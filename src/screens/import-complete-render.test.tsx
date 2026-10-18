import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Import complete says what happened to whom (38.12 D-55, D-109, D-110).
 * Renders the REAL ImportCompleteScreen with a mocked summary read through a
 * STATEFUL hook store (state and refs persist across renders; an effect or a
 * focus effect runs once on first render; `render()` re-runs the screen):
 *
 *  - only non-zero outcomes render, titled "Imported", "Linked", "Already in
 *    Orbit", "Skipped by you", "Skipped — no name", "Couldn't import",
 *    "Needs review" (D-55; B-2, B-3);
 *  - each lists up to IMPORT_COMPLETE_NAME_PREVIEW names, "Show all" expands
 *    the rest (D-109);
 *  - a tapped imported/linked name calls openContactFromFlow with the host
 *    (D-109, D-110); other names are plain text;
 *  - the unreadable-birthday notice renders only when non-zero (B-3);
 *  - "Review possible matches" forwards the host to DuplicateReview (A-1).
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

function runOnce(effect: () => unknown): void {
  const slot = hooks.effectIndex++;
  if (hooks.effectsRun.has(slot)) return;
  hooks.effectsRun.add(slot);
  effect();
}

vi.mock("@/navigation/use-focused-bottom-inset", () => ({
  useFocusedBottomInset: () => 0,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useEffect: runOnce,
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
vi.mock("expo-sqlite", () => ({}));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: runOnce }));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: "Text",
  View: "View",
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));

const mocks = vi.hoisted(() => ({
  sessionSummaryCounts: vi.fn(),
  getSessionById: vi.fn(async () => ({ id: 1, mode: "bulk" })),
  listSessionRows: vi.fn(async () => [] as unknown[]),
  openContactFromFlow: vi.fn(),
  finishFlow: vi.fn(),
}));

vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/db/import-session-dao", () => ({
  finalizeSessionIfTerminal: vi.fn(async () => {}),
}));
vi.mock("@/db/import-session-read", () => ({
  getSessionById: mocks.getSessionById,
  listSessionRows: mocks.listSessionRows,
  sessionRowCounts: async () => ({
    pending: 0,
    imported: 0,
    linked: 0,
    needs_review: 0,
    failed: 0,
    skipped: 0,
  }),
  sessionSummaryCounts: mocks.sessionSummaryCounts,
}));
vi.mock("@/navigation/back-acts-as-done", () => ({
  useBackActsAsDone: () => {},
}));
vi.mock("@/navigation/flow-host", () => ({
  DEFAULT_FLOW_HOST: { kind: "settings" },
  finishFlow: mocks.finishFlow,
  openContactFromFlow: mocks.openContactFromFlow,
}));
vi.mock("@/services/import/import-driver", () => ({
  runImportBatch: vi.fn(async () => ({})),
}));
vi.mock("@/services/import/import-photo-retry", () => ({
  retryImportedPhoto: vi.fn(),
  retryPhotoFs: {},
  skipRemainingPhotos: vi.fn(),
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: {
      surface: "surface",
      border: "border",
      textPrimary: "textPrimary",
      textSecondary: "textSecondary",
      accent: "accent",
      accentText: "accentText",
      onAccent: "onAccent",
      danger: "danger",
    },
  }),
}));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));
vi.mock("./import-complete-logic", () => ({
  importCompleteRetryState: () => ({ visible: false, message: "" }),
  runImportCompleteAction: vi.fn(async () => {}),
}));
vi.mock("./use-open-import-session", () => ({
  useOpenImportSession: () => {},
}));

const { ImportCompleteScreen, IMPORT_COMPLETE_NAME_PREVIEW } = await import(
  "./ImportCompleteScreen"
);

type TestElement = ReactElement<Record<string, unknown>>;

function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function text(node: TestElement): string {
  return [node, ...nodes(node.props.children as ReactNode)]
    .map((n) => n.props.children)
    .filter((child): child is string => typeof child === "string")
    .join("");
}

const DIGEST = { kind: "digest" } as const;
const navigation = {
  navigate: vi.fn(),
  replace: vi.fn(),
  goBack: vi.fn(),
  dispatch: vi.fn(),
  getState: vi.fn(),
  getParent: vi.fn(),
  addListener: vi.fn(() => () => {}),
};

type Params = { sessionId: number; host?: unknown };
const DIGEST_PARAMS: Params = { sessionId: 1, host: DIGEST };

function render(params: Params = DIGEST_PARAMS): TestElement[] {
  hooks.stateIndex = 0;
  hooks.refIndex = 0;
  hooks.effectIndex = 0;
  return nodes(
    (ImportCompleteScreen as (props: never) => ReactNode)({
      navigation,
      route: { params },
    } as never),
  );
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function loaded(params: Params = DIGEST_PARAMS): Promise<TestElement[]> {
  render(params);
  await flush();
  return render(params);
}

type Person = { rowId: number; name: string; contactId: number | null };

function bucket(people: Person[]) {
  return { count: people.length, people };
}

let nextRow = 1;
function people(prefix: string, n: number, withContact: boolean): Person[] {
  return Array.from({ length: n }, (_, index) => {
    const rowId = nextRow++;
    return {
      rowId,
      name: `${prefix} ${index + 1}`,
      contactId: withContact ? 100 + rowId : null,
    };
  });
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    imported: bucket([]),
    linked: bucket([]),
    alreadyInOrbit: bucket([]),
    inBin: bucket([]),
    skippedByUser: bucket([]),
    skippedNoName: bucket([]),
    failed: bucket([]),
    needsReview: bucket([]),
    birthdayUnreadable: 0,
    ...overrides,
  };
}

function headers(tree: TestElement[]): string[] {
  return tree
    .filter(
      (node) =>
        node.type === "Text" && node.props.accessibilityRole === "header",
    )
    .map(text);
}

function byTestId(tree: TestElement[], id: string): TestElement | undefined {
  return tree.find((node) => node.props.testID === id);
}

beforeEach(() => {
  hooks.states = [];
  hooks.setters = [];
  hooks.refs = [];
  hooks.effectsRun = new Set();
  nextRow = 1;
  vi.clearAllMocks();
});

describe("Import complete shows only non-zero outcomes (D-55)", () => {
  it("renders every non-zero outcome with its title and count, in order", async () => {
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({
        imported: bucket(people("Imp", 2, true)),
        linked: bucket(people("Lin", 1, true)),
        alreadyInOrbit: bucket(people("Alr", 1, true)),
        skippedByUser: bucket(people("Skp", 1, false)),
        skippedNoName: bucket(people("Unnamed contact", 1, false)),
        failed: bucket(people("Fail", 1, false)),
        needsReview: bucket(people("Rev", 3, false)),
      }),
    );
    const tree = await loaded();
    expect(headers(tree)).toEqual([
      "Imported (2)",
      "Linked (1)",
      "Already in Orbit (1)",
      "Skipped by you (1)",
      "Skipped — no name (1)",
      "Couldn't import (1)",
      "Needs review (3)",
    ]);
  });

  it("hides every zero outcome", async () => {
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({ imported: bucket(people("Imp", 1, true)) }),
    );
    const tree = await loaded();
    expect(headers(tree)).toEqual(["Imported (1)"]);
  });

  it("a pick linked to a person in the Bin has its own In the Bin outcome (38.12 D-154)", async () => {
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({
        alreadyInOrbit: bucket(people("Alr", 1, true)),
        inBin: bucket(people("Bin", 2, true)),
      }),
    );
    const tree = await loaded();
    expect(headers(tree)).toEqual(["Already in Orbit (1)", "In the Bin (2)"]);
  });

  it("an already-linked-only session shows Already in Orbit and no Skipped by you (B-2)", async () => {
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({ alreadyInOrbit: bucket(people("Alr", 1, true)) }),
    );
    const tree = await loaded();
    expect(headers(tree)).toEqual(["Already in Orbit (1)"]);
  });

  it("a name-required row shows Skipped — no name, not Skipped by you or Couldn't import (B-3)", async () => {
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({ skippedNoName: bucket(people("Unnamed contact", 1, false)) }),
    );
    const tree = await loaded();
    expect(headers(tree)).toEqual(["Skipped — no name (1)"]);
  });

  it("shows the unreadable-birthday notice when one birthday couldn't be read (B-3)", async () => {
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({
        imported: bucket(people("Imp", 1, true)),
        birthdayUnreadable: 1,
      }),
    );
    const tree = await loaded();
    const notice = byTestId(tree, "import-complete-birthday-unreadable");
    expect(notice && text(notice)).toBe("1 birthday couldn't be read");
  });

  it("hides the unreadable-birthday notice at zero (B-3)", async () => {
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({ imported: bucket(people("Imp", 1, true)) }),
    );
    const tree = await loaded();
    expect(byTestId(tree, "import-complete-birthday-unreadable")).toBe(
      undefined,
    );
  });
});

describe("Import complete names the people in each outcome (D-109)", () => {
  it("lists up to the preview count, then Show all expands the rest", async () => {
    const many = people("Imp", IMPORT_COMPLETE_NAME_PREVIEW + 3, true);
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({ imported: bucket(many) }),
    );
    let tree = await loaded();
    const shownNames = () =>
      many.filter((person) =>
        byTestId(tree, `import-complete-person-${person.rowId}`),
      );
    expect(IMPORT_COMPLETE_NAME_PREVIEW).toBe(5);
    expect(shownNames()).toEqual(many.slice(0, IMPORT_COMPLETE_NAME_PREVIEW));
    const showAll = byTestId(tree, "import-complete-show-all-imported");
    if (!showAll) throw new Error("no Show all");
    expect(showAll.props.accessibilityRole).toBe("button");
    expect(text(showAll)).toBe("Show all");
    (showAll.props.onPress as () => void)();
    tree = render();
    expect(shownNames()).toEqual(many);
    expect(byTestId(tree, "import-complete-show-all-imported")).toBe(undefined);
  });

  it("shows no Show all when the outcome fits the preview", async () => {
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({
        failed: bucket(people("Fail", IMPORT_COMPLETE_NAME_PREVIEW, false)),
      }),
    );
    const tree = await loaded();
    expect(byTestId(tree, "import-complete-show-all-failed")).toBe(undefined);
  });

  it("a tapped imported name opens that person through the flow host (D-110)", async () => {
    const [ivy] = people("Ivy", 1, true);
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({ imported: bucket([ivy]) }),
    );
    const tree = await loaded();
    const name = byTestId(tree, `import-complete-person-${ivy.rowId}`);
    if (!name) throw new Error("no name row");
    expect(name.type).toBe("Pressable");
    expect(name.props.accessibilityRole).toBe("button");
    expect(name.props.accessibilityLabel).toBe("Open Ivy 1");
    (name.props.onPress as () => void)();
    expect(mocks.openContactFromFlow).toHaveBeenCalledWith(
      navigation,
      DIGEST,
      ivy.contactId,
    );
  });

  it("a tapped linked name opens that person; a Settings host is the default", async () => {
    const [lee] = people("Lee", 1, true);
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({ linked: bucket([lee]) }),
    );
    const tree = await loaded({ sessionId: 1 });
    const name = byTestId(tree, `import-complete-person-${lee.rowId}`);
    if (!name) throw new Error("no name row");
    (name.props.onPress as () => void)();
    expect(mocks.openContactFromFlow).toHaveBeenCalledWith(
      navigation,
      { kind: "settings" },
      lee.contactId,
    );
  });

  it("names in other outcomes are plain text, not buttons", async () => {
    const [al] = people("Al", 1, true);
    const [sue] = people("Sue", 1, false);
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({ alreadyInOrbit: bucket([al]), skippedByUser: bucket([sue]) }),
    );
    const tree = await loaded();
    for (const person of [al, sue]) {
      const name = byTestId(tree, `import-complete-person-${person.rowId}`);
      expect(name?.type).toBe("Text");
      expect(name && text(name)).toBe(person.name);
    }
  });
});

describe("Review possible matches forwards the flow host (D-110, A-1)", () => {
  it("navigates to DuplicateReview with the session and the host", async () => {
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({ needsReview: bucket(people("Rev", 1, false)) }),
    );
    const tree = await loaded();
    const review = byTestId(tree, "import-complete-review");
    if (!review) throw new Error("no Review possible matches");
    (review.props.onPress as () => void)();
    expect(navigation.navigate).toHaveBeenCalledWith("DuplicateReview", {
      sessionId: 1,
      host: DIGEST,
    });
  });

  it("is absent when nobody needs review", async () => {
    mocks.sessionSummaryCounts.mockResolvedValue(
      summary({ imported: bucket(people("Imp", 1, true)) }),
    );
    const tree = await loaded();
    expect(byTestId(tree, "import-complete-review")).toBe(undefined);
  });
});
