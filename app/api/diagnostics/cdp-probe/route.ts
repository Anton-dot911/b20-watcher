import { NextResponse } from "next/server";

import { runCdpDiscoveryProbe } from "@/lib/cdp-probe";
import { checkRefreshSecret } from "@/lib/refresh-auth";

export const dynamic = "force-dynamic";

// POST /api/diagnostics/cdp-probe
// Protected by x-refresh-secret. Runs several CDP SQL probe queries to explain
// whether B20 discovery is returning zero because of address casing, event name,
// event signature, factory address, or missing indexed data.
export async function POST(request: Request) {
  const auth = checkRefreshSecret(request.headers.get("x-refresh-secret"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | { limit?: unknown }
    | null;

  const result = await runCdpDiscoveryProbe(body?.limit ?? 5);
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
