import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateFeeBps,
  validateSlippageBps,
  canonicalizeTokenPair,
  verifyConstantProductInvariant,
  getAmountOut,
  getAmountIn,
  calculateInitialLpTokens,
  computeOptimalDeposit,
  calculateLiquidityRemoval,
  MINIMUM_LIQUIDITY
} from "../dist/index.js";

describe("Protocol Mathematical Invariants & Bounded Arithmetic", () => {
  test("Fee validation enforces [1, 1000] range", () => {
    assert.doesNotThrow(() => validateFeeBps(1));
    assert.doesNotThrow(() => validateFeeBps(30));
    assert.doesNotThrow(() => validateFeeBps(1000));
    assert.throws(() => validateFeeBps(0), /INVALID_FEE_BPS/);
    assert.throws(() => validateFeeBps(1001), /INVALID_FEE_BPS/);
    assert.throws(() => validateFeeBps(30.5), /INVALID_FEE_BPS/);
  });

  test("Slippage validation enforces (0, 5000] range", () => {
    assert.doesNotThrow(() => validateSlippageBps(1));
    assert.doesNotThrow(() => validateSlippageBps(50));
    assert.doesNotThrow(() => validateSlippageBps(5000));
    assert.throws(() => validateSlippageBps(0), /AMM_EXCESSIVE_SLIPPAGE/);
    assert.throws(() => validateSlippageBps(-10), /AMM_EXCESSIVE_SLIPPAGE/);
    assert.throws(() => validateSlippageBps(5001), /AMM_EXCESSIVE_SLIPPAGE/);
  });

  test("Token pair canonicalization handles EVM and case-sensitive policies", () => {
    const [e0, e1] = canonicalizeTokenPair("USDC", "ETH", "EVM_CASE_INSENSITIVE");
    assert.equal(e0, "eth");
    assert.equal(e1, "usdc");

    // Case-sensitive preservation for non-EVM
    const [s0, s1] = canonicalizeTokenPair("So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "CASE_SENSITIVE_CANONICAL");
    assert.equal(s0 < s1, true);

    assert.throws(() => canonicalizeTokenPair("ETH", "eth", "EVM_CASE_INSENSITIVE"), /IDENTICAL_ADDRESSES/);
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

  test("Optimal deposit computation validates both minimums, rejects malformed bounds, and refunds excess", () => {
    const reserveA = 100000n;
    const reserveB = 200000n; // 1:2 ratio
    const totalLp = 141421n;

    // 1. Successful optimal deposit with refund
    const res = computeOptimalDeposit(10000n, 25000n, 10000n, 20000n, reserveA, reserveB, totalLp);
    assert.equal(res.amountA, 10000n);
    assert.equal(res.amountB, 20000n);
    assert.equal(res.refundA, 0n);
    assert.equal(res.refundB, 5000n);
    assert.ok(res.lpTokensMinted > 0n);

    // 2. Reject malformed bounds where min > desired
    assert.throws(
      () => computeOptimalDeposit(10000n, 20000n, 10001n, 20000n, reserveA, reserveB, totalLp),
      /AMM_EXCESSIVE_SLIPPAGE/
    );

    // 3. Reject negative bounds
    assert.throws(
      () => computeOptimalDeposit(10000n, 20000n, -1n, 20000n, reserveA, reserveB, totalLp),
      /AMM_ZERO_AMOUNT/
    );

    // 4. Reject tiny deposit that results in 0 LP tokens minted
    assert.throws(
      () => computeOptimalDeposit(1n, 2n, 0n, 0n, 1000000000000n, 2000000000000n, 1000n),
      /AMM_INSUFFICIENT_LIQUIDITY/
    );
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
