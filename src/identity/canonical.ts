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

function validateNetwork(chainId: number | undefined, networkType: NetworkType): number {
  if (networkType !== "evm" && networkType !== "non-evm") {
    throw new Error("UNSUPPORTED_NETWORK_TYPE: Select evm or non-evm explicitly");
  }
  const id = chainId === undefined && networkType === "evm" ? 1 : chainId;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    throw new Error("INVALID_CHAIN_ID: Non-EVM assets require an explicit positive safe integer network identifier");
  }
  return id;
}

export function canonicalizeAsset(
  identifier: string, chainId?: number, networkType: NetworkType = "evm",
): string {
  validateAssetIdentifier(identifier);
  const networkId = validateNetwork(chainId, networkType);
  const trimmed = identifier.trim();
  if (networkType === "evm") {
    const lower = encodeURIComponent(trimmed.toLowerCase());
    return networkId === 1 ? lower : `eip155:${networkId}:${lower}`;
  }
  return `non-evm:${networkId}:${encodeURIComponent(trimmed)}`;
}

export function getCanonicalPoolId(
  tokenA: string, tokenB: string, feeBps: number,
  chainId?: number, networkType: NetworkType = "evm",
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
