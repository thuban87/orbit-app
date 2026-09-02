---
phase: 12-home-screen-widget
plan: 03
subsystem: widget
tags: [widget, base64, photo, theme, headless, WDG-01]
requires:
  - "12-01: shared status theme tokens (statusStable/statusWobble/statusDecay), resolvePalette"
  - "photo-storage.resolvePhotoUri (relative -> file:// master)"
  - "expo-image-manipulator chainable API (manipulate/resize/renderAsync/saveAsync)"
provides:
  - "encodeWidgetThumb(relativePath): base64 data: URI tile-thumbnail encoder"
  - "widgetPalette() / ringColor() / ringWeight() / WidgetPalette: headless status-colour resolver"
affects:
  - "12-05 RemoteViews render (consumes both cores)"
tech-stack:
  added: []
  patterns:
    - "Per-tile encode failure swallowed to null (Logger-logged), NOT rethrown — departs from photo-pipeline's typed-error rethrow because this runs per-tile in a batch render"
    - "Headless colour resolution from theme-presets (no useTheme/ThemeProvider)"
key-files:
  created:
    - src/services/widget/widget-photo.ts
    - src/services/widget/widget-photo.test.ts
    - src/services/widget/widget-colors.ts
    - src/services/widget/widget-colors.test.ts
  modified: []
decisions:
  - "encodeWidgetThumb guards result.base64 (typed optional even with base64:true) — missing/empty -> null, never …base64,undefined"
  - "Both the throw path and the missing-base64 path collapse to the same null (initials fallback)"
  - "widget-colors kept SEPARATE from contact-card-ring's ringVisual (no opacity channel; no provider in headless render)"
metrics:
  duration: ~10m
  completed: 2026-08-17
  tasks: 2
  files: 4
status: complete
---

# Phase 12 Plan 03: Widget Base64 Encoder + Headless Colour Resolver Summary

The two remaining node-testable WDG-01 cores the widget render consumes: a base64 tile-thumbnail encoder that downscales the 512px photo master to a `data:image/jpeg;base64,…` URI (RemoteViews cannot read `file://`, network violates local-first), and a headless status→ring resolver that reads the shared 12-01 tokens directly from `theme-presets` (no `ThemeProvider` mounts in the headless task). Both pure, both unit-tested ahead of the native surface.

## What Was Built

### Task 1 — `widget-photo.ts` (`encodeWidgetThumb`)
- Resolves the master `file://` via `resolvePhotoUri`, downscales to `THUMB_PX` (88, tunable) via the SDK-52+ chainable `ImageManipulator` chain, and `saveAsync({ format: JPEG, compress: THUMB_Q (0.6), base64: true })`.
- **base64 guard:** emits `data:image/jpeg;base64,<b64>` ONLY when `typeof result.base64 === "string" && length > 0`. A resolved-but-undefined/empty payload (the field is typed optional even when requested — `ImageManipulator.types.d.ts:19,24`) → `Logger.warn` + `null`. Never emits `data:image/jpeg;base64,undefined` (codex/Claude MED).
- **Non-fatal per-tile failure:** a decode/manipulate throw (corrupt/evicted master) → `Logger.error` + `null`, NOT rethrown — the render calls this once per tile, so a throw would blank the whole grid; `null` degrades that ONE tile to the initials swatch (Codex/Claude M2). This deliberately departs from `photo-pipeline.ts`, which rethrows a typed `PhotoPipelineError`.
- Null/empty `relativePath` → `null` (no photo). No persisted file, no DB write (WDG-01: no new persistent state), no network, base64-only.
- `THUMB_PX`/`THUMB_Q` are top-of-file single-number-edit tunables (device spike in 12-08).

### Task 2 — `widget-colors.ts` (`widgetPalette` / `ringColor` / `ringWeight`)
- `widgetPalette()` → `resolvePalette(DEFAULT_PRESET_ID, "dark")` — the dark-first space-dark palette the headless render inherits, resolved WITHOUT a React theme hook.
- `ringColor(status, palette)`: stable→`statusStable`, wobble→`statusWobble`, decay→`statusDecay`, rogue→`rogue`, null→`border`.
- `ringWeight(status)`: stable 2 / wobble 3 / decay 4 / rogue 3 / null 2 (UI-SPEC weights).
- No hex literal (every colour off the passed palette); `check:colors` clean. Exports a `WidgetPalette` type alias. Kept deliberately separate from `contact-card-ring.ts`'s `ringVisual` (the widget has no opacity channel and no provider).

## Tests

- `widget-photo.test.ts` — 6 tests: null-path→null, empty-path→null, real path→`data:image/jpeg;base64,` prefix, manipulator-reject→null (not a rejection), undefined-base64→null, empty-base64→null. Mocks BOTH `expo-image-manipulator` AND `@/services/photos/photo-storage` (so `resolvePhotoUri` never pulls native `expo-file-system` into node — mirrors `photo-storage.test.ts`).
- `widget-colors.test.ts` — 3 tests: full `ringColor` routing table against a sentinel fixture, full `ringWeight` table, `widgetPalette()` resolves the space-dark dark palette with status tokens present.
- **9/9 green.** `npx tsc --noEmit` clean. `npm run check:colors` clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Invalid `.not.toContain("undefined")` assertion on a null value**
- **Found during:** Task 1 (GREEN run)
- **Issue:** The initial test asserted `expect(out).not.toContain("undefined")` on the missing-base64 case, but `out` is `null` and `toContain` requires a string/collection — the assertion errored (not a logic failure; the implementation returned the correct `null`).
- **Fix:** Removed the redundant assertion. `expect(out).toBeNull()` already fully covers the regression — if the guard broke and emitted `"data:image/jpeg;base64,undefined"`, `toBeNull()` would fail on that string.
- **Files modified:** `src/services/widget/widget-photo.test.ts`
- **Commit:** 4d1b377 (folded into the Task 1 GREEN commit)

## Threat Surface

No new surface beyond the plan's `<threat_model>`. T-12-05 (local-first): encoder emits base64 `data:` only from the on-device master via `resolvePhotoUri`, never `file://`/`http(s)`, no network; a decode failure returns `null` (no raw-path leak, no grid-wide failure). T-12-08 (theme literals): colours resolve from `theme-presets` tokens; no hex in `widget-colors.ts`; `check:colors` gate passes.

## Known Stubs

None. Both cores are complete and consumed by the 12-05 render.

## Commits

- 7b057bd — test(12-03): failing test for base64 encoder (RED)
- 4d1b377 — feat(12-03): base64 widget thumbnail encoder (GREEN, incl. test-assertion fix)
- c643848 — test(12-03): failing test for headless colour resolver (RED)
- a9507ea — feat(12-03): headless status-colour resolver (GREEN)

## Self-Check: PASSED
- src/services/widget/widget-photo.ts — FOUND
- src/services/widget/widget-colors.ts — FOUND
- src/services/widget/widget-photo.test.ts — FOUND
- src/services/widget/widget-colors.test.ts — FOUND
- Commits 7b057bd, 4d1b377, c643848, a9507ea — FOUND
