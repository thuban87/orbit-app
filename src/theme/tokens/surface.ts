/**
 * Per-package surface & glass treatment tokens (THEME-05 / dossier §F).
 *
 * ONE semantic surface API keyed by PACKAGE (no parallel component families):
 *   - Galaxy renders glass-forward — translucency, a luminous border, a subtle glow.
 *   - Standard renders flatter/quieter — opaque surfaces, a plain border, no glow.
 *
 * Blur degrades gracefully (dossier §F [DERIVED], `[theme -> performance]`): blur
 * carries no required meaning; when unaffordable a `GlassSurface` falls back to a
 * semi-opaque tinted surface TOKEN. Surface opacity increases with content density
 * (dense forms/settings use more opaque readable surfaces; presentation screens may
 * show more background) — readability wins.
 *
 * SURFACE-TOKEN-ONLY (cycle-3 LOW, finding #4): the pure `resolveSurfaceStyle`
 * selector returns ONLY declared SURFACE token fields — palette-token KEYS (drawn
 * from `SURFACE_COLOR_TOKEN_KEYS`) and declared opacity numbers, never a raw colour
 * or an ad-hoc opacity. `GlassSurface` consumes the selector and reads the actual
 * (mode-resolved) colour via `useTheme().colors[key]`, so the check:colors `/theme/`
 * LOCATION exemption cannot become an escape hatch for a colour literal smuggled
 * into a component. `surface.test.ts` asserts the token-only output.
 *
 * LIVE-GLASS AA INVARIANT (REVIEWS 23-06 MEDIUM + cycle-3 MEDIUM): TWO guards, both
 * in `surface.test.ts`. (1) COMPOSITED per-asset AA — every text/status foreground
 * over `alphaComposite(tint @ liveGlassTintOpacity, each asset's declared brightest
 * pixel)` meets AA. (2) OPACITY-ORDERING — `liveGlassTintOpacity >=
 * fallbackTintOpacity` per package, so the rendered live tint is never MORE
 * translucent than the AA-checked fallback. `liveGlassTintOpacity` is pinned to the
 * least-dense (most translucent, worst-case) density opacity.
 *
 * PURE DATA — no react-native import; colour VALUES here are palette-token KEYS +
 * one composite helper over `#RRGGBB` hexes, so the module stays node-testable.
 */

import type { ResolvedMode, ThemePackage } from "../theme-types";

/**
 * The palette colour-token keys a surface field may reference. Constrained to the
 * surface-relevant tokens so the selector's colour output is always a member of
 * this declared set (the token-only guard). These are keys into `ThemePalette`.
 */
export const SURFACE_COLOR_TOKEN_KEYS = [
  "surface",
  "surfaceElevated",
  "border",
  "borderStrong",
  "accent",
] as const;

export type SurfaceColorTokenKey = (typeof SURFACE_COLOR_TOKEN_KEYS)[number];

/**
 * Content-density steps. App-level density is fixed "moderate" (dossier §J, out of
 * scope), but a surface's OPACITY still varies by the density of its content region:
 * a presentation region shows more background; a dense form/settings region uses a
 * more opaque, readable surface. Ordered least-dense -> densest.
 */
export type SurfaceDensity = "presentation" | "comfortable" | "dense";

/** The densities in order (least dense / most translucent -> densest / most opaque). */
export const SURFACE_DENSITIES: readonly SurfaceDensity[] = [
  "presentation",
  "comfortable",
  "dense",
] as const;

/** The full per-package surface token set. */
export interface SurfaceTokenSet {
  /** Glass-forward (galaxy) vs flat/opaque (standard). */
  glass: boolean;
  /** The palette token the surface tint draws from. */
  tintTokenKey: SurfaceColorTokenKey;
  /** The palette token the surface border draws from (luminous vs plain). */
  borderTokenKey: SurfaceColorTokenKey;
  /** The palette token the subtle glow draws from, or null (flat = no glow). */
  glowTokenKey: SurfaceColorTokenKey | null;
  /** Opacity per density — MONOTONIC non-decreasing (denser -> more opaque). */
  densityOpacity: Record<SurfaceDensity, number>;
  /**
   * The rendered live tint opacity. Pinned to the least-dense (most translucent,
   * AA worst-case) density opacity; ALWAYS >= `fallbackTintOpacity`.
   */
  liveGlassTintOpacity: number;
  /**
   * The semi-opaque tinted FALLBACK opacity used when blur is unaffordable — the
   * guaranteed-readable, AA-checked bound. <= `liveGlassTintOpacity`.
   */
  fallbackTintOpacity: number;
}

/**
 * The per-package surface tokens.
 *
 * Galaxy: glass-forward — a translucent `surface` tint (band 0.88 -> 0.97 by
 * density) with a luminous `borderStrong` border and a subtle `accent` glow.
 * Standard: flat — a near-opaque `surface` tint (band 0.97 -> 1.0) with a plain
 * `border` and no glow. The opacity bands keep every text/status foreground AA over
 * the composited surface (asserted per asset in surface.test.ts).
 */
export const SURFACE: Record<ThemePackage, SurfaceTokenSet> = {
  galaxy: {
    glass: true,
    tintTokenKey: "surface",
    borderTokenKey: "borderStrong",
    glowTokenKey: "accent",
    // The OPAQUE band — used when the mode does NOT match the art tone (galaxy art
    // is dark, so this applies in LIGHT mode) to keep text readable. In the matched
    // regime the card goes glassy instead (see CARD_GLASS_OPACITY / cardTintOpacity).
    densityOpacity: { presentation: 0.88, comfortable: 0.93, dense: 0.97 },
    liveGlassTintOpacity: 0.88,
    fallbackTintOpacity: 0.88,
  },
  standard: {
    glass: false,
    tintTokenKey: "surface",
    borderTokenKey: "border",
    glowTokenKey: null,
    // The OPAQUE band — applied when mode does NOT match the art tone (standard art
    // is light, so this applies in DARK mode). Matched (light mode) goes glassy.
    densityOpacity: { presentation: 0.97, comfortable: 0.99, dense: 1.0 },
    liveGlassTintOpacity: 0.97,
    fallbackTintOpacity: 0.97,
  },
};

/** The surface opacity for a package at a given content density. */
export function surfaceOpacityForDensity(
  themePackage: ThemePackage,
  density: SurfaceDensity,
): number {
  return SURFACE[themePackage].densityOpacity[density];
}

/**
 * GLASSY CARDS (31.1-06) — mode-aware card tint so the selected background shows
 * THROUGH the content, not just the gutters.
 *
 * A card's tint opacity is the SAME thing that backs its text, so a translucent
 * card only stays readable when the background ART TONE matches the mode: galaxy
 * art is dark (readable glassy in DARK mode — light text over dark art), standard
 * art is light (readable glassy in LIGHT mode — dark text over light art). In the
 * MISMATCHED regime (galaxy-in-light, standard-in-dark — the cross-combos the
 * owner's parked theme-merge would retire) a glassy card would put text over a
 * mismatched-tone composite and fail AA, so the card falls back to the OPAQUE band
 * (`SURFACE.densityOpacity`) and stays readable. `surface.test.ts` proves AA per
 * asset for BOTH regimes across all four package×mode combos.
 *
 * TUNABLE: the matched-regime glass opacity (owner-approved near-transparent
 * galaxy cards, 2026-09-11). Standard is a touch higher (its light art needs a
 * little more tint under dark text).
 */
export const CARD_GLASS_OPACITY: Record<ThemePackage, number> = {
  galaxy: 0.05,
  // Standard's mid-tone assets (Dusk/Mesh) under dark secondary text set the floor;
  // 0.5 clears AA there while still far more transparent than the old 0.97 slab.
  standard: 0.5,
};

/**
 * True when the resolved mode matches the package's background art tone, so a
 * glassy (translucent) card stays text-readable. galaxy↔dark, standard↔light.
 */
export function cardMatchesMode(
  themePackage: ThemePackage,
  mode: ResolvedMode,
): boolean {
  return themePackage === "galaxy" ? mode === "dark" : mode === "light";
}

/**
 * The card tint opacity: glassy in the matched regime (art tone matches mode),
 * else the opaque density band so text stays readable over a mismatched art.
 */
export function cardTintOpacity(
  themePackage: ThemePackage,
  mode: ResolvedMode,
  density: SurfaceDensity,
): number {
  return cardMatchesMode(themePackage, mode)
    ? CARD_GLASS_OPACITY[themePackage]
    : SURFACE[themePackage].densityOpacity[density];
}

/**
 * BACKGROUND VEIL (31.1-05 / D-31.1-05-A) — the opacity of the `BackgroundHost`
 * full-screen scrim, DECOUPLED from the card `densityOpacity` above.
 *
 * The shipped 31.1 host reused `surfaceOpacityForDensity` (0.88–1.00) as a
 * full-screen wash, which left only 0–12% of the selected art visible and made
 * every selection look identical on regular screens (owner production-release
 * failure). Card readability does NOT come from this veil — it comes from the
 * per-card `GlassSurface` tint that text sits on (the AA proof in
 * `surface.test.ts` composites text over `card-tint over the asset`, never over
 * this host scrim). So the veil can be much lighter to reveal the art, while
 * bare-on-background CHROME (app bar, section headings, empty states) gets its
 * own local backing (`CHROME_SCRIM_OPACITY`) instead of depending on the veil.
 *
 * TUNABLE (CLAUDE.md): these are the single-number knobs tuned on-device. Kept
 * MONOTONIC non-decreasing (denser -> more veil -> less art) and bounded so every
 * package/density still shows a visible slice of the selected background — the
 * `surface.test.ts` visibility-floor guard fails if that regresses toward 0.
 */
export const BACKGROUND_VEIL_OPACITY: Record<
  ThemePackage,
  Record<SurfaceDensity, number>
> = {
  // Galaxy art is dark; light text stays high-contrast over it, so the veil is
  // light and the deep-space art reads prominently between cards (owner asked for
  // more background — tuned lighter 2026-09-11).
  galaxy: { presentation: 0.02, comfortable: 0.1, dense: 0.22 },
  // Standard art includes mid-tone assets (Dusk/Mesh); a touch heavier than
  // galaxy and dense forms lean calmer, but art shows generously on browse screens.
  standard: { presentation: 0.05, comfortable: 0.14, dense: 0.3 },
};

/**
 * The minimum fraction of the selected background art that must remain visible
 * (1 - veil) at each density — the anti-regression floor for the shipped bug.
 * Presentation (browse) screens must show a clearly present background; dense
 * (form/settings) screens may wash more for readability but never to ~zero.
 */
export const MIN_BACKGROUND_CONTRIBUTION: Record<SurfaceDensity, number> = {
  presentation: 0.4,
  comfortable: 0.3,
  dense: 0.2,
};

/** The `BackgroundHost` veil opacity for a package at a given content density. */
export function backgroundVeilOpacity(
  themePackage: ThemePackage,
  density: SurfaceDensity,
): number {
  return BACKGROUND_VEIL_OPACITY[themePackage][density];
}

/**
 * CHROME SCRIM (31.1-05) — the opacity of a LOCAL surface-tinted backing drawn
 * behind bare-on-background "chrome" text (app bar title/back, the dashboard
 * count, section headings, empty states) that does NOT sit on a `GlassSurface`
 * card. With the veil lightened (above), this chrome would otherwise sit on raw
 * art; the local scrim keeps it AA-readable independent of the veil, so the veil
 * can stay light. Reuses `colors.surface` as the tint (like cards). Set to the
 * MINIMUM that keeps text/status foregrounds AA over the scrim composited on each
 * asset's brightest pixel — `surface.test.ts` proves it per asset/package/mode.
 *
 * MODE-AWARE (31.1-06): like the cards, the chrome backing goes glassy in the
 * matched regime (art tone matches mode) so the app bar / bare chrome stays
 * consistent with the glassy content, and opaque in the mismatched regime so bare
 * text stays readable. It reuses `cardTintOpacity` at the densest (most opaque,
 * worst-case) step for a little extra backing under bare text with no card.
 */
export function chromeScrimOpacity(
  themePackage: ThemePackage,
  mode: ResolvedMode,
): number {
  return cardTintOpacity(themePackage, mode, "dense");
}

/**
 * The token-only surface style `GlassSurface` consumes. Every colour field is a
 * palette-token KEY (resolved to a real colour by the component via `useTheme()`),
 * every opacity a declared token value — no raw colour, no ad-hoc opacity.
 */
export interface SurfaceStyle {
  /** Glass-forward vs flat. */
  glass: boolean;
  /** Whether to actually render expo-blur (glass AND the platform affords it). */
  useBlur: boolean;
  /** Palette-token key for the surface tint. */
  tintTokenKey: SurfaceColorTokenKey;
  /** Palette-token key for the border. */
  borderTokenKey: SurfaceColorTokenKey;
  /** Palette-token key for the glow, or null (flat). */
  glowTokenKey: SurfaceColorTokenKey | null;
  /** The live tint opacity to apply (>= fallbackTintOpacity). */
  liveGlassTintOpacity: number;
  /** The fallback tint opacity (blur unavailable). */
  fallbackTintOpacity: number;
}

/**
 * Resolve the surface style for a package. PURE — returns ONLY declared SURFACE
 * token fields (palette-token keys + declared opacities + flags), so a component
 * cannot smuggle a colour/opacity literal past the check:colors location exemption.
 * `blurAvailable=false` (or a flat package) yields `useBlur=false` -> the tinted
 * fallback path.
 */
export function resolveSurfaceStyle(
  themePackage: ThemePackage,
  blurAvailable: boolean,
): SurfaceStyle {
  const t = SURFACE[themePackage];
  return {
    glass: t.glass,
    useBlur: t.glass && blurAvailable,
    tintTokenKey: t.tintTokenKey,
    borderTokenKey: t.borderTokenKey,
    glowTokenKey: t.glowTokenKey,
    liveGlassTintOpacity: t.liveGlassTintOpacity,
    fallbackTintOpacity: t.fallbackTintOpacity,
  };
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function toChannels(hex: string): [number, number, number] {
  if (!HEX_RE.test(hex)) {
    throw new Error(`alphaComposite: expected #RRGGBB, got ${String(hex)}`);
  }
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(c: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(c)));
  return clamped.toString(16).padStart(2, "0");
}

/**
 * Composite an opaque `fg` over an opaque `bg` with `fg` alpha in [0, 1], returning
 * the resulting opaque `#RRGGBB`. This models the rendered surface: the semi-opaque
 * tint (`fg` @ alpha) drawn over the background/asset pixel (`bg`). Used by the
 * surface.test AA proofs; also the reference math for GlassSurface's live tint.
 */
export function alphaComposite(fg: string, bg: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const [fr, fg_, fb] = toChannels(fg);
  const [br, bg_, bb] = toChannels(bg);
  const r = fr * a + br * (1 - a);
  const g = fg_ * a + bg_ * (1 - a);
  const b = fb * a + bb * (1 - a);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
