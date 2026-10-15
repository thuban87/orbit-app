# ADR-220: Things to Remember Inline on Add and Edit Contact, and the Shared Entry Field

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-05, D-65, D-66, D-67, D-114, D-116, D-119, D-121, D-129, D-135, D-141 (38.10-CONTEXT.md; ledger Q-16, draft review; convergence c1 Q-P3, c3 Q-P5, c11 Q-P10, c12 Q-P12; code review WR-01; plan-19 sign-off); D-104 in ADR-212
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Memories and Off Limits on Add/Edit Contact were links to other pages or the old "Add fuel" editor; Last Talked About and Current Location could only edit the newest entry; Add buttons were mixed (hollow, solid, none). The owner wanted every entry field to wrap, save on Enter and stay visible above the keyboard (Q-16, draft review).

## Decision

We will show Things to Remember inline on Add and Edit Contact in the Profile order: Last Talked About, Key People, Current Location, Memories, Thought of Them, Gift Ideas, Custom Fields, Off Limits, and on Edit Contact only, Imported from Contacts App with no Add and a fixed type (D-05, D-65, D-116). Key People, Memories, Off Limits ("Add Off Limits Item"), Gift Ideas and Thought of Them each have a solid "Add …" button (D-67); memory forms use the section's own name (D-141). Last Talked About and Current Location have no Add button: each shows an always-visible text box with its date (today by default) that the form's Save records; Enter there only closes the keyboard; the most recent entry shows as a small card above "See all" (D-119, D-121, D-135). One shared `EntryTextField` wraps up to about three lines then scrolls, shows Save/Send on the keyboard and saves on Enter, keeps a visible Save, and when focused is centred in the height left above the keyboard (D-66). It is used on Add/Edit Contact and the per-section editors, and without centring on Update Contact's editors (D-114). Newly typed or pasted line breaks become spaces; line breaks already stored are kept (D-129). The app-wide rollout is Phase 40's (todo `2026-10-12-phase-40-text-field-sweep.md`).

## Alternatives Considered

- **Last Talked About and Current Location with their own solid Add** — the D-67 list; amended by D-119 to an always-visible box.
- **Enter saves in those two boxes** — narrowed by D-121.
- **Flatten every line break on the first keystroke** — rejected at code review (WR-01).
- **Roll the field out app-wide now** — out of scope (about 25–35 sites, ≈2 plans) (draft review).

## Consequences

### Positive

- Most knowledge can be entered while creating or editing a contact; one field behaves the same everywhere it is used.

### Negative

- Two field behaviours coexist until Phase 40's sweep.

### Risks

- No keyboard library is installed; centring relies on a measured spacer and scroll, which an absolute bottom surface can defeat (memory note on KeyboardAvoidingView).

## Implementation

**Key files:**
- `src/components/ui/EntryTextField.tsx` — the shared entry field.
- `src/components/ui/entry-text-logic.ts` — `sanitizeEntryChange`, `normalizeEntryText`, `isSavableEntry`.
- `src/components/ui/use-keyboard-centering.ts` — focus centring.
- `src/components/ui/KeyboardCenteringProvider.tsx` — the centring context.
- `src/components/ui/centered-scroll.ts` — the pure centring helpers.
- `src/screens/CreateContactScreen.tsx` — inline sections on Add Contact.
- `src/screens/EditContactScreen.tsx` — inline sections on Edit Contact, the Imported section.
- `src/screens/create-contact-logic.ts` — section partitioning and draft items.
- `src/screens/edit-contact-logic.ts` — memory draft adapters and dated entries.
- `src/screens/edit-contact-display.ts` — the most-recent card.
- `src/components/OffLimitsInlineEditor.tsx` — the inline Off Limits section.
- `src/db/contacts-dao.ts` — the aggregates writing every home in one transaction.

**Depends on:** ADR-131 (Progressive Contact Creation and Complete-Record Editing); ADR-207 (Knowledge Homes After Fuel); ADR-210 (Dated Last Talked About and Current Location)
**Required by:** None
