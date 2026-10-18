# ADR-226: Archive Becomes the Bin, and Move to Bin Confirms First with No Undo

**Status:** Accepted
**Date:** 2026-10-16
**Phase:** 38.11-everyday-screens-ux
**Source decisions:** D-69, D-71, D-93, D-67, D-70 (38.11-CONTEXT.md; ledger Q-25, Q-27, Q-28, Q-32, Q-33, Q-34; 38.11-14 device ruling D3); device-pass decisions D4, D7
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-199 (partial — for Move to Bin only, "Archive … act at once with … Undo" dies and its rejected "Archive confirms first" is chosen; Restore and Bind still act at once with Undo, and Unbind keeps its confirm); ADR-018 (note — the user-facing term "Archive" / "Archived contacts" becomes "Bin"; the archive-before-purge gate is unchanged)
**Superseded by:** None

## Context

The owner found no way to delete a contact from the Profile. The flow already existed (archive, then delete permanently from Settings), but the word misled: "Archive indicates a different state, not really a state leading to deletion." Archive also acted at once with only an Undo snackbar, with no warning that the next step is permanent deletion.

## Decision

We will call it the **Bin** everywhere a user reads it (D-69). That covers the Profile ⋯ "Move to Bin" (red, warning icon), Settings → Bin with Restore and Delete permanently, snackbars, the search badge, dialogs, the History label and the glossary (`BIN`, `MOVE_TO_BIN`; "Archived contact(s)" is a retired form). Behaviour and internal names (`archived_at`, the `Archived` route id, DAO names) are unchanged.

Move to Bin asks first with the themed destructive confirm on the Profile and in the Contacts bulk bar (D-71, D-93, D4); the Profile one reads "Move {name} to the Bin? They'll be hidden from your lists. You can restore them, or delete them permanently, from Settings → Bin." There is no Undo. A "Moved {name} to the Bin" snackbar appears only after the write resolves, and the widget and reminder schedule are refreshed after it.

There is no Delete on the Profile: permanent deletion stays only in the Bin (D-67, ADR-018). The Bin never empties itself (D-70).

## Alternatives Considered

- **Delete Contact in the Profile ⋯** — rejected; the Bin plus ADR-018's gate covers it (Q-27).
- **"Trash", or keep "Archive"** — rejected for "Bin" (Q-32).
- **Confirm and Undo, or Undo only (keep 38.9 D-32)** — rejected for "Confirm, then act" (Q-34).
- **Auto-empty the Bin after a period** — rejected; never (Q-33).
- **"They'll be hidden everywhere."** — D-71's example copy, replaced at the device review (D-93).

## Consequences

### Positive

- The word says where the person is going and what comes next.

### Negative

- Move to Bin is one more tap than the Undo pattern the other reversible lifecycle actions use.

### Risks

- A Profile already in the Bin still offers Move to Bin, which always fails (IN-04; archived-Profile gating is 38.12's).
- Phase 39 copy that says "archive" must follow (`39-AMENDMENTS-PENDING.md`).

## Implementation

**Key files:**
- `src/constants/glossary.ts` — `BIN`, `MOVE_TO_BIN`, retired "Archived contact(s)".
- `src/screens/contact-profile-logic.ts` — `binConfirmation`, `bulkBinConfirmation`, `MOVE_TO_BIN_CONFIRM_MESSAGE`, `runMoveToBin`.
- `src/screens/ContactProfileScreen.tsx` — the ⋯ Move to Bin flow.
- `src/screens/HomeScreen.tsx` — bulk Move to Bin confirm and snackbar.
- `src/components/BulkActionSurface.tsx` — the bulk bar's Bin entry.
- `src/screens/ArchivedContactsScreen.tsx` — the Bin page (title, count, empty state, full-name rows).
- `src/screens/settings-contacts-model.ts` — Settings → Bin row.
- `src/screens/settings-hub-model.ts` — hub subtitle.

**Depends on:** ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out); ADR-199 (App-Wide Destructive-Action, Feedback and Validation Standards, and One Empty State); ADR-206 (Glossary — Canonical Terms Kept, Retired Forms Enforced, Plain-Word Rewrites, and a Shared Plural Helper)
**Required by:** ADR-232 (A Binned Person Gets a Bin Banner, an "In the Bin" Status and DAO Guards, and the Bin List Reloads with Restore and Undo)
