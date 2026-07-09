import { NextResponse } from "next/server";

import { normalizeAddress } from "@/lib/address";
import { B20_NETWORK, MOCK_MODE } from "@/lib/config";
import { getB20RiskReport, getB20Token } from "@/lib/data-source";

export const dynamic = "force-dynamic";

// GET /api/risk/[address]
// Returns the full issuer-control risk report for a single token address.
//
// Responses:
//   400 — the address is not a valid 20-byte hex address.
//   502 — the live CDP SQL data source failed (missing token, upstream error).
//   200 — a risk report. For a valid address that is not a known B20 token (or
//         has no matched events) this is a valid EMPTY report (score 0), not a
//         404 — this keeps mock and live behavior uniform.
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

  try {
    const [token, report] = await Promise.all([
      getB20Token(normalized),
      getB20RiskReport(normalized),
    ]);

    return NextResponse.json({
      mockMode: MOCK_MODE,
      network: B20_NETWORK,
      token: token
        ? {
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
            variant: token.variant,
            createdAt: token.createdAt,
          }
        : null,
      report,
    });
  } catch (error) {
    console.error(`GET /api/risk/${normalized} failed:`, error);
    return NextResponse.json(
      { error: "Failed to load the risk report from the data source." },
      { status: 502 }
    );
  }
}
