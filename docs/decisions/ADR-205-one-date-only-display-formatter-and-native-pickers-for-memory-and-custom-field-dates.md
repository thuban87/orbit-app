# ADR-205: One Date-Only Display Formatter, and Native Pickers for Memory and Custom-Field Dates

**Status:** Accepted
**Date:** 2026-10-11
**Phase:** 38.9-ux-standards
**Source decisions:** D-23, D-48, D-53, D-57, D-65, D-66, D-67, D-70 (38.9-CONTEXT.md; ledger Q-23, Batch 7 OQ-7, Batch 8, Batch 10, Batch 11)
**Reversibility:** costly (inferred: new memory and custom-field dates are written as `YYYY-MM-DD`; older free-text values are kept and flagged, not converted)
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Dates displayed several ways: raw ISO strings on Digest, the last-spoke segment, the snooze line, Recently Deleted and the week heatmap (C-06, D-21), and private month tables in several modules. `src/utils/dates.ts` held only the storage-key function `formatLocalDate()` and the minute-precision formatter. A Memory's "Meaningful date" was free text, and the custom-field Date widget was a text input.

## Decision

The system uses one date-only display formatter in `src/utils/dates.ts`, beside `formatLocalDate()`, with the only month and weekday tables (D-23). It reads "Oct 13" in the current year and "Jun 2, 2025" otherwise, adds the weekday where the day matters ("Tue, Oct 13"), and shows time only where it already did (D-48, DT-A). Display output is never a key: storage keys, query parameters and stored values still use `formatLocalDate()`, and `formatDisplayDateOrFallback` shows a value that does not parse as stored. A birthday with a known year always shows its year, even this year; a year-unknown birthday shows month-day (D-70, `formatStoredBirthdayForDisplay`). History's day headers and empty-day note gain the comma ("Fri, Oct 2", "Nothing logged on Tue, Oct 5"; D-53, D-57). These amend only the example wording of 38.8 D-21 and its day-header wording; ADR-194's `'Nothing logged on <day>'` contract is unchanged. A Memory's meaningful date and the custom-field Date widget become native date pickers: optional with Clear, stored as `YYYY-MM-DD` via `formatLocalDate()`, shown with the display formatter, no date range limit, and a memory date is always a full date (D-65, D-66, D-67). Wording is "Pick a date", "Clear" and "Not a date" under a stored value that fails the date parser. Custom-field invariants hold (ADR-001): only the widget changes, storage stays raw TEXT, the widget never emits on render, so existing values are never rewritten.

## Alternatives Considered

- **DT-0, today's mixed formats** — Rejected (Q-23).
- **DT-B, always show the year** — Not chosen; the owner picked DT-A (Q-23), then narrowed it for known-year birthdays only (D-70).
- **Keep the meaningful date and the custom Date field as text** — Rejected by the owner: "legit date fields with a picker that stores dates the same way" (Batch 10).
- **A "year unknown" memory date, or a limited date range** — Rejected (Batch 10, D-67).
- **History's empty-day note without the comma** — Rejected (OQ-7, D-53).

## Consequences

### Positive

- Every date-only label reads one way, and new memory and custom-field dates are machine-readable.

### Negative

- Older free-text meaningful dates and non-date custom values stay as written, marked "Not a date", until the user picks or clears.

### Risks

- A display string written to storage or used as a key would corrupt day lookups; `display-date-contract.test.ts` guards the display-only rule.

## Implementation

**Key files:**
- `src/utils/dates.ts` — `formatDisplayDate`, `formatDisplayDateOrFallback`, `formatMonthDay`, `formatStoredBirthdayForDisplay` and the shared tables.
- `src/utils/display-date-contract.test.ts` — display formatters never used for storage; the birthday display sites.
- `src/components/date-pick-logic.ts` — `storedFromPickerEvent`, `isPickableStoredDate`, `pickerSeedFromStored`.
- `src/components/MemoryEditor.tsx` — the meaningful-date picker row.
- `src/components/MemoryCard.tsx` — the formatted meaningful date.
- `src/components/field-widgets/DateFieldWidget.tsx` — the custom-field Date picker row.
- `src/profile/knowledge-presentation.ts` — `customValueDisplayText` and formatted custom Date values.
- `src/components/history/history-stream-logic.ts` — `dayLabel` and the empty-day note with the comma.
- `src/logic/digest-composition.ts` — the Digest birthday tag with weekday and a separate `dateKey`.
- `src/components/digest/DigestDayDetail.tsx` — Digest day detail dates.
- `src/screens/RecentlyDeletedScreen.tsx` — deleted-on dates.

**Depends on:** ADR-001 (Normalized Custom-Field Values); ADR-089 (Recoverable Memory Lifecycle and Contact-Operation Integrity); ADR-194 (Heatmap Jump-and-Highlight with No Count Card, and Honest Empty Targets); ADR-196 (Cycles Whole-Page Paging, No-Cadence Month Fallback, and Year-Bearing Off-Year Dates); ADR-204 (One Themed Option Sheet Replaces Every Native Picker; Native Date and Time Pickers Stay)
**Required by:** None
