# ADR-233: The Profile ⋯ Follows Lifecycle State, Bind and Unbind Show Undo, and Unbound People Get a Bind-Card Frequency, a Disabled Star and a Settings Row

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-94, D-99, D-100, D-42, D-33, D-32 (Bind half), D-95, D-36, D-38, D-39, D-97 (38.12-CONTEXT.md; ledger Q-02, Q-04, Q-05, Q-06, Q-07, Acceptance); carried D-11, D-12, D-21
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-225 (partial — the ⋯ list's "Snooze… in both states" dies: no Snooze while Unbound or in the Bin; the list gains "Check with phone Contacts…" for a linked person and "Merge with another contact…"; the rest of the ⋯ list, its order and the Profile top survive)
**Superseded by:** None

## Context

Snooze was offered to Unbound people, for whom it does nothing. Merge was reachable only through Settings → Check linked contacts, although dossier 20 Cluster U put it on the Profile, and the per-person update from Contacts (Cluster E) did not exist. Bind acted silently, and a confirmed Unbind left the ⋯ sheet open. An Unbound person's star was filled from the dormant rank. The Bind card never showed a frequency the person already had, and Unbound contacts had no Settings entry.

## Decision

The Profile ⋯ is built from `{ bound, archived, linked }`. For a live person it reads: Snooze… and Unbind contact (Bound only) · Check with phone Contacts… (linked only) · Merge with another contact… · Move to Bin · separator · Profile Layout · Background (D-94, D-99, D-100). Unbound and binned people get no Snooze in ⋯ and no Snooze tile, and both return on Bind. A stored snooze is left as data. Merge opens the merge picker with this person first (ADR-235). Check with phone Contacts opens the existing comparison for just this person. The sheet is the compact, content-sized variant with a Close, titled "More actions" (D-42).

Bind acts at once with "Bound <name>" and Undo, which unbinds (D-32). A confirmed Unbind closes the ⋯ sheet first, then shows "Unbound <name>" with Undo, which binds (D-33). Unbind stays a plain, confirmed entry (D-11), and the cadence is never cleared (ADR-062).

An Unbound person with a saved frequency sees it on the Bind card ("Bind · Every 30 days") with a Change link (D-95). A changed frequency is written before the bind, and Undo puts the saved frequency back.

On an Unbound Profile the star draws dimmed and off. A tap explains why in a notice snackbar, and the dormant rank is kept (D-36, D-21). The Profile favourite toggle refreshes the widget (D-38).

Settings → Contacts & Relationships lists "Unbound contacts" beside "Bin", and `UnboundContacts` is registered in the Settings stack. The Contacts ⋯ entry stays (D-97). The Unbound list scrolls to the top on a new query, keeps taps while the keyboard is up, and shows "Last contact <date>" or "No contact logged" instead of "Unbound" (D-39).

## Alternatives Considered

- **Keep Snooze for Unbound people** — rejected; Unbound people get no check-in reminders, so it does nothing (Q-02).
- **A Merge link at the bottom of Edit Contact**, or **no Profile merge** — rejected for ⋯ (Q-06 B, C).
- **"Sync with Contacts" with Update to Contacts** — the owner's own idea; the write-back half is deferred to the backlog as D-101 because it reverses dossier 20 Cluster B and ADR-068's rejected source write-back. The owner chose the update-from entry only (Q-07).
- **Keep Bind only, without the saved frequency** — rejected (Q-04).
- **No Settings entry for Unbound contacts** — rejected (Q-05).

## Consequences

### Positive

- Every ⋯ entry does something for the person it is shown to.
- Merge works for Orbit-only duplicates, which have no phone link.

### Negative

- The ⋯ list is longer for a linked live person.

### Risks

- An Undo of Bind after a changed frequency has to restore the old frequency; that path is covered by a test.

## Implementation

**Key files:**
- `src/screens/contact-profile-logic.ts` — `profileOverflowEntries`, `PROFILE_MERGE_LABEL`, `PROFILE_CHECK_PHONE_CONTACTS_LABEL`, `PROFILE_OVERFLOW_TITLE`, `unboundStarExplanation`, `bindCardModel`, `runProfileLifecycleTransition`.
- `src/screens/ContactProfileScreen.tsx` — the ⋯ sheet, Bind/Unbind snackbars with Undo, the Bind card and its Change link, the star.
- `src/components/profile/RelationshipOverview.tsx` — no Snooze tile for an Unbound person.
- `src/db/contact-read.ts` — `hasActiveExternalLink`.
- `src/navigation/shell-contract.ts` — `ReconcileDetail` in the Profile-reachable routes.
- `src/screens/UnboundContactsScreen.tsx` — scroll to top, keyboard taps, subtitle.
- `src/screens/unbound-list-logic.ts` — the row subtitle.
- `src/db/unbound-read.ts` — the last-contact column.
- `src/navigation/tabs/SettingsStack.tsx` — `UnboundContacts` registered.
- `src/screens/settings-contacts-model.ts` — the "Unbound contacts" row.
- `src/screens/contact-profile-logic.test.ts` — the ⋯ entries per state.

**Depends on:** ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment); ADR-225 (Profile Top — a Full-Width Edit Contact Button, a "Compose" Label, the Name in a Solid Top Bar, and a Slimmer ⋯); ADR-232 (A Binned Person Gets a Bin Banner, an "In the Bin" Status and DAO Guards, and the Bin List Reloads with Restore and Undo)
**Required by:** ADR-251 (An All Contacts Search Also Finds Unbound People); ADR-254 (Selection Mode Uses a Bottom Two-Row Bar and a More… Sheet)
