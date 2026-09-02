---
phase: 13-orrery
plan: 03
subsystem: database
tags: [sqlite, ring_seq, orrery, status-sql, node-sqlite, reorder, favourites-clone]

# Dependency graph
requires:
  - phase: 08-dashboard
    provides: "dashboard-read.ts read-chokepoint idiom, status.ts PROGRESS_SQL/STATUS_SQL fragments, rewriteFavouriteRanks 3-guard transactional reorder"
  - phase: 13-orrery (13-02)
    provides: "computeRingReorder (drag→order array) that feeds rewriteRingSeq"
provides:
  - "listOrbitingContacts(exec, {excludeContactId?}) — the orbiting-set scan composing status.ts, dense read-time rank, snooze retained, sun occupant excluded"
  - "rewriteRingSeq(exec, orderedIds, now, excludeContactId) — first contacts.ring_seq writer; favourites 3-guard clone with occupant-exclusion scope"
  - "listSunCandidates(exec) — favourites-first, non-archived candidate list for the Settings sun-picker"
  - "ORBITING_SELECT — exported projection embedding STATUS_SQL/PROGRESS_SQL for the parity guard"
affects: [13-04, 13-05, 13-06, 13-07, orrery render, sun-picker, ring-drag-release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-chokepoint composing status.ts fragments (never re-deriving thresholds) — extends the dashboard-read idiom to the orrery"
    - "Dense read-time rank (ORDER BY COALESCE(ring_seq,1e9), created_at, id) makes a stale/duplicate stored ring_seq harmless (M3, no renumber sweep)"
    - "Transactional reorder clone with an optional occupant-exclusion (AND id <> ?) appended to BOTH the count guard and each scoped UPDATE"

key-files:
  created:
    - src/db/orrery-read.ts
    - src/db/orrery-read.test.ts
    - src/db/ring-seq-dao.ts
    - src/db/ring-seq-dao.test.ts
    - src/db/sun-picker-read.ts
    - src/db/sun-picker-read.test.ts
  modified: []

key-decisions:
  - "orrery-read deliberately DIVERGES from dashboard BASE_WHERE: it does NOT filter snooze_until (L11 lock-test asserts a snoozed-but-contacted contact IS present)"
  - "excludeContactId occupant-exclusion is appended to BOTH Guard 2's COUNT and every Guard 3 UPDATE, so the guard's effective set == orrery-read's RENDERED (sun-excluded, N-1) orbiting set — the fixed cross-plan blocker"
  - "Render rank is the read-time 0-based row index, never the stored ring_seq value (M3, option (a) — no renumber sweep on sun-ownership change)"
  - "rewriteRingSeq writes only ring_seq + modified_at; contacts.last_contact is never assigned (single-writer invariant intact, grep-pin passes)"

patterns-established:
  - "Occupant-exclusion param threads identically through count-guard + per-row scoped UPDATE; omitted (no bind) when null"
  - "Status-parity guard: export the composed SELECT constant and assert it .toContain(STATUS_SQL) / .toContain(PROGRESS_SQL)"

requirements-completed: [ORR-01, ORR-06]

coverage:
  - id: D1
    description: "listOrbitingContacts scans the orbiting set (never-contacted + archived excluded, sun occupant excluded), dense read-time rank, status single-sourced from status.ts, snooze retained (L11)"
    requirement: "ORR-01"
    verification:
      - kind: unit
        ref: "src/db/orrery-read.test.ts#listOrbitingContacts — population + exclusions / dense ordering / field set + status parity"
        status: pass
    human_judgment: false
  - id: D2
    description: "rewriteRingSeq — first ring_seq writer, favourites 3-guard clone with excludeContactId occupant exclusion; contact-sun seam + M3 regression; never writes last_contact"
    requirement: "ORR-06"
    verification:
      - kind: unit
        ref: "src/db/ring-seq-dao.test.ts#rewriteRingSeq — self-sun happy path / three guards / contact-sun seam (incl. M3 regression)"
        status: pass
      - kind: other
        ref: "grep -nE 'last_contact[[:space:]]*=' src/db/ring-seq-dao.ts → zero matches"
        status: pass
    human_judgment: false
  - id: D3
    description: "listSunCandidates — favourites-first, non-archived candidate list for the Settings sun-picker; never-contacted included; no synthetic Me row"
    requirement: "ORR-06"
    verification:
      - kind: unit
        ref: "src/db/sun-picker-read.test.ts#listSunCandidates"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-18
status: complete
---

# Phase 13 Plan 03: Orrery Data Layer Summary

**The orrery's SQL surfaces: `listOrbitingContacts` (status single-sourced from status.ts, dense read-time rank, snooze retained, sun occupant excluded), `rewriteRingSeq` (the first `contacts.ring_seq` writer — a favourites 3-guard reorder clone whose scope extends by an `excludeContactId` occupant exclusion so the guard matches the sun-excluded rendered set), and `listSunCandidates` (favourites-first Settings picker list) — all node:sqlite tested.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-18T00:35:25Z
- **Completed:** 2026-08-18T00:39:57Z
- **Tasks:** 3
- **Files created:** 6

## Accomplishments
- `listOrbitingContacts` composes `PROGRESS_SQL`/`STATUS_SQL` from status.ts (never re-derives thresholds — a parity test asserts the exported `ORBITING_SELECT` embeds both fragments), scans `archived_at IS NULL AND last_contact IS NOT NULL`, orders densely by `COALESCE(ring_seq, 1e9), created_at, id` (the 0-based row index is the render rank, not the stored value — M3), and — the deliberate L11 divergence — does NOT filter snooze, so a snoozed-but-contacted contact stays in the sky.
- `rewriteRingSeq` clones `rewriteFavouriteRanks` verbatim (3 guards, N raw `?`-bound UPDATEs in ONE `inWriteTransaction`, `changes===1` per row) with two swaps: the column `favourite_rank → ring_seq` and the scope `favourite_rank IS NOT NULL → last_contact IS NOT NULL` plus the optional `AND id <> ?` occupant exclusion appended to BOTH Guard 2's COUNT and every Guard 3 UPDATE. This closes the fixed cross-plan blocker: the guard's effective set now equals the sun-excluded (N-1) rendered set, so a contact-sun drag no longer fails the count guard.
- `listSunCandidates` returns non-archived contacts favourites-first (`(favourite_rank IS NULL)`, then `favourite_rank ASC`, then `name COLLATE NOCASE, id`), keeping never-contacted contacts eligible (anyone can be the sun) and synthesizing no "Me" row.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: orrery-read — orbiting-contact scan** - `2a7ded2` (test) → `fb77e6b` (feat)
2. **Task 2: ring-seq-dao — rewriteRingSeq** - `dc7aeb9` (test) → `823dae9` (feat)
3. **Task 3: sun-picker-read — favourites-first candidate list** - `0328673` (test) → `aa54c39` (feat)

## Files Created/Modified
- `src/db/orrery-read.ts` - `listOrbitingContacts` + the exported `ORBITING_SELECT` parity constant + `OrbitingContact` type
- `src/db/orrery-read.test.ts` - 9 node:sqlite cases (population/exclusions, dense ordering, field set, status parity, L11 snooze divergence)
- `src/db/ring-seq-dao.ts` - `rewriteRingSeq` (first ring_seq writer, favourites 3-guard clone + occupant exclusion)
- `src/db/ring-seq-dao.test.ts` - 13 node:sqlite cases (happy path, 3 guards, empty no-op, contact-sun seam, contract-mismatch, M3 regression)
- `src/db/sun-picker-read.ts` - `listSunCandidates` + `SunCandidate` type
- `src/db/sun-picker-read.test.ts` - 5 node:sqlite cases (archived exclusion, favourites-first order, never-contacted inclusion, field set, no Me row)

## Decisions Made
None new beyond the plan — all decisions (L11 snooze divergence, M3 dense read-time rank, the excludeContactId occupant-exclusion scope, the single-writer last_contact invariant) were pre-specified by the plan and its cross-AI convergence. Implemented as written.

One naming choice within the delegated bucket: the count-guard error message reads `!= effective orbiting count N` (favourites' analog says "current live-favourite count") to name the sun-excluded effective set the guard now measures; the tests assert this string.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The `ring_seq` column already existed from migration 001 (`INTEGER`), so no migration shipped here — matching the plan's "first WRITER of contacts.ring_seq" framing (the column predates the writer).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 13-04 / 13-05 / 13-07 (render + drag-release) can consume `listOrbitingContacts` — note C2-1: `photo` is the raw relative path (or null); the consumer MUST null-guard before `resolvePhotoUri` (`photo ? resolvePhotoUri(photo) : null`).
- 13-07 ring-drag-release feeds `computeRingReorder` (13-02) output into `rewriteRingSeq`: pass the sun-excluded (N-1) list with `excludeContactId` set to the sun contact, or the full list with `null` on self-sun. Passing the wrong-length list fails Guard 2 by design.
- 13-06 Settings sun-picker consumes `listSunCandidates`; it prepends the "Me"/self option itself.
- C2-2 (13-04/05): a never-contacted contact chosen as the sun has status null, so `resolveSunOccupant` must accept `status: ProfileStatus | null` — this read keeps never-contacted candidates eligible on purpose.

## Self-Check: PASSED

All 6 created files exist on disk; all 6 task commits (3 RED + 3 GREEN) are in git history. Full suite `npx vitest run src/db/orrery-read.test.ts src/db/ring-seq-dao.test.ts src/db/sun-picker-read.test.ts` → 27 passed; `npx tsc --noEmit` clean; `npm run check:colors` clean; grep-pin `last_contact[[:space:]]*=` in ring-seq-dao.ts → zero matches.

---
*Phase: 13-orrery*
*Completed: 2026-08-18*
