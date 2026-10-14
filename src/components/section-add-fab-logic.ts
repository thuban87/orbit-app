/**
 * The section Add FAB's pure rules (Phase 38.10 D-131, gap G2).
 *
 * On the section pages the solid Add sits at the top. When it scrolls out of
 * view it morphs ("sucked down") into a second FAB at the bottom left,
 * opposite the universal FAB; scrolling back up reverses it. This module holds
 * what that decides without React: when the FAB shows, the morph's frame at a
 * given progress, where the FAB sits, how much scroll clearance it needs and
 * which icon each page shows.
 *
 * Worklets: `lerp`, `clamp01`, `morphFrame`, `fabTargetAfterScroll` and
 * `snapOnPause` run on the UI thread (Reanimated). Each is declared ABOVE every worklet that calls
 * it, because a worklet that calls one declared later in the same file is
 * undefined on device under Hermes, and vitest cannot catch that (owner memory
 * worklet-forward-ref-hazard; Phase 29 crashes).
 *
 * React-native-free (type-only imports plus pure token modules), so it is
 * unit-tested in the node env.
 */
import type { IconName } from "@/components/icons/icon-registry";
import type { MemoryTypeKey } from "@/db/memory-registry";
import { FAB_EDGE_GAP, FAB_SIZE } from "@/navigation/use-bottom-clearance";
import type { IconSizeToken } from "@/theme/tokens/icon-size";
import { MOTION } from "@/theme/tokens/motion";

// --- Tunable constants (single-number edits) -------------------------------
/** The morph's duration, in ms: the `slow` motion token ("morphs"). */
export const MORPH_DURATION_MS = MOTION.slow;
/** dp the page must scroll back past the Add's bottom before the FAB hides (no flicker at the edge). */
export const FAB_HIDE_HYSTERESIS = 8;
/** The fraction of the morph over which the overlay fades in from the bar's place. */
export const MORPH_APPEAR_FRACTION = 0.1;
/** The small + overlaid on the page icon. */
export const FAB_PLUS_SIZE: IconSizeToken = "sm";
/** The page icon in the FAB. */
export const FAB_ICON_SIZE: IconSizeToken = "lg";

/** A rectangle in the screen root's coordinates, with its corner radius. */
export interface MorphRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

/** The overlay's frame and layer opacities at one point of the morph. */
export interface MorphFrame extends MorphRect {
  /** The whole overlay: 0 at rest on the bar (the real bar shows), 1 once moving. */
  overlayOpacity: number;
  /** The bar's label: 1 at the bar, gone by the morph's midpoint. */
  labelOpacity: number;
  /** The page icon and its +: hidden until the midpoint, 1 at the FAB. */
  iconOpacity: number;
}

export function lerp(from: number, to: number, t: number): number {
  "worklet";
  return from + (to - from) * t;
}

export function clamp01(value: number): number {
  "worklet";
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * The overlay's frame at progress `p` (0 the bar, 1 the FAB). The label fades
 * over the first half and the icon over the second, so the two never overlap.
 */
export function morphFrame(
  p: number,
  from: MorphRect,
  to: MorphRect,
): MorphFrame {
  "worklet";
  const t = clamp01(p);
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
    radius: lerp(from.radius, to.radius, t),
    overlayOpacity: clamp01(t / MORPH_APPEAR_FRACTION),
    labelOpacity: clamp01(1 - t * 2),
    iconOpacity: clamp01(t * 2 - 1),
  };
}

/**
 * The morph's target after a scroll (1 = FAB, 0 = the Add at the top).
 * `barBottom` is the Add bar's bottom in scroll-content coordinates; 0 or less
 * means it has not been measured yet, so the FAB stays hidden. Once shown, the
 * FAB hides only when the page scrolls back `FAB_HIDE_HYSTERESIS` past the
 * Add's bottom. `suppressed` always gives 0.
 */
export function fabTargetAfterScroll(
  current: number,
  scrollY: number,
  barBottom: number,
  suppressed: boolean,
): 0 | 1 {
  "worklet";
  if (suppressed || barBottom <= 0) return 0;
  if (current === 1) {
    return scrollY < barBottom - FAB_HIDE_HYSTERESIS ? 0 : 1;
  }
  return scrollY >= barBottom ? 1 : 0;
}

/**
 * The value the morph snaps to when it pauses (blur, background): its current
 * target, so no in-between frame is left on screen (CLAUDE.md pause rule).
 * A worklet; it calls nothing in this file.
 */
export function snapOnPause(target: number): number {
  "worklet";
  return target;
}

/**
 * Whether the FAB is held hidden whatever the scroll: before the read loads
 * (no Add to morph), while any form is open, and while the keyboard is up
 * (UniversalFab's keyboard rule).
 */
export function fabSuppressed({
  loaded,
  formOpen,
  keyboardUp,
}: {
  loaded: boolean;
  formOpen: boolean;
  keyboardUp: boolean;
}): boolean {
  return !loaded || formOpen || keyboardUp;
}

/** The FAB's accessibility and touch props (UniversalFab's scrim-hiding pattern). */
export function fabA11yProps(shown: boolean): {
  accessible: boolean;
  importantForAccessibility: "auto" | "no-hide-descendants";
  accessibilityElementsHidden: boolean;
  pointerEvents: "auto" | "none";
} {
  return shown
    ? {
        accessible: true,
        importantForAccessibility: "auto",
        accessibilityElementsHidden: false,
        pointerEvents: "auto",
      }
    : {
        accessible: false,
        importantForAccessibility: "no-hide-descendants",
        accessibilityElementsHidden: true,
        pointerEvents: "none",
      };
}

/**
 * The section FAB's bottom offset inside its screen root. On a focused route
 * the tab bar is hidden and the root reaches the window's bottom, so the FAB
 * clears the system inset; on a tab page the root ends at the in-flow tab
 * bar's top, which already accounts for the inset (so `tabBarHeight` does not
 * add here, unlike the shell-level universal FAB's offset).
 */
export function sectionFabBottomOffset({
  focused,
  insetBottom,
}: {
  focused: boolean;
  insetBottom: number;
  tabBarHeight?: number;
}): number {
  return focused ? insetBottom + FAB_EDGE_GAP : FAB_EDGE_GAP;
}

/** Scroll-content clearance so the last entry ends fully above the section FAB. */
export function sectionFabClearance(input: {
  focused: boolean;
  insetBottom: number;
}): number {
  return sectionFabBottomOffset(input) + FAB_SIZE + FAB_EDGE_GAP;
}

/** The pages that carry a section FAB: the memory types and plan 22's pages. */
export type SectionFabKey =
  | MemoryTypeKey
  | "key_people"
  | "off_limits"
  | "last_talked_about"
  | "current_location";

/**
 * The page's FAB icon (D-131). Imported has no Add, so it has no FAB (D-35):
 * null, and callers render the FAB only when the page can add.
 */
export function sectionFabIcon(section: SectionFabKey): IconName | null {
  switch (section) {
    case "general":
      return "section-memories";
    case "thought_of_them":
      return "section-thought-of-them";
    case "gift_idea":
      return "section-gift-ideas";
    case "key_people":
      return "section-key-people";
    case "off_limits":
      return "section-off-limits";
    case "last_talked_about":
      return "section-last-talked-about";
    case "current_location":
      return "section-current-location";
    case "imported":
      return null;
  }
}
