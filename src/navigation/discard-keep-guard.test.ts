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

function mountGuard(hasUnsavedChanges: boolean, bypass = false) {
  nav.listener = null;
  const bypassRef = { current: bypass };
  // biome-ignore lint/correctness/useHookAtTopLevel: react is mocked; the hook runs as a plain function here.
  useDiscardKeepGuard({ hasUnsavedChanges, bypassRef });
  const fire = (action: unknown = { type: "GO_BACK" }) => {
    const event: BeforeRemoveEvent = {
      preventDefault: vi.fn(),
      data: { action },
    };
    (nav.listener as BeforeRemove | null)?.(event);
    return event;
  };
  return { fire, bypassRef };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  confirmStore.setState({ queue: [] });
  nav.dispatch.mockReset();
});

describe("decideGuardOnRemove (D-13)", () => {
  it("allows when bypassed or clean, prompts when dirty", () => {
    expect(decideGuardOnRemove({ hasUnsavedChanges: false, bypass: false })).toBe(
      "allow",
    );
    expect(decideGuardOnRemove({ hasUnsavedChanges: true, bypass: true })).toBe(
      "allow",
    );
    expect(decideGuardOnRemove({ hasUnsavedChanges: false, bypass: true })).toBe(
      "allow",
    );
    expect(decideGuardOnRemove({ hasUnsavedChanges: true, bypass: false })).toBe(
      "prompt",
    );
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
