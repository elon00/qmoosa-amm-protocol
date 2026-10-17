/**
 * QMOOSA AMM MATHEMATICAL INVARIANTS & BOUNDED ARITHMETIC
 * Pure mathematical functions for Constant Product (x * y = k) AMM.
 * Implements strict integer arithmetic, round-down protection favoring the pool,
 * dual-sided optimal deposit bounds enforcement, fee validation, and invariant verification.
 */
import { AmmErrorCode } from "../interfaces/index.js";
export const BPS_DENOMINATOR = 10000n;
export const MINIMUM_LIQUIDITY = 1000n; // Permanently locked minimum liquidity on pool initialization
export const MIN_FEE_BPS = 1; // 0.01% minimum fee
export const MAX_FEE_BPS = 1000; // 10.00% maximum fee
export const MAX_SLIPPAGE_BPS = 5000; // 50.00% maximum acceptable slippage tolerance
/**
 * Validates fee basis points within strict mathematical bounds [1, 1000].
 */
export function validateFeeBps(feeBps) {
    if (!Number.isInteger(feeBps) || feeBps < MIN_FEE_BPS || feeBps > MAX_FEE_BPS) {
        throw new Error(`${AmmErrorCode.INVALID_FEE_BPS}: feeBps must be an integer between ${MIN_FEE_BPS} and ${MAX_FEE_BPS}`);
    }
}
/**
 * Validates slippage tolerance basis points within strict bounds (0, 5000].
 */
export function validateSlippageBps(slippageBps) {
    if (!Number.isInteger(slippageBps) || slippageBps <= 0 || slippageBps > MAX_SLIPPAGE_BPS) {
        throw new Error(`${AmmErrorCode.EXCESSIVE_SLIPPAGE}: slippageBps must be an integer between 1 and ${MAX_SLIPPAGE_BPS}`);
    }
}
/**
 * Validates and canonicalizes token identifiers respecting target asset identity policies.
 * EVM: Case-folded to lowercase for canonical matching.
 * Non-EVM (Solana/Bitcoin/Algorand): Case-sensitive preservation with lexicographic ordering.
 */
export function canonicalizeTokenPair(tokenA, tokenB, policy = "EVM_CASE_INSENSITIVE") {
    if (!tokenA || !tokenB || typeof tokenA !== "string" || typeof tokenB !== "string") {
        throw new Error(`${AmmErrorCode.INVALID_TOKEN_IDENTIFIER}: Token identifiers must be non-empty strings`);
    }
    const cleanA = tokenA.trim();
    const cleanB = tokenB.trim();
    if (cleanA.length === 0 || cleanB.length === 0) {
        throw new Error(`${AmmErrorCode.INVALID_TOKEN_IDENTIFIER}: Token identifiers cannot be empty or whitespace`);
    }
    const normA = policy === "EVM_CASE_INSENSITIVE" ? cleanA.toLowerCase() : cleanA;
    const normB = policy === "EVM_CASE_INSENSITIVE" ? cleanB.toLowerCase() : cleanB;
    if (normA === normB) {
        throw new Error(`${AmmErrorCode.IDENTICAL_ADDRESSES}: Cannot pair identical token identifiers (${cleanA})`);
    }
    return normA < normB ? [normA, normB] : [normB, normA];
}
/**
 * Validates the constant-product invariant:
 * (reserveIn + amountInWithFee) * (reserveOut - amountOut) >= reserveIn * reserveOut
 */
export function verifyConstantProductInvariant(reserveIn, reserveOut, amountIn, amountOut, feeBps) {
    validateFeeBps(feeBps);
    if (reserveIn <= 0n || reserveOut <= 0n)
        return false;
    if (amountIn <= 0n || amountOut <= 0n)
        return false;
    if (amountOut >= reserveOut)
        return false;
    const feeNumerator = BPS_DENOMINATOR - BigInt(feeBps);
    const amountInWithFee = amountIn * feeNumerator;
    const balanceInAdjusted = (reserveIn * BPS_DENOMINATOR) + amountInWithFee;
    const balanceOutAdjusted = reserveOut - amountOut;
    const kBefore = reserveIn * reserveOut * BPS_DENOMINATOR;
    const kAfter = balanceInAdjusted * balanceOutAdjusted;
    return kAfter >= kBefore;
}
/**
 * Calculates swap output amount:
 * dy = (dx * (1 - f) * y) / (x * 10000 + dx * (1 - f))
 */
export function getAmountOut(amountIn, reserveIn, reserveOut, feeBps = 30) {
    validateFeeBps(feeBps);
    if (amountIn <= 0n) {
        throw new Error(`${AmmErrorCode.ZERO_AMOUNT}: amountIn must be positive`);
    }
    if (reserveIn <= 0n || reserveOut <= 0n) {
        throw new Error(`${AmmErrorCode.INSUFFICIENT_LIQUIDITY}: Reserves must be strictly positive`);
    }
    const feeNumerator = BPS_DENOMINATOR - BigInt(feeBps);
    const amountInWithFee = amountIn * feeNumerator;
    const numerator = amountInWithFee * reserveOut;
    const denominator = (reserveIn * BPS_DENOMINATOR) + amountInWithFee;
    return numerator / denominator; // Integer truncation rounds down in favor of pool
}
/**
 * Calculates required input amount for exact output:
 * dx = (x * dy * 10000) / ((y - dy) * (1 - f)) + 1
 */
export function getAmountIn(amountOut, reserveIn, reserveOut, feeBps = 30) {
    validateFeeBps(feeBps);
    if (amountOut <= 0n) {
        throw new Error(`${AmmErrorCode.ZERO_AMOUNT}: amountOut must be positive`);
    }
    if (reserveIn <= 0n || reserveOut <= 0n || amountOut >= reserveOut) {
        throw new Error(`${AmmErrorCode.INSUFFICIENT_LIQUIDITY}: reserveOut insufficient for requested amountOut`);
    }
    const feeNumerator = BPS_DENOMINATOR - BigInt(feeBps);
    const numerator = reserveIn * amountOut * BPS_DENOMINATOR;
    const denominator = (reserveOut - amountOut) * feeNumerator;
    return (numerator / denominator) + 1n; // Round up in favor of pool
}
/**
 * Calculates initial LP tokens to mint on empty pool:
 * lpTokens = sqrt(amountA * amountB) - MINIMUM_LIQUIDITY
 */
export function calculateInitialLpTokens(amountA, amountB) {
    if (amountA <= 0n || amountB <= 0n) {
        throw new Error(`${AmmErrorCode.ZERO_AMOUNT}: Initial deposits must be positive`);
    }
    const product = amountA * amountB;
    const root = sqrtBigInt(product);
    if (root <= MINIMUM_LIQUIDITY) {
        throw new Error(`${AmmErrorCode.INSUFFICIENT_LIQUIDITY}: Initial deposit too low to satisfy minimum liquidity lock`);
    }
    return root - MINIMUM_LIQUIDITY;
}
/**
 * Computes optimal deposit amounts enforcing constant-ratio liquidity addition.
 * Enforces strict validation of both minimum thresholds and guarantees positive asset & LP issuance.
 */
export function computeOptimalDeposit(amountADesired, amountBDesired, amountAMin, amountBMin, reserveA, reserveB, totalLpSupply) {
    // 1. Strict positive desired amounts
    if (amountADesired <= 0n || amountBDesired <= 0n) {
        throw new Error(`${AmmErrorCode.ZERO_AMOUNT}: Desired amounts must be strictly positive`);
    }
    // 2. Strict non-negative and valid minimum thresholds
    if (amountAMin < 0n || amountBMin < 0n) {
        throw new Error(`${AmmErrorCode.ZERO_AMOUNT}: Minimum bounds cannot be negative`);
    }
    if (amountAMin > amountADesired) {
        throw new Error(`${AmmErrorCode.EXCESSIVE_SLIPPAGE}: amountAMin (${amountAMin}) exceeds amountADesired (${amountADesired})`);
    }
    if (amountBMin > amountBDesired) {
        throw new Error(`${AmmErrorCode.EXCESSIVE_SLIPPAGE}: amountBMin (${amountBMin}) exceeds amountBDesired (${amountBDesired})`);
    }
    if (reserveA <= 0n || reserveB <= 0n || totalLpSupply <= 0n) {
        throw new Error(`${AmmErrorCode.INSUFFICIENT_LIQUIDITY}: Pool reserves and total supply must be strictly positive`);
    }
    let actualA;
    let actualB;
    let refundA = 0n;
    let refundB = 0n;
    const amountBOptimal = (amountADesired * reserveB) / reserveA;
    if (amountBOptimal <= amountBDesired) {
        actualA = amountADesired;
        actualB = amountBOptimal;
        refundB = amountBDesired - amountBOptimal;
    }
    else {
        const amountAOptimal = (amountBDesired * reserveA) / reserveB;
        if (amountAOptimal > amountADesired) {
            throw new Error(`${AmmErrorCode.SUB_OPTIMAL_RATIO}: Inconsistent optimal calculation`);
        }
        actualA = amountAOptimal;
        actualB = amountBDesired;
        refundA = amountADesired - amountAOptimal;
    }
    // 3. Enforce both minimum bounds strictly on actual deposit amounts
    if (actualA < amountAMin) {
        throw new Error(`${AmmErrorCode.EXCESSIVE_SLIPPAGE}: Actual deposit A (${actualA}) < required minimum (${amountAMin})`);
    }
    if (actualB < amountBMin) {
        throw new Error(`${AmmErrorCode.EXCESSIVE_SLIPPAGE}: Actual deposit B (${actualB}) < required minimum (${amountBMin})`);
    }
    // 4. Enforce non-zero asset deposits
    if (actualA <= 0n || actualB <= 0n) {
        throw new Error(`${AmmErrorCode.ZERO_AMOUNT}: Optimal deposit calculated to zero asset`);
    }
    // 5. Calculate LP tokens to mint and ensure > 0
    const lpA = (actualA * totalLpSupply) / reserveA;
    const lpB = (actualB * totalLpSupply) / reserveB;
    const lpTokensMinted = lpA < lpB ? lpA : lpB;
    if (lpTokensMinted <= 0n) {
        throw new Error(`${AmmErrorCode.INSUFFICIENT_LIQUIDITY}: Deposit yields 0 LP tokens minted due to extreme dilution or rounding`);
    }
    return { amountA: actualA, amountB: actualB, refundA, refundB, lpTokensMinted };
}
/**
 * Calculates assets returned upon burning LP tokens:
 * amountA = (lpTokensToBurn * reserveA) / totalLpSupply
 * amountB = (lpTokensToBurn * reserveB) / totalLpSupply
 */
export function calculateLiquidityRemoval(lpTokensToBurn, reserveA, reserveB, totalLpSupply, amountAMin = 0n, amountBMin = 0n) {
    if (lpTokensToBurn <= 0n) {
        throw new Error(`${AmmErrorCode.ZERO_AMOUNT}: lpTokensToBurn must be strictly positive`);
    }
    if (totalLpSupply <= 0n || reserveA <= 0n || reserveB <= 0n) {
        throw new Error(`${AmmErrorCode.INSUFFICIENT_LIQUIDITY}: Pool reserves or supply exhausted`);
    }
    if (lpTokensToBurn > totalLpSupply - MINIMUM_LIQUIDITY) {
        throw new Error(`${AmmErrorCode.INSUFFICIENT_LIQUIDITY}: Cannot burn locked minimum liquidity`);
    }
    const amountA = (lpTokensToBurn * reserveA) / totalLpSupply;
    const amountB = (lpTokensToBurn * reserveB) / totalLpSupply;
    if (amountA <= 0n && amountB <= 0n) {
        throw new Error(`${AmmErrorCode.ZERO_AMOUNT}: Redeemed amounts calculate to zero`);
    }
    if (amountA < amountAMin) {
        throw new Error(`${AmmErrorCode.EXCESSIVE_SLIPPAGE}: Redeemed amountA (${amountA}) < min (${amountAMin})`);
    }
    if (amountB < amountBMin) {
        throw new Error(`${AmmErrorCode.EXCESSIVE_SLIPPAGE}: Redeemed amountB (${amountB}) < min (${amountBMin})`);
    }
    return { amountA, amountB };
}
/**
 * Square root for BigInt using Newton-Raphson approximation
 */
export function sqrtBigInt(n) {
    if (n < 0n)
        throw new Error("Negative square root");
    if (n < 2n)
        return n;
    let x0 = n / 2n;
    let x1 = (x0 + n / x0) / 2n;
    while (x1 < x0) {
        x0 = x1;
        x1 = (x0 + n / x0) / 2n;
    }
    return x0;
}
