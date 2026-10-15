# ADR-182: Missing Photos Keep Their Reference; Backups Skip and Mark Only Missing Photos

**Status:** Accepted
**Date:** 2026-09-30
**Phase:** 38.6-photo-handling
**Source decisions:** D-23, D-24, D-26, D-27, D-28, D-29, D-30, D-31, D-32, D-33, D-34, D-35 (dossier § Execution rulings; code review WR-01, WR2-01/03, IN2-02, WR3-03, IN3-02/03; plan-check M1/M2)
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

A contact's photo reference can outlive its file. Before this decision, `settleRowLocked` retired a finalize row whose pending file was missing without checking the canonical file. One unreadable photo also made a manual or automatic backup fail as a whole (`BackupPhotoUnreadableError`). Text left in a photo field after a Text→Photo type change reached the image resolver and crashed Edit Contact.

## Decision

We will never clear a stored photo reference because its file is missing. That includes `settleRowLocked`'s missing-pending branch, which now checks the canonical file, keeps the reference and logs without content. The Profile hero and the photo editor (Edit Contact, Settings self photo and the custom photo field) show "Photo unavailable" with Change/Remove. Smaller photos show plain initials.

Export skips and counts a photo only when its file is missing or empty (D-29). Any other read error still fails the backup. A skipped row carries `photoBase64: null` plus an optional `photoSkipped: true` marker. The user is told "1 photo couldn't be included." / "N photos couldn't be included."

On restore, Merge and Replace-all leave a marked row's local photo bytes and reference untouched. Replace-all stages this phone's bytes before the reset and finalizes them at the row's new id-derived canonical path. A marked row whose local file was already gone points at its own new canonical path with no file there, so it shows "Photo unavailable" (D-28). That flag also applies to a Merge-moved value (D-35). An old path is never written back.

An unmarked `photoBase64: null` keeps its meaning: the user removed the photo. A photo-field value that is not a stored photo path is backed up and restored as text (D-31). It renders as initials plus "Photo unavailable" and never reaches a resolver (D-34). Restore results say "N photos weren't in the backup and couldn't be restored." (D-33).

`BACKUP_FORMAT_VERSION` stays 7, and there is no migration. Profile backgrounds stay all-or-nothing (D-27).

## Alternatives Considered

- **Clear the reference so backups pass** — rejected by the owner: an automatic path must never drop a unique photo from the record.
- **Skip on any read error** — rejected by D-29: a system-wide IO fault could produce photo-less "successful" backups that retention then uses to delete complete ones.
- **Bump the backup format for the marker** — rejected by D-26: an optional key was approved instead. This is an owner-approved exception to the "wire-shape change needs a version step" reasoning in ADR-145's rejected alternative.
- **Treat an unmarked null as "skipped"** — rejected because it would turn a user's photo removal into a keep.
- **A re-flag sweep for D-28's delete-failure fallback** — rejected by D-32. If a crash or delete failure leaves the row with no reference, that is accepted as rare.
- **Skip unreadable Profile backgrounds the same way** — rejected by D-27; revisit only if it is ever seen.

## Consequences

### Positive

- A lost photo stays visible as a fixable state instead of silently becoming initials forever.
- A backup with one missing photo still protects everything else, and a restore never deletes a photo the backup could not carry.

### Negative

- Restore has a per-mode photo path (Merge capture/write-back, Replace-all stage/finalize) plus result copy for two counts.

### Risks

- Older Orbit builds reading a marked backup see an ordinary null photo. This is acceptable because there is no installed base.

## Implementation

**Key files:**
- `src/services/photos/owned-master.ts` — `settleRowLocked` checks the canonical file and keeps the reference.
- `src/components/PhotoUnavailableNotice.tsx` — notice and load-failure hook for the hero and editor.
- `src/constants/photo-copy.ts` — `PHOTO_UNAVAILABLE_LABEL`.
- `src/components/profile/ProfileHero.tsx` — shows the unavailable state.
- `src/components/PhotoSourcePicker.tsx` — shows the unavailable state with Change/Remove.
- `src/db/photo-relative-path.ts` — `isStoredPhotoPath` gate for non-path values.
- `src/components/photo-display.ts` — never resolves a non-path value.
- `src/backup/export-manifest.ts` — `readPhotoOrSkip`, the skip count, the `photoSkipped` marker and text-as-text.
- `src/backup/backup-schema.ts` — accepts the optional boolean marker.
- `src/backup/restore-apply.ts` — leaves marked rows' local photos alone; the D-28/D-35 flags; count of missing photos.
- `src/services/photos/merge-photo-rehome.ts` — `stageLocalPhotoForRestore`.
- `src/services/backup/skipped-photos.ts` — skip and restore copy; the device-local automatic-backup record.
- `src/services/backup/backup-service.ts` — returns the skip count.
- `src/services/backup-sweep.ts` — records the automatic-backup skip count.
- `src/screens/BackupScreen.tsx` — shows the skip count.
- `src/screens/RestoreResultScreen.tsx` — shows the restore photo counts.
- `src/screens/backup-restore-logic.ts` — result parameters.

**Depends on:** ADR-057 (Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots); ADR-158 (Canonical Photo Ownership Across Masters, Staging, and Derivatives); ADR-159 (Commit-Current Restore with Deterministic Pair Completion and No Legacy Repair)
**Required by:** None
