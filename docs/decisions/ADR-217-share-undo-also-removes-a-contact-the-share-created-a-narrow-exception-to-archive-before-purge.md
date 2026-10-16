# ADR-217: Share Undo Also Removes a Contact the Share Created — a Narrow Exception to Archive-Before-Purge

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-100, D-106, D-109, D-110 (38.10-CONTEXT.md; plan-phase P5; revision-1 R1; plan-check cycle 2 Q2, Q2b)
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-018 (partial — "a direct DAO caller cannot bypass the lifecycle guard" gains one exception, share Undo of a share-created contact; archive-first purge from Settings → Archived contacts survives everywhere else)
**Superseded by:** ADR-231 (partial)

## Context

A contact created inline on the share screen exists only because of that share. Undoing the share but leaving the contact would leave a stray, tracked-monthly contact; but ADR-018 requires archive before any permanent delete.

## Decision

We will let Undo on a share that also created its contact remove both the share and the new contact (D-100). This is the only path that may permanently delete a contact that is not archived, and only when that contact owns nothing except the share it was created with (D-106). Rows the app creates automatically with a contact (empty values for app-wide custom fields, default settings) do not count while unchanged; anything the user added or edited — a note, contact method, filled-in field, interaction, key person, photo or event — blocks it (D-109). The guard is data: every contact-owned `(table, column)` has one disposition, derived from `pragma_foreign_key_list` and enforced by a test. When the guard blocks, Undo removes only the share, the contact stays active, and a snackbar says it was kept because it has other details (D-110). Only `capture-dao.ts` passes `requireArchived: false` to `purgeContactCore`, which a contract test pins.

## Alternatives Considered

- **Undo removes only the share** — not chosen (P5).
- **Archive the contact instead of deleting it** — my option text added this; the owner chose "remove share, keep contact" as the fallback (Q2b).
- **Count auto-created rows as owned** — rejected (Q2).

## Consequences

### Positive

- A mistaken inline create is fully undone in one tap.

### Negative

- The archive gate now has a documented bypass that every future contact-owned table must be classified for.

### Risks

- A new contact-owned table added without a disposition would let Undo delete user data; the schema-derived test fails until it is classified.

## Implementation

**Key files:**
- `src/db/capture-dao.ts` — `undoCreateContactAndShare`, `SHARE_UNDO_OWNERSHIP`, `shareContactIsUntouchedCore`.
- `src/db/purge-dao.ts` — `purgeContactCore` with `requireArchived` and `bumpRevision`.
- `src/no-fuel-contract.test.ts` — the single `requireArchived: false` check.

**Depends on:** ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out); ADR-216 (A Share Saves at Once to Thought of Them)
**Required by:** None
