---
phase: 11-actionable-notifications
plan: 07
subsystem: notifications
tags: [expo-notifications, expo-task-manager, headless, idempotency, sqlite, recency-dao, snooze-dao]

# Dependency graph
requires:
  - phase: 11-01
    provides: expo-notifications + expo-task-manager installed; notification-ids (DECAY_CATEGORY, ACTION_MARK/SNOOZE, decayIdentifier, actionUid, NotificationData)
  - phase: 11-03
    provides: snooze-dao (snoozeContact, PRESET_MODIFIERS "1w") + reserved snooze/unsnooze events
provides:
  - "ensureNotificationCategories() — registers the DECAY_CATEGORY mark+snooze buttons (opensAppToForeground:false)"
  - "handleNotificationAction(data, actionIdentifier) — the ONE exactly-once shared write handler (foreground listener + headless task both funnel here)"
  - "headless-task.ts — module-scope expo-task-manager task (defineTask + registerTaskAsync) for the killed-app path"
  - "NOTIFICATION_ACTION_TASK task-name constant"
affects: [11-12 foreground response listener, 11-13 App.tsx wiring/import, 11-09 in-app snooze reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One exactly-once shared handler with two dedup layers: in-process handledSet + durable UNIQUE(uid) backstop via deterministic actionUid()"
    - "Killed-app DB bootstrap: await openAndMigrate() (idempotent) before getExecutor() so a headless launch has a live migrated DB"
    - "Headless writes route ONLY through the mutexed DAOs; headless path does the write + a single decay cancel, never a reconcile (Pitfall 5)"

key-files:
  created:
    - src/services/notifications/notification-actions.ts
    - src/services/notifications/notification-actions.test.ts
    - src/services/notifications/headless-task.ts
  modified: []

key-decisions:
  - "Deterministic actionUid() as the interaction/event uid (never newUid()) so re-delivery/cold-replay collides on UNIQUE(uid) — H2"
  - "openAndMigrate() awaited before getExecutor() inside the shared handler — H1 (killed-app DB bootstrap)"
  - "On a swallowed UNIQUE replay the handler STILL cancels the decay notification (already acted on) but does NOT rethrow; any other error is logged and the key is NOT recorded so a genuine transient failure can retry"
  - "Post-snooze +1-week re-arm is LAUNCH-DEFERRED to the next foreground reconcile (headless has no guaranteed ensureChannels) — Pitfall 5 / owner-flag below"

patterns-established:
  - "Exactly-once notification action: handledSet (warm) + UNIQUE(uid) (cold) dual dedup"
  - "Headless-safe DB access: idempotent openAndMigrate() bootstrap inside the shared handler"

requirements-completed: [NOTIF-02]

coverage:
  - id: D1
    description: "Shared exactly-once handler: mark -> recordTouchpoint (canonical one-tap values), snooze -> snooze-dao +1w, both cancel the decay id; DB bootstrapped before write; unknown action inert"
    requirement: "NOTIF-02"
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-actions.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Exactly-once under re-delivery: a warm double (handledSet) and a cold replay (UNIQUE(uid) backstop) each write exactly one row"
    requirement: "NOTIF-02"
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-actions.test.ts#exactly-once (H2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Module-scope headless task (expo-task-manager) writes killed-app actions through the DB-bootstrapping shared handler on the FCM-less release APK"
    requirement: "NOTIF-02"
    verification:
      - kind: manual_procedural
        ref: "Pixel-UAT (A2 device spike): kill app, tap mark/snooze from shade, read row back via run-as com.bwales.orbit; assert exactly one row + reconcile did not run"
        status: unknown
    human_judgment: true
    rationale: "The FCM-less headless bring-up cannot be exercised in the JS/vitest harness — the native task runtime is absent. Must be proven on the physical Pixel (A2 spike carried from 04-log F5)."

# Metrics
duration: 12min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 07: Headless Notification Actions (write side) Summary

**Mark and snooze notification taps now write identically and EXACTLY ONCE through one shared handler — bootstrapping the DB on a killed-app headless launch (H1) and deduping re-delivery via the deterministic actionUid + UNIQUE(uid) constraint (H2) — routed only through the mutexed recency/snooze DAOs.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-16T16:54:00Z
- **Completed:** 2026-08-16T17:00:00Z
- **Tasks:** 2 completed
- **Files created:** 3

## Accomplishments
- `notification-actions.ts`: `ensureNotificationCategories()` (DECAY_CATEGORY mark+snooze buttons, both `opensAppToForeground:false`) and the ONE exactly-once `handleNotificationAction(data, actionIdentifier)` — awaits idempotent `openAndMigrate()` before `getExecutor()` (H1), derives the deterministic `actionUid()` as the row uid (H2), mark → `recordTouchpoint` with the 04-log canonical values (source `notification`, outbound, unspecified, connected 1, quality null), snooze → `snoozeContact` "1w", both then cancel `decayIdentifier(contactId)`.
- Two dedup layers: an in-process `handledSet` short-circuits warm double-delivery; a swallowed `UNIQUE constraint failed` rejection is the durable cold-replay backstop (still cancels, never rethrows). Any other error is logged and the key is NOT recorded so a transient failure can retry.
- `headless-task.ts`: module-scope `TaskManager.defineTask` + `registerTaskAsync` (task id `orbit-notification-action`) that parses the notification response payload and funnels to the shared handler — registration-only at import, no reconcile/sweep reachable (Pitfall 5).
- Co-located test drives the REAL DAOs against an in-memory `node:sqlite` DB (via a mocked `@/db/database`), proving canonical mark/snooze writes, the decay cancel, unknown-action inertness, both button flags, and — the H2 headline — that both a warm double and a cold replay write exactly one row.

## Task Commits

1. **Task 1: notification-actions — category + shared handler (tdd)** - `2dc4ef1` (feat)
2. **Task 2: headless-task — module-scope registerTaskAsync** - `cc57586` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified
- `src/services/notifications/notification-actions.ts` - Action category registration + the exactly-once shared write handler.
- `src/services/notifications/notification-actions.test.ts` - Behavioural proof against in-memory node:sqlite + the real DAOs (6 tests).
- `src/services/notifications/headless-task.ts` - Module-scope expo-task-manager headless task funneling to the shared handler.

## Decisions Made
- **UNIQUE-replay still cancels, never rethrows.** A cold-replayed tap that collides on `UNIQUE(uid)` was already acted on, so the handler swallows it, records the key, and STILL cancels the (already-acted) decay notification — the tap must never surface an error to the OS. A non-UNIQUE error is logged and the key is deliberately NOT recorded, leaving the door open for a legitimate retry.
- **Test uses the real DAOs, not DAO spies.** The plan allowed either; driving the real `recordTouchpoint`/`snoozeContact` against in-memory `node:sqlite` makes the exactly-once test assert the ACTUAL UNIQUE(uid) collision path rather than a mock, which is the whole point of H2.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- `vi.resetModules()` (needed so each test starts with an empty `handledSet`) re-instantiates the mocked `expo-notifications`, so the mock refs had to be re-fetched from the freshly-imported module inside `freshHandler()` rather than captured once at the top of the file. Resolved; unit tests green.
- The migration-1 test seed needs a UNIQUE uid per default-category insert, so the test's `newUid` is a counter, not a constant. Resolved.

## User Setup Required
None - no external service configuration required.

## Owner Flag (carried from the plan)
- **Confirm the headless-snooze +1-week re-arm may remain launch-deferred.** The headless path writes the snooze + cancels the imminent decay notification, but deliberately does NOT reconcile to pre-arm the post-snooze occurrence (no mounted React → no guaranteed `ensureChannels()`, the immutable-channel privacy landmine; Pitfall 5). The re-arm rides the next foreground reconcile (DECIDED NOTIF-01 cadence + OQ-3 "reconcile-on-launch, no background backstop"). The in-app snooze path (11-09) reconciles immediately because the app is alive.

## Next Phase Readiness
- **11-12** wires the foreground `addNotificationResponseReceivedListener` into the same `handleNotificationAction` and calls `clearLastNotificationResponseAsync()` after a cold-start response.
- **11-13** imports `headless-task.ts` (for its registration side effect) and calls `ensureNotificationCategories()` at startup.
- **A2 Pixel-UAT (phase gate):** the killed-app FCM-less mark/snooze write + single-row + no-reconcile assertions remain to be proven on-device before NOTIF-02 is called done.

## Self-Check: PASSED
- All 3 created files present on disk.
- Both task commits (`2dc4ef1`, `cc57586`) present in git history.
- `npx vitest run src/services/notifications/` — 51 passed; `npx tsc --noEmit` clean; biome clean.

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
