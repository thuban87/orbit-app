import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { formatMonthDay } from "@/utils/dates";

/**
 * The custom-field Date widget as a native date picker (38.9 D-66, D-67;
 * CLAUDE.md custom-field invariants, ADR-001). Render pattern from
 * photo-field-widget-render.test.tsx: hooks stubbed, react-native mocked.
 * `useState` returns its initial value (or `true` for `false` while
 * `forceOpenPicker` is set, to reach the picker); setters are recorded.
 *
 * The invariant under test: the widget never calls `onChange` on render, so a
 * stored value (valid, padded, or invalid) is never rewritten until the user
 * picks or clears.
 */
const hooks = vi.hoisted(() => ({ forceOpenPicker: false }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (value: unknown) => [
    value === false && hooks.forceOpenPicker ? true : value,
    () => {},
  ],
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: "Text",
  View: "View",
}));
vi.mock("@react-native-community/datetimepicker", () => ({
  default: "DateTimePicker",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));

const { DateFieldWidget } = await import("./DateFieldWidget");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}
function texts(tree: TestElement[]): string[] {
  return tree.flatMap((node) => {
    const children = node.props.children;
    if (typeof children === "string") return [children];
    if (Array.isArray(children)) {
      return children.filter((c): c is string => typeof c === "string");
    }
    return [];
  });
}

const YEAR = new Date().getFullYear();

function render(value: string | null) {
  const onChange = vi.fn();
  const tree = nodes(
    DateFieldWidget({ value, onChange, label: "Anniversary", testID: "cf" }),
  );
  return { tree, onChange };
}

describe("DateFieldWidget (D-66, D-67)", () => {
  beforeEach(() => {
    hooks.forceOpenPicker = false;
  });

  it("an empty value shows Pick a date and no Clear", () => {
    for (const value of [null, ""]) {
      const { tree, onChange } = render(value);
      expect(texts(tree)).toContain("Pick a date");
      expect(
        tree.some((n) => n.props.accessibilityLabel === "Clear Anniversary"),
      ).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    }
  });

  it("a valid date renders formatted, with Clear, and emits nothing on render", () => {
    const { tree, onChange } = render(`${YEAR}-10-20`);
    expect(texts(tree)).toContain(formatMonthDay(10, 20));
    expect(texts(tree)).not.toContain("Not a date");
    expect(texts(tree)).toContain("Clear");
    const row = tree.find((n) => n.props.accessibilityLabel === "Anniversary");
    expect(row?.props.accessibilityValue).toEqual({ text: "Oct 20" });
    expect(row?.props.testID).toBe("cf");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a parser-valid padded value renders formatted with no caption (C6-L6)", () => {
    const { tree, onChange } = render(` ${YEAR}-10-20`);
    expect(texts(tree)).toContain("Oct 20");
    expect(texts(tree)).not.toContain("Not a date");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a stored non-date renders raw with Not a date and emits nothing", () => {
    const { tree, onChange } = render("next spring");
    expect(texts(tree)).toContain("next spring");
    expect(texts(tree)).toContain("Not a date");
    expect(texts(tree)).toContain("Clear");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("an impossible calendar date renders raw with Not a date (C6-L3)", () => {
    const { tree, onChange } = render("2026-02-31");
    expect(texts(tree)).toContain("2026-02-31");
    expect(texts(tree)).toContain("Not a date");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Clear emits an empty string", () => {
    const { tree, onChange } = render("next spring");
    const clear = tree.find(
      (n) => n.props.accessibilityLabel === "Clear Anniversary",
    );
    (clear?.props.onPress as () => void)();
    expect(onChange).toHaveBeenCalledExactlyOnceWith("");
  });

  it("the picker's set emits YYYY-MM-DD; a dismiss emits nothing; no range limit", () => {
    hooks.forceOpenPicker = true;
    const { tree, onChange } = render(null);
    expect(onChange).not.toHaveBeenCalled();
    const picker = tree.find((n) => n.type === "DateTimePicker");
    expect(picker?.props.mode).toBe("date");
    expect(picker?.props.minimumDate).toBeUndefined();
    expect(picker?.props.maximumDate).toBeUndefined();
    const change = picker?.props.onChange as (
      event: { type: string },
      date?: Date,
    ) => void;
    change({ type: "dismissed" }, new Date(2026, 9, 20));
    expect(onChange).not.toHaveBeenCalled();
    change({ type: "set" }, new Date(2026, 9, 20, 23, 30));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10-20");
  });

  it("offers no year-unknown control (D-67)", () => {
    hooks.forceOpenPicker = true;
    const { tree } = render(null);
    expect(texts(tree).some((t) => /year unknown/i.test(t))).toBe(false);
  });
});
