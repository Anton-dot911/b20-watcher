import { NextResponse } from "next/server";

import { getHealthSnapshot } from "@/lib/health";

export const dynamic = "force-dynamic";

// GET /api/health
// Secret-free health endpoint for deployment smoke checks.
export function GET() {
  return NextResponse.json(getHealthSnapshot());
}
