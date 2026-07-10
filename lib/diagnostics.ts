import "server-only";

import { B20_FACTORY_ADDRESS, B20_NETWORK, DATA_SOURCE, MOCK_MODE } from "./config";
import type { CdpB20CreatedRow } from "./cdp-sql";
import { runCdpSql } from "./cdp-sql";
import { getSupabaseServerClient } from "./supabase-server";
import { clampLimit, discoverB20TokensSql } from "./sql";

export interface DiagnosticsCheck {
  ok: boolean;
  error?: string;
}

export interface CdpDiagnostics extends DiagnosticsCheck {
  rows: number;
  sampleRows: Array<{
    tokenAddress: string | null;
    name: string | null;
    symbol: string | null;
    blockTimestamp: string | number | null;
    transactionHash: string | null;
  }>;
}

export interface SupabaseTableDiagnostics extends DiagnosticsCheck {
  count: number | null;
}

export interface RefreshDiagnostics {
  ok: boolean;
  service: "b20-watcher";
  generatedAt: string;
  mockMode: boolean;
  dataSource: typeof DATA_SOURCE;
  network: typeof B20_NETWORK;
  factoryAddress: string;
  discoveryLimit: number;
  cdp: CdpDiagnostics;
  supabase: {
    ok: boolean;
    tables: {
      b20_tokens: SupabaseTableDiagnostics;
      b20_events: SupabaseTableDiagnostics;
      b20_risk_reports: SupabaseTableDiagnostics;
    };
  };
}

export function sanitizeDiagnosticError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  // Keep diagnostics useful but avoid returning very long upstream payloads.
  return message.replace(/\s+/g, " ").slice(0, 240);
}

export function clampDiagnosticLimit(limit: unknown): number {
  return clampLimit(typeof limit === "number" ? limit : Number(limit), 1, 20);
}

function mapCdpSampleRows(rows: CdpB20CreatedRow[]): CdpDiagnostics["sampleRows"] {
  return rows.slice(0, 3).map((row) => ({
    tokenAddress: row.token_address ?? null,
    name: row.name ?? null,
    symbol: row.symbol ?? null,
    blockTimestamp: row.block_timestamp ?? null,
    transactionHash: row.transaction_hash ?? null,
  }));
}

async function runCdpDiagnostics(limit: number): Promise<CdpDiagnostics> {
  try {
    const sql = discoverB20TokensSql(B20_NETWORK, limit, B20_FACTORY_ADDRESS);
    const rows = await runCdpSql<CdpB20CreatedRow>(sql);

    return {
      ok: true,
      rows: rows.length,
      sampleRows: mapCdpSampleRows(rows),
    };
  } catch (error) {
    return {
      ok: false,
      rows: 0,
      sampleRows: [],
      error: sanitizeDiagnosticError(error),
    };
  }
}

async function checkSupabaseTable(
  table: "b20_tokens" | "b20_events" | "b20_risk_reports"
): Promise<SupabaseTableDiagnostics> {
  try {
    const client = getSupabaseServerClient();
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("network", B20_NETWORK);

    if (error) {
      return {
        ok: false,
        count: null,
        error: sanitizeDiagnosticError(error),
      };
    }

    return {
      ok: true,
      count: count ?? 0,
    };
  } catch (error) {
    return {
      ok: false,
      count: null,
      error: sanitizeDiagnosticError(error),
    };
  }
}

async function runSupabaseDiagnostics(): Promise<RefreshDiagnostics["supabase"]> {
  const [tokens, events, reports] = await Promise.all([
    checkSupabaseTable("b20_tokens"),
    checkSupabaseTable("b20_events"),
    checkSupabaseTable("b20_risk_reports"),
  ]);

  return {
    ok: tokens.ok && events.ok && reports.ok,
    tables: {
      b20_tokens: tokens,
      b20_events: events,
      b20_risk_reports: reports,
    },
  };
}

export async function runRefreshDiagnostics(
  rawLimit: unknown = 5,
  now: Date = new Date()
): Promise<RefreshDiagnostics> {
  const discoveryLimit = clampDiagnosticLimit(rawLimit);
  const [cdp, supabase] = await Promise.all([
    runCdpDiagnostics(discoveryLimit),
    runSupabaseDiagnostics(),
  ]);

  return {
    ok: cdp.ok && supabase.ok,
    service: "b20-watcher",
    generatedAt: now.toISOString(),
    mockMode: MOCK_MODE,
    dataSource: DATA_SOURCE,
    network: B20_NETWORK,
    factoryAddress: B20_FACTORY_ADDRESS,
    discoveryLimit,
    cdp,
    supabase,
  };
}
