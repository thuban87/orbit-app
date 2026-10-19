import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryWindow } from "@/services/history/window";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Discrete hook harness (the repo has no react-test-renderer): per-instance
 * hook slots, state that persists between renders, and effects queued until
 * the render returns, like a React commit. A state update does not re-render
 * on its own; each test renders again to read the latest tree.
 */
const rt = vi.hoisted(() => {
  type Slot = {
    init?: boolean;
    value?: unknown;
    setter?: (update: unknown) => void;
    deps?: readonly unknown[];
    cleanup?: (() => void) | undefined;
  };
  let slots: Slot[] = [];
  let cursor = 0;
  let queued: (() => void)[] = [];
  const changed = (slot: Slot, deps: readonly unknown[]) =>
    !slot.deps || deps.some((dep, i) => !Object.is(dep, slot.deps?.[i]));
  const next = (): Slot => {
    slots[cursor] ??= {};
    return slots[cursor++];
  };
  const hooks = {
    useState: (initial: unknown) => {
      const slot = next();
      if (!slot.init) {
        slot.init = true;
        slot.value =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
        slot.setter = (update: unknown) => {
          slot.value =
            typeof update === "function"
              ? (update as (prev: unknown) => unknown)(slot.value)
              : update;
        };
      }
      return [slot.value, slot.setter];
    },
    useRef: (value: unknown) => {
      const slot = next();
      if (!slot.init) {
        slot.init = true;
        slot.value = { current: value };
      }
      return slot.value;
    },
    useCallback: (callback: unknown, deps: readonly unknown[]) => {
      const slot = next();
      if (changed(slot, deps)) {
        slot.value = callback;
        slot.deps = deps;
      }
      return slot.value;
    },
    useEffect: (
      effect: () => (() => void) | undefined,
      deps: readonly unknown[],
    ) => {
      const slot = next();
      if (changed(slot, deps)) {
        slot.deps = deps;
        queued.push(() => {
          slot.cleanup?.();
          slot.cleanup = effect();
        });
      }
    },
  };
  return {
    hooks,
    render<T>(instance: Slot[], component: () => T): T {
      slots = instance;
      cursor = 0;
      const out = component();
      const run = queued;
      queued = [];
      for (const effect of run) effect();
      return out;
    },
  };
});

const mocks = vi.hoisted(() => ({
  getAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
  readYourWeekMetrics: vi.fn(),
  readYourWeekDateCounts: vi.fn(),
  readYourWeekDay: vi.fn(),
  buildYourWeekWindow: vi.fn(),
}));

vi.mock("react", () => rt.hooks);
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/SegmentedControl", () => ({
  SegmentedControl: "SegmentedControl",
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/digest/YourWeekHeatmap", () => ({
  YourWeekHeatmap: "YourWeekHeatmap",
}));
vi.mock("@/components/digest/DigestDayDetail", () => ({
  DigestDayDetail: "DigestDayDetail",
}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(() => ({})),
  localDateTime: () => "2026-09-19 12:00:00",
}));
vi.mock("@/db/app-settings-dao", () => ({
  getAppSettings: mocks.getAppSettings,
  updateAppSettings: mocks.updateAppSettings,
}));
vi.mock("@/db/your-week-read", () => ({
  readYourWeekMetrics: mocks.readYourWeekMetrics,
  readYourWeekDateCounts: mocks.readYourWeekDateCounts,
  readYourWeekDay: mocks.readYourWeekDay,
}));
vi.mock("@/services/history/week-window", () => ({
  buildYourWeekWindow: mocks.buildYourWeekWindow,
  resolveFirstWeekday: vi.fn(() => 0),
}));
vi.mock("@/utils/dates", () => ({ formatLocalDate: () => "2026-10-19" }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));
vi.mock("@/utils/uat-faults", () => ({
  applyUatFault: vi.fn(async () => undefined),
}));

const { YourWeekSection } = await import("./YourWeekSection");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  if (typeof element.type === "function") {
    return nodes(
      (element.type as (props: Record<string, unknown>) => ReactNode)(
        element.props,
      ),
    );
  }
  return [element, ...nodes(element.props.children as ReactNode)];
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function weekWindow(start: number, end: number): HistoryWindow {
  const dates: string[] = [];
  for (let day = start; day <= end; day += 1) {
    dates.push(`2026-10-${String(day).padStart(2, "0")}`);
  }
  return {
    lens: "7days",
    ref: "2026-10-19",
    start: dates[0],
    end: dates[dates.length - 1],
    cells: dates.map((date) => ({
      date,
      isPlaceholder: false,
      isFuture: date > "2026-10-19",
    })),
  };
}

// Rolling 7 Days ends today (Oct 13–19); the Sunday-start Calendar Week is
// Oct 18–24. Oct 14 is real only in the rolling window; Oct 19 is in both.
const ROLLING = weekWindow(13, 19);
const CALENDAR = weekWindow(18, 24);
const BUSY = { peopleReached: 2, interactions: 3, events: 1 };

type PeriodRead = {
  start: string;
  read: ReturnType<typeof deferred<typeof BUSY>>;
};
let periodReads: PeriodRead[];
let dayReads: ReturnType<typeof deferred<unknown[]>>[];
let settingsWrites: ReturnType<typeof deferred<void>>[];

beforeEach(() => {
  periodReads = [];
  dayReads = [];
  settingsWrites = [];
  mocks.getAppSettings.mockReset();
  mocks.getAppSettings.mockResolvedValue({ yourWeekPeriod: "rolling7" });
  mocks.buildYourWeekWindow.mockReset();
  mocks.buildYourWeekWindow.mockImplementation((period: string) =>
    period === "rolling7" ? ROLLING : CALENDAR,
  );
  mocks.readYourWeekMetrics.mockReset();
  mocks.readYourWeekMetrics.mockImplementation(
    (_exec: unknown, start: string) => {
      const read = deferred<typeof BUSY>();
      periodReads.push({ start, read });
      return read.promise;
    },
  );
  mocks.readYourWeekDateCounts.mockReset();
  mocks.readYourWeekDateCounts.mockResolvedValue([]);
  mocks.readYourWeekDay.mockReset();
  mocks.readYourWeekDay.mockImplementation(() => {
    const read = deferred<unknown[]>();
    dayReads.push(read);
    return read.promise;
  });
  mocks.updateAppSettings.mockReset();
  mocks.updateAppSettings.mockImplementation(() => {
    const write = deferred<void>();
    settingsWrites.push(write);
    return write.promise;
  });
});

function mount(initialSignal = 0) {
  const instance: never[] = [];
  const props = {
    refreshSignal: initialSignal,
    onOpenProfile: vi.fn(),
    onOpenEvent: vi.fn(),
  };
  const render = (refreshSignal = props.refreshSignal) => {
    props.refreshSignal = refreshSignal;
    return nodes(rt.render(instance, () => YourWeekSection({ ...props })));
  };
  const find = (type: string) => render().find((node) => node.type === type);
  const has = (testID: string) =>
    render().some((node) => node.props.testID === testID);
  const heatmap = () => find("YourWeekHeatmap");
  const changePeriod = (period: string) => {
    const toggle = find("SegmentedControl");
    if (!toggle) throw new Error("Missing period toggle");
    (toggle.props.onChange as (value: string) => void)(period);
  };
  const tapDay = (date: string) => {
    const onSelectDay = heatmap()?.props.onSelectDay as (
      value: string,
    ) => Promise<void>;
    void onSelectDay(date);
  };
  return { props, render, find, has, heatmap, changePeriod, tapDay };
}

/** Mount and land the first Rolling 7 Days read. */
async function mountLoaded() {
  const view = mount();
  view.render();
  await settle();
  expect(periodReads).toHaveLength(1);
  periodReads[0].read.resolve(BUSY);
  await settle();
  expect(view.heatmap()?.props.window).toBe(ROLLING);
  return view;
}

describe("YourWeekSection", () => {
  it("renders informational metrics and the two-option period binding", () => {
    const tree = mount().render();
    const toggle = tree.find((node) => node.type === "SegmentedControl");
    expect(toggle?.props.testID).toBe("your-week-period");
    expect(toggle?.props.value).toBe("rolling7");
    expect(toggle?.props.options).toEqual([
      { label: "Rolling 7 Days", value: "rolling7" },
      { label: "Calendar Week", value: "calendar_week" },
    ]);
    expect(typeof toggle?.props.onChange).toBe("function");
    expect(
      tree
        .map((node) => node.props.accessibilityLabel)
        .filter((label) => typeof label === "string"),
    ).toEqual(
      expect.arrayContaining([
        "People reached, 0",
        "Interactions, 0",
        "Events, 0",
      ]),
    );
  });

  it("renders no day detail while the day detail is idle (no selection)", () => {
    const tree = mount().render();
    expect(tree.some((node) => node.type === "DigestDayDetail")).toBe(false);
  });

  it("passes the navigation callbacks to the day detail (38.13 D-46)", async () => {
    const view = await mountLoaded();
    view.tapDay("2026-10-14");
    await settle();
    dayReads[0].resolve([]);
    await settle();
    const detail = view.find("DigestDayDetail");
    expect(detail?.props.onOpenProfile).toBe(view.props.onOpenProfile);
    expect(detail?.props.onOpenEvent).toBe(view.props.onOpenEvent);
  });
});

describe("re-tapping the selected day closes it (38.13 D-45)", () => {
  it("closes the open day without a new read", async () => {
    const view = await mountLoaded();
    view.tapDay("2026-10-14");
    await settle();
    dayReads[0].resolve([]);
    await settle();
    expect(view.heatmap()?.props.selectedDate).toBe("2026-10-14");
    expect(view.find("DigestDayDetail")).toBeDefined();

    view.tapDay("2026-10-14");
    await settle();
    expect(view.heatmap()?.props.selectedDate).toBeNull();
    expect(view.find("DigestDayDetail")).toBeUndefined();
    expect(mocks.readYourWeekDay).toHaveBeenCalledTimes(1);
  });

  it("retires the outstanding read: a late result after closing publishes nothing", async () => {
    const view = await mountLoaded();
    view.tapDay("2026-10-14");
    await settle();
    view.tapDay("2026-10-14");
    await settle();
    dayReads[0].resolve([]);
    await settle();
    expect(view.heatmap()?.props.selectedDate).toBeNull();
    expect(view.find("DigestDayDetail")).toBeUndefined();
  });

  it("tapping another day moves the selection and reads that day", async () => {
    const view = await mountLoaded();
    view.tapDay("2026-10-14");
    await settle();
    view.tapDay("2026-10-15");
    await settle();
    expect(view.heatmap()?.props.selectedDate).toBe("2026-10-15");
    expect(mocks.readYourWeekDay).toHaveBeenCalledTimes(2);
    dayReads[1].resolve([]);
    await settle();
    expect(view.find("DigestDayDetail")?.props.date).toBe("2026-10-15");
  });
});

describe("a period switch keeps the body mounted (38.13 D-49)", () => {
  it("holds the old week until the new period's read lands (accepted write)", async () => {
    const view = await mountLoaded();
    view.changePeriod("calendar_week");
    await settle();
    expect(view.find("SegmentedControl")?.props.value).toBe("calendar_week");
    expect(view.heatmap()?.props.window).toBe(ROLLING);
    settingsWrites[0].resolve();
    await settle();
    expect(view.heatmap()?.props.window).toBe(ROLLING);
    periodReads[1].read.resolve(BUSY);
    await settle();
    expect(view.heatmap()?.props.window).toBe(CALENDAR);
    expect(view.has("your-week-error")).toBe(false);
  });

  it("holds the old week through a rolled-back write until the rollback read lands", async () => {
    const view = await mountLoaded();
    view.changePeriod("calendar_week");
    await settle();
    settingsWrites[0].reject(new Error("write failed"));
    await settle();
    expect(view.find("SegmentedControl")?.props.value).toBe("rolling7");
    expect(view.heatmap()?.props.window).toBe(ROLLING);
    // The abandoned period's late read is stale and never publishes.
    periodReads[1].read.resolve(BUSY);
    await settle();
    expect(view.heatmap()?.props.window).toBe(ROLLING);
    expect(periodReads).toHaveLength(3);
    periodReads[2].read.resolve(BUSY);
    await settle();
    expect(view.heatmap()?.props.window).toBe(ROLLING);
    expect(view.has("your-week-error")).toBe(false);
  });

  it("clears a day tapped mid-switch that is not a real day in the new window, and retires its read", async () => {
    const view = await mountLoaded();
    view.changePeriod("calendar_week");
    await settle();
    view.tapDay("2026-10-14");
    await settle();
    expect(view.heatmap()?.props.selectedDate).toBe("2026-10-14");
    periodReads[1].read.resolve(BUSY);
    await settle();
    expect(view.heatmap()?.props.window).toBe(CALENDAR);
    expect(view.heatmap()?.props.selectedDate).toBeNull();
    expect(view.find("DigestDayDetail")).toBeUndefined();
    dayReads[0].resolve([]);
    await settle();
    expect(view.find("DigestDayDetail")).toBeUndefined();
  });

  it("keeps a day tapped mid-switch that is a real day in both windows, with its detail", async () => {
    const view = await mountLoaded();
    view.changePeriod("calendar_week");
    await settle();
    view.tapDay("2026-10-19");
    await settle();
    dayReads[0].resolve([]);
    await settle();
    periodReads[1].read.resolve(BUSY);
    await settle();
    expect(view.heatmap()?.props.window).toBe(CALENDAR);
    expect(view.heatmap()?.props.selectedDate).toBe("2026-10-19");
    expect(view.find("DigestDayDetail")?.props.date).toBe("2026-10-19");
  });
});

describe("a failed read never shows another period's week as loaded (38.13 D-49, 38.3 B-WR-06)", () => {
  it("the new period's read fails: error body, not the old heatmap", async () => {
    const view = await mountLoaded();
    view.changePeriod("calendar_week");
    await settle();
    periodReads[1].read.reject(new Error("read failed"));
    await settle();
    expect(view.heatmap()).toBeUndefined();
    expect(view.has("your-week-error")).toBe(true);
    expect(view.has("your-week-refresh-error")).toBe(false);
  });

  it("the rollback read fails while the abandoned period's week is held: error body", async () => {
    const view = await mountLoaded();
    view.changePeriod("calendar_week");
    await settle();
    periodReads[1].read.resolve(BUSY);
    await settle();
    expect(view.heatmap()?.props.window).toBe(CALENDAR);
    settingsWrites[0].reject(new Error("write failed"));
    await settle();
    expect(view.heatmap()?.props.window).toBe(CALENDAR);
    periodReads[2].read.reject(new Error("read failed"));
    await settle();
    expect(view.heatmap()).toBeUndefined();
    expect(view.has("your-week-error")).toBe(true);
  });

  it("the rollback read fails while the rolled-back period's week is held: it stays, with the notice", async () => {
    const view = await mountLoaded();
    view.changePeriod("calendar_week");
    await settle();
    settingsWrites[0].reject(new Error("write failed"));
    await settle();
    periodReads[2].read.reject(new Error("read failed"));
    await settle();
    expect(view.heatmap()?.props.window).toBe(ROLLING);
    expect(view.has("your-week-refresh-error")).toBe(true);
    expect(view.has("your-week-error")).toBe(false);
  });

  it("a failed refresh of the period already shown keeps the week with the notice", async () => {
    const view = await mountLoaded();
    view.render(1);
    await settle();
    expect(periodReads).toHaveLength(2);
    periodReads[1].read.reject(new Error("read failed"));
    await settle();
    expect(view.heatmap()?.props.window).toBe(ROLLING);
    expect(view.has("your-week-refresh-error")).toBe(true);
    expect(view.has("your-week-error")).toBe(false);
  });
});
