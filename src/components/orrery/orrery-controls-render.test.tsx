import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { HOME_CAMERA } from "@/logic/orrery-camera-logic";
import { HIDDEN_FOCUS_CARD } from "@/logic/orrery-focus-card-logic";
import type { OrrerySystemState } from "@/stores/orrery-system-store";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { OrreryClusterPanel } from "./OrreryClusterPanel";
import { OrreryContactsSheet } from "./OrreryContactsSheet";
import { OrreryControls } from "./OrreryControls";
import { OrreryFocusContext } from "./OrreryFocusContext";
import {
  HUD_CORNER_ARM,
  HUD_CORNER_INSET,
  HUD_CORNER_OPACITY,
  HUD_CORNER_STROKE,
  ORRERY_HUD_CORNERS_TEST_ID,
} from "./OrreryHudCorners";
import {
  ORRERY_HEADER_OBSTACLE,
  OrreryImmersiveHeader,
} from "./OrreryImmersiveHeader";
import { OrrerySystemSelector } from "./OrrerySystemSelector";
import { OrreryViewOptions } from "./OrreryViewOptions";

const native = vi.hoisted(() => ({
  announce: vi.fn(),
  focus: vi.fn(),
  obstacles: [] as string[],
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  /** Opens the selector / view options panels (their `useState(false)`). */
  open: false,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => {},
  useCallback: (callback: unknown) => callback,
  // RegisteredModal (38.9 D-24) ids its window for the overlay registry.
  useId: () => "test-overlay",
  useState: (value: unknown) => [
    native.open && value === false ? true : value,
    () => {},
  ],
}));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  ScrollView: "ScrollView",
  Pressable: "Pressable",
  Modal: "Modal",
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: {},
    hairlineWidth: 0.5,
  },
  useWindowDimensions: () => ({ width: 400, height: 800, fontScale: 2 }),
  AccessibilityInfo: {
    announceForAccessibility: native.announce,
    setAccessibilityFocus: native.focus,
  },
  findNodeHandle: () => 7,
  // The shared Sheet listens for the soft keyboard (38.4 D-72).
  Keyboard: {
    addListener: () => ({ remove: () => {} }),
    isVisible: () => false,
    metrics: () => undefined,
  },
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
vi.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: vi.fn() }),
}));
vi.mock("@/stores/shell-transient-store", () => ({
  shellTransientStore: Object.assign(
    (selector: (s: { entries: unknown[] }) => unknown) =>
      selector({ entries: [] }),
    { getState: () => ({ entries: [] }) },
  ),
}));
// Every overlay window renders an in-window Snackbar host (38.9 D-40); the
// host reads the overlay registry and snackbar stores through Zustand hooks.
vi.mock("@/stores/overlay-registry-store", async (original) => ({
  ...(await original<typeof import("@/stores/overlay-registry-store")>()),
  overlayRegistryStore: Object.assign(
    (selector: (s: { entries: unknown[] }) => unknown) =>
      selector({ entries: [] }),
    { getState: () => ({ entries: [] }) },
  ),
}));
vi.mock("@/stores/snackbar-store", () => ({
  snackbarStore: (
    selector: (s: { snackbar: null; dismiss: () => void }) => unknown,
  ) => selector({ snackbar: null, dismiss: () => {} }),
}));
// The host also sizes its pill around the FABs on screen (38.10 D-132).
vi.mock("@/stores/shell-obstacle-store", async (original) => ({
  ...(await original<typeof import("@/stores/shell-obstacle-store")>()),
  useShellObstacleStore: Object.assign(
    (selector: (s: { rects: Record<string, unknown> }) => unknown) =>
      selector({ rects: {} }),
    { getState: () => ({ rects: {} }) },
  ),
}));
vi.mock("@/stores/section-fab-store", async (original) => ({
  ...(await original<typeof import("@/stores/section-fab-store")>()),
  useSectionFabStore: (
    selector: (s: {
      owners: ReadonlySet<string>;
      available: ReadonlySet<string>;
    }) => unknown,
  ) => selector({ owners: new Set<string>(), available: new Set<string>() }),
}));
// ...holds its place per message on the focused route (38.10 D-151).
vi.mock("@/stores/focused-route-store", () => ({
  useFocusedRouteStore: (
    selector: (s: { routeName: string | undefined }) => unknown,
  ) => selector({ routeName: undefined }),
}));
// ...and sits above the FAB row, off the tab bar's height (38.10 D-143).
vi.mock("@/stores/tab-bar-layout-store", async (original) => ({
  ...(await original<typeof import("@/stores/tab-bar-layout-store")>()),
  useMeasuredTabBarHeight: () => 0,
  useShownTabBarHeight: () => 0,
}));
vi.mock("@/db/database", () => ({ getExecutor: () => ({}) }));
vi.mock("@/stores/orrery-preferences-store", () => ({
  useOrreryPreferencesStore: () => ({
    hydration: "ready",
    saving: false,
    hydrated: true,
    saveError: null,
    committed: { density: "balanced", satellitesEnabled: 0 },
  }),
}));
vi.mock("expo-blur", () => ({ BlurView: "BlurView" }));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
  useSafeAreaInsets: () => native.insets,
}));
vi.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: "GestureHandlerRootView",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: THEME_PRESETS.galaxy.dark,
    mode: "dark",
    package: "galaxy",
  }),
  // overlay-base resets any glass scope for overlay content (RG-029); Galaxy
  // has no glass override, so the reset is a pass-through here.
  UnscopedTheme: ({ children }: { children?: ReactNode }) => children,
}));
// The Orrery never opts into the art treatment table (38.5-06, D-12): with no
// component the real hook returns null, which this stub reproduces without
// evaluating the hook module's DEV-only `__DEV__` guard under node.
vi.mock("@/theme/use-art-treatment", () => ({ useArtTreatment: () => null }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/OrbitSwitch", () => ({ OrbitSwitch: "OrbitSwitch" }));
vi.mock("@/navigation/use-window-measurement", () => ({
  useWindowObstacle: (key: string) => {
    native.obstacles.push(key);
    return { ref: { current: null }, onLayout: () => {} };
  },
}));
// The shared bar is rendered unchanged; only its placement is under test.
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));

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
  const tree = OrreryControls({
    viewport: { width: 400, height: 700 },
    measured,
    blocked,
    pose: pose as never,
    onContacts,
    onRecenter,
    onResetNorth,
  });
  const nodes = all(resolve(tree));
  return {
    tree,
    nodes,
    onContacts,
    onRecenter,
    onResetNorth,
    pose,
    buttons: nodes.filter((node) => node.type === "Pressable"),
  };
}
describe("actual Orrery controls and detail sheet", () => {
  it("uses three square overlay controls with icon-only 55px targets and a 4px gap", () => {
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
      expect(node.props.style).toMatchObject({ minWidth: 55, minHeight: 55 });
    const group = ui.tree.props.children as ReactElement<{
      children?: ReactNode;
      contentContainerStyle?: unknown;
    }>;
    expect(group.props.contentContainerStyle).toMatchObject({
      gap: 4,
      alignItems: "flex-end",
    });
    const surfaces = Array.isArray(group.props.children)
      ? group.props.children
      : [group.props.children];
    expect(surfaces).toHaveLength(3);
    for (const surface of surfaces) {
      const props = (surface as ReactElement<{ style: unknown[] }>).props;
      expect(props).toMatchObject({ treatment: "orrery-overlay" });
      expect(Object.assign({}, ...props.style)).toMatchObject({
        width: 55,
        height: 55,
      });
    }
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
  it("38.7-16: the controls take touches only on their plate column; the docked focus card stacks above them, and a hidden card sits off-screen", () => {
    const ui = controls();
    const root = ui.nodes[0];
    // The root keeps the full free-column width (the measured obstacle) but
    // takes no touches itself.
    expect(root.props.pointerEvents).toBe("box-none");
    const rootStyle = Object.assign({}, ...[root.props.style].flat());
    expect(rootStyle).toMatchObject({ width: 200, zIndex: 12, elevation: 12 });
    // Only the 55 dp plate column (pinned right) is a touch target.
    const scroll = ui.nodes.find((node) => node.type === "ScrollView");
    if (!scroll) throw new Error("Missing the controls' plate column");
    expect(Object.assign({}, ...[scroll.props.style].flat())).toMatchObject({
      width: 55,
      alignSelf: "flex-end",
    });
    const card = (visible: boolean) =>
      all(
        resolve(
          OrreryFocusContext({
            target: { kind: "member", id: 1, uid: "a" },
            name: "Ada",
            placement: {
              value: visible
                ? {
                    x: 40,
                    y: 500,
                    width: 280,
                    height: 180,
                    maxHeight: 300,
                    visible: true,
                  }
                : HIDDEN_FOCUS_CARD,
            } as never,
            cardHeight: { value: 180 } as never,
            blocked: false,
            onClear: vi.fn(),
            onProfile: vi.fn(),
          }),
        ),
      )[0];
    const shown = card(true);
    expect(shown.type).toBe("AnimatedView");
    const shownStyle = Object.assign({}, ...[shown.props.style].flat());
    // Above the controls (12), below the title (20).
    expect(shownStyle.zIndex).toBeGreaterThan(rootStyle.zIndex);
    expect(shownStyle.elevation).toBeGreaterThan(rootStyle.elevation);
    expect(shownStyle.zIndex).toBeLessThan(20);
    expect(shownStyle).toMatchObject({ opacity: 1, left: 40, top: 500 });
    // Hidden: never left at its last rect on the map (no taps land on it).
    const hiddenStyle = Object.assign({}, ...[card(false).props.style].flat());
    expect(hiddenStyle.opacity).toBe(0);
    expect(hiddenStyle.left).toBeLessThan(-10_000);
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
        retryReload: vi.fn(),
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
            placement: { value: HIDDEN_FOCUS_CARD } as never,
            cardHeight: { value: 180 } as never,
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
  it("satellite focus exposes full identity, relation and dismissal without contact actions", () => {
    const clear = vi.fn(),
      profile = vi.fn();
    const nodes = all(
      resolve(
        OrreryFocusContext({
          target: { kind: "satellite", uid: "r", parentId: 1, parentUid: "p" },
          name: "👩🏽‍🚀 李",
          placement: { value: HIDDEN_FOCUS_CARD } as never,
          cardHeight: { value: 180 } as never,
          blocked: false,
          onClear: clear,
          onProfile: profile,
          relationshipContext: "A key person for Parent",
        }),
      ),
    );
    expect(nodes.map((n) => n.text)).toContain("👩🏽‍🚀 李");
    expect(nodes.map((n) => n.text)).toContain("A key person for Parent");
    expect(
      nodes.some((n) => String(n.props.accessibilityLabel).includes("Profile")),
    ).toBe(false);
    const dismiss = nodes.find(
      (n) => n.props.accessibilityLabel === "Clear focus",
    );
    if (!dismiss) throw new Error("Missing satellite dismissal");
    (dismiss.props.onPress as () => void)();
    expect(clear).toHaveBeenCalledOnce();
    expect(profile).not.toHaveBeenCalled();
  });
  it("companion exposes moons only below matching parent identities, and keeps read failure separate from empty", () => {
    const member = { id: 1, uid: "p", name: "Parent" };
    const row = {
      uid: "r",
      parentId: 1,
      parentUid: "p",
      personName: "月",
      relationType: null,
    };
    const state = {
      status: "ready",
      requested: { id: "builtin:favorites", name: "Favorites" },
      snapshot: {
        contacts: [],
        systemSnapshot: { members: [member], resolvedSunIdentity: member },
      },
    } as unknown as OrrerySystemState;
    const render = (status: "ready" | "error", rows: (typeof row)[]) =>
      all(
        resolve(
          OrreryContactsSheet({
            visible: true,
            state,
            measured: true,
            onClose: vi.fn(),
            onAction: vi.fn(),
            satellites: { status, sceneGeneration: 1, rows },
            onReloadSatellites: vi.fn(),
          }),
        ),
      );
    expect(render("ready", [row]).map((n) => n.text)).toContain(
      "A key person for Parent",
    );
    expect(
      render("ready", [{ ...row, parentUid: "old" }]).map((n) => n.text),
    ).not.toContain("月");
    expect(
      render("ready", []).some(
        (n) => n.props.accessibilityLabel === "Reload satellites",
      ),
    ).toBe(false);
    expect(
      render("error", []).some(
        (n) => n.props.accessibilityLabel === "Reload satellites",
      ),
    ).toBe(true);
    if (!state.snapshot) throw new Error("Missing fixture snapshot");
    state.snapshot.systemSnapshot.members = [];
    expect(render("ready", [row]).map((n) => n.text)).not.toContain("月");
  });
  it("38.7-12 (D-39/M9): the immersive header sits at top 0 of the Orrery root, adds no safe-area inset of its own, hosts the unchanged bar once and is the header obstacle", async () => {
    // A non-zero inset: RootNavigator's SafeAreaView already applies it, so
    // nothing in the header may read or re-apply it (no double inset).
    native.insets = { top: 24, bottom: 0, left: 0, right: 0 };
    native.obstacles = [];
    const { ShellAppBar } = await import("@/components/ShellAppBar");
    const onBarHeight = vi.fn();
    const render = (barHeight: number) =>
      resolve(
        OrreryImmersiveHeader({
          barHeight,
          onBarHeight,
          children: <ShellAppBar variant="root" title="Orrery" />,
        }),
      );
    for (const barHeight of [0, 52]) {
      native.obstacles = [];
      const [root] = render(barHeight);
      const nodes = all([root]);
      expect(root.props.style).toMatchObject({
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
      });
      expect(root.props.pointerEvents).toBe("box-none");
      const flat = (style: unknown): Record<string, unknown>[] =>
        Array.isArray(style)
          ? style.flatMap(flat)
          : style && typeof style === "object"
            ? [style as Record<string, unknown>]
            : [];
      for (const node of nodes)
        for (const style of flat(node.props.style))
          for (const [key, value] of Object.entries(style)) {
            expect(key).not.toMatch(/^(padding|margin)/);
            if (key === "top") expect(value).toBe(0);
          }
      const bars = nodes.filter((node) => node.type === "ShellAppBar");
      expect(bars).toHaveLength(1);
      expect(bars[0].props).toEqual({ variant: "root", title: "Orrery" });
      // Wrapped in the header obstacle (OrreryObstacle's measured view).
      expect(native.obstacles).toEqual([ORRERY_HEADER_OBSTACLE]);
      const obstacle = nodes.find(
        (node) =>
          node.props.collapsable === false &&
          all(node.children).some((child) => child.type === "ShellAppBar"),
      );
      expect(obstacle).toBeDefined();
      // The scrim is decorative: not touchable, hidden from accessibility.
      const scrim = root.children[0];
      expect(scrim.props).toMatchObject({
        pointerEvents: "none",
        importantForAccessibility: "no-hide-descendants",
        accessibilityElementsHidden: true,
      });
      expect(scrim.children.length).toBe(barHeight > 0 ? 26 : 0);
      // The bar's bottom hairline is clipped once it is measured.
      expect(obstacle?.props.style).toEqual(
        barHeight > 0 ? [{ overflow: "hidden" }, { height: 51.5 }] : undefined,
      );
    }
    expect(ORRERY_HEADER_OBSTACLE).toBe("orrery-immersive-header");
    native.insets = { top: 0, bottom: 0, left: 0, right: 0 };
  });
  it("38.7-12 (D-22): every Orrery HUD panel and button carries Lab B's four instrument corner brackets, decorative and hidden from accessibility, with every accessible name unchanged", () => {
    const corners = (nodes: Node[]) =>
      nodes.filter((node) => node.props.testID === ORRERY_HUD_CORNERS_TEST_ID);
    const labels = (nodes: Node[]) =>
      nodes
        .map((node) => node.props.accessibilityLabel)
        .filter((label) => label !== undefined);
    const expectBrackets = (nodes: Node[], count: number) => {
      const found = corners(nodes);
      expect(found).toHaveLength(count);
      for (const chrome of found) {
        expect(chrome.props).toMatchObject({
          pointerEvents: "none",
          accessible: false,
          importantForAccessibility: "no-hide-descendants",
          accessibilityElementsHidden: true,
        });
        expect(chrome.props.style).toMatchObject({
          opacity: HUD_CORNER_OPACITY,
        });
        expect(chrome.children).toHaveLength(4);
        const inner = all(chrome.children);
        // No text, no label, nothing touchable.
        expect(inner.every((node) => node.type === "View")).toBe(true);
        expect(labels(inner)).toEqual([]);
        for (const bracket of chrome.children) {
          const style = Object.assign(
            {},
            ...(bracket.props.style as object[]),
          ) as Record<string, unknown>;
          expect(style).toMatchObject({
            width: HUD_CORNER_ARM,
            height: HUD_CORNER_ARM,
            borderColor: THEME_PRESETS.galaxy.dark.orreryInstrument,
          });
          // Two edges per bracket, at Lab B's inset and stroke.
          const edges = Object.entries(style).filter(([k]) =>
            /^border(Top|Bottom|Left|Right)Width$/.test(k),
          );
          expect(edges.map(([, v]) => v)).toEqual([
            HUD_CORNER_STROKE,
            HUD_CORNER_STROKE,
          ]);
          const offsets = ["top", "bottom", "left", "right"]
            .map((k) => style[k])
            .filter((v) => v !== undefined);
          expect(offsets).toEqual([HUD_CORNER_INSET, HUD_CORNER_INSET]);
        }
      }
    };
    // Camera controls: one bracket set per button.
    const ui = controls();
    expectBrackets(ui.nodes, 3);
    expect(labels(ui.nodes)).toEqual([
      "Contacts in this System",
      "Recenter Orrery",
      "Reset north",
    ]);
    // Cluster panel.
    const target = { kind: "contact-sun" as const, id: 3, uid: "sun" };
    const cluster = all(
      resolve(
        OrreryClusterPanel({
          targets: [target],
          scene: {
            systemSnapshot: { members: [] },
            sun: { sunContactName: "Outside sun" },
          } as never,
          viewport: { width: 400, height: 700 },
          stale: false,
          blocked: false,
          onClose: vi.fn(),
          onAction: vi.fn(),
          onReload: vi.fn(),
        }),
      ),
    );
    expectBrackets(cluster, 1);
    expect(labels(cluster)).toEqual([
      "Close contact group",
      "Focus in Orrery: Outside sun",
      "Open Profile: Outside sun",
    ]);
    // Focus card.
    const card = all(
      resolve(
        OrreryFocusContext({
          target: { kind: "member", id: 1, uid: "a" },
          name: "Ada",
          placement: { value: HIDDEN_FOCUS_CARD } as never,
          cardHeight: { value: 180 } as never,
          blocked: false,
          onClear: vi.fn(),
          onProfile: vi.fn(),
        }),
      ),
    );
    expectBrackets(card, 1);
    expect(labels(card)).toEqual(["Clear focus", "Open Profile: Ada"]);
    // System selector and view options: trigger closed, then trigger + panel.
    const selector = () =>
      all(
        resolve(
          OrrerySystemSelector({
            state: {
              status: "ready",
              requested: { id: "builtin:all-contacts", name: "All Contacts" },
              select: vi.fn(),
              reload: vi.fn(),
            } as unknown as OrrerySystemState,
            availableHeight: 700,
            enabled: true,
            catalog: [],
            counts: new Map(),
            needsAttention: new Map(),
            onOpenChange: vi.fn(),
          }),
        ),
      );
    const options = () =>
      all(resolve(OrreryViewOptions({ availableHeight: 700 })));
    native.open = false;
    const closedSelector = selector();
    const closedOptions = options();
    expectBrackets(closedSelector, 1);
    expectBrackets(closedOptions, 1);
    native.open = true;
    try {
      const openSelector = selector();
      const openOptions = options();
      expectBrackets(openSelector, 2);
      expectBrackets(openOptions, 2);
      expect(labels(openSelector)).toContain("Choose System");
      expect(labels(openOptions)).toContain("Close view options");
    } finally {
      native.open = false;
    }
    expect(labels(closedSelector)).toEqual([
      "Choose System. Current System: All Contacts",
    ]);
    expect(labels(closedOptions)).toEqual(["View options"]);
  });
});
