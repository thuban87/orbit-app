import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CustomFieldDef } from "@/db/field-types";

/**
 * FieldDefForm's `busy` (38.9 WR-02 follow-up; D-13, D-14, D-26): while the
 * host's create / edit is in flight, Cancel and the submit are held, announced
 * disabled and dimmed, so Cancel cannot close the form while the write
 * commits and a second submit is not offered.
 *
 * Hooks are stubbed so the form renders as a plain function: `useState`
 * returns its initial value, `useMemo` runs its factory.
 */
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => {},
  useMemo: (factory: () => unknown) => factory(),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [
    typeof value === "function" ? (value as () => unknown)() : value,
    () => {},
  ],
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/FieldValueInput", () => ({
  FieldValueInput: "FieldValueInput",
}));
vi.mock("@/components/ui", () => ({ OrbitSwitch: "OrbitSwitch" }));
vi.mock("@/db/col-name", () => ({ makeColName: () => "cf_x" }));
vi.mock("@/db/database", () => ({
  localDateTime: () => "2026-10-11 09:00:00",
}));
vi.mock("@/db/uid", () => ({ newUid: () => "uid" }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

import { FieldDefForm } from "./FieldDefForm";

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
  options: null,
  show_on_new: 0,
  always_show: 0,
  share_with_ai: 0,
} as unknown as CustomFieldDef;

const renderEdit = (busy?: boolean, onSubmit = vi.fn()) => ({
  tree: nodes(
    FieldDefForm({
      mode: "edit",
      field: FIELD,
      bottomClearance: 0,
      onSubmit,
      onCancel: vi.fn(),
      busy,
    }),
  ),
  onSubmit,
});
const renderCreate = (busy?: boolean) =>
  nodes(
    FieldDefForm({
      mode: "create",
      existingColNames: new Set(),
      nextDisplayOrder: 0,
      bottomClearance: 0,
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
      busy,
    }),
  );
const byTestId = (tree: TestElement[], id: string) =>
  tree.find((n) => n.props.testID === id);
const dimmed = (element: TestElement | undefined) =>
  ((element?.props.style ?? []) as unknown[]).some(
    (style) =>
      typeof style === "object" &&
      style !== null &&
      (style as { opacity?: number }).opacity === 0.5,
  );

describe("FieldDefForm busy holds Cancel and the submit (WR-02 follow-up)", () => {
  it("leaves Cancel and Save live by default", () => {
    const { tree } = renderEdit();
    for (const id of ["field-def-cancel", "field-def-submit"]) {
      expect(byTestId(tree, id)?.props.disabled).toBe(false);
      expect(byTestId(tree, id)?.props.accessibilityState).toEqual({
        disabled: false,
      });
      expect(dimmed(byTestId(tree, id))).toBe(false);
    }
  });

  it("disables, announces and dims Cancel and Save while busy", () => {
    const { tree } = renderEdit(true);
    for (const id of ["field-def-cancel", "field-def-submit"]) {
      expect(byTestId(tree, id)?.props.disabled).toBe(true);
      expect(byTestId(tree, id)?.props.accessibilityState).toEqual({
        disabled: true,
      });
      expect(dimmed(byTestId(tree, id))).toBe(true);
    }
  });

  it("a submit while busy is dropped", () => {
    const { tree, onSubmit } = renderEdit(true);
    (byTestId(tree, "field-def-submit")?.props.onPress as () => void)();
    expect(onSubmit).not.toHaveBeenCalled();
    const idle = renderEdit(false);
    (byTestId(idle.tree, "field-def-submit")?.props.onPress as () => void)();
    expect(idle.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("the create form's Cancel is held too; its empty-label submit stays disabled", () => {
    expect(
      byTestId(renderCreate(true), "field-def-cancel")?.props.disabled,
    ).toBe(true);
    expect(
      byTestId(renderCreate(false), "field-def-cancel")?.props.disabled,
    ).toBe(false);
    expect(
      byTestId(renderCreate(false), "field-def-submit")?.props.disabled,
    ).toBe(true);
  });
});
