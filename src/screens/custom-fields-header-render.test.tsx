import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomFieldDef } from "@/db/field-types";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of Custom Fields (38.9 D-16, D-14, D-61; review M4): the
 * shared child header is rendered once above the list/editor switch, so the
 * list AND both field-editor modes have it, with no in-body Back. The editor's
 * Cancel goes through the guard's dirty-aware `requestClose` (D-61), never the
 * raw `setEditor(null)`.
 *
 * `useState` is replaced by a call-order slot harness so the `editor` state can
 * be seeded. Slot order in CustomFieldsScreen: defs, emptyById, editor,
 * newFieldShareDefault, editorDirty, saving. A drift in that order makes the
 * seeded editor cases render the list instead, which fails them.
 */

const EDITOR_SLOT = 2;
const SAVING_SLOT = 5;

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
  View: "View",
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: {},
    hairlineWidth: 1,
  },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("react-native-reorderable-list", () => ({
  default: "ReorderableList",
  useReorderableDrag: () => vi.fn(),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AnchoredMenu", () => ({
  AnchoredMenu: "AnchoredMenu",
}));
vi.mock("@/components/FieldDefForm", () => ({
  FieldDefForm: "FieldDefForm",
  FIELD_TYPE_LABELS: {},
}));
vi.mock("@/db/ai-permissions-dao", () => ({
  resolveNewItemAiDefault: vi.fn(),
}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: vi.fn(),
}));
vi.mock("@/db/field-ddl", () => ({
  createField: vi.fn(),
  deleteOrQuarantineField: vi.fn(),
}));
vi.mock("@/db/field-defs-dao", () => ({
  changeFieldOptions: vi.fn(),
  countFieldValues: vi.fn(),
  listDefs: vi.fn(),
  renameField: vi.fn(),
  reorderFields: vi.fn(),
  restoreField: vi.fn(),
  updateFieldCuration: vi.fn(),
  updateFieldShareWithAi: vi.fn(),
}));
vi.mock("@/db/field-type-change", () => ({
  applyTypeChange: vi.fn(),
  preflightOptionsChange: vi.fn(),
  preflightTypeChange: vi.fn(),
}));
const guard = vi.hoisted(() => ({
  options: null as null | {
    subEditor?: { open: boolean; dirty: boolean; close: () => void };
  },
  requestClose: vi.fn(),
}));
vi.mock("@/navigation/discard-keep-guard", () => ({
  useDiscardKeepGuard: (options: typeof guard.options) => {
    guard.options = options;
    return { requestClose: guard.requestClose, settleHold: vi.fn() };
  },
}));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 96,
}));
vi.mock("@/stores/confirm-store", () => ({
  confirm: vi.fn(),
  notice: vi.fn(),
}));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: vi.fn() }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { CustomFieldsScreen } = await import("./CustomFieldsScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

const FIELD = {
  id: 7,
  label: "Birthday",
  type: "date",
} as unknown as CustomFieldDef;

function render(editor: unknown, saving = false) {
  hooks.states = [];
  hooks.setters = [];
  hooks.states[EDITOR_SLOT] = editor;
  hooks.states[SAVING_SLOT] = saving;
  hooks.index = 0;
  return nodes(CustomFieldsScreen());
}

function headersOf(tree: TestElement[]) {
  return tree.filter((node) => node.type === "ShellAppBar");
}

function hasInBodyBack(tree: TestElement[]) {
  return tree.some(
    (node) =>
      node.props.accessibilityLabel === "Back" ||
      node.props.label === "Back" ||
      node.props.children === "Back",
  );
}

describe("Custom Fields shared header on every branch (38.9 D-16, review M4)", () => {
  beforeEach(() => {
    guard.options = null;
    guard.requestClose.mockReset();
  });

  it("the list shows exactly one child header and no in-body Back", () => {
    const tree = render(null);
    const headers = headersOf(tree);
    expect(headers).toHaveLength(1);
    expect(headers[0].props.variant).toBe("child");
    expect(headers[0].props.title).toBe("Custom Fields");
    expect(tree.some((node) => node.type === "FieldDefForm")).toBe(false);
    expect(hasInBodyBack(tree)).toBe(false);
    // The header uses its default Back (goBack -> beforeRemove -> the guard).
    expect(headers[0].props.onBack).toBeUndefined();
  });

  for (const [label, editor] of [
    ["create", { mode: "create" }],
    ["edit", { mode: "edit", field: FIELD }],
  ] as const) {
    it(`the ${label} editor renders with exactly one child header and no in-body Back`, () => {
      const tree = render(editor);
      const headers = headersOf(tree);
      expect(headers).toHaveLength(1);
      expect(headers[0].props.variant).toBe("child");
      const forms = tree.filter((node) => node.type === "FieldDefForm");
      expect(forms).toHaveLength(1);
      expect(forms[0].props.mode).toBe(label);
      expect(hasInBodyBack(tree)).toBe(false);
      // The header sits beside the form, above it, not inside it.
      const root = tree[0];
      const children = (root.props.children as ReactNode[]).flat();
      expect(
        children.map((child) => (child as TestElement | null)?.type),
      ).toEqual(["ShellAppBar", "FieldDefForm"]);
    });

    it(`the ${label} editor is the guard's open sub-editor, and its Cancel is the dirty-aware close (D-14, D-61)`, () => {
      const tree = render(editor);
      expect(guard.options?.subEditor?.open).toBe(true);
      const form = tree.find((node) => node.type === "FieldDefForm");
      const onCancel = form?.props.onCancel as () => void;
      expect(typeof onCancel).toBe("function");
      // Not the raw editor setter.
      expect(onCancel).not.toBe(hooks.setters[EDITOR_SLOT]);
      onCancel();
      expect(guard.requestClose).toHaveBeenCalledTimes(1);
      const [close, dirty] = guard.requestClose.mock.calls[0];
      expect(close).toBe(guard.options?.subEditor?.close);
      expect(dirty).toBe(false);
      // Cancel alone did not close the editor; only the guard's close does.
      expect(hooks.states[EDITOR_SLOT]).toEqual(editor);
      (close as () => void)();
      expect(hooks.states[EDITOR_SLOT]).toBeNull();
    });
  }

  it("the list is not an open sub-editor (header Back leaves the screen)", () => {
    render(null);
    expect(guard.options?.subEditor?.open).toBe(false);
  });
});

describe("Custom Fields holds the field form while a create / edit runs (WR-02 follow-up)", () => {
  for (const [label, editor] of [
    ["create", { mode: "create" }],
    ["edit", { mode: "edit", field: FIELD }],
  ] as const) {
    it(`the ${label} form is busy exactly while saving, beside the header's disabled Back`, () => {
      for (const saving of [false, true]) {
        const tree = render(editor, saving);
        const form = tree.find((node) => node.type === "FieldDefForm");
        expect(form?.props.busy).toBe(saving);
        expect(headersOf(tree)[0].props.backDisabled).toBe(saving);
      }
    });
  }
});
