---
phase: 19-system-contact-import
plan: 05
subsystem: import duplicate detection
tags: [sqlite, contact-methods, canonicalization, duplicate-evidence, vitest]
requires:
  - phase: 18.1-contact-method-normalization
    provides: canonical contact method values and active external-contact links
provides:
  - Deterministic active Android external-link identity lookup
  - Conservative duplicate evidence classifier with durable JSON-safe candidates
affects: [19-06-import-driver, 19-07-duplicate-review, 19-11-consolidation]
actuals:
  tokens: 4659
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [deterministic-first duplicate classification, canonical method matching]
key-files:
  created:
    - src/services/import/duplicate-evidence.ts
    - src/services/import/duplicate-evidence.test.ts
  modified: []
key-decisions:
  - "Canonical phone/email evidence is normalized at the import boundary before querying stored canonical values."
  - "Correlated phone/email evidence from one imported record contributes only its strongest signal."
patterns-established:
  - "Duplicate classifiers return JSON-serializable candidates with evidence signals and advisory recommendation strings."
requirements-completed: [IMP-03]
coverage:
  - id: D1
    description: "Active Android external links bypass advisory scoring and return their deterministic contact ID."
    requirement: IMP-03
    verification:
      - kind: integration
        ref: src/services/import/duplicate-evidence.test.ts#short-circuits-an-active-external-link-before-any-advisory-candidate-query
        status: pass
    human_judgment: false
  - id: D2
    description: "Canonicalized contact methods and conservative duplicate evidence resolve to the five advisory outcomes without exposing scores."
    requirement: IMP-03
    verification:
      - kind: integration
        ref: npx vitest run src/services/import/duplicate-evidence.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit --pretty false
        status: pass
    human_judgment: false
duration: 5min
completed: 2026-08-29
status: complete
---

# Phase 19 Plan 05: Duplicate Evidence Summary

**Deterministic Android-link detection and a conservative canonical-method duplicate classifier with durable advisory candidates.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-29T13:27:30Z
- **Completed:** 2026-08-29T13:32:11Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added a bound active-link read that treats an existing Android source link as identity before any heuristic query.
- Canonicalized incoming phone and email drafts before querying `contact_methods.canonical_value`, including national phone formats with the session region.
- Added tunable, score-private advisory classification with name-only, birthday-only, correlated-evidence, and multi-candidate safeguards.

## Task Commits

1. **Task 1: findActiveExternalLink + deterministic bypass + canonicalized candidate gathering** - `8175c4f` (feat)
2. **Task 2: Weighted advisory ladder + negative invariants** - `d328fb1` (feat)

## Files Created/Modified

- `src/services/import/duplicate-evidence.ts` - Active-link identity read, canonical evidence gathering, and five-outcome advisory ladder.
- `src/services/import/duplicate-evidence.test.ts` - node:sqlite tests for deterministic lookup, canonical matching, and conservative scoring invariants.

## Decisions Made

- Exact phone/email matches are strong but correlated methods from the same imported record are capped at the stronger signal.
- Birthday-only evidence is retained as a candidate hint but resolves to Import as New; name-only remains Review-only.
- Two or more credible candidates always become Needs review and are stably ordered by evidence then contact ID.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`npx biome check` was run and remains red on 143 existing repository-wide diagnostics (for example `plugins/withWidgetBootReceiver.js`, `App.tsx`, and generated/model-registry files), none in this plan's two files. The scoped Biome check for this plan passes. Vitest also emits the repository's existing Vite config-loader and Node `node:sqlite` experimental warnings; the suite passes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 06 can call `scoreImportCandidate` with the import session phone region, persist its complete ordered `candidates` list, and use deterministic IDs without rerunning advisory scoring.

## Self-Check: PASSED

- `src/services/import/duplicate-evidence.ts` and `src/services/import/duplicate-evidence.test.ts` exist.
- Task commits `8175c4f` and `d328fb1` exist locally.

---

*Phase: 19-system-contact-import*
*Completed: 2026-08-29*
