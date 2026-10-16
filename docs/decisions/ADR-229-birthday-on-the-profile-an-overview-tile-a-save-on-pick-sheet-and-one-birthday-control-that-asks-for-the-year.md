# ADR-229: Birthday on the Profile — an Overview Tile, a Save-on-Pick Sheet, and One Birthday Control That Asks for the Year

**Status:** Accepted
**Date:** 2026-10-16
**Phase:** 38.11-everyday-screens-ux
**Source decisions:** D-53, D-55, D-80, D-56, D-59, D-61, D-49, D-86 (38.11-CONTEXT.md; ledger Q-07, Q-13, Q-18, Q-20, Q-21, Q-22, plan-time ruling D-80; phase code review WR-05); device-pass decision A7
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The Profile read no birthday at all. Turning "Year unknown" off on Edit Contact silently stored the year 2000 (its internal picker year), and Edit had no way to clear a birthday.

## Decision

The Relationship Overview has a **Birthday** tile, a new closed-registry module id `"birthday"` (ADR-109). It sits in every default layout right after Contact Frequency, before Snooze (D-53, D-80). Saved layouts gain it at that position at read time through `completeProfileLayoutChildren`, which the layout editor shares; nothing is written back. The tile shows the date through the 38.9 date standard, with the year when known, and appears only when a birthday is set; the grid closes up with no gap (D-55).

Tapping the tile opens a bottom sheet like the other Overview sheets, not Edit Contact (D-56). The sheet has a date picker that opens on the saved date, a Year unknown switch, Clear and Close (D-59). A pick saves at once through `setContactBirthday` with a confirming snackbar. Clear, and dropping a known year, offer Undo that restores the previous value. Each save reschedules reminders and refreshes the widget.

One shared `BirthdayField` control serves Add Contact, Edit Contact and the sheet. Turning Year unknown off opens the picker to choose the year; cancelling turns Year unknown back on; 2000 is never stored silently (D-61). Clear shows on Edit and the sheet, not on Add (D-49, A7). Birthday pickers stop at today, and a future stored date is clamped for the picker (D-86).

## Alternatives Considered

- **Birthday under the name, or not shown** — rejected for an Overview tile (Q-07).
- **Tile off by default, or shown as "Not set"** — rejected for on and hidden when empty (Q-20).
- **Tile opens Edit Contact** — rejected; it behaves like the other Overview tiles (Q-21).
- **A picker with Save, or no Clear** — rejected for save on pick with Year unknown and Clear (Q-22).
- **Year unknown off uses this year, or a blank year** — rejected for asking for the year (Q-13).
- **No cap on birthday pickers** — rejected; keep the cap at today (D-86).

## Consequences

### Positive

- A birthday is visible and editable from the Profile without leaving it.

### Negative

- The sheet saves on every pick; there is no draft to cancel, only Undo for removals.

### Risks

- A new module id joins the persisted contract; older saved layouts rely on read-time completion to show it.

## Implementation

**Key files:**
- `src/profile/persisted-contract.ts` — the `"birthday"` module id.
- `src/profile/module-registry.ts` — tile registration.
- `src/profile/presentation-schema.ts` — factory layout position.
- `src/profile/resolve-presentation.ts` — `completeProfileLayoutChildren`.
- `src/db/contact-read.ts` — the header returns `birthday`.
- `src/db/profile-read.ts` — `ProfileIdentity.birthday`.
- `src/db/contacts-dao.ts` — `setContactBirthdayCore`, `setContactBirthday`.
- `src/components/profile/RelationshipOverview.tsx` — the tile, hidden when empty.
- `src/components/profile/BirthdaySheet.tsx` — the sheet and `classifyBirthdayChange`.
- `src/components/profile/ProfileModuleHost.tsx` — hosts the sheet.
- `src/screens/ContactProfileScreen.tsx` — `saveBirthday`, reminders and widget refresh.
- `src/components/BirthdayField.tsx` — the shared control.
- `src/components/birthday-field-logic.ts` — the year-ask step machine and `birthdayPickerMaxDate`.
- `src/screens/edit-contact-logic.ts` — Edit's birthday state.

**Depends on:** ADR-109 (Fixed-Hero Semantic Profile Composition and Focused Accessible Editors); ADR-108 (Durable Independent-Axis Profile Presentation and Inheritance); ADR-205 (One Date-Only Display Formatter, and Native Pickers for Memory and Custom-Field Dates)
**Required by:** None
