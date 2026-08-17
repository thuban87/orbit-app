# Phase 12: Home Screen Widget - Research

**Researched:** 2026-08-17
**Domain:** Android home-screen widget (native RemoteViews via `react-native-android-widget`), headless SQLite write, base64 avatar encoding, `orbit://` deep-link bridge
**Confidence:** HIGH (library API verified against on-disk source + official docs; reuse map verified against actual code on disk)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Status Colour Palette (OD-1 resolved; owner-approved 2026-08-16):**
- `stable`/`wobble`/`decay` become **shared app-wide theme tokens THIS phase**, joining the existing `rogue` token. Widget bitmap AND dashboard `ContactCard` both consume them; Phase 13 (orrery) inherits the same tokens — one source of truth.
- Owner-approved hexes (rendered swatch reviewed 2026-08-16): `statusStable #45B98A`, `statusWobble #E8C15C`, `statusDecay #E56A52`, `rogue #E0904A` (unchanged). The `#F07A3D` decay alternative was declined.
- This retires `ContactCard`'s opacity-only placeholder and meets WDG-01's "each avatar carrying its status colour."

**Widget Interaction Affordances:**
- **Small tile:** whole tile/avatar = headless mark-contacted (no undo); a name-label region + a small chevron glyph = the explicit "open profile" target (two tap regions — a RemoteViews tap is a single click).
- **Larger tile:** Quick mark · Log contact · Message + per-contact fuel line; Message → the in-app Compose screen.
- **"Add Orbit widget" button lives in Settings** (`requestPinWidget`, graceful fallback to the OS picker). No onboarding surface this phase.
- Copy contract (UI-SPEC): button labels "Mark" (`✓`), "Log" (`✎`), "Message" (`✉`); empty state "Choose favourites"; add-widget CTA "Add Orbit widget"; fallback copy "Your launcher can't add it automatically — add Orbit from your home screen's widget menu."

### Claude's Discretion (implementation — per dossier "deferred to phase planning")
- Grid geometry per size bucket + max favourites per resolution — **physical-Pixel device spike** (RemoteViews bitmap-memory ceiling; the emulator cannot assess it and cannot run on this box).
- The base64 thumbnail pipeline: downscale the 512px master → tile-thumb → base64 `data:` URI; validate within RemoteViews bitmap memory; round via `ImageWidget` `radius`.
- One resizable widget (`WIDGET_RESIZED`) vs two picker entries — **resize-adapt preferred**.
- Freshness wiring: `requestWidgetUpdate` on app events; recompute status at launch via the launch-sweep hook registry (foreground only); a **separate** boot receiver for `BOOT_COMPLETED` / force-stop re-push.
- Two-tap-region hit-target construction + the JS synthetic back-stack (reuse `notification-nav` reset-to-`[Home, …]`; native `TaskStackBuilder` does not compose with app-wide `singleTask`).
- Headless `WIDGET_CLICK` mark write reuses `recordTouchpoint` (single-writer DAO + JS mutex, `source='widget'`, `connected/outbound/unspecified`, `quality=null`, 30 s budget); a widget-tap headless context must **never** run `runLaunchSweep`.
- `requestPinWidget` button + graceful fallback (returns false on unsupported launchers / API < 26).
- The `orbit://` deep-link bridge (`OPEN_URI` → React Navigation) — net-new but sanctioned; it must not handle the share intent.

### Deferred Ideas (OUT OF SCOPE)
- Widget self-swap-into-profile (in-tile profile view) — v2 / REJECTED.
- Per-instance widget config Activity / per-`widgetId` state — v2 / REJECTED (global mirror decided).
- First-run onboarding hint for the widget — Settings-only this phase.
- Larger-tile exact button copy/iconography beyond the UI-SPEC copy contract — closed by the UI-SPEC.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WDG-01 | Favourites grid in static manual rank, each avatar carrying its status colour, photos as base64 — adding no new schema or persistent state | Reuse `listDashboard({filter:'favourites'})` (already ordered `favourite_rank ASC`, carries status+progress+fuel); new base64 encoder reuses the SDK-57 `ImageManipulator` chain + `saveAsync({base64:true})`; new shared status tokens in `theme-types`/`theme-presets`; `ImageWidget image=data:` + `FlexWidget borderWidth/borderColor` ring. See Standard Stack, Architecture Patterns, Code Examples. |
| WDG-02 | Small-tile tap = headless mark-contacted (30 s, DAO+mutex, `source='widget'`); name/chevron opens profile; larger tile adds Quick mark · Log contact · Message (→ Compose) | Headless `WIDGET_CLICK` handler mirrors `notification-actions.ts` (`openAndMigrate()` → `recordTouchpoint`, deterministic-uid dedup, single cancel-free write); `OPEN_URI orbit://…` reserved click action → React Navigation. See Architecture Patterns §2/§3, Common Pitfalls. |
| WDG-03 | Freshness = event-push + launch/boot refresh (no polling); empty widget prompts "Choose favourites"; in-app "Add widget" button via `requestPinWidget` + fallback; "Back → dashboard" is JS navigation | `requestWidgetUpdate` on app write-events; a launch-sweep hook recomputes; a **separate** native `BOOT_COMPLETED` re-push path (Android 15 force-stop greying); `resolveNotificationNav`-style reset-to-`[Home,…]`. See Architecture Patterns §4/§5, Common Pitfalls. |
</phase_requirements>

## Summary

Phase 12 is dominated by ONE net-new dependency — `react-native-android-widget@0.22.0` — and the fact that it forces the project's **first committed native config change built into the existing custom dev-client entry point**. The good news the research confirms: nearly every hard part is already solved in this codebase and only needs re-wiring, not re-inventing. The favourites-with-status-and-fuel read (`listDashboard`), the single-writer mutexed mark path (`recordTouchpoint`), the headless-task-that-bootstraps-the-DB pattern (`notification-actions.ts` + `headless-task.ts`), the "Back → dashboard" synthetic reset (`notification-nav.ts` + `notification-gate.tsx`), the crash-safe 512px photo master, and the `ImageManipulator` crop/encode chain all exist and are verified on disk. The widget's genuinely new work is: (a) the base64 thumbnail encoder, (b) the RemoteViews component tree, (c) the `orbit://` `OPEN_URI` → React Navigation bridge, (d) the config-plugin + `index.ts` registration, and (e) the boot/force-stop re-push.

The library's architecture is the fact that colours everything: it does **not** render live RemoteViews — it rasterises your component tree off-screen to a single PNG and displays it with transparent tap-rectangles overlaid. Consequences: no live view, no text input, no real long-press (all already accounted for in the dossier/UI-SPEC), and the widget render runs in a **headless task with no React context** — so `useTheme()` is unavailable and colours must be resolved directly from `theme-presets`. The `ImageWidget` primitive natively decodes `data:image…` base64 URIs and rounds with `radius`; `FlexWidget` carries `borderWidth`/`borderColor`/`borderRadius` for the status ring; the reserved `OPEN_URI` click action fires an `ACTION_VIEW` deep link. All verified against the library's on-disk TypeScript source.

The two irreducible unknowns are **device-only**: the RemoteViews per-widget bitmap-memory ceiling (how many base64 thumbnails fit — a Pixel spike) and the killed-app headless-mark round-trip (the SAME FCM-less path whose on-device check was owner-accepted-deferred in Phase 11). Neither is assessable on the emulator; both must be verified on the physical Pixel via the desktop-build pipeline.

**Primary recommendation:** Install `react-native-android-widget@0.22.0` (gate behind the SUS/human-verify checkpoint — see Package Legitimacy Audit), register its config plugin + `widgetTaskHandler` in the EXISTING `index.ts`, and build the widget as a thin RemoteViews view over the existing favourites read + a new base64 encoder + a new `orbit://` linking bridge. Reuse the Phase-11 headless-write and back-stack patterns verbatim in structure. Treat grid capacity and the killed-app mark as physical-Pixel spikes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Favourites-with-status read | Database / DAO | — | `listDashboard` already projects status/progress/fuel ordered by `favourite_rank`; the widget must not re-derive status |
| Status colour resolution in the bitmap | Theme (presets module) | Widget render | Headless render has no `ThemeProvider`; colours resolve from `theme-presets` directly, never `useTheme()` |
| Base64 thumbnail encoding | Service (new `widget-photo` encoder) | expo-image-manipulator | Pure image transform reusing the existing manipulator chain; returns a `data:` URI, not a file path |
| Widget RemoteViews tree | Widget render (headless) | — | `FlexWidget`/`ImageWidget`/`TextWidget`; rasterised off-screen to a PNG |
| Headless mark-contacted write | Database / single-writer DAO | Headless task | `recordTouchpoint` behind the shared mutex; `source='widget'`; must bootstrap `openAndMigrate()` first |
| Tap → mark vs tap → open routing | Widget task handler (`WIDGET_CLICK`) + OS `OPEN_URI` | — | Non-reserved `clickAction` = headless write; reserved `OPEN_URI` = native `ACTION_VIEW` deep link |
| Deep-link → screen | Navigation (React Navigation, JS) | expo-linking / `Linking` listener | `TaskStackBuilder` does not compose with `singleTask`+`onNewIntent`; "Back → dashboard" is a JS reset |
| Freshness (event-push) | App write paths | `requestWidgetUpdate` | Push on open/edit/favourite-change/mark; recompute at launch via the sweep hook |
| Boot / force-stop re-push | Native `BOOT_COMPLETED` receiver | `RNWidgetJsCommunication#requestWidgetUpdate` | Android 15 force-stop greys the widget; must re-push on boot AND launch — a SEPARATE path from the foreground sweep |
| Add-widget CTA | Settings screen (RN) | `requestPinWidget` | Returns false on unsupported launchers / API < 26 → fallback copy |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native-android-widget` | `0.22.0` (latest) | The only maintained library that renders RN component trees to Android `RemoteViews` widgets with an Expo config plugin | The dossier verified it first-hand (unpacked 0.22.0 from npm, read on disk); peerDep `expo>=54.0.0` satisfies SDK 57; no postinstall. `[VERIFIED: npm registry — pending human-verify checkpoint, see audit]` |
| `expo-image-manipulator` | `~57.0.10` (ALREADY a dep) | Downscale the 512px master → tile thumb and emit base64 | Already used by `photo-pipeline.ts`; `saveAsync({base64:true})` returns the raw JPEG base64 `[VERIFIED: node_modules/expo-image-manipulator/build/ImageManipulator.types.d.ts:19-24,89-93]` |
| `expo-file-system` | `~57.0.4` (ALREADY a dep) | Fallback base64 read (`readAsStringAsync`) if the manipulator base64 path is undesirable; resolve the master `file://` | Already the photo-storage backbone `[VERIFIED: package.json]` |
| `expo-task-manager` | `~57.0.10` (ALREADY a dep) | Not required by the widget library (it registers its own headless entry) but confirms the headless-task runtime is present | `[VERIFIED: package.json]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-navigation/native` | `^7.3.16` (ALREADY a dep) | Apply the `orbit://` deep-link intent via the existing `navigationRef` | Reuse `navigationRef` from `src/navigation/linking.ts` — do NOT add a second navigation container |
| `expo-linking` | (transitively present via Expo) | Optional: parse the incoming `orbit://` URL if you choose a `Linking.addEventListener` bridge over React Navigation's `linking` config | Only one path is needed — see Architecture Patterns §3 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-native-android-widget` | Hand-rolled native `AppWidgetProvider` + Kotlin RemoteViews | Rejected: the widget metaphor (status-colour avatars, base64 photos, resize) would be entirely bespoke native; the library already solves off-screen rasterise + click routing + Expo plugin. No plugin predecessor exists to port. |
| `ImageManipulator.saveAsync({base64:true})` | `expo-file-system` `readAsStringAsync(uri,{encoding:'base64'})` on the saved file | Both valid. The manipulator-inline base64 avoids a second FS round-trip; the FS read is the fallback if you want to persist a thumbnail file too. Recommend the inline path (no new persistent state, per WDG-01). |
| React Navigation `linking` config | `Linking.addEventListener('url', …)` → `navigationRef` | The `Linking` listener is lower-risk here: a `linking` config with `getInitialURL`/`subscribe` risks racing the share-intent singleton (the exact hazard `linking.ts` documents). Prefer the explicit listener → `navigationRef.reset(...)`. See Pitfall 4. |

**Installation:**
```bash
npx expo install react-native-android-widget
# expo-image-manipulator, expo-file-system, expo-task-manager already installed
```
Use `npx expo install` (not bare `npm install`) so the version is SDK-57-aligned, matching the repo's established convention (09-01, 08-08).

**Version verification (performed this session):**
```
npm view react-native-android-widget version        → 0.22.0
npm view react-native-android-widget@latest time.modified → 2026-08-08
npm view react-native-android-widget@latest peerDependencies → { expo: '>=54.0.0', react: '*', react-native: '*' }
npm view react-native-android-widget@latest scripts.postinstall → (none)
```

## Package Legitimacy Audit

| Package | Registry | Age (0.22.0 publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `react-native-android-widget` | npm | 0.22.0 published 2026-08-08 (~10 days) | ~46,256/wk | github.com/sAleksovski/react-native-android-widget | **[SUS]** (`too-new`) | **Flagged — planner MUST add a `checkpoint:human-verify` before install** |

**Interpretation:** The seam flagged `too-new` purely because the **0.22.0 version bump** is recent (2026-08-08); the **package itself is mature** — ~46k weekly downloads, an established public repo, no `postinstall`, MIT-ish OSS lineage, and it was already unpacked-and-read-on-disk at 0.22.0 during the dossier investigation (`workpapers/12-widget/platform-library.md`, per the dossier Findings). This is a false-positive on the latest-version publish date, not a hallucination or slopsquat signal. Nonetheless, per the legitimacy protocol a **SUS verdict must be gated**: the planner inserts a `checkpoint:human-verify` task before the `expo install` (the owner's other project mirrors this discipline; the owner already approved a similar drag-library checkpoint in 08-08). The package name here is `[VERIFIED via official GitHub docs + on-disk source read]`, but registry-age gating still applies.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `react-native-android-widget` (planner adds one `checkpoint:human-verify` before install).

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────────────────────────────────┐
   HOME SCREEN            │  Android launcher — widget host (RemoteViews) │
   (outside the app)      └───────────────┬───────────────┬──────────────┘
                                           │ tap           │ (renders PNG + tap-rects)
              non-reserved clickAction ────┤               ├──── reserved OPEN_URI clickAction
                   "WIDGET_MARK"           │               │        (uri: orbit://…)
                                           ▼               ▼
                         ┌─────────────────────────┐   ┌──────────────────────────┐
                         │ widgetTaskHandler        │   │ native ACTION_VIEW intent │
                         │ (headless JS, 30s budget)│   │ → singleTask/onNewIntent  │
                         │  WIDGET_CLICK case       │   └───────────┬──────────────┘
                         └───────────┬─────────────┘               │ (app process)
       openAndMigrate() ────────────┤                              ▼
       (bootstraps DB, H1)          │                  ┌──────────────────────────┐
                                     ▼                  │ orbit:// linking bridge   │
                         ┌─────────────────────────┐    │ (Linking listener OR RN   │
                         │ recordTouchpoint(...)    │    │  linking) → navigationRef │
                         │ source='widget'          │    └───────────┬──────────────┘
                         │ SHARED withMutex()       │                │
                         └───────────┬─────────────┘    reset [Home, Compose|Profile]
                                     │ (writes last_contact)         │ "Back → dashboard"
                                     ▼                               ▼
                         ┌─────────────────────────┐    ┌──────────────────────────┐
                         │ SQLite (contacts,        │◄───┤ React Navigation screens  │
                         │ interactions)            │    │ (Compose / Profile / …)   │
                         └───────────┬─────────────┘    └──────────────────────────┘
                                     │
   FRESHNESS (no polling):          │ app write events → requestWidgetUpdate({name, renderWidget})
     • app open/edit/favourite/mark │      → widgetTaskHandler re-renders bitmap
     • launch sweep hook (fg only)  │
     • BOOT_COMPLETED receiver ─────┘  (SEPARATE native path; Android-15 force-stop recovery)
                 │
                 ▼
   widgetTaskHandler(WIDGET_UPDATE) → listDashboard({filter:'favourites'}) →
        base64-encode each thumb → FlexWidget/ImageWidget/TextWidget tree → PNG
```

The reader can trace the two primary use cases: (1) a small-tile tap flows down the left spine (headless `WIDGET_CLICK` → `openAndMigrate` → mutexed `recordTouchpoint` → SQLite → a `requestWidgetUpdate` re-render); (2) a name/chevron or action-button tap flows down the right spine (`OPEN_URI` → native `ACTION_VIEW` → the `orbit://` bridge → `navigationRef.reset` → the screen).

### Recommended Project Structure
```
src/services/widget/
├── widget-task-handler.tsx   # registerWidgetTaskHandler entry: switch on widgetAction
├── widget-render.tsx         # the FlexWidget/ImageWidget/TextWidget trees (small/large/empty)
├── widget-data.ts            # reads listDashboard({filter:'favourites'}) + shapes tiles
├── widget-photo.ts           # NEW base64 thumbnail encoder (512px master → data: URI)
├── widget-refresh.ts         # requestWidgetUpdate wrapper + launch-sweep hook registration
└── widget-colors.ts          # resolve status hex from theme-presets (NO useTheme in headless)
src/navigation/
└── widget-linking.ts         # NEW orbit:// OPEN_URI → navigationRef bridge (mirrors notification-gate)
android/ (generated by prebuild)
└── …BootReceiver             # NEW BOOT_COMPLETED receiver via a small config-plugin mod OR expo-router-free native
index.ts                      # ADD: registerWidgetTaskHandler(widgetTaskHandler)
app.config.ts                 # ADD: ['react-native-android-widget', widgetConfig] plugin entry
```

### Pattern 1: Config-plugin registration + custom entry point
**What:** The Expo config plugin declares the widget provider(s); the task handler is registered at module scope in the app entry file.
**When to use:** Once, at native enablement.
**Critical:** The project ALREADY has a custom `index.ts` entry (created in Phase 10 for share-intent) — the registration is a TWO-LINE ADDITION, not a net-new entry file.
```tsx
// index.ts  — ADD to the existing file (do not recreate)
// Source: docs/docs/api/register-widget-task-handler.md (github: sAleksovski/react-native-android-widget)
import { registerRootComponent } from "expo";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import App from "./App";
import { widgetTaskHandler } from "./src/services/widget/widget-task-handler";

registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
```
```ts
// app.config.ts — ADD one plugin entry inside the deduped plugins() builder.
// Source: docs/docs/tutorial/register-widget-expo.md
import type { WithAndroidWidgetsParams } from "react-native-android-widget";
const widgetConfig: WithAndroidWidgetsParams = {
  widgets: [{
    name: "OrbitFavourites",              // the name passed to requestWidgetUpdate / requestPinWidget
    label: "Orbit — Favourites",
    minWidth: "250dp", minHeight: "110dp",
    targetCellWidth: 4, targetCellHeight: 2,   // Android 12+ sizing
    description: "Your favourite people, one tap to mark contacted",
    previewImage: "./assets/widget-preview/orbit-favourites.png",
    updatePeriodMillis: 0,                 // 0 = no polling (WDG-03: event-push only)
  }],
};
// Append ['react-native-android-widget', widgetConfig] to the returned plugins array,
// through the SAME dedupe-by-name builder that already guards expo-image-picker/expo-share-intent.
```
**Anti-pattern:** adding the plugin as a bare string (it is a `[name, params]` TUPLE — like `expo-image-picker`/`expo-share-intent`, it cannot be Set-deduped; append it once past the name filter, per the 01-01 duplicate-plugin prebuild hazard already handled in `app.config.ts`).

### Pattern 2: Headless `WIDGET_CLICK` mark — mirror `notification-actions.ts` exactly in structure
**What:** The task handler's `WIDGET_CLICK` case bootstraps the DB, then writes through the single-writer mutexed DAO, within the 30 s budget.
**When to use:** The whole-tile / "Mark" button tap.
```tsx
// widget-task-handler.tsx (WIDGET_CLICK branch) — structure mirrors notification-actions.ts:104-160
// Source: src/services/notifications/notification-actions.ts (verified on disk)
case "WIDGET_CLICK": {
  if (props.clickAction === "WIDGET_MARK") {
    const contactId = Number(props.clickActionData?.contactId);
    await openAndMigrate();                 // H1: the ONLY thing that opens the DB in a headless launch
    const exec = getExecutor();
    const now = localDateTime();
    await recordTouchpoint(exec, {          // SHARED mutex + single-writer DAO
      contactId, uid: widgetMarkUid(contactId, now),  // deterministic-ish uid; see dedup note
      occurredAt: now, now,
      source: "widget", direction: "outbound", channel: "unspecified",
      connected: 1, quality: null,
    });
    await requestWidgetUpdate({ widgetName: "OrbitFavourites", renderWidget: renderFavourites });
  }
  break;
}
```
**Hard rules (all verified against the Phase-11 code on disk):**
- `openAndMigrate()` BEFORE `getExecutor()` — `getExecutor()` THROWS pre-open (`database.ts`), and in a killed-app headless launch React never mounts so App.tsx's open effect never runs (`notification-actions.ts:120-125`).
- `recordTouchpoint` already wraps its body in `withMutex` → hand-rolled `BEGIN/COMMIT` (`recency-dao.ts:214-240`, `mutex.ts:32-36`). The mutex comment already names Phase-12 widget taps. Do NOT issue a raw `UPDATE last_contact`; do NOT nest `inWriteTransaction`.
- The write MUST fit the **30 s hardcoded budget** (`RNWidgetBackgroundTaskWorker.java:34`, per dossier). One SQLite write is well within it.
- **Dedup:** unlike a notification (which has an occurrence-scoped identifier), a widget tap has no natural once-only key. A same-second double-tap should insert TWO rows only if genuinely two taps — but a re-delivered single tap should not. Recommendation: mint the interaction `uid` with `newUid()` (distinct rows are correct for genuine repeat taps — mirrors 04-log "same-day repeat taps insert distinct rows", LOG-06), and rely on the OS delivering `WIDGET_CLICK` once per tap. Do NOT copy the notification's deterministic-uid collision backstop unless the device spike shows double-delivery. `[ASSUMED — verify double-delivery behaviour on the Pixel spike]`

### Pattern 3: `orbit://` `OPEN_URI` → React Navigation bridge (mirror `notification-gate.tsx`)
**What:** Reserved `clickAction="OPEN_URI"` + `clickActionData={{ uri: "orbit://contact/123" }}` fires a native `ACTION_VIEW`; a JS listener resolves it to a `navigationRef` reset/navigate.
**When to use:** name/chevron (→ Profile), "Log" (→ Profile/log), "Message" (→ Compose), empty tile (→ Manage favourites).
```tsx
// src/navigation/widget-linking.ts — mirrors notification-gate.tsx / notification-nav.ts (verified on disk)
// A PURE resolver (node-testable, no RN import) + a thin gate that applies it to navigationRef.
export type WidgetNavIntent =
  | { type: "reset"; index: 1; routes: [{name:"Home"}, {name:"Compose"; params:{contactId:number}}] }
  | { type: "reset"; index: 1; routes: [{name:"Home"}, {name:"Profile"; params:{contactId:number}}] }
  | { type: "navigate"; name: "ManageFavourites" };

export function resolveWidgetUri(url: string): WidgetNavIntent | null {
  // parse orbit://contact/<id>, orbit://compose/<id>, orbit://favourites
  // return a reset onto [Home, <screen>] so Back ALWAYS lands on the dashboard
  // (notification-nav.ts:58-80 pattern — TaskStackBuilder does NOT compose with singleTask).
}
```
- Apply via the SAME `navigationRef` in `src/navigation/linking.ts` (imperative ref onto the mounted `NavigationContainer`) — do NOT add a second container.
- Gate it on the reactive `navReady` flag App.tsx already exposes (`App.tsx:205`, `onReady`) and queue a pre-ready intent, exactly as `NotificationResponseGate` and `ShareIntentGate` do.
- **"Back → dashboard"** = `nav.reset({ index:1, routes:[{name:"Home"}, target] })` (`notification-gate.tsx:91-95`), NOT native `TaskStackBuilder`.

### Pattern 4: Headless render resolves colours WITHOUT `useTheme()`
**What:** The widget tree renders inside the headless task with NO `ThemeProvider` mounted; colours must come from the presets module.
```tsx
// widget-colors.ts
// Source: src/theme/theme-presets.ts (the ONLY colour-literal file; check:colors gate) + resolvePalette()
import { resolvePalette, DEFAULT_PRESET_ID } from "@/theme/theme-presets";
export function widgetPalette() {
  // dark-first: the widget inherits space-dark (light palette falls back to dark today)
  return resolvePalette(DEFAULT_PRESET_ID, "dark");
}
// status ring colour: palette.statusStable | statusWobble | statusDecay | rogue
```
The `ImageWidget`/`FlexWidget` colour props are typed `` `#${string}` | `rgba(...)` `` (`style.props.ts:1-4`), i.e. the exact hex strings the presets already hold. `check:colors` allows hex only in `theme-presets.ts`, so the widget render passing `palette.statusDecay` (a variable) is compliant. **Never** inline a hex in the widget tree.

### Pattern 5: Freshness — event-push + launch hook + a SEPARATE boot receiver
- **Event push (foreground):** call `requestWidgetUpdate({ widgetName, renderWidget, widgetNotFound })` after any app write that changes what the widget shows (mark, favourite add/remove/reorder, contact edit, photo change). `requestWidgetUpdate` cycles every placed instance and no-ops via `widgetNotFound` when none exist (`request-widget-update.md`, verified).
- **Launch recompute (foreground only):** register a `SweepHook` on the existing launch-sweep registry (`registerSweepHook`, `launch-sweep.ts:45-47`) that recomputes + pushes. This runs once per real `background→active` launch and NEVER on a headless tap (`launch-sweep.ts:10-14`) — the exact rule the widget must honour.
- **Boot / force-stop (SEPARATE native path):** Android 15 force-stop greys the widget and cancels its PendingIntents until a manual launch (dossier Findings Q1). A `BOOT_COMPLETED` broadcast receiver must call the library's native `com.reactnativeandroidwidget.RNWidgetJsCommunication#requestWidgetUpdate(context, "OrbitFavourites")` (`update-widget.md`, verified) to re-arm from cold. This is NOT the same path as the foreground sweep and needs a native receiver (config-plugin manifest addition or a small custom plugin). `[CITED: update-widget.md — native requestWidgetUpdate]`

### Anti-Patterns to Avoid
- **Running `runLaunchSweep` from the widget headless task.** The sweep is foreground-only (`launch-sweep.ts:10-14`); a headless tap must never reach it. Import nothing that triggers it.
- **`useTheme()` in the widget render.** No provider is mounted in the headless render; resolve from `theme-presets`.
- **A second `NavigationContainer` or a `linking` `getInitialURL` for the share/deep-link.** Reuse `navigationRef`; a competing `linking` consumer races the share-intent singleton (`linking.ts` documents this exact hazard).
- **`http(s)` or `file://` image sources in the widget.** RemoteViews can't read `file://`, and network on the widget thread violates local-first. base64 `data:` ONLY (dossier "Decisions made without you" #3).
- **`updatePeriodMillis > 0`.** Floors at 30 min, Doze-throttled — polling. Keep it `0` (WDG-03).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Off-screen RemoteViews rasterise + tap rects | A native `AppWidgetProvider` + custom `RemoteViews` builder | `react-native-android-widget` `FlexWidget`/`ImageWidget`/`TextWidget` | The library already rasterises to a PNG + overlays tap-rectangles; bespoke native is enormous |
| base64 encode of a downscaled JPEG | Manual `Buffer`/`btoa` over raw bytes | `ImageManipulator…saveAsync({base64:true})` (already a dep) | Native, correct, returns the exact `data:image/jpeg;base64,` payload `ImageWidget` consumes |
| `last_contact` write from the widget | A fresh `UPDATE contacts SET last_contact` in the handler | `recordTouchpoint` behind `withMutex` | DATA-04 single-writer invariant; the MAX-recompute + rarely-responds filter + mutex are load-bearing |
| "Back → dashboard" after a deep link | Native `TaskStackBuilder` | JS `navigationRef.reset([Home, target])` | `TaskStackBuilder` does not compose with app-wide `singleTask`+`onNewIntent` (dossier Q3) |
| Favourites-with-status query | A new widget-specific SELECT | `listDashboard({ filter:'favourites', sort })` | Already ordered `favourite_rank ASC`, already projects status/progress/fuel, already excludes archived; re-deriving status risks the never-contacted='stable' bug (HIGH-1) |
| Missing-photo avatar | A new fallback scheme | `swatchIndex(name)` + `avatarSwatches` + `getInitials` (`avatar-initials.ts`) | The deterministic themed scheme already exists; a second one drifts |
| Deep-link → screen mapping | Ad-hoc string parsing in the gate | A pure `resolveWidgetUri` resolver (mirror `notification-nav.ts`) | Node-testable, keeps OS/nav out of the correctness core |

**Key insight:** This phase is ~80% re-wiring existing, verified subsystems and ~20% genuinely new (the library, the base64 encoder, the `orbit://` bridge, the boot receiver). The temptation to "just write it fresh in the headless task" is where DATA-04 / freshness / status-derivation bugs are born.

## Runtime State Inventory

> This phase adds NO new schema and NO new persistent state (dossier cross-domain export `[widget → data/backup]`; UI-SPEC; WDG-01). It is not a rename/migration phase. The inventory below is included because the widget introduces **OS-registered state** and a **native entry-point change**, which the standard grep will not surface.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (SQLite) | **None new.** The widget reads existing `contacts.favourite_rank`, derived status, `fuel`, `contacts.photo`. A widget mark writes an ordinary `interactions` row via `recordTouchpoint` (same rows as every other mark). | None — no migration, no new column. Confirmed against dossier + `dashboard-read.ts`/`recency-dao.ts` on disk. |
| Live service config | **None.** No external service; local-first. | None. |
| OS-registered state | **NEW: the Android AppWidgetProvider** registered by the config plugin (widget name `OrbitFavourites`), placed widget instances on the launcher, and a **NEW `BOOT_COMPLETED` receiver**. Also the `orbit://` scheme (already registered — `app.config.ts:20`) gains widget-originated `ACTION_VIEW` intents. | Config-plugin prebuild registers the provider + receiver in the manifest; the boot receiver must survive the regenerated manifest. Verify `allowBackup=false`, portrait-lock, `singleTask`, and existing plugins are preserved (see Pitfall 6). |
| Secrets / env vars | **None.** | None. |
| Build artifacts / entry point | **NEW native module** (`react-native-android-widget`) → the project's FIRST committed native change beyond existing plugins; **`index.ts` gains `registerWidgetTaskHandler`** (entry file already exists from Phase 10). A dev-client rebuild is required. `package.json main` already points at `index.ts` — no change there. | Rebuild the dev client / release APK on the desktop (`ssh droid`, rsync/scp — never git push). The library is Android-only; no iOS impact. |

**The canonical question — what still holds old state after every file is updated?** Placed widget instances on the launcher hold a rendered PNG until the next `requestWidgetUpdate`; force-stop greys them until launch/boot re-push. This is the freshness model, not a migration hazard.

## Common Pitfalls

### Pitfall 1: `getExecutor()` throws in the headless render/mark
**What goes wrong:** The widget's `WIDGET_UPDATE`/`WIDGET_CLICK` runs in a killed-app headless context; calling `getExecutor()` before `openAndMigrate()` throws "getDb() called before openAndMigrate() completed".
**Why:** React never mounts in the headless context, so App.tsx's open effect never runs (verified: `notification-actions.ts:120-125`, `headless-task.ts:20-24`).
**How to avoid:** `await openAndMigrate()` (idempotent — cached when already open) FIRST in any handler branch that touches the DB, including the render read.
**Warning signs:** widget renders blank / mark silently drops on a cold launcher tap after the app was killed.

### Pitfall 2: RemoteViews bitmap-memory ceiling (grid capacity) — device-only
**What goes wrong:** Too many base64 thumbnails in one widget bitmap → the render fails or truncates; the dossier flags this as real-but-unquantified.
**Why:** The main image is served from disk so the ~1 MB Binder cap is side-stepped, but the render is memory/30 s-bound and the ceiling is not in official docs.
**How to avoid:** Downscale hard (recommend a **~72–96 px** tile thumbnail at JPEG q≈0.6 — smaller than the 512px master; a 6-tile grid of ~88px thumbs is a few tens of KB base64 each). Spike the actual max-favourites-per-resolution on the **physical Pixel** (emulator can't run on this box and gives invalid perf). Truncate favourites beyond capacity by rank (dossier Cluster A).
**Warning signs:** blank/partial widget at higher favourite counts; only reproducible on-device.

### Pitfall 3: killed-app headless mark round-trip — device-only (Phase-11 deferred check rides here)
**What goes wrong:** The headless mark works warm but the FCM-less killed-app path can't be exercised in vitest (no native task runtime) — the SAME path whose on-device check was owner-accepted-deferred in Phase 11.
**Why:** The native headless bring-up only exists on the device.
**How to avoid:** Plan an explicit Pixel UAT: kill the app, tap the widget mark, read the written row back via `run-as com.bwales.orbit`. Verify BOTH the widget mark AND the still-pending Phase-11 notification headless mark together (STATE.md / 11-VERIFICATION.md). Structure the write to mirror the proven `notification-actions` handler so the risk is bring-up, not logic.
**Warning signs:** mark works in foreground, no row after a killed-app tap.

### Pitfall 4: a `linking` config racing the share-intent singleton
**What goes wrong:** Adding a React Navigation `linking={{ getInitialURL, subscribe }}` for `orbit://` competes with `ShareIntentProvider`'s consumption of the native pending-intent singleton on cold start.
**Why:** Two consumers of the launch intent race (documented in `linking.ts`).
**How to avoid:** Do NOT add a `linking` config. Use an explicit `Linking.addEventListener('url', …)` + `getInitialURL()` ONLY for `orbit://` widget deep links, resolving through `navigationRef`, and ensure it does not consume/short-circuit the share `text/plain` path. The share intent stays the provider's job (single owner).
**Warning signs:** shared links stop opening the capture picker after the widget bridge lands.

### Pitfall 5: freshness leaks into the headless tap (running the sweep)
**What goes wrong:** Recomputing "at launch" from the widget handler accidentally invokes `runLaunchSweep` in the headless context.
**Why:** The sweep hosts quarantine expiry / purge / reconcile and must run once per real foreground launch only.
**How to avoid:** The widget's launch recompute is a `SweepHook` registered on the EXISTING registry (fires from `installSweepTrigger`, foreground). The headless `WIDGET_CLICK`/`WIDGET_UPDATE` must import nothing that reaches the sweep (`launch-sweep.ts:10-14`).
**Warning signs:** quarantine/purge side effects firing on a widget tap.

### Pitfall 6: the regenerated manifest drops a hardened attribute
**What goes wrong:** `expo prebuild --clean` for the new native module regenerates `AndroidManifest.xml`; a mis-ordered plugin could lose `allowBackup=false`, portrait-lock, `singleTask`, or an existing plugin.
**Why:** First committed native change; the widget provider + boot receiver are new manifest entries.
**How to avoid:** Append the widget plugin through the existing dedupe-by-name `plugins()` builder (`app.config.ts:57-108`); after prebuild on `droid`, assert the release manifest still carries `android:allowBackup="false"` (T-02-13, verified in `app.config.ts:36`), portrait orientation, `launchMode="singleTask"`, and every prior plugin. Mirror the 02-06 manifest assertion step.
**Warning signs:** DB pullable via `adb backup`; app rotates; share/notification intents arrive on a fresh task instead of `onNewIntent`.

### Pitfall 7: the "Log" action has no dedicated route
**What goes wrong:** The larger-tile "Log" button deep-links to "the full log flow," but the navigation param list has no `Log` route (`src/navigation/types.ts` — only Home/Settings/…/Profile/Compose/Capture etc.).
**Why:** In-app, logging is a one-tap action surfaced on the Profile/timeline (Phase 6), not a standalone screen.
**How to avoid:** Decide the `orbit://` "Log" target during planning. Most consistent: `orbit://contact/{id}` → **Profile** (where the timeline + "Log contact" one-tap live), reusing the existing Profile route. Confirm with the owner if a direct log-refine sheet is wanted instead. `[ASSUMED: Log → Profile]`

## Code Examples

### Base64 thumbnail encoder (NEW — reuses the existing manipulator chain)
```ts
// src/services/widget/widget-photo.ts
// Source: expo-image-manipulator (installed) ImageRef.saveAsync({base64}) — verified in node_modules d.ts
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { resolvePhotoUri } from "@/services/photos/photo-storage";

const THUMB_PX = 88;       // device-spike-tunable; small keeps the grid under the bitmap ceiling
const THUMB_Q = 0.6;

/** 512px master (relative path) → a `data:image/jpeg;base64,…` URI for ImageWidget. Null if no photo. */
export async function encodeWidgetThumb(relativePath: string | null): Promise<string | null> {
  if (!relativePath) return null;
  const fileUri = resolvePhotoUri(relativePath);       // file:// of the master (photo-storage.ts:130)
  const rendered = await ImageManipulator.manipulate(fileUri)
    .resize({ width: THUMB_PX, height: THUMB_PX })
    .renderAsync();
  const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: THUMB_Q, base64: true });
  return `data:image/jpeg;base64,${out.base64}`;        // out.base64 present when base64:true
}
```

### Avatar tile with status ring (NEW render; reuses tokens + fallback helpers)
```tsx
// widget-render.tsx (small-tile cell) — colour props are hex strings from theme-presets (check:colors OK)
// Source: react-native-android-widget primitives (github src/widgets/*), style.props.ts, avatar-initials.ts
import { FlexWidget, ImageWidget, TextWidget } from "react-native-android-widget";

function AvatarTile({ tile, palette }: { tile: WidgetTile; palette: WidgetPalette }) {
  const ring = ringColor(tile.status, palette);        // statusStable|statusWobble|statusDecay|rogue|border
  const weight = ringWeight(tile.status);              // stable 2 · wobble 3 · decay 4 · rogue 3 (UI-SPEC)
  return (
    <FlexWidget
      clickAction="WIDGET_MARK" clickActionData={{ contactId: tile.id }}
      accessibilityLabel={`Mark ${tile.name} contacted`}
      style={{ borderWidth: weight, borderColor: ring, borderRadius: 44, padding: 4 }}
    >
      {tile.thumb
        ? <ImageWidget image={tile.thumb} imageWidth={80} imageHeight={80} radius={40} />
        : <FlexWidget style={{ width: 80, height: 80, borderRadius: 40,
            backgroundColor: palette.avatarSwatches[tile.swatchIndex], alignItems:"center", justifyContent:"center" }}>
            <TextWidget text={tile.initials} style={{ color: palette.avatarSwatchText, fontSize: 24 }} />
          </FlexWidget>}
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: `orbit://contact/${tile.id}` }}
        accessibilityLabel={`Open ${tile.name}`}
        style={{ backgroundColor: palette.surfaceElevated, borderRadius: 8, paddingHorizontal: 6 }}>
        <TextWidget text={`${tile.name} ›`} style={{ color: palette.textPrimary, fontSize: 13 }} maxLines={1} />
      </FlexWidget>
    </FlexWidget>
  );
}
```
(`ImageWidget.image` accepts `` `data:image${string}` `` and `radius` rounds it — verified `src/widgets/ImageWidget.tsx:29-50`. `FlexWidget` border/radius/backgroundColor props verified `style.props.ts:27-54`. `OPEN_URI` reserved action verified `click-action.ts`.)

### Event-push refresh wrapper
```ts
// src/services/widget/widget-refresh.ts
// Source: request-widget-update.md (verified) + launch-sweep.ts registry (on disk)
import { requestWidgetUpdate } from "react-native-android-widget";
import { registerSweepHook } from "@/services/launch-sweep";
import { renderFavourites } from "./widget-render";

export async function pushWidgetUpdate(): Promise<void> {
  await requestWidgetUpdate({
    widgetName: "OrbitFavourites",
    renderWidget: renderFavourites,           // async-loads listDashboard + encodes thumbs
    widgetNotFound: () => {},                  // no-op when no instance is placed
  });
}
// Register the foreground launch recompute ONCE (mirror App.tsx's one-shot guards, App.tsx:73-81):
export function registerWidgetSweep() { registerSweepHook(pushWidgetUpdate); }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `manipulateAsync(uri, actions, opts)` | Chainable `ImageManipulator.manipulate(uri).resize().renderAsync()` then `saveAsync()` | expo-image-manipulator SDK 52+ | The repo's `photo-pipeline.ts` already uses the new API; the widget encoder must too (not the deprecated `manipulateAsync`) |
| Widget deep link via `TaskStackBuilder` | JS `navigationRef.reset([Home, target])` | app-wide `singleTask` (Phase 10) | Native back-stack doesn't compose with `singleTask`; "Back → dashboard" is JS |
| `updatePeriodMillis` polling | Event-push `requestWidgetUpdate` + boot re-push | this phase (WDG-03) | No battery/Doze cost; force-stop recovery via `BOOT_COMPLETED` |

**Deprecated/outdated:**
- `ImageManipulator.manipulateAsync` — superseded by the chainable context API (already the repo standard).
- Any expectation of live RemoteViews / long-press / text-input in the widget — architecturally impossible (off-screen PNG rasterise); already designed around.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Widget-mark interaction `uid` uses `newUid()` (distinct rows per genuine tap), NOT the notification's deterministic-collision backstop | Pattern 2 | If the OS double-delivers `WIDGET_CLICK`, a single tap could write two rows. Verify delivery-once on the Pixel spike; add a deterministic uid only if needed. |
| A2 | The `orbit://` "Log" button routes to **Profile** (`orbit://contact/{id}`), reusing the existing Profile timeline/log surface | Pitfall 7 | If the owner wants a direct log-refine sheet, a new route/param is needed. Owner-confirmable at planning. |
| A3 | Recommended tile thumbnail ~72–96 px at q≈0.6 keeps a 6-tile grid under the RemoteViews bitmap ceiling | Pitfall 2 | The real ceiling is device-only; the number is a starting point for the Pixel spike, not a verified limit. |
| A4 | The `BOOT_COMPLETED` re-push uses the library's native `RNWidgetJsCommunication#requestWidgetUpdate`; a receiver is added via a config-plugin manifest mod | Pattern 5 | If the config plugin cannot register a custom receiver cleanly, a small standalone Expo config plugin (or manual manifest mod via a plugin) is needed — verify during native enablement. |
| A5 | `requestPinWidget({ widgetName: 'OrbitFavourites' })` returns `false` on unsupported launchers / API < 26 and rejects if the name is unregistered | Add-widget CTA | Behaviour verified in docs; the reject-on-unregistered-name case means the widget provider MUST be registered (prebuilt) before the Settings button can succeed. |

## Open Questions

1. **`orbit://` "Log" target** — see Pitfall 7 / A2. Recommendation: route to Profile; confirm with owner at planning.
2. **Boot-receiver mechanism** — does the config plugin register a `BOOT_COMPLETED` receiver, or is a small custom plugin needed? Resolve during native enablement (Wave 1) on the desktop prebuild; the library exposes the native `RNWidgetJsCommunication#requestWidgetUpdate` entry, so the JS side is settled — only the receiver wiring is open.
3. **Grid capacity per size bucket** — device spike on the physical Pixel (unquantifiable elsewhere).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `react-native-android-widget` | The whole widget | ✗ (net-new) | 0.22.0 (to install) | none — required |
| `expo-image-manipulator` | base64 encoder | ✓ | ~57.0.10 | `expo-file-system` readAsStringAsync |
| `expo-file-system` | photo path resolve / fallback base64 | ✓ | ~57.0.4 | — |
| Desktop build pipeline (`ssh droid`) | prebuild + release APK (native change) | ✓ (proven, FND-01) | JDK 17 + Android SDK | none — this box cannot build APKs |
| Physical Pixel 6 Pro | grid-capacity spike + killed-app mark UAT | ✓ (when plugged) | — | none — emulator invalid for both |

**Missing dependencies with no fallback:** `react-native-android-widget` (install, gated by the human-verify checkpoint). The physical Pixel for the two device-only spikes.
**Missing dependencies with fallback:** base64 encoding (manipulator inline vs FS read).

## Validation Architecture

> `workflow.nyquist_validation` is enabled (config.json). The correctness-critical seams are the base64 encoder (pure, node-testable), the `orbit://` URI resolver (pure, node-testable), the tile-data shaper, and the status→ring mapping. The headless mark and the RemoteViews render are device-UAT only.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (node env; `.test.ts` beside source) |
| Config file | repo Vitest setup (existing; used by every `-logic.ts`/DAO test) |
| Quick run command | `npx vitest run src/services/widget` |
| Full suite command | `npm test` (835/835 green as of Phase 11) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WDG-01 | base64 encoder returns `data:image/jpeg;base64,…` or null for no-photo | unit | `npx vitest run src/services/widget/widget-photo.test.ts` | ❌ Wave 0 |
| WDG-01 | tile shaper maps `listDashboard` favourites → tiles (status/initials/swatchIndex), truncates by rank | unit | `npx vitest run src/services/widget/widget-data.test.ts` | ❌ Wave 0 |
| WDG-01 | status→ring colour + weight mapping (stable/wobble/decay/rogue/null) | unit | `npx vitest run src/services/widget/widget-colors.test.ts` | ❌ Wave 0 |
| WDG-02 | headless mark writes one `interactions` row, `source='widget'`, via mutexed DAO | integration (node:sqlite) | `npx vitest run src/services/widget/widget-mark.test.ts` | ❌ Wave 0 |
| WDG-02/03 | `resolveWidgetUri` maps orbit:// URIs → reset/navigate intents; malformed → null | unit | `npx vitest run src/navigation/widget-linking.test.ts` | ❌ Wave 0 |
| WDG-02 | killed-app headless mark round-trip | manual (device) | Pixel UAT: kill app → tap → `run-as com.bwales.orbit` read row | manual-only |
| WDG-01 | grid capacity / bitmap ceiling | manual (device) | Pixel spike | manual-only |
| WDG-03 | force-stop greying → boot/launch re-push | manual (device) | Pixel UAT after `adb shell am force-stop` + reboot | manual-only |

### Sampling Rate
- **Per task commit:** `npx vitest run src/services/widget src/navigation/widget-linking.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green + the three device-only UATs on the physical Pixel before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/services/widget/widget-photo.test.ts` — WDG-01 encoder (mock the manipulator; assert `data:` prefix + null path)
- [ ] `src/services/widget/widget-data.test.ts` — WDG-01 tile shaping/truncation over a fake `listDashboard`
- [ ] `src/services/widget/widget-colors.test.ts` — WDG-01 ring colour+weight table
- [ ] `src/services/widget/widget-mark.test.ts` — WDG-02 headless write over the `node:sqlite` harness (reuse the recency-dao test harness)
- [ ] `src/navigation/widget-linking.test.ts` — WDG-02/03 pure URI resolver
- [ ] Framework install: none — Vitest + `node:sqlite` harness already present.

*(The RemoteViews render, `requestPinWidget`, and the boot receiver are device-UAT only — not unit-testable in node.)*

## Security Domain

> `security_enforcement` enabled, ASVS L1. The widget is local-only (no network, no new secrets), so the surface is narrow but real: it exposes contact data on the home screen and accepts OS-delivered click intents.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth in a local-first app |
| V3 Session Management | no | — |
| V4 Access Control | yes (light) | Widget shows only favourites + a fuel line the owner accepted as home-screen-visible (dossier 03-fuel: `off_limits` already excluded in-query by `listDashboard`/`RANKED_FUEL_EXCLUSIONS`) |
| V5 Input Validation | yes | The `orbit://` deep-link URI and `clickActionData.contactId` are OS-delivered untrusted input — validate/narrow (`Number.isInteger` on contactId; a strict URI parser returning null on anything unexpected, mirroring `resolveNotificationNav`'s narrowing) |
| V6 Cryptography | no | no crypto in this phase |

### Known Threat Patterns for {RN/Expo + RemoteViews + deep link}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed/oversized `orbit://` intent from another app | Tampering/Elevation | Strict `resolveWidgetUri` that only accepts `orbit://contact/<int>` / `compose/<int>` / `favourites`, returns null otherwise; never `eval`/interpolate the uri into a query |
| `clickActionData.contactId` non-numeric / stale / purged | Tampering | `Number.isInteger` guard; the mutexed DAO's `changes` assertions + the Logger-guarded catch (as in `notification-gate.tsx runActionTap`) swallow a stale id without an unhandled rejection |
| Home-screen data disclosure (fuel/faces on lock screen) | Information disclosure | Already an accepted owner cost (dossier 03-fuel); `off_limits` never surfaces; no new exposure beyond the favourites glance the owner chose |
| DB pulled off-device via `adb backup` after prebuild | Information disclosure | Re-assert `allowBackup=false` in the regenerated manifest (Pitfall 6) |
| Network on the widget read path (base64 via http) | — (local-first violation) | base64 `data:` only; `ImageWidget` fed a `data:` URI, never `http(s)`/`file://` |

## Sources

### Primary (HIGH confidence)
- `react-native-android-widget` official docs (github.com/sAleksovski/react-native-android-widget, `docs/docs/**`) — `register-widget-task-handler.md`, `handling-clicks.md`, `update-widget.md`, `request-pin-widget.md`, `request-widget-update.md`, `primitives/image-widget.md`, `tutorial/register-widget-expo.md`, `limitations.md` (fetched this session)
- `react-native-android-widget` on-disk TypeScript source (`src/widgets/ImageWidget.tsx`, `src/widgets/utils/style.props.ts`, `src/widgets/utils/click-action.ts`) — prop types verified
- Installed `expo-image-manipulator` type defs (`node_modules/.../ImageManipulator.types.d.ts:19-24,89-93`) — base64 save verified
- This repo's own code, read on disk: `notification-actions.ts`, `headless-task.ts`, `launch-sweep.ts`, `recency-dao.ts`, `mutex.ts`, `notification-nav.ts`, `notification-gate.tsx`, `linking.ts`, `app.config.ts`, `photo-storage.ts`, `photo-pipeline.ts`, `theme-types.ts`, `theme-presets.ts`, `dashboard-read.ts`, `navigation/types.ts`, `RootNavigator.tsx`, `App.tsx`, `index.ts`, `package.json`
- `npm view react-native-android-widget` (version 0.22.0, peerDeps, no postinstall) + `gsd-tools query package-legitimacy` (SUS: too-new, ~46k dl/wk, real repo)

### Secondary (MEDIUM confidence)
- Dossier `docs/dossier/12-widget.md` Findings (quotes the two verifier workpapers `platform-library.md` @0.22.0 + `platform-android.md`; the workpaper files are not on disk this session, so their platform-Android claims — 30 s budget line/`RNWidget*.java` refs, Android-15 force-stop — are inherited at the dossier's stated confidence)

### Tertiary (LOW confidence)
- none load-bearing; device-only limits (grid capacity, killed-app mark) are explicitly marked as spikes, not claims.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — library API + versions verified against on-disk source and official docs; encoder deps already installed.
- Architecture: HIGH — every reused pattern verified against actual code on disk; the new pieces map cleanly onto library primitives whose types were read directly.
- Pitfalls: HIGH for the code-verifiable ones (headless bootstrap, sweep gating, manifest hardening, linking race); MEDIUM for the two device-only limits (flagged as spikes) and the Android-15 force-stop behaviour (inherited from the dossier workpaper, not re-verified against developer.android.com this session).

**Research date:** 2026-08-17
**Valid until:** 2026-09-16 (30 days; `react-native-android-widget` is moderately active — re-check the version + config-plugin API if planning slips past that).
