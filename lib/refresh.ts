// Refresh layer: pull fresh B20 data from CDP SQL and populate the Supabase
// cache. This is the ONLY path that writes to the cache; normal page/API reads
// never trigger a refresh (see docs/README). Refresh is invoked explicitly
// through the /api/refresh endpoints or a script.
//
// Server-only: it reaches both the CDP client (bearer token) and the Supabase
// service-role client, so this module must never end up in a client bundle.
import "server-only";

import { normalizeAddress } from "./address";
import {
  upsertEvents,
  upsertRiskReport,
  upsertTokens,
} from "./b20-cache";
import {
  normalizeB20CreatedRow,
  normalizeEventRow,
  runCdpSql,
  type CdpB20CreatedRow,
  type CdpEventRow,
} from "./cdp-sql";
import { B20_FACTORY_ADDRESS, B20_NETWORK } from "./config";
import { buildRiskReport } from "./risk";
import { b20TokenEventsSql, discoverB20TokensSql } from "./sql";
import type { B20Event, B20Network, B20Token } from "./types";

/** Conservative default so a refresh does not fan out to 100+ tokens. */
export const DEFAULT_REFRESH_LIMIT = 20;

const TIMELINE_LIMIT = 5000;

export interface RefreshError {
  stage: "discovery" | "tokens-upsert" | "timeline" | "events-upsert" | "risk-report";
  tokenAddress?: string;
  message: string;
}

/** Counts returned by a refresh run. */
export interface RefreshResult {
  network: B20Network;
  tokens: number;
  events: number;
  reports: number;
  partial: boolean;
  errors: RefreshError[];
  /** Present for a single-token refresh. */
  tokenAddress?: string;
}

function sanitizeRefreshError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 240);
}

/** Fetches recent B20 token snapshots from CDP SQL. */
async function fetchRecentTokensFromCdp(limit: number): Promise<B20Token[]> {
  const sql = discoverB20TokensSql(B20_NETWORK, limit, B20_FACTORY_ADDRESS);
  const rows = await runCdpSql<CdpB20CreatedRow>(sql);
  return rows
    .map(normalizeB20CreatedRow)
    .filter((token) => normalizeAddress(token.address) !== null);
}

/** Fetches a single token's event timeline from CDP SQL. */
async function fetchTokenEventsFromCdp(address: string): Promise<B20Event[]> {
  const sql = b20TokenEventsSql(B20_NETWORK, address, TIMELINE_LIMIT);
  const rows = await runCdpSql<CdpEventRow>(sql);
  return rows
    .map(normalizeEventRow)
    .filter((event): event is B20Event => event !== null);
}

/**
 * Refreshes the recent-token window: discover tokens, cache them, then for each
 * token cache its event timeline and computed risk report.
 *
 * The limit is clamped to a conservative default so a single call cannot fan
 * out to 100+ tokens by accident.
 */
export async function refreshRecentB20Tokens(
  limit: number = DEFAULT_REFRESH_LIMIT
): Promise<RefreshResult> {
  const safeLimit =
    Number.isFinite(limit) && limit > 0
      ? Math.min(Math.floor(limit), 100)
      : DEFAULT_REFRESH_LIMIT;

  let tokens: B20Token[];
  try {
    tokens = await fetchRecentTokensFromCdp(safeLimit);
  } catch (error) {
    return {
      network: B20_NETWORK,
      tokens: 0,
      events: 0,
      reports: 0,
      partial: true,
      errors: [
        {
          stage: "discovery",
          message: sanitizeRefreshError(error),
        },
      ],
    };
  }

  const errors: RefreshError[] = [];

  try {
    await upsertTokens(tokens);
  } catch (error) {
    return {
      network: B20_NETWORK,
      tokens: tokens.length,
      events: 0,
      reports: 0,
      partial: true,
      errors: [
        {
          stage: "tokens-upsert",
          message: sanitizeRefreshError(error),
        },
      ],
    };
  }

  let eventCount = 0;
  let reportCount = 0;

  for (const token of tokens) {
    const address = normalizeAddress(token.address);
    if (!address) continue;

    let events: B20Event[] = [];
    try {
      events = await fetchTokenEventsFromCdp(address);
    } catch (error) {
      errors.push({
        stage: "timeline",
        tokenAddress: address,
        message: sanitizeRefreshError(error),
      });
      continue;
    }

    try {
      await upsertEvents(address, events);
      eventCount += events.length;
    } catch (error) {
      errors.push({
        stage: "events-upsert",
        tokenAddress: address,
        message: sanitizeRefreshError(error),
      });
      continue;
    }

    try {
      const report = buildRiskReport(address, events);
      await upsertRiskReport(report);
      reportCount += 1;
    } catch (error) {
      errors.push({
        stage: "risk-report",
        tokenAddress: address,
        message: sanitizeRefreshError(error),
      });
    }
  }

  return {
    network: B20_NETWORK,
    tokens: tokens.length,
    events: eventCount,
    reports: reportCount,
    partial: errors.length > 0,
    errors,
  };
}

/**
 * Refreshes a single token: cache its event timeline and computed risk report.
 * The token row must already exist in the cache (events reference it), so this
 * upserts a minimal token snapshot first from the address.
 *
 * @throws if the address is not a valid 20-byte hex address.
 */
export async function refreshTokenRisk(address: string): Promise<RefreshResult> {
  const normalized = normalizeAddress(address);
  if (!normalized) {
    throw new Error("Invalid token address.");
  }

  // Ensure a token row exists so the events/report foreign keys resolve. A
  // fuller snapshot is written by refreshRecentB20Tokens during discovery.
  await upsertTokens([
    {
      address: normalized,
      name: "",
      symbol: "",
      decimals: 0,
      variant: "",
      createdAt: new Date(0).toISOString(),
      events: [],
    },
  ]);

  const events = await fetchTokenEventsFromCdp(normalized);
  await upsertEvents(normalized, events);

  const report = buildRiskReport(normalized, events);
  await upsertRiskReport(report);

  return {
    network: B20_NETWORK,
    tokens: 1,
    events: events.length,
    reports: 1,
    partial: false,
    errors: [],
    tokenAddress: normalized,
  };
}
