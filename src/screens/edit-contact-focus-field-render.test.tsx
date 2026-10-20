import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomFieldDef } from "@/db/field-types";

/**
 * Edit Contact opened at a custom field (38.12 D-70; convergence c1 C-4, C-5).
 *
 * Custom Fields starts collapsed and AccordionSection mounts its body only
 * when expanded, so the target input does not exist until the expand. The
 * reveal hook expands after hydration, then reveals the target row once it
 * has laid out, never before. A flagged date and an out-of-options dropdown
 * value both show their problem and expected format, with the stored text
 * unchanged.
 *
 * Shallow render: AccordionSection, EditCustomFieldsSection and
 * FieldValueInput run for real; the value widgets are host strings. React's
 * effect / ref hooks are a small harness so the hook's effect can be run by
 * hand at "hydration".
 */

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  refIndex: 0,
  effects: [] as (() => void)[],
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: (fn: unknown) => fn,
  useEffect: (effect: () => void) => {
    hooks.effects.push(effect);
  },
  useRef: (value: unknown) => {
    const slot = hooks.refIndex++;
    if (!hooks.refs[slot]) hooks.refs[slot] = { current: value };
    return hooks.refs[slot];
  },
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  View: "View",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: {
      danger: "danger",
      surface: "surface",
      border: "border",
      borderStrong: "borderStrong",
      textSecondary: "textSecondary",
    },
  }),
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/field-widgets/DateFieldWidget", () => ({
  DateFieldWidget: "DateFieldWidget",
}));
vi.mock("@/components/field-widgets/DropdownFieldWidget", () => ({
  DropdownFieldWidget: "DropdownFieldWidget",
}));
vi.mock("@/components/field-widgets/NumberFieldWidget", () => ({
  NumberFieldWidget: "NumberFieldWidget",
}));
vi.mock("@/components/field-widgets/PhotoFieldWidget", () => ({
  PhotoFieldWidget: "PhotoFieldWidget",
}));
vi.mock("@/components/field-widgets/TextAreaFieldWidget", () => ({
  TextAreaFieldWidget: "TextAreaFieldWidget",
}));
vi.mock("@/components/field-widgets/TextFieldWidget", () => ({
  TextFieldWidget: "TextFieldWidget",
}));
vi.mock("@/components/field-widgets/ToggleFieldWidget", () => ({
  ToggleFieldWidget: "ToggleFieldWidget",
}));

const { EditCustomFieldsSection, useFocusFieldReveal } = await import(
  "./edit-contact-custom-fields"
);

interface Node {
  type: string;
  props: Record<string, unknown>;
  text: string;
  children: Node[];
}

function resolve(node: ReactNode): Node[] {
  if (typeof node === "string") {
    return [{ type: "literal", props: {}, text: node, children: [] }];
  }
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function") {
    return resolve(
      (element.type as (props: unknown) => ReactNode)(element.props),
    );
  }
  if (typeof element.type !== "string") return resolve(element.props.children);
  return [
    {
      type: element.type,
      props: element.props,
      text: "",
      children: resolve(element.props.children),
    },
  ];
}

function all(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

function textOf(node: Node): string {
  return node.type === "literal"
    ? node.text
    : node.children.map(textOf).join("");
}

function byTestId(tree: Node[], testID: string): Node | undefined {
  return tree.find((node) => node.props.testID === testID);
}

function def(over: Partial<CustomFieldDef>): CustomFieldDef {
  return {
    id: 1,
    col_name: "cf_1",
    label: "Field",
    type: "text",
    options: null,
    ...over,
  } as CustomFieldDef;
}

const DATE = def({ id: 11, col_name: "cf_met", label: "Met on", type: "date" });
const TIER = def({
  id: 12,
  col_name: "cf_tier",
  label: "Tier",
  type: "dropdown",
  options: JSON.stringify(["Platinum", "Bronze"]),
});
const NOTE = def({ id: 13, col_name: "cf_note", label: "Note" });
const DEFS = [NOTE, DATE, TIER];
const SAVED = { cf_met: "not a date", cf_tier: "Gold", cf_note: "hello" };

/** One render of the screen's slice: the hook, then the section. */
function renderEdit(input: {
  focusFieldDefId: number | undefined;
  hydrated: boolean;
  expanded: boolean;
  values?: Record<string, string | null>;
  expand: () => void;
  reveal: (node: unknown) => void;
}) {
  hooks.refIndex = 0;
  hooks.effects = [];
  // biome-ignore lint/correctness/useHookAtTopLevel: react is mocked; the hook runs as a plain function here.
  const focus = useFocusFieldReveal({
    focusFieldDefId: input.focusFieldDefId,
    ready: input.hydrated,
    expand: input.expand,
    reveal: input.reveal as (node: unknown) => void,
  });
  const runEffects = () => {
    for (const effect of hooks.effects) effect();
  };
  const tree = all(
    resolve(
      EditCustomFieldsSection({
        defs: DEFS,
        values: input.values ?? SAVED,
        savedValues: SAVED,
        contactId: 7,
        expanded: input.expanded,
        onExpandedChange: () => {},
        onChange: () => {},
        registerRow: focus.registerRow,
        onRowLayout: focus.onRowLayout,
      }),
    ),
  );
  // Attach each mounted row's node, as React would on commit.
  for (const node of tree) {
    const id = node.props.testID;
    if (typeof id === "string" && id.startsWith("edit-contact-custom-row-")) {
      (node.props.ref as (n: unknown) => void)({ testID: id });
    }
  }
  return { tree, runEffects };
}

function layout(tree: Node[], defId: number) {
  const row = byTestId(tree, `edit-contact-custom-row-${defId}`);
  if (!row) throw new Error(`row ${defId} is not mounted`);
  (row.props.onLayout as () => void)();
}

describe("Edit Contact opened at a custom field (38.12 D-70; C-4, C-5)", () => {
  beforeEach(() => {
    hooks.refs = [];
  });

  it("expands Custom Fields after hydration, mounts the target and only then reveals it", () => {
    const expand = vi.fn();
    const reveal = vi.fn();

    // Before hydration: nothing expands, the section is collapsed and the
    // target input does not exist.
    const before = renderEdit({
      focusFieldDefId: DATE.id,
      hydrated: false,
      expanded: false,
      expand,
      reveal,
    });
    before.runEffects();
    expect(expand).not.toHaveBeenCalled();
    expect(byTestId(before.tree, "accordion-custom-body")).toBeUndefined();
    expect(byTestId(before.tree, "edit-contact-custom-cf_met")).toBeUndefined();

    // Hydrated, still collapsed: the effect expands the section; no reveal
    // yet, because the target row has not mounted.
    const hydrated = renderEdit({
      focusFieldDefId: DATE.id,
      hydrated: true,
      expanded: false,
      expand,
      reveal,
    });
    hydrated.runEffects();
    expect(expand).toHaveBeenCalledTimes(1);
    expect(reveal).not.toHaveBeenCalled();

    // The expanded render mounts the body and the target input; its layout
    // fires the reveal for that row.
    const open = renderEdit({
      focusFieldDefId: DATE.id,
      hydrated: true,
      expanded: true,
      expand,
      reveal,
    });
    open.runEffects();
    expect(expand).toHaveBeenCalledTimes(1);
    expect(byTestId(open.tree, "accordion-custom-body")).toBeDefined();
    expect(byTestId(open.tree, "edit-contact-custom-cf_met")).toBeDefined();
    layout(open.tree, NOTE.id);
    expect(reveal).not.toHaveBeenCalled();
    layout(open.tree, DATE.id);
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal).toHaveBeenCalledWith({
      testID: `edit-contact-custom-row-${DATE.id}`,
    });

    // One-shot per open: a later layout does not scroll again.
    layout(open.tree, DATE.id);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a focus field", () => {
    const expand = vi.fn();
    const reveal = vi.fn();
    const view = renderEdit({
      focusFieldDefId: undefined,
      hydrated: true,
      expanded: true,
      expand,
      reveal,
    });
    view.runEffects();
    layout(view.tree, DATE.id);
    expect(expand).not.toHaveBeenCalled();
    expect(reveal).not.toHaveBeenCalled();
  });

  it("shows the stored value, the problem and the expected format for flagged values", () => {
    const { tree } = renderEdit({
      focusFieldDefId: TIER.id,
      hydrated: true,
      expanded: true,
      expand: vi.fn(),
      reveal: vi.fn(),
    });
    // The stored text reaches the widgets unchanged.
    expect(byTestId(tree, "edit-contact-custom-cf_met")?.props.value).toBe(
      "not a date",
    );
    expect(byTestId(tree, "edit-contact-custom-cf_tier")?.props.value).toBe(
      "Gold",
    );
    // Date: the problem and the format; its own caption is turned off so the
    // problem is not said twice.
    expect(
      textOf(byTestId(tree, "edit-contact-custom-cf_met-problem") as Node),
    ).toBe("This isn't a valid date");
    expect(
      textOf(byTestId(tree, "edit-contact-custom-cf_met-expected") as Node),
    ).toBe("Use YYYY-MM-DD");
    expect(
      byTestId(tree, "edit-contact-custom-cf_met")?.props.showInvalidCaption,
    ).toBe(false);
    // Dropdown out of its options (C-4).
    const problem = byTestId(tree, "edit-contact-custom-cf_tier-problem");
    expect(textOf(problem as Node)).toBe(
      "This is no longer one of the options",
    );
    expect(problem?.props.style).toEqual({ color: "danger" });
    expect(
      textOf(byTestId(tree, "edit-contact-custom-cf_tier-expected") as Node),
    ).toBe("Choose one of: Platinum, Bronze");
    // A valid value shows no error.
    expect(
      byTestId(tree, "edit-contact-custom-cf_note-problem"),
    ).toBeUndefined();
  });

  it("drops the error once the user changes the value (not yet saved)", () => {
    const { tree } = renderEdit({
      focusFieldDefId: undefined,
      hydrated: true,
      expanded: true,
      values: { ...SAVED, cf_tier: "Platinum" },
      expand: vi.fn(),
      reveal: vi.fn(),
    });
    expect(
      byTestId(tree, "edit-contact-custom-cf_tier-problem"),
    ).toBeUndefined();
    expect(byTestId(tree, "edit-contact-custom-cf_met-problem")).toBeDefined();
  });

  it("EditContactScreen wires the route's focusFieldDefId through the reveal hook", () => {
    const source = readFileSync(
      join(__dirname, "EditContactScreen.tsx"),
      "utf8",
    );
    // 38.14 D-42 adds focusSection beside focusFieldDefId.
    expect(source).toContain(
      "const { contactId, focusFieldDefId, focusSection } = route.params;",
    );
    expect(source).toContain("useFocusFieldReveal({");
    expect(source).toContain("onRowLayout={focusFieldReveal.onRowLayout}");
    expect(source).toContain("setSectionExpanded(CUSTOM_SECTION_ID, true)");
  });

  it("EditContactScreen expands and reveals Contact Methods once for focusSection (38.14 D-42)", () => {
    const source = readFileSync(
      join(__dirname, "EditContactScreen.tsx"),
      "utf8",
    );
    expect(source).toContain(
      'if (focusSection !== "methods" || !formReady) return;',
    );
    expect(source).toContain("if (focusSectionHandledRef.current) return;");
    expect(source).toContain("setSectionExpanded(focusSection, true);");
    expect(source).toContain("sectionRefs.current[focusSection]");
  });
});
