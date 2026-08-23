---
phase: 15
reviewers: [claude, codex]
reviewed_at: 2026-08-23
cycle: 1
plans_reviewed: [15-01, 15-02, 15-03, 15-04, 15-05, 15-06]
tooling_note: >
  Codex driven manually via `codex exec --sandbox read-only -c model_reasoning_effort=medium` WITHOUT
  --dangerously-bypass-hook-trust (classifier-blocked here); the gsd-review codex path is unusable.
  Claude driven as a fresh read-only subagent (no context inheritance), since gsd-review self-skips
  Claude inside Claude Code and its `claude -p` path has a Write-permission gap.
---

# Cross-AI Plan Review — Phase 15 (Weekly Digest)

## Cycle 1 — Aggregated Actionable Findings (planner worklist)

These are the deduped findings the replan (`--reviews`) must incorporate into PLAN.md or explicitly
defer/reject. Both reviewers verified against the code on disk.

### HIGH

- **H1 — [codex + claude] The shared Settings `persist` handler never reconciles the digest.**
  `SettingsScreen.tsx` has ONE shared `persist` (~:350-360) that fires only `reconcileSchedule`
  (decay/birthday), and it is the handler behind master ON/OFF (:373/:380), the delivery-hour / quiet
  pickers (:397/:403), and the decay/birthday rows. 15-05 wired the digest reconcile into a SEPARATE
  `persistDigest` used only by the digest `Switch`. Failures: (1) master OFF does NOT cancel the pending
  `digest:weekly` (`isOwnedIdentifier` matches only `decay:`/`birthday:`, notification-schedule.ts:287-289)
  → **the digest can fire while notifications are disabled** until the next foreground launch — a
  notification-control violation the owner's risk posture cares about; (2) master ON doesn't arm the
  default-on digest until next launch; (3) a delivery-hour change re-times decay/birthday but not the digest.
  **Fix:** every settings write affecting the digest (master toggle, delivery-hour, digest toggle) must
  synchronously run `reconcileDigestSchedule(exec)` — fold it into the shared post-write path (it is
  idempotent/cheap), not a one-row callback. Add tests for all transitions (master off/on, delivery-hour
  change, digest off/on) asserting the immediate OS schedule state.

- **H2 — [codex] `reconcileDigestSchedule` has no defer-one overlap coordinator.**
  15-03 (:163) specifies a single uncoordinated read/diff/write pass; the shipped scheduler uses a
  defer-one coordinator (notification-schedule.ts:481) precisely to stop a stale overlapping pass from
  re-arming after a newer setting cancels. Race: Pass A reads desired state → master-OFF persists and Pass
  B cancels → Pass A (stale) re-schedules. Reachable once H1 makes all three settings paths call digest
  reconcile; sequential idempotence tests don't cover it.
  **Fix:** give `reconcileDigestSchedule` the same defer-one/serialization semantics as the existing
  scheduler, with an overlapping-call regression test — OR document in-plan a concrete reason the digest
  reconcile cannot overlap in practice (and why that is safe).

### MEDIUM

- **M1 — [codex] Existing test harnesses are not migrated to schema v5 → they will break.**
  15-02 makes `getAppSettings` select `digest_enabled` unconditionally (:135), but the app-settings DAO
  test helper builds a v4 schema (app-settings-dao.test.ts:68) and the notification-schedule test setup
  migrates only through 004 (notification-schedule.test.ts:66). After the DAO change those suites fail with
  `no such column: digest_enabled`.
  **Fix:** the plans must update every current-schema test harness that invokes `getAppSettings` to run
  migration 005 / v5; leave intentionally-historical migration tests at their original versions.

- **M2 — [codex] The expo mock can't prove two-pass idempotence.**
  `__mocks__/expo-notifications.ts:66` `scheduleNotificationAsync` returns an id but does not add the
  request to the scheduled backing set, so the 15-03 (:179) "call twice → one schedule" acceptance is
  hollow (the 2nd pass still sees the digest absent and schedules again). The plan extends only mock types.
  **Fix:** make the mock stateful (schedule/cancel mutate the backing store) or arrange successive
  `getAllScheduledNotificationsAsync` results.

- **M3 — [claude] The drift/reschedule branch rests on an unverified Android assumption.**
  `reconcileDigestSchedule` decides leave-vs-reschedule by comparing the existing trigger's weekday/hour;
  that only works if `getAllScheduledNotificationsAsync()` round-trips weekday/hour for a WEEKLY trigger on
  Android — unverified. The node double stores exactly what was scheduled, so the unit test passes trivially
  (false confidence). 15-06 has no step that changes DIGEST_WEEKDAY/deliveryHour and confirms exactly one
  re-armed trigger at the new value.
  **Fix:** add a 15-06 device step that changes the weekday/hour and dumps `getAllScheduledNotificationsAsync`
  to confirm the WEEKLY trigger exposes weekday/hour on the physical Pixel + exactly one re-armed trigger.

### LOW

- **L1 — [codex] 15-06 UAT: wrong testID + build-mutation risk.**
  15-06 names the dashboard entry `digest-your...` while the locked testID is `dashboard-your-week-entry`
  (false-negative automation), and "temporarily set DIGEST_WEEKDAY/deliveryHour then restore" risks testing
  a build different from the final artifact.
  **Fix:** use the locked testID; record the exact APK/config tested; prefer a controlled temp constant or a
  device-clock procedure, restored deterministically.

- **L2 — [claude] A digest firing while the app is foregrounded is silently dropped.**
  `FOREGROUND_NOTIFICATION_BEHAVIOR` sets all flags false (notification-ids.ts:73-78); for a once-weekly
  nudge the push is lost that week if Orbit is open at delivery time (the in-app "Your week" entry mitigates).
  **Fix:** an explicit in-plan accept, or a 15-06 UAT observation. Not a blocking design flaw.

---

## Claude Review (Cycle 1 — fresh read-only subagent)

**Summary:** Six well-structured plans implementing a weekly Sunday digest as an additive read-and-schedule
layer over shipped subsystems. Every load-bearing citation verified against code: `STATUS_SQL`/`REASON_SQL`/
`ROGUE_K` branch order (status.ts:67-99), timezone rule (status.ts:44-59), `DECAY_ELIGIBLE_WHERE` as the exact
inverse of the overlooked population (decay-suppression.ts:58-62), `isOwnedIdentifier` (notification-schedule.ts:287-289),
the digest-non-clobber test (notification-schedule.test.ts:498-506), `countNeverContacted` (dashboard-read.ts:306),
app-settings toggle plumbing, the migration runner sort-by-version + TARGET_VERSION=4 (database.ts:39,109-115),
the 004 ADD-COLUMN analog, the launch-sweep registry (launch-sweep.ts:45). Migration-005 owner ruling respected;
the Phase-16 renumber to 006 confirmed in PHASE-16-SYNC-READINESS.md:41 and ROADMAP.md.

**Strengths:** overlooked-inverse trap correctly avoided (STATUS_SQL='rogue', omit reminders_off, pre-filter
last_contact NOT NULL, split by reason); timezone handling right (bare date() on stored col, date('now','localtime')
for window, dayTag via new Date(y,m-1,d)); schedule separation enforced + re-proven; migration 005 preserved not
reversed; good deviation from RESEARCH Pattern 4 (keeps NotificationData byte-unchanged, routes digest via an
`unknown` pre-check — type-safe end-to-end).

**Concerns:** HIGH = the shared `persist` never reconciles the digest (master-off leaves digest armed; master-on
and delivery-hour don't re-arm) — see H1. MEDIUM = drift branch unverified on-device (Android weekday/hour
round-trip) — see M3. LOW = foreground-fired digest silently dropped — see L2.

**Overall risk: MEDIUM** — read/logic/schedule/migration core correct and avoids every trap RESEARCH flagged;
the one HIGH is a Settings-layer wiring gap with a clear low-effort fix but a real notification-control impact.

`REVIEW_COUNTS: high=1 actionable_nonhigh=2`

---
## Codex Review (Cycle 1 — codex exec --sandbox read-only, no bypass flag, medium reasoning)

# Summary

The plans largely respect Orbit’s local-first, date, theme, migration, and service-boundary decisions. However, they do not yet guarantee correct digest scheduling after every relevant settings write. Two high-risk scheduling defects should be resolved before execution.

# Strengths

- Migration 005 correctly preserves the recorded `digest_enabled` owner decision, defaults it ON, and threads it through the DAO.
- Digest reads are local SQLite-only and use the correct local-date convention: bare `date(stored_value)` versus `date('now','localtime')`.
- The overlooked query explicitly avoids `DECAY_ELIGIBLE_WHERE`, which excludes muted, rarely-responding, and rogue contacts ([decay-suppression.ts](/home/bwales/projects/orbit-app/src/services/notifications/decay-suppression.ts:58)).
- `STATUS_SQL` and `REASON_SQL` are reused with the required rarely-responds-first branch ordering ([status.ts](/home/bwales/projects/orbit-app/src/db/status.ts:67), [status.ts](/home/bwales/projects/orbit-app/src/db/status.ts:95)).
- The weekly scheduler remains a separate service and sweep hook. The existing engine owns only `decay:` and `birthday:` identifiers ([notification-schedule.ts](/home/bwales/projects/orbit-app/src/services/notifications/notification-schedule.ts:286)).
- The proposed Expo weekly trigger is consistent with installed Expo Notifications 57: weekday `1` is Sunday.
- UI plans require theme tokens and contain no proposed network read path.

# Concerns

## HIGH — Master and delivery-hour writes do not reconcile the digest

[15-05-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/15-weekly-digest/15-05-PLAN.md:144) introduces `persistDigest`, but only the digest switch uses it. The existing `persist` callback invokes only `reconcileSchedule` ([SettingsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:350)).

Consequently:

- Master OFF uses `persist({ notificationsEnabled: 0 })` ([SettingsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:380)), leaving `digest:weekly` armed until the next foreground launch.
- Master ON does not immediately arm the default-enabled digest ([SettingsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:373)).
- A delivery-hour change goes through the same generic `persist` path ([SettingsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:397)), so the digest remains scheduled at the old hour until relaunch.

This directly violates the requested settings-write invariant and the plan’s immediate arm/cancel claims.

## HIGH — Digest reconciliation has no overlap coordinator

[15-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/15-weekly-digest/15-03-PLAN.md:163) specifies a single uncoordinated read/diff/write pass. The established scheduler has a defer-one coordinator specifically to prevent stale overlapping passes from re-arming a notification after a newer setting cancels it ([notification-schedule.ts](/home/bwales/projects/orbit-app/src/services/notifications/notification-schedule.ts:481)).

Concrete race:

1. Pass A reads master/digest enabled.
2. Master OFF is persisted and pass B cancels the trigger.
3. Pass A, using its stale desired state, schedules it again.

Once all three settings paths correctly invoke digest reconciliation, rapid or overlapping writes make this race reachable. Sequential idempotence tests do not cover it.

## MEDIUM — Tests using `getAppSettings` are not explicitly migrated to schema v5

Plan 02 makes `getAppSettings` unconditionally select `digest_enabled` ([15-02-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/15-weekly-digest/15-02-PLAN.md:135)), but the existing DAO helper still creates a v4 schema ([app-settings-dao.test.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.test.ts:68)). Plan 02 asks only to extend round-trip assertions, without explicitly updating that helper.

Likewise, Task 3 runs the existing notification-schedule suite, whose setup migrates only through 004 ([notification-schedule.test.ts](/home/bwales/projects/orbit-app/src/services/notifications/notification-schedule.test.ts:66)). After the DAO change, reconciliation will fail with `no such column: digest_enabled`.

Both suites must import migration005 and use v5 for cases invoking `getAppSettings`, while intentionally historical migration tests should remain at their original versions.

## MEDIUM — The proposed mock cannot prove two-pass idempotence as written

The acceptance criterion calls `reconcileDigestSchedule` twice and expects only one schedule call ([15-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/15-weekly-digest/15-03-PLAN.md:179)). But the current mock’s `scheduleNotificationAsync` only returns an ID; it does not add the request to the scheduled backing set ([expo-notifications.ts](/home/bwales/projects/orbit-app/__mocks__/expo-notifications.ts:66)).

Therefore the second pass still observes the digest as absent and schedules it again. The plan extends only mock types, not its state behavior. Make schedule/cancel mutate the backing store, or explicitly arrange successive `getAllScheduledNotificationsAsync` results.

## LOW — Device UAT is not truly verification-only or reproducible as specified

Plan 06 declares no modified files, but directs the verifier to “temporarily set” `DIGEST_WEEKDAY` or `deliveryHour`, then restore them ([15-06-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/15-weekly-digest/15-06-PLAN.md:87)). This risks testing a build different from the final artifact or accidentally retaining a temporary source/config value.

It also names the dashboard entry as `digest-your...`, while the locked testID is `dashboard-your-week-entry` ([15-06-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/15-weekly-digest/15-06-PLAN.md:99)). That can produce a false-negative automation result.

# Suggestions

- Replace the two settings callbacks with one post-write coordinator that always runs `reconcileSchedule`, and conditionally or harmlessly runs `reconcileDigestSchedule` after writes affecting `notificationsEnabled`, `deliveryHour`, or `digestEnabled`.
- Add tests for all six transitions: master OFF/ON, delivery hour change, and digest OFF/ON, each asserting immediate OS schedule state.
- Give `reconcileDigestSchedule` the same defer-one semantics as the existing scheduler, with an overlapping-call regression test.
- Update every current-schema test harness to migration 005.
- Make the Expo mock stateful enough to test actual convergence.
- Use a controlled temporary build constant or device-clock procedure for UAT, record the exact APK/config tested, and use the locked dashboard testID.

# Overall Risk

**HIGH.** The data and UI design are sound, but the current plans can leave a disabled digest armed, fail to apply a delivery-hour change until relaunch, or re-arm a digest through an overlapping reconciliation race. Those defects strike the phase’s central scheduling guarantee.

REVIEW_COUNTS: high=2 actionable_nonhigh=3

---

## CYCLE_SUMMARY (Cycle 1)

CYCLE_SUMMARY: current_high=2 current_actionable=5

**Not converged** — 2 HIGH (H1 shared-persist digest reconcile [both]; H2 defer-one overlap race [codex]) + 5 actionable (M1 test-harness v5 migration, M2 stateful mock, M3 drift-branch device step, L1 UAT testID/build, L2 foreground-drop accept). Proceeding to replan (`gsd-plan-phase 15 --reviews --skip-research`) then Cycle 2 review.

# ═══════════════════════════════════════════════════════════════
# Cycle 2 (post-replan review)
# ═══════════════════════════════════════════════════════════════

## Cycle 2 — Aggregated Actionable Findings (planner worklist)

Both reviewers verified all 7 Cycle-1 fixes (H1/H2/M1/M2/M3/L1/L2) as GENUINELY RESOLVED against code.
Divergence: Claude found 0 new (1 cosmetic LOW). Codex audited the tap-routing Back behavior Claude did
not, and found a real NEW HIGH + 3 actionable. Aggregate = NOT converged.

### HIGH

- **H3 (NEW) — [codex, orchestrator-verified] Warm digest tap violates "Back → dashboard".**
  15-05 (~:112) routes the digest body tap via `nav.navigate("Digest")`, which only lands Back-on-Home from a
  COLD start. On a warm tap over `Home → Profile/Settings`, navigate pushes Digest on top → `goBack()` returns
  to Profile/Settings. VERIFIED: the established Back→dashboard mechanism is a RESET onto `[Home, target]` —
  `resolveNotificationNav` returns `{type:"reset", index:1, routes:[{name:"Home"},{name:"Compose"}]}` for decay
  with the in-code comment "a reset (not a navigate) so Back ALWAYS lands on the dashboard regardless of the
  stack" (T-11-BACKSTACK), applied by `applyBodyNav` (notification-gate.tsx:91-97). The dossier requires the
  digest to inherit 11-notify's back-stack pattern (Back → dashboard).
  **Fix:** the digest intent must be `{type:"reset", index:1, routes:[{name:"Home"},{name:"Digest"}]}` (mirror
  decay), incorporated into `resolveNotificationNav` (the digest pre-check must return a reset intent, not rely
  on a bare navigate), with a test asserting that exact reset shape for the digest kind.

### MEDIUM

- **M4 — [codex] The overlap regression test is not deterministically overlapping.**
  15-03 (~:223) mirrors the existing coalescing test (notification-schedule.test.ts:779) which relies on
  promise/SQLite timing rather than proving pass 1 captured the old setting before pass 2 became pending — an
  uncoordinated impl could pass by luck.
  **Fix:** use a deferred mock barrier — hold pass 1 after its old-state read, invoke the 2nd reconcile, commit
  `digestEnabled=0`, then release pass 1 — making the stale-pass/trailing-pass ordering deterministic.

- **M5 — [codex] Stateful shared-mock change requires the FULL notification suite, but verification omits it.**
  Making the global expo mock stateful affects every notification suite, but 15-03 Task 1 runs only the
  notification-IDs suite and final verification (~:291) omits the named-actions, channels, permission, and
  purge-cleanup suites.
  **Fix:** add the full notification suite to 15-03's automated verification so the M2 fix can't silently alter
  shared test behavior.

### LOW

- **L3 — [codex] "Your week" entry layout stays right-aligned.**
  15-04 (~:177) prepends the entry to a flat flex-end top bar (HomeScreen.tsx:582 `justifyContent:"flex-end"`),
  leaving all three controls right-aligned. **Fix:** require a right-side wrapper for the ◎/⚙ cluster + a
  `space-between`/spacer so "Your week" sits at the left.

- **L4 — [claude] Dead `migrateToV4` helper after the M1 migration.**
  15-02 repoints all getAppSettings blocks to `migrateToV5` but instructs "add migrateToV5 alongside
  migrateToV4" → migrateToV4 ends with zero callers (possible Biome noUnusedVariables warning; non-blocking).
  **Fix:** convert `migrateToV4`→`migrateToV5` in place (or drop it once unused). Cosmetic, no correctness impact.

---

## Codex Review (Cycle 2)

## Summary

The Cycle-1 revisions substantially address the original findings. One new HIGH navigation defect remains, plus three actionable non-high concerns.

## What’s genuinely fixed

- H1: `reconcileDigestSchedule` is placed in the shared Settings `persist` path, covering master, delivery-hour, and digest-toggle writes.
- H2 implementation: the plan now prescribes the correct module-level defer-one coordinator and test reset. The regression test itself still needs deterministic synchronization, noted below.
- M1: current-schema `getAppSettings` and notification-scheduler harnesses are explicitly migrated to v5; historical migration tests remain pinned.
- M2: the Expo mock becomes stateful, making sequential idempotence and drift tests meaningful.
- M3: device UAT changes delivery hour and verifies weekday/hour round-trip plus exactly one re-armed trigger.
- L1: `dashboard-your-week-entry` is used, and the signed-off release build must be unmodified.
- L2: foreground suppression is explicitly accepted and device-observed.
- The local-first, local-date, migration-005, independent digest service, and non-decay-predicate requirements are preserved.

## Remaining or new Concerns

### HIGH — Warm notification taps do not guarantee Back returns to Dashboard

[15-05-PLAN.md:112](/home/bwales/projects/orbit-app/.planning/phases/15-weekly-digest/15-05-PLAN.md:112) instructs the gate to call `nav.navigate("Digest")` and claims Back automatically returns to Home because Home is the initial route. That is only reliable on cold start. On a warm tap while the current stack is `Home → Profile` or `Home → Settings`, navigating pushes Digest above that route, so Digest’s `goBack()` returns to Profile/Settings, violating the plan’s must-have and UAT contract.

The existing gate already distinguishes reset intents at [notification-gate.tsx:91](/home/bwales/projects/orbit-app/src/navigation/notification-gate.tsx:91), while `initialRouteName` at [RootNavigator.tsx:55](/home/bwales/projects/orbit-app/src/navigation/RootNavigator.tsx:55) does not reset an existing stack.

Change the digest intent to reset to `[Home, Digest]`, and test that exact intent shape.

### MEDIUM — The overlap regression test is not deterministically overlapping

[15-03-PLAN.md:223](/home/bwales/projects/orbit-app/.planning/phases/15-weekly-digest/15-03-PLAN.md:223) says to mirror the existing test, which starts both reconciles and the mutation without a controlled barrier. The analog at [notification-schedule.test.ts:779](/home/bwales/projects/orbit-app/src/services/notifications/notification-schedule.test.ts:779) relies on promise/SQLite timing rather than proving that pass one captured the old setting before pass two became pending.

Use a deferred mock barrier around the first pass: hold it after its old-state read, invoke the second reconcile, commit `digestEnabled=0`, then release the first pass. This makes the stale-pass/trailing-pass ordering deterministic and ensures an uncoordinated implementation cannot pass accidentally.

### MEDIUM — Stateful shared-mock regressions are required but not executed

The plan correctly warns that making the global Expo mock stateful requires the full notification suite at [15-03-PLAN.md:129](/home/bwales/projects/orbit-app/.planning/phases/15-weekly-digest/15-03-PLAN.md:129). However, Task 1 runs only the notification-IDs suite, and final verification at [15-03-PLAN.md:291](/home/bwales/projects/orbit-app/.planning/phases/15-weekly-digest/15-03-PLAN.md:291) omits the named actions, channels, permission, and purge-cleanup suites.

Add the full notification-suite command to automated verification. Otherwise the M2 fix can alter shared test behavior without the promised guard running.

### LOW — “Your week” will remain grouped on the right

[15-04-PLAN.md:177](/home/bwales/projects/orbit-app/.planning/phases/15-weekly-digest/15-04-PLAN.md:177) says to prepend the entry while keeping the glyph cluster grouped right, but the current top bar is a flat list of Pressables and uses `justifyContent: "flex-end"` at [HomeScreen.tsx:582](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:582). Merely prepending the text leaves all three controls right-aligned.

Explicitly require a right-side wrapper for the ◎/⚙ controls and a `space-between` or flexible spacer layout.

## Overall Risk

Moderate-high until the warm-tap stack behavior is corrected. The scheduling architecture and Cycle-1 data/settings fixes are otherwise materially improved; the remaining scheduling concerns are principally about proving the concurrency and mock changes reliably.

REVIEW_COUNTS: high=1 actionable_nonhigh=3

---

## Claude Review (Cycle 2 — fresh read-only subagent)

**Verdict: `REVIEW_COUNTS: high=0 actionable_nonhigh=0`.** All six revised plans hold up against the code on
disk; every Cycle-1 finding (H1/H2/M1/M2/M3/L1/L2) is grounded in real file:line facts and its fix is correct
and complete (verified: shared `persist` at SettingsScreen.tsx:350-360 covers master/delivery-hour/digest;
defer-one mirrors notification-schedule.ts:486-512 + __resetReconcileForTest:532-535; only two test files call
getAppSettings and both are migrated to v5; the stateless mock gap is real and the stateful fix makes idempotence
provable; 15-06 drift step validates the weekday/hour round-trip; locked testID used; L2 foreground-drop
explicitly accepted). One trivial LOW: the dead `migrateToV4` helper (= L4 above). "Nothing requires a plan
change before execution." NOTE: Claude did not audit the warm-tap Back behavior that codex flagged as H3.

---

## CYCLE_SUMMARY (Cycle 2)

CYCLE_SUMMARY: current_high=1 current_actionable=4

**Not converged** — 1 HIGH (H3 warm-tap Back→dashboard reset, codex-found + orchestrator-verified) + 4 actionable
(M4 deterministic overlap test, M5 full-notification-suite verify, L3 top-bar layout, L4 dead helper). Proceeding
to replan (Cycle 2 → Cycle 3, the max) then a final review.
