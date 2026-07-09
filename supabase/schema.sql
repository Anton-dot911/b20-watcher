-- B20 Watcher — Supabase schema (TASK-003 cache + refresh layer)
--
-- Run this against your Supabase project's Postgres database, e.g. from the
-- Supabase dashboard SQL editor or:
--   psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
-- These tables cache B20 token snapshots, their on-chain event timelines, and
-- computed issuer-control risk reports so the app can serve token pages quickly
-- without querying the CDP SQL API on every request. They are written ONLY by
-- the server-side refresh layer (lib/refresh.ts) using the Supabase
-- service-role key, and read by lib/b20-cache.ts in DATA_SOURCE=supabase mode.
--
-- Rows are network-scoped (base | base_sepolia) so a single project can hold
-- both networks without collisions, even when the same address exists on
-- multiple networks.

-- Token snapshots discovered from the B20 factory's B20Created events.
create table if not exists b20_tokens (
  address              text not null,
  network              text not null,
  name                 text,
  symbol               text,
  decimals             integer,
  variant              text,
  created_at           timestamptz,
  created_tx_hash      text,
  created_block_number bigint,
  created_log_index    integer,
  last_seen_at         timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (network, address)
);

-- Newest-first token listing per network (dashboard / getCachedTokens).
create index if not exists b20_tokens_network_created_at_idx
  on b20_tokens (network, created_at desc);

-- Normalized on-chain B20 events that drive risk scoring.
create table if not exists b20_events (
  id               text primary key,
  network          text not null,
  token_address    text not null,
  event_name       text not null,
  event_signature  text,
  block_timestamp  timestamptz,
  transaction_hash text not null,
  block_number     bigint not null,
  log_index        integer not null,
  args             jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  foreign key (network, token_address)
    references b20_tokens(network, address) on delete cascade,
  unique (network, transaction_hash, log_index)
);

-- Chronological timeline lookups scoped to a token on a network.
create index if not exists b20_events_timeline_idx
  on b20_events (network, token_address, block_number, log_index);

-- Latest computed risk report per token per network.
create table if not exists b20_risk_reports (
  token_address text not null,
  network       text not null,
  score         integer not null,
  level         text not null,
  summary       text not null,
  flags         jsonb not null,
  active_roles  jsonb not null,
  stats         jsonb not null,
  timeline      jsonb not null,
  generated_at  timestamptz not null,
  updated_at    timestamptz not null default now(),
  primary key (network, token_address),
  foreign key (network, token_address)
    references b20_tokens(network, address) on delete cascade
);
