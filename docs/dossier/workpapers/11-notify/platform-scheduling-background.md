# Platform verification — notification scheduling & background execution

**Workpaper:** 11-notify / scheduling + background architecture
**Date:** 2026-08-13
**Verifier:** platform-verification agent
**Method:** read Android source from the published npm tarballs (first-hand); official Expo docs and Android developer docs fetched live. Where only a secondary source exists it is labelled *(secondary)*.
**Scope note:** This paper covers scheduling / background-execution ONLY. The prior 11-notify verification (reboot re-arm, inexact alarm branch, headless action buttons, 3-button max, 1024-char body cap, single numeric id=0 + tag, no grouping, no per-notification large icon) is taken as given and not re-verified except where it intersects a finding here.

---

## Versions verified (all first-hand from tarballs)

| Package | Version read | How pinned by `expo@57` |
|---|---|---|
| `expo` | 57.0.12 (latest 57.x on registry) | — |
| `expo-notifications` | **57.0.10** | `bundledNativeModules.json`: `"~57.0.10"` |
| `expo-background-task` | **57.0.9** | `bundledNativeModules.json`: `"~57.0.9"` |
| `expo-background-fetch` | **57.0.9** (deprecated) | `bundledNativeModules.json`: `"~57.0.9"` |
| `expo-task-manager` | **57.0.9** | `bundledNativeModules.json`: `"~57.0.9"` |

`bundledNativeModules.json` read from `expo-57.0.12/package/bundledNativeModules.json`.

---

## Findings that change a design decision (read this first)

| # | Finding | First-hand source | Design impact |
|---|---|---|---|
| A | **Scheduled-notification content is FROZEN at schedule time.** The full request (title/body/data) is serialized to a **SharedPreferences** store on `scheduleNotificationAsync`; the AlarmManager PendingIntent carries only the *identifier*. On fire, the stored request is re-read and presented verbatim. | `ExpoSchedulingDelegate.scheduleNotification()` → `store.saveNotificationRequest(request)`; `triggerNotification()` reads it back; `SharedPreferencesNotificationsStore` | A "pre-schedule all decay notifications" design will show **stale fuel** and will fire even for contacts since marked-contacted, unless you **reschedule on every relevant mutation** (or don't bake dynamic text into the scheduled body). This is the crux finding. |
| B | **The WorkManager background task is HARD-GATED on network connectivity.** `Constraints.setRequiredNetworkType(NetworkType.CONNECTED)` is hardcoded and not configurable. | `BackgroundTaskScheduler.scheduleWorker()` | A local-first, no-network app's decay sweep **will not run while the device is offline** — even though the work is 100% on-device. This is a real correctness gap for a background-sweep architecture. |
| C | **Background task cadence is coarse and OS-controlled.** Native Android default = **24 h** (`60*24`); documented minimum = **15 min**; delivery is inexact and further deferred in restrictive App Standby buckets. (JS doc comment says "12 hours" but the Android native default is 24 h — doc is stale/cross-platform.) | `BackgroundTaskScheduler.DEFAULT_INTERVAL_MINUTES`; `BackgroundTask.types.ts`; Expo docs | A background sweep cannot be relied on for punctual "due today at 9am" reminders. Good enough for a daily digest-style sweep, not for precise per-contact timing. |
| D | **`expo-background-fetch` is deprecated** in favour of `expo-background-task` (WorkManager-backed). Still shipped at 57.0.9, emits a runtime warning. | `BackgroundFetch.ts` (`@deprecated`, `showDeprecationWarning`); `CHANGELOG.md` | Use `expo-background-task`, not `expo-background-fetch`, for any background-sweep design. |
| E | **Neither the trigger nor the channel has any quiet-hours field.** Only triggers are date/timeInterval/daily/weekly/monthly/yearly/channel. | `NotificationScheduler.triggerFromParams()` | Quiet hours ("no pings 22:00–08:00") must be implemented entirely in app logic by choosing the trigger instant yourself. |
| F | **A stable identifier CAN be supplied at schedule time**, and reusing it **replaces** both the stored request and the alarm (data URI embeds the identifier; `FLAG_UPDATE_CURRENT`). Distinct identifiers = distinct alarms. | `scheduleNotificationAsync(identifier, …)`; `createNotificationTrigger()` data URI + request code | Cancel/replace-per-contact is clean: key the identifier on `contactId`. No need to track library-generated ids. |
| G | **Delivered notification: re-posting with the SAME identifier REPLACES in the shade; a DIFFERENT identifier STACKS.** Posted as `notify(tag = identifier, id = 0)`. `setOngoing`/`setAutoCancel` ARE controllable from JS via `sticky` / `autoDismiss`. | `ExpoPresentationDelegate.presentNotification()`; `ExpoNotificationBuilder` lines 100–101 | Daily re-reminder for the same contact updates in place (use same id); "sticky" non-dismissible reminders are possible (`sticky:true`). |
| H | **Killed-app action buttons DO reach a registered background task** (headless), confirmed in source. The JS `addNotificationResponseReceivedListener` is explicitly a noop when killed. | `ExpoHandlingDelegate.handleNotificationResponse()` → `runTaskManagerTasks()` | Snooze / mark-contacted from a notification button works with the app dead — but only via a `registerTaskAsync` task, never the JS listener. One unresolved item is a **device spike** (below). |

---

## Q1 — Periodic background execution without FCM

**API:** `expo-background-task@57.0.9`, WorkManager-backed. Confirmed the correct successor to the deprecated `expo-background-fetch`.

**No Firebase/FCM anywhere in the module.** First-hand:
- `android/build.gradle` dependencies: `androidx.work:work-runtime-ktx:2.9.1` + `com.facebook.react:react-android`. No `firebase-*`.
- `android/src/main/AndroidManifest.xml` is an **empty manifest** — no permissions, no services, no FCM `MESSAGING_EVENT` receiver. The task is pure WorkManager.
- `BackgroundTaskModule.getStatusAsync()` returns `2` unconditionally with the comment *"WorkManager is always available on Android."* — there is no FCM/Play-Services gate.

**Cadence (first-hand + docs):**
- Native default interval: `BackgroundTaskScheduler.DEFAULT_INTERVAL_MINUTES = 60L * 24L` = **24 hours**. (`BackgroundTask.types.ts` doc comment claims "12 hours" and "minimum 15 minutes" — the 12h figure does not match the Android native default; treat 24h as the real Android default.)
- Interval comes from `registerTaskAsync(name, { minimumInterval })` → `BackgroundTaskConsumer.getIntervalMinutes()`.
- Mechanism (API 26+): a **self-rescheduling chain of `OneTimeWorkRequest`s** with `setInitialDelay(minimumInterval)`, re-enqueued (`ExistingWorkPolicy.APPEND`) at the end of each run (`runTasks()`), not a single `PeriodicWorkRequest`. Pre-API-26 falls back to `PeriodicWorkRequest`. WorkManager's 15-min periodic floor therefore does not literally apply to the API 26+ path, but Expo documents 15 min as the effective minimum.
- **App Standby / Doze:** WorkManager work is subject to standby-bucket deferral; Expo docs state *"the system controls the background task execution interval and treats the specified value as a minimum delay. Tasks won't run exactly on schedule."* In restrictive buckets ("rare"/"restricted") a job can be deferred for hours to a day. Expo docs also list the runtime constraints observed in the debugger: **`TIMING_DELAY CONNECTIVITY UID_NOT_RESTRICTED`**.
- **Network gate (Finding B):** `scheduleWorker()` hardcodes `Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED)`. The worker will not run offline. Expo docs corroborate: *"A background task will only run if the battery has enough charge … and the network is available."* This is the single biggest gotcha for a no-server app.

**Foreground guard:** `runTasks()` refuses to execute while `inForeground` (set via `OnActivityEntersForeground/Background`) and defers to a later worker — so the task only runs while backgrounded.

**`expo-background-fetch` on SDK 57 (Finding D):** still published at 57.0.9 and bundled, but **deprecated**. First-hand: `BackgroundFetch.ts` logs `"expo-background-fetch: This library is deprecated. Use expo-background-task instead."` and its exports carry `@deprecated Use … from expo-background-task`. `CHANGELOG.md`: *"Marked library as deprecated in favor of expo-background-task."* Do not use it for new work.

---

## Q2 — Is scheduled content frozen at schedule time? YES (the crux)

**First-hand chain:**
1. `NotificationScheduler.scheduleNotificationAsync(identifier, content, trigger)` builds a `NotificationRequest(identifier, content, trigger)` and calls `NotificationsService.schedule(...)`.
2. `ExpoSchedulingDelegate.scheduleNotification(request)`: for a schedulable (date/interval/calendar) trigger it calls **`store.saveNotificationRequest(request)`** and then `setupAlarm(nextTriggerDate, createNotificationTrigger(context, request.identifier))`.
3. `SharedPreferencesNotificationsStore.saveNotificationRequest()` base64-serializes the **entire request (content included)** into `SharedPreferences` under key `notification_request-<identifier>`.
4. The AlarmManager PendingIntent (`createNotificationTrigger`) carries **only the identifier** in its data URI (`…/scheduled/<identifier>/trigger`), no content.
5. When the alarm fires, `ExpoSchedulingDelegate.triggerNotification(identifier)` does `store.getNotificationRequest(identifier)` and presents **that stored request verbatim**, then re-schedules if it repeats.

**Correction to the task's hypothesis:** the scheduled store is **SharedPreferences**, not SQLite (`SharedPreferencesNotificationsStore`, prefs file `expo.modules.notifications.SharedPreferencesNotificationsStore`). Behaviour is the same either way: content is captured and persisted at schedule time.

**Consequence:** If contact X's fuel line, or the fact that X was marked-contacted, changes after you scheduled, the **delivered** notification shows the OLD text and **still fires**. The OS/library never re-derives content at fire time. Therefore a "pre-schedule everything" architecture is only correct if you **re-schedule (same identifier → overwrite) on every mutation that affects that contact's text or due-time**, or you cancel on mark-contacted/snooze. There is no "live content" escape hatch.

---

## Q3 — Cancel / reschedule semantics & identity

- **Supply your own identifier:** the native `scheduleNotificationAsync` takes `identifier: String` as its first argument (`NotificationScheduler`). The JS wrapper generates a UUID only if you omit it — you can and should pass a stable one (e.g. `contactId`).
- **Replace = reuse identifier.** `saveNotificationRequest` writes by key `notification_request-<identifier>` (overwrites). The alarm PendingIntent's data URI embeds the identifier and is created with `PendingIntent.FLAG_UPDATE_CURRENT`, so re-scheduling the same identifier **replaces** the pending alarm rather than adding a second. (The PendingIntent request *code* is a constant service-class hashCode for all notifications, but `filterEquals` distinguishes on the data URI, which is per-identifier — so identifiers do not collide.)
- **Cancel one:** `cancelScheduledNotificationAsync(identifier)` → `removeScheduledNotifications` → `alarmManager.cancel(createNotificationTrigger(id))` + `store.removeNotificationRequest(id)`.
- **Enumerate:** `getAllScheduledNotificationsAsync()` → `store.allNotificationRequests` (every `notification_request-*` key). Cheap; use it to reconcile.
- **Cancel all:** `cancelAllScheduledNotificationsAsync()`.
- **Practical cap:** default path uses the **inexact** `AlarmManagerCompat.setAndAllowWhileIdle` (because `SCHEDULE_EXACT_ALARM` is not declared, so `alarmManager.canScheduleExactAlarms()` is false on API 31+ — confirmed in `ExpoSchedulingDelegate.setupAlarm`). Android's documented **500-alarm-per-app cap applies to *exact* alarms only** *(secondary: Android 14 exact-alarm docs)*; there is no comparable documented cap for inexact alarms. At **tens of contacts**, alarm count is a non-issue on any branch.
- **Doze throttle (relevant to timing, not count):** `setAndAllowWhileIdle` alarms fire **at most once per ~9 minutes per app** while the device is dozing, and inexact alarms on Android 12+ may be delayed 10+ min *(secondary: Android AlarmManager docs / developer.android.com)*. Immaterial for decay reminders spread over days; only a factor if many alarms are packed into one 9-min window during Doze.

---

## Q4 — Quiet hours

**No OS/library quiet-hours field exists.** First-hand: `NotificationScheduler.triggerFromParams()` accepts exactly `timeInterval | date | daily | weekly | monthly | yearly | channel`. None takes a "window", "not-before/not-after", or "quiet hours" parameter. The Android `NotificationChannel` config surfaced by the channel modules exposes importance/sound/vibration/lights/lockscreen visibility/bypassDnd — **no time-of-day gate**. (System-wide Do Not Disturb exists but is user-controlled and not addressable per-notification from the app.)

**Implication:** quiet hours are **100% app logic** — when computing a contact's trigger instant, if it lands inside the quiet window, advance it yourself to the next allowed moment (e.g. 08:00) before calling `scheduleNotificationAsync`.

---

## Q5 — Re-notification / persistence

- **Persists until dismissed:** a delivered notification stays in the shade until the user dismisses or acts on it (standard Android; the library sets no timeout). On **tap**, default `autoDismiss = true` → `setAutoCancel(true)` removes it; set `autoDismiss:false` to keep it after tap.
- **Ongoing / non-dismissible IS available from JS:** `ExpoNotificationBuilder` line 101 `builder.setOngoing(content.isSticky)`; JS field `sticky` (default **false** per `ArgumentsNotificationContentBuilder`: `getBoolean(STICKY_KEY, false)`). Set `sticky:true` for a swipe-proof reminder. Line 100 `setAutoCancel(content.isAutoDismiss)`, default **true** (`getBoolean(AUTO_DISMISS_KEY, true)`).
- **Re-remind next day = a fresh `scheduleNotificationAsync` call** with a future trigger (or a `daily` repeating trigger).
- **Same identifier REPLACES in the shade; different identifier STACKS.** `ExpoPresentationDelegate.presentNotification()` calls `NotificationManagerCompat.notify(tag = request.identifier, id = ANDROID_NOTIFICATION_ID = 0, …)`. Android replaces on matching `(tag, id)`. So per-contact identifier → the daily reminder updates in place (one entry per contact); a new identifier each day → duplicates pile up. Key the identifier on `contactId` to get replace-in-place.

---

## Q6 — Snooze / mark from a KILLED app

**Confirmed from source that a custom action button reaches a `registerTaskAsync` background task even with the process dead:**

`ExpoHandlingDelegate.handleNotificationResponse()` (expo-notifications 57.0.10):
```kotlin
if (notificationResponse.action.opensAppToForeground()) {
  openAppToForeground(context, notificationResponse)
}
// Run background tasks only for custom notification action buttons (not the default tap).
if (!isAppInForeground() &&
    notificationResponse.actionIdentifier != NotificationResponse.DEFAULT_ACTION_IDENTIFIER) {
  FirebaseMessagingDelegate.runTaskManagerTasks(
    context.applicationContext,
    NotificationSerializer.toBundle(notificationResponse))
}
// NOTE the listeners are not set up when the app is killed
// and is launched in response to tapping a notification button
// this code is a noop in that case
```
- When the app is **not foreground** (backgrounded OR killed) **and** the action is a **custom** button (`opensAppToForeground:false`, non-default action id), it dispatches to `runTaskManagerTasks()`, which calls `TaskServiceProviderHelper.getTaskServiceImpl(...)` (restores registered tasks in a headless context) then runs every registered `remote-notification` task consumer's `executeTask(bundle)` → `task.execute(bundle)`. That is the headless JS path.
- The task involved is the one registered via **`Notifications.registerTaskAsync(taskName)`** (`ExpoBackgroundNotificationTasksModule` → `BackgroundRemoteNotificationTaskConsumer`, taskType `"remote-notification"`). This is a `TaskManager`/JobService-backed consumer, i.e. survives process death.
- The source **comment itself confirms** the JS `addNotificationResponseReceivedListener` path is a **noop when killed** — matching the prior finding. Snooze/mark-contacted must be handled inside the registered task, not the listener.
- The dispatch does **not** touch Firebase on the response path (the `FirebaseMessagingDelegate` companion is just where the helper lives; the response path passes a serialized `NotificationResponse`, not a `RemoteMessage`).

**Unresolved item → device spike (do not resolve remotely):** whether `TaskServiceProviderHelper.getTaskServiceImpl()` / the headless React loader initializes cleanly on a device with **no `google-services.json` / no FCM configured**. Nothing in the read source *requires* FCM for this path, but headless-task bring-up on an FCM-less build is exactly the kind of thing that has to be proven on the physical Pixel. Spike: build without google-services.json, kill the app, tap a custom action button, confirm the task's JS runs.

---

## Which architecture does the platform actually support, and at what cost

Three candidate architectures for decay notifications:

**1. Pre-schedule all + reschedule-on-mutation.** *Supported, with a hard constraint.*
- The platform frozen-content behaviour (Q2) means every scheduled notification's fuel text is a snapshot. To stay correct you MUST, on every mutation that changes a contact's due-time or displayed text (mark-contacted, snooze, interval edit, name/field edit that shows in the body), call `cancelScheduledNotificationAsync(contactId)` and re-`scheduleNotificationAsync(contactId, freshContent, freshTrigger)`. Identity is clean (Q3, Finding F).
- **Cost:** correctness is entirely on your reschedule discipline — miss a mutation and a stale/no-longer-due notification fires. Delivery is inexact (Doze/inexact-alarm), acceptable for "you're overdue" semantics. No network dependency (AlarmManager, not WorkManager). **Best fit for punctual per-contact reminders** given tens of contacts.
- Mitigation for staleness: keep the scheduled body **generic** ("Time to reach out to <name>") and compute exact fuel only when the app opens — a generic body cannot go stale on fuel, only on the due-event itself, which you still cancel on mark-contacted.

**2. Periodic background sweep (`expo-background-task`).** *Supported but weak for this use case.*
- A WorkManager task wakes ~daily, computes status for all contacts, and posts notifications at runtime with then-current fuel — so **content is never stale** (posted immediately, not pre-scheduled).
- **Cost:** (a) **hard network gate** (Finding B) — the sweep will not run offline, unacceptable as the *sole* mechanism for a local-first app that must work with no network; (b) cadence is coarse/OS-throttled (Finding C) — no punctual "due at 9am", can slip hours in restrictive buckets; (c) needs the FCM-less headless-init spike (Q6) to even be trusted. Good only as a **coarse daily backstop**, never the primary timer.

**3. Launch-sweep + scheduled hybrid.** *Supported; the pragmatic recommendation.*
- On every app launch/foreground, run a synchronous sweep (pure `elapsed/interval`, already the model) that (re)computes each contact's next-due instant and **reconciles the scheduled set**: cancel notifications for no-longer-due contacts, (re)schedule with fresh generic content + correct trigger for due/soon contacts. This makes launch the source of truth and folds mutation-driven rescheduling into one idempotent reconcile.
- Optionally add architecture #2's daily background sweep **purely as a backstop** for users who rarely open the app — accepting it silently no-ops while offline.
- **Cost:** users who never open the app for long stretches rely only on the pre-scheduled alarms (fine — AlarmManager survives reboot/update per prior finding) plus the flaky background backstop. Snooze/mark-from-killed still needs the registered response task (Q6). This gets correct fuel at open, correct-enough reminders while away, and no hard network dependency on the primary path.

**Bottom line:** the platform's frozen-content + inexact-AlarmManager model makes **#3 (launch-sweep reconcile over scheduled AlarmManager notifications, generic body, cancel/replace keyed on `contactId`)** the architecture with the fewest sharp edges. `expo-background-task` (#2) is viable **only as a best-effort daily backstop**, never the primary or sole mechanism, because of its hardcoded network constraint and coarse OS-throttled cadence. A "pre-schedule dynamic fuel text and never touch it" design (naive #1) is **not** supportable — it will deliver stale fuel and fire for marked-contacted contacts.

---

## Source index (files read first-hand)

expo-background-task 57.0.9: `BackgroundTaskScheduler.kt`, `BackgroundTaskModule.kt`, `BackgroundTaskConsumer.kt`, `BackgroundTaskWork.kt`, `AndroidManifest.xml`, `build.gradle`, `src/BackgroundTask.ts`, `src/BackgroundTask.types.ts`.
expo-background-fetch 57.0.9: `src/BackgroundFetch.ts`, `CHANGELOG.md`.
expo-notifications 57.0.10: `NotificationScheduler.kt`, `ExpoSchedulingDelegate.kt`, `SharedPreferencesNotificationsStore.kt`, `NotificationsService.kt`, `ExpoPresentationDelegate.kt`, `ExpoNotificationBuilder.kt`, `ArgumentsNotificationContentBuilder.java`, `INotificationContent.kt`, `ExpoHandlingDelegate.kt`, `FirebaseMessagingDelegate.kt`, `ExpoBackgroundNotificationTasksModule.kt`, `BackgroundRemoteNotificationTaskConsumer.kt`, `AndroidManifest.xml`, `src/Notifications.types.ts`.
expo 57.0.12: `bundledNativeModules.json`.

Live docs: docs.expo.dev/versions/latest/sdk/background-task, docs.expo.dev/versions/latest/sdk/background-fetch.
Secondary (Android platform behaviour, labelled inline): developer.android.com AlarmManager / schedule-exact-alarms; general Doze `setAndAllowWhileIdle` 9-minute throttle.
