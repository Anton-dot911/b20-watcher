# B20 Watcher / Risk Scanner MVP

Independent MVP for tracking and risk-scoring Base B20 native tokens.

## What this MVP does

- Discovers new B20 tokens from the B20 Factory event `B20Created(address,uint8,string,string,uint8,bytes)`.
- Builds token-level risk snapshots from B20 events:
  - `RoleGranted`
  - `RoleRevoked`
  - `LastAdminRenounced`
  - `Paused`
  - `Unpaused`
  - `PolicyUpdated`
  - `SupplyCapUpdated`
  - `BurnedBlocked`
  - `NameUpdated`
  - `SymbolUpdated`
  - `MultiplierUpdated`
  - `Announcement`
- Exposes:
  - public dashboard `/`
  - token detail page `/tokens/:address`
  - JSON API `/api/tokens`
  - JSON API `/api/risk/:address`
- Runs in mock mode by default, so UI can be reviewed immediately.

## Why CDP SQL API first

CDP SQL API indexes B20-related events in `base.events`, so this MVP avoids building a custom indexer first.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Real data mode

1. Create CDP credentials in Coinbase Developer Platform.
2. Generate a Bearer token for the SQL API.
3. Set:

```env
MOCK_MODE=false
CDP_BEARER_TOKEN=your_generated_bearer_token
B20_NETWORK=base
```

4. Run:

```bash
npm run dev
```

## Current limitation

This starter expects a ready `CDP_BEARER_TOKEN`. Production version should add automatic JWT generation from CDP API key name/private key.

## Product positioning

**B20 Watcher — security and issuer-control intelligence for Base-native tokens.**

Core user value:

> Know who controls a B20 token before you trust it.

## Next build steps

1. Add automatic CDP Bearer token generation.
2. Add Supabase cache.
3. Add scheduled refresh for discovered B20 tokens.
4. Add paid reports or x402 endpoint.
5. Add alerting for role, policy, pause, and supply-cap changes.
