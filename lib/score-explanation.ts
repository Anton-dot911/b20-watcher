import type { RiskFlag, RiskReport } from "./types";

export interface ScoreReason {
  title: string;
  points: number;
  severity: RiskFlag["severity"] | "none";
  description: string;
}

export interface ScoreExplanation {
  score: number;
  maxScore: number;
  mainReason: ScoreReason;
  reasons: ScoreReason[];
  hasPositiveReasons: boolean;
}

const NO_FLAGS_REASON: ScoreReason = {
  title: "No score-bearing flags",
  points: 0,
  severity: "none",
  description: "No issuer-control risk flags were detected from the observed B20 events.",
};

function compareReasons(a: ScoreReason, b: ScoreReason): number {
  if (b.points !== a.points) return b.points - a.points;
  return a.title.localeCompare(b.title);
}

export function explainRiskScore(report: RiskReport): ScoreExplanation {
  const reasons = report.flags
    .filter((flag) => flag.points > 0)
    .map((flag) => ({
      title: flag.title,
      points: flag.points,
      severity: flag.severity,
      description: flag.description,
    }))
    .sort(compareReasons);

  const mainReason = reasons[0] ?? NO_FLAGS_REASON;

  return {
    score: report.score,
    maxScore: 100,
    mainReason,
    reasons,
    hasPositiveReasons: reasons.length > 0,
  };
}

export function formatScoreReason(reason: ScoreReason): string {
  return reason.points > 0
    ? `${reason.title} +${reason.points}`
    : reason.title;
}
