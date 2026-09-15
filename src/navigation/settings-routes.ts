/**
 * The runtime source of truth for the Settings-stack route names the hub can
 * address. This constant exists so route registration is provable at RUNTIME,
 * not merely at the type level: the erased `SettingsStackParamList` cannot be
 * inspected by a test, so a type-only registration check proves nothing (a
 * route typed-but-never-registered still type-checks). `settings-routes.test.ts`
 * reads `SettingsStack.tsx` from disk and asserts every name here resolves to a
 * real `<Stack.Screen>`.
 *
 * Both the hub model (`settings-hub-model.ts`) and the source-scan test read
 * this single array; a `kind:"route"` hub row's `route` is typed
 * `SettingsRegisteredRoute`, so a row targeting an unregistered/reserved name
 * fails to type-check.
 *
 * LATER PLANS APPEND their category / Backup / About route names here as they
 * register the corresponding `<Stack.Screen>` in `SettingsStack.tsx` (Plans
 * 02–08). Keep this array and the stack registrations in lockstep.
 *
 * `CategoryManagement` (D-03) is DELIBERATELY EXCLUDED: Phase 37 reserves that
 * route name/IA slot for the future Category Management phase (37.1) but ships
 * NO `<Stack.Screen>` and NO tappable row (§K no-dead-placeholders). The
 * source-scan test asserts `CategoryManagement` is NOT registered, closing the
 * D-03 typed-but-unregistered false-positive.
 */
export const SETTINGS_REGISTERED_ROUTES = [
  // The preserved hub route name (§M — deep-link + back-stack safe).
  "Settings",
  // Transitional re-registration of the untouched monolith so every not-yet-
  // migrated control stays reachable; Plan 08 removes this once every group has
  // migrated into a category screen.
  "SettingsMore",
  // The first real category route (Plan 01) — Interactions.
  "SettingsInteractions",
  // The Appearance category route (Plan 02) — Theme section (package / mode /
  // accent / background); its <Stack.Screen> is registered in SettingsStack.tsx.
  "SettingsAppearance",
] as const;

export type SettingsRegisteredRoute =
  (typeof SETTINGS_REGISTERED_ROUTES)[number];
