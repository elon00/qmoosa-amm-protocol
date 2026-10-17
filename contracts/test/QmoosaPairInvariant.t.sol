// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/QmoosaFactory.sol";
import "../src/QmoosaPair.sol";
import "../src/test/MockERC20.sol";

contract PairHandler is Test {
    QmoosaPair public pair;
    MockERC20 public token0;
    MockERC20 public token1;

    uint256 public ghost_kBefore;

    constructor(QmoosaPair _pair, MockERC20 _token0, MockERC20 _token1) {
        pair = _pair;
        token0 = _token0;
        token1 = _token1;
    }

    function swap0(uint256 amountIn) public {
        amountIn = bound(amountIn, 1_000, 100_000e18);
        (uint112 r0, uint112 r1,) = pair.getReserves();
        if (r0 == 0 || r1 == 0) return;

        ghost_kBefore = uint256(r0) * r1;

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * r1;
        uint256 denominator = (uint256(r0) * 1000) + amountInWithFee;
        uint256 amount1Out = numerator / denominator;

        if (amount1Out == 0 || amount1Out >= r1) return;

        token0.mint(address(this), amountIn);
        token0.transfer(address(pair), amountIn);
        pair.swap(0, amount1Out, address(this), "");
    }

    function swap1(uint256 amountIn) public {
        amountIn = bound(amountIn, 1_000, 100_000e18);
        (uint112 r0, uint112 r1,) = pair.getReserves();
        if (r0 == 0 || r1 == 0) return;

        ghost_kBefore = uint256(r0) * r1;

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * r0;
        uint256 denominator = (uint256(r1) * 1000) + amountInWithFee;
        uint256 amount0Out = numerator / denominator;

        if (amount0Out == 0 || amount0Out >= r0) return;

        token1.mint(address(this), amountIn);
        token1.transfer(address(pair), amountIn);
        pair.swap(amount0Out, 0, address(this), "");
    }
}

contract QmoosaPairInvariantTest is StdInvariant, Test {
    QmoosaFactory public factory;
    QmoosaPair public pair;
    MockERC20 public token0;
    MockERC20 public token1;
    PairHandler public handler;

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

        // Initial liquidity
        token0.mint(address(this), 1_000_000e18);
        token1.mint(address(this), 1_000_000e18);
        token0.transfer(address(pair), 1_000_000e18);
        token1.transfer(address(pair), 1_000_000e18);
        pair.mint(address(this));

        handler = new PairHandler(pair, token0, token1);
        targetContract(address(handler));
    }

    /// @notice Invariant: k must be greater than or equal to initial k
    function invariant_ConstantProductNonDecreasing() public view {
        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 kCurrent = uint256(r0) * r1;
        uint256 kInitial = 1_000_000e18 * 1_000_000e18;
        assertTrue(kCurrent >= kInitial, "Invariant violated: k < initial k");
    }

    /// @notice Invariant: Total LP supply must always be >= MINIMUM_LIQUIDITY
    function invariant_TotalSupplyAlwaysAboveMinimum() public view {
        assertTrue(pair.totalSupply() >= pair.MINIMUM_LIQUIDITY());
    }
}
