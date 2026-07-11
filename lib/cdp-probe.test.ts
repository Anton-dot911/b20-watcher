import { describe, expect, it } from "vitest";

import { buildCdpProbeSql, clampProbeLimit, sanitizeProbeError } from "./cdp-probe";

describe("clampProbeLimit", () => {
  it("clamps probe limits to the safe 1-20 range", () => {
    expect(clampProbeLimit(0)).toBe(1);
    expect(clampProbeLimit(5)).toBe(5);
    expect(clampProbeLimit(999)).toBe(20);
  });

  it("accepts numeric strings", () => {
    expect(clampProbeLimit("7")).toBe(7);
  });
});

describe("sanitizeProbeError", () => {
  it("normalizes and truncates error messages", () => {
    const sanitized = sanitizeProbeError(new Error(`Probe failed\n${"x".repeat(500)}`));

    expect(sanitized).not.toContain("\n");
    expect(sanitized.length).toBeLessThanOrEqual(240);
    expect(sanitized.startsWith("Probe failed")).toBe(true);
  });
});

describe("buildCdpProbeSql", () => {
  it("builds factory probes with exact and lowercase factory addresses", () => {
    const sql = buildCdpProbeSql(5);

    expect(sql.factoryExactAddressCount).toContain("address = '0xB20f000000000000000000000000000000000000'");
    expect(sql.factoryLowercaseAddressCount).toContain("address = '0xb20f000000000000000000000000000000000000'");
    expect(sql.factoryLatestEvents).toContain("address IN ('0xB20f000000000000000000000000000000000000', '0xb20f000000000000000000000000000000000000')");
  });

  it("builds B20Created probes by signature and event name", () => {
    const sql = buildCdpProbeSql(5);

    expect(sql.b20CreatedBySignatureCount).toContain("event_signature = 'B20Created(address,uint8,string,string,uint8,bytes)'");
    expect(sql.b20CreatedByEventNameCount).toContain("event_name = 'B20Created'");
    expect(sql.b20CreatedSignatureAnywhere).toContain("event_signature = 'B20Created(address,uint8,string,string,uint8,bytes)'");
    expect(sql.b20CreatedEventNameAnywhere).toContain("event_name = 'B20Created'");
  });

  it("clamps SQL sample limits", () => {
    const sql = buildCdpProbeSql(500);

    expect(sql.safeLimit).toBe(20);
    expect(sql.factoryLatestEvents).toContain("LIMIT 20");
  });
});
