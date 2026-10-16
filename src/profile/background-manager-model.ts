import type { SnackbarMessage } from "@/stores/snackbar-store";

export interface BackgroundManagerState {
  committedPath: string | null;
  pendingPath: string | null;
  activeToken: string | null;
  dirty: boolean;
  error: string | null;
}

export type BackgroundPreparationResult =
  | { ok: true; relativePath: string }
  | { ok: false; message: string };

export type BackgroundListState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "populated"; templateCount: number }
  | { kind: "error"; message: string; retry: true };

/** Keeps list feedback visible without conflating it with a crop draft failure. */
export function resolveBackgroundListState({
  loading,
  error,
  templateCount,
}: {
  loading: boolean;
  error: string | null;
  templateCount: number;
}): BackgroundListState {
  if (loading) return { kind: "loading" };
  if (error) return { kind: "error", message: error, retry: true };
  if (templateCount === 0) return { kind: "empty" };
  return { kind: "populated", templateCount };
}

export function createBackgroundManagerState(
  committedPath: string | null,
): BackgroundManagerState {
  return {
    committedPath,
    pendingPath: null,
    activeToken: null,
    dirty: false,
    error: null,
  };
}

/** Starts a new isolated crop attempt. A newer token makes prior work stale. */
export function beginBackgroundPreparation(
  state: BackgroundManagerState,
  token: string,
): BackgroundManagerState {
  return {
    ...state,
    activeToken: token,
    pendingPath: null,
    dirty: true,
    error: null,
  };
}

/** Only the active picker/crop attempt can publish a prepared derivative. */
export function finishBackgroundPreparation(
  state: BackgroundManagerState,
  token: string,
  result: BackgroundPreparationResult,
): BackgroundManagerState {
  if (state.activeToken !== token) return state;
  if (!result.ok) {
    return {
      ...state,
      activeToken: null,
      dirty: false,
      error: result.message,
    };
  }
  return {
    ...state,
    activeToken: null,
    pendingPath: result.relativePath,
    dirty: true,
    error: null,
  };
}

/** Cancel drops only draft state; durable bytes and the committed selection survive. */
export function cancelBackgroundPreparation(
  state: BackgroundManagerState,
): BackgroundManagerState {
  return {
    ...state,
    pendingPath: null,
    activeToken: null,
    dirty: false,
    error: null,
  };
}

export function retryBackgroundPreparation(
  state: BackgroundManagerState,
): { kind: "retry" } | { kind: "none" } {
  return state.error ? { kind: "retry" } : { kind: "none" };
}

export function requestBackgroundManagerDismissal(
  state: BackgroundManagerState,
): { kind: "close" } | { kind: "confirm-discard" } {
  return state.dirty ? { kind: "confirm-discard" } : { kind: "close" };
}

/** A clean reopen is a fresh manager visit; an unsaved crop must remain guarded. */
export function shouldResetBackgroundManagerViewOnOpen(
  state: BackgroundManagerState,
): boolean {
  return !state.dirty;
}

/**
 * The destructive database transaction must finish before any derived bytes
 * are cleaned up or the list is refreshed. Rejections intentionally reach the
 * UI caller so it can retain the current list and offer a retry.
 */
export async function deleteBackgroundTemplateAndRefresh(input: {
  removeTemplate: () => Promise<string | null>;
  removeDerivative: (relativePath: string) => void;
  refresh: () => Promise<void>;
  onCommitted?: () => void;
}): Promise<void> {
  const orphan = await input.removeTemplate();
  if (orphan) input.removeDerivative(orphan);
  await input.refresh();
  input.onCommitted?.();
}

/** A failed write (nothing was applied); the same copy as the Settings page. */
export const BACKGROUND_SAVE_ERROR =
  "Couldn't save your changes. Nothing was applied. Try again.";

/** The confirming snackbar after Assign (38.9 D-39, D-46: verb first, then whom). */
export function backgroundSetLabel(contactName: string): string {
  return `Background set for ${contactName}`;
}

/**
 * Whether a saved-background card is this person's own background (its
 * selected state in the Profile sheet). A Category or global background the
 * person inherits is not their own, so no card is marked for it.
 */
export function isContactBackground(
  templateUid: string,
  contactBackgroundTemplateUid: string | null,
): boolean {
  return templateUid === contactBackgroundTemplateUid;
}

/**
 * What the Profile background sheet needs to write one person's own
 * background. `write` is contact-scoped (it wraps
 * `assignContactBackgroundTemplate` for one contact; null clears) and rejects
 * on failure. Nothing here reads sheet state, so a closure built from these
 * still works after the sheet closes.
 */
export interface ContactBackgroundWriter {
  write: (templateUid: string | null) => Promise<void>;
  /** The host's reload after a durable write. */
  onCommitted?: () => void;
  notify: (message: SnackbarMessage) => void;
  logError: (message: string, error: unknown) => void;
}

/**
 * Assign in the Profile sheet (38.11 D-58.3, RESEARCH A2): applies the
 * background to this person at once, then reloads and confirms. Resolves
 * true when written; a failure shows the error snackbar and resolves false.
 */
export async function assignContactBackground(
  writer: ContactBackgroundWriter,
  input: { templateUid: string; contactName: string },
): Promise<boolean> {
  try {
    await writer.write(input.templateUid);
  } catch (error) {
    writer.logError("background assignment failed", error);
    writer.notify({ kind: "error", label: BACKGROUND_SAVE_ERROR });
    return false;
  }
  writer.onCommitted?.();
  writer.notify({
    kind: "success",
    label: backgroundSetLabel(input.contactName),
  });
  return true;
}

export const BACKGROUND_RESET_LABEL = "Background reset to default";
export const BACKGROUND_RESTORED_LABEL = "Background restored";
export const BACKGROUND_RESTORE_ERROR =
  "Couldn't restore the background. Try again.";

/**
 * Reset to default in the Profile's Background sheet (38.11 D-65, background
 * half): clears only this person's own background, so they fall back to their
 * Category, global or theme background. Their layout and open/closed sections
 * are untouched (presentation-only, ADR-108). The background stays in the
 * library, so it is reversible: it acts at once and the snackbar carries Undo
 * (38.9 D-30). Undo writes `previousUid` back through the same contact-scoped
 * `write`, reloads, and confirms with its own snackbar (38.9 D-39); an Undo
 * failure shows an error snackbar. A reset failure shows an error snackbar
 * with no Undo. The Undo closure holds only `writer` and `previousUid`, so it
 * still works after the sheet closes. Resolves true when the reset was written.
 */
export async function resetContactBackground(
  writer: ContactBackgroundWriter,
  input: { previousUid: string | null },
): Promise<boolean> {
  const { previousUid } = input;
  if (previousUid === null) return false;
  try {
    await writer.write(null);
  } catch (error) {
    writer.logError("background reset failed", error);
    writer.notify({ kind: "error", label: BACKGROUND_SAVE_ERROR });
    return false;
  }
  writer.onCommitted?.();
  writer.notify({
    kind: "warning",
    label: BACKGROUND_RESET_LABEL,
    action: {
      label: "Undo",
      accessibilityLabel: "Undo background reset",
      onPress: () => {
        void (async () => {
          try {
            await writer.write(previousUid);
          } catch (error) {
            writer.logError("background reset undo failed", error);
            writer.notify({ kind: "error", label: BACKGROUND_RESTORE_ERROR });
            return;
          }
          writer.onCommitted?.();
          writer.notify({ kind: "success", label: BACKGROUND_RESTORED_LABEL });
        })();
      },
    },
  });
  return true;
}
