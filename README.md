# B20 Watcher / Risk Scanner

![CI](https://github.com/Anton-dot911/b20-watcher/actions/workflows/ci.yml/badge.svg)

Independent MVP for tracking and risk-scoring **Base B20 native tokens**.

> Know who controls a B20 token before you trust it.

B20 Watcher is a public dashboard and JSON API that estimates **issuer-control and operational risk** for B20 tokens from observed role, policy, pause, metadata, and supply events.

This is **not** a trading bot, price predictor, or investment advice.

## Current milestone

**`v0.2.0-live-cache-mobile-mvp`**

This milestone validates the product-quality live cached MVP:

- live cached Supabase data mode;
- protected refresh endpoints and scheduled GitHub Actions refresh;
- mobile-first dashboard cards;
- token search;
- copyable token addresses, transaction hashes, and relevant event arguments;
- readable score explanations;
- readable token event timeline.

Release notes: [`docs/releases/v0.2.0-live-cache-mobile-mvp.md`](docs/releases/v0.2.0-live-cache-mobile-mvp.md)

## Live demo

Reference deployment:

```txt
https://b20-watcher.netlify.app
```

Primary checks:

```txt
/                         dashboard
/tokens/<token-address>   token report
/api/health               secret-free health check
/api/tokens               token list JSON
/api/risk/<token-address> full token risk report JSON
```

## What this MVP does

- Lists tracked B20 tokens on a public dashboard.
- Provides mobile-first token cards with score, event count, main reason, copyable address, and report link.
- Searches by token name, symbol, address, risk reason, score, and flag titles.
- Renders a per-token report with score, level, summary, score breakdown, active roles, risk flags, and event timeline.
- Explains why a score is `10/100`, `30/100`, etc.
- Serves the same data as JSON via `/api/tokens` and `/api/risk/[address]`.
- Runs in mock mode, direct CDP mode, or cached Supabase mode.
- Keeps refresh explicit: normal page reads never write to Supabase and never call CDP.

## Product position

B20 Watcher answers one question:

> Who controls this B20 token, and what issuer-control risks exist before I trust it?

It focuses on **capabilities**, not intent. A regulated token may intentionally use pause, blocklist, burn, metadata, or supply-cap controls. B20 Watcher surfaces those capabilities so a user can review them before relying on a token.

## Data modes

### 1. Mock mode

Default local mode. No CDP token, Supabase project, or database is required.

```env
MOCK_MODE=true
DATA_SOURCE=mock
```

### 2. Live CDP mode

Reads directly from Coinbase CDP SQL on server-side requests.

```env
MOCK_MODE=false
DATA_SOURCE=cdp
B20_NETWORK=base
CDP_BEARER_TOKEN=<cdp-sql-bearer-token>
```

### 3. Cached Supabase mode

Production-oriented mode. Public reads use Supabase cache tables. Refresh jobs pull from CDP and upsert token snapshots, events, and risk reports.

```env
MOCK_MODE=false
DATA_SOURCE=supabase
B20_NETWORK=base_sepolia
B20_FACTORY_ADDRESS=0xB20f000000000000000000000000000000000000

NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
REFRESH_SECRET=<long-random-secret>

CDP_BEARER_TOKEN=<cdp-sql-bearer-token>
CDP_SQL_CACHE_MAX_AGE_MS=3000
```

`NEXT_PUBLIC_SUPABASE_URL` may be public. `SUPABASE_SERVICE_ROLE_KEY`, `CDP_BEARER_TOKEN`, and `REFRESH_SECRET` must remain server-side only.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional; mock mode is default
npm run dev
```

Open:

```txt
http://localhost:3000
```

Build and test:

```bash
npm run build
npm test
```

## Deployment

Detailed deployment instructions are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

The supported deployment flow is:

1. Deploy safely in mock mode.
2. Apply [`supabase/schema.sql`](supabase/schema.sql).
3. Add production env vars in the hosting provider.
4. Switch to cached Supabase mode.
5. Run `/api/health`.
6. Run a small refresh smoke test.
7. Verify public read endpoints.
8. Enable scheduled refresh through GitHub Actions.

Netlify and Vercel are both supported for this architecture. The current reference deployment uses Netlify.

## Supabase setup

Create a Supabase project and run the schema:

```sql
-- paste contents of supabase/schema.sql into Supabase SQL editor
```

or:

```bash
psql "$SUPABASE_DB_URL" -f supabase/schema.sql
```

The schema creates network-scoped cache tables:

- `b20_tokens`
- `b20_events`
- `b20_risk_reports`

Rows are scoped by `network`, so the same token address can exist on `base` and `base_sepolia` without collision.

## Refreshing the cache

Refresh pulls recent B20 tokens and timelines from CDP SQL, builds risk reports, and upserts them into Supabase.

Normal page reads never trigger refresh.

Manual refresh:

```bash
curl -X POST https://<your-domain>/api/refresh/recent \
  -H "Content-Type: application/json" \
  -H "x-refresh-secret: <REFRESH_SECRET>" \
  -d '{"limit": 5}'
```

Single-token refresh:

```bash
curl -X POST https://<your-domain>/api/refresh/token/<token-address> \
  -H "x-refresh-secret: <REFRESH_SECRET>"
```

Expected response shape:

```json
{
  "network": "base_sepolia",
  "tokens": 5,
  "events": 34,
  "reports": 5
}
```

A successful response with zero rows is still an infrastructure success. It means CDP returned no matching B20 deployments/events for the selected network/factory at that time.

## Scheduled refresh

The repository includes:

```txt
.github/workflows/refresh-cache.yml
```

It runs every 6 hours and can also be started manually from GitHub Actions.

Required GitHub Actions secrets:

```txt
B20_WATCHER_REFRESH_URL=https://<your-domain>/api/refresh/recent
B20_WATCHER_REFRESH_SECRET=<same value as REFRESH_SECRET in hosting provider>
```

Manual run:

1. Open GitHub → repository → **Actions**.
2. Select **Refresh B20 Cache**.
3. Click **Run workflow**.
4. Optional: set `limit` to `5` for a safe first run.

Safety behavior:

- scheduled refresh defaults to `limit=20`;
- manual refresh accepts a custom limit;
- the workflow caps the limit to `20`;
- the workflow fails if the refresh URL or secret is missing;
- the workflow prints the refresh JSON response but never prints the refresh secret.

## Risk model

The risk engine lives in [`lib/risk.ts`](lib/risk.ts). It replays a token's event timeline to derive role state and operational conditions, then applies weighted flags.

Known B20 role hashes are decoded in [`lib/roles.ts`](lib/roles.ts). For role events, the CDP timeline query selects `topic1 AS role_topic` so the scanner can recover canonical role hashes even when `parameters.role` is empty or decoded as unreadable bytes.

| Condition | Effect |
| --- | --- |
| Active `DEFAULT_ADMIN_ROLE` | High issuer-control risk |
| Active `MINT_ROLE` | Mint / inflation risk |
| Active `BURN_BLOCKED_ROLE` | Freeze / seize risk |
| `PolicyUpdated` | Policy restriction risk |
| `SupplyCapUpdated` | Supply-control risk |
| `Paused` without later `Unpaused` | High pause risk |
| `BurnedBlocked` | Blocked balance burn activity |
| `LastAdminRenounced` | Reduces admin risk, but other active roles can remain risky |

Score-to-level thresholds:

```txt
0–24    low
25–49   moderate
50–74   high
75–100  critical
```

Score explanation is generated by [`lib/score-explanation.ts`](lib/score-explanation.ts). The dashboard shows the main score reason, and each token report includes a score breakdown.

Example:

```txt
Score: 10/100
Main reason: Supply cap changed +10
```

## Event timeline presentation

The token report uses [`lib/event-presentation.ts`](lib/event-presentation.ts) to make raw B20 events easier to read.

Examples:

```txt
SupplyCapUpdated → Supply cap updated
RoleGranted      → Role granted
PolicyUpdated    → Transfer policy updated
```

The timeline also:

- adds short event descriptions;
- prioritizes important args per event type;
- formats large integer values with separators;
- shortens addresses and transaction hashes;
- keeps addresses and hashes copyable;
- decodes known B20 role hashes to names such as `MINT_ROLE` and `BURN_BLOCKED_ROLE`;
- hides still-unknown or unreadable role values as `Unknown role`.

## JSON API

### `GET /api/health`

Secret-free health payload. Does not call CDP or Supabase.

### `GET /api/tokens`

Returns the tracked token list and risk summaries.

### `GET /api/risk/[address]`

Returns one token and its full risk report.

Invalid address returns `400`. Data-source failure returns a safe `502`. A valid address with no cached report returns a valid empty report rather than crashing the page.

### `POST /api/refresh/recent`

Protected by `x-refresh-secret`. Discovers recent tokens and refreshes timelines/reports.

### `POST /api/refresh/token/[address]`

Protected by `x-refresh-secret`. Refreshes one token's timeline/report.

### `POST /api/diagnostics`

Protected by `x-refresh-secret`. Secret-free diagnostics for CDP/Supabase configuration.

### `POST /api/diagnostics/cdp-probe`

Protected by `x-refresh-secret`. CDP discovery probe for debugging zero-row discovery results.

## Project structure

```txt
app/
  layout.tsx                         app shell + data-mode badge
  page.tsx                           dashboard
  tokens/[address]/page.tsx          token risk report
  api/health/route.ts                GET /api/health
  api/tokens/route.ts                GET /api/tokens
  api/risk/[address]/route.ts        GET /api/risk/[address]
  api/refresh/recent/route.ts        POST /api/refresh/recent
  api/refresh/token/[address]/route.ts
  api/diagnostics/route.ts           POST /api/diagnostics
  api/diagnostics/cdp-probe/route.ts POST /api/diagnostics/cdp-probe
components/
  CopyValue.tsx                      shortened copyable values
  RiskBadge.tsx                      risk-level badge
  TokenSearchTable.tsx               dashboard table + mobile cards
lib/
  types.ts                           domain types
  mock-data.ts                       mock B20 tokens + events
  risk.ts                            buildRiskReport risk engine
  roles.ts                           B20 role hash decoding
  score-explanation.ts               main reason + score breakdown
  event-presentation.ts              readable event timeline display
  address.ts                         address validation/normalization
  config.ts                          mode + data source + network config
  sql.ts                             CDP SQL query builders
  cdp-sql.ts                         server-only CDP SQL client
  supabase-server.ts                 server-only Supabase client
  b20-cache.ts                       Supabase cache repository
  refresh.ts                         CDP -> Supabase refresh logic
  refresh-auth.ts                    x-refresh-secret validation
  data-source.ts                     mock / cdp / supabase abstraction
supabase/
  schema.sql                         cache schema
docs/
  DEPLOYMENT.md                      deployment runbook
  releases/                          release notes
```

## Environment variables

See [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `MOCK_MODE` | Defaults to `true`. Set `false` for live modes. |
| `DATA_SOURCE` | `mock`, `cdp`, or `supabase`. |
| `B20_NETWORK` | `base` or `base_sepolia`; `base-sepolia` is normalized. |
| `B20_FACTORY_ADDRESS` | B20 factory used for discovery. |
| `CDP_BEARER_TOKEN` | Server-side CDP SQL bearer token. Required for CDP mode and refresh. |
| `CDP_SQL_CACHE_MAX_AGE_MS` | CDP SQL cache max age. Default `3000`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Public-safe. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase service-role key. Never expose to browser. |
| `REFRESH_SECRET` | Shared secret required by refresh/diagnostics endpoints. |

## Tests and CI

```bash
npm run build
npm test
```

GitHub Actions runs on every pull request and push to `main`:

```txt
npm ci
npm run build
npm test
```

Tests cover address validation, SQL query builders, role hash decoding, risk scoring, Supabase cache conversion, refresh auth, diagnostics, score explanation, and event presentation.

## Current limitations

- Refresh is explicit. Public reads do not auto-refresh.
- No event diffing or alerting yet.
- Unknown/custom role hashes that are not in [`lib/roles.ts`](lib/roles.ts) are preserved safely and ignored by scoring.
- Score describes issuer-control capability, not malicious intent.
- No paid/x402 endpoints yet.

## Roadmap

1. Event diffing between refreshes.
2. Alerts for role, policy, pause, and supply-cap changes.
3. Shareable report metadata.
4. Paid / x402 endpoints for API access and premium monitoring.
