import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyValue } from "@/components/CopyValue";
import { RiskBadge } from "@/components/RiskBadge";
import { B20_NETWORK, dataModeLabel } from "@/lib/config";
import { getB20RiskReport, getB20Token } from "@/lib/data-source";
import {
  formatEventNumber,
  presentEvent,
  type PresentedEventArg,
} from "@/lib/event-presentation";
import {
  explainRiskScore,
  formatScoreReason,
} from "@/lib/score-explanation";
import type { B20Event, RiskLevel, RiskSeverity } from "@/lib/types";
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

function networkLabel(): string {
  return B20_NETWORK === "base_sepolia" ? "Base Sepolia" : "Base";
}

function formatEventValue(arg: PresentedEventArg) {
  if (arg.kind === "unknown") {
    return (
      <span className={styles.unreadableValue}>
        {arg.key === "role" ? "Unknown role" : "Unreadable value"}
      </span>
    );
  }

  if (arg.kind === "address" || arg.kind === "hash") {
    return (
      <CopyValue
        value={String(arg.value)}
        label={arg.label.toLowerCase()}
        compact
        className={styles.copyValue}
      />
    );
  }

  if (arg.kind === "number") {
    return <span>{formatEventNumber(arg.value)}</span>;
  }

  return <span>{String(arg.value)}</span>;
}

function renderEventArgs(event: B20Event) {
  const presented = presentEvent(event);

  if (presented.args.length === 0) {
    return <span>No decoded args</span>;
  }

  return presented.args.map((arg) => (
    <span key={arg.key} className={styles.argItem}>
      <span className={styles.argKey}>{arg.label}:</span>
      {formatEventValue(arg)}
    </span>
  ));
}

export default async function TokenReportPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const normalized = address.match(/^0x[0-9a-fA-F]{40}$/) ? address.toLowerCase() : null;
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
            <CopyValue value={token.address} label="token address" className="mono" />.
            Check the CDP/Supabase configuration, then run the refresh workflow
            again.
          </span>
        </div>
      </div>
    );
  }

  const scoreExplanation = explainRiskScore(report);

  return (
    <div className="container">
      <Link href="/" className={styles.back}>
        ← All tokens
      </Link>

      <div className={styles.header}>
        <div>
          <p className="eyebrow">B20 issuer-control report</p>
          <h1 className={styles.title}>
            {token.name || "Unnamed B20"}
            <span className={styles.symbol}>{token.symbol || "—"}</span>
          </h1>
          <div className={`mono ${styles.addr}`}>
            <CopyValue value={token.address} label="token address" />
          </div>
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

      <div className={styles.metaGrid}>
        <div>
          <span>Data source</span>
          <strong>{dataModeLabel()}</strong>
        </div>
        <div>
          <span>Network</span>
          <strong>{networkLabel()}</strong>
        </div>
        <div>
          <span>Token created</span>
          <strong>{formatDate(token.createdAt)}</strong>
        </div>
        <div>
          <span>Report generated</span>
          <strong>{formatDate(report.generatedAt)}</strong>
        </div>
      </div>

      <p className={styles.summary}>{report.summary}</p>

      <div className={styles.scoreBreakdown}>
        <div>
          <span className={styles.breakdownLabel}>Main reason</span>
          <strong>{formatScoreReason(scoreExplanation.mainReason)}</strong>
          <p>{scoreExplanation.mainReason.description}</p>
        </div>
        <div className={styles.breakdownTotal}>
          <span>Score</span>
          <strong>{scoreExplanation.score}/100</strong>
        </div>
      </div>

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
          <h2>Score breakdown</h2>
          {scoreExplanation.hasPositiveReasons ? (
            <>
              {scoreExplanation.reasons.map((reason) => (
                <div key={reason.title} className={styles.breakdownItem}>
                  <div>
                    <strong>{reason.title}</strong>
                    <p>{reason.description}</p>
                  </div>
                  <span>+{reason.points}</span>
                </div>
              ))}
              <p className={styles.breakdownNote}>
                Score is the capped sum of score-bearing risk flags. Maximum displayed score is 100.
              </p>
            </>
          ) : (
            <p className={styles.mutedText}>No score-bearing flags detected.</p>
          )}
        </div>

        <div className={styles.card}>
          <h2>Risk flags</h2>
          {report.flags.length === 0 ? (
            <p className={styles.mutedText}>No risk flags detected.</p>
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
      </div>

      <div className={styles.card}>
        <h2>Active roles</h2>
        {report.activeRoles.map((role) => (
          <div key={role.role} className={styles.role}>
            <div>
              <div className={styles.roleName}>{role.role}</div>
              {role.holders.length > 0 && (
                <div className={styles.roleHolders}>
                  {role.holders.map((holder) => (
                    <CopyValue
                      key={holder}
                      value={holder}
                      label={`${role.role} holder`}
                      compact
                      className={styles.copyValue}
                    />
                  ))}
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

      <div className={`${styles.card} ${styles.timeline}`}>
        <div className={styles.cardHeader}>
          <h2>Event timeline</h2>
          <span>{report.timeline.length} events</span>
        </div>
        {report.timeline.length === 0 ? (
          <p className={styles.mutedText}>
            No matching B20 events observed for this token.
          </p>
        ) : (
          report.timeline.map((event, i) => {
            const presented = presentEvent(event);

            return (
              <div
                key={`${event.transactionHash}-${event.logIndex}-${i}`}
                className={styles.event}
              >
                <div className={styles.eventDot} />
                <div className={styles.eventMain}>
                  <div className={styles.eventName}>{presented.title}</div>
                  <div className={styles.eventDescription}>{presented.description}</div>
                  <div className={styles.eventMeta}>
                    {formatDate(event.timestamp)} · block{" "}
                    {event.blockNumber.toLocaleString("en-US")} · tx{" "}
                    <CopyValue
                      value={event.transactionHash}
                      label="transaction hash"
                      compact
                      className={styles.copyValue}
                    />
                  </div>
                  <div className={styles.eventArgs}>{renderEventArgs(event)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.disclaimer}>
        This report estimates issuer-control and operational risk from observed
        B20 events. Regulated tokens may intentionally use pause, freeze,
        blocklist, or supply controls. Flags describe capabilities, not intent.
        Not a price prediction or investment advice.
      </div>
    </div>
  );
}
