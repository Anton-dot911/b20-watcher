import { NextResponse } from "next/server";

import { checkRefreshSecret } from "@/lib/refresh-auth";
import { DEFAULT_REFRESH_LIMIT, refreshRecentB20Tokens } from "@/lib/refresh";

export const dynamic = "force-dynamic";

// POST /api/refresh/recent
// Discovers recent B20 tokens from CDP SQL and populates the Supabase cache.
// Auth: requires x-refresh-secret.
// Body: { "limit": 20 }
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
    return NextResponse.json(result, { status: result.partial ? 207 : 200 });
  } catch (error) {
    console.error("POST /api/refresh/recent failed:", error);
    return NextResponse.json({ error: "Refresh failed." }, { status: 500 });
  }
}
