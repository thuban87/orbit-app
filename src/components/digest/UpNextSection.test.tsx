import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  View: "View",
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/ContactCard", () => ({
  ringVisual: (status: string) => ({ color: status, opacity: 1, width: 2 }),
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

const { UpNextSection, upNextReason } = await import("./UpNextSection");

interface Node {
  type: unknown;
  props: Record<string, unknown>;
  text: string;
  children: Node[];
}

function resolve(node: ReactNode): Node[] {
  if (node == null || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") {
    return [{ type: "text", props: {}, text: String(node), children: [] }];
  }
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function") {
    return resolve(
      (element.type as (props: unknown) => ReactNode)(element.props),
    );
  }
  const children = resolve(element.props.children);
  return [
    {
      type: element.type,
      props: element.props as Record<string, unknown>,
      text: children.map((child) => child.text).join(""),
      children,
    } as Node,
  ];
}

function all(nodes: Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

const candidate = (
  id: number,
  status: "wobble" | "decay" | "rogue" = "wobble",
) => ({
  id,
  name: `Person ${id}`,
  photo: null,
  progress: 1,
  status,
  reason: null as "overdue" | "unresponsive" | null,
});

describe("UpNextSection", () => {
  it("caps the compact profile rows at three and exposes a themed status ring", () => {
    const nodes = all(
      resolve(
        UpNextSection({
          candidates: [1, 2, 3, 4].map((id) => candidate(id)),
          onOpenProfile: vi.fn(),
        }),
      ),
    );
    expect(
      nodes.filter((node) =>
        String(node.props.testID).startsWith("digest-up-next-row-"),
      ),
    ).toHaveLength(3);
    expect(
      nodes.filter((node) =>
        String(node.props.testID).startsWith("digest-up-next-status-"),
      ),
    ).toHaveLength(3);
    expect(nodes.filter((node) => node.type === "Avatar")).toHaveLength(3);
  });

  it("keeps the module visible with its neutral empty state", () => {
    const text = all(
      resolve(UpNextSection({ candidates: [], onOpenProfile: vi.fn() })),
    )
      .map((node) => node.text)
      .join(" ");
    expect(text).toContain("You're all caught up");
    expect(text).toContain("No one needs a nudge right now.");
  });

  it("always supplies context, including status fallback and rogue reason copy", () => {
    expect(upNextReason(candidate(1, "wobble"))).toContain("Approaching");
    expect(upNextReason(candidate(2, "decay"))).toContain("Overdue");
    expect(
      upNextReason({ ...candidate(3, "rogue"), reason: "unresponsive" }),
    ).toContain("reply");

    const nodes = all(
      resolve(
        UpNextSection({
          candidates: [
            candidate(1, "wobble"),
            candidate(2, "decay"),
            { ...candidate(3, "rogue"), reason: "overdue" },
          ],
          onOpenProfile: vi.fn(),
        }),
      ),
    );
    const reasons = nodes.filter((node) =>
      String(node.props.testID).startsWith("digest-up-next-reason-"),
    );
    expect(reasons).toHaveLength(3);
    expect(reasons.every((node) => node.text.trim().length > 0)).toBe(true);
  });
});
