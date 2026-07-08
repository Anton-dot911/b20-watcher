# AI developer agent prompt

You are implementing the independent MVP for **B20 Watcher / Risk Scanner**.

## Goal

Build a production-grade first version of a public dashboard and JSON API that tracks Base B20 native tokens and scores issuer-control risk.

## Non-negotiable scope

Ship:

- `/` recent B20 token list
- `/tokens/[address]` risk report page
- `/api/tokens`
- `/api/risk/[address]`
- CDP SQL API integration
- risk score from B20 role, policy, pause, supply, metadata, and burn-blocked events
- mock mode for local demo
- clean, modern UI

Do not ship:

- trading execution
- investment advice
- wallet custody
- full AgentVault+ integration
- large billing system
- custom indexer

## Data source

Use CDP SQL API first. Query `base.events` or `base_sepolia.events`.

## Required security

- Validate addresses before SQL interpolation.
- Never expose CDP tokens to the client.
- Server-side only CDP calls.
- Add rate limiting before public launch.
- Clearly label score as issuer-control risk, not price prediction.

## Immediate improvement tasks

1. Add automatic CDP JWT Bearer generation.
2. Add Supabase persistence for token snapshots.
3. Add event diffing and last-seen cursor.
4. Add report share metadata.
5. Add alerts for `RoleGranted`, `PolicyUpdated`, `Paused`, `SupplyCapUpdated`, and `BurnedBlocked`.
