---
phase: 15
slug: weekly-digest
status: human_needed
verified_at: 2026-08-23
requirements: [DGST-01, DGST-02, DGST-03]
---

# Phase 15 (Weekly Digest) — Verification

## Node / static verification — PASS
- **vitest 1356/1356** (103 files; +51 new tests over the 1305 baseline), **`tsc --noEmit` clean**, **`check:colors` clean**.
- **Code review of the implementation** (fresh read-only reviewer, against the code on disk): **APPROVE — 0 HIGH / 0 MEDIUM / 2 LOW**. LOW-1 (a tunable comment off-by-one) fixed; LOW-2 (unreachable defensive note) recorded. See `15-REVIEW.md`.
- Cross-AI plan convergence (3 cycles) before execution: `15-REVIEWS.md`.

## On-device UAT (Pixel 6 Pro, release APK `app-release.apk` built on `droid`, 145 MB) — drivable parts PASS

Verified by driving the physical Pixel (uiautomator + screenshots; adb point-taps, so small top-bar Pressables needed the reachable-zone tap or system-back):

- ✅ **Install + launch** — release APK installs and opens standalone (no Metro) to the themed dashboard.
- ✅ **Dashboard "Your week" entry (L3 layout)** — the entry renders top-**left**, with the ◎/⚙ cluster top-right (`space-between`), `dashboard-your-week-entry` present. Navigates to the digest screen.
- ✅ **DigestScreen retrospective (DGST-02 retrospective half)** — renders **"You caught up with these people this week"** as a **LIST** (Dad · Tue, Alice · Mon; avatar + name + day), **most-recent-first**, with **NO scoreboard count** (the ⚠ streak-caution decision honored). Overlooked + gentle-line sections correctly **absent** (the device DB has 2 stable contacts, none rogue / never-contacted / hard-marked).
- ✅ **Back → dashboard** — the digest screen's back (system-back / react-navigation) returns to the dashboard.
- ✅ **Settings "Weekly digest" toggle (DGST-01 toggle half)** — present as the 4th notification type (after Decay reminders + Birthday alerts, before "Show names on lock screen"), **ON by default**, gentle helper "A Sunday-morning look back at your week — who you reached, and who's slipping quietly.", token-styled. Flips true→false→true correctly.
- ✅ **Migration 005 applied on-device** — the release build launched successfully AND the Settings toggle read a real `digest_enabled` value; this is impossible unless migration 005 ran on the device (getAppSettings selects `digest_enabled` — a missing column would throw `no such column`). So `user_version` advanced to 5 and the column exists + defaults ON, on real hardware.
- ✅ **Digest scheduled correctly on-device (DGST-01 scheduling core)** — `dumpsys alarm` shows an orbit `expo.modules.notifications.NOTIFICATION_EVENT` alarm at **`origWhen=2026-08-30 09:00` (Sunday)** — the correct `weekday:1` (Sunday) + 9:00 AM delivery hour. (Decay reminders sit separately at Mon 09:10 / Wed 09:05 — staggered minutes; the digest is the only Sunday alarm.)
  - **NOTE (pre-57 caveat, worth an owner check):** the alarm shows `repeatInterval=0` — the OS alarm is a one-shot at the next Sunday, so the weekly REPEAT relies on expo's `NOTIFICATION_EVENT` broadcast receiver re-arming the next occurrence on each fire (headlessly, even if the app isn't opened). That headless re-arm is exactly the #34782/#30577 behaviour the device spike targets — confirm it fires AND re-arms across ≥2 Sundays (or via a device-clock jump).

### Minor finding (non-blocking, UI polish)
- **Top-inset / safe-area on the top bar.** The dashboard "Your week" entry and the digest header/Back button render high — the top of their tap targets sits under the system status bar (bounds start ~y=28), so adb point-taps at their visual centre (y≲140) miss; taps lower in the bounds and system-back work. A real finger tap is likely fine (larger contact area; the visible control is below the status bar), but a small top-inset bump on the digest header + the "Your week" entry would make the targets cleaner. Owner's taste call.

## Still owner-gated — the release-blocking DGST-01 device spike (NOT yet verified; 15-06 checkpoint)
These are timing/device-state dependent and could not be observed by driving the UI on a release APK:
- **WEEKLY Sunday fire** — the `digest:weekly` trigger firing once/week (needs device-clock manipulation or waiting to Sunday morning). Pre-57 repeat bugs #34782/#30577 warrant one on-device confirmation it fires exactly once/week.
- **Reboot re-registration** — the WEEKLY trigger surviving a reboot (AlarmManager + expo's auto RECEIVE_BOOT_COMPLETED, no custom receiver).
- **Delivery-hour drift re-arm (M3)** — change the delivery hour, confirm the WEEKLY trigger round-trips the new weekday/hour AND exactly one re-armed trigger (needs `dumpsys alarm` / a run-as-able build to inspect the pending set — release APK is not run-as-able).
- **Notification tap → `[Home, Digest]` reset (H3)** — needs a real fired digest notification to tap; confirm Back lands on the dashboard from a deep stack.
- **Empty-week "all quiet this week" state** — the device DB currently has retrospective data, so the populated state was seen, not the empty state.
- **Foreground-suppression accept (L2)** — a digest firing while the app is foregrounded is silently dropped (by design).

**Verification status: `human_needed`** — the node-verifiable + drivable UI portions PASS; the timing-dependent DGST-01 device-spike checks above remain owner-gated (release-blocking). A debug build (run-as-able) is the path to inspect the scheduled-notification pending set for the drift/reboot checks.
