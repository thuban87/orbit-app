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
    readChannelPreference: vi.fn(() =>
      Promise.resolve({ pref: "Message" as const, remembered: null }),
    ),
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
      channel: "Message",
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

  it("resolves the channel from the Default Interaction Channel preference", async () => {
    // pref 'remember' → the remembered value; a concrete pref → that channel.
    const remembered = createDeps({
      readChannelPreference: vi.fn(() =>
        Promise.resolve({ pref: "remember" as const, remembered: "Call" as const }),
      ),
    });
    runQuickLog(remembered.deps, 7);
    await vi.waitFor(() =>
      expect(remembered.deps.recordTouchpoint).toHaveBeenCalledOnce(),
    );
    expect(remembered.deps.recordTouchpoint).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "Call" }),
    );

    const concrete = createDeps({
      readChannelPreference: vi.fn(() =>
        Promise.resolve({ pref: "In Person" as const, remembered: null }),
      ),
    });
    runQuickLog(concrete.deps, 7);
    await vi.waitFor(() =>
      expect(concrete.deps.recordTouchpoint).toHaveBeenCalledOnce(),
    );
    expect(concrete.deps.recordTouchpoint).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "In Person" }),
    );
  });

  it("does NOT write the remembered channel back (Quick Log only consumes it)", async () => {
    // Quick Log has no updateAppSettings dependency at all; the remembered value
    // is owned solely by the detailed Log Interaction screen (D-09). Assert the
    // resolved channel is used without any write-back surface on the deps.
    const { deps } = createDeps({
      readChannelPreference: vi.fn(() =>
        Promise.resolve({ pref: "remember" as const, remembered: "In Person" as const }),
      ),
    });
    runQuickLog(deps, 7);
    await vi.waitFor(() => expect(deps.recordTouchpoint).toHaveBeenCalledOnce());
    expect(deps.recordTouchpoint).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "In Person" }),
    );
    expect("updateAppSettings" in deps).toBe(false);
  });

  it("ignores a second request while the consumer's write is pending", async () => {
    const write = deferred<{ interactionId: number }>();
    const { deps } = createDeps({ recordTouchpoint: vi.fn(() => write.promise) });

    runQuickLog(deps, 7);
    runQuickLog(deps, 7);

    // The second call is rejected synchronously by pendingRef before it can reach
    // the (async) write, so recordTouchpoint runs exactly once.
    await vi.waitFor(() => expect(deps.recordTouchpoint).toHaveBeenCalledOnce());
    write.resolve({ interactionId: 12 });
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
