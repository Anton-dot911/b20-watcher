import { NextResponse } from "next/server";

import { normalizeAddress } from "@/lib/address";
import { MOCK_MODE } from "@/lib/config";
import { getMockToken } from "@/lib/mock-data";
import { buildRiskReport } from "@/lib/risk";

// GET /api/risk/[address]
// Returns the full issuer-control risk report for a single token address.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const normalized = normalizeAddress(address);

  if (!normalized) {
    return NextResponse.json(
      { error: "Invalid token address." },
      { status: 400 }
    );
  }

  const token = getMockToken(normalized);
  if (!token) {
    return NextResponse.json(
      { error: "Token not found." },
      { status: 404 }
    );
  }

  const report = buildRiskReport(token.address, token.events);

  return NextResponse.json({
    mockMode: MOCK_MODE,
    token: {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      variant: token.variant,
      createdAt: token.createdAt,
    },
    report,
  });
}
