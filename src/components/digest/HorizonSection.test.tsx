import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  View: "View",
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/ContactCard", () => ({
  ringVisual: () => ({ color: "theme-token", opacity: 1, width: 2 }),
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

const { HorizonSection } = await import("./HorizonSection");

interface Node {
  type: unknown;
  props: Record<string, unknown>;
  text: string;
  children: Node[];
}
function resolve(node: ReactNode): Node[] {
  if (node == null || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number")
    return [{ type: "text", props: {}, text: String(node), children: [] }];
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function")
    return resolve(
      (element.type as (props: unknown) => ReactNode)(element.props),
    );
  const children = resolve(element.props.children);
  return [
    {
      type: element.type,
      props: element.props as Record<string, unknown>,
      text: children.map((child) => child.text).join(""),
      children,
    },
  ];
}
function all(nodes: Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

const overlooked = (id: number) => ({
  id,
  name: `Overlooked ${id}`,
  photo: null,
  rarely_responds: 0,
  progress: 4,
  status: "rogue",
  reason: "overdue",
});
const never = (id: number) => ({
  id,
  name: `Never ${id}`,
  photo: null,
  modified_at: "2026-09-19",
  categoryLabel: null,
  trackingEnabled: 1,
  favourite_rank: null,
  last_contact: null,
  snooze_until: null,
  status: null,
  progress: null,
  fuelText: null,
  snippet: null,
});

const render = (overrides: Record<string, unknown> = {}) =>
  all(
    resolve(
      HorizonSection({
        birthdays: [],
        overlooked: [],
        neverContactedRows: [],
        neverContactedCount: 0,
        upNextIds: [],
        onOpenProfile: vi.fn(),
        onDrillThrough: vi.fn(),
        ...overrides,
      } as never),
    ),
  );

describe("HorizonSection", () => {
  it("hides empty subgroups while keeping Horizon's neutral empty state", () => {
    const nodes = render({
      birthdays: [
        {
          contact: { id: 1, name: "Birthday", birthday: "2000-09-19" },
          id: 1,
          name: "Birthday",
          birthday: "2000-09-19",
          daysUntil: 0,
          tag: "Today",
        },
      ],
    });
    expect(
      nodes.some((node) => node.props.testID === "digest-horizon-birthdays"),
    ).toBe(true);
    expect(
      nodes.some((node) => node.props.testID === "digest-horizon-overlooked"),
    ).toBe(false);
    expect(
      nodes.some(
        (node) => node.props.testID === "digest-horizon-never-contacted",
      ),
    ).toBe(false);

    const emptyText = render()
      .map((node) => node.text)
      .join(" ");
    expect(emptyText).toContain("Nothing on the horizon");
  });

  it("deduplicates Up Next and uses only a non-numeric Overlooked drill", () => {
    const drill = vi.fn();
    const nodes = render({
      overlooked: [1, 2, 3, 4, 5].map(overlooked),
      upNextIds: [1],
      onDrillThrough: drill,
    });
    expect(
      nodes.filter((node) =>
        String(node.props.testID).startsWith("digest-horizon-contact-"),
      ),
    ).toHaveLength(3);
    const more = nodes.find(
      (node) => node.props.testID === "digest-overlooked-more",
    );
    if (!more) throw new Error("Missing Overlooked drill-through");
    expect(more?.text).toContain("See everyone needing attention");
    expect(more?.text).not.toMatch(/\+\d/);
    (more.props.onPress as () => void)();
    expect(drill).toHaveBeenCalledWith("overlooked");
  });

  it("renders Never Contacted only above zero with honest numeric overflow", () => {
    const drill = vi.fn();
    const nodes = render({
      neverContactedRows: [1, 2, 3, 4, 5].map(never),
      neverContactedCount: 5,
      onDrillThrough: drill,
    });
    const group = nodes.find(
      (node) => node.props.testID === "digest-horizon-never-contacted",
    );
    expect(group?.text).toContain("5 people have never been contacted");
    const more = nodes.find(
      (node) => node.props.testID === "digest-never-contacted-more",
    );
    if (!more) throw new Error("Missing Never Contacted drill-through");
    expect(more?.text).toContain("+2 more →");
    (more.props.onPress as () => void)();
    expect(drill).toHaveBeenCalledWith("never-contacted");
  });
});
