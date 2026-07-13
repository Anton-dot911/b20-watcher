import "server-only";

import { isValidAddress } from "./address";
import { B20_FACTORY_ADDRESS, B20_NETWORK } from "./config";
import { runCdpSql } from "./cdp-sql";
import {
  B20_CREATED_SIGNATURE,
  NETWORK_TABLES,
  clampLimit,
} from "./sql";

const ROLE_GRANTED_SIGNATURE = "RoleGranted(bytes32,address,address)";

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

interface RoleFieldRow {
  value?: unknown;
}

export interface CdpProbeCheck {
  ok: boolean;
  sql: string;
  count?: number | null;
  rows?: EventSampleRow[];
  error?: string;
}

export interface CdpRoleFieldProbeCheck {
  expression: string;
  ok: boolean;
  sql: string;
  rows: RoleFieldRow[];
  error?: string;
}

export interface CdpRoleFieldProbeResult {
  requested: boolean;
  eventSignature: typeof ROLE_GRANTED_SIGNATURE;
  tokenAddress?: string | null;
  checks: CdpRoleFieldProbeCheck[];
  supportedExpressions: string[];
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
  roleFieldProbe?: CdpRoleFieldProbeResult;
}

export interface CdpProbeOptions {
  includeRoleFieldProbe?: boolean;
  tokenAddress?: unknown;
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

async function runRoleFieldCheck(
  table: string,
  expression: string,
  tokenAddress: string | null
): Promise<CdpRoleFieldProbeCheck> {
  const tokenFilter = tokenAddress ? `\n  AND address = '${tokenAddress}'` : "";
  const sql = `SELECT ${expression} AS value
FROM ${table}
WHERE event_signature = '${ROLE_GRANTED_SIGNATURE}'
  AND action = 'added'${tokenFilter}
ORDER BY block_timestamp DESC
LIMIT 1`;

  try {
    const rows = await runCdpSql<RoleFieldRow>(sql);
    return {
      expression,
      ok: true,
      sql,
      rows,
    };
  } catch (error) {
    return {
      expression,
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

const ROLE_FIELD_CANDIDATE_EXPRESSIONS = [
  "parameters['role']",
  "parameters.role",
  "topics",
  "topics[0]",
  "topics[1]",
  "topic0",
  "topic_0",
  "topic_1",
  "event_topics",
  "indexed_parameters",
  "raw_log",
  "data",
] as const;

function normalizeTokenAddress(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return isValidAddress(value) ? value.toLowerCase() : null;
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

async function runRoleFieldProbe(
  table: string,
  rawTokenAddress: unknown
): Promise<CdpRoleFieldProbeResult> {
  const tokenAddress = normalizeTokenAddress(rawTokenAddress);
  const checks: CdpRoleFieldProbeCheck[] = [];

  // Run sequentially to reduce CDP rate-limit pressure. This endpoint is
  // diagnostics-only and protected by x-refresh-secret, so latency is preferred
  // over accidentally hammering CDP with many invalid candidate expressions.
  for (const expression of ROLE_FIELD_CANDIDATE_EXPRESSIONS) {
    checks.push(await runRoleFieldCheck(table, expression, tokenAddress));
  }

  return {
    requested: true,
    eventSignature: ROLE_GRANTED_SIGNATURE,
    tokenAddress,
    checks,
    supportedExpressions: checks
      .filter((check) => check.ok)
      .map((check) => check.expression),
  };
}

export async function runCdpDiscoveryProbe(
  rawLimit: unknown = 5,
  options: CdpProbeOptions = {}
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

  const roleFieldProbe = options.includeRoleFieldProbe
    ? await runRoleFieldProbe(sql.table, options.tokenAddress)
    : undefined;

  return {
    ok:
      Object.values(checks).every((check) => check.ok) &&
      (!roleFieldProbe || roleFieldProbe.checks.some((check) => check.ok)),
    network: B20_NETWORK,
    table: sql.table,
    factoryAddress: sql.factory,
    factoryAddressLowercase: sql.factoryLower,
    eventSignature: B20_CREATED_SIGNATURE,
    limit: sql.safeLimit,
    checks,
    roleFieldProbe,
  };
}
