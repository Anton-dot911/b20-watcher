import type { RiskLevel } from "@/lib/types";
import styles from "./RiskBadge.module.css";

const LABEL: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};

export function RiskBadge({
  level,
  size = "md",
}: {
  level: RiskLevel;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`${styles.badge} ${styles[level]} ${
        size === "sm" ? styles.sm : ""
      }`}
    >
      <span className={styles.dot} />
      {LABEL[level]}
    </span>
  );
}
