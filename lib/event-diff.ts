import type { B20Event } from "./types";

export interface EventDiffEvent {
  name: string;
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  timestamp: string;
}

export interface TokenEventDiff {
  tokenAddress: string;
  baseline: boolean;
  previousEvents: number;
  currentEvents: number;
  newEvents: number;
  latestNewEvents: EventDiffEvent[];
}

export interface RefreshEventDiff {
  tokensChecked: number;
  tokensWithNewEvents: number;
  newEvents: number;
  byToken: TokenEventDiff[];
}

const DEFAULT_SAMPLE_LIMIT = 5;

function eventKey(event: B20Event): string {
  return `${event.transactionHash.toLowerCase()}:${event.logIndex}`;
}

function chronological(a: B20Event, b: B20Event): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
  return a.logIndex - b.logIndex;
}

function toDiffEvent(event: B20Event): EventDiffEvent {
  return {
    name: String(event.name),
    transactionHash: event.transactionHash,
    blockNumber: event.blockNumber,
    logIndex: event.logIndex,
    timestamp: event.timestamp,
  };
}

/**
 * Compares the previously cached timeline with the freshly fetched timeline.
 *
 * If there is no previous timeline, this is treated as a baseline refresh and
 * historical events are not reported as new. This avoids alert storms when a
 * token is first discovered or when the cache is rebuilt.
 */
export function diffTokenEvents(
  tokenAddress: string,
  previousTimeline: B20Event[] | null | undefined,
  currentTimeline: B20Event[],
  sampleLimit: number = DEFAULT_SAMPLE_LIMIT
): TokenEventDiff {
  const previousEvents = previousTimeline?.length ?? 0;
  const baseline = !previousTimeline;

  if (baseline) {
    return {
      tokenAddress,
      baseline: true,
      previousEvents: 0,
      currentEvents: currentTimeline.length,
      newEvents: 0,
      latestNewEvents: [],
    };
  }

  const previousKeys = new Set(previousTimeline.map(eventKey));
  const newEvents = currentTimeline
    .filter((event) => !previousKeys.has(eventKey(event)))
    .sort(chronological);

  return {
    tokenAddress,
    baseline: false,
    previousEvents,
    currentEvents: currentTimeline.length,
    newEvents: newEvents.length,
    latestNewEvents: newEvents.slice(-Math.max(1, sampleLimit)).map(toDiffEvent),
  };
}

export function summarizeEventDiffs(diffs: TokenEventDiff[]): RefreshEventDiff {
  return {
    tokensChecked: diffs.length,
    tokensWithNewEvents: diffs.filter((diff) => diff.newEvents > 0).length,
    newEvents: diffs.reduce((sum, diff) => sum + diff.newEvents, 0),
    byToken: diffs,
  };
}
