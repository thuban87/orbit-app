/**
 * Assist-queue refresh ordering (38.3 RG-023; D-23 latest-request authority).
 *
 * An older queue refresh must never overwrite a newer one: two overlapping
 * refreshes that resolve out of order leave the later-requested result in the
 * store; an older refresh that rejects after a newer one started changes
 * nothing and rejects only to its own caller. Also proves the dev-only
 * "assist-queue-refresh" UAT fault site and that the fire-and-forget AppState
 * refresh cannot become an unhandled rejection.
 *
 * Kept separate from `assist-store.test.ts` (node-sqlite suite) so the deferred
 * read mock here does not leak into it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getExecutor: vi.fn(),
  localDateTime: vi.fn(),
  listEligiblePendingAssists: vi.fn(),
}));

vi.mock("@/db/database", () => ({
  getExecutor: mocks.getExecutor,
  localDateTime: mocks.localDateTime,
}));
vi.mock("@/db/interaction-assist-read", () => ({
  listEligiblePendingAssists: mocks.listEligiblePendingAssists,
}));

import { subscribeAppState, useAssistBanner } from "@/stores/assist-store";
import { Logger } from "@/utils/logger";
import { __resetUatFaultsForTest, armUatFault } from "@/utils/uat-faults";

const NOW = "2026-08-31 12:05:00";

function row(id: number, uid: string) {
  return {
    id,
    uid,
    contact_id: id,
    channel: "text" as const,
    endpoint_value: null,
    handoff_at: "2026-08-31 12:00:00",
    created_at: `2026-08-31 12:00:0${id}`,
    contact_name: "Name",
  };
}

const OLD_QUEUE = [row(1, "old")];
const NEW_QUEUE = [row(2, "new"), row(1, "old")];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const devGlobal = globalThis as { __DEV__?: boolean };
let hadDev = false;
let savedDev: boolean | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  hadDev = "__DEV__" in devGlobal;
  savedDev = devGlobal.__DEV__;
  __resetUatFaultsForTest();
  mocks.getExecutor.mockReturnValue({});
  mocks.localDateTime.mockReturnValue(NOW);
  useAssistBanner.setState({ queue: [], newest: null, morePendingCount: 0 });
});

afterEach(() => {
  if (hadDev) devGlobal.__DEV__ = savedDev;
  else delete devGlobal.__DEV__;
  __resetUatFaultsForTest();
  vi.restoreAllMocks();
});

describe("assist queue refresh — latest-request authority", () => {
  it("two overlapping refreshes resolving out of order leave the later-requested result", async () => {
    const first = deferred<ReturnType<typeof row>[]>();
    const second = deferred<ReturnType<typeof row>[]>();
    mocks.listEligiblePendingAssists
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const olderCall = useAssistBanner.getState().refresh();
    const newerCall = useAssistBanner.getState().refresh();
    // Let both reach their read before settling.
    await vi.waitFor(() =>
      expect(mocks.listEligiblePendingAssists).toHaveBeenCalledTimes(2),
    );

    second.resolve(NEW_QUEUE);
    await newerCall;
    expect(useAssistBanner.getState().queue).toEqual(NEW_QUEUE);

    first.resolve(OLD_QUEUE);
    await olderCall;
    expect(useAssistBanner.getState().queue).toEqual(NEW_QUEUE);
    expect(useAssistBanner.getState().newest?.uid).toBe("new");
    expect(useAssistBanner.getState().morePendingCount).toBe(1);
  });

  it("an older refresh that rejects after a newer one started changes nothing and rejects only to its caller", async () => {
    const first = deferred<ReturnType<typeof row>[]>();
    const second = deferred<ReturnType<typeof row>[]>();
    mocks.listEligiblePendingAssists
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const olderCall = useAssistBanner.getState().refresh();
    const newerCall = useAssistBanner.getState().refresh();
    await vi.waitFor(() =>
      expect(mocks.listEligiblePendingAssists).toHaveBeenCalledTimes(2),
    );

    second.resolve(NEW_QUEUE);
    await expect(newerCall).resolves.toBeUndefined();
    first.reject(new Error("read failed"));
    await expect(olderCall).rejects.toThrow("read failed");
    expect(useAssistBanner.getState().queue).toEqual(NEW_QUEUE);
  });

  it("a current refresh whose read rejects still rejects to its caller and leaves the queue unchanged", async () => {
    useAssistBanner.setState({ queue: OLD_QUEUE });
    mocks.listEligiblePendingAssists.mockRejectedValueOnce(new Error("boom"));
    await expect(useAssistBanner.getState().refresh()).rejects.toThrow("boom");
    expect(useAssistBanner.getState().queue).toEqual(OLD_QUEUE);
  });

  it("with the 'assist-queue-refresh' fault armed in a dev build, the next refresh rejects once", async () => {
    devGlobal.__DEV__ = true;
    mocks.listEligiblePendingAssists.mockResolvedValue(NEW_QUEUE);
    armUatFault("assist-queue-refresh", { mode: "reject" });

    await expect(useAssistBanner.getState().refresh()).rejects.toThrow();
    expect(mocks.listEligiblePendingAssists).not.toHaveBeenCalled();
    expect(useAssistBanner.getState().queue).toEqual([]);

    await expect(useAssistBanner.getState().refresh()).resolves.toBeUndefined();
    expect(useAssistBanner.getState().queue).toEqual(NEW_QUEUE);
  });

  it("the AppState-driven refresh logs a rejection instead of leaving it unhandled", async () => {
    const errorSpy = vi.spyOn(Logger, "error").mockImplementation(() => {});
    mocks.listEligiblePendingAssists.mockRejectedValueOnce(new Error("boom"));
    const holder: { listener: ((state: string) => void) | null } = {
      listener: null,
    };
    subscribeAppState({
      addEventListener(_type, callback) {
        holder.listener = callback;
        return { remove: vi.fn() };
      },
    });
    holder.listener?.("background");
    holder.listener?.("active");
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(1));
    expect(errorSpy.mock.calls[0][0]).toBe("assist-store");
    expect(errorSpy.mock.calls[0][1]).toBe("queue refresh failed");
  });
});
