// Refresh-endpoint authorization.
//
// Kept as a pure, side-effect-free helper so it can be unit tested without a
// running server. The refresh secret is read from the environment and compared
// against the caller-supplied `x-refresh-secret` header. The secret itself is
// never returned, thrown, or logged.
import "server-only";

export type RefreshAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; error: string };

/**
 * Validates a supplied refresh secret against REFRESH_SECRET.
 *
 *   * REFRESH_SECRET unset on the server -> 500 (safe, no secret leaked).
 *   * supplied secret missing or wrong    -> 401.
 *   * supplied secret matches             -> ok.
 */
export function checkRefreshSecret(provided: string | null): RefreshAuthResult {
  const expected = process.env.REFRESH_SECRET;
  if (!expected) {
    return {
      ok: false,
      status: 500,
      error: "Refresh is not configured on the server.",
    };
  }
  if (!provided || provided !== expected) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }
  return { ok: true };
}
