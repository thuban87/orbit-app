/**
 * The Profile Birthday sheet (38.11 D-56, D-59, D-61; 38.9 D-30/D-39).
 *
 * Renders the REAL sheet and the REAL shared BirthdayField through a shallow
 * resolver with slot-seeded `useState` (the GroupLog harness idiom), then
 * drives the controls the user drives: the date row, the native picker's
 * result, the Year unknown switch and Clear. Everything the sheet saves goes
 * through its `onSave` prop; feedback goes through the snackbar store.
 */
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { birthdayPickerMaxDate } from "@/components/birthday-field-logic";

/** useState call order across one render: the sheet, then BirthdayField. */
const SLOT = {
  pending: 0,
  picker: 1,
} as const;

const hooks = vi.hoisted(() => ({
  index: 0,
  seed: new Map<number, unknown>(),
  initial: [] as unknown[],
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
    hooks.initial[slot] = initial;
    if (!hooks.setters[slot]) hooks.setters[slot] = vi.fn();
    return [
      hooks.seed.has(slot) ? hooks.seed.get(slot) : initial,
      hooks.setters[slot],
    ];
  },
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: "View",
}));
vi.mock("@react-native-community/datetimepicker", () => ({
  default: "DateTimePicker",
}));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  OrbitSwitch: "OrbitSwitch",
}));
vi.mock("@/components/ui/Sheet", () => ({ Sheet: "Sheet" }));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: {
      surface: "surface",
      border: "border",
      textPrimary: "textPrimary",
      textSecondary: "textSecondary",
    },
  }),
}));
const { showSnackbar } = vi.hoisted(() => ({ showSnackbar: vi.fn() }));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar }));

import { BirthdaySheet } from "./BirthdaySheet";

interface Node {
  type: string;
  props: Record<string, unknown>;
  text: string;
  children: Node[];
}

function resolve(node: ReactNode): Node[] {
  if (typeof node === "string" || typeof node === "number") {
    return [{ type: "literal", props: {}, text: String(node), children: [] }];
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

function textOf(node: Node | undefined): string {
  if (!node) return "";
  return node.type === "literal"
    ? node.text
    : node.children.map((child) => textOf(child)).join("");
}

const TODAY = "2026-10-16";

interface Rendered {
  nodes: Node[];
  onSave: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
}

function render(
  birthday: string | null,
  options: {
    onSave?: (value: string | null) => Promise<void>;
    picker?: { purpose: "date" | "year"; seed: string };
    pending?: boolean;
  } = {},
): Rendered {
  hooks.index = 0;
  hooks.seed.clear();
  if (options.picker) hooks.seed.set(SLOT.picker, options.picker);
  if (options.pending !== undefined)
    hooks.seed.set(SLOT.pending, options.pending);
  const onSave = vi.fn(options.onSave ?? (async () => {}));
  const onClose = vi.fn();
  const nodes = all(
    resolve(
      BirthdaySheet({
        visible: true,
        birthday,
        onSave,
        onClose,
      }),
    ),
  );
  return { nodes, onSave, onClose };
}

function byTestId(nodes: Node[], testID: string): Node | undefined {
  return nodes.find((node) => node.props.testID === testID);
}

function call<T extends unknown[]>(
  node: Node | undefined,
  prop: string,
  ...args: T
): void {
  const handler = node?.props[prop];
  if (typeof handler !== "function") throw new Error(`${prop} is missing`);
  (handler as (...values: T) => void)(...args);
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise<void>((done) => setImmediate(done));
  }
}

function lastSnackbar(): {
  kind: string;
  label: string;
  action?: { label: string; accessibilityLabel: string; onPress: () => void };
} {
  const calls = showSnackbar.mock.calls;
  return calls[calls.length - 1]?.[0];
}

/** A local Date for a `YYYY-MM-DD` (parts; never a UTC parse). */
function local(ymd: string): Date {
  return new Date(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(5, 7)) - 1,
    Number(ymd.slice(8, 10)),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
  showSnackbar.mockReset();
  hooks.setters = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BirthdaySheet harness", () => {
  it("pins the useState slots the tests seed", () => {
    render("1990-05-03");
    expect(hooks.initial[SLOT.pending]).toBe(false);
    expect(hooks.initial[SLOT.picker]).toBeNull();
  });
});

describe("BirthdaySheet (38.11 D-56, D-59)", () => {
  it("is a sheet titled Birthday with the date row, Year unknown, Clear and Close", () => {
    const { nodes } = render("1990-05-03");
    expect(nodes[0]?.type).toBe("Sheet");
    expect(nodes[0]?.props.visible).toBe(true);
    const heading = nodes.find(
      (node) => node.type === "AppText" && node.props.role === "heading",
    );
    expect(textOf(heading)).toBe("Birthday");
    expect(textOf(byTestId(nodes, "profile-birthday"))).toBe("May 3, 1990");
    expect(byTestId(nodes, "profile-birthday-year-unknown")?.props.value).toBe(
      false,
    );
    expect(byTestId(nodes, "profile-birthday-clear")).toBeDefined();
    expect(byTestId(nodes, "profile-birthday-close")?.props.label).toBe(
      "Close",
    );
  });

  it("a picker set saves at once and confirms with Birthday saved", async () => {
    const { nodes, onSave, onClose } = render("1990-05-03", {
      picker: { purpose: "date", seed: "1990-05-03" },
    });
    call(
      byTestId(nodes, "profile-birthday-picker"),
      "onChange",
      { type: "set" },
      local("1991-06-02"),
    );
    await flush();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("1991-06-02");
    expect(lastSnackbar()).toEqual({
      kind: "success",
      label: "Birthday saved",
    });
    expect(onClose).not.toHaveBeenCalled();
    // The pending state wraps the save.
    expect(hooks.setters[SLOT.pending]).toHaveBeenNthCalledWith(1, true);
    expect(hooks.setters[SLOT.pending]).toHaveBeenLastCalledWith(false);
  });

  it("opens a set birthday's date row on that date, with Year unknown off", () => {
    const { nodes } = render("1990-05-03");
    call(byTestId(nodes, "profile-birthday"), "onPress");
    expect(hooks.setters[SLOT.picker]).toHaveBeenCalledWith({
      purpose: "date",
      seed: "1990-05-03",
    });
  });

  it("caps the picker at today (D-86)", () => {
    const { nodes } = render("12-31", {
      picker: { purpose: "date", seed: "2000-12-31" },
    });
    const picker = byTestId(nodes, "profile-birthday-picker");
    expect(picker?.props.maximumDate).toEqual(birthdayPickerMaxDate(TODAY));
    expect(picker?.props.value).toEqual(local("2000-12-31"));
  });

  it("Clear saves null, says Birthday cleared with Undo, and closes the sheet", async () => {
    const { nodes, onSave, onClose } = render("1990-05-03");
    call(byTestId(nodes, "profile-birthday-clear"), "onPress");
    await flush();
    expect(onSave).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalledTimes(1);
    const cleared = lastSnackbar();
    expect(cleared.kind).toBe("warning");
    expect(cleared.label).toBe("Birthday cleared");
    expect(cleared.action?.label).toBe("Undo");

    // Undo restores the previous stored value through the same setter (38.9
    // D-30) and confirms with its own snackbar (38.9 D-39).
    cleared.action?.onPress();
    await flush();
    expect(onSave).toHaveBeenLastCalledWith("1990-05-03");
    expect(lastSnackbar()).toEqual({
      kind: "success",
      label: "Birthday restored",
    });
  });

  it("a failed Undo shows the save error", async () => {
    let fail = false;
    const { nodes, onSave } = render("1990-05-03", {
      onSave: async () => {
        if (fail) throw new Error("disk full");
      },
    });
    call(byTestId(nodes, "profile-birthday-clear"), "onPress");
    await flush();
    fail = true;
    lastSnackbar().action?.onPress();
    await flush();
    expect(onSave).toHaveBeenLastCalledWith("1990-05-03");
    expect(lastSnackbar()).toEqual({
      kind: "error",
      label: "Couldn't save the birthday. Try again.",
    });
  });

  it("a failed save keeps the sheet open, shows the error and keeps the shown value", async () => {
    const { nodes, onSave, onClose } = render("1990-05-03", {
      onSave: async () => {
        throw new Error("disk full");
      },
    });
    call(byTestId(nodes, "profile-birthday-clear"), "onPress");
    await flush();
    expect(onSave).toHaveBeenCalledWith(null);
    expect(onClose).not.toHaveBeenCalled();
    expect(lastSnackbar()).toEqual({
      kind: "error",
      label: "Couldn't save the birthday. Try again.",
    });
    expect(hooks.setters[SLOT.pending]).toHaveBeenLastCalledWith(false);
    // The shown value follows the stored value, which did not change.
    expect(textOf(byTestId(nodes, "profile-birthday"))).toBe("May 3, 1990");
  });

  it("ignores a second change while a save is pending", async () => {
    const { nodes, onSave } = render("1990-05-03", {
      onSave: () => new Promise<void>(() => {}),
    });
    call(
      byTestId(nodes, "profile-birthday-year-unknown"),
      "onValueChange",
      true,
    );
    call(byTestId(nodes, "profile-birthday-clear"), "onPress");
    await flush();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("blocks the controls while a save is pending", () => {
    const { nodes } = render("1990-05-03", { pending: true });
    const body = byTestId(nodes, "profile-birthday-body");
    expect(body?.props.pointerEvents).toBe("none");
    expect(body?.props.accessibilityState).toEqual({ busy: true });
  });
});

describe("BirthdaySheet Year unknown (38.11 D-61; 38.9 D-30)", () => {
  it("ON over a known year saves MM-DD with an Undo that restores the year", async () => {
    const { nodes, onSave } = render("1990-05-03");
    call(
      byTestId(nodes, "profile-birthday-year-unknown"),
      "onValueChange",
      true,
    );
    await flush();
    expect(onSave).toHaveBeenCalledWith("05-03");
    const saved = lastSnackbar();
    expect(saved.kind).toBe("success");
    expect(saved.label).toBe("Birthday saved");
    expect(saved.action?.label).toBe("Undo");
    saved.action?.onPress();
    await flush();
    expect(onSave).toHaveBeenLastCalledWith("1990-05-03");
    expect(lastSnackbar().label).toBe("Birthday restored");
  });

  it("ON over an already year-unknown birthday has nothing to drop", async () => {
    const { nodes, onSave } = render("05-03");
    expect(byTestId(nodes, "profile-birthday-year-unknown")?.props.value).toBe(
      true,
    );
    call(
      byTestId(nodes, "profile-birthday-year-unknown"),
      "onValueChange",
      true,
    );
    await flush();
    expect(onSave).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it("a plain date change saves without Undo", async () => {
    const { nodes, onSave } = render("05-03", {
      picker: { purpose: "date", seed: "2000-05-03" },
    });
    call(
      byTestId(nodes, "profile-birthday-picker"),
      "onChange",
      { type: "set" },
      local("2000-07-09"),
    );
    await flush();
    // Year unknown stays on: the placeholder year never reaches storage.
    expect(onSave).toHaveBeenCalledWith("07-09");
    expect(lastSnackbar()).toEqual({
      kind: "success",
      label: "Birthday saved",
    });
  });

  it("OFF on 02-29 asks for the year on the most recent leap-year 29 February", async () => {
    const { nodes, onSave } = render("02-29");
    call(
      byTestId(nodes, "profile-birthday-year-unknown"),
      "onValueChange",
      false,
    );
    await flush();
    expect(hooks.setters[SLOT.picker]).toHaveBeenCalledWith({
      purpose: "year",
      seed: "2024-02-29",
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("OFF on 12-31 asks on last year's date, never a future one (D-86)", () => {
    const { nodes } = render("12-31");
    call(
      byTestId(nodes, "profile-birthday-year-unknown"),
      "onValueChange",
      false,
    );
    expect(hooks.setters[SLOT.picker]).toHaveBeenCalledWith({
      purpose: "year",
      seed: "2025-12-31",
    });
  });

  it("the date row of a year-unknown birthday opens on the 2000 placeholder, the year ask on yearAskSeed (review V-10)", () => {
    const { nodes } = render("12-31");
    call(byTestId(nodes, "profile-birthday"), "onPress");
    expect(hooks.setters[SLOT.picker]).toHaveBeenLastCalledWith({
      purpose: "date",
      seed: "2000-12-31",
    });
    call(
      byTestId(nodes, "profile-birthday-year-unknown"),
      "onValueChange",
      false,
    );
    expect(hooks.setters[SLOT.picker]).toHaveBeenLastCalledWith({
      purpose: "year",
      seed: "2025-12-31",
    });
  });

  it("a picked year saves the full date; a cancelled ask leaves Year unknown on and saves nothing", async () => {
    const picked = render("12-31", {
      picker: { purpose: "year", seed: "2025-12-31" },
    });
    call(
      byTestId(picked.nodes, "profile-birthday-picker"),
      "onChange",
      { type: "set" },
      local("1988-12-31"),
    );
    await flush();
    expect(picked.onSave).toHaveBeenCalledWith("1988-12-31");

    const cancelled = render("12-31", {
      picker: { purpose: "year", seed: "2025-12-31" },
    });
    call(byTestId(cancelled.nodes, "profile-birthday-picker"), "onChange", {
      type: "dismissed",
    });
    await flush();
    expect(cancelled.onSave).not.toHaveBeenCalled();
    expect(
      byTestId(cancelled.nodes, "profile-birthday-year-unknown")?.props.value,
    ).toBe(true);
  });
});
