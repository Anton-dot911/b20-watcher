"use client";

import { useState } from "react";

interface CopyValueProps {
  value: string;
  label?: string;
  className?: string;
  compact?: boolean;
}

function shortenValue(value: string, compact = false): string {
  const start = compact ? 6 : 10;
  const end = compact ? 6 : 8;

  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

export function CopyValue({
  value,
  label = "value",
  className,
  compact = false,
}: CopyValueProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className={className} title={value}>
      <span>{shortenValue(value, compact)}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="copy-value-button"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
