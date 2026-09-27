/**
 * Dashboard refresh scheduler + single publication seam (38.3 RG-022, D-23,
 * D-14; performance/AUD-PERF-002, react-native/AUD-RN-010).
 *
 * Proves: hidden shell/foreground requests are deferred to the next focus read;
 * every issued read is logged once with its trigger; an older read resolving or
 * rejecting after a newer one publishes NOTHING (rows, line-3, matches, listNow,
 * counts, population counts, error, fade start, generation, refreshing,
 * initialLoad); and HomeScreen's `reload` dependency list names no
 * animation/lifecycle state. Hand-rolled deferred promises, no timers.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  createDashboardRefreshScheduler,
  type DashboardReadOutcome,
  type DashboardRefreshSource,
  dashboardFadeStart,
  isDashboardVisible,
  publishDashboardRead,
} from "@/screens/dashboard-refresh-scheduler";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Row = { id: number; name: string };
type Counts = { live: number };
type PopulationCounts = { favourites: number };

/** Records every sink call in order, so a stale publication is observable. */
function recordingSinks() {
  const calls: Array<[string, unknown]> = [];
  const sink =
    (name: string) =>
    (value?: unknown): void => {
      calls.push([name, value]);
    };
  return {
    calls,
    names: () => calls.map(([name]) => name),
    valuesOf: (name: string) =>
      calls.filter(([n]) => n === name).map(([, v]) => v),
    sinks: {
      setRows: sink("rows"),
      setLine3: sink("line3"),
      setSearchMatches: sink("searchMatches"),
      setListNow: sink("listNow"),
      setCounts: sink("counts"),
      setPopulationCounts: sink("populationCounts"),
      setError: sink("error"),
      setFadeStart: sink("fadeStart"),
      bumpResultGeneration: sink("generation"),
      setRefreshing: sink("refreshing"),
      setInitialLoad: sink("initialLoad"),
    },
  };
}

function okOutcome(
  label: string,
): DashboardReadOutcome<Row, string, string, Counts, PopulationCounts> {
  return {
    kind: "ok",
    rows: [{ id: 1, name: label }],
    line3: new Map([[1, `${label}-line3`]]),
    searchMatches: new Map([[1, `${label}-match`]]),
    listNow: `${label}-now`,
    counts: { live: label === "B" ? 2 : 1 },
    populationCounts: { favourites: label === "B" ? 20 : 10 },
    fadeStart: label === "B" ? 0 : 1,
  };
}

describe("createDashboardRefreshScheduler", () => {
  it("issues a focus read while visible, once, with a token", () => {
    const reads: Array<[number, DashboardRefreshSource]> = [];
    const scheduler = createDashboardRefreshScheduler({
      read: (token, source) => reads.push([token, source]),
      isVisible: () => true,
    });
    const token = scheduler.request("focus");
    expect(token).not.toBeNull();
    expect(reads).toEqual([[token, "focus"]]);
    expect(scheduler.isCurrent(token as number)).toBe(true);
  });

  it("defers shell and foreground while hidden; the next focus request reads exactly once", () => {
    let visible = false;
    const reads: DashboardRefreshSource[] = [];
    const scheduler = createDashboardRefreshScheduler({
      read: (_token, source) => reads.push(source),
      isVisible: () => visible,
    });
    expect(scheduler.request("shell")).toBeNull();
    expect(scheduler.request("foreground")).toBeNull();
    expect(scheduler.request("shell")).toBeNull();
    expect(reads).toEqual([]);

    visible = true;
    expect(scheduler.request("focus")).not.toBeNull();
    expect(reads).toEqual(["focus"]);
  });

  it("always issues focus, pull and snooze even while hidden", () => {
    const reads: DashboardRefreshSource[] = [];
    const scheduler = createDashboardRefreshScheduler({
      read: (_token, source) => reads.push(source),
      isVisible: () => false,
    });
    scheduler.request("focus");
    scheduler.request("pull");
    scheduler.request("snooze");
    expect(reads).toEqual(["focus", "pull", "snooze"]);
  });

  it("issues shell and foreground while visible", () => {
    const reads: DashboardRefreshSource[] = [];
    const scheduler = createDashboardRefreshScheduler({
      read: (_token, source) => reads.push(source),
      isVisible: () => true,
    });
    scheduler.request("shell");
    scheduler.request("foreground");
    expect(reads).toEqual(["shell", "foreground"]);
  });

  it("a newer request makes every older token non-current", () => {
    const scheduler = createDashboardRefreshScheduler({
      read: () => {},
      isVisible: () => true,
    });
    const a = scheduler.request("focus") as number;
    const b = scheduler.request("shell") as number;
    expect(scheduler.isCurrent(a)).toBe(false);
    expect(scheduler.isCurrent(b)).toBe(true);
  });

  it("invalidate() (unmount) retires every outstanding token", () => {
    const scheduler = createDashboardRefreshScheduler({
      read: () => {},
      isVisible: () => true,
    });
    const a = scheduler.request("focus") as number;
    const b = scheduler.request("pull") as number;
    scheduler.invalidate();
    expect(scheduler.isCurrent(a)).toBe(false);
    expect(scheduler.isCurrent(b)).toBe(false);
  });

  it("logs once per issued read with the source label, never for a deferred request", () => {
    let visible = true;
    const logged: DashboardRefreshSource[] = [];
    const scheduler = createDashboardRefreshScheduler({
      read: () => {},
      isVisible: () => visible,
      log: (source) => logged.push(source),
    });
    scheduler.request("focus");
    scheduler.request("pull");
    visible = false;
    scheduler.request("shell");
    scheduler.request("foreground");
    scheduler.request("snooze");
    expect(logged).toEqual(["focus", "pull", "snooze"]);
  });

  it("reads the CURRENT inputs through a mutable ref (never mount-time closures)", () => {
    const ran: string[] = [];
    const readRef: {
      current: (token: number, source: DashboardRefreshSource) => void;
    } = {
      current: () => ran.push("query-1"),
    };
    const scheduler = createDashboardRefreshScheduler({
      read: (token, source) => readRef.current(token, source),
      isVisible: () => true,
    });
    scheduler.request("focus");
    readRef.current = () => ran.push("query-2");
    scheduler.request("focus");
    expect(ran).toEqual(["query-1", "query-2"]);
  });
});

describe("publishDashboardRead", () => {
  it("publishes every sink for the current token, then settles", () => {
    const rec = recordingSinks();
    const published = publishDashboardRead({
      token: 1,
      outcome: okOutcome("B"),
      isCurrent: (token) => token === 1,
      sinks: rec.sinks,
    });
    expect(published).toBe(true);
    expect(rec.names()).toEqual([
      "rows",
      "line3",
      "searchMatches",
      "listNow",
      "counts",
      "populationCounts",
      "error",
      "fadeStart",
      "generation",
      "refreshing",
      "initialLoad",
    ]);
    expect(rec.valuesOf("error")).toEqual([false]);
    expect(rec.valuesOf("refreshing")).toEqual([false]);
    expect(rec.valuesOf("initialLoad")).toEqual([false]);
  });

  it("publishes the error shape (cleared rows/line-3/matches, error) and settles", () => {
    const rec = recordingSinks();
    publishDashboardRead({
      token: 1,
      outcome: { kind: "error" },
      isCurrent: () => true,
      sinks: rec.sinks,
    });
    expect(rec.valuesOf("rows")).toEqual([[]]);
    expect(rec.valuesOf("error")).toEqual([true]);
    expect(rec.valuesOf("refreshing")).toEqual([false]);
    expect(rec.valuesOf("initialLoad")).toEqual([false]);
    // The error path never publishes counts, listNow or a result transition.
    expect(rec.valuesOf("counts")).toEqual([]);
    expect(rec.valuesOf("listNow")).toEqual([]);
    expect(rec.valuesOf("fadeStart")).toEqual([]);
    expect(rec.valuesOf("generation")).toEqual([]);
  });

  it("calls NO sink for a stale token", () => {
    const rec = recordingSinks();
    const published = publishDashboardRead({
      token: 1,
      outcome: okOutcome("A"),
      isCurrent: () => false,
      sinks: rec.sinks,
    });
    expect(published).toBe(false);
    expect(rec.calls).toEqual([]);
  });
});

/**
 * The HomeScreen read shape end to end: the scheduler issues a token, an async
 * read awaits its data, and the body publishes ONLY through
 * `publishDashboardRead` (success and failure alike).
 */
function harness() {
  const rec = recordingSinks();
  const pending = new Map<
    number,
    ReturnType<
      typeof deferred<
        DashboardReadOutcome<Row, string, string, Counts, PopulationCounts>
      >
    >
  >();
  const settled: Promise<void>[] = [];
  const scheduler = createDashboardRefreshScheduler({
    read: (token) => {
      const d =
        deferred<
          DashboardReadOutcome<Row, string, string, Counts, PopulationCounts>
        >();
      pending.set(token, d);
      settled.push(
        (async () => {
          let outcome: DashboardReadOutcome<
            Row,
            string,
            string,
            Counts,
            PopulationCounts
          >;
          try {
            outcome = await d.promise;
          } catch {
            outcome = { kind: "error" };
          }
          publishDashboardRead({
            token,
            outcome,
            isCurrent: scheduler.isCurrent,
            sinks: rec.sinks,
          });
        })(),
      );
    },
    isVisible: () => true,
  });
  return { rec, pending, settled, scheduler };
}

describe("out-of-order reads publish only the latest", () => {
  it("B resolves, then A resolves: every sink records only B", async () => {
    const { rec, pending, settled, scheduler } = harness();
    const a = scheduler.request("focus") as number;
    const b = scheduler.request("focus") as number;
    pending.get(b)?.resolve(okOutcome("B"));
    pending.get(a)?.resolve(okOutcome("A"));
    await Promise.all(settled);

    expect(rec.valuesOf("rows")).toEqual([[{ id: 1, name: "B" }]]);
    expect(rec.valuesOf("line3")).toEqual([new Map([[1, "B-line3"]])]);
    expect(rec.valuesOf("searchMatches")).toEqual([new Map([[1, "B-match"]])]);
    expect(rec.valuesOf("listNow")).toEqual(["B-now"]);
    expect(rec.valuesOf("counts")).toEqual([{ live: 2 }]);
    expect(rec.valuesOf("populationCounts")).toEqual([{ favourites: 20 }]);
    expect(rec.valuesOf("fadeStart")).toEqual([0]);
    expect(rec.valuesOf("generation")).toHaveLength(1);
    expect(rec.valuesOf("error")).toEqual([false]);
    expect(rec.valuesOf("refreshing")).toEqual([false]);
    expect(rec.valuesOf("initialLoad")).toEqual([false]);
  });

  it("B resolves, then A rejects: no stale error and no stale settle", async () => {
    const { rec, pending, settled, scheduler } = harness();
    const a = scheduler.request("pull") as number;
    const b = scheduler.request("shell") as number;
    pending.get(b)?.resolve(okOutcome("B"));
    pending.get(a)?.reject(new Error("stale failure"));
    await Promise.all(settled);

    expect(rec.valuesOf("error")).toEqual([false]);
    expect(rec.valuesOf("rows")).toEqual([[{ id: 1, name: "B" }]]);
    expect(rec.valuesOf("refreshing")).toEqual([false]);
    expect(rec.valuesOf("initialLoad")).toEqual([false]);
  });

  it("A settles while B is still in flight: A publishes nothing, refreshing stays untouched", async () => {
    const { rec, pending, settled, scheduler } = harness();
    const a = scheduler.request("pull") as number;
    const b = scheduler.request("focus") as number;
    pending.get(a)?.resolve(okOutcome("A"));
    await settled[0];
    expect(rec.calls).toEqual([]);

    pending.get(b)?.resolve(okOutcome("B"));
    await Promise.all(settled);
    expect(rec.valuesOf("listNow")).toEqual(["B-now"]);
    expect(rec.valuesOf("refreshing")).toEqual([false]);
  });

  it("an unmount invalidate drops every in-flight publication", async () => {
    const { rec, pending, settled, scheduler } = harness();
    const a = scheduler.request("focus") as number;
    scheduler.invalidate();
    pending.get(a)?.resolve(okOutcome("A"));
    await Promise.all(settled);
    expect(rec.calls).toEqual([]);
  });
});

/**
 * performance/AUD-PERF-002 prohibition (verification: test): animation-only and
 * lifecycle state must never re-enter `reload`'s dependency list, or an
 * animation-preference change / background edge re-runs the focus read.
 */
describe("reload dependencies exclude animation/lifecycle state", () => {
  function reloadDependencyNames(): string[] {
    const source = readFileSync("src/screens/HomeScreen.tsx", "utf8");
    const file = ts.createSourceFile(
      "HomeScreen.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let deps: ts.ArrayLiteralExpression | null = null;
    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "reload" &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === "useCallback"
      ) {
        const second = node.initializer.arguments[1];
        if (second && ts.isArrayLiteralExpression(second)) deps = second;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    if (deps === null) {
      throw new Error(
        "HomeScreen `reload = useCallback(fn, [deps])` dependency array not found",
      );
    }
    return (deps as ts.ArrayLiteralExpression).elements.map((element) =>
      element.getText(file),
    );
  }

  it("names none of appActive, isFocused, reducedMotion, resultProgress", () => {
    const names = reloadDependencyNames();
    for (const forbidden of [
      "appActive",
      "isFocused",
      "reducedMotion",
      "resultProgress",
    ]) {
      expect(names).not.toContain(forbidden);
    }
    // Query/search changes must still re-issue the focus read.
    expect(names).toContain("debouncedSearchText");
    expect(names).toContain("query");
  });
});

describe("isDashboardVisible — backgrounded Home defers reads (38.3 review A-WR-01, D-23)", () => {
  it("is hidden while the app is backgrounded even with Home still the focused route", () => {
    expect(isDashboardVisible(true, "background")).toBe(false);
  });

  it("is visible only when Home is focused and the app is not backgrounded", () => {
    expect(isDashboardVisible(true, "active")).toBe(true);
    expect(isDashboardVisible(false, "active")).toBe(false);
    // `inactive` is a transient overlay state, not the background (no resume
    // sweep follows it), so a shell tick there must still read.
    expect(isDashboardVisible(true, "inactive")).toBe(true);
  });

  it("a shell or foreground request while backgrounded issues no read", () => {
    let appState = "background";
    const reads: DashboardRefreshSource[] = [];
    const scheduler = createDashboardRefreshScheduler({
      read: (_token, source) => reads.push(source),
      isVisible: () => isDashboardVisible(true, appState),
    });
    expect(scheduler.request("shell")).toBeNull();
    expect(scheduler.request("foreground")).toBeNull();
    expect(reads).toEqual([]);
    appState = "active";
    expect(scheduler.request("foreground")).not.toBeNull();
    expect(reads).toEqual(["foreground"]);
  });
});

/**
 * 38.3 REVIEW A-WR-05 / VERIFICATION W4 (38.4 D-10): the Home favourite toggle
 * publishes through the scheduler. After the write commits it requests a
 * non-deferrable "favourite" read, whose newer token retires any in-flight
 * stale read (which could otherwise revert the star), re-reads population
 * counts, and settles with fade start 1 so a star tap never re-fades the list.
 */
describe("favourite source (38.3 A-WR-05 / W4)", () => {
  it("a favourite request while hidden still issues a read (never deferred)", () => {
    const reads: DashboardRefreshSource[] = [];
    const logged: DashboardRefreshSource[] = [];
    const scheduler = createDashboardRefreshScheduler({
      read: (_token, source) => reads.push(source),
      isVisible: () => false,
      log: (source) => logged.push(source),
    });
    expect(scheduler.request("favourite")).not.toBeNull();
    expect(reads).toEqual(["favourite"]);
    expect(logged).toEqual(["favourite"]);
  });

  it("stale read A (before the write) then favourite read B: only B publishes, A resolving later publishes nothing", async () => {
    const { rec, pending, settled, scheduler } = harness();
    const a = scheduler.request("pull") as number;
    const b = scheduler.request("favourite") as number;
    pending.get(b)?.resolve(okOutcome("B"));
    pending.get(a)?.resolve(okOutcome("A"));
    await Promise.all(settled);
    expect(rec.valuesOf("rows")).toEqual([[{ id: 1, name: "B" }]]);
    expect(rec.valuesOf("populationCounts")).toEqual([{ favourites: 20 }]);
    expect(rec.valuesOf("generation")).toHaveLength(1);
  });

  it("stale read A rejecting after favourite read B publishes no error and no stale settle", async () => {
    const { rec, pending, settled, scheduler } = harness();
    const a = scheduler.request("shell") as number;
    const b = scheduler.request("favourite") as number;
    pending.get(b)?.resolve(okOutcome("B"));
    pending.get(a)?.reject(new Error("stale failure"));
    await Promise.all(settled);
    expect(rec.valuesOf("error")).toEqual([false]);
    expect(rec.valuesOf("refreshing")).toEqual([false]);
    expect(rec.valuesOf("initialLoad")).toEqual([false]);
  });

  it("two rapid toggles issue two favourite reads; only the last (final committed membership) publishes", async () => {
    const { rec, pending, settled, scheduler } = harness();
    const first = scheduler.request("favourite") as number;
    const second = scheduler.request("favourite") as number;
    expect(first).not.toBe(second);
    pending.get(second)?.resolve(okOutcome("B"));
    pending.get(first)?.resolve(okOutcome("A"));
    await Promise.all(settled);
    expect(rec.valuesOf("rows")).toEqual([[{ id: 1, name: "B" }]]);
    expect(rec.valuesOf("listNow")).toEqual(["B-now"]);
  });

  it("a favourite-sourced outcome publishes fade start 1 even when animation is allowed", () => {
    expect(dashboardFadeStart("favourite", true)).toBe(1);
    expect(dashboardFadeStart("favourite", false)).toBe(1);
    const rec = recordingSinks();
    publishDashboardRead({
      token: 1,
      outcome: {
        ...okOutcome("B"),
        fadeStart: dashboardFadeStart("favourite", true),
      },
      isCurrent: () => true,
      sinks: rec.sinks,
    });
    expect(rec.valuesOf("fadeStart")).toEqual([1]);
  });

  it("every other source keeps the existing rule: 0 when animation is allowed, else 1", () => {
    for (const source of [
      "focus",
      "shell",
      "foreground",
      "pull",
      "snooze",
    ] as const) {
      expect(dashboardFadeStart(source, true)).toBe(0);
      expect(dashboardFadeStart(source, false)).toBe(1);
    }
    const rec = recordingSinks();
    publishDashboardRead({
      token: 1,
      outcome: {
        ...okOutcome("B"),
        fadeStart: dashboardFadeStart("focus", true),
      },
      isCurrent: () => true,
      sinks: rec.sinks,
    });
    expect(rec.valuesOf("fadeStart")).toEqual([0]);
  });
});
