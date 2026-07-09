// Mock B20 token data used when MOCK_MODE is enabled (the default).
//
// This lets the dashboard, token report, and JSON API be reviewed immediately
// without any external data source or CDP integration.

import type { B20Token } from "./types";

const TOKEN_A_ADDRESS = "0xb200000000000000000000000000000000000001";
const TOKEN_B_ADDRESS = "0xb200000000000000000000000000000000000002";

const ISSUER = "0xa11ce00000000000000000000000000000000abc";
const MINTER = "0xb0b0000000000000000000000000000000000def";

// Token A: a high-control token that exercises every risk path. It grants
// admin, mint, and burn-blocked roles, updates policy and supply cap, and is
// paused without a later unpause.
const tokenA: B20Token = {
  address: TOKEN_A_ADDRESS,
  name: "Acme Regulated USD",
  symbol: "aRUSD",
  decimals: 6,
  variant: "regulated",
  createdAt: "2026-07-08T18:10:00.000Z",
  events: [
    {
      name: "RoleGranted",
      blockNumber: 18_000_100,
      logIndex: 0,
      timestamp: "2026-07-08T18:10:00.000Z",
      transactionHash: "0xa1000000000000000000000000000000000000000000000000000000000001",
      args: { role: "DEFAULT_ADMIN_ROLE", account: ISSUER, sender: ISSUER },
    },
    {
      name: "RoleGranted",
      blockNumber: 18_000_101,
      logIndex: 0,
      timestamp: "2026-07-08T18:20:00.000Z",
      transactionHash: "0xa1000000000000000000000000000000000000000000000000000000000002",
      args: { role: "MINT_ROLE", account: MINTER, sender: ISSUER },
    },
    {
      name: "RoleGranted",
      blockNumber: 18_000_102,
      logIndex: 0,
      timestamp: "2026-07-08T18:30:00.000Z",
      transactionHash: "0xa1000000000000000000000000000000000000000000000000000000000003",
      args: { role: "BURN_BLOCKED_ROLE", account: ISSUER, sender: ISSUER },
    },
    {
      name: "PolicyUpdated",
      blockNumber: 18_010_000,
      logIndex: 2,
      timestamp: "2026-07-08T19:00:00.000Z",
      transactionHash: "0xa1000000000000000000000000000000000000000000000000000000000004",
      args: { policyId: "0x01", oldValue: "0", newValue: "1" },
    },
    {
      name: "SupplyCapUpdated",
      blockNumber: 18_020_000,
      logIndex: 1,
      timestamp: "2026-07-08T20:00:00.000Z",
      transactionHash: "0xa1000000000000000000000000000000000000000000000000000000000005",
      args: { oldCap: "1000000000000", newCap: "5000000000000", sender: ISSUER },
    },
    {
      name: "Paused",
      blockNumber: 18_030_000,
      logIndex: 0,
      timestamp: "2026-07-09T08:00:00.000Z",
      transactionHash: "0xa1000000000000000000000000000000000000000000000000000000000006",
      args: { account: ISSUER },
    },
  ],
};

// Token B: a lower-control token. Admin was granted then renounced, and no
// mint/burn/pause controls remain active. Demonstrates the admin-renounced path.
const tokenB: B20Token = {
  address: TOKEN_B_ADDRESS,
  name: "OpenGrid Token",
  symbol: "OGT",
  decimals: 18,
  variant: "standard",
  createdAt: "2026-07-08T18:05:00.000Z",
  events: [
    {
      name: "RoleGranted",
      blockNumber: 17_500_000,
      logIndex: 0,
      timestamp: "2026-07-08T18:05:00.000Z",
      transactionHash: "0xb2000000000000000000000000000000000000000000000000000000000001",
      args: { role: "DEFAULT_ADMIN_ROLE", account: ISSUER, sender: ISSUER },
    },
    {
      name: "NameUpdated",
      blockNumber: 17_500_050,
      logIndex: 0,
      timestamp: "2026-07-08T18:15:00.000Z",
      transactionHash: "0xb2000000000000000000000000000000000000000000000000000000000002",
      args: { name: "OpenGrid Token" },
    },
    {
      name: "LastAdminRenounced",
      blockNumber: 17_600_000,
      logIndex: 0,
      timestamp: "2026-07-08T18:45:00.000Z",
      transactionHash: "0xb2000000000000000000000000000000000000000000000000000000000003",
      args: { account: ISSUER },
    },
  ],
};

const TOKENS: B20Token[] = [tokenA, tokenB];

/** Returns all mock tokens, newest first. */
export function getMockTokens(): B20Token[] {
  return [...TOKENS].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
}

/** Looks up a mock token by (already-normalized, lowercase) address. */
export function getMockToken(address: string): B20Token | undefined {
  return TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase());
}

export const MOCK_TOKEN_ADDRESSES = {
  highControl: TOKEN_A_ADDRESS,
  renounced: TOKEN_B_ADDRESS,
};
