/**
 * Every non-save exit of the post-log Add Note sheet is dirty-aware (38.9
 * D-14, D-61; verification review WR-01). Back, the scrim, Add Note's Cancel,
 * Edit Memory's Done and the Edit Memory form's own Cancel all ask "Discard
 * changes?" when typed work would be lost, and close at once when it would
 * not.
 *
 * Render-free: the component runs as a plain function over mocked hooks, and
 * the returned element tree is searched for the controls. `useState` slots are
 * seeded BY NAME through `SLOT` (the SystemBuilderScreen.test.tsx harness), and
 * a self-check pins both the slot count and what each slot drives, so adding
 * or reordering a `useState` in PostLogNoteEditor fails loudly instead of
 * silently shifting every seeded value (verification IN-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryRow } from "@/db/memories-read";

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
    state.initial[slot] = initial;
    if (!state.setters[slot]) state.setters[slot] = vi.fn();
    return [
      state.seed.has(slot) ? state.seed.get(slot) : initial,
      state.setters[slot],
    ];
  },
}));
vi.mock("react-native", () => ({
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("./ui", () => ({
  AppText: "AppText",
  Button: "Button",
  Sheet: "Sheet",
}));
vi.mock("./MemoryEditor", () => ({ MemoryEditor: "MemoryEditor" }));
vi.mock("./PersonLine", () => ({ PersonLine: "PersonLine" }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("@/hooks/use-contact-header", () => ({ useContactHeader: () => null }));
vi.mock("@/db/app-settings-dao", () => ({ getAppSettings: vi.fn() }));
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
vi.mock("@/db/memories-dao", () => ({
  addMemory: vi.fn(),
  deleteMemory: vi.fn(),
  editMemory: vi.fn(),
  restoreMemory: vi.fn(),
  setMemoryAllowAi: vi.fn(),
}));
vi.mock("@/db/memories-read", () => ({ listMemoriesForContact: vi.fn() }));
vi.mock("@/db/recency-dao", () => ({ editTouchpointFull: vi.fn() }));
vi.mock("@/logic/ai-enablement", () => ({ isAiMasterEnabled: () => false }));
vi.mock("@/stores/shell-refresh-store", () => ({ bumpShellRefresh: vi.fn() }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));
vi.mock("@/navigation/discard-keep-guard", () => ({
  confirmDiscard: () => {
    state.confirmDiscard();
    return Promise.resolve(state.discardAnswer);
  },
}));

const { PostLogNoteEditor } = await import("./PostLogNoteEditor");
const memoriesDao = await import("@/db/memories-dao");

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

const MEMORY = { id: 7, contact_id: 3 } as unknown as MemoryRow;

/** The MemoryEditor's `onCancelRequest` from a rendered Edit Memory view. */
function cancelRequestOf(tree: unknown): (close: () => void) => void {
  const handler = find(tree, "MemoryEditor")[0]?.props?.onCancelRequest;
  if (typeof handler !== "function") throw new Error("no onCancelRequest");
  return handler as (close: () => void) => void;
}

/** PostLogNoteEditor's `useState` call order. Pinned by the slot self-check. */
const SLOT = {
  text: 0,
  error: 1,
  createdMemory: 2,
  editingMemory: 3,
  globalAiEnabled: 4,
  memoryDraftDirty: 5,
  busy: 6,
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
    expect(state.initial[SLOT.createdMemory]).toBeNull();
    expect(state.initial[SLOT.editingMemory]).toBe(false);
    expect(state.initial[SLOT.globalAiEnabled]).toBe(false);
    expect(state.initial[SLOT.memoryDraftDirty]).toBe(false);
    expect(state.initial[SLOT.busy]).toBe(false);
  });

  it("each slot drives what its name says", async () => {
    // text → the note field's value.
    const typed = render({ text: "Coffee" });
    expect(find(typed.tree, "TextInput")[0]?.props?.value).toBe("Coffee");
    // error → the error caption and the Retry label.
    const failed = render({ error: "boom" });
    expect(texts(failed.tree)).toContain("boom");
    button(failed.tree, "Retry");
    // createdMemory → the "Memory saved" view.
    expect(texts(render({ createdMemory: MEMORY }).tree)).toContain(
      "Memory saved",
    );
    // editingMemory (with a created memory) → the Edit Memory view.
    const editing = render({ createdMemory: MEMORY, editingMemory: true });
    expect(texts(editing.tree)).toContain("Edit Memory");
    expect(find(editing.tree, "MemoryEditor")[0]?.props?.globalAiEnabled).toBe(
      false,
    );
    // globalAiEnabled → the editor's AI availability.
    const aiOn = render({
      createdMemory: MEMORY,
      editingMemory: true,
      globalAiEnabled: true,
    });
    expect(find(aiOn.tree, "MemoryEditor")[0]?.props?.globalAiEnabled).toBe(
      true,
    );
    // memoryDraftDirty → Done asks first (clean Done closes at once).
    press(button(editing.tree, "Done"));
    expect(state.confirmDiscard).not.toHaveBeenCalled();
    const dirty = render({
      createdMemory: MEMORY,
      editingMemory: true,
      memoryDraftDirty: true,
    });
    press(button(dirty.tree, "Done"));
    await flush();
    expect(state.confirmDiscard).toHaveBeenCalledOnce();
    // busy → the held controls draw disabled.
    expect(button(render({}).tree, "Save").props?.disabled).toBe(false);
    expect(button(render({ busy: true }).tree, "Save").props?.disabled).toBe(
      true,
    );
  });
});

describe("a held control looks disabled while a save runs (D-26; fix-pass WR-01)", () => {
  beforeEach(() => {
    state.savingRef.current = false;
    state.discardAnswer = true;
    state.confirmDiscard.mockClear();
    for (const setter of state.setters) setter?.mockClear();
  });

  it("Add Note's Cancel, Create Memory Instead and Save are enabled when idle and disabled while busy", () => {
    const labels = ["Cancel", "Create Memory Instead", "Save"];
    const idle = render({ text: "Coffee" });
    for (const label of labels) {
      expect(button(idle.tree, label).props?.disabled).toBe(false);
    }
    const held = render({ text: "Coffee", busy: true });
    for (const label of labels) {
      expect(button(held.tree, label).props?.disabled).toBe(true);
    }
  });

  it("Edit Memory's Done and the form's Cancel and Save are held while busy", () => {
    const edit = (busy: boolean) =>
      render({ createdMemory: MEMORY, editingMemory: true, busy });
    expect(button(edit(false).tree, "Done").props?.disabled).toBe(false);
    expect(find(edit(false).tree, "MemoryEditor")[0]?.props?.busy).toBe(false);
    expect(button(edit(true).tree, "Done").props?.disabled).toBe(true);
    expect(find(edit(true).tree, "MemoryEditor")[0]?.props?.busy).toBe(true);
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

describe("Edit Memory's Done and form Cancel are dirty-aware (D-14, D-61; verification WR-01)", () => {
  beforeEach(() => {
    state.savingRef.current = false;
    state.discardAnswer = true;
    state.confirmDiscard.mockClear();
  });

  const editView = (memoryDraftDirty: boolean) =>
    render({
      text: "Coffee",
      createdMemory: MEMORY,
      editingMemory: true,
      memoryDraftDirty,
    });

  it("Done with an untouched memory closes at once", () => {
    const { tree, onClose } = editView(false);
    press(button(tree, "Done"));
    expect(state.confirmDiscard).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Done with an edited memory asks before the edit is dropped", async () => {
    state.discardAnswer = false;
    const kept = editView(true);
    press(button(kept.tree, "Done"));
    await flush();
    expect(state.confirmDiscard).toHaveBeenCalledOnce();
    expect(kept.onClose).not.toHaveBeenCalled();

    state.discardAnswer = true;
    const discarded = editView(true);
    press(button(discarded.tree, "Done"));
    await flush();
    expect(discarded.onClose).toHaveBeenCalledOnce();
  });

  it("the form's own Cancel goes through onCancelRequest and asks only when edited", async () => {
    const closeClean = vi.fn();
    cancelRequestOf(editView(false).tree)(closeClean);
    expect(state.confirmDiscard).not.toHaveBeenCalled();
    expect(closeClean).toHaveBeenCalledOnce();

    state.discardAnswer = false;
    const dirty = editView(true);
    const requestCancel = cancelRequestOf(dirty.tree);
    const closeKept = vi.fn();
    requestCancel(closeKept);
    await flush();
    expect(state.confirmDiscard).toHaveBeenCalledOnce();
    expect(closeKept).not.toHaveBeenCalled();

    state.discardAnswer = true;
    const closeDiscarded = vi.fn();
    requestCancel(closeDiscarded);
    await flush();
    expect(closeDiscarded).toHaveBeenCalledOnce();
    // The form closes; the sheet itself stays open.
    expect(dirty.onClose).not.toHaveBeenCalled();
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

  it("Edit Memory's Done and form Cancel hold while a save is in flight", async () => {
    state.savingRef.current = true;
    const view = render({
      text: "Coffee",
      createdMemory: MEMORY,
      editingMemory: true,
      memoryDraftDirty: true,
    });
    press(button(view.tree, "Done"));
    const close = vi.fn();
    cancelRequestOf(view.tree)(close);
    await flush();
    expect(state.confirmDiscard).not.toHaveBeenCalled();
    expect(view.onClose).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("Delete, Restore and Allow AI wait for an in-flight save (fix-pass IN-01)", () => {
    vi.mocked(memoriesDao.deleteMemory).mockClear();
    vi.mocked(memoriesDao.restoreMemory).mockClear();
    vi.mocked(memoriesDao.setMemoryAllowAi).mockClear();
    const handlers = () => {
      const editor = find(
        render({ createdMemory: MEMORY, editingMemory: true }).tree,
        "MemoryEditor",
      )[0];
      return editor?.props as {
        onDelete: (id: number) => boolean;
        onRestore: (id: number) => void;
        onSetAllowAi: (id: number, allow: boolean) => boolean;
      };
    };
    state.savingRef.current = true;
    const held = handlers();
    // Reported as dropped, so MemoryEditor neither closes nor flips (third
    // fix pass IN-01).
    expect(held.onDelete(7)).toBe(false);
    held.onRestore(7);
    expect(held.onSetAllowAi(7, true)).toBe(false);
    expect(memoriesDao.deleteMemory).not.toHaveBeenCalled();
    expect(memoriesDao.restoreMemory).not.toHaveBeenCalled();
    expect(memoriesDao.setMemoryAllowAi).not.toHaveBeenCalled();

    // Idle, each one writes.
    state.savingRef.current = false;
    vi.mocked(memoriesDao.deleteMemory).mockResolvedValue(undefined as never);
    vi.mocked(memoriesDao.restoreMemory).mockResolvedValue(undefined as never);
    vi.mocked(memoriesDao.setMemoryAllowAi).mockResolvedValue(
      undefined as never,
    );
    const idle = handlers();
    expect(idle.onDelete(7)).toBe(true);
    idle.onRestore(7);
    expect(idle.onSetAllowAi(7, true)).toBe(true);
    expect(memoriesDao.deleteMemory).toHaveBeenCalledOnce();
    expect(memoriesDao.restoreMemory).toHaveBeenCalledOnce();
    expect(memoriesDao.setMemoryAllowAi).toHaveBeenCalledOnce();
  });

  it("the memory edit save claims the same slot, so a second Save is dropped", async () => {
    state.savingRef.current = true;
    const view = render({
      text: "Coffee",
      createdMemory: MEMORY,
      editingMemory: true,
    });
    const onEdit = find(view.tree, "MemoryEditor")[0]?.props?.onEdit;
    if (typeof onEdit !== "function") throw new Error("no onEdit");
    await expect(onEdit(7, {})).resolves.toBe(false);
  });
});

describe("a failed memory edit shows its error (fix-pass IN-04)", () => {
  beforeEach(() => {
    state.savingRef.current = false;
    state.discardAnswer = true;
    state.confirmDiscard.mockClear();
    for (const setter of state.setters) setter?.mockClear();
  });

  const editView = (view: Partial<Record<SlotName, unknown>> = {}) =>
    render({ createdMemory: MEMORY, editingMemory: true, ...view });

  it("a rejected edit sets the save-failed error and keeps the form open", async () => {
    vi.mocked(memoriesDao.editMemory).mockRejectedValueOnce(new Error("disk"));
    const onEdit = find(editView().tree, "MemoryEditor")[0]?.props?.onEdit;
    if (typeof onEdit !== "function") throw new Error("no onEdit");
    await expect(onEdit(7, {})).resolves.toBe(false);
    expect(state.setters[SLOT.error]).toHaveBeenLastCalledWith(
      "Couldn't save. Please try again.",
    );
    expect(state.savingRef.current).toBe(false);
  });

  it("renders the error under the Edit Memory heading in the danger colour", () => {
    const { tree } = editView({ error: "Couldn't save. Please try again." });
    const captions = find(tree, "AppText");
    const heading = captions.findIndex(
      (n) => n.props?.children === "Edit Memory",
    );
    const message = captions.findIndex(
      (n) => n.props?.children === "Couldn't save. Please try again.",
    );
    expect(heading).toBeGreaterThan(-1);
    expect(message).toBeGreaterThan(heading);
    expect(captions[message]?.props?.role).toBe("caption");
    expect(captions[message]?.props?.style).toHaveProperty("color");
    // No error, no caption.
    expect(texts(editView().tree)).not.toContain(
      "Couldn't save. Please try again.",
    );
  });

  it("closing the form clears the error with the draft it belonged to", () => {
    const close = vi.fn();
    cancelRequestOf(
      editView({ error: "Couldn't save. Please try again." }).tree,
    )(close);
    expect(close).toHaveBeenCalledOnce();
    expect(state.setters[SLOT.error]).toHaveBeenLastCalledWith(null);
  });
});
