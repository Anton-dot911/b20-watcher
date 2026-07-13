import { describe, expect, it } from "vitest";

import { diffTokenEvents, summarizeEventDiffs } from "./event-diff";
import type { B20Event } from "./types";

const ADDR = "0xb200000000000000000000000000000000000001";

function event(transactionHash: string, logIndex: number, blockNumber = 1): B20Event {
  return {
    name: "RoleGranted",
    transactionHash,
    logIndex,
    blockNumber,
    timestamp: new Date(blockNumber * 1000).toISOString(),
    args: {},
  };
}

describe("diffTokenEvents", () => {
  it("treats missing previous timeline as a baseline and reports no new events", () => {
    const diff = diffTokenEvents(ADDR, undefined, [event("0x1", 0), event("0x2", 0)]);

    expect(diff).toMatchObject({
      tokenAddress: ADDR,
      baseline: true,
      previousEvents: 0,
      currentEvents: 2,
      newEvents: 0,
      latestNewEvents: [],
    });
  });

  it("detects events not present in the previous timeline", () => {
    const previous = [event("0x1", 0, 1), event("0x2", 0, 2)];
    const current = [event("0x1", 0, 1), event("0x2", 0, 2), event("0x3", 0, 3)];

    const diff = diffTokenEvents(ADDR, previous, current);

    expect(diff.baseline).toBe(false);
    expect(diff.previousEvents).toBe(2);
    expect(diff.currentEvents).toBe(3);
    expect(diff.newEvents).toBe(1);
    expect(diff.latestNewEvents).toEqual([
      {
        name: "RoleGranted",
        transactionHash: "0x3",
        blockNumber: 3,
        logIndex: 0,
        timestamp: new Date(3000).toISOString(),
      },
    ]);
  });

  it("uses transaction hash plus log index as the stable event key", () => {
    const previous = [event("0x1", 0, 1)];
    const current = [event("0x1", 0, 1), event("0x1", 1, 1)];

    const diff = diffTokenEvents(ADDR, previous, current);

    expect(diff.newEvents).toBe(1);
    expect(diff.latestNewEvents[0].logIndex).toBe(1);
  });

  it("limits returned event samples", () => {
    const current = Array.from({ length: 10 }, (_, index) =>
      event(`0x${index}`, 0, index)
    );

    const diff = diffTokenEvents(ADDR, [], current, 3);

    expect(diff.newEvents).toBe(10);
    expect(diff.latestNewEvents).toHaveLength(3);
  });
});

describe("summarizeEventDiffs", () => {
  it("summarizes token-level diffs", () => {
    const first = diffTokenEvents(ADDR, [], [event("0x1", 0)]);
    const second = diffTokenEvents(`${ADDR.slice(0, -1)}2`, [], []);

    expect(summarizeEventDiffs([first, second])).toMatchObject({
      tokensChecked: 2,
      tokensWithNewEvents: 1,
      newEvents: 1,
    });
  });
});
