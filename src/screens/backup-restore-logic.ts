import type { RestoreApplyResult, RestoreMode } from "@/backup/restore-apply";
import { unavailableBackupBackgrounds } from "@/backup/restore-backgrounds";
import type { BackupManifest } from "@/backup/types";
import type { RestorePreviewAggregate } from "@/services/backup/backup-service";

export type RestorePreviewRoute = {
  readonly token: string;
  readonly preview: RestorePreviewAggregate;
};

export type RestoreCacheEntry = {
  readonly manifest: BackupManifest;
  readonly preview: RestorePreviewAggregate;
};

export type RestoreApplyConfirmationResult =
  | {
      readonly status: "confirmed";
      readonly candidate: RestoreCacheEntry;
      /**
       * The user agreed to switch an unavailable background to the package
       * default (38.5 D-47); the apply passes `unavailableBackgrounds:
       * "use-default"`.
       */
      readonly useDefaultBackgrounds: boolean;
    }
  | { readonly status: "cancelled" }
  | { readonly status: "expired" };

/** One confirmation dialog: the copy and the two button labels. */
export type RestoreApplyConfirmation = {
  readonly title: string;
  readonly message: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  /** The confirm button is destructive (Replace-all). */
  readonly destructive: boolean;
};

export type RestorePreviewFailureReason =
  | "wrong-passphrase"
  | "damaged-or-incomplete"
  | "newer-app";

export type RestorePreviewFailure = {
  readonly step: "passphrase" | "selection";
  readonly message: string;
  readonly action: "Try passphrase again" | "Choose another file";
};

export function createRestorePreviewCache() {
  const entries = new Map<string, RestoreCacheEntry>();
  let nextToken = 0;

  return {
    store(entry: RestoreCacheEntry): RestorePreviewRoute {
      nextToken += 1;
      const token = `restore-preview-${Date.now()}-${nextToken}`;
      entries.set(token, entry);
      return { token, preview: entry.preview };
    },
    read(token: string): RestoreCacheEntry | null {
      return entries.get(token) ?? null;
    },
    discard(token: string): void {
      entries.delete(token);
    },
  };
}

/** Deliberately process-local: a cold launch must re-select and re-validate. */
export const restorePreviewCache = createRestorePreviewCache();

/**
 * The owner's question for a backup background the app no longer has (38.5
 * D-47, 2026-09-29): "A background selected in the backup file is no longer
 * available. Do you agree to switch to the default background for now
 * instead?"
 */
export const UNAVAILABLE_BACKGROUND_TITLE = "Background not available";
export const UNAVAILABLE_BACKGROUND_MESSAGE =
  "A background selected in this backup is no longer available. Switch to the default background instead?";
/** The same notice inside the Replace-all dialog, whose buttons carry the answer. */
export const UNAVAILABLE_BACKGROUND_REPLACE_NOTE =
  "A background selected in this backup is no longer available. Replace and restore will switch to the default background instead.";

/**
 * Whether the validated backup holds a background id the DAO would reject
 * (neither active nor retired; D-47). Retired ids are available.
 */
export function backupHasUnavailableBackground(
  entry: Pick<RestoreCacheEntry, "manifest">,
): boolean {
  return unavailableBackupBackgrounds(entry.manifest?.appSettings).length > 0;
}

/**
 * The ONE dialog an apply shows, or null for none (a plain Merge):
 *   - Replace-all: the destructive confirmation; with an unavailable background
 *     its message also carries the D-47 notice, and "Replace and restore" is the
 *     consent (one dialog, not two);
 *   - Merge with an unavailable background: the D-47 question, Continue/Cancel.
 */
export function restoreApplyConfirmation(
  mode: RestoreMode,
  destinationConfigured: boolean,
  unavailableBackground: boolean,
): RestoreApplyConfirmation | null {
  if (mode === "replace-all") {
    const base = replaceAllConfirmation(destinationConfigured);
    return {
      title: base.title,
      message: unavailableBackground
        ? `${base.message}\n\n${UNAVAILABLE_BACKGROUND_REPLACE_NOTE}`
        : base.message,
      cancelLabel: "Keep local data",
      confirmLabel: "Replace and restore",
      destructive: true,
    };
  }
  if (!unavailableBackground) return null;
  return {
    title: UNAVAILABLE_BACKGROUND_TITLE,
    message: UNAVAILABLE_BACKGROUND_MESSAGE,
    cancelLabel: "Cancel",
    confirmLabel: "Continue",
    destructive: false,
  };
}

/**
 * Coordinates the apply's confirmation with the validated preview candidate.
 * The candidate never travels through navigation params. Cancel returns before
 * anything is written; a plain Merge confirms without a dialog.
 */
export async function confirmRestoreApply(
  cache: Pick<ReturnType<typeof createRestorePreviewCache>, "read">,
  token: string,
  mode: RestoreMode,
  readDestinationConfigured: () => Promise<boolean>,
  confirm: (confirmation: RestoreApplyConfirmation) => Promise<boolean>,
): Promise<RestoreApplyConfirmationResult> {
  const candidate = cache.read(token);
  if (!candidate) return { status: "expired" };

  const useDefaultBackgrounds = backupHasUnavailableBackground(candidate);
  const confirmation = restoreApplyConfirmation(
    mode,
    mode === "replace-all" ? await readDestinationConfigured() : false,
    useDefaultBackgrounds,
  );
  if (confirmation !== null && !(await confirm(confirmation)))
    return { status: "cancelled" };
  return { status: "confirmed", candidate, useDefaultBackgrounds };
}

export function isEncryptedBackupEnvelope(contents: string): boolean {
  try {
    const value: unknown = JSON.parse(contents);
    return Boolean(
      value &&
        typeof value === "object" &&
        (value as Record<string, unknown>).encrypted === true,
    );
  } catch {
    return false;
  }
}

export function restorePreviewFailure(
  reason: RestorePreviewFailureReason,
): RestorePreviewFailure {
  if (reason === "wrong-passphrase") {
    return {
      step: "passphrase",
      message:
        "That passphrase doesn't unlock this backup. Your local data hasn't changed.",
      action: "Try passphrase again",
    };
  }
  if (reason === "newer-app") {
    return {
      step: "selection",
      message:
        "This backup was made by a newer version of Orbit. Update Orbit, then try again. Your local data hasn't changed.",
      action: "Choose another file",
    };
  }
  return {
    step: "selection",
    message:
      "This backup is damaged or incomplete. Your local data hasn't changed.",
    action: "Choose another file",
  };
}

export function restoreApplyLabel(
  mode: RestoreMode,
): "Merge backup" | "Replace and restore" {
  return mode === "merge" ? "Merge backup" : "Replace and restore";
}

export function replaceAllConfirmation(destinationConfigured: boolean): {
  title: string;
  message: string;
} {
  return {
    title: "Replace all local data?",
    message: destinationConfigured
      ? "Orbit will first create and verify a fresh automatic backup of this device."
      : "Your current local data will be lost and no automatic backup destination is configured.",
  };
}

export function createRestoreApplySingleFlight<T>(
  operation: () => Promise<T>,
): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (pending) return pending;
    pending = operation().finally(() => {
      pending = null;
    });
    return pending;
  };
}

/** Applying is intentionally React-local; a cold process always lands at Backup. */
export function initialRestoreApplyState(): "idle" {
  return "idle";
}

export function toRestoreResultParams(
  result: Extract<RestoreApplyResult, { status: "applied" }>,
) {
  return {
    added: result.inserted,
    updated: result.updated,
    newerLocalKept: result.retained,
    deletionsApplied: result.deleted,
    photosNeedingAttention: result.photosNeedingAttention,
    photoCleanupPending: result.photoCleanupPending,
    scheduleResyncPending: result.scheduleResyncPending,
    replaceSafetySnapshot:
      result.mode === "replace-all"
        ? result.preRestoreSnapshotCreated
          ? ("verified" as const)
          : ("not-configured" as const)
        : null,
  };
}

export function restoreApplyRecovery(
  _reason: Exclude<RestoreApplyResult["status"], "applied"> | "unexpected",
): { step: "preview"; message: string } {
  return {
    step: "preview",
    message:
      "Couldn't restore this backup. Your local data hasn't changed. Please try again.",
  };
}
