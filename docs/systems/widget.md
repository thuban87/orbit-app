# Widget

**Last updated:** 2026-09-02
**Updated by phase:** 25-dashboard-data-state-foundation
**Owners:** `src/services/widget/`, `src/navigation/widget-linking.ts`, `src/services/widget/widget-quick-action-guard.ts`, `plugins/withWidgetBootReceiver.js`

## Purpose

The Widget system gives Orbit a local Android home-screen shortcut board for binary favourites in shared Dashboard Default order. It renders status-colour avatars from existing local data, lets a user mark contact without opening the app, and offers profile, logging, and a `Contact` reach-out entry point without adding widget-specific SQLite state.

## Architecture

### Data Model

The widget owns no table, migration, or per-instance state. It reads the Dashboard Favorites population projection, which carries a nullable derived status, eligible fuel, and a relative photo path.

**Tables:**
- `contacts` — supplies favourite membership, identity, photo reference, and the recency inputs to derived status.
- `fuel` — supplies the eligible per-contact line shown only in the larger layout.
- `interactions` — receives a full widget-sourced touchpoint when the user marks contacted.

**Types** (`src/services/widget/widget-data.ts`):
- `WidgetTile` — local render projection containing the Dashboard-ordered contact, nullable status, deterministic initials/swatch, photo reference, and fuel line.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Projection service | `src/services/widget/widget-data.ts` | Reads Favorites in Dashboard Default order, preserves nullable status, and shapes bounded tiles. |
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
2. The renderer resolves the device region and opens/migrates SQLite when needed, then `loadWidgetTiles()` calls the Bound-only favourites projection. An Unbound dormant favourite cannot produce a tile.
3. The tile shaper preserves Dashboard Default order and nullable query-time status; it never recalculates either value.
4. Each local photo master is downsized and encoded as a base64 `data:` URI. A missing or failed thumbnail falls back to deterministic themed initials rather than blanking the grid.
5. The renderer selects the small mark grid or larger fuel-and-action layout from widget width, then rasterises the RemoteViews tree with palette tokens.

### Marking and opening a contact

1. A small tile or larger Mark control sends `WIDGET_MARK` with a contact ID; the task handler rejects non-positive or unsafe IDs before opening SQLite.
2. The handler resolves the device region and opens/migrates the database, then `widgetMarkContacted()` delegates to `recordTouchpoint()` with `source='widget'`, outbound, connected, unspecified-channel defaults and no quality value.
3. The existing mutexed recency DAO commits the interaction and recomputes `last_contact`; refresh follows only after that durable write.
4. Profile and the larger layout's `Contact` control use accepted `orbit://` links. The `Contact` action emits `orbit://reach/<id>` only — parsed by the anchored `^orbit://reach/([0-9]+)$` allow-list (`Number.isSafeInteger`, `>0`, non-string rejected) — and deep-links into the shared in-app Reach Out router (the former `Message → orbit://compose → Compose` action is superseded). The widget never writes an assist or interaction.
5. After strict parsing, the discriminated live-state guard (`widget-quick-action-guard.ts`) rejects active-cadence actions for missing, archived, or Unbound targets: a purged/missing `Contact` target shows "This contact is no longer available." and uses the typed nested Dashboard reset, an archived target is silently dropped, and a live Unbound Profile open remains valid. The Profile consumes the `openReachOut` param exactly once (`setParams`).

### Staying fresh and recovering

1. Widget-visible foreground writes call `notifyWidgetDataChanged()` after their successful commit; the call is fire-and-forget and refresh failures are swallowed.
2. `App.tsx` registers `registerWidgetSweep()` only for a real foreground launch, never for a headless widget context.
3. The native boot receiver handles only `BOOT_COMPLETED` and asks the widget library to update placed `OrbitFavourites` instances. No widget timer or polling period runs.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `updatePeriodMillis` | `0` | `app.config.ts` | Enforces event-push rather than periodic polling. |
| `WIDGET_GRID_CAPACITY` | `6` | `src/services/widget/widget-data.ts` | Default bounded tile count. |
| `SMALL_CAPACITY` / `LARGE_CAPACITY` | `6` / `4` | `src/services/widget/widget-render.tsx` | Size-specific render bounds. |
| `LARGE_MIN_WIDTH_DP` | `280` | `src/services/widget/widget-render.tsx` | Selects the larger layout on the tuned device size. |
| `THUMB_PX` / `THUMB_Q` | `88` / `0.6` | `src/services/widget/widget-photo.ts` | Bounds thumbnail decode and JPEG output cost. |

## Decisions

- **ADR-042:** Shared Status Palette for Dashboard and Widget Rings — both surfaces consume one status-token vocabulary.
- **ADR-043:** Static Globally Mirrored Favourites Widget — instances share one state-free favourites list; its ordering source is superseded by ADR-075.
- **ADR-044:** Headless Widget Actions and Dashboard-Rooted Deep Links — marks use the recency writer and links reset to Dashboard (its `Message → Compose` action is partially superseded by ADR-074).
- **ADR-045:** Event-Driven Widget Refresh and Boot Recovery — event/launch/boot refresh replaces polling.
- **ADR-059:** Normalized Contact Methods, Canonical Actionability, and Local Provenance — makes the widget's possible first-open pass device-region migration input.
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — excludes Unbound favourites and fails stale active actions closed.
- **ADR-074:** Widget Contact Supersession and Strict Reach Deep-Link Fail-Safe — replaces the larger `Message` action with `Contact → orbit://reach`, deep-linking the shared router with a fail-safe lifecycle guard.
- **ADR-080:** Four-Tab Bottom Navigation Shell with Per-Tab Stacks — preserves strict widget-link behavior while changing only the Dashboard reset shape.
- **ADR-075:** Binary Favourite Membership Without a User-Facing Order — requires Favorites population Default ordering.
- **ADR-093:** Scoped Composable Dashboard Population and Filter Model — makes the Widget a Dashboard population consumer.

## Gotchas

1. **Never pass `file://` or network image sources to RemoteViews.** The widget encodes a local master to base64 `data:` and falls back to initials when encoding fails.
2. **Never re-derive status or reorder tiles.** The Dashboard projection already supplies nullable status and Default order; changing either can misstate never-contacted people or restore a retired rank concept.
3. **Do not run foreground sweep work in a widget task.** Headless taps may write one interaction but must not trigger unrelated cleanup, purge, or reconciliation.
4. **Keep refresh best-effort after a committed mark.** Rendering can consume the headless budget; it must never roll back or throw past the interaction write.
5. **Android 15 force-stop can grey the widget.** A manual launch re-arms it; boot recovery is a separate native path and the widget is never the sole route to logging.
6. **Headless first-open must supply, not guess, a migration region.** A missing region leaves national-format method data non-actionable rather than creating an irreversible false canonical value.
7. **Guard after parsing, not by weakening the URI allowlist.** Lifecycle is mutable after render, so every active action needs live local state.
8. **The widget is never a second assist writer.** `Contact` only emits `orbit://reach/<id>`; all assist creation and channel selection happen in the in-app router. Do not insert `interaction_assists` from any widget task.
9. **A method-less `Contact` tap opens nothing and can strand `openReachOut`.** A favourite with no actionable phone/email resolves the deep-link but the router returns null, and the param is cleared only when `hasReachRoute` is true (review IN-02, owner-deferred). Clear it unconditionally if you touch that path.
10. **Do not weaken the URI parser to accommodate tab routing.** Parsing and lifecycle guards stay unchanged; only the post-acceptance navigation state is nested below Dashboard.

## Related Systems

- **Dashboard** — owns the favourites projection and shared card status vocabulary.
- **Interaction log** — owns the serialized touchpoint and recency invariant used by a widget mark.
- **Photos** — supplies the bounded local master and deterministic initials fallback inputs.
- **App shell** — mounts the URI gate, foreground refresh hook, Settings CTA, and native configuration.
- **Contact methods** — supplies the actionable phone/email the reach-out router routes to.
- **Interaction Assist & Reach Out** — the larger `Contact` action deep-links into the shared router; the widget writes no assist rows.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-16 | 12 | Created the state-free Android favourites widget with headless mark, deep links, and event-driven recovery. |
| 2026-08-27 | 18.1 | Supplied device region to widget render and action first-open migration paths. |
| 2026-08-27 | 18.2 | Excluded Unbound favourites and added live lifecycle guards for stale widget actions. |
| 2026-08-31 | 21 | Replaced the larger `Message → Compose` action with `Contact → orbit://reach` into the shared Reach Out router, with a discriminated missing/archived fail-safe guard and a consumed-once `openReachOut` param. |
| 2026-09-02 | 22 | Re-expressed accepted widget-link and missing-contact fallback routes as nested Dashboard-tab states. |
| 2026-09-02 | 25 | Repointed tiles to Favorites population Default order and made the favourites deep link safely reset Home. |
