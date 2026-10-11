import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmStore } from "@/stores/confirm-store";

type BeforeRemoveEvent = {
  preventDefault: () => void;
  data: { action: unknown };
};
type BeforeRemove = (event: BeforeRemoveEvent) => void;

const nav = vi.hoisted(() => ({
  listener: null as ((event: unknown) => void) | null,
  dispatch: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => undefined | (() => void)) => {
    effect();
  },
  useRef: <T>(value: T) => ({ current: value }),
}));
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    addListener: (_name: string, callback: (event: unknown) => void) => {
      nav.listener = callback;
      return () => {};
    },
    dispatch: nav.dispatch,
  }),
}));

const { confirmDiscard, decideGuardOnRemove, useDiscardKeepGuard } =
  await import("./discard-keep-guard");

type SubEditor = { open: boolean; dirty: boolean; close: () => void };

function mountGuard(
  hasUnsavedChanges: boolean,
  bypass = false,
  subEditor?: SubEditor,
) {
  nav.listener = null;
  const bypassRef = { current: bypass };
  // biome-ignore lint/correctness/useHookAtTopLevel: react is mocked; the hook runs as a plain function here.
  const { requestClose } = useDiscardKeepGuard({
    hasUnsavedChanges,
    bypassRef,
    subEditor,
  });
  const fire = (action: unknown = { type: "GO_BACK" }) => {
    const event: BeforeRemoveEvent = {
      preventDefault: vi.fn(),
      data: { action },
    };
    (nav.listener as BeforeRemove | null)?.(event);
    return event;
  };
  return { fire, bypassRef, requestClose };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  confirmStore.setState({ queue: [] });
  nav.dispatch.mockReset();
});

describe("decideGuardOnRemove (D-13, D-14)", () => {
  const back = { actionType: "GO_BACK" };

  it("allows when bypassed or clean, prompts to leave when dirty", () => {
    expect(
      decideGuardOnRemove({ ...back, hasUnsavedChanges: false, bypass: false }),
    ).toBe("allow");
    expect(
      decideGuardOnRemove({ ...back, hasUnsavedChanges: true, bypass: true }),
    ).toBe("allow");
    expect(
      decideGuardOnRemove({ ...back, hasUnsavedChanges: false, bypass: true }),
    ).toBe("allow");
    expect(
      decideGuardOnRemove({ ...back, hasUnsavedChanges: true, bypass: false }),
    ).toBe("prompt-leave");
  });

  it("bypass wins for every action type, even with a dirty open sub-editor", () => {
    for (const actionType of ["GO_BACK", "POP", "RESET", "NAVIGATE"]) {
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: true,
          hasUnsavedChanges: true,
          subEditorOpen: true,
          subEditorDirty: true,
        }),
      ).toBe("allow");
    }
  });

  it("Back (GO_BACK / POP) closes an open sub-editor first (D-14)", () => {
    for (const actionType of ["GO_BACK", "POP"]) {
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: true,
          subEditorOpen: true,
          subEditorDirty: false,
        }),
      ).toBe("close-sub-editor");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: false,
          subEditorOpen: true,
          subEditorDirty: true,
        }),
      ).toBe("prompt-close-sub-editor");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: true,
          subEditorOpen: false,
          subEditorDirty: false,
        }),
      ).toBe("prompt-leave");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: false,
          subEditorOpen: false,
          subEditorDirty: false,
        }),
      ).toBe("allow");
    }
  });

  it("any other removal never closes a sub-editor (review C6-H1)", () => {
    for (const actionType of ["RESET", "NAVIGATE", "POP_TO_TOP", "REPLACE"]) {
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: false,
          subEditorOpen: true,
          subEditorDirty: false,
        }),
      ).toBe("allow");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: false,
          subEditorOpen: true,
          subEditorDirty: true,
        }),
      ).toBe("prompt-leave");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: true,
          subEditorOpen: false,
        }),
      ).toBe("prompt-leave");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: false,
        }),
      ).toBe("allow");
    }
  });
});

describe("confirmDiscard() (D-13, D-52)", () => {
  it("enqueues the themed Discard changes? prompt", () => {
    void confirmDiscard();
    const [entry] = confirmStore.getState().queue;
    expect(entry.kind).toBe("confirm");
    expect(entry.request).toEqual({
      title: "Discard changes?",
      message: "Your unsaved changes will be lost.",
      cancelLabel: "Keep editing",
      confirmLabel: "Discard changes",
      destructive: true,
      headingGlyph: false,
    });
  });

  it("resolves true on Discard changes and false on Keep editing", async () => {
    const discard = confirmDiscard();
    confirmStore.getState().resolveCurrent(true);
    await expect(discard).resolves.toBe(true);
    const keep = confirmDiscard();
    confirmStore.getState().resolveCurrent(false);
    await expect(keep).resolves.toBe(false);
  });

  it("is non-dismissable: Back on the prompt does nothing", () => {
    void confirmDiscard();
    confirmStore.getState().dismissCurrent();
    expect(confirmStore.getState().queue).toHaveLength(1);
  });

  it("is single-flight: a second call while one is pending resolves false and enqueues nothing", async () => {
    const first = confirmDiscard();
    const second = confirmDiscard();
    await expect(second).resolves.toBe(false);
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await expect(first).resolves.toBe(true);
    // Once the first resolves, the next call prompts again.
    void confirmDiscard();
    expect(confirmStore.getState().queue).toHaveLength(1);
  });

  it("is not blocked by an unrelated confirm in the queue", () => {
    confirmStore.getState().enqueue({
      kind: "confirm",
      request: { title: "Other", confirmLabel: "OK" },
      resolve: () => {},
    });
    void confirmDiscard();
    expect(confirmStore.getState().queue).toHaveLength(2);
  });
});

describe("useDiscardKeepGuard (D-13, D-14)", () => {
  it("lets a clean form leave at once", () => {
    const { fire } = mountGuard(false);
    const event = fire();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });

  it("lets a bypassed save leave without a prompt", () => {
    const { fire } = mountGuard(true, true);
    const event = fire();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });

  it("prompts on a dirty form and dispatches the removal only on Discard changes", async () => {
    const { fire } = mountGuard(true);
    const action = { type: "GO_BACK" };
    const event = fire(action);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(nav.dispatch).toHaveBeenCalledWith(action);
  });

  it("stays on Keep editing", async () => {
    const { fire } = mountGuard(true);
    fire();
    confirmStore.getState().resolveCurrent(false);
    await flush();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("dedupes a double Back: both are prevented, one prompt; after it resolves Back prompts again", async () => {
    const { fire } = mountGuard(true);
    const first = fire();
    const second = fire();
    expect(first.preventDefault).toHaveBeenCalledOnce();
    expect(second.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(false);
    await flush();
    const third = fire();
    expect(third.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(nav.dispatch).toHaveBeenCalledOnce();
  });
});

describe("useDiscardKeepGuard sub-editor variant (D-14)", () => {
  it("Back with a clean open sub-editor closes it and stays", () => {
    const close = vi.fn();
    const { fire } = mountGuard(true, false, {
      open: true,
      dirty: false,
      close,
    });
    const event = fire({ type: "GO_BACK" });
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(0);
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("Back with a dirty open sub-editor prompts; Discard closes it and stays", async () => {
    const close = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: true,
      close,
    });
    const event = fire({ type: "POP" });
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    expect(close).not.toHaveBeenCalled();
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(close).toHaveBeenCalledOnce();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("Keep editing leaves the dirty sub-editor open", async () => {
    const close = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: true,
      close,
    });
    fire();
    confirmStore.getState().resolveCurrent(false);
    await flush();
    expect(close).not.toHaveBeenCalled();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });
});

describe("useDiscardKeepGuard non-Back removals (review C6-H1)", () => {
  it("a RESET with a clean open sub-editor proceeds at once and closes nothing", () => {
    const close = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: false,
      close,
    });
    const event = fire({ type: "RESET" });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });

  it("a RESET with a dirty open sub-editor shows one prompt; Discard dispatches that RESET", async () => {
    const close = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: true,
      close,
    });
    const action = { type: "RESET", payload: { routes: [] } };
    const event = fire(action);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(close).not.toHaveBeenCalled();
    expect(nav.dispatch).toHaveBeenCalledOnce();
    expect(nav.dispatch).toHaveBeenCalledWith(action);
  });

  it("a RESET with a dirty open sub-editor and Keep editing dispatches nothing", async () => {
    const close = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: true,
      close,
    });
    fire({ type: "RESET" });
    confirmStore.getState().resolveCurrent(false);
    await flush();
    expect(nav.dispatch).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("a bypassed RESET is not prevented", () => {
    const close = vi.fn();
    const { fire } = mountGuard(true, true, { open: true, dirty: true, close });
    const event = fire({ type: "RESET" });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });
});

describe("useDiscardKeepGuard requestClose (D-61)", () => {
  it("a clean close runs at once with no prompt", () => {
    const { requestClose } = mountGuard(false);
    const close = vi.fn();
    requestClose(close, false);
    expect(close).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });

  it("a dirty close prompts and closes only on Discard changes", async () => {
    const { requestClose } = mountGuard(false);
    const close = vi.fn();
    requestClose(close, true);
    expect(close).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(close).toHaveBeenCalledOnce();
  });

  it("Keep editing does not close", async () => {
    const { requestClose } = mountGuard(false);
    const close = vi.fn();
    requestClose(close, true);
    confirmStore.getState().resolveCurrent(false);
    await flush();
    expect(close).not.toHaveBeenCalled();
  });

  it("while a prompt is pending, a second requestClose or Back queues nothing and closes nothing", async () => {
    const subClose = vi.fn();
    const { requestClose, fire } = mountGuard(true, false, {
      open: true,
      dirty: true,
      close: subClose,
    });
    const first = vi.fn();
    const second = vi.fn();
    requestClose(first, true);
    requestClose(second, true);
    const event = fire({ type: "GO_BACK" });
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    expect(subClose).not.toHaveBeenCalled();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });
});
