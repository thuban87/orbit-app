import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OffLimitsInlineEditor's edit reveal (38.10 verification): on Add/Edit
 * Contact the edit form opens after the rows, so an Edit asks the host to
 * scroll the form (`formRef`) into view through `onEditOpen`.
 *
 * Hooks are stubbed so the editor renders as a plain function (the
 * MemoryEditor.test pattern): `useState` returns its initial value, or the
 * seeded open form for the form slot; every setter call is counted.
 */
const hooks = vi.hoisted(() => ({
  form: null as unknown,
  setters: 0,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => {},
  useImperativeHandle: () => {},
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [
    // The first useState is the open form (null when closed).
    value === null ? hooks.form : value,
    () => {
      hooks.setters += 1;
    },
  ],
}));
vi.mock("react-native", () => ({
  StyleSheet: { create: <T>(styles: T) => styles, hairlineWidth: 1 },
  View: "View",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("./OffLimitsForm", () => ({ OffLimitsForm: "OffLimitsForm" }));
vi.mock("./ui", () => ({ AppText: "AppText", Button: "Button" }));

import {
  OffLimitsInlineEditor,
  type OffLimitsInlineEditorProps,
} from "./OffLimitsInlineEditor";

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

const item = { id: 3, text: "Politics", label: null, url: null };
const render = (props: Partial<OffLimitsInlineEditorProps> = {}) =>
  nodes(
    OffLimitsInlineEditor({
      items: [item],
      addLabel: "Add Off Limits Item",
      onAdd: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      ...props,
    }),
  );
const pressButton = (tree: TestElement[], label: string) => {
  const handler = tree.find(
    (n) => n.type === "Button" && n.props.label === label,
  )?.props.onPress;
  if (typeof handler !== "function") throw new Error(`missing ${label}`);
  handler();
};

describe("OffLimitsInlineEditor edit reveal (38.10 verification)", () => {
  beforeEach(() => {
    hooks.form = null;
    hooks.setters = 0;
  });

  it("Edit opens the row's form and asks the host to reveal it", () => {
    const onEditOpen = vi.fn();
    pressButton(render({ onEditOpen }), "Edit");
    // openForm: setDirty + setForm.
    expect(hooks.setters).toBe(2);
    expect(onEditOpen).toHaveBeenCalledTimes(1);
  });

  it("a held Edit (save in flight) opens nothing and asks nothing", () => {
    const onEditOpen = vi.fn();
    pressButton(render({ onEditOpen, busy: true }), "Edit");
    expect(hooks.setters).toBe(0);
    expect(onEditOpen).not.toHaveBeenCalled();
  });

  it("the Add opens its form in the Add's own place and asks nothing", () => {
    const onEditOpen = vi.fn();
    pressButton(render({ onEditOpen }), "Add Off Limits Item");
    expect(hooks.setters).toBe(2);
    expect(onEditOpen).not.toHaveBeenCalled();
  });

  it("the open form carries the host's formRef", () => {
    const formRef = { current: null };
    hooks.form = { item, key: 1 };
    const form = render({ formRef }).find((n) => n.type === "OffLimitsForm");
    expect(form?.props.formRef).toBe(formRef);
    expect(form?.props.initial).toBe(item);
  });
});
