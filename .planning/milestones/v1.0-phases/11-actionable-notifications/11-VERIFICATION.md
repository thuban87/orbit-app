---
phase: 11-actionable-notifications
verified: 2026-08-16T23:01:52Z
status: passed
closeout: owner-accepted 2026-08-16 (on-device UAT substantially passed; killed-app headless action deferred to a follow-up device check)
score: 18/18 code-truths verified
behavior_unverified: 5
overrides_applied: 0
behavior_unverified_items:
  - truth: "NOTIF-01 — a decaying contact gets a real morning notification (no exact-alarm), inside no quiet window, staggered, re-nagging weekly, on the correct AlarmManager schedule."
    test: "On the physical Pixel, build+install the release APK (desktop pipeline). Seed/age a contact past its interval so it is decay-eligible, foreground Orbit once to run the reconcile, then leave the app closed across a real 9am. Confirm the nudge arrives ~9am, never inside 21:00–08:00, body reads '{Name} — time to reach out.', and a still-unacted contact re-nags ~a week later replacing (not stacking) the prior shade entry."
    expected: "Notification delivers at the configured morning hour with the generic body; no delivery inside the quiet window; weekly re-nag replaces the same shade entry."
    why_human: "AlarmManager inexact delivery + Doze are device/OS-runtime; the JS/vitest harness mocks expo and proves only call shape, not real delivery timing."
  - truth: "NOTIF-02 — the mark-contacted and snooze actions write HEADLESSLY from a killed app (FCM-less registerTaskAsync bring-up), and the body tap opens Compose with Back → dashboard."
    test: "Kill Orbit completely. From a delivered decay notification in the shade, tap 'Mark contacted' — then read the DB via `run-as com.bwales.orbit` and confirm a new interactions row (source='notification', outbound, connected=1) and the decay:<id> schedule cancelled. Repeat with 'Snooze 1 week' and confirm snooze_until advanced + a snooze event row. Separately, tap the notification BODY and confirm ComposeScreen opens for the right contact and Android Back lands on the dashboard."
    expected: "Both actions write through the mutexed DAOs while the app is killed and cancel the pending decay; body tap → Compose{contactId}; Back → Home/dashboard."
    why_human: "Killed-app headless task execution and onNewIntent/singleTask back-stack are OS-runtime only; the FCM-less headless bring-up is the carried A2 device spike and cannot run in the JS harness."
  - truth: "NOTIF-03 — no decay notification fires for never-contacted/snoozed/rogue/Rarely-responds/muted on a REAL schedule, and muting/snoozing a still-decaying contact cancels its pending nudge at once."
    test: "On device: mute (Mute reminders) a decaying contact and confirm no decay nudge arrives; snooze one from the profile presets and confirm it stays silent until after the snooze window; verify a rogue / Rarely-responds / never-contacted contact never produces a decay nudge."
    expected: "Each suppressor keeps the OS schedule empty for that contact; an in-app mute/snooze cancels an already-pending decay notification immediately."
    why_human: "Scheduling suppression is observable only against the live OS pending-notification set over real time; unit tests assert the desired set, not OS delivery."
  - truth: "NOTIF-04 — birthday notifications fire day-of morning for a non-archived contact on their own channel and tap opens the profile."
    test: "On device, set a contact's birthday to today, foreground Orbit before 9am to reconcile, and confirm a single 'It's {Name}'s birthday today.' notification at ~9am; tapping it opens that contact's profile. Confirm the CR-01 case: open the app in the AFTERNOON on a birthday and confirm NO wrong-day 'today' notification fires the next morning."
    expected: "Birthday fires day-of only, on the birthday channel; tap → Profile{contactId}; no next-day 'today' misfire."
    why_human: "Day-of AlarmManager delivery and the tap→profile intent are OS-runtime; the CR-01 same-day guard is unit-tested but real delivery is device-only."
  - truth: "NOTIF-05 — POST_NOTIFICATIONS is asked at the value moment; master + per-type toggles + private-by-default lock-screen visibility behave on the OS; denial degrades to in-app with a single non-nagging note."
    test: "On a fresh install: open Settings → Notifications, flip the master toggle ON, and confirm the OS POST_NOTIFICATIONS dialog appears at that moment. GRANT once and confirm sub-controls enable + schedules arm. Re-install, flip master, DENY, and confirm master reverts to off with the degraded note shown once (no re-prompt loop). With lock-screen visibility PRIVATE, confirm a decay notification hides the contact name on the lock screen; flip to public and confirm the name shows."
    expected: "Dialog appears on master-on; denial reverts + shows the degraded note once; the private decay channel hides the name on the lock screen, the public channel shows it."
    why_human: "The OS permission dialog and per-channel lock-screen rendering are OS-runtime surfaces the emulator cannot assess and the JS harness cannot exercise."
human_verification:
  - test: "Real morning delivery + quiet-window roll (NOTIF-01): decay nudge arrives ~9am, never inside 21:00–08:00; weekly re-nag replaces the same shade entry."
    expected: "Generic-body notification at the configured hour outside the quiet window; re-nag ~weekly under the same decay:<id> identifier."
    why_human: "AlarmManager inexact/Doze delivery is device-runtime."
  - test: "Headless FCM-less killed-app mark/snooze write (NOTIF-02): kill app, tap shade action, read the DB via run-as."
    expected: "Mark writes a notification-sourced outbound touchpoint + cancels decay:<id>; snooze advances snooze_until + writes a snooze event; both from a killed process."
    why_human: "Killed-app headless task + FCM-less registerTaskAsync bring-up (A2 device spike) cannot run in the JS harness."
  - test: "Body tap → Compose → Back → dashboard (NOTIF-02)."
    expected: "Body tap opens ComposeScreen for the right contact; Android Back lands on the dashboard (reset back-stack)."
    why_human: "onNewIntent/singleTask back-stack is runtime."
  - test: "POST_NOTIFICATIONS grant/deny + lock-screen private/public (NOTIF-05)."
    expected: "Dialog at the value moment; deny reverts master + degraded note once; private channel hides name, public shows it."
    why_human: "OS permission dialog + per-channel visibility are OS-owned."
  - test: "Mute/snooze/birthday suppression on the real schedule (NOTIF-03/04)."
    expected: "Muted/snoozed contact produces no decay nudge; birthday fires day-of for non-archived; no CR-01 wrong-day misfire."
    why_human: "Scheduling + delivery are runtime; only the desired set is unit-tested."
---

# Phase 11: Actionable Notifications Verification Report

**Phase Goal:** The decay + birthday reminder engine — pre-scheduled + launch-reconciled, generic-body, quiet-windowed, with headless one-tap actions and the reminders-off mute — that opens the compose screen.
**Verified:** 2026-08-16T23:01:52Z
**Status:** passed — owner-accepted closeout after on-device Pixel UAT (2026-08-16)

## On-Device UAT Outcome (owner-accepted closeout, 2026-08-16) — see 11-UAT-NOTES.md
Release APK built via the desktop pipeline + installed on the Pixel. **Verified LIVE:** POST_NOTIFICATIONS value-moment dialog + grant; channels at IMPORTANCE_LOW (silent, FLAG_MUTE_HAPTIC); NOTIF-01 pre-scheduling as inexact RTC_WAKEUP (no exact-alarm) + reschedule-on-settings-change (item B/H3); a REAL birthday notification fired with the exact generic copy "It's Dad's birthday today." (silent, Silent-tray, `vis=PRIVATE`); tap → contact profile (routing); the in-app snooze-presets UI; migration v1→v2 with no crash; and the flat-weekly cadence (a decay nudge correctly scheduled a week out, not today). The earlier lock-screen concern is **softened** — the posted notification carries `vis=PRIVATE` (private applied at the notification level). **The ONE item not device-confirmed:** the killed-app FCM-less headless mark/snooze write (NOTIF-02 headless, the A2 spike) — not deliverable during the session (weekly cadence + quiet hours); it is verified in code review + the exactly-once unit test (real DAOs), and the owner accepted closing with this as a short follow-up device check on the next natural fire. Body-tap→Compose is pure-unit-tested; birthday→Profile confirmed live.

### Original human_needed detail (retained for the follow-up check)
**Re-verification:** No — initial verification

## Goal Achievement

This phase's four success criteria (NOTIF-01..05) are, by design, OS-runtime + UI-observable end-to-end behaviors (real AlarmManager delivery, killed-app FCM-less headless writes, the POST_NOTIFICATIONS dialog, per-channel lock-screen rendering, onNewIntent tap→Compose→Back, foreground silence, quiet-window roll). Per `11-VALIDATION.md`'s Manual-Only matrix these are Pixel-UAT items — exactly as Phase 10. The correct outcome is therefore **human_needed**: every code-truth the JS/data layer can prove is **statically VERIFIED** (below), and the OS-runtime completions route to the on-device UAT checklist.

**The unit suite mocks `expo-notifications` / `expo-task-manager` — it proves CALL SHAPE, not device behavior.** No OS-runtime behavior below is marked VERIFIED from a mocked test.

### Code-Truths — Statically Verified

| #  | Code-truth | Status | Evidence (file:line) |
| -- | ---------- | ------ | -------------------- |
| 1  | Native enablement: expo-notifications + expo-task-manager pinned; plugin registered exactly once | ✓ VERIFIED | `package.json:18,23` (~57.0.11 / ~57.0.10); `app.config.ts:57-77` (single `"expo-notifications"` string entry, dedupe guard) |
| 2  | Single source of truth for identifiers/channels/category/action ids/generic body/payload/idempotency uid | ✓ VERIFIED | `notification-ids.ts:27-121` — `decay:`/`birthday:` ids, `*_CHANNEL`, `DECAY_CATEGORY=decay_actions`, `decayBody`/`birthdayBody`, `NotificationData`, pure `actionUid()` |
| 3  | Migration 002 additive/forward-only, TARGET_VERSION=2, seeds one id=1 row with decided defaults | ✓ VERIFIED | `002-app-settings.ts:38-80` (CREATE + `?`-bound seed `[1,0,1,1,0,9,21,8,now,now]`); `database.ts:37,110` (`TARGET_VERSION=2`, `[migration001, migration002]`) |
| 4  | app-settings DAO validates hours∈[0,23] + toggles∈{0,1} BEFORE any UPDATE; writes only app_settings | ✓ VERIFIED | `app-settings-dao.ts:114-130,145-155,171-181` (assertHour/assertToggle pre-txn; `changes===1` guard) |
| 5  | snooze-dao is the first writer of snooze_until + immutable snooze/unsnooze events in one txn; never touches last_contact | ✓ VERIFIED | `snooze-dao.ts:78-143` — `inWriteTransaction` + `recordEventCore` (non-mutexed core), `changes===1`, no recency column referenced |
| 6  | clearSnooze ALWAYS writes an unsnooze event (uid required — review item 10) | ✓ VERIFIED | `snooze-dao.ts:120-143` (unconditional `recordEventCore` type "unsnooze") |
| 7  | Both in-app presets (3d/1w/1m) and headless +1wk go through the one DAO | ✓ VERIFIED | `PRESET_MODIFIERS` `snooze-dao.ts:45-49`; profile `ContactProfileScreen.tsx:98-100,315`; headless `notification-actions.ts:146-151` (preset "1w") |
| 8  | Decay suppression predicate excludes never-contacted/rarely_responds/muted/archived/rogue; reuses status.ts, never re-derives rogue; future snooze NOT excluded | ✓ VERIFIED | `decay-suppression.ts:58-62` (`DECAY_ELIGIBLE_WHERE` composes `PROGRESS_SQL`/`ROGUE_K`); `status.ts:42,59` (`ROGUE_K=3`) |
| 9  | Notification-read returns full eligible set + snooze base + birthday candidates (all non-archived), reuses daysUntilBirthday | ✓ VERIFIED | `notification-read.ts:73-98` (ORDER BY id; birthday read `archived_at IS NULL AND birthday IS NOT NULL`) |
| 10 | fire-instant: quiet-window wrap roll, per-contact stagger, hour clamp[0,23], stateless weekly cadence (no stored state) | ✓ VERIFIED | `fire-instant.ts:42-48 (clampHour), 62-111 (inQuietWindow/allowedSlotForDay wrap), 128-183 (nextAllowedFireInstant), 197-226 (nextNudgeDate)` |
| 11 | Three channels created idempotently, IMPORTANCE_LOW, versioned ids; visibility by WHICH channel, never mutated | ✓ VERIFIED | `channels.ts:43-59` (LOW; PRIVATE/PUBLIC decay + PRIVATE birthday); `notification-ids.ts:42-44` (`-v1` suffix) |
| 12 | POST_NOTIFICATIONS request/read wrappers; denial reported for graceful degrade, asks once | ✓ VERIFIED | `permission.ts:32-53` (guarded getPermissions/requestPermissions → `{granted}`) |
| 13 | Shared exactly-once handler: openAndMigrate() before getExecutor(), deterministic actionUid, UNIQUE(uid) collision benign, mark→recordTouchpoint, snooze→snoozeContact, then cancel | ✓ VERIFIED | `notification-actions.ts:104-175` (H1 bootstrap :124, handledSet :63,116, mark :133-143, snooze :146-151, cancel :159, UNIQUE swallow :162-169) |
| 14 | Category buttons register with opensAppToForeground:false; headless task defined+registered at module scope | ✓ VERIFIED | `notification-actions.ts:71-84`; `headless-task.ts:65-92` (defineTask + registerTaskAsync at module scope) |
| 15 | reconcile PRE-SCHEDULES within HORIZON_DAYS, hard-capped at MAX with birthdays reserved; full-request diff (hour granularity + channel + category + data + body); master/per-type gate; self-coordinating DEFER-ONE; sweep-registered, nothing at import | ✓ VERIFIED | `notification-schedule.ts:114,121 (horizon/cap), 419-443 (reserve+cap), 308-336 (requestsEqual), 380-383 (master gate), 486-512 (DEFER-ONE), 520-526 (sweep reg)` |
| 16 | CR-01 fixed: birthday never rolls off its own day with "today" copy | ✓ VERIFIED | `notification-schedule.ts:268-274` (skip when `formatLocalDate(fireInstant)!==formatLocalDate(nextBday)`); regression test `notification-schedule.test.ts:409` |
| 17 | WR-01 fixed: app_settings.modified_at uses localDateTime(), not toISOString(); no UTC leaks on notif/snooze paths | ✓ VERIFIED | `SettingsScreen.tsx:22,143` (`localDateTime()`); grep found zero `toISOString` in notification/snooze/settings write paths |
| 18 | Purge cancels decay+birthday POST-COMMIT via onPurgeExtensions, composed with photo cleanup, best-effort | ✓ VERIFIED | `purge-notification-cleanup.ts:55-62`; `ArchivedContactsScreen.tsx:140-157` (composed, each try/catch) |

**Score:** 18/18 code-truths verified · 5 behavior-unverified (OS-runtime end-to-end, routed to Pixel UAT)

### Success-Criterion Roll-up (roadmap contract)

| SC | Requirement | Static substrate | End-to-end status |
| -- | ----------- | ---------------- | ----------------- |
| 1 | NOTIF-01 decay engine | Truths 8,9,10,15,17 VERIFIED | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED → UAT (real delivery + quiet roll + weekly re-nag) |
| 2 | NOTIF-02 headless actions + body tap | Truths 2,7,13,14 VERIFIED + `notification-nav.ts` reset/navigate resolver, `notification-gate.tsx` warm/cold/queued routing | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED → UAT (killed-app FCM-less write; tap→Compose→Back) |
| 3 | NOTIF-03 suppression + mute | Truths 5,6,8,15 VERIFIED (in-app mute/snooze fire reconcile) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED → UAT (no nudge on real schedule) |
| 4 | NOTIF-04 birthday day-of | Truths 9,11,16 VERIFIED | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED → UAT (day-of delivery + tap→profile) |
| 5 | NOTIF-05 permission + toggles + lock-screen | Truths 3,4,11,12 VERIFIED + Settings value-moment/degraded wiring | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED → UAT (OS dialog + per-channel visibility) |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| notification-schedule | notification-read + fire-instant + birthday-logic + app-settings + notification-ids + channels | imports at `notification-schedule.ts:62-91` | ✓ WIRED |
| notification-actions | recency-dao / snooze-dao / notification-ids | `notification-actions.ts:41-52` (recordTouchpoint, snoozeContact, actionUid) | ✓ WIRED |
| headless-task | notification-actions | `headless-task.ts:38,81` funnels to shared handler | ✓ WIRED |
| notification-gate | notification-actions + notification-nav | `notification-gate.tsx:50,56,68-96` (action + body routing) | ✓ WIRED |
| App.tsx | channels + categories + headless + sweep + gate | `App.tsx:26-31,136-163,210` (channels/categories AWAITED before `installSweepTrigger`; gate mounted in ready NavigationContainer) | ✓ WIRED |
| Settings/Edit/Profile | reconcileSchedule | `SettingsScreen.tsx:146`, `EditContactScreen.tsx:348`, `ContactProfileScreen.tsx:322,344` (reconcile-after-write, review item B) | ✓ WIRED |
| ArchivedContacts | purge-notification-cleanup | `ArchivedContactsScreen.tsx:140-157` composed onPurgeExtensions | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Notification + DAO unit suites | `npx vitest run src/services/notifications src/db/snooze-dao.test.ts src/db/notification-read.test.ts src/db/app-settings-dao.test.ts` | 11 files / 128 tests passed | ✓ PASS |
| Type check | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| CR-01 regression present | grep `notification-schedule.test.ts` | "does NOT schedule a birthday whose 9am slot already passed today" (:409) | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Static status | Runtime |
| ----------- | ----------- | ------------- | ------- |
| NOTIF-01 | Pre-scheduled generic-body decay, reconciled, staggered, no exact-alarm | ✓ code SATISFIED | UAT |
| NOTIF-02 | Two headless actions (double-wired) + body tap → compose; Back → dashboard | ✓ code SATISFIED | UAT |
| NOTIF-03 | Suppression + permanent mute of a still-decaying contact | ✓ code SATISFIED | UAT |
| NOTIF-04 | Birthday day-of, own channel, tap → profile, single parser | ✓ code SATISFIED | UAT |
| NOTIF-05 | POST_NOTIFICATIONS value moment; master/per-type/lock-screen; deny → in-app | ✓ code SATISFIED | UAT |

### Anti-Patterns Found

None. Zero `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers across the phase's source files. No hardcoded colours in notification-adjacent UI (gate renders null; Settings/Profile resolve theme tokens). No `toISOString` on any scheduling/snooze/settings write path. Single-writer invariants for `last_contact` and `snooze_until` hold (confirmed in 11-REVIEW.md subsystem audit and re-checked here).

### Human Verification Required (Pixel UAT checklist)

The five items below are the Nyquist sample for this phase's OS-runtime behaviors (see `11-VALIDATION.md` Manual-Only matrix). Build the release APK via the desktop pipeline, install on the Pixel, and drive with `adb`.

1. **NOTIF-01 — real morning delivery + quiet-window roll.** Age a contact overdue, foreground once, leave closed across a real 9am. Expect a `{Name} — time to reach out.` nudge ~9am, never inside 21:00–08:00; a still-unacted contact re-nags ~weekly replacing the same shade entry.
2. **NOTIF-02 — killed-app headless mark/snooze (FCM-less A2 spike) + body tap.** Kill Orbit; tap `Mark contacted` from the shade → verify (via `run-as com.bwales.orbit`) a notification-sourced outbound touchpoint + decay:<id> cancelled; tap `Snooze 1 week` → snooze_until advanced + snooze event. Separately tap the BODY → ComposeScreen for the right contact, Android Back → dashboard.
3. **NOTIF-03 — suppression on the live schedule.** Mute a decaying contact → no decay nudge; snooze from profile → silent until after the window; rogue / Rarely-responds / never-contacted → never a decay nudge.
4. **NOTIF-04 — birthday day-of + CR-01 guard.** Birthday=today, foreground before 9am → one `It's {Name}'s birthday today.` at ~9am, tap → profile. Open in the AFTERNOON on a birthday → confirm NO wrong-day "today" misfire next morning.
5. **NOTIF-05 — permission + lock-screen visibility.** Fresh install: master ON triggers the OS dialog at that moment; GRANT arms schedules; DENY reverts master + shows the degraded note once (no re-prompt). Private visibility hides the name on the lock screen; public shows it.

### Gaps Summary

No gaps. All 18 statically-provable code-truths are VERIFIED against the code on disk, the two review findings (CR-01 birthday wrong-day roll, WR-01 toISOString) are fixed and (for CR-01) regression-tested, 128 unit tests pass, and `tsc --noEmit` is clean. The remaining verification surface is exclusively OS-runtime / UI-observable — the expected `human_needed` outcome for this phase, identical to Phase 10. Phase closes on a passing on-device Pixel UAT of the five items above.

---

_Verified: 2026-08-16T23:01:52Z_
_Verifier: Claude (gsd-verifier)_
