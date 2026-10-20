# ADR-227: One Snooze Sheet for the Profile Tile, Profile ⋯, Contacts Card and Bulk Bar

**Status:** Accepted
**Date:** 2026-10-16
**Phase:** 38.11-everyday-screens-ux
**Source decisions:** D-45, D-37, D-64, D-81, D-82 (38.11-CONTEXT.md; ledger Q-02, Q-25, plan-time ruling D-81, convergence cycle 1 O-1); carried D-15; owner extraction ruling 2026-10-16 (bulk Unsnooze subset recorded under D-82)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-103 (partial — "every selected contact is eligible for every bulk action" dies for bulk Unsnooze only, which now acts on the selected people the database says are snoozed; its rejected per-action eligibility filtering is adopted for that one action; bulk Snooze and every other bulk action still apply to all selected IDs through composed cores in one transaction)
**Superseded by:** ADR-234 (partial)

## Context

Snooze had four different UIs: the Profile Overview card sheet, a presets-only ⋯ sheet with no Close and a silent instant Unsnooze, a native Alert on the Contacts card (the last one left after 38.9), and a presets-only bulk sheet beside a separate bulk Unsnooze button. The custom date opened on today, which the validator rejects.

## Decision

We will use one `SnoozeSheet`, modelled on the Profile card sheet, for all four entries (D-45). It has presets, Choose date (a date row that reopens the native picker, then Set snooze or Cancel), Unsnooze when allowed, and Close. It handles pending state, error and Retry, and ignores Close, Back and the scrim while a save runs. The custom date defaults to and starts at tomorrow (D-37, D-15). Single-contact changes confirm by name with Undo.

The Profile ⋯ has one "Snooze…" entry that opens the sheet, with Unsnooze inside it and no instant Unsnooze in ⋯ (D-64). The Contacts card reads "Snooze…" in both states and opens the sheet, with no one-tap unsnooze (D-81).

The bulk bar's Snooze always opens the sheet, which is the one place for bulk snoozing and unsnoozing (D-82). The separate bulk Unsnooze button is gone. The sheet shows Unsnooze when `readCurrentlySnoozedIds` finds at least one snoozed person among the selected IDs at open. Unsnooze clears and counts only that subset, so no unsnooze event is written for a selected person who was never snoozed. Bulk Snooze still writes for every selected person through `bulkSnoozeUntil`. All writes still go through `snooze-dao`, the sole writer of `snooze_until`, and both custom-date writers run `assertFutureLocalSnoozeDate` before any transaction.

## Alternatives Considered

- **Build the sheet here for the Profile only, or no sharing** — rejected for one sheet on all four entries (Q-02).
- **Take Snooze out of ⋯ (tile only)** — rejected; it stays in ⋯ as one entry (Q-25).
- **One-tap unsnooze on the card** — rejected; the card opens the sheet (D-81).
- **Keep the bulk bar's Unsnooze button** — rejected; the sheet is the hub (D-82).
- **Unsnooze every selected person (ADR-103's all-IDs rule)** — not kept for bulk Unsnooze: it wrote false unsnooze events for never-snoozed people (owner extraction ruling under D-82).

## Consequences

### Positive

- Snooze looks and behaves the same everywhere; the last native Alert is gone.

### Negative

- A bulk selection with nobody snoozed shows no Unsnooze at all.

### Risks

- A retained Retry closure could reuse a consumed bulk claim; `runClaimedBulkWrite` reads the held claim at call time to prevent it.
- The Profile's single-contact Unsnooze still writes an event on every invocation (ADR-111); only the bulk path filters.

## Implementation

**Key files:**
- `src/components/SnoozeSheet.tsx` — the shared sheet.
- `src/profile/relationship-sheet-model.ts` — `snoozeCustomDateDefault`, confirmation and Undo labels.
- `src/components/profile/ProfileModuleHost.tsx` — Overview tile host.
- `src/components/profile/ProfileRelationshipSheets.tsx` — frequency sheet only (snooze moved out).
- `src/screens/ContactProfileScreen.tsx` — ⋯ Snooze… host.
- `src/screens/contact-profile-logic.ts` — ⋯ entries without Unsnooze.
- `src/screens/HomeScreen.tsx` — card and bulk hosts.
- `src/components/CardContextMenu.tsx` — "Snooze…" opens the sheet.
- `src/components/BulkActionSurface.tsx` — bulk bar without Unsnooze.
- `src/db/dashboard-read.ts` — `readCurrentlySnoozedIds`.
- `src/db/bulk-actions-dao.ts` — `bulkSnoozeUntil`.
- `src/db/snooze-dao.ts` — `assertFutureLocalSnoozeDate`; sole `snooze_until` writer.
- `src/db/profile-relationship-actions.ts` — Profile snooze writers.
- `src/logic/dashboard-bulk-action-session.ts` — `runClaimedBulkWrite`.

**Depends on:** ADR-103 (Atomic Composed Dashboard Bulk Mutations); ADR-111 (Cadence-Guarded Profile Metrics and Composed Relationship Actions); ADR-102 (Frozen-Universe Dashboard Multi-Select); ADR-199 (App-Wide Destructive-Action, Feedback and Validation Standards, and One Empty State)
**Required by:** ADR-234 (Per-Person Mute Becomes an Indefinite Snooze, Stored as a Far-Future Date and Converted by Migration 034 and on Restore); ADR-254 (Selection Mode Uses a Bottom Two-Row Bar and a More… Sheet); ADR-255 (Bulk Sheets Open Sized to Their Rows)
