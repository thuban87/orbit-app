/**
 * The shared snooze sheet (38.11 D-45, D-37; reviews T-19, V-03, V-08, W-01,
 * Y-01).
 *
 * Renders the REAL `SnoozeSheet` through a shallow resolver with a small
 * STATEFUL hook store (state and refs persist across renders, a setter
 * updates its slot, `render()` re-runs the component), so pending, error,
 * Retry and close behave across taps as on device. Feedback goes through the
 * mocked snackbar store.
 */
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SnoozeSheetProps } from "./SnoozeSheet";

const hooks = vi.hoisted(() => ({
  stateIndex: 0,
  refIndex: 0,
  states: [] as unknown[],
  setters: [] as ((value: unknown) => void)[],
  refs: [] as { current: unknown }[],
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useEffect: () => {},
  useMemo: <T,>(factory: () => T) => factory(),
  useRef: <T,>(value: T) => {
    const slot = hooks.refIndex++;
    if (!hooks.refs[slot]) hooks.refs[slot] = { current: value };
    return hooks.refs[slot];
  },
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
  AccessibilityInfo: { announceForAccessibility: vi.fn() },
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: "View",
}));
vi.mock("@react-native-community/datetimepicker", () => ({
  default: "DateTimePicker",
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/ui/Sheet", () => ({ Sheet: "Sheet" }));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: { border: "border", surface: "surface" } }),
}));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));
const { showSnackbar } = vi.hoisted(() => ({ showSnackbar: vi.fn() }));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar }));

import { formatDisplayDateOrFallback } from "@/utils/dates";
import { SnoozeSheet } from "./SnoozeSheet";

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
const ERROR_COPY =
  "Couldn't save your changes. Nothing was applied. Try again.";

/** A mounted sheet: re-render with (possibly new) props, find, tap. */
function mount(initial: Partial<SnoozeSheetProps> = {}) {
  hooks.states = [];
  hooks.setters = [];
  hooks.refs = [];
  const onClose = vi.fn();
  let props: SnoozeSheetProps = {
    visible: true,
    title: "Snooze Alex",
    snoozedUntil: null,
    showUnsnooze: false,
    todayLocal: TODAY,
    onPreset: vi.fn(async () => {}),
    onUntil: vi.fn(async () => {}),
    onClose,
    ...initial,
  };
  let nodes: Node[] = [];
  const render = (next: Partial<SnoozeSheetProps> = {}) => {
    props = { ...props, ...next };
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    nodes = all(resolve(SnoozeSheet(props)));
    return nodes;
  };
  render();
  const byTestId = (testID: string) =>
    render().find((node) => node.props.testID === testID);
  const press = (testID: string) => {
    const node = byTestId(testID);
    const handler = node?.props.onPress;
    if (typeof handler !== "function") throw new Error(`${testID} missing`);
    (handler as () => void)();
  };
  const sheet = () => render().find((node) => node.type === "Sheet");
  return {
    render,
    byTestId,
    press,
    sheet,
    onClose,
    get props() {
      return props;
    },
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise<void>((done) => setImmediate(done));
  }
}

function deferred() {
  let resolveIt!: () => void;
  let rejectIt!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolveIt = res;
    rejectIt = rej;
  });
  return { promise, resolve: resolveIt, reject: rejectIt };
}

type SnackbarCall = {
  kind: string;
  label: string;
  action?: { label: string; accessibilityLabel: string; onPress: () => void };
};
const snackbars = (): SnackbarCall[] =>
  showSnackbar.mock.calls.map((call) => call[0] as SnackbarCall);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
  showSnackbar.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SnoozeSheet choices (D-45, D-15, D-37)", () => {
  it("offers the presets and Choose date, and Unsnooze only when allowed", () => {
    const plain = mount();
    for (const id of ["3d", "1w", "1m", "custom"]) {
      expect(plain.byTestId(`snooze-sheet-${id}`)).toBeDefined();
    }
    expect(plain.byTestId("snooze-sheet-unsnooze")).toBeUndefined();
    expect(plain.byTestId("snooze-sheet-current")).toBeUndefined();

    const snoozed = mount({
      snoozedUntil: "2026-10-20",
      showUnsnooze: true,
      onUnsnooze: vi.fn(async () => {}),
    });
    expect(snoozed.byTestId("snooze-sheet-unsnooze")).toBeDefined();
    expect(textOf(snoozed.byTestId("snooze-sheet-current"))).toBe(
      `Snoozed until ${formatDisplayDateOrFallback("2026-10-20")}`,
    );
  });

  it("starts Choose date at tomorrow, its minimum, and Cancel collapses it (D-37)", async () => {
    const onUntil = vi.fn(async () => {});
    const sheet = mount({ onUntil });
    sheet.press("snooze-sheet-custom");
    const picker = sheet.byTestId("snooze-sheet-picker");
    const value = picker?.props.value as Date;
    const minimum = picker?.props.minimumDate as Date;
    expect([value.getFullYear(), value.getMonth(), value.getDate()]).toEqual([
      2026, 9, 17,
    ]);
    expect([
      minimum.getFullYear(),
      minimum.getMonth(),
      minimum.getDate(),
    ]).toEqual([2026, 9, 17]);
    // The default is valid, so Set snooze is enabled before any pick.
    expect(sheet.byTestId("snooze-sheet-set")?.props.disabled).toBe(false);

    // The native dialog closes on its result; a pick changes the date.
    const onChange = picker?.props.onChange;
    if (typeof onChange !== "function") throw new Error("picker missing");
    (onChange as (event: unknown, date?: Date) => void)(
      { type: "set" },
      new Date(2026, 9, 22, 12),
    );
    expect(sheet.byTestId("snooze-sheet-picker")).toBeUndefined();
    sheet.press("snooze-sheet-set");
    await flush();
    expect(onUntil).toHaveBeenCalledWith("2026-10-22");

    const again = mount();
    again.press("snooze-sheet-custom");
    expect(again.byTestId("snooze-sheet-cancel-date")?.props).toMatchObject({
      label: "Cancel",
      accessibilityLabel: "Cancel choosing a date",
    });
    again.press("snooze-sheet-cancel-date");
    expect(again.byTestId("snooze-sheet-set")).toBeUndefined();
    expect(again.byTestId("snooze-sheet-picker")).toBeUndefined();
  });
});

describe("SnoozeSheet settlement (review T-19)", () => {
  it("closes after a resolved preset", async () => {
    const onPreset = vi.fn(async () => {});
    const sheet = mount({ onPreset });
    sheet.press("snooze-sheet-1w");
    await flush();
    expect(onPreset).toHaveBeenCalledWith("1w");
    expect(sheet.onClose).toHaveBeenCalledOnce();
  });

  it("keeps a failed save open with the error and Retry, and Retry re-runs it", async () => {
    let fail = true;
    const onPreset = vi.fn(async () => {
      if (fail) throw new Error("disk");
    });
    const sheet = mount({ onPreset });
    sheet.press("snooze-sheet-3d");
    await flush();
    expect(sheet.onClose).not.toHaveBeenCalled();
    expect(textOf(sheet.byTestId("snooze-sheet-error"))).toBe(ERROR_COPY);
    expect(sheet.byTestId("snooze-sheet-retry")).toBeDefined();

    fail = false;
    sheet.press("snooze-sheet-retry");
    await flush();
    expect(onPreset).toHaveBeenCalledTimes(2);
    expect(onPreset).toHaveBeenLastCalledWith("3d");
    expect(sheet.onClose).toHaveBeenCalledOnce();
    expect(sheet.byTestId("snooze-sheet-error")).toBeUndefined();
  });

  it("keeps a failed Unsnooze open with the error and Retry", async () => {
    let fail = true;
    const onUnsnooze = vi.fn(async () => {
      if (fail) throw new Error("disk");
    });
    const sheet = mount({
      snoozedUntil: "2026-10-20",
      showUnsnooze: true,
      onUnsnooze,
    });
    sheet.press("snooze-sheet-unsnooze");
    await flush();
    expect(sheet.onClose).not.toHaveBeenCalled();
    expect(textOf(sheet.byTestId("snooze-sheet-error"))).toBe(ERROR_COPY);

    fail = false;
    sheet.press("snooze-sheet-retry");
    await flush();
    expect(onUnsnooze).toHaveBeenCalledTimes(2);
    expect(sheet.onClose).toHaveBeenCalledOnce();
  });

  it("ignores Close, Back and the scrim while an operation runs (review V-08)", async () => {
    const write = deferred();
    const sheet = mount({ onPreset: vi.fn(() => write.promise) });
    sheet.press("snooze-sheet-1m");
    sheet.press("snooze-sheet-close");
    const onRequestClose = sheet.sheet()?.props.onRequestClose;
    if (typeof onRequestClose !== "function") throw new Error("no Sheet");
    (onRequestClose as () => void)();
    expect(sheet.onClose).not.toHaveBeenCalled();
    // A second choice while pending is ignored too.
    expect(sheet.byTestId("snooze-sheet-3d")?.props.disabled).toBe(true);

    write.reject(new Error("disk"));
    await flush();
    expect(textOf(sheet.byTestId("snooze-sheet-error"))).toBe(ERROR_COPY);
    expect(sheet.byTestId("snooze-sheet-retry")).toBeDefined();
    sheet.press("snooze-sheet-close");
    expect(sheet.onClose).toHaveBeenCalledOnce();
  });
});

describe("SnoozeSheet confirmation and Undo (38.9 D-39; review V-03, W-01, Y-01)", () => {
  it("shows one person-naming snackbar per resolved operation", async () => {
    const preset = mount({ confirmName: "Alex" });
    preset.press("snooze-sheet-1w");
    await flush();
    expect(snackbars()).toHaveLength(1);
    expect(snackbars()[0]).toMatchObject({
      kind: "success",
      label: "Snoozed Alex for 1 week",
    });

    showSnackbar.mockReset();
    const until = mount({ confirmName: "Alex" });
    until.press("snooze-sheet-custom");
    until.press("snooze-sheet-set");
    await flush();
    expect(snackbars()).toHaveLength(1);
    expect(snackbars()[0].label).toBe(
      `Snoozed Alex until ${formatDisplayDateOrFallback("2026-10-17")}`,
    );

    showSnackbar.mockReset();
    const unsnooze = mount({
      confirmName: "Alex",
      snoozedUntil: "2026-10-20",
      showUnsnooze: true,
      onUnsnooze: vi.fn(async () => {}),
    });
    unsnooze.press("snooze-sheet-unsnooze");
    await flush();
    expect(snackbars()).toHaveLength(1);
    expect(snackbars()[0].label).toBe("Unsnoozed Alex");
  });

  it("shows no confirmation after a rejection, nor without confirmName", async () => {
    const failing = mount({
      confirmName: "Alex",
      onPreset: vi.fn(async () => {
        throw new Error("disk");
      }),
    });
    failing.press("snooze-sheet-1w");
    await flush();
    expect(showSnackbar).not.toHaveBeenCalled();

    const bulk = mount();
    bulk.press("snooze-sheet-1w");
    await flush();
    expect(bulk.onClose).toHaveBeenCalledOnce();
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  async function undoAfter(
    action: "1w" | "unsnooze" | "custom",
    snoozedUntil: string | null,
    onRestore: (previous: string | null) => Promise<void>,
  ) {
    const sheet = mount({
      confirmName: "Alex",
      snoozedUntil,
      showUnsnooze: snoozedUntil !== null,
      onUnsnooze: vi.fn(async () => {}),
      onRestore,
    });
    if (action === "custom") {
      sheet.press("snooze-sheet-custom");
      sheet.press("snooze-sheet-set");
    } else {
      sheet.press(`snooze-sheet-${action}`);
    }
    await flush();
    const confirmation = snackbars().at(-1);
    expect(confirmation?.action?.label).toBe("Undo");
    return confirmation as Required<SnackbarCall>;
  }

  it("Undo restores not snoozed for a person who was not snoozed", async () => {
    const onRestore = vi.fn(async (_previous: string | null) => {});
    const confirmation = await undoAfter("1w", null, onRestore);
    confirmation.action.onPress();
    await flush();
    expect(onRestore).toHaveBeenCalledExactlyOnceWith(null);
    expect(snackbars().at(-1)).toMatchObject({
      kind: "success",
      label: "Snooze undone for Alex",
    });
  });

  it("Undo restores the previous date after a changed date or an Unsnooze", async () => {
    for (const action of ["custom", "unsnooze"] as const) {
      const onRestore = vi.fn(async (_previous: string | null) => {});
      const confirmation = await undoAfter(action, "2026-10-25", onRestore);
      confirmation.action.onPress();
      await flush();
      expect(onRestore).toHaveBeenCalledExactlyOnceWith("2026-10-25");
    }
  });

  it("Undo restores not snoozed when the previous date expired before the tap (review Y-01)", async () => {
    const onRestore = vi.fn(async (_previous: string | null) => {});
    const confirmation = await undoAfter("1w", "2026-10-17", onRestore);
    // The previous date was future at open; by the Undo tap it has passed.
    vi.setSystemTime(new Date(2026, 9, 17, 9, 0, 0));
    confirmation.action.onPress();
    await flush();
    expect(onRestore).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("an expired snooze passed as null restores not snoozed (review W-01)", async () => {
    // Hosts pass `isSnoozed(raw, today) ? raw : null`; a raw yesterday is null.
    const onRestore = vi.fn(async (_previous: string | null) => {});
    const sheet = mount({ confirmName: "Alex", snoozedUntil: null, onRestore });
    expect(sheet.byTestId("snooze-sheet-current")).toBeUndefined();
    expect(sheet.byTestId("snooze-sheet-unsnooze")).toBeUndefined();
    sheet.press("snooze-sheet-3d");
    await flush();
    snackbars().at(-1)?.action?.onPress();
    await flush();
    expect(onRestore).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("a failed Undo shows the error snackbar", async () => {
    const onRestore = vi.fn(async (_previous: string | null) => {
      throw new Error("disk");
    });
    const confirmation = await undoAfter("1w", null, onRestore);
    confirmation.action.onPress();
    await flush();
    expect(snackbars().at(-1)).toMatchObject({
      kind: "error",
      label: "Couldn't undo the snooze change for Alex. Try again.",
    });
  });
});
