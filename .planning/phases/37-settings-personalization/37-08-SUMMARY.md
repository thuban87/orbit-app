---
phase: 37-settings-personalization
plan: 08
subsystem: navigation
tags: [react-navigation, settings, about, expo-constants, widget, monolith-retirement]

# Dependency graph
requires:
  - phase: 37-07
    provides: "SettingsHubScreen at `Settings`, SETTINGS_REGISTERED_ROUTES contract + on-disk source-scan test, settings-hub-model.ts discriminated-union rows, transitional SettingsMore monolith + route"
  - phase: 37-01
    provides: "the phase-wide Monolith Migration Matrix (authoritative behavior/error-state inventory), the kind:'route' | kind:'action' hub discriminated union"
provides:
  - "Settings → About Orbit (§K): a basic leaf showing product name + semantic version only (unavailable rows omitted)"
  - "Home Screen Widget access as a hub kind:'action' utility row (§L), reusing requestPinWidget"
  - "the SettingsMore monolith fully retired (§S / D-01): SettingsScreen.tsx deleted, route/row/registration removed, hub in the full §A order"
  - "expo-constants declared as a direct dependency"
affects: [37.1-category-management, settings-personalization, release-hardening]

# Actuals (#2632) — chars/4 over the realized src/ diff (31,510 chars).
actuals:
  tokens: 7900
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added:
    - "expo-constants (direct declaration — was transitive-only; SDK-selected ~57.0.18)"
  patterns:
    - "About surface reads only fields with a genuine runtime source (§K omit-unavailable): product-name CONSTANT (not the app.json scaffold name) + expo-constants version with a module-constant fallback"
    - "Hub utility as a kind:'action' row invoking a handler in place (requestPinWidget), never a navigation route"
    - "Monolith retirement gated on a Migration-Matrix walk: tsc catches stranded imports, the matrix catches dropped behaviour"

key-files:
  created:
    - src/screens/SettingsAboutScreen.tsx
    - src/screens/settings-about-model.ts
  modified:
    - src/screens/settings-hub-model.ts
    - src/screens/settings-hub-model.test.ts
    - src/screens/SettingsHubScreen.tsx
    - src/screens/settings-add-widget.ts
    - src/navigation/types.ts
    - src/navigation/tabs/SettingsStack.tsx
    - src/navigation/settings-routes.ts
    - package.json
  deleted:
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "About displays a product-name CONSTANT (\"Orbit\"), NOT app.json's scaffold name \"orbit-scaffold\" (OWNER FLAG F-1 — renaming app-config identity is an owner/Phase-40 call)."
  - "Build number and dependency licenses/acknowledgements OMITTED — no android.versionCode and no license generator/asset on disk (§K omit-unavailable; OWNER FLAG F-2)."
  - "expo-constants declared directly via `npx expo install` (was transitive-only) so the About version read cannot break on a future dedupe."
  - "Widget access is a single kind:'action' utility row after the whole category/About hierarchy, not a dedicated category (§L)."

patterns-established:
  - "§K basic About: name + version only, every unavailable row omitted, zero dead placeholders"
  - "Migration-Matrix-gated monolith deletion: walk every 37-01 matrix row against disk before removing the scaffold"

requirements-completed: []

coverage:
  - id: D1
    description: "Settings → About Orbit (§K) renders the product-name constant (\"Orbit\", not the app.json scaffold name) + the semantic version from expo-constants with a module-constant fallback; no build-number, licenses, or support/legal rows."
    verification:
      - kind: unit
        ref: "src/screens/settings-hub-model.test.ts#renders the COMPLETE §A category order, then the widget action row (About is the final category)"
        status: pass
      - kind: unit
        ref: "src/navigation/settings-routes.test.ts#registers a <Stack.Screen> for every SETTINGS_REGISTERED_ROUTES entry (SettingsAbout registered)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (clean — expo-constants import resolves; package.json lists it directly)"
        status: pass
    human_judgment: true
    rationale: "The rendered About screen (icon + name + version, no dead rows) is visually confirmable only on device; the model/route wiring is unit-proven but the on-screen presentation is not."
  - id: D2
    description: "Home Screen Widget access is a hub kind:'action' utility row after the category/About rows, invoking the reused requestPinWidget path with the addWidgetCopy fallback."
    verification:
      - kind: unit
        ref: "src/screens/settings-hub-model.test.ts#renders the COMPLETE §A category order, then the widget action row (exactly one action row, last)"
        status: pass
    human_judgment: true
    rationale: "That the row actually pins the widget from the hub is an on-device (Pixel) behaviour — requestPinWidget hits the launcher's native RemoteViews pin path, unobservable in vitest."
  - id: D3
    description: "The SettingsMore monolith is fully retired (§S / D-01): SettingsScreen.tsx deleted, SettingsMore removed from types/stack/SETTINGS_REGISTERED_ROUTES/hub row; hub renders the full §A order; no user-facing control lost (Migration-Matrix walk)."
    verification:
      - kind: unit
        ref: "src/screens/settings-hub-model.test.ts#has retired the transitional SettingsMore scaffold (Plan 08)"
        status: pass
      - kind: unit
        ref: "src/navigation/settings-routes.test.ts#does NOT register CategoryManagement + every registered route resolves to a <Stack.Screen>"
        status: pass
      - kind: other
        ref: "npm test (378 passed / 1 pre-existing unrelated fail; 3598 tests pass) + npx tsc --noEmit clean"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-06 confirmed at phase close: Phase 37 added no migration (TARGET_VERSION === 29) and no backup-format bump (BACKUP_FORMAT_VERSION === 5)."
    verification:
      - kind: other
        ref: "grep TARGET_VERSION src/db/database.ts (29) + BACKUP_FORMAT_VERSION src/backup/types.ts (5) — unchanged"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-14
status: complete
---

# Phase 37 Plan 08: About Orbit, Widget Utility Row & Monolith Retirement Summary

**Closed Phase 37 by shipping a basic About Orbit surface (real product name + semantic version only, unavailable rows omitted), moving Home Screen Widget access to a hub `kind:"action"` utility row, and retiring the SettingsMore monolith entirely — leaving Settings as the full §A navigation-first directory with no dead placeholders and no schema/format change (D-06).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-14T21:47:00Z
- **Completed:** 2026-09-14T21:59:00Z
- **Tasks:** 3
- **Files modified:** 11 (2 created, 8 modified, 1 deleted)

## Accomplishments
- **About Orbit (§K):** new `SettingsAboutScreen` (leaf shell) renders the app icon, the product-name constant `ABOUT_APP_NAME = "Orbit"` (deliberately NOT the `app.json` scaffold name `"orbit-scaffold"`), and the semantic version from `expo-constants` `Constants.expoConfig?.version` with a `"1.0.0"` module-constant fallback. New `settings-about-model.ts` owns the pure display data. Build number, licenses/acknowledgements, and support/privacy rows are OMITTED (no runtime source on disk — §K omit-unavailable). Registered `SettingsAbout` in types + SettingsStack + `SETTINGS_REGISTERED_ROUTES`; hub `About Orbit` row at §A index 7.
- **expo-constants direct dependency:** declared via `npx expo install expo-constants` (SDK-selected `~57.0.18`) so the About version read no longer depends on a transitive-only package (review MEDIUM cycle-3).
- **Widget utility row (§L):** the Home Screen Widget access is now a hub `kind:"action"` row (`ADD_WIDGET_ACTION`) after the category/About hierarchy, invoking the reused `requestPinWidget` path with the `addWidgetCopy` fallback carried verbatim from the monolith — not a navigation route, not a dedicated category.
- **Monolith retired (§S / D-01):** deleted `src/screens/SettingsScreen.tsx`; removed `SettingsMore` from `SettingsStackParamList`, `SettingsStack.tsx` (route + import), `SETTINGS_REGISTERED_ROUTES`, and the hub row. The hub-model test now asserts the retirement (SettingsMore absent), the COMPLETE §A order (Appearance → About) followed by the single widget action row, and that no row targets the reserved `CategoryManagement` (D-03).
- **D-06 confirmed:** `TARGET_VERSION === 29` and `BACKUP_FORMAT_VERSION === 5` unchanged — Phase 37 added no migration and no format bump.

## Monolith Migration Matrix walk (37-01 `<monolith_migration_matrix>`)

Every matrix row confirmed migrated before deletion — the pre-Task-2 `SettingsScreen.tsx` held ONLY the Home-screen widget group; all other groups had already migrated in Plans 01–07:

| Matrix group | Destination | Owning plan | Verified |
|---|---|---|---|
| `__DEV__` theme-preview row | Appearance (dev-only) | 02 | ✓ hub renders `__ThemePreview` row |
| Appearance: Theme/Mode/Accent/Background | Appearance › Theme | 02 | ✓ SettingsAppearanceScreen |
| Contact methods (phone region, reconcile, review-flagged) | Contacts › Contact Sources | 04 | ✓ SettingsContactsScreen |
| Contacts Integration (import) + permission/status | Contacts › Contact Sources | 04 | ✓ SettingsContactsScreen |
| Notifications: 10 controls + permission surface | Notifications | 05 | ✓ SettingsNotificationsScreen |
| Interaction Assist toggle (ADR-070 / D-10) | Interactions | 01 | ✓ SettingsInteractionsScreen |
| Default message mode / right-swipe / default channel | Interactions | 01 | ✓ SettingsInteractionsScreen |
| Your photo + Your orbit (self-star + Orbit Center) | Appearance / owner-profile | 03 | ✓ SettingsAppearanceScreen |
| Self-name editor (D-04b) + global profile default (D-05) | Appearance | 03 | ✓ SettingsAppearanceScreen |
| AI: enabled + hub rows + disclosure | AI | 06 | ✓ SettingsAIScreen |
| Home screen: Add Orbit widget | hub kind:'action' row | 08 | ✓ this plan (Task 2) |
| Custom Fields row | Contacts › Relationship Structure | 04 | ✓ SettingsContactsScreen |
| Systems row | Orrery › Systems | 06 | ✓ SettingsOrreryScreen |
| Orrery Display prefs (density/satellites) | Orrery › Display | 06 | ✓ SettingsOrreryScreen |
| Archived contacts row | Contacts › Contact Management | 04 | ✓ SettingsContactsScreen |
| Data & Backup (new entry point) | Data & Backup | 07 | ✓ dual-home registration |
| About Orbit (new) | About | 08 | ✓ this plan (Task 1) |

No un-inventoried group or behaviour remained; nothing was dropped. The monolith exported only the `SettingsScreen` component (no shared helper), so deletion stranded no import (tsc clean).

## Task Commits

Each task was committed atomically:

1. **Task 1: About Orbit surface (§K)** — `52d7363` (feat)
2. **Task 2: Home Screen Widget hub utility row (§L)** — `4da7516` (feat)
3. **Task 3: Retire the SettingsMore monolith + transitional route (§S / D-01)** — `38c6109` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `src/screens/settings-about-model.ts` — NEW: `ABOUT_APP_NAME`, `ABOUT_VERSION_FALLBACK`, `resolveAboutVersion()` (expo-constants + fallback).
- `src/screens/SettingsAboutScreen.tsx` — NEW: basic About leaf (icon + name + version, unavailable rows omitted).
- `src/screens/settings-hub-model.ts` — added About route row (§A index 7) + widget `kind:"action"` row; removed the transitional `more` row; refreshed comments.
- `src/screens/settings-hub-model.test.ts` — inverted the transitional-row guard to assert SettingsMore ABSENT; asserts full §A order + single widget action row + no CategoryManagement target.
- `src/screens/SettingsHubScreen.tsx` — wired the `add-widget` action (requestPinWidget + fallback copy), rows wrapped so the fallback renders under the widget row.
- `src/screens/settings-add-widget.ts` — added `ADD_WIDGET_ACTION` identifier.
- `src/navigation/types.ts` — added `SettingsAbout`, removed `SettingsMore`.
- `src/navigation/tabs/SettingsStack.tsx` — registered `SettingsAbout`; removed `SettingsMore` registration + `SettingsScreen` import.
- `src/navigation/settings-routes.ts` — appended `SettingsAbout`, removed `SettingsMore`.
- `package.json` / `package-lock.json` — `expo-constants` declared directly.
- `src/screens/SettingsScreen.tsx` — DELETED (the retired monolith).

## Decisions Made
- **Product-name constant, not app.json (F-1):** About shows `"Orbit"` rather than the scaffold `"orbit-scaffold"`; renaming the app-config identity touches Android package/build identity and is an owner + Phase-40 call, not taken here.
- **Omit unavailable rows (F-2):** no `android.versionCode` → no build number; no license generator/asset → no acknowledgements. Both omitted per §K, flagged to the owner as a possible Phase-40/legal follow-up.
- **expo-constants declared directly** rather than relying on the transitive resolution, matching the pattern already used in `ComposeScreen.tsx`.

## Deviations from Plan

**None — plan executed exactly as written.**

The one procedural note: `SettingsScreen.tsx` was already reduced to a single group (the widget) by Plans 01–07, so the plan's stale line references (1876–1928, 647) pointed at a 170-line file, not the original 2,168-line monolith. This is expected — decomposition happened incrementally across the phase; Task 2/3 handled the remaining group and the file deletion exactly as specified.

## Issues Encountered
- A `git add -A` on the Task-3 deletion pathspec initially split the commit (only the deletion landed). Amended immediately to fold the five unwiring edits into one atomic retirement commit (`38c6109`). No history left in a broken intermediate state.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Phase 37 fully executed (8/8 plans).** Settings is the coherent navigation-first §A directory: Appearance, Contacts & Relationships, Interactions, Notifications, Orrery, Data & Backup, AI, About, then the widget utility row. Monolith + transitional scaffold gone.
- **D-06 holds at phase close:** no schema, no backup-format bump across Phase 37.
- **Device UAT still owed (owner, before phase-close):** on the Pixel, drive Settings → every category in §A order → Data & Backup from both entry points → About; confirm the About screen renders name + version with no dead rows, the widget row still pins from the hub, and no behaviour was lost vs. the retired monolith. Per memory `no-ai-api-calls-without-clearing`, do NOT trigger a real AI suggestion during UAT.
- **Roadmap follow-up (D-03, owner):** Category Management is scheduled as inserted Phase 37.1.

## Self-Check: PASSED
- Created files present: `src/screens/SettingsAboutScreen.tsx`, `src/screens/settings-about-model.ts`, `37-08-SUMMARY.md`.
- Deleted file gone: `src/screens/SettingsScreen.tsx`.
- Task commits present in git: `52d7363` (feat), `4da7516` (feat), `38c6109` (feat).

---
*Phase: 37-settings-personalization*
*Completed: 2026-09-14*
