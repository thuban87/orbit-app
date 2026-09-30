// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
/**
 * ProfileHero render contract (38.6 D-03/D-04/D-15/D-17): the photo is
 * PROFILE_HERO_AVATAR_SIZE and opens the lightbox only when the contact has
 * one; the favourite star left the hero for the app bar (no utility row).
 */
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileIdentity } from "@/db/profile-read";
import {
  PROFILE_HERO_AVATAR_SIZE,
  PROFILE_HERO_GAP,
} from "@/screens/contact-profile-logic";
import { ProfileHero } from "./ProfileHero";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  View: "View",
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));

interface Node {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: readonly Node[];
}

function resolve(node: ReactNode): Node[] {
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
      children: resolve(element.props.children),
    },
  ];
}

function all(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

const identity: ProfileIdentity = {
  id: 7,
  name: "Alex",
  categoryName: null,
  photo: "avatars/contact-7.jpg",
  favouriteRank: null,
  archivedAt: null,
  trackingEnabled: 1,
  intervalDays: 30,
  rarelyResponds: 0,
  snoozeUntil: null,
};

const onOpenPhoto = vi.fn();

function render(overrides: Partial<ProfileIdentity> = {}) {
  return all(
    resolve(
      ProfileHero({
        identity: { ...identity, ...overrides },
        actionableMethods: { phone: null, email: null },
        messageContext: { archived: false, settingsHosted: false },
        onOpenPhoto,
        onMessage: () => {},
        onCall: () => {},
      }),
    ),
  );
}

beforeEach(() => onOpenPhoto.mockReset());

describe("ProfileHero layout (38.6 D-04/D-17)", () => {
  it("renders the photo at PROFILE_HERO_AVATAR_SIZE with the hero gap", () => {
    const nodes = render();
    expect(nodes.find((node) => node.type === "Avatar")?.props.size).toBe(
      PROFILE_HERO_AVATAR_SIZE,
    );
    const root = nodes.find((node) => node.props.testID === "profile-hero");
    const style = root?.props.style as { gap?: number } | undefined;
    expect(style?.gap).toBe(PROFILE_HERO_GAP);
  });

  it("has no favourite control and no utility row", () => {
    const nodes = render();
    expect(
      nodes.some((node) =>
        /Favorites$/.test(String(node.props.accessibilityLabel ?? "")),
      ),
    ).toBe(false);
    expect(
      nodes.some(
        (node) => node.type === "Icon" && node.props.name === "favorite",
      ),
    ).toBe(false);
    // The photo (or its opener) is the hero's first child.
    const root = nodes.find((node) => node.props.testID === "profile-hero");
    expect(root?.children[0]?.type).toBe("Pressable");
    expect(root?.children[0]?.children[0]?.type).toBe("Avatar");
  });
});

describe("ProfileHero photo entry", () => {
  it("wraps the photo in a button that opens the lightbox", () => {
    const opener = render().find(
      (node) => node.props.accessibilityLabel === "View photo of Alex",
    );
    expect(opener?.type).toBe("Pressable");
    expect(opener?.props.accessibilityRole).toBe("button");
    expect(opener?.children.map((child) => child.type)).toEqual(["Avatar"]);
    const press = opener?.props.onPress as () => void;
    press();
    expect(onOpenPhoto).toHaveBeenCalledTimes(1);
  });

  it("renders the initials avatar with no lightbox entry when there is no photo", () => {
    const nodes = render({ photo: null });
    expect(
      nodes.some((node) =>
        String(node.props.accessibilityLabel ?? "").startsWith("View photo"),
      ),
    ).toBe(false);
    const avatar = nodes.find((node) => node.type === "Avatar");
    expect(avatar?.props.photo).toBe(null);
  });
});
