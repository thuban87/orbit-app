---
phase: 11-actionable-notifications
plan: 06
subsystem: infra
tags: [expo-notifications, android-channels, post-notifications, permissions, notifications]

# Dependency graph
requires:
  - phase: 11-01
    provides: notification-ids (versioned channel id constants, DECAY_*/BIRTHDAY_* + the expo-notifications test double)
provides:
  - "ensureChannels() — idempotent creation of decay-private-v1, decay-public-v1, birthday-v1 at AndroidImportance.LOW"
  - "getNotificationPermission() / requestNotificationPermission() — value-moment POST_NOTIFICATIONS wrappers with graceful denial degrade"
affects: [11-02, 11-10, notification-schedule, launch-sweep, settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OS notification channels are create-only + versioned (-v1); importance/visibility are immutable at creation, so a behaviour change ships as a new -v2 id, never a re-set"
    - "Lock-screen visibility is a channel-selection concern (private vs public decay channel), never a channel mutation"
    - "OS permission read fresh every call (never cached); requested once at a value moment; rejection resolves to granted:false (no throw, no re-nag)"
    - "expo-notifications unit tests: vi.mock('expo-notifications') + the 11-01 double, vi.mocked() for typed .mock access, vi.clearAllMocks() between tests"

key-files:
  created:
    - src/services/notifications/channels.ts
    - src/services/notifications/channels.test.ts
    - src/services/notifications/permission.ts
    - src/services/notifications/permission.test.ts
  modified: []

key-decisions:
  - "All three channels created at AndroidImportance.LOW (silent, no heads-up, still shade/lock visible) — the correct Android tier for the owner's RATIFIED 'silent, no heads-up' intent; DEFAULT plays a sound and was NOT used"
  - "Birthday is a single PRIVATE channel (OQ-2); only the two decay channels split PRIVATE/PUBLIC"
  - "No custom sound set on any channel — LOW is silent by tier"
  - "Permission wrappers guard the OS call and resolve to {granted:false, status:'denied'} on rejection so callers degrade to in-app-only without a try/catch"

patterns-established:
  - "Versioned, create-only channel wiring keyed on notification-ids constants"
  - "Fresh-read, ask-once, no-re-nag permission wrappers returning {granted, status}"

requirements-completed: [NOTIF-05]

coverage:
  - id: D1
    description: "Three channels created idempotently with versioned ids and AndroidImportance.LOW: decay-private-v1 (PRIVATE), decay-public-v1 (PUBLIC), birthday-v1 (PRIVATE)"
    requirement: NOTIF-05
    verification:
      - kind: unit
        ref: "src/services/notifications/channels.test.ts#ensureChannels — immutable, versioned, LOW-importance channel set"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lock-screen visibility expressed by channel choice (private vs public decay channel), never by mutating an existing channel; ensureChannels is idempotent"
    requirement: NOTIF-05
    verification:
      - kind: unit
        ref: "src/services/notifications/channels.test.ts#splits lock-screen visibility by channel / is idempotent"
        status: pass
    human_judgment: false
  - id: D3
    description: "POST_NOTIFICATIONS requested at a value moment and status read fresh; denial reported (granted:false) so caller degrades to in-app only without re-nag; OS rejection never throws"
    requirement: NOTIF-05
    verification:
      - kind: unit
        ref: "src/services/notifications/permission.test.ts#getNotificationPermission / requestNotificationPermission"
        status: pass
    human_judgment: false
  - id: D4
    description: "On-device Pixel UAT: real POST_NOTIFICATIONS dialog on grant/deny; per-channel private/public lock-screen visibility; delivered decay/birthday notification is SILENT (no sound, no heads-up peek), shade/lock only"
    verification: []
    human_judgment: true
    rationale: "OS-only behaviour (permission dialog, lock-screen rendering, silence/heads-up) is not observable from a node unit test — requires the phase-gate Pixel UAT (H4 acceptance)"

# Metrics
duration: 8min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 06: Notification Channels & Permission Wiring Summary

**Idempotent, versioned LOW-importance Android channel set (decay private/public split + single private birthday) plus value-moment POST_NOTIFICATIONS wrappers that degrade gracefully on denial.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-16T16:48:00Z
- **Completed:** 2026-08-16T16:51:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 created

## Accomplishments
- `ensureChannels()` creates `decay-private-v1`, `decay-public-v1`, `birthday-v1` idempotently at `AndroidImportance.LOW` — genuinely silent, no heads-up peek, still visible in the shade/lock screen (the owner's RATIFIED "silent, no heads-up" intent; DEFAULT would play a sound and was deliberately NOT used).
- Lock-screen visibility is a per-channel property expressed by WHICH decay channel a notification posts to (PRIVATE vs PUBLIC); birthday is a single PRIVATE channel (OQ-2). No mutate-existing path exists — channels are create-only and versioned.
- `getNotificationPermission()` / `requestNotificationPermission()` are thin, fresh-read wrappers returning `{ granted, status }`; they ask once (no re-nag) and resolve to `{ granted: false }` on OS rejection so the caller degrades to in-app only without a try/catch.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: channels.ts — LOW-importance channel set**
   - `0129052` (test — RED)
   - `2983034` (feat — GREEN)
2. **Task 2: permission.ts — value-moment POST_NOTIFICATIONS request + status read**
   - `f03810c` (test — RED)
   - `577e2c8` (feat — GREEN)

_Note: TDD tasks have a RED (test) then GREEN (feat) commit._

## Files Created/Modified
- `src/services/notifications/channels.ts` - `ensureChannels()`; create-only, versioned, LOW-importance channel set with the private/public decay split + single private birthday channel. Top-of-file comment records why LOW (not DEFAULT) and why importance/visibility are immutable at creation.
- `src/services/notifications/channels.test.ts` - Asserts the three creates with exact ids, `AndroidImportance.LOW`, PRIVATE/PUBLIC/PRIVATE visibility, no custom sound, and idempotent repeat (never a mutate).
- `src/services/notifications/permission.ts` - `getNotificationPermission()` + `requestNotificationPermission()`; fresh read, ask-once, graceful-degrade wrappers.
- `src/services/notifications/permission.test.ts` - Asserts granted/denied mapping and that an OS rejection resolves to `granted:false` (never throws).

## Decisions Made
- Followed the plan and the RATIFIED CONTEXT decision exactly: `AndroidImportance.LOW` on all three channels. Task-1's `<name>` was already corrected to "LOW-importance channel set" (Cycle-2 folded note), and the body correctly specified LOW — implemented as LOW, no DEFAULT anywhere.
- Tests assert against the symbolic `AndroidImportance.LOW` (not a literal), because the 11-01 test double maps `LOW=2` while the real Android enum is `LOW=4`; symbolic assertion keeps the test correct under both.

## Deviations from Plan

None - plan executed exactly as written. (No Rule 1-4 deviations. The one implementation nuance — using `vi.mocked()` + `vi.clearAllMocks()` instead of the mock's `__reset`/raw `.mock` access — was required so `tsc --noEmit` stays clean against the REAL expo-notifications types, which the test statically resolves; this is a test-authoring detail, not a behavioural change.)

## Issues Encountered
- First test draft imported the mock-only `__reset` export and accessed `.mock` on the raw `setNotificationChannelAsync`, which failed `tsc --noEmit` (tsc resolves the real `expo-notifications` .d.ts, not the runtime double). Resolved by importing only real exports and using `vi.mocked(...)` for typed `.mock` access + `vi.clearAllMocks()` for teardown. All gates green afterward.

## User Setup Required
None - no external service configuration required. (POST_NOTIFICATIONS is requested at runtime; on-device grant/deny is part of the phase-gate Pixel UAT, not a build-time setup step.)

## Next Phase Readiness
- `ensureChannels()` is ready for the launch-sweep reconcile to call; `channelId` selection between `decay-private-v1` / `decay-public-v1` is the scheduler's concern (feeds from the `lockscreen_public` setting, 11-02).
- Permission wrappers are ready to gate scheduling at the value moment (degrade-to-in-app on denial).
- **Phase gate remains:** on-device Pixel UAT (D4) — real permission dialog, per-channel lock-screen private/public rendering, and confirmation that delivered decay/birthday notifications are SILENT with no heads-up peek (H4 acceptance). Not automatable; carried to the phase verification.

## Self-Check: PASSED

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
