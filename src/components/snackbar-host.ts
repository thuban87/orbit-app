/**
 * Snackbar host selection and geometry (38.9 D-40, D-51). Pure logic, unit
 * tested in `snackbar-host.test.ts`; `Snackbar.tsx` renders from it.
 *
 * Every overlay window (BaseOverlay and each `RegisteredModal`) renders its own
 * `<Snackbar host={id} />`, and `App.tsx` renders the root `<Snackbar />`
 * (host "root"). Only ONE host renders at a time: the topmost registered
 * overlay window, or the root host when no overlay is open. That keeps the
 * single snackbar visible above the sheet or dialog that fired it, with one
 * live-region announcement.
 */
import type { IconTone } from "@/components/icons/icon-registry";
import { FAB_SIDE_INSET, FAB_SIZE } from "@/navigation/use-bottom-clearance";
import type { SnackbarKind } from "@/stores/snackbar-store";
import { SPACING } from "@/theme/tokens/spacing";

/** Root pill width when only the universal FAB shows: D-132's "~80%". */
export const SNACKBAR_WIDTH_ONE_FAB = 0.8;
/** Root pill width when a section FAB also shows: D-132's "~60%", centred. */
export const SNACKBAR_WIDTH_WITH_SECTION_FAB = 0.6;
/** Minimum gap between the pill and a FAB lane, so the FAB stays tappable. */
export const SNACKBAR_FAB_GAP = SPACING.sm;

/** The host id of the App.tsx snackbar, outside every overlay window. */
export const ROOT_SNACKBAR_HOST = "root";

/**
 * Root host bottom padding: clears the tab bar and the universal + (the value
 * the single root snackbar has always used).
 */
export const ROOT_SNACKBAR_BOTTOM_PADDING = 112;

/** Whether the snackbar host `host` renders, given the topmost overlay id. */
export function resolveSnackbarHostVisible(
  host: string,
  topOverlayId: string | null,
): boolean {
  if (host === ROOT_SNACKBAR_HOST) return topOverlayId === null;
  return topOverlayId === host;
}

/**
 * Bottom padding for a host. Inside an overlay window there is no tab bar or
 * +, so the snackbar sits just above the system navigation bar (D-51); every
 * Modal window is edge-to-edge, so the nav-bar inset is added explicitly.
 */
export function snackbarBottomPadding(
  host: string,
  insetBottom: number,
): number {
  if (host === ROOT_SNACKBAR_HOST) return ROOT_SNACKBAR_BOTTOM_PADDING;
  return insetBottom + SPACING.base;
}

/** The width a FAB lane plus its side inset and the gap take from one edge. */
const FAB_LANE_RESERVE = FAB_SIDE_INSET + FAB_SIZE + SNACKBAR_FAB_GAP;

/** Where the pill sits and how wide it is. */
export interface SnackbarLayout {
  /** The overlay's cross-axis alignment for the pill. */
  alignItems: "flex-start" | "center";
  /** A fixed pill width, or undefined to size to its content. */
  width: number | undefined;
}

/**
 * Root-host pill geometry around the FABs (38.10 D-132; resolves O2 per
 * D-138). With only the universal FAB (bottom right) the pill is
 * left-aligned at ~80%; with a section FAB (bottom left) it is centred at
 * ~60%. Each width is clamped so the pill never reaches a FAB lane, which is
 * what keeps the FAB tappable on narrow phones; a narrower pill wraps its text
 * (taller is fine, D-132). With no FAB, and in every overlay window (no FAB
 * there, 38.9 D-40/D-51), the geometry is unchanged: centred, content-sized.
 * The overlay pads each side by `SPACING.base`. PURE.
 */
export function snackbarLayout(input: {
  host: string;
  windowWidth: number;
  universalFab: boolean;
  sectionFab: boolean;
}): SnackbarLayout {
  const { host, windowWidth, universalFab, sectionFab } = input;
  if (host !== ROOT_SNACKBAR_HOST || (!universalFab && !sectionFab)) {
    return { alignItems: "center", width: undefined };
  }
  if (sectionFab) {
    return {
      alignItems: "center",
      width: Math.min(
        Math.round(SNACKBAR_WIDTH_WITH_SECTION_FAB * windowWidth),
        windowWidth - 2 * FAB_LANE_RESERVE,
      ),
    };
  }
  return {
    alignItems: "flex-start",
    width: Math.min(
      Math.round(SNACKBAR_WIDTH_ONE_FAB * windowWidth),
      windowWidth - SPACING.base - FAB_LANE_RESERVE,
    ),
  };
}

/**
 * The pill's side padding (O5, D-132). The label starts `SPACING.base` from
 * the left edge; with no action the same padding closes the right side so the
 * text never runs into the pill's edge, and with an action the action's own
 * padding does. PURE.
 */
export function snackbarPadding(hasAction: boolean): {
  paddingLeft: number;
  paddingRight: number;
} {
  return {
    paddingLeft: SPACING.base,
    paddingRight: hasAction ? 0 : SPACING.base,
  };
}

/** How a snackbar of a given kind is drawn and announced (38.9 D-72, 38.10 D-132). */
export interface SnackbarPresentation {
  /** Theme token for the pill's fill. */
  fillTone: IconTone;
  /** Theme token for the message text. */
  labelTone: IconTone;
  /** Theme token for the action labels (the pill's own foreground). */
  actionTone: IconTone;
  /** Theme token for the pill's outline. */
  borderTone: IconTone;
  /** Tone of the leading reserved `warning` registry glyph; null = no glyph. */
  glyphTone: IconTone | null;
  /** Android live-region urgency for TalkBack. */
  liveRegion: "assertive" | "polite";
  /** `alert` marks an error for assistive tech; the other kinds have no role. */
  accessibilityRole: "alert" | undefined;
}

/** The warning pill's paint, shared by destructive results and errors (D-140). */
const WARNING_LOOK = {
  fillTone: "textPrimary",
  labelTone: "background",
  actionTone: "background",
  borderTone: "textPrimary",
  glyphTone: "background",
} as const satisfies Pick<
  SnackbarPresentation,
  "fillTone" | "labelTone" | "actionTone" | "borderTone" | "glyphTone"
>;

/**
 * Each kind's look, as palette KEYS (never colours; `Snackbar.tsx` resolves
 * them through `useTheme().colors`). PURE.
 *
 * - success (a notice, D-132): an accent pill with `onAccent` text, the pair
 *   ADR-084 validates for every curated accent. Polite.
 * - warning (a destructive result, D-132): an inverted pill, `textPrimary`
 *   fill with `background` text and the warning glyph, so it reads as a
 *   warning rather than a notice and differs from the `surface` cards. The
 *   body-text pair is AA in every palette; `danger`/`onDanger` is not
 *   (galaxy-dark ~3.9:1). Polite: the user caused it.
 * - error (a failure, D-140): the same warning pill, so there are two looks
 *   in total; it keeps its assertive announcement and `alert` role (38.9
 *   D-72).
 *
 * Timing is the same for every kind (38.9 D-04).
 */
export function snackbarPresentation(kind: SnackbarKind): SnackbarPresentation {
  switch (kind) {
    case "error":
      return {
        ...WARNING_LOOK,
        liveRegion: "assertive",
        accessibilityRole: "alert",
      };
    case "warning":
      return {
        ...WARNING_LOOK,
        liveRegion: "polite",
        accessibilityRole: undefined,
      };
    default:
      return {
        fillTone: "accent",
        labelTone: "onAccent",
        actionTone: "onAccent",
        borderTone: "accent",
        glyphTone: null,
        liveRegion: "polite",
        accessibilityRole: undefined,
      };
  }
}
