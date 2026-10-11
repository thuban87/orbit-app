/**
 * Every non-save exit of the post-log Add Note sheet is dirty-aware (38.9
 * D-14, D-61; verification review WR-01). Back, the scrim, Add Note's Cancel,
 * Edit Memory's Done and the Edit Memory form's own Cancel all ask "Discard
 * changes?" when typed work would be lost, and close at once when it would
 * not.
 *
 * Render-free: the component runs as a plain function over mocked hooks, and
 * the returned element tree is searched for the controls.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryRow } from "@/db/memories-read";

const state = vi.hoisted(() => ({
  /** useState values in call order; undefined → the initial value. */
  values: [] as unknown[],
  index: 0,
  savingRef: { current: false },
  discardAnswer: true,
  confirmDiscard: vi.fn(),
}));

vi.mock("react", () => ({
  useCallback: <T,>(fn: T) => fn,
  useEffect: () => undefined,
  useRef: () => state.savingRef,
  useState: <T,>(initial: T) => {
    const value = state.values[state.index];
    state.index += 1;
    return [value === undefined ? initial : value, vi.fn()];
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
  readInteractionForEdit: vi.fn(),
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

/** useState order: text, error, createdMemory, editingMemory, globalAi, memoryDraftDirty. */
function render(view: {
  text?: string;
  createdMemory?: MemoryRow | null;
  editingMemory?: boolean;
  memoryDraftDirty?: boolean;
}) {
  state.index = 0;
  state.values = [
    view.text,
    undefined,
    view.createdMemory,
    view.editingMemory,
    undefined,
    view.memoryDraftDirty,
  ];
  const onClose = vi.fn();
  const tree = PostLogNoteEditor({
    target: { interactionId: 11, contactId: 3 },
    onClose,
  });
  return { tree, onClose };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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
