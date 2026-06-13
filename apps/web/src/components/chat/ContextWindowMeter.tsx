import {
  type ContextWindowSnapshot,
  deriveContextWindowMeterDisplay,
  formatContextWindowTokens,
  formatCostUsd,
} from "~/lib/contextWindow";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";

export function ContextWindowMeter(props: {
  usage: ContextWindowSnapshot;
  cumulativeCostUsd?: number | null | undefined;
  activeWindowLabel?: string | null | undefined;
  pendingWindowLabel?: string | null | undefined;
}) {
  const { usage, cumulativeCostUsd, activeWindowLabel, pendingWindowLabel } = props;
  const display = deriveContextWindowMeterDisplay(usage);
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (display.normalizedPercentage / 100) * circumference;

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={0}
        render={
          <button
            type="button"
            className="group inline-flex items-center gap-1.5 rounded-full px-1 py-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            aria-label={display.ariaLabel}
          >
            <span className="relative flex h-3.5 w-3.5 items-center justify-center">
              <svg
                viewBox="0 0 16 16"
                className="-rotate-90 absolute inset-0 h-full w-full transform-gpu"
                aria-hidden="true"
              >
                <circle
                  cx="8"
                  cy="8"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  opacity="0.2"
                />
                <circle
                  cx="8"
                  cy="8"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
                />
              </svg>
            </span>
            <span className="tabular-nums font-medium leading-none">{display.compactLabel}</span>
          </button>
        }
      />
      <PopoverPopup
        tooltipStyle
        side="top"
        align="end"
        sideOffset={8}
        className="w-56 max-w-[calc(100vw-1rem)] rounded-lg px-2.5 py-2 shadow-lg/10"
      >
        <div className="space-y-1.5 leading-tight">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-medium text-muted-foreground">Context window</div>
            {display.usedPercentageLabel ? (
              <div className="tabular-nums text-xs font-semibold text-foreground">
                {display.usedPercentageLabel}
              </div>
            ) : null}
          </div>
          {display.usedPercentageLabel ? (
            <div className="h-1 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
              <div
                className="h-full rounded-full bg-foreground/55 transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${display.normalizedPercentage}%` }}
              />
            </div>
          ) : null}
          {pendingWindowLabel ? (
            <div className="text-[11px] text-muted-foreground">
              Current session: {activeWindowLabel ?? "Unknown"}
            </div>
          ) : null}
          {display.usedPercentageLabel ? (
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-muted-foreground">Tokens used</span>
              {display.hasReliableTokenRatio ? (
                <span className="tabular-nums font-medium text-foreground">
                  {display.tokenUsageLabel} / {formatContextWindowTokens(usage.maxTokens)}
                </span>
              ) : (
                <span className="tabular-nums font-medium text-foreground">
                  {display.tokenUsageLabel}
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs font-medium text-foreground">
              {display.tokenUsageLabel} tokens used so far
            </div>
          )}
          {pendingWindowLabel ? (
            <div className="text-[11px] text-muted-foreground">Next turn: {pendingWindowLabel}</div>
          ) : null}
          {(usage.totalProcessedTokens ?? null) !== null &&
          (usage.totalProcessedTokens ?? 0) > usage.usedTokens ? (
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>Total processed</span>
              <span className="tabular-nums text-foreground">
                {formatContextWindowTokens(usage.totalProcessedTokens ?? null)} tokens
              </span>
            </div>
          ) : null}
          {cumulativeCostUsd !== null && cumulativeCostUsd !== undefined ? (
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>Session cost</span>
              <span className="tabular-nums text-foreground">
                {formatCostUsd(cumulativeCostUsd)}
              </span>
            </div>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
