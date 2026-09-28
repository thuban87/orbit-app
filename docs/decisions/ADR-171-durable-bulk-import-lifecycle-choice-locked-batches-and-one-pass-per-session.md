# ADR-171: Durable Bulk-Import Lifecycle Choice, Locked Batches, and One Pass per Session

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.4-audit-remediation-ui-performance-release
**Source decisions:** 38.4-CONTEXT D-53, D-57, D-58, D-64, D-73(c), D-74; OA-E2; review A WR-01/WR-02, C CR-01, C WR-03
**Reversibility:** costly
**Migration:** 032
**Supersedes:** ADR-066 (partial: bulk "only a batch category override" and the Import Complete bridge to Unbound contacts)
**Superseded by:** None

## Context

Bulk import could create only Unbound contacts, so binding a batch meant editing each contact afterwards. The create seam also forced `trackingEnabled: false, intervalDays: null` for every import, silently dropping the Bound choice and cadence made on the single-contact review. That violated ADR-066 and the Phase 19 Cluster D `[DECIDED]` rule. A Bound batch would also make Import Complete's "View Unbound contacts" bridge misleading. Review and device testing found further problems:
- An invalid custom frequency did not block Import.
- A focus reload overwrote unsaved choices.
- Combine or a partial pass could produce a mixed-lifecycle batch.
- A Back during a running pass let Continue start a second pass over the same rows.

## Decision

Bulk setup offers an "Orbit participation" choice beside the batch category, defaulting to Unbound. Bound reveals a batch frequency (`FrequencyPicker`, starting at Monthly) and a blurb saying that binding creates reminders for every imported contact.

The durable session is the only source of the batch lifecycle. `setSessionBatchDefaults` persists category, `batch_tracking_enabled` and the new nullable positive `batch_interval_days` (migration 032) in one write before any contact is created. Every bulk create reads `sessionBatchLifecycle`, including resume, Combine and Duplicate Review's "Import as new".

Lifecycle is a required, validated parameter of the canonical create seam (`importContactRecord`, `importRowAsNew`, `combineCluster`) under ADR-062's rules. The single review now passes its reviewed choice through. After a Bound pass, `applyBoundImportEffects` reconciles the notification schedule and refreshes the widget; its failures are logged only.

Guards on the batch:
- An invalid Bound frequency blocks Import on both screens.
- A batch's lifecycle and cadence lock once any row leaves `pending`; the DAO throws `ImportBatchLifecycleLockedError`, and a category-only change still saves (D-64).
- A stopped batch's setup shows only "This import stopped partway — N contacts left" with Continue / Discard (D-73c).
- An in-memory run guard (`withImportRun`) allows one pass per session. Import Progress blocks removal while it drives or follows a pass, and setup holds Back while its Import or Combine is starting (D-74).

Import Complete's "View Unbound contacts" action is removed (D-58). Unbound contacts stay reachable from the Contacts overflow menu. Single review stays mandatory before single-contact creation, and `import_sessions` stays local-only, so the backup format is unchanged.

## Alternatives Considered

- **Keep bulk import Unbound-only (ADR-066)** — rejected by the owner (D-57); the Unbound default is kept instead.
- **Keep the Unbound bridge on Import Complete** — rejected (D-58); it would not list a Bound batch. It may return in another form.
- **Allow per-pass lifecycle changes in a batch** — rejected (D-64); it produces mixed batches.
- **Explain the lock on a stopped batch's setup** — superseded by D-73c; the choices were already applied, so only a plain stopped message is shown.

## Consequences

### Positive

- Batches can be bound at import with a real cadence, and the reviewed single-import choice is honoured.

### Negative

- Setup and Import Progress carry more state: edited-choice tracking, lock state, run following and Back interception.

### Risks

- The run guard is in-memory. It prevents concurrent passes in one process, not across a process death, where resume takes over.
- Back does not stop a running pass; it is only blocked while the pass continues.
- The single review lists Bound before Unbound, the reverse of bulk. This was flagged in review and never ruled on.

## Implementation

**Key files:**
- `src/db/migrations/032-import-batch-cadence.ts` — adds `import_sessions.batch_interval_days`.
- `src/db/database.ts` — schema head 32.
- `src/db/import-session-dao.ts` — `setSessionBatchDefaults` and the lifecycle lock.
- `src/db/import-session-read.ts` — `sessionBatchLifecycle`.
- `src/db/imported-contact-dao.ts` — required, validated import lifecycle on the create seam.
- `src/services/import/import-driver.ts` — bulk pass reads the session lifecycle under the run guard.
- `src/services/import/import-acquire.ts` — lifecycle threading on acquisition.
- `src/services/import/source-consolidation.ts` — Combine uses the session lifecycle.
- `src/services/import/import-lifecycle-effects.ts` — post-commit schedule and widget refresh for Bound imports.
- `src/services/import/import-run-guard.ts` — one pass per session.
- `src/screens/bulk-import-setup-logic.ts` — lifecycle choice, lock and stopped-batch presentation.
- `src/screens/BulkImportSetupScreen.tsx` — participation choice, frequency, stopped state and busy Back hold.
- `src/screens/ImportReviewScreen.tsx` — single-review lifecycle passed to the seam; validity gate.
- `src/screens/ImportProgressScreen.tsx` — blocks removal while a pass runs.
- `src/screens/import-progress-state.ts` — follows an in-flight pass.
- `src/screens/use-import-leave-guard.ts` — completion marking and `isBusy` hold.
- `src/screens/ImportCompleteScreen.tsx` — Unbound bridge removed.
- `src/screens/DuplicateReviewScreen.tsx` — "Import as new" uses the session lifecycle.
- `src/services/import/import-lifecycle-contract.test.ts` — lifecycle contract.
- `src/screens/bulk-import-stopped-contract.test.ts` — stopped-batch contract.
- `src/screens/import-progress-back-contract.test.ts` — Back-during-pass contract.

**Depends on:** ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment); ADR-065 (Durable Resumable Contact-Import Sessions with Failure-Isolated Photos); ADR-066 (Deliberate Reviewed Import with Unbound Bulk Defaults)
**Required by:** None
