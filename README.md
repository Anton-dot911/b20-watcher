# B20 Watcher / Risk Scanner

![CI](https://github.com/Anton-dot911/b20-watcher/actions/workflows/ci.yml/badge.svg)

Independent MVP for tracking and risk-scoring **Base B20 native tokens**.

> Know who controls a B20 token before you trust it.

**Three data modes.** Runs on bundled **mock data by default**, against the live
**Coinbase CDP SQL API**, or from a **Supabase cache** populated by the refresh
layer for fast, stable reads. The risk score estimates **issuer-control and
operational risk**, _not_ a price prediction or investment advice.

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
- Optionally runs in **live CDP mode** against the CDP SQL API to discover real
  B20 tokens on Base and build risk reports from live on-chain events.
- Optionally runs in **cached Supabase mode**, reading token snapshots and risk
  reports from Supabase tables so token pages load quickly. The cache is
  populated out-of-band by refresh endpoints/scripts, not on page views.

## Tech stack

- Next.js (App Router) + React + TypeScript
- Server-side API routes
- Coinbase CDP SQL API for live B20 data (server-side only)
- Supabase (Postgres) as the cache/persistence layer (server-side service role)
- Plain CSS + CSS Modules

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

### Cached Supabase mode

Serves token snapshots and risk reports from Supabase instead of hitting CDP on
every request. Reads are fast and stable; the cache is filled by the refresh
layer (below), never on page views. Set in `.env.local`:

```bash
MOCK_MODE=false
DATA_SOURCE=supabase
B20_NETWORK=base                       # or base_sepolia
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
REFRESH_SECRET=a-long-random-string    # required to run refresh
CDP_BEARER_TOKEN=your-cdp-bearer-token # used by refresh to pull fresh data
```

The header shows a **Cached: Supabase / Base** (or **/ Base Sepolia**) badge.

#### Supabase setup

1. Create a Supabase project and copy its URL and **service-role** key.
2. Apply the schema in [`supabase/schema.sql`](supabase/schema.sql) — either
   paste it into the Supabase dashboard **SQL editor** and run it, or:

   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/schema.sql
   ```

   This creates `b20_tokens`, `b20_events`, and `b20_risk_reports` (all
   network-scoped, so one project can hold both `base` and `base_sepolia`).
3. Populate the cache with the refresh endpoints below. Until you refresh, the
   dashboard is empty and a token's risk report reads as a valid **empty report**
   (score 0) rather than an error.

### Refreshing the cache

Refresh pulls fresh B20 data from CDP SQL and upserts it into Supabase. It runs
**only** through these endpoints (or a script that imports `lib/refresh.ts`) —
normal page reads never trigger a refresh (see
[Why page reads don't auto-refresh](#why-page-reads-dont-auto-refresh-yet)).
Every refresh request must carry the `x-refresh-secret` header matching
`REFRESH_SECRET`.

Refresh recent tokens (discovery + timelines + reports; conservative default
limit of 20):

```bash
curl -X POST http://localhost:3000/api/refresh/recent \
  -H "Content-Type: application/json" \
  -H "x-refresh-secret: $REFRESH_SECRET" \
  -d '{"limit": 20}'
```

Refresh a single token (its timeline + risk report):

```bash
curl -X POST http://localhost:3000/api/refresh/token/0xb200000000000000000000000000000000000001 \
  -H "x-refresh-secret: $REFRESH_SECRET"
```

Both return a JSON `RefreshResult` with counts, e.g.
`{ "network": "base", "tokens": 20, "events": 137, "reports": 20 }`.

Auth responses: `401` if the header is missing or wrong, `500` if
`REFRESH_SECRET` is not configured on the server (the secret is never logged or
echoed back). The single-token endpoint also returns `400` for an invalid
address.

#### Why page reads don't auto-refresh yet

Reads in Supabase mode are intentionally **pure reads** — a page view never
calls CDP or writes to the cache. This keeps page loads fast and predictable and
keeps the CDP bearer token off the read path. Freshness is a deliberate,
explicit action: run the refresh endpoints on a schedule (cron, a job runner, or
a manual call) to update the cache. Automatic on-read refresh is intentionally
out of scope for this task.

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
data source fails. For a valid address that is not a known B20 token (or has no
matched events, or is an un-refreshed Supabase cache miss) it returns `200` with
a valid **empty report** (score 0) rather than a `404`, so all modes behave
uniformly.

Refresh endpoints (write to the Supabase cache; require `x-refresh-secret`):

- `POST /api/refresh/recent` — body `{ "limit": 20 }` (optional). Discovers
  recent tokens and refreshes their timelines and reports.
- `POST /api/refresh/token/[address]` — refreshes one token.

Both return a `RefreshResult` (`{ network, tokens, events, reports }`). See
[Refreshing the cache](#refreshing-the-cache).

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
  api/refresh/recent/route.ts    POST /api/refresh/recent (x-refresh-secret)
  api/refresh/token/[address]/route.ts  POST /api/refresh/token/[address]
components/
  RiskBadge.tsx                  risk-level badge
lib/
  types.ts                       domain types
  mock-data.ts                   mock B20 tokens + events
  risk.ts                        buildRiskReport risk engine
  address.ts                     address validation/normalization
  config.ts                      mode + data source + network + cache config
  sql.ts                         CDP SQL query builders (pure, tested)
  cdp-sql.ts                     server-only CDP SQL client + row normalization
  supabase-server.ts             server-only Supabase service-role client
  b20-cache.ts                   Supabase cache repository + row conversions
  refresh.ts                     CDP -> Supabase refresh logic
  refresh-auth.ts                x-refresh-secret validation
  data-source.ts                 mock / cdp / supabase data abstraction
supabase/
  schema.sql                     cache tables (tokens, events, risk reports)
docs/                            product + risk model notes
```

### Data flow

Pages and API routes never branch on the data mode themselves — they call
`lib/data-source.ts`, which exposes `listB20Tokens`, `getB20Token`, and
`getB20RiskReport`. In mock mode these read `lib/mock-data.ts`; in CDP mode they
build SQL with `lib/sql.ts`, run it through `lib/cdp-sql.ts`, normalize the rows,
and feed them to the same `buildRiskReport` engine; in Supabase mode they read
cached rows via `lib/b20-cache.ts` and convert them back to internal types.

The refresh layer (`lib/refresh.ts`) is the only writer: it pulls fresh tokens
and timelines from CDP SQL, builds reports with the same `buildRiskReport`
engine, and upserts everything into Supabase through `lib/b20-cache.ts`. It is
reached only via the `/api/refresh/*` endpoints, which require `x-refresh-secret`
(`lib/refresh-auth.ts`).

SQL safety: table names come only from the validated `B20Network` enum, token
and factory addresses are validated as 20-byte hex before interpolation, and
row limits are clamped (discovery 1–100, timeline 1–5000).

## Environment variables

See [`.env.example`](.env.example):

- `MOCK_MODE` — defaults to `true`. Set to `false` to select a live source via
  `DATA_SOURCE`.
- `DATA_SOURCE` — live source when `MOCK_MODE=false`: `mock`, `cdp`, or
  `supabase`. Invalid/unset values fall back safely to `cdp`.
- `B20_NETWORK` — `base` (default) or `base_sepolia` (the hyphenated
  `base-sepolia` is normalized). Maps to the `base.events` / `base_sepolia.events`
  CDP SQL tables and scopes Supabase rows.
- `B20_FACTORY_ADDRESS` — factory used for token discovery.
- `CDP_BEARER_TOKEN` — **required for `DATA_SOURCE=cdp` and for refresh**,
  server-side only. Leave blank in mock mode.
- `CDP_SQL_CACHE_MAX_AGE_MS` — `maxAgeMs` for the CDP SQL cache (default `3000`).
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL. May be public; required for
  `DATA_SOURCE=supabase` and refresh.
- `SUPABASE_SERVICE_ROLE_KEY` — **server-side only** full-access key, read only
  inside `lib/supabase-server.ts`. Required for `DATA_SOURCE=supabase` and
  refresh. Never expose it to client bundles.
- `REFRESH_SECRET` — shared secret required by the refresh endpoints via the
  `x-refresh-secret` header.

> **Security notes.** The `SUPABASE_SERVICE_ROLE_KEY` and `CDP_BEARER_TOKEN` are
> read only inside `server-only` modules (`lib/supabase-server.ts`,
> `lib/cdp-sql.ts`), so `next build` fails if they are ever pulled into a client
> bundle. The `REFRESH_SECRET` gates all refresh endpoints and is never logged
> or returned in a response.

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

- **Refresh is manual/explicit.** Supabase reads never auto-refresh; the cache
  is only updated by calling the refresh endpoints (schedule them yourself). A
  Supabase cache miss for a token risk report reads as a valid **empty report**
  (score 0), not an error.
- **No event diffing/alerts yet.** The cache stores the latest snapshot and
  report per token; it does not diff changes between refreshes.
- Role decoding is minimal: only the well-known zero-hash `DEFAULT_ADMIN_ROLE`
  is resolved from a bytes32 hash. Other raw role hashes are preserved verbatim
  and ignored by the risk engine rather than crashing it.

## Roadmap (not in this task)

1. Automatic CDP JWT bearer generation.
2. Full on-chain role-hash decoding.
3. Scheduled/automatic refresh and event diffing.
4. Alerts for role, policy, pause, and supply-cap changes.
5. Shareable report metadata and paid / x402 endpoints.
