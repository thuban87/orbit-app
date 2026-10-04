import type {
  ResolvedMode,
  SystemScheme,
  ThemeMode,
  ThemePackage,
  ThemePalette,
  ThemePreset,
} from "./theme-types";

/**
 * The theme presets — THE SINGLE PLACE in the codebase where a colour hex
 * literal may appear (CLAUDE.md: all colours resolve through theme tokens).
 * Every other module reads colours via `useTheme().colors.*`.
 *
 * Re-keyed onto the PACKAGE axis (THEME-01). `galaxy` is the former `space-dark`
 * palette (dark-first, owner-approved seeds intact) now joined by an authored
 * galaxy LIGHT palette; `standard` is the second package with authored dark AND
 * light palettes (calmer/flatter than galaxy's deep-space glass). Plan 03
 * completes all four palettes so `ThemePreset.light` is REQUIRED and the resolver
 * dark-fallback is retired. Galaxy stays glass-forward/deep-space; Standard is
 * flatter. Every palette carries the FULL token set plus the accent overlay trio
 * (accent=fill/onAccent/accentText, seeded with the package default accent tone)
 * and the destructive pair (danger/onDanger). Status hue FAMILIES stay
 * recognizable across all four (Stable teal-green / Wobble gold / Decay coral /
 * Rogue amber) with per-palette luminance retuned for AA contrast. Owner-approved
 * galaxy-dark hues are INFRASTRUCTURE seeds the owner may retune (HANDOFF §7+Q4);
 * the newly-authored palettes are AA-tuned at Claude's discretion (23-CONTEXT).
 */
/**
 * 38.7-14 (D-26/D-27, owner item T-GLIGHT: "galaxy light should have more
 * flavor"): candidate Galaxy Light Orrery skies. No lab built a Galaxy Light
 * flavour, so the owner picks between rendered candidates; the single
 * constant ACTIVE_GALAXY_LIGHT_FLAVOUR selects one. Only the Orrery sky
 * tokens differ (the app's other Galaxy Light tokens are untouched), and the
 * contrast proofs bound every one (they composite over pure black and white).
 *   - "lab-b" (GL-A, the baseline): Lab B's light vellum sky with Plan 09's
 *     cool lavender washes — today's look.
 *   - "dark-hues" (GL-B): the same sky with Galaxy Dark's own nebula hues as
 *     the wash inks (deeper blue / violet / teal) and its star hues deepened
 *     into ink specks (navy, blue, gold, cyan).
 *   - "warm-violet" (GL-C): a warmer lavender sky with violet / rose / amber
 *     washes and plum-violet specks.
 */
export type GalaxyLightFlavour = "lab-b" | "dark-hues" | "warm-violet";
export type OrrerySkyTokens = Pick<
  ThemePalette,
  | "orrerySkyBase"
  | "orrerySkyHorizon"
  | "orreryNebula"
  | "orrerySkyStars"
  | "orreryOcclusion"
>;
export const GALAXY_LIGHT_FLAVOURS: Readonly<
  Record<GalaxyLightFlavour, OrrerySkyTokens>
> = {
  "lab-b": {
    orrerySkyBase: "#E8ECFA",
    orrerySkyHorizon: "#D6DDF6",
    orreryNebula: ["#9DAEEA", "#C0A6E8", "#98CDE2"],
    orrerySkyStars: ["#515A78", "#3F4A8C", "#6B5A9E"],
    orreryOcclusion: "#E8ECFA",
  },
  "dark-hues": {
    orrerySkyBase: "#E8ECFA",
    orrerySkyHorizon: "#D6DDF6",
    orreryNebula: ["#3E52A8", "#6A4FAE", "#2E708E"],
    orrerySkyStars: ["#3F4A8C", "#4A63C9", "#9A7420", "#2E7FA8"],
    orreryOcclusion: "#E8ECFA",
  },
  "warm-violet": {
    orrerySkyBase: "#EEEAF8",
    orrerySkyHorizon: "#DDD3F1",
    orreryNebula: ["#9C84D8", "#D58FBF", "#E9B07E"],
    orrerySkyStars: ["#4F3F86", "#7A4F9E", "#9E5A6E"],
    orreryOcclusion: "#EEEAF8",
  },
};
/**
 * The Galaxy Light sky in use. Owner ruling 2026-10-04 (T-GLIGHT = GB-125):
 * "dark-hues" (Galaxy Dark's nebula hues), drawn at 1.25x today's nebula
 * strength (`SKY_LOOKS.galaxy.light.nebulaStrength`). The other candidates
 * stay selectable here for later tuning (the owner saw them; not in use).
 */
export const ACTIVE_GALAXY_LIGHT_FLAVOUR: GalaxyLightFlavour = "dark-hues";

export const THEME_PRESETS: Record<ThemePackage, ThemePreset> = {
  galaxy: {
    id: "galaxy",
    name: "Galaxy",
    dark: {
      background: "#0B0E1A",
      surface: "#141828",
      surfaceElevated: "#1D2235",
      profileBackgroundScrim: "#0B0E1AB8",
      // Accent OVERLAY trio, seeded with the galaxy default accent (nebula-blue)
      // dark tone; the provider overlays the active accent at render (Plan 03).
      // fill stays #6C8CFF (the former single `accent`) so existing consumers see
      // no regression; onAccent is a deep navy (AA >=4.5 on the fill), accentText
      // the nebula-blue link tone (AA >=4.5 on the dark background/surface).
      accent: "#6C8CFF",
      onAccent: "#0A1330",
      accentText: "#8FA6FF",
      textPrimary: "#E6E9F5",
      textSecondary: "#8B93B0",
      textPlaceholder: "#8B93B0",
      border: "#2A3048",
      borderStrong: "#3C4568",
      // Destructive FILL (owner-approved #E5484D, 2026-08-14) — immovable owner
      // hue. `onDanger` is the conventional near-white destructive label; on this
      // fixed fill it measures ≈3.91:1 (below AA-normal), an OWNER-DECISION flag
      // recorded in the SUMMARY, NEVER auto-retuned (REVIEWS 23-03/23-07 cycle-4).
      danger: "#E5484D",
      onDanger: "#FFFFFF",
      // Deterministic avatar swatch set (PHOTO-04). 8 muted, deep-space-harmonised
      // hues distinguishable on the #0B0E1A background (UI-SPEC seeds — an
      // infrastructure default, owner-tunable like the rest of space-dark). The
      // avatar indexes this by `abs(hash(name)) % 8`; order is stable so a
      // person's colour never shifts. Never reorder without accepting that every
      // existing contact's swatch changes.
      avatarSwatches: [
        "#5B6CB8",
        "#4E8A8A",
        "#8A6BB0",
        "#B07A5B",
        "#5B9E6B",
        "#B05B7A",
        "#9E9E5B",
        "#5B8AB0",
      ],
      // One near-white foreground for the initials glyph on every swatch above.
      avatarSwatchText: "#F2F4FB",
      // In-app rogue status-label hue (owner-approved 2026-08-15) — an amber
      // attention colour legible on #0B0E1A and deliberately distinct from accent
      // (#6C8CFF) and danger (#E5484D): rogue is a STATUS, not a destructive
      // action. Infrastructure seed, owner-tunable like the rest of space-dark.
      rogue: "#E0904A",
      // Shared app-wide STATUS hues (owner-approved 2026-08-16, UI-SPEC ⭐). The
      // three net-new status tokens joining `rogue`, consumed by the dashboard
      // ContactCard, the Phase-12 widget bitmap, and the Phase-13 orrery — one
      // source of truth. stable = teal-green healthy orbit; wobble = gold caution;
      // decay = coral "act now" (orange-shifted off danger #E5484D so status ≠
      // destructive action). Owner-tunable like the other seeds; the #F07A3D decay
      // alternative was considered and declined.
      statusStable: "#45B98A",
      statusWobble: "#E8C15C",
      statusDecay: "#E56A52",
      // Ordered gravity-tier ramp (owner-approved 2026-08-15), ONE entry per tier
      // (thin→deep), indexed by gravity tierIndex in Plan 06-05's GravityBar.
      // Deep-space-harmonised seeds ascending in warmth/weight; ORDER IS STABLE —
      // reordering restyles every tier. Infrastructure seed, owner-tunable.
      gravityTiers: ["#4E5A7A", "#5B8AB0", "#5B9E8A", "#C9A24E"],
      // Ordered SELF-SUN star palette (ORR-05, UI-SPEC seeds — design-pass
      // defaults, owner-tunable §12.4 like avatarSwatches/gravityTiers). Six
      // astronomy-grounded spectral hues; gold at index 0 is the default self-sun
      // that resolves `self_sun_colour = NULL` at render. Rose-red is nudged off
      // statusDecay (#E56A52) and cyan off accent (#6C8CFF) so neither reads as a
      // status/accent. EVERY entry is a 6-digit hex — a tapped swatch is written
      // to self_sun_colour, whose DAO validator rejects anything else (M6). ORDER
      // IS STABLE — reordering restyles every self-sun.
      starPalette: [
        "#F2C14E",
        "#E8944A",
        "#D96B7C",
        "#A98BE0",
        "#5CC6F0",
        "#DCE6FF",
      ],
      // Desaturated same-hue morph endpoints (ORR-04, UI-SPEC seeds) — the low-
      // saturation (NOT greyscale) colour each live status body fades toward in
      // the orrery relationship morph. Owner-tunable like the other seeds.
      mutedStable: "#7A9E92",
      mutedWobble: "#C4B98F",
      mutedDecay: "#C79285",
      // Cold, dark EXTINGUISHED-ROGUE body fill (ORR-04, UI-SPEC seed). The rogue
      // planet BODY uses this blue-grey; the rogue RING keeps the warm `rogue`
      // amber (#E0904A) at faint-trace opacity. Owner-tunable.
      rogueExtinguished: "#3E4A6B",
      // Activity Heatmap count-saturation ramp (HIST-02). Luminous nebula-blue
      // ramp: [0] a faint blue-tinted plate for a REAL zero-count day (distinct
      // from surface #141828 AND from the transparent structural blank below);
      // [1..4] rise toward a bright nebula-blue. ORDER-STABLE. Owner-tunable seed.
      heatmapScale: ["#1A2138", "#2E3E6E", "#42579E", "#5A78D6", "#8AA6FF"],
      // Structural out-of-window blank (Month/Year padding) — transparent so the
      // section background shows through and it never reads as a zero-count day.
      heatmapCellEmpty: "#00000000",
      // History markers: filled interaction dot (nebula-blue family) vs a neutral
      // ring stroke for lifecycle-only dates (silhouette is the primary cue).
      markerInteraction: "#8FA6FF",
      markerLifecycle: "#8B93B0",
      // ── Orrery V2 sub-palette (38.7 D-51) ── Galaxy Dark: a DEEPER navy sky
      // than Standard's graphite (D-27), more visible stars than Lab A and a
      // much quieter nebula (D-07: blue/violet/teal washes at low alpha).
      // Reticle/instrument seed the default accent fill (applyAccent overlays).
      orrerySkyBase: "#070A16",
      orrerySkyHorizon: "#121A36",
      orreryNebula: ["#3E52A8", "#6A4FAE", "#2E708E"],
      orrerySkyStars: ["#E6E9F5", "#BCC8F2", "#F2DCAE", "#A4D6F2"],
      // 12 luminous per-System tints for the additive (screen) sky wash.
      orrerySystemHues: [
        "#5B7CFF",
        "#7E5BFF",
        "#B45BE6",
        "#E05BA8",
        "#E0705B",
        "#E0A75B",
        "#CBC45B",
        "#7ECB5B",
        "#4FCB8C",
        "#4FC4CB",
        "#4FA0E6",
        "#8FA0CB",
      ],
      orreryGrid: "#8B93B0",
      orreryRingLight: "#FFF3DC",
      orreryPulse: "#E8EDFF",
      orreryRim: "#DCE6FF",
      orreryGlow: "#9FB4FF",
      orreryReticle: "#6C8CFF",
      orreryInstrument: "#6C8CFF",
      orreryWarp: "#DCE6FF",
      orreryOcclusion: "#070A16",
    },
    // GALAXY LIGHT (authored Plan 03) — a light deep-space treatment: cool
    // off-white surfaces, deep-navy text, deeper accent/status hues retuned so
    // every gated pair meets AA on a near-white background. Same layout/IA as
    // galaxy dark; status hue FAMILIES preserved (stable green / wobble gold /
    // decay coral / rogue amber), darkened for contrast.
    light: {
      background: "#EDF0F9",
      surface: "#FBFCFE",
      surfaceElevated: "#FFFFFF",
      profileBackgroundScrim: "#EDF0F9B8",
      // nebula-blue LIGHT default tone: a deeper blue fill (white onAccent AA on
      // it) with an even deeper accentText tone (AA >=4.5 on the light surfaces).
      accent: "#3355E6",
      onAccent: "#FFFFFF",
      accentText: "#2A46C7",
      textPrimary: "#1A1F33",
      textSecondary: "#515A78",
      textPlaceholder: "#515A78",
      border: "#D2D9EA",
      borderStrong: "#B4BFD8",
      // Authored destructive pair (AA path): a deep red fill so near-white
      // onDanger AND danger-as-text both clear AA on the light surfaces.
      danger: "#B21D22",
      onDanger: "#FFFFFF",
      avatarSwatches: [
        "#3F5199",
        "#2F6E6E",
        "#6B4F91",
        "#915B3F",
        "#3F7E4F",
        "#913F5B",
        "#7E7E3F",
        "#3F6B91",
      ],
      // One near-white glyph foreground for the (mid-tone) avatar swatches above.
      avatarSwatchText: "#FBFCFE",
      // Rogue attention amber, darkened for the light background.
      rogue: "#9A5B14",
      // Status hue families, darkened to clear AA-large on near-white surfaces.
      statusStable: "#1E7D5A",
      statusWobble: "#8A6A12",
      statusDecay: "#B33A22",
      gravityTiers: ["#9AA6C4", "#5B7FB0", "#3F8E76", "#A07E28"],
      // Star palette (owner/sun hues) is theme-independent — same curated set,
      // gold at index 0. Every entry a 6-digit hex (self_sun_colour validator).
      starPalette: [
        "#F2C14E",
        "#E8944A",
        "#D96B7C",
        "#A98BE0",
        "#3F9ECC",
        "#5A73B8",
      ],
      mutedStable: "#5E8A78",
      mutedWobble: "#9A8654",
      mutedDecay: "#A87264",
      rogueExtinguished: "#8892A8",
      // Activity Heatmap ramp, galaxy LIGHT: ascending = deeper/more-saturated on
      // the near-white background. [0] a faint plate for a REAL zero-count day
      // (distinct from surface #FBFCFE and the transparent structural blank);
      // [1..4] deepen toward the light-mode nebula-blue accent (#3355E6).
      heatmapScale: ["#DDE3F5", "#B9C6F0", "#8CA0E6", "#5B72D6", "#3355E6"],
      heatmapCellEmpty: "#00000000",
      markerInteraction: "#2A46C7",
      markerLifecycle: "#515A78",
      // Orrery sub-palette, Galaxy Light (D-26: Lab B's light sky, with its own
      // flavour so it differs from Standard Light). Light modes draw ink tokens
      // with src-over. 38.7-14: the sky tokens (base, horizon, nebula, sky
      // stars, occlusion) come from the selected T-GLIGHT candidate.
      ...GALAXY_LIGHT_FLAVOURS[ACTIVE_GALAXY_LIGHT_FLAVOUR],
      // 12 deeper per-System tints (src-over ink washes on the light sky).
      orrerySystemHues: [
        "#3355E6",
        "#5B3FC7",
        "#8A3FB0",
        "#B03F7A",
        "#B04A30",
        "#A0701A",
        "#7E7A12",
        "#3F8A2A",
        "#1E8A5A",
        "#1A7E86",
        "#2A6EB0",
        "#5A6A94",
      ],
      orreryGrid: "#515A78",
      orreryRingLight: "#1A1F33",
      orreryPulse: "#26304F",
      orreryRim: "#FFFFFF",
      orreryGlow: "#C98A1A",
      orreryReticle: "#3355E6",
      orreryInstrument: "#3355E6",
      orreryWarp: "#3355E6",
    },
  },
  // The SECOND package — a calmer, FLATTER treatment vs galaxy's deep-space
  // glass. Authored dark AND light palettes (Plan 03), each a distinct full
  // palette so the package axis resolves to four distinct palettes.
  standard: {
    id: "standard",
    name: "Standard",
    dark: {
      background: "#101216",
      surface: "#191C22",
      surfaceElevated: "#242830",
      profileBackgroundScrim: "#101216C4",
      // slate-indigo DARK default tone (Standard default accent): calmer than
      // galaxy's nebula-blue. fill with a deep onAccent (AA on fill) + a light
      // indigo accentText (AA on the dark surfaces).
      accent: "#8091D6",
      onAccent: "#0C1130",
      accentText: "#9AA8E0",
      textPrimary: "#E9ECF1",
      textSecondary: "#9AA1AD",
      textPlaceholder: "#9AA1AD",
      border: "#2E333C",
      borderStrong: "#424956",
      // Authored destructive pair (AA path): a light red fill so danger-as-text
      // clears AA on the dark surfaces, with a near-black onDanger (AA on the
      // light-red fill — a single `danger` hex cannot be light-for-text AND
      // dark-enough for white-onDanger on a dark palette, so onDanger goes dark).
      danger: "#FF6B6B",
      onDanger: "#1A0606",
      avatarSwatches: [
        "#6472A0",
        "#4F8785",
        "#8570A6",
        "#A5795F",
        "#5F9668",
        "#A55F76",
        "#96965F",
        "#5F84A5",
      ],
      avatarSwatchText: "#F1F3F7",
      rogue: "#DA9350",
      statusStable: "#4BB08A",
      statusWobble: "#E2C065",
      statusDecay: "#EA7059",
      gravityTiers: ["#535D74", "#5F84A5", "#5F9686", "#BE9E56"],
      starPalette: [
        "#F2C14E",
        "#E8944A",
        "#D96B7C",
        "#A98BE0",
        "#5CC6F0",
        "#DCE6FF",
      ],
      mutedStable: "#7E9A90",
      mutedWobble: "#BFB488",
      mutedDecay: "#C08E82",
      rogueExtinguished: "#414957",
      // Activity Heatmap ramp, standard DARK: a flatter slate-indigo ramp (calmer
      // than galaxy's luminous one). [0] a faint plate for a REAL zero-count day
      // (distinct from surface #191C22 and the transparent structural blank);
      // [1..4] rise toward the slate-indigo accent (#8091D6).
      heatmapScale: ["#1C2130", "#333E63", "#4A5891", "#6675C0", "#9AA8E0"],
      heatmapCellEmpty: "#00000000",
      markerInteraction: "#9AA8E0",
      markerLifecycle: "#9AA1AD",
      // Orrery sub-palette, Standard Dark: Lab B's calm graphite chart sky
      // (STANDARD_DARK_ENV — barely-there clouds, crisp sparse stars), the
      // calm default feel of D-07.
      orrerySkyBase: "#0C0E12",
      orrerySkyHorizon: "#181B22",
      orreryNebula: ["#3B4459", "#4A4262"],
      orrerySkyStars: ["#E9ECF1", "#B0B8C6", "#CAD3E8"],
      orrerySystemHues: [
        "#6F86E0",
        "#8A6FE0",
        "#B06FD0",
        "#D06FA4",
        "#D07F6F",
        "#D0A86F",
        "#C2BC6F",
        "#86C26F",
        "#64C292",
        "#64BAC2",
        "#64A0D6",
        "#929EBE",
      ],
      orreryGrid: "#9AA1AD",
      orreryRingLight: "#FFF3DC",
      orreryPulse: "#E9ECF1",
      orreryRim: "#E9ECF1",
      orreryGlow: "#E2C065",
      orreryReticle: "#8091D6",
      orreryInstrument: "#8091D6",
      orreryWarp: "#CAD3E8",
      orreryOcclusion: "#0C0E12",
    },
    // STANDARD LIGHT (authored Plan 03) — a flat, calm light palette: neutral
    // off-white surfaces, near-black text, deeper accent/status hues retuned for
    // AA on a near-white background.
    light: {
      background: "#F2F3F6",
      surface: "#FFFFFF",
      surfaceElevated: "#FDFDFE",
      profileBackgroundScrim: "#F2F3F6C4",
      // slate-indigo LIGHT default tone.
      accent: "#4453B0",
      onAccent: "#FFFFFF",
      accentText: "#3C4AA0",
      textPrimary: "#1B1E26",
      textSecondary: "#565D6B",
      textPlaceholder: "#565D6B",
      border: "#DADEE6",
      borderStrong: "#BCC3CF",
      // Authored destructive pair (AA path): deep red fill; near-white onDanger
      // and danger-as-text both clear AA on the light surfaces.
      danger: "#B21D22",
      onDanger: "#FFFFFF",
      avatarSwatches: [
        "#48568F",
        "#356B6B",
        "#6E5590",
        "#8F5B48",
        "#3F7E4F",
        "#8F485F",
        "#7E7E3F",
        "#48688F",
      ],
      avatarSwatchText: "#FFFFFF",
      rogue: "#96591A",
      statusStable: "#1E7D5A",
      statusWobble: "#836612",
      statusDecay: "#B33A22",
      gravityTiers: ["#A2ADBE", "#5F84A5", "#3F8E76", "#A0902E"],
      starPalette: [
        "#F2C14E",
        "#E8944A",
        "#D96B7C",
        "#A98BE0",
        "#3F9ECC",
        "#5A73B8",
      ],
      mutedStable: "#5E8A78",
      mutedWobble: "#94824E",
      mutedDecay: "#A87264",
      rogueExtinguished: "#7E889C",
      // Activity Heatmap ramp, standard LIGHT: a flat slate-indigo ramp deepening
      // on the near-white background. [0] a faint plate for a REAL zero-count day
      // (distinct from surface #FFFFFF and the transparent structural blank);
      // [1..4] deepen toward the light-mode slate-indigo accent (#4453B0).
      heatmapScale: ["#E0E3F0", "#BCC3E6", "#8F9AD2", "#6070BE", "#4453B0"],
      heatmapCellEmpty: "#00000000",
      markerInteraction: "#3C4AA0",
      markerLifecycle: "#565D6B",
      // Orrery sub-palette, Standard Light: Lab B's light-mode sky (LIGHT_ENV —
      // low-contrast ink washes, sparse ink-speck stars, no glow).
      orrerySkyBase: "#F2F3F6",
      orrerySkyHorizon: "#E2E5EC",
      orreryNebula: ["#C6CCDE", "#D4CCE2"],
      orrerySkyStars: ["#565D6B", "#7A8191"],
      orrerySystemHues: [
        "#4453B0",
        "#6A48B8",
        "#8E449E",
        "#A8446E",
        "#A85238",
        "#946A22",
        "#76721C",
        "#4A7E34",
        "#2A7E58",
        "#287480",
        "#3A68A0",
        "#5C6684",
      ],
      orreryGrid: "#565D6B",
      orreryRingLight: "#1B1E26",
      orreryPulse: "#2B3040",
      orreryRim: "#FFFFFF",
      orreryGlow: "#A0902E",
      orreryReticle: "#4453B0",
      orreryInstrument: "#4453B0",
      orreryWarp: "#4453B0",
      orreryOcclusion: "#F2F3F6",
    },
  },
};

/**
 * The default package used before any user selection (and outside a provider).
 * NAME kept as `DEFAULT_PRESET_ID` so the headless widget consumer
 * (widget-colors.ts, ADR-042) and other by-name importers compile unchanged
 * across the package re-key; its value is now the `galaxy` package (= the former
 * space-dark palette), so `resolvePalette(DEFAULT_PRESET_ID, 'dark')` still
 * returns the identical dark palette the widget already rendered.
 */
export const DEFAULT_PRESET_ID: ThemePackage = "galaxy";

/**
 * Resolve a user-selected `ThemeMode` against the OS colour scheme. PURE — no
 * `react-native` import, so it unit-tests in the node Vitest env.
 *
 * When `mode` is `"system"`, ANY scheme value other than `"light"` (`"dark"`,
 * `"unspecified"`, `null`, `undefined`) resolves to the `"dark"` default. The
 * `systemScheme` param is typed `SystemScheme` (a superset of RN's
 * `ColorSchemeName`) so `useColorScheme()`'s return — including `"unspecified"`
 * — is assignable without coercion; narrowing it to `"light" | "dark" | null`
 * would reject `"unspecified"` (TS2345) and could silently invert the default.
 */
export function resolveMode(
  mode: ThemeMode,
  systemScheme: SystemScheme,
): ResolvedMode {
  return mode === "system"
    ? systemScheme === "light"
      ? "light"
      : "dark"
    : mode;
}

/**
 * Resolve a concrete palette for a package + resolved mode. PURE and TOTAL: with
 * all four palettes authored (Plan 03) and `ThemePreset.light` now REQUIRED,
 * every (package, mode) pair maps to exactly one distinct authored palette — the
 * former dark-fallback for a missing `light` is retired (`preset[mode]` is always
 * defined). The `?? DEFAULT_PRESET_ID` guard only defends an out-of-union package
 * argument, never a missing mode slot.
 */
export function resolvePalette(
  themePackage: ThemePackage,
  mode: ResolvedMode,
): ThemePalette {
  const preset =
    THEME_PRESETS[themePackage] ?? THEME_PRESETS[DEFAULT_PRESET_ID];
  return preset[mode];
}
