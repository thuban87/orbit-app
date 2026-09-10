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
