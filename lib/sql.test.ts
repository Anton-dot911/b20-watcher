import { describe, expect, it } from "vitest";

import {
  B20_EVENT_SIGNATURES,
  b20TokenEventsSql,
  clampLimit,
  discoverB20TokensSql,
  parseNetwork,
} from "./sql";

const TOKEN = "0xb200000000000000000000000000000000000001";

const FACTORY_LOWER = "0xb20f000000000000000000000000000000000000";

describe("parseNetwork", () => {
  it("accepts base", () => {
    expect(parseNetwork("base")).toBe("base");
  });

  it("accepts base_sepolia", () => {
    expect(parseNetwork("base_sepolia")).toBe("base_sepolia");
  });

  it("normalizes the hyphenated base-sepolia form", () => {
    expect(parseNetwork("base-sepolia")).toBe("base_sepolia");
  });

  it("is case-insensitive and trims", () => {
    expect(parseNetwork("  BASE ")).toBe("base");
    expect(parseNetwork("Base-Sepolia")).toBe("base_sepolia");
  });

  it("returns null for unsupported networks (invalid input cannot select a table)", () => {
    expect(parseNetwork("mainnet")).toBeNull();
    expect(parseNetwork("ethereum")).toBeNull();
    expect(parseNetwork("")).toBeNull();
    expect(parseNetwork(null)).toBeNull();
    expect(parseNetwork(undefined)).toBeNull();
  });
});

describe("clampLimit", () => {
  it("clamps to the max", () => {
    expect(clampLimit(500, 1, 100)).toBe(100);
  });

  it("clamps to the min", () => {
    expect(clampLimit(0, 1, 100)).toBe(1);
    expect(clampLimit(-5, 1, 100)).toBe(1);
  });

  it("passes a value in range through, floored", () => {
    expect(clampLimit(42.9, 1, 100)).toBe(42);
  });

  it("falls back to min for non-finite input", () => {
    expect(clampLimit(Number.NaN, 1, 100)).toBe(1);
    expect(clampLimit(Number.POSITIVE_INFINITY, 1, 100)).toBe(1);
  });
});

describe("discoverB20TokensSql", () => {
  it("queries the base.events table for base", () => {
    const sql = discoverB20TokensSql("base", 50);
    expect(sql).toContain("FROM base.events");
    expect(sql).not.toContain("base_sepolia.events");
  });

  it("queries the base_sepolia.events table for base_sepolia", () => {
    const sql = discoverB20TokensSql("base_sepolia", 50);
    expect(sql).toContain("FROM base_sepolia.events");
  });

  it("filters on the B20Created signature, lowercase factory, and added action", () => {
    const sql = discoverB20TokensSql("base", 50);
    expect(sql).toContain(
      "event_signature = 'B20Created(address,uint8,string,string,uint8,bytes)'"
    );
    expect(sql).toContain(`address = '${FACTORY_LOWER}'`);
    expect(sql).not.toContain(
      "address = '0xB20f000000000000000000000000000000000000'"
    );
    expect(sql).toContain("action = 'added'");
  });

  it("lowercases a valid factory override because CDP stores EVM addresses lowercase", () => {
    const factory = "0xABC0000000000000000000000000000000000001";
    expect(discoverB20TokensSql("base", 10, factory)).toContain(
      "address = '0xabc0000000000000000000000000000000000001'"
    );
  });

  it("clamps the limit to 1-100", () => {
    expect(discoverB20TokensSql("base", 9999)).toContain("LIMIT 100");
    expect(discoverB20TokensSql("base", 0)).toContain("LIMIT 1");
  });

  it("falls back to the lowercased default factory when given an invalid factory", () => {
    const sql = discoverB20TokensSql("base", 10, "not-an-address");
    expect(sql).toContain(`address = '${FACTORY_LOWER}'`);
  });
});

describe("b20TokenEventsSql", () => {
  it("queries the correct table per network", () => {
    expect(b20TokenEventsSql("base", TOKEN, 100)).toContain("FROM base.events");
    expect(b20TokenEventsSql("base_sepolia", TOKEN, 100)).toContain(
      "FROM base_sepolia.events"
    );
  });

  it("includes all required B20 event signatures", () => {
    const sql = b20TokenEventsSql("base", TOKEN, 100);
    for (const signature of B20_EVENT_SIGNATURES) {
      expect(sql).toContain(`'${signature}'`);
    }
  });

  it("selects topic1 as role_topic for canonical role-hash recovery", () => {
    const sql = b20TokenEventsSql("base", TOKEN, 100);
    expect(sql).toContain("topic1 AS role_topic");
  });

  it("includes the specific role/pause/policy signatures called out by the task", () => {
    const sql = b20TokenEventsSql("base", TOKEN, 100);
    expect(sql).toContain("'RoleGranted(bytes32,address,address)'");
    expect(sql).toContain("'RoleRevoked(bytes32,address,address)'");
    expect(sql).toContain("'RoleAdminChanged(bytes32,bytes32,bytes32)'");
    expect(sql).toContain("'LastAdminRenounced(address)'");
    expect(sql).toContain("'Paused(address,uint8[])'");
    expect(sql).toContain("'Unpaused(address,uint8[])'");
    expect(sql).toContain("'PolicyUpdated(bytes32,uint64,uint64)'");
    expect(sql).toContain("'SupplyCapUpdated(address,uint256,uint256)'");
    expect(sql).toContain("'BurnedBlocked(address,address,uint256)'");
  });

  it("orders by block_number then log_index ascending", () => {
    const sql = b20TokenEventsSql("base", TOKEN, 100);
    expect(sql).toContain("ORDER BY block_number ASC, log_index ASC");
  });

  it("lowercases and interpolates the validated token address", () => {
    const sql = b20TokenEventsSql(
      "base",
      "0xB200000000000000000000000000000000000ABC",
      100
    );
    expect(sql).toContain(
      "address = '0xb200000000000000000000000000000000000abc'"
    );
  });

  it("throws when the token address is invalid (validated before construction)", () => {
    expect(() => b20TokenEventsSql("base", "not-an-address", 100)).toThrow();
    expect(() => b20TokenEventsSql("base", "0xdead", 100)).toThrow();
    expect(() =>
      b20TokenEventsSql("base", "'; DROP TABLE events;--", 100)
    ).toThrow();
  });

  it("clamps the limit to 1-5000", () => {
    expect(b20TokenEventsSql("base", TOKEN, 10_000)).toContain("LIMIT 5000");
    expect(b20TokenEventsSql("base", TOKEN, 0)).toContain("LIMIT 1");
  });
});
