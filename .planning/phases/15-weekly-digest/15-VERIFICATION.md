---
phase: 15
slug: weekly-digest
status: passed
verified_at: 2026-08-23
requirements: [DGST-01, DGST-02, DGST-03]
note: >
  Node + code-review + on-device UAT all PASS, including a device-clock fire test that proved the WEEKLY
  digest fires AND headlessly re-arms for the next Sunday. Two low-risk items were not driven end-to-end
  (H3 notification-tap reset — code+node verified; reboot re-registration — expo auto RECEIVE_BOOT_COMPLETED,
  code+dossier verified). Owner sign-off is the final gate.
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

## Device-clock fire test — PASS (the release-blocking DGST-01 core)

Backgrounded the app, disabled `auto_time`, and set the clock just past the digest alarm's own epoch
(`cmd alarm set-time`, using the scheduled alarm's epoch to avoid timezone math), then restored `auto_time`:

- ✅ **The WEEKLY digest FIRED** — `dumpsys notification` shows `NotificationRecord ... tag=digest:weekly
  channel=digest-v1 vis=PRIVATE flags=AUTO_CANCEL`, **title "Your week in Orbit"**, **text "A look back at
  who you reached."** — the exact frozen copy, on the dedicated PRIVATE channel (lock-screen safe).
- ✅ **It HEADLESSLY RE-ARMED for the next Sunday** — `dumpsys alarm` after the fire shows the next
  `digest:weekly` at **`2026-09-06 09:00` (the next Sunday)**, with the app only backgrounded (not opened).
  **This resolves the pre-57 `repeatInterval=0` / #34782/#30577 caveat: the WEEKLY trigger fires AND
  re-schedules the next occurrence via expo's `NOTIFICATION_EVENT` receiver, so it keeps firing weekly even
  if the app is never opened.**
- Test artifacts (benign): the jump "consumed" the Aug 30 occurrence (now armed for Sep 6) — opening the app
  once before Aug 30 re-arms it to Aug 30 via the launch sweep. The forward jump also tripped a transient
  Google account security prompt on the phone (dismissed; clock restored to real network time).

## Not driven end-to-end (otherwise verified — low risk)
- **Notification tap → `[Home, Digest]` reset (H3)** — the shade capture failed after the Google prompt, so the
  tap wasn't driven. The reset intent is **code-reviewed** (`resolveNotificationNav` returns the exact
  `{type:"reset",index:1,routes:[{name:"Home"},{name:"Digest"}]}`; `applyBodyNav` applies it) and **node-tested**
  (asserts that exact shape). Back→dashboard was separately confirmed on-device via system-back from the digest screen.
- **Reboot re-registration** — not driven (would require rebooting the owner's work phone). expo-notifications
  auto-declares `RECEIVE_BOOT_COMPLETED` and re-registers WEEKLY triggers (code + dossier §platform-verification).
- **Empty-week "all quiet" state** — the device DB has retrospective data, so the populated state was seen, not the empty state (node-tested).
- **Foreground-suppression (L2)** — accepted by design (`FOREGROUND_NOTIFICATION_BEHAVIOR` all-false); the fire test backgrounded the app precisely so the notification would post.

**Verification status: `passed`** (pending owner sign-off) — every critical DGST-01/02/03 behaviour is verified: node 1356/1356 + code-review APPROVE, the UI drives correctly on the Pixel, migration 005 applied on real hardware, and the WEEKLY digest provably **fires + re-arms** with the correct copy/channel. The un-driven items above are code/dossier-verified and low-risk.
