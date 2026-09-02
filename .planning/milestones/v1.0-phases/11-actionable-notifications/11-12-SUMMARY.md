---
phase: 11-actionable-notifications
plan: 12
subsystem: notifications
tags: [expo-notifications, react-navigation, navigationRef, cold-start, tap-routing]

# Dependency graph
requires:
  - phase: 11-01
    provides: NotificationData payload contract + DEFAULT_ACTION_IDENTIFIER classification ids
  - phase: 11-07
    provides: handleNotificationAction — the exactly-once shared mark/snooze handler
provides:
  - "resolveNotificationNav(data) — a pure, node-tested tap-routing decision (reset for decay, navigate for birthday, null for malformed)"
  - "NotificationResponseGate — the OS-listener wiring (warm + cold-start) that applies the routing decision and funnels action taps to the shared handler"
affects: [11-13, notifications, navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-decision / OS-wiring split: routing logic is a serializable node-testable function; the gate is a thin adapter that applies it"
    - "ShareIntentGate-style isReady-gated queue: a pre-ready body tap is parked in reactive state and flushed once navigator readiness settles"

key-files:
  created:
    - src/services/notifications/notification-nav.ts
    - src/services/notifications/notification-nav.test.ts
    - src/navigation/notification-gate.tsx
  modified: []

key-decisions:
  - "Body-tap routing is a reset (not navigate) onto [Home, Compose] so Back always lands on the dashboard regardless of the OS-handed stack under singleTask/onNewIntent (Pitfall 7 / T-11-BACKSTACK)."
  - "Only DEFAULT_ACTION_IDENTIFIER is treated as a body tap; every other non-mark/snooze actionIdentifier is ignored (review item 8)."
  - "Cold-start response is read once via getLastNotificationResponseAsync inside the isReady-gated effect and cleared afterward so a relaunch cannot replay it (H2 / T-11-REPLAY)."

patterns-established:
  - "Pure routing decision + node test, separate from OS listener wiring"
  - "Logger-guarded catch around the foreground action handler so a stale/purged contactId or benign idempotency rejection can never become an unhandled promise rejection"

requirements-completed: [NOTIF-02, NOTIF-04]

coverage:
  - id: D1
    description: "resolveNotificationNav routes a decay body tap to a reset onto [Home, Compose{contactId}], a birthday body tap to navigate Profile{contactId}, and a malformed payload to null."
    requirement: "NOTIF-02"
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-nav.test.ts#resolveNotificationNav"
        status: pass
    human_judgment: false
  - id: D2
    description: "NotificationResponseGate routes warm + cold-start taps: body tap opens Compose (Back → dashboard), birthday tap opens Profile, mark/snooze write exactly once, a pre-ready body tap routes once ready, and a cold-start tap does not re-route on relaunch."
    requirement: "NOTIF-04"
    verification:
      - kind: manual_procedural
        ref: "Pixel-UAT (phase gate): decay body tap → Compose → Back → dashboard; birthday tap → Profile; warm mark/snooze writes once; cold-start routes once and does not replay; pre-isReady body tap routes once ready"
        status: unknown
    human_judgment: true
    rationale: "Tap delivery, cold-start launch, and navigator-readiness timing are OS-driven and only observable on-device; the gate wires expo-notifications + react-navigation imperatively and cannot be exercised in the node test harness."

# Metrics
duration: 4min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 12: Notification Tap Routing Summary

**A pure `resolveNotificationNav` decision (decay → reset to [Home, Compose], birthday → navigate Profile, malformed → null) plus a ShareIntentGate-style `NotificationResponseGate` that wires warm and cold-start taps to navigation or the shared exactly-once action handler.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-08-16T17:20:00Z
- **Completed:** 2026-08-16T17:24:00Z
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments
- `resolveNotificationNav(data)` — a pure, serializable, node-tested routing decision separate from the OS wiring: decay → `{type:"reset",index:1,routes:[Home, Compose{contactId}]}`, birthday → `{type:"navigate",name:"Profile",params:{contactId}}`, malformed/unknown → `null`.
- `NotificationResponseGate({ isReady })` — a render-null gate mirroring `ShareIntentGate`: warm taps via `addNotificationResponseReceivedListener`, the cold-start tap via `getLastNotificationResponseAsync` read once in the `isReady`-gated effect, reusing the existing `navigationRef`.
- Classification routes ONLY `DEFAULT_ACTION_IDENTIFIER` as a body tap and `ACTION_MARK`/`ACTION_SNOOZE` to the shared `handleNotificationAction`; a pre-`isReady` body tap is queued in reactive state and flushed once readiness settles.
- The foreground action call is wrapped in a Logger-guarded `.catch`, and `clearLastNotificationResponseAsync()` is called after a cold-start response to prevent relaunch replay.

## Task Commits

Each task was committed atomically:

1. **Task 1: resolveNotificationNav — pure routing decision (TDD)** - `76f5f9a` (test, RED) → `63ca505` (feat, GREEN)
2. **Task 2: NotificationResponseGate — cold-start + warm tap wiring** - `e26b994` (feat)

**Plan metadata:** _(this SUMMARY + ROADMAP commit)_

_Note: Task 1 followed the RED → GREEN TDD cycle (no refactor commit needed)._

## Files Created/Modified
- `src/services/notifications/notification-nav.ts` - Pure `resolveNotificationNav` + the `NavIntent` discriminated-union type.
- `src/services/notifications/notification-nav.test.ts` - Node test covering decay/birthday/malformed with exact shapes.
- `src/navigation/notification-gate.tsx` - `NotificationResponseGate` (warm + cold-start wiring, DEFAULT-only body tap, queued-until-ready routing, Logger-guarded action catch, cold-start replay clear).

## Decisions Made
- **Body tap is a reset, not a navigate** onto [Home, Compose] so Back always reaches the dashboard regardless of the prior stack under Android singleTask/onNewIntent (Pitfall 7).
- **Only `DEFAULT_ACTION_IDENTIFIER` counts as a body tap** — every other non-mark/snooze id is ignored, not treated as a body tap (review item 8).
- **`getLastNotificationResponseAsync` is read exactly once** (guarded by a ref) inside the `isReady`-gated effect and cleared afterward (H2 replay guard). The warm listener parks body taps in reactive state so the same flush effect handles queued and immediate taps uniformly.
- **`content.data` cast through `unknown`** to `NotificationData` in `dataOf` — the payload is app-minted at schedule time; body taps re-validate via the resolver and action taps are caught by the guarded catch.

## Deviations from Plan

None - plan executed exactly as written. (The only implementation note: `ACTION_MARK`/`ACTION_SNOOZE`/`NotificationData` are imported from `notification-ids` rather than `notification-actions`, since `notification-actions` imports but does not re-export them — a source-of-truth import, not a behavioral change.)

## Issues Encountered
- tsc initially flagged `content.data` (`Record<string, unknown> | undefined`) as non-overlapping with `NotificationData`; resolved by casting through `unknown` in the `dataOf` helper with an explanatory comment. No behavioral impact.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The gate is ready to be mounted by `App.tsx` alongside `<ShareIntentGate/>` in **11-13** (passing the same reactive `navReady` flag as `isReady`).
- **Pixel-UAT is the remaining phase gate** for Task 2 (D2): tap delivery, cold-start launch, and navigator-readiness timing are OS-driven and only verifiable on-device.

## Self-Check: PASSED

All three created files exist on disk; all three task commits (`76f5f9a`, `63ca505`, `e26b994`) are present in git history.

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
