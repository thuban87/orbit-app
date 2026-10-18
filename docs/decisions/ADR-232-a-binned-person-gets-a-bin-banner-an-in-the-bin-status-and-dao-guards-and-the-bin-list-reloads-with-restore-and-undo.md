# ADR-232: A Binned Person Gets a Bin Banner, an "In the Bin" Status and DAO Guards, and the Bin List Reloads with Restore and Undo

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-93, D-34, D-35, D-41, D-31, D-40, D-32 (Restore half) (38.12-CONTEXT.md; ledger Q-01, Acceptance revision of D-40); carried D-10, D-20
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

A person in the Bin opened to a Profile that looked live. It offered Snooze, Unbind and a Move to Bin that always failed (38.11 IN-04), and a Bound, contacted binned person read "Stable". The Bin list loaded only on mount although it is mounted in both the Contacts and Settings stacks, so it went stale, flashed "The Bin is empty" while loading, and Restore acted silently.

## Decision

A binned person's Profile shows a banner, "<name> is in the Bin", with an **Open the Bin** button (D-93). Restore and permanent delete stay only in the Bin list (ADR-018, D-20). The banner sits directly below the Hero, because the photo rises under the overlay app bar. It replaces the Unbound Bind card.

The binned Profile offers no Snooze, Unbind, Move to Bin, Merge or update-from-Contacts entries. Its ⋯ holds only Profile Layout and Background, and the star is disabled (D-34). `profileOverflowEntries` takes `{ bound, archived }`. Orbit Status shows **In the Bin** before any live status ("Orbit Status is paused while they're in the Bin."), and `getContactStatus` returns no status for a binned row (D-35). Dead `bindEnabled` / `canStartLifecycleTransition` are gone (D-41).

The DAOs refuse a binned person with one typed error, `ContactInBinError`, through `assertContactNotInBinCore`. The guard covers bind, unbind, snooze, unsnooze, setting and clearing the favourite rank, and a participation change in `updateContactFull`. Edit Contact's Bound/Unbound chips are disabled for a binned person.

The Bin list reloads on focus and in both catch blocks, and shows a loading line instead of the empty state (D-31). Rows show avatar, name and the date moved to the Bin. Restore stays a visible button. Delete permanently sits behind a row ⋯, the only destructive action (D-40). Restore acts at once with "Restored <name>" and Undo, which puts the original `archived_at` back. Restore also reconciles the reminder schedule and refreshes the widget (D-32).

## Alternatives Considered

- **Banner plus Restore on the Profile** (the 38.11 reviewer's suggestion) — rejected to keep ADR-018's single home for restore and purge (Q-01 B).
- **Restore and Delete both behind the row ⋯** — the first D-40 draft; revised at acceptance. Restore is not destructive, so only Delete goes behind ⋯.
- **Making the binned Profile's Frequency and Birthday tiles read-only** — raised at the device pass (Q5); the owner said "skip", so they stay editable.

## Consequences

### Positive

- A binned Profile can no longer offer an action that fails, and its status no longer claims a live relationship.
- The Bin list is current in whichever stack shows it.

### Negative

- A binned person's Frequency and Birthday tiles still accept edits (owner Q5 "skip").

### Risks

- Any new lifecycle writer must call `assertContactNotInBinCore`, or a binned person can be changed again.

## Implementation

**Key files:**
- `src/screens/contact-profile-logic.ts` — `profileOverflowEntries({ bound, archived })`, `binnedProfileBanner`, `profileStarView`.
- `src/screens/ContactProfileScreen.tsx` — the banner and its Open the Bin button.
- `src/navigation/tab-entry.ts` — `openBinFromProfile`.
- `src/services/profile-metrics.ts` — `STATUS_IN_THE_BIN` checked before any live status.
- `src/db/contact-status-read.ts` — no status for a binned row.
- `src/db/contact-lifecycle-dao.ts` — `ContactInBinError`, `assertContactNotInBinCore`, guarded bind and unbind.
- `src/db/snooze-dao.ts` — Bin guard on snooze and unsnooze.
- `src/db/favourites-dao.ts` — Bin guard on the favourite rank.
- `src/db/profile-relationship-actions.ts` — composed Profile actions refuse a binned person.
- `src/db/contacts-dao.ts` — participation change guarded in `updateContactFull`.
- `src/db/bulk-actions-dao.ts` — bulk cores follow the guard.
- `src/services/notifications/notification-actions.ts` — notification actions handle the refusal.
- `src/screens/edit-contact-logic.ts` — `participationChoice(archivedAt)`.
- `src/screens/ArchivedContactsScreen.tsx` — focus reload, loading line, rows, Restore with Undo, Delete behind ⋯.
- `src/screens/archived-contacts-render.test.tsx` — Bin list render tests.

**Depends on:** ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out); ADR-226 (Archive Becomes the Bin, and Move to Bin Confirms First with No Undo); ADR-199 (App-Wide Destructive-Action, Feedback and Validation Standards, and One Empty State)
**Required by:** None
