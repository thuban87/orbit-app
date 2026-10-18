# ADR-240: Import Takes Full-Size Phone Photos, Warns Before Photos Outgrow the Encrypted Backup, and Check Linked Contacts Keeps Thumbnails

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-118, D-135, D-137, D-133, D-147, D-132 (import half) (38.12-CONTEXT.md; ledger Q-22, Q-P1, Q-P2, Q-C1, mid-execution ruling R3)
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-181 (partial — "Imported phone photos stay at the native picker's thumbnail size" (its D-22) dies, and its logged-for-later alternative "Full-size phone photos on import" is adopted; the square WebP master, the 1024 px edge, never upscaling and the 8 MiB encrypted-backup cap survive)
**Superseded by:** None

## Context

Imported phone photos stayed at the native picker's thumbnail size, so they looked soft beside photos added in Orbit (todo `2026-09-29-import-full-size-phone-contact-photo`). Research then showed the cost the owner had not been told. Imported photos would become masters up to 1024 px, backups would grow (about 62 KB per photo contact), and the 8 MiB encrypted-backup cap would be reached at about 145 photo contacts (ADR-181). Check linked contacts would also have re-asked every linked person with a phone photo once.

## Decision

Import takes the phone contact's full-size photo, falling back to the thumbnail. The master rules hold: one square WebP master of at most 1024 px, never upscaled (D-118, ADR-181). The owner kept this knowing its cost (D-135: "Keep, let's fix them though").

Full-size is import-only (D-137). The native reader takes a `preferFullSize` flag, false by default, which only the import paths pass. Check linked contacts' "Use phone's photo" keeps today's thumbnail bytes, so reconcile adds no backup growth. Every read also returns `photoFingerprint`, a SHA-256 of the phone's thumbnail bytes (else of the full-size copy). Import records it as the link's reviewed photo, so a thumbnail-to-full-size switch is never seen as a difference (D-132, ADR-236).

Before an import whose photos would push the encrypted backup past its cap, Orbit warns (D-133). The estimate is the current backup size plus about 62 KB per photo contact. The sheet, "These photos may not fit in your backups", offers four choices:
- **Import with smaller photos** — thumbnail size, at most 256 px;
- **Continue anyway** — with a clear warning that backups stop working until photos are removed;
- **Import without photos**;
- **Go back**.

The check runs on every import path that takes photos. With backup encryption off there is no cap and no prompt.

"Import without photos" records the declined phone photos as reviewed, so Check linked contacts does not re-offer them (D-147). The user can undo that per person with "Ask about the phone's photo again" on the check detail.

## Alternatives Considered

- **Drop full-size import (keep thumbnails)** — rejected (Q-P1 C).
- **A hard stop at the cap** — rejected for a warning with choices (Q-P2 B).
- **Warn and allow, with no smaller-photos option** — rejected; the owner asked for all four choices (Q-P2 C).
- **Full-size on Check linked contacts too**, with or without its own size warning — rejected for thumbnails on the check (Q-C1).

## Consequences

### Positive

- Imported photos are as sharp as photos added in Orbit.
- No import can push the encrypted backup over its cap without the user choosing to.

### Negative

- Backups grow faster, and the cap is reached at about 145 photo contacts instead of later.
- The same person's photo can be full-size from import and thumbnail-size from a later Check.

### Risks

- "Continue anyway" leaves every automatic backup failing as "too large" until photos are removed.
- The estimate counts every picked contact with a photo, so it errs toward asking.

## Implementation

**Key files:**
- `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt` — full-size-first reads behind `preferFullSize`, thumbnail fallback, fingerprint.
- `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/PhotoFingerprint.kt` — the fingerprint.
- `modules/orbit-contact-picker/src/OrbitContactPickerModule.ts` — the `preferFullSize` bridge signature.
- `modules/orbit-contact-picker/index.ts` — `readContactsByLookupKeys` and `readAllContacts` options.
- `src/services/import/import-photo.ts` — records the fingerprint after a photo is adopted; declined photos recorded.
- `src/services/import/import-photo-retry.ts` — records the fingerprint on retry.
- `src/services/import/import-acquire.ts` — payload fingerprint; "Import without photos".
- `src/services/import/start-contact-import.ts` — passes `preferFullSize` and the budget choice.
- `src/services/import/import-photo-budget.ts` — the estimate and the four choices.
- `src/components/PhotoBudgetSheet.tsx` — the warning sheet.
- `src/db/reconcile-snapshot-dao.ts` — `recordImportedPhotoFingerprint`.
- `src/screens/ReconcileDetailScreen.tsx` — "Ask about the phone's photo again".

**Depends on:** ADR-181 (One Square WebP Master up to 1024 px with Bounded Orrery Textures from Cache Copies); ADR-065 (Durable Resumable Contact-Import Sessions with Failure-Isolated Photos)
**Required by:** None
