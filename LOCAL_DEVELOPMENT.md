# Local development

This repository contains a library and Solidity contracts. It does not run a web application.

Install Node.js 24 and Foundry 1.8.5, enter the repository folder and run:

    npm ci --ignore-scripts
    npm test
    npm run lint

npm test rebuilds dist from TypeScript before importing it. It runs the existing arithmetic tests and pool identity regressions. No wallet, API key or blockchain funds are required.

Run the contract tests from the contracts folder:

    cd contracts
    forge test -vv

Foundry compiles with Solidity 0.8.24 and the configured Cancun target. The tests include fuzz runs, stateful swap invariants and selected adversarial cases. They execute in the local test EVM, not on Ethereum or Solana.

Compilation requires the pinned compiler to be available; first-time dependency/compiler downloads need internet access. The forge-std test library is vendored. CI does not need an unrelated submodule initialization.

Use the SDK's compiled exports from dist/index.js after building. Keep signing credentials in the application that integrates the SDK; this package neither holds a wallet nor authenticates an RPC endpoint.

There is no localhost webpage to open or server to stop. Commands return when complete; Ctrl+C stops a running command. Publishing a package, deploying contracts and configuring live-chain access are separate release operations.
