export type NetworkType = "evm" | "non-evm";
export declare function validateAssetIdentifier(identifier: string): void;
export declare function canonicalizeAsset(identifier: string, chainId?: number, networkType?: NetworkType): string;
export declare function getCanonicalPoolId(tokenA: string, tokenB: string, feeBps: number, chainId?: number, networkType?: NetworkType): {
    poolId: string;
    canonicalToken0: string;
    canonicalToken1: string;
};
