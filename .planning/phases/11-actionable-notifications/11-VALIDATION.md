---
phase: 11
slug: actionable-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-16
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from
> `11-RESEARCH.md` § Validation Architecture. Task-level rows are assigned during planning; the
> requirement→test map below is the basis.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (node env; react-native-free logic only — the project convention) |
| **Config file** | `package.json` `"test": "vitest run"`; `*.test.ts` beside source |
| **Quick run command** | `npx vitest run src/services/notifications src/db/snooze-dao.test.ts src/db/notification-read.test.ts` |
| **Full suite command** | `npm test` (676+ green as of Phase 8/9) + `npm run check:colors` + `tsc --noEmit` + biome |
| **Estimated runtime** | ~30 seconds (quick) |

---

## Sampling Rate

- **After every task commit:** Run the quick command (< 30s).
- **After every plan wave:** Run the full suite + `check:colors` + `tsc --noEmit` + biome.
- **Before `/gsd-verify-work`:** Full suite green, THEN **on-device Pixel UAT** (mandatory — this
  phase's core behaviours are OS-runtime + UI-observable only, exactly as Phase 10).
- **Max feedback latency:** ~30 seconds (unit), device-cycle for UAT.

---

## Per-Task Verification Map (requirement basis — task IDs assigned at planning)

| Req | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-----------|-------------------|-------------|--------|
| NOTIF-01 | `nextAllowedFireInstant` rolls a quiet-window hit to next morning; staggers; respects user hour/window | T-11 tamper (bounds) | unit (pure) | `npx vitest run src/services/notifications/fire-instant.test.ts` | ❌ W0 | ⬜ |
| NOTIF-01 | Reconcile diff cancels no-longer-due `decay:<id>`, schedules due, leaves unchanged | — | unit (mock expo-notifications) | `npx vitest run src/services/notifications/notification-schedule.test.ts` | ❌ W0 | ⬜ |
| NOTIF-03 | Suppression predicate excludes never-contacted / snoozed / rogue(≥ROGUE_K) / rarely_responds / reminders_off; SQL parity with status.ts | — | unit (in-memory sqlite) | `npx vitest run src/db/notification-read.test.ts` | ❌ W0 | ⬜ |
| NOTIF-03 | `snooze-dao` writes local `snooze_until` + immutable events snooze row in one txn; never touches last_contact; clear NULLs it | T-11 mutex | unit (in-memory sqlite + mutex) | `npx vitest run src/db/snooze-dao.test.ts` | ❌ W0 | ⬜ |
| NOTIF-04 | Birthday candidates = non-archived with `daysUntilBirthday()===0`; ignores decay suppressors | — | unit | `npx vitest run src/db/notification-read.test.ts` | ❌ W0 (reuses tested birthday-logic) | ⬜ |
| NOTIF-02 | Shared handler: mark → `recordTouchpoint(source='notification',direction='outbound'…)` + cancel; snooze → snooze-dao + cancel | T-11 mutex | unit (mock DAOs) | `npx vitest run src/services/notifications/notification-actions.test.ts` | ❌ W0 | ⬜ |
| NOTIF-02 | Headless FCM-less killed-app tap writes; body tap→Compose; Back→dashboard; real delivery timing | — | **manual (Pixel UAT)** | desktop-build-pipeline → adb uiautomator | manual (device spike A2) | ⬜ |
| NOTIF-05 | POST_NOTIFICATIONS value-moment request; denied→degraded-once; master/per-type/lock-screen gate scheduling | T-11 info-disclosure | manual (OS dialog + channel) + unit for app-level gate | partial unit + Pixel UAT | ❌ W0 (gate logic) | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/notifications/fire-instant.test.ts` — NOTIF-01 timing math (quiet-window wrap is the key case)
- [ ] `src/services/notifications/notification-schedule.test.ts` — NOTIF-01 reconcile diff (mock expo-notifications)
- [ ] `src/services/notifications/notification-actions.test.ts` — NOTIF-02 handler routing
- [ ] `src/db/notification-read.test.ts` — NOTIF-03/04 suppression + birthday candidates (mirror `dashboard-read.test.ts`, in-memory sqlite)
- [ ] `src/db/snooze-dao.test.ts` — NOTIF-03 snooze writer contract
- [ ] A test double/mock for `expo-notifications` (schedule/cancel/getAllScheduled/setNotificationChannel/registerTaskAsync) — native module; unit tests mock it and assert call shapes. No framework install needed (Vitest present).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Headless FCM-less killed-app mark/snooze write | NOTIF-02 | OS-runtime; emulator can't assess; FCM-less `registerTaskAsync` bring-up is an unproven device spike (04-log F5) | Build release APK via desktop pipeline; kill app; tap action from shade; verify DB write via `run-as com.bwales.orbit` reading SQLite |
| Real morning delivery + quiet-window roll | NOTIF-01 | AlarmManager inexact delivery is device/Doze-dependent | On-device over a real morning window; confirm no delivery inside quiet hours |
| Body tap → Compose → Back → dashboard | NOTIF-02 | `onNewIntent`/`singleTask` back-stack is runtime | Tap notification body; assert Compose opens for the right contact; Back lands on dashboard |
| POST_NOTIFICATIONS grant/deny degrade; lock-screen private/public | NOTIF-05 | OS permission dialog + per-channel visibility are OS | Grant + deny paths; verify degraded note shows once; verify private channel hides name on lock screen |
| Mute/snooze/birthday suppression on real schedule | NOTIF-03/04 | Scheduling is runtime | Mute a decaying contact → no decay nudge; birthday day-of fires for non-archived |

*Manual-only items are OS-runtime behaviours the emulator cannot assess and the JS harness cannot exercise — the Pixel UAT is the Nyquist sample for them, exactly as Phase 10.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the 5 new suites + the expo-notifications mock)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
