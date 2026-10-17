import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Review matches' per-person sheet (38.12 D-107, D-52) and Import review's
 * link choice (38.6 D-25 F-1).
 *
 * `MatchChoiceSheet` replaced Duplicate review's centred "Choose an existing
 * contact" modal: a bottom sheet titled with the incoming person, the
 * candidate Orbit contacts as single-choice rows (Avatar, name, evidence),
 * then Link (enabled once a candidate is picked), Import as new, Skip and
 * Cancel. It renders through a STATEFUL hook store (state persists across
 * renders, a setter updates its slot, `render()` re-runs the component), so a
 * pick then Link behaves as on device.
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
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  Sheet: "Sheet",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));

const { EXISTING_CONTACT_AVATAR_SIZE, LinkExistingChoiceButton } = await import(
  "./ExistingContactChoice"
);
const { MATCH_CHOICE_EMPTY_COPY, MatchChoiceSheet } = await import(
  "./MatchChoiceSheet"
);
type CandidateChoice = import("./CandidateCardGrid").CandidateChoice;
type MatchChoiceSheetProps = import("./MatchChoiceSheet").MatchChoiceSheetProps;

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

let props: MatchChoiceSheetProps;

function render(overrides: Partial<MatchChoiceSheetProps> = {}) {
  props = { ...props, ...overrides };
  hooks.stateIndex = 0;
  return nodes(MatchChoiceSheet(props));
}

function radios(tree: TestElement[]) {
  return tree.filter(
    (node) =>
      node.type === "Pressable" && node.props.accessibilityRole === "radio",
  );
}

function buttonIn(tree: TestElement[], label: string): TestElement {
  const found = tree.find(
    (node) => node.type === "Button" && node.props.label === label,
  );
  if (!found) throw new Error(`no ${label} button`);
  return found;
}

function press(node: TestElement) {
  (node.props.onPress as () => void)();
}

beforeEach(() => {
  hooks.states = [];
  hooks.setters = [];
  props = {
    visible: true,
    entryKey: 31,
    personName: "Ann Lee",
    choices: CHOICES,
    writing: false,
    onLink: vi.fn(),
    onImportNew: vi.fn(),
    onSkip: vi.fn(),
    onClose: vi.fn(),
  };
});

describe("EXISTING_CONTACT_AVATAR_SIZE", () => {
  it("matches the Pending confirmations avatar (40)", () => {
    expect(EXISTING_CONTACT_AVATAR_SIZE).toBe(40);
  });
});

describe("MatchChoiceSheet (38.12 D-107)", () => {
  it("is a bottom Sheet (not a centred modal) titled with the incoming person", () => {
    const tree = render();
    const sheet = tree.find((node) => node.type === "Sheet");
    expect(sheet?.props.visible).toBe(true);
    expect(tree.some((node) => node.type === "Modal")).toBe(false);
    const heading = tree.find(
      (node) => node.type === "AppText" && node.props.role === "heading",
    );
    expect(textOf(heading)).toBe("Ann Lee");
  });

  it("lists every candidate as a radio row: Avatar, name, evidence; label = name + evidence", () => {
    const rows = radios(render()).map((row) => {
      const tree = nodes(row.props.children as ReactNode);
      const avatar = tree.find((node) => node.type === "Avatar");
      return {
        avatar: [
          avatar?.props.photo,
          avatar?.props.name,
          avatar?.props.contactId,
          avatar?.props.size,
        ],
        texts: tree.filter((node) => node.type === "AppText").map(textOf),
        label: row.props.accessibilityLabel,
        checked: (row.props.accessibilityState as { checked: boolean }).checked,
      };
    });
    expect(rows).toEqual([
      {
        avatar: ["avatars/contact-4.jpg", "Sam Carter", 4, 40],
        texts: ["Sam Carter", "Matching phone number"],
        label: "Sam Carter, Matching phone number",
        checked: false,
      },
      {
        avatar: [null, "Sam Wilson", 9, 40],
        texts: ["Sam Wilson", "Similar name"],
        label: "Sam Wilson, Similar name",
        checked: false,
      },
    ]);
  });

  it("Link is disabled until a candidate is picked, then links that candidate", () => {
    let tree = render();
    expect(buttonIn(tree, "Link").props.disabled).toBe(true);
    press(radios(tree)[1] as TestElement);
    tree = render();
    expect(
      (
        (radios(tree)[1] as TestElement).props.accessibilityState as {
          checked: boolean;
        }
      ).checked,
    ).toBe(true);
    const link = buttonIn(tree, "Link");
    expect(link.props.disabled).toBe(false);
    press(link);
    expect(props.onLink).toHaveBeenCalledWith(CHOICES[1]);
  });

  it("a pick never carries over to the next queued person", () => {
    press(radios(render())[0] as TestElement);
    expect(buttonIn(render(), "Link").props.disabled).toBe(false);
    const tree = render({ entryKey: 32, personName: "Bo Ray" });
    expect(buttonIn(tree, "Link").props.disabled).toBe(true);
    expect(
      radios(tree).every(
        (row) =>
          !(row.props.accessibilityState as { checked: boolean }).checked,
      ),
    ).toBe(true);
  });

  it("Import as new, Skip and Cancel call their handlers; scrim/Back is onClose", () => {
    const tree = render();
    press(buttonIn(tree, "Import as new"));
    press(buttonIn(tree, "Skip"));
    press(buttonIn(tree, "Cancel"));
    expect(props.onImportNew).toHaveBeenCalledTimes(1);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    const sheet = tree.find((node) => node.type === "Sheet") as TestElement;
    (sheet.props.onRequestClose as () => void)();
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("holds every control while a write is in flight (T-38.12-20)", () => {
    press(radios(render())[0] as TestElement);
    const tree = render({ writing: true });
    for (const label of ["Link", "Import as new", "Skip", "Cancel"]) {
      expect(buttonIn(tree, label).props.disabled, label).toBe(true);
    }
    for (const row of radios(tree)) {
      expect(row.props.disabled).toBe(true);
    }
  });

  it("with no candidate left it says so and offers no radio", () => {
    const tree = render({ choices: [] });
    expect(radios(tree)).toHaveLength(0);
    expect(tree.some((node) => textOf(node) === MATCH_CHOICE_EMPTY_COPY)).toBe(
      true,
    );
    expect(buttonIn(tree, "Link").props.disabled).toBe(true);
    expect(buttonIn(tree, "Import as new").props.disabled).toBe(false);
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
