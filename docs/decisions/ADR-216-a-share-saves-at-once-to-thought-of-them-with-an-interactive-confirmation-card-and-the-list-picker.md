# ADR-216: A Share Saves at Once to Thought of Them, with an Interactive Confirmation Card and the List Picker

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-02, D-04, D-07, D-23, D-28, D-30, D-32, D-74, D-77, D-78, D-79, D-80, D-83, D-99, D-120, D-150; D-82 REJECTED (38.10-CONTEXT.md; ledger Q-22, Q-23, Q-24, Q-26, Q-27, Q-50; plan-phase P4; convergence c12 Q-P11); carried D-12
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-038 (partial — writing every share as `topic` fuel with a fixed default kind dies; write-at-pick, never a touchpoint, canonical URL kept separate, contact-owned rows, independent multi-attach rows and name-only inline create survive)
**Superseded by:** None

## Context

A share was saved as topic fuel with no way to choose where it belonged, no Undo (I-04) and a 1.5 s toast; the face-grid picker demoted search; resume prompts could cover a share (I-01, NEW-7); multi-person shares skipped the auto-backup revision bump (NEW-2), and a failed share after inline create duplicated the contact on retry (NEW-3). Phase 39 needed I-01 and I-04 fixed first (D-07).

## Decision

We will save a share at once, on the person tap, to Thought of Them with provenance `share` and Allow AI off (D-02, D-04, D-77). The confirmation becomes an interactive card: section chips (Thought of Them · Gift Ideas · Last Talked About · Memories) that move the item, Undo, Add note and an Allow AI switch, off by default and disabled while Last Talked About is chosen (D-77, D-78, D-99). The card reads "Saved to <name> · <section>" and follows the chip; its auto-close (`SHARE_CARD_AUTO_CLOSE_MS`, 5000 ms, at the top of the logic file) waits while touched. A multi-person share lands every copy in Thought of Them and the chips move them together (D-79). Undo returns to the unlocked list with the same shared item (D-120). The share screen uses the app's list picker with always-visible search, keeps "New contact" carrying the search text, never offers archived contacts, and orders by most recent share across every home a share can live in (D-30, D-80). A share-created contact keeps the name-only sheet and the shared monthly default `NEW_CONTACT_DEFAULT_INTERVAL_DAYS`, and the card reads "Created <name> · checking in monthly" (D-32, D-83). Every share write bumps `data_revision`, and creating a contact plus its first share is one transaction (D-28). Both resume prompts are suppressed while a share is pending or the share screen is focused, cold and warm (D-23). Sharing keeps today's `finish()` return to the source app (D-74).

## Alternatives Considered

- **Pick the section before saving** — rejected: slower, and revives 03-fuel's rejected "contact + kind together" (Q-22).
- **AI switch only on the item later** — not chosen (Q-23).
- **A section per copy on a multi-person share** — not chosen (Q-24).
- **Keep the face grid with demoted search** — rejected (Q-27); 10-capture's rejected "search-first" is revived.
- **Remove "New contact" from the share picker (D-82)** — rejected: the owner's own recorded decision (ADR-038) (Q-50).
- **Leave the monthly default silent** — rejected (Q-26, option a).
- **Undo keeps the list locked and closes the screen** — replaced by D-120.

## Consequences

### Positive

- The share is never lost to an unanswered question; Undo and moves make the default cheap to correct.

### Negative

- Accepted (D-150): a share sent within about 0.5 s of the previous card closing opens Digest and is dropped (release build, 2 of 8 tries).

### Risks

- Card state races are held by a render-time share sequence and one write latch; a new share intent while a write is in flight must not publish into the old card.

## Implementation

**Key files:**
- `src/db/capture-dao.ts` — share, create-and-share, move, Allow AI and note writes, each one transaction and one bump.
- `src/db/capture-read.ts` — share recency over every home (`SHARE_RECENCY_JOIN`).
- `src/screens/CaptureScreen.tsx` — the list picker, inline create, card host.
- `src/components/ShareConfirmationCard.tsx` — chips, Undo, Add note, Allow AI.
- `src/logic/share-card-logic.ts` — card reducer, auto-close constant, labels and snackbars.
- `src/components/ContactPicker.tsx` — embedded `ContactPickerList`, `allowArchived`.
- `src/constants/new-contact-defaults.ts` — `NEW_CONTACT_DEFAULT_INTERVAL_DAYS`.
- `src/services/resume-prompt-precedence.ts` — `resolveActiveResumePrompt` with `suppressed`.
- `App.tsx` — the resume-prompt gate.

**Depends on:** ADR-207 (Knowledge Homes After Fuel); ADR-213 (Moving Entries Between Things to Remember Sections); ADR-037 (Text-Only Android Share Intent Integration); ADR-038 (Contact-Owned Share Capture Fuel)
**Required by:** None
