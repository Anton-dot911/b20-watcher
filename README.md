# B20 Watcher / Risk Scanner

![CI](https://github.com/Anton-dot911/b20-watcher/actions/workflows/ci.yml/badge.svg)

Independent MVP for tracking and risk-scoring **Base B20 native tokens**.

> Know who controls a B20 token before you trust it.

**Two data modes.** Runs on bundled **mock data by default**, or against the
live **Coinbase CDP SQL API** when configured. There is no database yet — live
mode relies only on the CDP SQL cache. The risk score estimates
**issuer-control and operational risk**, _not_ a price prediction or investment
advice.

B20 Watcher is a public dashboard and JSON API that scores **issuer-control
risk** for B20 tokens from their on-chain role, policy, pause, and supply
events. It answers one question: _who controls this token, and what risks exist
before I trust it?_

This is **not** a trading bot, a price predictor, or investment advice.

## What this MVP does

- Lists tracked B20 tokens on a public dashboard (`/`).
- Renders a per-token risk report (`/tokens/[address]`) with a 0–100 score,
  risk level, summary, flags, active roles, and an event timeline.
- Serves the same data as JSON via `/api/tokens` and `/api/risk/[address]`.
- Runs in **mock mode by default**, so the whole product can be reviewed
  immediately with no external data source, database, or CDP integration.
- Optionally runs in **live mode** against the CDP SQL API to discover real B20
  tokens on Base and build risk reports from live on-chain events.

## Tech stack

- Next.js (App Router) + React + TypeScript
- Server-side API routes
- Coinbase CDP SQL API for live B20 data (server-side only)
- Plain CSS + CSS Modules
- No database yet — mock data or live CDP SQL (with its own cache)

## Quick start

### Mock mode (default)

No external data source or CDP token needed:

```bash
npm install
cp .env.example .env.local   # optional; mock mode is the default
npm run dev
```

Open <http://localhost:3000>. The header shows a **Mock mode** badge.

### Live CDP SQL mode

Fetches real B20 token deployments and event timelines from the Coinbase CDP
SQL API and builds risk reports from them. Set in `.env.local`:

```bash
MOCK_MODE=false
B20_NETWORK=base            # or base_sepolia
CDP_BEARER_TOKEN=your-cdp-bearer-token
```

Then run `npm run dev`. The header shows a **Live: Base** (or **Live: Base
Sepolia**) badge. If `CDP_BEARER_TOKEN` is missing in live mode, the API routes
return a server-side error (`502`) and the pages render a readable error state
instead of crashing.

> **Safety:** `CDP_BEARER_TOKEN` is **server-side only**. It is read exclusively
> inside `lib/cdp-sql.ts`, which imports `server-only` so it can never be
> bundled into client code, and it is never sent to the browser.

### Pages

- `/` — dashboard with the recent B20 token list and a "Mock mode" label
- `/tokens/0xb200000000000000000000000000000000000001` — high-control token report
- `/tokens/0xb200000000000000000000000000000000000002` — admin-renounced token report

### JSON API

- `GET /api/tokens` — `{ mockMode, network, count, tokens }`; each token
  carries a risk summary (`score`, `level`, `eventCount`).
- `GET /api/risk/0xb200000000000000000000000000000000000001` —
  `{ mockMode, network, token, report }` with the full risk report.

`/api/risk/[address]` responds `400` for an invalid address and `502` when the
live CDP data source fails. For a valid address that is not a known B20 token
(or has no matched events) it returns `200` with a valid **empty report**
(score 0) rather than a `404`, so mock and live behave uniformly.

## Risk model

The risk engine lives in [`lib/risk.ts`](lib/risk.ts) as a reusable
`buildRiskReport(tokenAddress, events)` function. It replays a token's events
to derive current role state and operational conditions, then applies weighted
flags:

| Condition | Effect |
| --- | --- |
| Active `DEFAULT_ADMIN_ROLE` | High issuer-control risk |
| Active `MINT_ROLE` | Mint / inflation risk |
| Active `BURN_BLOCKED_ROLE` | Freeze / seize risk |
| `PolicyUpdated` | Policy restriction risk |
| `SupplyCapUpdated` | Supply-control risk |
| `Paused` without a later `Unpaused` | High pause risk |
| `LastAdminRenounced` | Reduces admin risk, but other active-role risks remain |

Score-to-level thresholds: `0–24 low`, `25–49 moderate`, `50–74 high`,
`75–100 critical`.

Regulated tokens may intentionally use pause, freeze, blocklist, and supply
controls. Flags describe **capabilities, not intent**.

## Project structure

```txt
app/
  layout.tsx                     app shell + Mock mode badge
  page.tsx                       dashboard
  tokens/[address]/page.tsx      token risk report
  api/tokens/route.ts            GET /api/tokens
  api/risk/[address]/route.ts    GET /api/risk/[address]
components/
  RiskBadge.tsx                  risk-level badge
lib/
  types.ts                       domain types
  mock-data.ts                   mock B20 tokens + events
  risk.ts                        buildRiskReport risk engine
  address.ts                     address validation/normalization
  config.ts                      mode + network + cache config
  sql.ts                         CDP SQL query builders (pure, tested)
  cdp-sql.ts                     server-only CDP SQL client + row normalization
  data-source.ts                 mock-vs-live data abstraction
docs/                            product + risk model notes
```

### Data flow

Pages and API routes never branch on the data mode themselves — they call
`lib/data-source.ts`, which exposes `listB20Tokens`, `getB20Token`, and
`getB20RiskReport`. In mock mode these read `lib/mock-data.ts`; in live mode
they build SQL with `lib/sql.ts`, run it through `lib/cdp-sql.ts`, normalize the
rows, and feed them to the same `buildRiskReport` engine.

SQL safety: table names come only from the validated `B20Network` enum, token
and factory addresses are validated as 20-byte hex before interpolation, and
row limits are clamped (discovery 1–100, timeline 1–5000).

## Environment variables

See [`.env.example`](.env.example):

- `MOCK_MODE` — defaults to `true`. Set to `false` for live CDP SQL mode.
- `B20_NETWORK` — `base` (default) or `base_sepolia` (the hyphenated
  `base-sepolia` is normalized). Maps to the `base.events` / `base_sepolia.events`
  CDP SQL tables.
- `CDP_BEARER_TOKEN` — **required in live mode**, server-side only. Leave blank
  in mock mode.
- `CDP_SQL_CACHE_MAX_AGE_MS` — `maxAgeMs` for the CDP SQL cache (default `3000`).
- `B20_FACTORY_ADDRESS` — factory used for token discovery in live mode.

## Build

```bash
npm run build
```

## Tests

Unit tests (Vitest) cover the risk engine and address validation:

```bash
npm test          # run once
npm run test:watch # watch mode
```

## Continuous integration

GitHub Actions runs on every pull request and on pushes to `main`
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). The pipeline uses
Node 22 and runs:

```bash
npm ci
npm run build
npm test
```

The build/test status is shown by the CI badge at the top of this README.

## Current limitations

- **No persistence/cache database yet.** Live mode has no snapshot or diffing
  store; freshness relies solely on the CDP SQL cache
  (`CDP_SQL_CACHE_MAX_AGE_MS`).
- Role decoding is minimal: only the well-known zero-hash `DEFAULT_ADMIN_ROLE`
  is resolved from a bytes32 hash. Other raw role hashes are preserved verbatim
  and ignored by the risk engine rather than crashing it.

## Roadmap (not in this MVP)

1. Automatic CDP JWT bearer generation.
2. Full on-chain role-hash decoding.
3. Database/cache for token snapshots and event diffing.
4. Alerts for role, policy, pause, and supply-cap changes.
5. Shareable report metadata and paid / x402 endpoints.
