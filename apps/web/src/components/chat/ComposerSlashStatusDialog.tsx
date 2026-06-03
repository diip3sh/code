import type { ResolvedThreadWorkspaceState } from "@t3tools/shared/threadEnvironment";
import type { ProviderInteractionMode } from "@t3tools/contracts";
import type { ReactNode } from "react";
import type { DraftThreadEnvMode } from "../../composerDraftStore";
import {
  type ContextWindowSnapshot,
  formatContextWindowTokens,
  formatCostUsd,
} from "../../lib/contextWindow";
import type { RateLimitStatus } from "./RateLimitBanner";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { ContextWindowMeter } from "./ContextWindowMeter";

function StatusSection(props: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={props.className}>
      <h3 className="mb-2 text-xs font-medium leading-none text-muted-foreground font-sans">
        {props.title}
      </h3>
      {props.children}
    </section>
  );
}

function StatusField(props: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-baseline gap-3 py-1">
      <dt className="text-xs leading-5 text-muted-foreground">{props.label}</dt>
      <dd
        className={
          props.mono
            ? "min-w-0 font-mono text-[0.8125rem] leading-5 tabular-nums text-foreground"
            : "min-w-0 truncate text-[0.8125rem] font-medium leading-5 text-foreground"
        }
      >
        {props.value}
      </dd>
    </div>
  );
}

function formatRateLimitMessage(rateLimitStatus: RateLimitStatus): string {
  const resetSuffix = rateLimitStatus.resetsAt
    ? ` Resets at ${new Date(rateLimitStatus.resetsAt).toLocaleTimeString()}.`
    : "";
  if (rateLimitStatus.status === "rejected") {
    return `Rate limit reached.${resetSuffix}`;
  }
  const utilizationSuffix =
    typeof rateLimitStatus.utilization === "number"
      ? ` (${Math.round(rateLimitStatus.utilization * 100)}% used)`
      : "";
  return `Approaching rate limit${utilizationSuffix}.${resetSuffix}`;
}

function formatEnvironmentLabel(
  envMode: DraftThreadEnvMode,
  envState: ResolvedThreadWorkspaceState,
): string {
  if (envMode === "local") {
    return "Local";
  }
  return envState === "worktree-pending" ? "New worktree (pending)" : "Worktree";
}

export function ComposerSlashStatusDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModel: string | null | undefined;
  fastModeEnabled: boolean;
  selectedPromptEffort: string | null;
  interactionMode: ProviderInteractionMode;
  envMode: DraftThreadEnvMode;
  envState: ResolvedThreadWorkspaceState;
  branch: string | null;
  contextWindow: ContextWindowSnapshot | null;
  cumulativeCostUsd: number | null;
  rateLimitStatus: RateLimitStatus | null;
  activeContextWindowLabel?: string | null;
  pendingContextWindowLabel?: string | null;
}) {
  const {
    open,
    onOpenChange,
    selectedModel,
    fastModeEnabled,
    selectedPromptEffort,
    interactionMode,
    envMode,
    envState,
    branch,
    contextWindow,
    cumulativeCostUsd,
    rateLimitStatus,
    activeContextWindowLabel,
    pendingContextWindowLabel,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-[30rem] rounded-xl">
        <DialogHeader className="gap-1 px-4 pb-2 pt-4">
          <DialogTitle className="text-base leading-6">Session status</DialogTitle>
          <DialogDescription className="max-w-[32rem] text-xs leading-5">
            Runtime controls and thread state for this composer.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4 px-4 pb-4 pt-1">
          <StatusSection title="Runtime">
            <dl className="grid gap-x-5 rounded-md border border-border/50 bg-muted/15 px-3 py-2 sm:grid-cols-2">
              <StatusField label="Model" value={selectedModel ?? "Unknown"} />
              <StatusField label="Fast mode" value={fastModeEnabled ? "On" : "Off"} />
              <StatusField label="Reasoning" value={selectedPromptEffort ?? "Default"} />
              <StatusField label="Mode" value={interactionMode === "plan" ? "Plan" : "Default"} />
              <StatusField label="Environment" value={formatEnvironmentLabel(envMode, envState)} />
              <StatusField label="Branch" value={branch ?? "Unknown"} />
            </dl>
          </StatusSection>

          <StatusSection title="Context window">
            <div className="rounded-md border border-border/50 bg-card px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Latest usage from the active thread.
                  </p>
                  {pendingContextWindowLabel ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      Current: {activeContextWindowLabel ?? "Unknown"}. Next:{" "}
                      {pendingContextWindowLabel}.
                    </p>
                  ) : null}
                </div>
                {contextWindow ? (
                  <ContextWindowMeter
                    usage={contextWindow}
                    cumulativeCostUsd={cumulativeCostUsd}
                    activeWindowLabel={activeContextWindowLabel}
                    pendingWindowLabel={pendingContextWindowLabel}
                  />
                ) : null}
              </div>
              {contextWindow ? (
                <dl className="mt-2 grid gap-x-5 border-t border-border/40 pt-2 sm:grid-cols-2">
                  <StatusField
                    label="Used"
                    mono
                    value={formatContextWindowTokens(contextWindow.usedTokens)}
                  />
                  <StatusField
                    label="Remaining"
                    mono
                    value={formatContextWindowTokens(contextWindow.remainingTokens)}
                  />
                  <StatusField
                    label="Window"
                    mono
                    value={formatContextWindowTokens(contextWindow.maxTokens)}
                  />
                  <StatusField
                    label="Cost"
                    mono={cumulativeCostUsd !== null}
                    value={
                      cumulativeCostUsd !== null
                        ? formatCostUsd(cumulativeCostUsd)
                        : "Not available"
                    }
                  />
                </dl>
              ) : (
                <p className="mt-2 border-t border-border/40 pt-2 text-xs leading-5 text-muted-foreground">
                  Context usage has not been reported yet.
                </p>
              )}
            </div>
          </StatusSection>

          <StatusSection title="Rate limits">
            <div className="rounded-md border border-border/50 bg-card px-3 py-2.5">
              {rateLimitStatus ? (
                <p className="text-[0.8125rem] leading-5 text-foreground">
                  {formatRateLimitMessage(rateLimitStatus)}
                </p>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">
                  No active warning for this thread.
                </p>
              )}
            </div>
          </StatusSection>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
