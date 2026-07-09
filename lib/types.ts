// Core domain types for B20 Watcher.
//
// These model the on-chain B20 events that drive issuer-control risk scoring.
// The risk engine (lib/risk.ts) consumes B20Event[] and produces a RiskReport.

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export type RiskSeverity = "info" | "low" | "moderate" | "high" | "critical";

/**
 * Networks the scanner can query. These map 1:1 to CDP SQL event tables
 * (see lib/sql.ts). The hyphenated form `base-sepolia` is normalized to the
 * underscore form before it reaches this type.
 */
export type B20Network = "base" | "base_sepolia";

/**
 * Where B20 data is read from. `mock` serves bundled fixtures, `cdp` queries the
 * CDP SQL API directly, and `supabase` reads the Supabase cache populated by the
 * refresh layer. See lib/config.ts for how MOCK_MODE/DATA_SOURCE resolve this.
 */
export type DataSource = "mock" | "cdp" | "supabase";

/**
 * Built-in B20 role identifiers the risk engine recognizes. These map to
 * on-chain role hashes but are kept human-readable here.
 */
export type KnownB20Role =
  | "DEFAULT_ADMIN_ROLE"
  | "MINT_ROLE"
  | "BURN_ROLE"
  | "BURN_BLOCKED_ROLE"
  | "PAUSE_ROLE"
  | "UNPAUSE_ROLE"
  | "METADATA_ROLE"
  | "OPERATOR_ROLE";

/**
 * A B20 role. Live CDP data may carry a role as a raw bytes32 hash that we
 * cannot decode yet, so the type also admits arbitrary strings. Known roles
 * keep autocomplete; unknown ones are preserved verbatim and ignored by the
 * risk engine instead of crashing it. The `string & {}` keeps the known
 * literals visible in editors while still accepting any string.
 */
export type B20Role = KnownB20Role | (string & {});

/**
 * Event names emitted by B20 tokens that the risk engine understands.
 */
export type KnownB20EventName =
  | "RoleGranted"
  | "RoleRevoked"
  | "RoleAdminChanged"
  | "LastAdminRenounced"
  | "Paused"
  | "Unpaused"
  | "PolicyUpdated"
  | "SupplyCapUpdated"
  | "BurnedBlocked"
  | "NameUpdated"
  | "SymbolUpdated"
  | "MultiplierUpdated"
  | "Announcement";

/**
 * A B20 event name. Live CDP data can surface event types the risk engine does
 * not score (e.g. `ContractURIUpdated`), so arbitrary strings are admitted and
 * simply ignored by the engine's `default` branch.
 */
export type B20EventName = KnownB20EventName | (string & {});

/**
 * A single normalized B20 event. The `args` bag carries event-specific
 * parameters (role name, target account, policy id, supply cap, etc.).
 */
export interface B20Event {
  name: B20EventName;
  blockNumber: number;
  logIndex: number;
  timestamp: string; // ISO-8601
  transactionHash: string;
  args: Record<string, string | number>;
}

/**
 * A risk flag surfaced on the report. Each flag maps to one or more events
 * or to a derived condition (e.g. active admin role).
 */
export interface RiskFlag {
  id: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  points: number;
}

/**
 * Current holder state of a role, derived by replaying grant/revoke events.
 */
export interface RoleState {
  role: B20Role;
  active: boolean;
  holders: string[];
}

export interface RiskStats {
  totalEvents: number;
  activeRoleCount: number;
  flagCount: number;
  paused: boolean;
  adminRenounced: boolean;
}

export interface RiskReport {
  tokenAddress: string;
  score: number;
  level: RiskLevel;
  summary: string;
  flags: RiskFlag[];
  activeRoles: RoleState[];
  stats: RiskStats;
  timeline: B20Event[];
  generatedAt: string; // ISO-8601
}

/**
 * Lightweight token record used by the dashboard and /api/tokens.
 */
export interface B20Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  variant: string;
  createdAt: string; // ISO-8601
  events: B20Event[];
}
