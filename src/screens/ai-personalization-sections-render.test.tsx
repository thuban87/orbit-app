import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Shallow render of AI Personalization's section list (38.12 D-86, D-120): the
 * page is one ScrollViewContainer with the sections in a NestedReorderableList;
 * each section row is a drag handle, its title, its Send-to-AI switch and a ⋯
 * holding every action (Rename / edit, Replace from file, Move up, Move down,
 * Delete section last as danger). No inline action buttons, no adjustable-only
 * sort control. A drag and Move up / Move down persist through the one reorder
 * write.
 *
 * A function-call render with a mocked React (same harness as
 * ai-personalization-reload-render.test.tsx): `useState` slots are seeded by
 * call order and every setter is a spy. A row is rendered by calling the
 * list's `renderItem`, then the row component as a plain function.
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

const drag = vi.hoisted(() => vi.fn());
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
  useReorderableDrag: () => drag,
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
  GlassSurface: "GlassSurface",
  MIN_TOUCH_TARGET: 44,
  OrbitSwitch: "OrbitSwitch",
}));
vi.mock("@/components/ui/AnchoredMenu", () => ({
  AnchoredMenu: "AnchoredMenu",
}));
vi.mock("@/components/ui/ScopedPalette", () => ({
  ScopedPalette: "ScopedPalette",
}));
vi.mock("@/components/ui/SettingsSectionCard", () => ({
  SettingsSectionCard: "SettingsSectionCard",
}));
vi.mock("@/db/ai-connections-dao", () => ({
  resolveActiveAiConnection: vi.fn(),
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "2026-10-17 12:00:00",
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
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
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

function list(tree: TestElement[]): TestElement {
  const found = tree.find((node) => node.type === "NestedReorderableList");
  if (!found) throw new Error("no NestedReorderableList");
  return found;
}

/** The row element the list renders for `index` (not yet called). */
function rowElement(tree: TestElement[], index: number): TestElement {
  const reorderable = list(tree);
  const data = reorderable.props.data as unknown[];
  return (
    reorderable.props.renderItem as (info: {
      item: unknown;
      index: number;
    }) => TestElement
  )({ item: data[index], index });
}

/** The row at `index`, its component called as a plain function. */
function renderRow(tree: TestElement[], index: number): TestElement[] {
  const row = rowElement(tree, index);
  const component = row.type as unknown as (
    props: Record<string, unknown>,
  ) => ReactNode;
  return nodes(component(row.props));
}

type MenuItem = {
  id: string;
  label: string;
  danger?: boolean;
  separatorBefore?: boolean;
  onPress: () => void;
};
function menuItems(rowTree: TestElement[]): MenuItem[] {
  const menu = rowTree.find((node) => node.type === "AnchoredMenu");
  if (!menu) throw new Error("no AnchoredMenu");
  return menu.props.items as MenuItem[];
}

const section = (uid: string, title: string, displayOrder: number) => ({
  id: displayOrder + 1,
  uid,
  title,
  body: `${title} text`,
  enabled: true,
  displayOrder,
  createdAt: "now",
  modifiedAt: "now",
});
const SECTIONS = [
  section("s-1", "About me", 0),
  section("s-2", "Work", 1),
  section("s-3", "Family", 2),
];
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
  dao.listPersonalizationSections.mockResolvedValue(SECTIONS);
  dao.reorderPersonalizationSections.mockResolvedValue(undefined);
});

describe("AI sections use the shared list pattern (38.12 D-86, D-120)", () => {
  it("renders the page in one ScrollViewContainer with the sections in a NestedReorderableList", () => {
    const tree = render({ sections: SECTIONS });
    expect(tree.some((node) => node.type === "ScrollViewContainer")).toBe(true);
    expect(tree.some((node) => node.type === "ScrollView")).toBe(false);
    const reorderable = list(tree);
    expect(
      (reorderable.props.data as typeof SECTIONS).map((s) => s.uid),
    ).toEqual(["s-1", "s-2", "s-3"]);
    expect(reorderable.props.scrollEnabled).toBe(false);
  });

  it("each row has a drag handle and a ⋯, and no inline action buttons", () => {
    const row = renderRow(render({ sections: SECTIONS }), 0);
    const handle = row.find(
      (node) => node.props.testID === "personalization-drag-s-1",
    );
    expect(handle?.props.onLongPress).toBe(drag);
    const options = row.find(
      (node) => node.props.testID === "personalization-options-s-1",
    );
    expect(options?.props.accessibilityLabel).toBe("Options for About me");
    expect(options?.props.collapsable).toBe(false);
    // Only the handle and the ⋯ are pressable; no Button in the row.
    expect(
      row
        .filter((node) => node.type === "Pressable")
        .map((node) => node.props.testID),
    ).toEqual(["personalization-drag-s-1", "personalization-options-s-1"]);
    expect(row.some((node) => node.type === "Button")).toBe(false);
    // The adjustable-only sort control is gone.
    expect(
      row.some((node) => node.props.accessibilityRole === "adjustable"),
    ).toBe(false);
  });

  it("the section text spans the full card width, below the title row", () => {
    const row = renderRow(render({ sections: SECTIONS }), 0);
    const card = row[0] as TestElement;
    const direct = (card.props.children as ReactNode[]).filter(
      Boolean,
    ) as TestElement[];
    // The title row holds the handle, title, switch and ⋯ only.
    const header = direct[0] as TestElement;
    expect(
      nodes(header.props.children as ReactNode).some(
        (node) => node.props.children === "About me text",
      ),
    ).toBe(false);
    // The text is the card's own child, so it takes the card's full width.
    expect(
      direct.some(
        (node) =>
          node.type === "AppText" && node.props.children === "About me text",
      ),
    ).toBe(true);
  });

  it("the first row's menu: Rename / edit, Replace from file, Move down, then Delete section last as danger", () => {
    const items = menuItems(renderRow(render({ sections: SECTIONS }), 0));
    expect(items.map((item) => item.label)).toEqual([
      "Rename / edit",
      "Replace from file",
      "Move down",
      "Delete section",
    ]);
    const last = items.at(-1);
    expect(last?.danger).toBe(true);
    expect(last?.separatorBefore).toBe(true);
  });

  it("a middle row offers Move up and Move down; the last row Move up only", () => {
    const tree = render({ sections: SECTIONS });
    expect(menuItems(renderRow(tree, 1)).map((item) => item.label)).toEqual([
      "Rename / edit",
      "Replace from file",
      "Move up",
      "Move down",
      "Delete section",
    ]);
    expect(menuItems(renderRow(tree, 2)).map((item) => item.label)).toEqual([
      "Rename / edit",
      "Replace from file",
      "Move up",
      "Delete section",
    ]);
  });

  it("Move down persists the swapped order through the one reorder write", async () => {
    const tree = render({ sections: SECTIONS });
    menuItems(renderRow(tree, 0))
      .find((item) => item.label === "Move down")
      ?.onPress();
    await flush();
    expect(dao.reorderPersonalizationSections).toHaveBeenCalledWith(
      "exec",
      ["s-2", "s-1", "s-3"],
      "2026-10-17 12:00:00",
    );
    // The new order shows at once, before the re-read.
    expect(hooks.setters[SLOT.sections]).toHaveBeenCalledWith([
      SECTIONS[1],
      SECTIONS[0],
      SECTIONS[2],
    ]);
  });

  it("a drag end persists the moved order through the same write", async () => {
    const tree = render({ sections: SECTIONS });
    (
      list(tree).props.onReorder as (event: {
        from: number;
        to: number;
      }) => void
    )({ from: 2, to: 0 });
    await flush();
    expect(dao.reorderPersonalizationSections).toHaveBeenCalledWith(
      "exec",
      ["s-3", "s-1", "s-2"],
      "2026-10-17 12:00:00",
    );
  });

  it("a failed reorder puts the old order back and says so", async () => {
    dao.reorderPersonalizationSections.mockRejectedValue(new Error("write"));
    const tree = render({ sections: SECTIONS });
    (
      list(tree).props.onReorder as (event: {
        from: number;
        to: number;
      }) => void
    )({ from: 0, to: 1 });
    await flush();
    expect(hooks.setters[SLOT.sections]).toHaveBeenLastCalledWith(SECTIONS);
    expect(hooks.setters[SLOT.message]).toHaveBeenCalledWith(
      "Couldn't reorder those sections. Please try again.",
    );
    expect(dao.listPersonalizationSections).not.toHaveBeenCalled();
  });

  it("Rename / edit opens the inline editor; Delete section asks first", () => {
    const tree = render({ sections: SECTIONS });
    const items = menuItems(renderRow(tree, 1));
    items.find((item) => item.label === "Rename / edit")?.onPress();
    expect(hooks.setters[SLOT.editingUid]).toHaveBeenCalledWith("s-2");
    items.find((item) => item.label === "Delete section")?.onPress();
    expect(hooks.setters[SLOT.deleteUid]).toHaveBeenCalledWith("s-2");
    expect(dao.deletePersonalizationSection).not.toHaveBeenCalled();
  });

  it("the row being edited carries the inline section editor", () => {
    const tree = render({ sections: SECTIONS, editingUid: "s-2" });
    const editor = nodes(rowElement(tree, 1).props.children as ReactNode).find(
      (node) =>
        typeof node.type === "function" &&
        (node.type as { name?: string }).name === "SectionEditor",
    );
    expect(editor).toBeDefined();
    expect(rowElement(tree, 0).props.children).toBeNull();
  });
});
