// Runtime configuration.
//
// The app runs in mock mode by default. Setting MOCK_MODE=false switches the
// data source to the live CDP SQL API (see lib/data-source.ts).
//
// NOTE: the CDP bearer token is intentionally NOT read here. It is read only
// inside the server-only CDP client (lib/cdp-sql.ts) so it can never be pulled
// into a client bundle through this shared config module.

import { DEFAULT_B20_FACTORY_ADDRESS, parseNetwork } from "./sql";
import type { B20Network } from "./types";

/** Mock mode is the default; only an explicit "false" opts into live mode. */
export const MOCK_MODE = process.env.MOCK_MODE !== "false";

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

/** Human-readable label for the active data mode, used by the UI badge. */
export function dataModeLabel(): string {
  if (MOCK_MODE) return "Mock mode";
  return B20_NETWORK === "base_sepolia" ? "Live: Base Sepolia" : "Live: Base";
}
