# Platform verification — can a widget tap and a notification action write to SQLite without foregrounding the app?

Verifier: platform verification agent. Verification date: **2026-08-12**.

Subject: dossier 04-log. The decided constraint from 01-data is that *every* touchpoint from
*every* route inserts a row into `interactions`, and exactly one DAO function recomputes
`contacts.last_contact` as `MAX(...)` over interaction rows in the same transaction. Two of those
routes are outside the app's UI: an Android home-screen widget tile
(`react-native-android-widget`) and an actionable local notification (`expo-notifications`).

The question this paper answers: **can either route actually perform that write without bringing
the Activity to the foreground, and in what JS execution context?**

The precedent for asking is `expo-sms`: a prior verification found `SMSModule.kt:76` calls
`appContext.throwingActivity.startActivity(...)`, so it *cannot* run headless, which reshaped the
whole SMS hand-off design (03-fuel §1.9, F8). The same class of constraint here would reshape the
interaction-log design.

**Everything below marked VERIFIED was read from the published npm tarball of the named version,
extracted locally, or from AOSP / official documentation fetched today.** Nothing here is quoted
from another agent's summary. Where I am reasoning rather than reading, it says INFERRED.

---

## The answer, up front

| Route | Can it write to SQLite with the app never foregrounded? | Execution context |
|---|---|---|
| **Widget tile tap** | **YES — verified in source.** | App's own JS runtime, started headlessly via WorkManager → `HeadlessJsTask`. Hard **30 s** budget. |
| **Notification action button** | **YES — verified in source, and now documented.** Requires `opensAppToForeground: false` + a task registered with `Notifications.registerTaskAsync`. | App's own JS runtime, started headlessly via `expo-task-manager`. **No timeout.** |

And the finding that most changes the concurrency design:

> **Both headless contexts are the *same* JS runtime as the foreground app, in the same process,
> and therefore the *same* `expo-sqlite` connection object.** There is no second connection and no
> cross-process locking to defend against — in the ordinary case. The hazard is interleaving on one
> connection, not contention between two.

---

## 0. Version / source table

| Thing | Version verified | How |
|---|---|---|
| `react-native-android-widget` | **`0.22.0`** (latest, modified 2026-08-08) | `npm view react-native-android-widget version` |
| `expo` | `57.0.12` | `npm view expo version` |
| `expo-notifications` | **`57.0.10`**, pinned `~57.0.10` | `expo@57.0.12` → `package/bundledNativeModules.json` |
| `expo-task-manager` | **`57.0.9`**, pinned `~57.0.9` | same |
| `expo-sqlite` | **`57.0.1`**, pinned `~57.0.1` | same |
| `expo-modules-core` | **`57.0.9`** | `npm pack` |
| `react-native` | **`0.86.2`** pinned by `expo@57.0.12` (npm `latest` is 0.87.0) | `bundledNativeModules.json` |
| AOSP `Notification.java` | `android16-release` | `raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android16-release/core/java/android/app/Notification.java` |
| RN `ReactHostImpl.kt` | tag `v0.86.2` | `raw.githubusercontent.com/facebook/react-native/v0.86.2/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactHostImpl.kt` |
| Widget library docs | fetched 2026-08-12 | `https://saleksovski.github.io/react-native-android-widget/docs/handling-clicks`, `.../docs/update-widget` |
| Expo notifications docs | SDK 57, fetched 2026-08-12 | `https://docs.expo.dev/versions/latest/sdk/notifications/` |
| Expo SQLite docs | SDK 57, fetched 2026-08-12 | `https://docs.expo.dev/versions/latest/sdk/sqlite/` |
| Android app widgets — update frequency | fetched 2026-08-12 | `https://developer.android.com/develop/ui/views/appwidgets/advanced` |
| Android 15 behavior changes (all apps) | fetched 2026-08-12 | `https://developer.android.com/about/versions/15/behavior-changes-all` |
| Android broadcasts overview | fetched 2026-08-12 | `https://developer.android.com/develop/background-work/background-tasks/broadcasts` |
| WorkManager expedited work | fetched 2026-08-12 | `https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work` |

Tarballs extracted to
`/tmp/claude-1000/-home-bwales-projects-orbit-app/6fd0e3de-.../scratchpad/pkgs/<name>-<version>/package/`.
All file paths below are relative to that `package/` root.

---

## PART 1 — The widget tile tap

### 1.1 The click never touches an Activity — it is a broadcast

`android/src/main/java/com/reactnativeandroidwidget/RNWidget.java:203-215` — every clickable view in
the rendered `RemoteViews` gets:

```java
Intent intent = new Intent(appContext.getPackageName() + ".WIDGET_CLICK");
// ... widgetId, clickAction, clickActionData extras ...
PendingIntent pendingIntent = PendingIntent.getBroadcast(
    ...,
    PendingIntent.FLAG_CANCEL_CURRENT
        | PendingIntent.FLAG_MUTABLE
);
widgetView.setOnClickPendingIntent(button, pendingIntent);
```

**`PendingIntent.getBroadcast`, not `getActivity`.** VERIFIED. There is no Activity in the path.

The receiver is the generated `AppWidgetProvider` subclass. `app.plugin.js:95-130` writes into the
merged manifest:

```
<receiver android:name=".widget.<Name>" android:exported="false" android:label="...">
  <intent-filter>
    <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    <action android:name="<app.package>.WIDGET_CLICK" />
  </intent-filter>
  <meta-data android:name="android.appwidget.provider"
             android:resource="@xml/widgetprovider_<name>" />
</receiver>
```

and `app.plugin.js:186-192` generates the class itself as a bare `extends RNWidgetProvider`.
No `android:process` attribute is set — **the receiver runs in the app's main process.** VERIFIED.

### 1.2 What the receiver does with the click

`RNWidgetProvider.java:44-63`:

```java
switch (incomingIntent.getStringExtra("clickAction")) {
    case "OPEN_APP":  openApp(context); break;      // startActivity(launchIntent)
    case "OPEN_URI":  openUri(context, ...); break; // startActivity(ACTION_VIEW)
    default:          handleWidgetClick(context, incomingIntent, widgetId);
}
```

Only the two reserved strings launch an Activity (`:123-140`). **Any other `clickAction` string
goes to `handleWidgetClick`, which never starts an Activity.** VERIFIED.

`RNWidgetProvider.java:142-155` packs `clickAction` and `clickActionData` (the latter JSON-stringified)
into a WorkManager `Data` and calls `RNWidgetJsCommunication.startBackgroundTask`.

The library's own documentation agrees, and is worth quoting because it is the inverse of what a
reader expects: *"Two special `clickAction` values execute directly without emitting to your
handler"* — i.e. **`OPEN_APP` is the special case; a custom action is the default and stays
headless.** (`docs/handling-clicks`, fetched 2026-08-12.) The same page notes **`clickAction` only
works on Android 7 and up** — irrelevant for this project's floor but recorded.

### 1.3 The JS context: WorkManager → HeadlessJsTask on the app's own ReactHost

`RNWidgetJsCommunication.java:24-40`:

```java
OneTimeWorkRequest.Builder builder =
    new OneTimeWorkRequest.Builder(RNWidgetBackgroundTaskWorker.class).setInputData(data);
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST);
}
WorkManager.getInstance(context).enqueue(builder.build());
```

`android/build.gradle:104` pulls `androidx.work:work-runtime:2.8.1`.

`RNWidgetBackgroundTaskWorker.java:31-36`:

```java
return new HeadlessJsTaskConfig(
    "RNWidgetBackgroundTask",
    Arguments.makeNativeMap(arguments),
    30 * 1000,   // <-- timeout, hardcoded
    true         // <-- allowedInForeground
);
```

**A widget tap gets a hardcoded 30-second JS budget.** VERIFIED, `RNWidgetBackgroundTaskWorker.java:34`.
It is not configurable from JS or from the config plugin (grepped; the literal appears once).

`oss/HeadlessJsTaskWorker.java:73-94` and `:128-130`:

```java
private ReactHost getReactHost() {
    return ((ReactApplication) this.getApplicationContext()).getReactHost();
}

protected void startTask(final HeadlessJsTaskConfig taskConfig) {
    ReactHost reactHost = this.getReactHost();
    ReactContext reactContext = reactHost.getCurrentReactContext();
    if (reactContext == null) {
        reactHost.addReactInstanceEventListener(... invokeStartTask ...);
        reactHost.start();
    } else {
        this.invokeStartTask(reactContext, taskConfig);
    }
}
```

**This is the app's own `ReactHost`, obtained from the `ReactApplication`.** If the app is already
running, the existing `ReactContext` is reused verbatim. If not, `reactHost.start()` boots the JS
runtime with no Activity attached. VERIFIED.

The JS side: `src/api/register-widget-task-handler.tsx:7` and `:99`:

```ts
const HEADLESS_TASK_KEY = 'RNWidgetBackgroundTask';
AppRegistry.registerHeadlessTask(HEADLESS_TASK_KEY, () => taskProvider);
```

and `:88-96` awaits the app's handler, passing `{ widgetInfo, widgetAction, clickAction,
clickActionData, renderWidget }`. `widgetAction` is `'WIDGET_CLICK'` for a tap
(`RNWidgetProvider.java:153`).

**So: the handler is an `async` function in the app's JS bundle, and the native side waits for its
promise.** A `db.withTransactionAsync(...)` inside it is fully supported. There is no restriction on
what modules the handler may touch.

### 1.4 Does it work when the app is swiped away or has never been launched since boot?

- **Swiped from Recents / process killed:** YES. INFERRED-with-documentation. The receiver is
  manifest-declared, and Android's broadcast documentation states: *"If you declare a broadcast
  receiver in your manifest, the system launches your app when the broadcast is sent. If the app is
  not already running, the system launches the app."*
  (`developer.android.com/develop/background-work/background-tasks/broadcasts`, fetched 2026-08-12.)
  `HeadlessJsTaskWorker` then finds `getCurrentReactContext() == null` and calls `reactHost.start()`.
  This path exists precisely for that case.

- **Force-stopped by the user (Settings → Force stop):** **NO — and worse, the widget visibly dies.**
  VERIFIED against Android 15 behavior changes (fetched 2026-08-12):

  > *"Apps use pending intents to update app widgets. If an app enters the stopped state, all these
  > pending intents are canceled, and the system disables the app's widgets. (The widgets are grayed
  > out, and the device user cannot interact with them.) The system re-enables the widgets the next
  > time the user launches the app."*

  This is **not** the same as swiping from Recents. It is force-stop, and on Android 15+ it is
  terminal for the widget until the user opens the app. **Design consequence:** the widget can never
  be the *only* route to the log, and a "your widget is asleep" state is a real user-visible
  condition the app should be able to explain.

- **Never launched since install:** the same `FLAG_STOPPED` machinery applies. Google's wording is
  that an app leaves the stopped state through *"direct or indirect user action... (through the
  sharesheet or a **widget**, selecting the app as live wallpaper, etc.)"*. INFERRED: placing the
  widget is itself the qualifying interaction, so the tile is live from the moment it is placed. Not
  device-tested.

### 1.5 Doze and quota

- The work is enqueued **expedited** on Android 12+ with `RUN_AS_NON_EXPEDITED_WORK_REQUEST` fallback
  (`RNWidgetJsCommunication.java:33-35`). Google: *"Power management restrictions, such as Battery
  Saver and Doze, are less likely to affect expedited work"*, and *"While your app is in the
  foreground, quotas won't limit the execution of expedited work. An execution time quota applies
  only when your app is in the background."* The quota *"is based on the standby bucket and process
  importance."* (WorkManager docs, fetched 2026-08-12.)
- **Design consequence.** A relationship app the user opens rarely lands in a restrictive standby
  bucket — which is exactly the state a decay-nudge app is in. On quota exhaustion the tap's work
  request silently degrades to ordinary deferrable work. The write still happens, but **not
  necessarily promptly**, and possibly not until the device leaves Doze. The widget must therefore
  give optimistic UI feedback and must never be treated as synchronous.
- No foreground service is required or used. VERIFIED (grepped: `setForeground` appears nowhere in
  the library's Android source).

### 1.6 The widget *update* mechanism

Three ways in, all VERIFIED in source:

| Mechanism | Where | Constraint |
|---|---|---|
| `updatePeriodMillis` in the config plugin | `app.plugin.js:211-212` | `Math.max(30 * 60 * 1000, widget.updatePeriodMillis)` — **the plugin itself clamps to a 30-minute floor**; default `0` = no periodic updates. `src/config-plugin.type.ts:34-41` documents both. |
| `requestWidgetUpdate({ widgetName, renderWidget })` from JS | `src/api/request-widget-update.tsx` | Needs a live JS context — which the headless task *is*. Inside the click handler you normally just call the supplied `renderWidget()` instead. |
| `RNWidgetJsCommunication.requestWidgetUpdate(context, widgetName)` from **native** | `RNWidgetJsCommunication.java:15-22` (`public static`) | The only way to push an update with no JS running — callable from a `BroadcastReceiver`, `AlarmManager`, etc. It enqueues the same headless task with `widgetAction = 'WIDGET_UPDATE'`. |

The 30-minute floor is the platform's, not the library's: *"`updatePeriodMillis` doesn't support
values of less than 30 minutes"*, and for anything more frequent Google says *"set the
`updatePeriodMillis` to 0 and use `WorkManager` instead"*
(`developer.android.com/develop/ui/views/appwidgets/advanced`, fetched 2026-08-12).

The library's own docs add the caveat that `requestWidgetUpdate` *"requires the app to be open — it
cannot update widgets when the application is closed"* (`docs/update-widget`, fetched 2026-08-12).
Read against the source, that is a statement about the *JS* entry point only; the static native
entry point exists for exactly this gap.

**Design consequence.** Orbit's widget content (who is decaying, who is due) can be refreshed
(a) at most every 30 min by the platform, (b) whenever the app is open, (c) on every widget tap as a
side effect of the click handler, and (d) from any native trigger the app already owns — notably the
`expo-notifications` alarm that fires a decay nudge. Option (d) is the one that makes a widget that
stays current without a 30-minute polling loop.

### 1.7 One robustness note

`RNWidgetProvider.java:53` switches on `incomingIntent.getStringExtra("clickAction")` with no null
check, after only filtering on the action prefix at `:47`. Any broadcast matching
`<package>.WIDGET*` that lacks the extra will NPE inside the receiver. Nothing in the library sends
such a broadcast, but the app must not either. Low severity; recorded because the receiver is
`exported="false"`, so only our own code can trigger it.

---

## PART 2 — The notification action button

The mechanism was previously mapped in `03-fuel/platform-notify-storage.md` §1.5. **I re-verified
every load-bearing line independently in `expo-notifications@57.0.10` rather than taking it on
trust. The core claim holds.** Two of that paper's caveats are now wrong and are corrected in §2.5.

### 2.1 `opensAppToForeground: false` produces a broadcast PendingIntent

`android/src/main/java/expo/modules/notifications/service/NotificationsService.kt:475-489`:

```kotlin
// Starting from Android 12, notification trampolines are not allowed. If the notification
// wants to open foreground app, we should use the dedicated Activity pendingIntent.
if (action.opensAppToForeground() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
  return ExpoHandlingDelegate.createPendingIntentForOpeningApp(context, intent)
}
val mutableFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
return PendingIntent.getBroadcast(
  context,
  intent.component?.className?.hashCode() ?: NotificationsService::class.java.hashCode(),
  intent,
  PendingIntent.FLAG_UPDATE_CURRENT or mutableFlag
)
```

VERIFIED. With `opensAppToForeground: false` the action is a **broadcast to
`NotificationsService`**, and the Activity is never started.

The flag reaches native intact: `ExpoNotificationCategoriesModule.kt:49-52` declares
`class Options : Record { @Field val opensAppToForeground = true }` — **it defaults to `true`, so
headless is opt-in** — and `:101` / `:110` pass it into `TextInputNotificationAction` /
`NotificationAction` respectively. VERIFIED.

### 2.2 The background task fires, and only for action buttons

`android/src/main/java/expo/modules/notifications/service/delegates/ExpoHandlingDelegate.kt:150-165`:

```kotlin
override fun handleNotificationResponse(notificationResponse: NotificationResponse) {
  if (notificationResponse.action.opensAppToForeground()) {
    openAppToForeground(context, notificationResponse)
  }

  // Run background tasks only for custom notification action buttons (not the default tap).
  // When the default notification tap launches the app from killed state, calling
  // runTaskManagerTasks starts a headless React instance that races with the foreground app. ...
  if (!isAppInForeground() && notificationResponse.actionIdentifier != NotificationResponse.DEFAULT_ACTION_IDENTIFIER) {
    FirebaseMessagingDelegate.runTaskManagerTasks(
      context.applicationContext,
      NotificationSerializer.toBundle(notificationResponse)
    )
  }
  // ...
}
```

VERIFIED, and three things follow:

1. **Background work must hang off a *button*.** The body tap (`DEFAULT_ACTION_IDENTIFIER`) is
   explicitly excluded.
2. **The app must not be foregrounded.** `isAppInForeground()` is
   `ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(RESUMED)` (`:114`). If Orbit happens
   to be open, the background task does *not* run and only the JS response listener fires. **A "mark
   contacted" implementation must handle both paths or it will double-write or no-write depending on
   app state.** This is the sharpest correctness trap in the whole route.
3. `ExpoHandlingDelegate.kt:167-177` — when the app is killed, the JS response *listeners* are not
   set up and the response is merely queued into `sPendingNotificationResponses` for later delivery.
   The `opensAppToForeground` JSDoc says the same. **`addNotificationResponseReceivedListener` is not
   a viable write path**; it works in warm-app testing and silently defers in the field.

### 2.3 No FCM is involved on this path

`FirebaseMessagingDelegate.kt:84-92`:

```kotlin
fun runTaskManagerTasks(applicationContext: Context, bundle: Bundle) {
  // getTaskServiceImpl() has a side effect:
  // the TaskService constructor calls restoreTasks which then constructs a
  // BackgroundRemoteNotificationTaskConsumer, and the getBackgroundTasks() call below
  // doesn't return an empty collection.
  TaskServiceProviderHelper.getTaskServiceImpl(applicationContext)
  getBackgroundTasks().forEach { it.executeTask(bundle) }
}
```

VERIFIED: the function body touches no Firebase type. It is a `companion object` member that merely
*lives* in a class whose other members handle FCM. `getBackgroundTasks()` returns the statically
registered `BackgroundRemoteNotificationTaskConsumer` set (`:66-82`), populated by that consumer's
`init { addBackgroundTaskConsumer(this) }` (`BackgroundRemoteNotificationTaskConsumer.kt:31-33`)
when `TaskService` restores persisted tasks.

The consumer's own `executeTask` (`:62-64`) is `task.execute(bundle, null)` →
`Task.java:57-59` → `mService.executeTask(this, data, error, callback)`.

**INFERRED (high confidence, still worth one device check):** a project with no
`google-services.json` and no FCM configuration reaches this code normally, because nothing on the
path constructs a Firebase object. The prior paper flagged this as its one unverified claim; reading
the code again, the concern is narrower than it looked — the only requirement is that
`TaskService`'s constructor successfully restore the persisted task, which is `SharedPreferences`
work. I could not run it on a device, so it stays INFERRED.

### 2.4 The execution context and its budget

`expo-task-manager@57.0.9`, `android/src/main/java/expo/modules/taskManager/TaskService.java:377-437`:

- `:411` `maybeStartHeadlessTask(appScopeKey)` on the first event.
- `:414-417` if the task manager already exists (app running), execute immediately.
- `:426-437` otherwise `getAppLoader().loadApp(...)` — the `"react-native-headless"` loader.

`:650-668`:

```java
HeadlessJsTaskConfig taskConfig = new HeadlessJsTaskConfig(
  "expo-task-manager",
  new WritableNativeMap(),
  0,    // no timeout, managed by the task consumer
  true  // allow in foreground to avoid exceptions if app returns
);
```

**No timeout on this path**, unlike the widget's 30 s. VERIFIED, `TaskService.java:655`. The task is
finished when JS signals completion: `notifyTaskFinished` (`:209-238`) removes the event, calls
`maybeFinishHeadlessTask`, then after a 2-second grace window `invalidateAppRecord`.

The loader, `expo-modules-core@57.0.9`
`android/src/main/java/expo/modules/adapters/react/apploader/RNHeadlessAppLoader.kt:33-48`:

```kotlin
val reactHost = (context.applicationContext as ReactApplication).reactHost
  ?: throw IllegalStateException("Your application does not have a valid reactHost")
reactHost.addReactInstanceEventListener(...)
android.os.Handler(context.mainLooper).post { reactHost.start() }
```

**Again the app's own `ReactHost`.** VERIFIED. Same conclusion as the widget path.

Crucially, `TaskService.java:426-437` does *not* go through `JobScheduler` for this call — it
executes the task directly or loads the app. The `JobScheduler` path exists for other consumers via
`didExecuteJob` (`BackgroundRemoteNotificationTaskConsumer.kt:46-60`), but a notification action
response does not use it.

### 2.5 Two corrections to `03-fuel/platform-notify-storage.md` §1.5

Both were reasonable readings of an older state of the world. Both are now wrong, and both matter.

1. **"The local-notification-action path is real in code but not documented."** — **No longer true.**
   `expo-notifications@57.0.10` `src/registerTaskAsync.ts:7` documents it explicitly:

   > *"Only on Android, the task also runs in response to a notification action tap when the app is
   > backgrounded or terminated."*

   The same sentence appears on the live SDK 57 docs page (fetched 2026-08-12). The "load-bearing
   behavior on an undocumented path" fragility flag can be **downgraded**. (The `categoryIdentifier`
   iOS-only annotation problem from §1.4 of that paper is unchanged — the docs page still lists it
   under iOS-only fields.)

2. **"The headless-JS path runs under `expo-task-manager`, which uses `JobScheduler`"** and therefore
   is subject to Android 16 standby-bucket job quotas. — **Not for this path.** See §2.4:
   `runTaskManagerTasks` → `executeTask` → direct execution / `loadApp`. No job is scheduled. The
   Android 16 JobScheduler quota tightening does **not** gate a notification action tap. (It *does*
   gate the widget path, which genuinely uses WorkManager — see §1.5.)

A third caveat from that paper, *"headless JS is a separate JS runtime from the foreground app,"* is
**wrong under the current architecture** and is the subject of Part 3.

### 2.6 Action-button specifics worth writing down

- **Three action buttons, platform maximum.** AOSP `Notification.java` (`android16-release`, fetched
  today): `public static final int MAX_ACTION_BUTTONS = 3;` at line 301, enforced at line 6587
  (`Math.min(nonContextualActions.size(), MAX_ACTION_BUTTONS)`). Extras are silently dropped.
  The Expo docs page states no limit — the platform does. VERIFIED.
- **Text-input (`RemoteInput`) actions honour `opensAppToForeground` too.**
  `ExpoNotificationBuilder.kt:82-90` builds the same `createNotificationResponseIntent` and attaches
  a `RemoteInput` keyed `USER_TEXT_RESPONSE_KEY`; `ExpoNotificationCategoriesModule.kt:96-104` passes
  the flag through. `NotificationsService.kt:546-547` reads the text back out of the *broadcast*
  intent (`RemoteInput.getResultsFromIntent(intent)`), and
  `NotificationSerializer.java:41,44` puts both `actionIdentifier` and `userText` into the bundle
  handed to the background task. VERIFIED — **so an inline typed note can be captured and written to
  SQLite entirely headlessly.** That is a genuinely stronger capture route than the widget, which
  cannot take text at all.
- Action buttons get no per-action icon (`buildButtonAction` reuses the app's small icon,
  `ExpoNotificationBuilder.kt:77-80`). Titles are the only differentiator.

---

## PART 3 — Concurrency: one process, one JS runtime, one connection

This is where the design question actually gets decided, and where the intuition ("background task
= second runtime = second connection = locking") is **wrong for this stack**.

### 3.1 Both headless entry points use the app's single `ReactHost`

| Path | Line |
|---|---|
| Widget | `HeadlessJsTaskWorker.java:128-130` — `((ReactApplication) getApplicationContext()).getReactHost()` |
| Notification | `RNHeadlessAppLoader.kt:34` — `(context.applicationContext as ReactApplication).reactHost` |
| Notification (timer-keepalive) | `TaskService.java:671-672` — `((ReactApplication) context.getApplicationContext()).getReactHost()` |

All three: the same object. VERIFIED.

And a `ReactHost` owns exactly one instance. RN `v0.86.2` `ReactHostImpl.kt` (fetched today):

```kotlin
override fun start(): TaskInterface<Void> = Task.call({ getOrCreateStartTask() }, bgExecutor)

@ThreadConfined("ReactHost") private var startTask: Task<Void>? = null
@ThreadConfined("ReactHost")
private fun getOrCreateStartTask(): Task<Void> {
  startTask?.let { return it }
  ...
}
```

with `private var reactInstance: ReactInstance? = null` and the class comment *"A ReactHost is an
object that manages a single ReactInstance."* `start()` is idempotent. VERIFIED.

Combined with §1.1 (no `android:process` on the receiver) and the fact that neither library declares
a separate process anywhere: **headless JS runs in the same OS process and the same JS VM as the
foreground app.**

### 3.2 Therefore: the same `expo-sqlite` connection object

`expo-sqlite@57.0.1` caches connections **per module instance**:

- `android/src/main/java/expo/modules/sqlite/SQLiteModule.kt:24` —
  `private val cachedDatabases: MutableList<NativeDatabase> = mutableListOf()`
- `:113` — on construction, `findCachedDatabase { it.databasePath == databasePath && it.openOptions == options && !options.useNewConnection }?.let { it.addRef(); return@Constructor it }`
- `src/NativeDatabase.ts:49-53` — `useNewConnection` *"Whether to create new connection even if
  connection with the same database name exists in cache. @default false"*

One `ReactContext` ⇒ one `SQLiteModule` instance ⇒ one cache. **A headless `openDatabaseAsync('orbit.db')`
returns the *same* `NativeDatabase` the foreground app already opened, ref-counted.** VERIFIED.

Consequences, and they invert the usual advice:

- **There is no second connection, so there is no `SQLITE_BUSY` between foreground and background.**
  Writes serialize inside one connection.
- **The real hazard is JS-level interleaving on one connection.** `SQLiteDatabase.ts:140-149`:
  `withTransactionAsync` is literally `BEGIN` → `await task()` → `COMMIT`. Expo's own docs warn:
  *"This transaction is not exclusive and can be interrupted by other async queries"* and that
  queries issued **outside** the scope function while it is open *"may be included in that
  transaction."* A headless "mark contacted" transaction landing in the middle of a foreground
  transaction on the same connection would be **merged into it** — and rolled back with it.
  **This is the concurrency bug to design against, and it is not the one people expect.**
- The single DAO function required by 01-data is the right shape for this, but it must serialize its
  own callers in JS (a promise queue / mutex), not rely on SQLite to do it.
- `withExclusiveTransactionAsync` *does* open a second connection —
  `SQLiteDatabase.ts:786-796`, `const options = { ...db.options, useNewConnection: true }` — and the
  docs say *"the other async write queries will abort with `database is locked` error."*
  Note it issues a plain `BEGIN` (`:184`), not `BEGIN EXCLUSIVE`; "exclusive" here means "on its own
  connection." **If the design reaches for this, the second-connection locking problem is created,
  not avoided.**

### 3.3 Journal mode and busy timeout are NOT configured — this is an action item

- `android/src/main/cpp/NativeDatabaseBinding.cpp:115-117` — `::exsqlite3_open(dbPath.c_str(), &db)`.
  Plain `sqlite3_open`, no flags.
- Grepped the entire package outside `vendor/` for `journal_mode`, `WAL`, and `busy_timeout`:
  **zero hits.** VERIFIED.

So on a fresh database the journal mode is SQLite's default (**DELETE**, not WAL) and the busy
timeout is **0** — a blocked writer returns `SQLITE_BUSY` immediately rather than waiting. Expo's own
SQLite docs recommend the fix explicitly: *"Enable WAL journal mode when you create a new database to
improve performance in general"*, via `await db.execAsync('PRAGMA journal_mode = WAL')`.

**Design consequence.** `PRAGMA journal_mode = WAL` (persistent, set once) and a non-zero
`PRAGMA busy_timeout` belong in the database bootstrap that runs before migrations, on **every**
entry point — foreground, widget task, and notification task alike. Since all three share one
connection, whichever runs first sets it, but the code must not assume which one that is.

Two further notes:

- `SQLiteModule.kt:30` — `moduleCoroutineScope = CoroutineScope(Dispatchers.IO)`, a multi-threaded
  pool, and every `AsyncFunction` is `.runOnQueue(moduleCoroutineScope)`. Queries are not serialized
  on one thread. No `-DSQLITE_THREADSAFE` override appears in `android/build.gradle:27-38`, so the
  vendored SQLite is in its default **serialized** threading mode and sharing one handle across those
  threads is safe at the C level. INFERRED from the absence of the flag plus SQLite's documented
  default; not read from a compiled artifact.
- `SQLiteModule.kt:63-68` — `OnDestroy { removeAllCachedDatabases().forEach { closeDatabase(it) } }`.
  When the headless React instance is torn down (`RNHeadlessAppLoader.invalidateApp` →
  `reactHost.destroy(...)`, only if `lifecycleState == BEFORE_CREATE`, i.e. no Activity took
  ownership — `RNHeadlessAppLoader.kt:60-68`), every cached connection is closed. **A write must be
  committed before the handler's promise resolves; nothing may be left in flight.**

### 3.4 The bundle-side-effects warning

`expo-notifications` `src/registerTaskAsync.ts:13-14`, verbatim:

> *"Make sure you define and register the task in the module scope of a JS module which is required
> early by your app (e.g. in the `index.ts` file)... `expo-task-manager` loads your app's JS bundle
> in the background and executes the task, **as well as any side effects which may happen as a
> consequence of requiring any JS modules**."*

**Design consequence, and it collides directly with a `CLAUDE.md` rule.** Orbit's quarantine-expiry
and history-retention sweeps are specified to *"run as a sweep at app launch."* If that sweep is
wired to module scope or to a bare "app started" hook, **it will also run on every widget tap and
every notification action from a cold process** — inside a 30-second budget, in the widget's case,
competing with the write the user actually asked for. The launch sweep must be gated on a real
foreground launch (`AppState` / root-component mount), not on bundle evaluation.

---

## PART 4 — Fallbacks, and what they cost

Neither route needs a fallback for the *write* itself. Both can write. The fallbacks that remain are:

| Situation | Fallback | Cost |
|---|---|---|
| Widget tap, expedited quota exhausted (rarely-opened app, restrictive standby bucket) | Work runs as ordinary deferrable work | Write is **delayed**, possibly until the device leaves Doze. Widget must show optimistic state immediately and reconcile on next render. |
| Widget tap while app force-stopped (Android 15+) | **None** — the tile is greyed out and untappable until the user launches the app | Total loss of the route. Not silent (the tile visibly greys), which is the one mercy. |
| Notification action while Orbit is **foregrounded** | Background task does not run (`isAppInForeground()` guard, `ExpoHandlingDelegate.kt:160`); only the JS response listener fires | Needs a *second* code path. If only the background task is implemented, taps while the app is open are **dropped**. |
| Notification action while app killed, relying on `addNotificationResponseReceivedListener` | Response is queued in `sPendingNotificationResponses` and delivered when a listener registers | Write deferred to next app launch. Works, but the `last_contact` timestamp will be wrong unless the response's own timestamp is used rather than "now". |
| Anything that must open the SMS composer | Activity must foreground — `expo-sms` `SMSModule.kt:76` | Unchanged from 03-fuel F8. **A "mark contacted" button and an "SMS them" button are different buttons with different execution models.** Do not merge them. |

**Cold-start cost, for the record:** neither successful route pays an Activity cold start. Both pay a
*JS bundle* cold start when the process is dead — `reactHost.start()` plus bundle evaluation, plus
whatever module-scope side effects §3.4 warns about. That is real (hundreds of ms to seconds on a
mid-range device) but invisible: no window appears, and the user's tap has already been
acknowledged by the notification collapsing or the widget re-rendering.

---

## Open / unverified

1. **The no-FCM question (§2.3).** Code reading says the path is Firebase-free; I could not run it on
   a device. This remains the single claim a plan should smoke-test before leaning on it. It is
   cheap to test: register the task, fire a local notification with a non-foregrounding action, kill
   the app, tap.
2. **Whether placing a widget clears `FLAG_STOPPED` for a never-launched app** (§1.4). Google's
   wording lists "a widget" among the qualifying indirect interactions, but I did not test it.
3. **Widget tap latency in practice** under a restrictive standby bucket. Unquantified. It cannot be
   measured on the desktop emulator (per `CLAUDE.md`); it needs the physical Pixel.
4. **SQLite threading mode** (§3.3) is inferred from the absence of a `-DSQLITE_THREADSAFE` build
   flag, not read from the compiled `.so`.
5. **OEM behavior**: several OEM ROMs (Xiaomi, Huawei, Samsung historically) treat swipe-from-Recents
   as force-stop. If they do, §1.4's "swiped away" row degrades to the force-stop row on those
   devices. Well-attested in practice, not verified here.
6. I did **not** touch the attached device for this paper. No device use, no screenshots, no data
   read.
