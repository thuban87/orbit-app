---
phase: 08-dashboard-never-contacted-screen
plan: 02
subsystem: logic
tags: [birthday, date-math, pure-function, vitest, leap-year]

# Dependency graph
requires:
  - phase: 08-01
    provides: birthday storage format convention (MM-DD vs YYYY-MM-DD via edit-contact-logic)
provides:
  - "src/logic/birthday-logic.ts → daysUntilBirthday(stored, today): the SINGLE pure birthday parser"
  - "Both ported bugs fixed and node-proven: day-of drop (local-midnight compare) and Feb-29 → Mar-1 silent overflow (explicit Feb-28 observation)"
  - "Strict regex + explicit calendar validation before Date construction (no silent normalization)"
  - "FEB_29_OBSERVED_DAY exported constant (flagged owner default = Feb-28)"
affects: [08-06 birthday banner (DASH-05), 11 birthday notification (NOTIF-04)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure react-native-free logic module in src/logic/ so Vitest runs it in node — mirrors the *-logic.ts convention"
    - "Strict-regex-then-explicit-calendar-validation BEFORE any Date construction, to defeat JS Date silent normalization"
    - "Local-midnight vs local-midnight day difference (round(ms / 86_400_000)) — never compare a time-carrying now"

key-files:
  created:
    - src/logic/birthday-logic.ts
    - src/logic/birthday-logic.test.ts
  modified: []

key-decisions:
  - "Feb-29 non-leap-year observation defaults to Feb-28 (celebrate within the birth month), recorded as a flagged LOW-severity owner decision in a top-of-file comment + exported FEB_29_OBSERVED_DAY constant"
  - "MM-DD (year unknown) is February-leap-PERMISSIVE (allows day 29); YYYY-MM-DD validates the day against that specific year's calendar"
  - "Signature accepts string | null with an early null/empty/whitespace guard, matching the nullable contacts.birthday column and edit-contact-logic.ts:98"

patterns-established:
  - "Pattern: single cross-phase date parser proven by node tests, reused by both the banner (Plan 06) and Phase 11 notification"

requirements-completed: [DASH-05]

coverage:
  - id: D1
    description: "daysUntilBirthday returns 0 when today IS the birthday at any time of day (day-of drop fixed via local-midnight compare)"
    requirement: "DASH-05"
    verification:
      - kind: unit
        ref: "src/logic/birthday-logic.test.ts#Bug 1: day-of drop is fixed (local-midnight vs local-midnight)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Feb-29 birthday in a non-leap year observed explicitly on Feb-28, never silently overflowed to Mar-1; leap years use Feb-29 exactly; rollover recomputes for the next year's leap status"
    requirement: "DASH-05"
    verification:
      - kind: unit
        ref: "src/logic/birthday-logic.test.ts#Bug 2: Feb-29 overflow is fixed (explicit observation)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both stored formats parse (MM-DD year-unknown and YYYY-MM-DD year-known); past birthdays roll to next year; null/empty/malformed/calendar-invalid input returns null without throwing (MEDIUM-1 strict validation)"
    requirement: "DASH-05"
    verification:
      - kind: unit
        ref: "src/logic/birthday-logic.test.ts#strict calendar validation, null/empty/malformed contract, MM-DD vs YYYY-MM-DD parity, future/past/rollover"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-08-15
status: complete
---

# Phase 8 Plan 02: The single birthday parser Summary

**`daysUntilBirthday(stored, today)` — a pure, node-tested parser that fixes the legacy day-of drop (local-midnight compare) and the silent Feb-29 → Mar-1 overflow (explicit Feb-28 observation), accepting both MM-DD and YYYY-MM-DD storage formats.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-08-15T23:22:00Z
- **Completed:** 2026-08-15T23:25:00Z
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 2 created

## Accomplishments
- Created the single cross-phase birthday parser `src/logic/birthday-logic.ts`, reused by the Plan 06 banner and Phase 11 notification (NOTIF-04).
- Fixed Bug 1 (day-of drop): both comparison anchors are built at LOCAL MIDNIGHT and differenced, so today-is-birthday returns exactly 0 at 00:01, 12:00, and 23:59 local.
- Fixed Bug 2 (Feb-29 overflow): an explicit observation branch returns Feb-28 in non-leap years (recorded as a flagged owner default via `FEB_29_OBSERVED_DAY`), and rollover recomputes the observed day for the next year's leap status.
- Enforced MEDIUM-1 strict validation: strict regex plus explicit month/day range checks run BEFORE any `new Date(...)`, so `02-30`, `13-01`, and non-leap `2021-02-29` return null instead of silently normalizing; MM-DD `02-29` stays leap-permissive and leap `2020-02-29` stays valid.
- 28 node tests pass; `tsc --noEmit` clean; Biome clean; parser is pure (0 react-native/expo/toISOString references).

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): failing tests for daysUntilBirthday** - `71bc1d5` (test)
2. **Task 1 (GREEN): implement daysUntilBirthday parser** - `ddcfd34` (feat)

No REFACTOR commit — the GREEN implementation was already clean.

**Plan metadata:** _(final docs commit)_

_Note: TDD tasks may have multiple commits (test → feat → refactor)._

## Files Created/Modified
- `src/logic/birthday-logic.ts` - The pure `daysUntilBirthday` parser + `FEB_29_OBSERVED_DAY` constant, with strict parsing/validation, local-midnight compare, and explicit Feb-29 observation.
- `src/logic/birthday-logic.test.ts` - 28 Vitest node tests covering the null/malformed contract, strict calendar validation, both bug fixes at multiple times of day, format parity, and rollover across leap/non-leap years.

## Decisions Made
- Feb-29 non-leap observation defaults to Feb-28 and is surfaced as an exported `FEB_29_OBSERVED_DAY` constant with a top-of-file comment flagging it as a LOW-severity owner taste call (Feb-28 vs Mar-1). The bug being fixed is the SILENT overflow; the explicit choice is what matters. Switching to Mar-1 would require changing both the constant and the `observedDayFor` branch — noted in-file.
- MM-DD is February-leap-permissive (year unknown, so a genuine Feb-29 birthday must survive); YYYY-MM-DD validates against its real year.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Biome initially flagged line-length formatting and the acceptance grep counted a "react-native" mention inside the doc comment. Reworded the comment to "no React Native / Expo imports" (grep now 0) and applied `biome check --write` formatting. Re-ran tests + tsc green afterward. No behavior change.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `daysUntilBirthday` is ready for the Plan 06 birthday banner (DASH-05) and Phase 11's birthday notification (NOTIF-04) to import directly.
- No blockers.

## Self-Check: PASSED

---
*Phase: 08-dashboard-never-contacted-screen*
*Completed: 2026-08-15*
