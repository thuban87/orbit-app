import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ exec: {}, showSnackbar: vi.fn() }));
vi.mock("react-native", () => ({
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
  View: "View",
}));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: vi.fn() }));
vi.mock("@/components/digest/UpNextSection", () => ({
  UpNextSection: "UpNextSection",
}));
vi.mock("@/components/digest/HorizonSection", () => ({
  HorizonSection: "HorizonSection",
}));
vi.mock("@/components/digest/YourWeekSection", () => ({
  YourWeekSection: "YourWeekSection",
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/ChromeScrim", () => ({ ChromeScrim: "ChromeScrim" }));
vi.mock("@/db/database", () => ({
  getExecutor: () => mocks.exec,
  localDateTime: () => "2026-09-19 12:00:00",
}));
vi.mock("@/stores/snackbar-store", () => ({
  showSnackbar: mocks.showSnackbar,
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

const { DigestContent, DigestLoadedBody, runDigestDrillThrough } = await import(
  "./DigestScreen"
);

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

const upNext = (id: number) => ({
  id,
  name: `Person ${id}`,
  photo: null,
  progress: 2,
  status: "decay" as const,
  reason: null,
});
const data = {
  upNextCandidates: [upNext(1), upNext(2), upNext(3), upNext(4)],
  overlooked: [
    { ...upNext(1), rarely_responds: 0 },
    { ...upNext(5), rarely_responds: 0 },
  ],
  birthdayCandidates: [],
  neverContactedCount: 0,
  neverContactedRows: [],
};

describe("DigestScreen composition", () => {
  it("renders the fixed Up Next, Horizon, Your Week order and flows claimed ids", () => {
    const nodes = all(
      resolve(
        DigestLoadedBody({
          data,
          onOpenProfile: vi.fn(),
          onDrillThrough: vi.fn(),
        }),
      ),
    );
    expect(
      nodes
        .map((node) => node.type)
        .filter((type) =>
          ["UpNextSection", "HorizonSection", "YourWeekSection"].includes(
            String(type),
          ),
        ),
    ).toEqual(["UpNextSection", "HorizonSection", "YourWeekSection"]);
    const upNextNode = nodes.find((node) => node.type === "UpNextSection");
    const horizon = nodes.find((node) => node.type === "HorizonSection");
    if (!horizon) throw new Error("Missing Horizon module");
    expect(upNextNode?.props.candidates).toHaveLength(3);
    expect(horizon?.props.upNextIds).toEqual([1, 2, 3]);
    expect(
      (horizon.props.overlooked as Array<{ id: number }>).map((row) => row.id),
    ).toEqual([5]);
  });

  it("keeps loading blank and renders the calm Digest error sentinel", () => {
    const loading = all(
      resolve(
        DigestContent({
          state: { phase: "loading" },
          onOpenProfile: vi.fn(),
          onDrillThrough: vi.fn(),
        }),
      ),
    );
    expect(loading.some((node) => node.type === "UpNextSection")).toBe(false);
    expect(loading.map((node) => node.text).join(" ")).toContain("Digest");

    const error = all(
      resolve(
        DigestContent({
          state: { phase: "error" },
          onOpenProfile: vi.fn(),
          onDrillThrough: vi.fn(),
        }),
      ),
    );
    const text = error.map((node) => node.text).join(" ");
    expect(text).toContain("Couldn't load your Digest");
    expect(text).toContain("Try opening it again in a moment.");
  });

  it("awaits the complete query write before navigating and never navigates on rejection", async () => {
    const order: string[] = [];
    await runDigestDrillThrough("never-contacted", {
      setPopulationsAndFilters: (async (
        _exec: unknown,
        populations: string[],
        filters: Record<string, string[]>,
      ) => {
        expect(populations).toEqual(["not-contacted"]);
        expect(filters).toEqual({});
        order.push("persisted");
      }) as never,
      navigateToContacts: () => order.push("navigated"),
    });
    expect(order).toEqual(["persisted", "navigated"]);

    const navigate = vi.fn();
    await expect(
      runDigestDrillThrough("overlooked", {
        setPopulationsAndFilters: vi
          .fn()
          .mockRejectedValue(new Error("write failed")),
        navigateToContacts: navigate,
      }),
    ).rejects.toThrow("write failed");
    expect(navigate).not.toHaveBeenCalled();
  });
});
