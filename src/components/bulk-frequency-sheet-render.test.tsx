/**
 * The bulk Change Contact Frequency sheet (38.13 D-39, D-71).
 *
 * Renders the REAL `BulkFrequencySheet` through a shallow resolver with a small
 * stateful hook store (the bulk-action-surface-render harness). The picker is
 * left unresolved so its props (value, onChange, onValidityChange) can be
 * driven directly.
 */
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BulkFrequencySheetProps } from "./BulkFrequencySheet";

const hooks = vi.hoisted(() => ({
  stateIndex: 0,
  states: [] as unknown[],
  setters: [] as ((value: unknown) => void)[],
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (value: unknown) => {
    const slot = hooks.stateIndex++;
    if (!(slot in hooks.states)) {
      hooks.states[slot] =
        typeof value === "function" ? (value as () => unknown)() : value;
    }
    if (!hooks.setters[slot]) {
      hooks.setters[slot] = (next: unknown) => {
        hooks.states[slot] =
          typeof next === "function"
            ? (next as (current: unknown) => unknown)(hooks.states[slot])
            : next;
      };
    }
    return [hooks.states[slot], hooks.setters[slot]];
  },
}));
vi.mock("react-native", () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: "View",
}));
vi.mock("@/components/FrequencyPicker", () => ({
  FrequencyPicker: "FrequencyPicker",
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/ui/Sheet", () => ({ Sheet: "Sheet" }));

import { BulkFrequencySheet } from "./BulkFrequencySheet";

interface Node {
  type: string;
  key: string | null;
  props: Record<string, unknown>;
  text: string;
  children: Node[];
}

function resolve(node: ReactNode): Node[] {
  if (typeof node === "string" || typeof node === "number") {
    return [
      {
        type: "literal",
        key: null,
        props: {},
        text: String(node),
        children: [],
      },
    ];
  }
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type !== "string") return resolve(element.props.children);
  return [
    {
      type: element.type,
      key: element.key,
      props: element.props,
      text: "",
      children: resolve(element.props.children),
    },
  ];
}

function all(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

function textOf(node: Node | undefined): string {
  if (!node) return "";
  return node.type === "literal"
    ? node.text
    : node.children.map((child) => textOf(child)).join("");
}

/**
 * A mounted sheet. React re-renders at once after a render-phase state
 * update; `render` does the same by rendering until the state settles.
 */
function mount(initial: Partial<BulkFrequencySheetProps> = {}) {
  hooks.states = [];
  hooks.setters = [];
  const props: BulkFrequencySheetProps = {
    visible: true,
    onCancel: vi.fn(),
    onContinue: vi.fn(),
    ...initial,
  };
  let nodes: Node[] = [];
  const render = () => {
    for (let pass = 0; pass < 3; pass += 1) {
      const before = JSON.stringify(hooks.states);
      hooks.stateIndex = 0;
      nodes = all(resolve(BulkFrequencySheet(props)));
      if (JSON.stringify(hooks.states) === before) return;
    }
  };
  render();
  const byType = (type: string) => nodes.find((node) => node.type === type);
  return {
    props,
    render,
    byType,
    picker: () => byType("FrequencyPicker") as Node,
    continueButton: () =>
      nodes.find(
        (node) => node.props.testID === "bulk-frequency-continue",
      ) as Node,
  };
}

describe("BulkFrequencySheet (D-39)", () => {
  beforeEach(() => {
    hooks.states = [];
    hooks.setters = [];
  });

  it("is a compact sheet titled Change Contact Frequency, starting on 30 days", () => {
    const sheet = mount();
    const root = sheet.byType("Sheet");
    expect(root?.props.variant).toBe("compact");
    expect(root?.props.visible).toBe(true);
    expect(textOf(sheet.byType("AppText"))).toBe("Change Contact Frequency");
    expect(sheet.picker().props.value).toBe(30);
    expect(sheet.continueButton().props.disabled).toBe(false);
  });

  it("blocks Continue while the picker reports an invalid custom entry", () => {
    const sheet = mount();
    (sheet.picker().props.onValidityChange as (valid: boolean) => void)(false);
    sheet.render();
    expect(sheet.continueButton().props.disabled).toBe(true);
    (sheet.continueButton().props.onPress as () => void)();
    expect(sheet.props.onContinue).not.toHaveBeenCalled();
  });

  it("continues with the picker's value", () => {
    const sheet = mount();
    (sheet.picker().props.onChange as (days: number) => void)(90);
    sheet.render();
    expect(sheet.picker().props.value).toBe(90);
    (sheet.continueButton().props.onPress as () => void)();
    expect(sheet.props.onContinue).toHaveBeenCalledWith(90);
  });

  it("starts again on the preset, with a fresh picker, each time it opens", () => {
    const sheet = mount();
    (sheet.picker().props.onChange as (days: number) => void)(12);
    (sheet.picker().props.onValidityChange as (valid: boolean) => void)(false);
    sheet.render();
    const firstKey = sheet.picker().key;
    sheet.props.visible = false;
    sheet.render();
    sheet.props.visible = true;
    sheet.render();
    expect(sheet.picker().props.value).toBe(30);
    expect(sheet.continueButton().props.disabled).toBe(false);
    expect(sheet.picker().key).not.toBe(firstKey);
  });

  it("cancels through the sheet's own close request", () => {
    const sheet = mount();
    const root = sheet.byType("Sheet") as Node;
    (root.props.onRequestClose as () => void)();
    expect(sheet.props.onCancel).toHaveBeenCalledTimes(1);
  });
});
