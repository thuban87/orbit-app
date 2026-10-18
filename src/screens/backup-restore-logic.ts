import type {
  RestoreApplyResult,
  RestoreMode,
  RestorePeopleCounts,
  RestoreProgressStep,
} from "@/backup/restore-apply";
import { backgroundsNeedingConsent } from "@/backup/restore-backgrounds";
import type { BackupManifest } from "@/backup/types";
import type { RestorePreviewAggregate } from "@/services/backup/backup-service";
import { plural } from "@/utils/plural";

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
       * The mode the user confirmed. The apply runs with exactly this mode,
       * never the screen's live selection (38.5 scoped re-check WR-1: a mode
       * tap during the confirmation's read must not run Replace-all behind
       * Merge's dialog; D-47 "Replace-all shows one dialog").
       */
      readonly mode: RestoreMode;
      /**
       * The user agreed to switch an unavailable background to the package
       * default (38.5 D-47); the apply passes `unavailableBackgrounds:
       * "use-default"`.
       */
      readonly useDefaultBackgrounds: boolean;
    }
  | { readonly status: "cancelled" }
  | { readonly status: "expired" };

/** A confirmed apply: the candidate, the confirmed mode and the D-47 answer. */
export type ConfirmedRestoreApply = Extract<
  RestoreApplyConfirmationResult,
  { status: "confirmed" }
>;

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
  "A background selected in this backup is no longer available. Replace all will switch to the default background instead.";

/**
 * Whether this restore must ask the D-47 question: the validated backup holds a
 * background id the DAO would reject (neither active nor retired; retired ids
 * are available) AND the restore will write the backup's settings. A Merge
 * whose backup settings are not newer than this phone's never writes them, so
 * it never asks (owner ruling RA-a, 2026-09-29; D-49). The decision is
 * `backgroundsNeedingConsent`, the same helper `applyRestore` gates on.
 */
export async function backupNeedsBackgroundConsent(
  entry: Pick<RestoreCacheEntry, "manifest">,
  mode: RestoreMode,
  readLocalSettingsModifiedAt: () => Promise<string>,
): Promise<boolean> {
  return (
    (
      await backgroundsNeedingConsent(
        mode,
        entry.manifest?.appSettings,
        readLocalSettingsModifiedAt,
      )
    ).length > 0
  );
}

/** The destination reads an apply's confirmation may need. */
export type RestoreApplyConfirmationReads = {
  /** Replace-all only: whether an automatic backup destination is set. */
  readonly destinationConfigured: () => Promise<boolean>;
  /**
   * This phone's settings LWW stamp (`app_settings.modified_at`); read only
   * when the backup holds an unavailable background id (RA-a / D-49).
   */
  readonly localSettingsModifiedAt: () => Promise<string>;
};

/**
 * The ONE dialog an apply shows, or null for none (a plain Merge):
 *   - Replace-all: the destructive confirmation stating the people on each
 *     side (D-60); with an unavailable background its message also carries the
 *     D-47 notice, and "Replace all" is the consent (one dialog, not two);
 *   - Merge whose backup settings will be written and hold an unavailable
 *     background: the D-47 question, Continue/Cancel.
 * `unavailableBackground` is `backupNeedsBackgroundConsent` (RA-a / D-49), not
 * the bare presence of an unavailable id.
 */
export function restoreApplyConfirmation(
  mode: RestoreMode,
  destinationConfigured: boolean,
  unavailableBackground: boolean,
  scale: RestorePeopleScale,
): RestoreApplyConfirmation | null {
  if (mode === "replace-all") {
    const base = replaceAllConfirmation(destinationConfigured, scale);
    return {
      title: base.title,
      message: unavailableBackground
        ? `${base.message}\n\n${UNAVAILABLE_BACKGROUND_REPLACE_NOTE}`
        : base.message,
      cancelLabel: "Keep local data",
      confirmLabel: REPLACE_ALL_LABEL,
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
 * anything is written; a plain Merge (including one whose older backup
 * settings will not be written, RA-a) confirms without a dialog.
 */
export async function confirmRestoreApply(
  cache: Pick<ReturnType<typeof createRestorePreviewCache>, "read">,
  token: string,
  mode: RestoreMode,
  reads: RestoreApplyConfirmationReads,
  confirm: (confirmation: RestoreApplyConfirmation) => Promise<boolean>,
): Promise<RestoreApplyConfirmationResult> {
  const candidate = cache.read(token);
  if (!candidate) return { status: "expired" };

  const useDefaultBackgrounds = await backupNeedsBackgroundConsent(
    candidate,
    mode,
    reads.localSettingsModifiedAt,
  );
  const confirmation = restoreApplyConfirmation(
    mode,
    mode === "replace-all" ? await reads.destinationConfigured() : false,
    useDefaultBackgrounds,
    candidate.preview,
  );
  if (confirmation !== null && !(await confirm(confirmation)))
    return { status: "cancelled" };
  return { status: "confirmed", candidate, mode, useDefaultBackgrounds };
}

/** The two steps of one Apply tap, supplied by the screen. */
export type RestoreApplyRunSteps = {
  /** Asks for (at most) the one confirmation for `mode`. */
  readonly confirm: (
    mode: RestoreMode,
  ) => Promise<RestoreApplyConfirmationResult>;
  /** Runs the apply for a confirmed result, with `confirmed.mode`. */
  readonly apply: (confirmed: ConfirmedRestoreApply) => Promise<void>;
};

/**
 * One Apply tap, with the restore mode LOCKED from the tap until the
 * confirmation settles and the apply completes or is cancelled (38.5 scoped
 * re-check WR-1). It enforces D-47's "each path shows one dialog": the
 * confirmation is asked for the mode selected at the tap, and the apply runs
 * with the mode that confirmation carries, so Replace-all can never run behind
 * Merge's dialog, and a Replace-all always passes through its own "Replace
 * all?" confirmation, once. While locked, a mode change is refused
 * (`acceptsModeChange`) and a second Apply tap returns `busy` without asking
 * again. The lock is synchronous, so a tap that lands before the screen
 * re-renders its disabled radios is refused too.
 */
export function createRestoreApplyRun(steps: RestoreApplyRunSteps) {
  let locked = false;
  return {
    /** Whether a mode tap may change the selection now. */
    acceptsModeChange(): boolean {
      return !locked;
    },
    async begin(
      mode: RestoreMode,
    ): Promise<RestoreApplyConfirmationResult | { readonly status: "busy" }> {
      if (locked) return { status: "busy" };
      locked = true;
      try {
        const confirmation = await steps.confirm(mode);
        if (confirmation.status === "confirmed")
          await steps.apply(confirmation);
        return confirmation;
      } finally {
        locked = false;
      }
    },
  };
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

/**
 * The message for a failed backup intake (pick or share). A source D-117
 * refuses (not a content:// link) gets the normal "not a backup" message,
 * because trying again can never succeed; any other failure keeps "Please
 * try again" (38.12 review B-IN-01).
 */
export function backupIntakeFailureMessage(result: {
  notBackup?: boolean;
}): string {
  return result.notBackup
    ? restorePreviewFailure("damaged-or-incomplete").message
    : "Couldn't restore this backup. Your local data hasn't changed. Please try again.";
}

/**
 * What the Backup page does with a drained shared backup (38.12 DEF-04).
 * Draining empties the native singleton, so a share that was drained is
 * always loaded, even when its focus run was superseded (a warm share can
 * route to the page more than once in quick succession): dropping it would
 * lose the share for good. Only a failure message is skipped once the run is
 * superseded; the newer run reports its own result.
 */
export function sharedBackupIntakeAction(
  shared: { uri: string | null; failed?: boolean },
  superseded: boolean,
): "load" | "fail" | "none" {
  if (shared.failed) return superseded ? "none" : "fail";
  return shared.uri ? "load" : "none";
}

/**
 * D-61: Replace has one name everywhere: the mode option, the apply button,
 * the confirm's title and button, and the background notice. "Replace all"
 * is the shortest existing label (38.12-18).
 */
export const REPLACE_ALL_LABEL = "Replace all";

/**
 * D-60: the people on each side, both excluding the Bin, plus the people in
 * this phone's Bin that Replace all would delete permanently (A-WR-01).
 */
export type RestorePeopleScale = Pick<
  RestorePreviewAggregate,
  "phoneContacts" | "backupContacts" | "phoneBinNotInBackup"
>;

/** The restore mode choice, Merge first: it is the default (D-23). */
export const RESTORE_MODE_OPTIONS: readonly {
  readonly value: RestoreMode;
  readonly label: string;
}[] = [
  { value: "merge", label: "Merge" },
  { value: "replace-all", label: REPLACE_ALL_LABEL },
];

export function restoreModeLabel(mode: RestoreMode): string {
  return mode === "merge" ? "Merge" : REPLACE_ALL_LABEL;
}

/** D-60: "This phone: 12 contacts · Backup: 40 contacts". */
export function restorePeopleComparison(
  scale: Pick<RestorePeopleScale, "phoneContacts" | "backupContacts">,
): string {
  return `This phone: ${plural(scale.phoneContacts, "contact")} · Backup: ${plural(scale.backupContacts, "contact")}`;
}

export function restoreApplyLabel(
  mode: RestoreMode,
): "Merge backup" | typeof REPLACE_ALL_LABEL {
  return mode === "merge" ? "Merge backup" : REPLACE_ALL_LABEL;
}

/**
 * The Replace all confirm (D-60, D-02): the scale on both sides, then (only
 * when there are any) the people in this phone's Bin it deletes permanently
 * (A-WR-01; D-59/D-60 honesty, the Bin never empties itself), then the
 * safety-backup sentence. The screen shows it destructive and
 * non-dismissable.
 */
export function replaceAllConfirmation(
  destinationConfigured: boolean,
  scale: RestorePeopleScale,
): {
  title: string;
  message: string;
} {
  const binned = scale.phoneBinNotInBackup;
  const replaces = `This replaces the ${plural(scale.phoneContacts, "contact")} on this phone with the ${scale.backupContacts} in the backup.${
    binned > 0
      ? ` It also permanently deletes the ${plural(binned, "contact")} in this phone's Bin that the backup doesn't have.`
      : ""
  }`;
  return {
    title: `${REPLACE_ALL_LABEL}?`,
    message: `${replaces}\n\n${
      destinationConfigured
        ? "Orbit will first create and verify a fresh automatic backup of this device."
        : "Your current local data will be lost and no automatic backup destination is configured."
    }`,
  };
}

export function createRestoreApplySingleFlight<A extends unknown[], T>(
  operation: (...args: A) => Promise<T>,
): (...args: A) => Promise<T> {
  let pending: Promise<T> | null = null;
  return (...args: A) => {
    if (pending) return pending;
    pending = operation(...args).finally(() => {
      pending = null;
    });
    return pending;
  };
}

/** Applying is intentionally React-local; a cold process always lands at Backup. */
export function initialRestoreApplyState(): "idle" {
  return "idle";
}

/**
 * D-69: the busy state's label for the step `applyRestore` last reported.
 * Before the first report the restore is still reading the file, so it reads
 * as restoring.
 */
export function restoreProgressLabel(step: RestoreProgressStep | null): string {
  return step === "safety-backup"
    ? "Making a safety backup…"
    : "Restoring contacts…";
}

/** The Backup restored route params (`RestoreResult`). */
export type RestoreResultRoute = {
  readonly mode: RestoreMode;
  /** D-59: people, not rows (`applyRestore`'s `people`). */
  readonly people: RestorePeopleCounts;
  readonly photosNeedingAttention: number;
  readonly photoCleanupPending: number;
  readonly scheduleResyncPending: boolean;
  readonly replaceSafetySnapshot: "verified" | "not-configured" | null;
  /** Photos the Replace-all safety backup left out (38.6 D-24). */
  readonly replaceSafetySnapshotSkippedPhotos: number;
  /** Skipped-photo rows with no photo left to keep (38.6 D-26). */
  readonly restoredPhotosMissing: number;
};

/**
 * D-59: Backup restored counts people. Contacts on the phone before always;
 * contacts restored for Replace-all, and for Merge the contacts added and
 * updated on one line (38.12 D-165); for Replace-all the contacts it removed (Merge
 * never removes anyone, so it has no such line); and D-140 (owner
 * 2026-10-17): the phone's people the backup has in its Bin, only when there
 * are any; and (A-WR-01) the people in the phone's Bin that Replace-all
 * deleted permanently, only when there are any. Row totals ("Added", "Updated") are not shown: they count every
 * record, not people.
 */
export function restoreResultPeopleLines(
  mode: RestoreMode,
  people: RestorePeopleCounts,
): string[] {
  const lines = [
    `Contacts on this phone before: ${people.before}`,
    // D-165: a Merge says what it added and updated; "Contacts restored: 0"
    // read as "nothing happened" when it had changed people.
    mode === "merge"
      ? `Contacts added: ${people.added ?? 0} · Contacts updated: ${people.updated ?? 0}`
      : `Contacts restored: ${people.restored}`,
  ];
  if (mode === "replace-all") lines.push(`Contacts removed: ${people.removed}`);
  if (people.movedToBin > 0)
    lines.push(`${plural(people.movedToBin, "contact")} moved to the Bin`);
  // A-WR-01: Replace-all's permanent deletions from this phone's Bin, only
  // when there are any (like D-140's line).
  if (people.removedFromBin > 0)
    lines.push(
      `${plural(people.removedFromBin, "contact")} in the Bin permanently deleted`,
    );
  return lines;
}

export function toRestoreResultParams(
  result: Extract<RestoreApplyResult, { status: "applied" }>,
): RestoreResultRoute {
  return {
    mode: result.mode,
    people: result.people,
    photosNeedingAttention: result.photosNeedingAttention,
    photoCleanupPending: result.photoCleanupPending,
    scheduleResyncPending: result.scheduleResyncPending,
    replaceSafetySnapshot:
      result.mode === "replace-all"
        ? result.preRestoreSnapshotCreated
          ? ("verified" as const)
          : ("not-configured" as const)
        : null,
    // 38.6 D-24: photos the Replace-all safety backup left out (Merge takes none).
    replaceSafetySnapshotSkippedPhotos:
      result.mode === "replace-all"
        ? result.preRestoreSnapshotSkippedPhotos
        : 0,
    // 38.6 D-26: skipped-photo rows that end with no photo on this phone.
    restoredPhotosMissing: result.restoredPhotosMissing,
  };
}

/** 38.6 D-39: Replace-all's safety backup of this device was over the size cap. */
export const RESTORE_SAFETY_BACKUP_TOO_LARGE_COPY =
  "Couldn't back up this device first because the backup is too large. Your local data hasn't changed.";

export function restoreApplyRecovery(
  reason: Exclude<RestoreApplyResult["status"], "applied"> | "unexpected",
): { step: "preview"; message: string } {
  return {
    step: "preview",
    message:
      reason === "pre-restore-snapshot-too-large"
        ? RESTORE_SAFETY_BACKUP_TOO_LARGE_COPY
        : "Couldn't restore this backup. Your local data hasn't changed. Please try again.",
  };
}
