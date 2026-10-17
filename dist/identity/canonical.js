/**
 * Canonical Asset Identity Policy (Mission 05D)
 * Provides deterministic, cross-chain-aware asset canonicalization and pool key generation.
 */
export function validateAssetIdentifier(identifier) {
    if (!identifier || typeof identifier !== "string" || identifier.trim().length === 0) {
        throw new Error("INVALID_ASSET_IDENTIFIER: Asset identifier must be a non-empty string");
    }
}
export function canonicalizeAsset(identifier, chainId = 1, networkType = "evm") {
    validateAssetIdentifier(identifier);
    const trimmed = identifier.trim();
    if (networkType === "evm") {
        // Check if it's an EVM 20-byte address (0x + 40 hex chars)
        const isAddress = /^0x[0-9a-fA-F]{40}$/.test(trimmed);
        if (isAddress) {
            const lower = trimmed.toLowerCase();
            return chainId === 1 ? lower : `eip155:${chainId}:${lower}`;
        }
        // For symbols or aliases in local sandbox, canonicalize to lowercase
        const lower = trimmed.toLowerCase();
        return chainId === 1 ? lower : `eip155:${chainId}:${lower}`;
    }
    else {
        // Non-EVM networks (e.g. Solana base58 addresses or Algorand identifiers) are case-sensitive
        return trimmed;
    }
}
export function getCanonicalPoolId(tokenA, tokenB, feeBps, chainId = 1, networkType = "evm") {
    validateAssetIdentifier(tokenA);
    validateAssetIdentifier(tokenB);
    const cA = canonicalizeAsset(tokenA, chainId, networkType);
    const cB = canonicalizeAsset(tokenB, chainId, networkType);
    if (cA === cB) {
        throw new Error("AMM_IDENTICAL_ADDRESSES: Cannot create pool or quote with identical canonical assets");
    }
    // Deterministic lexicographical sorting independent of caller order
    const isAFirst = cA < cB;
    const canonicalToken0 = isAFirst ? cA : cB;
    const canonicalToken1 = isAFirst ? cB : cA;
    const poolId = `${canonicalToken0}:${canonicalToken1}:${feeBps}`;
    return { poolId, canonicalToken0, canonicalToken1 };
}
