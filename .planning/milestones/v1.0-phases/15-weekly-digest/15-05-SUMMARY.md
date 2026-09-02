---
phase: 15-weekly-digest
plan: 05
subsystem: ui
tags: [notifications, react-navigation, expo-notifications, settings, digest]

# Dependency graph
requires:
  - phase: 15-02
    provides: digestEnabled column + WritableSettingsKey/AppSettingsPatch + assertToggle guard
  - phase: 15-03
    provides: reconcileDigestSchedule (defer-one guarded, self-coordinating)
  - phase: 15-04
    provides: Digest route registered in the navigator
provides:
  - resolveNotificationNav digest branch — a [Home, Digest] RESET NavIntent for kind:"digest" taps
  - Settings "Weekly digest" master-gated toggle row (4th notification type)
  - reconcileDigestSchedule folded into the SHARED settings persist path (master + delivery-hour + toggle)
affects: [15-06, weekly-digest device UAT, notification routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Digest tap routing is a RESET (not a navigate), mirroring the decay reset, so Back always lands on the dashboard on warm AND cold stacks (T-11-BACKSTACK / review H3)"
    - "Every digest-affecting settings write reconciles the WEEKLY trigger via a single SHARED post-write path — no per-control reconcile (review H1 / Pitfall 7)"

key-files:
  created: []
  modified:
    - src/services/notifications/notification-nav.ts
    - src/services/notifications/notification-nav.test.ts
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "Digest pre-check runs BEFORE isNotificationData narrowing — a digest payload carries no contactId, so the numeric-contactId narrowing would wrongly reject it; nothing to forge (V5)"
  - "Distinct RESET NavIntent variant for the digest ([Home, Digest]) rather than loosening the decay Compose{contactId} reset tuple"
  - "reconcileDigestSchedule folded into the shared `persist` handler, not a one-row persistDigest callback — so master ON/OFF, the delivery-hour picker, and the digest toggle all arm/cancel/re-time the WEEKLY trigger immediately"

patterns-established:
  - "Notification-kind routing lives entirely in the pure resolver (takes `unknown`); the gate's existing applyBodyNav reset branch applies any reset intent unchanged"

requirements-completed: [DGST-01]

coverage:
  - id: D1
    description: "A tapped digest notification resolves to a [Home, Digest] RESET (index 1) so Back returns to the dashboard on warm and cold stacks; a forged contactId is not forwarded; decay/birthday/malformed routing byte-unchanged"
    requirement: DGST-01
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-nav.test.ts#routes a digest body tap to a RESET onto [Home, Digest] (index 1)"
        status: pass
      - kind: unit
        ref: "src/services/notifications/notification-nav.test.ts#routes a digest tap to the SAME [Home, Digest] reset and forwards no contactId"
        status: pass
    human_judgment: false
  - id: D2
    description: "Settings has a master-gated 'Weekly digest' toggle (4th notification type, defaults ON) whose writes — plus master ON/OFF and the delivery-hour picker — reconcile the WEEKLY trigger via the shared persist path"
    requirement: DGST-01
    verification:
      - kind: unit
        ref: "src/services/notifications/digest-schedule.test.ts (15-03: per-transition arm/cancel/re-time proven at the reconcile layer)"
        status: pass
      - kind: manual_procedural
        ref: "15-06 device UAT: toggle OFF cancels, ON arms, delivery-hour re-times on the Pixel"
        status: unknown
    human_judgment: true
    rationale: "The Settings row's on-device switch behaviour and the OS schedule state per transition are device-UAT (project pattern); 15-06 re-verifies all three transition paths on the Pixel"

# Metrics
duration: 2min
completed: 2026-08-23
status: complete
---

# Phase 15 Plan 05: Digest Tap Routing + Settings Toggle Summary

**Digest notification taps resolve to a [Home, Digest] RESET (Back → dashboard on warm and cold stacks), and a master-gated "Weekly digest" Settings toggle arms/cancels the WEEKLY trigger through the shared settings persist path.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-08-23T23:15:38Z
- **Completed:** 2026-08-23T23:17:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added a distinct RESET `NavIntent` variant `{ type:"reset", index:1, routes:[{name:"Home"},{name:"Digest"}] }` and a digest pre-check in `resolveNotificationNav` — placed BEFORE `isNotificationData` so a contactId-less digest payload is accepted (review H3 / T-11-BACKSTACK); the decay/birthday reset+navigate branches are byte-unchanged.
- Added the master-gated "Weekly digest" Settings row (4th notification type, after Birthday alerts, before lock-screen), defaulting ON, writing `digestEnabled` via the existing `persist` path.
- Folded `reconcileDigestSchedule(exec)` into the SHARED `persist` handler so master ON/OFF, the delivery-hour picker, and the digest toggle all reconcile the WEEKLY trigger synchronously (review H1 / Pitfall 7) — no one-row `persistDigest`.
- The notification-gate was NOT edited: its existing `applyBodyNav` reset branch applies the digest reset unchanged; `notification-schedule.ts` / `notification-actions.ts` / `notification-gate.tsx` show no diff.

## Task Commits

Each task was committed atomically:

1. **Task 1: Digest tap routing — RESET onto [Home, Digest] (resolver only, TDD)** - `89fefa4` (feat)
2. **Task 2: Settings "Weekly digest" toggle row + shared-path reconcile** - `654ca05` (feat)

_TDD Task 1: RED (2 new digest tests failing) → GREEN (resolver branch) committed together as one atomic task commit._

## Files Created/Modified
- `src/services/notifications/notification-nav.ts` - Added digest RESET NavIntent variant + pre-check branch (returns [Home, Digest] reset for kind:"digest", no contactId forwarded)
- `src/services/notifications/notification-nav.test.ts` - Added two digest cases asserting the exact reset shape and that a forged contactId is not forwarded
- `src/screens/SettingsScreen.tsx` - Imported reconcileDigestSchedule; folded it into the shared `persist` handler; added the master-gated "Weekly digest" toggle row

## Decisions Made
- Digest pre-check runs before `isNotificationData` narrowing (a digest carries no contactId to narrow on — V5 boundary).
- A distinct RESET variant for the digest rather than loosening the decay Compose{contactId} tuple.
- Shared-path reconcile (not a per-control callback) so no future settings write can silently skip re-arming the digest.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Verification / Gate Results
- `npx vitest run src/services/notifications/notification-nav.test.ts` — 7/7 pass (2 new digest cases + 5 existing byte-green).
- Full notification + navigation suite (`npx vitest run src/services/notifications/ src/navigation/`) — 135/135 pass, 11 files.
- `npx tsc --noEmit` — clean.
- `npm run check:colors` — clean (all colours via theme tokens).
- `npx biome check src/screens/SettingsScreen.tsx` — clean.
- `git diff --stat` on `notification-schedule.ts` / `notification-actions.ts` / `notification-gate.tsx` — no changes (shipped machinery + gate untouched).
- Acceptance greps: `grep -c persistDigest` = 0; `reconcileDigestSchedule` present inside the shared `persist` callback; `settings-notifications-digest` testID present between birthday and lock-screen rows.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DGST-01 fully wired end-to-end: tap opens the live Digest screen via a [Home, Digest] RESET, and the toggle independently arms/cancels the weekly trigger with no path leaving a disabled digest armed.
- 15-06 device UAT re-verifies the three OS-schedule transition paths (master OFF cancels, master ON arms, delivery-hour re-times) and the tap-through on the Pixel.

## Self-Check: PASSED

All modified source files and both task commits (89fefa4, 654ca05) verified present.

---
*Phase: 15-weekly-digest*
*Completed: 2026-08-23*
