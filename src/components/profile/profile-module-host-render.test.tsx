import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ProfileKnowledge } from "@/db/profile-knowledge-read";
import type { ProfileSnapshot } from "@/db/profile-read";
import type { KnowledgeChildId } from "@/profile/knowledge-presentation";
import type { ProfilePresentation } from "@/profile/types";
import { ProfileModuleHost } from "./ProfileModuleHost";

// `useState` returns its initial value unless a test seeds a slot (call order
// within one render, counted from `hooks.index`; the Birthday sheet case
// resets it and seeds the host's activeSheet slot).
const hooks = vi.hoisted(() => ({
  index: 0,
  seed: new Map<number, unknown>(),
  initial: [] as unknown[],
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useEffect: () => {},
  useMemo: <T,>(factory: () => T) => factory(),
  useRef: <T,>(value: T) => ({ current: value }),
  useState: (value: unknown) => {
    const slot = hooks.index++;
    hooks.initial[slot] = value;
    return [hooks.seed.has(slot) ? hooks.seed.get(slot) : value, vi.fn()];
  },
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: "View",
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/ui/GlassSurface", () => ({
  GlassSurface: "GlassSurface",
}));
vi.mock("@/components/ui/ChromeScrim", () => ({
  ChromeScrim: "ChromeScrim",
}));
vi.mock("./ProfileHeading", () => ({ ProfileHeading: "ProfileHeading" }));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: { borderStrong: "borderStrong" } }),
}));
vi.mock("@/components/history/HistorySection", () => ({
  HistorySection: "HistorySection",
}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: vi.fn(),
}));
vi.mock("@/db/profile-presentation-dao", () => ({
  readProfileCollapseOverride: vi.fn(),
  setProfileCollapseOverride: vi.fn(),
}));
vi.mock("./ProfileRelationshipSheets", () => ({
  ProfileRelationshipSheets: "ProfileRelationshipSheets",
}));
vi.mock("./BirthdaySheet", () => ({ BirthdaySheet: "BirthdaySheet" }));
vi.mock("@/components/SnoozeSheet", () => ({ SnoozeSheet: "SnoozeSheet" }));
vi.mock("./RelationshipOverview", () => ({
  RelationshipOverview: "RelationshipOverview",
}));
vi.mock("./ThingsToRemember", () => ({
  ThingsToRemember: "ThingsToRemember",
}));

interface Node {
  type: string;
  key?: string | null;
  props: Record<string, unknown>;
  text: string;
  children: Node[];
}

function resolve(node: ReactNode): Node[] {
  if (typeof node === "string") {
    return [{ type: "literal", props: {}, text: node, children: [] }];
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
      key: element.key,
      props: element.props,
      text: "",
      children: resolve(element.props.children),
    },
  ];
}

function all(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

/** Every node with the host-element types above it, outermost first. */
function withAncestors(
  nodes: readonly Node[],
  above: readonly string[] = [],
): { node: Node; ancestors: readonly string[] }[] {
  return nodes.flatMap((node) => [
    { node, ancestors: above },
    ...withAncestors(node.children, [...above, node.type]),
  ]);
}

function text(node: Node): string {
  return all(node.children)
    .map((child) => child.text)
    .join("");
}

const presentation = {
  collapse: {},
  layout: {
    document: {
      topLevel: [{ id: "things-to-remember", visible: true, expanded: true }],
      thingsToRemember: [],
    },
  },
} as unknown as ProfilePresentation;

function snapshot(knowledge: ProfileSnapshot["knowledge"]): ProfileSnapshot {
  return {
    identity: { id: 7, name: "Ada" },
    knowledge,
  } as ProfileSnapshot;
}

function sectionHeaderCaptions(
  knowledge: ProfileSnapshot["knowledge"],
): Node[] {
  const nodes = all(
    resolve(
      ProfileModuleHost({
        snapshot: snapshot(knowledge),
        presentation,
        todayLocal: "2026-09-19",
        historyRevision: 0,
        onRequestScrollTo: vi.fn(),
        onSetFrequency: vi.fn(async () => {}),
        onSnooze: vi.fn(async () => {}),
        onUnsnooze: vi.fn(async () => {}),
        onSaveBirthday: vi.fn(async () => {}),
        onKnowledgeAction: vi.fn(),
        onKnowledgeViewAll: vi.fn(),
        onOpenValueHistory: vi.fn(),
        onOpenKnowledgeChange: vi.fn(),
        onContactMethodAction: vi.fn(),
      }),
    ),
  );
  // 38.14 D-51: a top-level section's captions sit under its heading row
  // (on a local ChromeScrim), no longer inside the toggle.
  return nodes.filter(
    (node) => node.type === "AppText" && node.props.role === "caption",
  );
}

const oneEntry = <T,>(item: T) => ({
  items: [item],
  total: 1,
  remainingCount: 0,
  hiddenCount: 0,
  showHiddenAvailable: false,
});
const noEntries = {
  items: [],
  total: 0,
  remainingCount: 0,
  hiddenCount: 0,
  showHiddenAvailable: false,
};

/** One entry in every Things to Remember child (D-72 needs entries). */
const fullKnowledge = {
  currentState: {
    last_talked_about: { id: 1, value: "Trip", previous: [] },
    current_location: { id: 2, value: "Lisbon", previous: [] },
  },
  featured: oneEntry({ owner: "memory", id: 3, row: { id: 3 } }),
  relationships: oneEntry({ id: 4 }),
  memories: oneEntry({ id: 5 }),
  thoughtOfThem: oneEntry({ id: 6 }),
  giftIdeas: oneEntry({ id: 7 }),
  importedNotes: oneEntry({ id: 8 }),
  customFields: [{ name: null, items: [{ fieldDefId: 9 }] }],
  offLimits: [{ id: 10 }],
} as unknown as ProfileKnowledge;

function profileHostNodes(
  onKnowledgeAction = vi.fn(),
  hostPresentation: ProfilePresentation = presentation,
  knowledge: ProfileKnowledge = fullKnowledge,
): Node[] {
  return all(
    resolve(
      ProfileModuleHost({
        snapshot: snapshot({ status: "ready", data: knowledge }),
        presentation: hostPresentation,
        todayLocal: "2026-09-19",
        historyRevision: 0,
        onRequestScrollTo: vi.fn(),
        onSetFrequency: vi.fn(async () => {}),
        onSnooze: vi.fn(async () => {}),
        onUnsnooze: vi.fn(async () => {}),
        onSaveBirthday: vi.fn(async () => {}),
        onKnowledgeAction,
        onKnowledgeViewAll: vi.fn(),
        onOpenValueHistory: vi.fn(),
        onOpenKnowledgeChange: vi.fn(),
        onContactMethodAction: vi.fn(),
      }),
    ),
  );
}

function childPresentation(id: KnowledgeChildId): ProfilePresentation {
  return {
    ...presentation,
    layout: {
      document: {
        ...presentation.layout.document,
        thingsToRemember: [{ id, visible: true, expanded: true }],
      },
    },
  } as unknown as ProfilePresentation;
}

describe("ProfileModuleHost section-header captions", () => {
  it("omits captions in normal state but retains the existing optional-section error", () => {
    expect(
      sectionHeaderCaptions({ status: "ready", data: {} as never }),
    ).toEqual([]);
    expect(
      sectionHeaderCaptions({
        status: "error",
        message: "Knowledge is unavailable.",
      }).map((node) =>
        all(node.children)
          .map((child) => child.text)
          .join(""),
      ),
    ).toEqual(["Knowledge is unavailable."]);
  });

  it("does not render an edit action for the top-level Things to Remember collection", () => {
    const action = profileHostNodes().find(
      (node) => node.props.accessibilityLabel === "Edit Things to Remember",
    );

    expect(action).toBeUndefined();
  });

  it("renders a distinct Off Limits heading action without duplicate heading or caption copy", () => {
    const onKnowledgeAction = vi.fn();
    const nodes = profileHostNodes(
      onKnowledgeAction,
      childPresentation("off-limits"),
    );
    const action = nodes.find(
      (node) => node.props.accessibilityLabel === "Edit Off Limits",
    );

    expect(action).toBeDefined();
    expect(
      nodes.filter(
        (node) =>
          node.type === "ProfileHeading" &&
          node.props.level === "h2" &&
          node.children.some(
            (child) => child.type === "literal" && child.text === "Off Limits",
          ),
      ),
    ).toHaveLength(1);
    expect(
      nodes.filter(
        (node) => node.type === "AppText" && node.props.role === "caption",
      ),
    ).toHaveLength(0);
    if (!action) throw new Error("Off Limits edit action is missing");
    (action.props.onPress as () => void)();

    expect(onKnowledgeAction).toHaveBeenCalledWith({
      action: "edit",
      childId: "off-limits",
      target: { owner: "offLimits", id: 0 },
    });
  });

  it("gives every child with entries its D-72 heading action, routed as an edit intent", () => {
    const cases = [
      ["last-talked-about", "Add", "Last Talked About", "current-state"],
      ["thought-of-them", "Add", "Thought of Them", "memory"],
      ["gift-ideas", "Add", "Gift Ideas", "memory"],
      ["memories", "Add", "Memories", "memory"],
      ["current-location", "Edit", "Current Location", "current-state"],
      ["key-people", "Edit", "Key People", "relationship"],
      ["off-limits", "Edit", "Off Limits", "offLimits"],
      ["custom-fields", "Edit", "Custom Fields", "custom-field"],
      [
        "imported-contact-notes",
        "Edit",
        "Imported from Contacts App",
        "memory",
      ],
    ] as const;

    for (const [childId, verb, label, owner] of cases) {
      const onKnowledgeAction = vi.fn();
      const nodes = profileHostNodes(
        onKnowledgeAction,
        childPresentation(childId),
      );
      const action = nodes.find(
        (node) => node.props.accessibilityLabel === `${verb} ${label}`,
      );

      expect(action, `${verb} ${label}`).toBeDefined();
      if (!action) throw new Error(`${label} heading action is missing`);
      const icon = all([action]).find((node) => node.type === "Icon");
      expect(icon?.props.name).toBe(verb === "Add" ? "add" : "edit");
      (action.props.onPress as () => void)();
      expect(onKnowledgeAction).toHaveBeenCalledWith({
        action: "edit",
        childId,
        target: { owner, id: 0 },
      });
    }

    const pinned = profileHostNodes(
      vi.fn(),
      childPresentation("pinned-featured"),
    );
    for (const label of ["Add Pinned / Featured", "Edit Pinned / Featured"]) {
      expect(
        pinned.find((node) => node.props.accessibilityLabel === label),
      ).toBeUndefined();
    }
  });

  it("draws no heading action on an empty section, and keeps it on one with entries (D-72; c11)", () => {
    const knowledge = {
      ...fullKnowledge,
      currentState: {},
      memories: oneEntry({ id: 5 }),
      giftIdeas: noEntries,
    } as unknown as ProfileKnowledge;
    const labels = (id: KnowledgeChildId) =>
      profileHostNodes(vi.fn(), childPresentation(id), knowledge)
        .map((node) => node.props.accessibilityLabel)
        .filter((label): label is string => typeof label === "string");

    expect(labels("current-location")).not.toContain("Edit Current Location");
    expect(labels("gift-ideas")).not.toContain("Add Gift Ideas");
    expect(labels("memories")).toContain("Add Memories");
  });

  it("draws no heading action while the knowledge read has failed", () => {
    const nodes = all(
      resolve(
        ProfileModuleHost({
          snapshot: snapshot({ status: "error", message: "Couldn't load" }),
          presentation: childPresentation("memories"),
          todayLocal: "2026-09-19",
          historyRevision: 0,
          onRequestScrollTo: vi.fn(),
          onSetFrequency: vi.fn(async () => {}),
          onSnooze: vi.fn(async () => {}),
          onUnsnooze: vi.fn(async () => {}),
          onSaveBirthday: vi.fn(async () => {}),
          onKnowledgeAction: vi.fn(),
          onKnowledgeViewAll: vi.fn(),
          onOpenValueHistory: vi.fn(),
          onOpenKnowledgeChange: vi.fn(),
          onContactMethodAction: vi.fn(),
        }),
      ),
    );
    expect(
      nodes.find((node) => node.props.accessibilityLabel === "Add Memories"),
    ).toBeUndefined();
  });
});

// 38.3 RG-021 (D-10, D-11): the Last Interaction tile and the Status sheet's
// "View history" reveal the in-Profile History section, and are offered only
// when the resolved layout shows History.
describe("ProfileModuleHost History reveal", () => {
  function historyPresentation(
    history: { visible: boolean; expanded: boolean },
    collapse: Record<string, boolean> = {},
  ): ProfilePresentation {
    return {
      collapse,
      layout: {
        document: {
          topLevel: [
            { id: "relationship-overview", visible: true, expanded: true },
            { id: "interaction-history", ...history },
          ],
          overview: [],
          thingsToRemember: [],
        },
      },
    } as unknown as ProfilePresentation;
  }

  function historyHostNodes(
    hostPresentation: ProfilePresentation,
    onRequestScrollTo = vi.fn(),
  ): Node[] {
    return all(
      resolve(
        ProfileModuleHost({
          snapshot: {
            identity: { id: 7, name: "Ada", intervalDays: 30 },
            knowledge: { status: "ready", data: {} },
            history: { status: "ready", data: {} },
          } as unknown as ProfileSnapshot,
          presentation: hostPresentation,
          todayLocal: "2026-09-19",
          historyRevision: 0,
          onRequestScrollTo,
          onSetFrequency: vi.fn(async () => {}),
          onSnooze: vi.fn(async () => {}),
          onUnsnooze: vi.fn(async () => {}),
          onSaveBirthday: vi.fn(async () => {}),
          onKnowledgeAction: vi.fn(),
          onKnowledgeViewAll: vi.fn(),
          onOpenValueHistory: vi.fn(),
          onOpenKnowledgeChange: vi.fn(),
          onContactMethodAction: vi.fn(),
        }),
      ),
    );
  }

  const layout = (y: number) => ({ nativeEvent: { layout: { y } } });
  const handler = <T,>(node: Node | undefined, prop: string): T => {
    const value = node?.props[prop];
    if (typeof value !== "function") throw new Error(`${prop} is missing`);
    return value as T;
  };

  it("hands both History actions a reveal handler when the layout shows History", () => {
    const nodes = historyHostNodes(
      historyPresentation({ visible: true, expanded: true }),
    );
    const overview = nodes.find((node) => node.type === "RelationshipOverview");
    const sheets = nodes.find(
      (node) => node.type === "ProfileRelationshipSheets",
    );
    expect(overview?.props.onOpenHistory).toBeTypeOf("function");
    expect(sheets?.props.onOpenHistory).toBeTypeOf("function");
  });

  it("offers neither History action when the layout hides History (D-11)", () => {
    const nodes = historyHostNodes(
      historyPresentation({ visible: false, expanded: true }),
    );
    const overview = nodes.find((node) => node.type === "RelationshipOverview");
    const sheets = nodes.find(
      (node) => node.type === "ProfileRelationshipSheets",
    );
    expect(overview).toBeDefined();
    expect(overview?.props.onOpenHistory).toBeUndefined();
    expect(sheets?.props.onOpenHistory).toBeUndefined();
    expect(
      nodes.find((node) => node.props.testID === "profile-history-anchor"),
    ).toBeUndefined();
  });

  it("scrolls an expanded History into view at the host offset plus the section offset", async () => {
    const { setProfileCollapseOverride } = await import(
      "@/db/profile-presentation-dao"
    );
    vi.mocked(setProfileCollapseOverride).mockClear();
    const onRequestScrollTo = vi.fn();
    const nodes = historyHostNodes(
      historyPresentation({ visible: true, expanded: true }),
      onRequestScrollTo,
    );
    const host = nodes.find(
      (node) => node.props.testID === "profile-module-host",
    );
    const anchor = nodes.find(
      (node) => node.props.testID === "profile-history-anchor",
    );
    handler<(event: unknown) => void>(host, "onLayout")(layout(240));
    handler<(event: unknown) => void>(anchor, "onLayout")(layout(600));
    const overview = nodes.find((node) => node.type === "RelationshipOverview");
    handler<() => void>(overview, "onOpenHistory")();

    expect(onRequestScrollTo).toHaveBeenCalledExactlyOnceWith(840);
    // Already expanded: the reveal writes nothing (no reset of History state).
    expect(setProfileCollapseOverride).not.toHaveBeenCalled();
  });

  it("expands a collapsed History through the persisted collapse override (D-28)", async () => {
    const { setProfileCollapseOverride, readProfileCollapseOverride } =
      await import("@/db/profile-presentation-dao");
    vi.mocked(setProfileCollapseOverride).mockClear();
    vi.mocked(readProfileCollapseOverride).mockResolvedValue({
      "interaction-history": true,
    });
    const onRequestScrollTo = vi.fn();
    const nodes = historyHostNodes(
      historyPresentation(
        { visible: true, expanded: true },
        { "interaction-history": false },
      ),
      onRequestScrollTo,
    );
    const sheets = nodes.find(
      (node) => node.type === "ProfileRelationshipSheets",
    );
    handler<() => void>(sheets, "onOpenHistory")();
    await vi.waitFor(() =>
      expect(setProfileCollapseOverride).toHaveBeenCalledWith(undefined, {
        contactId: 7,
        moduleId: "interaction-history",
        expanded: true,
        now: undefined,
      }),
    );
    // The scroll waits for the expanded History layout.
    expect(onRequestScrollTo).not.toHaveBeenCalled();
  });
  // 38.8 D-19/D-20 (C2-01): a heatmap jump measures its target against the
  // History anchor and scrolls the Profile there; the request's own
  // isCurrent() decides staleness and the host keeps no request state.
  it("keys HistorySection by the contact and hands it a History scroll request", () => {
    const nodes = historyHostNodes(
      historyPresentation({ visible: true, expanded: true }),
    );
    const section = nodes.find((node) => node.type === "HistorySection");
    expect(section?.props.onRequestHistoryScroll).toBeTypeOf("function");
    expect(section?.key).toBe("7");
    const anchor = nodes.find(
      (node) => node.props.testID === "profile-history-anchor",
    );
    expect(anchor?.props.collapsable).toBe(false);
  });

  it("scrolls a current jump request to host + anchor + target offsets and reports success", () => {
    const onRequestScrollTo = vi.fn();
    const nodes = historyHostNodes(
      historyPresentation({ visible: true, expanded: true }),
      onRequestScrollTo,
    );
    const host = nodes.find(
      (node) => node.props.testID === "profile-module-host",
    );
    const anchor = nodes.find(
      (node) => node.props.testID === "profile-history-anchor",
    );
    handler<(event: unknown) => void>(host, "onLayout")(layout(240));
    handler<(event: unknown) => void>(anchor, "onLayout")(layout(600));
    const anchorRef = anchor?.props.ref as { current: unknown };
    const anchorNode = { anchor: true };
    anchorRef.current = anchorNode;
    const target = {
      measureLayout: vi.fn(
        (
          relativeTo: unknown,
          onSuccess: (x: number, y: number) => void,
          _onFail: () => void,
        ) => {
          expect(relativeTo).toBe(anchorNode);
          onSuccess(0, 120);
        },
      ),
    };
    const request = handler<
      (
        target: unknown,
        isCurrent: () => boolean,
        onResult: (ok: boolean) => void,
      ) => void
    >(
      nodes.find((node) => node.type === "HistorySection"),
      "onRequestHistoryScroll",
    );

    const onResult = vi.fn();
    request(target, () => true, onResult);
    expect(onRequestScrollTo).toHaveBeenCalledExactlyOnceWith(960);
    expect(onResult).toHaveBeenCalledExactlyOnceWith(true);

    const staleResult = vi.fn();
    request(target, () => false, staleResult);
    expect(onRequestScrollTo).toHaveBeenCalledTimes(1);
    expect(staleResult).not.toHaveBeenCalled();
  });

  // 38.8 D-73 (G2): the empty-day note asks to land `leadIn` above itself.
  it("subtracts a requested lead-in from the measured target offset (D-73)", () => {
    const onRequestScrollTo = vi.fn();
    const nodes = historyHostNodes(
      historyPresentation({ visible: true, expanded: true }),
      onRequestScrollTo,
    );
    const host = nodes.find(
      (node) => node.props.testID === "profile-module-host",
    );
    const anchor = nodes.find(
      (node) => node.props.testID === "profile-history-anchor",
    );
    handler<(event: unknown) => void>(host, "onLayout")(layout(240));
    handler<(event: unknown) => void>(anchor, "onLayout")(layout(600));
    (anchor?.props.ref as { current: unknown }).current = {};
    const target = {
      measureLayout: (
        _relativeTo: unknown,
        onSuccess: (x: number, y: number) => void,
      ) => onSuccess(0, 120),
    };
    const request = handler<
      (
        target: unknown,
        isCurrent: () => boolean,
        onResult: (ok: boolean) => void,
        leadIn?: number,
      ) => void
    >(
      nodes.find((node) => node.type === "HistorySection"),
      "onRequestHistoryScroll",
    );
    request(target, () => true, vi.fn(), 50);
    expect(onRequestScrollTo).toHaveBeenCalledExactlyOnceWith(910);
  });

  // 38.8 D-72 (G1): History reports its loaded content's layout so an
  // expanding reveal can settle; an already-open reveal never scrolls twice.
  it("hands HistorySection a content-layout signal that never re-scrolls an open reveal (D-72)", () => {
    const onRequestScrollTo = vi.fn();
    const nodes = historyHostNodes(
      historyPresentation({ visible: true, expanded: true }),
      onRequestScrollTo,
    );
    const host = nodes.find(
      (node) => node.props.testID === "profile-module-host",
    );
    const anchor = nodes.find(
      (node) => node.props.testID === "profile-history-anchor",
    );
    handler<(event: unknown) => void>(host, "onLayout")(layout(240));
    handler<(event: unknown) => void>(anchor, "onLayout")(layout(600));
    handler<() => void>(
      nodes.find((node) => node.type === "RelationshipOverview"),
      "onOpenHistory",
    )();
    handler<() => void>(
      nodes.find((node) => node.type === "HistorySection"),
      "onContentLayout",
    )();
    expect(onRequestScrollTo).toHaveBeenCalledExactlyOnceWith(840);
  });

  it("treats a History read error as History's laid-out content (D-72)", () => {
    const nodes = all(
      resolve(
        ProfileModuleHost({
          snapshot: {
            identity: { id: 7, name: "Ada", intervalDays: 30 },
            knowledge: { status: "ready", data: {} },
            history: { status: "error", message: "Couldn't load" },
          } as unknown as ProfileSnapshot,
          presentation: historyPresentation({ visible: true, expanded: true }),
          todayLocal: "2026-09-19",
          historyRevision: 0,
          onRequestScrollTo: vi.fn(),
          onSetFrequency: vi.fn(async () => {}),
          onSnooze: vi.fn(async () => {}),
          onUnsnooze: vi.fn(async () => {}),
          onSaveBirthday: vi.fn(async () => {}),
          onKnowledgeAction: vi.fn(),
          onKnowledgeViewAll: vi.fn(),
          onOpenValueHistory: vi.fn(),
          onOpenKnowledgeChange: vi.fn(),
          onContactMethodAction: vi.fn(),
        }),
      ),
    );
    const error = nodes.find(
      (node) => node.props.testID === "profile-history-error",
    );
    expect(error?.props.onLayout).toBeTypeOf("function");
  });

  it("reports a failed measure only to a current request", () => {
    const onRequestScrollTo = vi.fn();
    const nodes = historyHostNodes(
      historyPresentation({ visible: true, expanded: true }),
      onRequestScrollTo,
    );
    const anchor = nodes.find(
      (node) => node.props.testID === "profile-history-anchor",
    );
    (anchor?.props.ref as { current: unknown }).current = {};
    const target = {
      measureLayout: (
        _relativeTo: unknown,
        _onSuccess: (x: number, y: number) => void,
        onFail: () => void,
      ) => onFail(),
    };
    const request = handler<
      (
        target: unknown,
        isCurrent: () => boolean,
        onResult: (ok: boolean) => void,
      ) => void
    >(
      nodes.find((node) => node.type === "HistorySection"),
      "onRequestHistoryScroll",
    );
    const current = vi.fn();
    request(target, () => true, current);
    expect(current).toHaveBeenCalledExactlyOnceWith(false);
    const stale = vi.fn();
    request(target, () => false, stale);
    expect(stale).not.toHaveBeenCalled();
    expect(onRequestScrollTo).not.toHaveBeenCalled();
  });
});

// 38.11 D-56/D-59 (review T-06): the Overview's sheets live in the host; the
// "birthday" sheet id opens the Birthday sheet, never ProfileRelationshipSheets.
describe("ProfileModuleHost Birthday sheet (38.11 D-56, D-59)", () => {
  /** The host's useState order: collapse, pending, failed, activeSheet. */
  const ACTIVE_SHEET_SLOT = 3;

  function birthdayHostNodes(activeSheet: string | null) {
    const onSaveBirthday = vi.fn(async () => {});
    hooks.index = 0;
    hooks.seed.clear();
    hooks.seed.set(ACTIVE_SHEET_SLOT, activeSheet);
    try {
      const nodes = all(
        resolve(
          ProfileModuleHost({
            snapshot: {
              identity: { id: 7, name: "Ada", birthday: "1990-05-03" },
              knowledge: { status: "ready", data: {} },
              history: { status: "ready", data: {} },
            } as unknown as ProfileSnapshot,
            presentation,
            todayLocal: "2026-09-19",
            historyRevision: 0,
            onRequestScrollTo: vi.fn(),
            onSetFrequency: vi.fn(async () => {}),
            onSnooze: vi.fn(async () => {}),
            onUnsnooze: vi.fn(async () => {}),
            onSaveBirthday,
            onKnowledgeAction: vi.fn(),
            onKnowledgeViewAll: vi.fn(),
            onOpenValueHistory: vi.fn(),
            onOpenKnowledgeChange: vi.fn(),
            onContactMethodAction: vi.fn(),
          }),
        ),
      );
      return { nodes, onSaveBirthday };
    } finally {
      hooks.seed.clear();
    }
  }

  it("pins the activeSheet slot", () => {
    birthdayHostNodes(null);
    expect(hooks.initial[ACTIVE_SHEET_SLOT]).toBeNull();
  });

  it("renders the Birthday sheet for the birthday id with the host's save and stored birthday", () => {
    const { nodes, onSaveBirthday } = birthdayHostNodes("birthday");
    const sheet = nodes.find((node) => node.type === "BirthdaySheet");
    expect(sheet?.props.visible).toBe(true);
    expect(sheet?.props.birthday).toBe("1990-05-03");
    expect(sheet?.props.onSave).toBe(onSaveBirthday);
    expect(sheet?.props.onClose).toBeTypeOf("function");
    const relationship = nodes.find(
      (node) => node.type === "ProfileRelationshipSheets",
    );
    expect(relationship?.props.active).toBeNull();
  });

  it("keeps the Birthday sheet closed for the other sheet ids", () => {
    const { nodes } = birthdayHostNodes("frequency");
    expect(
      nodes.find((node) => node.type === "BirthdaySheet")?.props.visible,
    ).toBe(false);
    expect(
      nodes.find((node) => node.type === "ProfileRelationshipSheets")?.props
        .active,
    ).toBe("frequency");
  });
});

// 38.11 D-45 (review T-06, W-01, X-02): the Overview Snooze tile opens the
// shared SnoozeSheet hosted here, never a snooze section in
// ProfileRelationshipSheets; it gets the EFFECTIVE snooze end.
describe("ProfileModuleHost Snooze sheet (38.11 D-45)", () => {
  /** The host's useState order: collapse, pending, failed, activeSheet. */
  const ACTIVE_SHEET_SLOT = 3;
  const TODAY = "2026-09-19";

  function snoozeHostNodes(
    activeSheet: string | null,
    snoozeUntil: string | null,
  ) {
    const onSnooze = vi.fn(async () => {});
    const onUnsnooze = vi.fn(async () => {});
    hooks.index = 0;
    hooks.seed.clear();
    hooks.seed.set(ACTIVE_SHEET_SLOT, activeSheet);
    try {
      const nodes = all(
        resolve(
          ProfileModuleHost({
            snapshot: {
              identity: { id: 7, name: "Ada", snoozeUntil },
              knowledge: { status: "ready", data: {} },
              history: { status: "ready", data: {} },
            } as unknown as ProfileSnapshot,
            presentation,
            todayLocal: TODAY,
            historyRevision: 0,
            onRequestScrollTo: vi.fn(),
            onSetFrequency: vi.fn(async () => {}),
            onSnooze,
            onUnsnooze,
            onSaveBirthday: vi.fn(async () => {}),
            onKnowledgeAction: vi.fn(),
            onKnowledgeViewAll: vi.fn(),
            onOpenValueHistory: vi.fn(),
            onOpenKnowledgeChange: vi.fn(),
            onContactMethodAction: vi.fn(),
          }),
        ),
      );
      const sheet = nodes.find((node) => node.type === "SnoozeSheet");
      if (!sheet) throw new Error("SnoozeSheet is missing");
      return { nodes, sheet, onSnooze, onUnsnooze };
    } finally {
      hooks.seed.clear();
    }
  }

  it("renders SnoozeSheet for the snooze id, wired to the host's snooze callbacks", async () => {
    const { nodes, sheet, onSnooze, onUnsnooze } = snoozeHostNodes(
      "snooze",
      "2026-09-25",
    );
    expect(sheet.props.visible).toBe(true);
    expect(sheet.props.title).toBe("Snooze Ada");
    expect(sheet.props.confirmName).toBe("Ada");
    expect(sheet.props.snoozedUntil).toBe("2026-09-25");
    expect(sheet.props.showUnsnooze).toBe(true);
    expect(sheet.props.todayLocal).toBe(TODAY);
    expect(sheet.props.onUnsnooze).toBe(onUnsnooze);
    expect(sheet.props.onClose).toBeTypeOf("function");
    // ProfileRelationshipSheets never receives the "snooze" id.
    expect(
      nodes.find((node) => node.type === "ProfileRelationshipSheets")?.props
        .active,
    ).toBeNull();

    const props = sheet.props as {
      onPreset: (preset: "1w") => Promise<void>;
      onUntil: (until: string) => Promise<void>;
      onRestore: (previous: string | null) => Promise<void>;
    };
    await props.onPreset("1w");
    expect(onSnooze).toHaveBeenLastCalledWith({ preset: "1w" });
    await props.onUntil("2026-09-30");
    expect(onSnooze).toHaveBeenLastCalledWith({ until: "2026-09-30" });
    // Undo maps onto the same callbacks, with no expiry logic of its own.
    await props.onRestore("2026-09-25");
    expect(onSnooze).toHaveBeenLastCalledWith({ until: "2026-09-25" });
    await props.onRestore(null);
    expect(onUnsnooze).toHaveBeenCalledOnce();
  });

  it("keeps the snooze sheet closed for other sheet ids", () => {
    expect(snoozeHostNodes("frequency", null).sheet.props.visible).toBe(false);
    expect(snoozeHostNodes(null, null).sheet.props.visible).toBe(false);
  });

  it("passes an expired snooze as not snoozed (review W-01, X-02)", () => {
    const { sheet } = snoozeHostNodes("snooze", "2026-09-18");
    expect(sheet.props.snoozedUntil).toBeNull();
    expect(sheet.props.showUnsnooze).toBe(false);
    // Ending today is not snoozed either (the countSnoozed predicate).
    const today = snoozeHostNodes("snooze", TODAY).sheet;
    expect(today.props.snoozedUntil).toBeNull();
    expect(today.props.showUnsnooze).toBe(false);
  });
});

// 38.11 D-28: an open section's chevron points up; a closed one points down.
describe("ProfileModuleHost section chevrons (38.11 D-28)", () => {
  function chevrons(expanded: boolean) {
    const hostPresentation = {
      collapse: {},
      layout: {
        document: {
          topLevel: [{ id: "things-to-remember", visible: true, expanded }],
          thingsToRemember: [],
        },
      },
    } as unknown as ProfilePresentation;
    return profileHostNodes(vi.fn(), hostPresentation)
      .filter(
        (node) =>
          node.type === "Pressable" &&
          typeof (node.props.accessibilityState as { expanded?: unknown })
            ?.expanded === "boolean",
      )
      .map((toggle) => ({
        expanded: (toggle.props.accessibilityState as { expanded: boolean })
          .expanded,
        icon: all(toggle.children).find((node) => node.type === "Icon")?.props
          .name,
      }));
  }

  it("points up when the section is open", () => {
    expect(chevrons(true)).toEqual([{ expanded: true, icon: "chevron-up" }]);
  });

  it("points down when the section is closed", () => {
    expect(chevrons(false)).toEqual([
      { expanded: false, icon: "chevron-down" },
    ]);
  });
});

// 38.14 D-51 / D-52 / D-83 (ADR-115 :18, ADR-218 :18): a top-level section has
// no card — its H1, rule and chevron sit bare on the page; its captions and
// Retry sit on a local ChromeScrim. A sub-section keeps its card and H2.
describe("ProfileModuleHost section levels (38.14 D-51, D-52, D-83)", () => {
  /** The host's useState order: collapse, pending, failed, activeSheet. */
  const PENDING_SLOT = 1;
  const FAILED_SLOT = 2;

  function levelNodes(options: {
    pending?: boolean;
    failed?: boolean;
    knowledge?: ProfileSnapshot["knowledge"];
    children?: KnowledgeChildId[];
  }) {
    hooks.index = 0;
    hooks.seed.clear();
    if (options.pending) {
      hooks.seed.set(PENDING_SLOT, new Set(["things-to-remember"]));
    }
    if (options.failed) hooks.seed.set(FAILED_SLOT, "things-to-remember");
    try {
      return withAncestors(
        resolve(
          ProfileModuleHost({
            snapshot: snapshot(
              options.knowledge ?? { status: "ready", data: fullKnowledge },
            ),
            presentation: {
              ...presentation,
              layout: {
                document: {
                  ...presentation.layout.document,
                  thingsToRemember: (options.children ?? []).map((id) => ({
                    id,
                    visible: true,
                    expanded: true,
                  })),
                },
              },
            } as unknown as ProfilePresentation,
            todayLocal: "2026-09-19",
            historyRevision: 0,
            onRequestScrollTo: vi.fn(),
            onSetFrequency: vi.fn(async () => {}),
            onSnooze: vi.fn(async () => {}),
            onUnsnooze: vi.fn(async () => {}),
            onSaveBirthday: vi.fn(async () => {}),
            onKnowledgeAction: vi.fn(),
            onKnowledgeViewAll: vi.fn(),
            onOpenValueHistory: vi.fn(),
            onOpenKnowledgeChange: vi.fn(),
            onContactMethodAction: vi.fn(),
          }),
        ),
      );
    } finally {
      hooks.seed.clear();
    }
  }

  const h1 = (entries: ReturnType<typeof levelNodes>) =>
    entries.find(
      ({ node }) => node.type === "ProfileHeading" && node.props.level === "h1",
    );

  it("renders the top-level heading as a bare H1 with no card and no ChromeScrim", () => {
    const entries = levelNodes({});
    const heading = h1(entries);
    expect(heading).toBeDefined();
    expect(heading && text(heading.node)).toBe("Things to Remember");
    expect(heading?.ancestors).not.toContain("ChromeScrim");
    expect(heading?.ancestors).not.toContain("GlassSurface");
    const chevron = entries.find(
      ({ node }) =>
        node.type === "Icon" && String(node.props.name).startsWith("chevron-"),
    );
    expect(chevron).toBeDefined();
    expect(chevron?.ancestors).not.toContain("ChromeScrim");
    expect(chevron?.ancestors).not.toContain("GlassSurface");
  });

  it("draws a token-coloured rule under the H1 row and gives the header no horizontal padding (R3-04)", () => {
    const entries = levelNodes({});
    const header = entries.find(
      ({ node }) =>
        node.type === "View" &&
        all(node.children).some(
          (child) =>
            child.type === "ProfileHeading" && child.props.level === "h1",
        ) &&
        node.children.some((child) => child.type === "Pressable"),
    );
    const style = Object.assign(
      {},
      ...([] as unknown[])
        .concat(header?.node.props.style)
        .map((entry) => (entry ?? {}) as Record<string, unknown>),
    ) as Record<string, unknown>;
    expect(style.borderBottomWidth).toBe(1);
    expect(style.borderBottomColor).toBe("borderStrong");
    expect(style.paddingHorizontal).toBeUndefined();
    expect(style.padding).toBeUndefined();
  });

  it("puts the Saving… caption and Retry on a ChromeScrim each, never the H1", () => {
    const entries = levelNodes({ pending: true, failed: true });
    const caption = entries.find(
      ({ node }) => node.type === "AppText" && text(node) === "Saving…",
    );
    expect(caption?.ancestors).toContain("ChromeScrim");
    const retry = entries.find(
      ({ node }) =>
        node.type === "Button" &&
        node.props.accessibilityLabel === "Retry saving Things to Remember",
    );
    expect(retry?.ancestors).toContain("ChromeScrim");
    expect(
      entries.filter(({ node }) => node.type === "ChromeScrim"),
    ).toHaveLength(2);
    expect(h1(entries)?.ancestors).not.toContain("ChromeScrim");
  });

  it("puts the error caption on a ChromeScrim", () => {
    const entries = levelNodes({
      knowledge: { status: "error", message: "Knowledge is unavailable." },
    });
    const caption = entries.find(
      ({ node }) =>
        node.type === "AppText" && text(node) === "Knowledge is unavailable.",
    );
    expect(caption?.node.props.role).toBe("caption");
    expect(caption?.ancestors).toContain("ChromeScrim");
  });

  it("keeps a sub-section on its card with an H2 heading and its header action", () => {
    const entries = levelNodes({ children: ["memories"] });
    const heading = entries.find(
      ({ node }) => node.type === "ProfileHeading" && node.props.level === "h2",
    );
    expect(heading && text(heading.node)).toBe("Memories");
    expect(heading?.ancestors).toContain("GlassSurface");
    expect(heading?.ancestors).not.toContain("ChromeScrim");
    const action = entries.find(
      ({ node }) => node.props.accessibilityLabel === "Add Memories",
    );
    expect(action?.ancestors).toContain("GlassSurface");
  });
});
