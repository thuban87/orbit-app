# ADR-234: Per-Person Mute Becomes an Indefinite Snooze, Stored as a Far-Future Date and Converted by Migration 034 and on Restore

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-96, D-98, D-134, D-37 (38.12-CONTEXT.md; ledger Q-03, Q-03b, Q-03c, Q-P3); CONTEXT Claude's Discretion (storage shape)
**Reversibility:** one-way
**Migration:** 034
**Supersedes:** ADR-227 (partial — the shared sheet's choice set dies as it stood: it gains "Until I turn it off"; the one sheet for all four entries, its pending, error and Undo behaviour survive); ADR-054 (note — "deliberately ignoring the decay-push mute" is moot: the mute is now an indefinite snooze, which Overlooked already honours; the rest survives); ADR-039 (note — the "muted" suppressor is now covered by "snoozed at fire time"; the rest survives)
**Superseded by:** None

## Context

Per-person mute (`reminders_off`) lived only as an Edit Contact switch, nothing on the Profile showed it, and it suppressed only decay pushes. A dated snooze, read by about twenty readers, also marks the Contacts card, drops the person from Digest and Up next, and gives the Orrery its snoozed look. The owner asked: "isn't mute basically the same as snooze? Do we need both?"

## Decision

Per-person mute becomes a Snooze choice (D-96). The shared snooze sheet offers **Until I turn it off**, Edit Contact's "Mute reminders" switch is gone, and the Snooze tile reads "Snoozed · until you turn it off". Unsnooze ends it, and birthdays are unaffected.

An indefinite snooze behaves exactly like a dated one on every surface: notifications, the Contacts card and filters, Digest, Up next, the Orrery and pickers. Only the end date is missing (D-98). It is stored as `snooze_until = '9999-12-31'` (`INDEFINITE_SNOOZE_UNTIL`), a far-future date every existing snooze reader already honours, so no reader changed. Only display sites special-case it, through one helper, `snoozeUntilLabel`. The custom snooze date is capped at today + 10 years so a pick never equals the sentinel.

Migration 034 converts every `reminders_off = 1` row into the indefinite snooze and clears `reminders_off`, overwriting any dated snooze on that row and leaving `modified_at` unchanged (D-134; legacy repair approved under D-30). The migration writes the literal, and a test pins it equal to the runtime constant. A restore maps `remindersOff = 1` in any backup format to the indefinite snooze, in both restore modes. `reminders_off` stays as a column and a form pass-through.

The Overview Snooze tile reads the effective, unexpired snooze, like ⋯ and the sheet (D-37).

## Alternatives Considered

- **Show mute on the tile with an unmute, or also in the sheet or ⋯** — the first framing (Q-03); the owner asked whether both were needed instead.
- **Remove per-person mute entirely** — rejected; it would supersede dossier 18 Cluster L's independent per-person pause (Q-03b B).
- **Keep both, and show mute on the tile** — rejected for one concept (Q-03b C).
- **"Until I turn it off" pauses reminders only, as mute did** — rejected for "like any snooze" (Q-03c B).
- **Add `reminders_off` to every snooze reader** — the other storage shape in Claude's Discretion; not taken, since the sentinel needs no reader change.
- **Leave existing muted people unconverted** — rejected; they would stay invisibly muted with no switch (Q-P3 B).

## Consequences

### Positive

- One pause concept for the user, visible on the Profile, with one way to end it.
- No snooze reader had to change.

### Negative

- An indefinite snooze now also hides the person from Digest, Up next and the Contacts filters, which mute did not.

### Risks

- Migration 034 is one-way: a muted row's earlier dated snooze is overwritten.
- A future display site that prints `snooze_until` raw would show "9999-12-31"; display goes through `snoozeUntilLabel`.

## Implementation

**Key files:**
- `src/db/migrations/034-snooze-review-memory-resume.ts` — part c, the mute conversion.
- `src/db/migrations/034-snooze-review-memory-resume.test.ts` — the conversion and the literal-equals-constant pin.
- `src/db/database.ts` — `TARGET_VERSION` 34.
- `src/db/snooze-dao.ts` — `INDEFINITE_SNOOZE_UNTIL`, `isIndefiniteSnooze`.
- `src/db/indefinite-snooze-readers.test.ts` — every snooze reader treats the sentinel like a date.
- `src/components/SnoozeSheet.tsx` — the "Until I turn it off" choice and the 10-year cap.
- `src/profile/relationship-sheet-model.ts` — `snoozeUntilLabel`.
- `src/components/profile/RelationshipOverview.tsx` — the effective-snooze tile.
- `src/components/profile/ProfileModuleHost.tsx` — passes its local date to the tile.
- `src/screens/EditContactScreen.tsx` — the mute switch removed.
- `src/backup/restore-apply.ts` — `remindersOff = 1` restores as the indefinite snooze.

**Depends on:** ADR-227 (One Snooze Sheet for the Profile Tile, Profile ⋯, Contacts Card and Bulk Bar); ADR-009 (Crash-Safe Forward-Only SQLite Migrations)
**Required by:** None
