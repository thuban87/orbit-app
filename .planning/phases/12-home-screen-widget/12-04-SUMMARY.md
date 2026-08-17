---
phase: 12-home-screen-widget
plan: 04
subsystem: widget (data + navigation cores)
tags: [widget, navigation, deep-link, favourites, dashboard-read]
requires:
  - listDashboard({filter:'favourites'}) projection (src/db/dashboard-read.ts)
  - getInitials + swatchIndex (src/components/avatar-initials.ts)
  - navigationRef (src/navigation/linking.ts)
  - RootStackParamList routes: Home, Profile, Compose, ManageFavourites (src/navigation/types.ts)
provides:
  - shapeWidgetTiles / loadWidgetTiles / WidgetTile (favourites tile shaper)
  - resolveWidgetUri / WidgetNavIntent (strict orbit:// resolver)
  - WidgetLinkingGate (ready-gated deep-link nav gate, mounted in App by 12-07)
affects:
  - 12-05 (RemoteViews render consumes WidgetTile + emits the Log clickActionData URI)
  - 12-07 (App mounts WidgetLinkingGate)
tech-stack:
  added: []
  patterns:
    - "Pure node-testable resolver mirroring notification-nav.ts (data:unknown, malformed->null)"
    - "All accepted deep links RESET onto [Home, target] (Back->dashboard under singleTask)"
    - "Gate dynamic-imports react-native/./linking to keep the resolver node-loadable"
key-files:
  created:
    - src/services/widget/widget-data.ts
    - src/services/widget/widget-data.test.ts
    - src/navigation/widget-linking.ts
    - src/navigation/widget-linking.test.ts
  modified: []
decisions:
  - "Task-1 owner-ratified (2026-08-17): Log -> orbit://contact/{id} -> Profile; no bespoke Log route"
  - "WIDGET_GRID_CAPACITY = 6 (device-spike-tunable at file top)"
  - "Id guard: anchored digit-only regex + Number.isSafeInteger && id > 0 (oversized/negative/zero -> null)"
metrics:
  duration: ~15m
  completed: 2026-08-17
  tasks: 3
  files: 4
status: complete
---

# Phase 12 Plan 04: Widget Data + Navigation Cores Summary

Built the two pure, node-testable correctness cores of the home-screen widget's data + navigation spine: the favourites tile shaper (`widget-data.ts`) that maps the existing `listDashboard({filter:'favourites'})` projection to widget tiles carrying derived status VERBATIM, and the strict `orbit://` deep-link resolver (`widget-linking.ts`) that allow-lists exactly three forms and resets every accepted link onto `[Home, target]` for a JS "Back → dashboard". Both land ahead of the native RemoteViews surface (12-05) and the App mount (12-07). 35 new tests; full suite 878/878.

## Task 1 — BLOCKING owner checkpoint (Log → Profile): RATIFIED

Pre-ratified by the owner (2026-08-17) and carried into this execution: the larger-tile **"Log" action maps to `orbit://contact/{id}` → the existing Profile screen** (where the one-tap "Log contact" action already lives). No bespoke `Log` route is introduced. This is encoded in `resolveWidgetUri` (contact form → Profile) and is what 12-05's render must emit for the Log button's `clickActionData`. No new navigation surface; a future redirect (e.g. `orbit://log/{id}`) would be a localized one-line addition here + one URI in 12-05.

## Task 2 — Favourites tile shaper (`widget-data.ts`)

- `shapeWidgetTiles(rows, {capacity, swatchCount})`: maps `DashboardRow[]` → `WidgetTile[]`, carrying `status` (`ProfileStatus | null`) **verbatim** — never re-deriving it, so a never-contacted favourite stays `null` (not the `'stable'` HIGH-1 trap). Computes only presentational `initials` (`getInitials`) + `swatchIndex` (`swatchIndex(name, swatchCount)`); carries the relative photo path unchanged (base64 encoding is deferred to the 12-03 render, keeping this module file-I/O-free and node-testable). Truncates to `capacity`, preserving the incoming `favourite_rank ASC` order. Empty → `[]`.
- `loadWidgetTiles(exec, {swatchCount, capacity?})`: calls `listDashboard(exec, {filter:'favourites', sort:'status'})` — the favourites branch ignores the sort arg and orders by `favourite_rank ASC` (the required static manual rank) — then pipes rows through `shapeWidgetTiles`. `capacity` defaults to `WIDGET_GRID_CAPACITY` (6, tunable at file top).

## Task 3 — Strict `orbit://` resolver + ready-gated gate (`widget-linking.ts`)

- `resolveWidgetUri(url: unknown): WidgetNavIntent | null` — pure, node-loadable (no react-navigation / expo / react-native import at load time, mirroring `notification-nav.ts`). Strict allow-list of three forms only:
  - `orbit://contact/<positive-int>` → reset `[Home, Profile{contactId}]`
  - `orbit://compose/<positive-int>` → reset `[Home, Compose{contactId}]`
  - `orbit://favourites` → reset `[Home, ManageFavourites]` (a **reset**, not a bare navigate — the Codex HIGH fix)
- Every accepted form is a RESET onto `[Home, target]` (index 1) so Back always lands on the dashboard under app-wide `singleTask`.
- Rejects (→ `null`): non-string input (param typed `unknown`, guarded with `typeof`), wrong scheme, unknown host, non-integer / negative / zero / oversized id, missing id, extra path segment, a present query string / fragment / port, and an encoded path. The anchored digit-only regexes (`^orbit://contact/([0-9]+)$`) plus `Number.isSafeInteger(id) && id > 0` make the id impossible to smuggle anything through; the untrusted OS intent is never eval/interpolated (V5 / T-12-01).
- `WidgetLinkingGate({ isReady })`: render-null gate mirroring `ShareIntentGate`/`NotificationResponseGate` — `Linking.addEventListener('url')` (warm) + `Linking.getInitialURL()` once (cold), resolves via `resolveWidgetUri`, parks the intent in reactive state, flushes onto `navigationRef.reset(...)` once `isReady` settles. **No react-navigation `linking` config** (Pitfall 4 — would race the share-intent singleton); handles only `orbit://` and never consumes the share `text/plain` path. `react-native`'s `Linking` and `./linking`'s `navigationRef` are pulled in via **dynamic import inside the effects**, which is what keeps the module node-loadable so the pure resolver's test never loads react-native.

## Deviations from Plan

None — plan executed as written. Task 1's blocking checkpoint was resolved by the owner's pre-execution ratification (keep Log → Profile); Tasks 2 and 3 proceeded and encoded that decision.

## Verification

- `npx vitest run src/services/widget/widget-data.test.ts src/navigation/widget-linking.test.ts` → 35 passed (6 shaper + 29 resolver).
- `npm test` (full suite) → 878/878 passed, no regressions.
- `npx tsc --noEmit` → clean (0 errors), incl. the union-tuple `navigationRef.reset({index, routes})` call.
- `npm run check:colors` → clean (both modules are logic-only, no colour literals).
- Grep confirms `widget-linking.ts` uses only `Linking.addEventListener` / `getInitialURL`; no react-navigation `linking` getInitialURL/subscribe config.

## Notes for Downstream Plans

- **12-05 (render):** consume `WidgetTile`; emit the Log button `clickActionData` as `orbit://contact/{id}` (the ratified Profile target). `relativePhoto` still needs base64 encoding via the 12-03 encoder before it reaches `ImageWidget`.
- **12-07 (App):** mount `<WidgetLinkingGate isReady={...} />` alongside `ShareIntentGate`/`NotificationResponseGate`, passing the same reactive `onReady` flag.
- `WidgetLinkingGate` itself is device-only (reaches `react-native`) and is intentionally NOT node-tested — the pure `resolveWidgetUri` carries the correctness contract.

## Self-Check: PASSED

- Files created: all 4 FOUND on disk.
- Commits: `22af489` (test), `e3f7996` (feat) — widget-data; `7d05e9a` (test), `213c7d4` (feat) — widget-linking. All present in `git log`.
- Tests green (35 plan / 878 suite), tsc + check:colors clean.
