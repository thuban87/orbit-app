# Widget

**Last updated:** 2026-08-27
**Updated by phase:** 18.1-contact-method-normalization
**Owners:** `src/services/widget/`, `src/navigation/widget-linking.ts`, `plugins/withWidgetBootReceiver.js`

## Purpose

The Widget system gives Orbit a local Android home-screen shortcut board for manually ranked favourites. It renders status-colour avatars from existing local data, lets a user mark contact without opening the app, and offers profile, logging, and message entry points without adding widget-specific SQLite state.

## Architecture

### Data Model

The widget owns no table, migration, or per-instance state. It reads the existing dashboard favourites projection, which carries a nullable derived status, ranked eligible fuel, and a relative photo path.

**Tables:**
- `contacts` — supplies favourite rank, identity, photo reference, and the recency inputs to derived status.
- `fuel` — supplies the eligible per-contact line shown only in the larger layout.
- `interactions` — receives a full widget-sourced touchpoint when the user marks contacted.

**Types** (`src/services/widget/widget-data.ts`):
- `WidgetTile` — local render projection containing the rank-ordered contact, nullable status, deterministic initials/swatch, photo reference, and fuel line.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Projection service | `src/services/widget/widget-data.ts` | Reads dashboard favourites, preserves manual rank and nullable status, and shapes bounded tiles. |
| Photo service | `src/services/widget/widget-photo.ts` | Converts a bounded local photo master to a base64 JPEG thumbnail or returns `null`. |
| Render service | `src/services/widget/widget-render.tsx` | Builds size-specific RemoteViews trees from tiles and token-resolved colours. |
| Task handler | `src/services/widget/widget-task-handler.tsx` | Handles widget lifecycle events and validates/commits headless marks. |
| Refresh service | `src/services/widget/widget-refresh.ts` | Pushes event and foreground-launch rerenders without polling. |
| Navigation gate | `src/navigation/widget-linking.ts` | Strictly maps accepted `orbit://` links to Dashboard-rooted navigation resets. |
| Native boot path | `plugins/withWidgetBootReceiver.js` | Generates the guarded non-exported receiver that re-pushes placed widgets at boot. |

### Key Files

| File | Role |
|---|---|
| `app.config.ts` | Registers the resizable, event-push-only `OrbitFavourites` provider. |
| `src/services/widget/widget-data.ts` | Favourites tile shaper and tunable default capacity. |
| `src/services/widget/widget-colors.ts` | Headless palette resolver and status-ring mapping. |
| `src/services/widget/widget-photo.ts` | Base64 thumbnail encoder for RemoteViews. |
| `src/services/widget/widget-render.tsx` | Small grid, larger action layout, and empty-state render trees. |
| `src/services/widget/widget-mark.ts` | Thin delegate to the mutexed recency writer with widget one-tap defaults. |
| `src/services/widget/widget-task-handler.tsx` | Module-registered headless lifecycle and click handler. |
| `src/services/widget/widget-refresh.ts` | Safe event-push and foreground-sweep refresh entry points. |
| `src/navigation/widget-linking.ts` | Strict URI parser plus ready-gated navigation bridge. |
| `plugins/withWidgetBootReceiver.js` | Prebuild plugin for the Kotlin boot receiver and manifest entries. |

## How It Works

### Rendering favourites

1. A lifecycle event or `requestWidgetUpdate` invokes `renderFavourites(widgetInfo)`.
2. The renderer resolves the device region and opens/migrates SQLite when needed, then `loadWidgetTiles()` calls `listDashboard()` with the favourites filter. A widget render can be the first opener of an upgraded database.
3. The tile shaper preserves `favourite_rank` order and nullable query-time status; it never recalculates either value.
4. Each local photo master is downsized and encoded as a base64 `data:` URI. A missing or failed thumbnail falls back to deterministic themed initials rather than blanking the grid.
5. The renderer selects the small mark grid or larger fuel-and-action layout from widget width, then rasterises the RemoteViews tree with palette tokens.

### Marking and opening a contact

1. A small tile or larger Mark control sends `WIDGET_MARK` with a contact ID; the task handler rejects non-positive or unsafe IDs before opening SQLite.
2. The handler resolves the device region and opens/migrates the database, then `widgetMarkContacted()` delegates to `recordTouchpoint()` with `source='widget'`, outbound, connected, unspecified-channel defaults and no quality value.
3. The existing mutexed recency DAO commits the interaction and recomputes `last_contact`; refresh follows only after that durable write.
4. Profile and Compose controls use accepted `orbit://` links. `WidgetLinkingGate` strictly parses them and resets React Navigation to Dashboard plus the requested destination, so Back returns to Dashboard.

### Staying fresh and recovering

1. Widget-visible foreground writes call `notifyWidgetDataChanged()` after their successful commit; the call is fire-and-forget and refresh failures are swallowed.
2. `App.tsx` registers `registerWidgetSweep()` only for a real foreground launch, never for a headless widget context.
3. The native boot receiver handles only `BOOT_COMPLETED` and asks the widget library to update placed `OrbitFavourites` instances. No widget timer or polling period runs.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `updatePeriodMillis` | `0` | `app.config.ts` | Enforces event-push rather than periodic polling. |
| `WIDGET_GRID_CAPACITY` | `6` | `src/services/widget/widget-data.ts` | Default rank-bounded tile count. |
| `SMALL_CAPACITY` / `LARGE_CAPACITY` | `6` / `4` | `src/services/widget/widget-render.tsx` | Size-specific render bounds. |
| `LARGE_MIN_WIDTH_DP` | `280` | `src/services/widget/widget-render.tsx` | Selects the larger layout on the tuned device size. |
| `THUMB_PX` / `THUMB_Q` | `88` / `0.6` | `src/services/widget/widget-photo.ts` | Bounds thumbnail decode and JPEG output cost. |

## Decisions

- **ADR-042:** Shared Status Palette for Dashboard and Widget Rings — both surfaces consume one status-token vocabulary.
- **ADR-043:** Static Globally Mirrored Favourites Widget — instances share one manually ranked, state-free list.
- **ADR-044:** Headless Widget Actions and Dashboard-Rooted Deep Links — marks use the recency writer and links reset to Dashboard.
- **ADR-045:** Event-Driven Widget Refresh and Boot Recovery — event/launch/boot refresh replaces polling.
- **ADR-059:** Normalized Contact Methods, Canonical Actionability, and Local Provenance — makes the widget's possible first-open pass device-region migration input.

## Gotchas

1. **Never pass `file://` or network image sources to RemoteViews.** The widget encodes a local master to base64 `data:` and falls back to initials when encoding fails.
2. **Never re-derive status or reorder tiles.** The dashboard projection already supplies nullable status and favourite-rank order; changing either can misstate never-contacted people or move an un-undoable mark target.
3. **Do not run foreground sweep work in a widget task.** Headless taps may write one interaction but must not trigger unrelated cleanup, purge, or reconciliation.
4. **Keep refresh best-effort after a committed mark.** Rendering can consume the headless budget; it must never roll back or throw past the interaction write.
5. **Android 15 force-stop can grey the widget.** A manual launch re-arms it; boot recovery is a separate native path and the widget is never the sole route to logging.
6. **Headless first-open must supply, not guess, a migration region.** A missing region leaves national-format method data non-actionable rather than creating an irreversible false canonical value.

## Related Systems

- **Dashboard** — owns the favourites projection and shared card status vocabulary.
- **Interaction log** — owns the serialized touchpoint and recency invariant used by a widget mark.
- **Photos** — supplies the bounded local master and deterministic initials fallback inputs.
- **App shell** — mounts the URI gate, foreground refresh hook, Settings CTA, and native configuration.
- **Contact methods** — supplies the existing Compose destination for Message.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-16 | 12 | Created the state-free Android favourites widget with headless mark, deep links, and event-driven recovery. |
| 2026-08-27 | 18.1 | Supplied device region to widget render and action first-open migration paths. |
