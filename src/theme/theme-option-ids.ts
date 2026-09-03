/**
 * Canonical theme option-id source (THEME-02 / THEME-04, REVIEWS 23-01 cycle-4).
 *
 * The SINGLE place the accepted accent ids and background slot ids are declared.
 * The `app-settings-dao` validators (`assertAccentId` / `assertBackgroundId`)
 * CONSUME these arrays via `.includes()` — exactly the `assertAiProvider` /
 * `AI_PROVIDER_IDS` idiom (app-settings-dao.ts) — and Plans 03 (`accents.ts`) /
 * 06 (`backgrounds.ts`) IMPORT these SAME constants to key their resolver maps
 * rather than re-declaring a parallel list, so the DAO's accepted-id set and each
 * resolver's known-id set cannot drift in either direction.
 *
 * This module imports NOTHING — no `react-native`, no db layer — so it stays
 * node-testable and importing it from the theme resolvers creates no
 * theme->db layering inversion. It holds ONLY ids (no colour hexes), so
 * `check:colors` never trips on it even though it lives under `/theme/`.
 */

/**
 * The accepted accent ids (THEME-02). ~8 curated choices; Plan 03's `accents.ts`
 * keys its per-mode tone map (`{ fill, onAccent, text }`) by exactly these ids,
 * with `nebula-blue` the Galaxy default and `slate-indigo` the Standard default
 * (applied when the stored per-package accent is NULL). The accent set is
 * Claude's discretion (23-CONTEXT D-32); the hex tones live in `accents.ts`.
 */
export const ACCENT_IDS = [
  "nebula-blue",
  "slate-indigo",
  "aurora-teal",
  "solar-amber",
  "rose-quartz",
  "violet-haze",
  "emerald",
  "coral",
] as const;

/** A validated accent id (a member of `ACCENT_IDS`). NULL = package default. */
export type AccentId = (typeof ACCENT_IDS)[number];

/**
 * The accepted background slot ids (THEME-04). `none` is the explicit None/Solid
 * slot (resolves to the solid theme background); the remaining ids are the
 * per-package bundled backgrounds Plan 06's `backgrounds.ts` maps to local
 * `require()` assets. A stored NULL resolves to the package default at render.
 */
export const BACKGROUND_SLOT_IDS = [
  "none",
  "galaxy-nebula",
  "galaxy-deep-space",
  "galaxy-aurora",
  "galaxy-starfield",
  "standard-dawn",
  "standard-dusk",
  "standard-mesh",
  "standard-paper",
] as const;

/** A validated background slot id (a member of `BACKGROUND_SLOT_IDS`). */
export type BackgroundSlotId = (typeof BACKGROUND_SLOT_IDS)[number];
