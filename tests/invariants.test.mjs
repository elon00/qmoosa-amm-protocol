import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateFeeBps,
  canonicalizeTokenPair,
  verifyConstantProductInvariant,
  getAmountOut,
  getAmountIn,
  calculateInitialLpTokens,
  computeOptimalDeposit,
  calculateLiquidityRemoval,
  MINIMUM_LIQUIDITY
} from "../dist/index.js";

describe("Protocol Mathematical Invariants & Bounds", () => {
  test("Fee validation enforces [1, 1000] range", () => {
    assert.doesNotThrow(() => validateFeeBps(1));
    assert.doesNotThrow(() => validateFeeBps(30));
    assert.doesNotThrow(() => validateFeeBps(1000));
    assert.throws(() => validateFeeBps(0), /INVALID_FEE_BPS/);
    assert.throws(() => validateFeeBps(1001), /INVALID_FEE_BPS/);
    assert.throws(() => validateFeeBps(30.5), /INVALID_FEE_BPS/);
  });

  test("Token pair canonicalization orders and prevents identical tokens", () => {
    const [t0, t1] = canonicalizeTokenPair("USDC", "ETH");
    assert.equal(t0, "ETH");
    assert.equal(t1, "USDC");

    assert.throws(() => canonicalizeTokenPair("ETH", "ETH"), /IDENTICAL_ADDRESSES/);
    assert.throws(() => canonicalizeTokenPair("", "USDC"), /INVALID_TOKEN_IDENTIFIER/);
  });

  test("Constant product invariant strictly holds for valid swaps", () => {
    const rIn = 1000000n;
    const rOut = 2000000n;
    const amountIn = 10000n;
    const amountOut = getAmountOut(amountIn, rIn, rOut, 30);
    assert.equal(verifyConstantProductInvariant(rIn, rOut, amountIn, amountOut, 30), true);
  });

  test("Initial LP calculation locks exactly MINIMUM_LIQUIDITY", () => {
    const a = 1000000n;
    const b = 1000000n;
    const lp = calculateInitialLpTokens(a, b);
    assert.equal(lp, 1000000n - MINIMUM_LIQUIDITY);
  });

  test("Optimal deposit computation prevents mispriced liquidity and refunds excess", () => {
    const reserveA = 100000n;
    const reserveB = 200000n; // 1:2 ratio

    // User provides 10,000 A and 25,000 B (excess B provided)
    const { amountA, amountB, refundA, refundB } = computeOptimalDeposit(
      10000n, 25000n, 10000n, 20000n, reserveA, reserveB
    );

    assert.equal(amountA, 10000n);
    assert.equal(amountB, 20000n); // exactly matched 1:2 ratio
    assert.equal(refundA, 0n);
    assert.equal(refundB, 5000n);  // 5,000 B refunded to user
  });

  test("Liquidity removal burns proportional shares and protects locked liquidity", () => {
    const totalLp = 1000000n;
    const rA = 5000000n;
    const rB = 10000000n;
    const lpToBurn = 100000n; // 10% of total LP

    const { amountA, amountB } = calculateLiquidityRemoval(lpToBurn, rA, rB, totalLp, 0n, 0n);
    assert.equal(amountA, 500000n);
    assert.equal(amountB, 1000000n);

    // Attempting to burn locked minimum liquidity throws
    assert.throws(() => calculateLiquidityRemoval(totalLp, rA, rB, totalLp), /INSUFFICIENT_LIQUIDITY/);
  });
});
