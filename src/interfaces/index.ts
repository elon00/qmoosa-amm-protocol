/**
 * QMOOSA AMM PROTOCOL INTERFACES & DOMAIN TYPES
 * Formal mathematical and schema specifications for constant-product (x * y = k) AMM pools.
 */

export type AssetId = string;

export interface TokenMetadata {
  id: AssetId;
  symbol: string;
  name: string;
  decimals: number;
}

export interface PoolKey {
  tokenA: AssetId;
  tokenB: AssetId;
  feeBps: number; // Strictly between MIN_FEE_BPS (1) and MAX_FEE_BPS (1000)
}

export interface PoolState {
  key: PoolKey;
  reserveA: bigint;
  reserveB: bigint;
  totalLpSupply: bigint;
  blockTimestamp: number;
  sequenceNumber: bigint;
  kLast: bigint; // reserveA * reserveB
}

export interface SwapQuote {
  tokenIn: AssetId;
  tokenOut: AssetId;
  amountIn: bigint;
  expectedAmountOut: bigint;
  minAmountOut: bigint;
  feeAmount: bigint;
  priceImpactBps: number;
  executionPrice: number;
}

export interface SwapExecutionParams {
  poolKey: PoolKey;
  tokenIn: AssetId;
  amountIn: bigint;
  minAmountOut: bigint;
  recipient: string;
  deadline: number;
}

export interface SwapResult {
  poolKey: PoolKey;
  tokenIn: AssetId;
  tokenOut: AssetId;
  amountIn: bigint;
  amountOut: bigint;
  feeAmount: bigint;
  newReserveA: bigint;
  newReserveB: bigint;
  transactionHash: string;
  timestamp: number;
}

export interface AddLiquidityParams {
  poolKey: PoolKey;
  amountADesired: bigint;
  amountBDesired: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  recipient: string;
  deadline: number;
}

export interface AddLiquidityResult {
  poolKey: PoolKey;
  amountA: bigint;
  amountB: bigint;
  amountARefunded: bigint;
  amountBRefunded: bigint;
  lpTokensMinted: bigint;
  recipient: string;
}

export interface RemoveLiquidityParams {
  poolKey: PoolKey;
  lpTokensToBurn: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  recipient: string;
  deadline: number;
}

export interface RemoveLiquidityResult {
  poolKey: PoolKey;
  amountA: bigint;
  amountB: bigint;
  lpTokensBurned: bigint;
  recipient: string;
}

export enum AmmErrorCode {
  IDENTICAL_ADDRESSES = "AMM_IDENTICAL_ADDRESSES",
  INVALID_TOKEN_IDENTIFIER = "AMM_INVALID_TOKEN_IDENTIFIER",
  INVALID_FEE_BPS = "AMM_INVALID_FEE_BPS",
  ZERO_AMOUNT = "AMM_ZERO_AMOUNT",
  INSUFFICIENT_LIQUIDITY = "AMM_INSUFFICIENT_LIQUIDITY",
  INSUFFICIENT_INPUT_AMOUNT = "AMM_INSUFFICIENT_INPUT_AMOUNT",
  INSUFFICIENT_OUTPUT_AMOUNT = "AMM_INSUFFICIENT_OUTPUT_AMOUNT",
  EXCESSIVE_SLIPPAGE = "AMM_EXCESSIVE_SLIPPAGE",
  DEADLINE_EXPIRED = "AMM_DEADLINE_EXPIRED",
  K_INVARIANT_VIOLATION = "AMM_K_INVARIANT_VIOLATION",
  OVERFLOW_UNDERFLOW = "AMM_OVERFLOW_UNDERFLOW",
  POOL_ALREADY_EXISTS = "AMM_POOL_ALREADY_EXISTS",
  POOL_NOT_FOUND = "AMM_POOL_NOT_FOUND",
  SUB_OPTIMAL_RATIO = "AMM_SUB_OPTIMAL_RATIO",
  INSUFFICIENT_LP_BALANCE = "AMM_INSUFFICIENT_LP_BALANCE"
}
