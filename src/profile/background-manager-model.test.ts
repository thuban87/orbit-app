import { describe, expect, it, vi } from "vitest";
import {
  beginBackgroundPreparation,
  cancelBackgroundPreparation,
  createBackgroundManagerState,
  deleteBackgroundTemplateAndRefresh,
  finishBackgroundPreparation,
  requestBackgroundManagerDismissal,
  resolveBackgroundListState,
  retryBackgroundPreparation,
  shouldResetBackgroundManagerViewOnOpen,
} from "./background-manager-model";

describe("background manager model", () => {
  it("isolates a pending crop from committed state and rejects stale completion", () => {
    const initial = createBackgroundManagerState("profile-backgrounds/old.jpg");
    const started = beginBackgroundPreparation(initial, "pick-1");
    expect(started.pendingPath).toBeNull();
    expect(started.committedPath).toBe("profile-backgrounds/old.jpg");
    const stale = finishBackgroundPreparation(started, "other-pick", {
      ok: true,
      relativePath: "profile-backgrounds/new.jpg",
    });
    expect(stale).toBe(started);
    expect(
      finishBackgroundPreparation(started, "pick-1", {
        ok: true,
        relativePath: "profile-backgrounds/new.jpg",
      }).pendingPath,
    ).toBe("profile-backgrounds/new.jpg");
  });

  it("keeps committed bytes on cancel or preparation failure and enables Retry", () => {
    const started = beginBackgroundPreparation(
      createBackgroundManagerState("profile-backgrounds/old.jpg"),
      "pick-1",
    );
    const failed = finishBackgroundPreparation(started, "pick-1", {
      ok: false,
      message:
        "Couldn't prepare that image. Choose another image or try again.",
    });
    expect(failed.committedPath).toBe("profile-backgrounds/old.jpg");
    expect(failed.error).toContain("Couldn't prepare");
    expect(retryBackgroundPreparation(failed)).toEqual({ kind: "retry" });
    expect(cancelBackgroundPreparation(failed).committedPath).toBe(
      "profile-backgrounds/old.jpg",
    );
  });

  it("guards dirty crop dismissal but allows a clean sheet to close", () => {
    expect(
      requestBackgroundManagerDismissal(createBackgroundManagerState(null)),
    ).toEqual({ kind: "close" });
    expect(
      requestBackgroundManagerDismissal(
        beginBackgroundPreparation(
          createBackgroundManagerState(null),
          "pick-1",
        ),
      ),
    ).toEqual({ kind: "confirm-discard" });
  });

  it("returns a clean manager to its list view on reopen without bypassing a crop guard", () => {
    expect(
      shouldResetBackgroundManagerViewOnOpen(
        createBackgroundManagerState(null),
      ),
    ).toBe(true);
    expect(
      shouldResetBackgroundManagerViewOnOpen(
        beginBackgroundPreparation(
          createBackgroundManagerState(null),
          "pick-1",
        ),
      ),
    ).toBe(false);
  });

  it("describes visible list states and retry affordance without touching draft state", () => {
    expect(
      resolveBackgroundListState({
        loading: true,
        error: null,
        templateCount: 0,
      }),
    ).toEqual({ kind: "loading" });
    expect(
      resolveBackgroundListState({
        loading: false,
        error: null,
        templateCount: 0,
      }),
    ).toEqual({ kind: "empty" });
    expect(
      resolveBackgroundListState({
        loading: false,
        error: null,
        templateCount: 2,
      }),
    ).toEqual({ kind: "populated", templateCount: 2 });
    expect(
      resolveBackgroundListState({
        loading: false,
        error: "Couldn't load background templates. Try again.",
        templateCount: 2,
      }),
    ).toEqual({
      kind: "error",
      message: "Couldn't load background templates. Try again.",
      retry: true,
    });
  });

  it("refreshes only after a successful background-template deletion", async () => {
    const events: string[] = [];
    await deleteBackgroundTemplateAndRefresh({
      removeTemplate: async () => {
        events.push("delete");
        return "profile-backgrounds/orphan.jpg";
      },
      removeDerivative: (path) => events.push(`derivative:${path}`),
      refresh: async () => {
        events.push("refresh");
      },
      onCommitted: () => events.push("committed"),
    });
    expect(events).toEqual([
      "delete",
      "derivative:profile-backgrounds/orphan.jpg",
      "refresh",
      "committed",
    ]);

    const refresh = vi.fn();
    await expect(
      deleteBackgroundTemplateAndRefresh({
        removeTemplate: async () => {
          throw new Error("transaction failed");
        },
        removeDerivative: vi.fn(),
        refresh,
      }),
    ).rejects.toThrow("transaction failed");
    expect(refresh).not.toHaveBeenCalled();
  });
});
