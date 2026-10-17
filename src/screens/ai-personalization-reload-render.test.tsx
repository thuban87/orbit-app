import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AI Personalization keeps a failed re-read apart from a failed write (38.9
 * third fix pass IN-02).
 *
 * `addSection` and `saveEditedSection` (and the import, reorder and delete
 * writes) used to `await load()` inside the write's `try`, so a re-read that
 * failed after a committed write showed "Couldn't add / save that section".
 * The draft was already cleared, so the user retyped it and wrote it twice.
 * The re-read now runs after the write's `try` with its own catch, which
 * shows the load error.
 *
 * A function-call render with a mocked React: `useState` slots are seeded by
 * call order and every setter is a spy. Child components are not invoked;
 * the test calls the `onSave` the screen hands its section editors.
 */

/** AIPersonalizationScreen's `useState` call order. Pinned below. */
const SLOT = {
  style: 0,
  savedStyle: 1,
  sections: 2,
  activeModel: 3,
  estimate: 4,
  recomputing: 5,
  message: 6,
  savingStyle: 7,
  savingSection: 8,
  reordering: 9,
  adding: 10,
  draftTitle: 11,
  draftBody: 12,
  editingUid: 13,
  sectionEditDirty: 14,
  deleteUid: 15,
} as const;
const SLOT_COUNT = 16;

const hooks = vi.hoisted(() => ({
  index: 0,
  seed: new Map<number, unknown>(),
  setters: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useEffect: () => {},
  useMemo: <T,>(factory: () => T) => factory(),
  useRef: <T,>(value: T) => ({ current: value }),
  useState: (value: unknown) => {
    const slot = hooks.index++;
    const initial =
      typeof value === "function" ? (value as () => unknown)() : value;
    if (!hooks.setters[slot]) hooks.setters[slot] = vi.fn();
    return [
      hooks.seed.has(slot) ? hooks.seed.get(slot) : initial,
      hooks.setters[slot],
    ];
  },
}));
vi.mock("react-native", () => ({
  AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
  findNodeHandle: vi.fn(),
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: {
    create: <T,>(styles: T) => styles,
    hairlineWidth: 1,
  },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("react-native-reorderable-list", () => ({
  NestedReorderableList: "NestedReorderableList",
  ScrollViewContainer: "ScrollViewContainer",
  useReorderableDrag: () => vi.fn(),
}));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: vi.fn() }));
vi.mock("expo-file-system", () => ({
  Directory: vi.fn(),
  File: vi.fn(),
  Paths: { document: "document" },
}));
vi.mock("@/ai/model-catalog-cache", () => ({ loadCachedCatalog: vi.fn() }));
vi.mock("@/ai/model-catalog-storage", () => ({
  createFileCatalogStorage: () => ({}),
}));
vi.mock("@/ai/model-registry", () => ({ resolveActiveCatalog: vi.fn() }));
vi.mock("@/ai/openrouter-catalog", () => ({
  loadCachedOpenRouterCatalog: vi.fn(),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/SegmentedControl", () => ({
  SegmentedControl: "SegmentedControl",
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  ConfirmDialog: "ConfirmDialog",
  MIN_TOUCH_TARGET: 44,
  OrbitSwitch: "OrbitSwitch",
}));
vi.mock("@/components/ui/AnchoredMenu", () => ({
  AnchoredMenu: "AnchoredMenu",
}));
vi.mock("@/components/ui/SettingsSectionCard", () => ({
  SettingsSectionCard: "SettingsSectionCard",
}));
vi.mock("@/db/ai-connections-dao", () => ({
  resolveActiveAiConnection: vi.fn(),
}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: () => "2026-10-11 12:00:00",
}));
const dao = vi.hoisted(() => ({
  createPersonalizationSection: vi.fn(),
  deletePersonalizationSection: vi.fn(),
  getWritingStyle: vi.fn(),
  importPersonalizationSection: vi.fn(),
  listPersonalizationSections: vi.fn(),
  reorderPersonalizationSections: vi.fn(),
  replacePersonalizationSectionFromImport: vi.fn(),
  setPersonalizationSectionEnabled: vi.fn(),
  updatePersonalizationSection: vi.fn(),
  updateWritingStyle: vi.fn(),
}));
vi.mock("@/db/personalization-dao", () => dao);
vi.mock("@/navigation/discard-keep-guard", () => ({
  useDiscardKeepGuard: () => ({ requestClose: vi.fn(), settleHold: vi.fn() }),
}));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 96,
}));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: vi.fn() }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { resolveActiveAiConnection } = await import("@/db/ai-connections-dao");
const { AIPersonalizationScreen } = await import("./AIPersonalizationScreen");

type TestElement = ReactElement<Record<string, unknown>>;
/**
 * Every element in the tree. The section list's rows come from its
 * `renderItem`, so each row element (and its children) is expanded here.
 */
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  const rows =
    element.type === "NestedReorderableList"
      ? (element.props.data as unknown[]).map((item, index) =>
          (
            element.props.renderItem as (info: {
              item: unknown;
              index: number;
            }) => ReactNode
          )({ item, index }),
        )
      : [];
  return [
    element,
    ...nodes(element.props.children as ReactNode),
    ...nodes(rows),
  ];
}

function render(seed: Partial<Record<keyof typeof SLOT, unknown>> = {}) {
  hooks.index = 0;
  hooks.seed = new Map(
    Object.entries(seed).map(([key, value]) => [
      SLOT[key as keyof typeof SLOT],
      value,
    ]),
  );
  const tree = nodes(AIPersonalizationScreen({}) as ReactNode);
  expect(hooks.index).toBe(SLOT_COUNT);
  return tree;
}

/** The element of a local component, by its function name. */
function component(tree: TestElement[], name: string): TestElement {
  const found = tree.find(
    (node) =>
      typeof node.type === "function" &&
      (node.type as { name?: string }).name === name,
  );
  if (!found) throw new Error(`${name} not rendered`);
  return found;
}

const SECTION = {
  uid: "s-1",
  title: "About me",
  body: "I write short notes.",
  enabled: true,
};
const LOAD_ERROR = "Couldn't load AI personalization. Please try again.";
const messages = () =>
  hooks.setters[SLOT.message]?.mock.calls.map((call) => call[0]) ?? [];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  hooks.setters = [];
  for (const mock of Object.values(dao)) mock.mockReset();
  vi.mocked(resolveActiveAiConnection).mockResolvedValue(null as never);
  dao.getWritingStyle.mockResolvedValue({
    tone: "balanced",
    length: "normal",
    directness: "balanced",
    freeform: "",
  });
  dao.listPersonalizationSections.mockResolvedValue([SECTION]);
});

describe("adding a section (third fix pass IN-02)", () => {
  const add = async () => {
    const tree = render({ adding: true, draftTitle: "Work", draftBody: "x" });
    (component(tree, "NewSectionEditor").props.onSave as () => void)();
    await flush();
  };

  it("a re-read that fails after the section was created shows the load error, not a failed add", async () => {
    dao.createPersonalizationSection.mockResolvedValue(undefined);
    dao.listPersonalizationSections.mockRejectedValue(new Error("read"));
    await add();
    expect(dao.createPersonalizationSection).toHaveBeenCalledOnce();
    expect(messages()).toEqual([LOAD_ERROR]);
    // The committed draft is cleared and the form closed.
    expect(hooks.setters[SLOT.draftTitle]).toHaveBeenCalledWith("");
    expect(hooks.setters[SLOT.adding]).toHaveBeenCalledWith(false);
  });

  it("a failed create shows the add error, keeps the draft and reads nothing", async () => {
    dao.createPersonalizationSection.mockRejectedValue(new Error("write"));
    await add();
    expect(messages()).toEqual([
      "Couldn't add that section. Please try again.",
    ]);
    expect(hooks.setters[SLOT.draftTitle]).not.toHaveBeenCalled();
    expect(dao.listPersonalizationSections).not.toHaveBeenCalled();
  });

  it("a create and re-read that both succeed show no message", async () => {
    dao.createPersonalizationSection.mockResolvedValue(undefined);
    await add();
    expect(dao.listPersonalizationSections).toHaveBeenCalledOnce();
    expect(messages()).toEqual([]);
  });
});

describe("saving an edited section (third fix pass IN-02)", () => {
  const save = async () => {
    const tree = render({ sections: [SECTION], editingUid: SECTION.uid });
    const onSave = component(tree, "SectionEditor").props.onSave as (
      section: typeof SECTION,
    ) => Promise<void>;
    await onSave({ ...SECTION, body: "Edited." });
    await flush();
  };

  it("a re-read that fails after the update shows the load error, not a failed save", async () => {
    dao.updatePersonalizationSection.mockResolvedValue(undefined);
    dao.getWritingStyle.mockRejectedValue(new Error("read"));
    await save();
    expect(dao.updatePersonalizationSection).toHaveBeenCalledOnce();
    expect(messages()).toEqual([LOAD_ERROR]);
    expect(hooks.setters[SLOT.editingUid]).toHaveBeenCalledWith(null);
  });

  it("a failed update shows the save error and keeps the editor open", async () => {
    dao.updatePersonalizationSection.mockRejectedValue(new Error("write"));
    await save();
    expect(messages()).toEqual([
      "Couldn't save that section. Please try again.",
    ]);
    expect(hooks.setters[SLOT.editingUid]).not.toHaveBeenCalled();
    expect(dao.getWritingStyle).not.toHaveBeenCalled();
  });
});

describe("reorder and delete keep the same split (third fix pass IN-02)", () => {
  it("a failed re-read after a committed reorder shows the load error", async () => {
    dao.reorderPersonalizationSections.mockResolvedValue(undefined);
    dao.listPersonalizationSections.mockRejectedValue(new Error("read"));
    const tree = render({
      sections: [SECTION, { ...SECTION, uid: "s-2", title: "Work" }],
    });
    // Move down sits in the first section's ⋯ (38.12 D-120); the screen
    // hands the row its move handler.
    const row = component(tree, "PersonalizationSectionCard");
    (row.props.onMove as (direction: "up" | "down") => void)("down");
    await flush();
    expect(dao.reorderPersonalizationSections).toHaveBeenCalledOnce();
    expect(messages()).toEqual([LOAD_ERROR]);
  });

  it("a failed re-read after a committed delete shows the load error", async () => {
    dao.deletePersonalizationSection.mockResolvedValue(undefined);
    dao.listPersonalizationSections.mockRejectedValue(new Error("read"));
    const tree = render({ sections: [SECTION], deleteUid: SECTION.uid });
    const dialog = tree.find((node) => node.type === "ConfirmDialog");
    if (!dialog) throw new Error("ConfirmDialog not rendered");
    (dialog.props.onConfirm as () => void)();
    await flush();
    expect(dao.deletePersonalizationSection).toHaveBeenCalledWith(
      undefined,
      SECTION.uid,
    );
    expect(messages()).toEqual([LOAD_ERROR]);
  });
});
