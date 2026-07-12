import { describe, expect, it } from "vitest";

import {
  normalizeB20CreatedRow,
  normalizeEventRow,
  resolveRole,
  type CdpB20CreatedRow,
  type CdpEventRow,
} from "./cdp-sql";
import { buildRiskReport } from "./risk";
import { B20_ROLE_HASHES } from "./roles";

const ADDR = "0xb200000000000000000000000000000000000001";
const HOLDER = "0xa11ce00000000000000000000000000000000abc";
const ZERO_HASH = `0x${"0".repeat(64)}`;
const UNKNOWN_ROLE_HASH = `0x${"de".repeat(32)}`;

describe("normalizeB20CreatedRow", () => {
  it("maps a B20Created row to a B20Token", () => {
    const row: CdpB20CreatedRow = {
      block_timestamp: "2026-07-08 18:10:00.000",
      transaction_hash: "0xabc",
      token_address: "0xB200000000000000000000000000000000000001",
      name: "Acme Regulated USD",
      symbol: "aRUSD",
      decimals: 6,
      variant: "regulated",
      block_number: 18_000_100,
      log_index: 0,
    };

    const token = normalizeB20CreatedRow(row);
    expect(token.address).toBe(ADDR); // lowercased
    expect(token.name).toBe("Acme Regulated USD");
    expect(token.symbol).toBe("aRUSD");
    expect(token.decimals).toBe(6);
    expect(token.variant).toBe("regulated");
    expect(token.createdAt).toBe("2026-07-08T18:10:00.000Z");
    expect(token.events).toEqual([]);
  });

  it("coerces a string decimals field to a number", () => {
    const token = normalizeB20CreatedRow({
      token_address: ADDR,
      decimals: "18",
    });
    expect(token.decimals).toBe(18);
  });

  it("handles a unix-seconds timestamp", () => {
    const token = normalizeB20CreatedRow({
      token_address: ADDR,
      block_timestamp: 1_752_000_000,
    });
    expect(token.createdAt).toBe(new Date(1_752_000_000 * 1000).toISOString());
  });
});

describe("normalizeEventRow", () => {
  it("maps a RoleGranted row to an internal B20Event", () => {
    const row: CdpEventRow = {
      block_timestamp: "2026-07-08 18:10:00.000",
      transaction_hash: "0xabc",
      event_name: "RoleGranted",
      event_signature: "RoleGranted(bytes32,address,address)",
      parameters: { role: ZERO_HASH, account: HOLDER, sender: HOLDER },
      block_number: 18_000_100,
      log_index: 2,
    };

    const event = normalizeEventRow(row);
    expect(event).not.toBeNull();
    expect(event?.name).toBe("RoleGranted");
    expect(event?.blockNumber).toBe(18_000_100);
    expect(event?.logIndex).toBe(2);
    expect(event?.transactionHash).toBe("0xabc");
    // Zero-hash resolves to the admin role.
    expect(event?.args.role).toBe("DEFAULT_ADMIN_ROLE");
    expect(event?.args.account).toBe(HOLDER);
  });

  it("prefers role_topic when parameters.role is empty", () => {
    const event = normalizeEventRow({
      event_signature: "RoleGranted(bytes32,address,address)",
      parameters: { role: "", account: HOLDER, sender: HOLDER },
      role_topic: B20_ROLE_HASHES.MINT_ROLE,
      block_number: 1,
      log_index: 0,
    });

    expect(event?.args.role).toBe("MINT_ROLE");
  });

  it("prefers role_topic when parameters.role is unreadable", () => {
    const event = normalizeEventRow({
      event_signature: "RoleGranted(bytes32,address,address)",
      parameters: { role: "���bad-role���", account: HOLDER, sender: HOLDER },
      role_topic: B20_ROLE_HASHES.BURN_BLOCKED_ROLE,
      block_number: 1,
      log_index: 0,
    });

    expect(event?.args.role).toBe("BURN_BLOCKED_ROLE");
  });

  it("decodes known non-admin role hashes", () => {
    const event = normalizeEventRow({
      event_signature: "RoleGranted(bytes32,address,address)",
      parameters: {
        role: B20_ROLE_HASHES.BURN_BLOCKED_ROLE,
        account: HOLDER,
        sender: HOLDER,
      },
      block_number: 1,
      log_index: 0,
    });

    expect(event?.args.role).toBe("BURN_BLOCKED_ROLE");
  });

  it("parses parameters supplied as a JSON string", () => {
    const event = normalizeEventRow({
      event_signature: "SupplyCapUpdated(address,uint256,uint256)",
      parameters: JSON.stringify({ oldCap: "1", newCap: "2" }),
      block_number: 1,
      log_index: 0,
    });
    expect(event?.name).toBe("SupplyCapUpdated");
    expect(event?.args.newCap).toBe("2");
  });

  it("derives the event name from the signature when event_name is missing", () => {
    const event = normalizeEventRow({
      event_signature: "Paused(address,uint8[])",
      parameters: { account: HOLDER },
      block_number: 5,
      log_index: 0,
    });
    expect(event?.name).toBe("Paused");
  });

  it("returns null when there is no name or signature", () => {
    expect(normalizeEventRow({ parameters: {} })).toBeNull();
  });

  it("preserves an unknown role hash verbatim", () => {
    const event = normalizeEventRow({
      event_signature: "RoleGranted(bytes32,address,address)",
      parameters: { role: UNKNOWN_ROLE_HASH, account: HOLDER },
      block_number: 1,
      log_index: 0,
    });
    expect(event?.args.role).toBe(UNKNOWN_ROLE_HASH);
  });
});

describe("resolveRole", () => {
  it("decodes the zero-hash admin role", () => {
    expect(resolveRole(ZERO_HASH)).toBe("DEFAULT_ADMIN_ROLE");
    expect(resolveRole(ZERO_HASH.toUpperCase().replace("0X", "0x"))).toBe(
      "DEFAULT_ADMIN_ROLE"
    );
  });

  it("decodes known role hashes", () => {
    expect(resolveRole(B20_ROLE_HASHES.MINT_ROLE)).toBe("MINT_ROLE");
    expect(resolveRole(B20_ROLE_HASHES.PAUSE_ROLE)).toBe("PAUSE_ROLE");
  });

  it("passes through an already-decoded known role name", () => {
    expect(resolveRole("MINT_ROLE")).toBe("MINT_ROLE");
  });

  it("preserves an unknown role verbatim", () => {
    expect(resolveRole(UNKNOWN_ROLE_HASH)).toBe(UNKNOWN_ROLE_HASH);
  });
});

describe("risk engine tolerance for normalized live rows", () => {
  it("flags admin risk for a normalized zero-hash RoleGranted event", () => {
    const event = normalizeEventRow({
      event_signature: "RoleGranted(bytes32,address,address)",
      parameters: { role: ZERO_HASH, account: HOLDER, sender: HOLDER },
      block_number: 1,
      log_index: 0,
    })!;

    const report = buildRiskReport(ADDR, [event]);
    expect(report.flags.map((f) => f.id)).toContain("active-admin");
  });

  it("flags mint risk for a normalized MINT_ROLE hash", () => {
    const event = normalizeEventRow({
      event_signature: "RoleGranted(bytes32,address,address)",
      parameters: { role: B20_ROLE_HASHES.MINT_ROLE, account: HOLDER, sender: HOLDER },
      block_number: 1,
      log_index: 0,
    })!;

    const report = buildRiskReport(ADDR, [event]);
    expect(report.flags.map((f) => f.id)).toContain("active-mint");
  });

  it("flags burn-blocked risk from role_topic when parameters.role is unreadable", () => {
    const event = normalizeEventRow({
      event_signature: "RoleGranted(bytes32,address,address)",
      parameters: { role: "���bad-role���", account: HOLDER, sender: HOLDER },
      role_topic: B20_ROLE_HASHES.BURN_BLOCKED_ROLE,
      block_number: 1,
      log_index: 0,
    })!;

    const report = buildRiskReport(ADDR, [event]);
    expect(report.flags.map((f) => f.id)).toContain("active-burn-blocked");
  });

  it("does not crash and does not flag an unknown role", () => {
    const event = normalizeEventRow({
      event_signature: "RoleGranted(bytes32,address,address)",
      parameters: { role: UNKNOWN_ROLE_HASH, account: HOLDER, sender: HOLDER },
      block_number: 1,
      log_index: 0,
    })!;

    expect(() => buildRiskReport(ADDR, [event])).not.toThrow();
    const report = buildRiskReport(ADDR, [event]);
    expect(report.flags.map((f) => f.id)).not.toContain("active-admin");
    // The unknown role is not surfaced as an active built-in role.
    expect(report.activeRoles.every((r) => !r.active)).toBe(true);
  });
});
