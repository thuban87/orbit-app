import { beforeEach, describe, expect, it, vi } from "vitest";
import { shellTransientStore } from "./shell-transient-store";

beforeEach(() => {
  shellTransientStore.setState({ entries: [] });
});

describe("shellTransientStore", () => {
  it("dismisses the topmost registered overlay by invoking its close callback", () => {
    const firstDismiss = vi.fn();
    const secondDismiss = vi.fn();
    const store = shellTransientStore.getState();

    store.openTransient("first", firstDismiss);
    store.openTransient("second", secondDismiss);

    expect(store.dismissTop()).toBe(true);
    expect(secondDismiss).toHaveBeenCalledOnce();
    expect(firstDismiss).not.toHaveBeenCalled();
    expect(shellTransientStore.getState().entries.map((entry) => entry.id)).toEqual([
      "first",
    ]);

    expect(shellTransientStore.getState().dismissTop()).toBe(true);
    expect(firstDismiss).toHaveBeenCalledOnce();
    expect(shellTransientStore.getState().dismissTop()).toBe(false);
  });

  it("replaces a duplicate overlay callback without duplicating its layer", () => {
    const originalDismiss = vi.fn();
    const replacementDismiss = vi.fn();

    shellTransientStore.getState().openTransient("picker", originalDismiss);
    shellTransientStore.getState().openTransient("picker", replacementDismiss);

    expect(shellTransientStore.getState().entries).toHaveLength(1);
    shellTransientStore.getState().dismissTop();
    expect(originalDismiss).not.toHaveBeenCalled();
    expect(replacementDismiss).toHaveBeenCalledOnce();
  });
});
