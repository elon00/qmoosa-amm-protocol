# QMOOSA AMM Protocol — Evidence-Based Release Gates

Audit date: 2026-10-20. Scope: **protocol specification library**, not a deployed exchange. Latest inspected "Protocol Reality CI & Invariant Gate" run on 2026-10-17 was successful, but **a green workflow is not proof of deployed contracts, financial security or market adoption**.

## Architectural contract
- This repository owns invariant definitions, deterministic math, interface schemas, threat models, and protocol semantics. Keep on-chain contracts, routing services, SDK, dashboard and end-to-end tests in their corresponding project-family repositories.
- Supply inflation or new token creation **must not** be added by default to AMM interfaces. Token minting is a separate, chain-specific, access-controlled module governed by explicit supply policy.
- Publish chain ID, token address, decimals, protocol version, deployment transaction, contract verification and immutable release SHA only after genuine deployment.

## Required independent tests before release
1. Validate pool accounting: reserve conservation, fee capture, rounding direction, zero liquidity, dust, extreme values and overflow bounds.
2. Verify invariant preservation across swap/mint/burn, price impact and slippage bounds, withdrawal permissions, fee-on-transfer/rebasing edge cases (if supported).
3. Run property-based and fuzz tests with adversarial parameters; ensure failures are deterministic and add regression cases.
4. Test oracle manipulation resistance, MEV/slippage constraints, reentrancy, authorization, flash-loan exposure, front-running and paused/emergency states in the *actual contract repository*.
5. Prove cross-repo version compatibility for protocol -> engine -> SDK -> dashboard -> tests, with immutable package artifacts.
6. Require npm ci, npm run lint, npm test and npm run build to pass at the exact release SHA; capture CI run links and package hashes.
7. Record independent audit findings, license provenance, reproducible public demo, accessibility and product/market validation.

## Evidence ledger
| Gate | Current assessment |
| --- | --- |
| Specification code exists | Observed (src/, schemas/, docs/) |
| Protocol CI | Successful in latest inspected run (2026-10-17) |
| Full adversarial economic verification | Unverified |
| External security audit | Unverified |
| On-chain testnet deployment | Unverified |
| Mainnet readiness | NOT VERIFIED / LOCKED |
| Market readiness / hackathon win | Unverified; cannot guarantee placement |

**No mainnet execution, paid services, or token minting as part of this documentation change.**
