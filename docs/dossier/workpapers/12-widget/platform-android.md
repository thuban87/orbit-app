# Platform verification — Android home-screen widget (App Widget / RemoteViews)

**Domain:** 12-widget · **Verified:** 2026-08-14 · **Verifier:** platform-verifier agent
**Scope:** Current Android platform constraints for an App Widget built via `react-native-android-widget`
(native `RemoteViews`), targeting recent Android (14 / 15 / 16). All claims below are cited to
official `developer.android.com` docs with the Android version each applies to. Anything I could not
verify against official docs is flagged **[UNVERIFIED]**.

**Design context being verified (already decided — feasibility only, not re-litigated):**
- Widget = grid of favourite contacts (photo + name).
- Tap = "mark contacted" (headless DB write, no app launch).
- Long-press = deep-link to profile (launches app).
- `launchMode="singleTask"` is imposed app-wide by expo-share-intent → taps reuse ONE activity
  instance via `onNewIntent`, not a fresh `onCreate`.
- No timed-undo on a widget tap (cached processes freeze ~10s after backgrounding — established).

---

## Q1 — Android 15 force-stop → widgets greyed out, PendingIntents cancelled  ✅ CONFIRMED

**Load-bearing. Verified.** This is a real Android 15 behaviour change and it applies to **all apps**
running on Android 15 regardless of `targetSdk`.

Source: **Behavior changes: all apps** (Android 15) —
`https://developer.android.com/about/versions/15/behavior-changes-all`

Verbatim, section *"Widgets disabled when user force-stops an app"*:
> "If a user force-stops an app on a device running **Android 15**, the system temporarily disables
> all the app's widgets. The widgets are grayed out, and the user cannot interact with them. This is
> because beginning with Android 15, the system cancels all an app's pending intents when the app is
> force-stopped. The system re-enables those widgets the next time the user launches the app."

Verbatim, section *"Changes to package stopped state"* (same page):
> "the system also **cancels all pending intents when the app enters the stopped state** on a device
> running Android 15. When the user's actions remove the app from the stopped state, the
> `ACTION_BOOT_COMPLETED` broadcast is delivered to the app providing an opportunity to re-register
> any pending intents."
> "Apps use pending intents to update app widgets. If an app enters the stopped state, all these
> pending intents are canceled, and the system disables the app's widgets ... The system re-enables
> the widgets the next time the user launches the app."

**Version:** Android 15 (API 35). The "stopped state" (`FLAG_STOPPED`) is entered by an explicit
user Force Stop **or** by never having launched the app since install/update. Widgets re-enable only
after the user **manually launches the app** (direct launch, or indirect action such as sharesheet /
selecting as live wallpaper — a widget tap does NOT count while the app is stopped, because its
PendingIntents are already cancelled).

**Design consequence:** the widget can **never be the only route into the app's core actions.** After
a force-stop (user- or system-initiated), tap-to-mark-contacted and long-press-to-profile are both
dead until the user opens the app from the launcher icon. The app must (a) not present the widget as
the sole entry point, and (b) re-push widget updates on next launch / on `ACTION_BOOT_COMPLETED` to
re-register PendingIntents.

---

## Q2 — Background Activity Launch (BAL): widget click launching the profile Activity  ✅ ALLOWED

**Verified: a launcher-initiated widget click is an explicit BAL exception.** The deep-link-to-profile
path is allowed.

Source: **Restrictions on starting activities from the background** —
`https://developer.android.com/guide/components/activities/background-starts`

Verbatim exception list — the two relevant entries:
> "The activity is started from a `PendingIntent` that was sent by the system (for example, from a
> notification tap)."
> "The launch is initiated by the device's launcher app, such as when a user taps an app icon or
> **interacts with a widget**."

So both of Orbit's launch paths qualify:
- **Widget long-press → launch profile:** allowed as a launcher-initiated interaction.
- **Notification tap → launch app** (domain 11): allowed as a system-sent PendingIntent.

**Android 15 (API 35) change — creator opt-in for PendingIntents.** Source: same page.
> "When your app targets Android 15 (API level 35) or higher, an app that **creates** a
> `PendingIntent` no longer grants its background launch privileges by default."

- **Sender opt-in** (Android 14 / API 34+): `ActivityOptions.setPendingIntentBackgroundActivityStartMode()`.
- **Creator opt-in** (Android 15 / API 35+): `ActivityOptions.setPendingIntentCreatorBackgroundActivityStartMode()`.
- Docs recommend the stricter `MODE_BACKGROUND_ACTIVITY_START_ALLOW_IF_VISIBLE`.

**Practical note for Orbit:** the widget-click and notification-tap cases are covered by the
*launcher/system-initiated* exceptions above, so they do **not** depend on the creator/sender opt-in
in ordinary use. The opt-in matters only if the app tries to launch an Activity from its own
background code (e.g. a headless receiver deciding to open the app) — which Orbit's design avoids for
the mark-contacted path (that path is a broadcast, no Activity; see Q7). `react-native-android-widget`
builds the PendingIntents; confirm it targets these APIs correctly if a future path launches an
Activity from app-created (not launcher-clicked) PendingIntents.

---

## Q3 — Synthetic back-stack under singleTask + onNewIntent  ⚠️ FRAMEWORK ANSWER DOES NOT COMPOSE

Source: **Start an Activity from a notification** (back-stack construction) —
`https://developer.android.com/develop/ui/views/notifications/navigation`

The framework-native mechanism is **`TaskStackBuilder`**:
> `addNextIntentWithParentStack(resultIntent)` reads each activity's `android:parentActivityName`
> and synthesises a full back stack; `getPendingIntent(...)` returns a PendingIntent carrying that
> whole stack, so Back walks the declared parent chain to the home screen.

**Why this does NOT solve Orbit's case directly:** `TaskStackBuilder` synthesises a back stack by
launching a **new** task / activity instances. Orbit is `launchMode="singleTask"` app-wide (imposed
by expo-share-intent), so a deep-link intent is delivered to the **existing single Activity instance
via `onNewIntent()`** — no new activity is created, and the synthetic stack is not built. The
notifications doc itself only pairs `singleTask` with the *"special activity"* pattern
(`taskAffinity="" ` + `FLAG_ACTIVITY_NEW_TASK|CLEAR_TASK`, no back stack) and explicitly defers
`onNewIntent` behaviour to *Tasks and the back stack*
(`https://developer.android.com/guide/components/activities/tasks-and-back-stack`).

**Conclusion for Orbit:** the "Back → dashboard" behaviour must be built at the **JS-navigation
layer** (React Navigation), not via `TaskStackBuilder`. The widget/notification PendingIntent should
carry a deep link; `onNewIntent` hands it to JS; the navigator resets/pushes so the stack reads
`[Dashboard, Profile]` and the hardware Back button pops Profile → Dashboard. This matches the
"Back → dashboard" pattern the prior domains (10-capture, 11-notify) already settled and keeps a
single native task. `TaskStackBuilder` is the correct native tool only for a plain multi-activity app,
which this RN app is not.

---

## Q4 — RemoteViews view-type limits (no custom views, no EditText; which collections scroll)  ✅ CONFIRMED

Source: **Create a simple widget** —
`https://developer.android.com/develop/ui/views/appwidgets`

Verbatim:
> "widget layouts are based on `RemoteViews`, which doesn't support every kind of layout or view
> widget. **You can't use custom views or subclasses of the views that are supported by
> `RemoteViews`.**"

- **No arbitrary/custom views.** Only the framework-supported classes and *not* their subclasses.
- **No `EditText` / text input.** `EditText` is not among the supported classes; there is no editable
  field in `RemoteViews`. (Independently corroborates the CLAUDE.md note: "Text input inside a widget
  is impossible.") A "type a note into the widget" feature is not buildable.
- Interactive elements added in **Android 12 (API 31)**: `CheckBox`, `Switch`, `RadioButton`,
  `ViewStub` are explicitly listed as supported. (Source: same page.)

**Scrolling collection views** — Source: **Use collection widgets** —
`https://developer.android.com/develop/ui/views/appwidgets/collections`
Supported collection (adapter-backed, scrollable) views:
- **`ListView`** — vertically scrolling list.
- **`GridView`** — 2-D scrolling grid.
- **`StackView`** — flickable stacked cards.
- **`AdapterViewFlipper`** — adapter-backed view animator (one child at a time).

These are populated via a **`RemoteViewsService` + `RemoteViewsFactory`** (`getViewAt(position)`
returns a `RemoteViews` per item), wired with `setRemoteAdapter(...)`. Declared in the manifest with
`android:permission="android.permission.BIND_REMOTEVIEWS"`.

**Design consequence:** a **scrollable list/grid of ALL favourites IS possible** — use a `GridView`
(matches the "grid of contacts" design) backed by a `RemoteViewsService`. A fixed small grid of N
favourites (static `RemoteViews`, no service) is the simpler alternative. Note
`react-native-android-widget` must expose the collection/`RemoteViewsService` path for the scrollable
option; verify its feature support before committing to a scrollable "all favourites" list vs a fixed
small grid. (See Q6 — the collection path also carries the bitmap-memory risk.)

---

## Q5 — Widget sizing (responsive / exact-size, size buckets, cells)  ✅ CONFIRMED

Source: **Provide flexible widget layouts** —
`https://developer.android.com/develop/ui/views/appwidgets/layouts`

**Android 12+ (API 31) sizing attributes** in `appwidget-provider` XML:
- `targetCellWidth` / `targetCellHeight` — target size in launcher grid cells. Verbatim: *"If
  defined, these attributes are used instead of `minWidth` or `minHeight`."*
- `maxResizeWidth` / `maxResizeHeight` — max size the launcher lets the user resize to.
- `minWidth` / `minHeight` / `minResizeWidth` / `minResizeHeight` — legacy, all versions.

**Responsive layouts (Android 12+ / API 31), preferred approach** —
`RemoteViews(Map<SizeF, RemoteViews>)`:
```kotlin
val viewMapping: Map<SizeF, RemoteViews> = mapOf(
    SizeF(150f, 100f) to smallView,
    SizeF(150f, 200f) to tallView,
    SizeF(215f, 100f) to wideView,
)
appWidgetManager.updateAppWidget(id, RemoteViews(viewMapping))
```
Verbatim: *"the system doesn't have to wake up the app every time it displays the widget in a
different size."* The launcher can also supply `OPTION_APPWIDGET_SIZES` to
`onAppWidgetOptionsChanged()` (Android 12+) for exact layouts.

**Legacy size-range approach (Android 4.1+ / API 16):** read
`OPTION_APPWIDGET_MIN_WIDTH` / `MAX_WIDTH` / `MIN_HEIGHT` / `MAX_HEIGHT` from
`getAppWidgetOptions()` in `onAppWidgetOptionsChanged()` and estimate. Docs note this *"doesn't work
in all situations."*

**How many buckets are practical:** docs' own example uses **3** (small/tall/wide); guidance is
**~2 for phones** (portrait vs landscape shape) and **~4 for foldables**. Grid-cell rule of thumb
(portrait): a cell ≈ `(73n − 16) × (118m − 16) dp` for n×m cells; a 3×2 widget ≈ 203×220 dp.

**Design consequence:** target `targetCellWidth`/`targetCellHeight` for Android 12+, provide 2–4
`SizeF` responsive buckets (e.g. a 2-col small grid vs a 3–4-col wide grid), keep a legacy fallback
for pre-12. Number of favourite tiles shown should scale by bucket.

---

## Q6 — RemoteViews bitmap / Binder memory limit (how many photos)  ⚠️ PARTLY UNVERIFIED

**What official docs DO say** — Source: **Use collection widgets** —
`https://developer.android.com/develop/ui/views/appwidgets/collections`
Verbatim caution on the `RemoteCollectionItems` path (Android 12+): the approach
> "doesn't work well if your collection contains numerous `Bitmaps` being passed to
> `setImageViewBitmap`."

**[UNVERIFIED against official docs]** The specific figures in the question — the **~1.5–2 MB Binder
transaction ceiling** and the *"exceed the maximum bitmap memory usage"* log message — are **not
stated as a quantified limit anywhere in the official `developer.android.com` App Widget docs.** That
error string originates in the AOSP framework (`RemoteViews` / `AppWidgetHostView`), not in the
developer guides, and the per-process Binder transaction buffer (~1 MB, shared) is an OS-level
implementation detail the widget docs do not commit to a number for. **Do not cite a specific MB
figure as documented.** Treat it as a real but unquantified constraint.

**What this means for the photo grid (design guidance, not a doc quote):**
- Passing many full-size contact photos via `setImageViewBitmap` across a single `RemoteViews`
  update risks overrunning the Binder transaction buffer — this is the documented failure mode above.
- Mitigations supported by docs: (a) pass images by **URI** (`setImageViewUri`) so the launcher
  loads them out-of-band rather than serialising bitmaps through the Binder call; (b) for the
  collection path, load per-item images inside `RemoteViewsFactory.getViewAt()` rather than shipping
  one giant transaction; (c) downscale photos hard — widget tiles are small (tens of dp), so decode
  to roughly the tile's pixel size (e.g. ≤ ~96–128 px square), not the stored resolution.
- **A safe favourites count cannot be quoted from docs.** Empirically the practical ceiling for
  bitmaps in one transaction is small (order of a handful of MB total); with aggressive downscaling
  and URI-based loading a grid of ~a dozen favourites is reasonable, but **this must be validated on
  the physical Pixel 6 Pro**, not asserted. Flag for a spike.

---

## Q7 — Headless broadcast PendingIntent for "mark contacted" (no Activity)  ✅ CONFIRMED

Source: **Create an advanced widget** —
`https://developer.android.com/develop/ui/views/appwidgets/advanced`

A widget click can fire a **broadcast** PendingIntent that runs a `BroadcastReceiver` /
`AppWidgetProvider` with **no Activity launch**:
> "construct a `PendingIntent`, then update the widget from the invoked `Activity`, `Broadcast`, or
> `Service`. ... if you select a `Broadcast` for the `PendingIntent`, you can choose a foreground
> broadcast to give the `BroadcastReceiver` priority."

Wire via `setOnClickPendingIntent(viewId, PendingIntent.getBroadcast(...))`. Optionally add
`Intent.FLAG_RECEIVER_FOREGROUND` to prioritise delivery.

**Caveats (documented):**
- **10-second receiver limit:** *"after 10 seconds, the system considers a `BroadcastReceiver` to be
  non-responsive."* For work that might exceed this, use `goAsync()` or hand off to `WorkManager`.
  Orbit's mark-contacted is a single-row SQLite write — comfortably sub-10s — so a plain receiver +
  `goAsync()` for the DB write is appropriate.
- **BAL is not triggered** by this path because it launches no Activity — so the Android 14/15 BAL
  opt-in (Q2) is irrelevant to mark-contacted. No foreground-service requirement either.
- **Force-stop interaction (Q1) still applies:** while the app is in the stopped state on Android 15
  the broadcast PendingIntent is cancelled and the widget greyed out until manual launch.

**Design consequence:** the "tap = mark contacted, no app launch" design is directly supported. Do
the DB write in the receiver (via `goAsync()`), then push a widget refresh
(`partiallyUpdateAppWidget`) to reflect the new "contacted" state. `react-native-android-widget`
supports a headless task on widget click — confirm it routes through a broadcast receiver, not an
Activity, so no window flashes.

---

## Q8 — Widget configuration Activity  ✅ CONFIRMED (largely Glance-first docs)

Source: **Enable users to configure widgets** —
`https://developer.android.com/develop/ui/views/appwidgets/configuration`

- Configuration activity declared with the **`android:configure`** attribute in the widget provider
  metadata; launched via the **`APPWIDGET_CONFIGURE`** action when the widget is placed.
- Must return **`RESULT_OK`** with the **`EXTRA_APPWIDGET_ID`** so the placed widget is committed
  (returning `RESULT_CANCELED` drops the placement).
- **Android 12+ (API 31) flags** in `widgetFeatures`:
  - `reconfigurable` — lets the user **reconfigure an already-placed widget** (long-press → reconfigure),
  - `configuration_optional` — skip the initial config step and use a default configuration.

**Note:** the current docs page is written Glance-first and defers much implementation detail to the
Glance guide; the Views/`RemoteViews`-based specifics (manifest declaration, result handling) are
shown via a linked sample. **[Partly unverified verbatim]** — the flag *names* and the Android 12
reconfigure capability are confirmed; exact manifest snippets were not quoted from the page.

**Design consequence:** a config Activity lets the user pick which favourites / how many tiles at
placement time, and `reconfigurable` (Android 12+) lets them change it later without removing the
widget. Since Orbit is RN, the "config activity" is itself an RN screen or a light native chooser —
`react-native-android-widget` provides a configuration hook; verify it emits `RESULT_OK` +
`EXTRA_APPWIDGET_ID` correctly.

---

## Q9 — In-app widget pinning (`requestPinAppWidget`)  ✅ CONFIRMED

Source: **Widget discoverability** —
`https://developer.android.com/develop/ui/views/appwidgets/discoverability`

- **Android 8.0 (API 26)+:** `AppWidgetManager.requestPinAppWidget(provider, options, successCallback)`
  lets the app offer an in-app **"Add widget to home screen"** button.
- Gate the UI on **`isRequestPinAppWidgetSupported()`** — only show the button when it returns `true`.
- `successCallback` is a `PendingIntent` fired **only on success** (receives `EXTRA_APPWIDGET_ID`);
  pass `null` if not needed. **Failures do not trigger the callback.**
- **Launcher support:** *"launchers that let users create pinned shortcuts also let them pin widgets"*
  — but **not all launchers support it.** When unsupported, `isRequestPinAppWidgetSupported()` returns
  `false` and `requestPinAppWidget()` has no effect (no throw, no callback).

**Design consequence:** Orbit can offer an in-app "Add Orbit widget" affordance, but must branch on
`isRequestPinAppWidgetSupported()` and fall back to instructing the user to add it from the launcher's
widget picker on launchers that don't support pinning (some OEM launchers historically do not).

---

## Q10 — Widget update frequency / battery  ✅ CONFIRMED

Sources: **Create an advanced widget** (`.../appwidgets/advanced`) and **Create a simple widget**
(`.../appwidgets`).

- **`updatePeriodMillis` minimum is 30 minutes.** Verbatim: *"`updatePeriodMillis` doesn't support
  values of less than 30 minutes."* Setting `0` disables periodic updates. Applies to all versions.
- **Recommended push pattern for data-driven widgets:** set `updatePeriodMillis` to `0` and push
  updates from the app on data change via `AppWidgetManager.updateAppWidget()` /
  `partiallyUpdateAppWidget()`; for a scrollable collection, invalidate with
  `notifyAppWidgetViewDataChanged()`. For work that must run in the background/periodically, use
  **`WorkManager`** (docs: *"similar power restrictions apply"* — App Standby Buckets).
- **Doze / App Standby:** periodic `updatePeriodMillis` alarms and `WorkManager` jobs are subject to
  Doze and App Standby Bucket throttling — updates are batched/deferred while the device is idle.

**Design consequence:** Orbit's widget is **local-first and event-driven** — it should NOT poll on a
timer. Set `updatePeriodMillis = 0` and push a widget refresh whenever the underlying data changes
(a contact marked contacted, favourites edited, status decay recomputed at app launch). The
mark-contacted tap should `partiallyUpdateAppWidget` immediately from its receiver (Q7). This also
sidesteps Doze throttling for the interactive path, since updates ride on user actions, not alarms.
The one thing a timer would be needed for — status/decay drift over hours while the app is closed —
cannot beat the 30-min floor and would be throttled by Doze anyway; recompute on next app open
instead (consistent with the app-launch sweep pattern in CLAUDE.md).

---

## Summary of design-decision impacts

| # | Constraint | Impact on design |
|---|------------|------------------|
| 1 | Android 15: force-stop greys out widgets, cancels PendingIntents until manual launch | Widget can NEVER be the sole route to core actions; re-push on launch / BOOT_COMPLETED |
| 2 | Launcher-initiated widget click & system notification tap are BAL exceptions | Long-press→profile and notif-tap→app both allowed; app-created BAL needs Android 15 creator opt-in only if launching Activity from own background |
| 3 | singleTask + onNewIntent ⇒ TaskStackBuilder does NOT build the back stack | "Back→dashboard" must be handled in JS navigation (React Navigation), not native |
| 4 | RemoteViews: no custom views, no EditText; scroll via ListView/GridView/StackView + RemoteViewsService | Scrollable "all favourites" grid IS possible (GridView + service); no text input in widget |
| 5 | Android 12+ responsive `RemoteViews(Map<SizeF,…>)`, 2–4 buckets practical | Provide 2–4 size layouts scaling tile count; legacy fallback pre-12 |
| 6 | Bitmap memory limit real but **NOT quantified in official docs** | Downscale photos to tile size, prefer `setImageViewUri`, validate favourites count on real Pixel — do not cite a MB number |
| 7 | Broadcast PendingIntent runs headless (no Activity), 10s receiver limit | tap=mark-contacted supported; DB write in receiver via goAsync(), then partiallyUpdate |
| 8 | Config Activity: `APPWIDGET_CONFIGURE`, `reconfigurable`/`configuration_optional` (Android 12+) | Placement-time favourite picker + later reconfigure supported |
| 9 | `requestPinAppWidget` (API 26+), gate on `isRequestPinAppWidgetSupported()` | In-app "Add widget" button OK; fall back to widget picker on unsupported launchers |
| 10 | `updatePeriodMillis` min 30 min; Doze throttles; push pattern recommended | Set 0, push on data change; recompute decay at app launch, never poll |

## Flagged / unverified

- **Q6 (bitmap/Binder MB ceiling):** the ~1.5–2 MB figure and the "exceed the maximum bitmap memory
  usage" message are **not present in official App Widget docs** — AOSP framework internals. Real
  constraint, unquantified by docs. Needs a device spike to fix a safe favourites count.
- **Q4/Q7/Q8 (react-native-android-widget coverage):** all native capabilities above are confirmed at
  the *platform* level. Whether the `react-native-android-widget` wrapper exposes each one
  (RemoteViewsService collections, headless broadcast click, config `RESULT_OK`/`EXTRA_APPWIDGET_ID`)
  was NOT verified here — verify against the library before planning.
- **Q8 verbatim manifest:** flag names and Android 12 reconfigure confirmed; exact manifest snippets
  not quoted (docs are Glance-first).

## Sources

- https://developer.android.com/about/versions/15/behavior-changes-all
- https://developer.android.com/guide/components/activities/background-starts
- https://developer.android.com/develop/ui/views/notifications/navigation
- https://developer.android.com/develop/ui/views/appwidgets
- https://developer.android.com/develop/ui/views/appwidgets/collections
- https://developer.android.com/develop/ui/views/appwidgets/layouts
- https://developer.android.com/develop/ui/views/appwidgets/advanced
- https://developer.android.com/develop/ui/views/appwidgets/configuration
- https://developer.android.com/develop/ui/views/appwidgets/discoverability
- https://developer.android.com/reference/android/widget/RemoteViews
