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
vi.mock("@/components/SnoozeSheet", () => ({}));
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
vi.mock("@/services/widget/widget-refresh", () => ({}));
vi.mock("@/stores/confirm-store", () => ({ confirm: vi.fn() }));
vi.mock("@/stores/shell-refresh-store", () => ({}));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: vi.fn() }));
vi.mock("@/theme/use-reduced-motion", () => ({}));
vi.mock("@/utils/logger", () => ({ Logger: {} }));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));

const { ProfileAppBar } = await import("./ContactProfileScreen");
const {
  PROFILE_APP_BAR,
  PROFILE_APP_BAR_SCRIM_OPACITY,
  profileStarView,
  unboundStarExplanation,
} = await import("./contact-profile-logic");

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
    favouriteUnavailable: boolean;
    favouriteHint: string;
    scrolled: boolean;
    title: string | null;
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

  it("draws a binned person's star disabled, dimmed and not filled, even with a rank (38.12 D-34)", () => {
    const view = profileStarView({
      favouriteRank: 3,
      bound: true,
      archived: true,
      pending: false,
    });
    const star = all(
      render({
        favourite: view.favourite,
        favouriteDisabled: view.disabled,
        favouriteUnavailable: view.unavailable,
      }),
    ).find(isStar);
    expect(star?.props.disabled).toBe(true);
    expect(star?.children[0]?.props.state).toBe("default");
    expect(flatStyle(star?.props.style).opacity).toBe(0.5);
  });

  it("draws an Unbound person's star off and dimmed even with a dormant rank; a press reaches the explanation (38.12 D-36)", () => {
    const view = profileStarView({
      favouriteRank: 2,
      bound: false,
      archived: false,
      pending: false,
    });
    const star = all(
      render({
        favourite: view.favourite,
        favouriteDisabled: view.disabled,
        favouriteUnavailable: view.unavailable,
        favouriteHint: unboundStarExplanation("Alex"),
      }),
    ).find(isStar);
    expect(star?.children[0]?.props.state).toBe("default");
    expect(flatStyle(star?.props.style).opacity).toBe(0.5);
    expect(star?.props.accessibilityHint).toBe(
      "Bind Alex to make them a Favorite.",
    );
    // Pressable, so the tap can explain; the screen writes nothing for it.
    expect(star?.props.disabled).toBe(false);
    handlers.onToggleFavourite.mockClear();
    const press = star?.props.onPress as () => void;
    press();
    expect(handlers.onToggleFavourite).toHaveBeenCalledTimes(1);
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

  it("makes the scrim solid while the name shows in the bar (38.11 D-92)", () => {
    const scrimOf = (nodes: Node[]) =>
      all(nodes).find((node) => node.props.testID === "profile-app-bar-scrim");
    const solid = scrimOf(render({ scrolled: true, title: "Alex Example" }));
    const style = flatStyle(solid?.props.style);
    expect(style.opacity).toBe(1);
    expect(style.backgroundColor).toBe(THEME_PRESETS.galaxy.dark.background);
    expect(solid?.props.pointerEvents).toBe("none");
    // Dropping the name goes back to the signed-off 0.92 (38.6 D-36).
    const plain = scrimOf(render({ scrolled: true, title: null }));
    expect(flatStyle(plain?.props.style).opacity).toBe(
      PROFILE_APP_BAR_SCRIM_OPACITY,
    );
  });
});

describe("ProfileAppBar name after scrolling (38.11 D-57)", () => {
  const titleOf = (nodes: Node[]) =>
    all(nodes).find((node) => node.props.testID === "profile-app-bar-title");

  it("shows no name until the screen passes one", () => {
    expect(titleOf(render())).toBeUndefined();
    expect(titleOf(render({ title: null }))).toBeUndefined();
  });

  it("renders the name in one ellipsized header line between Back and the star", () => {
    const nodes = render({ title: "Alex Example", scrolled: true });
    const title = titleOf(nodes);
    expect(title?.type).toBe("AppText");
    expect(title?.props).toMatchObject({
      numberOfLines: 1,
      ellipsizeMode: "tail",
      accessibilityRole: "header",
      role: "heading",
      children: "Alex Example",
    });
    // No colour override: AppText's theme text colour applies.
    expect(flatStyle(title?.props.style).color).toBeUndefined();
    const [bar] = nodes;
    const order = bar.children.map(
      (node) => node.props.testID ?? node.props.accessibilityLabel ?? node.type,
    );
    expect(order).toEqual([
      "profile-app-bar-scrim",
      "Back",
      "profile-app-bar-title",
      "View",
    ]);
  });
});

describe("Profile scroll wiring (review T-17)", () => {
  const source = readFileSync(
    join(__dirname, "ContactProfileScreen.tsx"),
    "utf8",
  );

  it("wires the scroll handler unconditionally; only the scrim stays behind the flag", () => {
    expect(source).not.toContain("onScroll={PROFILE_APP_BAR_SCROLL_SCRIM");
    expect(source).toContain("onScroll={onContentScroll}");
    expect(source).toContain(
      "scrolled={PROFILE_APP_BAR_SCROLL_SCRIM && barScrolled}",
    );
    expect(source).toContain(
      "title={barShowsName ? snapshot.identity.name : null}",
    );
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

describe("Profile refresh error placement (review WR-04)", () => {
  const source = readFileSync(
    join(__dirname, "ContactProfileScreen.tsx"),
    "utf8",
  );
  const screen = source.slice(
    source.indexOf("export function ContactProfileScreen"),
  );

  it("renders the error at the top only without content, else below the hero", () => {
    expect(screen).not.toMatch(/\{error \? <AppText>/);
    const top = screen.indexOf('errorPlacement === "top"');
    const hero = screen.indexOf("<ProfileHero");
    const belowHero = screen.indexOf('errorPlacement === "below-hero"');
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(hero);
    expect(belowHero).toBeGreaterThan(hero);
  });
});

describe("Profile lifecycle feedback wiring (38.12 D-32, D-33, D-38, D-95)", () => {
  const source = readFileSync(
    join(__dirname, "ContactProfileScreen.tsx"),
    "utf8",
  );
  const screen = source.slice(
    source.indexOf("export function ContactProfileScreen"),
  );

  it("the favourite toggle publishes a widget refresh after the write (D-38)", () => {
    const toggle = screen.slice(
      screen.indexOf("const toggleFavourite = useCallback"),
      screen.indexOf("const launchMethod = useCallback"),
    );
    const write = toggle.indexOf("await clearFavouriteRank(");
    const publish = toggle.indexOf("notifyWidgetDataChanged()");
    expect(write).toBeGreaterThan(0);
    expect(publish).toBeGreaterThan(write);
  });

  it("a confirmed Unbind closes the ⋯ sheet before the transition (D-33)", () => {
    const unbind = screen.slice(
      screen.indexOf('case "unbind": {'),
      screen.indexOf('case "update-from-contacts":'),
    );
    const close = unbind.indexOf("closeOverlay();");
    const transition = unbind.indexOf('transitionLifecycle("unbind")');
    expect(close).toBeGreaterThan(0);
    expect(transition).toBeGreaterThan(close);
  });

  it("Bind and Unbind run through the feedback runner with Undo (D-32, D-33)", () => {
    expect(screen).toContain("runProfileLifecycleTransition({");
  });

  it("a frequency changed on the Bind card is written with the bind, not before it (D-95, C-WR-05)", () => {
    const transition = screen.slice(
      screen.indexOf("transition: async () => {"),
      screen.indexOf("undo: async () => {"),
    );
    expect(transition).toContain("bindWithCadenceAndLifecycleEffects(");
    expect(transition).not.toContain("setProfileContactFrequency(");
    const undo = screen.slice(
      screen.indexOf("undo: async () => {"),
      screen.indexOf("reload: () => load(),"),
    );
    expect(undo).toContain("unbindWithCadenceAndLifecycleEffects(");
    expect(undo).not.toContain("setProfileContactFrequency(");
  });

  it("the Overview frequency change reconciles the notification schedule (C-WR-06)", () => {
    const setFrequency = screen.slice(
      screen.indexOf("const setFrequency = useCallback"),
      screen.indexOf("const snooze = useCallback"),
    );
    const write = setFrequency.indexOf("setProfileContactFrequency(");
    const reconcile = setFrequency.indexOf("reconcileSchedule(getExecutor())");
    expect(write).toBeGreaterThan(0);
    expect(reconcile).toBeGreaterThan(write);
  });

  it("the Bind card reads its label and Change link from bindCardModel (D-95)", () => {
    expect(screen).toContain("bindCardModel(");
    expect(screen).toContain('testID="profile-bind-change"');
  });
});
