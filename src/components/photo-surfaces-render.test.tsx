import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Review surfaces that show an existing Orbit contact render its canonical
 * photo through `Avatar`, so they follow the display revision (38.6 D-01/D-14).
 * Staged (pre-import / phone) previews keep their caller-resolved URI; the
 * reconcile staging preview is never served from the image cache.
 */

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (value: unknown) => [
    typeof value === "function" ? (value as () => unknown)() : value,
    () => {},
  ],
}));
vi.mock("react-native", () => ({
  FlatList: "FlatList",
  Modal: "Modal",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: {},
    hairlineWidth: 1,
  },
}));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/ConfidenceChip", () => ({
  ConfidenceChip: "ConfidenceChip",
  confidenceLabel: (outcome: string) => outcome,
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));

const { CandidateCardGrid } = await import("./CandidateCardGrid");
type CandidateItem = import("./CandidateCardGrid").CandidateItem;
const { PhotoChoice } = await import("./PhotoChoice");
type PhotoChoiceOption = import("./PhotoChoice").PhotoChoiceOption;

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

/** Render one grid card through the FlatList's renderItem. */
function gridCard(item: CandidateItem): TestElement[] {
  const tree = nodes(
    CandidateCardGrid({
      items: [item],
      bulkActions: [],
      onInspect: () => {},
      onBulkAction: () => {},
      recommendationExcludes: "needs_review",
    }),
  );
  const list = tree.find((node) => node.type === "FlatList");
  const renderItem = list?.props.renderItem as (info: {
    item: CandidateItem;
  }) => ReactNode;
  return nodes(renderItem({ item }));
}

const BASE: CandidateItem = {
  id: 7,
  name: "Grace Hopper",
  outcome: "needs_review",
  evidenceHint: "2 differences left",
  photoUri: null,
};

describe("CandidateCardGrid photo sources (38.6 D-01/D-14)", () => {
  it("renders the canonical Orbit photo through Avatar when `photo` is set", () => {
    const card = gridCard({ ...BASE, photo: "avatars/contact-7.jpg" });
    const avatars = card.filter((node) => node.type === "Avatar");
    expect(avatars).toHaveLength(1);
    expect(avatars[0]?.props).toMatchObject({
      photo: "avatars/contact-7.jpg",
      name: "Grace Hopper",
      contactId: 7,
      size: 48,
    });
    expect(card.some((node) => node.type === "Image")).toBe(false);
  });

  it("keeps the raw staging Image when only `photoUri` is set", () => {
    const card = gridCard({
      ...BASE,
      photoUri: "file:///cache/import-staging/7.jpg",
    });
    const image = card.find((node) => node.type === "Image");
    expect(image?.props.source).toEqual({
      uri: "file:///cache/import-staging/7.jpg",
    });
    expect(card.some((node) => node.type === "Avatar")).toBe(false);
  });

  it("falls back to the initials Avatar when neither is set", () => {
    const card = gridCard({ ...BASE, photo: null });
    const avatars = card.filter((node) => node.type === "Avatar");
    expect(avatars).toHaveLength(1);
    expect(avatars[0]?.props.photo).toBeNull();
    expect(card.some((node) => node.type === "Image")).toBe(false);
  });
});

function photoChoice(options: PhotoChoiceOption[]): TestElement[] {
  return nodes(PhotoChoice({ options, mode: "conflict", onChange: () => {} }));
}

describe("PhotoChoice photo sources (38.6 D-01/D-14)", () => {
  it("renders a canonical `photo` through Avatar at size 96", () => {
    const tree = photoChoice([
      {
        id: "survivor",
        photo: "avatars/contact-1.jpg",
        uri: null,
        name: "Ada",
        provenance: "From Ada",
      },
    ]);
    const avatars = tree.filter((node) => node.type === "Avatar");
    expect(avatars.map((node) => node.props)).toEqual([
      { photo: "avatars/contact-1.jpg", name: "Ada", size: 96 },
    ]);
    expect(tree.some((node) => node.type === "Image")).toBe(false);
  });

  it("renders the staging `uri` as an uncached Image", () => {
    const tree = photoChoice([
      {
        id: "source",
        uri: "file:///docs/reconcile-contact-3-link-9.jpg",
        name: "Ada",
        provenance: "From the phone",
      },
    ]);
    const image = tree.find((node) => node.type === "Image");
    expect(image?.props.source).toEqual({
      uri: "file:///docs/reconcile-contact-3-link-9.jpg",
    });
    expect(image?.props.cachePolicy).toBe("none");
    expect(tree.some((node) => node.type === "Avatar")).toBe(false);
  });

  it("falls back to initials when neither is set", () => {
    const tree = photoChoice([
      { id: "none", uri: null, name: "Ada", provenance: "From Ada" },
    ]);
    const avatars = tree.filter((node) => node.type === "Avatar");
    expect(avatars.map((node) => node.props.photo)).toEqual([null]);
    expect(tree.some((node) => node.type === "Image")).toBe(false);
  });
});
