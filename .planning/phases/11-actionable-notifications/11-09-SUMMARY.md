---
phase: 11-actionable-notifications
plan: 09
subsystem: ui
tags: [react-native, notifications, snooze, sqlite, expo-notifications, theme-tokens]

# Dependency graph
requires:
  - phase: 11-03
    provides: snooze-dao (snoozeContact / clearSnooze — the mutexed single writer of snooze_until + snooze/unsnooze events)
  - phase: 11-10
    provides: reconcileSchedule (self-coordinating OS-schedule reconcile engine)
  - phase: 11-04
    provides: reminders_off decay-suppression predicate (the mute toggle's real wiring)
provides:
  - "Edit-form mute toggle relabelled 'Mute reminders' + helper (copy-only; testID/position/contract unchanged)"
  - "getContactHeader widened additively with snooze_until"
  - "Profile in-app Snooze-reminders block: 3d/1w/1m presets + 'Snoozed until {date}' status + Clear"
  - "In-app reconcile-after-write on every schedule-affecting change (profile snooze/clear + edit-save mute/interval) so a pre-parked notification is cancelled/rescheduled immediately (item B)"
affects: [11-11, 11-13, dashboard-snoozed-segment, notification-schedule]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reconcile-after-write: fire-and-forget + Logger-guarded reconcileSchedule(getExecutor()) after any in-app DB write that affects the OS schedule — never awaited into the tap/save critical path (item B, mirrors the settings-change reconcile)"
    - "Local-date-safe status render: a stored bare YYYY-MM-DD is rendered DIRECTLY and compared lexicographically against formatLocalDate(new Date()) — never new Date(str) / formatLocalDate(str) (avoids the forbidden UTC evening off-by-one)"
    - "Additive header widening: append a column to getContactHeader's SELECT + both type literals; field-wise callers are untouched"

key-files:
  created: []
  modified:
    - src/screens/EditContactScreen.tsx
    - src/db/contact-read.ts
    - src/screens/ContactProfileScreen.tsx

key-decisions:
  - "Snooze preset chips render in the FilterChipRow UNSELECTED idiom (surface + border + textSecondary) — they are tap-to-snooze actions, not a persisted selection, so none is ever highlighted."
  - "Future-snooze test uses `>` (strict) against today: snooze_until == today reads as EXPIRED, matching the dashboard's bare-date `snooze_until <= today` contract."
  - "reconcile is fired AFTER the load() re-run in the profile handlers; order is non-critical since reconcile re-reads the freshly-committed row."

patterns-established:
  - "Reconcile-after-write for in-app schedule-affecting writes (NOTIF-03 item B)"
  - "Direct-string render of a stored local YYYY-MM-DD (item 7)"

requirements-completed: [NOTIF-01, NOTIF-03]

coverage:
  - id: D1
    description: "Edit-form reminders_off toggle relabelled 'Mute reminders' + helper line; testID/position/on-off contract unchanged (copy-only)"
    requirement: "NOTIF-01"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (typecheck) + npm run check:colors (theme-token gate)"
        status: pass
      - kind: manual_procedural
        ref: "Pixel-UAT: toggle reads 'Mute reminders' + helper; toggling still persists reminders_off"
        status: unknown
    human_judgment: true
    rationale: "Rendered copy + on-device toggle persistence is UI-observable only; the phase gate is on-device Pixel UAT (not runnable in this environment)."
  - id: D2
    description: "getContactHeader additively returns snooze_until so the profile reads the active snooze date from the existing header seek"
    requirement: "NOTIF-03"
    verification:
      - kind: unit
        ref: "src/db/contact-read.test.ts (18 tests) + npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "Profile Snooze-reminders block: 3d/1w/1m presets write snooze_until via snooze-dao; 'Snoozed until {date}' status + Clear appear only while a future snooze is active"
    requirement: "NOTIF-03"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit + npm run check:colors + full suite (832 tests) green"
        status: pass
      - kind: manual_procedural
        ref: "Pixel-UAT: tap 3 days/1 week/1 month -> status shows 'Snoozed until {date}'; Clear removes it; dashboard 'snoozed' segment reflects it"
        status: unknown
    human_judgment: true
    rationale: "The rendered block, preset writes, and dashboard-segment reflection are UI-observable; the phase gate is on-device Pixel UAT."
  - id: D4
    description: "Every in-app schedule-affecting write (profile snooze/clear + edit-save mute/interval) fires reconcileSchedule immediately so a pre-parked notification is cancelled/rescheduled at once (item B)"
    requirement: "NOTIF-03"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (call sites typed against reconcileSchedule) + notification-schedule unit suite green"
        status: pass
      - kind: manual_procedural
        ref: "Pixel-UAT: snoozing/muting a contact whose decay notification is imminent SUPPRESSES it (verify via getAllScheduledNotificationsAsync the decay id is cancelled/rescheduled past snooze_until without reopening the app)"
        status: unknown
    human_judgment: true
    rationale: "OS-schedule suppression is observable only on-device via getAllScheduledNotificationsAsync / that no nudge arrives; the phase gate is Pixel UAT."

# Metrics
duration: ~12min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 09: In-app NOTIF-03 surfaces (mute relabel + profile snooze presets) Summary

**Relabelled the edit-form mute toggle (copy-only), added the profile 3d/1w/1m in-app snooze presets writing snooze_until through the 11-03 DAO with a local-date-safe status + clear, and wired reconcile-after-write on every in-app schedule-affecting change so a pre-parked notification is cancelled/rescheduled immediately (item B).**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-08-16
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Edit-form `reminders_off` toggle now reads "Mute reminders" with the helper line "Keep them in Orbit, but never get reminders about them." — copy-only, testID `edit-contact-reminders-off` / position / token styling / on-off contract all unchanged (no rebuild).
- `getContactHeader` widened additively with `snooze_until` (same idiom as favourite_rank/phone); field-wise callers + `contact-read.test.ts` (18 tests) unchanged.
- Profile "Snooze reminders" block: three preset chips (`contact-profile-snooze-3d/-1w/-1m`) writing `snooze_until` via `snoozeContact`, a `contact-profile-snooze-status` line + `contact-profile-snooze-clear` shown only while a future snooze is active, all through the mutexed DAO with no confirmation and no danger token.
- Reconcile-after-write (item B): every in-app schedule-affecting write — profile snooze, profile clear, AND the edit-save mute/interval commit — fires `void reconcileSchedule(getExecutor()).catch(...)` (fire-and-forget, Logger-guarded, off the tap/save critical path) so an already-pre-parked decay notification is cancelled/rescheduled at once, not deferred to the next launch (NOTIF-03).
- Item 7 (UTC-safe): the status renders the stored bare `YYYY-MM-DD` directly and the future-snooze test compares it lexicographically against `formatLocalDate(new Date())` — never `new Date(str)` / `formatLocalDate(str)`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Relabel edit mute toggle + reconcile after edit-save** - `45d3bbd` (feat)
2. **Task 2: Widen getContactHeader with snooze_until (additive)** - `bb2e9cf` (feat)
3. **Task 3: Profile Snooze-reminders block (presets + status + clear)** - `ced76f2` (feat)

## Files Created/Modified
- `src/screens/EditContactScreen.tsx` - Mute-toggle copy relabel + helper; `handleSave` fires `reconcileSchedule(getExecutor())` (fire-and-forget, Logger-guarded) after the metadata commit.
- `src/db/contact-read.ts` - `getContactHeader` returns `snooze_until` (additive: return type + `getFirstAsync` literal + SELECT).
- `src/screens/ContactProfileScreen.tsx` - `SNOOZE_PRESETS` const, `snooze_until` on the local `Header` type, `doSnooze`/`doClearSnooze` handlers (each: DAO write -> `load()` -> fire-and-forget `reconcileSchedule`), the `contact-profile-snooze` block + styles (8/12/16/24 spacing, all theme tokens).

## Decisions Made
- Preset chips render in the FilterChipRow UNSELECTED idiom — they are actions, not a persisted selection, so none is highlighted.
- Future-snooze test is strict `>` today (snooze_until == today reads as expired, matching the dashboard bare-date contract).
- reconcile fired after `load()` in the profile handlers; order non-critical since reconcile re-reads the committed row.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Biome flagged one formatting nit in the new profile block (multiline `style` array); ran `biome check --write` on the touched files and re-verified tsc + check:colors + full suite green. No logic change.

## Known Stubs
None - all surfaces are wired to live data (snooze-dao writes, getContactHeader read, reconcileSchedule).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The two in-app NOTIF-03 writers (mute copy + snooze presets) and the edit-save reconcile are in place; 11-11 (SettingsScreen) and 11-13 (App.tsx) own the remaining reconcile call sites with no file conflict.
- **Phase gate outstanding:** on-device Pixel UAT of the rendered surfaces (mute relabel + helper; snooze presets/status/clear; dashboard snoozed-segment reflection; and OS-level suppression that a snooze/mute cancels an imminent pre-parked notification via `getAllScheduledNotificationsAsync`) is NOT runnable in this environment and must be verified on the Pixel before the phase closes.

## Self-Check: PASSED

- `src/screens/EditContactScreen.tsx` - FOUND
- `src/db/contact-read.ts` - FOUND
- `src/screens/ContactProfileScreen.tsx` - FOUND
- Commit `45d3bbd` - FOUND
- Commit `bb2e9cf` - FOUND
- Commit `ced76f2` - FOUND

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
