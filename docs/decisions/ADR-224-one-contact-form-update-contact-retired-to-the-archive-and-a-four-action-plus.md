# ADR-224: One Contact Form — Update Contact Retired to the Archive, and a Four-Action +

**Status:** Accepted
**Date:** 2026-10-16
**Phase:** 38.11-everyday-screens-ux
**Source decisions:** D-62, D-66, D-26, D-41; D-72 (deferred to 38.15) (38.11-CONTEXT.md; ledger Q-12, Q-23, Q-29, Q-30); carried D-13
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-132 (partial — the Update Contact chooser dies; its rejected "Merge … Update Contact, and Edit Contact into one form" is chosen for Update and Edit only; Quick Log and Log Interaction stay separate focused flows); ADR-082 (partial — Update Contact and Memory as + actions die; the fixed-order dial, the canonical picker, Profile preselection and truthful Quick Log survive)
**Superseded by:** None

## Context

The + offered six actions, and two of them led to forms that "basically do a lot of the same things": Update Contact (a chooser of focused editors, reachable only from the +) and Edit Contact (the complete form, in the Profile ⋯). Memory on the + duplicated entry points that already exist. Edit Contact's save called `navigate("Profile")`, which pushed a second Profile, and the + covered the last control on long pages.

## Decision

We will keep Edit Contact as the single contact form and retire Update Contact (D-62). It leaves the +, its route is removed from the param lists (so tsc rejects any registration), and its screen, chooser logic and test move to `docs/archive/update-contact/` as reference. The archive has no production imports and is outside tsc, Biome, vitest's `src/**` include and graphify, following the 38.8 Rolodex pattern.

Memory leaves the + (D-66). It moves from `FAB_ROUTES` to `PROFILE_REACHABLE_ROUTES` and stays registered in all five stacks, so memories are still added from Profile sections, Add/Edit Contact, the post-Quick-Log step and sharing. The + is Add Contact, Quick Log, Log Interaction and Group Log. Group Log leaves too when 38.15 builds the Events tab's create button (D-72).

Edit's save returns to the Profile it came from (D-26, D-13). `resolveEditSaveExit` goes back when the previous route is that contact's Profile or Compose, otherwise it replaces the Edit route; it never uses `popTo`. Every screen with the + ends with a tunable margin above it (`FAB_CLEARANCE_MARGIN` in `useBottomClearance`), so the + never covers the last control (D-41).

## Alternatives Considered

- **One list-style form with per-section saves** — rejected; larger (~3–5 plans) and loses Edit's one-save aggregate (Q-23).
- **Keep both forms** — rejected; two menu items for largely the same thing (Q-23).
- **Delete Update Contact outright** — not chosen; the owner asked to keep the code as reference (Q-23).
- **Move Group Log off the + now** — deferred to 38.15 with the Events tab (Q-29, D-72).

## Consequences

### Positive

- One place to change a contact; a smaller, clearer +.

### Negative

- No quick jump into one Edit section from the + (the plan judged no caller needed it; other Edit entries are unchanged).

### Risks

- Phase 39 lessons that teach the six-action + must follow (`39-AMENDMENTS-PENDING.md`).
- The + dial's TalkBack swipe order is still not verified on device (todo `2026-09-28-fab-dial-talkback-swipe-skips-actions`).

## Implementation

**Key files:**
- `src/components/universal-fab-logic.ts` — `UNIVERSAL_FAB_ACTIONS`, the four actions.
- `src/components/UniversalFab.tsx` — the dial.
- `src/navigation/shell-contract.ts` — `FAB_ROUTES` and `PROFILE_REACHABLE_ROUTES`.
- `src/navigation/focused-route-classification.ts` — focused routes without UpdateContact.
- `src/navigation/types.ts` — UpdateContact removed from the param lists.
- `src/navigation/use-bottom-clearance.ts` — `FAB_CLEARANCE_MARGIN`, `bottomClearanceFor`.
- `src/screens/edit-contact-logic.ts` — `resolveEditSaveExit`.
- `src/screens/EditContactScreen.tsx` — the save exit.
- `src/screens/UpdateContactScreen.tsx` — retired (moved to the archive).
- `src/screens/update-contact-chooser-logic.ts` — retired (moved to the archive).
- `docs/archive/update-contact/README.md` — the archive's reference note.

**Depends on:** ADR-082 (Universal Capture FAB, Canonical Picker, and Truthful Quick Log); ADR-132 (Focused Rapid Capture Workflows); ADR-131 (Progressive Contact Creation and Complete-Record Editing); ADR-173 (Universal FAB Semantic Visibility, Open-Dial Containment, Non-Collapsable Shell Overlays, Border, and Bottom Clearance)
**Required by:** None
