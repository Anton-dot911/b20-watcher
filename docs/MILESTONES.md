# Milestones

## v0.1.0 — Live cached refresh on Base Sepolia

Status: stable infrastructure milestone.

Validated refresh result:

```json
{
  "network": "base_sepolia",
  "tokens": 5,
  "events": 34,
  "reports": 5,
  "partial": false,
  "errors": []
}
```

Confirmed working:

- Netlify deployment
- GitHub Actions manual refresh
- Refresh endpoint authentication
- CDP B20 factory discovery
- CDP token timeline reads
- Supabase token cache writes
- Supabase event cache writes
- Supabase risk report writes
- JSONB payload sanitization for CDP event metadata
- Base Sepolia live cached data

Current production-like environment mode:

```env
MOCK_MODE=false
DATA_SOURCE=supabase
B20_NETWORK=base_sepolia
B20_FACTORY_ADDRESS=0xB20f000000000000000000000000000000000000
CDP_SQL_CACHE_MAX_AGE_MS=3000
```

Security notes:

- Secrets are stored only in Netlify and GitHub Actions.
- Do not commit `CDP_BEARER_TOKEN`.
- Do not commit `SUPABASE_SERVICE_ROLE_KEY`.
- Do not commit `REFRESH_SECRET` or `B20_WATCHER_REFRESH_SECRET`.

Known limitations:

- Base mainnet may still return zero B20 discovery rows.
- The validated live data source is Base Sepolia.
- No monetization layer yet.
- No alerts yet.
- UI still needs polish for live cached data.

Next recommended task:

```txt
TASK-011: UI polish for live cached data
```
