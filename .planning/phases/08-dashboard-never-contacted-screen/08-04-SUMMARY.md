---
phase: 08-dashboard-never-contacted-screen
plan: 04
subsystem: ui
tags: [react-native, expo, zustand, asyncstorage, dashboard, theme-tokens]

# Dependency graph
requires:
  - phase: 08-dashboard-never-contacted-screen (Plan 01)
    provides: dashboard-read.ts — DashboardSort / DashboardFilter unions + DashboardRow projection
  - phase: 05 (Avatar / PHOTO-04)
    provides: Avatar component with recyclingKey + cacheBust wiring
  - phase: 07 (fuel)
    provides: RankedFuelLine (surface-agnostic fuel line) + FuelSearchResultRow snippet idiom
  - phase: foundation (FND-05)
    provides: theme-store Zustand persist pattern + theme tokens
provides:
  - ContactCard — the LOCKED shared card content contract (presentational, no DB/nav)
  - FilterChipRow — single-active chip control (presentational)
  - useDashboardPrefs — persisted last-used sort + filter (AsyncStorage)
affects: [08-05, 08-07, 08-09, dashboard, never-contacted-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational primitive: explicit props, no DB read / no getExecutor / no useNavigation — caller wires onPress"
    - "Token-clean status placeholder: shape/opacity over existing tokens + a naming accessibilityLabel, in lieu of not-yet-approved band tokens (OD-1)"
    - "Persisted UI preference via Zustand persist over AsyncStorage (theme-store analog), NOT a SQLite row"

key-files:
  created:
    - src/components/ContactCard.tsx
    - src/components/FilterChipRow.tsx
    - src/stores/dashboard-prefs-store.ts
  modified: []

key-decisions:
  - "Status ring shipped as a token-clean placeholder (rogue=colors.rogue; stable/wobble/decay differentiated by opacity over textSecondary/border) — no band hex invented; coloured-band variant left as owner decision OD-1"
  - "Favourite marker is a provisional accent star (OD-2); category chip is surfaceElevated + textSecondary (OD-4) — both flagged, no new token"
  - "Card rule for the search variant stays simply 'snippet present → show snippet' (the DAO sets snippet non-null on any fuel match, incl. name+fuel, review MEDIUM-6)"
  - "Active chip label uses colors.background on the accent fill (shipped filled-accent idiom) for legibility, token-clean"

patterns-established:
  - "Pattern: LOCKED testIDs + a status-naming accessibilityLabel so uiautomator UAT asserts state without colour inspection"
  - "Pattern: null status renders the neutral never-contacted state, never 'Stable' (mirrors the getContactStatus / dashboard-read HIGH-1 guard)"

requirements-completed: [DASH-02, DASH-03, DASH-07]

coverage:
  - id: D1
    description: "ContactCard renders the LOCKED content contract (Avatar recyclingKey+cacheBust, token-clean status ring, one-line name, ranked-fuel OR snippet, category chip hidden when null, favourite marker) with the LOCKED testIDs + status accessibilityLabel"
    requirement: "DASH-03"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npm run check:colors (clean)"
        status: pass
    human_judgment: true
    rationale: "Visual/layout + on-device face-flash behaviour is device-UAT, deferred to the end-of-phase Pixel pass (Plans 07/09). Automated gates prove type/colour discipline only, not the rendered contract."
  - id: D2
    description: "FilterChipRow renders a single-active chip row (active accent/borderStrong, inactive surface/border), LOCKED dashboard-filter-chip-{key} testIDs, count in label for snoozed/favourites"
    requirement: "DASH-02"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npm run check:colors (clean)"
        status: pass
    human_judgment: true
    rationale: "Chip visuals + active-state contrast are device-UAT, deferred to Plan 09 assembly on the Pixel."
  - id: D3
    description: "useDashboardPrefs persists last-used sort (default status) + filter (default all) across launches via Zustand persist over AsyncStorage"
    requirement: "DASH-07"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean); theme-store persist pattern copied verbatim"
        status: pass
    human_judgment: true
    rationale: "Cross-launch persistence is only observable on-device; no node test was specified for AsyncStorage rehydration. Verify in the Plan 09 Pixel pass."

# Metrics
duration: 6min
completed: 2026-08-15
status: complete
---

# Phase 8 Plan 04: Dashboard UI primitives (ContactCard + FilterChipRow + dashboard-prefs-store) Summary

**Three decoupled, presentational dashboard primitives — the LOCKED ContactCard content contract, a single-active FilterChipRow, and a Zustand/AsyncStorage sort+filter prefs store — all token-clean and testID-complete, ready for the screens (Plans 05/07/09) to assemble.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-15T23:36:00Z
- **Completed:** 2026-08-15T23:39:00Z
- **Tasks:** 3
- **Files modified:** 3 (all created)

## Accomplishments
- `ContactCard` composes the LOCKED contract from the existing `Avatar` + `RankedFuelLine` unchanged: recyclingKey via `contactId` + `cacheBust=modifiedAt` (anti-face-flash correctness), a token-clean status-ring placeholder with a status-naming `accessibilityLabel`, a one-line name, the ranked fuel line OR a fuel-match snippet, a category chip hidden when null, and a provisional favourite star — nothing log-derived.
- `FilterChipRow` renders a horizontal, single-active chip control (active `accent`/`borderStrong`, inactive `surface`/`border`), emits the LOCKED `dashboard-filter-chip-{key}` testIDs, and carries counts in the snoozed/favourites labels — parent owns the active state.
- `useDashboardPrefs` persists last-used sort (`status`) + filter (`all`) across launches, copying the shipped `theme-store` persist shape verbatim (AsyncStorage, version 1, partialize, warn-on-rehydrate) — a device-local UI pref, not a SQLite row.
- All three flagged owner decisions (OD-1 band tokens, OD-2 favourite marker, OD-4 category chip) were surfaced with token-clean placeholders and code comments — no hex invented.

## Task Commits

Each task was committed atomically:

1. **Task 1: ContactCard.tsx — LOCKED shared card content contract** — `b08d78b` (feat)
2. **Task 2: FilterChipRow.tsx — single-active chip control** — `4182bd7` (feat)
3. **Task 3: dashboard-prefs-store.ts — persisted sort + filter** — `fbcd408` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) — final docs commit.

## Files Created/Modified
- `src/components/ContactCard.tsx` - The LOCKED presentational dashboard/never-contacted card; explicit `ContactCardProps`, no DB/nav.
- `src/components/FilterChipRow.tsx` - Presentational single-active chip row built from `ScrollView` + `Pressable`.
- `src/stores/dashboard-prefs-store.ts` - Zustand persist store for last-used sort+filter over AsyncStorage.

## Decisions Made
- Status ring is a token-clean placeholder: `rogue` reads `colors.rogue`; the three bands + the neutral never-contacted state differ ONLY by opacity over `textSecondary`/`border`. Band colours (OD-1) remain the owner's call — no hex invented.
- Active chip label renders in `colors.background` on the `accent` fill (the shipped filled-accent CTA idiom) for legibility; inactive label is `textSecondary`.
- Kept the card's search-variant rule minimal ("snippet present → show snippet") because the 08-01 DAO already sets `snippet` non-null on any fuel match, including a combined name+fuel match (review MEDIUM-6).
- Status `accessibilityLabel`s are distinct per band (Stable / Wobbling / Decaying / Rogue / "Not yet contacted") so uiautomator UAT can assert the band without colour.

## Deviations from Plan

None - plan executed exactly as written. No bugs, missing critical functionality, blocking issues, or architectural changes surfaced; the flagged owner decisions were handled with the token-clean placeholders the plan/UI-SPEC prescribe.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The three primitives are token-clean (`check:colors` green across full `src`), type-clean (`tsc --noEmit` green), and carry the LOCKED testIDs — ready for Plans 05/07/09 to assemble into the dashboard + never-contacted screens.
- Deferred to the end-of-phase Pixel UAT (Plans 07/09): the rendered card contract, the recycling-list face-flash behaviour, chip active-state contrast, and cross-launch persistence of sort+filter.
- Owner decisions still open for a later design pass: OD-1 status band tokens, OD-2 favourite marker glyph/token, OD-4 category colour-coding, plus exact card/chip layout.

## Self-Check: PASSED

---
*Phase: 08-dashboard-never-contacted-screen*
*Completed: 2026-08-15*
