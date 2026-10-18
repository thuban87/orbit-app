import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  ProfileCustomFieldValue,
  ProfileKnowledge,
} from "@/db/profile-knowledge-read";

/**
 * A flagged custom-field value on the Profile (38.12 D-70; enforces D-24's
 * tap-to-fix): the card shows exactly one "Needs attention" marker, in the
 * danger colour, and tapping the card runs Edit for that field, which the
 * Profile routes to Edit Contact with `focusFieldDefId`
 * (contact-profile-logic.test.ts). A valid value keeps its sheet on tap and
 * shows no marker.
 */

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: <T,>(factory: () => T) => factory(),
  useState: <T,>(value: T) => [value, vi.fn()] as const,
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: "View",
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: { danger: "danger" } }),
}));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  Sheet: "Sheet",
}));
vi.mock("@/components/MemoryCard", () => ({ openMemoryLink: vi.fn() }));

const { DetailSheet, ThingsToRemember } = await import("./ThingsToRemember");

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

const emptyCollection = {
  items: [],
  total: 0,
  remainingCount: 0,
  hiddenCount: 0,
  showHiddenAvailable: false,
};

function field(
  over: Partial<ProfileCustomFieldValue>,
): ProfileCustomFieldValue {
  return {
    fieldDefId: 21,
    valueUid: "v-21",
    label: "Met on",
    type: "date",
    options: null,
    rawValue: "not a date",
    parsed: { ok: false },
    shareWithAi: 0,
    historyRetained: 0,
    historyKey: null,
    ...over,
  };
}

function knowledgeWith(items: ProfileCustomFieldValue[]): ProfileKnowledge {
  return {
    currentState: {},
    featured: emptyCollection,
    relationships: emptyCollection,
    memories: emptyCollection,
    thoughtOfThem: emptyCollection,
    giftIdeas: emptyCollection,
    importedNotes: emptyCollection,
    customFields: [{ name: null, items }],
    offLimits: [],
  } as unknown as ProfileKnowledge;
}

function cardsOf(items: ProfileCustomFieldValue[], onAction = vi.fn()) {
  const tree = all(
    resolve(
      ThingsToRemember({
        contactId: 7,
        knowledge: knowledgeWith(items),
        childIds: ["custom-fields"],
        onAction,
        onViewAll: vi.fn(),
        onOpenValueHistory: vi.fn(),
      }),
    ),
  );
  return tree.filter(
    (node) =>
      node.type === "Pressable" &&
      typeof node.props.accessibilityLabel === "string",
  );
}

function markers(card: Node): Node[] {
  return all([card]).filter(
    (node) =>
      node.type === "AppText" &&
      node.children.some(
        (child) => child.type === "literal" && child.text === "Needs attention",
      ),
  );
}

describe("flagged custom-field value on the Profile (38.12 D-70)", () => {
  it("shows exactly one 'Needs attention' marker, in the danger colour", () => {
    const [card] = cardsOf([field({})]);
    if (!card) throw new Error("card is missing");
    const found = markers(card);
    expect(found).toHaveLength(1);
    expect(found[0]?.props.style).toEqual({ color: "danger" });
    expect(card.props.accessibilityLabel).toBe("Met on, needs attention");
  });

  it("tapping the flagged card runs Edit for that field", () => {
    const onAction = vi.fn();
    const [card] = cardsOf([field({})], onAction);
    (card?.props.onPress as (() => void) | undefined)?.();
    expect(onAction).toHaveBeenCalledWith({
      action: "edit",
      target: { owner: "custom-field", id: 21 },
    });
  });

  it("a valid value shows no marker and its tap opens the sheet, not Edit", () => {
    const onAction = vi.fn();
    const [card] = cardsOf(
      [
        field({
          rawValue: "2026-10-20",
          parsed: { ok: true, value: "2026-10-20" },
        }),
      ],
      onAction,
    );
    if (!card) throw new Error("card is missing");
    expect(markers(card)).toHaveLength(0);
    (card.props.onPress as () => void)();
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("the flagged value's detail sheet (38.12 D-70, review C-WR-04)", () => {
  function sheetTexts(invalid: boolean): Node[] {
    const item = {
      title: "Met on",
      preview: "sometime",
      metadata: invalid ? ["Needs attention"] : [],
      invalid,
      detail: { owner: "custom-field", id: 21 },
      history: null,
      management: { accessibility: ["edit"] },
    };
    return all(
      resolve(
        DetailSheet({
          item: item as never,
          onClose: vi.fn(),
          onAction: vi.fn(),
          onOpenValueHistory: vi.fn(),
        }),
      ),
    ).filter((node) => node.type === "AppText");
  }
  const says = (node: Node, pattern: RegExp) =>
    node.children.some(
      (child) => child.type === "literal" && pattern.test(child.text),
    );

  it("shows needs attention once, in the danger colour", () => {
    const found = sheetTexts(true).filter((node) =>
      says(node, /needs attention/i),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.props.style).toEqual({ color: "danger" });
  });

  it("a valid value's sheet has no marker", () => {
    expect(
      sheetTexts(false).filter((node) => says(node, /needs attention/i)),
    ).toHaveLength(0);
  });
});
