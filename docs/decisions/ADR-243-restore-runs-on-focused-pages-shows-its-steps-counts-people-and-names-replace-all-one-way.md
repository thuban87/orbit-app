# ADR-243: Restore Runs on Focused Pages, Shows Its Steps, Counts People, and Names Replace All One Way

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-114, D-69, D-59, D-60, D-61, D-140, D-165, D-66; D-122 (rejected) (38.12-CONTEXT.md; ledger Q-20, Q-22b, mid-execution ruling Q3, device batch MRG); carried D-23
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

A restore can run for minutes. During it the tab bar and the + stayed usable, and the + covered the progress and error cards (todo `2026-09-30-fab-covers-restore-cards`). The restore showed no steps. Backup restored reported row totals rather than people, and its deletions line was always 0. The preview had no count of the people already on the phone. Replace had three names, and a source time ending in "Z" or with milliseconds read "Unknown time".

## Decision

Restore preview and Backup restored are focused routes, with no tab bar and no + on either page (D-114). This keeps "the + mirrors the tab bar" (ADR-173). `applyRestore` reports its steps through an `onProgress` callback, and the preview's busy state shows them: "Making a safety backup…", "Restoring contacts…" (D-69).

The preview compares "This phone: N contacts · Backup: M contacts" through a new DAO count of contacts not in the Bin, `countContactsNotInBin` (D-60). The Replace confirm states that scale, and the linked-items count covers every manifest entity. Backup restored shows people only (D-59). `applyRestore` returns `people: { before, restored, removed }`, and the old row totals are gone from the route and the page. The people count is also Phase 39 D-96's branch signal. A Replace-all result adds "N contacts moved to the Bin", only when N is non-zero, for people on the phone that the backup has in the Bin (D-140). A Merge result reads "Contacts added: N · Contacts updated: M" (D-165).

Replace has one name everywhere, "Replace all" (D-61). The mode choice uses the shared option row and sheet with the shared selection look, and Merge stays preselected (D-23). The restore source date parses UTC "Z" and millisecond timestamps (D-66).

The picked backup file's name is not shown: readable file names (ADR-244) and the preview's own date make it redundant (D-122).

## Alternatives Considered

- **Hide the tab bar and + only while applying** — rejected for the whole preview and result (Q-20 B).
- **Show the picked file's name on Restore** — rejected as redundant (D-122, Q-22b).
- **"Contacts restored: 0" on a Merge result** — the built line; replaced at the device batch (MRG).
- **"Replace all local data" / "Replace and restore"** — retired for one name (D-61).

## Consequences

### Positive

- Nothing covers a running restore, and the user sees what it is doing.
- The result says what happened to people, not rows.

### Negative

- The detailed row totals are no longer visible anywhere.

### Risks

- A phone person who is in the backup's Bin is counted neither as removed nor as restored; the D-140 line names them.

## Implementation

**Key files:**
- `src/navigation/focused-route-classification.ts` — RestorePreview and RestoreResult are focused.
- `src/backup/restore-apply.ts` — `onProgress`, `people` counts, `movedToBin`.
- `src/db/contact-read.ts` — `countContactsNotInBin`.
- `src/services/backup/backup-service.ts` — `loadBackupForRestorePreview` with the phone and backup counts.
- `src/screens/backup-restore-logic.ts` — `restoreProgressLabel`, `restorePeopleComparison`, `REPLACE_ALL_LABEL`, `RESTORE_MODE_OPTIONS`, `restoreResultPeopleLines`.
- `src/screens/RestorePreviewScreen.tsx` — steps, comparison, mode choice.
- `src/screens/RestoreResultScreen.tsx` — people lines.
- `src/components/ui/OptionSelectRow.tsx` — optional `disabled` while a restore runs.
- `src/utils/dates.ts` — `parseIsoUtcMs`, `formatSourceTimeMinuteOrFallback`.

**Depends on:** ADR-058 (Optional Encrypted Backups and Previewed Local Restoration); ADR-173 (Universal FAB Semantic Visibility, Open-Dial Containment, Non-Collapsable Shell Overlays, Border, and Bottom Clearance); ADR-241 (Import, Check, Merge and Restore Carry a Flow Host, and Settings-Started Flows Finish Back on Settings)
**Required by:** None
