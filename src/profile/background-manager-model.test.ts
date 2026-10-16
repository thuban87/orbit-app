import { describe, expect, it, vi } from "vitest";
import type { SnackbarMessage } from "@/stores/snackbar-store";
import {
  assignContactBackground,
  BACKGROUND_RESET_LABEL,
  BACKGROUND_RESTORE_ERROR,
  BACKGROUND_RESTORED_LABEL,
  BACKGROUND_SAVE_ERROR,
  backgroundSetLabel,
  beginBackgroundPreparation,
  cancelBackgroundPreparation,
  createBackgroundManagerState,
  deleteBackgroundTemplateAndRefresh,
  finishBackgroundPreparation,
  isContactBackground,
  requestBackgroundManagerDismissal,
  resetContactBackground,
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

  it("marks only the person's own background as the current card (38.11 D-58.4)", () => {
    expect(isContactBackground("bg-1", "bg-1")).toBe(true);
    expect(isContactBackground("bg-1", "bg-2")).toBe(false);
    // Inheriting a Category or global background marks no card.
    expect(isContactBackground("bg-1", null)).toBe(false);
  });

  it("Assign writes this person's background, reloads, then confirms (38.11 D-58.3)", async () => {
    const events: string[] = [];
    const ok = await assignContactBackground(
      {
        write: async (uid) => {
          events.push(`write:${uid}`);
        },
        onCommitted: () => events.push("committed"),
        notify: (message) => events.push(`${message.kind}:${message.label}`),
        logError: () => events.push("log"),
      },
      { templateUid: "bg-1", contactName: "Ann Lee" },
    );
    expect(ok).toBe(true);
    expect(events).toEqual([
      "write:bg-1",
      "committed",
      "success:Background set for Ann Lee",
    ]);
    expect(backgroundSetLabel("Ann Lee")).toBe("Background set for Ann Lee");
  });

  it("a failed Assign shows the error snackbar and does not reload", async () => {
    const onCommitted = vi.fn();
    const notify = vi.fn();
    const logError = vi.fn();
    const ok = await assignContactBackground(
      {
        write: async () => {
          throw new Error("transaction failed");
        },
        onCommitted,
        notify,
        logError,
      },
      { templateUid: "bg-1", contactName: "Ann Lee" },
    );
    expect(ok).toBe(false);
    expect(onCommitted).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({
      kind: "error",
      label: BACKGROUND_SAVE_ERROR,
    });
  });

  /** A writer that records every call, for the reset and Undo cases. */
  function recordingWriter(
    failOn: (uid: string | null) => boolean = () => false,
  ) {
    const events: string[] = [];
    const messages: SnackbarMessage[] = [];
    return {
      events,
      messages,
      writer: {
        write: async (uid: string | null) => {
          events.push(`write:${uid}`);
          if (failOn(uid)) throw new Error("transaction failed");
        },
        onCommitted: () => events.push("committed"),
        notify: (message: SnackbarMessage) => {
          messages.push(message);
          events.push(`${message.kind}:${message.label}`);
        },
        logError: (message: string) => events.push(`log:${message}`),
      },
    };
  }

  /** Lets the Undo's fire-and-forget write settle. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("Reset to default clears only this person's background, at once with Undo (38.11 D-65; 38.9 D-30)", async () => {
    const { events, messages, writer } = recordingWriter();
    expect(await resetContactBackground(writer, { previousUid: "bg-1" })).toBe(
      true,
    );
    expect(events).toEqual([
      "write:null",
      "committed",
      `warning:${BACKGROUND_RESET_LABEL}`,
    ]);
    expect(BACKGROUND_RESET_LABEL).toBe("Background reset to default");
    const undo = messages[0]?.action;
    expect(undo?.label).toBe("Undo");
    expect(undo?.accessibilityLabel).toBe("Undo background reset");

    // Undo re-assigns the captured previous background, reloads, then confirms (38.9 D-39).
    undo?.onPress();
    await settle();
    expect(events.slice(3)).toEqual([
      "write:bg-1",
      "committed",
      `success:${BACKGROUND_RESTORED_LABEL}`,
    ]);
    expect(BACKGROUND_RESTORED_LABEL).toBe("Background restored");
  });

  it("a failed Undo shows the restore error and does not reload", async () => {
    const { events, messages, writer } = recordingWriter(
      (uid) => uid === "bg-1",
    );
    await resetContactBackground(writer, { previousUid: "bg-1" });
    messages[0]?.action?.onPress();
    await settle();
    expect(events.slice(3)).toEqual([
      "write:bg-1",
      "log:background reset undo failed",
      `error:${BACKGROUND_RESTORE_ERROR}`,
    ]);
    expect(BACKGROUND_RESTORE_ERROR).toBe(
      "Couldn't restore the background. Try again.",
    );
  });

  it("a failed reset shows an error snackbar with no Undo and does not reload", async () => {
    const { events, messages, writer } = recordingWriter((uid) => uid === null);
    expect(await resetContactBackground(writer, { previousUid: "bg-1" })).toBe(
      false,
    );
    expect(events).toEqual([
      "write:null",
      "log:background reset failed",
      `error:${BACKGROUND_SAVE_ERROR}`,
    ]);
    expect(messages[0]?.action).toBeUndefined();
  });

  it("does nothing when the person has no background of their own", async () => {
    const { events, writer } = recordingWriter();
    expect(await resetContactBackground(writer, { previousUid: null })).toBe(
      false,
    );
    expect(events).toEqual([]);
  });
});
