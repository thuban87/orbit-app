import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryRow } from "@/db/memories-read";
import type { ProfileKnowledge } from "@/db/profile-knowledge-read";
import type {
  KnowledgeEntryLink,
  KnowledgePresentationItem,
} from "@/profile/knowledge-presentation";

/**
 * Things to Remember entry actions on the Profile (38.10 D-70, D-87, D-107,
 * D-68, D-24; checker cycle 2 I-9, cycle 3 I-1; convergence c10): the card's
 * screen-reader actions read Edit / Pin / Unpin and never Hide, a linked
 * card's tap opens its interaction, an empty section's "Add …" emits an
 * `affordance: "empty"` intent, and the sheet offers Close and a URL's Open.
 */

let sheetItem: KnowledgePresentationItem | null = null;

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: <T,>(factory: () => T) => factory(),
  // The selected-entry state starts null; a test can open the sheet on an item.
  useState: <T,>(value: T) =>
    [value === null && sheetItem ? sheetItem : value, vi.fn()] as const,
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: "View",
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  Sheet: "Sheet",
}));
const openMemoryLink = vi.fn();
vi.mock("@/components/MemoryCard", () => ({
  openMemoryLink: (url: string) => openMemoryLink(url),
}));

import {
  type KnowledgeActionIntent,
  KnowledgeCard,
  ThingsToRemember,
} from "./ThingsToRemember";

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

function memory(id: number, over: Partial<MemoryRow> = {}): MemoryRow {
  return {
    id,
    uid: `memory-${id}`,
    contact_id: 7,
    type: "general",
    custom_label: null,
    value: `Memory ${id}`,
    note: null,
    url: null,
    meaningful_date: null,
    pinned: 0,
    outdated: 0,
    hidden: 0,
    provenance: "user",
    created_at: "2026-09-01 12:00:00",
    modified_at: "2026-09-01 12:00:00",
    deleted_at: null,
    allow_ai: 0,
    interaction_id: null,
    link_source: null,
    group_note_copy: 0,
    linked_note_ai_locked: 0,
    ...over,
  };
}

const empty = {
  currentState: {},
  featured: emptyCollection,
  relationships: emptyCollection,
  memories: emptyCollection,
  thoughtOfThem: emptyCollection,
  giftIdeas: emptyCollection,
  importedNotes: emptyCollection,
  customFields: [],
  offLimits: [],
} as unknown as ProfileKnowledge;

function withMemories(rows: MemoryRow[]): ProfileKnowledge {
  return {
    ...empty,
    memories: { ...emptyCollection, items: rows, total: rows.length },
  };
}

function render(
  knowledge: ProfileKnowledge,
  childId: Parameters<typeof ThingsToRemember>[0]["childIds"] = ["memories"],
  handlers: {
    onAction?: (intent: KnowledgeActionIntent) => void;
    onOpenLinked?: (link: KnowledgeEntryLink) => void;
  } = {},
): Node[] {
  return all(
    resolve(
      ThingsToRemember({
        contactId: 7,
        knowledge,
        childIds: childId,
        onAction: handlers.onAction ?? vi.fn(),
        onViewAll: vi.fn(),
        onOpenValueHistory: vi.fn(),
        onOpenLinked: handlers.onOpenLinked,
      }),
    ),
  );
}

function props(node: Node | undefined): Record<string, unknown> {
  if (!node) throw new Error("node is missing");
  return node.props;
}

const cards = (nodes: Node[]) =>
  nodes.filter(
    (node) =>
      node.type === "Pressable" &&
      typeof node.props.accessibilityLabel === "string",
  );

const buttonLabels = (nodes: Node[]) =>
  nodes
    .filter((node) => node.type === "Button")
    .map((node) => node.props.label as string);

beforeEach(() => {
  sheetItem = null;
  openMemoryLink.mockReset();
});

describe("Things to Remember entry actions (D-70, D-87; I-9, I-1)", () => {
  it("labels the card's screen-reader actions Edit and Pin or Unpin, never Hide", () => {
    const [plain, pinned] = cards(
      render(withMemories([memory(1), memory(2, { pinned: 1 })])),
    );
    expect(props(plain).accessibilityActions).toEqual([
      { name: "edit", label: "Edit" },
      { name: "pin", label: "Pin" },
    ]);
    expect(props(pinned).accessibilityActions).toEqual([
      { name: "edit", label: "Edit" },
      { name: "unpin", label: "Unpin" },
    ]);
    for (const card of [plain, pinned]) {
      const labels = (
        props(card).accessibilityActions as { label: string }[]
      ).map((action) => action.label);
      expect(labels).not.toContain("Hide from Profile");
    }
  });

  it("runs the screen-reader action that fired, with the entry's target", () => {
    const onAction = vi.fn();
    const [card] = cards(
      render(withMemories([memory(1)]), ["memories"], { onAction }),
    );
    (props(card).onAccessibilityAction as (event: unknown) => void)({
      nativeEvent: { actionName: "pin" },
    });
    expect(onAction).toHaveBeenCalledWith({
      action: "pin",
      target: { owner: "memory", id: 1 },
    });
    (props(card).onAccessibilityAction as (event: unknown) => void)({
      nativeEvent: { actionName: "activate" },
    });
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe("linked entries (D-107, D-37)", () => {
  const linked = memory(1, { interaction_id: 40, link_source: "note" });

  it("opens the interaction on a linked card's tap and keeps the sheet on long-press", () => {
    const onOpenLinked = vi.fn();
    const onOpen = vi.fn();
    const item = {
      id: "memory:1",
      title: "Memory",
      preview: "Memory 1",
      metadata: [],
      detail: {
        owner: "memory" as const,
        id: 1,
        link: { interactionId: 40, linkSource: "note" as const },
      },
      management: {
        longPress: ["edit"] as const,
        accessibility: ["edit"] as const,
      },
      sparkle: false,
    };
    const [card] = cards(
      resolve(KnowledgeCard({ item, onOpen, onAction: vi.fn(), onOpenLinked })),
    );
    (props(card).onPress as () => void)();
    expect(onOpenLinked).toHaveBeenCalledWith({
      interactionId: 40,
      linkSource: "note",
    });
    expect(onOpen).not.toHaveBeenCalled();
    (props(card).onLongPress as () => void)();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("taps through to the interaction from the Profile section", () => {
    const onOpenLinked = vi.fn();
    const [card] = cards(
      render(withMemories([linked]), ["memories"], { onOpenLinked }),
    );
    (props(card).onPress as () => void)();
    expect(onOpenLinked).toHaveBeenCalledWith({
      interactionId: 40,
      linkSource: "note",
    });
  });

  it("opens the sheet on an unlinked card's tap, and on a linked one without onOpenLinked", () => {
    const onOpenLinked = vi.fn();
    const [plain] = cards(
      render(withMemories([memory(2)]), ["memories"], { onOpenLinked }),
    );
    const [fallback] = cards(render(withMemories([linked])));
    expect(props(plain).onPress).toBe(props(plain).onLongPress);
    expect(props(fallback).onPress).toBe(props(fallback).onLongPress);
    (props(plain).onPress as () => void)();
    expect(onOpenLinked).not.toHaveBeenCalled();
  });
});

describe("empty sections (D-68; c10)", () => {
  it("renders an empty section's 'Add …' and emits an empty-add intent", () => {
    const onAction = vi.fn();
    const nodes = render(empty, ["gift-ideas"], { onAction });
    const add = nodes.find(
      (node) => node.type === "Button" && node.props.label === "Add Gift Idea",
    );
    expect(add).toBeDefined();
    (props(add).onPress as () => void)();
    expect(onAction).toHaveBeenCalledWith({
      action: "edit",
      childId: "gift-ideas",
      target: { owner: "memory", id: 0 },
      affordance: "empty",
    });
  });

  it("renders only the line for an empty Imported section", () => {
    const nodes = render(empty, ["imported-contact-notes"]);
    expect(
      buttonLabels(nodes).filter((label) => label?.startsWith("Add")),
    ).toEqual([]);
    expect(
      nodes.some(
        (node) => node.type === "literal" && node.text === "Nothing added yet",
      ),
    ).toBe(true);
  });

  it("drops the empty 'Add …' once the section has an entry", () => {
    expect(buttonLabels(render(withMemories([memory(1)])))).not.toContain(
      "Add Memory",
    );
  });
});

describe("entry sheet (D-87, D-70, D-24)", () => {
  it("offers Edit, Pin and Close, no Hide, and Open for a stored URL", () => {
    sheetItem = {
      id: "memory:3",
      title: "Memory",
      preview: "Soup",
      metadata: ["Link"],
      detail: { owner: "memory", id: 3, url: "https://example.test/soup" },
      management: {
        longPress: ["edit", "pin"],
        accessibility: ["edit", "pin"],
      },
      sparkle: false,
    };
    const nodes = render(empty, ["memories"]);
    const labels = buttonLabels(nodes);
    expect(labels).toEqual(
      expect.arrayContaining(["Open", "Edit", "Pin", "Close"]),
    );
    expect(labels).not.toContain("Done");
    expect(labels).not.toContain("Hide from Profile");
    expect(
      nodes.some(
        (node) =>
          node.type === "literal" && node.text === "https://example.test/soup",
      ),
    ).toBe(true);
    const open = nodes.find(
      (node) => node.type === "Button" && node.props.label === "Open",
    );
    (props(open).onPress as () => void)();
    expect(openMemoryLink).toHaveBeenCalledWith("https://example.test/soup");
  });
});
