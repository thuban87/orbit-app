import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomFieldDef } from "@/db/field-types";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of the Custom Fields list (38.12 D-120): one reorderable list
 * of active fields, each row a drag handle plus a ⋯ menu holding the row's
 * actions, no inline action buttons, the destructive item last and chosen by
 * the data (Delete with no values, Quarantine with values; D-24). Move up /
 * Move down and a drag both persist through `reorderFields` over the FULL
 * order (active first, quarantined after).
 *
 * `useState` is a call-order slot harness (same as
 * custom-fields-header-render.test.tsx). Screen slot order: defs, valueCounts,
 * editor, newFieldShareDefault, editorDirty, saving. Row components are
 * called as plain functions after the screen, so their slots follow.
 */

const DEFS_SLOT = 0;
const COUNTS_SLOT = 1;
const EDITOR_SLOT = 2;

const drag = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  setters: [] as ((next: unknown) => void)[],
  index: 0,
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (fn: unknown) => fn,
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => {},
  useState: (value: unknown) => {
    const slot = hooks.index++;
    if (!(slot in hooks.states)) {
      hooks.states[slot] =
        typeof value === "function" ? (value as () => unknown)() : value;
    }
    if (!hooks.setters[slot]) {
      hooks.setters[slot] = (next: unknown) => {
        hooks.states[slot] =
          typeof next === "function"
            ? (next as (previous: unknown) => unknown)(hooks.states[slot])
            : next;
      };
    }
    return [hooks.states[slot], hooks.setters[slot]];
  },
}));
// CustomFieldsScreen reads the Settings navigator for "Review now" (38.12 D-121).
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));
vi.mock("react-native", () => ({
  AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
  findNodeHandle: vi.fn(),
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: {},
    hairlineWidth: 1,
  },
}));
vi.mock("react-native-reorderable-list", () => ({
  default: "ReorderableList",
  useReorderableDrag: () => drag,
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
// The real module's exports (FIELD_TYPE_LABELS), with the form itself a host
// element; the form is rendered for real only by the photo Allow AI test.
vi.mock("@/components/FieldDefForm", async (original) => ({
  ...(await original<typeof import("@/components/FieldDefForm")>()),
  FieldDefForm: "FieldDefForm",
}));
vi.mock("@/components/FieldValueInput", () => ({
  FieldValueInput: "FieldValueInput",
}));
vi.mock("@/components/ui", () => ({ OrbitSwitch: "OrbitSwitch" }));
vi.mock("@/db/col-name", () => ({ makeColName: () => "cf_x" }));
vi.mock("@/db/uid", () => ({ newUid: () => "uid" }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AnchoredMenu", () => ({
  AnchoredMenu: "AnchoredMenu",
}));
vi.mock("@/db/ai-permissions-dao", () => ({
  resolveNewItemAiDefault: vi.fn(),
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "now",
}));
vi.mock("@/db/field-ddl", () => ({
  createField: vi.fn(),
  deleteOrQuarantineField: vi.fn(),
}));
vi.mock("@/db/field-defs-dao", () => ({
  changeFieldOptions: vi.fn(),
  countFieldValues: vi.fn(),
  listDefs: vi.fn(async () => []),
  renameField: vi.fn(),
  reorderFields: vi.fn(async () => undefined),
  restoreField: vi.fn(async () => undefined),
  updateFieldCuration: vi.fn(),
  updateFieldShareWithAi: vi.fn(),
}));
vi.mock("@/db/field-type-change", () => ({
  applyTypeChange: vi.fn(),
  preflightOptionsChange: vi.fn(),
  preflightTypeChange: vi.fn(),
}));
vi.mock("@/navigation/discard-keep-guard", () => ({
  useDiscardKeepGuard: () => ({ requestClose: vi.fn(), settleHold: vi.fn() }),
}));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 96,
}));
vi.mock("@/stores/confirm-store", () => ({
  confirm: vi.fn(async () => false),
  notice: vi.fn(),
}));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: vi.fn() }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { CustomFieldsScreen, optionsSummary, quarantineKeptUntil, typeSummary } =
  await import("./CustomFieldsScreen");
const { FieldDefForm } = await vi.importActual<
  typeof import("@/components/FieldDefForm")
>("@/components/FieldDefForm");
const dao = await import("@/db/field-defs-dao");
const confirmStore = await import("@/stores/confirm-store");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function def(
  id: number,
  label: string,
  type: string,
  quarantined_at: string | null = null,
): CustomFieldDef {
  return {
    id,
    label,
    type,
    quarantined_at,
    display_order: id,
  } as unknown as CustomFieldDef;
}

const ACTIVE = [def(1, "Coffee", "text"), def(2, "Met at", "date")];
const QUARANTINED = [def(9, "Old", "photo", "2026-10-01 09:00:00")];

function renderScreen(
  defs: CustomFieldDef[] = [...ACTIVE, ...QUARANTINED],
  counts: Record<number, number> = { 1: 0, 2: 3, 9: 2 },
) {
  hooks.states = [];
  hooks.setters = [];
  hooks.states[DEFS_SLOT] = defs;
  hooks.states[COUNTS_SLOT] = counts;
  hooks.states[EDITOR_SLOT] = null;
  hooks.index = 0;
  return nodes(CustomFieldsScreen());
}

function list(tree: TestElement[]): TestElement {
  const found = tree.find((node) => node.type === "ReorderableList");
  if (!found) throw new Error("no ReorderableList");
  return found;
}

/** Render the active row at `index` (its function component, called directly). */
function renderRow(tree: TestElement[], index: number): TestElement[] {
  const reorderable = list(tree);
  const data = reorderable.props.data as CustomFieldDef[];
  const renderItem = reorderable.props.renderItem as (info: {
    item: CustomFieldDef;
    index: number;
  }) => TestElement;
  const row = renderItem({ item: data[index], index });
  const component = row.type as unknown as (
    props: Record<string, unknown>,
  ) => ReactNode;
  return nodes(component(row.props));
}

/** Render every quarantined row from the list footer. */
function renderQuarantinedRows(tree: TestElement[]): TestElement[][] {
  const footer = list(tree).props.ListFooterComponent as TestElement | null;
  if (!footer) return [];
  return nodes(footer)
    .filter((node) => typeof node.type === "function")
    .map((row) =>
      nodes(
        (row.type as unknown as (props: Record<string, unknown>) => ReactNode)(
          row.props,
        ),
      ),
    );
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

describe("Custom Fields list: drag handle + ⋯ (38.12 D-120)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the active fields in one reorderable list, the quarantined ones after it", () => {
    const tree = renderScreen();
    const reorderable = list(tree);
    expect(
      (reorderable.props.data as CustomFieldDef[]).map((d) => d.id),
    ).toEqual([1, 2]);
    expect(typeof reorderable.props.onReorder).toBe("function");
    const quarantinedRows = renderQuarantinedRows(tree);
    expect(quarantinedRows).toHaveLength(1);
  });

  it("each active row has a drag handle and a ⋯, and no inline action buttons", () => {
    const tree = renderScreen();
    const row = renderRow(tree, 0);
    const handle = row.find((node) => node.props.testID === "field-drag-1");
    expect(handle?.props.onLongPress).toBe(drag);
    const options = row.find((node) => node.props.testID === "field-options-1");
    expect(options?.props.accessibilityLabel).toBe("Options for Coffee");
    expect(options?.props.collapsable).toBe(false);
    expect(options?.props.accessibilityState).toEqual({ expanded: false });
    // Only the handle and the ⋯ are pressable in the row.
    const pressables = row.filter((node) => node.type === "Pressable");
    expect(pressables.map((node) => node.props.testID)).toEqual([
      "field-drag-1",
      "field-options-1",
    ]);
    for (const label of ["Up", "Down", "Edit", "Delete", "Quarantine"]) {
      expect(
        row.some(
          (node) => node.type === "Text" && node.props.children === label,
        ),
      ).toBe(false);
    }
  });

  it("the first, empty field's menu: Edit, Move down, then Delete last as danger", () => {
    const row = renderRow(renderScreen(), 0);
    const items = menuItems(row);
    expect(items.map((item) => item.label)).toEqual([
      "Edit",
      "Move down",
      "Delete",
    ]);
    const last = items.at(-1);
    expect(last?.danger).toBe(true);
    expect(last?.separatorBefore).toBe(true);
  });

  it("the last field with values: Edit, Move up, then Quarantine last as danger", () => {
    const row = renderRow(renderScreen(), 1);
    const items = menuItems(row);
    expect(items.map((item) => item.label)).toEqual([
      "Edit",
      "Move up",
      "Quarantine",
    ]);
    expect(items.at(-1)?.danger).toBe(true);
  });

  it("a middle field offers both Move up and Move down", () => {
    const tree = renderScreen([...ACTIVE, def(3, "Pets", "text")], {
      1: 0,
      2: 0,
      3: 0,
    });
    const items = menuItems(renderRow(tree, 1));
    expect(items.map((item) => item.label)).toEqual([
      "Edit",
      "Move up",
      "Move down",
      "Delete",
    ]);
  });

  it("Move down persists the swapped FULL order (active first, quarantined after)", async () => {
    const tree = renderScreen();
    const items = menuItems(renderRow(tree, 0));
    items.find((item) => item.label === "Move down")?.onPress();
    await vi.waitFor(() => expect(dao.reorderFields).toHaveBeenCalledTimes(1));
    expect(dao.reorderFields).toHaveBeenCalledWith("exec", [2, 1, 9], "now");
  });

  it("a drag end persists through the same full-order reorder", async () => {
    const tree = renderScreen([
      ...ACTIVE,
      def(3, "Pets", "text"),
      ...QUARANTINED,
    ]);
    const onReorder = list(tree).props.onReorder as (event: {
      from: number;
      to: number;
    }) => void;
    onReorder({ from: 2, to: 0 });
    await vi.waitFor(() => expect(dao.reorderFields).toHaveBeenCalledTimes(1));
    expect(dao.reorderFields).toHaveBeenCalledWith("exec", [3, 1, 2, 9], "now");
  });

  it("Edit opens the field editor; Delete / Quarantine goes through the confirm", async () => {
    const tree = renderScreen();
    const items = menuItems(renderRow(tree, 0));
    items.find((item) => item.label === "Edit")?.onPress();
    expect(hooks.states[EDITOR_SLOT]).toEqual({
      mode: "edit",
      field: ACTIVE[0],
    });
    items.find((item) => item.label === "Delete")?.onPress();
    await vi.waitFor(() =>
      expect(confirmStore.confirm).toHaveBeenCalledTimes(1),
    );
    expect(vi.mocked(confirmStore.confirm).mock.calls[0][0]).toMatchObject({
      confirmLabel: "Delete",
      destructive: true,
    });
  });

  it("a quarantined row has no drag handle and a ⋯ with Restore", async () => {
    const [row] = renderQuarantinedRows(renderScreen());
    expect(row.some((node) => node.props.onLongPress !== undefined)).toBe(
      false,
    );
    const pressables = row.filter((node) => node.type === "Pressable");
    expect(pressables.map((node) => node.props.testID)).toEqual([
      "field-options-9",
    ]);
    const items = menuItems(row);
    expect(items.map((item) => item.label)).toEqual(["Restore"]);
    items[0].onPress();
    await vi.waitFor(() =>
      expect(dao.restoreField).toHaveBeenCalledWith("exec", 9, "now"),
    );
  });
});

describe("Custom Fields copy and labels (38.12 D-71, D-72, D-74, D-129)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 17, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const ids = (n: number) => Array.from({ length: n }, (_, i) => i);

  it("the type-change summary keeps the §14.4 sentence and agrees in number (D-71, D-24)", () => {
    expect(typeSummary({ total: 12, convert: ids(8), flag: ids(4) })).toBe(
      "8 of 12 values will convert automatically. 4 need your input — fix now or later.",
    );
    expect(typeSummary({ total: 3, convert: ids(2), flag: ids(1) })).toBe(
      "2 of 3 values will convert automatically. 1 needs your input — fix now or later.",
    );
  });

  it("the type-change summary leaves out the 'need your input' clause when nothing needs fixing (D-139)", () => {
    expect(typeSummary({ total: 1, convert: ids(1), flag: [] })).toBe(
      "1 of 1 value will convert automatically.",
    );
    expect(typeSummary({ total: 0, convert: [], flag: [] })).toBe(
      "0 of 0 values will convert automatically.",
    );
    // A non-zero count keeps the clause.
    expect(typeSummary({ total: 2, convert: ids(1), flag: ids(1) })).toBe(
      "1 of 2 values will convert automatically. 1 needs your input — fix now or later.",
    );
  });

  it("the options-change summary agrees in number too", () => {
    expect(optionsSummary({ total: 5, keep: ids(4), flag: ids(1) })).toBe(
      "4 of 5 values will be kept. 1 needs your input — fix now or later.",
    );
  });

  it("a quarantined field is kept until its quarantine date plus the window (D-72)", () => {
    expect(quarantineKeptUntil("2026-10-01 09:00:00")).toBe("Oct 31");
    expect(quarantineKeptUntil("2025-12-20 09:00:00")).toBe("Jan 19");
    expect(quarantineKeptUntil("2026-12-20 09:00:00")).toBe("Jan 19, 2027");
    expect(quarantineKeptUntil("not a date")).toBeNull();
  });

  it("the quarantined row shows its type label and 'kept until <date>'", () => {
    const [row] = renderQuarantinedRows(renderScreen());
    const texts = row
      .filter((node) => node.type === "Text")
      .map((node) => [node.props.children].flat().join(""));
    expect(texts).toContain("Photo · kept until Oct 31");
  });

  it("active rows show the field-type label, never the raw type id (D-74)", () => {
    const tree = renderScreen();
    const texts = [0, 1].flatMap((index) =>
      renderRow(tree, index)
        .filter((node) => node.type === "Text")
        .map((node) => node.props.children),
    );
    expect(texts).toEqual(["Coffee", "Text", "Met at", "Date"]);
  });

  it("the Quarantine confirm says the field has values for N contacts (D-72)", async () => {
    const items = menuItems(renderRow(renderScreen(), 1));
    items.at(-1)?.onPress();
    await vi.waitFor(() =>
      expect(confirmStore.confirm).toHaveBeenCalledTimes(1),
    );
    const request = vi.mocked(confirmStore.confirm).mock.calls[0][0];
    expect(request).toMatchObject({
      title: "Quarantine field",
      confirmLabel: "Quarantine",
    });
    expect(request.message).toBe(
      '"Met at" has values for 3 contacts, so it will be quarantined for 30 days. You can restore it before then.',
    );
  });

  it("the singular count reads '1 contact', and an empty field says it has no values", async () => {
    const tree = renderScreen(ACTIVE, { 1: 0, 2: 1 });
    menuItems(renderRow(tree, 1)).at(-1)?.onPress();
    menuItems(renderRow(tree, 0)).at(-1)?.onPress();
    await vi.waitFor(() =>
      expect(confirmStore.confirm).toHaveBeenCalledTimes(2),
    );
    const [quarantine, remove] = vi
      .mocked(confirmStore.confirm)
      .mock.calls.map(([request]) => request);
    expect(quarantine.message).toContain("has values for 1 contact, so");
    expect(remove).toMatchObject({
      title: "Delete field",
      confirmLabel: "Delete",
      destructive: true,
      message: '"Coffee" has no values, so it will be deleted permanently.',
    });
  });

  function renderForm(props: Record<string, unknown>) {
    hooks.states = [];
    hooks.setters = [];
    hooks.index = 0;
    return nodes(
      FieldDefForm({
        bottomClearance: 0,
        onSubmit: vi.fn(),
        onCancel: vi.fn(),
        ...props,
      } as never),
    );
  }

  it("the new-field placeholder is a neutral example, not a built-in field (D-74)", () => {
    const tree = renderForm({
      mode: "create",
      existingColNames: new Set(),
      nextDisplayOrder: 0,
    });
    const input = tree.find((node) => node.props.testID === "field-def-label");
    expect(input?.props.placeholder).toBe("e.g. Favorite coffee");
  });

  it("a photo-type definition offers no Allow AI switch and saves share_with_ai 0 (D-129)", () => {
    const onSubmit = vi.fn();
    const photo = {
      id: 9,
      label: "Headshot",
      type: "photo",
      options: null,
      show_on_new: 0,
      always_show: 0,
      share_with_ai: 1,
    } as unknown as CustomFieldDef;
    const tree = renderForm({ mode: "edit", field: photo, onSubmit });
    expect(
      tree.some((node) => node.props.testID === "field-def-share-with-ai"),
    ).toBe(false);
    const submit = tree.find(
      (node) => node.props.testID === "field-def-submit",
    );
    (submit?.props.onPress as () => void)();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "photo", share_with_ai: 0 }),
    );
  });

  it("a non-photo definition keeps its Allow AI switch", () => {
    const tree = renderForm({
      mode: "edit",
      field: { ...ACTIVE[0], options: null, share_with_ai: 1 },
    });
    expect(
      tree.some((node) => node.props.testID === "field-def-share-with-ai"),
    ).toBe(true);
  });
});
