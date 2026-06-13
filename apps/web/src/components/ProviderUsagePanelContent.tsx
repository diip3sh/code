// FILE: ProviderUsagePanelContent.tsx
// Purpose: Render a provider usage summary panel that can show both classic
// rate-limit rows and archive-derived local usage lines in the same popover.

import type { ProviderKind } from "@t3tools/contracts";
import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";

import { ExternalLinkIcon } from "~/lib/icons";
import type { OpenUsageUsageLine } from "~/lib/openUsageRateLimits";
import {
  deriveProviderUsageLearnMoreHref,
  deriveRateLimitLearnMoreHref,
  deriveVisibleRateLimitRows,
  type ProviderRateLimit,
} from "~/lib/rateLimits";
import { cn } from "~/lib/utils";

import { RateLimitSummaryList } from "./RateLimitSummaryList";

export function providerUsageLabel(provider: ProviderKind | null | undefined): string {
  if (provider === "codex") return "Codex usage";
  if (provider === "claudeAgent") return "Claude usage";
  if (provider === "gemini") return "Gemini usage";
  return "Usage";
}

export const ProviderUsagePanelContent = memo(function ProviderUsagePanelContent(props: {
  provider: ProviderKind | null | undefined;
  rateLimits: ReadonlyArray<ProviderRateLimit>;
  usageLines?: ReadonlyArray<OpenUsageUsageLine> | undefined;
  isLoading?: boolean | undefined;
  learnMoreHref?: string | null | undefined;
  showTitle?: boolean | undefined;
  compact?: boolean | undefined;
  className?: string | undefined;
}) {
  const visibleRows = useMemo(
    () => deriveVisibleRateLimitRows(props.rateLimits),
    [props.rateLimits],
  );
  const learnMoreHref = useMemo(
    () =>
      props.learnMoreHref ??
      deriveRateLimitLearnMoreHref(props.rateLimits) ??
      deriveProviderUsageLearnMoreHref(props.provider),
    [props.learnMoreHref, props.provider, props.rateLimits],
  );
  const usageLines = props.usageLines ?? [];
  const [selectedUsageLabel, setSelectedUsageLabel] = useState(usageLines.at(-1)?.label ?? "");
  const selectedUsageLine =
    usageLines.find((line) => line.label === selectedUsageLabel) ?? usageLines.at(-1) ?? null;

  useEffect(() => {
    if (usageLines.some((line) => line.label === selectedUsageLabel)) {
      return;
    }
    setSelectedUsageLabel(usageLines.at(-1)?.label ?? "");
  }, [selectedUsageLabel, usageLines]);

  return (
    <div className={cn("space-y-2", props.className)}>
      {props.showTitle !== false ? (
        <div className="text-[length:var(--app-font-size-chat-meta,10px)] font-medium text-muted-foreground">
          {providerUsageLabel(props.provider)}
        </div>
      ) : null}
      {visibleRows.length > 0 ? (
        <RateLimitSummaryList rateLimits={props.rateLimits} compact={props.compact === true} />
      ) : null}
      {props.compact && usageLines.length > 0 && selectedUsageLine ? (
        <div className="space-y-1.5">
          <div
            className="grid grid-cols-[repeat(var(--usage-tab-count),minmax(0,1fr))] gap-0.5 rounded-md bg-[color-mix(in_srgb,var(--color-text-foreground)_5%,transparent)] p-0.5"
            role="tablist"
            style={{ "--usage-tab-count": usageLines.length } as CSSProperties}
          >
            {usageLines.map((line) => {
              const isSelected = line.label === selectedUsageLine.label;
              return (
                <button
                  key={line.label}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={cn(
                    "rounded-[5px] px-1.5 py-1 text-[10px] font-medium transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.97] motion-reduce:transition-colors",
                    isSelected
                      ? "bg-[var(--color-background-surface-under)] text-foreground shadow-sm/10"
                      : "text-muted-foreground hover:bg-[color-mix(in_srgb,var(--color-text-foreground)_5%,transparent)] hover:text-foreground",
                  )}
                  onClick={() => setSelectedUsageLabel(line.label)}
                >
                  {line.label}
                </button>
              );
            })}
          </div>
          <div role="tabpanel" className="flex items-baseline justify-between gap-3 px-1">
            <span className="text-[10px] text-muted-foreground">
              {selectedUsageLine.subtitle ?? "Recent usage"}
            </span>
            <span className="tabular-nums text-[11px] font-medium text-foreground">
              {selectedUsageLine.value}
            </span>
          </div>
        </div>
      ) : usageLines.length > 0 ? (
        <div className={cn(props.compact ? "space-y-1" : "space-y-1.5")}>
          {usageLines.map((line) => (
            <div
              key={`${line.label}:${line.value}`}
              className={cn(
                "space-y-0.5",
                props.compact ? "text-[11px]" : "text-[length:var(--app-font-size-chat,12px)]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{line.label}</span>
                <span className="text-right text-[length:var(--app-font-size-chat-meta,10px)] text-muted-foreground">
                  {line.value}
                </span>
              </div>
              {line.subtitle ? (
                <div className="text-[length:var(--app-font-size-chat-meta,10px)] text-muted-foreground/80">
                  {line.subtitle}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : visibleRows.length === 0 && props.isLoading ? (
        <p className="text-[length:var(--app-font-size-chat-meta,10px)] leading-relaxed text-muted-foreground">
          Scanning local usage data for the selected provider.
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="text-[length:var(--app-font-size-chat-meta,10px)] leading-relaxed text-muted-foreground">
          {props.provider
            ? "No local usage data was found yet for the selected provider."
            : "No local usage data was found yet."}
        </p>
      ) : null}
      {learnMoreHref ? (
        <a
          href={learnMoreHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 pt-0.5 text-[length:var(--app-font-size-chat-meta,10px)] text-muted-foreground transition-colors hover:text-foreground"
        >
          Learn more
          <ExternalLinkIcon className="size-3" />
        </a>
      ) : null}
    </div>
  );
});
