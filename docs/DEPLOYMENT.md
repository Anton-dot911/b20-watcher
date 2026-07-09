# Deployment runbook

This runbook is for deploying **B20 Watcher / Risk Scanner** with Supabase cached mode.

The safest production path is:

1. Deploy in mock mode.
2. Apply Supabase schema.
3. Add production secrets.
4. Switch to cached Supabase mode.
5. Run a small refresh smoke test.
6. Verify public read endpoints.
7. Enable scheduled refresh.

The app can be deployed to either **Vercel** or **Netlify**. Vercel is the most direct Next.js path, but Netlify is also supported for this architecture.

## 1. Vercel project

Import the GitHub repository into Vercel.

Build settings:

```txt
Framework preset: Next.js
Install command: npm ci
Build command: npm run build
Output: default Next.js output
```

Initial safe env:

```env
MOCK_MODE=true
DATA_SOURCE=mock
B20_NETWORK=base
```

Deploy and check:

```bash
curl https://<your-domain>/api/health
curl https://<your-domain>/api/tokens
```

The header should show `Mock mode`.

## 2. Netlify project

Import the GitHub repository into Netlify.

Build settings:

```txt
Framework preset: Next.js
Install command: npm ci
Build command: npm run build
Publish directory: .next
```

Initial safe env:

```env
MOCK_MODE=true
DATA_SOURCE=mock
B20_NETWORK=base
```

Deploy and check:

```bash
curl https://<your-site>.netlify.app/api/health
curl https://<your-site>.netlify.app/api/tokens
```

Expected:

- `/api/health` returns a secret-free health payload.
- `/api/tokens` returns mock tokens.
- The app header shows `Mock mode`.

Netlify should treat Next.js route handlers such as `/api/health`, `/api/tokens`, `/api/risk/[address]`, and `/api/refresh/*` as server-side functions. Refresh endpoints may take longer than simple read endpoints, so start with a small refresh limit, such as `5`.

## 3. Supabase schema

Create a Supabase project and run:

```sql
-- paste contents of supabase/schema.sql into the Supabase SQL editor
```

The schema creates:

- `b20_tokens`
- `b20_events`
- `b20_risk_reports`

Rows are scoped by `network`, so the same token address can exist on `base` and `base_sepolia` without collision.

## 4. Production env vars

For cached Supabase mode, set these in your hosting provider:

```env
MOCK_MODE=false
DATA_SOURCE=supabase
B20_NETWORK=base
B20_FACTORY_ADDRESS=0xB20f000000000000000000000000000000000000

NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
REFRESH_SECRET=<long-random-secret>

CDP_BEARER_TOKEN=<cdp-sql-bearer-token>
CDP_SQL_CACHE_MAX_AGE_MS=3000
```

Security rules:

- `NEXT_PUBLIC_SUPABASE_URL` may be public.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed in client code.
- `CDP_BEARER_TOKEN` must never be exposed in client code.
- `REFRESH_SECRET` must be long and random.
- Refresh endpoints must not be public without the `x-refresh-secret` header.

## 5. Health check

After setting env vars and redeploying:

```bash
curl https://<your-domain>/api/health
```

Expected shape:

```json
{
  "ok": true,
  "service": "b20-watcher",
  "mockMode": false,
  "dataSource": "supabase",
  "network": "base",
  "modeLabel": "Cached: Supabase / Base",
  "generatedAt": "..."
}
```

This endpoint is intentionally secret-free and does not call CDP or Supabase.

## 6. Refresh smoke test

Run a conservative refresh first:

```bash
curl -X POST https://<your-domain>/api/refresh/recent \
  -H "Content-Type: application/json" \
  -H "x-refresh-secret: <REFRESH_SECRET>" \
  -d '{"limit": 5}'
```

Expected shape:

```json
{
  "network": "base",
  "tokens": 5,
  "events": 123,
  "reports": 5
}
```

Actual counts may differ depending on live B20 data and CDP response.

## 7. Public read smoke tests

After refresh:

```bash
curl https://<your-domain>/api/tokens
curl https://<your-domain>/api/risk/<token-address>
```

Expected:

- `/api/tokens` returns `mockMode: false`, `network: "base"`, and a non-empty token list.
- `/api/risk/<token-address>` returns a report with `score`, `level`, `flags`, `activeRoles`, `stats`, and `timeline`.

## 8. Scheduled refresh with GitHub Actions

After the first manual refresh works, enable the scheduled refresh workflow:

```txt
.github/workflows/refresh-cache.yml
```

It runs every 6 hours and can also be started manually from the **Actions** tab.

Create these GitHub Actions secrets in the repository:

```txt
B20_WATCHER_REFRESH_URL=https://<your-domain>/api/refresh/recent
B20_WATCHER_REFRESH_SECRET=<same value as REFRESH_SECRET in your hosting provider>
```

For Netlify:

```txt
B20_WATCHER_REFRESH_URL=https://<your-site>.netlify.app/api/refresh/recent
```

For Vercel:

```txt
B20_WATCHER_REFRESH_URL=https://<your-domain>.vercel.app/api/refresh/recent
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

## 9. Failure diagnostics

### `/api/health` works but `/api/tokens` fails

Likely Supabase env or schema issue:

- verify `NEXT_PUBLIC_SUPABASE_URL`
- verify `SUPABASE_SERVICE_ROLE_KEY`
- verify `supabase/schema.sql` was applied
- verify `DATA_SOURCE=supabase`

### Refresh returns `401`

The `x-refresh-secret` header is missing or does not match `REFRESH_SECRET`.

For scheduled refresh, verify:

- GitHub secret `B20_WATCHER_REFRESH_SECRET`
- hosting env var `REFRESH_SECRET`
- both values are identical

### Refresh returns `500`

Common causes:

- `REFRESH_SECRET` missing on server
- `CDP_BEARER_TOKEN` missing or expired
- Supabase service-role key missing or wrong
- Supabase schema not applied
- CDP SQL API returned an upstream error
- refresh request exceeded the hosting provider's function limits

On Netlify, reduce the refresh body to a smaller limit first:

```bash
curl -X POST https://<your-site>.netlify.app/api/refresh/recent \
  -H "Content-Type: application/json" \
  -H "x-refresh-secret: <REFRESH_SECRET>" \
  -d '{"limit": 2}'
```

### Dashboard is empty in cached mode

This is expected before the first refresh. Run:

```bash
curl -X POST https://<your-domain>/api/refresh/recent \
  -H "Content-Type: application/json" \
  -H "x-refresh-secret: <REFRESH_SECRET>" \
  -d '{"limit": 5}'
```

## 10. Suggested operating cadence

Start conservatively:

- first manual refresh after deploy: `limit: 5`
- scheduled refresh: every 6 hours, `limit: 20`
- single-token refresh when checking a specific token manually

Later work can add event diffing, alerts, and a dedicated refresh job queue if the endpoint becomes too slow for serverless functions.
