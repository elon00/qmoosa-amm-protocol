/**
 * QMOOSA AMM MATHEMATICAL INVARIANTS
 * Pure mathematical functions for Constant Product (x * y = k) AMM.
 * Implements strict integer arithmetic, round-down protection favoring the pool,
 * and invariant verification.
 */

import { AmmErrorCode } from "../interfaces/index.js";

export const BPS_DENOMINATOR = 10000n;
export const MINIMUM_LIQUIDITY = 1000n; // Permanently locked minimum liquidity on pool initialization

/**
 * Validates the constant-product invariant:
 * (reserveIn + amountInWithFee) * (reserveOut - amountOut) >= reserveIn * reserveOut
 */
export function verifyConstantProductInvariant(
  reserveIn: bigint,
  reserveOut: bigint,
  amountIn: bigint,
  amountOut: bigint,
  feeBps: number
): boolean {
  if (reserveIn <= 0n || reserveOut <= 0n) return false;
  if (amountIn <= 0n || amountOut <= 0n) return false;
  if (amountOut >= reserveOut) return false;

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
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number = 30
): bigint {
  if (amountIn <= 0n) {
    throw new Error(AmmErrorCode.ZERO_AMOUNT);
  }
  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error(AmmErrorCode.INSUFFICIENT_LIQUIDITY);
  }

  const feeNumerator = BPS_DENOMINATOR - BigInt(feeBps);
  const amountInWithFee = amountIn * feeNumerator;
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * BPS_DENOMINATOR) + amountInWithFee;

  return numerator / denominator;
}

/**
 * Calculates required input amount for exact output:
 * dx = (x * dy * 10000) / ((y - dy) * (1 - f)) + 1
 */
export function getAmountIn(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number = 30
): bigint {
  if (amountOut <= 0n) {
    throw new Error(AmmErrorCode.ZERO_AMOUNT);
  }
  if (reserveIn <= 0n || reserveOut <= 0n || amountOut >= reserveOut) {
    throw new Error(AmmErrorCode.INSUFFICIENT_LIQUIDITY);
  }

  const feeNumerator = BPS_DENOMINATOR - BigInt(feeBps);
  const numerator = reserveIn * amountOut * BPS_DENOMINATOR;
  const denominator = (reserveOut - amountOut) * feeNumerator;

  return (numerator / denominator) + 1n; // Round up to favor the pool
}

/**
 * Calculates initial LP tokens to mint: sqrt(amountA * amountB) - MINIMUM_LIQUIDITY
 */
export function calculateInitialLpTokens(amountA: bigint, amountB: bigint): bigint {
  const product = amountA * amountB;
  const root = sqrtBigInt(product);
  if (root <= MINIMUM_LIQUIDITY) {
    throw new Error(AmmErrorCode.INSUFFICIENT_LIQUIDITY);
  }
  return root - MINIMUM_LIQUIDITY;
}

/**
 * Calculates subsequent LP tokens for liquidity addition:
 * min((amountA * totalLp) / reserveA, (amountB * totalLp) / reserveB)
 */
export function calculateSubsequentLpTokens(
  amountA: bigint,
  amountB: bigint,
  reserveA: bigint,
  reserveB: bigint,
  totalLpSupply: bigint
): bigint {
  const lpA = (amountA * totalLpSupply) / reserveA;
  const lpB = (amountB * totalLpSupply) / reserveB;
  return lpA < lpB ? lpA : lpB;
}

/**
 * Square root for BigInt using Newton-Raphson approximation
 */
export function sqrtBigInt(n: bigint): bigint {
  if (n < 0n) throw new Error("Negative square root");
  if (n < 2n) return n;

  let x0 = n / 2n;
  let x1 = (x0 + n / x0) / 2n;

  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + n / x0) / 2n;
  }
  return x0;
}
