---
phase: 31-profile-experience
plan: 04
subsystem: database
tags: [sqlite, read-snapshot, profile, knowledge, interaction-history]
requires:
  - phase: 31-02
    provides: Profile presentation persistence and read inputs
  - phase: 31-03
    provides: Truthful Profile metric models
provides:
  - Coherent local ProfileSnapshot aggregate under one inReadSnapshot transaction
  - Typed Profile knowledge projection with hidden precedence, pinned references, custom-field grouping, and narrow Off Limits reads
  - Bounded latest-three interim interaction-history projection
affects: [31-05, 31-06, 31-10, 32-history-insights]
actuals:
  tokens: 14985
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns:
    - ReadOnlyExecutor child composition inside one SQLite read snapshot
    - Semantic-owner knowledge collections with explicit optional-section error classification
key-files:
  created:
    - src/db/profile-read.ts
    - src/db/profile-knowledge-read.ts
    - src/db/profile-history-read.ts
  modified:
    - src/db/impact-read.ts
    - src/db/contact-methods-read.ts
    - src/db/memories-read.ts
    - src/db/relationships-read.ts
    - src/db/value-history-dao.ts
key-decisions:
  - "Pinned Profile items remain references to their owning Memory or relationship row and are removed from ordinary visible child lists to prevent duplicate rendering."
  - "Only ProfileOptionalSectionError may become a section-local error; schema, corruption, missing-contact-after-read, and transaction failures remain fatal."
  - "The interim History projection selects no interaction note prose and is hard-limited to three rows behind the stable interaction-history identity."
patterns-established:
  - "Profile aggregate: pass the actual inReadSnapshot callback executor to every child reader without casts or nested snapshots."
  - "Sensitive knowledge: keep current state, relationships, Memories, imported notes, normalized custom fields, and Off Limits as distinct source-owned models."
requirements-completed: [PROF-01, PROF-08, PROF-10, PROF-11, PROF-13, PROF-14, PROF-16, PROF-17, PROF-18]
coverage:
  - id: D1
    description: One coherent local Profile snapshot supplies identity, presentation, metrics, methods, knowledge, and history.
    requirement: PROF-01
    verification:
      - kind: integration
        ref: src/db/profile-read.test.ts#coherent local Profile snapshot
        status: pass
    human_judgment: false
  - id: D2
    description: Semantic knowledge remains source-typed with hidden-before-pinned behavior, grouped raw custom fields, and isolated Off Limits.
    requirement: PROF-14
    verification:
      - kind: integration
        ref: src/db/profile-knowledge-read.test.ts#Profile knowledge projection
        status: pass
    human_judgment: false
  - id: D3
    description: Interim Interaction History returns a deterministic latest-three projection without full note text.
    requirement: PROF-18
    verification:
      - kind: integration
        ref: src/db/profile-history-read.test.ts#bounded interim Profile history
        status: pass
    human_judgment: false
duration: 19min
completed: 2026-09-09
status: complete
---

# Phase 31 Plan 04: Coherent Profile Snapshot Summary

**One mutex-held local SQLite snapshot now returns renderer-neutral Profile identity, presentation, metrics, complete methods, typed knowledge, and bounded history without widening AI or network access.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-09T17:25:00Z
- **Completed:** 2026-09-09T17:44:00Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Added `ProfileSnapshot` and `readProfileSnapshot`, composing every child read through the actual `ReadOnlyExecutor` supplied by one `inReadSnapshot` callback.
- Added source-owned Profile knowledge projections with visible caps/counts, hidden recovery state, deduplicated featured references, raw typed custom-field values and history keys, and a dedicated contact-bound Off Limits query.
- Added the stable `interaction-history` interim seam with a hard latest-three bound, deterministic ties, useful empty/latest summaries, and no full interaction-note projection.
- Proved that 3,000 interactions remain inside a generous deterministic node-local two-second budget while preserving full-history metric semantics.

## Task Commits

1. **Task 1 RED: Semantic knowledge and read-only boundary tests** — `e32119b`
2. **Task 1 GREEN: Semantic knowledge and complete method projections** — `7db7341`
3. **Task 2 RED: Bounded interim history tests** — `e1c6398`
4. **Task 2 GREEN: Bounded interim Interaction History projection** — `cafe0de`
5. **Task 3 RED: Coherent aggregate and rollback tests** — `c5edabb`
6. **Task 3 GREEN: Coherent local Profile snapshot** — `4e6e038`

## Files Created/Modified

- `src/db/profile-read.ts` / `.test.ts` — one-snapshot aggregate, explicit optional error classification, fatal rollback, and long-history budget.
- `src/db/profile-knowledge-read.ts` / `.test.ts` — distinct current-state, relationship, Memory, imported-note, grouped custom-field, featured, and Off Limits models.
- `src/db/profile-history-read.ts` / `.test.ts` — deterministic latest-three interaction preview and stable renderer/route identity.
- `src/db/impact-read.ts` / `.test.ts` — snapshot-compatible impact input read.
- `src/db/contact-methods-read.ts` / `.test.ts` — snapshot-compatible complete method groups and validated actionable-primary selection.
- `src/db/memories-read.ts` / `.test.ts` — snapshot-compatible owner-facing Memory reads while AI/deleted reads retain their prior contracts.
- `src/db/relationships-read.ts` / `.test.ts` — snapshot-compatible structured relationship reads.
- `src/db/value-history-dao.ts` / `.test.ts` — read-only history lookup widened while both transaction-composed writers retain `SqlExecutor`.

## Decisions Made

- Featured rows are durable references tagged by semantic owner, never copied entities; hidden state wins before featured selection and featured rows do not repeat in ordinary visible child collections.
- Named custom-field groups follow first configured display occurrence; null groups remain null rather than gaining an invented persisted group.
- Ordinary Off Limits remains a narrow owner-facing `fuel.kind='off_limits'` read with no inferred permission field. `RANKED_FUEL_EXCLUSIONS` was left byte-identical.
- Only deliberately constructed `ProfileOptionalSectionError` values are contained at a section boundary. All unclassified database failures abort and roll back the aggregate.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's `npm run check` command is unavailable because `package.json` has no `check` script, matching the recorded Phase 31 baseline. Its direct equivalents passed: `npx tsc --noEmit`, targeted Biome, `npm run check:colors`, and `git diff --check`.

## Known Stubs

None.

## Threat Flags

None. The planned SQLite-row-to-Profile boundary remains local, every runtime query value is bound, Off Limits is isolated from ranked/search/AI projections, and no network/file/auth surface was added.

## User Setup Required

None.

## Next Phase Readiness

- Plan 31-05 can bind the fixed Hero and module registry to one coherent snapshot and use complete methods plus actionable primaries without a second read.
- Plan 31-06 can adapt each semantic knowledge owner without reconstructing storage details or weakening hidden/Off Limits boundaries.
- Phase 32 can replace the `interaction-history` renderer while keeping its stable module identity and persistence seam.

## Self-Check: PASSED

- All 16 created/modified plan files exist.
- Commits `e32119b`, `7db7341`, `e1c6398`, `cafe0de`, `c5edabb`, and `4e6e038` exist in local history.
- Targeted verification passed 8/8 files and 41/41 tests.
- Full regression passed 302/302 files and 2774/2774 tests.
- TypeScript, targeted Biome, color-token validation, and whitespace checks passed.

---
*Phase: 31-profile-experience*
*Completed: 2026-09-09*
