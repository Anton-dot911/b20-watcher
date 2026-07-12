// Server-only CDP SQL API client and row normalization.
//
// `import "server-only"` makes any attempt to bundle this module into client
// code a build-time error, so the CDP bearer token can never reach the browser.
// The token is read from the environment ONLY inside runCdpSql.
import "server-only";

import { CDP_SQL_CACHE_MAX_AGE_MS } from "./config";
import { resolveRole } from "./roles";
import type { B20Event, B20EventName, B20Token } from "./types";

export { resolveRole } from "./roles";

const CDP_SQL_ENDPOINT =
  "https://api.cdp.coinbase.com/platform/v2/data/query/run";

/** Shape of a `B20Created` discovery row (see discoverB20TokensSql). */
export interface CdpB20CreatedRow {
  block_timestamp?: string | number | null;
  transaction_hash?: string | null;
  token_address?: string | null;
  name?: string | null;
  symbol?: string | null;
  decimals?: string | number | null;
  variant?: string | null;
  block_number?: string | number | null;
  log_index?: string | number | null;
}

/** Shape of a token-timeline row (see b20TokenEventsSql). */
export interface CdpEventRow {
  block_timestamp?: string | number | null;
  transaction_hash?: string | null;
  event_name?: string | null;
  event_signature?: string | null;
  parameters?: unknown;
  block_number?: string | number | null;
  log_index?: string | number | null;
}

/**
 * Runs a SQL query against the CDP SQL API and returns the result rows.
 *
 * Throws a clear error when the bearer token is missing (i.e. live mode is
 * misconfigured), when the HTTP response is not ok, or when the response body
 * has no `result` field. The bearer token is never included in thrown errors.
 */
export async function runCdpSql<T>(sql: string): Promise<T[]> {
  const token = process.env.CDP_BEARER_TOKEN;
  if (!token) {
    throw new Error(
      "CDP_BEARER_TOKEN is not set. It is required when MOCK_MODE=false."
    );
  }

  const response = await fetch(CDP_SQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, cache: { maxAgeMs: CDP_SQL_CACHE_MAX_AGE_MS } }),
    // Data freshness is governed by the CDP cache, not Next's fetch cache.
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `CDP SQL request failed with status ${response.status}` +
        (detail ? `: ${detail.slice(0, 200)}` : "")
    );
  }

  const body = (await response.json()) as { result?: T[] } | null;
  if (!body || !("result" in body)) {
    throw new Error("CDP SQL response did not include a result field.");
  }

  return body.result ?? [];
}

// --- Row normalization ------------------------------------------------------

const ROLE_EVENT_NAMES: ReadonlySet<string> = new Set([
  "RoleGranted",
  "RoleRevoked",
  "RoleAdminChanged",
]);

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Best-effort conversion of a CDP timestamp to an ISO-8601 string. */
function toIsoTimestamp(value: unknown): string {
  const epoch = () => new Date(0).toISOString();
  if (value == null) return epoch();

  if (typeof value === "number") {
    // Heuristic: values below ~1e12 are seconds, otherwise milliseconds.
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? epoch() : d.toISOString();
  }

  const s = String(value).trim();
  if (/^\d+$/.test(s)) return toIsoTimestamp(Number(s));

  // CDP often returns "2024-01-01 00:00:00.000" (space separator, no zone).
  const withT = s.includes("T") ? s : s.replace(" ", "T");
  const hasZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(withT);
  const d = new Date(hasZone ? withT : `${withT}Z`);
  return Number.isNaN(d.getTime()) ? epoch() : d.toISOString();
}

function parseParameters(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

function toArgs(params: Record<string, unknown>): Record<string, string | number> {
  const args: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    args[key] = typeof value === "number" ? value : String(value);
  }
  return args;
}

function signatureToName(signature: string): string {
  const paren = signature.indexOf("(");
  return paren === -1 ? signature : signature.slice(0, paren);
}

/**
 * Normalizes a `B20Created` discovery row into a `B20Token`. The event log is
 * left empty here; the per-token timeline is fetched separately when a risk
 * report is built. The address is lowercased for consistent lookup.
 */
export function normalizeB20CreatedRow(row: CdpB20CreatedRow): B20Token {
  const rawAddress = row.token_address != null ? String(row.token_address) : "";
  return {
    address: rawAddress.toLowerCase(),
    name: row.name != null ? String(row.name) : "",
    symbol: row.symbol != null ? String(row.symbol) : "",
    decimals: toNumber(row.decimals),
    variant: row.variant != null ? String(row.variant) : "",
    createdAt: toIsoTimestamp(row.block_timestamp),
    events: [],
  };
}

/**
 * Normalizes a CDP timeline row into the internal `B20Event` shape. Returns
 * null when the row has neither an event name nor a signature to derive one
 * from. Known role hashes on role events are decoded to role names; unknown
 * roles are preserved verbatim and ignored by scoring.
 */
export function normalizeEventRow(row: CdpEventRow): B20Event | null {
  const signature =
    typeof row.event_signature === "string" ? row.event_signature : "";
  const name =
    (row.event_name != null && String(row.event_name)) ||
    signatureToName(signature);
  if (!name) return null;

  const args = toArgs(parseParameters(row.parameters));
  if (ROLE_EVENT_NAMES.has(name) && args.role != null) {
    args.role = resolveRole(args.role);
  }

  return {
    name: name as B20EventName,
    blockNumber: toNumber(row.block_number),
    logIndex: toNumber(row.log_index),
    timestamp: toIsoTimestamp(row.block_timestamp),
    transactionHash:
      row.transaction_hash != null ? String(row.transaction_hash) : "",
    args,
  };
}
