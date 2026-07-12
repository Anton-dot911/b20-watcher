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
