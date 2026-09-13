/**
 * Shared one-tap Quick Log capture command.
 *
 * Consumers own their refs and inject side effects so the command preserves
 * per-instance single-flight semantics while remaining node-testable.
 */
export interface QuickLogUndoRequest {
  contactId: number;
  interactionId: number;
}

export interface QuickLogUndoController {
  undo(request: QuickLogUndoRequest): Promise<void> | null;
}

export interface QuickLogSnackbarAction {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}

export interface QuickLogSnackbar {
  kind: "success" | "error";
  label: string;
  action: {
    label: "Undo" | "Retry";
    accessibilityLabel: string;
    onPress: () => void;
  };
  /**
   * Optional second action on the SUCCESS snackbar: "Add Note" beside "Undo"
   * (CAPT-05). Undo (SHELL-11) is preserved; tapping either dismisses the
   * snackbar (mutual exclusion). Omitted on the failure snackbar.
   */
  secondaryAction?: QuickLogSnackbarAction;
}

export interface QuickLogInput {
  contactId: number;
  uid: string;
  occurredAt: string;
  now: string;
  channel: "unspecified";
  direction: "outbound";
  connected: 1;
  quality: null;
  source: "manual";
}

export interface RunQuickLogDeps {
  pendingRef: { current: boolean };
  undoController: QuickLogUndoController;
  recordTouchpoint: (input: QuickLogInput) => Promise<{ interactionId: number }>;
  localDateTime: () => string;
  newUid: () => string;
  showSnackbar: (snackbar: QuickLogSnackbar) => void;
  notifySuccessHaptic: () => void | Promise<void>;
  notifyWidgetDataChanged: () => void;
  bumpShellRefresh: () => void;
  /**
   * Opens the post-log Note/Memory editor bound to the just-created interaction
   * (CAPT-05). Invoked by the success snackbar's "Add Note" secondary action.
   */
  openPostLogEditor: (args: {
    interactionId: number;
    contactId: number;
  }) => void;
}

function undoQuickLog(
  deps: RunQuickLogDeps,
  contactId: number,
  interactionId: number,
): void {
  const deletion = deps.undoController.undo({ contactId, interactionId });
  if (!deletion) return;

  void deletion
    .then(() => {
      deps.notifyWidgetDataChanged();
      deps.bumpShellRefresh();
    })
    .catch(() => {
      deps.showSnackbar({
        kind: "error",
        label: "Couldn't undo",
        action: {
          label: "Retry",
          accessibilityLabel: "Retry undoing logged interaction",
          onPress: () => undoQuickLog(deps, contactId, interactionId),
        },
      });
    });
}

/**
 * Starts a Quick Log write unless this consumer already has one in flight.
 * This deliberately returns void: feedback, retry, and undo remain owned by
 * the command and its injected per-instance dependencies.
 */
export function runQuickLog(deps: RunQuickLogDeps, contactId: number): void {
  if (deps.pendingRef.current) return;
  deps.pendingRef.current = true;
  const stamp = deps.localDateTime();

  void deps
    .recordTouchpoint({
      contactId,
      uid: deps.newUid(),
      occurredAt: stamp,
      now: stamp,
      channel: "unspecified",
      direction: "outbound",
      connected: 1,
      quality: null,
      source: "manual",
    })
    .then(({ interactionId }) => {
      deps.showSnackbar({
        kind: "success",
        label: "Logged",
        action: {
          label: "Undo",
          accessibilityLabel: "Undo logged interaction",
          onPress: () => undoQuickLog(deps, contactId, interactionId),
        },
        secondaryAction: {
          label: "Add Note",
          accessibilityLabel: "Add a note to the logged interaction",
          onPress: () =>
            deps.openPostLogEditor({ interactionId, contactId }),
        },
      });
      void deps.notifySuccessHaptic();
      deps.notifyWidgetDataChanged();
      deps.bumpShellRefresh();
    })
    .catch(() => {
      deps.showSnackbar({
        kind: "error",
        label: "Couldn't log",
        action: {
          label: "Retry",
          accessibilityLabel: "Retry logging contact",
          onPress: () => runQuickLog(deps, contactId),
        },
      });
    })
    .finally(() => {
      deps.pendingRef.current = false;
    });
}
