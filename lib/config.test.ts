import { afterEach, describe, expect, it, vi } from "vitest";

import { parseDataSource } from "./config";

describe("parseDataSource", () => {
  it("parses the three supported sources, case-insensitively and trimmed", () => {
    expect(parseDataSource("mock")).toBe("mock");
    expect(parseDataSource("cdp")).toBe("cdp");
    expect(parseDataSource("supabase")).toBe("supabase");
    expect(parseDataSource("  CDP ")).toBe("cdp");
    expect(parseDataSource("Supabase")).toBe("supabase");
  });

  it("returns null for unsupported / empty / non-string input", () => {
    expect(parseDataSource("postgres")).toBeNull();
    expect(parseDataSource("")).toBeNull();
    expect(parseDataSource(null)).toBeNull();
    expect(parseDataSource(undefined)).toBeNull();
  });
});

// The resolved DATA_SOURCE and dataModeLabel are computed from the environment
// at module load, so each case reloads the module with a fresh environment.
describe("resolved DATA_SOURCE and dataModeLabel", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  async function loadConfig(env: Record<string, string | undefined>) {
    vi.resetModules();
    // Start from a clean slate for the vars we care about.
    delete process.env.MOCK_MODE;
    delete process.env.DATA_SOURCE;
    delete process.env.B20_NETWORK;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return import("./config");
  }

  it("defaults to mock when MOCK_MODE is unset", async () => {
    const config = await loadConfig({});
    expect(config.DATA_SOURCE).toBe("mock");
    expect(config.dataModeLabel()).toBe("Mock mode");
  });

  it("mock mode wins even if DATA_SOURCE=cdp is set", async () => {
    const config = await loadConfig({ MOCK_MODE: "true", DATA_SOURCE: "cdp" });
    expect(config.DATA_SOURCE).toBe("mock");
    expect(config.dataModeLabel()).toBe("Mock mode");
  });

  it("resolves cdp on base", async () => {
    const config = await loadConfig({ MOCK_MODE: "false", DATA_SOURCE: "cdp" });
    expect(config.DATA_SOURCE).toBe("cdp");
    expect(config.dataModeLabel()).toBe("Live: CDP / Base");
  });

  it("resolves supabase on base sepolia", async () => {
    const config = await loadConfig({
      MOCK_MODE: "false",
      DATA_SOURCE: "supabase",
      B20_NETWORK: "base-sepolia",
    });
    expect(config.DATA_SOURCE).toBe("supabase");
    expect(config.dataModeLabel()).toBe("Cached: Supabase / Base Sepolia");
  });

  it("falls back safely to cdp for an invalid DATA_SOURCE in live mode", async () => {
    const config = await loadConfig({
      MOCK_MODE: "false",
      DATA_SOURCE: "nonsense",
    });
    expect(config.DATA_SOURCE).toBe("cdp");
    expect(config.dataModeLabel()).toBe("Live: CDP / Base");
  });
});
