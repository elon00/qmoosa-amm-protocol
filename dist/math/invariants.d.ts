/**
 * QMOOSA AMM MATHEMATICAL INVARIANTS & BOUNDED ARITHMETIC
 * Pure mathematical functions for Constant Product (x * y = k) AMM.
 * Implements strict integer arithmetic, round-down protection favoring the pool,
 * optimal deposit ratio enforcement, fee validation, and invariant verification.
 */
export declare const BPS_DENOMINATOR = 10000n;
export declare const MINIMUM_LIQUIDITY = 1000n;
export declare const MIN_FEE_BPS = 1;
export declare const MAX_FEE_BPS = 1000;
/**
 * Validates fee basis points within strict mathematical bounds [1, 1000].
 */
export declare function validateFeeBps(feeBps: number): void;
/**
 * Validates and canonicalizes token identifiers.
 */
export declare function canonicalizeTokenPair(tokenA: string, tokenB: string): [string, string];
/**
 * Validates the constant-product invariant:
 * (reserveIn + amountInWithFee) * (reserveOut - amountOut) >= reserveIn * reserveOut
 */
export declare function verifyConstantProductInvariant(reserveIn: bigint, reserveOut: bigint, amountIn: bigint, amountOut: bigint, feeBps: number): boolean;
/**
 * Calculates swap output amount:
 * dy = (dx * (1 - f) * y) / (x * 10000 + dx * (1 - f))
 */
export declare function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, feeBps?: number): bigint;
/**
 * Calculates required input amount for exact output:
 * dx = (x * dy * 10000) / ((y - dy) * (1 - f)) + 1
 */
export declare function getAmountIn(amountOut: bigint, reserveIn: bigint, reserveOut: bigint, feeBps?: number): bigint;
/**
 * Calculates initial LP tokens to mint on empty pool:
 * lpTokens = sqrt(amountA * amountB) - MINIMUM_LIQUIDITY
 */
export declare function calculateInitialLpTokens(amountA: bigint, amountB: bigint): bigint;
/**
 * Computes optimal deposit amounts enforcing constant-ratio liquidity addition.
 * Refunds excess to prevent provider value extraction or unintended slippage.
 */
export declare function computeOptimalDeposit(amountADesired: bigint, amountBDesired: bigint, amountAMin: bigint, amountBMin: bigint, reserveA: bigint, reserveB: bigint): {
    amountA: bigint;
    amountB: bigint;
    refundA: bigint;
    refundB: bigint;
};
/**
 * Calculates subsequent LP tokens minted for verified optimal deposit amounts:
 * lpTokens = min((amountA * totalLp) / reserveA, (amountB * totalLp) / reserveB)
 */
export declare function calculateSubsequentLpTokens(amountA: bigint, amountB: bigint, reserveA: bigint, reserveB: bigint, totalLpSupply: bigint): bigint;
/**
 * Calculates assets returned upon burning LP tokens:
 * amountA = (lpTokensToBurn * reserveA) / totalLpSupply
 * amountB = (lpTokensToBurn * reserveB) / totalLpSupply
 */
export declare function calculateLiquidityRemoval(lpTokensToBurn: bigint, reserveA: bigint, reserveB: bigint, totalLpSupply: bigint, amountAMin?: bigint, amountBMin?: bigint): {
    amountA: bigint;
    amountB: bigint;
};
/**
 * Square root for BigInt using Newton-Raphson approximation
 */
export declare function sqrtBigInt(n: bigint): bigint;
