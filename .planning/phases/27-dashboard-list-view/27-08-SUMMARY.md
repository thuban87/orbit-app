---
phase: 27-dashboard-list-view
plan: 08
subsystem: dashboard-list-recency
tags: [typescript, dates, react-native, sqlite, vitest]
requires:
  - phase: 27-dashboard-list-view
    provides: List row local-calendar recency and snooze presentation helpers.
provides:
  - Strict local wall-clock timestamp parsing that rejects numeric rollover values.
  - Fail-closed snooze evaluation and neutral List recency output for corrupt stored timestamps.
affects: [27-dashboard-list-view, 28-dashboard-card-view]
actuals:
  tokens: 1194
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - Validate timestamp component ranges and Date local-calendar round trips before exposing milliseconds.
    - Catch persisted-data parse failures at the List presentation boundary and return established neutral copy.
key-files:
  created: []
  modified: [src/utils/dates.ts, src/utils/dates.test.ts, src/components/list-row-content.ts, src/components/list-row-content.test.ts]
key-decisions:
  - "Local parser rejects components outside wall-clock ranges and dates Date would normalize through rollover."
  - "Malformed non-null List recency uses No interactions yet rather than allowing a parser exception to escape rendering."
requirements-completed: [LISTV-05]
coverage:
  - id: D1
    description: Numeric-invalid local timestamps fail before JavaScript Date normalization, and snooze treats them as inactive.
    requirement: LISTV-05
    verification:
      - kind: unit
        ref: "src/utils/dates.test.ts#rejects numeric-invalid local timestamp and accepts a real leap day"
        status: pass
    human_judgment: false
  - id: D2
    description: Corrupt non-null List recency values return neutral render-safe copy while valid local-calendar copy remains unchanged.
    requirement: LISTV-05
    verification:
      - kind: unit
        ref: "src/components/list-row-content.test.ts#renders corrupt non-null last-contact as neutral recency"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit; npm run check:colors"
        status: pass
    human_judgment: false
duration: 3min
completed: 2026-09-06
status: complete
---

# Phase 27 Plan 08: Strict timestamp presentation Summary

**Dashboard List timestamp handling now rejects JavaScript-normalized invalid dates, keeps corrupt snoozes inactive, and renders malformed interaction dates with neutral safe copy.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-06T04:31:00Z
- **Completed:** 2026-09-06T04:33:20Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Added numeric range and local-calendar round-trip validation to the shared local wall-clock parser, rejecting invalid months, times, and rollover dates.
- Proved malformed snooze values fail closed, including the verifier's `2026-09-05 99:00:00` case, while preserving valid leap-day and local-calendar behavior.
- Made List recency a presentation safety boundary that renders `No interactions yet` for corrupt non-null persisted values instead of throwing through `ListRow`.

## Task Commits

1. **Task 1 RED: Invalid local timestamp parsing regression** — `4a1ea56` (`test`)
2. **Task 1 GREEN: Reject normalized local timestamps** — `a86faa3` (`fix`)
3. **Task 2 RED: Corrupt List recency regression** — `460b9b6` (`test`)
4. **Task 2 GREEN: Render List recency fail-safe copy** — `37fabbc` (`fix`)

## Verification

- `npx vitest run src/utils/dates.test.ts src/components/list-row-content.test.ts` — **29 passed**.
- `npx tsc --noEmit` — **passed**.
- `npm run check:colors` — **passed**.

## TDD Gate Compliance

- Task 1 RED commit `4a1ea56` precedes GREEN commit `a86faa3`.
- Task 2 RED commit `460b9b6` precedes GREEN commit `37fabbc`.

## Decisions Made

- Retain Orbit's local date grammar and DST-safe calendar calculations; strict validation is performed before consumers receive milliseconds.
- Treat parser failures as neutral presentation data for List recency without rewriting SQLite data or relaxing shared parsing.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Next Phase Readiness

Both code-level Phase 27 gap closures are complete. The remaining verification report's device-only List layout, gesture/accessibility, and search/motion observations remain separate human-UAT work.

## Self-Check: PASSED

- Confirmed `src/utils/dates.ts`, `src/utils/dates.test.ts`, `src/components/list-row-content.ts`, and `src/components/list-row-content.test.ts` exist.
- Confirmed commits `4a1ea56`, `a86faa3`, `460b9b6`, and `37fabbc` are in git history.
