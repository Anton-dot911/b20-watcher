// Address validation and normalization helpers.
//
// Addresses are user-controlled input (URL params, API params). Validating and
// normalizing them here keeps the rest of the app from having to trust raw
// strings, and would prevent SQL interpolation issues in a real-data mode.

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Returns true if the string is a well-formed 20-byte hex address.
 */
export function isValidAddress(value: string | null | undefined): value is string {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

/**
 * Lowercases a valid address for consistent comparison and lookup.
 * Returns null if the input is not a valid address.
 */
export function normalizeAddress(value: string | null | undefined): string | null {
  if (!isValidAddress(value)) return null;
  return value.toLowerCase();
}

/**
 * Shortens an address for display, e.g. 0xb200…0001.
 */
export function shortenAddress(value: string): string {
  if (!isValidAddress(value)) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
