# Verification limits and open acceptance

Passing CI verifies the commands and revision shown by that run. It does not establish production safety, licensing clearance, live liquidity or customer acceptance.

- The SDK provides mathematical and lookup helpers. Network IDs and raw token addresses need verification by the integrating application. Aliases are local modeling inputs.
- Non-EVM lookup formats changed in 2.0.0 candidate to include network identity; migrate stored keys deliberately. No on-chain migration is performed.
- The reference pair uses a fixed 30 bps swap fee. Generic SDK fee arguments do not create on-chain fee tiers.
- Compiler/target settings remain explicit. No Glamsterdam transaction execution, Solana program deployment or Alpenglow validator upgrade is claimed by local tests. Integrations must verify the actual target network and obtain current gas estimates.
- Solana/other case-sensitive identifiers in helpers do not make these EVM contracts native programs on those chains.
- Stateful invariant coverage currently exercises the configured handler actions. It is not exhaustive economic or adversarial verification.
- Contract review, deployment receipts/bytecode verification, operational recovery, measured load and customer acceptance remain open.
- Package metadata and source headers declare MIT, but a root license notice and source provenance review are incomplete. Resolve distribution notices/provenance before a registry release; no registry publication is automated.
- Agent orchestration, x402 settlement, wallet custody and PQC transport are not implemented here. Their applicability must follow this package's actual role, not a technology checklist.

The package is marked private while distribution notices and provenance remain open. The major-version candidate makes the lookup-key migration explicit. No release has been published to a registry.
