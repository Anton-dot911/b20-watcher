import Link from "next/link";

import { RiskBadge } from "@/components/RiskBadge";
import { shortenAddress } from "@/lib/address";
import { getMockTokens } from "@/lib/mock-data";
import { buildRiskReport } from "@/lib/risk";
import type { RiskLevel } from "@/lib/types";
import styles from "./page.module.css";

const SCORE_COLOR: Record<RiskLevel, string> = {
  low: "var(--low)",
  moderate: "var(--moderate)",
  high: "var(--high)",
  critical: "var(--critical)",
};

export default function HomePage() {
  const tokens = getMockTokens().map((token) => {
    const report = buildRiskReport(token.address, token.events);
    return { token, report };
  });

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
            <span className={styles.count}>{tokens.length} tracked</span>
          </div>
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
                {tokens.map(({ token, report }) => (
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
                        <span
                          className={styles.scoreNum}
                          style={{ color: SCORE_COLOR[report.level] }}
                        >
                          {report.score}
                        </span>
                        <span className={styles.count}>/ 100</span>
                      </div>
                    </td>
                    <td>
                      <RiskBadge level={report.level} size="sm" />
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
        </div>
      </section>
    </div>
  );
}
