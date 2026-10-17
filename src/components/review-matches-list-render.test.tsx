import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Review matches list (38.12 D-107, D-15; convergence c2 B-4).
 *
 * A one-column list: each row shows the incoming person, "Might be: <Orbit
 * name> (+N)" and the evidence. A tap inspects that one person; long-press
 * enters multi-select and the bulk bar shows Link / Import as new / Skip as
 * buttons on the bar itself, with no centred "Choose action" dialog.
 *
 * Renders through a STATEFUL hook store (state persists across renders, a
 * setter updates its slot, `render()` re-runs the component), and the
 * FlatList's `renderItem` is called for every row.
 */

const hooks = vi.hoisted(() => ({
  stateIndex: 0,
  states: [] as unknown[],
  setters: [] as ((value: unknown) => void)[],
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
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
  FlatList: "FlatList",
  Pressable: "Pressable",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

const { mightBeLine, ReviewMatchesList } = await import("./ReviewMatchesList");
type CandidateItem = import("./ReviewMatchesList").CandidateItem;
type Props = import("./ReviewMatchesList").ReviewMatchesListProps;

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function textOf(element: TestElement | undefined): string {
  const children = element?.props.children;
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.join("");
  return "";
}

const ANN: CandidateItem = {
  id: 31,
  name: "Ann Lee",
  outcome: "needs_review",
  evidenceHint: "Matching phone number",
  photoUri: null,
  candidates: [
    { contactId: 4, name: "Ann Leigh", evidenceHint: "Matching phone number" },
    { contactId: 9, name: "Ann Lane", evidenceHint: "Similar name" },
  ],
};
const BO: CandidateItem = {
  id: 32,
  name: "Bo Ray",
  outcome: "needs_review",
  evidenceHint: "Similar name",
  photoUri: null,
  candidates: [{ contactId: 5, name: "Bo Rae", evidenceHint: "Similar name" }],
};
const CY: CandidateItem = {
  id: 33,
  name: "Cy Moe",
  outcome: "needs_review",
  evidenceHint: "Needs a closer look",
  photoUri: null,
  candidates: [],
};

let props: Props;

function render(overrides: Partial<Props> = {}) {
  props = { ...props, ...overrides };
  hooks.stateIndex = 0;
  const tree = nodes(ReviewMatchesList(props));
  const list = tree.find((node) => node.type === "FlatList");
  const renderItem = list?.props.renderItem as
    | ((info: { item: CandidateItem }) => ReactNode)
    | undefined;
  const rows = ((list?.props.data as CandidateItem[] | undefined) ?? []).map(
    (item) => renderItem?.({ item }) as TestElement,
  );
  return { tree, rows };
}

function rowTexts(row: TestElement): string[] {
  return nodes(row.props.children as ReactNode)
    .filter((node) => node.type === "Text")
    .map(textOf);
}

beforeEach(() => {
  hooks.states = [];
  hooks.setters = [];
  props = {
    items: [ANN, BO, CY],
    bulkActions: ["link", "import-new", "skip"],
    onInspect: vi.fn(),
    onBulkAction: vi.fn(async () => {}),
  };
});

describe("mightBeLine (D-107, B-10)", () => {
  it("names the first choice and counts the rest", () => {
    expect(mightBeLine(ANN.candidates)).toBe("Might be: Ann Leigh (+1)");
    expect(mightBeLine(BO.candidates)).toBe("Might be: Bo Rae");
    expect(mightBeLine([])).toBeNull();
    expect(mightBeLine(undefined)).toBeNull();
  });
});

describe("ReviewMatchesList (38.12 D-107)", () => {
  it("is a one-column list: person, 'Might be: … (+N)', evidence", () => {
    const { tree, rows } = render();
    const list = tree.find((node) => node.type === "FlatList");
    expect(list?.props.numColumns).toBeUndefined();
    expect(rows.map(rowTexts)).toEqual([
      ["Ann Lee", "Might be: Ann Leigh (+1)", "Matching phone number"],
      ["Bo Ray", "Might be: Bo Rae", "Similar name"],
      ["Cy Moe", "Needs a closer look"],
    ]);
  });

  it("announces the row through the shared candidate-card contract", () => {
    const row = render().rows[0] as TestElement;
    expect(row.props.accessibilityRole).toBe("button");
    expect(row.props.accessibilityLabel).toBe(
      "Ann Lee. Might be: Ann Leigh (+1). Matching phone number.",
    );
    expect(row.props.accessibilityActions).toEqual([
      { name: "toggle-selection", label: "Select" },
    ]);
  });

  it("a tap outside multi-select inspects that one person", () => {
    const row = render().rows[1] as TestElement;
    (row.props.onPress as () => void)();
    expect(props.onInspect).toHaveBeenCalledWith(BO);
    expect(
      render().tree.some(
        (node) => node.props.testID === "review-matches-bulk-bar",
      ),
    ).toBe(false);
  });

  it("long-press enters multi-select; the bulk bar shows Link, Import as new and Skip on the bar", () => {
    ((render().rows[0] as TestElement).props.onLongPress as () => void)();
    // A tap now toggles instead of inspecting.
    ((render().rows[1] as TestElement).props.onPress as () => void)();
    expect(props.onInspect).not.toHaveBeenCalled();
    const { tree, rows } = render();
    expect(
      rows.map(
        (row) =>
          (row.props.accessibilityState as { selected?: boolean }).selected,
      ),
    ).toEqual([true, true, false]);
    const bar = tree.find(
      (node) => node.props.testID === "review-matches-bulk-bar",
    );
    expect(bar).toBeDefined();
    const barTree = nodes(bar?.props.children as ReactNode);
    expect(barTree.some((node) => textOf(node) === "2 selected")).toBe(true);
    expect(
      barTree
        .filter((node) => node.type === "Button")
        .map((node) => node.props.label),
    ).toEqual(["Link", "Import as new", "Skip"]);
  });

  it("a bar button runs that action on the selection, with no modal or chooser (B-4)", async () => {
    ((render().rows[0] as TestElement).props.onLongPress as () => void)();
    ((render().rows[2] as TestElement).props.onLongPress as () => void)();
    const { tree } = render();
    expect(
      tree.some(
        (node) =>
          node.type === "Modal" ||
          node.type === "RegisteredModal" ||
          textOf(node).includes("Choose action"),
      ),
    ).toBe(false);
    const skip = tree.find(
      (node) => node.type === "Button" && node.props.label === "Skip",
    );
    await ((skip as TestElement).props.onPress as () => Promise<void> | void)();
    await Promise.resolve();
    expect(props.onBulkAction).toHaveBeenCalledWith("skip", [ANN, CY]);
    // The selection clears after the action.
    const after = render();
    expect(
      after.tree.some(
        (node) => node.props.testID === "review-matches-bulk-bar",
      ),
    ).toBe(false);
  });

  it("filters the bar's buttons through isActionEligible", () => {
    ((render().rows[0] as TestElement).props.onLongPress as () => void)();
    const { tree } = render({
      isActionEligible: (action) => action !== "link",
    });
    expect(
      tree
        .filter((node) => node.type === "Button")
        .map((node) => node.props.label),
    ).toEqual(["Import as new", "Skip"]);
  });

  it("shows the checking line while loading", () => {
    const { tree } = render({ items: [], loading: true });
    expect(tree.some((node) => textOf(node) === "Checking for matches…")).toBe(
      true,
    );
    expect(tree.some((node) => node.type === "FlatList")).toBe(false);
  });
});
