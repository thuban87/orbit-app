import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Events search orchestration (38.14 D-25, D-48; ADR-162).
 *
 * A function-call render with a mocked React, after group-log-save-render:
 * hooks live in call-order slots. Unlike that test, the state here is real
 * (setters store their value and mark the tree for a re-render) and effects
 * are deps-aware: on a re-render an effect re-runs only when its deps changed,
 * and its previous cleanup runs first, as React does. `useFocusEffect` runs
 * while focused and again when its callback identity changes; a simulated
 * blur runs every focus cleanup and a refocus runs every focus callback again,
 * as React Navigation does, alongside flipping the mocked `useIsFocused`.
 */

type Slot =
  | { kind: "state"; value: unknown; set: (update: unknown) => void }
  | { kind: "memo"; deps: readonly unknown[]; value: unknown }
  | { kind: "ref"; ref: { current: unknown } }
  | { kind: "effect"; deps: readonly unknown[]; cleanup?: () => void }
  | {
      kind: "focus";
      callback: () => undefined | (() => void);
      cleanup?: () => void;
      runs: number;
    };

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  index: 0,
  dirty: false,
  pending: [] as (() => void)[],
  focused: true,
}));

function depsChanged(prev: readonly unknown[], next: readonly unknown[]) {
  return (
    prev.length !== next.length ||
    prev.some((dep, i) => !Object.is(dep, next[i]))
  );
}

vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  const slotAt = () => h.index++;
  const memo = (factory: () => unknown, deps: readonly unknown[]) => {
    const i = slotAt();
    const prev = h.slots[i] as Slot | undefined;
    if (prev?.kind === "memo" && !depsChanged(prev.deps, deps))
      return prev.value;
    const value = factory();
    h.slots[i] = { kind: "memo", deps, value };
    return value;
  };
  return {
    ...actual,
    useState: (initial: unknown) => {
      const i = slotAt();
      type StateSlot = Extract<Slot, { kind: "state" }>;
      const existing = h.slots[i] as Slot | undefined;
      if (existing?.kind === "state") return [existing.value, existing.set];
      const state: StateSlot = {
        kind: "state",
        value:
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial,
        set: (update: unknown) => {
          const next =
            typeof update === "function"
              ? (update as (value: unknown) => unknown)(state.value)
              : update;
          if (!Object.is(next, state.value)) {
            state.value = next;
            h.dirty = true;
          }
        },
      };
      h.slots[i] = state;
      return [state.value, state.set];
    },
    useMemo: (factory: () => unknown, deps: readonly unknown[]) =>
      memo(factory, deps),
    useCallback: (callback: unknown, deps: readonly unknown[]) =>
      memo(() => callback, deps),
    useRef: (initial: unknown) => {
      const i = slotAt();
      const slot = h.slots[i] as Slot | undefined;
      if (slot?.kind === "ref") return slot.ref;
      const ref = { current: initial };
      h.slots[i] = { kind: "ref", ref };
      return ref;
    },
    useEffect: (
      callback: () => undefined | (() => void),
      deps: readonly unknown[],
    ) => {
      const i = slotAt();
      const prev = h.slots[i] as Slot | undefined;
      if (prev?.kind === "effect" && !depsChanged(prev.deps, deps)) return;
      const slot: Slot = { kind: "effect", deps, cleanup: undefined };
      h.slots[i] = slot;
      h.pending.push(() => {
        if (prev?.kind === "effect") prev.cleanup?.();
        slot.cleanup = callback() ?? undefined;
      });
    },
  };
});

const focusHooks = vi.hoisted(() => ({
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    const i = h.index++;
    const prev = h.slots[i] as
      | { kind: "focus"; callback: unknown; cleanup?: () => void; runs: number }
      | undefined;
    if (prev?.kind === "focus" && prev.callback === callback) return;
    const slot = {
      kind: "focus" as const,
      callback,
      cleanup: undefined as undefined | (() => void),
      runs: prev?.runs ?? 0,
    };
    h.slots[i] = slot;
    if (!h.focused) return;
    h.pending.push(() => {
      prev?.cleanup?.();
      slot.runs += 1;
      slot.cleanup = callback() ?? undefined;
    });
  },
  useIsFocused: () => h.focused,
}));
vi.mock("@react-navigation/native", () => focusHooks);

const back = vi.hoisted(() => ({
  live: new Set<() => boolean>(),
  added: 0,
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  BackHandler: {
    addEventListener: (_event: string, listener: () => boolean) => {
      back.live.add(listener);
      back.added += 1;
      return { remove: () => back.live.delete(listener) };
    },
  },
  FlatList: "FlatList",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  EmptyState: "EmptyState",
}));
vi.mock("@/components/ui/ChromeScrim", () => ({ ChromeScrim: "ChromeScrim" }));
vi.mock("@/db/database", () => ({ getExecutor: () => "exec" }));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 0,
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

interface Read {
  term: string;
  resolve: (rows: unknown[]) => void;
}
const db = vi.hoisted(() => ({ reads: [] as Read[] }));
vi.mock("@/db/group-events-read", () => {
  const read = (term: string) =>
    new Promise<unknown[]>((resolve) => {
      db.reads.push({ term, resolve });
    });
  return {
    listGroupEvents: () => read(""),
    searchGroupEvents: (_exec: unknown, input: { term: string }) =>
      read(input.term),
  };
});

const { GroupEventsScreen } = await import("./GroupEventsScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

let tree: TestElement[] = [];
const navigation = { navigate: vi.fn() };

function renderOnce() {
  h.index = 0;
  h.dirty = false;
  const out = GroupEventsScreen({
    navigation,
    route: { params: {} },
  } as unknown as Parameters<typeof GroupEventsScreen>[0]);
  tree = nodes(out as ReactNode);
  const effects = h.pending.splice(0);
  for (const run of effects) run();
}

/** Renders until no state changed, flushing microtasks between passes. */
async function settle() {
  renderOnce();
  for (let pass = 0; pass < 20; pass++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (!h.dirty) return;
    renderOnce();
  }
  throw new Error("render did not settle");
}

function focusSlots() {
  return (h.slots as Slot[]).filter(
    (slot): slot is Extract<Slot, { kind: "focus" }> => slot?.kind === "focus",
  );
}

async function blur() {
  for (const slot of focusSlots()) {
    slot.cleanup?.();
    slot.cleanup = undefined;
  }
  h.focused = false;
  await settle();
}

async function refocus() {
  h.focused = true;
  for (const slot of focusSlots()) {
    slot.runs += 1;
    slot.cleanup = slot.callback() ?? undefined;
  }
  await settle();
}

const searchInput = () => tree.find((el) => el.type === "TextInput");
const spinnerShown = () => tree.some((el) => el.type === "ActivityIndicator");
const listData = () =>
  tree.find((el) => el.type === "FlatList")?.props.data as
    | unknown[]
    | undefined;
function toggleSearch() {
  const bar = tree.find((el) => el.type === "ShellAppBar");
  const trailing = bar?.props.trailing as TestElement;
  (trailing.props.onPress as () => void)();
}
async function type(text: string) {
  const input = searchInput();
  expect(input, "search input").toBeDefined();
  ((input as TestElement).props.onChangeText as (value: string) => void)(text);
  await settle();
}
async function resolveRead(term: string, rows: unknown[]) {
  const index = db.reads.findIndex((read) => read.term === term);
  expect(index, `pending read for "${term}"`).toBeGreaterThan(-1);
  const [read] = db.reads.splice(index, 1);
  read.resolve(rows);
  await settle();
}
function pressBack(): boolean {
  const listeners = [...back.live];
  expect(listeners).toHaveLength(1);
  return listeners[0]();
}

/** Mounts, settles the first read and opens search. */
async function mountWithSearchOpen() {
  await settle();
  await resolveRead("", [{ id: 1 }]);
  toggleSearch();
  await settle();
}

beforeEach(() => {
  h.slots = [];
  h.pending = [];
  h.focused = true;
  db.reads = [];
  back.live.clear();
  back.added = 0;
});

describe("GroupEventsScreen search (38.14 D-25, D-48)", () => {
  it("two typed terms resolving in reverse publish only the newer rows; typing keeps the term and search open", async () => {
    await mountWithSearchOpen();
    const focusRunsBefore = focusSlots().map((slot) => slot.runs);
    await type("a");
    await type("ab");
    expect(searchInput()?.props.value).toBe("ab");

    await resolveRead("ab", [{ id: 2, title: "ab" }]);
    expect(listData()).toEqual([{ id: 2, title: "ab" }]);
    await resolveRead("a", [{ id: 3, title: "a" }]);
    expect(listData()).toEqual([{ id: 2, title: "ab" }]);

    expect(searchInput()?.props.value).toBe("ab");
    // Neither focus effect re-ran while typing: their deps exclude `term`.
    expect(focusSlots().map((slot) => slot.runs)).toEqual(focusRunsBefore);
    // The list stayed visible: no spinner on later term changes.
    expect(spinnerShown()).toBe(false);
  });

  it("the empty state echoes the term the shown rows were read for, not one still reading (review B-IN-03)", async () => {
    await mountWithSearchOpen();
    const emptyTerm = () => {
      const empty = tree.find((el) => el.type === "FlatList")?.props
        .ListEmptyComponent as TestElement | undefined;
      return nodes(empty).find((el) => el.type === "EmptyState")?.props.term;
    };
    await type("zz");
    await resolveRead("zz", []);
    expect(emptyTerm()).toBe("zz");
    await type("zzq");
    // The newer read is still in flight: the empty list is still "zz"'s.
    expect(emptyTerm()).toBe("zz");
    await resolveRead("zzq", []);
    expect(emptyTerm()).toBe("zzq");
  });

  it("closing search with the toggle clears the term", async () => {
    await mountWithSearchOpen();
    await type("din");
    toggleSearch();
    await settle();
    expect(searchInput()).toBeUndefined();
    toggleSearch();
    await settle();
    expect(searchInput()?.props.value).toBe("");
  });

  it("a blur (opening a result) keeps the term; refocus reads it once with no spinner", async () => {
    await mountWithSearchOpen();
    await type("din");
    await resolveRead("din", [{ id: 4 }]);
    expect(db.reads).toHaveLength(0);

    await blur();
    expect(db.reads).toHaveLength(0);
    await refocus();
    expect(db.reads.map((read) => read.term)).toEqual(["din"]);
    expect(searchInput()?.props.value).toBe("din");
    expect(spinnerShown()).toBe(false);
    expect(listData()).toEqual([{ id: 4 }]);
    await resolveRead("din", [{ id: 5 }]);
    expect(listData()).toEqual([{ id: 5 }]);
  });

  it("a read in flight at blur never publishes", async () => {
    await mountWithSearchOpen();
    await type("x");
    await blur();
    await resolveRead("x", [{ id: 9 }]);
    expect(listData()).toEqual([{ id: 1 }]);
  });

  it("Back closes search and clears the term, also after a blur and refocus (R4-02)", async () => {
    await mountWithSearchOpen();
    await type("din");
    await blur();
    expect(back.live.size).toBe(0);
    await refocus();
    expect(pressBack()).toBe(true);
    await settle();
    expect(searchInput()).toBeUndefined();
    expect(back.live.size).toBe(0);
    toggleSearch();
    await settle();
    expect(searchInput()?.props.value).toBe("");
  });

  it("no Back listener while search is closed", async () => {
    await settle();
    expect(back.live.size).toBe(0);
    expect(back.added).toBe(0);
  });

  it("closing a blank search during the first read lets that read publish (R4-03)", async () => {
    await settle();
    expect(spinnerShown()).toBe(true);
    toggleSearch();
    await settle();
    toggleSearch();
    await settle();
    expect(searchInput()).toBeUndefined();
    expect(db.reads.map((read) => read.term)).toEqual([""]);
    await resolveRead("", [{ id: 7 }]);
    expect(spinnerShown()).toBe(false);
    expect(listData()).toEqual([{ id: 7 }]);
  });
});
