# ADR-001: Target Execution Model & Runtime Specification

**Status:** PROPOSED & REVIEWED  
**Author:** Antigravity (Implementation Lead) & ChatGPT (Architecture Lead)  
**Date:** 2026-10-17  

---

## 1. Context & Architectural Problem

The Qmoosa AMM pilot software family currently implements mathematical specifications, deterministic in-memory execution, client SDK abstraction, Web4 UI components, and testing harnesses. To transition from prototype to transaction-capable software without introducing speculative code or unverified assumptions, the formal target execution model must be explicitly selected.

---

## 2. Evaluation of Architectural Options

### Option A: Off-Chain Deterministic Simulation Engine
- **Characteristics:** Headless Node.js/Rust state-machine with cryptographic replay protection, event logs, and atomic in-memory/KV persistence.
- **Pros:** Zero gas costs, instant finality, ideal for local multi-agent simulations and high-throughput Conway/Web4 automated testing.
- **Cons:** Does not provide decentralized smart contract settlement or trustless multi-party asset custody.

### Option B: EVM-Compatible L2 On-Chain Settlement (Arbitrum / Base)
- **Characteristics:** Solidity smart contracts implementing constant product AMM with ERC-20 token custody, reentrancy guards, and event emission.
- **Pros:** 
  - Directly compatible with existing portfolio repository [`QARBI`](https://github.com/elon00/QARBI) (Arbitrum EVM).
  - Mature tooling (Foundry, Hardhat, OpenZeppelin v5, Viem, Wagmi).
  - Low transaction fees on Arbitrum Sepolia testnet.
  - Standardized wallet integration (MetaMask, Rabby, WalletConnect).
- **Cons:** Requires testnet faucet funds and network confirmation monitoring.

### Option C: Non-EVM Chain-Native Settlement (TON TVM, Solana Anchor, or ICP)
- **Characteristics:** Tact/FunC for TON, Rust/Anchor for Solana, or Motoko for Internet Computer.
- **Pros:** High performance, native to the user's TON (`qton`, `alcat-mesh`) or ICP (`Qmoosa-ICP`, `qicp-equality`) holdings.
- **Cons:** Significantly higher operational complexity for cross-chain testing and different asset custody semantics.

---

## 3. Decision: Hybrid Architecture (Option B Primary + Option A Sandbox)

We select **Option B (EVM-Compatible on Arbitrum/Base L2)** as the authoritative production settlement model, supported by **Option A (Deterministic Local Sandbox)** for fast, zero-spend CI/CD verification:

1. **Protocol & Engine Contracts:**
   - Formal specifications in `@qmoosa/amm-protocol`.
   - Core deterministic verification engine in `@qmoosa/amm-engine` with dual execution modes:
     - `Mode 1 (Local Sandbox):` In-memory atomic state store for testing, multi-agent simulation, and CI.
     - `Mode 2 (On-Chain Adapter):` EVM smart contract interfaces compiled via Foundry/Hardhat targeted at Arbitrum Sepolia.
2. **SDK & Client Layer:**
   - Abstract `ChainTransactionAdapter` interface with explicit `ArbitrumTestnetAdapter` and `LocalSandboxAdapter`.
   - Mock wallet adapters strictly segregated into `@qmoosa/amm-sdk/testing`.
3. **Dashboard:**
   - Live network toggle: `[LOCAL SANDBOX]` vs `[ARBITRUM SEPOLIA TESTNET]`.
   - Clear disclosure of demonstration vs live transaction state.
4. **Mainnet Safeguard:**
   - Mainnet deployments remain **LOCKED** under all circumstances until explicit human sign-off.
