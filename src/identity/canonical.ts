/**
 * Asset and pool lookup identities. Raw aliases are allowed for local models;
 * these helpers do not establish that an asset exists on a blockchain.
 */
import { validateFeeBps } from "../math/invariants.js";

export type NetworkType = "evm" | "non-evm";

export function validateAssetIdentifier(identifier: string): void {
  if (typeof identifier !== "string" || !identifier.trim() || identifier.length > 1024 ||
      /[\u0000-\u001f\u007f]/.test(identifier)) {
    throw new Error("INVALID_ASSET_IDENTIFIER: Use a bounded raw identifier without control characters");
  }
  try { encodeURIComponent(identifier); }
  catch { throw new Error("INVALID_ASSET_IDENTIFIER: Use well-formed Unicode"); }
}

function validateNetwork(chainId: number, networkType: NetworkType): void {
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("INVALID_CHAIN_ID: A positive safe integer network identifier is required");
  }
  if (networkType !== "evm" && networkType !== "non-evm") {
    throw new Error("UNSUPPORTED_NETWORK_TYPE: Select evm or non-evm explicitly");
  }
}

export function canonicalizeAsset(
  identifier: string, chainId: number = 1, networkType: NetworkType = "evm",
): string {
  validateAssetIdentifier(identifier);
  validateNetwork(chainId, networkType);
  const trimmed = identifier.trim();
  if (networkType === "evm") {
    const lower = encodeURIComponent(trimmed.toLowerCase());
    return chainId === 1 ? lower : `eip155:${chainId}:${lower}`;
  }
  return `non-evm:${chainId}:${encodeURIComponent(trimmed)}`;
}

export function getCanonicalPoolId(
  tokenA: string, tokenB: string, feeBps: number,
  chainId: number = 1, networkType: NetworkType = "evm",
): { poolId: string; canonicalToken0: string; canonicalToken1: string } {
  validateFeeBps(feeBps);
  const cA = canonicalizeAsset(tokenA, chainId, networkType);
  const cB = canonicalizeAsset(tokenB, chainId, networkType);
  if (cA === cB) {
    throw new Error("AMM_IDENTICAL_ADDRESSES: Cannot pair identical canonical assets");
  }
  const [canonicalToken0, canonicalToken1] = cA < cB ? [cA, cB] : [cB, cA];
  return { poolId: `${canonicalToken0}:${canonicalToken1}:${feeBps}`, canonicalToken0, canonicalToken1 };
}
