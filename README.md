# EIP-7702 USDT Authorization Demo

This repo contains a minimal **B-side authorization page** for an EIP-7702 demo.

The UI is intentionally simple and uses fixed addresses:

- `USDT`: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
- `ERC7702Account`: `0x8ab5bae1d0edc1c378310c095a511fac03bcf37b`
- `Spender`: `0x8284654bc3edb8300e365f8fdda06c747e8caf2b`

The page focuses on one flow:

1. Connect wallet
2. Select the **B** address
3. Enter the **A** address
4. Read A/B USDT balances
5. Send `B authorize + init (0x04)`

## What It Demonstrates

This demo shows how **B** delegates execution to a fixed `ERC7702Account` implementation through **EIP-7702**, then calls `init(spender)` in the same flow to store the fixed `Spender` address in B's storage.

The page is presented as a **1 USDT demo target**, but note:

- EIP-7702 authorization delegates account execution logic
- It is **not** an ERC20 allowance model like `approve(1 USDT)`

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Build

```bash
npm install
npm run build
```

Build output:

- `web/dist`

## Deploy

This is a static frontend app. Deploy `web/dist` to any static hosting service.

Examples:

- Vercel
- Netlify
- Cloudflare Pages
- Nginx static hosting

Recommended settings:

- Build command: `npm run build`
- Output directory: `web/dist`

## Usage

1. Connect a wallet
2. Pick the B address
3. Enter the A address
4. Click `Refresh Balances`
5. Click `B Authorize + init (0x04)`

The page already fixes the USDT, `ERC7702Account`, and `Spender` addresses, so there is nothing else to configure.

## Notes

- The current UI does **not** expose advanced options like custom RPC or private-key fallback.
- The flow depends on whether the connected wallet supports the signing and transaction path required by EIP-7702.
- Some wallets may fail during authorization even if the UI is correct.

## Common Issue

### `Account type "json-rpc" is not supported`

This usually means the connected wallet/provider does not support the authorization-signing flow required for EIP-7702 in this DApp path.

### `An unknown RPC error occurred`

This is commonly returned by wallets that do not fully support:

- authorization signing for EIP-7702, or
- sending a transaction with `authorizationList`

## Project Structure

- `contracts/`: Hardhat contracts project
- `web/`: Vite + React frontend
- `web/src/generated/contracts.ts`: generated contract artifacts used by the frontend

## Security Warning

`Spender` is a delegated contract role. Once it is written into `authorizedSpender`, it can act through the delegated execution path.

Do not use this demo with real funds.
