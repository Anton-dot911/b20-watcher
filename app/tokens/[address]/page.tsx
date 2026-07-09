import Link from "next/link";
import { notFound } from "next/navigation";

import { RiskBadge } from "@/components/RiskBadge";
import { normalizeAddress } from "@/lib/address";
import { getB20RiskReport, getB20Token } from "@/lib/data-source";
import type { RiskLevel, RiskSeverity } from "@/lib/types";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const LEVEL_COLOR: Record<RiskLevel, string> = {
  low: "var(--low)",
  moderate: "var(--moderate)",
  high: "var(--high)",
  critical: "var(--critical)",
};

const SEV_COLOR: Record<RiskSeverity, string> = {
  info: "var(--accent)",
  low: "var(--low)",
  moderate: "var(--moderate)",
  high: "var(--high)",
  critical: "var(--critical)",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export default async function TokenReportPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const normalized = normalizeAddress(address);
  if (!normalized) notFound();

  const token = await getB20Token(normalized);
  if (!token) notFound();

  let report;
  try {
    report = await getB20RiskReport(normalized);
  } catch {
    report = null;
  }

  if (!report) {
    return (
      <div className="container">
        <Link href="/" className={styles.back}>
          ← All tokens
        </Link>
        <div className={styles.errorState}>
          <strong>Risk report unavailable.</strong>
          <span>
            The live data source could not be reached for{" "}
            <span className="mono">{token.address}</span>. Check the CDP
            configuration and try again, or run in mock mode.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Link href="/" className={styles.back}>
        ← All tokens
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {token.name}
            <span className={styles.symbol}>{token.symbol}</span>
          </h1>
          <div className={`mono ${styles.addr}`}>{token.address}</div>
        </div>
        <div className={styles.scorePanel}>
          <div>
            <span
              className={styles.scoreValue}
              style={{ color: LEVEL_COLOR[report.level] }}
            >
              {report.score}
            </span>
            <span className={styles.scoreMax}> / 100</span>
          </div>
          <RiskBadge level={report.level} />
        </div>
      </div>

      <p className={styles.summary}>{report.summary}</p>

      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{report.stats.totalEvents}</div>
          <div className={styles.statLabel}>Events observed</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{report.stats.activeRoleCount}</div>
          <div className={styles.statLabel}>Active roles</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{report.stats.flagCount}</div>
          <div className={styles.statLabel}>Risk flags</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>
            {report.stats.paused ? "Yes" : "No"}
          </div>
          <div className={styles.statLabel}>Currently paused</div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2>Risk flags</h2>
          {report.flags.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>
              No risk flags detected.
            </p>
          ) : (
            report.flags.map((flag) => (
              <div key={flag.id} className={styles.flag}>
                <div
                  className={styles.flagBar}
                  style={{ background: SEV_COLOR[flag.severity] }}
                />
                <div className={styles.flagBody}>
                  <div className={styles.flagTop}>
                    <div className={styles.flagTitle}>
                      {flag.title}
                      <span
                        className={styles.sev}
                        style={{
                          color: SEV_COLOR[flag.severity],
                          background: `color-mix(in srgb, ${
                            SEV_COLOR[flag.severity]
                          } 14%, transparent)`,
                        }}
                      >
                        {flag.severity}
                      </span>
                    </div>
                    <span className={styles.flagPoints}>
                      {flag.points > 0 ? `+${flag.points}` : "0"}
                    </span>
                  </div>
                  <div className={styles.flagDesc}>{flag.description}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.card}>
          <h2>Active roles</h2>
          {report.activeRoles.map((role) => (
            <div key={role.role} className={styles.role}>
              <div>
                <div className={styles.roleName}>{role.role}</div>
                {role.holders.length > 0 && (
                  <div className={styles.roleHolders}>
                    {role.holders.join(", ")}
                  </div>
                )}
              </div>
              <span
                className={`${styles.pill} ${
                  role.active ? styles.pillActive : styles.pillInactive
                }`}
              >
                {role.active ? "Active" : "None"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={`${styles.card} ${styles.timeline}`}>
        <h2>Event timeline</h2>
        {report.timeline.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>
            No matching B20 events observed for this token.
          </p>
        ) : (
          report.timeline.map((event, i) => (
            <div
              key={`${event.transactionHash}-${event.logIndex}-${i}`}
              className={styles.event}
            >
              <div className={styles.eventDot} />
              <div className={styles.eventMain}>
                <div className={styles.eventName}>{event.name}</div>
                <div className={styles.eventMeta}>
                  {formatDate(event.timestamp)} · block{" "}
                  {event.blockNumber.toLocaleString("en-US")}
                </div>
                <div className={styles.eventArgs}>
                  {Object.entries(event.args)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("  ·  ")}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles.disclaimer}>
        This score estimates issuer-control and operational risk from observed
        events. Regulated tokens may intentionally use pause, freeze, blocklist,
        or supply controls — flags describe capabilities, not intent. Not a
        price prediction or investment advice. Report generated{" "}
        {formatDate(report.generatedAt)}.
      </div>
    </div>
  );
}
