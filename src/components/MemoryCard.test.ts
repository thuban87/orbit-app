import { describe, expect, it, vi } from "vitest";

const { openURL } = vi.hoisted(() => ({
  openURL: vi.fn(() => Promise.resolve()),
}));
vi.mock("react-native", () => ({
  Linking: { openURL },
  Pressable: "Pressable",
  StyleSheet: { create: <T>(styles: T) => styles },
  View: "View",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("./icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("./ui", () => ({ AppText: "AppText", Button: "Button" }));

import type { MemoryRow } from "@/db/memories-read";
import { MemoryCard, openMemoryLink } from "./MemoryCard";

describe("openMemoryLink", () => {
  it("only passes an http/https-normalised URL to the OS", () => {
    openMemoryLink("intent://scan/#Intent;scheme=zxing;end");
    openMemoryLink("javascript://alert(1)");

    expect(openURL).toHaveBeenNthCalledWith(
      1,
      "https://scan/#Intent;scheme=zxing;end",
    );
    expect(openURL).toHaveBeenNthCalledWith(2, "https://alert(1)");
  });
});

describe("MemoryCard disabled (D-26; 38.9 third fix pass WR-02)", () => {
  const memory = {
    id: 5,
    type: "general",
    value: "Trip",
    note: null,
    url: null,
    meaningful_date: null,
    pinned: 0,
    outdated: 0,
    hidden: null,
    allow_ai: 0,
    provenance: "user",
    deleted_at: null,
  } as unknown as MemoryRow;
  type CardElement = { type: unknown; props: Record<string, unknown> };

  it("is a live button by default", () => {
    const onPress = vi.fn();
    const card = MemoryCard({ memory, onPress }) as unknown as CardElement;
    expect(card.type).toBe("Pressable");
    expect(card.props.disabled).toBe(false);
    expect(card.props.accessibilityState).toEqual({ disabled: false });
    expect(card.props.onPress).toBe(onPress);
    expect(card.props.style).toBeNull();
  });

  it("holds the press and draws the Button disabled look when disabled", () => {
    const onPress = vi.fn();
    const card = MemoryCard({
      memory,
      onPress,
      disabled: true,
    }) as unknown as CardElement;
    expect(card.props.disabled).toBe(true);
    expect(card.props.accessibilityState).toEqual({ disabled: true });
    expect(card.props.onPress).toBeUndefined();
    expect(card.props.style).toEqual({ opacity: 0.5 });
  });
});

describe("MemoryCard host props (D-107, D-17, D-84; plan 13)", () => {
  const memory = {
    id: 5,
    type: "general",
    custom_label: null,
    value: "Trip",
    note: null,
    url: null,
    meaningful_date: null,
    pinned: 0,
    outdated: 0,
    hidden: null,
    allow_ai: 0,
    provenance: "user",
    deleted_at: null,
  } as unknown as MemoryRow;
  type Element = { type: unknown; props: Record<string, unknown> };
  function nodes(node: unknown): Element[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    const element = node as Element;
    return [element, ...nodes(element.props.children)];
  }
  const action = (name: string) => ({ nativeEvent: { actionName: name } });
  /** Presses a nested Pressable, failing loudly when it is missing. */
  const press = (element: Element | undefined) => {
    const onPress = element?.props.onPress;
    if (typeof onPress !== "function") throw new Error("missing onPress");
    onPress({ stopPropagation: vi.fn() });
  };

  it("passes the long-press, label, hint and actions to the Pressable", () => {
    const onLongPress = vi.fn();
    const onAccessibilityAction = vi.fn();
    const card = MemoryCard({
      memory,
      onPress: vi.fn(),
      onLongPress,
      accessibilityLabel: "Open the interaction for this Memory entry",
      accessibilityHint: "Long-press or use actions to edit or pin.",
      accessibilityActions: [
        { name: "edit", label: "Edit" },
        { name: "pin", label: "Pin" },
      ],
      onAccessibilityAction,
    }) as unknown as Element;
    expect(card.props.onLongPress).toBe(onLongPress);
    expect(card.props.accessibilityLabel).toBe(
      "Open the interaction for this Memory entry",
    );
    expect(card.props.accessibilityHint).toBe(
      "Long-press or use actions to edit or pin.",
    );
    expect(card.props.accessibilityActions).toEqual([
      { name: "edit", label: "Edit" },
      { name: "pin", label: "Pin" },
    ]);
    (card.props.onAccessibilityAction as (e: unknown) => void)(action("pin"));
    expect(onAccessibilityAction).toHaveBeenCalledWith(action("pin"));
  });

  it("a card without the new props keeps the Edit … memory label and no actions", () => {
    const card = MemoryCard({ memory, onPress: vi.fn() }) as unknown as Element;
    expect(card.props.accessibilityLabel).toBe("Edit Memory memory");
    expect(card.props.accessibilityActions).toBeUndefined();
    expect(card.props.onLongPress).toBeUndefined();
    const tree = nodes(card);
    expect(
      tree.some((n) => n.props.accessibilityLabel === "Show on Profile"),
    ).toBe(false);
    expect(tree.some((n) => n.props.accessibilityLabel === "Move")).toBe(false);
  });

  it("dims a hidden row and offers Show on Profile when the host passes it", () => {
    const onShowOnProfile = vi.fn();
    const card = MemoryCard({
      memory: { ...memory, hidden: 1 },
      onPress: vi.fn(),
      onShowOnProfile,
    }) as unknown as Element;
    const tree = nodes(card);
    const view = tree.find((n) => n.type === "View");
    const opacity = ((view?.props.style ?? []) as { opacity?: number }[])
      .map((style) => style?.opacity)
      .find((value) => value !== undefined);
    expect(opacity).toBe(0.68);
    const button = tree.find(
      (n) =>
        n.type === "Pressable" &&
        n.props.accessibilityLabel === "Show on Profile",
    );
    press(button);
    expect(onShowOnProfile).toHaveBeenCalledTimes(1);
    expect(card.props.accessibilityActions).toEqual([
      { name: "showOnProfile", label: "Show on Profile" },
    ]);
    (card.props.onAccessibilityAction as (e: unknown) => void)(
      action("showOnProfile"),
    );
    expect(onShowOnProfile).toHaveBeenCalledTimes(2);
  });

  it("a shown row is not dimmed and has no Show on Profile", () => {
    const card = MemoryCard({
      memory,
      onPress: vi.fn(),
      onShowOnProfile: vi.fn(),
    }) as unknown as Element;
    const tree = nodes(card);
    expect(
      tree.some((n) => n.props.accessibilityLabel === "Show on Profile"),
    ).toBe(false);
    expect(card.props.accessibilityActions).toBeUndefined();
  });

  it("offers Move, visible and as a screen-reader action, when the host passes it", () => {
    const onMove = vi.fn();
    const card = MemoryCard({
      memory,
      onPress: vi.fn(),
      onMove,
      accessibilityActions: [{ name: "edit", label: "Edit" }],
    }) as unknown as Element;
    const button = nodes(card).find(
      (n) => n.type === "Pressable" && n.props.accessibilityLabel === "Move",
    );
    press(button);
    expect(card.props.accessibilityActions).toEqual([
      { name: "edit", label: "Edit" },
      { name: "move", label: "Move" },
    ]);
    (card.props.onAccessibilityAction as (e: unknown) => void)(action("move"));
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it("shows a link entry's URL with its Open action (D-24)", () => {
    const tree = nodes(
      MemoryCard({ memory: { ...memory, url: "https://example.com/gift" } }),
    );
    expect(
      tree.some((n) => n.props.children === "https://example.com/gift"),
    ).toBe(true);
    expect(
      tree.some((n) => n.props.accessibilityLabel === "Open memory link"),
    ).toBe(true);
  });
});

describe("MemoryCard pencil (D-130)", () => {
  const memory = {
    id: 5,
    type: "gift_idea",
    custom_label: null,
    value: "Kayak",
    note: null,
    url: null,
    meaningful_date: null,
    pinned: 1,
    outdated: 0,
    hidden: null,
    allow_ai: 1,
    provenance: "user",
    deleted_at: null,
  } as unknown as MemoryRow;
  type Element = { type: unknown; props: Record<string, unknown> };
  function nodes(node: unknown): Element[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    const element = node as Element;
    return [element, ...nodes(element.props.children)];
  }
  const pencil = (tree: Element[]) =>
    tree.find((n) => n.type === "Button" && n.props.icon === "edit");

  it("renders an iconOnly pencil after the markers whose press calls onEditPress", () => {
    const onEditPress = vi.fn();
    const tree = nodes(MemoryCard({ memory, onPress: vi.fn(), onEditPress }));
    const button = pencil(tree);
    expect(button?.props.role).toBe("iconOnly");
    expect(button?.props.accessibilityLabel).toBe("Edit Gift Ideas memory");
    expect(button?.props.disabled).toBe(false);
    // After the markers (Pinned, sparkle) in the header.
    const order = tree.map((n) => n.props.accessibilityLabel);
    expect(order.lastIndexOf("Edit Gift Ideas memory")).toBeGreaterThan(
      order.indexOf("Shared with AI"),
    );
    const stopPropagation = vi.fn();
    const onPress = button?.props.onPress;
    if (typeof onPress !== "function") throw new Error("missing onPress");
    onPress({ stopPropagation });
    expect(onEditPress).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalled();
  });

  it("takes the host's label and is held with the card", () => {
    const tree = nodes(
      MemoryCard({
        memory,
        onPress: vi.fn(),
        onEditPress: vi.fn(),
        editAccessibilityLabel: "Edit this gift",
        disabled: true,
      }),
    );
    expect(pencil(tree)?.props.accessibilityLabel).toBe("Edit this gift");
    expect(pencil(tree)?.props.disabled).toBe(true);
  });

  it("has no pencil without onEditPress", () => {
    const tree = nodes(MemoryCard({ memory, onPress: vi.fn() }));
    expect(pencil(tree)).toBeUndefined();
  });
});
