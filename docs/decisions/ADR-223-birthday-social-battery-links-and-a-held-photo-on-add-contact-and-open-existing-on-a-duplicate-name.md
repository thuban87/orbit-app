# ADR-223: Birthday, Social Battery, Links and a Held Photo on Add Contact, and Open Existing on a Duplicate Name

**Status:** Accepted
**Date:** 2026-10-16
**Phase:** 38.11-everyday-screens-ux
**Source decisions:** D-48, D-77, D-73, D-88; D-50 (rejected) (38.11-CONTEXT.md; ledger Q-03, Q-14, Q-16, Q-17, Q-18; phase code review WR-04); device-pass decision A8
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-016 (partial — its rejected "Rich create form" is adopted for birthday, social battery, links and photo only; the lean initial sections survive); ADR-131 (partial — its rejected "Present the complete form at initial create" is adopted for the same four fields, behind See More or in Identity; the three initial sections and Show More survive)
**Superseded by:** None

## Context

Birthday, Social battery, Links and Photo could only be set by saving a contact and then opening Edit Contact. The earlier rejection was product friction ("creating a contact should not demand 15 fields"), not a technical limit. The duplicate-name warning offered only Save anyway or Cancel, so a user who had typed an existing person could not get to them.

## Decision

We will offer Birthday (with Year unknown), Social battery and Links on Add Contact behind See More, in a "Birthday, social battery & links" section, written by the one create transaction (D-48). `createContactFullCore` inserts `birthday` and `social_battery` and appends links through the non-bumping `addLinksCore` before the single `data_revision` bump; a link failure rolls the whole create back. A link row with a label but no URL shows a warn-only caption and is dropped on save (D-88).

Add Contact offers Photo in Identity, above Name (D-77). The picked photo is cropped into a held file under `create-staging/` (an allowlisted, token-checked namespace), promoted through the normal owned-master path after the create commits, and deleted in every outcome. If promotion fails, the contact is kept and the user is told the photo wasn't added. Discarding the form, Remove, or killing the app leaves nothing: a launch sweep deletes orphan staging files.

The duplicate-name dialog offers Cancel · Open existing · Save anyway through a three-way themed `choose()` (D-73, ADR-198). Open existing opens the first match by name, behind the discard guard. Duplicates still only warn (D-18).

## Alternatives Considered

- **Keep these fields Edit-only** — rejected by the owner (Q-17, Q-16).
- **"Show less" after See More** — rejected; See More stays one-way (D-50).
- **Block a label-only link row** — rejected; warn only, matching contact-method warnings (D-88, D-17).

## Consequences

### Positive

- A contact can be created complete in one save, with one revision bump and no partial rows.

### Negative

- Photo files are written outside the database transaction, so a create can succeed while its photo fails; the user is told.
- Edit Contact still saves links in a second transaction after metadata; only the create path is one transaction.

### Risks

- A held photo outliving its form is a leak; the staging allowlist, the session-aware sweep and the pinned importer list in `photo-writer-contract.test.ts` bound it.
- Large source photos can fail the crop ("Couldn't prepare that image", device finding F-06, pre-existing, backlog todo).

## Implementation

**Key files:**
- `src/db/contacts-dao.ts` — `createContactFullCore` writes birthday, social battery and links in one transaction.
- `src/db/contact-links-dao.ts` — `addLinksCore`, a non-bumping link append for composition.
- `src/screens/contact-link-drafts.ts` — `buildLinksForDiff`, shared by Add and Edit.
- `src/components/links-editor-logic.ts` — the label-without-URL caption.
- `src/screens/create-contact-logic.ts` — create input, held-photo unsaved-work rule, duplicate-name outcome.
- `src/screens/CreateContactScreen.tsx` — See More section, Photo in Identity, duplicate dialog.
- `src/services/photos/create-photo.ts` — `promoteCreatePhoto`, never throws, deletes staging in `finally`.
- `src/services/photos/create-staging-sweep.ts` — launch sweep of orphan held photos.
- `src/services/photos/photo-storage.ts` — stage, list, delete and resolve for `create-staging/`.
- `src/db/photo-relative-path.ts` — `SAFE_CREATE_STAGING_RELATIVE` allowlist.
- `src/components/PhotoSourcePicker.tsx` — hold mode and the unsaved-photo Remove confirm.
- `src/screens/CropPhotoScreen.tsx` — hold-mode crop target.
- `App.tsx` — registers the staging sweep.
- `src/db/contact-read.ts` — `findDuplicateNameIds`.
- `src/stores/confirm-store.ts` — `choose()` three-way dialog.
- `src/components/ui/ConfirmDialog.tsx` — the third, secondary button.

**Depends on:** ADR-016 (Fixed-First Contact Forms and Atomic Contact Creation); ADR-131 (Progressive Contact Creation and Complete-Record Editing); ADR-180 (Display-Revision Photo URIs and Current Photos on Every Existing-Contact Surface); ADR-198 (Themed Dialogs Through One Imperative Host, an Overlay Registry, and Snackbars Above Overlays)
**Required by:** None
