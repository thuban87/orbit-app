# Android Home-Screen Widget Integration Pipeline

## Overview

Use this process when adding or materially changing Orbit's Android home-screen widget. It keeps widget data local, renders RemoteViews from bounded inputs, routes headless writes through existing DAOs, and verifies native configuration on the physical Pixel instead of treating Metro reload as a native test.

## Architecture (Phase 12)

The registered provider is `OrbitFavourites`. `react-native-android-widget` invokes the module-scope task handler for lifecycle events and clicks; the handler renders an off-screen bitmap or commits a narrowly validated action. The widget has no SQLite table or per-instance configuration: it reads the existing ranked favourites projection.

### Provider configuration

**File:** `app.config.ts`

The widget config is a tuple passed through the existing deduping `plugins()` helper. It must retain the exact provider name because native registration, pin requests, refreshes, and the task handler all use it.

```ts
const widgetPlugin: [string, WithAndroidWidgetsParams] = [
  "react-native-android-widget",
  widgetConfig,
];
```

### Refresh and action chain

1. A committed widget-visible foreground write calls `notifyWidgetDataChanged()`.
2. `pushWidgetUpdate()` calls `requestWidgetUpdate()` for `OrbitFavourites` and swallows render failures.
3. A `WIDGET_MARK` click validates its contact ID, opens/migrates SQLite, and calls `widgetMarkContacted()`.
4. `widgetMarkContacted()` delegates to `recordTouchpoint()`; only after commit does the handler request a rerender.
5. `WidgetLinkingGate` accepts only minted `orbit://` links and resets to Dashboard plus the destination.

## File Locations

### Code

| File | Purpose |
|---|---|
| `app.config.ts` | Provider definition and local boot-receiver plugin registration. |
| `index.ts` | Module-scope `registerWidgetTaskHandler(widgetTaskHandler)`. |
| `src/services/widget/widget-render.tsx` | Size-routed RemoteViews render tree. |
| `src/services/widget/widget-data.ts` | Existing dashboard favourites projection → widget tiles. |
| `src/services/widget/widget-photo.ts` | Base64 local-photo thumbnail encoder. |
| `src/services/widget/widget-task-handler.tsx` | Headless lifecycle and mark task. |
| `src/services/widget/widget-refresh.ts` | Event-push and foreground-launch refresh wrapper. |
| `src/navigation/widget-linking.ts` | Strict `orbit://` resolver and readiness gate. |
| `plugins/withWidgetBootReceiver.js` | Generates the guarded non-exported boot receiver at prebuild. |

## How to Change the Widget

1. **Keep data state-free.** Read favourites through `loadWidgetTiles()` and preserve its rank order and nullable status. Do not add a widget table, per-widget preferences, polling, or a second status calculation.

2. **Keep images local and bounded** in `src/services/widget/widget-photo.ts`:

   ```ts
   const out = await rendered.saveAsync({
     format: SaveFormat.JPEG,
     compress: THUMB_Q,
     base64: true,
   });
   ```

   Return `null` for a missing/empty payload or encoder error. Never give RemoteViews a `file://` or `http(s)` image source.

3. **Add a widget action** in `src/services/widget/widget-render.tsx` and route it in `src/services/widget/widget-task-handler.tsx`. Validate all click data before SQLite. A write must call an existing DAO boundary; it must not write `last_contact` directly or run foreground sweep work.

4. **Add a deep link** only in `src/navigation/widget-linking.ts`. Extend the strict resolver and reset to `[Home, target]`; do not enable a React Navigation linking configuration or consume the share intent.

5. **Publish after successful data changes.** Add `notifyWidgetDataChanged()` after the owning write commits. Keep it fire-and-forget: rendering must not roll back a successful user action.

6. **Run JavaScript checks.**

   ```bash
   npx vitest run src/services/widget src/navigation/widget-linking.test.ts
   npx tsc --noEmit
   npm run check:colors
   ```

7. **Rebuild native Android output** whenever `app.config.ts`, `package.json`, a native dependency, or `plugins/withWidgetBootReceiver.js` changes. Follow [the desktop build pipeline](desktop-build-pipeline.md); a Metro refresh does not update the provider or manifest.

## What You Don't Need to Change

- Do not add a migration, widget DAO, or per-`widgetId` persistence for the global-mirror design.
- Do not alter `src/db/status.ts`; the widget carries dashboard status verbatim.
- Do not add widget polling; `updatePeriodMillis` stays `0`.
- Do not use native `TaskStackBuilder`; Dashboard-rooted Back is a JavaScript navigation reset.

## Pitfalls

1. **A headless task is not an app launch.** Do not import or invoke foreground sweep execution from the task handler.
2. **A mark must commit before refreshing.** The bitmap render can fail or exceed the headless budget; the interaction must remain durable.
3. **The release APK is not database-inspectable.** Use the debug-plus-Metro build for `run-as` row-count verification; use release for standalone widget-host proof.
4. **Force-stop and reboot differ.** A manual launch re-arms a force-stopped widget; the generated `BOOT_COMPLETED` receiver covers cold boot.
5. **Capacity is device-tunable.** Validate thumbnail size, tile counts, and layout breakpoints on the physical Pixel; an emulator cannot close this performance proof.

## Smoke Test

```bash
npx vitest run src/services/widget src/navigation/widget-linking.test.ts
npx tsc --noEmit
npm run check:colors
```

Expected: widget unit tests, TypeScript, and the colour gate all pass.

```bash
grep -q 'updatePeriodMillis: 0' app.config.ts && \
grep -q 'registerWidgetTaskHandler(widgetTaskHandler)' index.ts && \
grep -q 'android:exported": "false"' plugins/withWidgetBootReceiver.js
```

Expected: event-push configuration, headless registration, and the non-exported boot receiver are present before prebuild.
