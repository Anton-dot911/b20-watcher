import { describe, expect, it } from "vitest";

import { getHealthSnapshot } from "./health";

describe("getHealthSnapshot", () => {
  it("returns a secret-free health payload", () => {
    const snapshot = getHealthSnapshot(new Date("2026-07-09T00:00:00.000Z"));

    expect(snapshot.ok).toBe(true);
    expect(snapshot.service).toBe("b20-watcher");
    expect(snapshot.generatedAt).toBe("2026-07-09T00:00:00.000Z");
    expect(snapshot).toHaveProperty("mockMode");
    expect(snapshot).toHaveProperty("dataSource");
    expect(snapshot).toHaveProperty("network");
    expect(snapshot).toHaveProperty("modeLabel");

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("CDP_BEARER_TOKEN");
    expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serialized).not.toContain("REFRESH_SECRET");
  });
});
