# Platform verification — notification lifecycle, channel architecture, nagging/quiet-hours

**Domain:** 11-notify · **Date:** 2026-08-13 · **Verifier:** platform-verification agent
**Method:** First-hand read of the published `expo-notifications@57.0.10` npm tarball (Android Kotlin/Java + JS/TS source) and live official docs (developer.android.com, docs.expo.dev). Every load-bearing claim below is cited to a file:line in the tarball or a live URL. Where only a search-model synthesis exists, it is flagged.

---

## Versions

| Package / source | Version | How resolved |
|---|---|---|
| `expo` | 57.0.12 | `npm pack expo@57` → tarball `package.json` |
| `expo-notifications` (bundled for SDK 57) | `~57.0.10` | `expo@57.0.12` `bundledNativeModules.json` → `"expo-notifications": "~57.0.10"` |
| `expo-notifications` (read for this report) | 57.0.10 | `npm pack expo-notifications@57.0.10` |
| Android platform docs | Android 14 / 15 / 16 | developer.android.com, live 2026-08-13 |

Tarball paths below are relative to `package/android/src/main/java/expo/modules/notifications/` unless noted.

---

## Findings that change a design decision

| # | Finding | First-hand source | Design consequence |
|---|---|---|---|
| A | **A channel's importance and all behavior fields are immutable after creation** — OS-enforced, Android 8+. Only `name` and `description` can change later. | Expo docs (channels immutability); Android channels guide: *"After you create a notification channel, you can't change the notification behaviors."* | Any user-facing change to importance, DND-bypass, lock-screen visibility, sound, or vibration requires **delete + recreate a new channel**, not an edit. Decide channel identity up front. |
| B | **Delete+recreate to change settings is user-visible AND has a same-id trap.** Deleted channels are counted on the app's notification-settings screen as spam prevention; recreating a channel **with the same id** is a **no-op** (it does *not* apply new settings). | Android channels guide: *"The notification settings screen displays the number of deleted channels, as a spam prevention mechanism"* and *"Recreating an existing notification channel with its original values performs no operation."* | To actually change a channel's behavior you must recreate under a **new channel id** (e.g. version-suffix the id). Reusing the id silently keeps the old settings. This is the single biggest channel-architecture landmine. |
| C | **No time-of-day / quiet-hours field exists anywhere** on a channel or a notification. `bypassDnd` is the only DND-related field, it is per-channel and defaults false. | `AndroidXNotificationsChannelManager.java:96–166` — full settable field list; no quiet-window field. | App-level quiet hours must be implemented **by scheduling the trigger to the next allowed time yourself.** The platform gives you nothing. Aligns with the "reduce nagging" mandate: quiet hours are Orbit's own scheduling logic. |
| D | **Same-identifier notifications REPLACE; different-identifier STACK.** Native posts with `notify(tag = request.identifier, id = 0)`. A scheduled notification presents with its **request identifier**. | `ExpoPresentationDelegate.kt:108–110` (`notify(identifier, getNotifyId(...), ...)`), `:37` (`ANDROID_NOTIFICATION_ID = 0`), `:127` (`getNotifyId` returns the constant). | Choose the identifier deliberately. A **stable per-contact identifier** (e.g. `decay:<contactId>`) makes re-nags for the same contact collapse to one shade entry. A per-fire unique id makes them pile up. |
| E | **A per-contact avatar / MessagingStyle look is unreachable from JS on SDK 57.** For a *local* notification the large icon comes only from a single static manifest meta-data resource; there is no JS field to set a dynamic/per-notification large icon. | `ExpoNotificationBuilder.kt:150–154`; `NotificationContent.java:105–121` (`getImage` reads manifest `META_DATA_LARGE_ICON_KEY`, one app-wide resource); `NotificationContentInput` in `src/Notifications.types.ts` has no `largeIcon`/`image` field. Confirms prior finding. | "Alice" + her photo on the notification is **not possible** without a native module/patch. Decay notifications get the app icon only. Design the copy to carry identity in the text. |
| F | **Android 15 Notification Cooldown is now officially documented** (prior work found it only in secondary sources). It auto-reduces appearance, sound volume, and vibration of repetitive notifications from the same app for up to ~2 min; critical notifications are exempt; user can disable it in Settings. | developer.android.com/develop/ui/compose/notifications — *"Android 15 introduces a notification cooldown feature… reduces the appearance, sound volume and vibration intensity for repetitive notifications for up to two minutes… Critical notifications… are not subject to cooldown. The user can turn off notification cooldown in Settings."* | On Android 15+ a **burst** of per-contact decay notifications will be auto-muted by the OS after the first. This is a platform tailwind for "one notification at a time" and a platform penalty for "N per-contact at once." Reinforces finding D toward collapsing/summarizing rather than firing many. |
| G | **Delivered notifications are user-dismissible by default; even `sticky:true` (ongoing) is swipe-dismissible on Android 14+.** | `ArgumentsNotificationContentBuilder.java` (`autoDismiss` default `true` → `setAutoCancel`; `sticky` default `false` → `setOngoing`), `ExpoNotificationBuilder.kt:100–101`; Android 14 behavior change *"Changes to how users experience non-dismissible notifications."* | You cannot pin a decay reminder so it can't be dismissed. Do not design around a persistent/un-clearable reminder — it won't hold on modern Android. |

---

## Per-question findings

### 1. Channel creation & the multi-channel model

**JS API (all present in `expo-notifications@57.0.10`):**
- `setNotificationChannelAsync(channelId, options)` → `NotificationChannelManagerModule.kt` `AsyncFunction("setNotificationChannelAsync")`. Internally calls `createNotificationChannel` — **there is no separate "update"; set = create.**
- `getNotificationChannelsAsync()`, `getNotificationChannelAsync(channelId)`, `deleteNotificationChannelAsync(channelId)` — same module.
- **Channel groups:** `setNotificationChannelGroupAsync`, `getNotificationChannelGroupsAsync`, `deleteNotificationChannelGroupAsync` (JS files `src/*NotificationChannelGroup*.android.ts`; native `NotificationChannelGroupManagerModule.kt`). Groups are only display headers in system settings; they carry no behavior.

**Every settable channel field** (verified in `AndroidXNotificationsChannelManager.java:96–166`, `configureChannelWithOptions`):

| Option key | Native call | Notes |
|---|---|---|
| `importance` | `new NotificationChannel(id, name, importance)` | Set at construction only. `NotificationImportance` enum → native value. |
| `bypassDnd` | `setBypassDnd(bool)` | Defaults false. See Q2. |
| `description` | `setDescription` | One of only two mutable-after-creation fields. |
| `lightColor` | `setLightColor(Color.parseColor(...))` | |
| `groupId` | `setGroup(...)` (auto-creates group if missing) | |
| `lockscreenVisibility` | `setLockscreenVisibility(...)` | `NotificationVisibility` enum: PUBLIC=1, PRIVATE=2, SECRET=3, UNKNOWN=0 (`enums/NotificationVisibility.java`). Per-channel, not per-notification. |
| `showBadge` | `setShowBadge(bool)` | |
| `sound` + `audioAttributes` | `setSound(uri, attrs)` | filename resolves via `SoundResolver`; `null` = silent; absent = default sound. |
| `vibrationPattern` | `setVibrationPattern(long[])` | |
| `enableLights` | `enableLights(bool)` | |
| `enableVibrate` | `enableVibration(bool)` | |

**Immutability:** OS-enforced on Android 8+ (API 26). Expo docs: *"After a channel has been created, you can modify only its name and description. This limitation is imposed by the Android OS."* Android channels guide: *"Once you submit the channel to the NotificationManager, you can't change the importance level."* → **Findings A & B.** `createNotificationChannel` returns the OS's stored channel, not the requested one (`AndroidXNotificationsChannelManager.java` comment: *"the created channel may differ from this value"*), so on a re-`set` with the same id you get back the *old* settings.

**Lazy vs up-front:** Because a settings change means a new channel id (Finding B), and because deleted channels linger visibly, prefer a **small, stable set of channels created up front** (e.g. one "Reminders" channel, plus a second only if you must honor a user's PRIVATE/PUBLIC lock-screen preference — per the trusted prior finding, that's the only way, since visibility is per-channel and immutable). Avoid a channel-per-contact model.

### 2. Do Not Disturb / quiet hours

- `bypassDnd` **exists** as a channel field (`AndroidXNotificationsChannelManager.java` `BYPASS_DND_KEY` → `setBypassDnd`). Defaults false (channel is subject to the user's DND unless the app opts out).
- **No time-of-day / quiet-window field exists** on either a channel (full field list above) or a notification (`ArgumentsNotificationContentBuilder.java` payload keys: title, subtitle, body, data, sound, vibrate, priority, badge, color, autoDismiss, categoryIdentifier, sticky — none temporal). → **Finding C:** app-level quiet hours = schedule the trigger to the next allowed time in Orbit's own logic. There is no "respect quiet hours" flag to hand the OS.

### 3. Re-posting / replacing / stacking

- Native post: `NotificationManagerCompat.from(context).notify(notification.notificationRequest.identifier, getNotifyId(request), androidNotification)` (`ExpoPresentationDelegate.kt:108–110`).
- `getNotifyId` returns the constant `ANDROID_NOTIFICATION_ID = 0` for every notification (`:37`, `:127`). So the numeric id is always 0 and **the tag = the request identifier** is what distinguishes notifications in the shade.
- Android semantics: `notify(tag, id, …)` replaces an existing notification with the same (tag, id) pair. Here id is constant, so **same identifier ⇒ replace, different identifier ⇒ stack.**
- A **scheduled** notification fires with its **request identifier** as the tag (same code path; the scheduled request carries the identifier through to presentation). → **Finding D.** Per-contact re-nags collapse iff you reuse a per-contact identifier.

### 4. Dismissal & ongoing

- `autoDismiss` payload default `true` → `builder.setAutoCancel(content.isAutoDismiss)` (`ArgumentsNotificationContentBuilder.java` `getAutoDismiss`; `ExpoNotificationBuilder.kt:100`). Tapping clears it.
- `sticky` payload default `false` → `builder.setOngoing(content.isSticky)` (`ExpoNotificationBuilder.kt:101`). So JS **can** request an ongoing/sticky notification.
- BUT Android 14 behavior change *"Changes to how users experience non-dismissible notifications"*: `FLAG_ONGOING_EVENT` / `setOngoing(true)` notifications are now **user-dismissible** by swipe (except while locked, and they still clear via "Clear all"). CallStyle/media/DPC are excluded, but a plain reminder is not. → **Finding G:** you cannot make a decay reminder un-clearable on modern Android.

### 5. Badging / unread count

- `setBadgeCountAsync(count)` and `getBadgeCountAsync()` exist and work on Android (`src/BadgeModule.native.ts`, native `badge/BadgeModule.kt` + `badge/BadgeHelper.kt`) — **not iOS-only.**
- **Launcher-dependent.** Expo docs: *"Not all Android launchers support application badges. If the launcher does not support icon badges, the method will always resolve to 0."* Treat badge count as best-effort cosmetic, not a reliable channel.
- Note also `NotificationContentInput.badge` sets a per-notification number (`setNumber`) — distinct from the app-icon badge.

### 6. Android 16 "Notification Cooldown"

- **Now officially documented, but attributed to Android 15 (API 35), not Android 16.** The Android 16 `behavior-changes-all` page does *not* mention it; the canonical text lives at developer.android.com/develop/ui/compose/notifications.
- Exact text: *"Android 15 introduces a notification cooldown feature that aims to improve the experience of notifications that arrive in quick succession. This feature reduces the appearance, sound volume and vibration intensity for repetitive notifications for up to two minutes… Critical notifications that require audio and haptics to get attention are not subject to cooldown. The user can turn off notification cooldown in Settings."* The affected notifications still appear in the drawer.
- The doc's stated exemption is **critical** notifications; it does **not** enumerate calls/alarms/conversations for cooldown specifically (that enumeration belongs to the separate Android 14 dismissibility change). → **Finding F.** Prior work's "found only in secondary sources as of 2026-08-12" is now upgraded: first-hand official confirmation exists, versioned to Android 15.

### 7. MessagingStyle / per-contact avatar (re-scoped)

Confirmed: **still no way** to put a per-contact avatar on a local decay notification without a native module/patch on SDK 57. Local `NotificationContent.getImage()` reads a single static manifest resource (`META_DATA_LARGE_ICON_KEY`); the dynamic-image path (`RemoteNotificationContent`, `remoteMessage.notification.imageUrl`) is **FCM-remote only**, and Orbit has no FCM. `NotificationContentInput` exposes no `largeIcon`/`image` field. → **Finding E.** (Prior BigTextStyle-hardcoded / MessagingStyle-unreachable finding holds.)

---

## Sources

- Tarballs: `npm pack expo@57` (→ 57.0.12), `npm pack expo-notifications@57.0.10`. Android source under `package/android/src/main/java/expo/modules/notifications/`; JS under `package/src/`.
- Expo Notifications SDK docs: https://docs.expo.dev/versions/latest/sdk/notifications/
- Android 14 behavior changes (ongoing dismissible): https://developer.android.com/about/versions/14/behavior-changes-all
- Android 15 notification cooldown: https://developer.android.com/develop/ui/compose/notifications
- Channels (immutability, delete/recreate no-op, deleted-count spam note): https://developer.android.com/develop/ui/compose/notifications/channels
- NotificationChannel field reference: https://developer.android.com/reference/android/app/NotificationChannel
