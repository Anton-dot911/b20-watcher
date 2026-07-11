import { describe, expect, it } from "vitest";

import { explainRiskScore, formatScoreReason } from "./score-explanation";
import type { RiskReport } from "./types";

function reportWithFlags(flags: RiskReport["flags"]): RiskReport {
  return {
    tokenAddress: "0xb200000000000000000000000000000000000001",
    score: flags.reduce((sum, flag) => sum + flag.points, 0),
    level: "low",
    summary: "Test report",
    flags,
    activeRoles: [],
    stats: {
      totalEvents: 0,
      activeRoleCount: 0,
      flagCount: flags.length,
      paused: false,
      adminRenounced: false,
    },
    timeline: [],
    generatedAt: "2026-07-11T00:00:00.000Z",
  };
}

describe("explainRiskScore", () => {
  it("returns the highest-point flag as the main reason", () => {
    const explanation = explainRiskScore(
      reportWithFlags([
        {
          id: "supply-cap-changed",
          title: "Supply cap changed",
          description: "Supply cap was updated.",
          severity: "low",
          points: 10,
        },
        {
          id: "active-admin",
          title: "Active admin role",
          description: "Admin role is active.",
          severity: "high",
          points: 30,
        },
      ])
    );

    expect(explanation.mainReason.title).toBe("Active admin role");
    expect(explanation.mainReason.points).toBe(30);
    expect(explanation.reasons.map((reason) => reason.points)).toEqual([30, 10]);
    expect(explanation.hasPositiveReasons).toBe(true);
  });

  it("ignores zero-point flags for score reasons", () => {
    const explanation = explainRiskScore(
      reportWithFlags([
        {
          id: "info-only",
          title: "Informational flag",
          description: "No points.",
          severity: "info",
          points: 0,
        },
      ])
    );

    expect(explanation.hasPositiveReasons).toBe(false);
    expect(explanation.mainReason.title).toBe("No score-bearing flags");
    expect(explanation.reasons).toEqual([]);
  });

  it("formats positive and zero-point reasons", () => {
    expect(
      formatScoreReason({
        title: "Supply cap changed",
        points: 10,
        severity: "low",
        description: "Supply cap was updated.",
      })
    ).toBe("Supply cap changed +10");

    expect(
      formatScoreReason({
        title: "No score-bearing flags",
        points: 0,
        severity: "none",
        description: "No flags.",
      })
    ).toBe("No score-bearing flags");
  });
});
