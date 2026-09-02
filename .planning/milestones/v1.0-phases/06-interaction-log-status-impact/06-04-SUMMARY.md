---
phase: 06-interaction-log-status-impact
plan: 04
subsystem: database
tags: [sqlite, status, rogue, theme-tokens, react-native]

# Dependency graph
requires:
  - phase: 06-interaction-log-status-impact
    provides: "query-time status engine (STATUS_SQL/PROGRESS_SQL/ROGUE_K in status.ts), the ContactProfileScreen scaffold + single unified load()"
provides:
  - "REASON_SQL — rogue reason CASE mirroring STATUS_SQL branch order (overdue / unresponsive / NULL)"
  - "getContactStatus(exec, contactId) — single-contact query-time status + reason (incl. rogue), never-contacted NULL-guarded"
  - "query-time types ProfileStatus ('stable'|'wobble'|'decay'|'rogue') + RogueReason ('unresponsive'|'overdue'|null)"
  - "ThemePalette.rogue (status colour token) + ThemePalette.gravityTiers (ordered 4-entry gravity ramp) with space-dark seeds"
  - "in-app rogue label + reason render on the contact profile via colors.rogue"
affects: [06-05 GravityBar (consumes gravityTiers), 06-06 IntensityLine, status/impact surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reason CASE mirrors STATUS_SQL branch order so status and reason can never disagree"
    - "By-id status seek guards last_contact NULL in TS (STATUS_SCAN's NULL pre-filter is absent on a single seek)"
    - "New status/gravity colour tokens declared like danger/avatarSwatches; seeded only in theme-presets.ts"

key-files:
  created:
    - src/db/contact-status-read.ts
    - src/db/contact-status-read.test.ts
  modified:
    - src/db/status.ts
    - src/db/status.test.ts
    - src/theme/theme-types.ts
    - src/theme/theme-presets.ts
    - src/theme/theme-presets.test.ts
    - src/screens/ContactProfileScreen.tsx

key-decisions:
  - "REASON_SQL interpolates only code constants (WOBBLE_MAX, ROGUE_K, PROGRESS_SQL); contactId ?-bound (T-06-06)"
  - "Branch logic (rarely_responds-first, ROGUE_K) is CITED/firm; reason value naming (overdue/unresponsive) is the RESEARCH A4 label-copy assumption"
  - "gravityTiers seeded at exactly 4 entries (thin/building/solid/deep) to match Plan 05's GRAVITY_TIERS; test asserts exact length"
  - "rogue is its own token (amber attention hue), never reusing danger (danger = destructive action, rogue = status)"

patterns-established:
  - "Query-time status+reason read via one by-id SELECT composing PROGRESS_SQL/STATUS_SQL/REASON_SQL"
  - "Rogue label is in-app only (never a notification), styled through a themed token"

requirements-completed: [LOG-05, LOG-04]

coverage:
  - id: D1
    description: "REASON_SQL rogue reason CASE (overdue / unresponsive / NULL) mirroring STATUS_SQL branch order"
    requirement: "LOG-05"
    verification:
      - kind: unit
        ref: "src/db/status.test.ts#REASON_SQL — rogue reason (mirrors STATUS_SQL branch order)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getContactStatus single-contact query-time status + reason incl. rogue, never-contacted NULL guard"
    requirement: "LOG-05"
    verification:
      - kind: unit
        ref: "src/db/contact-status-read.test.ts#getContactStatus"
        status: pass
    human_judgment: false
  - id: D3
    description: "rogue + gravityTiers status/gravity colour tokens on ThemePalette with space-dark seeds"
    requirement: "LOG-05"
    verification:
      - kind: unit
        ref: "src/theme/theme-presets.test.ts#status/gravity colour tokens (LOG-05, owner-approved 2026-08-15)"
        status: pass
      - kind: other
        ref: "npm run check:colors (no colour literal outside src/**/theme/**)"
        status: pass
    human_judgment: false
  - id: D4
    description: "In-app rogue label + reason renders on the contact profile via colors.rogue (LOG-04 render half)"
    requirement: "LOG-04"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npm run check:colors && npx biome check src/screens/ContactProfileScreen.tsx"
        status: pass
    human_judgment: true
    rationale: "RN screen render + correct hue/copy placement is UI-observable only; on-device UAT on the Pixel (drive a contact past ROGUE_K or set Rarely-responds + overdue) confirms the label + reason render and that no notification fires."

# Metrics
duration: 5min
completed: 2026-08-15
status: complete
---

# Phase 6 Plan 4: Rogue reason + status/gravity colour tokens + in-app rogue label Summary

**REASON_SQL + getContactStatus give the rogue state a query-time reason (overdue/unresponsive), the theme gains `rogue` + a 4-entry `gravityTiers` token set, and the profile renders an in-app rogue label via `colors.rogue`.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-15T20:26:39Z
- **Completed:** 2026-08-15T20:31:27Z
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments
- `REASON_SQL` in status.ts: a rogue-reason CASE whose branch order is IDENTICAL to STATUS_SQL (rarely_responds branch first → 'unresponsive'; progress ≥ ROGUE_K → 'overdue'; else NULL), so status and reason can never disagree — including the rarely_responds-past-ROGUE_K case reading 'unresponsive' in both.
- `getContactStatus(exec, contactId)`: a single by-id SELECT composing PROGRESS_SQL/STATUS_SQL/REASON_SQL, returning query-time `ProfileStatus` (incl. rogue) + `RogueReason`, with a TS guard forcing status/reason/progress to null for a never-contacted (last_contact NULL) contact.
- Added `rogue: string` + `gravityTiers: readonly string[]` to `ThemePalette` (declared like danger/avatarSwatches) with seeded space-dark values (amber `#E0904A`; 4-entry thin→deep ramp) — the sole colour-literal file.
- The profile now renders "No longer in a working orbit · {reason}" when status==='rogue', emphasis via `colors.rogue` + reason in textSecondary; in-app only, no notification; never-contacted shows nothing; existing Rarely-responds label preserved.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing tests for REASON_SQL + getContactStatus** - `72f4873` (test)
2. **Task 1 (GREEN): REASON_SQL + getContactStatus** - `644a213` (feat)
3. **Task 2: rogue + gravityTiers colour tokens** - `3d560e0` (feat)
4. **Task 3: rogue label + reason render on profile** - `624c493` (feat)
5. **Task 1 test formatting** - `ff42d86` (style)

## Files Created/Modified
- `src/db/status.ts` - Added `REASON_SQL` (rogue reason CASE); STATUS_SQL/PROGRESS_SQL/ROGUE_K unchanged.
- `src/db/contact-status-read.ts` - `getContactStatus` + query-time types `ProfileStatus`/`RogueReason`.
- `src/db/status.test.ts` - REASON_SQL bucket coverage (overdue / unresponsive / branch-order / NULL).
- `src/db/contact-status-read.test.ts` - getContactStatus behaviours incl. never-contacted NULL and missing-id.
- `src/theme/theme-types.ts` - `ThemePalette.rogue` + `ThemePalette.gravityTiers`.
- `src/theme/theme-presets.ts` - space-dark seeds for both new tokens.
- `src/theme/theme-presets.test.ts` - shape/presence assertions; gravityTiers exact length == 4.
- `src/screens/ContactProfileScreen.tsx` - loads getContactStatus in the unified load(); renders the rogue label.

## Decisions Made
- Reason value naming (overdue/unresponsive) is the RESEARCH A4 assumption for label copy; the branch logic is CITED and firm.
- `gravityTiers` seeded at exactly 4 entries; the test mirrors the tier count as a literal (`4`) with an exact-length assertion because Plan 05's `impact.ts` is a sibling in this wave and does not yet exist to import from.
- rogue kept as its own token (a status/attention hue), never `danger` (destructive action).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- One biome formatting nit in the new REASON_SQL test block surfaced in the final full-suite run; auto-formatted via `biome check --write` and committed as `ff42d86` (style). No logic change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `gravityTiers` + `rogue` tokens are in place for Plan 05's GravityBar and the rogue label to consume — no borrowing of danger/accent.
- On-device UAT (Pixel) still needed for D4: drive a contact past ROGUE_K (or set Rarely-responds + overdue) and confirm the rogue label + correct reason render in the `colors.rogue` hue, and that no notification is produced by this surface.

## Self-Check: PASSED

- Created files exist: `src/db/contact-status-read.ts`, `src/db/contact-status-read.test.ts` — FOUND.
- Commits exist: `72f4873`, `644a213`, `3d560e0`, `624c493`, `ff42d86` — FOUND.
- Full suite: `npx vitest run` → 41 files / 483 tests passed; `npx tsc --noEmit` clean; `npm run check:colors` clean; `npx biome check src` clean.

---
*Phase: 06-interaction-log-status-impact*
*Completed: 2026-08-15*
