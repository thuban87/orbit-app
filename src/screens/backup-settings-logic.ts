import {
  type AppSettings,
  type AppSettingsPatch,
  assertBackupDays,
} from "@/db/app-settings-dao";
import type { ReadPhase } from "@/logic/read-phase";

export const BACKUP_DAYS_VALIDATION_COPY =
  "Enter a whole number from 1 to 3650 days.";

export type WholeBackupDaysResult =
  | { readonly value: number }
  | { readonly error: typeof BACKUP_DAYS_VALIDATION_COPY };

/** Parse without coercion, then defer the authoritative range check to the DAO. */
export function validateWholeBackupDays(raw: string): WholeBackupDaysResult {
  if (!/^[0-9]+$/.test(raw)) {
    return { error: BACKUP_DAYS_VALIDATION_COPY };
  }
  const value = Number(raw);
  try {
    assertBackupDays("backup days", value);
    return { value };
  } catch {
    return { error: BACKUP_DAYS_VALIDATION_COPY };
  }
}

/** The two backup day-count fields of the schedule (D-34). */
export type BackupDayField = "interval" | "retention";

const BACKUP_DAY_FIELD_KEY = {
  interval: "backupIntervalDays",
  retention: "backupRetentionDays",
} as const satisfies Record<BackupDayField, keyof AppSettingsPatch>;

/** A single-key app_settings patch for one day field (never both). */
export type BackupDaysFieldPatch = Pick<
  AppSettingsPatch,
  "backupIntervalDays" | "backupRetentionDays"
>;

export type BackupDaysFieldPatchResult =
  | { readonly ok: true; readonly patch: BackupDaysFieldPatch }
  | { readonly ok: false; readonly error: typeof BACKUP_DAYS_VALIDATION_COPY };

/**
 * The per-field patch (38.9 D-34; RESEARCH Pitfall 8): one valid field saves
 * on its own, and an invalid one blocks only itself. Invalid raw text stays in
 * the controlled input and never reaches SQLite.
 */
export function buildBackupDaysFieldPatch(
  field: BackupDayField,
  text: string,
): BackupDaysFieldPatchResult {
  const result = validateWholeBackupDays(text);
  if ("error" in result) return { ok: false, error: result.error };
  return { ok: true, patch: { [BACKUP_DAY_FIELD_KEY[field]]: result.value } };
}

/**
 * The one gate for blur, submit and every leave site (D-34): true only when the
 * latest text is valid, differs from the value it would replace (the pending
 * write's value while one is in flight, else the saved value; review C3-M1),
 * and this typed version is neither written already nor in flight.
 */
export function shouldFlushOnLeave({
  savedValue,
  pendingValue,
  text,
  typedVersion,
  committedVersion,
  pendingVersion,
}: {
  savedValue: number | null;
  pendingValue: number | null;
  text: string;
  typedVersion: number;
  committedVersion: number;
  pendingVersion: number | null;
}): boolean {
  if (typedVersion === committedVersion) return false;
  if (pendingVersion !== null && typedVersion === pendingVersion) return false;
  const parsed = validateWholeBackupDays(text);
  if ("error" in parsed) return false;
  const baseline = pendingVersion !== null ? pendingValue : savedValue;
  return parsed.value !== baseline;
}

/**
 * Whether a settings read may reseed a day field (D-34; review C2-M2): only
 * with no write pending, no keystroke since the field was last seeded or
 * written, and a read that began after that field's last committed write.
 */
export function shouldReseedDayField({
  typedVersion,
  committedVersion,
  pendingVersion,
  readStartedSeq,
  lastCommitSeq,
}: {
  typedVersion: number;
  committedVersion: number;
  pendingVersion: number | null;
  readStartedSeq: number;
  lastCommitSeq: number;
}): boolean {
  return (
    pendingVersion === null &&
    typedVersion === committedVersion &&
    readStartedSeq > lastCommitSeq
  );
}

/** One day field's save state, owned by the controller. */
export interface BackupDayFieldState {
  /** The latest typed (or seeded) text, shown in the input. */
  readonly latestText: string;
  /** The value last read or successfully written; null before any read. */
  readonly savedValue: number | null;
  /** The inline validation error shown under the field. */
  readonly error: typeof BACKUP_DAYS_VALIDATION_COPY | null;
  /** Incremented on every keystroke. */
  readonly typedVersion: number;
  /** The typed version last seeded or successfully written (never backwards). */
  readonly committedVersion: number;
  /** The write in flight (at most one per field), else null. */
  readonly pendingVersion: number | null;
  readonly pendingValue: number | null;
  /** The controller `seq` of this field's last successful write. */
  readonly lastCommitSeq: number;
  /** A blur/submit/leave that arrived while a write was in flight. */
  readonly drainRequested: boolean;
  readonly drainOrigin: "blur" | "leave" | null;
  /** The typed version the current leave already attempted (review C3-L1). */
  readonly leaveAttemptedVersion: number | null;
}

export interface BackupDaySnapshot {
  readonly interval: {
    readonly text: string;
    readonly error: string | null;
  };
  readonly retention: {
    readonly text: string;
    readonly error: string | null;
  };
}

export interface BackupDayController {
  /** Immutable view state; a new object after every change. */
  getSnapshot(): BackupDaySnapshot;
  /** A copy of one field's internal state (diagnostics and tests). */
  fieldState(field: BackupDayField): BackupDayFieldState;
  /**
   * A mount attaches its render listener (resetting idle fields, C5-M3) and
   * gets back its detach. Writes and drains never depend on a listener.
   */
  attach(listener: () => void): () => void;
  /** A keystroke. */
  changeText(field: BackupDayField, text: string): void;
  /** Blur or submit of one field. */
  commitField(field: BackupDayField): void;
  /** The screen gained focus (C7-L1): reset idle fields before its read. */
  focus(): void;
  /** A leave site: focus-effect cleanup, `beforeRemove`, unmount, app background. */
  leave(): void;
  /** A settings read is starting; pass the result to `loaded`. */
  beginRead(): number;
  /** The current read landed. */
  loaded(
    readStartedSeq: number,
    values: { backupIntervalDays: number; backupRetentionDays: number },
  ): void;
}

const DAY_FIELDS: readonly BackupDayField[] = ["interval", "retention"];

type MutableFieldState = {
  -readonly [K in keyof BackupDayFieldState]: BackupDayFieldState[K];
};

function initialFieldState(): MutableFieldState {
  return {
    latestText: "",
    savedValue: null,
    error: null,
    typedVersion: 0,
    committedVersion: 0,
    pendingVersion: null,
    pendingValue: null,
    lastCommitSeq: 0,
    drainRequested: false,
    drainOrigin: null,
    leaveAttemptedVersion: null,
  };
}

/**
 * The backup schedule's save-on-leave controller (38.9 D-34; review H3, C2-M2,
 * C3-M1, C3-L1, C4-M1, C4-L1, C5-M3, C7-L1). Pure: `write` and `onWriteFailed`
 * are injected. All per-field state, writes, leave handling and drains live
 * here, settling through the controller's own promise chain, so a save started
 * by a leave completes after the screen unmounts. The screen holds one
 * module-scoped instance, so a remount attaches to the same state.
 *
 * Rules per field:
 * - At most one write in flight. A blur/submit or leave arriving meanwhile
 *   records a drain request instead; when the write settles (success or
 *   failure) the drain runs the gate on the latest text against the settled
 *   state. A "leave" drain acts as a leave site; a "blur" drain acts as a blur
 *   commit and leaves `leaveAttemptedVersion` alone, so a failed one is still
 *   retried once by a later leave (C4-M1).
 * - Each leave attempts a given typed version at most once (C3-L1). A
 *   keystroke or a focus gain clears that mark and turns a pending "leave"
 *   drain into "blur" (C4-L1).
 * - A read reseeds a field only per `shouldReseedDayField`.
 * - On attach and on focus, idle fields (no write pending, no drain requested)
 *   drop their unsaved text state, so the next read shows storage and an
 *   earlier visit's invalid or failed text is neither shown nor written over
 *   newer storage (C5-M3, C7-L1).
 */
export function createBackupDayController({
  write,
  onWriteFailed,
}: {
  write: (patch: BackupDaysFieldPatch) => Promise<void>;
  onWriteFailed: (error: unknown) => void;
}): BackupDayController {
  const fields: Record<BackupDayField, MutableFieldState> = {
    interval: initialFieldState(),
    retention: initialFieldState(),
  };
  const listeners = new Set<() => void>();
  let seq = 0;
  let snapshot = buildSnapshot();

  function buildSnapshot(): BackupDaySnapshot {
    return {
      interval: {
        text: fields.interval.latestText,
        error: fields.interval.error,
      },
      retention: {
        text: fields.retention.latestText,
        error: fields.retention.error,
      },
    };
  }

  function notify(): void {
    snapshot = buildSnapshot();
    for (const listener of [...listeners]) listener();
  }

  function gate(state: MutableFieldState): boolean {
    return shouldFlushOnLeave({
      savedValue: state.savedValue,
      pendingValue: state.pendingValue,
      text: state.latestText,
      typedVersion: state.typedVersion,
      committedVersion: state.committedVersion,
      pendingVersion: state.pendingVersion,
    });
  }

  function resetIdleFields(): void {
    for (const field of DAY_FIELDS) {
      const state = fields[field];
      if (state.pendingVersion !== null || state.drainRequested) {
        // Settlement rules keep applying; no leave has seen it on this visit.
        state.leaveAttemptedVersion = null;
        if (state.drainOrigin === "leave") state.drainOrigin = "blur";
        continue;
      }
      state.committedVersion = state.typedVersion;
      state.leaveAttemptedVersion = null;
      state.error = null;
    }
  }

  function startWrite(field: BackupDayField): void {
    const state = fields[field];
    const built = buildBackupDaysFieldPatch(field, state.latestText);
    if (!built.ok) return;
    const version = state.typedVersion;
    const value = Number(state.latestText);
    state.pendingVersion = version;
    state.pendingValue = value;
    let pending: Promise<void>;
    try {
      pending = write(built.patch);
    } catch (error) {
      pending = Promise.reject(error);
    }
    void pending.then(
      () => settle(field, version, value, null),
      (error: unknown) => settle(field, version, value, { error }),
    );
  }

  function settle(
    field: BackupDayField,
    version: number,
    value: number,
    failure: { error: unknown } | null,
  ): void {
    const state = fields[field];
    if (failure === null) {
      state.committedVersion = Math.max(state.committedVersion, version);
      if (state.committedVersion === version) state.savedValue = value;
      seq += 1;
      state.lastCommitSeq = seq;
    } else {
      onWriteFailed(failure.error);
    }
    if (state.pendingVersion === version) {
      state.pendingVersion = null;
      state.pendingValue = null;
    }
    if (state.drainRequested) {
      const origin = state.drainOrigin;
      state.drainRequested = false;
      state.drainOrigin = null;
      if (origin === "leave") leaveField(field);
      else commitFieldNow(field);
    }
    notify();
  }

  function requestDrain(field: BackupDayField, origin: "blur" | "leave"): void {
    const state = fields[field];
    state.drainRequested = true;
    state.drainOrigin =
      origin === "leave" || state.drainOrigin === "leave" ? "leave" : "blur";
  }

  function commitFieldNow(field: BackupDayField): void {
    const state = fields[field];
    const built = buildBackupDaysFieldPatch(field, state.latestText);
    if (!built.ok) {
      state.error = built.error;
      return;
    }
    const passes = gate(state);
    if (state.pendingVersion !== null) {
      if (passes) requestDrain(field, "blur");
      return;
    }
    if (passes) {
      startWrite(field);
      return;
    }
    // Valid and unchanged (or already written): nothing to write.
    state.committedVersion = state.typedVersion;
  }

  function leaveField(field: BackupDayField): void {
    const state = fields[field];
    if (state.typedVersion === state.leaveAttemptedVersion) return;
    if (state.pendingVersion !== null) {
      requestDrain(field, "leave");
      return;
    }
    if (!gate(state)) return;
    state.leaveAttemptedVersion = state.typedVersion;
    startWrite(field);
  }

  return {
    getSnapshot: () => snapshot,
    fieldState: (field) => ({ ...fields[field] }),
    attach(listener) {
      resetIdleFields();
      listeners.add(listener);
      notify();
      return () => {
        listeners.delete(listener);
      };
    },
    changeText(field, text) {
      const state = fields[field];
      state.latestText = text;
      state.typedVersion += 1;
      state.error = null;
      state.leaveAttemptedVersion = null;
      if (state.drainOrigin === "leave") state.drainOrigin = "blur";
      notify();
    },
    commitField(field) {
      commitFieldNow(field);
      notify();
    },
    focus() {
      resetIdleFields();
      notify();
    },
    leave() {
      for (const field of DAY_FIELDS) leaveField(field);
      notify();
    },
    beginRead() {
      seq += 1;
      return seq;
    },
    loaded(readStartedSeq, values) {
      const next: Record<BackupDayField, number> = {
        interval: values.backupIntervalDays,
        retention: values.backupRetentionDays,
      };
      for (const field of DAY_FIELDS) {
        const state = fields[field];
        if (
          !shouldReseedDayField({
            typedVersion: state.typedVersion,
            committedVersion: state.committedVersion,
            pendingVersion: state.pendingVersion,
            readStartedSeq,
            lastCommitSeq: state.lastCommitSeq,
          })
        ) {
          continue;
        }
        state.latestText = String(next[field]);
        state.savedValue = next[field];
        state.error = null;
      }
      notify();
    },
  };
}

export type EncryptionSetupResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: "Enter a passphrase." | "Passphrases don't match.";
    };

/** Never return a passphrase; this is validation-only view state. */
export function validateEncryptionSetup(
  passphrase: string,
  confirmation: string,
): EncryptionSetupResult {
  if (!passphrase) return { ok: false, error: "Enter a passphrase." };
  if (passphrase !== confirmation) {
    return { ok: false, error: "Passphrases don't match." };
  }
  return { ok: true };
}

/**
 * 38.6 D-39 (review WR5-03): the copy for an over-cap source during a
 * re-encrypting passphrase change. Same tone as the other "too large" copy.
 */
export const REENCRYPTION_TOO_LARGE_COPY =
  "An automatic backup in your folder is too large to re-encrypt, so your passphrase wasn't changed. You can still use the new passphrase for future backups only.";

/** The inline error for a passphrase change that didn't finish. */
export function encryptionErrorCopy(status: string): string {
  if (status === "wrong-current-passphrase")
    return "That passphrase doesn't match your current backup protection.";
  if (status === "too-large") return REENCRYPTION_TOO_LARGE_COPY;
  return "Orbit couldn't safely re-encrypt every accessible automatic backup. Reconnect the folder and try again.";
}

export interface BackupSettingsPresentation {
  /** Render the folder and encryption groups at all. */
  readonly showGroups: boolean;
  /** Null while settings are unknown — never a default "off" (D-24). */
  readonly encryptionSummary: "on" | "off" | null;
  readonly folderConfigured: boolean;
  readonly folderAccessible: boolean;
}

/**
 * Which backup-settings state the screen may present (38.3 RG-035, D-24).
 * Everything is hidden/false/null unless the settings read has succeeded: an
 * unread or unreadable settings row must never render as "Off — backups are
 * readable JSON", a folder state, or the passphrase-setup flow, because the
 * user decides whether backups need protection from what this screen claims.
 * Presentation only — encryption itself is untouched.
 */
export function backupSettingsPresentation(
  phase: ReadPhase<AppSettings>,
): BackupSettingsPresentation {
  if (phase.phase !== "loaded") {
    return {
      showGroups: false,
      encryptionSummary: null,
      folderConfigured: false,
      folderAccessible: false,
    };
  }
  const settings = phase.data;
  return {
    showGroups: true,
    encryptionSummary: settings.encryptionEnabled === 1 ? "on" : "off",
    folderConfigured:
      settings.backupFolderUri !== null &&
      settings.backupFolderUri !== undefined,
    folderAccessible: settings.backupFolderAccessible === 1,
  };
}

export type CommitThenRefreshOutcome =
  | "committed"
  | "nothing-committed"
  | "commit-failed";

export interface CommitThenRefreshSteps {
  /** The write. Resolve `false` when nothing was written (e.g. picker cancelled). */
  readonly commit: () => Promise<boolean>;
  /** The post-write re-read; MUST never reject (use `runGatedRead`). */
  readonly refresh: () => Promise<void>;
  /** Report a failed WRITE (error snackbar / inline error). Never sees a re-read failure. */
  readonly onCommitFailed: (error: unknown) => void;
}

/**
 * Commit, then await the re-read (38.3 D-04). The re-read sits OUTSIDE the
 * write's catch, so a failed re-read after a committed write can only surface
 * as the read-error state — it is never reported as a failed write and the
 * write is never retried. The handler resolves only after the re-read settles.
 */
export async function commitThenRefresh(
  steps: CommitThenRefreshSteps,
): Promise<CommitThenRefreshOutcome> {
  let wrote: boolean;
  try {
    wrote = await steps.commit();
  } catch (error) {
    steps.onCommitFailed(error);
    return "commit-failed";
  }
  if (!wrote) return "nothing-committed";
  await steps.refresh();
  return "committed";
}

/** The slice of React Native's `AppState` the background flush needs. */
export interface AppStateLike {
  addEventListener(
    type: "change",
    listener: (state: string) => void,
  ): { remove(): void };
}

/**
 * D-34 leave-flush on backgrounding (38.9-06, folding 38.9-03's out-of-scope
 * finding #1): pressing Home with a day field still focused fires no blur,
 * focus loss, Back or unmount, so a typed value would be lost if Android then
 * kills the app. Going to `background` is one more leave site and runs the
 * controller's own `leave()` (same gate and validation, same error path, no
 * write for invalid text). Returns the unsubscribe, for the screen's unmount.
 */
export function subscribeBackgroundLeaveFlush(
  appState: AppStateLike,
  controller: Pick<BackupDayController, "leave">,
): () => void {
  const subscription = appState.addEventListener("change", (state) => {
    if (state === "background") controller.leave();
  });
  return () => subscription.remove();
}
