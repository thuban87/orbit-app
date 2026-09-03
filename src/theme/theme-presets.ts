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
 * palette verbatim (dark-first, owner-approved seeds intact); `standard` is a
 * second package with a DISTINCT placeholder dark palette so the package axis
 * resolves to two different palettes — the full four-palette authoring (galaxy
 * light + standard dark/light) is Plan 03. These are INFRASTRUCTURE seeds, not a
 * finished visual design (the owner's call, HANDOFF §7 + Q4).
 */
export const THEME_PRESETS: Record<ThemePackage, ThemePreset> = {
  galaxy: {
    id: "galaxy",
    name: "Galaxy",
    dark: {
      background: "#0B0E1A",
      surface: "#141828",
      surfaceElevated: "#1D2235",
      accent: "#6C8CFF",
      textPrimary: "#E6E9F5",
      textSecondary: "#8B93B0",
      border: "#2A3048",
      borderStrong: "#3C4568",
      danger: "#E5484D",
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
  },
  // The SECOND package — a DISTINCT placeholder dark palette proving the package
  // axis resolves to two different palettes (resolvePalette('standard','dark') is
  // observably different from 'galaxy'). A neutral slate treatment, deliberately
  // cooler-flat vs galaxy's deep-space blues. Plan 03 authors the finished
  // standard palettes (dark + light) and galaxy-light; these are placeholders.
  standard: {
    id: "standard",
    name: "Standard",
    dark: {
      background: "#101216",
      surface: "#191C22",
      surfaceElevated: "#242830",
      accent: "#7C8DA6",
      textPrimary: "#E9ECF1",
      textSecondary: "#9AA1AD",
      border: "#2E333C",
      borderStrong: "#424956",
      danger: "#E5484D",
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
      statusWobble: "#DDBB63",
      statusDecay: "#DE6E57",
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
 * Resolve a concrete palette for a package + resolved mode. PURE. Falls back to
 * the package's `dark` palette when the requested mode's palette is absent — so
 * with only dark palettes shipped this phase, `resolvePalette(pkg, "light")`
 * deterministically returns the dark palette (`"light"`/`"system"` are DEFINED,
 * never undefined). Plan 03 authors the light palettes and makes `light`
 * required.
 */
export function resolvePalette(
  themePackage: ThemePackage,
  mode: ResolvedMode,
): ThemePalette {
  const preset =
    THEME_PRESETS[themePackage] ?? THEME_PRESETS[DEFAULT_PRESET_ID];
  return preset[mode] ?? preset.dark;
}
