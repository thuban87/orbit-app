import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ProfileSnapshot } from "@/db/profile-read";
import type { KnowledgeChildId } from "@/profile/knowledge-presentation";
import type { ProfilePresentation } from "@/profile/types";
import { ProfileModuleHost } from "./ProfileModuleHost";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useEffect: () => {},
  useMemo: <T,>(factory: () => T) => factory(),
  useState: <T,>(value: T) => [value, vi.fn()] as const,
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
vi.mock("./RelationshipOverview", () => ({
  RelationshipOverview: "RelationshipOverview",
}));
vi.mock("./ThingsToRemember", () => ({
  ThingsToRemember: "ThingsToRemember",
}));

interface Node {
  type: string;
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
      props: element.props,
      text: "",
      children: resolve(element.props.children),
    },
  ];
}

function all(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
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
        onOpenHistory: vi.fn(),
        onSetFrequency: vi.fn(async () => {}),
        onSnooze: vi.fn(async () => {}),
        onUnsnooze: vi.fn(async () => {}),
        onKnowledgeAction: vi.fn(),
        onKnowledgeViewAll: vi.fn(),
        onOpenValueHistory: vi.fn(),
        onOpenKnowledgeChange: vi.fn(),
        onContactMethodAction: vi.fn(),
      }),
    ),
  );
  const header = nodes.find(
    (node) =>
      node.type === "Pressable" && node.props.accessibilityRole === "button",
  );
  return header
    ? all([header]).filter(
        (node) => node.type === "AppText" && node.props.role === "caption",
      )
    : [];
}

function profileHostNodes(
  onKnowledgeAction = vi.fn(),
  hostPresentation: ProfilePresentation = presentation,
): Node[] {
  return all(
    resolve(
      ProfileModuleHost({
        snapshot: snapshot({ status: "ready", data: {} as never }),
        presentation: hostPresentation,
        todayLocal: "2026-09-19",
        onOpenHistory: vi.fn(),
        onSetFrequency: vi.fn(async () => {}),
        onSnooze: vi.fn(async () => {}),
        onUnsnooze: vi.fn(async () => {}),
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
          node.type === "AppText" &&
          node.props.role === "heading" &&
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
      target: { owner: "fuel", id: 0 },
    });
  });

  it("gives every editable child owner its own correctly routed heading action", () => {
    const cases = [
      ["pinned-featured", "Pinned / Featured", "memory"],
      ["last-talked-about", "Last Talked About", "current-state"],
      ["key-people", "Key People", "relationship"],
      ["current-location", "Current Location", "current-state"],
      ["memories", "Memories", "memory"],
      ["custom-fields", "Custom Fields", "custom-field"],
      ["off-limits", "Off Limits", "fuel"],
      ["imported-contact-notes", "Imported from Contacts App", "memory"],
    ] as const;

    for (const [childId, label, owner] of cases) {
      const onKnowledgeAction = vi.fn();
      const action = profileHostNodes(
        onKnowledgeAction,
        childPresentation(childId),
      ).find((node) => node.props.accessibilityLabel === `Edit ${label}`);

      expect(action).toBeDefined();
      if (!action) throw new Error(`${label} edit action is missing`);
      (action.props.onPress as () => void)();
      expect(onKnowledgeAction).toHaveBeenCalledWith({
        action: "edit",
        childId,
        target: { owner, id: 0 },
      });
    }
  });
});
