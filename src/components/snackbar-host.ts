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
import { FAB_EDGE_GAP, FAB_SIZE } from "@/navigation/use-bottom-clearance";
import type { SnackbarKind } from "@/stores/snackbar-store";
import { SPACING } from "@/theme/tokens/spacing";

/** Gap between the pill and the top of the FAB row below it (D-143). */
export const SNACKBAR_FAB_GAP = SPACING.sm;

/** The host id of the App.tsx snackbar, outside every overlay window. */
export const ROOT_SNACKBAR_HOST = "root";

/**
 * Root host bottom padding with no FAB on screen: clears the tab bar (the
 * value the single root snackbar has always used). With a FAB showing, the
 * pill sits above the FAB row instead (`snackbarLayout`, D-143).
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

/** Where the pill sits and how wide it is. */
export interface SnackbarLayout {
  /** The overlay's cross-axis alignment for the pill. */
  alignItems: "center";
  /** A fixed pill width, or undefined to size to its content. */
  width: number | undefined;
  /** The overlay's bottom padding: where the pill's bottom edge sits. */
  paddingBottom: number;
}

/**
 * Root-host pill geometry around the FABs (38.10 D-143, amending D-132's
 * widths). Whenever a round button shows (the universal + alone, or with a
 * section button, or a section button alone), the pill is FULL WIDTH inside
 * the overlay's `SPACING.base` side margins and sits `SNACKBAR_FAB_GAP` above
 * the FAB row, clear of both FABs, so they stay tappable.
 *
 * The FAB row's bottom edge: the universal + sits `FAB_EDGE_GAP` above the
 * tab bar (UniversalFab), and on the non-focused pages that also carry a
 * section button that button shares its baseline (D-149). The universal + is
 * hidden only on focused workflows and while the keyboard is up, and a section
 * button hides with the keyboard too, so a section button showing WITHOUT the
 * universal + is on a focused route, where it sits `FAB_EDGE_GAP` above the
 * safe-area inset (`sectionFabBottomOffset`).
 *
 * With no FAB, and in every overlay window (no FAB there, 38.9 D-40/D-51),
 * the geometry is unchanged: centred, content-sized, at
 * `snackbarBottomPadding`. PURE.
 */
export function snackbarLayout(input: {
  host: string;
  windowWidth: number;
  universalFab: boolean;
  sectionFab: boolean;
  /** The measured tab bar height (`useMeasuredTabBarHeight`). */
  tabBarHeight: number;
  /** The safe-area bottom inset. */
  insetBottom: number;
}): SnackbarLayout {
  const {
    host,
    windowWidth,
    universalFab,
    sectionFab,
    tabBarHeight,
    insetBottom,
  } = input;
  if (host !== ROOT_SNACKBAR_HOST || (!universalFab && !sectionFab)) {
    return {
      alignItems: "center",
      width: undefined,
      paddingBottom: snackbarBottomPadding(host, insetBottom),
    };
  }
  const fabRowBottom =
    (universalFab ? tabBarHeight : insetBottom) + FAB_EDGE_GAP;
  return {
    alignItems: "center",
    width: windowWidth - 2 * SPACING.base,
    paddingBottom: fabRowBottom + FAB_SIZE + SNACKBAR_FAB_GAP,
  };
}

/** What the root host knows about the screen a snackbar shows on (D-151). */
export interface SnackbarScreenContext {
  host: string;
  windowWidth: number;
  /**
   * The tab bar's height when it is on screen (`useShownTabBarHeight`): the
   * universal +'s row sits on it whenever the + shows.
   */
  tabBarHeight: number;
  /** The safe-area bottom inset. */
  insetBottom: number;
  /**
   * The route lets the universal + show (not a focused workflow). It may be
   * hidden now (the keyboard) and appear while the snackbar is up.
   */
  universalFabMayShow: boolean;
  /**
   * The focused screen has a section FAB mounted, which the scroll morph can
   * bring up at any time (`selectSectionFabAvailable`).
   */
  sectionFabMayShow: boolean;
}

/**
 * The root pill's position for the WHOLE life of a message (38.10 D-151): the
 * D-143 layout for the FABs showing now, lifted so its bottom edge is never
 * below `SNACKBAR_FAB_GAP` above any FAB row that may appear on this screen
 * while it is up. The pill then never hops when the section button morphs in
 * or out, or when the keyboard closes and the + comes back, and never sits
 * over a FAB that shows.
 *
 * The rows that may appear (the same baselines as `snackbarLayout`):
 * - the universal + row, `tabBarHeight + FAB_EDGE_GAP`, on any non-focused
 *   route. A section FAB there shares its baseline (D-149).
 * - on a focused route (no tab bar, no +), the section FAB row,
 *   `insetBottom + FAB_EDGE_GAP`, when the screen has one.
 *
 * Width is the live D-143 width: full width when a FAB shows now, else
 * centred and content-sized. Either way the lifted pill clears every row. An
 * overlay host is unchanged (no FAB there, D-51). PURE.
 */
export function heldSnackbarLayout(
  input: SnackbarScreenContext & {
    universalFab: boolean;
    sectionFab: boolean;
  },
): SnackbarLayout {
  const live = snackbarLayout(input);
  if (input.host !== ROOT_SNACKBAR_HOST) return live;
  if (!input.universalFabMayShow && !input.sectionFabMayShow) return live;
  // The highest row that may appear: the + row on a non-focused route (where
  // a section FAB shares it), else the focused route's section FAB row.
  const highestRow = snackbarLayout({
    ...input,
    universalFab: input.universalFabMayShow,
    sectionFab: true,
  });
  return {
    ...live,
    paddingBottom: Math.max(live.paddingBottom, highestRow.paddingBottom),
  };
}

/** A root pill layout held for one message on one screen (D-151). */
export interface SnackbarLayoutLatch {
  /** The snackbar message it was computed for (compared by identity). */
  message: object;
  /** The screen it was computed on (`snackbarScreenKey`). */
  screenKey: string;
  layout: SnackbarLayout;
}

/**
 * The screen facts a held layout depends on. FAB PRESENCE is deliberately not
 * part of it: the section button morphing in or out, or the + hiding for the
 * keyboard, must not move the pill (D-151). PURE.
 */
export function snackbarScreenKey(context: SnackbarScreenContext): string {
  return [
    context.host,
    context.windowWidth,
    context.tabBarHeight,
    context.insetBottom,
    context.universalFabMayShow ? "plus" : "no-plus",
    context.sectionFabMayShow ? "section" : "no-section",
  ].join("|");
}

/**
 * Hold the root pill's layout for a message (38.10 D-151). The previous latch
 * is kept while the message and the screen are the same, whatever the FABs do
 * meanwhile; a new or replacing message is laid out afresh. So is a message
 * that outlives its screen (Save then Back): the next screen has different
 * buttons, and holding the old place could put the pill over the + there.
 * PURE.
 */
export function latchSnackbarLayout(
  previous: SnackbarLayoutLatch | null,
  message: object,
  input: SnackbarScreenContext & {
    universalFab: boolean;
    sectionFab: boolean;
  },
): SnackbarLayoutLatch {
  const screenKey = snackbarScreenKey(input);
  if (
    previous !== null &&
    previous.message === message &&
    previous.screenKey === screenKey
  ) {
    return previous;
  }
  return { message, screenKey, layout: heldSnackbarLayout(input) };
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
