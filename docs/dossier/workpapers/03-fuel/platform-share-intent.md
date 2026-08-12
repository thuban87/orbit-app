# Platform verification — Android share-sheet capture into an Expo app

**Subject:** HANDOFF §6 [DECIDED] — "Register Orbit as an Android share target. Share a link, article, or text into Orbit → pick a contact → attaches as Conversational Fuel. Zero-friction capture."

**Verified:** 2026-08-12 · **Verdict:** the decision is sound and buildable. Four constraints materially change the design.

**Method.** Package facts were read from the **npm registry tarballs themselves** (downloaded, checksummed, extracted), not from READMEs, blog posts, or training data. Platform behaviour is cited to `developer.android.com`. Anything I could not confirm is marked **unverified**.

> Verification note: an initial `npm pack` of `expo-share-intent@8.0.1` produced a contaminated tree (it contained `expo-notifications` sources). Every finding below was re-verified against the tarball fetched directly from `registry.npmjs.org` with a matching sha1 (`80647e238efb2de2adb9bc4902fe4a246b17c07b`). The published package is correct; the local pack was not.

---

## 1. Version / source table

| Thing | Version | Published | Source |
|---|---|---|---|
| `expo` | **57.0.12** (`latest`, `next`) | 2026-08-10 | `https://registry.npmjs.org/expo` |
| `expo-sqlite` | **57.0.1** (`latest`) | 2026-07-15 | `https://registry.npmjs.org/expo-sqlite` |
| `expo-linking` | 57.0.5 | 2026-08-04 | `https://registry.npmjs.org/expo-linking` |
| React Native (SDK 57) | **0.86** (from 0.85 in SDK 56) | — | `https://expo.dev/changelog/sdk-57` |
| `expo-share-intent` | **8.0.1** | 2026-07-10 | `https://registry.npmjs.org/expo-share-intent` |
| `react-native-receive-sharing-intent` | 2.0.0 | **2021-05-17** | `https://registry.npmjs.org/react-native-receive-sharing-intent` |
| `expo-quick-actions` | 6.0.2 | 2026-05-27 | `https://registry.npmjs.org/expo-quick-actions` |
| `react-native-android-widget` | 0.22.0 | 2026-08-08 | `https://registry.npmjs.org/react-native-android-widget` |

**Prior verification confirmed.** `expo@57.0.12` / `expo-sqlite@57.0.1` are the current `latest` tags. SDK 56 (`56.0.19`) and SDK 55 (`55.0.28`) are still maintained; `58.0.0-canary` exists but there is no SDK 58 release. RN 0.86 is confirmed from Expo's own SDK 57 changelog. Expo's default `targetSdkVersion` for SDK 57 is **unverified** — the changelog does not state it and I could not confirm it from package metadata; assume API 36 but check `expo-build-properties` defaults before relying on it.

Other referenced sources:

| Topic | URL |
|---|---|
| `Intent.EXTRA_SUBJECT` contract | `https://developer.android.com/reference/android/content/Intent#EXTRA_SUBJECT` |
| Web Share Target ⇄ Intent extras mapping | `https://developer.chrome.com/docs/capabilities/web-apis/web-share-target` |
| Sharing content-URI grants are temporary | `https://developer.android.com/training/secure-file-sharing/share-file` |
| Direct Share / Sharing Shortcuts | `https://developer.android.com/training/sharing/direct-share-targets` |
| Android 14 sharesheet custom actions + ranking | `https://android-developers.googleblog.com/2023/04/android-14-beta-1.html` |
| Android 15 behaviour changes (API 35) | `https://developer.android.com/about/versions/15/behavior-changes-15` |
| Android 16 behaviour changes (all apps) | `https://developer.android.com/about/versions/16/behavior-changes-all` |
| Play target API level requirements | `https://developer.android.com/google/play/requirements/target-sdk` |
| `expo-share-intent` repo / compat matrix | `https://github.com/achorein/expo-share-intent` |

---

## 2. How registration happens on Expo SDK 57

### The library choice is effectively already made

| Candidate | Latest | Last publish | Verdict |
|---|---|---|---|
| **`expo-share-intent`** | 8.0.1 | 2026-07-10 | **Only viable route.** `peerDependencies: { "expo": "^57", "expo-constants": ">=57.0.3", "expo-linking": ">=57.0.1" }` — explicitly pinned to SDK 57. Ships a Kotlin Expo module + config plugin. |
| `react-native-receive-sharing-intent` | 2.0.0 | **2021-05-17** | **Dead — do not use.** Five years without a publish. Predates the New Architecture, Expo config plugins, the API 33 `getParcelableExtra` deprecation, and scoped-storage maturity. |
| `expo-share-extension` | — | — | **iOS-only by design** (an iOS share extension with custom UI). Irrelevant to an Android-first app. |

Version alignment tracks Expo SDK 1:1 — v8 → SDK 57, v7 → SDK 56, v6 → SDK 55, v5 → SDK 54 (README compat matrix, corroborated by the `expo: "^57"` peer dep on 8.0.1).

Maintenance is healthy but **single-maintainer** (`achorein`), with a release cadence tied to each Expo SDK: 6.1.0 (2026-04-14) → 6.1.1 (2026-05-25) → 7.0.0 (2026-06-06) → 8.0.0 (2026-07-03) → 8.0.1 (2026-07-10). Bus-factor 1 on a load-bearing capture path is a risk worth naming, though the Kotlin module is only ~380 lines and is forkable.

### What the config plugin actually writes

Read from `plugin/build/android/withAndroidIntentFilters.js` and `withAndroidMainActivityAttributes.js` in the published 8.0.1 tarball:

- Intent filters are appended to **`.MainActivity`**. There is no separate receiver activity.
- `ACTION_SEND` + `category.DEFAULT`, one `<data android:mimeType>` per configured type.
- **Default when unconfigured is `["text/*"]` only.**
- `ACTION_SEND_MULTIPLE` is emitted **only** if `androidMultiIntentFilters` is set — multi-item share is opt-in.
- **The plugin sets `android:launchMode="singleTask"` on `.MainActivity` by default** (`withAndroidMainActivityAttributes`, default `{"android:launchMode": "singleTask"}`). See §4 — this is a whole-app change.

Configuration is declarative in `app.json` / `app.config.ts`; a `scheme` must be set.

```
["expo-share-intent", {
  "androidIntentFilters": ["text/*", "image/*"],
  "androidMultiIntentFilters": ["image/*"]
}]
```

### Prebuild cost: zero incremental

`expo-share-intent` cannot run in Expo Go. But **the project already requires a custom dev client / prebuild because of `react-native-android-widget`** (`peerDependencies: { "expo": ">=54.0.0" }`, ships native code). Share capture adds no new build-infrastructure decision.

---

## 3. What payloads actually arrive

### FINDING A (load-bearing) — `EXTRA_SUBJECT` is never read. Chrome's page title does not reach JS.

This is the single most decision-changing finding.

Android's `ACTION_SEND` contract defines `Intent.EXTRA_SUBJECT` as the conventional slot for a page or article **title**. **Chrome for Android sets `EXTRA_SUBJECT` to the page title and `EXTRA_TEXT` to the URL.** The Web Share Target spec documents the same equivalence: `{title}` ≡ `Intent.EXTRA_SUBJECT`, `{text}` ≡ `Intent.EXTRA_TEXT` (`https://developer.chrome.com/docs/capabilities/web-apis/web-share-target`).

`expo-share-intent@8.0.1` reads **`EXTRA_TITLE`, not `EXTRA_SUBJECT`**. From `android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt` in the published tarball:

```kotlin
notifyShareIntent(mapOf(
    "text" to intent.getStringExtra(Intent.EXTRA_TEXT),
    "type" to "text",
    "meta" to mapOf(
        "title" to intent.getCharSequenceExtra(Intent.EXTRA_TITLE),   // ← line 132
    )
))
```

`grep -rn "EXTRA_" android/` over the entire published package returns exactly four hits: `EXTRA_TEXT`, `EXTRA_TITLE`, and two `EXTRA_STREAM`. **`EXTRA_SUBJECT` appears nowhere in the shipped Android source.**

The JS layer does not compensate: `build/utils.js` `parseShareIntent()` does `meta: { title: shareIntent.meta?.title ?? undefined }` — a straight pass-through.

**Consequence:** a link shared from Chrome arrives with `meta.title === undefined`. `EXTRA_TITLE` is a comparatively rare extra that senders are not obliged to set, whereas `EXTRA_SUBJECT` is the documented ACTION_SEND convention. So the app cannot rely on getting a human-readable label for a shared link.

**Design impact — this is an owner decision, not an implementation detail.** Three options:

1. **Render the raw URL** and let the user type a label. No network, no fork. Costs a tap, which erodes "zero-friction."
2. **Patch/fork the Kotlin module** to also read `EXTRA_SUBJECT` (a ~1-line change: `intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: intent.getCharSequenceExtra(Intent.EXTRA_TITLE)`). Highest-value fix, but it makes the project a native-patch maintainer on every SDK bump. Upstreaming it is the better play.
3. **Fetch the page title over the network.** This collides head-on with the local-first commitment in `CLAUDE.md` ("no backend… do not introduce a network dependency into any read path") and would need to be an explicit, recorded exception.

What the app **does** reliably get is `text` (raw `EXTRA_TEXT`) and `webUrl`, which `parseShareIntent` derives by regex-extracting the first `http…` substring from `text` on the JS side.

### What arrives, by case

| Shared thing | What the app gets | Reliability |
|---|---|---|
| Plain text | `text` = `EXTRA_TEXT`; `type: "text"`; `webUrl: null` | Reliable |
| URL from Chrome | `text` = the URL; `webUrl` = regex-extracted; `type: "weburl"`; **`meta.title` undefined** | URL reliable; **title not** |
| Text containing a URL | `text` = full string; `webUrl` = **first** `http…` match only | Multi-URL text silently loses all but the first |
| Single image | `EXTRA_STREAM` `content://` → module copies bytes into `context.cacheDir`, returns `filePath` + `contentUri` | See below; **and see FINDING D** |
| Multiple items | Requires `androidMultiIntentFilters` opt-in → `ACTION_SEND_MULTIPLE` → array of file infos | Opt-in, off by default |

### FINDING B — `content://` URIs are short-lived, and the library's copy lands in cache storage

A `content://` URI granted by `ACTION_SEND` carries a temporary read grant scoped to the receiving activity's lifetime; Android's guidance is that the receiver must consume the data promptly and must not persist the URI for later use (`https://developer.android.com/training/secure-file-sharing/share-file`). Storing a `content://` string in SQLite and re-opening it hours later fails with `SecurityException`.

`expo-share-intent` handles the immediate part correctly — `getDataColumn()` does `resolver.openInputStream(uri)?.use { input -> FileOutputStream(targetFile).use { input.copyTo(it) } }`. **But `targetFile` is in `context.cacheDir`**, which the OS may purge under storage pressure and the user may clear from Settings.

**Design impact:** if Conversational Fuel is ever to hold an image, the app must copy out of `cacheDir` into app-private persistent storage **as part of the capture transaction**, and must never store `contentUri` as the record of truth. Given the app has no backup and no remote repair (`CLAUDE.md`), a fuel row pointing at a purged cache file is unrecoverable. The cheap alternative is to **scope §6 to text and URLs only** for v1 and defer images.

### FINDING C — a real bug in the single-file path

Same file, the `ACTION_SEND` single-file branch:

```kotlin
notifyShareIntent(mapOf( "files" to arrayOf(getFileInfo(uri), "type" to "file")))
```

`"type" to "file"` is **inside** `arrayOf(...)` rather than a sibling key, so a single shared file emits a `files` array whose second element is a `Pair`, and no top-level `type`. The `ACTION_SEND_MULTIPLE` branch on the following lines is written correctly. `parseShareIntent` partially masks this by filtering entries lacking `path`/`contentUri`, but the malformed element still reaches `file.mimeType.startsWith(...)` in the `isMedia` computation.

**Treat single-image share as unproven until tested on the physical device.** Text/URL capture — the actual §6 use case — does not go through this branch. This reinforces the "text and URLs only for v1" reading.

---

## 4. Lifecycle: cold start, warm start, and dropped payloads

Verified against `ExpoShareIntentReactActivityLifecycleListener.kt`, `ExpoShareIntentSingleton.kt`, `ExpoShareIntentModule.kt`, and `build/useShareIntent.js`.

**Cold start is sound.** The intent is stashed before JS exists:

```kotlin
override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    if (activity?.intent?.type != null) {
        ExpoShareIntentSingleton.intent = activity?.intent
        ExpoShareIntentSingleton.isPending = true
    }
}
```

JS then drains it: `useShareIntent` calls `ExpoShareIntentModule.getShareIntent("")` on mount and on every `AppState → "active"`; the `AsyncFunction("getShareIntent")` consumes the singleton and nulls it.

**Warm start has a narrow drop window.** `OnNewIntent { handleShareIntent(it) }` emits the `onChange` event **immediately and does not stash it**. If the JS listener is not yet subscribed the payload is silently dropped; if `instance` is null, `instance!!.sendEvent(...)` is a non-null assertion on a nullable and throws. In practice warm start implies JS is running, so the window is small — but it is real during a JS reload or an OOM-restored activity.

### FINDING D (load-bearing) — backgrounding destroys the pending payload, by default

`useShareIntent` defaults to `resetOnBackground: true`. Moving the app to background clears the pending share intent.

**Design impact:** **any capture flow that leaves the app before committing loses the payload** — a system contact picker, a permission dialog that backgrounds the app, or the user tabbing back to the source app to check something. Therefore:

- The contact-pick step **must** be an in-app screen backed by the local SQLite `contacts` table, never a system picker.
- The fuel row should be written to SQLite as early as possible rather than held in React state until a confirm tap.

This constrains the *shape* of the §6 flow, not just its implementation.

### FINDING E (load-bearing) — `launchMode="singleTask"` is imposed on the whole app

The plugin's default `androidMainActivityAttributes` is `{"android:launchMode": "singleTask"}`, and `handleShareIntent` additionally restarts the task with `FLAG_ACTIVITY_NEW_TASK` when `!activity.isTaskRoot`.

`singleTask` changes back-stack behaviour for **every** entry point, not just shares. Notification taps (HANDOFF §6's decayed-contact notifications), widget taps (`react-native-android-widget`), launcher shortcuts, and deep links all now land on a single reused activity instance and arrive via `onNewIntent` rather than a fresh `onCreate`.

**Design impact:** this is a cross-cutting constraint on the notification and widget designs, decided as a side effect of adopting the share target. Any of those surfaces that assumes a fresh activity or a normal back stack will need rework. It should be recorded as a decision, not discovered later.

### FINDING F (load-bearing) — there is no lightweight capture UI in this stack

The intent filter is attached to `.MainActivity`, so a share **always launches the full React Native app**: JS bundle load, Hermes startup, `expo-sqlite` open, store hydration, Skia init. There is no Android-side quick-capture dialog or trampoline.

Building one would mean a second native Activity rendering native Android Views or `RemoteViews` — i.e. writing real native code outside React Native, since RN cannot render into a lightweight non-RN activity, and a second RN root would not be lighter.

**Design impact:** the "zero-friction capture" claim in HANDOFF §6 is bounded by the cold-start time of the entire app. That number should be measured on the **physical Pixel 6 Pro** (per `CLAUDE.md`, the emulator cannot support a perf claim) before §6's ordering priority — "ship share-sheet capture early… they are the reason the previous version failed" (HANDOFF line 477) — is treated as settled. If cold start is slow, the *mitigation* is app-startup work, not share-sheet work.

---

## 5. Direct Share / Sharing Shortcuts — "share to Orbit → Dad"

### FINDING G (load-bearing) — this requires writing native code. No library provides it.

**Current API.** `ChooserTargetService` was **deprecated in Android 11 (API 30)**, and since API 30 the **Sharing Shortcuts API is the only way to supply Direct Share targets** (`https://developer.android.com/training/sharing/direct-share-targets`). Sharing Shortcuts were introduced in Android 10 (API 29); `ShortcutManagerCompat` back-ports usage reporting to API 21, and `androidx.sharetarget`'s `ChooserTargetServiceCompat` covers pre-API-30 devices.

**What it requires:**

1. A `<share-target>` element in `res/xml/shortcuts.xml`, with `android:targetClass` and matching `<data android:mimeType>` + `<category>`.
2. Runtime publication of dynamic shortcuts via `ShortcutManagerCompat.setDynamicShortcuts()` / `pushDynamicShortcut()`, each built with **`setCategories(...)` matching the `<share-target>` category** and **`setLongLived(true)`**.
3. Adaptive bitmap icons (`IconCompat.createWithAdaptiveBitmap()`, 108×108 dp with 72×72 dp content).
4. The `androidx.sharetarget` dependency plus an `android.service.chooser.chooser_target_service` meta-data entry for backward compatibility.

**Nothing in the JS/Expo ecosystem does this.** I checked the obvious candidate directly:

- **`expo-quick-actions@6.0.2`** ships a config plugin that writes `res/xml/shortcuts.xml` — but only a `<shortcuts>` root with launcher shortcuts (`plugin/build/withShortcutsXML.js`, fallback string `<shortcuts …></shortcuts>`); **no `<share-target>` support**.
- Its Kotlin `setShortcuts()` uses the **framework** `ShortcutManager` (not `ShortcutManagerCompat`) and builds `ShortcutInfo.Builder(context, id).setShortLabel(...).setLongLabel(...).setIcon(...).setIntent(...)` — **no `setCategories`, no `setLongLived`, no `setPerson`**. Its public `Action` type has no categories field. Its shortcuts therefore cannot appear in the Direct Share row.
- No maintained RN/Expo package implementing Sharing Shortcuts surfaced in search. **Unverified negative** — I did not find one, but absence of search evidence is not proof none exists.

**Design impact.** Per-contact Direct Share targets are **not reachable without a custom native module** on SDK 57. Since capture must go through the full app anyway (FINDING F), Direct Share is exactly the feature that would have made capture fast — "share → Dad" in one tap instead of "share → Orbit → wait for cold start → pick Dad." That it costs native code is a scope decision the owner should make explicitly, not a detail to defer.

Two secondary facts if it is pursued: Android 14 improved Direct Share ranking based on `pushDynamicShortcut` usage reporting with capability bindings (`https://android-developers.googleblog.com/2023/04/android-14-beta-1.html`), and the docs warn the system avoids surfacing stale targets with **no activity in the last 30 days** — so a rarely-contacted person (precisely Orbit's decay case) may be the one the sharesheet declines to show. That is an unhappy interaction with the product's core premise and worth thinking through before investing.

---

## 6. Play Store policy and Android 13–16 behaviour changes

**No Play policy targets share targets specifically.** I found none. The binding constraint is the target API level requirement.

### FINDING H — the Play target-API deadline is 19 days away

Per `https://developer.android.com/google/play/requirements/target-sdk`, starting **August 31, 2026**:

- **New apps and app updates must target Android 16 (API 36) or higher.**
- Existing apps must target Android 15 (API 35) or higher to stay available to new users on newer devices.
- Extensions may be requested to **November 1, 2026**.

Orbit is a new app, so **API 36 is the floor from the first Play submission**, and everything below is in scope from day one, not deferred.

### Behaviour changes that touch this flow

| Change | Android | Gated by | Relevance |
|---|---|---|---|
| **Edge-to-edge enforced by default**; `setStatusBarColor`/`setNavigationBarColor` deprecated and disabled; `Configuration.screenWidthDp/screenHeightDp` now **include** system bars | 15 (API 35) | targetSdk 35+ | Any capture screen must apply `WindowInsets`. RN 0.86 "includes fixes and improvements to edge-to-edge support on Android" (`https://expo.dev/changelog/sdk-57`), but layout is still the app's job. Interacts with the Skia orrery, which reads viewport dimensions. |
| **Background activity launch restrictions**: `PendingIntent` creators block background activity launches by default; apps cannot bring a task to foreground without sender consent; finishing a non-top activity returns to home rather than the previous task | 15 (API 35) | targetSdk 35+ | Directly relevant to HANDOFF §6's notification actions ("opens the SMS composer for that contact"). Combined with `singleTask` (FINDING E), the back-stack behaviour after a share-capture or a notification tap needs explicit design. |
| **Intent redirection hardening** — nested `Intent` extras are blocked from launching components by default; opt out via `removeLaunchSecurityProtection()` | 16 (API 36) | **all apps** | `expo-share-intent`'s `handleShareIntent` re-launches a copied intent (`Intent(intent).addFlags(FLAG_ACTIVITY_NEW_TASK)`) when `!activity.isTaskRoot`. That copy carries the resolved component so it should be fine, but it is the one code path in this library that touches the hardened area. **Verify on an API 36 device.** |
| Ordered broadcast priority scoped to the same process | 16 (API 36) | all apps | Not relevant to share capture. |
| `StrictMode.detectUnsafeIntentLaunch()` available | 15 (API 35) | opt-in | Worth enabling in dev builds specifically because of the intent re-launch above. |
| `POST_NOTIFICATIONS` runtime permission | 13 (API 33) | targetSdk 33+ | Not a share-target issue, but it gates the other half of HANDOFF §6 (decay notifications) and must be requested at runtime. |

Android 14's `ChooserAction` / `EXTRA_CHOOSER_CUSTOM_ACTIONS` is a **sender**-side API (adding custom actions to a sharesheet you invoke). Orbit is a **receiver**; it does not apply.

I found **no** Android 15 or 16 behaviour changes specific to the share sheet or to `content://` grant lifetime.

---

## 7. Launcher app shortcuts as a second capture entry point

`expo-quick-actions@6.0.2` (published 2026-05-27) is **viable but carries caveats**.

**Maintenance:** actively maintained, but its own README states *"This is not an official Expo SDK package."* Maintainer is Evan Bacon (an Expo core member, which helps). Release cadence 6.0.0 (2025-09-15) → 6.0.1 (2026-01-14) → 6.0.2 (2026-05-27) — roughly every 4–8 months, slower than the Expo SDK train. `peerDependencies: { "expo": "*" }`, i.e. **no declared SDK 57 pin**, so SDK 57 compatibility is **unverified** and should be smoke-tested rather than assumed.

**What it gives you:** long-press-the-launcher-icon shortcuts via a declarative `setItems()` API, with a listener for the tapped action. Android path requires API 25+ (`@RequiresApi(N_MR1)`) — irrelevant in practice.

**Constraints found by reading the source:**

- `setShortcuts()` does `val intent = Intent(context, currentActivity!!::class.java)` — a **non-null assertion on the current activity**. Shortcuts can therefore only be published while an activity exists; a "keep per-contact shortcuts fresh" background sweep is not possible through this API. Fits the `CLAUDE.md` rule that sweeps run at app launch anyway.
- `shortcutManager.dynamicShortcuts = shortcuts` replaces the whole set every call — there is no incremental add.
- The launcher caps how many dynamic shortcuts it displays (typically 4–5); the library exposes `maxCount`. A per-contact shortcut list will be truncated.
- These are **launcher** shortcuts, not Sharing Shortcuts, so they are a *second entry point into the app*, not a faster path from another app's share sheet. They do not substitute for §5.

**Design impact:** a reasonable "New fuel" / "Log interaction" shortcut on the launcher icon. It does **not** solve the capture-speed problem, because it still cold-starts the full app (FINDING F) and it starts from Orbit rather than from the content.

---

## 8. Summary of constraints that change a design decision

| # | Constraint | What it changes |
|---|---|---|
| **A** | `expo-share-intent` reads `EXTRA_TITLE`, never `EXTRA_SUBJECT`; Chrome puts the title in `EXTRA_SUBJECT` | A shared link arrives **unlabelled**. Choose: raw URL + manual label / fork the Kotlin module / network fetch (breaks local-first). **Owner decision.** |
| **D** | `useShareIntent` defaults to `resetOnBackground: true` | Contact picking must be an **in-app** screen; write to SQLite early. Any flow that leaves the app loses the payload. |
| **E** | The plugin sets `launchMode="singleTask"` on `.MainActivity` | Changes back-stack behaviour for **notifications, widgets, deep links** — not just shares. Cross-cutting; record it. |
| **F** | Intent filter lives on `.MainActivity`; no trampoline possible without native code | "Zero-friction capture" is bounded by **full app cold start**. Measure on the physical Pixel, not the emulator. |
| **G** | Direct Share requires `ShortcutManagerCompat` + `<share-target>`; no RN/Expo library provides it | "Share → Orbit → Dad" needs a **custom native module**. Also, the docs' 30-day staleness rule works against exactly the decayed contacts Orbit exists to surface. |
| **B/C** | `content://` grants are transient; the library copies to `cacheDir` (purgeable); the single-file branch has a real bug | Consider scoping v1 to **text and URLs only**; defer images. If images ship, copy to persistent storage inside the capture transaction. |
| **H** | Play requires **API 36** for new apps from **2026-08-31** | Android 15 edge-to-edge and background-activity-launch rules, and Android 16 intent-redirection hardening, all apply **from day one**. |

**None of this invalidates HANDOFF §6.** Share-target registration is a solved, maintained, config-plugin-level problem on SDK 57. What is *not* settled is (a) how a captured link gets a label without a network call, and (b) whether "fast" capture is achievable at all without native work — both of which sit in the owner's bucket.
