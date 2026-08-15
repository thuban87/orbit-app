---
phase: 04-contact-crud-lifecycle
plan: 01
subsystem: ui
tags: [react-navigation, native-stack, navigation, theme-tokens, expo]

# Dependency graph
requires:
  - phase: 03-custom-fields
    provides: CustomFieldsScreen (the reachability route being relocated into Settings)
  - phase: 01-foundation
    provides: ThemeProvider/useTheme, App.tsx launch gate, check:colors gate
provides:
  - react-navigation native-stack shell (NavigationContainer + RootNavigator, 7 routes)
  - RootStackParamList route/param contract with a typed RootStackScreenProps helper
  - SettingsScreen hosting Custom Fields + Archived contacts rows
  - migrated HomeScreen (no useState route toggle; navigate-driven)
  - danger theme token (#E5484D) in ThemePalette + space-dark preset
affects: [create-contact, edit-contact, contact-profile, archived-list, purge, frequency-picker, validation-ui]

# Tech tracking
tech-stack:
  added:
    - "@react-navigation/native ^7.3.16"
    - "@react-navigation/native-stack ^7.18.8"
    - "react-native-screens ~4.26.0"
  patterns:
    - "Every Phase-4 screen is a native-stack route registered in RootNavigator"
    - "headerShown:false — each screen renders its own Back chrome (no duplicate header)"
    - "Not-yet-built routes register themed 'Coming soon' placeholders swapped by later plans"
    - "Prop-driven screens (CustomFieldsScreen.onBack) wired to the navigator via a thin goBack() wrapper, not an internal useNavigation refactor"

key-files:
  created:
    - src/navigation/types.ts
    - src/navigation/RootNavigator.tsx
    - src/screens/SettingsScreen.tsx
  modified:
    - App.tsx
    - src/screens/HomeScreen.tsx
    - src/theme/theme-types.ts
    - src/theme/theme-presets.ts
    - package.json

key-decisions:
  - "RootStackParamList declared as a `type` alias (not `interface`) so it satisfies createNativeStackNavigator's ParamListBase constraint via TS's implicit index signature"
  - "Settings hosts TWO rows (Custom Fields, Archived), not three — UI-SPEC's 'Custom Fields' and 'Reachability route' name the same CustomFieldsScreen (reconciliation)"
  - "danger token relocated from Plan 09 to wave 1 so Plans 03/04/06/09 can consume colors.danger; none re-adds it"
  - "CustomFieldsScreen left untouched — registered via a goBack() wrapper in RootNavigator, keeping it prop-driven and testable"

patterns-established:
  - "Native-stack navigator as the single app shell; headerShown:false; Android system Back walks the stack (predictive-back off, app.config.ts:26)"
  - "Themed placeholder factory (makePlaceholder) for routes owned by later plans"

requirements-completed: [CRUD-05]

coverage:
  - id: D1
    description: "App boots into a react-navigation native-stack; Home renders inside NavigationContainer with headerShown:false"
    requirement: CRUD-05
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (repo typecheck, all routes/components resolve)"
        status: pass
      - kind: manual_procedural
        ref: "on-device UAT (desktop→Pixel build): Home renders, no duplicate header over CustomFieldsScreen"
        status: unknown
    human_judgment: true
    rationale: "Navigation rendering + system-Back stack behavior is UI-observable only and needs a native rebuild on the Pixel; native-stack cannot be exercised in the node/vitest env."
  - id: D2
    description: "Settings reachable from Home; hosts Custom Fields (relocated, still functional) and Archived contacts rows (no count badge)"
    requirement: CRUD-05
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (SettingsScreen + route registration typecheck)"
        status: pass
      - kind: manual_procedural
        ref: "on-device UAT: Home→Settings→Custom Fields navigates; Custom Fields CRUD still works; two rows, no badge"
        status: unknown
    human_judgment: true
    rationale: "End-to-end navigation and that Custom Fields still works after relocation are observable only in the running app on-device."
  - id: D3
    description: "HomeScreen has no hand-rolled route state (useState<Route> toggle removed); navigation is via navigation.navigate"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit + grep: no useState/Route toggle, no CustomFieldsScreen import in HomeScreen"
        status: pass
    human_judgment: false
  - id: D4
    description: "danger theme token (#E5484D) exists in ThemePalette and the space-dark.dark preset; colour gate stays green"
    verification:
      - kind: unit
        ref: "src/theme/theme-presets.test.ts (palette tokens resolve as strings)"
        status: pass
      - kind: other
        ref: "npm run check:colors src App.tsx (exit 0 — hex only inside theme/)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 01: Navigation Shell, Settings & danger Token Summary

**react-navigation native-stack shell (7 routes, headerShown:false) with a Settings host for Custom Fields + Archived contacts, HomeScreen migrated off its useState toggle, and the danger (#E5484D) theme token landed in wave 1.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-15T05:29:29Z
- **Completed:** 2026-08-15T05:33:56Z
- **Tasks:** 4 (Task 1 = pre-authorized package-legitimacy gate; Tasks 2–4 implemented)
- **Files modified:** 8 (3 created, 5 modified) + package-lock.json

## Accomplishments
- Stood up the app's real navigation shell: `NavigationContainer` + a `createNativeStackNavigator` registering all 7 Phase-4 routes (`Home`, `Settings`, `CustomFields`, `Create`, `Profile`, `Edit`, `Archived`), `screenOptions={{ headerShown: false }}` so no native header doubles each screen's own Back chrome.
- Migrated `HomeScreen` off the Phase-3 `useState<Route>` toggle onto `navigation.navigate` — Home now offers a primary "New contact" (accent fill) and a "Settings" entry; no dependency-free route logic remains.
- Added `SettingsScreen` hosting exactly two rows — "Custom Fields" (relocated) and "Archived contacts" (no count badge) — the two CRUD-05 low-traffic homes.
- Registered `CustomFields` via a thin `goBack()` wrapper, leaving `CustomFieldsScreen`'s DAO logic and `onBack` contract completely untouched.
- Added the `danger: "#E5484D"` token to `ThemePalette` + the `space-dark.dark` preset (relocated from Plan 09 to wave 1) so downstream validation/destructive UI resolves `colors.danger`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy gate** — no commit (pre-install supply-chain gate T-04-SC; verified legitimate and pre-authorized per execution context — `@react-navigation/*` + `react-native-screens` are the canonical first-party packages)
2. **Task 2: Install nav deps + RootNavigator + App.tsx + HomeScreen migration** — `2e28316` (feat)
3. **Task 3: SettingsScreen + relocate Custom Fields entry** — `5854c35` (feat)
4. **Task 4: Add the danger theme token** — `d8e735e` (feat)

## Files Created/Modified
- `src/navigation/types.ts` (created) — `RootStackParamList` route/param map + `RootStackScreenProps` helper
- `src/navigation/RootNavigator.tsx` (created) — native-stack navigator, themed placeholder factory, CustomFields goBack() wrapper
- `src/screens/SettingsScreen.tsx` (created) — Settings host with Custom Fields + Archived rows
- `App.tsx` (modified) — mounts `NavigationContainer` + `RootNavigator` in the `ready && !error` branch; both launch effects preserved verbatim
- `src/screens/HomeScreen.tsx` (modified) — route toggle removed; navigate-driven "New contact" + "Settings"
- `src/theme/theme-types.ts` (modified) — `danger` added to `ThemePalette`
- `src/theme/theme-presets.ts` (modified) — `danger: "#E5484D"` in `space-dark.dark`
- `package.json` / `package-lock.json` (modified) — three nav deps via `npx expo install`

## Decisions Made
- **`type` alias over `interface` for `RootStackParamList`:** an `interface` lacks TS's implicit index signature and fails `createNativeStackNavigator<...>`'s `ParamListBase` constraint (TS2344); the `type` alias assigns cleanly. Matches react-navigation's official docs.
- **Two Settings rows, not three:** applied the plan's Settings-rows reconciliation — UI-SPEC:192's "Custom Fields" and "Reachability route" name the same on-disk `CustomFieldsScreen`; a third row would navigate to a nonexistent screen.
- **CustomFieldsScreen unchanged:** registered via a `goBack()` wrapper in `RootNavigator` rather than refactoring `onBack` to call `useNavigation` internally — keeps the screen prop-driven and its Phase-3 DAO logic and tests intact.

## Deviations from Plan

### Sequencing adjustment (not a scope change)

**1. [Rule 3 - Blocking/sequencing] Settings + CustomFields registered as placeholders in Task 2, swapped to real screens in Task 3**
- **Found during:** Task 2 (RootNavigator creation)
- **Issue:** The literal Task 2 wording registers `Settings` → `SettingsScreen` and `CustomFields` → `CustomFieldsScreen`, but `SettingsScreen` is not created until Task 3 and the plan explicitly places the `CustomFields` `goBack()` wrapper in Task 3. Registering a not-yet-existent `SettingsScreen` in Task 2 would break that task's `npx tsc --noEmit` verify and leave a non-green atomic commit.
- **Fix:** Task 2 registered `Settings` and `CustomFields` with themed placeholders (all 7 routes present, "no route references a missing component" satisfied); Task 3 swapped `Settings` → `SettingsScreen` and `CustomFields` → the `goBack()` wrapper. Final state is exactly what the plan specifies.
- **Files modified:** src/navigation/RootNavigator.tsx
- **Verification:** `npx tsc --noEmit` + `check:colors` green at both Task 2 and Task 3 commits.
- **Committed in:** 2e28316 (Task 2), 5854c35 (Task 3)

---

**Total deviations:** 1 (sequencing only, to keep each atomic commit's typecheck green)
**Impact on plan:** No scope change — the plan's end state (Settings/CustomFields wired to real screens, CustomFields via goBack() wrapper) is reached exactly. No functionality added or removed.

## Known Stubs

Intentional placeholder routes — each is replaced by its owning later plan (not blockers for CRUD-05):

| Route | File / line | Reason |
|-------|-------------|--------|
| `Create` | src/navigation/RootNavigator.tsx (makePlaceholder "New contact") | Create form ships in a later Phase-4 plan |
| `Profile` | src/navigation/RootNavigator.tsx (makePlaceholder "Profile") | Profile scaffold ships in a later Phase-4 plan |
| `Edit` | src/navigation/RootNavigator.tsx (makePlaceholder "Edit contact") | Edit form ships in a later Phase-4 plan |
| `Archived` | src/navigation/RootNavigator.tsx (makePlaceholder "Archived contacts") | Archived list ships in Plan 08 |

These placeholders make every route reachable and type-checked now; the shell is the deliverable, the destination screens are scoped to their own plans.

## Issues Encountered
None. Typecheck, colour gate, and the full vitest suite (231 tests) all passed.

## User Setup Required
None - no external service configuration required. The three navigation packages are native modules; they require a native rebuild through the desktop pipeline (docs/runbooks/desktop-build-pipeline.md) before on-device UAT — this is expected, not a failure. JS fast-refreshes on this box.

## Next Phase Readiness
- The navigation shell is ready: Create/Profile/Edit/Archived plans register their real screens by replacing the named placeholders in `RootNavigator.tsx`.
- `colors.danger` is available for FrequencyPicker invalid-interval, future-date, and duplicate-name emphasis in Plans 03/04/06, and the purge "Delete permanently" button in the Archived plan.
- **Deferred to phase gate (not a per-plan failure):** on-device UAT on the Pixel — Home→Settings→Custom Fields navigation, Android system Back walking the stack, no duplicate header over CustomFieldsScreen's own Back, two Settings rows with no badge. Requires the native rebuild (react-native-screens).

## Self-Check: PASSED

All created files exist on disk (types.ts, RootNavigator.tsx, SettingsScreen.tsx, 04-01-SUMMARY.md) and all three task commits (2e28316, 5854c35, d8e735e) are in git history.

---
*Phase: 04-contact-crud-lifecycle*
*Completed: 2026-08-15*
