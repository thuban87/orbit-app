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
