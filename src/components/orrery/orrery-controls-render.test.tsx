import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { HOME_CAMERA } from "@/logic/orrery-camera-logic";
import type { OrrerySystemState } from "@/stores/orrery-system-store";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { OrreryClusterPanel } from "./OrreryClusterPanel";
import { OrreryContactsSheet } from "./OrreryContactsSheet";
import { OrreryControls } from "./OrreryControls";
import { OrreryFocusContext } from "./OrreryFocusContext";

const native = vi.hoisted(() => ({ announce: vi.fn(), focus: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useEffect: () => {},
  useState: (value: unknown) => [value, () => {}],
}));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  ScrollView: "ScrollView",
  Pressable: "Pressable",
  Modal: "Modal",
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 400, height: 800, fontScale: 2 }),
  AccessibilityInfo: {
    announceForAccessibility: native.announce,
    setAccessibilityFocus: native.focus,
  },
  findNodeHandle: () => 7,
}));
vi.mock("react-native-reanimated", () => ({
  default: {
    View: "AnimatedView",
    ScrollView: "ScrollView",
    createAnimatedComponent: (component: unknown) => component,
  },
  useAnimatedStyle: (fn: () => unknown) => fn(),
  useAnimatedProps: (fn: () => unknown) => ({
    get value() {
      return fn();
    },
  }),
}));
vi.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
vi.mock("expo-blur", () => ({ BlurView: "BlurView" }));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: THEME_PRESETS.galaxy.dark,
    mode: "dark",
    package: "galaxy",
  }),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/navigation/use-window-measurement", () => ({
  useWindowObstacle: () => ({ ref: { current: null }, onLayout: () => {} }),
}));

interface Node {
  type: string;
  props: Record<string, unknown>;
  text: string;
  children: Node[];
}
function resolve(node: ReactNode): Node[] {
  if (typeof node === "string")
    return [{ type: "literal", props: {}, text: node, children: [] }];
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function")
    return resolve((element.type as (p: unknown) => ReactNode)(element.props));
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
function all(nodes: Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}
function controls(measured = true, blocked = false) {
  const onContacts = vi.fn(),
    onRecenter = vi.fn(),
    onResetNorth = vi.fn();
  const pose = { value: { ...HOME_CAMERA, yaw: Math.PI / 2 } };
  const nodes = all(
    resolve(
      OrreryControls({
        viewport: { width: 400, height: 700 },
        measured,
        blocked,
        pose: pose as never,
        onContacts,
        onRecenter,
        onResetNorth,
      }),
    ),
  );
  return {
    nodes,
    onContacts,
    onRecenter,
    onResetNorth,
    pose,
    buttons: nodes.filter((node) => node.type === "Pressable"),
  };
}
describe("actual Orrery controls and detail sheet", () => {
  it("keeps full labels, minimum targets and 8 gap with Contacts above Recenter, no save spinner", () => {
    const ui = controls(false);
    expect(ui.buttons.map((node) => node.props.accessibilityLabel)).toEqual([
      "Contacts in this System",
      "Recenter Orrery",
      "Reset north",
    ]);
    expect(ui.buttons.map((node) => node.props.disabled)).toEqual([
      false,
      true,
      true,
    ]);
    for (const node of ui.buttons)
      expect(node.props.style).toMatchObject({ minWidth: 44, minHeight: 44 });
    expect(
      ui.nodes.find((node) => node.type === "ScrollView")?.props
        .contentContainerStyle,
    ).toMatchObject({ gap: 8 });
    for (const node of ui.nodes.filter((node) => node.type === "Text")) {
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.allowFontScaling).toBeUndefined();
    }
    (ui.buttons[0].props.onPress as () => void)();
    expect(ui.onContacts).toHaveBeenCalledOnce();
    ui.onContacts.mock.calls[0][0]();
    expect(native.focus).toHaveBeenCalledWith(7);
  });
  it("reports current yaw through live accessible value and exposes independent action callbacks", () => {
    const ui = controls();
    (ui.buttons[1].props.onPress as () => void)();
    (ui.buttons[2].props.onPress as () => void)();
    expect(ui.onRecenter).toHaveBeenCalledOnce();
    expect(ui.onResetNorth).toHaveBeenCalledOnce();
    ui.pose.value.yaw = Math.PI;
    expect(
      (ui.buttons[2].props.animatedProps as { value: unknown }).value,
    ).toEqual({ accessibilityValue: { text: "180 degrees from north" } });
    const hidden = controls(true, true);
    expect(hidden.nodes[0].props.pointerEvents).toBe("none");
    expect(hidden.nodes[0].props.importantForAccessibility).toBe(
      "no-hide-descendants",
    );
    expect(hidden.buttons.every((node) => node.props.disabled === true)).toBe(
      true,
    );
  });
  it.each(["initial", "loading", "error", "stale", "ready"] as const)(
    "opens the real detail modal for shared %s state with truthful copy",
    (status) => {
      const state = {
        status,
        requested: { id: "builtin:all-contacts", name: "All Contacts" },
        snapshot:
          status === "ready"
            ? {
                contacts: [],
                systemSnapshot: { members: [], resolvedSunIdentity: null },
              }
            : null,
        reload: vi.fn(),
      } as unknown as OrrerySystemState;
      const close = vi.fn();
      const nodes = all(
        resolve(
          OrreryContactsSheet({
            visible: true,
            state,
            measured: true,
            onClose: close,
            onAction: vi.fn(),
          }),
        ),
      );
      expect(nodes.find((node) => node.type === "Modal")?.props).toMatchObject({
        visible: true,
        transparent: true,
      });
      const text = nodes.map((node) => node.text).join(" ");
      expect(text).toContain("Contacts in this System");
      const expected =
        status === "initial" || status === "loading"
          ? "Loading contacts…"
          : status === "error"
            ? "Couldn't load this System. Try loading it again."
            : status === "stale"
              ? "Couldn't refresh this System. Showing the last loaded contacts."
              : "No contacts in your Orrery yet";
      expect(text).toContain(expected);
      const closeButton = nodes.find(
        (node) => node.props.accessibilityLabel === "Close contact list",
      );
      if (!closeButton) throw new Error("Missing close contact list action");
      (closeButton.props.onPress as () => void)();
      expect(close).toHaveBeenCalledOnce();
    },
  );
  it("renders qualifying sun identity once in shared order and dispatches distinct full-name member actions", () => {
    const name = "👩🏽‍🚀 é 東京 ".repeat(20);
    const state = {
      status: "ready",
      requested: { id: "builtin:favorites", name: "Favorites" },
      snapshot: {
        contacts: [{ id: 2 }],
        systemSnapshot: {
          members: [
            { id: 3, uid: "sun", name },
            { id: 2, uid: "other", name: "Other" },
          ],
          resolvedSunIdentity: { id: 3 },
        },
      },
    } as unknown as OrrerySystemState;
    const action = vi.fn();
    const nodes = all(
      resolve(
        OrreryContactsSheet({
          visible: true,
          state,
          measured: true,
          onClose: vi.fn(),
          onAction: action,
        }),
      ),
    );
    expect(nodes.filter((node) => node.text === name)).toHaveLength(1);
    expect(
      nodes
        .filter((node) => node.type === "Avatar")
        .map((node) => node.props.contactId),
    ).toEqual(["sun", "other"]);
    const buttons = nodes.filter((node) =>
      String(node.props.accessibilityLabel).startsWith("Open Profile:"),
    );
    expect(buttons.map((node) => node.props.accessibilityLabel)).toEqual([
      `Open Profile: ${name}`,
      "Open Profile: Other",
    ]);
    (buttons[0].props.onPress as () => void)();
    const focusButton = nodes.find(
      (node) => node.props.accessibilityLabel === `Focus in Orrery: ${name}`,
    );
    if (!focusButton) throw new Error("Missing Focus in Orrery action");
    (focusButton.props.onPress as () => void)();
    expect(action.mock.calls).toEqual([
      ["profile", 3],
      ["focus", 3],
    ]);
  });
  it("renders a nonmodal group with wrapping identity, bounded scroll and independent focus/Profile actions", () => {
    const target = { kind: "contact-sun" as const, id: 3, uid: "sun" };
    const action = vi.fn();
    const close = vi.fn();
    const scene = {
      systemSnapshot: { members: [] },
      sun: { sunContactName: "Outside sun" },
    } as never;
    const nodes = all(
      resolve(
        OrreryClusterPanel({
          targets: [target],
          scene,
          viewport: { width: 400, height: 700 },
          stale: true,
          blocked: false,
          onClose: close,
          onAction: action,
          onReload: vi.fn(),
        }),
      ),
    );
    expect(nodes.some((node) => node.type === "Modal")).toBe(false);
    expect(nodes.map((node) => node.text).join(" ")).toContain("1 contact");
    expect(
      nodes.find((node) => node.type === "ScrollView")?.props.style,
    ).toEqual({ maxHeight: 280 });
    const profile = nodes.find(
      (node) => node.props.accessibilityLabel === "Open Profile: Outside sun",
    );
    if (!profile) throw new Error("Missing group Profile action");
    (profile.props.onPress as () => void)();
    expect(action).toHaveBeenCalledWith("profile", target);
    expect(nodes[0].props.pointerEvents).toBe("auto");
  });
  it("keeps focused identity and dismissal available while optional context loads or fails", () => {
    for (const contextState of ["loading", "error"] as const) {
      const nodes = all(
        resolve(
          OrreryFocusContext({
            target: { kind: "member", id: 1, uid: "a" },
            name: "Full identity",
            frame: { value: null } as never,
            blocked: false,
            onClear: vi.fn(),
            onProfile: vi.fn(),
            contextState,
            onReloadContext: vi.fn(),
          }),
        ),
      );
      expect(nodes.map((node) => node.text)).toContain("Full identity");
      expect(
        nodes.some((node) => node.props.accessibilityLabel === "Clear focus"),
      ).toBe(true);
      expect(
        nodes.some(
          (node) =>
            node.props.accessibilityLabel === "Open Profile: Full identity",
        ),
      ).toBe(true);
      expect(
        nodes.some(
          (node) => node.props.accessibilityLabel === "Reload satellites",
        ),
      ).toBe(contextState === "error");
    }
  });
});
