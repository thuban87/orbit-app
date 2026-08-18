---
phase: 13-orrery
plan: 04
subsystem: theme + orrery-logic
tags: [theme-tokens, starPalette, orrery, ring-style, sun-occupant, ringVisual-reuse, tdd, node-tested]

# Dependency graph
requires:
  - phase: 13-orrery (13-01)
    provides: "app-settings-dao exported self_sun_colour validator (SELF_SUN_COLOUR_RE / assertSelfSunColour) — the M6 conformance lock imports it"
  - phase: 12-widget (12-01)
    provides: "ringVisual(status, colors) — the status→colour vocabulary orreryRingStyle extends (colour reused, never re-mapped)"
  - phase: 08-dashboard
    provides: "contact-status-read.ts ProfileStatus | null (never-contacted → null status), the *-logic.ts pure-resolver idiom"
provides:
  - "starPalette / mutedStable / mutedWobble / mutedDecay / rogueExtinguished — five owner-tunable ThemePalette tokens seeded in space-dark.dark"
  - "orreryRingStyle(status, colors) — pure status→{color,opacity,width,strokeStyle,bodyFill}; reuses ringVisual, adds the stroke axis + rogue body split + the CANONICAL null→neutral (colors.border) fallback"
  - "resolveSunOccupant(input) — pure self/contact/archived-fallback sun resolver; NULL/archived/missing → self, live contact → status glow, never-contacted → the reused neutral glow (C2-2)"
affects: [13-05, 13-06, 13-07, orrery render, sun glow, planet body fill, self-sun swatch picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "orreryRingStyle EXTENDS ringVisual (imports + reuses the {color,opacity,width} triple) — status→colour is mapped in exactly one place, never duplicated"
    - "The null→neutral (colors.border) fallback is defined ONCE in orrery-ring-logic and REUSED by sun-occupant-logic via orreryRingStyle(status, colors).color — a never-contacted contact-sun glows the neutral border with no invented colour (C2-2)"
    - "M6/C2-5 palette⟷validator coupling: the starPalette conformance test IMPORTS the real DAO validator (SELF_SUN_COLOUR_RE + assertSelfSunColour) rather than re-inlining the regex, so the palette lock and the write path cannot desync"
    - "Logic-test palettes sourced from THEME_PRESERTS['space-dark'].dark (C2-3), never an inline hex fake palette — the no-arg check:colors stays green"

key-files:
  created:
    - src/logic/orrery-ring-logic.ts
    - src/logic/orrery-ring-logic.test.ts
    - src/logic/sun-occupant-logic.ts
    - src/logic/sun-occupant-logic.test.ts
  modified:
    - src/theme/theme-types.ts
    - src/theme/theme-presets.ts
    - src/theme/theme-presets.test.ts

key-decisions:
  - "All five new hex seeds live ONLY in theme-presets.ts (the single sanctioned hex file); the two logic modules take a resolved ThemePalette and stay hex-free — check:colors enforces it"
  - "orreryRingStyle reuses ringVisual for the colour triple (no second status→colour map); it adds strokeStyle (solid→dashed→faded→faintTrace) and bodyFill (full status for stable/wobble/decay, rogueExtinguished for the rogue BODY while the RING keeps colors.rogue)"
  - "The null→neutral colour is colors.border, defined once in orreryRingStyle and reused by resolveSunOccupant — a never-contacted contact-sun glows it (C2-2), no new colour invented"
  - "resolveSunOccupant treats NULL id, an archived occupant, AND a missing/unknown id all as self (A7) — the sun never glows a hidden contact; glow = selfSunColour ?? starPalette[0]"
  - "M6/C2-5: the starPalette conformance test imports the ACTUAL exported DAO validator, so a non-6-hex seed fails the suite before it could throw inside updateAppSettings when a swatch is tapped"

patterns-established:
  - "Extend-don't-duplicate: a new pure mapping imports the shipped one (ringVisual) and adds only its new axes"
  - "Define a fallback colour once, reuse it by calling the module that owns it (orrery-ring-logic's null→neutral)"
  - "Lock owner-tunable seeds against the real downstream validator by importing it, never re-declaring the rule"

requirements-completed: [ORR-01, ORR-04, ORR-05]

coverage:
  - id: T1
    description: "Five orrery theme tokens declared on ThemePalette and seeded in space-dark.dark (starPalette >= 6, gold #F2C14E at index 0, muted*, rogueExtinguished); every hex in theme-presets.ts only"
    requirement: "ORR-05"
    verification:
      - kind: unit
        ref: "src/theme/theme-presets.test.ts#orrery theme tokens — gold-at-0, length >= 6, muted + rogueExtinguished non-empty"
        status: pass
      - kind: other
        ref: "npm run check:colors → clean (every new hex inside theme-presets.ts)"
        status: pass
    human_judgment: false
  - id: T1-M6
    description: "starPalette format lock — every entry passes the REAL exported self_sun_colour DAO validator (imported, not re-inlined) so a tapped swatch can never throw in updateAppSettings"
    requirement: "ORR-05"
    verification:
      - kind: unit
        ref: "src/theme/theme-presets.test.ts#M6 + C2-5 — SELF_SUN_COLOUR_RE.test + assertSelfSunColour not.toThrow for every starPalette entry"
        status: pass
      - kind: other
        ref: "grep — test imports SELF_SUN_COLOUR_RE/assertSelfSunColour from @/db/app-settings-dao; no re-declared /^#[0-9A-Fa-f]{6}$/"
        status: pass
    human_judgment: false
  - id: T2
    description: "orreryRingStyle — solid/dashed/faded/faintTrace stroke vocabulary reusing ringVisual's colour, rogue ring/body split (ring colors.rogue, body rogueExtinguished), and the null→neutral (colors.border) fallback that never throws"
    requirement: "ORR-04"
    verification:
      - kind: unit
        ref: "src/logic/orrery-ring-logic.test.ts — each status→style row incl. null→neutral + colour/opacity/width parity with ringVisual"
        status: pass
    human_judgment: false
  - id: T3
    description: "resolveSunOccupant — NULL→self, NULL+no-colour→starPalette[0], live-contact→status glow, never-contacted(status null)→neutral border glow (C2-2), archived→self, missing→self (A7); accepts status: ProfileStatus | null"
    requirement: "ORR-05"
    verification:
      - kind: unit
        ref: "src/logic/sun-occupant-logic.test.ts — all six behavior cases"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit clean — resolveSunOccupant accepts ProfileStatus | null; no invented colour (glow via orreryRingStyle / starPalette / selfSunColour)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-18
status: complete
---

# Phase 13 Plan 04: Orrery Theme Tokens + Ring-Style + Sun-Occupant Logic Summary

**The orrery's visual vocabulary: five owner-tunable theme tokens (`starPalette` with gold `#F2C14E` at index 0, `mutedStable/Wobble/Decay`, `rogueExtinguished`) seeded in the one hex file; `orreryRingStyle` — a pure status→ring-style map that EXTENDS the shipped `ringVisual` with a stroke axis + the extinguished-rogue body + the canonical null→neutral fallback; and `resolveSunOccupant` — a pure self/contact/archived-fallback sun resolver (A7) that reuses that null→neutral for a never-contacted contact-sun (C2-2). All colours land in `theme-presets.ts`; both logic modules stay hex-free and node-tested.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-18T19:44Z
- **Completed:** 2026-08-18T19:49Z
- **Tasks:** 3
- **Files created:** 4 · **Files modified:** 3

## Accomplishments
- **Task 1 (theme tokens):** Declared five keys on `ThemePalette` (`starPalette: readonly string[]`, `mutedStable/Wobble/Decay: string`, `rogueExtinguished: string`), each with the owner-tunable "order-stable seed" doc idiom mirroring `avatarSwatches`/`gravityTiers`. Seeded them in `space-dark.dark` ONLY — the six-colour star palette (gold `#F2C14E` at index 0, amber, rose-red, violet, cyan, ice-white), the three desaturated muted endpoints, and the cold blue-grey `rogueExtinguished` — using the UI-SPEC seeds. Added an M6/C2-5 conformance describe block that IMPORTS the real `SELF_SUN_COLOUR_RE` + `assertSelfSunColour` from `app-settings-dao` and asserts every `starPalette` entry passes the ACTUAL DAO write-path rule (no re-inlined regex), plus gold-at-0 and length ≥ 6.
- **Task 2 (orrery-ring-logic, TDD):** `orreryRingStyle(status, colors)` returns `{color, opacity, width, strokeStyle, bodyFill}` and a `StrokeStyle` union `'solid'|'dashed'|'faded'|'faintTrace'`. It IMPORTS and reuses `ringVisual` for the `{color, opacity, width}` triple (status→colour never re-mapped) and adds `strokeStyle` (solid→dashed→faded→faintTrace by status) and `bodyFill` (full status colour for stable/wobble/decay; `colors.rogueExtinguished` for the rogue BODY while the ring keeps `colors.rogue`). `null` status returns the canonical neutral (`color = colors.border`), never throwing — the single fallback `sun-occupant-logic` reuses (C2-2).
- **Task 3 (sun-occupant-logic, TDD):** `resolveSunOccupant(input)` returns a `SunOccupant` discriminated union `{kind:'self'|'contact', photo, glowColor, contactId?}`. NULL id, an archived occupant, OR a missing/unknown id all fall back to self (A7) with `glowColor = selfSunColour ?? starPalette[0]`; a live, non-archived contact glows its STATUS colour via `orreryRingStyle(occupant.status, colors).color`, which — because `status` is `ProfileStatus | null` — resolves a never-contacted contact-sun (status `null`) to the reused neutral border (C2-2), inventing no colour.

## Task Commits

1. **Task 1: orrery theme tokens (types + seeds + M6 lock)** — `1801915` (feat; single commit, `type="auto"` with the conformance test co-landed)
2. **Task 2: orreryRingStyle (TDD)** — `d35d528` (test/RED) → `4cbfad5` (feat/GREEN)
3. **Task 3: resolveSunOccupant (TDD)** — `c923b16` (test/RED) → `10780dd` (feat/GREEN)

## Files Created/Modified
- `src/theme/theme-types.ts` — five new `ThemePalette` keys with owner-tunable-seed doc comments (M6 note on the 6-hex constraint)
- `src/theme/theme-presets.ts` — the five seeds in `space-dark.dark` (the only hex file)
- `src/theme/theme-presets.test.ts` — M6/C2-5 conformance block importing the real DAO validator + gold-at-0/length/muted/rogueExtinguished assertions
- `src/logic/orrery-ring-logic.ts` — `orreryRingStyle` + `StrokeStyle`/`OrreryRingStyle` types
- `src/logic/orrery-ring-logic.test.ts` — 6 node cases (each status row + null→neutral + ringVisual parity), palette from `THEME_PRESETS`
- `src/logic/sun-occupant-logic.ts` — `resolveSunOccupant` + `SunOccupant`/`SunOccupantInput`/`SunOccupantLookup` types
- `src/logic/sun-occupant-logic.test.ts` — 6 node cases (self / self-no-colour→starPalette[0] / live→status glow / never-contacted→neutral / archived→self / missing→self), palette + picked colour from `THEME_PRESETS`

## Decisions Made
None beyond the plan — every decision (the five token seeds, the ringVisual reuse, the rogue ring/body split, the single null→neutral fallback, the A7 archived/missing→self fallback, the C2-2 never-contacted→neutral glow, the C2-5 validator import) was pre-specified by the plan and its cross-AI convergence. Implemented as written.

One choice inside the delegated bucket: `orreryRingStyle`'s `null` branch returns `strokeStyle: 'solid'` and `bodyFill: colors.border` alongside the asserted `color: colors.border` — the tests lock only the neutral colour (the C2-2 reuse point), leaving the neutral's stroke/body as a sane non-throwing default.

## Deviations from Plan

None — plan executed exactly as written. (One in-flight correction, not a deviation: the sun-occupant test initially used `#123ABC` literals for the "picked" self-sun colour; `check:colors` correctly flagged them since `/logic/` is not exempt, so the picked value was re-sourced from `starPalette[3]` — hex-free, C2-3.)

## Issues Encountered
None. `check:colors` caught the placeholder hex in the logic test on the first Task-3 gate run; fixed by sourcing the value from the palette (the intended pattern).

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- **13-05 render** consumes `orreryRingStyle` for every orbiting body (ring stroke + planet body fill) and `resolveSunOccupant` for the sun's occupant + glow. Note: `resolveSunOccupant` expects the caller to have already looked the sun-contact up (`occupant: {photo, status, archived} | null`) — a `null` occupant means missing → self.
- **13-06 Settings self-sun swatch picker** writes a tapped `starPalette` entry to `self_sun_colour`; the M6 lock guarantees every seed passes the DAO validator, so a swatch tap can never throw.
- **C2-2 thread:** the screen must pass `statusRow?.status ?? null` into `resolveSunOccupant` — a never-contacted contact-sun (status `null`) glows the neutral border, by design.
- **Design pass (deferred, owner §12.4):** the exact seed hexes are tunable defaults; retuning `starPalette` / `muted*` / `rogueExtinguished` in `theme-presets.ts` restyles the orrery with no code change.

## Self-Check: PASSED

All 7 created/modified files exist on disk; all 5 task commits (`1801915`, `d35d528`, `4cbfad5`, `c923b16`, `10780dd`) are in git history. Full suite `npx vitest run src/theme/theme-presets.test.ts src/logic/orrery-ring-logic.test.ts src/logic/sun-occupant-logic.test.ts` → 29 passed; `npx tsc --noEmit` clean; `npm run check:colors` clean.

---
*Phase: 13-orrery*
*Completed: 2026-08-18*
