import { NextResponse } from "next/server";

import { MOCK_MODE } from "@/lib/config";
import { getMockTokens } from "@/lib/mock-data";
import { buildRiskReport } from "@/lib/risk";

// GET /api/tokens
// Returns the list of tracked B20 tokens with a lightweight risk summary each.
export function GET() {
  const tokens = getMockTokens().map((token) => {
    const report = buildRiskReport(token.address, token.events);
    return {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      variant: token.variant,
      createdAt: token.createdAt,
      eventCount: token.events.length,
      score: report.score,
      level: report.level,
    };
  });

  return NextResponse.json({
    mockMode: MOCK_MODE,
    count: tokens.length,
    tokens,
  });
}
