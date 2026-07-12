import type { B20Role, KnownB20Role } from "./types";

export const B20_ROLE_NAMES: readonly KnownB20Role[] = [
  "DEFAULT_ADMIN_ROLE",
  "MINT_ROLE",
  "BURN_ROLE",
  "BURN_BLOCKED_ROLE",
  "PAUSE_ROLE",
  "UNPAUSE_ROLE",
  "METADATA_ROLE",
  "OPERATOR_ROLE",
];

export const DEFAULT_ADMIN_ROLE_HASH = `0x${"0".repeat(64)}`;

/**
 * Known B20 AccessControl role hashes.
 *
 * These are keccak256(roleName) values, except DEFAULT_ADMIN_ROLE which is the
 * OpenZeppelin zero-hash admin role.
 */
export const B20_ROLE_HASHES: Record<KnownB20Role, string> = {
  DEFAULT_ADMIN_ROLE: DEFAULT_ADMIN_ROLE_HASH,
  MINT_ROLE:
    "0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686",
  BURN_ROLE:
    "0xe97b137254058bd94f28d2f3eb79e2d34074ffb488d042e3bc958e0a57d2fa22",
  BURN_BLOCKED_ROLE:
    "0x7408fdc0d31c7bcb349eab611f5d1168acd4303574993f8cdc98b1cd18c41cae",
  PAUSE_ROLE:
    "0x139c2898040ef16910dc9f44dc697df79363da767d8bc92f2e310312b816e46d",
  UNPAUSE_ROLE:
    "0x265b220c5a8891efdd9e1b1b7fa72f257bd5169f8d87e319cf3dad6ff52b94ae",
  METADATA_ROLE:
    "0x6bd6b5318a46e5fff572d5e4258a20774aab40cc35ac7680654b9081fcc82f80",
  OPERATOR_ROLE:
    "0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929",
};

const ROLE_NAMES = new Set<string>(B20_ROLE_NAMES);

const ROLE_BY_HASH = new Map<string, KnownB20Role>(
  Object.entries(B20_ROLE_HASHES).map(([role, hash]) => [
    hash.toLowerCase(),
    role as KnownB20Role,
  ])
);

function cleanRoleValue(raw: unknown): string {
  return raw == null ? "" : String(raw).trim();
}

export function isKnownB20Role(role: unknown): role is KnownB20Role {
  return ROLE_NAMES.has(cleanRoleValue(role));
}

/**
 * Resolves a raw role value to a known B20 role name when possible.
 *
 * Handles:
 * - already-decoded role names, e.g. MINT_ROLE;
 * - DEFAULT_ADMIN_ROLE zero hash;
 * - keccak256 hashes of known B20 role names;
 * - unknown hashes or unreadable values, preserved verbatim.
 */
export function resolveRole(raw: unknown): B20Role {
  const value = cleanRoleValue(raw);
  if (!value) return value as B20Role;

  if (isKnownB20Role(value)) return value;

  const resolved = ROLE_BY_HASH.get(value.toLowerCase());
  return (resolved ?? value) as B20Role;
}

export function roleDisplayName(raw: unknown): string {
  return String(resolveRole(raw));
}
