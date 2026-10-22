import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalizeAsset, getCanonicalPoolId } from "../dist/index.js";

test("non-EVM asset and pool identities are separated by network", () => {
  assert.throws(() => canonicalizeAsset("SOL", undefined, "non-evm"), /INVALID_CHAIN_ID/);
  assert.throws(() => getCanonicalPoolId("SOL", "USDC", 30, undefined, "non-evm"), /INVALID_CHAIN_ID/);
  assert.notEqual(canonicalizeAsset("SOL", 101, "non-evm"), canonicalizeAsset("SOL", 102, "non-evm"));
  assert.notEqual(getCanonicalPoolId("SOL", "USDC", 30, 101, "non-evm").poolId,
    getCanonicalPoolId("SOL", "USDC", 30, 102, "non-evm").poolId);
  assert.notEqual(getCanonicalPoolId("SOL", "USDC", 30, 101, "non-evm").poolId,
    getCanonicalPoolId("SOL", "USDC", 30, 101, "evm").poolId);
});

test("structured identifiers remain usable while delimiters cannot collide", () => {
  for (const value of ["a\n", "a\u0000b", "a".repeat(1025), "\ud800"]) {
    assert.throws(() => getCanonicalPoolId(value, "USDC", 30), /INVALID_ASSET_IDENTIFIER/);
    assert.throws(() => canonicalizeAsset(value), /INVALID_ASSET_IDENTIFIER/);
  }
  assert.notEqual(getCanonicalPoolId("ab", "c", 30).poolId, getCanonicalPoolId("a", "bc", 30).poolId);
  assert.notEqual(getCanonicalPoolId("a:b", "c", 30).poolId,
    getCanonicalPoolId("a", "b:c", 30).poolId);
  assert.notEqual(canonicalizeAsset("a:b"), canonicalizeAsset("a%3Ab"));
  assert.equal(canonicalizeAsset("0x2::coin::USD", 202, "non-evm"),
    "non-evm:202:0x2%3A%3Acoin%3A%3AUSD");

});

test("invalid fees, networks and network types fail before an identity is returned", () => {
  for (const fee of [0, -1, 1001, 30.5, NaN, Infinity, "30"]) {
    assert.throws(() => getCanonicalPoolId("ETH", "USDC", fee), /INVALID_FEE_BPS/);
  }
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1"]) {
    assert.throws(() => getCanonicalPoolId("ETH", "USDC", 30, id), /INVALID_CHAIN_ID/);
    assert.throws(() => canonicalizeAsset("ETH", id), /INVALID_CHAIN_ID/);
  }
  assert.throws(() => getCanonicalPoolId("ETH", "USDC", 30, 1, "unknown"), /UNSUPPORTED_NETWORK_TYPE/);
});

test("ordering is canonical while network, case policy and fee remain distinct", () => {
  for (const id of [1, 11155111, 42161, Number.MAX_SAFE_INTEGER]) {
    for (const network of ["evm", "non-evm"]) {
      const a = getCanonicalPoolId("SOL", "USDC", 30, id, network);
      assert.equal(a.poolId, getCanonicalPoolId("USDC", "SOL", 30, id, network).poolId);
      assert.notEqual(a.poolId, getCanonicalPoolId("SOL", "USDC", 31, id, network).poolId);
    }
  }
  assert.equal(getCanonicalPoolId("ETH", "USDC", 30).poolId, "eth:usdc:30");
});
