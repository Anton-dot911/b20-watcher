import { NextResponse } from "next/server";

import { B20_NETWORK, MOCK_MODE } from "@/lib/config";
import { getB20RiskReport, listB20Tokens } from "@/lib/data-source";

export const dynamic = "force-dynamic";

// GET /api/tokens
// Returns the list of tracked B20 tokens with a lightweight risk summary each.
export async function GET() {
  try {
    const tokens = await listB20Tokens();

    const withRisk = await Promise.all(
      tokens.map(async (token) => {
        let score = 0;
        let level: string = "low";
        let eventCount = token.events.length;
        try {
          const report = await getB20RiskReport(token.address);
          score = report.score;
          level = report.level;
          eventCount = report.stats.totalEvents;
        } catch {
          // Keep the token in the list even if its report cannot be built.
        }
        return {
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          variant: token.variant,
          createdAt: token.createdAt,
          eventCount,
          score,
          level,
        };
      })
    );

    return NextResponse.json({
      mockMode: MOCK_MODE,
      network: B20_NETWORK,
      count: withRisk.length,
      tokens: withRisk,
    });
  } catch (error) {
    console.error("GET /api/tokens failed:", error);
    return NextResponse.json(
      { error: "Failed to load B20 tokens from the data source." },
      { status: 502 }
    );
  }
}
