---
phase: 37-settings-personalization
plan: 01
subsystem: ui
tags: [react-navigation, settings, app-settings-dao, interaction-assist, adr-070, zustand]

# Dependency graph
requires:
  - phase: 35-compose
    provides: default_message_mode column + MESSAGE_MODES/assertMessageMode (D-04a)
  - phase: 22-app-shell
    provides: SettingsStack, ShellAppBar, per-tab native-stack shell (§M)
provides:
  - SETTINGS_REGISTERED_ROUTES runtime route-registration contract + source-scan test (extended by Plans 02–08)
  - SettingsHubScreen (navigation-first directory) mounted at the preserved `Settings` route name
  - SETTINGS_HUB_ROWS discriminated-union hub model (route|action) + SETTINGS_CATEGORY_ORDER (§A)
  - SettingsInteractionsScreen — first real category route (message mode, right-swipe, default channel, migrated Interaction Assist)
  - settings-interactions-logic option models + injectable persistInteractionAssistEnabled (D-10/ADR-070)
  - transitional SettingsMore route re-registering the monolith so nothing is lost
affects: [37-02, 37-03, 37-04, 37-05, 37-06, 37-07, 37-08]

actuals:
  tokens: 8200
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Runtime route-registration contract (SETTINGS_REGISTERED_ROUTES) + source-scan test proving <Stack.Screen> registration"
    - "Discriminated-union hub model (kind:route | kind:action) so nav rows and action rows are distinct at the type level"
    - "Injectable DI helper for the ADR-070 assist write path (deps required, not defaulted, to keep the logic module vitest-node loadable)"

key-files:
  created:
    - src/navigation/settings-routes.ts
    - src/navigation/settings-routes.test.ts
    - src/screens/settings-hub-model.ts
    - src/screens/settings-hub-model.test.ts
    - src/screens/SettingsHubScreen.tsx
    - src/screens/SettingsInteractionsScreen.tsx
    - src/screens/settings-interactions-logic.ts
    - src/screens/settings-interactions-logic.test.ts
  modified:
    - src/navigation/tabs/SettingsStack.tsx
    - src/navigation/types.ts
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "Hub mounts at the preserved `Settings` route name (§M); monolith re-registered at transitional `SettingsMore` so every un-migrated control stays reachable"
  - "Interaction Assist migrated to the canonical setInteractionAssistEnabled + banner refresh (D-10/ADR-070); generic persist forbidden for this toggle"
  - "persistInteractionAssistEnabled takes REQUIRED deps (not defaulted) — RN-tethered default bindings (expo-sqlite/assist-store) would make the logic module + its unit test unloadable in vitest-node"

patterns-established:
  - "SETTINGS_REGISTERED_ROUTES: single runtime source both SettingsStack and hub-model read; later plans append route names here as they register screens"
  - "Category screen = leaf-shell analog (onBack prop + ShellAppBar child) reusing SettingsScreen's persist() verbatim for generic writes"

requirements-completed: []

coverage:
  - id: D1
    description: "Runtime route-registration contract: SETTINGS_REGISTERED_ROUTES resolves to real <Stack.Screen> registrations; CategoryManagement (D-03) is NOT registered"
    verification:
      - kind: unit
        ref: "src/navigation/settings-routes.test.ts#Settings route-registration contract"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hub model: route rows target only registered routes (§K), §A ordering holds, transitional SettingsMore is the last non-utility row"
    verification:
      - kind: unit
        ref: "src/screens/settings-hub-model.test.ts#Settings hub model"
        status: pass
    human_judgment: false
  - id: D3
    description: "Interactions option models (message mode D-04a, right-swipe D-04c, default channel §F) map to the exact AppSettingsPatch reusing the DAO enums"
    verification:
      - kind: unit
        ref: "src/screens/settings-interactions-logic.test.ts#message mode / right-swipe / default channel"
        status: pass
    human_judgment: false
  - id: D4
    description: "Migrated Interaction Assist toggle routes through the canonical setInteractionAssistEnabled + banner refresh, never the generic persist (D-10/ADR-070)"
    verification:
      - kind: unit
        ref: "src/screens/settings-interactions-logic.test.ts#persistInteractionAssistEnabled — D-10 / ADR-070"
        status: pass
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts#setInteractionAssistEnabled queue-clear on opt-out"
        status: pass
    human_judgment: false
  - id: D5
    description: "Device UAT: Settings tab shows the hub; Interactions row opens the new screen and a preference change persists; the transitional row opens the full original monolith"
    verification: []
    human_judgment: true
    rationale: "On-device navigation + visual verification on the Pixel; gated behind the precondition (owner-confirmed package name + emu-connect target). Deferred to end-of-phase UAT."

duration: 12min
completed: 2026-09-14
status: complete
---

# Phase 37 Plan 01: Settings Decomposition Tracer Summary

**Navigation-first Settings hub mounted at the preserved `Settings` route with a real end-to-end Interactions category (message mode / right-swipe / default channel + ADR-070-preserving Interaction Assist migration) and a runtime route-registration contract, proving the decomposition architecture on one atomic vertical slice.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files modified:** 11 (8 created, 3 modified)

## Accomplishments
- TRACER proven end-to-end: `Settings` → SettingsHubScreen → navigate `SettingsInteractions` → real `updateAppSettings` round-trip, independently green (tsc + colours + DAO suite).
- Landed the phase-wide `SETTINGS_REGISTERED_ROUTES` runtime contract + a source-scan test that reads `SettingsStack.tsx` on disk (closes the erased-`SettingsStackParamList` false positive) and asserts `CategoryManagement` (D-03) is unregistered.
- Interactions category surfaces message mode (D-04a), dashboard right-swipe (D-04c), and default channel (§F) via the generic DAO persist path; the migrated Interaction Assist toggle writes through the canonical `setInteractionAssistEnabled` + `useAssistBanner.refresh()` (D-10/ADR-070), never the generic path.
- Monolith kept whole via the transitional `SettingsMore` route; Interaction Assist is the only group migrated out of it this plan.
- No migration added, `TARGET_VERSION` stays 29, `BACKUP_FORMAT_VERSION` stays 5 (D-06).

## Task Commits

1. **Task 1: TRACER — hub + transitional SettingsMore + Interactions slice + route contract** - `bbac93f` (feat)
2. **Task 2: Interactions expansion (right-swipe / default channel / Interaction Assist migration)** - `9b3baeb` (test, RED) → `d5907d8` (feat, GREEN)
3. **Task 3: route-registration + hub-model contract tests** - `4053a87` (test)

## Files Created/Modified
- `src/navigation/settings-routes.ts` - `SETTINGS_REGISTERED_ROUTES` runtime contract + `SettingsRegisteredRoute` type.
- `src/navigation/settings-routes.test.ts` - source-scan registration proof + D-03 unregistered guard.
- `src/screens/settings-hub-model.ts` - discriminated-union `SETTINGS_HUB_ROWS` + `SETTINGS_CATEGORY_ORDER` (§A).
- `src/screens/settings-hub-model.test.ts` - route validity / §A ordering / transitional-row guard.
- `src/screens/SettingsHubScreen.tsx` - navigation-first directory (no live values, §A) at the `Settings` route.
- `src/screens/SettingsInteractionsScreen.tsx` - Interactions category screen (4 controls).
- `src/screens/settings-interactions-logic.ts` - option models + injectable `persistInteractionAssistEnabled`.
- `src/screens/settings-interactions-logic.test.ts` - option-model + assist-handler unit tests.
- `src/navigation/tabs/SettingsStack.tsx` - hub at `Settings`, `SettingsMore` (monolith), `SettingsInteractions` route.
- `src/navigation/types.ts` - `SettingsMore` / `SettingsInteractions` added to `SettingsStackParamList`.
- `src/screens/SettingsScreen.tsx` - Interaction Assist group + handler + now-unused imports removed.

## Decisions Made
- **Hub at the preserved `Settings` route name (§M):** deep-link + back-stack safe; monolith re-homed at `SettingsMore`.
- **ADR-070 enforced, not reversed (D-10):** the migrated assist toggle uses the specialized queue-clearing writer + banner refresh; the generic `persist()` path is explicitly forbidden for it. The DAO-level queue-clear proof (existing `app-settings-dao.test.ts`) is referenced, not duplicated; a handler-level test proves the specialized writer + banner refresh are used.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `persistInteractionAssistEnabled` deps made required instead of defaulted to the real bindings**
- **Found during:** Task 2 (Interactions expansion)
- **Issue:** The plan specified the injectable helper's `deps` DEFAULT to the real `setInteractionAssistEnabled` / `getAppSettings` / `useAssistBanner.getState().refresh` / `localDateTime`. Top-level importing those real bindings pulls in `@/db/database` → `expo-sqlite` and `@/stores/assist-store`, whose transitive `react-native` Flow source vitest-node cannot parse — making the logic module AND its required unit test unloadable in the node test env (`RolldownError: Flow is not supported`).
- **Fix:** Made `deps` a REQUIRED parameter. The Interactions screen (a real RN component) constructs the real deps inline and passes them; the unit test injects mocks. Behavior is identical (`setInteractionAssistEnabled` → `getAppSettings` re-read → `refreshBanner()`), and ADR-070 enforcement is unchanged — only the binding site moved from the logic module to the caller.
- **Files modified:** src/screens/settings-interactions-logic.ts, src/screens/SettingsInteractionsScreen.tsx
- **Verification:** `npx vitest run src/screens/settings-interactions-logic.test.ts` green (11 tests); tsc clean.
- **Committed in:** d5907d8 (Task 2 GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the assist-handler logic unit-testable in vitest-node (a stated plan requirement). No behavioural change, no ADR-070 weakening, no scope creep.

## Issues Encountered
- The DAO does NOT re-export `RIGHT_SWIPE_ACTIONS` (it imports it from `@/logic/dashboard-query-logic`). The option model and test import it from its canonical source. `DEFAULT_INTERACTION_CHANNELS` is exported from the DAO and imported from there.

## Known Stubs
- `SettingsHubScreen` handles a `kind:"action"` hub row with a no-op branch. This is future-proofing for Plan 08's "Add Orbit widget" utility row, not a stub that blocks this plan's goal — no action rows are authored yet (§K: only rows whose destination exists this plan). The discriminated union + exhaustive switch are intentional per §L.

## User Setup Required
None for automated verification. Device UAT (D5) requires the owner to confirm the Orbit app package name + `emu-connect` target first (Task 1 precondition; CLAUDE.md Android section is quest-board-derived). Deferred to end-of-phase UAT.

## Next Phase Readiness
- `SETTINGS_REGISTERED_ROUTES` + source-scan test are the contract Plans 02–08 extend as they register category/Backup/About routes.
- Hub model, category-screen shell, and the generic `persist()` write path are the templates for the remaining category screens.
- Architecture de-risked: hub-at-`Settings` + category-route + DAO round-trip + runtime-provable registration all proven on one committed slice.

## Self-Check: PASSED

All created source files present on disk; all four task commits (`bbac93f`, `9b3baeb`, `d5907d8`, `4053a87`) exist in git history.

---
*Phase: 37-settings-personalization*
*Completed: 2026-09-14*
