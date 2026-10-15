# ADR-210: Dated Last Talked About and Current Location, Where the Newest Date Is Most Recent

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-39, D-41, D-45, D-46, D-48, D-50, D-51, D-52, D-53, D-101 (38.10-CONTEXT.md; ledger Q-04, Q-32, Q-34, Q-39, Q-40, Q-41, Q-43, Q-44; plan-check C1); carried D-16
**Reversibility:** one-way
**Migration:** 033
**Supersedes:** ADR-088 (partial — "SQLite enforces at most one current value" through a stored, user-promotable flag dies; history retention and the app-owned registry survive); ADR-205 (partial — "no date range limit" dies for the Last Talked About and Current Location pickers only; memory date pickers stay unlimited)
**Superseded by:** None

## Context

`current_state_entries` stored a value with an `is_current` flag and only `created_at`; a "Make current" action re-promoted old entries, and the full history was behind the section pencil. The owner wanted Last Talked About to gain a real "when" date so notes from interactions and direct entries could sit together in order (Q-04).

## Decision

We will rebuild `current_state_entries` in migration 033 without `is_current`, adding `entry_date NOT NULL`, `entry_time`, `url`, an interaction link and share / Group-Note-copy markers. Interaction-sourced and direct entries share this one store and show together; a direct entry never counts as contact (D-39). A linked entry takes its interaction's date and time; a direct add gets a date picker defaulting to today and stores a date only; a share to Last Talked About is dated today and keeps its link (D-41, D-46, D-48). Display is date-only everywhere; tapping a linked entry opens the interaction, which shows the time. **Most Recent is the entry with the latest date**; order is by date, then time where present, else creation time, through one order builder `currentStateOrderSql` (D-45, D-51). "Make current" is removed. The Profile keeps Most Recent plus up to five Previous with a visible "See all (N)"; the reworked history page shows dates, opens linked entries, deletes with Undo and has no Make current (D-50, D-52). Current Location gets the same treatment (D-53). Both date pickers stop at today, since a future date would sit on top (D-101).

## Alternatives Considered

- **A share to Last Talked About becomes current / history-only / not a destination** — superseded by the owner's direction: dated today, editable later (Q-04).
- **Keep "Make current"** — rejected: with dates, the newest date decides (Q-40, "Remove it").
- **Show times in the section** — rejected: date only, time on the interaction (Q-41, owner's design).
- **Keep the pencil to the history page** — rejected: a visible See all replaces it (Q-43).
- **Leave the date range unlimited (38.9 D-67)** — rejected for these two pickers (plan-check C1, "Cap at today").

## Consequences

### Positive

- Backdated entries slot into Previous by date; interaction notes and direct entries read as one dated list.

### Negative

- Dropping `is_current` is one-way; every reader must use `currentStateOrderSql`, never a flag.

### Risks

- An entry saved with today's date on a device with a wrong clock sorts by that date; there is no server time.

## Implementation

**Key files:**
- `src/db/migrations/033-knowledge-homes.ts` — the `current_state_entries` rebuild.
- `src/db/current-state-history-read.ts` — `currentStateOrderSql`, dated projections.
- `src/db/current-state-history-dao.ts` — plain dated inserts, edits with date and URL, delete with Undo.
- `src/db/profile-knowledge-read.ts` — Most Recent plus five Previous and the total.
- `src/screens/MemoryHistoryScreen.tsx` — the reworked history page.
- `src/screens/memory-history-logic.ts` — rows, date rules, `maxPickableDate`.
- `src/components/ui/EntryDateField.tsx` — the date field with a maximum date.

**Depends on:** ADR-088 (Additive Contact-Knowledge Schema and Application-Owned Memory Registry); ADR-205 (One Date-Only Display Formatter)
**Required by:** None
