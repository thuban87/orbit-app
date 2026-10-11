/**
 * "Make this an event" title prompt at large text (38.4 D-72,
 * Plan 17 G1-f). At font_scale 2.0 on the Pixel 3a the Cancel / Create row
 * did not wrap, pushing Cancel off the left edge as an unlabelled sliver, and
 * the field had no keyboard submit. The prompt now uses the shared
 * ConfirmDialog actions (a row when both fit, stacked full-width when they do
 * not) and the keyboard's Done key creates the event.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  title: "",
  busy: false,
  discardAnswer: true,
  confirmDiscard: vi.fn(),
  savingRef: { current: false },
  /** The next useState slot; reset by every render. */
  index: 0,
  initial: [] as unknown[],
  setters: [] as ReturnType<typeof vi.fn>[],
}));

/** GroupTitlePromptSheet's `useState` call order, pinned by the slot test. */
const SLOT = { title: 0, busy: 1 } as const;

vi.mock("react", () => ({
  useEffect: () => undefined,
  useRef: () => state.savingRef,
  useState: <T,>(initial: T) => {
    const slot = state.index;
    state.index += 1;
    state.initial[slot] = initial;
    if (!state.setters[slot]) state.setters[slot] = vi.fn();
    const value = [state.title, state.busy][slot];
    return [value === undefined ? initial : value, state.setters[slot]];
  },
}));
vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  Sheet: "Sheet",
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({
  ConfirmActions: "ConfirmActions",
}));
vi.mock("@/theme", () => ({ useUnscopedTheme: () => ({ colors: {} }) }));
vi.mock("@/navigation/discard-keep-guard", () => ({
  confirmDiscard: () => {
    state.confirmDiscard();
    return Promise.resolve(state.discardAnswer);
  },
}));

const { GroupTitlePromptSheet } = await import("./GroupTitlePromptSheet");

interface Element {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown };
}

function find(node: unknown, type: unknown): Element[] {
  if (!node || typeof node !== "object") return [];
  const element = node as Element;
  const own = element.type === type ? [element] : [];
  const children = element.props?.children;
  const nested = Array.isArray(children)
    ? children.flatMap((child) => find(child, type))
    : find(children, type);
  return [...own, ...nested];
}

function call(element: Element | undefined, prop: string): void {
  const handler = element?.props?.[prop];
  if (typeof handler !== "function") throw new Error(`missing ${prop}`);
  handler();
}

function render(onConfirm = vi.fn(), onRequestClose = vi.fn()) {
  state.index = 0;
  const tree = GroupTitlePromptSheet({
    visible: true,
    onRequestClose,
    onConfirm,
  });
  return { tree, onConfirm, onRequestClose };
}

describe("GroupTitlePromptSheet (D-72)", () => {
  beforeEach(() => {
    state.title = "";
    state.busy = false;
    state.discardAnswer = true;
    state.confirmDiscard.mockClear();
    state.savingRef.current = false;
    for (const setter of state.setters) setter?.mockClear();
  });

  it("pins the useState call order the seeding relies on", () => {
    render();
    expect(state.index).toBe(Object.keys(SLOT).length);
    expect(state.initial[SLOT.title]).toBe("");
    expect(state.initial[SLOT.busy]).toBe(false);
  });

  it("uses the shared stacking actions, never a fixed row", () => {
    state.title = "Trip";
    const { tree, onConfirm, onRequestClose } = render();
    expect(find(tree, "Button")).toHaveLength(0);
    const [actions] = find(tree, "ConfirmActions");
    expect(actions?.props).toMatchObject({
      cancelLabel: "Cancel",
      confirmLabel: "Create event",
      destructive: false,
      confirmDisabled: false,
      cancelDisabled: false,
    });
    call(actions, "onConfirm");
    expect(onConfirm).toHaveBeenCalledWith("Trip");
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("Cancel with an empty title closes at once (D-61; verification WR-01)", () => {
    const { tree, onRequestClose } = render();
    call(find(tree, "ConfirmActions")[0], "onCancel");
    expect(state.confirmDiscard).not.toHaveBeenCalled();
    expect(onRequestClose).toHaveBeenCalledOnce();
  });

  it("Cancel with a typed title asks first, like Back (D-61; verification WR-01)", async () => {
    state.title = "Trip";
    state.discardAnswer = false;
    const kept = render();
    call(find(kept.tree, "ConfirmActions")[0], "onCancel");
    await Promise.resolve();
    expect(state.confirmDiscard).toHaveBeenCalledOnce();
    expect(kept.onRequestClose).not.toHaveBeenCalled();

    state.discardAnswer = true;
    const discarded = render();
    call(find(discarded.tree, "ConfirmActions")[0], "onCancel");
    await Promise.resolve();
    expect(discarded.onRequestClose).toHaveBeenCalledOnce();
  });

  it("keeps Create disabled for a blank title", () => {
    const [actions] = find(render().tree, "ConfirmActions");
    expect(actions?.props?.confirmDisabled).toBe(true);
  });

  it("creates the event from the keyboard's Done key with the trimmed title", () => {
    state.title = "  Book club  ";
    const { tree, onConfirm } = render();
    const [input] = find(tree, "TextInput");
    expect(input?.props?.returnKeyType).toBe("done");
    call(input, "onSubmitEditing");
    expect(onConfirm).toHaveBeenCalledWith("Book club");
  });

  it("Back or the scrim with an empty title closes at once (D-14)", () => {
    const { tree, onRequestClose } = render();
    const [sheet] = find(tree, "Sheet");
    call(sheet, "onRequestClose");
    expect(state.confirmDiscard).not.toHaveBeenCalled();
    expect(onRequestClose).toHaveBeenCalledOnce();
  });

  it("Back or the scrim with a typed title asks first (D-14; review CR-02)", async () => {
    state.title = "Trip";
    state.discardAnswer = false;
    const kept = render();
    call(find(kept.tree, "Sheet")[0], "onRequestClose");
    await Promise.resolve();
    expect(state.confirmDiscard).toHaveBeenCalledOnce();
    expect(kept.onRequestClose).not.toHaveBeenCalled();

    state.discardAnswer = true;
    const discarded = render();
    call(find(discarded.tree, "Sheet")[0], "onRequestClose");
    await Promise.resolve();
    expect(discarded.onRequestClose).toHaveBeenCalledOnce();
  });

  it("holds Back, the scrim and Cancel while the create is in flight (verification IN-01)", async () => {
    state.title = "Trip";
    let finish: () => void = () => undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { tree, onRequestClose } = render(onConfirm);
    const [actions] = find(tree, "ConfirmActions");
    call(actions, "onConfirm");
    call(find(tree, "Sheet")[0], "onRequestClose");
    call(actions, "onCancel");
    // A second Create while the first is pending is dropped, too.
    call(actions, "onConfirm");
    await Promise.resolve();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(state.confirmDiscard).not.toHaveBeenCalled();
    expect(onRequestClose).not.toHaveBeenCalled();

    // Once the create settles (here: it failed and the sheet stayed open),
    // the exits work again.
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    state.title = "";
    const after = render(onConfirm, onRequestClose);
    call(find(after.tree, "ConfirmActions")[0], "onCancel");
    expect(onRequestClose).toHaveBeenCalledOnce();
  });

  it("draws the held Cancel and Create event disabled while the create runs (D-26; fix-pass WR-01)", async () => {
    state.title = "Trip";
    let finish: () => void = () => undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    call(find(render(onConfirm).tree, "ConfirmActions")[0], "onConfirm");
    expect(state.setters[SLOT.busy]).toHaveBeenLastCalledWith(true);

    // The next render reads busy: both choices draw disabled.
    state.busy = true;
    const [held] = find(render(onConfirm).tree, "ConfirmActions");
    expect(held?.props).toMatchObject({
      confirmDisabled: true,
      cancelDisabled: true,
    });

    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.setters[SLOT.busy]).toHaveBeenLastCalledWith(false);
  });

  it("clears the disabled look when the host's create rejects", async () => {
    state.title = "Trip";
    const onConfirm = vi.fn(() => Promise.reject(new Error("boom")));
    call(find(render(onConfirm).tree, "ConfirmActions")[0], "onConfirm");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.setters[SLOT.busy]).toHaveBeenLastCalledWith(false);
  });

  it("releases the hold when the host's create rejects", async () => {
    state.title = "Trip";
    const onConfirm = vi.fn(() => Promise.reject(new Error("boom")));
    const { tree } = render(onConfirm);
    call(find(tree, "ConfirmActions")[0], "onConfirm");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.savingRef.current).toBe(false);
  });

  it("ignores the Done key for a blank title", () => {
    state.title = "   ";
    const { tree, onConfirm } = render();
    const [input] = find(tree, "TextInput");
    call(input, "onSubmitEditing");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("the Profile host lets the prompt's buttons take the first tap (D-72)", () => {
  it("sets keyboardShouldPersistTaps on the Profile ScrollView that the Modal sheet descends from", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const profile = readFileSync(
      join(__dirname, "../../screens/ContactProfileScreen.tsx"),
      "utf8",
    );
    const open = profile.indexOf("<ScrollView\n          ref={scrollRef}");
    expect(open).toBeGreaterThan(-1);
    const opener = profile.slice(open, profile.indexOf(">", open) + 1);
    expect(opener).toContain('keyboardShouldPersistTaps="handled"');
  });
});
