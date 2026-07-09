// Data-source abstraction.
//
// This is the single seam between the UI/API layer and where B20 data comes
// from. In mock mode it serves the bundled mock data; in live mode it queries
// the CDP SQL API. Callers (pages, API routes) never branch on the mode
// themselves — they just call these three functions.
//
// Server-only: the live path reaches the CDP client, which holds the bearer
// token, so this module must never end up in a client bundle.
import "server-only";

import { normalizeAddress } from "./address";
import {
  normalizeB20CreatedRow,
  normalizeEventRow,
  runCdpSql,
  type CdpB20CreatedRow,
  type CdpEventRow,
} from "./cdp-sql";
import { B20_FACTORY_ADDRESS, B20_NETWORK, MOCK_MODE } from "./config";
import { getMockToken, getMockTokens } from "./mock-data";
import { buildRiskReport } from "./risk";
import { b20TokenEventsSql, discoverB20TokensSql } from "./sql";
import type { B20Event, B20Token, RiskReport } from "./types";

const DEFAULT_DISCOVERY_LIMIT = 50;
const TIMELINE_LIMIT = 5000;

/** Lists recent B20 tokens, newest first. */
export async function listB20Tokens(
  limit: number = DEFAULT_DISCOVERY_LIMIT
): Promise<B20Token[]> {
  if (MOCK_MODE) {
    return getMockTokens().slice(0, limit);
  }

  const sql = discoverB20TokensSql(B20_NETWORK, limit, B20_FACTORY_ADDRESS);
  const rows = await runCdpSql<CdpB20CreatedRow>(sql);
  return rows
    .map(normalizeB20CreatedRow)
    .filter((token) => normalizeAddress(token.address) !== null);
}

/**
 * Looks up a single token's metadata by address.
 *
 * Mock mode returns null for an unknown address. Live mode returns discovered
 * metadata when the token is in the recent list, otherwise a partial record so
 * a report can still be generated from its on-chain timeline.
 */
export async function getB20Token(address: string): Promise<B20Token | null> {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;

  if (MOCK_MODE) {
    return getMockToken(normalized) ?? null;
  }

  const tokens = await listB20Tokens();
  const found = tokens.find((t) => t.address.toLowerCase() === normalized);
  if (found) return found;

  // Not in the recent discovery window — return partial metadata so the report
  // page can still render from the event timeline.
  return {
    address: normalized,
    name: "Unknown B20 token",
    symbol: "—",
    decimals: 0,
    variant: "unknown",
    createdAt: new Date(0).toISOString(),
    events: [],
  };
}

/**
 * Builds an issuer-control risk report for a token.
 *
 * For a valid address with no events (unknown token, or a token with no
 * matched events) this returns a valid empty report (score 0), NOT an error.
 * Throws only on an invalid address or an upstream CDP failure.
 */
export async function getB20RiskReport(address: string): Promise<RiskReport> {
  const normalized = normalizeAddress(address);
  if (!normalized) {
    throw new Error("Invalid token address.");
  }

  if (MOCK_MODE) {
    const token = getMockToken(normalized);
    return buildRiskReport(normalized, token?.events ?? []);
  }

  const sql = b20TokenEventsSql(B20_NETWORK, normalized, TIMELINE_LIMIT);
  const rows = await runCdpSql<CdpEventRow>(sql);
  const events = rows
    .map(normalizeEventRow)
    .filter((event): event is B20Event => event !== null);
  return buildRiskReport(normalized, events);
}
