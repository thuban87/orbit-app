/**
 * Semantic icon registry (THEME-09 / D-05, dossier §M) — the ONE centralized
 * source mapping semantic names to a base icon family. Screens import semantic
 * names ONLY (never a third-party Ionicons glyph name directly); there is never
 * a second icon source (D-05).
 *
 * Base family: Ionicons (via `@expo/vector-icons`), which ships matched
 * outline/filled pairs — those pairs ARE the state variants. Swapping to the
 * deferred custom Orbit family happens at THIS map only (do NOT build that
 * family now). The registry stores plain glyph STRINGS so this module stays
 * `react-native`-free and node-testable; the Ionicons-name TYPE validation is
 * enforced in `Icon.tsx` (which imports the real Ionicons) via `tsc --noEmit`
 * — passing an unregistered/invalid glyph fails the build there.
 *
 * PURE — only `import type` erasures; nothing from `react-native`.
 */
import type { TabParamList } from "@/navigation/types";
import type { ThemePalette } from "@/theme/theme-types";

/**
 * Semantic name -> { outline, filled } glyph pair. `Icon` picks `filled` for the
 * active state, `outline` otherwise. Distinct semantic names may legitimately
 * map to the same base glyph (e.g. `close` outline==filled, or `back`) — the KEY
 * is the semantic identity, not the glyph, so this is not a collision.
 *
 * Reserved by contract:
 *  - the four TAB identities: dashboard/orrery/backup/settings (TAB_ICON below
 *    maps the real `*Tab` route keys onto them);
 *  - the six StatusGlyph display names (status-*), one distinct silhouette per
 *    display state (Task 2 / THEME-08);
 *  - `warning` for Plan 07's Destructive button / ConfirmDialog.
 */
export const ICON_REGISTRY = {
  // ---- General screen icons (RESEARCH Pattern 4) ------------------------
  close: { outline: "close", filled: "close" },
  settings: { outline: "settings-outline", filled: "settings" },
  favorite: { outline: "heart-outline", filled: "heart" },
  search: { outline: "search-outline", filled: "search" },
  back: { outline: "chevron-back", filled: "chevron-back" },
  add: { outline: "add", filled: "add" },
  message: { outline: "chatbubble-outline", filled: "chatbubble" },
  call: { outline: "call-outline", filled: "call" },
  edit: { outline: "create-outline", filled: "create" },
  sparkle: { outline: "sparkles-outline", filled: "sparkles" },
  filter: { outline: "filter-outline", filled: "filter" },
  sort: { outline: "swap-vertical-outline", filled: "swap-vertical" },
  list: { outline: "list-outline", filled: "list" },
  grid: { outline: "grid-outline", filled: "grid" },
  "your-week": { outline: "calendar-outline", filled: "calendar" },
  "group-events": { outline: "people-outline", filled: "people" },
  "chevron-down": { outline: "chevron-down", filled: "chevron-down" },

  // ---- Tab identities (the four persistent destinations) ----------------
  // `settings` above doubles as the Settings tab identity (TAB_ICON maps it).
  dashboard: { outline: "home-outline", filled: "home" },
  orrery: { outline: "planet-outline", filled: "planet" },
  backup: { outline: "cloud-upload-outline", filled: "cloud-upload" },

  // ---- Plan 07 destructive affordance -----------------------------------
  warning: { outline: "warning-outline", filled: "warning" },

  // ---- Status display glyphs (Task 2 / THEME-08) ------------------------
  // Six DISTINCT silhouettes so status stays readable without colour.
  "status-stable": {
    outline: "checkmark-circle-outline",
    filled: "checkmark-circle",
  },
  "status-wobble": { outline: "time-outline", filled: "time" },
  "status-decay": { outline: "warning-outline", filled: "warning" },
  "status-rogue": { outline: "remove-circle-outline", filled: "remove-circle" },
  "status-neutral": { outline: "ellipse-outline", filled: "ellipse-outline" },
  "status-snoozed": { outline: "moon-outline", filled: "moon" },
} as const;

/** The registered semantic names. An unregistered name fails `tsc`. */
export type IconName = keyof typeof ICON_REGISTRY;

/**
 * The explicit semantic-name -> real route-key mapping (REVIEWS 23-05 LOW). The
 * `TabParamList` keys are the `*Tab`-suffixed forms (DashboardTab/OrreryTab/
 * BackupTab/SettingsTab), NOT the bare semantic words. Typing it
 * `Record<keyof TabParamList, IconName>` forces completeness — a new tab route
 * cannot compile without an icon, so retiring the ad-hoc TAB_GLYPHS map can
 * never leave a tab without a glyph.
 */
export const TAB_ICON: Record<keyof TabParamList, IconName> = {
  DashboardTab: "dashboard",
  OrreryTab: "orrery",
  BackupTab: "backup",
  SettingsTab: "settings",
};

/**
 * A string-valued tone union derived from `ThemePalette` (REVIEWS 23-05 cycle-4
 * MEDIUM). `avatarSwatches`/`gravityTiers`/`starPalette` are `readonly string[]`
 * (theme-types.ts), so a raw `keyof ThemePalette` tone could resolve
 * `colors[tone]` to an ARRAY — which Ionicons' string `color` prop cannot
 * consume. This mapped type keeps ONLY the keys whose value is a `string`, so
 * the three array members are excluded automatically and any FUTURE string
 * token is included with no edit here.
 */
export type IconTone = {
  [K in keyof ThemePalette]: ThemePalette[K] extends string ? K : never;
}[keyof ThemePalette];

/**
 * The narrower neutral/status tone subset `StatusGlyph` uses (REVIEWS 23-05
 * cycle-4 MEDIUM) — never a raw `keyof ThemePalette`. Every member is a
 * string-valued token, so `StatusTone extends IconTone` holds (asserted in the
 * test suite).
 */
export type StatusTone =
  | "statusStable"
  | "statusWobble"
  | "statusDecay"
  | "rogue"
  | "border";
