import { NextResponse } from "next/server";

import { runRefreshDiagnostics } from "@/lib/diagnostics";
import { checkRefreshSecret } from "@/lib/refresh-auth";

export const dynamic = "force-dynamic";

// POST /api/diagnostics
// Protected by the same x-refresh-secret as the refresh endpoints.
// Returns secret-free CDP/Supabase diagnostics to explain empty refresh results.
export async function POST(request: Request) {
  const auth = checkRefreshSecret(request.headers.get("x-refresh-secret"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | { limit?: unknown }
    | null;

  const diagnostics = await runRefreshDiagnostics(body?.limit ?? 5);
  return NextResponse.json(diagnostics, { status: diagnostics.ok ? 200 : 207 });
}
