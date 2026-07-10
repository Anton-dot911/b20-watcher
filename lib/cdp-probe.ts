import "server-only";

import { B20_FACTORY_ADDRESS, B20_NETWORK } from "./config";
import { runCdpSql } from "./cdp-sql";
import {
  B20_CREATED_SIGNATURE,
  NETWORK_TABLES,
  clampLimit,
} from "./sql";

interface CountRow {
  count?: number | string | null;
}

interface EventSampleRow {
  block_timestamp?: string | number | null;
  transaction_hash?: string | null;
  address?: string | null;
  event_name?: string | null;
  event_signature?: string | null;
  action?: string | null;
  parameters?: unknown;
  block_number?: string | number | null;
  log_index?: string | number | null;
}

export interface CdpProbeCheck {
  ok: boolean;
  sql: string;
  count?: number | null;
  rows?: EventSampleRow[];
  error?: string;
}

export interface CdpProbeResult {
  ok: boolean;
  network: typeof B20_NETWORK;
  table: string;
  factoryAddress: string;
  factoryAddressLowercase: string;
  eventSignature: string;
  limit: number;
  checks: {
    factoryExactAddressCount: CdpProbeCheck;
    factoryLowercaseAddressCount: CdpProbeCheck;
    factoryLatestEvents: CdpProbeCheck;
    b20CreatedBySignatureCount: CdpProbeCheck;
    b20CreatedByEventNameCount: CdpProbeCheck;
    b20CreatedSignatureAnywhere: CdpProbeCheck;
    b20CreatedEventNameAnywhere: CdpProbeCheck;
  };
}

export function sanitizeProbeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 240);
}

export function clampProbeLimit(limit: unknown): number {
  return clampLimit(typeof limit === "number" ? limit : Number(limit), 1, 20);
}

function countFromRows(rows: CountRow[]): number {
  const raw = rows[0]?.count ?? 0;
  const count = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(count) ? count : 0;
}

async function runCountProbe(sql: string): Promise<CdpProbeCheck> {
  try {
    const rows = await runCdpSql<CountRow>(sql);
    return {
      ok: true,
      sql,
      count: countFromRows(rows),
    };
  } catch (error) {
    return {
      ok: false,
      sql,
      count: null,
      error: sanitizeProbeError(error),
    };
  }
}

async function runSampleProbe(sql: string): Promise<CdpProbeCheck> {
  try {
    const rows = await runCdpSql<EventSampleRow>(sql);
    return {
      ok: true,
      sql,
      rows,
    };
  } catch (error) {
    return {
      ok: false,
      sql,
      rows: [],
      error: sanitizeProbeError(error),
    };
  }
}

function eventSampleSelect(table: string): string {
  return `SELECT
  block_timestamp,
  transaction_hash,
  address,
  event_name,
  event_signature,
  action,
  parameters,
  block_number,
  log_index
FROM ${table}`;
}

export function buildCdpProbeSql(limit: number = 5) {
  const safeLimit = clampProbeLimit(limit);
  const table = NETWORK_TABLES[B20_NETWORK];
  const factory = B20_FACTORY_ADDRESS;
  const factoryLower = B20_FACTORY_ADDRESS.toLowerCase();

  return {
    table,
    safeLimit,
    factory,
    factoryLower,
    factoryExactAddressCount: `SELECT count(*) AS count
FROM ${table}
WHERE address = '${factory}'
  AND action = 'added'`,
    factoryLowercaseAddressCount: `SELECT count(*) AS count
FROM ${table}
WHERE address = '${factoryLower}'
  AND action = 'added'`,
    factoryLatestEvents: `${eventSampleSelect(table)}
WHERE address IN ('${factory}', '${factoryLower}')
  AND action = 'added'
ORDER BY block_timestamp DESC
LIMIT ${safeLimit}`,
    b20CreatedBySignatureCount: `SELECT count(*) AS count
FROM ${table}
WHERE event_signature = '${B20_CREATED_SIGNATURE}'
  AND address IN ('${factory}', '${factoryLower}')
  AND action = 'added'`,
    b20CreatedByEventNameCount: `SELECT count(*) AS count
FROM ${table}
WHERE event_name = 'B20Created'
  AND address IN ('${factory}', '${factoryLower}')
  AND action = 'added'`,
    b20CreatedSignatureAnywhere: `${eventSampleSelect(table)}
WHERE event_signature = '${B20_CREATED_SIGNATURE}'
  AND action = 'added'
ORDER BY block_timestamp DESC
LIMIT ${safeLimit}`,
    b20CreatedEventNameAnywhere: `${eventSampleSelect(table)}
WHERE event_name = 'B20Created'
  AND action = 'added'
ORDER BY block_timestamp DESC
LIMIT ${safeLimit}`,
  };
}

export async function runCdpDiscoveryProbe(
  rawLimit: unknown = 5
): Promise<CdpProbeResult> {
  const sql = buildCdpProbeSql(clampProbeLimit(rawLimit));

  const [
    factoryExactAddressCount,
    factoryLowercaseAddressCount,
    factoryLatestEvents,
    b20CreatedBySignatureCount,
    b20CreatedByEventNameCount,
    b20CreatedSignatureAnywhere,
    b20CreatedEventNameAnywhere,
  ] = await Promise.all([
    runCountProbe(sql.factoryExactAddressCount),
    runCountProbe(sql.factoryLowercaseAddressCount),
    runSampleProbe(sql.factoryLatestEvents),
    runCountProbe(sql.b20CreatedBySignatureCount),
    runCountProbe(sql.b20CreatedByEventNameCount),
    runSampleProbe(sql.b20CreatedSignatureAnywhere),
    runSampleProbe(sql.b20CreatedEventNameAnywhere),
  ]);

  const checks = {
    factoryExactAddressCount,
    factoryLowercaseAddressCount,
    factoryLatestEvents,
    b20CreatedBySignatureCount,
    b20CreatedByEventNameCount,
    b20CreatedSignatureAnywhere,
    b20CreatedEventNameAnywhere,
  };

  return {
    ok: Object.values(checks).every((check) => check.ok),
    network: B20_NETWORK,
    table: sql.table,
    factoryAddress: sql.factory,
    factoryAddressLowercase: sql.factoryLower,
    eventSignature: B20_CREATED_SIGNATURE,
    limit: sql.safeLimit,
    checks,
  };
}
