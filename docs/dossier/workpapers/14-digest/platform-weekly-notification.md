# Platform workpaper — Weekly digest local notification

**Scope:** verify `expo-notifications` support for a once-weekly local notification (fixed weekday + morning hour) that opens an in-app screen. No backend, no FCM, no push. Local scheduling only.

**Package/version verified:** `expo-notifications`, the version bundled with **Expo SDK 57**. Docs site is on the SDK 57 (`versions/latest`) line; latest published npm is **57.0.9**. All findings below are against that documentation, not training data.

**Primary sources**
- Expo Notifications SDK reference (latest / SDK 57): https://docs.expo.dev/versions/latest/sdk/notifications/
- expo-notifications on npm (version): https://www.npmjs.com/package/expo-notifications
- expo-notifications CHANGELOG: https://github.com/expo/expo/blob/main/packages/expo-notifications/CHANGELOG.md
- Issue #34782 — non-repeating notification re-fired indefinitely (Android): https://github.com/expo/expo/issues/34782
- Issue #30577 — daily/weekly/yearly should not require `repeats`: https://github.com/expo/expo/issues/30577
- Issue #4121 — scheduled notifications not shown after reboot: https://github.com/expo/expo/issues/4121
- Android — start an activity from a notification: https://developer.android.com/develop/ui/views/notifications/navigation
- Android 15 — background activity launch (BAL) restrictions: https://developer.android.com/guide/components/activities/background-starts
- Android — Schedule alarms (AlarmManager reboot behavior): https://developer.android.com/develop/background-work/services/alarms

---

## VERDICT (Q1): Native weekly repeat on Android — **YES.**

`expo-notifications` in SDK 57 exposes a first-class **`WEEKLY`** schedulable trigger
(`SchedulableTriggerInputTypes.WEEKLY` / `WeeklyTriggerInput`) that fires **once every
week when `weekday` + `hour` + `minute` match**, and it is supported on Android. There
is no need to schedule a one-shot dated notification and re-arm it on fire/launch. This
is the intended mechanic for a fixed-weekday, fixed-hour digest.

Caveat that shapes the design: the weekly trigger **has no `repeats` field and repeats
indefinitely by construction** — you cannot make it fire "once." That's fine for a
digest, but it means "fresh content per week" requires cancel + reschedule (see Q2).

---

## Q1 — Repeating weekly calendar trigger

**Supported. `WeeklyTriggerInput`.** From the SDK 57 reference:

- `SchedulableTriggerInputTypes` includes `DATE`, `TIME_INTERVAL`, `DAILY`, `WEEKLY`,
  `MONTHLY`, `YEARLY`, and `CALENDAR`.
- `WeeklyTriggerInput` fields: `type: 'weekly'`, `weekday: number`, `hour: number`,
  `minute: number`. Docs: "A trigger related to a weekly notification … the notification
  will be delivered once every week when the `weekday`, `hour`, and `minute` date
  components match the specified value."
- **Weekday numbering: 1–7 with `1 = Sunday`** … `7 = Saturday`. So the CONTEXT example
  "Sunday 9am" = `{ type: SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 9, minute: 0 }`.

**Platform split — note the inversion from intuition:**
- `WEEKLY` / `MONTHLY` / `YEARLY` are the **Android-native** calendar-style triggers.
  Docs: for WEEKLY, "The same functionality will be achieved on iOS with a
  `CalendarNotificationTrigger`." i.e. on iOS the JS `WEEKLY` input is lowered onto
  `UNCalendarNotificationTrigger`; on Android it maps to the native AlarmManager path.
- `CALENDAR` (the raw `CalendarTriggerInput` with `weekday`/`repeats`) is documented as
  the **iOS** form. Do **not** reach for `CALENDAR` on Android — use `WEEKLY`.
- `TIME_INTERVAL` is Android-capable and can repeat, but it repeats on an elapsed-seconds
  cadence, not a wall-clock weekday/hour, so it is the wrong tool for "Sunday 9am."

**Design recommendation:** use `SchedulableTriggerInputTypes.WEEKLY`. It is cross-platform
at the JS layer and Android-native underneath, so a single call covers the digest.

---

## Q2 — Is a repeating notification's content frozen?

**Yes — same frozen-content behavior as one-shot scheduled notifications.** Content
(`title`, `body`, `data`) is captured at `scheduleNotificationAsync()` time and re-shown
verbatim on every occurrence. The docs state content is fixed at schedule time and cannot
be modified afterward; there is no per-occurrence content callback for a scheduled trigger
(the foreground `setNotificationHandler` only runs while the app is alive, which is exactly
when the digest is *not* meant to matter). This matches the frozen-serialized-to-
SharedPreferences fact the decay-reminder sibling already established.

**Consequence for the digest:** you **cannot** compute a fresh "here's who to reconnect
with this week" body per occurrence from a single standing weekly schedule. Options:
1. **Cancel + reschedule each week** — on app open (or via the network-gated background
   task when it happens to run), cancel the digest and re-schedule next Sunday's WEEKLY
   trigger with freshly computed content. This is the only way to get per-week dynamic
   copy. But it depends on the app being opened, so it is unreliable as the *sole*
   mechanism (see Q3).
2. **Static digest copy** — schedule one standing WEEKLY notification with generic body
   ("Your weekly Orbit digest is ready"), let it fire reliably forever with no app
   involvement, and compute the actual digest contents *inside the in-app screen* when
   the user taps through. This keeps the notification a dumb, reliable trigger and moves
   all dynamic content behind the tap. **Recommended** given the offline / no-background
   constraints — it degrades gracefully when the app is never opened.

A hybrid is possible (static standing schedule + opportunistic content refresh when the
app is open), but option 2 is the robust floor.

---

## Q3 — Reliability across reboot / app-not-opened

**App never opened for weeks:** a native `WEEKLY` trigger keeps firing on its own. It is
backed by Android AlarmManager, not by the app process or by the network-gated
`expo-background-task`. This is the key reason to prefer the native WEEKLY trigger over a
"reschedule on launch" scheme — the latter silently stops the moment the user stops
opening the app, which for a re-engagement digest is precisely the population you need to
reach.

**Reboot:** by default Android cancels all AlarmManager alarms on shutdown
(Android docs, "Schedule alarms"). expo-notifications handles this for you: the library
declares **`RECEIVE_BOOT_COMPLETED`** automatically in its `AndroidManifest.xml` and,
per the SDK 57 docs, uses it "to set up scheduled notifications when the device
(re)starts." So scheduled notifications are **re-registered after reboot by the library**
— you do **not** need to write your own `BOOT_COMPLETED` receiver, and there is no ADR
implication requiring one.

**Reliability caveats to record (not blockers, but real):**
- **Exact vs inexact timing.** On Android 12+ exact alarms need `SCHEDULE_EXACT_ALARM` /
  `USE_EXACT_ALARM`. A once-a-week morning digest does **not** need minute-exact delivery;
  the default inexact path is appropriate and avoids the exact-alarm permission burden and
  its Play policy scrutiny. Expect delivery within a window around the target time, which
  is fine for a digest — do not chase exactness here.
- **OEM battery/Doze killers.** Aggressive vendors (Xiaomi, Samsung, Huawei, OnePlus) can
  delay or drop alarms for "optimized" apps. This is an Android-ecosystem reality, not an
  expo bug, and affects any local scheduler. For a weekly digest the occasional slipped
  or delayed occurrence is tolerable; do not architect around it.
- **Historical bug, verify on 57.** Issue #34782 (SDK ~52) had a non-repeating Android
  notification re-firing in a loop when the app was closed; closed via PR #35393 and
  marked outdated. Issue #30577 notes daily/weekly/yearly inputs historically forced a
  `repeats` param. Both predate SDK 57. Worth a one-time on-device confirmation that a 57
  WEEKLY trigger fires exactly once per week (not looping) before shipping — cheap to
  verify on the physical Pixel, and repeat cadence can't be measured on the emulator.

---

## Q4 — Tapping the notification to open a specific in-app screen

**Standard mechanism confirmed, no special Android 15 blocker for a user tap.**

- Put routing info in the notification **`data`** payload at schedule time (e.g.
  `data: { screen: 'weekly-digest' }` or a deep-link URL). It survives freezing (it's part
  of the frozen content) and is delivered with the response.
- Cold start (app was killed): read the launching tap with
  **`getLastNotificationResponseAsync()`** (or the `useLastNotificationResponse()` hook),
  pull `response.notification.request.content.data`, and route. Call
  `clearLastNotificationResponseAsync()` after handling to avoid re-routing on the next
  launch.
- Warm/foreground/background-but-alive: **`addNotificationResponseReceivedListener()`**
  fires on tap; route from the same `data` payload.

**Android 15 constraint — does it affect the tap?** No, not the tap. Android 15's new
default is that **PendingIntents don't implicitly get background-activity-launch (BAL)
privileges** — an app can no longer silently launch an activity from the *background* via
a PendingIntent without opting in
(`setPendingIntentBackgroundActivityStartMode(MODE_BACKGROUND_ACTIVITY_START_ALLOWED)`).
That restriction targets *background, non-user-initiated* launches. A **user physically
tapping the notification** is a foreground, user-initiated launch of the notification's
content intent, which remains allowed — this is the ordinary "start an activity from a
notification" flow (Android notifications-navigation docs). expo-notifications owns the
content PendingIntent internally, and the app is already `launchMode="singleTask"`, so the
tap arrives via `onNewIntent` (warm) or the launch intent (cold) exactly as today. **No
code change required for the tap path on Android 15.** (If you ever add a background,
non-tap auto-launch, revisit BAL — but the digest doesn't do that.)

---

## Net decisions this workpaper drives

1. **Use `SchedulableTriggerInputTypes.WEEKLY`** with `{ weekday: 1, hour: 9, minute: 0 }`
   for a Sunday 9am digest (weekday 1 = Sunday). Android-native, survives reboot via the
   library's `RECEIVE_BOOT_COMPLETED`, keeps firing when the app is never opened.
2. **Prefer static notification copy** on the standing weekly schedule; compute the actual
   digest content inside the in-app screen on tap. Dynamic per-week copy would require
   cancel+reschedule, which is unreliable offline/when-unopened.
3. **Don't build a custom BOOT_COMPLETED receiver** — the library already re-arms on boot.
4. **Don't require exact alarms** — inexact delivery is correct for a weekly digest.
5. **Tap-to-open:** `data` payload + `getLastNotificationResponseAsync()` (cold) /
   `addNotificationResponseReceivedListener()` (warm). No Android 15 change needed given
   `singleTask` + `onNewIntent`.
6. **Pre-ship check on the physical phone:** confirm a WEEKLY trigger fires once per week
   and does not loop (historical pre-57 bugs #34782 / #30577). Cannot be validated on the
   emulator.
