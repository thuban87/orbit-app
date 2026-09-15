---
phase: 37-settings-personalization
plan: 05
subsystem: ui
tags: [settings, notifications, reconcile-on-write, notification-permission, react-navigation, g-section, tdd]

# Dependency graph
requires:
  - phase: 37-settings-personalization
    plan: 01
    provides: SettingsHubScreen at the preserved Settings route, transitional SettingsMore monolith, SETTINGS_REGISTERED_ROUTES contract + source-scan test, settings-hub-model.ts
  - phase: 37-settings-personalization
    plan: 04
    provides: SettingsContactsScreen migrated-category + fresh-on-focus permission-surface/handoff pattern (openContactsSettings idiom)
provides:
  - SettingsNotificationsScreen (§G) at the registered SettingsNotifications route — all 10 notification controls (master, degraded note, Decay, Birthday, Birthday-unbound, Weekly digest, Lock-screen, Reminder time, Quiet start, Quiet end) organized by user-facing type, plus a raw OS-permission surface + Open-system-settings handoff
  - persistNotificationSettings(exec, patch, deps) — shared, tested reconcile-on-write helper (updateAppSettings → getAppSettings re-read RETURNED → both reconcilers void-fired; rejects on write failure) + settings-notifications-logic.test.ts
  - SettingsNotifications route registered (SettingsStackParamList + <Stack.Screen> + SETTINGS_REGISTERED_ROUTES) and hub row at §A index 3
  - Settings monolith slimmed — the entire Notifications group + its state/handlers/imports removed
affects: [37-06, 37-07, 37-08]

actuals:
  tokens: 9400
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Every notification/digest write routes through one shared helper persistNotificationSettings(exec, patch, deps) with injectable deps ({updateAppSettings, getAppSettings, reconcileSchedule, reconcileDigestSchedule, now}), so the reconcile-on-write path is unit-testable (ordering + both-fire + failure) rather than only asserted by source text"
    - "The helper RETURNS the fresh getAppSettings re-read (never discards it); the screen PUBLISHES it into local state on success so controls reflect the durable write, and a write REJECTION is caught to render an inline save-error notice instead of publishing a stale value (never swallowed in the helper)"
    - "Both reconcilers fire immediately (fire-and-forget via void, NOT awaited) on every notification write so the OS schedule re-arms on change (Pitfall 5), matching the shipped monolith"
    - "The RAW OS notification permission is read fresh on focus via getNotificationPermission() INDEPENDENT of the master toggle and drives a permission row + Linking.openSettings() handoff, tracked SEPARATELY from the master-on-but-blocked degraded note (mirrors openContactsSettings, incl. its calm OEM Alert fallback); permission-dependent controls stay visible with explanation"

key-files:
  created:
    - src/screens/settings-notifications-logic.ts
    - src/screens/settings-notifications-logic.test.ts
    - src/screens/SettingsNotificationsScreen.tsx
  modified:
    - src/navigation/types.ts
    - src/navigation/tabs/SettingsStack.tsx
    - src/navigation/settings-routes.ts
    - src/screens/settings-hub-model.ts
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "persistNotificationSettings extracted from the monolith's inline persist() with INJECTABLE deps so the write+re-read+both-reconcilers path is provable by unit test through the actual shared path (not a source-text name check); it RETURNS the fresh AppSettings (review MEDIUM #2 — re-read not discarded) and REJECTS on a failed updateAppSettings without invoking the reconcilers or returning a stale value (review cycle-3 failure ownership → the screen owns and renders the error)"
  - "The Notifications screen publishes the returned fresh settings on success (mirrors the monolith's setSettings(next)) so every control reflects the durable write; on a helper rejection it catches and renders an inline save-error (theme-token danger colour) instead of publishing a stale value"
  - "Raw OS permission status read fresh on focus regardless of the master toggle (the monolith only read it when master was on, which cannot power a general permission row); degraded stays the separate master-on-but-blocked concern"
  - "No schema change; TARGET_VERSION stays 29, BACKUP_FORMAT_VERSION stays 5 (D-06). Writes reuse the validated updateAppSettings path — no inline SQL (T-37-01); both reconcilers carried on every write (T-37-06 / Pitfall 5)"
  - "Birthday-unbound NOTIFICATION behaviour lives under Notifications (§G); birthday presentation stays deferred to Your Week (ADR-076) — no reversal"

requirements-completed: []

coverage:
  - id: T1
    description: "persistNotificationSettings calls updateAppSettings with the patch BEFORE the re-read, fires BOTH reconcilers on success, RETURNS the re-read AppSettings, and on a failed updateAppSettings REJECTS without invoking the reconcilers or the re-read and without returning a stale value"
    verification:
      - kind: unit
        ref: "src/screens/settings-notifications-logic.test.ts"
        status: pass
    human_judgment: false
  - id: T2
    description: "SettingsNotifications is in SETTINGS_REGISTERED_ROUTES + SettingsStackParamList, registered as a <Stack.Screen>, and the hub row is at §A index 3 in canonical §A order"
    verification:
      - kind: unit
        ref: "src/navigation/settings-routes.test.ts + src/screens/settings-hub-model.test.ts"
        status: pass
    human_judgment: false
  - id: T3
    description: "Source: the screen routes writes through persistNotificationSettings (not a bare updateAppSettings), publishes the returned value on success and catches a rejection for an inline save-error; the raw permission status is read via getNotificationPermission() fresh on focus and stored separately from degraded (not gated on the master); the permission row + Linking.openSettings() handoff render when blocked; all 10 controls render here and the group is removed from SettingsScreen.tsx"
    verification:
      - kind: source-inspection
        ref: "src/screens/SettingsNotificationsScreen.tsx + src/screens/SettingsScreen.tsx"
        status: pass
    human_judgment: false
  - id: UAT
    description: "Device UAT: toggling any notification setting re-arms the OS schedule immediately (not at next launch); with notifications denied, the permission row reflects it even with the master off and the handoff opens Android app settings; controls remain visible with an explanation"
    verification: []
    human_judgment: true
    rationale: "OS-scheduler re-arm and OS-permission surface/handoff are OS-dependent and UI-observable; deferred to end-of-phase Pixel UAT (verify-ui-on-pixel-yourself)."

duration: 8min
completed: 2026-09-14
status: complete
---

# Phase 37 Plan 05: Notifications Category (§G) Summary

**The Notifications category ships: all 10 notification controls (master, degraded note, Decay, Birthday, Birthday-unbound, Weekly digest, Lock-screen, Reminder time, Quiet start/end) migrate out of the SettingsMore monolith into a SettingsNotificationsScreen organized by user-facing type, every write routed through a new shared, unit-tested `persistNotificationSettings` reconcile-on-write helper that re-reads and returns the durable settings and fires both schedule reconcilers immediately (Pitfall 5) — plus a raw OS-permission surface (read fresh on focus, independent of the master toggle) with a `Linking.openSettings()` handoff, and no schema or backup-format change (D-06).**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2
- **Files:** 8 (3 created, 5 modified)
- **Task commits:** 3 (+ 1 docs commit)

## Accomplishments

- **`persistNotificationSettings` shared helper (Task 1, TDD).** Extracted from the monolith's inline `persist()` with injectable deps (`{ updateAppSettings, getAppSettings, reconcileSchedule, reconcileDigestSchedule, now }`) so the reconcile-on-write path is unit-testable through the actual shared path rather than a source-text name check. It writes the patch, re-reads via `getAppSettings`, fires BOTH reconcilers fire-and-forget (`void`, not awaited) so the OS schedule re-arms immediately, and RETURNS the fresh `AppSettings` (review MEDIUM #2 — the re-read is not discarded). A failed `updateAppSettings` REJECTS out of the helper (it does not catch/swallow) so the reconcilers never fire, no stale value is returned, and the caller owns the error (review cycle-3). Written RED first (`test(...)` commit), then GREEN.
- **SettingsNotificationsScreen (§G, Task 1).** A leaf category screen (`ShellAppBar variant="child"` + `onBack`) migrating all 10 controls from the monolith, grouped by user-facing type: Notifications (master + degraded note + permission row), Relationship reminders (Decay), Birthdays (Birthday + Birthday-unbound), Weekly digest, Delivery time (Reminder time + Quiet start/end + the native time picker), and Notification display (lock-screen). Every write routes through `persistNotificationSettings` (never a bare `updateAppSettings`), publishes the returned fresh settings on success so controls reflect the durable write, and catches a rejection to surface an inline save-error notice (theme-token `danger`) rather than publishing a stale value. testIDs + accessibility labels carried verbatim from the monolith.
- **Notification-permission surface + handoff (Task 2, §G).** The raw OS permission is read fresh on focus via `getNotificationPermission()` INDEPENDENT of the master toggle and stored in its own state, SEPARATE from the master-on-but-blocked `degraded` note (the monolith only read permission when the master was on, which cannot power a general permission row). A permission row renders true OS status regardless of the master; when blocked it offers an actionable **Open system settings** handoff via `Linking.openSettings()` with a calm OEM `Alert` fallback (mirrors `openContactsSettings`) — never a silent re-prompt. Permission-dependent controls stay visible with explanation.
- **Route registration + hub row (Task 1).** `SettingsNotifications: undefined` added to `SettingsStackParamList`, a `SettingsNotificationsRoute` wrapper + `<Stack.Screen>` registered in `SettingsStack.tsx`, `"SettingsNotifications"` appended to `SETTINGS_REGISTERED_ROUTES`, and the **Notifications** hub row inserted at §A index 3 (after Interactions, before the transitional `SettingsMore` row — which stays last, per the hub-model regression test).
- **Monolith slimmed (Task 1).** The entire Notifications section plus its now-orphaned state (`settings`, `degraded`, `activePicker`), handlers (`reloadNotifications`, `persist`, `onToggleMaster`, `onPickTime`), helpers (`formatHour`, `seedForHour`), the `ActivePicker` type, and the notification-only imports (DateTimePicker, permission service, both reconcilers, `updateAppSettings`/`getAppSettings`/`AppSettings`/`AppSettingsPatch`, `localDateTime`) were removed from `SettingsScreen.tsx`. AI hub, Add-Orbit-widget, and Systems remain for later plans.
- No migration added; `TARGET_VERSION` stays 29, `BACKUP_FORMAT_VERSION` stays 5 (D-06).

## Task Commits

1. **Task 1 (RED):** failing test for `persistNotificationSettings` reconcile-on-write helper — `424a7c3` (test)
2. **Task 1 (GREEN):** Notifications category (§G) — all 10 controls via shared reconcile-on-write helper — `c4c6a6e` (feat)
3. **Task 2:** notification-permission surface + system-settings handoff (§G) — `af27ff8` (feat)

## Files

- **Created:** `src/screens/settings-notifications-logic.ts`, `src/screens/settings-notifications-logic.test.ts`, `src/screens/SettingsNotificationsScreen.tsx`
- **Modified:** `src/navigation/types.ts` (SettingsNotifications route name), `src/navigation/tabs/SettingsStack.tsx` (wrapper + `<Stack.Screen>`), `src/navigation/settings-routes.ts` (append SettingsNotifications), `src/screens/settings-hub-model.ts` (hub row §A index 3), `src/screens/SettingsScreen.tsx` (Notifications group + orphans removed)

## Deviations from Plan

**1. [Rule 3 - Stale plan reference] Plan cited monolith lines 1173–1529 for the Notifications group; the file was already slimmed to 313–669 by Plans 01–04.**
- **Found during:** Task 1 read-first.
- **Issue:** The PLAN's `read_first`/`action` cite SettingsScreen.tsx line ranges (persist at 501–520, permission at 349, group at 1173–1529) from the pre-decomposition monolith. Plans 01–04 had already migrated Appearance/Interactions/Contacts out, so on disk the Notifications group lived at ~313–669 and `persist()` at ~190–209.
- **Fix:** Migrated the group by CONTENT (the 10 controls + persist + degraded + permission read), not by the stale line numbers. Behaviour carried verbatim.
- **Files:** `src/screens/SettingsNotificationsScreen.tsx`, `src/screens/SettingsScreen.tsx`
- **Commit:** `c4c6a6e`

No other deviations — the plan executed as written (the "screen-reflects-write" coverage is asserted by source inspection + the helper return/rejection test, exactly as the cycle-3 AC scoped it; no RN component-render test is run in this phase's vitest-node env).

## Known Stubs

None. Every rendered control drives a live `persistNotificationSettings` write (reconcile-on-write) or the OS-permission handoff. The permission row and save-error notice render only from live state.

## Threat Flags

None new. Notification/digest writes reuse the monolith's validated `updateAppSettings` path — no inline SQL (T-37-01 mitigated) — and carry BOTH `reconcileSchedule` + `reconcileDigestSchedule` on every write, asserted by the helper's unit test (T-37-06 / Pitfall 5 mitigated). The OS permission is READ and surfaced; the handoff opens system settings (no in-app grant, no new egress). No data leaves the device.

## User Setup Required

None for automated verification. Device UAT (see coverage UAT) on the owner's Pixel: confirm toggling any notification setting re-arms the OS schedule immediately (not at next launch); with notifications denied, the permission row reflects it even with the master off and the handoff opens Android app settings; controls stay visible with an explanation. Deferred to end-of-phase UAT (verify-ui-on-pixel-yourself). Note (memory: no-ai-api-calls-without-clearing) — N/A here; this plan touches no AI path.

## Verification

- `npx vitest run src/screens/settings-notifications-logic.test.ts` — 4/4 pass.
- `npx vitest run src/screens/settings-hub-model.test.ts src/navigation/settings-routes.test.ts` — green.
- `npx tsc --noEmit` — clean (project-wide).
- `npm run check:colors` — clean.
- `npx biome check` on all touched files — clean.
- Full suite: 3578 tests pass across 376 files; 1 pre-existing unrelated transform failure (`src/components/orrery/orrery-controls-render.test.tsx`, Phase 29 `Unexpected token 'typeof'`, 0 tests run) — out of scope, not caused by this plan.

## Self-Check: PASSED

All three created files present on disk; all five modified files present; all three task commits (`424a7c3`, `c4c6a6e`, `af27ff8`) exist in git history.
