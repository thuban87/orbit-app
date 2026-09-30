import { readFileSync } from "node:fs";
import { join } from "node:path";
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
const PhotoChoiceModule = await import("./PhotoChoice");
const { PhotoChoice } = PhotoChoiceModule;
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

const KEEP_TEXT = "No meaningful change — keep Orbit photo";
const SOURCE_OPTION: PhotoChoiceOption = {
  id: "source",
  uri: "file:///docs/reconcile-contact-3-link-9.jpg",
  name: "Contacts photo",
  provenance: "Ada (phone)",
};

function textOf(element: TestElement | undefined): string {
  const children = element?.props.children;
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.join("");
  return "";
}

function keepPressable(tree: TestElement[]): TestElement | undefined {
  return tree.find(
    (node) =>
      node.type === "Pressable" &&
      nodes(node.props.children as ReactNode).some(
        (kid) => kid.type === "Text" && textOf(kid) === KEEP_TEXT,
      ),
  );
}

describe("PhotoChoice keep-Orbit photo card (38.6 D-25 F-3)", () => {
  const { KEEP_ORBIT_PHOTO } = PhotoChoiceModule;

  function render(
    keepPhoto:
      | { photo: string | null; name: string; contactId?: number | string }
      | undefined,
    overrides: { selectedId?: string; onChange?: (value: string) => void } = {},
  ) {
    return PhotoChoice({
      label: "Photo",
      options: [SOURCE_OPTION],
      mode: "conflict",
      selectedId: overrides.selectedId,
      onChange: overrides.onChange ?? (() => {}),
      keepPhoto,
    }) as TestElement;
  }

  it("renders the keep option as a 124-wide card after the source cards, inside the ScrollView", () => {
    const root = render({
      photo: "avatars/contact-3.jpg",
      name: "Ada",
      contactId: 3,
    });
    const tree = nodes(root);
    const scroll = tree.find((node) => node.type === "ScrollView");
    const scrollTree = nodes(scroll?.props.children as ReactNode);
    const keep = keepPressable(scrollTree);
    expect(keep).toBeDefined();
    const cards = scrollTree.filter((node) => node.type === "Pressable");
    expect(cards.at(-1)).toBe(keep);
    const style = Object.assign(
      {},
      ...((keep as TestElement).props.style as object[]),
    );
    expect(style).toMatchObject({ width: 124 });
    // No full-width keep row below the ScrollView.
    expect(tree.filter((node) => keepPressable([node])).length).toBe(1);
    const rootKids = (root.props.children as TestElement[]).filter(Boolean);
    expect(rootKids.at(-1)?.type).toBe("ScrollView");
  });

  it("shows the Orbit photo through Avatar 96, then the text", () => {
    const keep = keepPressable(
      nodes(
        render({ photo: "avatars/contact-3.jpg", name: "Ada", contactId: 3 }),
      ),
    );
    const kids = nodes(keep?.props.children as ReactNode);
    const avatar = kids.find((node) => node.type === "Avatar");
    expect(avatar?.props).toEqual({
      photo: "avatars/contact-3.jpg",
      name: "Ada",
      contactId: 3,
      size: 96,
    });
    expect(kids.map((node) => node.type)).toEqual(["Avatar", "Text"]);
    const text = kids.find((node) => node.type === "Text");
    expect(text?.props.numberOfLines).toBe(3);
    expect(keep?.props.accessibilityRole).toBe("radio");
    expect(keep?.props.accessibilityLabel).toBe(`Photo: ${KEEP_TEXT}`);
  });

  it("shows initials when the contact has no Orbit photo", () => {
    const keep = keepPressable(
      nodes(render({ photo: null, name: "Ada", contactId: 3 })),
    );
    const avatar = nodes(keep?.props.children as ReactNode).find(
      (node) => node.type === "Avatar",
    );
    expect(avatar?.props.photo).toBeNull();
  });

  it("shows the ✓ on the keep card when it is selected", () => {
    const keep = keepPressable(
      nodes(
        render(
          { photo: null, name: "Ada", contactId: 3 },
          { selectedId: KEEP_ORBIT_PHOTO },
        ),
      ),
    );
    const texts = nodes(keep?.props.children as ReactNode).filter(
      (node) => node.type === "Text",
    );
    expect(texts.map(textOf)).toEqual([KEEP_TEXT, "✓"]);
    expect(keep?.props.accessibilityState).toEqual({ selected: true });
  });

  it("pressing the keep card calls onChange(KEEP_ORBIT_PHOTO)", () => {
    const onChange = vi.fn();
    const keep = keepPressable(
      nodes(render({ photo: null, name: "Ada", contactId: 3 }, { onChange })),
    ) as TestElement;
    (keep.props.onPress as () => void)();
    expect(onChange).toHaveBeenCalledWith(KEEP_ORBIT_PHOTO);
  });

  it("without keepPhoto keeps today's full-width keep row below the ScrollView, with no Avatar", () => {
    const root = render(undefined);
    const rootKids = (root.props.children as TestElement[]).filter(Boolean);
    const row = rootKids.at(-1);
    expect(row?.type).toBe("Pressable");
    expect(keepPressable([row as TestElement])).toBe(row);
    const scroll = rootKids.find((node) => node.type === "ScrollView");
    expect(
      keepPressable(nodes(scroll?.props.children as ReactNode)),
    ).toBeUndefined();
    const style = Object.assign(
      {},
      ...((row as TestElement).props.style as object[]),
    );
    expect(style).toMatchObject({ flexDirection: "row", minHeight: 44 });
    expect(style.width).toBeUndefined();
    expect(row?.props).not.toHaveProperty("accessibilityLabel");
    const kids = nodes(row?.props.children as ReactNode);
    expect(kids.some((node) => node.type === "Avatar")).toBe(false);
    const text = kids.find((node) => node.type === "Text");
    expect(text?.props).not.toHaveProperty("numberOfLines");
  });
});

describe("Update from Contacts passes the Orbit photo to the keep card (D-25 F-3)", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  it("ReconcileDetailScreen threads contact.photo through ScanState to keepPhoto", () => {
    const screen = read("src/screens/ReconcileDetailScreen.tsx");
    expect(screen).toMatch(/orbitPhoto: string \| null;/);
    expect(screen).toContain("orbitPhoto: contact.photo,");
    expect(screen.replace(/\s+/g, " ")).toContain(
      "keepPhoto={{ photo: scan.orbitPhoto, name: scan.contactName, contactId, }}",
    );
  });

  it("MergeConflictsScreen's photo choice stays unchanged (no keep card)", () => {
    expect(read("src/screens/MergeConflictsScreen.tsx")).not.toContain(
      "keepPhoto",
    );
  });
});
