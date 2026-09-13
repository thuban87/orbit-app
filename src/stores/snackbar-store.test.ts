import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type SnackbarMessage,
  snackbarStore,
} from "./snackbar-store";

function baseMessage(overrides: Partial<SnackbarMessage> = {}): SnackbarMessage {
  return {
    kind: "success",
    label: "Logged",
    action: {
      label: "Undo",
      accessibilityLabel: "Undo logged interaction",
      onPress: vi.fn(),
    },
    ...overrides,
  };
}

describe("snackbarStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    snackbarStore.getState().dismiss();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a single-action message with no secondaryAction (backward compatible)", () => {
    snackbarStore.getState().show(baseMessage());

    const snackbar = snackbarStore.getState().snackbar;
    expect(snackbar?.label).toBe("Logged");
    expect(snackbar?.action.label).toBe("Undo");
    expect(snackbar?.secondaryAction).toBeUndefined();
  });

  it("carries an optional secondaryAction when provided", () => {
    const onAddNote = vi.fn();
    snackbarStore.getState().show(
      baseMessage({
        secondaryAction: {
          label: "Add Note",
          accessibilityLabel: "Add a note to the logged interaction",
          onPress: onAddNote,
        },
      }),
    );

    const snackbar = snackbarStore.getState().snackbar;
    expect(snackbar?.action.label).toBe("Undo");
    expect(snackbar?.secondaryAction?.label).toBe("Add Note");
    snackbar?.secondaryAction?.onPress();
    expect(onAddNote).toHaveBeenCalledOnce();
  });

  it("auto-dismisses after the 6s timer regardless of action count", () => {
    snackbarStore.getState().show(
      baseMessage({
        secondaryAction: {
          label: "Add Note",
          accessibilityLabel: "Add a note",
          onPress: vi.fn(),
        },
      }),
    );
    expect(snackbarStore.getState().snackbar).not.toBeNull();

    vi.advanceTimersByTime(6000);
    expect(snackbarStore.getState().snackbar).toBeNull();
  });

  it("dismiss clears the message immediately", () => {
    snackbarStore.getState().show(baseMessage());
    snackbarStore.getState().dismiss();
    expect(snackbarStore.getState().snackbar).toBeNull();
  });
});
