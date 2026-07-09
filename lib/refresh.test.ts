import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the CDP client (keep the real row normalizers) and the Supabase cache
// so the refresh functions can be exercised without any network or database.
vi.mock("./cdp-sql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cdp-sql")>();
  return { ...actual, runCdpSql: vi.fn() };
});

vi.mock("./b20-cache", () => ({
  upsertTokens: vi.fn(async () => {}),
  upsertEvents: vi.fn(async () => {}),
  upsertRiskReport: vi.fn(async () => {}),
}));

import { upsertEvents, upsertRiskReport, upsertTokens } from "./b20-cache";
import { runCdpSql } from "./cdp-sql";
import { refreshRecentB20Tokens, refreshTokenRisk } from "./refresh";

const ADDR = "0xb200000000000000000000000000000000000001";
const HOLDER = "0xa11ce00000000000000000000000000000000abc";
const ZERO_HASH = `0x${"0".repeat(64)}`;

const runCdpSqlMock = vi.mocked(runCdpSql);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("refreshRecentB20Tokens", () => {
  it("discovers tokens and upserts tokens, events, and reports", async () => {
    runCdpSqlMock
      // 1) token discovery
      .mockResolvedValueOnce([
        {
          token_address: ADDR,
          name: "Acme Regulated USD",
          symbol: "aRUSD",
          decimals: 6,
          variant: "regulated",
          block_timestamp: "2026-07-08 18:10:00.000",
          block_number: 18_000_100,
          log_index: 0,
        },
      ] as never)
      // 2) that token's event timeline
      .mockResolvedValueOnce([
        {
          event_signature: "RoleGranted(bytes32,address,address)",
          parameters: { role: ZERO_HASH, account: HOLDER, sender: HOLDER },
          transaction_hash: "0xabc",
          block_number: 18_000_100,
          log_index: 0,
        },
      ] as never);

    const result = await refreshRecentB20Tokens(5);

    expect(result).toMatchObject({
      network: "base",
      tokens: 1,
      events: 1,
      reports: 1,
    });

    expect(upsertTokens).toHaveBeenCalledTimes(1);
    const upsertedTokens = vi.mocked(upsertTokens).mock.calls[0][0];
    expect(upsertedTokens[0].address).toBe(ADDR);

    expect(upsertEvents).toHaveBeenCalledTimes(1);
    const [eventAddress, events] = vi.mocked(upsertEvents).mock.calls[0];
    expect(eventAddress).toBe(ADDR);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("RoleGranted");

    expect(upsertRiskReport).toHaveBeenCalledTimes(1);
    const report = vi.mocked(upsertRiskReport).mock.calls[0][0];
    // The admin role is active, so the report should flag it.
    expect(report.flags.map((f) => f.id)).toContain("active-admin");
  });

  it("is a safe no-op set of upserts when discovery returns nothing", async () => {
    runCdpSqlMock.mockResolvedValueOnce([] as never);

    const result = await refreshRecentB20Tokens();

    expect(result).toMatchObject({ tokens: 0, events: 0, reports: 0 });
    expect(upsertTokens).toHaveBeenCalledTimes(1); // called with []
    expect(upsertEvents).not.toHaveBeenCalled();
    expect(upsertRiskReport).not.toHaveBeenCalled();
  });
});

describe("refreshTokenRisk", () => {
  it("upserts a token stub, its events, and its report", async () => {
    runCdpSqlMock.mockResolvedValueOnce([
      {
        event_signature: "Paused(address,uint8[])",
        parameters: { account: HOLDER },
        transaction_hash: "0xdef",
        block_number: 18_030_000,
        log_index: 0,
      },
    ] as never);

    const result = await refreshTokenRisk(ADDR);

    expect(result).toMatchObject({
      network: "base",
      tokens: 1,
      events: 1,
      reports: 1,
      tokenAddress: ADDR,
    });
    expect(upsertTokens).toHaveBeenCalledTimes(1);
    expect(upsertEvents).toHaveBeenCalledWith(ADDR, expect.any(Array));
    expect(upsertRiskReport).toHaveBeenCalledTimes(1);
    const report = vi.mocked(upsertRiskReport).mock.calls[0][0];
    expect(report.stats.paused).toBe(true);
  });

  it("throws on an invalid address without touching the cache", async () => {
    await expect(refreshTokenRisk("not-an-address")).rejects.toThrow(
      /invalid token address/i
    );
    expect(upsertTokens).not.toHaveBeenCalled();
    expect(upsertEvents).not.toHaveBeenCalled();
    expect(upsertRiskReport).not.toHaveBeenCalled();
  });
});
