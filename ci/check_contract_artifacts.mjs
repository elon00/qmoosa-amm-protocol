import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import * as artifacts from "../dist/contracts/index.js";

const expected = ["MockERC20Artifact", "QmoosaFactoryArtifact", "QmoosaPairArtifact", "QmoosaRouterArtifact"];
if (!isDeepStrictEqual(Object.keys(artifacts).sort(), expected.sort())) {
  throw new Error("Incomplete or unexpected SDK contract exports");
}
for (const name of expected) {
  const artifact = artifacts[name];
  const compiled = JSON.parse(readFileSync(new URL(
    "../contracts/out/" + artifact.contractName + ".sol/" + artifact.contractName + ".json", import.meta.url)));
  if (!Array.isArray(artifact.abi) || !isDeepStrictEqual(artifact.abi, compiled.abi) ||
      typeof artifact.bytecode !== "string" || !artifact.bytecode.startsWith("0x") ||
      artifact.bytecode !== compiled.bytecode?.object) {
    throw new Error("SDK ABI or bytecode differs from the pinned compiler output: " + name);
  }
  console.log(name + ": ABI and creation bytecode match local compiler output");
}
