import { describe, expect, it } from "vitest";

import { clampDiagnosticLimit, sanitizeDiagnosticError } from "./diagnostics";

describe("clampDiagnosticLimit", () => {
  it("defaults invalid values to 1", () => {
    expect(clampDiagnosticLimit("not-a-number")).toBe(1);
  });

  it("clamps diagnostics limits to the safe 1-20 range", () => {
    expect(clampDiagnosticLimit(0)).toBe(1);
    expect(clampDiagnosticLimit(5)).toBe(5);
    expect(clampDiagnosticLimit(500)).toBe(20);
  });

  it("accepts numeric strings", () => {
    expect(clampDiagnosticLimit("7")).toBe(7);
  });
});

describe("sanitizeDiagnosticError", () => {
  it("normalizes whitespace and caps long error messages", () => {
    const longMessage = `CDP failed\n\n${"x".repeat(500)}`;
    const sanitized = sanitizeDiagnosticError(new Error(longMessage));

    expect(sanitized).not.toContain("\n");
    expect(sanitized.length).toBeLessThanOrEqual(240);
    expect(sanitized.startsWith("CDP failed")).toBe(true);
  });
});
