import { describe, expect, it } from "vitest";

import { buildRiskReport } from "./risk";
import type { B20Event, B20EventName } from "./types";

let seq = 0;

/** Builds a B20Event with sensible defaults; override any field per test. */
function makeEvent(
  name: B20EventName,
  args: Record<string, string | number> = {},
  overrides: Partial<B20Event> = {}
): B20Event {
  seq += 1;
  return {
    name,
    blockNumber: overrides.blockNumber ?? seq,
    logIndex: overrides.logIndex ?? 0,
    timestamp: overrides.timestamp ?? new Date(seq * 1000).toISOString(),
    transactionHash: overrides.transactionHash ?? `0x${seq.toString(16)}`,
    args,
  };
}

const ADDR = "0xb200000000000000000000000000000000000001";
const HOLDER = "0xa11ce00000000000000000000000000000000abc";

function grant(role: string, block: number, logIndex = 0): B20Event {
  return makeEvent(
    "RoleGranted",
    { role, account: HOLDER, sender: HOLDER },
    { blockNumber: block, logIndex }
  );
}

describe("buildRiskReport", () => {
  it("adds high issuer-control risk for an active DEFAULT_ADMIN_ROLE", () => {
    const report = buildRiskReport(ADDR, [grant("DEFAULT_ADMIN_ROLE", 1)]);

    expect(report.score).toBeGreaterThan(0);
    expect(report.flags.map((f) => f.id)).toContain("active-admin");
    const adminRole = report.activeRoles.find(
      (r) => r.role === "DEFAULT_ADMIN_ROLE"
    );
    expect(adminRole?.active).toBe(true);
  });

  it("adds mint/inflation risk for an active MINT_ROLE", () => {
    const base = buildRiskReport(ADDR, []).score;
    const report = buildRiskReport(ADDR, [grant("MINT_ROLE", 1)]);

    expect(report.score).toBeGreaterThan(base);
    expect(report.flags.map((f) => f.id)).toContain("active-mint");
  });

  it("adds freeze/seize risk for an active BURN_BLOCKED_ROLE", () => {
    const report = buildRiskReport(ADDR, [grant("BURN_BLOCKED_ROLE", 1)]);

    const flag = report.flags.find((f) => f.id === "active-burn-blocked");
    expect(flag).toBeDefined();
    expect(flag?.points).toBeGreaterThan(0);
    expect(report.score).toBeGreaterThan(0);
  });

  it("flags high/critical pause risk when Paused has no later Unpaused", () => {
    const report = buildRiskReport(ADDR, [
      makeEvent("Paused", { account: HOLDER }, { blockNumber: 5 }),
    ]);

    expect(report.stats.paused).toBe(true);
    const flag = report.flags.find((f) => f.id === "currently-paused");
    expect(flag).toBeDefined();
    expect(["high", "critical"]).toContain(flag?.severity);
  });

  it("does not mark the token paused when Unpaused follows Paused", () => {
    const report = buildRiskReport(ADDR, [
      makeEvent("Paused", { account: HOLDER }, { blockNumber: 5 }),
      makeEvent("Unpaused", { account: HOLDER }, { blockNumber: 6 }),
    ]);

    expect(report.stats.paused).toBe(false);
    expect(report.flags.map((f) => f.id)).not.toContain("currently-paused");
  });

  it("clears admin risk on LastAdminRenounced but keeps other active-role risks", () => {
    const events: B20Event[] = [
      grant("DEFAULT_ADMIN_ROLE", 1),
      grant("MINT_ROLE", 2),
      makeEvent("LastAdminRenounced", { account: HOLDER }, { blockNumber: 3 }),
    ];
    const report = buildRiskReport(ADDR, events);

    // Admin risk removed.
    expect(report.flags.map((f) => f.id)).not.toContain("active-admin");
    expect(report.stats.adminRenounced).toBe(true);
    const adminRole = report.activeRoles.find(
      (r) => r.role === "DEFAULT_ADMIN_ROLE"
    );
    expect(adminRole?.active).toBe(false);

    // Mint risk still present.
    expect(report.flags.map((f) => f.id)).toContain("active-mint");
    const mintRole = report.activeRoles.find((r) => r.role === "MINT_ROLE");
    expect(mintRole?.active).toBe(true);
    expect(report.score).toBeGreaterThan(0);
  });

  it("clamps the score to the 0-100 range", () => {
    // Pile on every high-weight condition to exceed 100 before clamping.
    const events: B20Event[] = [
      grant("DEFAULT_ADMIN_ROLE", 1),
      grant("MINT_ROLE", 2),
      grant("BURN_BLOCKED_ROLE", 3),
      makeEvent("PolicyUpdated", { policyId: "0x1" }, { blockNumber: 4 }),
      makeEvent("SupplyCapUpdated", { newCap: "1" }, { blockNumber: 5 }),
      makeEvent("BurnedBlocked", { account: HOLDER }, { blockNumber: 6 }),
      makeEvent("Paused", { account: HOLDER }, { blockNumber: 7 }),
    ];
    const report = buildRiskReport(ADDR, events);

    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBe(100);
    expect(report.level).toBe("critical");

    // Empty log floors at 0.
    const empty = buildRiskReport(ADDR, []);
    expect(empty.score).toBe(0);
    expect(empty.level).toBe("low");
  });

  it("derives state from blockNumber + logIndex, not array order", () => {
    // Array order would end on Paused, but by block number Unpaused is later.
    const outOfOrder: B20Event[] = [
      makeEvent("Unpaused", { account: HOLDER }, { blockNumber: 20 }),
      makeEvent("Paused", { account: HOLDER }, { blockNumber: 10 }),
    ];
    const report = buildRiskReport(ADDR, outOfOrder);
    expect(report.stats.paused).toBe(false);

    // Same block: ordering falls back to logIndex.
    const sameBlock: B20Event[] = [
      makeEvent("Unpaused", { account: HOLDER }, { blockNumber: 30, logIndex: 2 }),
      makeEvent("Paused", { account: HOLDER }, { blockNumber: 30, logIndex: 1 }),
    ];
    const sameBlockReport = buildRiskReport(ADDR, sameBlock);
    expect(sameBlockReport.stats.paused).toBe(false);

    // Timeline is returned in chronological order.
    const blocks = report.timeline.map((e) => e.blockNumber);
    expect(blocks).toEqual([...blocks].sort((a, b) => a - b));
  });
});
