// SQL query builders for the CDP SQL API.
//
// These are pure string builders with NO network access and NO secrets, so
// they are safe to unit test in isolation (see lib/sql.test.ts). All the
// safety-critical decisions live here:
//
//   * Table names come ONLY from the validated `B20Network` enum, never from
//     raw user input, so a caller cannot inject a table name.
//   * Token/factory addresses are validated as 20-byte hex before they are
//     interpolated, so they cannot carry SQL metacharacters.
//   * Row limits are clamped to safe ranges.

import { isValidAddress } from "./address";
import type { B20Network } from "./types";

/**
 * Maps each supported network to its CDP SQL events table. Because the key type
 * is `B20Network`, only validated networks can select a table.
 */
export const NETWORK_TABLES: Record<B20Network, string> = {
  base: "base.events",
  base_sepolia: "base_sepolia.events",
};

/** The B20 factory that emits `B20Created` on token deployment. */
export const DEFAULT_B20_FACTORY_ADDRESS =
  "0xB20f000000000000000000000000000000000000";

/** Event signature emitted by the factory when a new B20 token is created. */
export const B20_CREATED_SIGNATURE =
  "B20Created(address,uint8,string,string,uint8,bytes)";

/**
 * Token-level event signatures the scanner pulls for the risk timeline. Order
 * is irrelevant to the query; the risk engine only acts on the ones it knows.
 */
export const B20_EVENT_SIGNATURES = [
  "RoleGranted(bytes32,address,address)",
  "RoleRevoked(bytes32,address,address)",
  "RoleAdminChanged(bytes32,bytes32,bytes32)",
  "LastAdminRenounced(address)",
  "Paused(address,uint8[])",
  "Unpaused(address,uint8[])",
  "PolicyUpdated(bytes32,uint64,uint64)",
  "SupplyCapUpdated(address,uint256,uint256)",
  "BurnedBlocked(address,address,uint256)",
  "ContractURIUpdated()",
  "NameUpdated(address,string)",
  "SymbolUpdated(address,string)",
  "EIP712DomainChanged()",
  "MultiplierUpdated(uint256)",
  "ExtraMetadataUpdated(string,string)",
  "Announcement(address,string,string,string)",
  "EndAnnouncement(string)",
] as const;

/**
 * Parses/normalizes an arbitrary network string into a `B20Network`.
 * Accepts hyphenated `base-sepolia` and any casing; returns null for anything
 * that is not a supported network. Returning null (rather than a default) lets
 * callers surface a clear configuration error.
 */
export function parseNetwork(
  raw: string | null | undefined
): B20Network | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "base") return "base";
  if (normalized === "base_sepolia") return "base_sepolia";
  return null;
}

/**
 * Clamps a limit into `[min, max]`, flooring to an integer. Non-finite input
 * (NaN, Infinity) falls back to `min`.
 */
export function clampLimit(value: number, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function tableFor(network: B20Network): string {
  const table = NETWORK_TABLES[network];
  // Defensive: `network` is typed, but guard against a bad value slipping
  // through untyped JS callers so we never emit `FROM undefined`.
  if (!table) throw new Error(`Unsupported B20 network: ${String(network)}`);
  return table;
}

/**
 * Builds the token-discovery query: the most recent `B20Created` events from
 * the factory on the given network.
 *
 * @param network        validated network enum (selects the SQL table)
 * @param limit          desired row count, clamped to 1–100
 * @param factoryAddress factory contract; validated, falls back to the default
 */
export function discoverB20TokensSql(
  network: B20Network,
  limit: number,
  factoryAddress: string = DEFAULT_B20_FACTORY_ADDRESS
): string {
  const table = tableFor(network);
  const safeLimit = clampLimit(limit, 1, 100);
  const factory = isValidAddress(factoryAddress)
    ? factoryAddress
    : DEFAULT_B20_FACTORY_ADDRESS;

  return `SELECT
  block_timestamp,
  transaction_hash,
  parameters['token'] AS token_address,
  parameters['name'] AS name,
  parameters['symbol'] AS symbol,
  parameters['decimals'] AS decimals,
  parameters['variant'] AS variant,
  block_number,
  log_index
FROM ${table}
WHERE event_signature = '${B20_CREATED_SIGNATURE}'
  AND address = '${factory}'
  AND action = 'added'
ORDER BY block_timestamp DESC
LIMIT ${safeLimit}`;
}

/**
 * Builds the token event-timeline query for a single token.
 *
 * @param network      validated network enum (selects the SQL table)
 * @param tokenAddress token contract; MUST be a valid address or this throws
 * @param limit        desired row count, clamped to 1–5000
 */
export function b20TokenEventsSql(
  network: B20Network,
  tokenAddress: string,
  limit: number
): string {
  const table = tableFor(network);
  if (!isValidAddress(tokenAddress)) {
    throw new Error("Invalid token address for SQL construction.");
  }
  const address = tokenAddress.toLowerCase();
  const safeLimit = clampLimit(limit, 1, 5000);
  const signatures = B20_EVENT_SIGNATURES.map((s) => `    '${s}'`).join(",\n");

  return `SELECT
  block_timestamp,
  transaction_hash,
  event_name,
  event_signature,
  parameters,
  block_number,
  log_index
FROM ${table}
WHERE address = '${address}'
  AND action = 'added'
  AND event_signature IN (
${signatures}
  )
ORDER BY block_number ASC, log_index ASC
LIMIT ${safeLimit}`;
}
