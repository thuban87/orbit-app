/**
 * The Card-view selection bar (38.13 D-69 mockup M3b, D-72, D-75).
 *
 * Renders the REAL `BulkActionSurface` through a shallow resolver with a
 * small stateful hook store (the snooze-sheet-render harness), so the More…
 * sheet opens and closes across taps.
 */
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BulkActionAvailability } from "@/logic/dashboard-selection-applicability";
import type { BulkActionSurfaceProps } from "./BulkActionSurface";

const ALL_ENABLED: BulkActionAvailability = {
  canQuickLog: true,
  canSnooze: true,
  canAddFavorites: true,
  canOpenMore: true,
  canLogInteraction: true,
  showRemoveFavorites: true,
  canSetCategory: true,
  canChangeFrequency: true,
  canMoveToBin: true,
  canToggleSelectAll: true,
};

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
  useLayoutEffect: () => {},
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
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: "Text",
  View: "View",
}));
// 38.13 D-80 (review R1-05): the bar publishes its obstacle only while
// selection is on and Home is focused.
const nav = vi.hoisted(() => ({ focused: true, selectionMode: true }));
const obstacle = vi.hoisted(() => ({
  calls: [] as { key: string; enabled: boolean }[],
  ref: { current: null },
  onLayout: () => {},
}));
vi.mock("@react-navigation/native", () => ({
  useIsFocused: () => nav.focused,
}));
vi.mock("@/navigation/use-window-measurement", () => ({
  useWindowObstacle: (key: string, enabled: boolean) => {
    obstacle.calls.push({ key, enabled });
    return { ref: obstacle.ref, onLayout: obstacle.onLayout, measure: vi.fn() };
  },
}));
vi.mock("@/stores/dashboard-selection-store", () => ({
  useDashboardSelectionStore: (select: (state: { mode: boolean }) => unknown) =>
    select({ mode: nav.selectionMode }),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/Sheet", () => ({ Sheet: "Sheet" }));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: {
      accentText: "accentText",
      border: "border",
      surface: "surface",
      surfaceElevated: "surfaceElevated",
      textPrimary: "textPrimary",
      textSecondary: "textSecondary",
    },
  }),
}));

import { BulkActionSurface } from "./BulkActionSurface";

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

function baseProps(
  overrides: Partial<BulkActionSurfaceProps> = {},
): BulkActionSurfaceProps {
  return {
    selectedCount: 3,
    pending: false,
    selectAllLabel: "Select All",
    availability: ALL_ENABLED,
    onExit: vi.fn(),
    onToggleSelectAll: vi.fn(),
    onQuickLog: vi.fn(),
    onSnooze: vi.fn(),
    onAddFavourites: vi.fn(),
    onLogInteraction: vi.fn(),
    onRemoveFavourites: vi.fn(),
    onSetCategory: vi.fn(),
    onChangeFrequency: vi.fn(),
    onArchive: vi.fn(),
    ...overrides,
  };
}

/** A mounted bar: re-render with the same props, find by testID, tap. */
function mount(overrides: Partial<BulkActionSurfaceProps> = {}) {
  hooks.states = [];
  hooks.setters = [];
  hooks.refs = [];
  const props = baseProps(overrides);
  let nodes: Node[] = [];
  const render = () => {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    nodes = all(resolve(BulkActionSurface(props)));
  };
  render();
  const find = (testID: string) =>
    nodes.find((node) => node.props.testID === testID);
  const press = (testID: string) => {
    const node = find(testID);
    if (!node) throw new Error(`no node ${testID}`);
    (node.props.onPress as () => void)();
    render();
  };
  return {
    props,
    render,
    find,
    press,
    get nodes() {
      return nodes;
    },
  };
}

describe("BulkActionSurface — the M3b bar (38.13 D-69, D-72)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("row 1: an Exit selection close button, 'N selected' and a select-all button", () => {
    const bar = mount();
    const root = bar.find("dashboard-selection-bar");
    expect(root).toBeDefined();
    const exit = bar.find("bulk-action-exit");
    expect(exit?.props.accessibilityLabel).toBe("Exit selection");
    expect(
      exit?.children.some(
        (child) => child.type === "Icon" && child.props.name === "close",
      ),
    ).toBe(true);
    expect(textOf(bar.find("dashboard-selection-count"))).toBe("3 selected");
    const selectAll = bar.find("dashboard-selection-select-all");
    expect(textOf(selectAll)).toBe("Select All");
    bar.press("bulk-action-exit");
    expect(bar.props.onExit).toHaveBeenCalledOnce();
    bar.press("dashboard-selection-select-all");
    expect(bar.props.onToggleSelectAll).toHaveBeenCalledOnce();
  });

  it("row 2: exactly four buttons, Quick Log, Snooze, Favorite, More…, each an icon above its label", () => {
    const bar = mount();
    const buttons = bar.nodes.filter(
      (node) =>
        typeof node.props.testID === "string" &&
        /^bulk-action-(?!exit)/.test(node.props.testID as string),
    );
    expect(buttons.map((node) => node.props.testID)).toEqual([
      "bulk-action-quick-log",
      "bulk-action-snooze",
      "bulk-action-favorite",
      "bulk-action-more",
    ]);
    expect(buttons.map((node) => textOf(node))).toEqual([
      "Quick Log",
      "Snooze",
      "Favorite",
      "More…",
    ]);
    for (const button of buttons) {
      // Icon first, then the label: icon over label in a column.
      expect(button.children[0]?.type).toBe("Icon");
      expect(button.children[1]?.type).toBe("Text");
    }
  });

  it("each bar button calls its host handler", () => {
    const bar = mount();
    bar.press("bulk-action-quick-log");
    bar.press("bulk-action-snooze");
    bar.press("bulk-action-favorite");
    expect(bar.props.onQuickLog).toHaveBeenCalledOnce();
    expect(bar.props.onSnooze).toHaveBeenCalledOnce();
    expect(bar.props.onAddFavourites).toHaveBeenCalledOnce();
  });

  it("'Working…' shows only while a write is pending", () => {
    expect(mount().find("dashboard-selection-working")).toBeUndefined();
    const busy = mount({ pending: true });
    expect(textOf(busy.find("dashboard-selection-working"))).toBe("Working…");
  });
});

describe("BulkActionSurface — the More… sheet (38.13 D-75)", () => {
  it("opens from More… and lists the routine rows, then a separate Careful actions group", () => {
    const bar = mount();
    const sheet = () => bar.nodes.find((node) => node.type === "Sheet");
    expect(sheet()?.props.visible).toBe(false);
    bar.press("bulk-action-more");
    expect(sheet()?.props.visible).toBe(true);
    expect(textOf(bar.find("bulk-more-title"))).toBe("3 selected");
    const order = all(sheet()?.children ?? [])
      .map((node) => node.props.testID)
      .filter(
        (id): id is string =>
          typeof id === "string" && id.startsWith("bulk-more-"),
      )
      .filter((id) => id !== "bulk-more-title");
    expect(order).toEqual([
      "bulk-more-log-interaction",
      "bulk-more-remove-favorites",
      "bulk-more-set-category",
      "bulk-more-careful-heading",
      "bulk-more-frequency",
      "bulk-more-archive",
    ]);
    expect(textOf(bar.find("bulk-more-careful-heading"))).toBe(
      "Careful actions",
    );
    expect(textOf(bar.find("bulk-more-archive"))).toBe("Move to Bin");
  });

  it.each([
    ["bulk-more-log-interaction", "onLogInteraction"],
    ["bulk-more-remove-favorites", "onRemoveFavourites"],
    ["bulk-more-set-category", "onSetCategory"],
    ["bulk-more-frequency", "onChangeFrequency"],
    ["bulk-more-archive", "onArchive"],
  ] as const)("%s closes the sheet, then calls %s", (testID, handler) => {
    const bar = mount();
    bar.press("bulk-action-more");
    bar.press(testID);
    expect(bar.props[handler]).toHaveBeenCalledOnce();
    expect(bar.nodes.find((node) => node.type === "Sheet")?.props.visible).toBe(
      false,
    );
  });
});

describe("BulkActionSurface — only what applies is enabled (38.13 D-40, D-74, D-77)", () => {
  const disabledOf = (node: { props: Record<string, unknown> } | undefined) =>
    node?.props.disabled === true &&
    (node.props.accessibilityState as { disabled?: boolean }).disabled === true;

  it("the Snooze button is disabled when no selected Bound person can be snoozed", () => {
    const bar = mount({
      availability: { ...ALL_ENABLED, canSnooze: false },
    });
    expect(disabledOf(bar.find("bulk-action-snooze"))).toBe(true);
    expect(disabledOf(bar.find("bulk-action-quick-log"))).toBe(false);
  });

  it("Favorite always reads Favorite and is disabled when everyone selected is already a favourite (D-74)", () => {
    const bar = mount({
      availability: { ...ALL_ENABLED, canAddFavorites: false },
    });
    const favorite = bar.find("bulk-action-favorite");
    expect(textOf(favorite)).toBe("Favorite");
    expect(disabledOf(favorite)).toBe(true);
    expect(bar.nodes.some((node) => textOf(node).includes("Unfavorite"))).toBe(
      false,
    );
  });

  it("Remove from Favorites shows only when some selected Bound person is a favourite (D-75)", () => {
    const without = mount({
      availability: { ...ALL_ENABLED, showRemoveFavorites: false },
    });
    without.press("bulk-action-more");
    expect(without.find("bulk-more-remove-favorites")).toBeUndefined();
    expect(without.find("bulk-more-log-interaction")).toBeDefined();

    const withFav = mount();
    withFav.press("bulk-action-more");
    expect(withFav.find("bulk-more-remove-favorites")).toBeDefined();
  });

  it("each More… row follows its own flag", () => {
    const bar = mount({
      availability: {
        ...ALL_ENABLED,
        canSetCategory: false,
        canMoveToBin: false,
      },
    });
    bar.press("bulk-action-more");
    expect(disabledOf(bar.find("bulk-more-set-category"))).toBe(true);
    expect(disabledOf(bar.find("bulk-more-archive"))).toBe(true);
    expect(disabledOf(bar.find("bulk-more-frequency"))).toBe(false);
  });

  it("after an emptied universe the bar reads 0 selected and Select All, with every action disabled (R5-03)", () => {
    const none: BulkActionAvailability = {
      canQuickLog: false,
      canSnooze: false,
      canAddFavorites: false,
      canOpenMore: false,
      canLogInteraction: false,
      showRemoveFavorites: false,
      canSetCategory: false,
      canChangeFrequency: false,
      canMoveToBin: false,
      canToggleSelectAll: false,
    };
    const bar = mount({
      selectedCount: 0,
      selectAllLabel: "Select All",
      availability: none,
    });
    expect(textOf(bar.find("dashboard-selection-count"))).toBe("0 selected");
    expect(textOf(bar.find("dashboard-selection-select-all"))).toBe(
      "Select All",
    );
    for (const id of [
      "bulk-action-quick-log",
      "bulk-action-snooze",
      "bulk-action-favorite",
      "bulk-action-more",
    ]) {
      expect(disabledOf(bar.find(id))).toBe(true);
    }
  });

  it("a pending write disables every bar button", () => {
    const bar = mount({ pending: true });
    expect(disabledOf(bar.find("bulk-action-favorite"))).toBe(true);
  });

  it("while an action reads what it applies to, the buttons are busy and disabled, with no Working… (38.13 review A-IN-01; D-41)", () => {
    const bar = mount({ reading: true });
    for (const id of [
      "bulk-action-quick-log",
      "bulk-action-snooze",
      "bulk-action-favorite",
      "bulk-action-more",
    ]) {
      const button = bar.find(id);
      expect(disabledOf(button)).toBe(true);
      const state = button?.props.accessibilityState as
        | { busy?: boolean }
        | undefined;
      expect(state?.busy).toBe(true);
    }
    expect(bar.find("dashboard-selection-working")).toBeUndefined();
  });

  it("reads Deselect all when the host says so", () => {
    const bar = mount({ selectAllLabel: "Deselect all" });
    expect(textOf(bar.find("dashboard-selection-select-all"))).toBe(
      "Deselect all",
    );
  });
});

describe("BulkActionSurface — the selection-bar obstacle (38.13 D-80; review R1-05)", () => {
  beforeEach(() => {
    obstacle.calls = [];
    nav.focused = true;
    nav.selectionMode = true;
  });

  it("publishes dashboard-selection-bar while selecting on a focused Home, with ref and onLayout on the bar root", () => {
    const bar = mount();
    expect(obstacle.calls.at(-1)).toEqual({
      key: "dashboard-selection-bar",
      enabled: true,
    });
    const root = bar.find("dashboard-selection-bar");
    expect(root?.props.collapsable).toBe(false);
    expect(root?.props.onLayout).toBe(obstacle.onLayout);
    // React 19: `ref` is a plain prop on the element.
    expect(root?.props.ref).toBe(obstacle.ref);
  });

  it("publishes nothing while Home is unfocused (GroupLog / LogContact with selection on), and again on refocus", () => {
    nav.focused = false;
    mount();
    expect(obstacle.calls.at(-1)).toEqual({
      key: "dashboard-selection-bar",
      enabled: false,
    });
    nav.focused = true;
    mount();
    expect(obstacle.calls.at(-1)?.enabled).toBe(true);
  });

  it("publishes nothing once selection mode is off", () => {
    nav.selectionMode = false;
    mount();
    expect(obstacle.calls.at(-1)?.enabled).toBe(false);
  });
});
