import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ProfileKnowledge } from "@/db/profile-knowledge-read";

/**
 * Profile custom photo field with text in it (38.6 D-34), shallow render of
 * Things to Remember: the card says "Photo unavailable" (never "Photo added"),
 * renders without throwing, and the stored text is left as it is (D-31).
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
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  Sheet: "Sheet",
}));

import { ThingsToRemember } from "./ThingsToRemember";

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

function photoField(fieldDefId: number, label: string, rawValue: string) {
  return {
    fieldDefId,
    valueUid: `value-${fieldDefId}`,
    label,
    type: "photo" as const,
    options: null,
    rawValue,
    parsed: { ok: true as const, value: rawValue },
    shareWithAi: 0 as const,
    historyRetained: 0 as const,
    historyKey: null,
  };
}

const knowledge = {
  currentState: {},
  featured: emptyCollection,
  relationships: emptyCollection,
  memories: emptyCollection,
  importedNotes: emptyCollection,
  customFields: [
    {
      name: null,
      items: [
        photoField(30, "Dog", "Rex"),
        photoField(31, "Cat", "avatars/cv-7-cat.jpg"),
      ],
    },
  ],
  offLimits: [],
} as unknown as ProfileKnowledge;

function cards(): Node[] {
  const nodes = all(
    resolve(
      ThingsToRemember({
        contactId: 7,
        knowledge,
        childIds: ["custom-fields"],
        onAction: vi.fn(),
        onViewAll: vi.fn(),
        onOpenValueHistory: vi.fn(),
      }),
    ),
  );
  return nodes.filter(
    (node) =>
      node.type === "Pressable" &&
      typeof node.props.accessibilityLabel === "string",
  );
}

function texts(node: Node): string[] {
  return all([node])
    .filter((child) => child.type === "literal")
    .map((child) => child.text);
}

describe("Things to Remember: text in a photo field (38.6 D-34)", () => {
  it("renders the text-valued photo field as 'Photo unavailable', not 'Photo added'", () => {
    const [dog, cat] = cards();
    expect(dog?.props.accessibilityLabel).toBe("Dog");
    const dogTexts = dog ? texts(dog) : [];
    expect(dogTexts).toEqual(["Dog", "Photo unavailable"]);
    expect(dogTexts).not.toContain("Photo added");
    // Not the parse-error treatment: the value is untouched, not "fixable".
    expect(dogTexts).not.toContain("Needs attention");
    expect(cat ? texts(cat) : []).toEqual(["Cat", "Photo added"]);
  });

  it("leaves the stored text untouched", () => {
    const [field] = knowledge.customFields[0]?.items ?? [];
    cards();
    expect(field?.rawValue).toBe("Rex");
  });
});
