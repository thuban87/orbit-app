import type {
  ResolvedMode,
  SystemScheme,
  ThemeMode,
  ThemePalette,
  ThemePreset,
  ThemePresetId,
} from "./theme-types";

/**
 * The theme presets — THE SINGLE PLACE in the codebase where a colour hex
 * literal may appear (CLAUDE.md: all colours resolve through theme tokens).
 * Every other module reads colours via `useTheme().colors.*`.
 *
 * One space-dark preset ships this phase as INFRASTRUCTURE, not a finished
 * palette; the visual design is the owner's call (HANDOFF §7 + Q4).
 */
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  "space-dark": {
    id: "space-dark",
    name: "Deep Space",
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
    },
  },
};

/** The default preset used before any user selection (and outside a provider). */
export const DEFAULT_PRESET_ID: ThemePresetId = "space-dark";

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
 * Resolve a concrete palette for a preset + resolved mode. PURE. Falls back to
 * the preset's `dark` palette when the requested mode's palette is absent — so
 * with only a dark palette shipped this phase, `resolvePalette(id, "light")`
 * deterministically returns the dark palette (`"light"`/`"system"` are DEFINED,
 * never undefined).
 */
export function resolvePalette(
  presetId: ThemePresetId,
  mode: ResolvedMode,
): ThemePalette {
  const preset = THEME_PRESETS[presetId] ?? THEME_PRESETS[DEFAULT_PRESET_ID];
  return preset[mode] ?? preset.dark;
}
