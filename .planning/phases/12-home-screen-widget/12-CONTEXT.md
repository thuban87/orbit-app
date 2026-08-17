# Phase 12: Home Screen Widget - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning

<domain>
## Phase Boundary

A favourites-grid Android home-screen widget (native `RemoteViews` via `react-native-android-widget`,
first custom dev client) that adds **no new schema and no new persistent state** — it reads only what
already exists (favourites rank, derived status, fuel rows, photo master). It shows favourites in static
manual rank with status-colour avatars (base64), a small-tile headless mark-contacted, and a larger tile
adding Quick mark · Log contact · Message (→ the in-app compose screen). Freshness is event-push +
launch/boot refresh (no polling). Empty → "Choose favourites". An in-app "Add widget" button lives in
Settings. Everything the dossier (`docs/dossier/12-widget.md`) locked is DECIDED and not reopened here.

</domain>

<decisions>
## Implementation Decisions

### Status Colour Palette (resolves the open OD-1 — owner decision this session)
- Define **stable / wobble / decay** as **shared app-wide theme tokens THIS phase** (joining the existing
  `rogue` token). The widget bitmap AND the dashboard `ContactCard` both consume them; Phase 13 (orrery)
  inherits the same tokens — one source of truth.
- This retires `ContactCard`'s opacity-only placeholder and meets WDG-01's "each avatar carrying its
  status colour."
- Actual hues are **proposed from the existing space-dark theme tokens at the UI-SPEC step for owner
  approval** — Claude does not pick final colours unilaterally.

### Widget Interaction Affordances
- **Small tile:** whole tile/avatar = headless mark-contacted (no undo); a **name-label region + a small
  chevron glyph** = the explicit "open profile" target (the dossier's two-tap-region model for §6's
  "long-press", since a RemoteViews tap is a single click).
- **Larger tile:** Quick mark · Log contact · Message + per-contact fuel line (DECIDED); Message →
  the in-app Compose screen. Exact button copy/iconography is deferred to the UI-SPEC design contract.
- **"Add Orbit widget" button lives in Settings** (`requestPinWidget`, graceful fallback to the OS
  picker). No onboarding surface this phase.

### Claude's Discretion (implementation — per dossier "deferred to phase planning")
- Grid geometry per size bucket + max favourites per resolution — physical-Pixel device spike
  (RemoteViews bitmap-memory ceiling; emulator cannot assess it).
- The base64 thumbnail pipeline: downscale the 512px master → tile-thumb → base64 `data:` URI; validate
  within RemoteViews bitmap memory; round via `ImageWidget` radius. (Net-new — no encoder exists today.)
- One resizable widget (`WIDGET_RESIZED`) vs two picker entries — resize-adapt preferred.
- Freshness wiring: `requestWidgetUpdate` on app events; recompute status at launch via the launch-sweep
  hook registry (foreground only); a **separate** boot receiver for `BOOT_COMPLETED` / force-stop re-push.
- Two-tap-region hit-target construction + the JS synthetic back-stack (reuse the `notification-nav`
  reset-to-`[Home, …]` pattern — native `TaskStackBuilder` does not compose with app-wide `singleTask`).
- Headless `WIDGET_CLICK` mark write reuses `recordTouchpoint` (single-writer DAO + JS mutex,
  `source='widget'`, `connected/outbound/unspecified`, `quality=null`, 30 s budget); a widget-tap headless
  context must **never** run `runLaunchSweep`.
- `requestPinWidget` button + graceful fallback (returns false on unsupported launchers / API < 26).
- The `orbit://` deep-link bridge (`OPEN_URI` → React Navigation) — net-new but sanctioned
  (`linking.ts` anticipates it); it must not handle the share intent.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (verified file:line)
- **Favourites WITH status + fuel:** `listDashboard({ filter:'favourites', sort })` —
  `src/db/dashboard-read.ts:166-210` — projects status/progress + fuel line, ordered `favourite_rank ASC`.
  (The leaner `FavouriteRow` / `listFavourites`, `dashboard-read.ts:96-103`, lacks status+fuel — do NOT
  wire the widget tiles to it.)
- **Single-writer mark path:** `recordTouchpoint(...)` — `src/db/recency-dao.ts:215-240` — the only writer
  of `contacts.last_contact`. Shared mutex `withMutex` — `src/db/mutex.ts:32-36` (its comment already names
  Phase-12 headless widget taps).
- **Compose route/screen:** `Compose: { contactId }` — `src/navigation/types.ts:56-66`;
  `src/screens/ComposeScreen.tsx` (self-fetches from id); registered `RootNavigator.tsx:73`. Profile route:
  `types.ts:25`.
- **Back→dashboard synthetic back-stack model:** `resolveNotificationNav` reset onto `[Home, Compose]`
  index 1 — `src/services/notifications/notification-nav.ts:27-80`; applied via `navigationRef` in
  `notification-gate.tsx:82-96`.
- **Photo master:** `resolvePhotoUri` → `file://` of the 512px JPEG — `src/services/photos/photo-storage.ts:130`;
  pipeline `photo-pipeline.ts:38-91`; `SAFE_RELATIVE` allowlist `photo-relative-path.ts:22`. **No base64
  encoder exists — the widget adds it.** Cache-bust discriminator = `modified_at`.
- **Status logic:** `STATUS_SQL` / `PROGRESS_SQL` / `REASON_SQL` — `src/db/status.ts:40-73`; `ProfileStatus`
  type `contact-status-read.ts:19-20`; `getContactStatus` by id.
- **Status colour token:** only `colors.rogue` exists — `src/theme/theme-types.ts:75`; avatar swatches
  `theme-types.ts:47-65`. **stable/wobble/decay tokens are NET-NEW this phase** (owner-approved shared palette).
- **Launch-sweep registry:** `registerSweepHook` / `runLaunchSweep` — `src/services/launch-sweep.ts:45-47`
  (rule: importing the registry runs nothing; a headless tap must never reach the sweep,
  `launch-sweep.ts:10-14`). Phase-11 registration pattern `App.tsx:131-139`.
- **Headless task pattern:** `TaskManager.defineTask` + `registerTaskAsync` at module scope —
  `src/services/notifications/headless-task.ts:65-92`; side-effect import `App.tsx:28`. Shared exactly-once
  handler `handleNotificationAction` (awaits `openAndMigrate()` before `getExecutor()`; deterministic dedup)
  — `src/services/notifications/notification-actions.ts:104-175`.
- **App scheme:** `scheme: "orbit"` — `app.config.ts:20` (basis for `orbit://` OPEN_URI).
- **Add-widget button home:** `SettingsScreen` — `src/screens/SettingsScreen.tsx`.

### Established Patterns
- All colours resolve through theme tokens — including RemoteViews bitmaps. No hardcoded colours.
- Status is derived-never-stored; the widget adds no schema and no persistent state.
- Headless writers share the single mutex; a headless context bootstraps `openAndMigrate()` before any
  `getExecutor()`.

### Integration Points
- `react-native-android-widget` (NOT installed — net-new dep; config-plugin entry in `app.config.ts`;
  forces the project's first custom dev client / committed native dir; the regenerated manifest must
  preserve `allowBackup=false` + portrait-lock + the existing plugins).
- A new base64 photo encoder alongside `photo-storage`.
- A new `orbit://` linking bridge (React Navigation `linking` config or a `Linking` url-listener →
  `navigationRef`); must not touch the share intent (`linking.ts:30-33`).
- New shared status-colour tokens in `theme-types` + every theme preset; `ContactCard` upgraded off its
  opacity placeholder to consume them.

</code_context>

<specifics>
## Specific Ideas

- **Shared status palette** is an owner decision this session: widget + `ContactCard` now, orrery (Ph13)
  inherits. Hues proposed at UI-SPEC from the space-dark tokens for owner approval.
- **Verification linkage:** the widget's killed-app headless mark exercises the SAME FCM-less path whose
  on-device check was **deferred (owner-accepted) in Phase 11** (see STATE.md). Plan to verify both
  together on the physical Pixel — and the emulator cannot assess base64 bitmap-memory limits or
  headless-mark timing at all.
- **Android 15 force-stop greys the widget** (cancels its PendingIntents until a manual launch) — so the
  widget can never be the sole route into the log; this mandates the re-push on launch / `BOOT_COMPLETED`.

</specifics>

<deferred>
## Deferred Ideas

- Widget self-swap-into-profile (in-tile profile view) — v2 / REJECTED (the deep-link to the real profile
  is richer). REQUIREMENTS.md v2.
- Per-instance widget config Activity / per-`widgetId` state — v2 / REJECTED (global mirror decided).
- First-run onboarding hint for the widget — owner chose Settings-only this phase.
- Larger-tile exact button copy/iconography — handled in the UI-SPEC design contract, not discuss.

</deferred>
