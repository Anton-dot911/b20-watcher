// B20 issuer-control risk engine.
//
// buildRiskReport replays a token's B20 events to derive current role state and
// operational conditions, then translates those into weighted risk flags and a
// 0-100 score. The score estimates issuer-control and operational risk — it is
// NOT a price prediction. Regulated tokens may intentionally use freeze,
// blocklist, and supply controls, so flags describe controls rather than
// automatically labeling them malicious.

import type {
  B20Event,
  B20Role,
  RiskFlag,
  RiskLevel,
  RiskReport,
  RiskStats,
  RoleState,
} from "./types";

// Built-in B20 roles the scanner recognizes. These are kept human-readable for
// the MVP (no role-hash decoding yet). OPERATOR_ROLE is relevant for Asset
// variant features such as multiplier and announcements. Policy changes are
// admin-gated and tracked as PolicyUpdated events, not as a dedicated role.
const ALL_ROLES: B20Role[] = [
  "DEFAULT_ADMIN_ROLE",
  "MINT_ROLE",
  "BURN_ROLE",
  "BURN_BLOCKED_ROLE",
  "PAUSE_ROLE",
  "UNPAUSE_ROLE",
  "METADATA_ROLE",
  "OPERATOR_ROLE",
];

/** Chronological ordering by block number then log index. */
function chronological(a: B20Event, b: B20Event): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
  return a.logIndex - b.logIndex;
}

/** Score-to-level thresholds (see docs/RISK_MODEL.md). */
function levelForScore(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

interface DerivedState {
  roleHolders: Map<B20Role, Set<string>>;
  adminRenounced: boolean;
  paused: boolean;
  policyUpdates: number;
  supplyCapUpdates: number;
  burnedBlocked: number;
}

/**
 * Replays events chronologically to derive current on-chain state:
 * role holders, admin-renounced status, and pause status.
 */
function deriveState(events: B20Event[]): DerivedState {
  const roleHolders = new Map<B20Role, Set<string>>();
  for (const role of ALL_ROLES) roleHolders.set(role, new Set());

  let adminRenounced = false;
  let paused = false;
  let policyUpdates = 0;
  let supplyCapUpdates = 0;
  let burnedBlocked = 0;

  const ordered = [...events].sort(chronological);

  for (const event of ordered) {
    switch (event.name) {
      case "RoleGranted": {
        const role = String(event.args.role) as B20Role;
        const account = String(event.args.account ?? "").toLowerCase();
        const holders = roleHolders.get(role);
        if (holders && account) holders.add(account);
        break;
      }
      case "RoleRevoked": {
        const role = String(event.args.role) as B20Role;
        const account = String(event.args.account ?? "").toLowerCase();
        const holders = roleHolders.get(role);
        if (holders && account) holders.delete(account);
        break;
      }
      case "LastAdminRenounced": {
        // Admin control is given up: clear the admin role holders. Other roles
        // (mint, burn-blocked, etc.) are intentionally left untouched.
        roleHolders.get("DEFAULT_ADMIN_ROLE")?.clear();
        adminRenounced = true;
        break;
      }
      case "Paused":
        paused = true;
        break;
      case "Unpaused":
        paused = false;
        break;
      case "PolicyUpdated":
        policyUpdates += 1;
        break;
      case "SupplyCapUpdated":
        supplyCapUpdates += 1;
        break;
      case "BurnedBlocked":
        burnedBlocked += 1;
        break;
      default:
        break;
    }
  }

  return {
    roleHolders,
    adminRenounced,
    paused,
    policyUpdates,
    supplyCapUpdates,
    burnedBlocked,
  };
}

function activeRolesFrom(state: DerivedState): RoleState[] {
  return ALL_ROLES.map((role) => {
    const holders = [...(state.roleHolders.get(role) ?? new Set<string>())];
    return { role, active: holders.length > 0, holders };
  });
}

/**
 * Builds a full issuer-control risk report for a token from its event log.
 *
 * @param tokenAddress the token contract address (used only for labeling here)
 * @param events       the token's normalized B20 event log
 */
export function buildRiskReport(
  tokenAddress: string,
  events: B20Event[]
): RiskReport {
  const state = deriveState(events);
  const activeRoles = activeRolesFrom(state);
  const isActive = (role: B20Role) =>
    activeRoles.find((r) => r.role === role)?.active ?? false;

  const flags: RiskFlag[] = [];

  // Admin control — the highest-leverage control. Renouncing it removes this
  // risk but not the other role-based risks below.
  if (isActive("DEFAULT_ADMIN_ROLE")) {
    flags.push({
      id: "active-admin",
      title: "Active admin role",
      description:
        "DEFAULT_ADMIN_ROLE is still held. The issuer can reassign roles and reconfigure the token at will.",
      severity: "high",
      points: 30,
    });
  } else if (state.adminRenounced) {
    flags.push({
      id: "admin-renounced",
      title: "Admin renounced",
      description:
        "The admin role has been renounced, reducing centralized control. Other active roles still carry risk.",
      severity: "info",
      points: 0,
    });
  }

  // Mint / inflation.
  if (isActive("MINT_ROLE")) {
    flags.push({
      id: "active-mint",
      title: "Active mint role",
      description:
        "MINT_ROLE is held, so supply can be inflated. Holders are exposed to dilution risk.",
      severity: "high",
      points: 20,
    });
  }

  // Freeze / seize.
  if (isActive("BURN_BLOCKED_ROLE")) {
    flags.push({
      id: "active-burn-blocked",
      title: "Active burn-blocked role",
      description:
        "BURN_BLOCKED_ROLE is held, enabling freeze/seize of blocked balances. May be intentional for regulated tokens.",
      severity: "high",
      points: 20,
    });
  }

  // Pause — a pause that has not been reversed halts transfers.
  if (state.paused) {
    flags.push({
      id: "currently-paused",
      title: "Token currently paused",
      description:
        "A Paused event has no matching later Unpaused. Transfers may be halted right now.",
      severity: "critical",
      points: 25,
    });
  }

  // Policy restriction.
  if (state.policyUpdates > 0) {
    flags.push({
      id: "policy-updated",
      title: "Transfer policy updated",
      description: `Observed ${state.policyUpdates} PolicyUpdated event(s). Allowlist/blocklist or transfer rules may restrict holders.`,
      severity: "moderate",
      points: 10,
    });
  }

  // Supply control.
  if (state.supplyCapUpdates > 0) {
    flags.push({
      id: "supply-cap-updated",
      title: "Supply cap changed",
      description: `Observed ${state.supplyCapUpdates} SupplyCapUpdated event(s). The issuer can adjust the maximum supply.`,
      severity: "moderate",
      points: 10,
    });
  }

  // Burn-blocked activity actually exercised.
  if (state.burnedBlocked > 0) {
    flags.push({
      id: "burned-blocked-activity",
      title: "Blocked-balance burns observed",
      description: `Observed ${state.burnedBlocked} BurnedBlocked event(s). Blocked balances have been burned/seized in practice.`,
      severity: "high",
      points: 10,
    });
  }

  const rawScore = flags.reduce((sum, flag) => sum + flag.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));
  const level = levelForScore(score);

  const stats: RiskStats = {
    totalEvents: events.length,
    activeRoleCount: activeRoles.filter((r) => r.active).length,
    flagCount: flags.filter((f) => f.points > 0).length,
    paused: state.paused,
    adminRenounced: state.adminRenounced,
  };

  const summary = buildSummary(level, stats, state);

  const timeline = [...events].sort(chronological);

  return {
    tokenAddress,
    score,
    level,
    summary,
    flags,
    activeRoles,
    stats,
    timeline,
    generatedAt: new Date().toISOString(),
  };
}

function buildSummary(
  level: RiskLevel,
  stats: RiskStats,
  state: DerivedState
): string {
  if (stats.flagCount === 0) {
    return "No issuer-control risk flags detected from observed events.";
  }

  const parts: string[] = [];
  if (state.paused) parts.push("the token is currently paused");
  if (stats.activeRoleCount > 0) {
    parts.push(`${stats.activeRoleCount} privileged role(s) remain active`);
  }
  if (state.adminRenounced) parts.push("admin control has been renounced");

  const detail = parts.length > 0 ? ` because ${parts.join(", ")}` : "";
  return `Issuer-control risk is ${level}${detail}.`;
}
