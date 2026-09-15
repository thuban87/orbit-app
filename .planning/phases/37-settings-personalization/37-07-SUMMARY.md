---
phase: 37-settings-personalization
plan: 07
subsystem: navigation
tags: [react-navigation, backup, restore, settings, dual-home, native-stack]

# Dependency graph
requires:
  - phase: 37-06
    provides: "SettingsHubScreen at `Settings`, SETTINGS_REGISTERED_ROUTES contract + on-disk source-scan test, settings-hub-model.ts, category-screen route-registration pattern"
  - phase: 17-backup-export-restore
    provides: "the four Backup screens (BackupScreen/BackupSettingsScreen/RestorePreviewScreen/RestoreResultScreen), restorePreviewCache, consumeSharedBackup native singleton, share-intent gate (linking.ts)"
provides:
  - "Data & Backup reachable from Settings → one canonical Backup screen tree, two entry points (Backup tab + Settings)"
  - "explicit per-stack `host` prop pattern for dual-homed screen trees (backup-tab | settings, fail-closed default)"
  - "backup-dualhome-logic.ts pure helpers: restoreReturnRouteName / shouldConsumeSharedBackup / backupAppBarVariant"
  - "Backup/BackupSettings/RestorePreview/RestoreResult registered in SettingsStackParamList + SETTINGS_REGISTERED_ROUTES"
affects: [37-08, backup-tab-removal, settings-personalization]

# Actuals (#2632) — chars/4 over the realized src/ diff (24,941 chars).
actuals:
  tokens: 6200
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-homed screen tree: ONE set of screens registered in two stacks, host disambiguated by an EXPLICIT per-stack wrapper prop (never getParent/getState nav-state inference)"
    - "Fail-closed host default: DEFAULT_BACKUP_HOST='backup-tab' preserves shipped single-consumer / reset-to-Backup behaviour for any un-anticipated mount"
    - "Params-free route subset type (ParamlessSettingsRoute) so a hub directory row can only target a bare-navigable route"

key-files:
  created:
    - src/screens/backup-dualhome-logic.ts
    - src/screens/backup-dualhome-logic.test.ts
  modified:
    - src/navigation/types.ts
    - src/navigation/tabs/SettingsStack.tsx
    - src/navigation/tabs/BackupStack.tsx
    - src/navigation/settings-routes.ts
    - src/screens/settings-hub-model.ts
    - src/screens/BackupScreen.tsx
    - src/screens/RestorePreviewScreen.tsx
    - src/screens/RestoreResultScreen.tsx

key-decisions:
  - "Reused the existing four Backup screens unchanged (one canonical tree, §I) — NO second Backup implementation."
  - "Host resolution via explicit per-stack wrapper prop, defaulting fail-closed to backup-tab (review cycle-1 HIGH + CONTESTED)."
  - "Narrowed hub row `route` type to the params-free registered subset (blocking-fix, Rule 3) so adding params-required RestorePreview/RestoreResult to the registration contract didn't break the hub's bare navigate."

patterns-established:
  - "Origin-aware navigation reset at EVERY reset site across a shared screen tree, driven by a single host primitive"
  - "Tab-scoped consumption of a native singleton so a dual-mounted consumer cannot double-drain it"

requirements-completed: []

coverage:
  - id: D1
    description: "The four Backup screens are registered in the Settings stack (SettingsStackParamList + SETTINGS_REGISTERED_ROUTES + <Stack.Screen> via host='settings' wrappers); a Data & Backup hub row targets route `Backup`; the Backup bottom tab stays registered and functional."
    verification:
      - kind: unit
        ref: "src/navigation/settings-routes.test.ts#registers a <Stack.Screen> for every SETTINGS_REGISTERED_ROUTES entry"
        status: pass
      - kind: unit
        ref: "src/screens/settings-hub-model.test.ts#targets only registered routes for every kind:'route' row"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both dual-home hazards handled via pure host helpers: origin-aware post-restore return (restoreReturnRouteName), tab-scoped shared-backup consume (shouldConsumeSharedBackup), and host-aware app-bar chrome (backupAppBarVariant), with the fail-closed default and single-drain-per-host invariant."
    verification:
      - kind: unit
        ref: "src/screens/backup-dualhome-logic.test.ts (9 tests: both hosts per helper, DEFAULT_BACKUP_HOST, single-drain-per-host)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Device UAT: Settings → Data & Backup opens the same Backup tree with a Back affordance returning to the Settings hub; the Backup tab copy stays title-only; a Settings-entry restore returns to the hub while the tab restore still returns to Backup; a shared backup opens once (no double-drain) and lands on the Backup tab copy."
    verification: []
    human_judgment: true
    rationale: "Navigation chrome, back-stack behaviour, and single-drain of the native shared-backup singleton are UI/on-device observable only; the SAF-grant reconnect hazard (memory) must be exercised on the Pixel. Pure helpers are unit-proven; the wiring into a live navigator is not."

# Metrics
duration: 10min
completed: 2026-09-14
status: complete
---

# Phase 37 Plan 07: Data & Backup Dual-Home Summary

**Data & Backup given a second canonical entry point from Settings by registering the existing four Backup screens in the Settings stack — one tree, two entry points — with an explicit per-stack `host` prop driving origin-aware post-restore return, tab-scoped shared-backup consume, and host-aware app-bar chrome; the Backup bottom tab preserved unchanged.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-14T21:34:00Z
- **Completed:** 2026-09-14T21:44:00Z
- **Tasks:** 2
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments
- Registered the EXISTING `BackupScreen`/`BackupSettingsScreen`/`RestorePreviewScreen`/`RestoreResultScreen` in `SettingsStackParamList`, `SETTINGS_REGISTERED_ROUTES`, and `SettingsStack.tsx` — one canonical tree, reachable from both the Backup tab and Settings → Data & Backup (§I / D-08). No second copy.
- Threaded an EXPLICIT `host` prop through per-stack wrapper components (`host="settings"` in SettingsStack, `host="backup-tab"` in BackupStack), fail-closed default `DEFAULT_BACKUP_HOST="backup-tab"` — replacing the fragile, untested `getParent`/`getState` nav-state inference the cross-AI review flagged HIGH.
- Made every reset-to-Backup site origin-aware via `restoreReturnRouteName(host)`: `RestoreResultScreen`'s return button and `RestorePreviewScreen`'s success-reset base now return to the Settings hub under the Settings host while the Backup-tab flow is unchanged; `returnToSelection` intentionally stays `Backup` (documented).
- Gated `consumeSharedBackup` on `shouldConsumeSharedBackup(host)` so only the Backup-tab copy drains the native shared-backup singleton (no double-drain; the share-intent gate already targets `BackupTab › Backup`).
- Made the Backup app bar host-aware via `backupAppBarVariant(host)` — `variant="child"`/Back under Settings (returns to the hub), `variant="root"` (title-only) unchanged under the tab.
- Kept the Backup bottom tab registered and functional (removal deferred, §R); no migration and `BACKUP_FORMAT_VERSION` stays 5 (D-06).

## Task Commits

Each task committed atomically:

1. **Task 1: Register the four Backup screens in the Settings stack via per-stack host wrappers + hub Data & Backup row** — `3463848` (feat)
2. **Task 2 (TDD RED): failing specs for backup dual-home host helpers** — `911855b` (test)
3. **Task 2 (TDD GREEN): origin-aware resets, tab-scoped consume, host-aware app bar** — `c4ffef7` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

_TDD task: RED (test) → GREEN (feat)._

## Files Created/Modified
- `src/screens/backup-dualhome-logic.ts` — `BackupHost` type, `DEFAULT_BACKUP_HOST` (fail-closed), and the three pure host helpers.
- `src/screens/backup-dualhome-logic.test.ts` — 9 unit specs over both hosts, the default, and the single-drain invariant.
- `src/navigation/types.ts` — added `Backup`/`BackupSettings`/`RestorePreview`/`RestoreResult` to `SettingsStackParamList` (shapes identical to `BackupStackParamList`).
- `src/navigation/tabs/SettingsStack.tsx` — imports + `host="settings"` wrappers + four `<Stack.Screen>` registrations.
- `src/navigation/tabs/BackupStack.tsx` — converted `Backup`/`RestorePreview`/`RestoreResult` to explicit `host="backup-tab"` wrappers.
- `src/navigation/settings-routes.ts` — appended the four route names to `SETTINGS_REGISTERED_ROUTES`.
- `src/screens/settings-hub-model.ts` — inserted the Data & Backup row (route `Backup`, §A index 5); narrowed hub `route` type to the params-free registered subset.
- `src/screens/BackupScreen.tsx` — `host` prop; gated consume; host-aware app-bar variant.
- `src/screens/RestorePreviewScreen.tsx` — `host` prop; origin-aware success-reset base; documented `returnToSelection`.
- `src/screens/RestoreResultScreen.tsx` — `host` prop; origin-aware return reset.

## Decisions Made
- **Reused the existing Backup screens unchanged** (one canonical tree, §I) rather than duplicating — the screens self-fetch and take only `navigation`/`route`, so they mount in a second stack without modification (D-08).
- **Host resolution via explicit prop, fail-closed to `backup-tab`** — an un-anticipated host-less mount preserves shipped single-consumer / reset-to-Backup behaviour; the opposite default risks a shared backup never being consumed by any mount (review cycle-1 CONTESTED; owner risk-posture call, not silently flipped).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narrowed the hub row `route` type to the params-free registered subset**
- **Found during:** Task 1 (registration)
- **Issue:** Appending `RestorePreview` (needs a preview token) and `RestoreResult` (needs restore counts) to `SETTINGS_REGISTERED_ROUTES` widened `SettingsRegisteredRoute` to include params-required routes. `SettingsHubScreen`'s bare `navigation.navigate(row.route)` (single-arg overload) then failed to type-check (TS2769) because those routes cannot be navigated without params.
- **Fix:** Added a `ParamlessSettingsRoute` mapped type in `settings-hub-model.ts` (`{ [K in SettingsRegisteredRoute]: undefined extends RootStackParamList[K] ? K : never }[...]`) and typed `SettingsHubRouteEntry.route` against it. All four Backup names stay in the registration contract (satisfying the plan + source-scan test), but a hub directory row can only target a bare-navigable route (`Backup`, undefined params) — semantically correct: a directory row can't deep-link into a restore-preview without a token.
- **Files modified:** src/screens/settings-hub-model.ts
- **Verification:** `npx tsc --noEmit` clean; settings-hub-model + settings-routes tests green.
- **Committed in:** `3463848` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking / Rule 3)
**Impact on plan:** Minimal, confined to `settings-hub-model.ts` (in Task 1's file set). No scope creep — restores type safety while keeping the plan's registration contract intact.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 37-08 (About Orbit + widget utility row + monolith retirement + D-06 confirmation) is unblocked.
- **Device UAT owed (D3 / owner):** on the Pixel, verify Settings → Data & Backup shows a Back affordance returning to the hub (tab copy stays title-only), origin-aware post-restore return, and a shared backup opening once with no double-drain — exercising the SAF-grant reconnect path (memory saf-grant-reconnect-cycle). Do NOT trigger a real AI call during UAT; backup UAT does not touch AI.
- No schema/format change: head migration 029 / `TARGET_VERSION=29`, `BACKUP_FORMAT_VERSION=5` untouched (D-06).

## Self-Check: PASSED
- Created files present: `src/screens/backup-dualhome-logic.ts`, `src/screens/backup-dualhome-logic.test.ts`, `37-07-SUMMARY.md`.
- Task commits present in git: `3463848` (feat), `911855b` (test), `c4ffef7` (feat).

---
*Phase: 37-settings-personalization*
*Completed: 2026-09-14*
