// FILE: RateLimitSummaryList.tsx
// Purpose: Renders the compact rate-limit rows shared by the local popover and
// the dedicated rate-limit panel.

import { useMemo } from "react";

import type { ProviderRateLimit } from "~/lib/rateLimits";
import {
  deriveVisibleRateLimitRows,
  formatRateLimitRemainingPercent,
  formatRateLimitResetTime,
} from "~/lib/rateLimits";

export function RateLimitSummaryList({
  rateLimits,
  compact = false,
}: {
  rateLimits: ReadonlyArray<ProviderRateLimit>;
  compact?: boolean;
}) {
  const rows = useMemo(() => deriveVisibleRateLimitRows(rateLimits), [rateLimits]);

  if (rows.length === 0) {
    return (
      <p className="text-[length:var(--app-font-size-chat-meta,10px)] text-muted-foreground">
        No rate limit data yet.
      </p>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <div
          key={row.id}
          className={
            compact
              ? "grid grid-cols-[1fr_auto_auto] items-baseline gap-x-2 text-[11px]"
              : "flex items-center justify-between text-[length:var(--app-font-size-chat,12px)]"
          }
        >
          <span className="font-medium text-foreground">{row.label}</span>
          <span className="tabular-nums text-[length:var(--app-font-size-chat-meta,10px)] text-foreground">
            {formatRateLimitRemainingPercent(row.remainingPercent)}
          </span>
          {row.resetsAt ? (
            <span className="min-w-10 text-right tabular-nums text-[length:var(--app-font-size-chat-meta,10px)] text-muted-foreground">
              {formatRateLimitResetTime(row.resetsAt)}
            </span>
          ) : compact ? (
            <span className="min-w-10" />
          ) : null}
        </div>
      ))}
    </>
  );
}
