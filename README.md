# QMoosa AMM protocol reference

## About

A TypeScript SDK for constant-product AMM arithmetic and asset lookup identities, with Solidity factory, pair and router reference contracts. The contracts include liquidity, slippage, deadline and permit behavior exercised by local tests. This is an experimental reference awaiting deployment, independent review and product acceptance.

## Build and test locally

Use Node.js 24 and Foundry 1.8.5. Open a terminal in this repository:

    npm ci --ignore-scripts
    npm test
    npm run lint
    cd contracts
    forge test -vv

This project is a library and contract package. It has no browser application or HTTP server, so no application localhost URL is advertised. Tests execute locally. See [local setup and verification](LOCAL_DEVELOPMENT.md).

## Pool identities in 2.0.0 candidate

The identity helpers validate fee bounds, positive safe integer network IDs and supported case policies. Non-EVM identities now include the provided network ID. Identifier components are percent-encoded so structured identifiers cannot create delimiter collisions. Control characters, malformed Unicode and identifiers longer than 1024 code units are rejected.

Existing non-EVM lookup keys need rebuilding from their original identifiers and correct network ID. EVM mainnet identifiers without reserved characters keep their previous format. Canonical identities are lookup keys; retain verified raw asset addresses for transaction construction. Non-EVM numeric network IDs are application-defined and need a consistent mapping to the actual network/genesis.

Aliases such as ETH and USDC support local models. These helpers do not resolve aliases, verify token addresses, inspect RPC genesis or establish that an asset exists.

## Verification and release boundaries

CI builds and tests the SDK on Linux/Windows, checks generated output, runs Solidity/fuzz/stateful tests, audits locked dependencies, scans complete available Git history with an external pinned policy, and analyzes Python/TypeScript/workflows with CodeQL. Failed, skipped or missing required jobs block the protocol gate. A package candidate is generated only after that gate passes on main; it is not published to a registry.

The current Solidity pair has a fixed 30 basis-point swap fee. SDK functions accepting other fees are mathematical models, not additional deployed fee tiers. No live deployment or market acceptance is established by this repository. See [verification limits and remaining work](VERIFICATION_LIMITS.md).
