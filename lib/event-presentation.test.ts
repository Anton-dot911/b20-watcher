import { describe, expect, it } from "vitest";

import { formatEventNumber, presentEvent } from "./event-presentation";
import { B20_ROLE_HASHES } from "./roles";
import type { B20Event } from "./types";

function event(name: string, args: Record<string, unknown>): B20Event {
  return {
    name,
    signature: `${name}(test)`,
    timestamp: "2026-07-11T00:00:00.000Z",
    transactionHash:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    blockNumber: 1,
    logIndex: 0,
    args,
  };
}

describe("presentEvent", () => {
  it("maps known event names to readable titles and descriptions", () => {
    const presented = presentEvent(
      event("SupplyCapUpdated", {
        updater: "0xb20f000000000000000000000000000000000000",
        newSupplyCap: "1000000000000000000000",
        oldSupplyCap: "0",
      })
    );

    expect(presented.title).toBe("Supply cap updated");
    expect(presented.description).toContain("maximum supply cap");
    expect(presented.args.map((arg) => arg.key)).toEqual([
      "newSupplyCap",
      "oldSupplyCap",
      "updater",
    ]);
  });

  it("shows decoded role names for known role hashes", () => {
    const presented = presentEvent(
      event("RoleGranted", {
        role: B20_ROLE_HASHES.MINT_ROLE,
        account: "0x4a51000000000000000000000000000000c9f505",
        sender: "0xb20f000000000000000000000000000000000000",
      })
    );

    const role = presented.args.find((arg) => arg.key === "role");

    expect(role?.kind).toBe("text");
    expect(role?.value).toBe("MINT_ROLE");
  });

  it("classifies unreadable role values as unknown", () => {
    const presented = presentEvent(
      event("RoleGranted", {
        role: "���bad-role���",
        account: "0x4a51000000000000000000000000000000c9f505",
        sender: "0xb20f000000000000000000000000000000000000",
      })
    );

    const role = presented.args.find((arg) => arg.key === "role");
    const account = presented.args.find((arg) => arg.key === "account");

    expect(role?.kind).toBe("unknown");
    expect(account?.kind).toBe("address");
  });

  it("falls back for unknown event names", () => {
    const presented = presentEvent(event("CustomEvent", { value: "abc" }));

    expect(presented.title).toBe("CustomEvent");
    expect(presented.description).toBe("Observed B20 event.");
  });
});

describe("formatEventNumber", () => {
  it("formats integer-like values with grouping", () => {
    expect(formatEventNumber("1000000000000000000000")).toBe(
      "1,000,000,000,000,000,000,000"
    );
  });

  it("leaves non-integer values unchanged", () => {
    expect(formatEventNumber("launchpad")).toBe("launchpad");
  });
});
