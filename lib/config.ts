// Runtime configuration.
//
// The app runs in mock mode by default. Setting MOCK_MODE=false switches to a
// live data source selected by DATA_SOURCE:
//   * cdp      — query the CDP SQL API directly (lib/data-source.ts)
//   * supabase — read cached snapshots/reports from Supabase (lib/b20-cache.ts)
//
// NOTE: neither the CDP bearer token nor the Supabase service-role key is read
// here. They are read only inside their server-only clients (lib/cdp-sql.ts,
// lib/supabase-server.ts) so they can never be pulled into a client bundle
// through this shared config module.

import { DEFAULT_B20_FACTORY_ADDRESS, parseNetwork } from "./sql";
import type { B20Network, DataSource } from "./types";

/** Mock mode is the default; only an explicit "false" opts into live mode. */
export const MOCK_MODE = process.env.MOCK_MODE !== "false";

/**
 * Parses/normalizes an arbitrary data-source string into a `DataSource`.
 * Returns null for anything unsupported so callers can decide on a fallback.
 */
export function parseDataSource(
  raw: string | null | undefined
): DataSource | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "mock") return "mock";
  if (normalized === "cdp") return "cdp";
  if (normalized === "supabase") return "supabase";
  return null;
}

/**
 * The effective data source.
 *
 * MOCK_MODE=true always wins and resolves to `mock`. Otherwise DATA_SOURCE
 * selects `cdp` or `supabase`; an unset or invalid DATA_SOURCE falls back
 * safely to `cdp` (the original live behavior) rather than crashing.
 */
export const DATA_SOURCE: DataSource = MOCK_MODE
  ? "mock"
  : parseDataSource(process.env.DATA_SOURCE) ?? "cdp";

/**
 * Active network, normalized to the `B20Network` enum. Unsupported values fall
 * back to `base` so the app stays usable rather than crashing on a typo.
 */
export const B20_NETWORK: B20Network =
  parseNetwork(process.env.B20_NETWORK) ?? "base";

/** Factory used for token discovery. Falls back to the canonical B20 factory. */
export const B20_FACTORY_ADDRESS =
  process.env.B20_FACTORY_ADDRESS ?? DEFAULT_B20_FACTORY_ADDRESS;

/**
 * `maxAgeMs` passed to the CDP SQL cache. Defaults to 3000ms; non-numeric or
 * negative values fall back to the default.
 */
export const CDP_SQL_CACHE_MAX_AGE_MS = (() => {
  const raw = Number(process.env.CDP_SQL_CACHE_MAX_AGE_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 3000;
})();

/**
 * Human-readable label for the active data mode, used by the UI badge. Examples:
 *   "Mock mode"
 *   "Live: CDP / Base"          "Live: CDP / Base Sepolia"
 *   "Cached: Supabase / Base"   "Cached: Supabase / Base Sepolia"
 */
export function dataModeLabel(): string {
  if (DATA_SOURCE === "mock") return "Mock mode";
  const network = B20_NETWORK === "base_sepolia" ? "Base Sepolia" : "Base";
  if (DATA_SOURCE === "supabase") return `Cached: Supabase / ${network}`;
  return `Live: CDP / ${network}`;
}
