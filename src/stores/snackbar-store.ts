import { create } from "zustand";

export type SnackbarKind = "success" | "error";

export interface SnackbarAction {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}

export interface SnackbarMessage {
  kind: SnackbarKind;
  label: string;
  action: SnackbarAction;
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
