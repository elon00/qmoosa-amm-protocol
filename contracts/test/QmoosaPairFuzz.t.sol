// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/QmoosaFactory.sol";
import "../src/QmoosaPair.sol";
import "../src/test/MockERC20.sol";

contract QmoosaPairFuzzTest is Test {
    QmoosaFactory public factory;
    QmoosaPair public pair;
    MockERC20 public token0;
    MockERC20 public token1;

    address public alice = address(0xAAAA);
    address public trader = address(0xBBBB);

    function setUp() public {
        factory = new QmoosaFactory(address(this));
        MockERC20 tA = new MockERC20("Token A", "TKA", 18);
        MockERC20 tB = new MockERC20("Token B", "TKB", 18);

        address pAddr = factory.createPair(address(tA), address(tB));
        pair = QmoosaPair(pAddr);

        if (address(tA) == pair.token0()) {
            token0 = tA;
            token1 = tB;
        } else {
            token0 = tB;
            token1 = tA;
        }

        // Fund Alice with deep initial liquidity
        token0.mint(alice, 10_000_000e18);
        token1.mint(alice, 10_000_000e18);

        vm.startPrank(alice);
        token0.transfer(address(pair), 1_000_000e18);
        token1.transfer(address(pair), 1_000_000e18);
        pair.mint(alice);
        vm.stopPrank();
    }

    /// @notice Property-based fuzz test: for any valid swap amountIn, k must NEVER decrease
    function testFuzz_SwapConstantProductInvariant(uint256 amount0In) public {
        // Bound amount0In between 1000 wei and 5,000,000e18 (5x initial reserves)
        amount0In = bound(amount0In, 1_000, 5_000_000e18);

        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 kBefore = uint256(r0) * r1;

        // Compute expected output: (amountIn * 997 * r1) / (r0 * 1000 + amountIn * 997)
        uint256 amountInWithFee = amount0In * 997;
        uint256 numerator = amountInWithFee * r1;
        uint256 denominator = (uint256(r0) * 1000) + amountInWithFee;
        uint256 amount1Out = numerator / denominator;

        if (amount1Out == 0 || amount1Out >= r1) {
            return;
        }

        token0.mint(trader, amount0In);

        vm.startPrank(trader);
        token0.transfer(address(pair), amount0In);
        pair.swap(0, amount1Out, trader, "");
        vm.stopPrank();

        (uint112 r0After, uint112 r1After,) = pair.getReserves();
        uint256 kAfter = uint256(r0After) * r1After;

        assertTrue(kAfter >= kBefore, "CRITICAL: Constant product k invariant decreased during swap!");
    }

    /// @notice Property-based fuzz test: subsequent liquidity deposits mint proportional shares
    function testFuzz_ProportionalLiquidityMinting(uint256 multiplier) public {
        multiplier = bound(multiplier, 1, 1000); // 1x to 1000x

        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 totalLpBefore = pair.totalSupply();

        uint256 deposit0 = uint256(r0) * multiplier / 10;
        uint256 deposit1 = uint256(r1) * multiplier / 10;

        token0.mint(trader, deposit0);
        token1.mint(trader, deposit1);

        vm.startPrank(trader);
        token0.transfer(address(pair), deposit0);
        token1.transfer(address(pair), deposit1);
        uint256 lpMinted = pair.mint(trader);
        vm.stopPrank();

        uint256 expectedLp = (totalLpBefore * multiplier) / 10;
        assertEq(lpMinted, expectedLp, "Minted LP shares must match exact deposit proportion");
    }
}
