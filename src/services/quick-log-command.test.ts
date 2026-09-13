import { describe, expect, it, vi } from "vitest";
import {
  runQuickLog,
  type QuickLogSnackbar,
  type RunQuickLogDeps,
} from "./quick-log-command";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createDeps(overrides: Partial<RunQuickLogDeps> = {}) {
  const snackbars: QuickLogSnackbar[] = [];
  const deps: RunQuickLogDeps = {
    pendingRef: { current: false },
    undoController: { undo: vi.fn(() => Promise.resolve()) },
    recordTouchpoint: vi.fn(() => Promise.resolve({ interactionId: 12 })),
    localDateTime: vi.fn(() => "2026-09-06 09:00:00"),
    newUid: vi.fn(() => "interaction-uid"),
    showSnackbar: (snackbar) => snackbars.push(snackbar),
    notifySuccessHaptic: vi.fn(),
    notifyWidgetDataChanged: vi.fn(),
    bumpShellRefresh: vi.fn(),
    openPostLogEditor: vi.fn(),
    ...overrides,
  };
  return { deps, snackbars };
}

describe("runQuickLog", () => {
  it("records once, announces success, and refreshes", async () => {
    const { deps, snackbars } = createDeps();

    runQuickLog(deps, 7);
    await vi.waitFor(() => expect(snackbars).toHaveLength(1));

    expect(deps.recordTouchpoint).toHaveBeenCalledWith({
      contactId: 7,
      uid: "interaction-uid",
      occurredAt: "2026-09-06 09:00:00",
      now: "2026-09-06 09:00:00",
      channel: "unspecified",
      direction: "outbound",
      connected: 1,
      quality: null,
      source: "manual",
    });
    expect(snackbars[0]).toMatchObject({ kind: "success", label: "Logged" });
    expect(deps.notifySuccessHaptic).toHaveBeenCalledOnce();
    expect(deps.notifyWidgetDataChanged).toHaveBeenCalledOnce();
    expect(deps.bumpShellRefresh).toHaveBeenCalledOnce();
  });

  it("offers Undo AND Add Note on success; Add Note opens the post-log editor", async () => {
    const { deps, snackbars } = createDeps();

    runQuickLog(deps, 7);
    await vi.waitFor(() => expect(snackbars).toHaveLength(1));

    expect(snackbars[0].action.label).toBe("Undo");
    expect(snackbars[0].secondaryAction?.label).toBe("Add Note");

    snackbars[0].secondaryAction?.onPress();
    expect(deps.openPostLogEditor).toHaveBeenCalledWith({
      interactionId: 12,
      contactId: 7,
    });
  });

  it("omits Add Note on the failure snackbar", async () => {
    const { deps, snackbars } = createDeps({
      recordTouchpoint: vi.fn(() => Promise.reject(new Error("write failed"))),
    });

    runQuickLog(deps, 7);
    await vi.waitFor(() => expect(snackbars).toHaveLength(1));

    expect(snackbars[0]).toMatchObject({ kind: "error", label: "Couldn't log" });
    expect(snackbars[0].secondaryAction).toBeUndefined();
    expect(deps.openPostLogEditor).not.toHaveBeenCalled();
  });

  it("ignores a second request while the consumer's write is pending", () => {
    const write = deferred<{ interactionId: number }>();
    const { deps } = createDeps({ recordTouchpoint: vi.fn(() => write.promise) });

    runQuickLog(deps, 7);
    runQuickLog(deps, 7);

    expect(deps.recordTouchpoint).toHaveBeenCalledOnce();
  });

  it("shows Retry after a failed write and clears the pending guard", async () => {
    const { deps, snackbars } = createDeps({
      recordTouchpoint: vi.fn(() => Promise.reject(new Error("write failed"))),
    });

    runQuickLog(deps, 7);
    await vi.waitFor(() => expect(snackbars).toHaveLength(1));

    expect(snackbars[0]).toMatchObject({ kind: "error", label: "Couldn't log" });
    await vi.waitFor(() => expect(deps.pendingRef.current).toBe(false));
  });

  it("undoes the logged interaction and refreshes", async () => {
    const { deps, snackbars } = createDeps();

    runQuickLog(deps, 7);
    await vi.waitFor(() => expect(snackbars).toHaveLength(1));
    snackbars[0].action.onPress();

    await vi.waitFor(() =>
      expect(deps.undoController.undo).toHaveBeenCalledWith({
        contactId: 7,
        interactionId: 12,
      }),
    );
    await vi.waitFor(() => expect(deps.notifyWidgetDataChanged).toHaveBeenCalledTimes(2));
    expect(deps.bumpShellRefresh).toHaveBeenCalledTimes(2);
  });
});
