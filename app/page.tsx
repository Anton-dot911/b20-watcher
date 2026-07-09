import Link from "next/link";

import { RiskBadge } from "@/components/RiskBadge";
import { shortenAddress } from "@/lib/address";
import { dataModeLabel, MOCK_MODE } from "@/lib/config";
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

  return (
    <div className="container">
      <section className={styles.hero}>
        <p className="eyebrow">Base B20 · Issuer-control intelligence</p>
        <h1 className={styles.hero__title}>
          Know who controls a B20 token before you trust it.
        </h1>
        <p className={styles.hero__tagline}>
          B20 Watcher tracks Base B20 native tokens and scores issuer-control
          risk from on-chain role, policy, pause, and supply events — so you can
          see who holds the keys.
        </p>
      </section>

      <section className="section">
        <div className={styles.tableCard}>
          <div className={styles.tableHead}>
            <h2>Recent B20 tokens</h2>
            <span className={styles.count}>
              {loadError ? dataModeLabel() : `${rows.length} tracked`}
            </span>
          </div>

          {loadError ? (
            <div className={styles.errorState}>
              <strong>Live data unavailable.</strong>
              <span>
                The {dataModeLabel()} data source could not be reached. Check the
                CDP configuration and try again, or run in mock mode.
              </span>
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Address</th>
                    <th>Risk score</th>
                    <th>Level</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ token, report }) => (
                    <tr key={token.address} className={styles.row}>
                      <td>
                        <div className={styles.tokenName}>{token.name}</div>
                        <div className={styles.tokenSymbol}>{token.symbol}</div>
                      </td>
                      <td>
                        <span className={`mono ${styles.addr}`}>
                          {shortenAddress(token.address)}
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
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className={styles.count}>
                        No B20 tokens found{MOCK_MODE ? "." : " in the recent window."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
