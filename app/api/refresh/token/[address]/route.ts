import { NextResponse } from "next/server";

import { normalizeAddress } from "@/lib/address";
import { checkRefreshSecret } from "@/lib/refresh-auth";
import { refreshTokenRisk } from "@/lib/refresh";

export const dynamic = "force-dynamic";

// POST /api/refresh/token/[address]
// Refreshes a single token: pulls its event timeline from CDP SQL and rebuilds
// its cached risk report in Supabase.
//
// Auth: requires the `x-refresh-secret` header to match REFRESH_SECRET.
//   401 — header missing or wrong.
//   400 — the address is not a valid 20-byte hex address.
//   500 — REFRESH_SECRET not configured on the server, or the refresh failed.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const auth = checkRefreshSecret(request.headers.get("x-refresh-secret"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { address } = await params;
  const normalized = normalizeAddress(address);
  if (!normalized) {
    return NextResponse.json(
      { error: "Invalid token address." },
      { status: 400 }
    );
  }

  try {
    const result = await refreshTokenRisk(normalized);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`POST /api/refresh/token/${normalized} failed:`, error);
    return NextResponse.json(
      { error: "Refresh failed. Check CDP and Supabase configuration." },
      { status: 500 }
    );
  }
}
