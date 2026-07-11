import Link from "next/link";

import { RiskBadge } from "@/components/RiskBadge";
import { shortenAddress } from "@/lib/address";
import { B20_NETWORK, dataModeLabel, MOCK_MODE } from "@/lib/config";
import { getB20RiskReport, listB20Tokens } from "@/lib/data-source";
import type { B20Token, RiskLevel, RiskReport } from "@/lib/types";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const SCORE_COLOR: Record<RiskLevel, string> = {
  low: "var(--low)",
  moderate: "var(--moderate)",
  high: "var(--high)",
  critical: "var(--critical)",
};

type Row = { token: B20Token; report: RiskReport | null };

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

function networkLabel(): string {
  return B20_NETWORK === "base_sepolia" ? "Base Sepolia" : "Base";
}

export default async function HomePage() {
  let rows: Row[] = [];
  let loadError = false;

  try {
    const tokens = await listB20Tokens();
    rows = await Promise.all(
      tokens.map(async (token) => {
        try {
          return { token, report: await getB20RiskReport(token.address) };
        } catch {
          return { token, report: null };
        }
      })
    );
  } catch {
    loadError = true;
  }

  const reports = rows.flatMap((row) => (row.report ? [row.report] : []));
  const totalEvents = reports.reduce(
    (sum, report) => sum + report.stats.totalEvents,
    0
  );
  const lastGeneratedAt = reports
    .map((report) => report.generatedAt)
    .sort()
    .at(-1);

  return (
    <div className="container">
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div>
            <p className="eyebrow">Base B20 · Issuer-control intelligence</p>
            <h1 className={styles.hero__title}>
              Know who controls a B20 token before you trust it.
            </h1>
            <p className={styles.hero__tagline}>
              B20 Watcher tracks Base B20 native tokens and scores issuer-control
              risk from on-chain role, policy, pause, and supply events — so you
              can see who holds the keys.
            </p>
          </div>

          <div className={styles.livePanel}>
            <div className={styles.livePanel__label}>Live cache status</div>
            <div className={styles.livePanel__mode}>{dataModeLabel()}</div>
            <div className={styles.livePanel__meta}>
              Network: {networkLabel()}
              <br />
              Last report: {lastGeneratedAt ? formatUtc(lastGeneratedAt) : "not yet"}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.statusGrid} aria-label="B20 cache summary">
        <div className={styles.statusCard}>
          <span>Tracked tokens</span>
          <strong>{loadError ? "—" : rows.length}</strong>
        </div>
        <div className={styles.statusCard}>
          <span>Risk reports</span>
          <strong>{loadError ? "—" : reports.length}</strong>
        </div>
        <div className={styles.statusCard}>
          <span>Events cached</span>
          <strong>{loadError ? "—" : totalEvents}</strong>
        </div>
        <div className={styles.statusCard}>
          <span>Data mode</span>
          <strong>{MOCK_MODE ? "Mock" : "Live"}</strong>
        </div>
      </section>

      <section className="section">
        <div className={styles.tableCard}>
          <div className={styles.tableHead}>
            <div>
              <h2>Recent B20 tokens</h2>
              <p>
                Cached token snapshots and generated issuer-control risk reports.
              </p>
            </div>
            <span className={styles.count}>
              {loadError ? dataModeLabel() : `${rows.length} tracked`}
            </span>
          </div>

          {loadError ? (
            <div className={styles.errorState}>
              <strong>Live data unavailable.</strong>
              <span>
                The {dataModeLabel()} data source could not be reached. Check the
                CDP/Supabase configuration, then run the refresh workflow again.
              </span>
            </div>
          ) : rows.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>No cached B20 tokens yet.</strong>
              <span>
                Run the Refresh B20 Cache workflow. In live cached mode, this page
                reads from Supabase and does not trigger refreshes itself.
              </span>
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
                  {rows.map(({ token, report }) => (
                    <tr key={token.address} className={styles.row}>
                      <td>
                        <div className={styles.tokenName}>{token.name || "Unnamed B20"}</div>
                        <div className={styles.tokenSymbol}>{token.symbol || "—"}</div>
                      </td>
                      <td>
                        <span className={`mono ${styles.addr}`}>
                          {shortenAddress(token.address)}
                        </span>
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
        </div>
      </section>
    </div>
  );
}
