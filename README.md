# B20 Watcher / Risk Scanner

![CI](https://github.com/Anton-dot911/b20-watcher/actions/workflows/ci.yml/badge.svg)

Independent MVP for tracking and risk-scoring **Base B20 native tokens**.

> Know who controls a B20 token before you trust it.

B20 Watcher is a public dashboard and JSON API that estimates **issuer-control and operational risk** for B20 tokens from observed role, policy, pause, metadata, and supply events.

This is **not** a trading bot, price predictor, or investment advice.

## Current milestone

**`v0.2.0-live-cache-mobile-mvp`**

This milestone validates the product-quality live cached MVP.

## Role decoding note

Known B20 role hashes are decoded in `lib/roles.ts`. For role events, the CDP timeline query selects `topic1 AS role_topic` so the scanner can recover the canonical role hash even when `parameters.role` is empty or decoded as unreadable bytes.

After deploying role-decoder changes, run the refresh workflow again. Existing Supabase-cached reports keep their old timeline payload until refresh rewrites them.
