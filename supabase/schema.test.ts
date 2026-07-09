import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8")
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("Supabase schema network scoping", () => {
  it("uses a composite primary key for b20_tokens", () => {
    expect(schema).toContain("primary key (network, address)");
  });

  it("uses a composite foreign key from b20_events to b20_tokens", () => {
    expect(schema).toContain("foreign key (network, token_address)");
    expect(schema).toContain("references b20_tokens(network, address)");
  });

  it("keeps b20_events unique by network + transaction hash + log index", () => {
    expect(schema).toContain("unique (network, transaction_hash, log_index)");
  });

  it("uses a composite primary key for b20_risk_reports", () => {
    expect(schema).toContain("primary key (network, token_address)");
  });

  it("allows the same token address to exist on multiple networks", () => {
    expect(schema).not.toContain("address text primary key");
    expect(schema).not.toContain("token_address text primary key");
  });
});
