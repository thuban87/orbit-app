import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Review matches: tap a row → MatchChoiceSheet → Link / Import as new / Skip
 * settles that one person (38.12 D-107, D-51, D-52; convergence c1 A-2).
 *
 * Renders the REAL DuplicateReviewScreen with mocked DAO reads and writes
 * through a STATEFUL hook store (state and refs persist across renders, a
 * setter updates its slot, an effect runs once on first render, `render()`
 * re-runs the screen). ReviewMatchesList and MatchChoiceSheet are host
 * elements here, so the test drives the screen through their props:
 *
 *  (a) a single tap links through the latched `chooseLink` write, and the
 *      "Linked <incoming> to <Orbit name>" snackbar shows only after the write
 *      resolves (never when it rejects);
 *  (b) a bulk "link" over two rows opens the sheet for the first, Link
 *      advances to the second, Link again closes it;
 *  (c) Cancel after a bulk "link" clears the queue, so a later single tap
 *      opens with an empty queue (D-52, T-38.12-19).
 */

const hooks = vi.hoisted(() => ({
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  states: [] as unknown[],
  setters: [] as ((value: unknown) => void)[],
  refs: [] as { current: unknown }[],
  effectsRun: new Set<number>(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useEffect: (effect: () => unknown) => {
    const slot = hooks.effectIndex++;
    if (hooks.effectsRun.has(slot)) return;
    hooks.effectsRun.add(slot);
    effect();
  },
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
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  View: "View",
}));
vi.mock("@/components/MatchChoiceSheet", () => ({
  MatchChoiceSheet: "MatchChoiceSheet",
}));
vi.mock("@/components/ReviewMatchesList", () => ({
  ReviewMatchesList: "ReviewMatchesList",
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));
vi.mock("./use-open-import-session", () => ({
  useOpenImportSession: () => {},
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "2026-10-17 12:00:00",
}));
const HEADERS: Record<number, { name: string; photo: string | null }> = {
  4: { name: "Ann Leigh", photo: null },
  9: { name: "Ann Lane", photo: null },
  5: { name: "Bo Rae", photo: null },
};
vi.mock("@/db/contact-read", () => ({
  getContactHeader: async (_exec: unknown, id: number) => HEADERS[id] ?? null,
}));
const dao = vi.hoisted(() => ({
  finalizeSessionIfTerminal: vi.fn(async (..._args: unknown[]) => {}),
  markRowStatus: vi.fn(async (..._args: unknown[]) => {}),
  linkExistingContactToRow: vi.fn(async (..._args: unknown[]) => {}),
  importRowAsNew: vi.fn(async () => ({ contactId: 77, skipped: null })),
  listSessionRows: vi.fn(),
  showSnackbar: vi.fn(),
}));
vi.mock("@/db/import-session-dao", () => ({
  finalizeSessionIfTerminal: dao.finalizeSessionIfTerminal,
  markRowStatus: dao.markRowStatus,
}));
vi.mock("@/db/import-session-read", () => ({
  getSessionById: async () => ({
    id: 1,
    batchCategoryId: null,
    batchTrackingEnabled: false,
    batchIntervalDays: null,
    phoneRegion: null,
  }),
  listSessionRows: dao.listSessionRows,
  sessionBatchLifecycle: () => ({ trackingEnabled: false }),
  sessionRowCounts: async () => ({ needs_review: 2, pending: 0 }),
}));
vi.mock("@/db/imported-contact-dao", () => ({
  linkExistingContactToRow: dao.linkExistingContactToRow,
}));
vi.mock("@/services/import/import-driver", () => ({
  importRowAsNew: dao.importRowAsNew,
}));
vi.mock("@/services/import/import-lifecycle-effects", () => ({
  applyBoundImportEffects: vi.fn(async () => {}),
}));
vi.mock("@/services/photos/photo-storage", () => ({
  resolveImportStagingUri: (path: string) => `file:///${path}`,
}));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: dao.showSnackbar }));

const { DuplicateReviewScreen } = await import("./DuplicateReviewScreen");

type TestElement = ReactElement<Record<string, unknown>>;
type Item = {
  id: number;
  name: string;
  candidates: { contactId: number; name: string }[];
};

function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function row(id: number, name: string, candidates: unknown[]) {
  return {
    id,
    uid: `u${id}`,
    sessionId: 1,
    externalContactId: `ext-${id}`,
    sourcePayload: JSON.stringify({ displayName: name }),
    photoRelPath: null,
    rowStatus: "needs_review",
    matchOutcome: "needs_review",
    matchedContactId: null,
    candidates,
    contactId: null,
    failureReason: null,
    photoFailed: false,
    createdAt: "2026-10-17 11:00:00",
    modifiedAt: "2026-10-17 11:00:00",
  };
}

const ROWS = [
  row(31, "Ann Lee", [
    { contactId: 4, signals: ["phoneMatch"] },
    { contactId: 9, signals: ["nameOverlap"] },
  ]),
  row(32, "Bo Ray", [{ contactId: 5, signals: ["nameOverlap"] }]),
];

/**
 * DuplicateReviewScreen's `useState` call order, so a test can read the
 * pending link queue directly (a single tap also resets it, which would hide
 * a close that left it behind).
 */
const SLOT = { linkQueue: 4, currentLink: 5 } as const;

function queuedNames(): string[] {
  return (
    (hooks.states[SLOT.linkQueue] as
      | { item: { name: string } }[]
      | undefined) ?? []
  ).map((entry) => entry.item.name);
}

const navigation = { replace: vi.fn() };

function render() {
  hooks.stateIndex = 0;
  hooks.refIndex = 0;
  hooks.effectIndex = 0;
  const tree = nodes(
    DuplicateReviewScreen({
      navigation,
      route: { params: { sessionId: 1 } },
    } as never),
  );
  const list = tree.find((node) => node.type === "ReviewMatchesList");
  const sheet = tree.find((node) => node.type === "MatchChoiceSheet");
  if (!sheet) throw new Error("no MatchChoiceSheet");
  return {
    list: list as TestElement,
    sheet,
    items: (list?.props.items as Item[] | undefined) ?? [],
  };
}

async function flush() {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function loaded() {
  render();
  await flush();
  return render();
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function snackbarLabels(): string[] {
  return dao.showSnackbar.mock.calls.map(
    ([message]) => (message as { label: string }).label,
  );
}

function sheetState() {
  const { sheet } = render();
  return {
    visible: sheet.props.visible,
    person: sheet.props.personName,
    choices: (sheet.props.choices as { name: string }[]).map((c) => c.name),
  };
}

beforeEach(() => {
  hooks.states = [];
  hooks.setters = [];
  hooks.refs = [];
  hooks.effectsRun = new Set();
  vi.clearAllMocks();
  dao.listSessionRows.mockResolvedValue(ROWS);
  dao.linkExistingContactToRow.mockImplementation(async () => {});
});

describe("Review matches single tap (D-107, D-51)", () => {
  it("lists the rows and no sheet until a row is tapped", async () => {
    const { items, sheet } = await loaded();
    expect(items.map((item) => item.name)).toEqual(["Ann Lee", "Bo Ray"]);
    expect(sheet.props.visible).toBe(false);
  });

  it("(a) tap → sheet for that person → Link writes once and confirms only after the write commits", async () => {
    const { list, items } = await loaded();
    (list.props.onInspect as (item: Item) => void)(items[0] as Item);
    expect(sheetState()).toEqual({
      visible: true,
      person: "Ann Lee",
      choices: ["Ann Leigh", "Ann Lane"],
    });
    const write = deferred();
    dao.linkExistingContactToRow.mockImplementation(() => write.promise);
    const { sheet } = render();
    (sheet.props.onLink as (choice: unknown) => void)(
      (sheet.props.choices as unknown[])[0],
    );
    await flush();
    expect(render().sheet.props.writing).toBe(true);
    expect(snackbarLabels()).toEqual([]);
    write.resolve();
    await flush();
    expect(dao.linkExistingContactToRow).toHaveBeenCalledTimes(1);
    expect(dao.linkExistingContactToRow).toHaveBeenCalledWith(
      "exec",
      expect.objectContaining({ rowId: 31, contactId: 4 }),
    );
    expect(snackbarLabels()).toEqual(["Linked Ann Lee to Ann Leigh"]);
    expect(sheetState().visible).toBe(false);
  });

  it("(a) a rejected link shows no 'Linked' snackbar and keeps the person open", async () => {
    const { list, items } = await loaded();
    (list.props.onInspect as (item: Item) => void)(items[0] as Item);
    dao.linkExistingContactToRow.mockRejectedValue(new Error("unique"));
    const { sheet } = render();
    (sheet.props.onLink as (choice: unknown) => void)(
      (sheet.props.choices as unknown[])[1],
    );
    await flush();
    expect(snackbarLabels()).toEqual([
      "Couldn't link this contact. Please choose again.",
    ]);
    expect(sheetState()).toMatchObject({ visible: true, person: "Ann Lee" });
  });

  it("Skip settles that one person through the latched resolve and confirms it", async () => {
    const { list, items } = await loaded();
    (list.props.onInspect as (item: Item) => void)(items[1] as Item);
    (render().sheet.props.onSkip as () => void)();
    await flush();
    expect(dao.markRowStatus).toHaveBeenCalledTimes(1);
    expect(dao.markRowStatus).toHaveBeenCalledWith(
      "exec",
      32,
      "skipped",
      null,
      "2026-10-17 12:00:00",
    );
    expect(snackbarLabels()).toEqual(["Skipped Bo Ray"]);
    expect(sheetState().visible).toBe(false);
  });

  it("Import as new that fails for the row keeps the person open with no success snackbar", async () => {
    dao.importRowAsNew.mockResolvedValueOnce({
      contactId: null,
      skipped: "name-required",
    } as never);
    const { list, items } = await loaded();
    (list.props.onInspect as (item: Item) => void)(items[0] as Item);
    (render().sheet.props.onImportNew as () => void)();
    await flush();
    expect(snackbarLabels()).toEqual([
      "Couldn't import — no name. Add a name before importing.",
    ]);
    expect(sheetState()).toMatchObject({ visible: true, person: "Ann Lee" });
  });
});

describe("Review matches bulk link queue (A-2, D-52)", () => {
  it("(b) bulk link opens the first, Link advances to the second, Link again closes", async () => {
    const { list, items } = await loaded();
    await (list.props.onBulkAction as (a: string, i: Item[]) => Promise<void>)(
      "link",
      items,
    );
    expect(sheetState()).toMatchObject({ visible: true, person: "Ann Lee" });
    let { sheet } = render();
    (sheet.props.onLink as (choice: unknown) => void)(
      (sheet.props.choices as unknown[])[0],
    );
    await flush();
    expect(sheetState()).toEqual({
      visible: true,
      person: "Bo Ray",
      choices: ["Bo Rae"],
    });
    ({ sheet } = render());
    (sheet.props.onLink as (choice: unknown) => void)(
      (sheet.props.choices as unknown[])[0],
    );
    await flush();
    expect(sheetState().visible).toBe(false);
    expect(
      dao.linkExistingContactToRow.mock.calls.map(
        ([, input]) => (input as { rowId: number; contactId: number }).rowId,
      ),
    ).toEqual([31, 32]);
    expect(snackbarLabels()).toEqual([
      "Linked Ann Lee to Ann Leigh",
      "Linked Bo Ray to Bo Rae",
    ]);
  });

  it("(c) Cancel clears the queue: a later single tap links once and closes", async () => {
    const { list, items } = await loaded();
    await (list.props.onBulkAction as (a: string, i: Item[]) => Promise<void>)(
      "link",
      items,
    );
    expect(queuedNames()).toEqual(["Bo Ray"]);
    (render().sheet.props.onClose as () => void)();
    expect(sheetState().visible).toBe(false);
    expect(hooks.states[SLOT.currentLink]).toBeNull();
    expect(queuedNames()).toEqual([]);
    (render().list.props.onInspect as (item: Item) => void)(items[0] as Item);
    const { sheet } = render();
    expect(sheet.props.personName).toBe("Ann Lee");
    (sheet.props.onLink as (choice: unknown) => void)(
      (sheet.props.choices as unknown[])[0],
    );
    await flush();
    // The stale bulk entry (Bo Ray) never comes back.
    expect(sheetState().visible).toBe(false);
    expect(dao.linkExistingContactToRow).toHaveBeenCalledTimes(1);
  });

  it("a close during an in-flight link is held, so the write's advance cannot reopen a cleared queue", async () => {
    const { list, items } = await loaded();
    await (list.props.onBulkAction as (a: string, i: Item[]) => Promise<void>)(
      "link",
      items,
    );
    const write = deferred();
    dao.linkExistingContactToRow.mockImplementation(() => write.promise);
    const { sheet } = render();
    (sheet.props.onLink as (choice: unknown) => void)(
      (sheet.props.choices as unknown[])[0],
    );
    await flush();
    (render().sheet.props.onClose as () => void)();
    expect(sheetState()).toMatchObject({ visible: true, person: "Ann Lee" });
    write.resolve();
    await flush();
    expect(sheetState()).toMatchObject({ visible: true, person: "Bo Ray" });
    (render().sheet.props.onClose as () => void)();
    expect(sheetState().visible).toBe(false);
  });
});
