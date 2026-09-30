/**
 * Profile app bar render contract (38.6 D-17): back, then the favourite star,
 * then ⋮; the bar overlays the scroll content and passes touches through its
 * empty area, and its scroll scrim never swallows a touch.
 *
 * The screen module is imported with every data/service dependency stubbed —
 * only the exported `ProfileAppBar` is rendered, shallowly.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  AppState: { currentState: "active" },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: { position: "absolute" },
    hairlineWidth: 1,
  },
  View: "View",
}));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: () => {} }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/BackgroundHost", () => ({}));
vi.mock("@/components/ui/Sheet", () => ({}));
vi.mock("@/components/FrequencyPicker", () => ({}));
vi.mock("@/components/PhotoLightbox", () => ({}));
vi.mock("@/components/ReachOutRouter", () => ({}));
vi.mock("@/components/profile/ProfileBackgroundManager", () => ({}));
vi.mock("@/components/profile/ProfileHero", () => ({}));
vi.mock("@/components/profile/ProfileLayoutEditor", () => ({}));
vi.mock("@/components/profile/ProfileModuleHost", () => ({}));
vi.mock("@/components/profile/ProfileTemplateManager", () => ({}));
vi.mock("@/db/app-settings-dao", () => ({}));
vi.mock("@/db/contacts-dao", () => ({}));
vi.mock("@/db/database", () => ({}));
vi.mock("@/db/favourites-dao", () => ({}));
vi.mock("@/db/interaction-assist-read", () => ({}));
vi.mock("@/db/profile-presentation-dao", () => ({}));
vi.mock("@/db/profile-read", () => ({}));
vi.mock("@/db/profile-relationship-actions", () => ({}));
vi.mock("@/navigation/use-bottom-clearance", () => ({}));
vi.mock("@/profile/resolve-presentation", () => ({}));
vi.mock("@/services/contact-lifecycle-effects", () => ({}));
vi.mock("@/services/notifications/notification-schedule", () => ({}));
vi.mock("@/services/photos/background-storage", () => ({}));
vi.mock("@/services/reach-out/handoff", () => ({}));
vi.mock("@/stores/shell-refresh-store", () => ({}));
vi.mock("@/theme/use-reduced-motion", () => ({}));
vi.mock("@/utils/logger", () => ({ Logger: {} }));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));

const { ProfileAppBar } = await import("./ContactProfileScreen");
const { PROFILE_APP_BAR, PROFILE_APP_BAR_SCRIM_OPACITY } = await import(
  "./contact-profile-logic"
);

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

function flatStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatStyle));
  return (style as Record<string, unknown>) ?? {};
}

const handlers = {
  onBack: vi.fn(),
  onToggleFavourite: vi.fn(),
  onOpenOverflow: vi.fn(),
};

function render(
  overrides: Partial<{
    favourite: boolean;
    favouriteDisabled: boolean;
    scrolled: boolean;
  }> = {},
) {
  return resolve(
    ProfileAppBar({
      name: "Alex",
      favourite: false,
      favouriteDisabled: false,
      scrolled: false,
      ...handlers,
      ...overrides,
    }),
  );
}

const isStar = (node: Node) =>
  /Favorites$/.test(String(node.props.accessibilityLabel ?? ""));

describe("ProfileAppBar (38.6 D-17)", () => {
  it("renders back, then the star, then ⋮", () => {
    const controls = all(render()).filter(
      (node) => node.type === "Button" || isStar(node),
    );
    expect(controls.map((node) => node.props.accessibilityLabel)).toEqual([
      "Back",
      "Add Alex to Favorites",
      "More actions for Alex",
    ]);
  });

  it("keeps the star's labels, 44 hit area, glyph state and toggle", () => {
    const star = all(render()).find(isStar);
    expect(star?.type).toBe("Pressable");
    expect(star?.props.accessibilityRole).toBe("button");
    expect(star?.props.disabled).toBe(false);
    const style = flatStyle(star?.props.style);
    expect(style.minWidth).toBe(PROFILE_APP_BAR.touchTarget);
    expect(style.minHeight).toBe(PROFILE_APP_BAR.touchTarget);
    expect(star?.children[0]).toMatchObject({
      type: "Icon",
      props: { name: "favorite", state: "default" },
    });
    const press = star?.props.onPress as () => void;
    press();
    expect(handlers.onToggleFavourite).toHaveBeenCalledTimes(1);

    const active = all(render({ favourite: true, favouriteDisabled: true }))
      .filter(isStar)
      .at(0);
    expect(active?.props.accessibilityLabel).toBe("Remove Alex from Favorites");
    expect(active?.props.disabled).toBe(true);
    expect(active?.children[0]?.props.state).toBe("active");
  });

  it("overlays the content and passes touches through its empty area", () => {
    const [bar] = render();
    expect(bar.props.pointerEvents).toBe("box-none");
    expect(flatStyle(bar.props.style)).toMatchObject({
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: PROFILE_APP_BAR.height,
    });
  });

  it("shows a touch-transparent token scrim only once scrolled", () => {
    const scrimOf = (nodes: Node[]) =>
      all(nodes).find((node) => node.props.testID === "profile-app-bar-scrim");
    expect(scrimOf(render())).toBeUndefined();
    const scrim = scrimOf(render({ scrolled: true }));
    expect(scrim?.props.pointerEvents).toBe("none");
    const style = flatStyle(scrim?.props.style);
    expect(style.backgroundColor).toBe(THEME_PRESETS.galaxy.dark.background);
    expect(style.opacity).toBe(PROFILE_APP_BAR_SCRIM_OPACITY);
  });
});

describe("Profile screen accessibility order (review WR-03)", () => {
  // The screen itself is too wide to render here; pin its JSX structure.
  const source = readFileSync(
    join(__dirname, "ContactProfileScreen.tsx"),
    "utf8",
  );
  const screen = source.slice(
    source.indexOf("export function ContactProfileScreen"),
  );

  it("renders the overlay app bar before the ScrollView", () => {
    const bar = screen.indexOf("<ProfileAppBar");
    const scroll = screen.search(/<ScrollView\s/);
    expect(bar).toBeGreaterThan(0);
    expect(scroll).toBeGreaterThan(0);
    expect(bar).toBeLessThan(scroll);
    expect(screen.indexOf("<ProfileAppBar", bar + 1)).toBe(-1);
  });

  it("starts the ScrollView one pixel below the bar and takes it out of the padding", () => {
    const scroll = screen.slice(
      screen.search(/<ScrollView\s/),
      screen.indexOf("</ScrollView>"),
    );
    expect(scroll).toContain(
      "style={{ marginTop: profileScrollA11yOffset(pixelRatio) }}",
    );
    expect(scroll).toContain(
      "paddingTop: profileScrollContentTopPadding(pixelRatio)",
    );
  });
});
