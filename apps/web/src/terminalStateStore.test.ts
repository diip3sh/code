import { ThreadId } from "@t3tools/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import { collectTerminalIdsFromLayout } from "./terminalPaneLayout";
import {
  sanitizePersistedTerminalStateByThreadId,
  selectThreadTerminalState,
  useTerminalStateStore,
} from "./terminalStateStore";

const THREAD_ID = ThreadId.makeUnsafe("thread-1");

function summarizeTerminalGroups(
  terminalGroups: ReturnType<typeof selectThreadTerminalState>["terminalGroups"],
) {
  return terminalGroups.map((group) => ({
    id: group.id,
    activeTerminalId: group.activeTerminalId,
    terminalIds: collectTerminalIdsFromLayout(group.layout),
  }));
}

describe("terminalStateStore actions", () => {
  beforeEach(() => {
    useTerminalStateStore.setState({ terminalStateByThreadId: {} });
  });

  it("returns a closed default terminal state for unknown threads", () => {
    const terminalState = selectThreadTerminalState(
      useTerminalStateStore.getState().terminalStateByThreadId,
      THREAD_ID,
    );
    expect(terminalState).toMatchObject({
      entryPoint: "chat",
      terminalOpen: false,
      presentationMode: "drawer",
      terminalHeight: 280,
      terminalIds: ["default"],
      terminalLabelsById: { default: "Terminal 1" },
      terminalTitleOverridesById: {},
      terminalCliKindsById: {},
      terminalAttentionStatesById: {},
      runningTerminalIds: [],
      activeTerminalId: "default",
      activeTerminalGroupId: "group-default",
    });
    expect(summarizeTerminalGroups(terminalState.terminalGroups)).toEqual([
      {
        id: "group-default",
        activeTerminalId: "default",
        terminalIds: ["default"],
      },
    ]);
  });

  it("marks chat-first threads without forcing open terminal UI", () => {
    const store = useTerminalStateStore.getState();
    store.openTerminalThreadPage(THREAD_ID);
    store.openChatThreadPage(THREAD_ID);

    const terminalState = selectThreadTerminalState(
      useTerminalStateStore.getState().terminalStateByThreadId,
      THREAD_ID,
    );
    expect(terminalState.entryPoint).toBe("chat");
  });

  it("opens terminal-first threads in the drawer", () => {
    const store = useTerminalStateStore.getState();
    store.openTerminalThreadPage(THREAD_ID);

    const terminalState = selectThreadTerminalState(
      useTerminalStateStore.getState().terminalStateByThreadId,
      THREAD_ID,
    );
    expect(terminalState.entryPoint).toBe("terminal");
    expect(terminalState.terminalOpen).toBe(true);
    expect(terminalState.presentationMode).toBe("drawer");
  });

  it("opens and splits terminals into the active group", () => {
    const store = useTerminalStateStore.getState();
    store.setTerminalOpen(THREAD_ID, true);
    store.splitTerminal(THREAD_ID, "terminal-2");

    const terminalState = selectThreadTerminalState(
      useTerminalStateStore.getState().terminalStateByThreadId,
      THREAD_ID,
    );
    expect(terminalState.terminalOpen).toBe(true);
    expect(terminalState.terminalIds).toEqual(["default", "terminal-2"]);
    expect(terminalState.activeTerminalId).toBe("terminal-2");
    expect(summarizeTerminalGroups(terminalState.terminalGroups)).toEqual([
      {
        id: "group-default",
        activeTerminalId: "terminal-2",
        terminalIds: ["default", "terminal-2"],
      },
    ]);
  });

  it("keeps split terminals in the same group up to the current group limit", () => {
    const store = useTerminalStateStore.getState();
    store.splitTerminal(THREAD_ID, "terminal-2");
    store.splitTerminal(THREAD_ID, "terminal-3");
    store.splitTerminal(THREAD_ID, "terminal-4");
    store.splitTerminal(THREAD_ID, "terminal-5");

    const terminalState = selectThreadTerminalState(
      useTerminalStateStore.getState().terminalStateByThreadId,
      THREAD_ID,
    );
    expect(terminalState.terminalIds).toEqual([
      "default",
      "terminal-2",
      "terminal-3",
      "terminal-4",
      "terminal-5",
    ]);
    expect(summarizeTerminalGroups(terminalState.terminalGroups)).toEqual([
      {
        id: "group-default",
        activeTerminalId: "terminal-5",
        terminalIds: ["default", "terminal-2", "terminal-3", "terminal-4", "terminal-5"],
      },
    ]);
  });

  it("creates new terminals in a separate group", () => {
    useTerminalStateStore.getState().newTerminal(THREAD_ID, "terminal-2");

    const terminalState = selectThreadTerminalState(
      useTerminalStateStore.getState().terminalStateByThreadId,
      THREAD_ID,
    );
    expect(terminalState.terminalIds).toEqual(["default", "terminal-2"]);
    expect(terminalState.activeTerminalId).toBe("terminal-2");
    expect(terminalState.activeTerminalGroupId).toBe("group-terminal-2");
    expect(summarizeTerminalGroups(terminalState.terminalGroups)).toEqual([
      { id: "group-default", activeTerminalId: "default", terminalIds: ["default"] },
      { id: "group-terminal-2", activeTerminalId: "terminal-2", terminalIds: ["terminal-2"] },
    ]);
  });

  it("stores terminal labels and removes them when a terminal closes", () => {
    const store = useTerminalStateStore.getState();
    store.newTerminal(THREAD_ID, "terminal-2");
    store.setTerminalMetadata(THREAD_ID, "terminal-2", {
      cliKind: "codex",
      label: "Codex CLI",
    });

    let terminalState = selectThreadTerminalState(
      useTerminalStateStore.getState().terminalStateByThreadId,
      THREAD_ID,
    );
    expect(terminalState.terminalLabelsById).toEqual({
      default: "Terminal 1",
      "terminal-2": "Codex 1",
    });
    expect(terminalState.terminalCliKindsById).toEqual({ "terminal-2": "codex" });

    store.closeTerminal(THREAD_ID, "terminal-2");

    terminalState = selectThreadTerminalState(
      useTerminalStateStore.getState().terminalStateByThreadId,
      THREAD_ID,
    );
    expect(terminalState.terminalLabelsById).toEqual({ default: "Terminal 1" });
    expect(terminalState.terminalCliKindsById).toEqual({});
  });

  it("allows unlimited groups while keeping each group capped at four terminals", () => {
    const store = useTerminalStateStore.getState();
    store.splitTerminal(THREAD_ID, "terminal-2");
    store.splitTerminal(THREAD_ID, "terminal-3");
    store.splitTerminal(THREAD_ID, "terminal-4");
    store.newTerminal(THREAD_ID, "terminal-5");
    store.newTerminal(THREAD_ID, "terminal-6");

    const terminalState = selectThreadTerminalState(
      useTerminalStateStore.getState().terminalStateByThreadId,
      THREAD_ID,
    );
    expect(terminalState.terminalIds).toEqual([
      "default",
      "terminal-2",
      "terminal-3",
      "terminal-4",
      "terminal-5",
      "terminal-6",
    ]);
    expect(summarizeTerminalGroups(terminalState.terminalGroups)).toEqual([
      {
        id: "group-default",
        activeTerminalId: "terminal-4",
        terminalIds: ["default", "terminal-2", "terminal-3", "terminal-4"],
      },
      { id: "group-terminal-5", activeTerminalId: "terminal-5", terminalIds: ["terminal-5"] },
      { id: "group-terminal-6", activeTerminalId: "terminal-6", terminalIds: ["terminal-6"] },
    ]);
  });

  it("tracks and clears terminal subprocess activity", () => {
    const store = useTerminalStateStore.getState();
    store.splitTerminal(THREAD_ID, "terminal-2");
    store.setTerminalActivity(THREAD_ID, "terminal-2", {
      hasRunningSubprocess: true,
      agentState: null,
    });
    expect(
      selectThreadTerminalState(useTerminalStateStore.getState().terminalStateByThreadId, THREAD_ID)
        .runningTerminalIds,
    ).toEqual(["terminal-2"]);

    store.setTerminalActivity(THREAD_ID, "terminal-2", {
      hasRunningSubprocess: false,
      agentState: null,
    });
    expect(
      selectThreadTerminalState(useTerminalStateStore.getState().terminalStateByThreadId, THREAD_ID)
        .runningTerminalIds,
    ).toEqual([]);
  });

  it("strips volatile runtime flags from persisted terminal state", () => {
    const store = useTerminalStateStore.getState();
    store.splitTerminal(THREAD_ID, "terminal-2");
    store.setTerminalTitleOverride(THREAD_ID, "terminal-2", "New keybinds set");
    store.setTerminalActivity(THREAD_ID, "terminal-2", {
      hasRunningSubprocess: false,
      agentState: "attention",
    });

    const sanitized = sanitizePersistedTerminalStateByThreadId(
      useTerminalStateStore.getState().terminalStateByThreadId,
    );

    expect(sanitized[THREAD_ID]?.terminalTitleOverridesById).toEqual({
      "terminal-2": "New keybinds set",
    });
    expect(sanitized[THREAD_ID]?.terminalAttentionStatesById).toEqual({});
    expect(sanitized[THREAD_ID]?.runningTerminalIds).toEqual([]);
  });

  it("resets to default and clears persisted entry when closing the last terminal", () => {
    const store = useTerminalStateStore.getState();
    store.closeTerminal(THREAD_ID, "default");

    expect(useTerminalStateStore.getState().terminalStateByThreadId[THREAD_ID]).toBeUndefined();
    expect(
      selectThreadTerminalState(useTerminalStateStore.getState().terminalStateByThreadId, THREAD_ID)
        .terminalIds,
    ).toEqual(["default"]);
  });

  it("keeps terminal-first threads terminal-first after closing the last terminal", () => {
    const store = useTerminalStateStore.getState();
    store.openTerminalThreadPage(THREAD_ID);
    store.closeTerminal(THREAD_ID, "default");

    const terminalState = selectThreadTerminalState(
      useTerminalStateStore.getState().terminalStateByThreadId,
      THREAD_ID,
    );
    expect(useTerminalStateStore.getState().terminalStateByThreadId[THREAD_ID]).toBeDefined();
    expect(terminalState.entryPoint).toBe("terminal");
    expect(terminalState.terminalOpen).toBe(false);
    expect(terminalState.terminalIds).toEqual(["default"]);
  });

  it("normalizes persisted workspace presentation state back to the drawer", () => {
    const sanitized = sanitizePersistedTerminalStateByThreadId({
      [THREAD_ID]: {
        ...selectThreadTerminalState({}, THREAD_ID),
        terminalOpen: true,
        presentationMode: "workspace",
        workspaceLayout: "terminal-only",
        workspaceActiveTab: "chat",
      } as never,
    });

    const terminalState = sanitized[THREAD_ID];
    expect(terminalState).toBeDefined();
    if (!terminalState) return;
    expect(terminalState.presentationMode).toBe("drawer");
    expect("workspaceLayout" in terminalState).toBe(false);
    expect("workspaceActiveTab" in terminalState).toBe(false);
  });

  it("keeps a valid active terminal after closing an active split terminal", () => {
    const store = useTerminalStateStore.getState();
    store.splitTerminal(THREAD_ID, "terminal-2");
    store.splitTerminal(THREAD_ID, "terminal-3");
    store.closeTerminal(THREAD_ID, "terminal-3");

    const terminalState = selectThreadTerminalState(
      useTerminalStateStore.getState().terminalStateByThreadId,
      THREAD_ID,
    );
    expect(terminalState.activeTerminalId).toBe("terminal-2");
    expect(terminalState.terminalIds).toEqual(["default", "terminal-2"]);
    expect(summarizeTerminalGroups(terminalState.terminalGroups)).toEqual([
      {
        id: "group-default",
        activeTerminalId: "terminal-2",
        terminalIds: ["default", "terminal-2"],
      },
    ]);
  });
});
