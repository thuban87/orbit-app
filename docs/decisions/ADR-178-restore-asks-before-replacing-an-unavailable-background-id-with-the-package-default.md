# ADR-178: Restore Asks Before Replacing an Unavailable Background Id with the Package Default

**Status:** Accepted
**Date:** 2026-09-26
**Phase:** 38.5-background-art-text-contrast
**Source decisions:** D-47, D-49 from phase CONTEXT.md (code review IN-07, re-review WR-A, scoped re-check WR-1)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None (replaces the phase's own threat mitigation T-38.5-05-03, a whole-restore abort that no ADR recorded)
**Superseded by:** None

## Context

ADR-177 retires three background slot ids and lets `assertBackgroundId` accept them on write and restore, so a retired id restores silently and renders as the package default. An id the DAO does not know at all (neither active nor retired, for example a slot added by a later version under the same backup format, D-34) still throws. As planned in 38.5-05 (T-38.5-05-03), that throw aborted the whole restore. The code review (IN-07) put that behaviour to the owner.

## Decision

- **Ask, then use the default (D-47).** When a backup holds an unavailable background id, the restore preview shows a notice and, at apply, asks: "A background selected in this backup is no longer available. Switch to the default background instead?" Merge shows its own Continue/Cancel dialog. Replace-all puts the notice inside its existing confirmation, so each path shows one dialog. Continue restores everything, with that package's background set to its default. Cancel writes nothing.
- **Only when the settings will be written (D-49, RA-a).** Replace-all always writes the backup's settings. Merge writes them only when they are strictly newer than the phone's (`app_settings.modified_at`). A Merge whose backup settings are older or the same age asks nothing, shows no notice, and leaves the phone's settings untouched.
- **One predicate decides the prompt and the write.** `restoreWritesBackupSettings` and `backgroundsNeedingConsent` in `src/backup/restore-backgrounds.ts` drive both the flow's question and `applyRestore`'s gate. Without consent, `applyRestore` returns `unavailable-background` before any snapshot, staging or write. It also re-decides consent inside its transaction from that transaction's own settings read.
- **The DAO stays strict.** The substitution happens in the restore's settings mapping, before `assertBackgroundId`. Retired ids restore unchanged and silently. A malformed value (not a bounded printable string) is a damaged file at the schema. No backup-format bump (D-34).
- **The confirmed mode applies (re-check WR-1).** The restore mode is locked from the Apply tap until the apply settles, and the apply uses the mode carried in the confirmation result, never the screen's live selection.

## Alternatives Considered

- **Abort the whole restore (T-38.5-05-03)** — the 38.5-05 behaviour. Rejected by the owner (D-47): one unknown cosmetic setting should not block restoring everything else.
- **Swap to the default silently** — Rejected: the owner asked for a warning and confirmation first.
- **Ask on every Merge that holds an unavailable id** — the first D-47 build. Rejected (D-49): when Merge skips older settings, Continue changed nothing and Cancel abandoned the merge over a setting that would never have been written.

## Consequences

### Positive

- A backup made by a newer build still restores on an older one, with the user's consent.
- The prompt and the write cannot disagree, because both call one helper.

### Negative

- The restore flow has one more dialog state, and the screen has to lock the mode while it is open.

### Risks

- A new settings key that holds a background-like id must join `BACKUP_BACKGROUND_KEYS`, or it falls back to the DAO's strict throw.

## Implementation

**Key files:**
- `src/backup/restore-backgrounds.ts` — `unavailableBackupBackgrounds`, `restoreWritesBackupSettings`, `backgroundsNeedingConsent` and `withDefaultBackgrounds`.
- `src/backup/restore-backgrounds.test.ts` — the consent and mapping tests.
- `src/backup/restore-apply.ts` — the consent gate before snapshot and staging, and the in-transaction re-check.
- `src/backup/restore-apply.test.ts` — the no-snapshot, no-staging and stale-read tests.
- `src/backup/backup-schema.ts` — bounded printable-string background values; anything else is a damaged file.
- `src/screens/RestorePreviewScreen.tsx` — the notice, the dialogs and the mode lock.
- `src/screens/backup-restore-logic.ts` — `confirmRestoreApply` and `backupNeedsBackgroundConsent`.
- `src/screens/backup-restore-logic.test.ts` — the Merge, Replace-all and mode-lock flow tests.
- `src/db/app-settings-dao.ts` — `assertBackgroundId` stays strict for every write.

**Depends on:** ADR-177 (Mode-Specific Background Art and Signed Per-Combination Art Treatments)
**Required by:** None
