// Supabase-backed cache repository for B20 tokens, events, and risk reports.
//
// This is the read/write seam for DATA_SOURCE=supabase. Reads are used by the
// data-source layer to serve token pages quickly; writes are used by the
// refresh layer (lib/refresh.ts) to populate the cache from CDP SQL.
//
// Server-only: it reaches the service-role Supabase client, so this module must
// never end up in a client bundle.
import "server-only";

import { normalizeAddress } from "./address";
import { B20_NETWORK } from "./config";
import { getSupabaseServerClient } from "./supabase-server";
import type {
  B20Event,
  B20EventName,
  B20Network,
  RiskFlag,
  RiskLevel,
  RiskReport,
  RiskStats,
  RoleState,
  B20Token,
} from "./types";

const EPOCH_ISO = new Date(0).toISOString();

/** Supabase upsert conflict target for b20_tokens. Mirrors primary key (network, address). */
export const TOKEN_UPSERT_CONFLICT_TARGET = "network,address";

/** Supabase upsert conflict target for b20_events. Mirrors unique(network, transaction_hash, log_index). */
export const EVENT_UPSERT_CONFLICT_TARGET =
  "network,transaction_hash,log_index";

/** Supabase upsert conflict target for b20_risk_reports. Mirrors primary key (network, token_address). */
export const RISK_REPORT_UPSERT_CONFLICT_TARGET = "network,token_address";

// --- DB row shapes ----------------------------------------------------------

interface TokenRow {
  address: string;
  network: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  variant: string | null;
  created_at: string | null;
  created_tx_hash: string | null;
  created_block_number: number | null;
  created_log_index: number | null;
  last_seen_at?: string;
  updated_at?: string;
}

interface EventRow {
  id: string;
  network: string;
  token_address: string;
  event_name: string;
  event_signature: string | null;
  block_timestamp: string | null;
  transaction_hash: string;
  block_number: number;
  log_index: number;
  args: Record<string, string | number>;
}

interface RiskReportRow {
  token_address: string;
  network: string;
  score: number;
  level: string;
  summary: string;
  flags: RiskFlag[];
  active_roles: RoleState[];
  stats: RiskStats;
  timeline: B20Event[];
  generated_at: string;
  updated_at?: string;
}

// --- JSONB safety -----------------------------------------------------------

/**
 * Postgres JSONB rejects the zero byte, even when it arrives through JSON escape
 * sequences such as \u0000. CDP event parameters may contain arbitrary metadata,
 * so sanitize JSON payloads before upserting them into Supabase JSONB columns.
 */
export function sanitizeJsonbValue<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/\u0000/g, "") as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonbValue(item)) as T;
  }

  if (value && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      clean[key] = sanitizeJsonbValue(nested);
    }
    return clean as T;
  }

  return value;
}

// --- Row <-> internal type conversions --------------------------------------

/** Converts a `b20_tokens` row into the internal `B20Token` shape. */
export function rowToToken(row: TokenRow): B20Token {
  return {
    address: row.address,
    name: row.name ?? "",
    symbol: row.symbol ?? "",
    decimals: row.decimals ?? 0,
    variant: row.variant ?? "",
    createdAt: row.created_at ?? EPOCH_ISO,
    events: [],
  };
}

/** Converts a `b20_risk_reports` row into the internal `RiskReport` shape. */
export function rowToRiskReport(row: RiskReportRow): RiskReport {
  return {
    tokenAddress: row.token_address,
    score: row.score,
    level: row.level as RiskLevel,
    summary: row.summary,
    flags: row.flags ?? [],
    activeRoles: row.active_roles ?? [],
    stats: row.stats,
    timeline: row.timeline ?? [],
    generatedAt: row.generated_at,
  };
}

/** Converts a `b20_events` row into the internal `B20Event` shape. */
export function rowToEvent(row: EventRow): B20Event {
  return {
    name: row.event_name as B20EventName,
    blockNumber: row.block_number,
    logIndex: row.log_index,
    timestamp: row.block_timestamp ?? EPOCH_ISO,
    transactionHash: row.transaction_hash,
    args: row.args ?? {},
  };
}

/** Deterministic primary key for an event row. */
function eventId(network: B20Network, event: B20Event): string {
  return `${network}:${event.transactionHash.toLowerCase()}:${event.logIndex}`;
}

// --- Reads ------------------------------------------------------------------

/**
 * Returns cached tokens for the active network, newest first. Returns an empty
 * array (never throws) when the cache is empty.
 */
export async function getCachedTokens(limit = 50): Promise<B20Token[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("b20_tokens")
    .select("*")
    .eq("network", B20_NETWORK)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.floor(limit)));

  if (error) {
    throw new Error(`Failed to read cached tokens: ${error.message}`);
  }
  return (data ?? []).map((row) => rowToToken(row as TokenRow));
}

/**
 * Returns a single cached token by address, or null when the address is invalid
 * or not present in the cache.
 */
export async function getCachedToken(address: string): Promise<B20Token | null> {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("b20_tokens")
    .select("*")
    .eq("network", B20_NETWORK)
    .eq("address", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read cached token: ${error.message}`);
  }
  return data ? rowToToken(data as TokenRow) : null;
}

/**
 * Returns the cached risk report for a token, or null when the address is
 * invalid or no report has been cached yet.
 */
export async function getCachedRiskReport(
  address: string
): Promise<RiskReport | null> {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("b20_risk_reports")
    .select("*")
    .eq("network", B20_NETWORK)
    .eq("token_address", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read cached risk report: ${error.message}`);
  }
  return data ? rowToRiskReport(data as RiskReportRow) : null;
}

// --- Writes -----------------------------------------------------------------

/**
 * Upserts token snapshots for the active network. Invalid addresses are
 * skipped. A no-op on an empty list.
 */
export async function upsertTokens(tokens: B20Token[]): Promise<void> {
  const now = new Date().toISOString();
  const rows: TokenRow[] = [];
  for (const token of tokens) {
    const normalized = normalizeAddress(token.address);
    if (!normalized) continue;
    rows.push({
      address: normalized,
      network: B20_NETWORK,
      name: token.name || null,
      symbol: token.symbol || null,
      decimals: Number.isFinite(token.decimals) ? token.decimals : null,
      variant: token.variant || null,
      created_at: token.createdAt || null,
      created_tx_hash: null,
      created_block_number: null,
      created_log_index: null,
      last_seen_at: now,
      updated_at: now,
    });
  }
  if (rows.length === 0) return;

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("b20_tokens")
    .upsert(rows, { onConflict: TOKEN_UPSERT_CONFLICT_TARGET });
  if (error) {
    throw new Error(`Failed to upsert tokens: ${error.message}`);
  }
}

/**
 * Upserts a token's event timeline. The token row must already exist (events
 * reference b20_tokens). Invalid token addresses throw; a no-op on empty input.
 */
export async function upsertEvents(
  tokenAddress: string,
  events: B20Event[]
): Promise<void> {
  const normalized = normalizeAddress(tokenAddress);
  if (!normalized) {
    throw new Error("Invalid token address for event upsert.");
  }
  if (events.length === 0) return;

  const rows: EventRow[] = events.map((event) => ({
    id: eventId(B20_NETWORK, event),
    network: B20_NETWORK,
    token_address: normalized,
    event_name: String(event.name),
    event_signature: null,
    block_timestamp: event.timestamp || null,
    transaction_hash: event.transactionHash,
    block_number: event.blockNumber,
    log_index: event.logIndex,
    args: sanitizeJsonbValue(event.args ?? {}),
  }));

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("b20_events")
    .upsert(rows, { onConflict: EVENT_UPSERT_CONFLICT_TARGET });
  if (error) {
    throw new Error(`Failed to upsert events: ${error.message}`);
  }
}

/**
 * Upserts the latest risk report for a token on the active network. Invalid
 * token addresses throw.
 */
export async function upsertRiskReport(report: RiskReport): Promise<void> {
  const normalized = normalizeAddress(report.tokenAddress);
  if (!normalized) {
    throw new Error("Invalid token address for risk-report upsert.");
  }

  const row: RiskReportRow = {
    token_address: normalized,
    network: B20_NETWORK,
    score: report.score,
    level: report.level,
    summary: report.summary,
    flags: sanitizeJsonbValue(report.flags),
    active_roles: sanitizeJsonbValue(report.activeRoles),
    stats: sanitizeJsonbValue(report.stats),
    timeline: sanitizeJsonbValue(report.timeline),
    generated_at: report.generatedAt,
    updated_at: new Date().toISOString(),
  };

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("b20_risk_reports")
    .upsert(row, { onConflict: RISK_REPORT_UPSERT_CONFLICT_TARGET });
  if (error) {
    throw new Error(`Failed to upsert risk report: ${error.message}`);
  }
}
