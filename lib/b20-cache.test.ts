import { describe, expect, it } from "vitest";

import {
  EVENT_UPSERT_CONFLICT_TARGET,
  RISK_REPORT_UPSERT_CONFLICT_TARGET,
  rowToEvent,
  rowToRefreshRun,
  rowToRiskReport,
  rowToToken,
  sanitizeJsonbValue,
  TOKEN_UPSERT_CONFLICT_TARGET,
} from "./b20-cache";

const ADDR = "0xb200000000000000000000000000000000000001";
const HOLDER = "0xa11ce00000000000000000000000000000000abc";

describe("Supabase cache conflict targets", () => {
  it("upserts tokens by network + address", () => {
    expect(TOKEN_UPSERT_CONFLICT_TARGET).toBe("network,address");
  });

  it("upserts events by network + transaction_hash + log_index", () => {
    expect(EVENT_UPSERT_CONFLICT_TARGET).toBe(
      "network,transaction_hash,log_index"
    );
  });

  it("upserts risk reports by network + token_address", () => {
    expect(RISK_REPORT_UPSERT_CONFLICT_TARGET).toBe(
      "network,token_address"
    );
  });
});

describe("sanitizeJsonbValue", () => {
  it("removes zero bytes from strings before JSONB upsert", () => {
    expect(sanitizeJsonbValue("hello\u0000world")).toBe("helloworld");
  });

  it("sanitizes nested arrays and objects", () => {
    const value = {
      title: "A\u0000B",
      nested: [{ key: "C\u0000D" }, 1, true, null],
    };

    expect(sanitizeJsonbValue(value)).toEqual({
      title: "AB",
      nested: [{ key: "CD" }, 1, true, null],
    });
  });
});

describe("rowToToken", () => {
  it("maps a full DB token row to a B20Token", () => {
    const token = rowToToken({
      address: ADDR,
      network: "base",
      name: "Acme Regulated USD",
      symbol: "aRUSD",
      decimals: 6,
      variant: "regulated",
      created_at: "2026-07-08T18:10:00.000Z",
      created_tx_hash: "0xabc",
      created_block_number: 18_000_100,
      created_log_index: 0,
      last_seen_at: "2026-07-09T00:00:00.000Z",
      updated_at: "2026-07-09T00:00:00.000Z",
    });

    expect(token).toEqual({
      address: ADDR,
      name: "Acme Regulated USD",
      symbol: "aRUSD",
      decimals: 6,
      variant: "regulated",
      createdAt: "2026-07-08T18:10:00.000Z",
      events: [],
    });
  });

  it("supplies safe defaults for null columns", () => {
    const token = rowToToken({
      address: ADDR,
      network: "base",
      name: null,
      symbol: null,
      decimals: null,
      variant: null,
      created_at: null,
      created_tx_hash: null,
      created_block_number: null,
      created_log_index: null,
    });

    expect(token.name).toBe("");
    expect(token.symbol).toBe("");
    expect(token.decimals).toBe(0);
    expect(token.variant).toBe("");
    expect(token.createdAt).toBe(new Date(0).toISOString());
    expect(token.events).toEqual([]);
  });
});

describe("rowToEvent", () => {
  it("maps a DB event row to a B20Event", () => {
    const event = rowToEvent({
      id: "base:0xabc:2",
      network: "base",
      token_address: ADDR,
      event_name: "RoleGranted",
      event_signature: "RoleGranted(bytes32,address,address)",
      block_timestamp: "2026-07-08T18:10:00.000Z",
      transaction_hash: "0xabc",
      block_number: 18_000_100,
      log_index: 2,
      args: { role: "DEFAULT_ADMIN_ROLE", account: HOLDER },
    });

    expect(event).toEqual({
      name: "RoleGranted",
      blockNumber: 18_000_100,
      logIndex: 2,
      timestamp: "2026-07-08T18:10:00.000Z",
      transactionHash: "0xabc",
      args: { role: "DEFAULT_ADMIN_ROLE", account: HOLDER },
    });
  });
});

describe("rowToRiskReport", () => {
  it("maps a DB risk row to a RiskReport", () => {
    const report = rowToRiskReport({
      token_address: ADDR,
      network: "base",
      score: 30,
      level: "moderate",
      summary: "Issuer-control risk is moderate.",
      flags: [
        {
          id: "active-admin",
          title: "Active admin role",
          description: "…",
          severity: "high",
          points: 30,
        },
      ],
      active_roles: [
        { role: "DEFAULT_ADMIN_ROLE", active: true, holders: [HOLDER] },
      ],
      stats: {
        totalEvents: 1,
        activeRoleCount: 1,
        flagCount: 1,
        paused: false,
        adminRenounced: false,
      },
      timeline: [
        {
          name: "RoleGranted",
          blockNumber: 1,
          logIndex: 0,
          timestamp: "2026-07-08T18:10:00.000Z",
          transactionHash: "0xabc",
          args: { role: "DEFAULT_ADMIN_ROLE", account: HOLDER },
        },
      ],
      generated_at: "2026-07-09T00:00:00.000Z",
      updated_at: "2026-07-09T00:00:00.000Z",
    });

    expect(report.tokenAddress).toBe(ADDR);
    expect(report.score).toBe(30);
    expect(report.level).toBe("moderate");
    expect(report.summary).toBe("Issuer-control risk is moderate.");
    expect(report.flags).toHaveLength(1);
    expect(report.flags[0].id).toBe("active-admin");
    expect(report.activeRoles[0].role).toBe("DEFAULT_ADMIN_ROLE");
    expect(report.stats.totalEvents).toBe(1);
    expect(report.timeline).toHaveLength(1);
    expect(report.generatedAt).toBe("2026-07-09T00:00:00.000Z");
  });

  it("defaults array fields when they are missing", () => {
    const report = rowToRiskReport({
      token_address: ADDR,
      network: "base",
      score: 0,
      level: "low",
      summary: "No issuer-control risk flags detected from observed events.",
      // @ts-expect-error simulating a partial/legacy row
      flags: null,
      // @ts-expect-error simulating a partial/legacy row
      active_roles: null,
      stats: {
        totalEvents: 0,
        activeRoleCount: 0,
        flagCount: 0,
        paused: false,
        adminRenounced: false,
      },
      // @ts-expect-error simulating a partial/legacy row
      timeline: null,
      generated_at: "2026-07-09T00:00:00.000Z",
    });

    expect(report.flags).toEqual([]);
    expect(report.activeRoles).toEqual([]);
    expect(report.timeline).toEqual([]);
  });
});

describe("rowToRefreshRun", () => {
  it("maps a refresh run row to dashboard metadata", () => {
    const run = rowToRefreshRun({
      id: 7,
      network: "base_sepolia",
      status: "success",
      tokens: 5,
      events: 15,
      reports: 5,
      partial: false,
      errors: [],
      event_diff: {
        tokensChecked: 5,
        tokensWithNewEvents: 1,
        newEvents: 2,
        byToken: [],
      },
      completed_at: "2026-07-14T00:00:00.000Z",
    });

    expect(run).toEqual({
      id: 7,
      network: "base_sepolia",
      status: "success",
      tokens: 5,
      events: 15,
      reports: 5,
      partial: false,
      errors: [],
      eventDiff: {
        tokensChecked: 5,
        tokensWithNewEvents: 1,
        newEvents: 2,
        byToken: [],
      },
      completedAt: "2026-07-14T00:00:00.000Z",
    });
  });

  it("defaults missing refresh event diff fields", () => {
    const run = rowToRefreshRun({
      id: 8,
      network: "base",
      status: "unknown-status",
      tokens: 0,
      events: 0,
      reports: 0,
      partial: false,
      errors: null,
      event_diff: null,
      completed_at: "2026-07-14T00:00:00.000Z",
    });

    expect(run.status).toBe("success");
    expect(run.errors).toEqual([]);
    expect(run.eventDiff).toEqual({
      tokensChecked: 0,
      tokensWithNewEvents: 0,
      newEvents: 0,
      byToken: [],
    });
  });
});
