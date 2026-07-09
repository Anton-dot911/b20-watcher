import { NextResponse } from "next/server";

import { checkRefreshSecret } from "@/lib/refresh-auth";
import { DEFAULT_REFRESH_LIMIT, refreshRecentB20Tokens } from "@/lib/refresh";

export const dynamic = "force-dynamic";

// POST /api/refresh/recent
// Discovers recent B20 tokens from CDP SQL and populates the Supabase cache
// (token snapshots, event timelines, risk reports).
//
// Auth: requires the `x-refresh-secret` header to match REFRESH_SECRET.
//   401 — header missing or wrong.
//   500 — REFRESH_SECRET not configured on the server, or the refresh failed.
//
// Body (optional JSON): { "limit": 20 }. Defaults to a conservative limit.
export async function POST(request: Request) {
  const auth = checkRefreshSecret(request.headers.get("x-refresh-secret"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let limit = DEFAULT_REFRESH_LIMIT;
  try {
    const body = (await request.json().catch(() => null)) as
      | { limit?: unknown }
      | null;
    if (body && typeof body.limit === "number") {
      limit = body.limit;
    }
  } catch {
    // Ignore malformed bodies; fall back to the default limit.
  }

  try {
    const result = await refreshRecentB20Tokens(limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/refresh/recent failed:", error);
    return NextResponse.json(
      { error: "Refresh failed. Check CDP and Supabase configuration." },
      { status: 500 }
    );
  }
}
