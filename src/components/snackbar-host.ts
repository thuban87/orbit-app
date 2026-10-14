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
import type { SnackbarKind } from "@/stores/snackbar-store";
import { SPACING } from "@/theme/tokens/spacing";

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
  /** The leading reserved `warning` registry glyph and its tone, or none. */
  glyph: { tone: IconTone } | null;
  /** Android live-region urgency for TalkBack. */
  liveRegion: "assertive" | "polite";
  /** `alert` marks an error for assistive tech; the other kinds have no role. */
  accessibilityRole: "alert" | undefined;
}

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
 * - error (38.9 D-72): a `danger` outline and glyph on the `surface` pill,
 *   announced assertively as an alert.
 *
 * Timing is the same for every kind (38.9 D-04).
 */
export function snackbarPresentation(kind: SnackbarKind): SnackbarPresentation {
  switch (kind) {
    case "error":
      return {
        fillTone: "surface",
        labelTone: "textSecondary",
        actionTone: "accentText",
        borderTone: "danger",
        glyph: { tone: "danger" },
        liveRegion: "assertive",
        accessibilityRole: "alert",
      };
    case "warning":
      return {
        fillTone: "textPrimary",
        labelTone: "background",
        actionTone: "background",
        borderTone: "textPrimary",
        glyph: { tone: "background" },
        liveRegion: "polite",
        accessibilityRole: undefined,
      };
    default:
      return {
        fillTone: "accent",
        labelTone: "onAccent",
        actionTone: "onAccent",
        borderTone: "accent",
        glyph: null,
        liveRegion: "polite",
        accessibilityRole: undefined,
      };
  }
}
