---
phase: 12-home-screen-widget
plan: 01
subsystem: ui
tags: [theme-tokens, status-palette, contact-card, react-native, vitest, cvd-accessibility]

# Dependency graph
requires:
  - phase: 08-dashboard
    provides: "ContactCard (DASH-03) with the OD-1 token-clean opacity placeholder + statusLabel accessibilityLabel"
  - phase: 06-profile
    provides: "rogue status token + gravityTiers ramp (the flat-token / doc-comment shape mirrored here)"
provides:
  - "Shared app-wide status palette tokens: statusStable/statusWobble/statusDecay on ThemePalette, seeded owner-approved in space-dark"
  - "Pure RN-free ringVisual(status, colors) helper mapping status -> {color, opacity, width}"
  - "ContactCard status ring showing REAL colour + escalating CVD-safe border weight (OD-1 opacity placeholder retired)"
affects: [12-03-widget-bitmap, 12-05-widget-render, 13-orrery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Component logic in an RN-free sibling .ts module (contact-card-ring.ts beside ContactCard.tsx, mirroring avatar-initials.ts) so it is node-unit-testable without loading react-native"
    - "Redundant non-colour status channel: colour (primary) + escalating border weight (CVD backup) + accessibilityLabel"

key-files:
  created:
    - src/components/contact-card-ring.ts
    - src/components/ContactCard.test.tsx
  modified:
    - src/theme/theme-types.ts
    - src/theme/theme-presets.ts
    - src/theme/theme-presets.test.ts
    - src/components/ContactCard.tsx
    - vitest.config.ts

key-decisions:
  - "ringVisual lives in an RN-free sibling module (contact-card-ring.ts), re-exported from ContactCard.tsx — the only way to unit-test it render-free, since ContactCard.tsx imports react-native (unparseable in the node test env)"
  - "Corrected the plan's helper signature from colors: ThemePalette[\"colors\"] (a non-existent key) to colors: ThemePalette"
  - "Extended vitest include to src/**/*.test.tsx so the planned .test.tsx artifact actually runs (passWithNoTests would otherwise mask it)"

patterns-established:
  - "Pure component-helper module: extract render-free logic to a sibling .ts, re-export from the .tsx, test the .ts — no react-native in the node runner"
  - "Owner-approved hexes locked under an exact-value test so a future seed drift fails loudly"

requirements-completed: [WDG-01]

coverage:
  - id: D1
    description: "statusStable/statusWobble/statusDecay declared on ThemePalette and seeded with the owner-approved hexes (#45B98A/#E8C15C/#E56A52) in space-dark"
    requirement: WDG-01
    verification:
      - kind: unit
        ref: "src/theme/theme-presets.test.ts#seeds the three new status tokens with their exact owner-approved hexes"
        status: pass
      - kind: other
        ref: "npm run check:colors (no hex literal outside src/**/theme/**)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pure ringVisual(status, colors) maps all five states to {color, opacity, width}; opacity no longer signals a real status; border weight escalates as CVD backup"
    requirement: WDG-01
    verification:
      - kind: unit
        ref: "src/components/ContactCard.test.tsx#ringVisual (retires OD-1 opacity placeholder) — 6 cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "ContactCard dashboard ring renders the real status colour + escalating weight on-device; accessibilityLabel band preserved for uiautomator UAT"
    requirement: WDG-01
    verification:
      - kind: manual_procedural
        ref: "on-device Pixel UAT — dashboard ContactCards show teal/gold/coral/amber/neutral rings with escalating border weight"
        status: unknown
    human_judgment: true
    rationale: "Colour rendering + visual weight escalation is owner taste/visual verification on the physical device; unit tests prove the mapping but not the pixels. Emulator cannot substitute (owner's device-verify policy)."

# Metrics
duration: 6min
completed: 2026-08-17
status: complete
---

# Phase 12 Plan 01: Shared Status Palette + ContactCard Ring Summary

**Owner-approved statusStable/Wobble/Decay theme tokens (#45B98A/#E8C15C/#E56A52) land as one source of truth, and ContactCard's OD-1 opacity placeholder is retired for a real colour + escalating-border-weight status ring via a pure, unit-tested ringVisual() helper.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-17T07:33:19Z
- **Completed:** 2026-08-17T07:39:00Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Declared `statusStable`/`statusWobble`/`statusDecay` flat tokens on `ThemePalette` beside `rogue`, with status-not-action doc-comments, and seeded the three owner-approved hexes in the `space-dark` preset (the sole colour-literal file). `rogue #E0904A` unchanged.
- Locked all three seeds under an exact-value test in `theme-presets.test.ts` so a future drift fails loudly (Codex/Claude M1).
- Extracted a pure, RN-free `ringVisual(status, colors)` helper covering all five states, and rewired `ContactCard` to consume it — retiring the opacity-as-signal placeholder for real colour + a redundant escalating border weight (CVD backup). `accessibilityLabel` and all testIDs preserved for uiautomator UAT.
- `check:colors` clean (no hex outside the theme layer), `tsc --noEmit` clean, full suite 843/843 green.

## Task Commits

1. **Tasks 1+2: Declare + seed the three shared status tokens** - `73ae9b7` (feat) — committed together because tsc requires the preset to seed the new required fields the moment the type declares them (the plan anticipated this).
2. **Task 3 (RED): failing ringVisual unit spec + vitest .tsx glob** - `97c5936` (test)
3. **Task 3 (GREEN): ringVisual helper + ContactCard wiring** - `42072c5` (feat)

_TDD gate: `test(...)` (97c5936) precedes `feat(...)` (42072c5). No refactor commit needed._

## Files Created/Modified
- `src/theme/theme-types.ts` - Added three status token fields on `ThemePalette` with doc-comments mirroring `rogue`.
- `src/theme/theme-presets.ts` - Seeded `statusStable #45B98A` / `statusWobble #E8C15C` / `statusDecay #E56A52` in `space-dark`.
- `src/theme/theme-presets.test.ts` - Exact-hex lock for the three seeds + non-empty-string assertion across presets.
- `src/components/contact-card-ring.ts` - **New.** Pure RN-free `ringVisual()` status→ring mapping.
- `src/components/ContactCard.tsx` - Consumes `ringVisual` via `useTheme().colors.*`, re-exports it, retires OD-1; doc-comments updated.
- `src/components/ContactCard.test.tsx` - **New.** 6 unit cases over `ringVisual` (all five states + an opacity-never-signals-status guard).
- `vitest.config.ts` - Extended `include` to also match `src/**/*.test.tsx`.

## Decisions Made
- **ringVisual lives in an RN-free sibling module, not inline in ContactCard.tsx.** Importing anything from `ContactCard.tsx` transitively loads `react-native`, whose Flow-typed `index.js` cannot be parsed by the node test runner. The pure `.ts` sibling (re-exported from the `.tsx`) mirrors the existing `avatar-initials.ts`/`Avatar.tsx` split and is the repo's established way to make component logic node-testable. The plan's "exported from ContactCard.tsx" contract is preserved via the re-export.
- **Corrected the helper signature** from the plan's `colors: ThemePalette["colors"]` (a non-existent key — `ThemePalette` *is* the colours object) to `colors: ThemePalette`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted ringVisual to a pure RN-free sibling module**
- **Found during:** Task 3 (TDD RED)
- **Issue:** The plan places `ringVisual` in `ContactCard.tsx` and has the test import it from there. Importing from `ContactCard.tsx` loads `react-native` (Flow-typed `index.js`), which the node/esbuild test transform cannot parse — the test errored before any assertion ran, so the helper was not unit-testable as specified.
- **Fix:** Created `src/components/contact-card-ring.ts` with the pure `ringVisual`, re-exported it from `ContactCard.tsx` (so it is still "exported from ContactCard"), and imported the pure module in the test. Mirrors the existing `avatar-initials.ts` pattern. Also corrected the helper's `colors` param type (`ThemePalette["colors"]` → `ThemePalette`).
- **Files modified:** src/components/contact-card-ring.ts (new), src/components/ContactCard.tsx, src/components/ContactCard.test.tsx
- **Verification:** `npx vitest run src/components/ContactCard.test.tsx` → 6 pass; tsc clean.
- **Committed in:** 97c5936 (test) / 42072c5 (impl)

**2. [Rule 3 - Blocking] Extended vitest `include` to match `.test.tsx`**
- **Found during:** Task 3 (TDD RED)
- **Issue:** The runner's `include` was `src/**/*.test.ts` only, so the plan's named `ContactCard.test.tsx` artifact did not match — and with `passWithNoTests: true`, the plan's verify command `npx vitest run src/components/ContactCard.test.tsx` returned exit 0 "No test files found", **masking** the test (the objective forbids masked failures).
- **Fix:** Added `src/**/*.test.tsx` to `include` (kept a comment noting tests must stay render-free in the node env). This honours the plan's `.test.tsx` filename and its verbatim verify command while making the test actually run.
- **Files modified:** vitest.config.ts
- **Verification:** The verify command now collects and runs the file (6 pass); full suite 843/843 green.
- **Committed in:** 97c5936 (part of the RED commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking build/test-infra). No product or architectural change; no ADR/HANDOFF decision touched.
**Impact on plan:** Necessary to make the planned unit test executable and un-masked. `ringVisual` is still exported from `ContactCard.tsx` and consumed via `useTheme().colors.*` exactly as specified; the only structural change is which file physically holds the pure function.

## Issues Encountered
- The `react-native` import barrier in the node test env (resolved via the pure-module extraction above). No other issues.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The three shared status tokens now exist as one source of truth for the widget bitmap (12-03/12-05) and the Phase-13 orrery to consume — no re-derivation of hexes downstream.
- **Deferred to on-device Pixel UAT (D3):** the dashboard ring's actual colour rendering + visual weight escalation is owner visual verification (emulator cannot substitute per the device-verify policy). The mapping itself is unit-proven.
- WDG-01 is partially satisfied (each avatar carries its status colour on the dashboard; shared palette ready for the widget surface, which is gated on the native rebuild in a later plan).

## Self-Check: PASSED

---
*Phase: 12-home-screen-widget*
*Completed: 2026-08-17*
