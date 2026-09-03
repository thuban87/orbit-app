/**
 * Curated accent system (THEME-02 / D-06, REVIEWS 23-03 HIGH resolution).
 *
 * A FIXED curated set of accent choices — NO user-entered/unrestricted accent
 * (out of scope, dossier deferred). Each accent resolves per RESOLVED MODE to a
 * tone triple `{ fill, onAccent, text }` rather than a single hex, because one
 * hex cannot be AA-4.5:1 as an accent-as-text link on BOTH a Galaxy-dark
 * background and a near-white light surface:
 *   - `fill`     — the filled-accent background (Primary button / active state)
 *   - `onAccent` — the foreground drawn ON `fill` (AA >=4.5 against it)
 *   - `text`     — the accent-as-text/link tone for THAT mode's background
 *                  (AA >=4.5 against `background`/`surface`)
 *
 * The accent is SEPARATE from the owner/star colour (`starPalette`) — a distinct
 * setting (dossier §C, THEME-02); nothing here touches the star colour.
 *
 * The DAO stores an accent-ID (or NULL), NEVER a hex (D-06 / self_sun_colour
 * precedent); the provider resolves `id + package + resolvedMode -> tone` here at
 * render and overlays `palette.accent`(=fill)/`onAccent`/`accentText`. This file
 * is the SOLE home for accent hex literals (alongside theme-presets.ts); it lives
 * under `src/theme/**` so `check:colors` exempts it.
 *
 * The id list is IMPORTED from the Plan 01 single source `theme-option-ids.ts`
 * (`ACCENT_IDS`); ACCENTS is keyed by exactly those ids and this module declares
 * NO parallel id list, so the DAO's accepted-id set and this resolver's known-id
 * set cannot drift (REVIEWS 23-01 cycle-4). Every tone here is validated to meet
 * AA in all four theme/mode combos by `accents.test.ts` — a failing accent is
 * retuned or dropped, NEVER kept, and AA is never weakened.
 */

import { ACCENT_IDS, type AccentId } from "./theme-option-ids";
import type { ResolvedMode, ThemePackage, ThemePalette } from "./theme-types";

/** A per-mode accent tone: the fill, its on-fill foreground, and the link text. */
export interface AccentTone {
  /** Filled-accent background (Primary button / active state). */
  fill: string;
  /** Foreground drawn on `fill` (AA >=4.5 against it). */
  onAccent: string;
  /** Accent-as-text/link tone for this mode's background (AA >=4.5). */
  text: string;
}

/** Both resolved-mode tones for one curated accent. */
interface AccentToneSet {
  dark: AccentTone;
  light: AccentTone;
}

/**
 * The curated accent tones, keyed by the imported `ACCENT_IDS`. Each id carries a
 * `dark` and a `light` tone triple. Tones vary by RESOLVED MODE (dark|light); a
 * single mode tone is shared across packages because the four palettes' dark
 * backgrounds (and light backgrounds) sit at comparable luminance, so one tone
 * meets AA against both packages at that mode (asserted by the per-combo gate).
 *
 * `Record<AccentId, ...>` makes an id missing a tone a COMPILE error, and the
 * drift test asserts the key set equals `ACCENT_IDS` exactly (no extra ids).
 */
export const ACCENTS: Record<AccentId, AccentToneSet> = {
  "nebula-blue": {
    dark: { fill: "#6C8CFF", onAccent: "#0A1330", text: "#8FA6FF" },
    light: { fill: "#3355E6", onAccent: "#FFFFFF", text: "#2A46C7" },
  },
  "slate-indigo": {
    dark: { fill: "#8091D6", onAccent: "#0C1130", text: "#9AA8E0" },
    light: { fill: "#4453B0", onAccent: "#FFFFFF", text: "#3C4AA0" },
  },
  "aurora-teal": {
    dark: { fill: "#3FB8B0", onAccent: "#052321", text: "#4FD0C6" },
    light: { fill: "#0E7A73", onAccent: "#FFFFFF", text: "#0B6A64" },
  },
  "solar-amber": {
    dark: { fill: "#E8B84A", onAccent: "#2A1E00", text: "#F0C766" },
    light: { fill: "#8A6212", onAccent: "#FFFFFF", text: "#7A5610" },
  },
  "rose-quartz": {
    dark: { fill: "#E06B93", onAccent: "#2E0713", text: "#EC86A8" },
    light: { fill: "#B62B57", onAccent: "#FFFFFF", text: "#A8244D" },
  },
  "violet-haze": {
    dark: { fill: "#9B7BE0", onAccent: "#15082E", text: "#B199E8" },
    light: { fill: "#6A3FC7", onAccent: "#FFFFFF", text: "#5E37B5" },
  },
  emerald: {
    dark: { fill: "#4FB86B", onAccent: "#04220E", text: "#63CC7F" },
    light: { fill: "#137A3A", onAccent: "#FFFFFF", text: "#106A33" },
  },
  coral: {
    dark: { fill: "#FF7A5C", onAccent: "#2E0A02", text: "#FF9377" },
    light: { fill: "#C0402A", onAccent: "#FFFFFF", text: "#B03A26" },
  },
};

/**
 * Each package's DEFAULT accent id — applied when the stored per-package accent
 * is NULL (the self_sun_colour NULL-resolve-at-render idiom). Galaxy defaults to
 * Nebula Blue, Standard to the calmer Slate Indigo (UI-SPEC / THEME-02).
 */
export const DEFAULT_ACCENT: Record<ThemePackage, AccentId> = {
  galaxy: "nebula-blue",
  standard: "slate-indigo",
};

/** True when `id` is a known curated accent id (a member of `ACCENT_IDS`). */
function isKnownAccentId(id: string): id is AccentId {
  return (ACCENT_IDS as readonly string[]).includes(id);
}

/**
 * Resolve `(accent-id | null, package, resolvedMode)` to a tone triple. A NULL or
 * unknown/tampered id falls back to the package DEFAULT accent's tone — so an
 * invalid stored value renders a safe default, never crashes (T-23-06). PURE and
 * RN-free (node-testable).
 */
export function resolveAccent(
  id: AccentId | null,
  themePackage: ThemePackage,
  resolvedMode: ResolvedMode,
): AccentTone {
  const effectiveId =
    id !== null && isKnownAccentId(id) ? id : DEFAULT_ACCENT[themePackage];
  return ACCENTS[effectiveId][resolvedMode];
}

/**
 * Overlay a resolved accent tone onto a base palette: `accent`=fill,
 * `onAccent`, `accentText`=text. PURE — returns a NEW palette, mutating nothing.
 * The provider calls this at render so a live accent change restyles the tree.
 */
export function applyAccent(
  palette: ThemePalette,
  tone: AccentTone,
): ThemePalette {
  return {
    ...palette,
    accent: tone.fill,
    onAccent: tone.onAccent,
    accentText: tone.text,
  };
}
