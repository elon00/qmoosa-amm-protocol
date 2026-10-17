// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./interfaces/IQmoosaRouter.sol";
import "./interfaces/IQmoosaFactory.sol";
import "./interfaces/IQmoosaPair.sol";
import "./libraries/SafeTransfer.sol";

/**
 * @title QmoosaRouter
 * @notice Atomic execution router for the Qmoosa AMM protocol.
 * Enforces transaction deadlines, user-specified slippage boundaries,
 * multi-hop routing, and safe token transfers.
 */
contract QmoosaRouter is IQmoosaRouter {
    address public immutable override factory;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "EXPIRED");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "ZERO_ADDRESS");
        factory = _factory;
    }

    // =========================================================================
    // LIBRARY HELPERS
    // =========================================================================

    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ZERO_ADDRESS");
    }

    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) public pure override returns (uint256 amountB) {
        require(amountA > 0, "INSUFFICIENT_AMOUNT");
        require(reserveA > 0 && reserveB > 0, "INSUFFICIENT_LIQUIDITY");
        amountB = (amountA * reserveB) / reserveA;
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure override returns (uint256 amountOut) {
        require(amountIn > 0, "INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function getAmountsOut(uint256 amountIn, address[] memory path) public view override returns (uint256[] memory amounts) {
        require(path.length >= 2, "INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 0; i < path.length - 1; i++) {
            address pair = IQmoosaFactory(factory).getPair(path[i], path[i + 1]);
            require(pair != address(0), "PAIR_DOES_NOT_EXIST");
            (address token0,) = sortTokens(path[i], path[i + 1]);
            (uint112 reserve0, uint112 reserve1,) = IQmoosaPair(pair).getReserves();
            (uint256 reserveIn, uint256 reserveOut) = path[i] == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    // =========================================================================
    // LIQUIDITY MANAGEMENT
    // =========================================================================

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal returns (uint256 amountA, uint256 amountB) {
        address pair = IQmoosaFactory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) {
            pair = IQmoosaFactory(factory).createPair(tokenA, tokenB);
        }
        (address token0,) = sortTokens(tokenA, tokenB);
        (uint112 reserve0, uint112 reserve1,) = IQmoosaPair(pair).getReserves();
        (uint256 reserveA, uint256 reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);

        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, "INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external override ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = IQmoosaFactory(factory).getPair(tokenA, tokenB);
        SafeTransfer.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        SafeTransfer.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = IQmoosaPair(pair).mint(to);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external override ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pair = IQmoosaFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "PAIR_DOES_NOT_EXIST");
        // Transfer LP tokens to pair
        SafeTransfer.safeTransferFrom(pair, msg.sender, pair, liquidity);
        (uint256 amount0, uint256 amount1) = IQmoosaPair(pair).burn(to);
        (address token0,) = sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, "INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "INSUFFICIENT_B_AMOUNT");
    }

    // =========================================================================
    // SWAP EXECUTION
    // =========================================================================

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override ensure(deadline) returns (uint256[] memory amounts) {
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");

        address firstPair = IQmoosaFactory(factory).getPair(path[0], path[1]);
        require(firstPair != address(0), "PAIR_DOES_NOT_EXIST");

        SafeTransfer.safeTransferFrom(path[0], msg.sender, firstPair, amounts[0]);
        _swap(amounts, path, to);
    }

    function _swap(uint256[] memory amounts, address[] memory path, address _to) internal {
        for (uint256 i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address recipient = i < path.length - 2 ? IQmoosaFactory(factory).getPair(output, path[i + 2]) : _to;
            address pair = IQmoosaFactory(factory).getPair(input, output);
            IQmoosaPair(pair).swap(amount0Out, amount1Out, recipient, new bytes(0));
        }
    }
}
