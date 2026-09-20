import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ProfileSnapshot } from "@/db/profile-read";
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
    return resolve((element.type as (props: unknown) => ReactNode)(element.props));
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
      topLevel: [
        { id: "things-to-remember", visible: true, expanded: true },
      ],
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

function sectionHeaderCaptions(knowledge: ProfileSnapshot["knowledge"]): Node[] {
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
    (node) => node.type === "Pressable" && node.props.accessibilityRole === "button",
  );
  return header
    ? all([header]).filter(
        (node) => node.type === "AppText" && node.props.role === "caption",
      )
    : [];
}

describe("ProfileModuleHost section-header captions", () => {
  it("omits captions in normal state but retains the existing optional-section error", () => {
    expect(sectionHeaderCaptions({ status: "ready", data: {} as never })).toEqual([]);
    expect(
      sectionHeaderCaptions({
        status: "error",
        message: "Knowledge is unavailable.",
      }).map((node) => all(node.children).map((child) => child.text).join("")),
    ).toEqual(["Knowledge is unavailable."]);
  });
});
