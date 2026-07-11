"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { RiskBadge } from "@/components/RiskBadge";
import { CopyValue } from "@/components/CopyValue";
import type { B20Token, RiskLevel, RiskReport } from "@/lib/types";
import styles from "@/app/page.module.css";

const SCORE_COLOR: Record<RiskLevel, string> = {
  low: "var(--low)",
  moderate: "var(--moderate)",
  high: "var(--high)",
  critical: "var(--critical)",
};

type Row = { token: B20Token; report: RiskReport | null };

interface TokenSearchTableProps {
  rows: Row[];
}

function formatUtc(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function searchableText(row: Row): string {
  const { token, report } = row;
  return [
    token.name,
    token.symbol,
    token.address,
    report?.level,
    report?.score,
    report?.summary,
    ...(report?.flags.map((flag) => flag.title) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function TokenSearchTable({ rows }: TokenSearchTableProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter((row) => searchableText(row).includes(normalizedQuery));
  }, [normalizedQuery, rows]);

  if (rows.length === 0) {
    return (
      <div className={styles.emptyState}>
        <strong>No cached B20 tokens yet.</strong>
        <span>
          Run the Refresh B20 Cache workflow. In live cached mode, this page
          reads from Supabase and does not trigger refreshes itself.
        </span>
      </div>
    );
  }

  return (
    <>
      <div className={styles.tableControls}>
        <label className={styles.searchBox}>
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, symbol, address, risk level…"
            className={styles.searchInput}
          />
        </label>
        <div className={styles.searchMeta}>
          {filteredRows.length} of {rows.length} shown
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className={styles.clearButton}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>No matching tokens.</strong>
          <span>Try a token symbol, address fragment, or risk level.</span>
        </div>
      ) : (
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Address</th>
                <th>Events</th>
                <th>Risk score</th>
                <th>Level</th>
                <th>Generated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ token, report }) => (
                <tr key={token.address} className={styles.row}>
                  <td>
                    <div className={styles.tokenName}>{token.name || "Unnamed B20"}</div>
                    <div className={styles.tokenSymbol}>{token.symbol || "—"}</div>
                  </td>
                  <td>
                    <CopyValue
                      value={token.address}
                      label="token address"
                      compact
                      className={`mono ${styles.addr}`}
                    />
                  </td>
                  <td>
                    <span className={styles.count}>
                      {report ? report.stats.totalEvents : "—"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.scoreCell}>
                      {report ? (
                        <>
                          <span
                            className={styles.scoreNum}
                            style={{ color: SCORE_COLOR[report.level] }}
                          >
                            {report.score}
                          </span>
                          <span className={styles.count}>/ 100</span>
                        </>
                      ) : (
                        <span className={styles.count}>unavailable</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {report ? (
                      <RiskBadge level={report.level} size="sm" />
                    ) : (
                      <span className={styles.count}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={styles.count}>
                      {report ? formatUtc(report.generatedAt) : "—"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      href={`/tokens/${token.address}`}
                      className={styles.viewLink}
                    >
                      View report
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
