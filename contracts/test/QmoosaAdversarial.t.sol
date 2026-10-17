// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/QmoosaFactory.sol";
import "../src/QmoosaPair.sol";
import "../src/QmoosaRouter.sol";
import "../src/test/MockERC20.sol";
import "../src/test/MaliciousReentrantToken.sol";

contract QmoosaAdversarialTest is Test {
    QmoosaFactory public factory;
    QmoosaRouter public router;
    MockERC20 public tokenA;
    MockERC20 public tokenB;

    address public feeToSetter = address(0xFA);
    address public feeTo = address(0xFB);
    address public attacker = address(0xBAD);
    address public user1 = address(0x101);
    address public user2 = address(0x102);

    function setUp() public {
        vm.prank(feeToSetter);
        factory = new QmoosaFactory(feeToSetter);
        router = new QmoosaRouter(address(factory));

        tokenA = new MockERC20("Token A", "TKNA", 18);
        tokenB = new MockERC20("Token B", "TKNB", 18);

        tokenA.mint(user1, 1_000_000 ether);
        tokenB.mint(user1, 1_000_000 ether);
        tokenA.mint(user2, 1_000_000 ether);
        tokenB.mint(user2, 1_000_000 ether);
        tokenA.mint(attacker, 1_000_000 ether);
        tokenB.mint(attacker, 1_000_000 ether);

        vm.prank(user1);
        tokenA.approve(address(router), type(uint256).max);
        vm.prank(user1);
        tokenB.approve(address(router), type(uint256).max);

        vm.prank(user2);
        tokenA.approve(address(router), type(uint256).max);
        vm.prank(user2);
        tokenB.approve(address(router), type(uint256).max);

        vm.prank(attacker);
        tokenA.approve(address(router), type(uint256).max);
        vm.prank(attacker);
        tokenB.approve(address(router), type(uint256).max);
    }

    function test_MultiUserLiquidityFairness() public {
        // User 1 provides initial liquidity
        vm.prank(user1);
        (,, uint256 lp1) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10_000 ether,
            10_000 ether,
            0,
            0,
            user1,
            block.timestamp + 100
        );

        // User 2 adds identical liquidity at same ratio
        vm.prank(user2);
        (,, uint256 lp2) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10_000 ether,
            10_000 ether,
            0,
            0,
            user2,
            block.timestamp + 100
        );

        // lp2 must equal lp1 + 1000 (since 1000 was permanently locked on first mint)
        assertEq(lp2, lp1 + 1000);

        address pair = factory.getPair(address(tokenA), address(tokenB));

        // User 2 burns all their LP tokens
        vm.startPrank(user2);
        QmoosaPair(pair).approve(address(router), type(uint256).max);
        (uint256 retA2, uint256 retB2) = router.removeLiquidity(
            address(tokenA),
            address(tokenB),
            lp2,
            0,
            0,
            user2,
            block.timestamp + 100
        );
        vm.stopPrank();

        // User 2 receives approximately their 10,000 ether deposit back
        assertApproxEqAbs(retA2, 10_000 ether, 1000);
        assertApproxEqAbs(retB2, 10_000 ether, 1000);
    }

    function test_AdministrativeFeeSetterPermissions() public {
        // Non-setter cannot change feeTo
        vm.prank(attacker);
        vm.expectRevert("FORBIDDEN");
        factory.setFeeTo(attacker);

        // Non-setter cannot change feeToSetter
        vm.prank(attacker);
        vm.expectRevert("FORBIDDEN");
        factory.setFeeToSetter(attacker);

        // Authorized feeToSetter can update feeTo
        vm.prank(feeToSetter);
        factory.setFeeTo(feeTo);
        assertEq(factory.feeTo(), feeTo);

        // Authorized feeToSetter can update feeToSetter
        address newSetter = address(0xFC);
        vm.prank(feeToSetter);
        factory.setFeeToSetter(newSetter);
        assertEq(factory.feeToSetter(), newSetter);
    }

    function test_ExtremeReserveOverflowProtection() public {
        address pair = factory.createPair(address(tokenA), address(tokenB));
        
        // Overflow uint112 reserve limit (type(uint112).max)
        uint256 overflowAmount = uint256(type(uint112).max) + 1;
        tokenA.mint(pair, overflowAmount);
        tokenB.mint(pair, 1 ether);

        // Minting should revert because uint112 balance check fails
        vm.expectRevert("OVERFLOW");
        QmoosaPair(pair).mint(user1);
    }

    function test_SandwichAttackDefeatedByRouterSlippage() public {
        // Initial liquidity
        vm.prank(user1);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100_000 ether,
            100_000 ether,
            0,
            0,
            user1,
            block.timestamp + 100
        );

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        // Target victim wants to swap 1,000 A for B with 0.5% max slippage
        uint256 victimAmountIn = 1_000 ether;
        uint256[] memory quotedAmounts = router.getAmountsOut(victimAmountIn, path);
        uint256 expectedOut = quotedAmounts[1];
        uint256 strictMinOut = (expectedOut * 995) / 1000;

        // Attacker front-runs with large trade manipulating reserves
        vm.prank(attacker);
        router.swapExactTokensForTokens(
            20_000 ether,
            0,
            path,
            attacker,
            block.timestamp + 100
        );

        // Victim transaction is executed with their strict slippage limit
        // The router MUST atomically revert the transaction, protecting user from sandwich!
        vm.prank(user2);
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        router.swapExactTokensForTokens(
            victimAmountIn,
            strictMinOut,
            path,
            user2,
            block.timestamp + 100
        );
    }

    function test_EIP2612PermitFunctionality() public {
        address pairAddr = factory.createPair(address(tokenA), address(tokenB));
        QmoosaPair pair = QmoosaPair(pairAddr);

        uint256 ownerPrivateKey = 0xBEEF;
        address owner = vm.addr(ownerPrivateKey);

        // Initial mint to owner
        tokenA.mint(pairAddr, 10_000 ether);
        tokenB.mint(pairAddr, 10_000 ether);
        pair.mint(owner);

        uint256 value = 100 ether;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = pair.nonces(owner);

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                pair.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        owner,
                        attacker,
                        value,
                        nonce,
                        deadline
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, digest);

        // Execute permit
        pair.permit(owner, attacker, value, deadline, v, r, s);

        assertEq(pair.allowance(owner, attacker), value);
        assertEq(pair.nonces(owner), nonce + 1);

        // Expired deadline rejects permit
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert("EXPIRED_PERMIT");
        pair.permit(owner, attacker, value, deadline, v, r, s);
    }
}
