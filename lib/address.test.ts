import { describe, expect, it } from "vitest";

import { isValidAddress, normalizeAddress, shortenAddress } from "./address";

const LOWER = "0xb200000000000000000000000000000000000001";
const MIXED = "0xB200000000000000000000000000000000000ABC";

describe("isValidAddress", () => {
  it("accepts a valid lowercase address", () => {
    expect(isValidAddress(LOWER)).toBe(true);
  });

  it("accepts a valid mixed-case address", () => {
    expect(isValidAddress(MIXED)).toBe(true);
  });

  it("rejects a non-hex address", () => {
    expect(isValidAddress("0xZZ00000000000000000000000000000000000001")).toBe(
      false
    );
  });

  it("rejects a too-short address", () => {
    expect(isValidAddress("0xb20001")).toBe(false);
  });

  it("rejects empty and nullish input", () => {
    expect(isValidAddress("")).toBe(false);
    expect(isValidAddress(null)).toBe(false);
    expect(isValidAddress(undefined)).toBe(false);
  });
});

describe("normalizeAddress", () => {
  it("passes a valid lowercase address through unchanged", () => {
    expect(normalizeAddress(LOWER)).toBe(LOWER);
  });

  it("normalizes a valid mixed-case address to lowercase", () => {
    expect(normalizeAddress(MIXED)).toBe(MIXED.toLowerCase());
  });

  it("returns null for an invalid address", () => {
    expect(normalizeAddress("not-an-address")).toBeNull();
  });

  it("returns null for a non-hex address", () => {
    expect(
      normalizeAddress("0xZZ00000000000000000000000000000000000001")
    ).toBeNull();
  });

  it("returns null for a too-short address", () => {
    expect(normalizeAddress("0xb20001")).toBeNull();
  });
});

describe("shortenAddress", () => {
  it("shortens a valid address", () => {
    expect(shortenAddress(LOWER)).toBe("0xb200…0001");
  });

  it("returns the input unchanged when it is not a valid address", () => {
    expect(shortenAddress("bogus")).toBe("bogus");
  });
});
