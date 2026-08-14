# Platform verification — `react-native-android-widget`

Widget dossier (domain 12). Verifies the library's **current** capabilities against its
published source and docs, for the favourites-grid home-screen widget design.

- **Verified against:** npm `react-native-android-widget@0.22.0` (latest, published
  **2026-08-08**), unpacked via `npm pack` — source read on disk. Docs at
  <https://saleksovski.github.io/react-native-android-widget/docs/>. Repo
  `sAleksovski/react-native-android-widget` (master).
- **Date of verification:** 2026-08-14.
- **Method:** read the actual TypeScript API and the native Java (`android/src/main/java/com/reactnativeandroidwidget/…`) inside the packed tarball, not summaries. File:line citations below are into that packed `package/` tree; the same files exist in the repo.
- npm dist-tags: `latest: 0.22.0`, `alpha: 0.15.0-alpha.0`. No newer stable exists as of the verification date.

---

## Architecture (the single most design-relevant fact)

**The widget is not live RemoteViews of your components. The library renders your
entire widget tree to a native View hierarchy off-screen, rasterises it to ONE PNG
bitmap, writes that PNG to disk, and shows it in the widget as a single
`ImageView` via `setImageViewUri(content://…)`. Tappable regions are transparent
RemoteViews rectangles overlaid on top of that image.**

Evidence: `RNWidget.java:76-78` — `drawViewToBitmap(rootView)` → `saveBitmapToDisk` →
`remoteWidgetView.setImageViewUri(R.id.rn_widget_image_light, bitmapUri)`.
`RNWidget.java:115` `addClickableAreas(...)` overlays the tap targets.
`private.types.ts` confirms the model: a widget is `{ base64Image, clickableAreas[], collectionAreas[] }`.

Consequences that shape the design:

- **Text/photos are baked into a picture.** Fine for display. It also means **there is
  no text input and no live/scrollable content except via the `ListWidget` collection
  path** (which uses real RemoteViews collections — see below).
- **The classic ~1 MB RemoteViews Binder bitmap limit is largely side-stepped** for the
  main widget image: the bitmap goes to disk and is served through a read-only
  `ContentProvider` (`RNWidgetImageProvider.java:26-54`, authority
  `<pkg>.rnwidget.imageprovider`); only a small `content://` URI crosses Binder. So a
  dense favourites grid with many photos is bounded by **memory + the 30 s task budget**,
  not by the Binder transaction cap. (No explicit byte ceiling is documented or enforced
  in source — flagged as "not found," not "unlimited.")

---

## Answers to the specific questions

### 1. Current version + changelog since 0.22.0 baseline
`0.22.0` is latest (2026-08-08). Highlights back through 0.16 (CHANGELOG, npm publish times):
- **0.22.0** (2026-08-08): `requestPinWidget` added — launcher's native add-widget prompt.
- **0.21.0** (2026-07-11): `ImageWidget` `resizeMode`; `TextWidget` `lineHeight`/`lineSpacingExtra`; **expedited WorkManager** for widget background tasks on Android 12+ (reduces click/update latency); fix for crash removing widgets when stored images unreadable.
- **0.20.x** (2026-01): Accessibility / TalkBack support (`accessibilityLabel`).
- **0.19.0** (2026-01-11): **Dark-mode widgets** — `renderWidget` accepts `{ light, dark }` (`types.ts:45-50`).
- **0.18.0** (2026-01): React Native 0.83 support; examples on Expo 55.
- **0.17.0** (2025-05-16): request widget update from native code; custom widget package name.
- **0.16.0** (2025-04-10): RN 0.79; new-architecture support.

### 2. Size / responsive layout — **SUPPORTED. The small-vs-large split is valid.**
One widget definition CAN render different React trees by size:
- On resize, Android fires `onAppWidgetOptionsChanged` → the provider detects a real
  size change and dispatches a **`WIDGET_RESIZED`** headless task
  (`RNWidgetProvider.java:19-28`, `isSizeChanged` at `:78-87`). No tap needed.
- The task handler receives `widgetInfo.width` and `widgetInfo.height` (in dp) plus
  `screenInfo` (`types.ts:22-43`; `register-widget-task-handler.tsx:20-46`). Your handler
  branches on those and calls `renderWidget(<Large/>)` vs `renderWidget(<Small/>)`.
- The manifest bounds are set from the config plugin: `minWidth`, `minHeight`,
  `targetCellWidth/Height`, `maxResizeWidth/Height`, `resizeMode`
  (`config-plugin.type.ts:16-23`; written to `widgetprovider_*.xml` in `app.plugin.js:193-216`).
- **Caveat:** this is ONE resizable widget whose content adapts, not two separate widget
  types in the picker. If you want two distinct entries in the launcher's widget picker,
  declare two widgets in the plugin. Either approach works; "adapt by size" is the
  cheaper one and is exactly what the library is built for.

### 3. Click handling — headless JS, ~30 s, and in-place re-render **CONFIRMED.**
- Any primitive takes `clickAction?: string` + `clickActionData?: Record<string,unknown>`
  (`click-action.ts:1-30`).
- Non-reserved `clickAction` → provider `onReceive` → `handleWidgetClick` → a
  **`WIDGET_CLICK`** headless task carrying `clickAction` + JSON `clickActionData`
  (`RNWidgetProvider.java:43-63, 142-155`). In JS it arrives as
  `widgetAction === 'WIDGET_CLICK'` with parsed `clickActionData`
  (`register-widget-task-handler.tsx:58-96`).
- **Budget: 30 000 ms, hardcoded.** `RNWidgetBackgroundTaskWorker.java:34` —
  `new HeadlessJsTaskConfig("RNWidgetBackgroundTask", …, 30 * 1000, true)`. Still exactly
  30 s in 0.22.0. Enough to open SQLite and write one interaction row; **not** a place for
  long work.
- **(a) run arbitrary JS then (b) re-render the SAME widget in place: YES.** Inside the
  handler you do your DB write, then call `props.renderWidget(<Widget …/>)`, which routes
  to `AndroidWidget.drawWidgetById(config, widgetName, widgetId)` for *that* instance
  (`register-widget-task-handler.tsx:64-86`). This is the mechanism behind both "mark
  contacted → refresh the tile" and the §6 profile-swap stretch goal.
- Reserved strings that bypass your handler: **`OPEN_APP`** and **`OPEN_URI`** (see Q4).

### 4. Deep-link to a profile screen — **SUPPORTED via `OPEN_URI`.**
`clickAction: 'OPEN_URI'`, `clickActionData: { uri: 'orbit://contact/123' }`. Native side
does `Intent.ACTION_VIEW` on the URI with `FLAG_ACTIVITY_NEW_TASK`
(`RNWidgetProvider.java:57-58, 132-140`), i.e. a standard Android deep link you catch with
RN/Expo Linking (`onNewIntent`). `OPEN_APP` just launches the app with no params
(`:54-55, 123-130`). Both run natively without spinning up a headless task, so they are
instant — but they also cannot do a DB write. **Long-press → profile is `OPEN_URI`;
tap → mark-contacted is a headless `clickAction`.** Note there is no built-in
"long-press vs tap" distinction: a RemoteViews tap target is a single click. To get two
gestures you need two separate tap regions/buttons, not press-duration detection.

### 5. Images — base64 `data:` URIs **CONFIRMED**, plus file/http/resource.
`ImageWidgetSource = ImageRequireSource | 'http:…' | 'https:…' | 'data:image…'`
(`ImageWidget.tsx:25-29`). Native decode in `ResourceUtils.getBitmap`
(`ResourceUtils.java:35-49`): `data:` → `Base64.decode` → `decodeByteArray` (`:39-42`);
also `file://` (`:43-44`) and `http(s)` (`:46-48`, a **network fetch on the widget thread**
— avoid for contact photos, and it violates the local-first read-path rule anyway).
Each image is scaled to `imageWidth`/`imageHeight` (`ImageWidget.java:27-30, 52`).
**Recommendation stands: pass on-device contact photos as base64 `data:` URIs.** No
documented byte ceiling; the real limits are the RN-bridge payload size for the widget
config map and the 30 s render budget — pre-scale photos small (grid thumbnails) before
base64-encoding. `radius` gives rounded avatars natively (`ImageWidget.java:35-37`).

### 6. Text input — **IMPOSSIBLE (confirmed); text DISPLAY fine.**
There is no editable widget primitive — the whole surface is a rasterised bitmap plus tap
overlays (see Architecture). Exported widgets are `TextWidget` (display), `ImageWidget`,
`IconWidget`, `SvgWidget`, `FlexWidget`, `OverlapWidget`, `ListWidget` (`index.ts:10-16`).
No `EditText`/input equivalent exists. This matches the CLAUDE.md note. Any typing must
happen in the app after a deep link.

### 7. Update cadence — push updates + 30-min floor **CONFIRMED.**
- Data-driven push: `requestWidgetUpdate({ widgetName, renderWidget, widgetNotFound })`
  updates every instance (`request-widget-update.tsx`), or `requestWidgetUpdateById` for
  one (`request-widget-update-by-id.tsx`). Call these from the app whenever the DB changes
  (e.g. after editing favourites) — no polling needed.
- Automatic `updatePeriodMillis` is **clamped to a 30-minute minimum**:
  `Math.max(30*60*1000, updatePeriodMillis)` (`app.plugin.js:211-213`; documented in
  `config-plugin.type.ts:38-41`). Default is `0` = no automatic updates. **Design
  implication:** do not rely on `updatePeriodMillis` for freshness (30 min is coarse and
  battery-costly); drive freshness from `requestWidgetUpdate` on app events, and let the
  status/fuel line be recomputed at render time in the handler.

### 8. Configuration screen — **SUPPORTED (pick which favourites show).**
- Declare `widgetFeatures: 'reconfigurable' | 'reconfigurable|configuration_optional'` in
  the plugin (`config-plugin.type.ts:24-33`). This makes the plugin emit a
  `WidgetConfigurationActivity` (subclass of the library's
  `RNWidgetConfigurationActivity`) and wire the `APPWIDGET_CONFIGURE` intent-filter +
  `android:configure` (`app.plugin.js:48-94, 209-211`).
- In JS: `registerWidgetConfigurationScreen(Comp)`; the component gets `widgetInfo`,
  `renderWidget`, and `setResult('ok'|'cancel')` (`register-widget-configuration-screen.tsx:9-42`).
  `'configurable'` (plain `reconfigurable`) opens the screen when the widget is dropped;
  `reconfigurable|configuration_optional` does **not** auto-open on drop but allows
  reconfigure via long-press → Configure. **This is the correct home for "choose which
  favourites appear in this instance."**

### 9. Expo integration — config plugin, **custom dev client required (NOT Expo Go).**
Ships an Expo config plugin (`app.plugin.js`) that writes native provider Java classes,
`res/xml` provider descriptors, manifest receivers/services, fonts, and preview drawables
— all at prebuild. Add `["react-native-android-widget", { widgets: [...] , fonts: [...] }]`
to `app.json` plugins. Because it generates native code and the module has native Android
sources, it requires `expo prebuild` + a **custom dev client / EAS build**; it cannot run
in Expo Go. New-architecture supported since 0.16; RN 0.83 since 0.18. Gotchas from the
plugin source: each widget needs `minWidth`/`minHeight` (required, `config-plugin.type.ts:16-17`);
custom `packageName` must start with the app package (`app.plugin.js:231-233`); the config
Activity Java file is written into your app package (`app.plugin.js:77-94`).

### 10. Multiple instances, keyed by `widgetId` — **SUPPORTED.**
`getWidgetInfo(name)` returns an array, one `WidgetInfo` per placed instance, each with a
distinct numeric `widgetId` (`get-widget-info.ts`; `types.ts:22-43`). `WIDGET_ADDED`,
`WIDGET_CLICK`, `WIDGET_RESIZED`, `WIDGET_DELETED` all carry the `widgetId`
(`RNWidgetProvider.java`), and `requestWidgetUpdateById` targets one. **The library keeps
no per-instance app state for you** — each headless task is a fresh JS context. To make
instance A show a different favourite set (or the profile-swap "mode") than instance B,
**you persist per-`widgetId` state yourself** (SQLite/AsyncStorage) and read it in the
handler. `WIDGET_DELETED` is your hook to clean that row up.

### 11. In-app "add this widget" button — **SUPPORTED on Android 8+ / supporting launchers.**
`requestPinWidget({ widgetName })` (new in **0.22.0**) calls
`AppWidgetManager.requestPinAppWidget` (`RNWidgetPinning.java:11-39`). Resolves `false` on
API < 26 or when the launcher doesn't support pinning; `true` means the request was
*accepted by the launcher*, **not** that the user confirmed placement. Good for an
onboarding "Add Orbit widget" affordance, but must degrade gracefully (many launchers
return false).

---

## §6 stretch goal — widget swaps ITSELF into a profile view in place: **FEASIBLE, with caveats**
Mechanically supported: a `WIDGET_CLICK` handler can call `renderWidget(<ProfileView/>)`
for that `widgetId`, replacing the tile's content in place (Q3). Caveats the design must own:
1. **You persist the mode per `widgetId`** — the headless context is stateless (Q10). A
   tap that flips to profile view must write `mode=profile` for that id; a "back" tap flips
   it back; `WIDGET_DELETED` cleans it up.
2. Every transition is a **fresh 30 s headless task** that re-rasterises the whole widget —
   expect a short latency (mitigated by expedited WorkManager on Android 12+, 0.21.0), not
   an animated in-widget transition.
3. Any external `requestWidgetUpdate` (e.g. app-driven refresh) must also respect the
   stored mode or it will clobber the profile view back to the grid.

---

## What I could NOT verify / flags
- **No explicit image byte/Binder ceiling** is documented or enforced in source. The main
  widget bitmap avoids the Binder cap (served from disk via ContentProvider), but I could
  not find a stated max for base64 payloads or per-item collection images. Treat as
  memory-/timeout-bound and pre-scale thumbnails; validate on the physical Pixel 6 Pro
  (the emulator on this box cannot run, and perf/Skia claims are invalid there anyway).
- **`ListWidget` collection cap = 2 per widget**: `RNWidgetCollectionService.MAX_COLLECTION_WIDGETS = 2`
  (`RNWidgetCollectionService.java:24`). A favourites grid built as a real scrollable
  collection is limited to 2 `ListWidget`s per widget instance. A non-scrolling
  `FlexWidget` grid of `ImageWidget`s has no such cap (it's one baked bitmap) but doesn't scroll.
- **No press-duration gesture support**: "long-press vs tap" must be two separate tap
  targets/buttons, not a real long-press (Q4). Verify the two-button larger layout uses
  distinct `clickAction` regions.
- Changelog release *dates* shown by one GitHub-releases fetch were year-wrong; dates above
  are taken from **npm publish timestamps** (`npm view … time`), which are authoritative.

## Primary citations
- Source (packed `react-native-android-widget@0.22.0`): `RNWidgetBackgroundTaskWorker.java:34`
  (30 s), `RNWidgetProvider.java:19-63` (resize + click routing), `RNWidget.java:76-121`
  (bitmap architecture), `ResourceUtils.java:35-49` (image decode incl. `data:`),
  `RNWidgetImageProvider.java` (disk/ContentProvider), `RNWidgetPinning.java` (pin),
  `RNWidgetCollectionService.java:24` (collection cap), `app.plugin.js:193-216` (updatePeriod
  clamp, provider xml), `config-plugin.type.ts`, `types.ts`, `click-action.ts`,
  `register-widget-task-handler.tsx`, `register-widget-configuration-screen.tsx`, `ImageWidget.tsx`.
- Docs: <https://saleksovski.github.io/react-native-android-widget/docs/handling-clicks>,
  `…/docs/api/register-widget-task-handler`, `…/docs/tutorial/register-widget`.
- npm: <https://www.npmjs.com/package/react-native-android-widget> (0.22.0, 2026-08-08).
