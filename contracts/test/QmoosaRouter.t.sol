// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/QmoosaFactory.sol";
import "../src/QmoosaPair.sol";
import "../src/QmoosaRouter.sol";
import "../src/test/MockERC20.sol";

contract QmoosaRouterTest is Test {
    QmoosaFactory public factory;
    QmoosaRouter public router;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public tokenC;

    address public user = address(0x1111);
    address public feeToSetter = address(0xFEE5);

    function setUp() public {
        vm.prank(feeToSetter);
        factory = new QmoosaFactory(feeToSetter);
        router = new QmoosaRouter(address(factory));

        tokenA = new MockERC20("USD Coin", "USDC", 6);
        tokenB = new MockERC20("Ether", "ETH", 18);
        tokenC = new MockERC20("Dai", "DAI", 18);

        // Fund user
        tokenA.mint(user, 1_000_000 * 10 ** 6);
        tokenB.mint(user, 1_000 * 10 ** 18);
        tokenC.mint(user, 1_000_000 * 10 ** 18);

        vm.startPrank(user);
        tokenA.approve(address(router), type(uint256).max);
        tokenB.approve(address(router), type(uint256).max);
        tokenC.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    function test_AddLiquidityOptimal() public {
        vm.startPrank(user);
        (uint256 amountA, uint256 amountB, uint256 liquidity) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            user,
            block.timestamp + 1000
        );
        vm.stopPrank();

        assertEq(amountA, 50_000 * 10 ** 6);
        assertEq(amountB, 25 * 10 ** 18);
        assertTrue(liquidity > 0);

        address pair = factory.getPair(address(tokenA), address(tokenB));
        assertTrue(pair != address(0));

        (uint112 r0, uint112 r1,) = IQmoosaPair(pair).getReserves();
        assertTrue(r0 > 0 && r1 > 0);
    }

    function test_SwapExactTokensForTokensSuccess() public {
        // Setup initial pool
        vm.startPrank(user);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            user,
            block.timestamp + 1000
        );

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        uint256 amountIn = 1_000 * 10 ** 6; // 1,000 USDC
        uint256[] memory expectedAmounts = router.getAmountsOut(amountIn, path);
        uint256 expectedOut = expectedAmounts[1];
        uint256 minAmountOut = (expectedOut * 995) / 1000; // 0.5% slippage

        uint256 balBBefore = tokenB.balanceOf(user);
        uint256[] memory actualAmounts = router.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            user,
            block.timestamp + 1000
        );
        vm.stopPrank();

        assertEq(actualAmounts[1], expectedOut);
        assertEq(tokenB.balanceOf(user) - balBBefore, expectedOut);
    }

    function test_SwapRevertOnHighSlippage() public {
        vm.startPrank(user);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            user,
            block.timestamp + 1000
        );

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        uint256 amountIn = 1_000 * 10 ** 6;
        uint256[] memory expectedAmounts = router.getAmountsOut(amountIn, path);
        uint256 expectedOut = expectedAmounts[1];

        // Intentionally require more than output
        uint256 unreasonableMinOut = expectedOut + 1;

        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        router.swapExactTokensForTokens(
            amountIn,
            unreasonableMinOut,
            path,
            user,
            block.timestamp + 1000
        );
        vm.stopPrank();
    }

    function test_SwapRevertOnExpiredDeadline() public {
        vm.startPrank(user);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            user,
            block.timestamp + 1000
        );

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        vm.expectRevert("EXPIRED");
        router.swapExactTokensForTokens(
            1_000 * 10 ** 6,
            0,
            path,
            user,
            block.timestamp - 1
        );
        vm.stopPrank();
    }

    function test_RemoveLiquidityProportional() public {
        vm.startPrank(user);
        (,, uint256 liquidity) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            user,
            block.timestamp + 1000
        );

        address pair = factory.getPair(address(tokenA), address(tokenB));
        QmoosaPair(pair).approve(address(router), type(uint256).max);

        uint256 removeLp = liquidity / 2;
        (uint256 amountA, uint256 amountB) = router.removeLiquidity(
            address(tokenA),
            address(tokenB),
            removeLp,
            24_000 * 10 ** 6,
            12 * 10 ** 18,
            user,
            block.timestamp + 1000
        );
        vm.stopPrank();

        assertTrue(amountA >= 24_000 * 10 ** 6);
        assertTrue(amountB >= 12 * 10 ** 18);
    }

    function test_MultiHopSwap() public {
        vm.startPrank(user);
        // Pair 1: A / B (USDC / ETH)
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            0,
            0,
            user,
            block.timestamp + 1000
        );

        // Pair 2: B / C (ETH / DAI)
        router.addLiquidity(
            address(tokenB),
            address(tokenC),
            25 * 10 ** 18,
            50_000 * 10 ** 18,
            0,
            0,
            user,
            block.timestamp + 1000
        );

        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);

        uint256 amountIn = 1_000 * 10 ** 6; // 1,000 USDC
        uint256[] memory amountsOut = router.getAmountsOut(amountIn, path);
        uint256 expectedFinalDai = amountsOut[2];

        uint256 balCBefore = tokenC.balanceOf(user);
        uint256[] memory actualAmounts = router.swapExactTokensForTokens(
            amountIn,
            (expectedFinalDai * 99) / 100, // 1% slippage
            path,
            user,
            block.timestamp + 1000
        );
        vm.stopPrank();

        assertEq(actualAmounts[2], expectedFinalDai);
        assertEq(tokenC.balanceOf(user) - balCBefore, expectedFinalDai);
    }

    function test_AtomicRollbackOnFailure() public {
        vm.startPrank(user);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            50_000 * 10 ** 6,
            25 * 10 ** 18,
            0,
            0,
            user,
            block.timestamp + 1000
        );

        address pair = factory.getPair(address(tokenA), address(tokenB));
        (uint112 r0Before, uint112 r1Before,) = IQmoosaPair(pair).getReserves();
        uint256 balABefore = tokenA.balanceOf(user);
        uint256 balBBefore = tokenB.balanceOf(user);

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        // Expect revert due to slippage
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        router.swapExactTokensForTokens(
            1_000 * 10 ** 6,
            100 * 10 ** 18, // Impossible output
            path,
            user,
            block.timestamp + 1000
        );
        vm.stopPrank();

        // Verify total state preservation
        (uint112 r0After, uint112 r1After,) = IQmoosaPair(pair).getReserves();
        assertEq(r0Before, r0After);
        assertEq(r1Before, r1After);
        assertEq(tokenA.balanceOf(user), balABefore);
        assertEq(tokenB.balanceOf(user), balBBefore);
    }
}
