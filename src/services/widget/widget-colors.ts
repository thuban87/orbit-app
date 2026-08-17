/**
 * widget-colors — the headless status→ring resolver (WDG-01), the second of this
 * phase's two node-testable correctness cores.
 *
 * The widget bitmap is rasterised in a HEADLESS task with NO `ThemeProvider`
 * mounted, so `useTheme()` is unavailable — colours must resolve from
 * `theme-presets` DIRECTLY (RESEARCH Pattern 4). `widgetPalette()` returns the
 * dark-first space-dark palette the render inherits; `ringColor`/`ringWeight` are
 * PURE tables mirroring the in-app `ringVisual` (contact-card-ring.ts, 12-01) —
 * deliberately kept SEPARATE because the widget has no provider and no opacity
 * channel (the card's opacity distinguishes never-contacted; the widget uses
 * colour + weight only).
 *
 * NO hex literal lives here (CLAUDE.md / check:colors): every colour is read off
 * the passed palette, which sources it from theme-presets — the ONE sanctioned
 * colour-literal file. NO React theme hook is imported.
 */
import { DEFAULT_PRESET_ID, resolvePalette } from "@/theme/theme-presets";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { ThemePalette } from "@/theme/theme-types";

/** The palette shape the headless widget render resolves colours from. */
export type WidgetPalette = ThemePalette;

/**
 * The dark-first palette the headless render inherits: space-dark, dark mode.
 * `resolvePalette` falls back to the dark palette for `"light"` today, so the
 * widget deterministically renders in space-dark regardless of the app's mode
 * (RESEARCH Pattern 4). PURE — no `react-native`, no theme hook.
 */
export function widgetPalette(): WidgetPalette {
  return resolvePalette(DEFAULT_PRESET_ID, "dark");
}

/**
 * Map a query-time status (or `null` never-contacted) to its ring COLOUR against
 * a resolved palette: stable→statusStable, wobble→statusWobble, decay→statusDecay,
 * rogue→rogue, null→border (neutral). Every colour comes from the palette — no
 * hex literal here.
 */
export function ringColor(
  status: ProfileStatus | null,
  palette: WidgetPalette,
): string {
  switch (status) {
    case "stable":
      return palette.statusStable;
    case "wobble":
      return palette.statusWobble;
    case "decay":
      return palette.statusDecay;
    case "rogue":
      return palette.rogue;
    default:
      return palette.border;
  }
}

/**
 * Map a status to its ring border WEIGHT (the redundant CVD-safe channel,
 * UI-SPEC): stable 2 / wobble 3 / decay 4 (thickest — the "act now" state) /
 * rogue 3 / null a thin 2. PURE.
 */
export function ringWeight(status: ProfileStatus | null): number {
  switch (status) {
    case "stable":
      return 2;
    case "wobble":
      return 3;
    case "decay":
      return 4;
    case "rogue":
      return 3;
    default:
      return 2;
  }
}
