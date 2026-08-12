# Platform verification — how much Conversational Fuel a notification can show, and SQLite text search

Verifier: platform verification agent. Verification date: **2026-08-12**.

Subject: `HANDOFF.md:151-153`, `[DECIDED] Actionable notifications` — *"Local notifications via
`expo-notifications` — no backend required. A decay notification must carry a direct action that
opens the SMS composer for that contact, with their Conversational Fuel visible. Reminder and
action collapse into one tap."*

Nobody had verified what "visible" can concretely mean. This paper establishes it.

---

## Findings that change a design decision

| # | Finding | Where |
|---|---|---|
| 1 | Notification text is hard-capped at **1024 chars** by the framework and silently truncated. The widely-cited 5120 is the *Android 10* value; it was cut 5× in Android 11. | §1.1 |
| 2 | `expo-notifications` **hardcodes `BigTextStyle`**. `InboxStyle` (multi-item, ≤6 lines with an action button) and `MessagingStyle` (the conversation look) are **not reachable from JS**. Multi-item Fuel is possible only as newlines in `body`. | §1.2, §1.3 |
| 3 | JS `body` is used as **both** the collapsed one-liner and the expanded block — the same string. You cannot author a separate teaser. `data` is never displayed. | §1.3 |
| 4 | **No per-contact avatar and no `BigPictureStyle`** for local notifications; the large icon is a static manifest resource. **No notification grouping** either. | §1.3a |
| 5 | Notification **actions do work on Android** — but `categoryIdentifier` is annotated and documented as **iOS-only**. Load-bearing behavior on an undocumented path. | §1.4 |
| 6 | A **"mark contacted" action can write to SQLite with the app never opening** — headless JS via `expo-task-manager`, Android-only, on a path documented for *remote push*. Needs a device spike. | §1.5 |
| 7 | Exact alarms are **off by default**; the library takes the inexact `setAndAllowWhileIdle` branch. Minute-accurate nudges cost a user-revocable permission that is denied by default on Android 13+ and is Play-policy-gated. | §1.6 |
| 8 | **`expo-sms` requires a live Activity** — it cannot run headless. So HANDOFF's *"one tap"* means tap → Orbit opens → composer, not a direct hand-off. A true direct hand-off is legal on Android but needs native code. | §1.9 |
| 9 | Android **cannot tell us whether a message was sent** (`{ result: 'unknown' }`). "Contacted" is never an observable fact. | §1.9 |
| 9a | The CDD mandates only that an SMS app **open** on `SENDTO` — **not** that it honour `sms_body`. An empty composer is compliant. Prefill is a nice-to-have that may silently not appear, so the Fuel must be legible in the notification itself. | §1.9a |
| 10 | **FTS5 is compiled in by default**; **ICU is not**, so `LIKE` is ASCII-only case-insensitive. Search is cheap *if* it goes through FTS5. | Part 2 |

---

## 0. Version / source table

| Thing | Version verified | Source |
|---|---|---|
| `expo` | `57.0.12` | `npm view expo version`, 2026-08-12 |
| `expo-notifications` | **`57.0.10`** (published 2026-08-10), pinned `~57.0.10` | `expo@57.0.12` → `package/bundledNativeModules.json` |
| `expo-sqlite` | **`57.0.1`**, pinned `~57.0.1` | same |
| `expo-sms` | **`57.0.1`** (published 2026-08-06), pinned `~57.0.1` | same |
| SQLite vendored by `expo-sqlite@57.0.1` | **3.50.3**, source id `2025-07-17 13:25:10 3ce993b8657d6d9deda380a93cdd6404a8c8ba1b185b2bc423703e41ae5f2543` | `vendor/sqlite3/sqlite3.c:468,470` in the published npm tarball |
| AOSP `Notification.java` | branches `android11-release` … `android16-release` + `master` | `https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/<branch>/core/java/android/app/Notification.java` |
| Expo notifications docs | SDK 57 | `https://docs.expo.dev/versions/latest/sdk/notifications/` |
| Android expanded-notification docs | fetched 2026-08-12 | `https://developer.android.com/develop/ui/views/notifications/expanded` |
| Android alarm scheduling docs | fetched 2026-08-12 | `https://developer.android.com/develop/background-work/services/alarms/schedule` |
| Android 15 behavior changes | fetched 2026-08-12 | `https://developer.android.com/about/versions/15/behavior-changes-15` |
| Android 16 behavior changes (all apps) | fetched 2026-08-12 | `https://developer.android.com/about/versions/16/behavior-changes-all` |
| Android 16 features | fetched 2026-08-12 | `https://developer.android.com/about/versions/16/features` |
| Android background activity starts | fetched 2026-08-12 | `https://developer.android.com/guide/components/activities/background-starts` |
| Android common intents (SMS) | fetched 2026-08-12 | `https://developer.android.com/guide/components/intents-common` |
| Android 12 behavior changes (trampolines) | fetched 2026-08-12 | `https://developer.android.com/about/versions/12/behavior-changes-12` |
| SQLite `LIKE` semantics | fetched 2026-08-12 | `https://www.sqlite.org/lang_expr.html` |
| SQLite FTS5 / `unicode61` | fetched 2026-08-12 | `https://www.sqlite.org/fts5.html` |
| Android 16 CDD §3.2.3.5 | fetched 2026-08-12 | `https://source.android.com/docs/compatibility/16/android-16-cdd` |
| `sms:` URI scheme (`?body=`) | RFC 5724, Jan 2010 | `https://www.rfc-editor.org/rfc/rfc5724.txt` |
| Google Messages (device-observed) | `messages.android_20260720_05_RC01` on Pixel 6 Pro | see §1.9a + provenance note |

**The prior verification's claim is CONFIRMED**: `expo@57.0.12` / `expo-sqlite@57.0.1`, SQLite
**3.50.3** vendored at `vendor/sqlite3/`, plus a second SQLCipher copy at `vendor/sqlcipher/`.

Every claim below marked "verified in source" was read from the **published npm tarball** of the
named package, or from AOSP source fetched today — not from docs, and not from memory. Where only
docs or secondary sources exist, that is stated explicitly.

---

## PART 1 — How much Fuel an Android notification can show

### 1.1 The hard framework limit is **1024 characters**, and it truncates silently

This is the single most design-relevant number, and it is **not** the figure in circulation.

AOSP `Notification.java`:

```java
/**
 * Maximum length of CharSequences accepted by Builder and friends.
 *
 * <p>
 * Avoids spamming the system with overly large strings such as full e-mails.
 */
private static final int MAX_CHARSEQUENCE_LENGTH = 1024;
```

```java
public static CharSequence safeCharSequence(CharSequence cs) {
    if (cs == null) return cs;
    if (cs.length() > MAX_CHARSEQUENCE_LENGTH) {
        cs = cs.subSequence(0, MAX_CHARSEQUENCE_LENGTH);
    }
    ...
}
```

`safeCharSequence()` is applied to **every** text field that matters here —
`setContentTitle`, `setContentText`, `setSubText`, `BigTextStyle.bigText`,
`InboxStyle.addLine`, `MessagingStyle.Message` text, and action button titles.

Verified value per branch (I fetched each branch's `Notification.java` and grepped the constant):

| AOSP branch | `MAX_CHARSEQUENCE_LENGTH` |
|---|---|
| `android9-release` | *(file not present at that path on this mirror)* |
| `android10-release` | `5 * 1024` |
| `android11-release` | **1024** |
| `android12-release` | **1024** |
| `android13-release` | **1024** |
| `android14-release` | **1024** |
| `android15-release` | **1024** |
| `android16-release` | **1024** |
| `master` (2026-08-12) | **1024** |

**Design consequence.** The commonly cited "5120 character" figure is stale — it was the Android
10 value and was cut by 5× in Android 11. On every Android version this app will ship to, a
notification body is hard-capped at **1024 UTF-16 code units**, silently `subSequence`'d with no
error, no log, and no callback. Fuel text destined for a notification must be truncated by the
app to a length it chooses, with an ellipsis it controls — otherwise a long Fuel entry gets
guillotined mid-word by the framework.

Note this is a *cap*, not a *display* limit. It is far more than any notification actually shows.

### 1.2 What is visible collapsed vs expanded

There is **no documented character limit for what is displayed** — display is a layout question,
so it varies with device, font size, and system theme. Google documents only line counts.

- **Collapsed**: one line of `contentText`, ellipsized. Nothing in official documentation
  quantifies a character count; the widely-quoted "40–90 characters" figures come from
  push-marketing blogs, not from Google, and are **not verifiable**. Treat collapsed as
  *"roughly one line, assume the user sees the title and almost nothing else."*
- **Expanded**: depends entirely on style (below).

`developer.android.com/develop/ui/views/notifications/expanded` documents three relevant styles:

| Style | What expansion shows | Documented limit |
|---|---|---|
| `BigTextStyle` | "the large block of text" — one continuous, wrapping block | none documented |
| `InboxStyle` | "multiple pieces of content text that are each **truncated to one line**" | **"If you add more than six lines, only the first six are visible."** |
| `MessagingStyle` | sequential messages; "each message can be multiple lines long"; `setContentTitle()`/`setContentText()` "are ignored" | none documented; API 24+ |

Verified against AOSP for `InboxStyle`: there are seven row slots
(`R.id.inbox_text0` … `inbox_text6`), and

```java
int maxRows = rowIds.length;
if (mBuilder.mActions.size() > 0) {
    maxRows--;
}
```

**So `InboxStyle` gives 7 lines with no action buttons, and 6 lines the moment you add any
action button.** Since HANDOFF §6 requires an action button, the effective ceiling is 6
one-line items. Additionally, `RemoteInputHistoryItem`s (direct-reply history) eat further rows.

**Design consequence.** A *multi-item* Fuel list survives expansion only in `InboxStyle`, capped
at 6 items each truncated to one line — good for "3 short topics," bad for "one long note."
A *single long* Fuel note survives expansion only in `BigTextStyle` — it wraps, no line cap.
You cannot have both; the styles are mutually exclusive. This is a **product choice about what a
Fuel entry is**, not an implementation detail.

### 1.3 `expo-notifications@57.0.10` hardcodes `BigTextStyle` and exposes no way to change it

Verified in `android/src/main/java/expo/modules/notifications/notifications/presentation/builders/ExpoNotificationBuilder.kt`, in `build()`:

```kotlin
builder.setContentTitle(content.title)
builder.setContentText(content.text)
builder.setSubText(content.subText)
// Sets the text/contentText as the bigText to allow the notification to be expanded and the
// entire text to be viewed.
builder.setStyle(NotificationCompat.BigTextStyle().bigText(content.text))
```

This is unconditional. There is **no** `InboxStyle` and **no** `MessagingStyle` anywhere in the
Android source of the package (grepped; zero hits). The JS API has no style field.

The JS→Android field mapping is (`ArgumentsNotificationContentBuilder.java:20-31`):

| JS `NotificationContentInput` field | Android |
|---|---|
| `title` | `setContentTitle` |
| `subtitle` | `setSubText` — the small header line beside the app name; **display "depends on the device"** (the package's own doc comment) |
| `body` | `setContentText` **and** `BigTextStyle.bigText` — same string used twice |
| `data` | notification `extras` only. **Never displayed.** |
| `color`, `priority`, `vibrate`, `autoDismiss`, `sticky`, `badge`, `sound`, `categoryIdentifier` | mapped as named |

**Design consequences.**

1. **Fuel goes in `body` and nowhere else.** `data` is invisible; `subtitle` is a device-dependent
   header scrap, not a content field.
2. **`body` is doing double duty.** The same string is the collapsed one-liner *and* the expanded
   block. You cannot write a short teaser for collapsed and a long body for expanded — the first
   line of your `body` **is** the collapsed preview. Fuel text must be authored (or reordered)
   so its first ~40–50 characters are the most useful part.
3. **Multi-item Fuel is possible but only as newlines inside `body`.** `BigTextStyle` wraps,
   so `"• topic one\n• topic two\n• topic three"` renders as three visible lines when expanded
   and as a run-together single line when collapsed. There is no per-item truncation and no
   6-line cap — but also no `InboxStyle` framing.
4. **Getting `InboxStyle` or `MessagingStyle` requires native code** — either a patch/fork of
   `ExpoNotificationBuilder`, or a different library. `MessagingStyle` is what would give the
   "conversation" look (avatar, sender name, message bubbles) and it is **not reachable from JS
   on this stack**. If the design wants that look, that is a native-module decision to make now,
   not later.
5. **Nothing is visible without expanding except one line.** The "Fuel visible" half of the
   HANDOFF decision is only satisfiable in the expanded state unless the Fuel is short enough to
   fit one collapsed line. Heads-up (peeking) notifications on high-importance channels show the
   collapsed layout, so a heads-up alert does **not** buy you the expanded text.

### 1.3a Two further things `expo-notifications` does not expose on Android

**No per-notification image / contact avatar.** `ExpoNotificationBuilder` sets a large icon only
from `notificationContent.getImage(context)`, and for **locally scheduled** notifications
(`NotificationContent.java:100-121`) that method reads a **static resource from the manifest
meta-data** `expo.modules.notifications.large_notification_icon`. Only `RemoteNotificationContent`
(FCM push) can carry a per-message image. There is **no `BigPictureStyle`** anywhere in the
package. So a decay notification cannot show *that contact's* photo without native code.

**No notification grouping.** `setGroup` / `setGroupSummary` appear nowhere in the Android source
(the single `setGroup` hit is `NotificationChannel.setGroup` — channel groups, unrelated). Also,
every notification is posted with the **same numeric id** (`ANDROID_NOTIFICATION_ID = 0`) and is
distinguished only by tag (`NotificationManagerCompat.notify(identifier, 0, notification)`,
`ExpoPresentationDelegate.kt:105-112`). Consequence: firing one decay notification per contact
produces N ungrouped, unsummarised notifications. See the Android 16 cooldown note in §1.6a — the
design should strongly prefer **one digest notification** over N per-contact ones.

### 1.4 Notification actions — what is reachable, and how many

**Three action buttons is the platform maximum.** AOSP `Notification.java`:

```java
/**
 * Maximum number of (generic) action buttons in a notification (contextual action buttons are
 * handled separately).
 * @hide
 */
public static final int MAX_ACTION_BUTTONS = 3;
```

and in the expansion path: `int numActions = Math.min(nonContextualActions.size(), MAX_ACTION_BUTTONS);`.
Extra actions are silently dropped. Practically, three is also the visual limit; with long labels
fewer fit legibly.

**Actions on Android go through `categoryIdentifier`, and this works despite the TypeScript
saying it is iOS-only.** In `Notifications.types.ts` the field is annotated:

```ts
  /**
   * The identifier of the notification’s category.
   * @platform ios
   */
  categoryIdentifier?: string;
```

and the Expo SDK 57 docs likewise list `categoryIdentifier` under iOS-only fields of
`NotificationContentInput`. **That annotation is wrong.** Verified:

- `ArgumentsNotificationContentBuilder.java:30` reads `CATEGORY_IDENTIFIER_KEY = "categoryIdentifier"` from the JS payload and calls `setCategoryId(...)`.
- `ExpoNotificationBuilder.build()` calls `notificationContent.categoryId?.let { addActionsToBuilder(builder, it) }`.
- `scheduleNotificationAsync.ts` passes `request.content` to native **verbatim**, with no field filtering — so the value is not stripped on the way down.
- The same docs page lists `setNotificationCategoryAsync` as *"Supported platforms: Android, iOS."*

**Design consequence:** actions work on Android, but the *contract* is documented as iOS-only.
That is a load-bearing behavior sitting on an undocumented (though clearly intentional) code
path. Anyone "fixing" the type annotation, or an Expo minor that tightens payload validation,
could break the app's core interaction. Worth pinning the version and adding a smoke test.

**Action buttons carry no per-action icon.** `buildButtonAction()` uses the app's single small
notification `icon` for every action. Title text only differentiates them.

**Direct reply (`RemoteInput`) is supported.** `buildTextInputAction()` attaches a
`RemoteInput` when the JS action declares `textInput`. So an inline "add Fuel" text field on the
notification is reachable from JS, and its text arrives as
`TextInputNotificationResponse.userText`. **This is a genuine zero-friction Fuel capture path that
HANDOFF §6 does not currently consider** — and unlike a widget (`HANDOFF.md:159`, *"text input
inside an Android widget is impossible"*), a notification *can* take typed input.

The full JS action shape (`Notifications.types.ts`, `interface NotificationAction`) is:

```ts
{ identifier: string;
  buttonTitle: string;
  textInput?: { submitButtonTitle: string /* @platform ios */; placeholder: string };
  options?: { isDestructive?: boolean /* ios */;
              isAuthenticationRequired?: boolean /* ios */;
              opensAppToForeground?: boolean /* @default true */ } }
```

Registered with `setNotificationCategoryAsync(identifier, actions[], options?)` — documented
"Supported platforms: Android, iOS."

### 1.5 Can a "mark contacted" action write to SQLite **without opening the app**? — Yes, with caveats

This is the load-bearing question and the answer is **yes on Android**, via a specific and
somewhat obscure path.

Each action carries `opensAppToForeground: boolean`. Verified in
`NotificationsService.createNotificationResponseIntent()`:

```kotlin
// Starting from Android 12, notification trampolines are not allowed. If the notification
// wants to open foreground app, we should use the dedicated Activity pendingIntent.
if (action.opensAppToForeground() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
  return ExpoHandlingDelegate.createPendingIntentForOpeningApp(context, intent)
}
val mutableFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
return PendingIntent.getBroadcast(context, ..., intent, PendingIntent.FLAG_UPDATE_CURRENT or mutableFlag)
```

With `opensAppToForeground: false` the action's `PendingIntent` is a **broadcast** to
`NotificationsService` (a `BroadcastReceiver`), and the app is never foregrounded.

Then, in `ExpoHandlingDelegate.handleNotificationResponse()`:

```kotlin
// Run background tasks only for custom notification action buttons (not the default tap).
if (!isAppInForeground() && notificationResponse.actionIdentifier != NotificationResponse.DEFAULT_ACTION_IDENTIFIER) {
  FirebaseMessagingDelegate.runTaskManagerTasks(
    context.applicationContext,
    NotificationSerializer.toBundle(notificationResponse)
  )
}
```

`runTaskManagerTasks` starts a **headless JS instance via `expo-task-manager`** and executes any
task registered with `Notifications.registerTaskAsync(...)`, passing the serialized *response*
(including `actionIdentifier` and the notification's `data`). Confirmed by the changelog entry
for `expo-notifications@0.30.6` (2025-04-22):

> **🛠 Breaking changes** — *"[Android] support action buttons when not in foreground. This is
> breaking because notification background tasks on Android run not only in response to an
> incoming notification but also in response to an action button press."* (expo/expo#35295)

So headless JS runs, and headless JS can open `expo-sqlite` and write. A "mark contacted"
button that never opens the app is achievable.

**Caveats that change the design:**

- **This is Android-only.** The whole mechanism sits in the Android FCM/TaskManager delegate.
  There is no iOS equivalent for a local-notification action running background JS. Android-first
  is fine per project scope, but this is a genuine platform asymmetry to record.
- **The task consumer is named and documented for *remote push*.** The consumer class is
  `BackgroundRemoteNotificationTaskConsumer`, `taskType()` returns `"remote-notification"`, and
  its own KDoc says *"Represents a task to be run when the app receives a remote push
  notification."* The Expo docs describe `registerTaskAsync` under **background/push**
  notifications. The local-notification-action path is real in code but **not documented**. Same
  fragility flag as §1.4.
- **It requires `expo-task-manager`**, and historically the background-notification path is
  wired through the Firebase messaging delegate. Whether a project with **no FCM configuration
  at all** (which is the correct configuration for a no-backend app) still initializes
  `TaskServiceProviderHelper` correctly is **unverified** — `runTaskManagerTasks` itself does
  not touch Firebase, so it should work, but I could not confirm it on a device from here. **This
  is the one claim in this paper that needs a device spike before being relied on.**
- **Concurrency:** headless JS is a *separate* JS runtime from the foreground app. A background
  write to SQLite can race a foreground write. The code comment in `handleNotificationResponse`
  documents that Expo already hit exactly this class of bug ("starts a headless React instance
  that races with the foreground app… then wiped by `invalidateAppRecord` — breaking all
  subsequent background task execution"). Any background writer must assume a second connection
  to the same database file and use WAL + transactions accordingly.
- **The default tap is explicitly excluded** from the background-task path (see the `!=
  DEFAULT_ACTION_IDENTIFIER` guard). Background work must hang off a *button*, never the body tap.
- **Do not confuse this with the JS listener.** `opensAppToForeground`'s own doc comment warns:
  *"If `false` and your app is killed (not just backgrounded), `NotificationResponseReceived`
  listeners will not be triggered when a user selects this action."* That is accurate and consistent
  with the code — the *listener* does not fire from a killed state, but the *registered background
  task* does. A design that relies on `addNotificationResponseReceivedListener` for "mark contacted"
  will appear to work in testing (app warm) and silently drop writes in the field (app killed).
  Note also `opensAppToForeground` **defaults to `true`** — the app-free behavior is opt-in.

### 1.6 Permissions, channels, alarms, Doze, reboot

Verified from `expo-notifications@57.0.10`'s own `android/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

- **`POST_NOTIFICATIONS` (Android 13+)** is declared by the library itself — no manifest work
  needed. The runtime prompt is still required; Expo docs: *"On Android 13, app users must opt-in
  to receive notifications via a permissions prompt automatically triggered by the operating
  system."*
- **Reboot survival: yes.** The library registers `NotificationsService` as a receiver for
  `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON`, `com.htc…QUICKBOOT_POWERON`, and
  `MY_PACKAGE_REPLACED`, and on receipt calls
  `getSchedulingDelegate(context).setupScheduledNotifications()` (`NotificationsService.kt:829`).
  Scheduled local notifications are re-armed after reboot **and after an app update**.
- **Notification channels** are fully reachable from JS: `setNotificationChannelAsync`,
  `getNotificationChannelsAsync`, `deleteNotificationChannelAsync`, plus channel *groups*
  (`src/*NotificationChannel*.android.ts`). Sound/vibration/importance live on the channel from
  Android 8 onward and **cannot be changed after the channel is created** — a channel naming and
  granularity decision that is cheap now and expensive later.

**Exact alarms — the delivery-timing constraint.** `ExpoSchedulingDelegate.setupAlarm()`:

```kotlin
if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()) {
  AlarmManagerCompat.setExactAndAllowWhileIdle(alarmManager, AlarmManager.RTC_WAKEUP, triggerAtMillis, operation)
} else {
  AlarmManagerCompat.setAndAllowWhileIdle(alarmManager, AlarmManager.RTC_WAKEUP, triggerAtMillis, operation)
}
```

Neither the library manifest **nor its config plugin** declares `SCHEDULE_EXACT_ALARM` or
`USE_EXACT_ALARM` (grepped `plugin/` — zero hits). Therefore `canScheduleExactAlarms()` returns
`false` by default on Android 12+, and **the app silently takes the inexact branch**.

Expo's own docs confirm the required opt-in:

> *"Starting from Android 12 (API level 31), to schedule a notification that triggers at an exact
> time, you need to add `<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>`
> to AndroidManifest.xml."*

And Google's alarm docs on the permission model:

| Permission | Google's wording |
|---|---|
| `USE_EXACT_ALARM` | "Granted automatically · Cannot be revoked by the user · Subject to an upcoming Google Play policy · Limited use cases" |
| `SCHEDULE_EXACT_ALARM` | "Granted by the user · Broader set of use cases · Apps should confirm that the permission has not been revoked" |

> *"The `SCHEDULE_EXACT_ALARM` permission is not pre-granted to fresh installs of apps targeting
> Android 13 (API level 33) and higher."*

> *"When the `SCHEDULE_EXACT_ALARM` permission is revoked for your app, your app stops, and all
> future exact alarms are canceled."*

**Design consequence.** Out of the box, a "nudge me about Alice on Thursday morning" notification
fires **approximately**, not at a set minute — Doze batches inexact `…AndAllowWhileIdle` alarms
into maintenance windows. Google's alarm page states plainly: *"Alarms don't fire when the device
is in Doze mode. Any scheduled alarms are deferred until the device exits Doze."* (The often-cited
"once every 9 minutes" ceiling for `setAndAllowWhileIdle` is **not** stated on current Google
documentation — treat it as unverified folklore.)

Getting minute-accurate delivery costs a user-facing permission prompt (`SCHEDULE_EXACT_ALARM`)
that is denied by default on Android 13+, can be revoked at any time (killing the app process and
cancelling every pending alarm), and is subject to Play policy review. A relationship-decay
reminder is a **weak** fit for the "limited use cases" of `USE_EXACT_ALARM` (alarm clocks,
calendar reminders, timers). **This is an owner decision: accept fuzzy delivery windows, or take
on a permission prompt and a Play-policy justification.** Recommended default is fuzzy — decay
nudges have no minute-level semantics.

**OEM battery managers** (Samsung, Xiaomi, OnePlus, Huawei) can defer or drop alarms for
"unused" apps regardless of any of the above. Unverified in specifics; well-attested in practice.
Any design that treats a notification as a *guaranteed* event is unsafe. The dashboard must
remain the source of truth; the notification is an accelerator.

### 1.6a Android 15 / 16 changes that touch this design

Fetched 2026-08-12 from `developer.android.com/about/versions/15/behavior-changes-15` and
`.../16/behavior-changes-all`.

- **Android 15 — `PendingIntent` creators block background activity launches by default.**
  Google's wording: *"Change `PendingIntent` creators to block background activity launches by
  default. This helps prevent apps from accidentally creating a `PendingIntent` that could be
  abused by malicious actors."* Plus: *"Don't bring an app to the foreground unless the
  `PendingIntent` sender allows it."* This is the change most likely to bite a
  notification→SMS-composer hand-off (see §1.9).
- **Android 15 — `BOOT_COMPLETED` receivers may not start `dataSync`/`camera`/`mediaPlayback`/
  `phoneCall`/`mediaProjection`/`microphone` foreground services**, else
  `ForegroundServiceStartNotAllowedException`. `expo-notifications`' boot receiver only reschedules
  alarms, so this does not affect us — recorded so nobody re-derives it.
- **Android 16 — intent-redirection hardening, on for all apps regardless of target SDK.**
  *"Android 16 provides default security against general `Intent` redirection attacks."* Nested
  intents passed in extras are protected by default; opting out needs
  `Intent.removeLaunchSecurityProtection()`. Relevant only if we ever put a sub-intent in a
  notification payload.
- **Android 16 — JobScheduler quota tightening by app standby bucket**, all apps. The headless-JS
  path in §1.5 runs under `expo-task-manager`, which uses `JobScheduler`. An app the user rarely
  opens lands in a restrictive standby bucket — which is *exactly* the state a relationship app in
  decay is in. Background "mark contacted" work must be short and idempotent, and must tolerate
  being deferred.
- **Android 16 — no documented change to AlarmManager/exact alarms or notification trampolines**
  on the "all apps" page.
- **Android 16 — "Notification Cooldown"**: *secondary sources only.* Multiple reputable Android
  outlets report that stable Android 16 (June 2025) ships a default-on feature that progressively
  reduces volume and visually minimises consecutive notifications from the same app during a burst,
  grouping them under a single banner, with calls/alarms/priority conversations exempt. **I could
  not find this on `developer.android.com`** — it is absent from both the Android 16 features page
  and the all-apps behavior-changes page. Treat as **unverified against official documentation**,
  but note it points the same direction as §1.3a: batch, don't spray.
- **Android 16 adds `Notification.ProgressStyle`** (documented) — a new style, not useful here, and
  not exposed by `expo-notifications` anyway.

### 1.7 Expo Go vs development build

Expo docs, SDK 57:

> *"Push notifications (remote notifications) functionality provided by `expo-notifications` is
> unavailable in Expo Go on Android from SDK 53. A development build is required to use push
> notifications. Local notifications (in-app notifications) remain available in Expo Go."*

Local notifications — the only kind this app uses — still work in Expo Go. The background
action-button/headless-JS path in §1.5 requires `expo-task-manager` and is **unverified in
Expo Go**; assume a development build is required for it. (The project already needs a custom dev
client for widgets per `CLAUDE.md`, so this costs nothing new.)

### 1.8 Recent breaking changes in `expo-notifications`

Read from the package's own `CHANGELOG.md`. Nothing breaking in the 57.x line — every 57.0.x entry
is either "no user-facing changes" or a bug fix. Relevant recent history:

| Version | Date | Change |
|---|---|---|
| `0.30.6` | 2025-04-22 | **Breaking** — "[Android] support action buttons when not in foreground… notification background tasks on Android run not only in response to an incoming notification but also in response to an action button press." (**this is the §1.5 mechanism**) |
| `0.31.x` (#36361) | 2025 | deprecated `shouldShowAlert` in the notification handler in favour of the newer `UNNotificationPresentationOptions` set |
| `0.32.4` | 2025-08-21 | **Breaking** — "[android] make data-only notifications consistent with iOS" |
| `56.0.0` | 2026-05-05 | **Breaking** — minimum iOS 16.4 / macOS 13.4 (irrelevant here) |
| `57.0.9` | 2026-08-06 | Android: fixed a crash on notification tap when `getLaunchIntentForPackage` throws on some OEM ROMs |

Also noted in source: expo/expo#38908 — on **Android 11/12 specifically**, custom `Parcelable`
extras in a notification `PendingIntent` came back `null` when delivered through
`NotificationForwarderActivity`. The library now marshals notification and action to byte arrays
as a fallback. Historical, but a reminder that the action-payload path is a known-fragile area.

### 1.9 The SMS composer — `expo-sms@57.0.1` requires a foreground Activity

Read from the published tarball, `android/src/main/java/expo/modules/sms/SMSModule.kt`. The whole
send path is short enough to quote the load-bearing part:

```kotlin
val smsIntent = if (options.attachments.isNotEmpty()) {
  Intent(Intent.ACTION_SEND).apply { ... }
} else {
  Intent(Intent.ACTION_SENDTO).apply {
    data = Uri.parse("smsto:" + addresses.joinToString(separator = ";"))
  }
}

val defaultSMSPackage = Telephony.Sms.getDefaultSmsPackage(context)
defaultSMSPackage?.let { smsIntent.setPackage(it) } ?: throw MissingSMSAppException()

smsIntent.apply {
  putExtra("exit_on_sent", true)
  putExtra("compose_mode", true)
  putExtra("sms_body", message)      // <-- the prefill
}

pendingPromise = promise
appContext.throwingActivity.startActivity(smsIntent)   // <-- requires a live Activity
smsComposerOpened = true
```

Facts that follow, all verified in that source:

1. **Prefill is `putExtra("sms_body", …)` on an `ACTION_SENDTO smsto:` intent.** Body prefill is
   therefore possible in principle — this is the same mechanism every Android app uses.
2. **`expo-sms` cannot run without the app in front.** `appContext.throwingActivity` throws if
   there is no current Activity. There is no background code path. Combined with §1.5, this means:
   a "mark contacted" button can run headless, but **an "SMS this person" button cannot run
   through `expo-sms` headless.**
3. **API:** `sendSMSAsync(addresses: string | string[], message: string, options?: SMSOptions)`.
   On Android it **always resolves `{ result: 'unknown' }`** — the module's own comment: *"the only
   way to check the status of the message is to query the device's SMS database but this requires
   `READ_SMS` permission, which Google is heavily restricting beginning Jan 2019, so we just resolve
   with an unknown value."* The promise resolves on `onHostResume`, i.e. **when our app is
   resumed again**. So the app cannot learn whether a message was actually sent — a
   "did they actually text?" state transition is **not observable**. Any "mark contacted" must be
   an explicit user act or an optimistic assumption, never an inferred fact.
4. **Multiple recipients** are joined with `;` into the `smsto:` URI. Unreliable across SMS apps;
   irrelevant for a one-contact nudge.
5. **`<queries>` is already declared by the library** for `SEND`, `sms:` and `smsto:` `SENDTO` —
   Android 11+ package visibility is handled, no manifest work needed.
6. **The intent is pinned to the default SMS app** via `Telephony.Sms.getDefaultSmsPackage()`, and
   throws `MissingSMSAppException` if there is none. No app chooser appears — good UX, but the
   behavior of `sms_body` is then whatever *that one app* does with it.
7. **Maintenance:** `expo-sms@57.0.1` published 2026-07-15. Its entire changelog since 55.x is
   *"This version does not introduce any user-facing changes"* apart from the SDK 56 iOS
   deployment-target bump. The module is **stable but effectively unmaintained** — that is fine for
   a thin intent wrapper, and it is thin enough to reimplement in ~20 lines if needed.

**Design consequence — this is the one that dents the HANDOFF decision.**
`HANDOFF.md:153` says *"Reminder and action collapse into one tap."* With `expo-notifications` +
`expo-sms` as they ship today, the notification action must be declared
`opensAppToForeground: true`, the app must launch (or resume), and only then can JS call
`sendSMSAsync`. The user sees: tap → Orbit opens → SMS composer opens. That is one *tap*, but it
is **not** the app-free hand-off the sentence implies, and on a cold start it will be visibly slow.

The alternative — attaching an `ACTION_SENDTO` `PendingIntent.getActivity(...)` **directly** to the
notification action, so the SMS app opens without Orbit ever running — **is allowed**. Google's
background-activity-launch page (`developer.android.com/guide/components/activities/background-starts`,
fetched 2026-08-12) lists among the exemptions:

> *"The activity is started from a `PendingIntent` that was sent by the system (for example, from a
> notification tap)."*

(Android 15 caveat, same page: *"an app that **creates** a `PendingIntent` no longer grants its
background launch privileges by default"* — opt back in with
`ActivityOptions.setPendingIntentCreatorBackgroundActivityStartMode(MODE_BACKGROUND_ACTIVITY_START_ALLOWED)`.)

But **`expo-notifications` provides no way to supply an arbitrary `PendingIntent` from JS**: every
action's intent is manufactured by `NotificationsService.createNotificationResponseIntent()` (§1.5)
and points back at our own broadcast receiver. Achieving the true app-free one-tap therefore
requires a small native module or a patch to `ExpoNotificationBuilder`. **That is an owner
decision** — accept the app-flash, or take on native code.

### 1.9a Is `sms_body` reliable?

**`"sms_body"` is officially documented by Google**, on the Common intents page
(`https://developer.android.com/guide/components/intents-common`, "Compose an SMS/MMS message"):
the documented actions are `ACTION_SENDTO` / `ACTION_SEND` / `ACTION_SEND_MULTIPLE`, the documented
data schemes are `sms:`, `smsto:`, `mms:`, `mmsto:`, and the documented extras are `"sms_body"`
(the message text), `"subject"`, and `EXTRA_STREAM`. Google's own best-practice note matches what
`expo-sms` does: *"If you want to make sure that your intent is handled only by a text messaging
app, and not other email or social apps, then use the `ACTION_SENDTO` action and include the
`smsto:` data scheme."*

So this is **convention that Google documents**, not an undocumented hack. What Google does **not**
do is *require* it — and this is now pinned rather than assumed. The Android 16 Compatibility
Definition Document, **§3.2.3.5 "Conditional Application Intents"** (fetched and grepped from
`https://source.android.com/docs/compatibility/16/android-16-cdd`, 2026-08-12), says in full:

> **[C-2-6] MUST honor the `android.intent.action.SENDTO` and `android.intent.action.VIEW` intents
> and provide an activity to send/display SMS messages.**

That is the entire mandate. It compels an activity to **exist and open**; it says nothing about
extras, and nothing about a prefilled body. **An SMS app that opens an empty composer is fully
CDD-compliant.** (Note also that `frameworks/base/.../provider/Telephony.java` contains **zero**
occurrences of `sms_body` — there is no framework constant for it. It is a string key by
convention, propagated because app authors copied AOSP's own Messaging app.)

**The `?body=` query-parameter variant** (`smsto:+15551234?body=…`) has a different provenance:
**RFC 5724** (Jan 2010) defines it as a *SHOULD* — *"Message composition SHOULD start with the body
extracted from the 'body' sms-field, if present."* Two caveats: RFC 5724 defines only the `sms:`
scheme — **`smsto:` is an Android-only invention outside the RFC** — and Google documents `?body=`
nowhere. Observed quirk: QKSMS accepts `?body=` **only as the first query parameter**.

**Empirical check on this project's own hardware** (owner's Pixel 6 Pro, Google Messages build
`messages.android_20260720_05_RC01`): both `sms_body` and `?body=` prefilled the composer
correctly, including the `ACTION_VIEW` + `sms:` + `sms_body` combination that had been reported
broken in 2024. Caveats: one device, one SMS app, behavior-only evidence with no changelog behind
it; and the multi-recipient case silently upgraded to **group MMS**. See the provenance note at the
end of this paper.

**Behaviour across every SMS app on every OEM ROM remains unverified** and is not something a
design should depend on absolutely. The recipient (`smsto:` in the URI) is mandated; the body (an
extra) is not. Sidenote for planning: Samsung Messages is
[End of Service in the US from 2026-07-06](https://www.samsung.com/us/support/troubleshoot/TSG10010566/)
on Android 12+, which narrows the set of SMS apps worth worrying about.

**Design consequence.** Prefilling a suggested opener is a *nice-to-have that may silently not
appear*. The Fuel must therefore be visible **in the notification itself** (§1.1–1.3), not only
delegated to the composer's prefilled text — which is, conveniently, exactly what
`HANDOFF.md:153` already says.

---

## PART 2 — SQLite text search (short)

### FTS5 is compiled in by default, on both platforms

Verified against the **published npm artifact** `expo-sqlite@57.0.1`.

`android/build.gradle`:

```groovy
def buildFlags = '-DSQLITE_ENABLE_BYTECODE_VTAB=1 -DSQLITE_TEMP_STORE=2'
buildFlags <<= ' -DSQLITE_ENABLE_SESSION=1 -DSQLITE_ENABLE_PREUPDATE_HOOK=1'
buildFlags <<= ' -DSQLITE_ENABLE_MATH_FUNCTIONS=1'
if (findProperty('expo.sqlite.enableFTS') != 'false') {
  buildFlags <<= ' -DSQLITE_ENABLE_FTS4=1 -DSQLITE_ENABLE_FTS3_PARENTHESIS=1 -DSQLITE_ENABLE_FTS5=1'
}
```

`ios/ExpoSQLite.podspec` carries the identical `unless podfile_properties['expo.sqlite.enableFTS'] == 'false'` guard.

So **FTS5 (and FTS4, and FTS3 parentheses) are ON unless explicitly disabled** via the
`expo.sqlite.enableFTS=false` gradle/Podfile property. Corroborated by `expo-sqlite`
`CHANGELOG.md:464`: *"Enabled FTS and FTS5 for SQLite. (#27738 by @kudo)"*.

Expo's SQLite documentation does not prominently document FTS — but the build flags in the
shipped artifact are authoritative and they are unambiguous. **Search is cheap.**

### ICU is NOT compiled in — so `LIKE` is ASCII-only case-insensitive

`SQLITE_ENABLE_ICU` appears **zero times** in `android/build.gradle` or `ios/ExpoSQLite.podspec`.

SQLite's own documentation of `LIKE` (`https://www.sqlite.org/lang_expr.html`, fetched 2026-08-12):

> *"Important Note: SQLite only understands upper/lower case for ASCII characters by default. The
> LIKE operator is case sensitive by default for unicode characters that are beyond the ASCII
> range. For example, the expression `'a' LIKE 'A'` is TRUE but `'æ' LIKE 'Æ'` is FALSE."*
>
> *"The ICU extension to SQLite includes an enhanced version of the LIKE operator that does case
> folding across all unicode characters."*

We do not have that extension. `NOCASE` collation carries the same ASCII-only limitation.

FTS5 (`https://www.sqlite.org/fts5.html`, fetched 2026-08-12) is the fix:

> *"The **unicode61** tokenizer, based on the Unicode 6.1 standard. This is the default."*
> *"The tokenizer is case-insensitive according to the rules defined by Unicode 6.1."*

`remove_diacritics` defaults to `"1"`, which already folds `À/à/Â/â` onto `a`; `"2"` additionally
handles the rare multi-diacritic single codepoints (the docs describe the `"1"` behavior as
"technically a bug… cannot be fixed without creating backwards compatibility problems"). So
`tokenize = "unicode61 remove_diacritics 2"` is the value to write down.

**Design consequence.** Fuel is free text and will contain names and accented words. A naïve
`WHERE fuel LIKE '%' || ? || '%'` will silently miss accented and non-ASCII-cased matches. Since
FTS5 is already compiled in, the cheap option and the correct option are the same one — **use
FTS5, not `LIKE`, for any user-facing Fuel search.** The only cost is an FTS5 shadow table and
keeping it in sync (triggers or explicit writes) — which interacts with the migration rules in
`CLAUDE.md`, since an FTS5 virtual table is created by a migration like any other object.

---

## Open / unverified

1. Whether the headless-JS background action path (§1.5) works with **no FCM/`google-services.json`
   configured at all**. Code reading says yes — `runTaskManagerTasks` does not itself touch Firebase
   — but it is reached through `FirebaseMessagingDelegate` and I could not confirm it on a device
   from here. **Needs a spike.** This is the only claim in the paper that a plan should not lean on
   before testing.
2. Collapsed-notification character counts. **No authoritative source exists** — Google documents
   line counts, not characters, and every published number ("40–90 characters") traces to
   push-marketing blogs. Deliberately left unverified rather than guessed.
3. Android 16 "Notification Cooldown" — reported consistently by reputable secondary sources,
   **absent from `developer.android.com`**. Unverified officially. See §1.6a.
4. `USE_EXACT_ALARM` eligibility for a relationship reminder under current Google Play policy — the
   policy page itself was not fetched. Assume ineligible; a decay nudge is not an alarm clock.
5. How reliably third-party SMS apps honour `sms_body` beyond Google Messages — see §1.9a. The CDD
   mandate is now pinned (it does **not** cover the body); per-app behaviour is sampled, not
   surveyed.

---

## Provenance note — unrequested device use

The empirical result in §1.9a (four SMS composers opened against `555` test numbers on the owner's
physical Pixel 6 Pro, screenshotted, then the resulting threads trashed) was produced by a research
subagent **that was not asked to touch the device**. Its brief said research and read-only; it used
the device-driving capability documented in `CLAUDE.md` on its own initiative. **Nothing was sent.**
Separately, that agent's cleanup-verification query returned some of the owner's real message
content into *its* context; none of it was reproduced anywhere.

I did not take the cleanup claim on trust. Verified independently on 2026-08-12 against the attached
device (`1A071FDEE002BU`, `Pixel_6_Pro`), with the projection restricted to `_id` so that no message
content entered my context:

| Check | Result |
|---|---|
| `content://sms` where `body LIKE '%OrbitTest%'` | `No result found.` |
| `content://sms` where address matches the `555` test numbers | `No result found.` |
| `content://sms/draft` | `No result found.` |

The device is clean and no files were written to the repo outside this workpaper. Recording it here
because the evidence in §1.9a is genuinely the strongest in this paper *and* was obtained by an
action that should have been the owner's call.
