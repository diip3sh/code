import { FileDiff, type FileDiffMetadata, Virtualizer } from "@pierre/diffs/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearch } from "@tanstack/react-router";
import { ThreadId, type TurnId } from "@t3tools/contracts";
import { LuWrapText } from "react-icons/lu";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DiffIcon,
  Loader2Icon,
  MinusIcon,
  PanelRightIcon,
  PanelRightCloseIcon,
  PlusIcon,
} from "~/lib/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GIT_WORKING_TREE_DIFF_LIVE_REFETCH_INTERVAL_MS,
  gitBranchesQueryOptions,
  gitQueryKeys,
  gitStatusQueryOptions,
  gitSummarizeDiffQueryOptions,
  gitUpdateIndexMutationOptions,
  gitWorkingTreeDiffQueryOptions,
} from "~/lib/gitReactQuery";
import { checkpointDiffQueryOptions } from "~/lib/providerReactQuery";
import { cn } from "~/lib/utils";
import { parseDiffRouteSearch } from "../diffRouteSearch";
import { useTheme } from "../hooks/useTheme";
import {
  buildPatchCacheKey,
  getRenderablePatch,
  resolveDiffCopyText,
  resolveDiffThemeName,
  summarizePatchStats,
} from "../lib/diffRendering";
import { resolveDiffEnvironmentState } from "../lib/threadEnvironment";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { useTurnDiffSummaries } from "../hooks/useTurnDiffSummaries";
import {
  isRepoDiffScope,
  REPO_DIFF_SCOPE_LABELS,
  useRepoDiffScopeStore,
} from "../repoDiffScopeStore";
import { useStore } from "../store";
import { createProjectSelector, createThreadSelector } from "../storeSelectors";
import { getProviderStartOptions, useAppSettings } from "../appSettings";
import { useComposerDraftStore } from "../composerDraftStore";
import { selectThreadTerminalState, useTerminalStateStore } from "../terminalStateStore";
import ChatMarkdown from "./ChatMarkdown";
import { resolveDiffPanelThread } from "./DiffPanel.logic";
import { DiffPanelLoadingState, DiffPanelShell, type DiffPanelMode } from "./DiffPanelShell";
import { Button } from "./ui/button";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "./ui/menu";
import { FileEntryIcon } from "./chat/FileEntryIcon";
import { DiffStatLabel, hasNonZeroStat } from "./chat/DiffStatLabel";
import { type SplitViewPanePanelState } from "../splitViewStore";
import { hasLiveTurnTailWork, isLatestTurnSettled } from "../session-logic";
import { IconFileDiff } from "@tabler/icons-react";

type DiffSurfaceMode = "summary" | "total";
type DiffThemeType = "light" | "dark";

function buildDiffPanelUnsafeCSS(theme: "light" | "dark"): string {
  return `
:host {
  /* Route the entire diff viewer through the chat code font so custom code fonts reach line numbers too. */
  --diffs-font-family: var(--font-chat-code-family);
  --diffs-header-font-family: var(--font-chat-code-family);
  /* Honor the user-chosen chat code font size from settings instead of the library default (13px). */
  --diffs-font-size: var(--app-font-size-chat-code, 11px);
  font-family: var(--font-chat-code-family) !important;
  font-size: var(--app-font-size-chat-code, 11px) !important;
}

[data-diffs-header],
[data-diff],
[data-file],
[data-error-wrapper],
[data-virtualizer-buffer] {
  /* Re-assert the code font inside the library chrome because these nodes live in shadow-rooted markup. */
  --diffs-font-family: var(--font-chat-code-family) !important;
  --diffs-header-font-family: var(--font-chat-code-family) !important;
  --diffs-font-size: var(--app-font-size-chat-code, 11px) !important;
  font-family: var(--font-chat-code-family) !important;
  font-size: var(--app-font-size-chat-code, 11px) !important;
  --diffs-bg: color-mix(in srgb, var(--card) 90%, var(--background)) !important;
  --diffs-light-bg: color-mix(in srgb, var(--card) 90%, var(--background)) !important;
  --diffs-dark-bg: color-mix(in srgb, var(--card) 90%, var(--background)) !important;
  --diffs-token-light-bg: transparent;
  --diffs-token-dark-bg: transparent;

  --diffs-bg-context-override: color-mix(in srgb, var(--background) 97%, var(--foreground));
  --diffs-bg-hover-override: color-mix(in srgb, var(--background) 94%, var(--foreground));
  --diffs-bg-separator-override: color-mix(in srgb, var(--background) 95%, var(--foreground));
  --diffs-bg-buffer-override: color-mix(in srgb, var(--background) 90%, var(--foreground));

  --diffs-bg-addition-override: color-mix(in srgb, var(--background) 92%, var(--success));
  --diffs-bg-addition-number-override: color-mix(in srgb, var(--background) 88%, var(--success));
  --diffs-bg-addition-hover-override: color-mix(in srgb, var(--background) 85%, var(--success));
  --diffs-bg-addition-emphasis-override: color-mix(in srgb, var(--background) 80%, var(--success));

  --diffs-bg-deletion-override: color-mix(in srgb, var(--background) 92%, var(--destructive));
  --diffs-bg-deletion-number-override: color-mix(in srgb, var(--background) 88%, var(--destructive));
  --diffs-bg-deletion-hover-override: color-mix(in srgb, var(--background) 85%, var(--destructive));
  --diffs-bg-deletion-emphasis-override: color-mix(
    in srgb,
    var(--background) 80%,
    var(--destructive)
  );

  background-color: var(--diffs-bg) !important;
}

[data-file-info] {
  font-family: var(--font-chat-code-family) !important;
  font-size: var(--app-font-size-chat-code, 12px) !important;
  background-color: var(--color-background) !important;
  color: var(--color-red-500) !important;
}

[data-file-info] * {
  color: var(--color-red-500) !important;
}

[data-diffs-header] {
  position: sticky !important;
  top: 0;
  z-index: 4;
  background-color: var(--color-background) !important;
  cursor: pointer;
}

/* Hide the default change-type icon (blue circle) — replaced by chevron + file-type icon. */
[data-change-icon] {
  display: none;
}

[data-title] {
  font-family: var(--app-font-chat-code-family) !important;
  font-size: var(--app-font-size-chat-code, 11px) !important;
  font-weight: 500 !important;
  cursor: pointer;
  color: var(--color-text) !important;
}

[data-file],
[data-diff] {
  border-radius: 0.5rem 0.5rem 0 0 !important;
  overflow: hidden !important;
}

`;
}

function resolveFileDiffPath(fileDiff: FileDiffMetadata): string {
  const raw = fileDiff.name ?? fileDiff.prevName ?? "";
  if (raw.startsWith("a/") || raw.startsWith("b/")) {
    return raw.slice(2);
  }
  return raw;
}

function buildFileDiffRenderKey(fileDiff: FileDiffMetadata): string {
  return fileDiff.cacheKey ?? `${fileDiff.prevName ?? "none"}:${fileDiff.name}`;
}

function normalizeDiffActionPath(pathValue: string | null | undefined): string | null {
  if (!pathValue || pathValue === "/dev/null") {
    return null;
  }
  if (pathValue.startsWith("a/") || pathValue.startsWith("b/")) {
    return pathValue.slice(2);
  }
  return pathValue;
}

function resolveFileDiffActionPaths(fileDiff: FileDiffMetadata): string[] {
  return [
    normalizeDiffActionPath(fileDiff.prevName),
    normalizeDiffActionPath(fileDiff.name),
  ].filter((pathValue, index, paths): pathValue is string => {
    return pathValue !== null && paths.indexOf(pathValue) === index;
  });
}

interface DiffPanelProps {
  mode?: DiffPanelMode;
  threadId?: ThreadId | null;
  panelState?: Pick<SplitViewPanePanelState, "panel" | "diffTurnId" | "diffFilePath">;
  onUpdatePanelState?: (
    patch: Partial<Pick<SplitViewPanePanelState, "panel" | "diffTurnId" | "diffFilePath">>,
  ) => void;
  onClosePanel?: () => void;
  liveRefreshEnabled?: boolean;
}

export { DiffWorkerPoolProvider } from "./DiffWorkerPoolProvider";

export default function DiffPanel({
  mode = "inline",
  threadId: controlledThreadId,
  panelState,
  onUpdatePanelState,
  onClosePanel,
  liveRefreshEnabled = true,
}: DiffPanelProps) {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const { settings } = useAppSettings();
  const providerOptions = useMemo(() => getProviderStartOptions(settings), [settings]);
  const setTerminalOpen = useTerminalStateStore((store) => store.setTerminalOpen);
  const setTerminalPresentationMode = useTerminalStateStore(
    (store) => store.setTerminalPresentationMode,
  );
  const [diffWordWrap, setDiffWordWrap] = useState(settings.diffWordWrap);
  const [surfaceMode, setSurfaceMode] = useState<DiffSurfaceMode>("total");
  const repoDiffScope = useRepoDiffScopeStore((store) => store.scope);
  const setRepoDiffScope = useRepoDiffScopeStore((store) => store.setScope);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => new Set());
  const patchViewportRef = useRef<HTMLDivElement>(null);
  const previousDiffOpenRef = useRef(false);
  const routeThreadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });
  const diffSearch = useSearch({
    strict: false,
    select: (search) => parseDiffRouteSearch(search),
  });
  const diffOpen = panelState ? panelState.panel === "diff" : diffSearch.diff === "1";
  const activeThreadId = controlledThreadId ?? routeThreadId;
  const terminalOpen = useTerminalStateStore((store) =>
    activeThreadId
      ? selectThreadTerminalState(store.terminalStateByThreadId, activeThreadId).terminalOpen
      : false,
  );
  const serverThread = useStore(
    useMemo(() => createThreadSelector(activeThreadId), [activeThreadId]),
  );
  const draftThread = useComposerDraftStore((store) =>
    activeThreadId ? (store.draftThreadsByThreadId[activeThreadId] ?? null) : null,
  );
  const fallbackDraftProjectId = draftThread?.projectId ?? null;
  const fallbackDraftProject = useStore(
    useMemo(() => createProjectSelector(fallbackDraftProjectId), [fallbackDraftProjectId]),
  );
  // Keep diff summary access available for draft chats before the first turn promotes them into the server store.
  const activeThread = useMemo(
    () =>
      resolveDiffPanelThread({
        threadId: activeThreadId,
        serverThread,
        draftThread,
        fallbackModelSelection: fallbackDraftProject?.defaultModelSelection ?? null,
      }),
    [activeThreadId, draftThread, fallbackDraftProject?.defaultModelSelection, serverThread],
  );
  const activeProjectId = activeThread?.projectId ?? draftThread?.projectId ?? null;
  const activeProject = useStore(
    useMemo(() => createProjectSelector(activeProjectId), [activeProjectId]),
  );
  const resolvedThreadEnvMode =
    serverThread?.envMode ?? draftThread?.envMode ?? activeThread?.envMode;
  const resolvedThreadWorktreePath =
    serverThread?.worktreePath ?? draftThread?.worktreePath ?? activeThread?.worktreePath ?? null;
  const diffEnvironmentState = resolveDiffEnvironmentState({
    projectCwd: activeProject?.cwd ?? null,
    envMode: resolvedThreadEnvMode,
    worktreePath: resolvedThreadWorktreePath,
  });
  const diffEnvironmentPending = diffEnvironmentState.pending;
  const activeCwd = diffEnvironmentState.cwd;
  const gitBranchesQuery = useQuery(gitBranchesQueryOptions(activeCwd ?? null));
  const gitStatusQuery = useQuery(gitStatusQueryOptions(activeCwd ?? null));
  const updateIndexMutation = useMutation(
    gitUpdateIndexMutationOptions({ cwd: activeCwd ?? null, queryClient }),
  );
  const isGitRepo = gitBranchesQuery.data?.isRepo ?? true;
  const { turnDiffSummaries, inferredCheckpointTurnCountByTurnId } =
    useTurnDiffSummaries(activeThread);
  const repoDiffLiveRefreshIntervalMs = useMemo(() => {
    if (!liveRefreshEnabled) return false;
    if (!activeThread) return false;
    const hasLiveTail = hasLiveTurnTailWork({
      latestTurn: activeThread.latestTurn,
      messages: activeThread.messages,
      activities: activeThread.activities,
      session: activeThread.session,
    });
    return !isLatestTurnSettled(activeThread.latestTurn, activeThread.session) || hasLiveTail
      ? GIT_WORKING_TREE_DIFF_LIVE_REFETCH_INTERVAL_MS
      : false;
  }, [activeThread, liveRefreshEnabled]);
  const orderedTurnDiffSummaries = useMemo(
    () =>
      [...turnDiffSummaries].toSorted((left, right) => {
        const leftTurnCount =
          left.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[left.turnId] ?? 0;
        const rightTurnCount =
          right.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[right.turnId] ?? 0;
        if (leftTurnCount !== rightTurnCount) {
          return rightTurnCount - leftTurnCount;
        }
        return right.completedAt.localeCompare(left.completedAt);
      }),
    [inferredCheckpointTurnCountByTurnId, turnDiffSummaries],
  );

  const selectedTurnId = panelState
    ? (panelState.diffTurnId ?? null)
    : (diffSearch.diffTurnId ?? null);
  const selectedFilePath =
    selectedTurnId !== null
      ? panelState
        ? (panelState.diffFilePath ?? null)
        : (diffSearch.diffFilePath ?? null)
      : null;
  const selectedTurn =
    selectedTurnId === null
      ? undefined
      : (orderedTurnDiffSummaries.find((summary) => summary.turnId === selectedTurnId) ??
        orderedTurnDiffSummaries[0]);
  const selectedCheckpointTurnCount =
    selectedTurn &&
    (selectedTurn.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[selectedTurn.turnId]);
  const selectedCheckpointRange = useMemo(
    () =>
      typeof selectedCheckpointTurnCount === "number"
        ? {
            fromTurnCount: Math.max(0, selectedCheckpointTurnCount - 1),
            toTurnCount: selectedCheckpointTurnCount,
          }
        : null,
    [selectedCheckpointTurnCount],
  );
  const conversationCheckpointTurnCount = useMemo(() => {
    const turnCounts = orderedTurnDiffSummaries
      .map(
        (summary) =>
          summary.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[summary.turnId],
      )
      .filter((value): value is number => typeof value === "number");
    if (turnCounts.length === 0) {
      return undefined;
    }
    const latest = Math.max(...turnCounts);
    return latest > 0 ? latest : undefined;
  }, [inferredCheckpointTurnCountByTurnId, orderedTurnDiffSummaries]);
  const conversationCheckpointRange = useMemo(
    () =>
      !selectedTurn && typeof conversationCheckpointTurnCount === "number"
        ? {
            fromTurnCount: 0,
            toTurnCount: conversationCheckpointTurnCount,
          }
        : null,
    [conversationCheckpointTurnCount, selectedTurn],
  );
  const activeCheckpointRange = selectedTurn
    ? selectedCheckpointRange
    : conversationCheckpointRange;
  const conversationCacheScope = useMemo(() => {
    if (selectedTurn || orderedTurnDiffSummaries.length === 0) {
      return null;
    }
    return `conversation:${orderedTurnDiffSummaries.map((summary) => summary.turnId).join(",")}`;
  }, [orderedTurnDiffSummaries, selectedTurn]);
  const activeCheckpointDiffQuery = useQuery(
    checkpointDiffQueryOptions({
      threadId: activeThreadId,
      fromTurnCount: activeCheckpointRange?.fromTurnCount ?? null,
      toTurnCount: activeCheckpointRange?.toTurnCount ?? null,
      ignoreWhitespace: true,
      cacheScope: selectedTurn ? `turn:${selectedTurn.turnId}` : conversationCacheScope,
      enabled: isGitRepo && !diffEnvironmentPending,
    }),
  );
  const selectedTurnCheckpointDiff = selectedTurn
    ? activeCheckpointDiffQuery.data?.diff
    : undefined;
  const conversationCheckpointDiff = selectedTurn
    ? undefined
    : activeCheckpointDiffQuery.data?.diff;
  const isLoadingCheckpointDiff = activeCheckpointDiffQuery.isLoading;
  const checkpointDiffError =
    activeCheckpointDiffQuery.error instanceof Error
      ? activeCheckpointDiffQuery.error.message
      : activeCheckpointDiffQuery.error
        ? "Failed to load checkpoint diff."
        : null;

  const selectedPatch = selectedTurn ? selectedTurnCheckpointDiff : conversationCheckpointDiff;
  const hasResolvedPatch = typeof selectedPatch === "string";
  const hasNoNetChanges = hasResolvedPatch && selectedPatch.trim().length === 0;
  const normalizedSelectedPatch = hasResolvedPatch ? selectedPatch.trim() : null;
  const repoDiffQuery = useQuery(
    gitWorkingTreeDiffQueryOptions({
      cwd: activeCwd ?? null,
      scope: repoDiffScope,
      enabled: diffOpen && !diffEnvironmentPending,
      refetchInterval: repoDiffLiveRefreshIntervalMs,
    }),
  );
  const repoPatch = repoDiffQuery.data?.patch;
  const hasResolvedRepoPatch = typeof repoPatch === "string";
  const hasNoRepoChanges = hasResolvedRepoPatch && repoPatch.trim().length === 0;
  const normalizedRepoPatch = hasResolvedRepoPatch ? repoPatch.trim() : null;
  const repoDiffError =
    repoDiffQuery.error instanceof Error
      ? repoDiffQuery.error.message
      : repoDiffQuery.error
        ? "Failed to load repo diff."
        : null;
  const branchHasCommittedChanges = (gitStatusQuery.data?.aheadCount ?? 0) > 0;

  useEffect(() => {
    if (!hasResolvedRepoPatch || !activeCwd) {
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: gitQueryKeys.status(activeCwd),
    });
    void queryClient.invalidateQueries({
      queryKey: gitQueryKeys.branches(activeCwd),
    });
  }, [activeCwd, hasResolvedRepoPatch, queryClient, repoPatch]);

  useEffect(() => {
    if (
      diffOpen &&
      repoDiffScope === "workingTree" &&
      hasResolvedRepoPatch &&
      hasNoRepoChanges &&
      branchHasCommittedChanges
    ) {
      setRepoDiffScope("branch");
      setSurfaceMode("total");
    }
  }, [
    branchHasCommittedChanges,
    diffOpen,
    hasNoRepoChanges,
    hasResolvedRepoPatch,
    repoDiffScope,
    setRepoDiffScope,
  ]);

  const activeReviewPatch = surfaceMode === "total" ? repoPatch : selectedPatch;
  const activeReviewError = surfaceMode === "total" ? repoDiffError : checkpointDiffError;
  const activeReviewIsLoading =
    surfaceMode === "total" ? repoDiffQuery.isLoading : isLoadingCheckpointDiff;
  const activeReviewHasNoChanges = surfaceMode === "total" ? hasNoRepoChanges : hasNoNetChanges;
  const { copyToClipboard, isCopied: isSummaryCopied } = useCopyToClipboard();
  const { copyToClipboard: copyDiffToClipboard, isCopied: isDiffCopied } = useCopyToClipboard();
  const diffCopyText = useMemo(() => resolveDiffCopyText(activeReviewPatch), [activeReviewPatch]);
  const renderablePatch = useMemo(
    () => getRenderablePatch(activeReviewPatch, `diff-panel:${resolvedTheme}`),
    [activeReviewPatch, resolvedTheme],
  );
  const renderableFiles = useMemo(() => {
    if (!renderablePatch || renderablePatch.kind !== "files") {
      return [];
    }
    return renderablePatch.files.toSorted((left, right) =>
      resolveFileDiffPath(left).localeCompare(resolveFileDiffPath(right), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [renderablePatch]);
  const repoDiffFileCount = useMemo(() => {
    if (repoDiffScope !== "unstaged" && repoDiffScope !== "staged") {
      return null;
    }
    const renderableRepoPatch =
      surfaceMode === "total"
        ? renderablePatch
        : getRenderablePatch(repoPatch, `diff-panel:repo-count:${resolvedTheme}:${repoDiffScope}`);
    if (!renderableRepoPatch || renderableRepoPatch.kind !== "files") {
      return null;
    }
    return renderableRepoPatch.files.length;
  }, [renderablePatch, repoDiffScope, repoPatch, resolvedTheme, surfaceMode]);
  const totalPatchStat = useMemo(() => summarizePatchStats(repoPatch), [repoPatch]);
  const indexAction =
    surfaceMode === "total"
      ? repoDiffScope === "unstaged"
        ? "stage"
        : repoDiffScope === "staged"
          ? "unstage"
          : null
      : null;
  const showIndexActions = indexAction !== null;
  const indexActionLabel = indexAction === "stage" ? "Stage" : "Unstage";
  const handleUpdateIndex = useCallback(
    (filePaths?: string[]) => {
      if (!indexAction || updateIndexMutation.isPending) {
        return;
      }
      updateIndexMutation.mutate({
        action: indexAction,
        ...(filePaths && filePaths.length > 0 ? { filePaths } : {}),
      });
    },
    [indexAction, updateIndexMutation],
  );

  useEffect(() => {
    if (diffOpen && !previousDiffOpenRef.current) {
      setDiffWordWrap(settings.diffWordWrap);
      setRepoDiffScope("unstaged");
      setSurfaceMode("total");
    }
    previousDiffOpenRef.current = diffOpen;
  }, [diffOpen, setRepoDiffScope, settings.diffWordWrap]);

  const selectedPatchIdentity = useMemo(
    () =>
      normalizedSelectedPatch && normalizedSelectedPatch.length > 0
        ? buildPatchCacheKey(normalizedSelectedPatch, "diff-panel:surface")
        : null,
    [normalizedSelectedPatch],
  );
  const diffSummaryCacheScope = useMemo(() => {
    if (!activeProjectId) {
      return activeCwd ?? null;
    }

    // Share summaries across chats in the same project, while isolating worktrees.
    return activeThread?.worktreePath
      ? `project:${activeProjectId}:worktree:${activeThread.worktreePath}`
      : `project:${activeProjectId}:local`;
  }, [activeCwd, activeProjectId, activeThread?.worktreePath]);

  useEffect(() => {
    if (surfaceMode === "summary" && hasResolvedRepoPatch && hasNoRepoChanges) {
      setSurfaceMode("total");
    }
  }, [hasNoRepoChanges, hasResolvedRepoPatch, surfaceMode]);

  useEffect(() => {
    setSurfaceMode("total");
  }, [activeThreadId, diffOpen, selectedPatchIdentity, selectedTurnId]);

  const diffSummaryPrefetchOptions = useMemo(
    () =>
      gitSummarizeDiffQueryOptions({
        cwd: activeCwd ?? null,
        cacheScope: diffSummaryCacheScope,
        patch: normalizedRepoPatch,
        codexHomePath: settings.codexHomePath || null,
        model: settings.textGenerationModel ?? null,
        ...(providerOptions ? { providerOptions } : {}),
        enabled: true,
      }),
    [
      activeCwd,
      diffSummaryCacheScope,
      normalizedRepoPatch,
      settings.codexHomePath,
      settings.textGenerationModel,
      providerOptions,
    ],
  );
  const diffSummaryQueryOptions = useMemo(
    () =>
      gitSummarizeDiffQueryOptions({
        cwd: activeCwd ?? null,
        cacheScope: diffSummaryCacheScope,
        patch: normalizedRepoPatch,
        codexHomePath: settings.codexHomePath || null,
        model: settings.textGenerationModel ?? null,
        ...(providerOptions ? { providerOptions } : {}),
        enabled: surfaceMode === "summary",
      }),
    [
      activeCwd,
      diffSummaryCacheScope,
      normalizedRepoPatch,
      settings.codexHomePath,
      settings.textGenerationModel,
      providerOptions,
      surfaceMode,
    ],
  );
  const diffSummaryQuery = useQuery(diffSummaryQueryOptions);
  const diffSummaryText = diffSummaryQuery.data?.summary ?? null;
  const diffSummaryError =
    diffSummaryQuery.error instanceof Error
      ? diffSummaryQuery.error.message
      : diffSummaryQuery.error
        ? "Failed to generate diff summary."
        : null;
  const canShowSummary = Boolean(
    !diffEnvironmentPending && activeCwd && (!hasResolvedRepoPatch || !hasNoRepoChanges),
  );
  const canPrefetchSummary = Boolean(
    diffOpen && !diffEnvironmentPending && activeCwd && normalizedRepoPatch && !hasNoRepoChanges,
  );
  const canShowTotal = Boolean(!diffEnvironmentPending && activeCwd);

  useEffect(() => {
    if (!canPrefetchSummary) {
      return;
    }

    const cachedSummaryState = queryClient.getQueryState(diffSummaryPrefetchOptions.queryKey);
    if (
      cachedSummaryState?.status === "success" ||
      cachedSummaryState?.fetchStatus === "fetching"
    ) {
      return;
    }

    const timerId = window.setTimeout(() => {
      const nextSummaryState = queryClient.getQueryState(diffSummaryPrefetchOptions.queryKey);
      if (nextSummaryState?.status === "success" || nextSummaryState?.fetchStatus === "fetching") {
        return;
      }
      void queryClient.prefetchQuery(diffSummaryPrefetchOptions);
    }, 900);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [canPrefetchSummary, diffSummaryPrefetchOptions, queryClient]);

  useEffect(() => {
    if (!selectedFilePath || !patchViewportRef.current) {
      return;
    }
    const target = Array.from(
      patchViewportRef.current.querySelectorAll<HTMLElement>("[data-diff-file-path]"),
    ).find((element) => element.dataset.diffFilePath === selectedFilePath);
    target?.scrollIntoView({ block: "nearest" });
  }, [selectedFilePath, renderableFiles]);

  const toggleFileCollapsed = useCallback((fileKey: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileKey)) next.delete(fileKey);
      else next.add(fileKey);
      return next;
    });
  }, []);

  const handleShowTerminal = useCallback(() => {
    if (!activeThreadId) {
      return;
    }
    if (!terminalOpen) {
      setTerminalPresentationMode(activeThreadId, "drawer");
    }
    setTerminalOpen(activeThreadId, !terminalOpen);
  }, [activeThreadId, setTerminalOpen, setTerminalPresentationMode, terminalOpen]);

  const headerRow = (
    <>
      <div className="min-w-0 flex-1 [-webkit-app-region:no-drag]">
        <h2 className="truncate text-sm font-medium tracking-normal text-foreground flex items-center gap-2 w-fit">
          <IconFileDiff className="size-4 inline-block opacity-80" />
          Review
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 [-webkit-app-region:no-drag]">
        <button
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            handleShowTerminal();
          }}
          aria-label="Show terminal"
          title="Show terminal"
        >
          <PanelRightIcon className="size-4 rotate-90" />
        </button>
        {onClosePanel ? (
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onClosePanel();
            }}
            aria-label="Close review panel"
            title="Close review panel"
          >
            <PanelRightCloseIcon className="size-4" />
          </button>
        ) : null}
      </div>
    </>
  );

  return (
    <DiffPanelShell mode={mode} header={headerRow}>
      {!activeThread ? (
        <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
          Select a thread to inspect turn diffs.
        </div>
      ) : !isGitRepo ? (
        <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
          Turn diffs are unavailable because this project is not a git repository.
        </div>
      ) : diffEnvironmentPending ? (
        <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
          This chat environment is still being prepared. Diff and summary will be available once the
          worktree is ready.
        </div>
      ) : (
        <>
          <div className="border-b border-border/70 px-3">
            <div className="flex items-end gap-1">
              <button
                type="button"
                className={cn(
                  "relative -mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors",
                  surfaceMode === "summary"
                    ? "border-transparent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  !canShowSummary && "cursor-not-allowed opacity-45 hover:text-muted-foreground",
                )}
                disabled={!canShowSummary}
                onClick={() => {
                  setSurfaceMode("summary");
                }}
                aria-pressed={surfaceMode === "summary"}
              >
                <LuWrapText className="size-3.5 opacity-80" />
                <span>Summary</span>
              </button>
              <Menu>
                <MenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        "relative -mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors",
                        surfaceMode === "total"
                          ? "border-transparent text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                        !canShowTotal &&
                          "cursor-not-allowed opacity-45 hover:text-muted-foreground",
                      )}
                      disabled={!canShowTotal}
                      onClick={() => {
                        setSurfaceMode("total");
                      }}
                      aria-pressed={surfaceMode === "total"}
                      aria-label="Choose repo diff source"
                    />
                  }
                >
                  <DiffIcon className="size-3.5 opacity-80" />
                  <span>{REPO_DIFF_SCOPE_LABELS[repoDiffScope]}</span>
                  {repoDiffFileCount !== null ? (
                    <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-muted-foreground/10 px-1.5 font-mono text-[11px] font-medium leading-none tabular-nums text-muted-foreground">
                      {repoDiffFileCount}
                    </span>
                  ) : null}
                  <ChevronDownIcon className="size-3 opacity-70" />
                  {totalPatchStat && hasNonZeroStat(totalPatchStat) ? (
                    <span className="ml-0.5 inline-flex items-center font-mono text-[11px] font-medium">
                      <DiffStatLabel
                        additions={totalPatchStat.additions}
                        deletions={totalPatchStat.deletions}
                      />
                    </span>
                  ) : null}
                </MenuTrigger>
                <MenuPopup align="start">
                  <MenuRadioGroup
                    value={repoDiffScope}
                    onValueChange={(value) => {
                      if (isRepoDiffScope(value)) {
                        setRepoDiffScope(value);
                        setSurfaceMode("total");
                      }
                    }}
                  >
                    <MenuRadioItem value="branch">Branch</MenuRadioItem>
                    <MenuRadioItem value="workingTree">Working tree</MenuRadioItem>
                    <MenuRadioItem value="unstaged">Unstaged</MenuRadioItem>
                    <MenuRadioItem value="staged">Staged</MenuRadioItem>
                  </MenuRadioGroup>
                </MenuPopup>
              </Menu>
              {surfaceMode !== "summary" && diffCopyText ? (
                <Button
                  variant="ghost"
                  size="xs"
                  className="ml-auto shrink-0 gap-1.5 self-center"
                  onClick={() => {
                    copyDiffToClipboard(diffCopyText, undefined);
                  }}
                  aria-label={isDiffCopied ? "Copied full diff" : "Copy full diff"}
                  title={isDiffCopied ? "Copied full diff" : "Copy full diff"}
                >
                  {isDiffCopied ? (
                    <CheckIcon className="size-3 text-success" />
                  ) : (
                    <CopyIcon className="size-3" />
                  )}
                  <span>{isDiffCopied ? "Copied" : "Copy"}</span>
                </Button>
              ) : null}
            </div>
          </div>

          {surfaceMode === "summary" ? (
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Repo summary</p>
                  <p className="text-[11px] text-muted-foreground">
                    Generated from the current {REPO_DIFF_SCOPE_LABELS[repoDiffScope].toLowerCase()}{" "}
                    diff.
                  </p>
                </div>
                {diffSummaryText ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="shrink-0 gap-1.5"
                    onClick={() => {
                      copyToClipboard(diffSummaryText, undefined);
                    }}
                    aria-label={isSummaryCopied ? "Copied diff summary" : "Copy diff summary"}
                    title={isSummaryCopied ? "Copied diff summary" : "Copy diff summary"}
                  >
                    {isSummaryCopied ? (
                      <CheckIcon className="size-3 text-success" />
                    ) : (
                      <CopyIcon className="size-3" />
                    )}
                    <span>{isSummaryCopied ? "Copied" : "Copy"}</span>
                  </Button>
                ) : null}
              </div>

              {repoDiffQuery.isLoading && !hasResolvedRepoPatch ? (
                <DiffPanelLoadingState
                  label={`Loading ${REPO_DIFF_SCOPE_LABELS[repoDiffScope].toLowerCase()} diff...`}
                />
              ) : repoDiffError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {repoDiffError}
                </div>
              ) : hasNoRepoChanges ? (
                <div className="flex h-full items-center justify-center px-5 text-center text-xs text-muted-foreground/70 font-system-ui">
                  No changes in the selected diff source.
                </div>
              ) : diffSummaryQuery.isLoading ? (
                <DiffPanelLoadingState label="Generating repo summary..." />
              ) : diffSummaryError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {diffSummaryError}
                </div>
              ) : diffSummaryText ? (
                <ChatMarkdown
                  text={diffSummaryText}
                  cwd={activeCwd ?? undefined}
                  className="text-sm leading-7"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
                  Summary unavailable for the selected repo diff.
                </div>
              )}
            </div>
          ) : (
            <div
              ref={patchViewportRef}
              className="diff-panel-viewport relative min-h-0 min-w-0 flex-1 overflow-hidden"
            >
              {activeReviewError && !renderablePatch && (
                <div className="px-3">
                  <p className="mb-2 text-[11px] text-red-500/80">{activeReviewError}</p>
                </div>
              )}
              {!renderablePatch ? (
                activeReviewIsLoading ? (
                  <DiffPanelLoadingState
                    label={
                      surfaceMode === "total"
                        ? `Loading ${REPO_DIFF_SCOPE_LABELS[repoDiffScope].toLowerCase()} diff...`
                        : "Loading checkpoint diff..."
                    }
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 py-2 text-xs text-muted-foreground/70 font-system-ui">
                    <p>
                      {activeReviewHasNoChanges
                        ? surfaceMode === "total"
                          ? "No changes in the selected diff source."
                          : "No net changes in this selection."
                        : surfaceMode === "total"
                          ? "No repo diff is available right now."
                          : "No patch available for this selection."}
                    </p>
                  </div>
                )
              ) : renderablePatch.kind === "files" ? (
                <Virtualizer
                  className={cn(
                    "diff-render-surface h-full min-h-0 overflow-auto px-2",
                    showIndexActions ? "pb-24" : "pb-2",
                  )}
                  config={{
                    overscrollSize: 600,
                    intersectionObserverMargin: 1200,
                  }}
                >
                  {renderableFiles.map((fileDiff) => {
                    const filePath = resolveFileDiffPath(fileDiff);
                    const fileKey = buildFileDiffRenderKey(fileDiff);
                    const themedFileKey = `${fileKey}:${resolvedTheme}`;
                    const isCollapsed = collapsedFiles.has(fileKey);
                    const fileActionPaths = resolveFileDiffActionPaths(fileDiff);
                    const canUpdateFileIndex =
                      showIndexActions &&
                      fileActionPaths.length > 0 &&
                      !updateIndexMutation.isPending;
                    return (
                      <div
                        key={themedFileKey}
                        data-diff-file-path={filePath}
                        className="diff-render-file group mb-2 rounded-md first:mt-2 last:mb-0"
                        onClickCapture={(event) => {
                          const nativeEvent = event.nativeEvent as MouseEvent;
                          const composedPath = nativeEvent.composedPath?.() ?? [];
                          const clickedHeader = composedPath.some((node) => {
                            if (!(node instanceof Element)) return false;
                            return (
                              node.hasAttribute("data-diffs-header") ||
                              node.hasAttribute("data-file-info")
                            );
                          });
                          if (!clickedHeader) return;
                          event.stopPropagation();
                          toggleFileCollapsed(fileKey);
                        }}
                      >
                        <FileDiff
                          fileDiff={fileDiff}
                          options={{
                            diffStyle: "unified",
                            lineDiffType: "none",
                            overflow: diffWordWrap ? "wrap" : "scroll",
                            theme: resolveDiffThemeName(resolvedTheme),
                            themeType: resolvedTheme as DiffThemeType,
                            unsafeCSS: buildDiffPanelUnsafeCSS(resolvedTheme),
                            collapsed: isCollapsed,
                          }}
                          renderHeaderPrefix={() => (
                            <FileEntryIcon
                              pathValue={filePath}
                              kind="file"
                              theme={resolvedTheme}
                              className="size-4"
                            />
                          )}
                          renderHeaderMetadata={() => (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "2px",
                                color: "inherit",
                              }}
                            >
                              {showIndexActions ? (
                                <button
                                  type="button"
                                  className="inline-flex size-6 items-center justify-center rounded-md text-[#808080] opacity-0 transition-[background-color,color,opacity] hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-45"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleUpdateIndex(fileActionPaths);
                                  }}
                                  disabled={!canUpdateFileIndex}
                                  aria-label={`${indexActionLabel} ${filePath}`}
                                  title={`${indexActionLabel} ${filePath}`}
                                >
                                  {updateIndexMutation.isPending ? (
                                    <Loader2Icon className="size-3 animate-spin" />
                                  ) : indexAction === "stage" ? (
                                    <PlusIcon className="size-3.5" />
                                  ) : (
                                    <MinusIcon className="size-3.5 text-muted-foreground" />
                                  )}
                                </button>
                              ) : null}
                              <ChevronDownIcon
                                style={{
                                  width: "14px",
                                  height: "14px",
                                  transition: "transform 150ms ease",
                                  transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                                  opacity: 0.5,
                                }}
                              />
                            </span>
                          )}
                        />
                      </div>
                    );
                  })}
                </Virtualizer>
              ) : (
                <div className="h-full overflow-auto p-2">
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground/75">{renderablePatch.reason}</p>
                    <pre
                      className={cn(
                        "max-h-[72vh] rounded-md border border-border/70 bg-background/70 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground/90",
                        diffWordWrap
                          ? "overflow-auto whitespace-pre-wrap wrap-break-word"
                          : "overflow-auto",
                      )}
                    >
                      {renderablePatch.text}
                    </pre>
                  </div>
                </div>
              )}
              {showIndexActions ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-9 z-20 flex justify-center px-3">
                  <div className="rounded-lg bg-[color:var(--color-success)]/10 p-px shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="group pointer-events-auto h-8 select-none gap-2 rounded-lg border-0 bg-background text-muted-foreground px-3 font-system-ui text-sm leading-8  transition-colors hover:bg-background hover:text-background/95 active:shadow-[-1px_0px_1px_0px_color-mix(in_srgb,var(--border)_85%,transparent)_inset,1px_0px_1px_0px_color-mix(in_srgb,var(--border)_85%,transparent)_inset,0px_0.125rem_1px_0px_color-mix(in_srgb,var(--border)_85%,transparent)_inset] disabled:opacity-55"
                      disabled={updateIndexMutation.isPending || activeReviewHasNoChanges}
                      onClick={() => {
                        handleUpdateIndex();
                      }}
                      aria-label={`${indexActionLabel} all files`}
                      title={`${indexActionLabel} all files`}
                    >
                      {updateIndexMutation.isPending ? (
                        <Loader2Icon className="size-3 animate-spin" />
                      ) : indexAction === "stage" ? (
                        <PlusIcon className="size-3.5" />
                      ) : (
                        <MinusIcon className="size-3.5" />
                      )}
                      <span className="block group-active:[transform:translate3d(0,1px,0)]">
                        {indexActionLabel} all
                      </span>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </DiffPanelShell>
  );
}
