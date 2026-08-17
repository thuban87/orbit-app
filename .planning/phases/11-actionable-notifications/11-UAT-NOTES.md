# Phase 11 — On-Device Pixel UAT Notes (2026-08-16, live driving)

Release APK built via desktop pipeline (droid), installed on the Pixel (`1A071FDEE002BU`) as a reinstall (`-r`, exercised migration v1→v2 on real data).

## Verified live on-device
- **Launch + migration:** the release build cold-starts with no crash; migration 002 (v1→v2 `app_settings`) ran on existing data; dashboard + birthday banner ("Dad's birthday today") render.
- **Settings → Notifications section** renders with all controls + correct copy: master "Allow notifications", "Decay reminders", "Birthday alerts", "Show names on lock screen", and the **user-tunable "Reminder time 9:00 AM" + "Quiet hours 9:00 PM – 8:00 AM"** (the owner's reversal). All expected testIDs present.
- **NOTIF-05 value moment:** tapping the master toggle fires the OS `POST_NOTIFICATIONS` dialog ("Allow Orbit to send you notifications?"). Granting → `POST_NOTIFICATIONS granted=true`.
- **Channels:** `decay-private-v1`, `decay-public-v1`, `birthday-v1` created at `mImportance=2` (**IMPORTANCE_LOW — silent**, FLAG_MUTE_HAPTIC, vibration off) — the H4 fix confirmed on-device.
- **NOTIF-01 pre-scheduling:** after grant, the launch/foreground reconcile scheduled an `RTC_WAKEUP` AlarmManager alarm (inexact — no exact-alarm permission) for a **future** due morning (`2026-08-21 09:10`, = 9am + per-contact stagger) — i.e. a decay notification is parked and will fire without the app open.

## FINDING — lock-screen private/public visibility not enforced on-device (needs follow-up fix + rebuild)
- **Symptom:** on-device, BOTH `decay-private-v1` and `decay-public-v1` report `mLockscreenVisibility=-1000` (`VISIBILITY_NO_OVERRIDE`) — identical. The private/public split is not applied at the channel level.
- **Code is correct:** `src/services/notifications/channels.ts:47/52/57` sets `lockscreenVisibility: AndroidNotificationVisibility.PRIVATE`/`PUBLIC` per channel. So `expo-notifications`' `setNotificationChannelAsync({lockscreenVisibility})` is apparently NOT propagating to the native channel's visibility (stays at the NO_OVERRIDE default).
- **Impact:** NOTIF-05's "private-by-default lock-screen visibility" (hide the contact name on the lock screen) is likely NOT effective on-device — a privacy-control gap (T-11-LOCK).
- **Fix (owner-logged, deferred):** investigate the expo channel-visibility mapping (SDK 57); likely needs a code change (a new channel-id version since channels are immutable, and/or a native/config path) + another desktop build. NOT a blocker for the engine; a privacy hardening follow-up.

## Remaining on-device UAT (in progress this session — forced-delivery route)
- Actual delivery: silent, generic body ("{Name} — time to reach out"), no heads-up.
- Killed-app FCM-less headless mark/snooze DB write (H1/H2) — verified via the profile timeline after a killed-app action tap (release APK is not debuggable → no run-as; verify via app UI).
- Body-tap → Compose → Back → dashboard.
- Being forced by: making a contact overdue + setting the delivery hour to the next allowed slot (8pm, before the 9pm quiet window) so a notification fires within minutes.
