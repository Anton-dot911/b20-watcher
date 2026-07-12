import { describe, expect, it } from "vitest";

import {
  B20_ROLE_HASHES,
  B20_ROLE_NAMES,
  DEFAULT_ADMIN_ROLE_HASH,
  isKnownB20Role,
  resolveRole,
} from "./roles";

describe("resolveRole", () => {
  it("decodes DEFAULT_ADMIN_ROLE zero hash", () => {
    expect(resolveRole(DEFAULT_ADMIN_ROLE_HASH)).toBe("DEFAULT_ADMIN_ROLE");
    expect(resolveRole(DEFAULT_ADMIN_ROLE_HASH.toUpperCase().replace("0X", "0x"))).toBe(
      "DEFAULT_ADMIN_ROLE"
    );
  });

  it("decodes every known B20 role hash", () => {
    for (const role of B20_ROLE_NAMES) {
      expect(resolveRole(B20_ROLE_HASHES[role])).toBe(role);
    }
  });

  it("passes through already-decoded known role names", () => {
    expect(resolveRole("MINT_ROLE")).toBe("MINT_ROLE");
    expect(resolveRole("BURN_BLOCKED_ROLE")).toBe("BURN_BLOCKED_ROLE");
  });

  it("preserves unknown role hashes verbatim", () => {
    const unknown = `0x${"de".repeat(32)}`;
    expect(resolveRole(unknown)).toBe(unknown);
  });
});

describe("isKnownB20Role", () => {
  it("returns true only for known role names", () => {
    expect(isKnownB20Role("MINT_ROLE")).toBe(true);
    expect(isKnownB20Role(B20_ROLE_HASHES.MINT_ROLE)).toBe(false);
    expect(isKnownB20Role("POLICY_ROLE")).toBe(false);
  });
});
