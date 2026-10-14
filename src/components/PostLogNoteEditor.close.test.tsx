/**
 * Every non-save exit of the post-log Add Note sheet is dirty-aware (38.9
 * D-14, D-61; verification review WR-01). Back, the scrim and Cancel ask
 * "Discard changes?" when typed work would be lost, and close at once when it
 * would not. The sheet's "Also save to" picker (38.10 D-42, D-95) saves
 * through `saveNoteWithLinkedEntry` only when a section applies to a
 * non-blank note (convergence c10, Codex C-01).
 *
 * Render-free: the component runs as a plain function over mocked hooks, and
 * the returned element tree is searched for the controls. `useState` slots are
 * seeded BY NAME through `SLOT` (the SystemBuilderScreen.test.tsx harness), and
 * a self-check pins both the slot count and what each slot drives, so adding
 * or reordering a `useState` in PostLogNoteEditor fails loudly instead of
 * silently shifting every seeded value (verification IN-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  /** The next useState slot; reset by every render. */
  index: 0,
  /** Seeded values by slot; an unseeded slot gets its initial value. */
  seed: new Map<number, unknown>(),
  /** Each slot's initial value from the last render (the self-check). */
  initial: [] as unknown[],
  /** One setter spy per slot, kept across renders. */
  setters: [] as ReturnType<typeof vi.fn>[],
  savingRef: { current: false },
  discardAnswer: true,
  confirmDiscard: vi.fn(),
  /** Settles the pending readInteractionForEdit of an in-flight Save. */
  finishRead: (_seed: unknown): void => undefined,
}));

vi.mock("react", () => ({
  useCallback: <T,>(fn: T) => fn,
  useEffect: () => undefined,
  useRef: () => state.savingRef,
  useState: <T,>(initial: T) => {
    const slot = state.index;
    state.index += 1;
    // A function initial value is called, as React calls a lazy initialiser.
    const value =
      typeof initial === "function" ? (initial as () => T)() : initial;
    state.initial[slot] = value;
    if (!state.setters[slot]) state.setters[slot] = vi.fn();
    return [
      state.seed.has(slot) ? state.seed.get(slot) : value,
      state.setters[slot],
    ];
  },
}));
vi.mock("react-native", () => ({
  // D-146: the note box follows the keyboard; down in this harness.
  Keyboard: { isVisible: () => false, addListener: vi.fn() },
  StyleSheet: { create: (styles: unknown) => styles },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("./ui", () => ({
  AppText: "AppText",
  Button: "Button",
  Sheet: "Sheet",
}));
vi.mock("./AlsoSaveToPicker", () => ({ AlsoSaveToPicker: "AlsoSaveToPicker" }));
vi.mock("./PersonLine", () => ({ PersonLine: "PersonLine" }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("@/hooks/use-contact-header", () => ({ useContactHeader: () => null }));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: () => "2026-10-11 12:00:00",
}));
vi.mock("@/db/interaction-edit-read", () => ({
  readInteractionForEdit: () =>
    new Promise((resolve) => {
      state.finishRead = resolve;
    }),
}));
vi.mock("@/db/recency-dao", () => ({
  editTouchpointFull: vi.fn(),
  saveNoteWithLinkedEntry: vi.fn(),
}));
vi.mock("@/stores/shell-refresh-store", () => ({ bumpShellRefresh: vi.fn() }));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: vi.fn() }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));
vi.mock("@/navigation/discard-keep-guard", () => ({
  confirmDiscard: () => {
    state.confirmDiscard();
    return Promise.resolve(state.discardAnswer);
  },
}));

const { PostLogNoteEditor } = await import("./PostLogNoteEditor");
const recencyDao = await import("@/db/recency-dao");
const snackbarStore = await import("@/stores/snackbar-store");

interface Element {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown };
}

function find(node: unknown, type: unknown): Element[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  const element = node as Element;
  const own = element.type === type ? [element] : [];
  return [...own, ...find(element.props?.children, type)];
}

function button(tree: unknown, label: string): Element {
  const match = find(tree, "Button").find((b) => b.props?.label === label);
  if (!match) throw new Error(`no "${label}" button`);
  return match;
}

function press(element: Element, prop = "onPress"): void {
  const handler = element.props?.[prop];
  if (typeof handler !== "function") throw new Error(`missing ${prop}`);
  handler();
}

/** The interaction row `readInteractionForEdit` returns for a live log. */
const SEED = {
  id: 11,
  occurredAt: "2026-10-11 11:00:00",
  channel: "Call",
  direction: "outbound",
  connected: 1,
  quality: null,
  note: null,
  duration: null,
  allowAi: 0,
};

/** The rendered "Also save to" picker. */
function picker(tree: unknown): Element {
  const [match] = find(tree, "AlsoSaveToPicker");
  if (!match) throw new Error("no AlsoSaveToPicker");
  return match;
}

/** Choose a section (or None) on the rendered picker. */
function choose(tree: unknown, section: string | null): void {
  const handler = picker(tree).props?.onChange;
  if (typeof handler !== "function") throw new Error("no picker onChange");
  handler(section);
}

/** Type into the rendered note field. */
function typeNote(tree: unknown, next: string): void {
  const handler = find(tree, "TextInput")[0]?.props?.onChangeText;
  if (typeof handler !== "function") throw new Error("no onChangeText");
  handler(next);
}

/** PostLogNoteEditor's `useState` call order. Pinned by the slot self-check. */
const SLOT = {
  text: 0,
  error: 1,
  alsoSaveTo: 2,
  busy: 3,
  keyboardUp: 4,
} as const;
type SlotName = keyof typeof SLOT;

function render(view: Partial<Record<SlotName, unknown>>) {
  state.index = 0;
  state.seed = new Map(
    Object.entries(view)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [SLOT[key as SlotName], value]),
  );
  const onClose = vi.fn();
  const tree = PostLogNoteEditor({
    target: { interactionId: 11, contactId: 3 },
    onClose,
  });
  return { tree, onClose };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The string children of every AppText in the tree. */
function texts(tree: unknown): string[] {
  return find(tree, "AppText").flatMap((node) => {
    const children = node.props?.children;
    return typeof children === "string" ? [children] : [];
  });
}

describe("the useState slot map the seeding relies on (verification IN-03)", () => {
  beforeEach(() => {
    state.savingRef.current = false;
    state.discardAnswer = true;
    state.confirmDiscard.mockClear();
  });

  it("pins the slot count and each slot's initial value", () => {
    render({});
    expect(state.index).toBe(Object.keys(SLOT).length);
    expect(state.initial[SLOT.text]).toBe("");
    expect(state.initial[SLOT.error]).toBeNull();
    expect(state.initial[SLOT.alsoSaveTo]).toBeNull();
    expect(state.initial[SLOT.busy]).toBe(false);
    expect(state.initial[SLOT.keyboardUp]).toBe(false);
  });

  it("each slot drives what its name says", () => {
    // text → the note field's value.
    const typed = render({ text: "Coffee" });
    expect(find(typed.tree, "TextInput")[0]?.props?.value).toBe("Coffee");
    // error → the error caption and the Retry label.
    const failed = render({ error: "boom" });
    expect(texts(failed.tree)).toContain("boom");
    button(failed.tree, "Retry");
    // alsoSaveTo → the picker's value.
    expect(
      picker(render({ text: "x", alsoSaveTo: "gift_idea" }).tree).props?.value,
    ).toBe("gift_idea");
    // busy → the held controls draw disabled.
    expect(button(render({}).tree, "Save").props?.disabled).toBe(false);
    expect(button(render({ busy: true }).tree, "Save").props?.disabled).toBe(
      true,
    );
    // keyboardUp → the note box's height bounds (D-146).
    const boxStyle = (keyboardUp: boolean) =>
      Object.assign(
        {},
        ...((find(render({ keyboardUp }).tree, "TextInput")[0]?.props?.style ??
          []) as object[]),
      );
    expect(boxStyle(false)).toMatchObject({ minHeight: 84 });
    expect(boxStyle(false).maxHeight).toBeUndefined();
    expect(boxStyle(true)).toMatchObject({ minHeight: 48, maxHeight: 48 });
  });
});

describe("a held control looks disabled while a save runs (D-26; fix-pass WR-01)", () => {
  beforeEach(() => {
    state.savingRef.current = false;
    state.discardAnswer = true;
    state.confirmDiscard.mockClear();
    for (const setter of state.setters) setter?.mockClear();
  });

  it("Cancel, Save and the picker are enabled when idle and disabled while busy", () => {
    const labels = ["Cancel", "Save"];
    const idle = render({ text: "Coffee" });
    for (const label of labels) {
      expect(button(idle.tree, label).props?.disabled).toBe(false);
    }
    expect(picker(idle.tree).props?.disabled).toBe(false);
    const held = render({ text: "Coffee", busy: true });
    for (const label of labels) {
      expect(button(held.tree, label).props?.disabled).toBe(true);
    }
    expect(picker(held.tree).props?.disabled).toBe(true);
  });

  it("a note save sets busy beside the ref and clears it when it settles", async () => {
    const { tree } = render({ text: "Coffee" });
    press(button(tree, "Save"));
    expect(state.savingRef.current).toBe(true);
    expect(state.setters[SLOT.busy]).toHaveBeenLastCalledWith(true);
    state.finishRead(null);
    await flush();
    expect(state.savingRef.current).toBe(false);
    expect(state.setters[SLOT.busy]).toHaveBeenLastCalledWith(false);
  });
});

describe("the rebuilt sheet (38.10 D-42; F-18)", () => {
  it("has one action row, Cancel then Save, and no memory path", () => {
    const { tree } = render({ text: "Coffee" });
    const labels = find(tree, "Button").map((b) => b.props?.label);
    expect(labels).toEqual(["Cancel", "Save"]);
    expect(texts(tree)).toContain("Add Note");
    expect(find(tree, "ScrollView")).toHaveLength(0);
  });

  it("the picker sits under the note field and is disabled while the note is blank (c10 C-01)", () => {
    const blank = render({ text: "   " });
    expect(picker(blank.tree).props?.disabled).toBe(true);
    expect(picker(render({ text: "" }).tree).props?.disabled).toBe(true);
    expect(picker(render({ text: "x" }).tree).props?.disabled).toBe(false);
  });

  it("choosing a section sets the choice; a chosen section counts as work on close", async () => {
    for (const setter of state.setters) setter?.mockClear();
    state.confirmDiscard.mockClear();
    state.discardAnswer = false;
    const { tree } = render({ text: "Coffee" });
    choose(tree, "memory");
    expect(state.setters[SLOT.alsoSaveTo]).toHaveBeenLastCalledWith("memory");
    const chosen = render({ text: "Coffee", alsoSaveTo: "memory" });
    press(button(chosen.tree, "Cancel"));
    await flush();
    expect(state.confirmDiscard).toHaveBeenCalledOnce();
    expect(chosen.onClose).not.toHaveBeenCalled();
    state.discardAnswer = true;
  });
});

describe("Also save to on save (38.10 D-37, D-42, D-95; c10 C-01)", () => {
  beforeEach(() => {
    state.savingRef.current = false;
    state.discardAnswer = true;
    state.confirmDiscard.mockClear();
    for (const setter of state.setters) setter?.mockClear();
    vi.mocked(recencyDao.editTouchpointFull).mockReset();
    vi.mocked(recencyDao.saveNoteWithLinkedEntry).mockReset();
    vi.mocked(snackbarStore.showSnackbar).mockReset();
  });

  it("a note with a section saves through saveNoteWithLinkedEntry", async () => {
    vi.mocked(recencyDao.saveNoteWithLinkedEntry).mockResolvedValue({
      linkedEntry: null,
    });
    const { tree, onClose } = render({
      text: "  Coffee  ",
      alsoSaveTo: "gift_idea",
    });
    press(button(tree, "Save"));
    state.finishRead(SEED);
    await flush();
    expect(recencyDao.saveNoteWithLinkedEntry).toHaveBeenCalledOnce();
    const [, input, section] = vi.mocked(recencyDao.saveNoteWithLinkedEntry)
      .mock.calls[0];
    expect(section).toBe("gift_idea");
    expect(input).toMatchObject({
      interactionId: 11,
      contactId: 3,
      note: "Coffee",
      occurredAt: SEED.occurredAt,
      allowAi: 0,
    });
    expect(recencyDao.editTouchpointFull).not.toHaveBeenCalled();
    expect(snackbarStore.showSnackbar).toHaveBeenCalledWith({
      kind: "success",
      label: "Added note, also saved to Gift Ideas",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("a note with None saves through editTouchpointFull, as before", async () => {
    vi.mocked(recencyDao.editTouchpointFull).mockResolvedValue(
      undefined as never,
    );
    const { tree, onClose } = render({ text: "Coffee" });
    press(button(tree, "Save"));
    state.finishRead(SEED);
    await flush();
    expect(recencyDao.editTouchpointFull).toHaveBeenCalledOnce();
    expect(recencyDao.saveNoteWithLinkedEntry).not.toHaveBeenCalled();
    expect(snackbarStore.showSnackbar).toHaveBeenCalledWith({
      kind: "success",
      label: "Added note",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("type a note, choose a section, clear the note, Save: nothing is written and the sheet closes (c11 C-08)", async () => {
    // Type, then choose Gift Ideas.
    const typed = render({ text: "x" });
    choose(typed.tree, "gift_idea");
    expect(state.setters[SLOT.alsoSaveTo]).toHaveBeenLastCalledWith(
      "gift_idea",
    );
    // Clear the note: the choice resets to None.
    const chosen = render({ text: "x", alsoSaveTo: "gift_idea" });
    typeNote(chosen.tree, "");
    expect(state.setters[SLOT.text]).toHaveBeenLastCalledWith("");
    const reset = state.setters[SLOT.alsoSaveTo]?.mock.calls.at(-1)?.[0] as (
      prev: string | null,
    ) => string | null;
    expect(reset("gift_idea")).toBeNull();
    // Save with the blank note (and, defensively, a stale choice).
    const cleared = render({ text: "", alsoSaveTo: "gift_idea" });
    press(button(cleared.tree, "Save"));
    state.finishRead(SEED);
    await flush();
    expect(recencyDao.editTouchpointFull).not.toHaveBeenCalled();
    expect(recencyDao.saveNoteWithLinkedEntry).not.toHaveBeenCalled();
    expect(snackbarStore.showSnackbar).not.toHaveBeenCalled();
    expect(cleared.onClose).toHaveBeenCalledOnce();
  });

  it("a failed linked save keeps the sheet open with the error", async () => {
    vi.mocked(recencyDao.saveNoteWithLinkedEntry).mockRejectedValueOnce(
      new Error("disk"),
    );
    const { tree, onClose } = render({
      text: "Coffee",
      alsoSaveTo: "last_talked_about",
    });
    press(button(tree, "Save"));
    state.finishRead(SEED);
    await flush();
    expect(state.setters[SLOT.error]).toHaveBeenLastCalledWith(
      "Couldn't save. Please try again.",
    );
    expect(snackbarStore.showSnackbar).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(state.savingRef.current).toBe(false);
  });
});

describe("Add Note's Cancel follows the Back rule (D-61; verification WR-01)", () => {
  beforeEach(() => {
    state.savingRef.current = false;
    state.discardAnswer = true;
    state.confirmDiscard.mockClear();
  });

  it("an empty note closes at once", () => {
    const { tree, onClose } = render({ text: "  " });
    press(button(tree, "Cancel"));
    expect(state.confirmDiscard).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("a typed note asks first; Keep editing stays, Discard closes", async () => {
    state.discardAnswer = false;
    const kept = render({ text: "Coffee" });
    press(button(kept.tree, "Cancel"));
    await flush();
    expect(state.confirmDiscard).toHaveBeenCalledOnce();
    expect(kept.onClose).not.toHaveBeenCalled();

    state.discardAnswer = true;
    const discarded = render({ text: "Coffee" });
    press(button(discarded.tree, "Cancel"));
    await flush();
    expect(discarded.onClose).toHaveBeenCalledOnce();
  });

  it("Cancel and Back share the same close", () => {
    const { tree } = render({ text: "Coffee" });
    const [sheet] = find(tree, "Sheet");
    expect(button(tree, "Cancel").props?.onPress).toBe(
      sheet?.props?.onRequestClose,
    );
  });
});

describe("a save in flight owns the close (verification IN-01)", () => {
  beforeEach(() => {
    state.savingRef.current = false;
    state.discardAnswer = true;
    state.confirmDiscard.mockClear();
  });

  it("Back, the scrim and Cancel open no prompt while the note is saving", async () => {
    const { tree, onClose } = render({ text: "Coffee" });
    press(button(tree, "Save"));
    expect(state.savingRef.current).toBe(true);
    press(find(tree, "Sheet")[0] as Element, "onRequestClose");
    press(button(tree, "Cancel"));
    await flush();
    expect(state.confirmDiscard).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // The interaction was undone meanwhile: the save fails softly, the sheet
    // stays open, and the exits ask again.
    state.finishRead(null);
    await flush();
    expect(state.savingRef.current).toBe(false);
    const after = render({ text: "Coffee" });
    press(button(after.tree, "Cancel"));
    await flush();
    expect(state.confirmDiscard).toHaveBeenCalledOnce();
  });
});
