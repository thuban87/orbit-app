# Platform verification refresh — 10-capture (share-to-Orbit)

**Re-verification date:** 2026-08-13
**Prior verification:** 2026-08-12 (from published `expo-share-intent@8.0.1` tarball + Android docs)
**Method:** Fetched live npm registry, unpacked the actual `expo-share-intent@8.0.1` tarball
(`npm pack`), read the on-disk Kotlin/JS source, and fetched developer.android.com. No
reliance on training data.

**Bottom line:** Nothing changed in the last day. No new `expo-share-intent` release, no new
`expo-quick-actions` release. All five prior claims still hold. No design decision changes.

---

## Claim 1 — EXTRA_SUBJECT patch necessity — STILL HOLDS

**(a) Current latest version.** `expo-share-intent` latest on npm is **8.0.1**, published
**2026-07-10T15:14:59Z** (`time.modified` = 2026-07-10). No release in the last 24h; 8.0.1 is
unchanged since the prior verification. (Release history: 7.0.0 2026-06-06, 8.0.0 2026-07-03,
8.0.1 2026-07-10.)

**(b) Kotlin still reads EXTRA_TITLE, NOT EXTRA_SUBJECT.** In the unpacked tarball,
`android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt`:

```kotlin
// line 124-134, text/plain ACTION_SEND branch
if (intent.type!!.startsWith("text/plain")) {
    if (intent.action == Intent.ACTION_SEND) {
        notifyShareIntent(mapOf(
            "text" to intent.getStringExtra(Intent.EXTRA_TEXT),   // line 129
            "type" to "text",
            "meta" to mapOf(
                "title" to intent.getCharSequenceExtra(Intent.EXTRA_TITLE),  // line 132
            )
        ))
    }
```

Grep of the whole module for `EXTRA_SUBJECT` returns **nothing**. The only EXTRA reads are
`EXTRA_TEXT` (129), `EXTRA_TITLE` (132), and `EXTRA_STREAM` (143, 150). Chrome for Android puts
the page title in `EXTRA_SUBJECT` and the URL in `EXTRA_TEXT`; the library ignores
`EXTRA_SUBJECT`, so a link shared from Chrome arrives with `webUrl` populated but **title = null**
unless the Kotlin is patched to fall back to `EXTRA_SUBJECT`. **The planned patch is still
necessary.**

**(c) webUrl / regex extraction still holds.** `build/utils.js` lines 62-69:

```js
const webUrl = shareIntent.text
    .match(/[(http(s)?)://(www.)?-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/gi)
    ?.find((link) => link.startsWith("http")) || null;
// ...
type: webUrl ? "weburl" : "text",
webUrl,
```

Unchanged: the URL is regex-scraped out of the shared text, and `type` becomes `"weburl"` when a
URL is found. The scrape gets the URL; it does not recover a title (that only comes from the
metadata field, which is why the Kotlin patch matters).

Source: npm registry; unpacked `expo-share-intent-8.0.1.tgz`.

---

## Claim 2 — Config-plugin MIME registration — STILL HOLDS

`plugin/build/android/withAndroidIntentFilters.js`:

- **Default filter is `["text/*"]`** — line 51: `const newFilters = filters || ["text/*"];`
- Emits one `ACTION_SEND` + `category.DEFAULT` filter with **one `<data android:mimeType>` per
  configured type** — lines 53-60.
- **`ACTION_SEND_MULTIPLE` is emitted only if `androidMultiIntentFilters` is set** — lines 62-72
  (`multiFilters ? [...] : []`).

**Can the app register `text/plain` only (narrower than the `text/*` default)?** Yes. Passing
`androidIntentFilters: ["text/plain"]` makes `newFilters = ["text/plain"]`, producing a single
`<data android:mimeType="text/plain"/>`. Nothing forces `text/*`.

**Practical consequence of `text/*` vs `text/plain`.** The Kotlin module's text branch gates on
`intent.type!!.startsWith("text/plain")` (line 125). Registering `text/*` in the manifest makes
Orbit appear in the sharesheet for `text/html` and other `text/*` subtypes, but those intents
**fall through to the else (file/media) branch**. With `ACTION_SEND` and no `EXTRA_STREAM` URI,
that branch calls `notifyError("empty uri for file sharing: ...")` (line 147) — i.e. Orbit is
offered as a target and then errors/misroutes. **Registering `text/plain` only is the correct
narrowing**: it keeps Orbit out of the sharesheet for share types the module cannot handle.

Source: unpacked tarball `plugin/build/android/withAndroidIntentFilters.js`,
`ExpoShareIntentModule.kt`.

---

## Claim 3 — Direct Share / Sharing Shortcuts negative — STILL HOLDS

No maintained RN/Expo package publishes Android Sharing Shortcuts / `<share-target>` Direct Share
targets (the per-contact "share → Orbit → Dad in one tap" feature). It still requires a custom
native module using `ShortcutManagerCompat.pushDynamicShortcut` + a `<share-target>` in
`res/xml/shortcuts.xml`.

**What I searched:**
- npm/GitHub search for "expo/react-native android sharing shortcuts share-target direct share
  ShortcutManagerCompat pushDynamicShortcut". Candidates found are **launcher/home-screen
  shortcuts only**, none declare a `<share-target>`:
  - `@rn-org/react-native-shortcuts@0.2.0` — npm description verbatim: *"React native library
    for android shortcuts and iOS quick actions which allow users to quickly access specific app
    functionalities directly from the **home screen or app icon**."* Keywords: shortcuts, quick
    actions. No share-target / sharesheet support.
  - `react-native-add-shortcut`, `react-native-app-shortcuts` — Android App (launcher) Shortcuts.
  - `expo-quick-actions` — latest **6.0.2** (2026-05-27, unchanged). Launcher/quick-action
    shortcuts only, no `<share-target>`.

**Android docs' stale-target rule (confirmed).** developer.android.com "Provide Direct Share
targets" states: *"Don't publish shortcuts that are stale; a conversation with no user activity
in the last 30 days is considered stale."* and *"Avoid providing irrelevant or stale Direct Share
targets—for example, contacts the user hasn't messaged within the last 30 days."* Same doc
confirms the two required pieces: a `<share-target>` in the shortcuts XML resource and
`ShortcutManagerCompat.setDynamicShortcuts` / `pushDynamicShortcut`.

Sources:
- https://developer.android.com/training/sharing/direct-share-targets
- npm metadata for `@rn-org/react-native-shortcuts`, `expo-quick-actions`.

---

## Claim 4 — Back-stack / return-to-source after capture — STILL HOLDS

**Plugin defaults confirmed in tarball:**
- `plugin/build/android/withAndroidMainActivityAttributes.js` line 31-33 sets
  `"android:launchMode": "singleTask"` on `.MainActivity` by default.
- `useShareIntent` default `resetOnBackground: true` (library behavior, unchanged in 8.0.1).

**Android 15 (API 35) behavior change (confirmed on developer.android.com).** Under *Secured
background activity launches*, "Control how the top activity of a task stack can finish its task":

> *"If the top activity finishes a task, Android will go back to whichever task was last active.
> Moreover, if a non-top activity finishes its task, Android will go back to the home screen; it
> won't block the finish of this non-top activity."*

**What this means for "return the user to the app they shared from":**
- If, when the user finishes capture, **Orbit's capture activity is the top (and only) activity of
  its own task**, finishing it returns to *whichever task was last active* — i.e. the sharing app.
  This is the achievable path and it is the normal `finish()` case.
- If capture is a **non-top** activity in its task when it finishes, Android 15+ sends the user to
  **home**, not back to the sharing app.
- The relevant control is therefore **normal `finish()` on an activity that is the top of its own
  task**, *not* `finishAndRemoveTask()`. `finishAndRemoveTask()` removes the whole task and lands
  the user on home/launcher — the opposite of returning to source.
- `singleTask` interacts here: it keeps Orbit in a single dedicated task. Because
  `expo-share-intent`'s `handleShareIntent` re-launches with `FLAG_ACTIVITY_NEW_TASK` when the
  activity is not the task root (Kotlin lines 116-122), the shared capture tends to run as the
  root of Orbit's task — the top-activity-finishes case — which is exactly the case that returns
  to the last-active task (the sharing app). So **"return to the app you shared from" is
  achievable via a plain `finish()`**, provided the capture activity is the top of Orbit's task
  and you do not call `finishAndRemoveTask()`.

Android 15 also tightened background-activity-launch restrictions generally; nothing there blocks
this foreground finish flow.

Sources:
- https://developer.android.com/about/versions/15/behavior-changes-15 (Secured background
  activity launches)
- unpacked tarball `withAndroidMainActivityAttributes.js`, `ExpoShareIntentModule.kt` (116-122).

---

## Claim 5 — Play target-API deadline — STILL HOLDS (unchanged)

developer.android.com "Meet Google Play's target API level requirement" states, verbatim:

> *"Starting August 31 2026: New apps and app updates must target Android 16 (API level 36) or
> higher to be submitted to Google Play; except for Wear OS and Android Automotive OS apps, which
> must target Android 15 (API level 35) or higher, and Android TV and Android XR apps, which must
> target Android 14 (API level 34) or higher."*

> *"If you need more time to update your app, you'll be able to request an extension to November
> 1, 2026."*

Dates/rule **unchanged**: API 36 (Android 16) for new apps + updates from **2026-08-31**,
extension window to **2026-11-01**.

Source: https://developer.android.com/google/play/requirements/target-sdk (also corroborated by
Play Console Help answer 11926878).

---

## Design-decision impact

**None changed.** Every prior claim survives re-verification:
- The EXTRA_SUBJECT Kotlin patch is still required (Chrome titles still lost without it).
- Register `text/plain` only, not `text/*`, to avoid Orbit erroring on `text/html` shares.
- Per-contact Direct Share remains a custom-native-module job; no library shortcut exists.
- "Return to source" is achievable with a plain `finish()` on a top-of-task capture activity —
  never `finishAndRemoveTask()`; Android 15's non-top-finish-goes-home rule is the constraint to
  respect.
- Target API 36 by 2026-08-31 (ext. 2026-11-01) — plan around it, deadline is 18 days out.
