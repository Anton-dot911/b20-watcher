# B20 Watcher / Risk Scanner

![CI](https://github.com/Anton-dot911/b20-watcher/actions/workflows/ci.yml/badge.svg)

Independent MVP for tracking and risk-scoring **Base B20 native tokens**.

> Know who controls a B20 token before you trust it.

**Mock-only MVP.** All data is mock data — there is no CDP SQL integration and
no database yet. The risk score estimates **issuer-control and operational
risk**, _not_ a price prediction or investment advice.

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

## Tech stack

- Next.js (App Router) + React + TypeScript
- Server-side API routes
- Plain CSS + CSS Modules
- No database — mock data only in this MVP

## Quick start

```bash
npm install
cp .env.example .env.local   # optional; mock mode is the default
npm run dev
```

Open <http://localhost:3000>.

### Pages

- `/` — dashboard with the recent B20 token list and a "Mock mode" label
- `/tokens/0xb200000000000000000000000000000000000001` — high-control token report
- `/tokens/0xb200000000000000000000000000000000000002` — admin-renounced token report

### JSON API

- `GET /api/tokens` — list of tracked tokens with a risk summary each
- `GET /api/risk/0xb200000000000000000000000000000000000001` — full risk report

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
  config.ts                      MOCK_MODE flag
docs/                            product + risk model notes
```

## Environment variables

See [`.env.example`](.env.example). All are optional for the MVP:

- `MOCK_MODE` — defaults to `true`. Set to `false` for future real-data mode.
- `B20_NETWORK` — `base` (default) or `base-sepolia`.
- `CDP_BEARER_TOKEN` — only for future real-data mode; **not required here**.
- `B20_FACTORY_ADDRESS` — factory used for token discovery in real-data mode.

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

## Roadmap (not in this MVP)

1. CDP SQL API integration for real B20 discovery and event timelines.
2. Automatic CDP JWT bearer generation.
3. Database/cache for token snapshots and event diffing.
4. Alerts for role, policy, pause, and supply-cap changes.
5. Shareable report metadata and paid / x402 endpoints.
