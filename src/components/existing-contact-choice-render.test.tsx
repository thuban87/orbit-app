import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of the import duplicate choices (38.6 D-25 F-1): each
 * existing Orbit contact a user can link to shows its photo (or initials)
 * through `Avatar` beside its name, in Duplicate review's "Choose an existing
 * contact" sheet and Import review's "might already be in Orbit" choices.
 */

vi.mock("react-native", () => ({
  Modal: "Modal",
  Pressable: "Pressable",
  Text: "Text",
  View: "View",
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: {},
    hairlineWidth: 1,
  },
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));

const {
  EXISTING_CONTACT_AVATAR_SIZE,
  ExistingContactChoiceSheet,
  LinkExistingChoiceButton,
} = await import("./ExistingContactChoice");
type CandidateChoice = import("./CandidateCardGrid").CandidateChoice;

const colors = THEME_PRESETS.galaxy.dark;

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

function colorOf(element: TestElement | undefined): unknown {
  const style = element?.props.style;
  const flat = Array.isArray(style)
    ? Object.assign({}, ...(style as object[]))
    : (style as Record<string, unknown> | undefined);
  return (flat as Record<string, unknown> | undefined)?.color;
}

function fillOf(element: TestElement | undefined): Record<string, unknown> {
  const style = element?.props.style;
  return Array.isArray(style)
    ? Object.assign({}, ...(style as object[]))
    : ((style as Record<string, unknown>) ?? {});
}

const CHOICES: CandidateChoice[] = [
  {
    contactId: 4,
    name: "Sam Carter",
    photo: "avatars/contact-4.jpg",
    evidenceHint: "Matching phone number",
  },
  {
    contactId: 9,
    name: "Sam Wilson",
    photo: null,
    evidenceHint: "Similar name",
  },
];

function sheet(
  overrides: Partial<Parameters<typeof ExistingContactChoiceSheet>[0]> = {},
) {
  return nodes(
    ExistingContactChoiceSheet({
      visible: true,
      choices: CHOICES,
      writing: false,
      onChoose: () => {},
      onClose: () => {},
      ...overrides,
    }),
  );
}

describe("EXISTING_CONTACT_AVATAR_SIZE", () => {
  it("matches the Pending confirmations avatar (40)", () => {
    expect(EXISTING_CONTACT_AVATAR_SIZE).toBe(40);
  });
});

describe("ExistingContactChoiceSheet (38.6 D-25 F-1)", () => {
  it("keeps the modal shell: fade, transparent, closes through onClose", () => {
    const onClose = vi.fn();
    const modal = sheet({ onClose }).find((node) => node.type === "Modal");
    expect(modal?.props).toMatchObject({
      visible: true,
      transparent: true,
      animationType: "fade",
    });
    (modal?.props.onRequestClose as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      sheet().some(
        (node) =>
          node.type === "Text" && textOf(node) === "Choose an existing contact",
      ),
    ).toBe(true);
  });

  it("renders one button per choice with the Avatar first, then name and hint", () => {
    const pressables = sheet().filter((node) => node.type === "Pressable");
    expect(pressables).toHaveLength(2);
    const rows = pressables.map((pressable) => {
      const tree = nodes(pressable.props.children as ReactNode);
      const avatar = tree.find((node) => node.type === "Avatar");
      const texts = tree.filter((node) => node.type === "Text").map(textOf);
      const first = (
        Array.isArray(pressable.props.children)
          ? pressable.props.children
          : [pressable.props.children]
      ) as TestElement[];
      return {
        firstChild: first[0]?.type,
        avatar: [
          avatar?.props.photo,
          avatar?.props.name,
          avatar?.props.contactId,
          avatar?.props.size,
        ],
        texts,
        role: pressable.props.accessibilityRole,
        label: pressable.props.accessibilityLabel,
      };
    });
    expect(rows).toEqual([
      {
        firstChild: "Avatar",
        avatar: ["avatars/contact-4.jpg", "Sam Carter", 4, 40],
        texts: ["Sam Carter", "Matching phone number"],
        role: "button",
        label: "Sam Carter, Matching phone number",
      },
      {
        firstChild: "Avatar",
        avatar: [null, "Sam Wilson", 9, 40],
        texts: ["Sam Wilson", "Similar name"],
        role: "button",
        label: "Sam Wilson, Similar name",
      },
    ]);
  });

  it("disables every choice while a write is in flight", () => {
    for (const writing of [false, true]) {
      const pressables = sheet({ writing }).filter(
        (node) => node.type === "Pressable",
      );
      for (const pressable of pressables) {
        expect(pressable.props.disabled).toBe(writing);
        expect(pressable.props.accessibilityState).toEqual({
          disabled: writing,
        });
      }
    }
  });

  it("pressing a choice calls onChoose with that choice", () => {
    const onChoose = vi.fn();
    const pressables = sheet({ onChoose }).filter(
      (node) => node.type === "Pressable",
    );
    (pressables[1]?.props.onPress as () => void)();
    expect(onChoose).toHaveBeenCalledWith(CHOICES[1]);
  });

  it("shows the unavailable line and no Avatar when no choice remains", () => {
    const tree = sheet({ choices: [] });
    expect(tree.some((node) => node.type === "Avatar")).toBe(false);
    expect(tree.some((node) => node.type === "Pressable")).toBe(false);
    expect(
      tree.some(
        (node) =>
          node.type === "Text" &&
          textOf(node) === "This matching contact is no longer available.",
      ),
    ).toBe(true);
  });

  it("does not show the unavailable line while choices remain", () => {
    expect(
      sheet().some(
        (node) =>
          textOf(node) === "This matching contact is no longer available.",
      ),
    ).toBe(false);
  });
});

const IMPORT_CHOICE = {
  contactId: 4,
  name: "Sam Carter",
  photo: "avatars/contact-4.jpg",
};

function button(
  overrides: Partial<Parameters<typeof LinkExistingChoiceButton>[0]> = {},
): TestElement {
  return LinkExistingChoiceButton({
    choice: IMPORT_CHOICE,
    single: true,
    disabled: false,
    onPress: () => {},
    ...overrides,
  }) as TestElement;
}

describe("LinkExistingChoiceButton (38.6 D-25 F-1)", () => {
  it("single: Avatar, then 'Link to Existing' and the name in onAccent on an accent fill", () => {
    const root = button();
    expect(root.type).toBe("Pressable");
    expect(fillOf(root)).toMatchObject({
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    });
    const tree = nodes(root.props.children as ReactNode);
    const avatar = tree.find((node) => node.type === "Avatar");
    expect(avatar?.props).toMatchObject({
      photo: "avatars/contact-4.jpg",
      name: "Sam Carter",
      contactId: 4,
      size: 40,
    });
    const first = (root.props.children as TestElement[])[0];
    expect(first?.type).toBe("Avatar");
    const texts = tree.filter((node) => node.type === "Text");
    expect(texts.map(textOf)).toEqual(["Link to Existing", "Sam Carter"]);
    expect(texts.map(colorOf)).toEqual([colors.onAccent, colors.onAccent]);
    expect(root.props.accessibilityRole).toBe("button");
    expect(root.props.accessibilityLabel).toBe("Link to Existing, Sam Carter");
  });

  it("several: 'Choose this one' and the name on a surface fill", () => {
    const root = button({
      single: false,
      choice: { ...IMPORT_CHOICE, photo: null },
    });
    expect(fillOf(root)).toMatchObject({
      backgroundColor: colors.surface,
      borderColor: colors.border,
    });
    const tree = nodes(root.props.children as ReactNode);
    expect(tree.find((node) => node.type === "Avatar")?.props.photo).toBeNull();
    const texts = tree.filter((node) => node.type === "Text");
    expect(texts.map(textOf)).toEqual(["Choose this one", "Sam Carter"]);
    expect(texts.map(colorOf)).toEqual([
      colors.textPrimary,
      colors.textSecondary,
    ]);
    expect(root.props.accessibilityLabel).toBe("Choose this one, Sam Carter");
  });

  it("is disabled while disabled, and pressing it calls onPress", () => {
    const onPress = vi.fn();
    expect(button({ disabled: true }).props.disabled).toBe(true);
    const root = button({ onPress });
    expect(root.props.disabled).toBe(false);
    (root.props.onPress as () => void)();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
