// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/QmoosaFactory.sol";
import "../src/QmoosaPair.sol";
import "../src/test/MockERC20.sol";
import "../src/test/MaliciousReentrantToken.sol";

contract QmoosaPairTest is Test {
    QmoosaFactory public factory;
    QmoosaPair public pair;
    MockERC20 public token0;
    MockERC20 public token1;

    address public alice = address(0x1111);
    address public bob = address(0x2222);

    function setUp() public {
        factory = new QmoosaFactory(address(this));
        MockERC20 tA = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 tB = new MockERC20("Wrapped Ether", "WETH", 18);

        address pAddr = factory.createPair(address(tA), address(tB));
        pair = QmoosaPair(pAddr);

        // Map token0 and token1 according to pair canonical ordering
        if (address(tA) == pair.token0()) {
            token0 = tA;
            token1 = tB;
        } else {
            token0 = tB;
            token1 = tA;
        }

        // Fund Alice and Bob
        token0.mint(alice, 100_000e18);
        token1.mint(alice, 100_000e18);
        token0.mint(bob, 100_000e18);
        token1.mint(bob, 100_000e18);
    }

    function test_InitialLiquidityLocksMinimum() public {
        uint256 amount0 = 1000e6;
        uint256 amount1 = 1000e18;

        vm.startPrank(alice);
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        uint256 lpMinted = pair.mint(alice);
        vm.stopPrank();

        uint256 expectedTotal = 1000e12; // sqrt(1000e6 * 1000e18) = 1e15
        uint256 expectedLp = expectedTotal - pair.MINIMUM_LIQUIDITY();

        assertEq(lpMinted, expectedLp);
        assertEq(pair.balanceOf(alice), expectedLp);
        assertEq(pair.balanceOf(address(0)), pair.MINIMUM_LIQUIDITY(), "1000 shares must be permanently locked");
        assertEq(pair.totalSupply(), expectedTotal);

        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertEq(r0, uint112(amount0));
        assertEq(r1, uint112(amount1));
    }

    function test_SubsequentLiquidityMinting() public {
        // Initial deposit
        vm.startPrank(alice);
        token0.transfer(address(pair), 10_000e6);
        token1.transfer(address(pair), 10_000e18);
        pair.mint(alice);
        vm.stopPrank();

        uint256 lpBefore = pair.totalSupply();

        // Bob deposits 50% more liquidity
        vm.startPrank(bob);
        token0.transfer(address(pair), 5_000e6);
        token1.transfer(address(pair), 5_000e18);
        uint256 bobLp = pair.mint(bob);
        vm.stopPrank();

        assertEq(bobLp, lpBefore / 2, "Bob must receive exactly proportional 50% LP shares");
        assertEq(pair.balanceOf(bob), bobLp);
    }

    function test_BurnLiquidityProportional() public {
        // Alice deposits liquidity
        vm.startPrank(alice);
        token0.transfer(address(pair), 10_000e6);
        token1.transfer(address(pair), 10_000e18);
        uint256 lpAlice = pair.mint(alice);

        // Alice burns all her LP shares
        pair.transfer(address(pair), lpAlice);
        (uint256 a0, uint256 a1) = pair.burn(alice);
        vm.stopPrank();

        assertTrue(a0 > 0 && a1 > 0);
        // Balance remaining in pair is exactly the locked minimum liquidity
        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertTrue(r0 > 0 && r1 > 0, "Reserves must remain non-zero for locked minimum shares");
        assertEq(pair.totalSupply(), pair.MINIMUM_LIQUIDITY());
    }

    function test_SwapConstantProductAndFee() public {
        // Setup initial pool: 50,000 token0 and 25 token1
        vm.startPrank(alice);
        token0.transfer(address(pair), 50_000e6);
        token1.transfer(address(pair), 25e18);
        pair.mint(alice);
        vm.stopPrank();

        (uint112 r0Before, uint112 r1Before,) = pair.getReserves();
        uint256 kBefore = uint256(r0Before) * r1Before;

        // Bob swaps 1,000 token0 for token1
        uint256 amount0In = 1_000e6;
        // Output formula with 0.3% fee: (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
        uint256 amountInWithFee = amount0In * 997;
        uint256 numerator = amountInWithFee * r1Before;
        uint256 denominator = (uint256(r0Before) * 1000) + amountInWithFee;
        uint256 expectedAmount1Out = numerator / denominator;

        vm.startPrank(bob);
        token0.transfer(address(pair), amount0In);
        uint256 bobToken1Before = token1.balanceOf(bob);
        pair.swap(0, expectedAmount1Out, bob, "");
        vm.stopPrank();

        uint256 bobToken1After = token1.balanceOf(bob);
        assertEq(bobToken1After - bobToken1Before, expectedAmount1Out);

        (uint112 r0After, uint112 r1After,) = pair.getReserves();
        uint256 kAfter = uint256(r0After) * r1After;
        assertTrue(kAfter >= kBefore, "k invariant must never decrease after fee-adjusted swap");
    }

    function test_ZeroOutputReversion() public {
        vm.startPrank(alice);
        token0.transfer(address(pair), 10_000e6);
        token1.transfer(address(pair), 10_000e18);
        pair.mint(alice);

        // Attempting swap with 0 output
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        pair.swap(0, 0, alice, "");
        vm.stopPrank();
    }

    function test_InsufficientLiquidityReversion() public {
        vm.startPrank(alice);
        token0.transfer(address(pair), 10_000e6);
        token1.transfer(address(pair), 10_000e18);
        pair.mint(alice);

        // Requesting output equal or greater than reserves
        (uint112 r0,,) = pair.getReserves();
        vm.expectRevert("INSUFFICIENT_LIQUIDITY");
        pair.swap(r0, 0, alice, "");
        vm.stopPrank();
    }

    function test_AdversarialReentrancyReverted() public {
        // Deploy malicious reentrant token
        MaliciousReentrantToken malToken = new MaliciousReentrantToken();
        address evilPairAddr = factory.createPair(address(malToken), address(token1));
        QmoosaPair evilPair = QmoosaPair(evilPairAddr);

        malToken.setTarget(evilPairAddr);

        // Seed liquidity
        malToken.mint(alice, 100_000e18);
        token1.mint(alice, 100_000e18);

        vm.startPrank(alice);
        malToken.transfer(evilPairAddr, 10_000e18);
        token1.transfer(evilPairAddr, 10_000e18);
        evilPair.mint(alice);
        vm.stopPrank();

        // Perform swap that sends malToken to Bob - malToken tries to re-enter evilPair during transfer!
        token1.mint(bob, 100e18);
        vm.startPrank(bob);
        token1.transfer(evilPairAddr, 100e18);

        evilPair.swap(10e18, 0, bob, "");
        vm.stopPrank();

        assertTrue(malToken.attackTriggered(), "Attack callback must have been triggered");
        assertFalse(malToken.reentrancySucceeded(), "Reentrant call must NOT succeed");
        assertEq(malToken.reentrancyRevertReason(), "LOCKED", "Reentrant call must revert with LOCKED");
    }

    function test_SkimAndSync() public {
        vm.startPrank(alice);
        token0.transfer(address(pair), 10_000e6);
        token1.transfer(address(pair), 10_000e18);
        pair.mint(alice);

        // Donor donates 5,000 extra token0 directly to the contract (unbacked)
        token0.transfer(address(pair), 5_000e6);
        vm.stopPrank();

        (uint112 r0Before, uint112 r1Before,) = pair.getReserves();
        assertEq(token0.balanceOf(address(pair)), uint256(r0Before) + 5_000e6);

        // Bob skims the unbacked excess tokens
        uint256 bobT0Before = token0.balanceOf(bob);
        pair.skim(bob);
        uint256 bobT0After = token0.balanceOf(bob);
        assertEq(bobT0After - bobT0Before, 5_000e6);

        // Reserves remain intact
        (uint112 r0After, uint112 r1After,) = pair.getReserves();
        assertEq(r0Before, r0After);
        assertEq(r1Before, r1After);
    }
}
