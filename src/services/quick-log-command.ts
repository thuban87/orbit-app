/**
 * Shared one-tap Quick Log capture command.
 *
 * Consumers own their refs and inject side effects so the command preserves
 * per-instance single-flight semantics while remaining node-testable.
 *
 * CHANNEL (D-09, owner-ratified 34 follow-up): Quick Log seeds the interaction's
 * channel from the Default Interaction Channel preference via the shared pure
 * `resolveInitialChannel` — a fixed preference selects that channel, the
 * `remember` sentinel reads the remembered value (Message fallback). Quick Log
 * CONSUMES the resolved default but NEVER writes `remembered_interaction_channel`
 * back: the remembered value stays the "last actively-chosen ordinary-save
 * channel" owned solely by the detailed Log Interaction screen.
 *
 * FEEDBACK (38.14 D-63, D-38, D-39): the success snackbar uses the one logging
 * pattern, "Logged <Channel> with <Name>" (`loggedInteractionSnackbar`), built
 * from the SAME resolved channel just written. A successful Undo confirms with
 * a warning-kind snackbar (a destructive result) naming what was undone.
 */
import type {
  DefaultInteractionChannel,
  RememberedInteractionChannel,
} from "@/db/app-settings-dao";
import { loggedInteractionSnackbar } from "@/logic/also-save-to-logic";
import { resolveInitialChannel } from "@/screens/log-interaction-logic";

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
  /** `warning` is the Undo confirmation (a destructive result, 38.10 D-132). */
  kind: "success" | "warning" | "error";
  label: string;
  /** Omitted on the Undo confirmation (38.14 D-38). */
  action?: {
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
  /** Resolved from the Default Interaction Channel preference (D-09). */
  channel: string;
  direction: "outbound";
  connected: 1;
  quality: null;
  source: "manual";
}

/** The two channel-preference columns Quick Log resolves its channel from. */
export interface QuickLogChannelPreference {
  pref: DefaultInteractionChannel;
  remembered: RememberedInteractionChannel | null;
}

export interface RunQuickLogDeps {
  pendingRef: { current: boolean };
  undoController: QuickLogUndoController;
  recordTouchpoint: (
    input: QuickLogInput,
  ) => Promise<{ interactionId: number }>;
  /**
   * Read the two channel-preference columns Quick Log seeds its channel from
   * (the SAME `app-settings` reads the detailed Log Interaction screen uses).
   * Consumers own the read + a fallback so a settings-read failure never blocks
   * the immediate write (local-first, no network on this read path).
   */
  readChannelPreference: () => Promise<QuickLogChannelPreference>;
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

/**
 * The person Quick Log names in its snackbar: a known name, null (name only the
 * channel), or a lazy local read the command resolves inside its in-flight
 * guard (38.14 R5-01) so a consumer never awaits before taking the guard.
 */
export type QuickLogPersonName = string | null | (() => Promise<string | null>);

/** Resolves a person name; never rejects (a failed or empty read is null). */
function resolvePersonName(
  personName: QuickLogPersonName,
): Promise<string | null> {
  if (typeof personName !== "function") return Promise.resolve(personName);
  let read: Promise<string | null>;
  try {
    read = personName();
  } catch {
    return Promise.resolve(null);
  }
  return Promise.resolve(read).then(
    (name) => name ?? null,
    () => null,
  );
}

/** The Undo confirmation (38.14 D-38): what was undone, channel and person. */
function undidQuickLogLabel(
  channel: string,
  personName: string | null,
): string {
  const whom = personName ? ` with ${personName}` : "";
  return `Undid ${channel}${whom}`;
}

function undoQuickLog(
  deps: RunQuickLogDeps,
  contactId: number,
  interactionId: number,
  channel: string,
  personName: string | null,
): void {
  const deletion = deps.undoController.undo({ contactId, interactionId });
  if (!deletion) return;

  void deletion
    .then(() => {
      deps.notifyWidgetDataChanged();
      deps.bumpShellRefresh();
      deps.showSnackbar({
        kind: "warning",
        label: undidQuickLogLabel(channel, personName),
      });
    })
    .catch(() => {
      deps.showSnackbar({
        kind: "error",
        label: "Couldn't undo",
        action: {
          label: "Retry",
          accessibilityLabel: "Retry undoing logged interaction",
          onPress: () =>
            undoQuickLog(deps, contactId, interactionId, channel, personName),
        },
      });
    });
}

/**
 * Starts a Quick Log write unless this consumer already has one in flight.
 * This deliberately returns void: feedback, retry, and undo remain owned by
 * the command and its injected per-instance dependencies.
 *
 * `personName` may be lazy: it is read only after the guard is taken, beside
 * the channel read, so a second tap while the first is in flight records
 * nothing (R5-01). A failed name read names only the channel; it never blocks
 * the write.
 */
export function runQuickLog(
  deps: RunQuickLogDeps,
  contactId: number,
  personName: QuickLogPersonName,
): void {
  if (deps.pendingRef.current) return;
  deps.pendingRef.current = true;
  const stamp = deps.localDateTime();
  const namePromise = resolvePersonName(personName);
  // Retry reuses the resolved name once the read settles; until then it is
  // passed on as given (the retry is itself guarded).
  let retryName: QuickLogPersonName = personName;
  void namePromise.then((value) => {
    retryName = value;
  });

  void Promise.all([deps.readChannelPreference(), namePromise])
    .then(async ([{ pref, remembered }, name]) => {
      // Consume the resolved default channel (D-09, D-63); do NOT write
      // remembered back — the detailed Log Interaction screen owns that write.
      const channel = resolveInitialChannel(pref, remembered);
      const { interactionId } = await deps.recordTouchpoint({
        contactId,
        uid: deps.newUid(),
        occurredAt: stamp,
        now: stamp,
        channel,
        direction: "outbound",
        connected: 1,
        quality: null,
        source: "manual",
      });
      return { interactionId, channel, name };
    })
    .then(({ interactionId, channel, name }) => {
      deps.showSnackbar({
        kind: "success",
        label: loggedInteractionSnackbar({
          channel,
          personName: name,
          section: null,
        }),
        action: {
          label: "Undo",
          accessibilityLabel: "Undo logged interaction",
          onPress: () =>
            undoQuickLog(deps, contactId, interactionId, channel, name),
        },
        secondaryAction: {
          label: "Add Note",
          accessibilityLabel: "Add a note to the logged interaction",
          onPress: () => deps.openPostLogEditor({ interactionId, contactId }),
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
          onPress: () => runQuickLog(deps, contactId, retryName),
        },
      });
    })
    .finally(() => {
      deps.pendingRef.current = false;
    });
}
