import { create } from "zustand";

/**
 * What a snackbar reports (38.10 D-132, D-140): `success` is a notice (accent
 * pill); `warning` is a destructive result (a delete or a removal); `error` is
 * a failure, drawn as the warning pill (D-140) and announced as an alert
 * (38.9 D-72). `snackbar-host.ts` maps each kind to its look.
 */
export type SnackbarKind = "success" | "warning" | "error";

export interface SnackbarAction {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}

export interface SnackbarMessage {
  kind: SnackbarKind;
  label: string;
  action?: SnackbarAction;
  /**
   * Optional second action rendered AFTER the primary (e.g. Quick Log's "Add
   * Note" beside "Undo", CAPT-05). Single-action callers omit it and render
   * unchanged. Tapping either action dismisses the snackbar, so the two are
   * mutually exclusive per message.
   */
  secondaryAction?: SnackbarAction;
}

interface SnackbarStore {
  snackbar: SnackbarMessage | null;
  show: (message: SnackbarMessage) => void;
  dismiss: () => void;
}

let dismissTimer: ReturnType<typeof setTimeout> | undefined;

/** Shell-level transient feedback; intentionally in-memory and non-persisted. */
export const snackbarStore = create<SnackbarStore>()((set) => ({
  snackbar: null,
  show: (message) => {
    if (dismissTimer) clearTimeout(dismissTimer);
    set({ snackbar: message });
    dismissTimer = setTimeout(() => {
      set({ snackbar: null });
      dismissTimer = undefined;
    }, 6000);
  },
  dismiss: () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = undefined;
    set({ snackbar: null });
  },
}));

export const showSnackbar = (message: SnackbarMessage) =>
  snackbarStore.getState().show(message);
