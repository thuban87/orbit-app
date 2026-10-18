import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArchivedContactRow } from "@/db/contacts-dao";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of the Bin list (38.12 D-31, D-32, D-40; convergence c1
 * L-2): it reads on focus, shows a loading line until the first read, each row
 * shows the Avatar, name and the day moved to the Bin with a visible Restore
 * and "Delete permanently" behind ⋯, and Restore acts at once with a snackbar
 * whose Undo moves the person back to the Bin with Move to Bin's
 * after-effects.
 *
 * `useState` is a call-order slot harness (as in
 * custom-fields-list-render.test.tsx). Screen slots: rows, loadFailed. The
 * row component is called as a plain function after the screen.
 */

const ROWS_SLOT = 0;
const LOAD_FAILED_SLOT = 1;

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  setters: [] as ((next: unknown) => void)[],
  index: 0,
  focus: null as null | (() => void),
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
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate }),
  useFocusEffect: (effect: () => void) => {
    hooks.focus = effect;
  },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui/AnchoredMenu", () => ({
  AnchoredMenu: "AnchoredMenu",
}));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/ui/ChromeScrim", () => ({ ChromeScrim: "ChromeScrim" }));
vi.mock("@/components/ui/ScopedPalette", () => ({
  ScopedPalette: "ScopedPalette",
}));
vi.mock("@/db/contacts-dao", () => ({
  archiveContact: vi.fn(async () => undefined),
  listArchived: vi.fn(async () => []),
  restoreContact: vi.fn(async () => "2026-09-01 08:00:00"),
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "2026-10-17 10:00:00",
}));
vi.mock("@/db/purge-dao", () => ({
  computeImpact: vi.fn(async () => ({})),
  impactSummaryLines: () => [],
  purgeContact: vi.fn(async () => undefined),
}));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 96,
}));
vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule: vi.fn(async () => undefined),
}));
vi.mock("@/services/notifications/purge-notification-cleanup", () => ({
  buildNotificationPurgeCleanup: () => vi.fn(),
}));
vi.mock("@/services/photos/photo-storage", () => ({
  deleteImportStaging: vi.fn(),
}));
vi.mock("@/services/photos/purge-photo-cleanup", () => ({
  buildPhotoPurgeCleanup: () => vi.fn(),
}));
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged: vi.fn(),
}));
vi.mock("@/stores/confirm-store", () => ({
  confirm: vi.fn(async () => false),
  notice: vi.fn(async () => undefined),
}));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: vi.fn() }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { ArchivedContactsScreen, BinRow, movedToBinLabel } = await import(
  "./ArchivedContactsScreen"
);
const dao = await import("@/db/contacts-dao");
const purge = await import("@/db/purge-dao");
const schedule = await import("@/services/notifications/notification-schedule");
const widget = await import("@/services/widget/widget-refresh");
const confirmStore = await import("@/stores/confirm-store");
const snackbar = await import("@/stores/snackbar-store");

type TestElement = ReactElement<Record<string, unknown>>;
const PALETTE = THEME_PRESETS.galaxy.dark;

/** Flatten a tree; a ScopedPalette's render-function child is expanded. */
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  const children = element.props.children;
  const expanded =
    typeof children === "function"
      ? (children as (palette: unknown) => ReactNode)(PALETTE)
      : (children as ReactNode);
  return [element, ...nodes(expanded)];
}

const ANN: ArchivedContactRow = {
  id: 7,
  name: "Ann Lee",
  photo: null,
  archived_at: "2026-10-13 09:00:00",
};

function renderScreen(rows: ArchivedContactRow[] | null): TestElement[] {
  hooks.states = [];
  hooks.setters = [];
  hooks.states[ROWS_SLOT] = rows;
  hooks.states[LOAD_FAILED_SLOT] = false;
  hooks.index = 0;
  return nodes(ArchivedContactsScreen());
}

function byTestId(tree: TestElement[], id: string): TestElement | undefined {
  return tree.find((node) => node.props.testID === id);
}

/** Render the BinRow element for `id` (its function component, called directly). */
function renderRow(tree: TestElement[], id: number): TestElement[] {
  const row = tree.find(
    (node) =>
      node.type === BinRow &&
      (node.props.contact as ArchivedContactRow).id === id,
  );
  if (!row) throw new Error(`no BinRow ${id}`);
  return nodes(BinRow(row.props as Parameters<typeof BinRow>[0]));
}

function press(tree: TestElement[], id: string): void {
  const target = byTestId(tree, id);
  if (!target) throw new Error(`no ${id}`);
  (target.props.onPress as () => void)();
}

function menuItems(
  tree: TestElement[],
): { label: string; danger?: boolean; onPress: () => void }[] {
  const menu = tree.find((node) => node.type === "AnchoredMenu");
  if (!menu) throw new Error("no AnchoredMenu");
  return menu.props.items as {
    label: string;
    danger?: boolean;
    onPress: () => void;
  }[];
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.focus = null;
});

describe("Bin list reads (D-31)", () => {
  it("reads on focus, not only on mount", async () => {
    vi.mocked(dao.listArchived).mockResolvedValueOnce([ANN]);
    renderScreen(null);
    expect(hooks.focus).not.toBeNull();
    expect(dao.listArchived).not.toHaveBeenCalled();
    hooks.focus?.();
    await flush();
    expect(dao.listArchived).toHaveBeenCalledTimes(1);
    expect(hooks.states[ROWS_SLOT]).toEqual([ANN]);
  });

  it("shows a loading line before the first read, never the empty state", () => {
    const tree = renderScreen(null);
    expect(byTestId(tree, "archived-loading")).toBeDefined();
    expect(byTestId(tree, "archived-empty")).toBeUndefined();
  });

  it("shows the empty state once a read returns nothing", () => {
    const tree = renderScreen([]);
    expect(byTestId(tree, "archived-empty")).toBeDefined();
    expect(byTestId(tree, "archived-loading")).toBeUndefined();
  });
});

describe("Bin rows (D-40)", () => {
  it("shows the Avatar, name and the day moved to the Bin, with a visible Restore", () => {
    const row = renderRow(renderScreen([ANN]), ANN.id);
    expect(row.some((node) => node.type === "Avatar")).toBe(true);
    expect(
      row.some(
        (node) => node.type === "Text" && node.props.children === "Ann Lee",
      ),
    ).toBe(true);
    const moved = byTestId(row, "archived-moved-7");
    expect(String(moved?.props.children)).toMatch(/^Moved to the Bin Oct 13/);
    const restore = byTestId(row, "archived-restore-7");
    expect(restore?.type).toBe("Button");
    expect(restore?.props.label).toBe("Restore");
  });

  it("puts Delete permanently behind the row ⋯ only", () => {
    const row = renderRow(renderScreen([ANN]), ANN.id);
    const items = menuItems(row);
    expect(items.map((item) => item.label)).toEqual(["Delete permanently"]);
    expect(items[0]?.danger).toBe(true);
    // No visible Delete control on the row at rest.
    expect(
      row.some(
        (node) =>
          node.type !== "AnchoredMenu" &&
          /Delete/.test(String(node.props.label ?? node.props.children ?? "")),
      ),
    ).toBe(false);
  });

  it("the ⋯ Delete permanently keeps the impact-summary confirm", async () => {
    const row = renderRow(renderScreen([ANN]), ANN.id);
    menuItems(row)[0]?.onPress();
    await flush();
    expect(purge.computeImpact).toHaveBeenCalledWith("exec", 7);
    expect(confirmStore.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete permanently",
        destructive: true,
      }),
    );
    expect(purge.purgeContact).not.toHaveBeenCalled();
  });

  it("formats the moved line through the display formatter", () => {
    const now = new Date(2026, 9, 17);
    expect(movedToBinLabel("2026-10-13 09:00:00", now)).toBe(
      "Moved to the Bin Oct 13",
    );
    expect(movedToBinLabel("2025-06-02 09:00:00", now)).toBe(
      "Moved to the Bin Jun 2, 2025",
    );
    expect(movedToBinLabel("garbage", now)).toBe("Moved to the Bin");
  });
});

describe("Restore with Undo (D-32, D-03; L-2)", () => {
  it("restores at once, reconciles, refreshes the widget and offers Undo", async () => {
    const row = renderRow(renderScreen([ANN]), ANN.id);
    press(row, "archived-restore-7");
    await flush();
    expect(dao.restoreContact).toHaveBeenCalledWith(
      "exec",
      7,
      "2026-10-17 10:00:00",
    );
    expect(schedule.reconcileSchedule).toHaveBeenCalledTimes(1);
    expect(widget.notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(dao.listArchived).toHaveBeenCalled();
    expect(snackbar.showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "success",
        label: "Restored Ann Lee",
        action: expect.objectContaining({ label: "Undo" }),
      }),
    );
  });

  it("Undo moves the person back to the Bin with Move to Bin's after-effects", async () => {
    const row = renderRow(renderScreen([ANN]), ANN.id);
    press(row, "archived-restore-7");
    await flush();
    const message = vi.mocked(snackbar.showSnackbar).mock.calls[0]?.[0];
    vi.mocked(schedule.reconcileSchedule).mockClear();
    vi.mocked(widget.notifyWidgetDataChanged).mockClear();
    vi.mocked(dao.listArchived).mockClear();

    message?.action?.onPress();
    await flush();

    // A-WR-03: back to the Bin with the original Bin date.
    expect(dao.archiveContact).toHaveBeenCalledWith(
      "exec",
      7,
      "2026-10-17 10:00:00",
      "2026-09-01 08:00:00",
    );
    expect(widget.notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(schedule.reconcileSchedule).toHaveBeenCalledTimes(1);
    expect(dao.listArchived).toHaveBeenCalledTimes(1);
    // Undo confirms itself (38.9 D-39 via D-04); no confirm dialog.
    expect(confirmStore.confirm).not.toHaveBeenCalled();
    expect(snackbar.showSnackbar).toHaveBeenLastCalledWith({
      kind: "success",
      label: "Moved Ann Lee back to the Bin",
    });
  });

  it("a failed Restore shows the error and re-reads, so a stale row disappears", async () => {
    vi.mocked(dao.restoreContact).mockRejectedValueOnce(new Error("stale"));
    const row = renderRow(renderScreen([ANN]), ANN.id);
    press(row, "archived-restore-7");
    await flush();
    expect(snackbar.showSnackbar).toHaveBeenCalledWith({
      kind: "error",
      label: "Couldn't restore. Please try again.",
    });
    expect(dao.listArchived).toHaveBeenCalledTimes(1);
    expect(schedule.reconcileSchedule).not.toHaveBeenCalled();
  });

  it("a failed Delete re-reads too", async () => {
    vi.mocked(purge.computeImpact).mockRejectedValueOnce(new Error("gone"));
    const row = renderRow(renderScreen([ANN]), ANN.id);
    menuItems(row)[0]?.onPress();
    await flush();
    expect(snackbar.showSnackbar).toHaveBeenCalledWith({
      kind: "error",
      label: "Couldn't delete. Please try again.",
    });
    expect(dao.listArchived).toHaveBeenCalledTimes(1);
  });
});
