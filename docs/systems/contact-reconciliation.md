# Contact Reconciliation

**Last updated:** 2026-09-03
**Updated by phase:** 24.1-contact-knowledge-foundation
**Owners:** `src/db/reconcile-apply.ts`, `src/db/reconcile-session-dao.ts`, `src/db/reconcile-session-read.ts`, `src/db/reconcile-snapshot-dao.ts`, `src/db/reconcile-relink-dao.ts`, `src/db/merge-dao.ts`, `src/logic/reconcile-diff.ts`

## Purpose

Contact reconciliation lets a person deliberately compare linked Android system contacts with Orbit's local copy without making the source authoritative. It also provides a serious local merge path for duplicate Orbit identities, preserving compatible relationship data on-device and requiring an explicit choice where meaningful values conflict.

## Architecture

### Data Model

Migration 013 keeps reconciliation state in local SQLite. It does not create a generic synchronization journal, source authority model, or cross-device conflict mechanism.

**Tables:**
- `reconciliation_sessions` — one durable user-triggered linked-contact review run.
  - `status` (`TEXT`) — `pending`, `complete`, or `discarded` session state.
  - `checked_count` (`INTEGER`) — number of linked contacts considered by the scan.
- `reconciliation_session_cards` — one changed Orbit contact's durable review state in a session.
  - `diff_json` (`TEXT`) — persisted actionable differences and their disposition.
  - `card_status` (`TEXT`) — pending, partial, resolved, or missing-source review state.
  - `staged_photo_rel_path` (`TEXT`, nullable) — safe private source-photo staging reference.
- `reconcile_source_snapshot` — the last reviewed canonical source value per active external link and field family.
  - `field_family` (`TEXT`) — name, phones, emails, birthday, or photo identity.
  - `reviewed_value` (`TEXT`, nullable) — narrow source-memory value used only to suppress an unchanged re-nag.
- `bulk_review_resolutions` — durable `fixed` or `ignored` dispositions for import rows with unreadable birthdays.
- `tombstones` — existing generic contact retirement evidence; merge writes one for its absorbed identity instead of archiving it.
- `memories`, `relationships`, and `current_state_entries` — contact-owned knowledge rows that merge reparents explicitly before retiring the absorbed identity.

**Types** (`src/logic/reconcile-diff.ts`, `src/db/merge-dao.ts`):
- `ReconcileDiffResult` — classified five-family source comparison and actionable options.
- `MergeResolutions` — typed user selections for scalar, photo, and per-method-type primary conflicts.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|-------|------|----------------|
| Diff logic | `src/logic/reconcile-diff.ts` | Classifies canonical source changes and serializes method-family source memory. |
| Apply DAO | `src/db/reconcile-apply.ts` | Applies selected reconciliation fields with stale-value protection through existing writer cores. |
| Session DAO | `src/db/reconcile-session-dao.ts` | Creates, transitions, finalizes, and discards durable review sessions and cards. |
| Session read | `src/db/reconcile-session-read.ts` | Reads resumable work, cards, and completion buckets. |
| Relink DAO | `src/db/reconcile-relink-dao.ts` | Replaces or retires only an external source link without changing Orbit data. |
| Merge DAO | `src/db/merge-dao.ts` | Performs the atomic survivor/absorbed merge and tombstone retirement. |
| Photo service | `src/services/photos/reconcile-photo.ts` | Stages source photos and promotes a chosen photo after commit. |
| Resume service | `src/services/import/reconcile-resume-sweep.ts` | Surfaces newest pending work and cleans discarded staging on foreground launch. |

### Key Files

| File | Role |
|------|------|
| `src/db/migrations/013-reconciliation-and-merge.ts` | Defines reconciliation session, snapshot, and bulk-review durable state. |
| `src/logic/reconcile-diff.ts` | Implements additive, conflict, removed, and missing-source classification. |
| `src/db/reconcile-apply.ts` | Composes safe local writes and reviewed snapshots. |
| `src/db/reconcile-session-dao.ts` | Owns session/card state transitions. |
| `src/db/reconcile-relink-dao.ts` | Implements non-destructive relink and unlink. |
| `src/db/merge-dao.ts` | Owns transactional merge order, child reparenting, and tombstoning. |
| `src/screens/ReconcileDetailScreen.tsx` | Renders per-contact review, missing-source actions, and permission-gated source reads. |
| `src/screens/ReconcileGridScreen.tsx` | Runs a Settings-launched scan and hosts durable bulk review. |

## How It Works

### Reviewing linked-contact changes

1. A user taps `Update from Contacts` on a linked profile or `Check linked contacts` in Settings; the API-37+ read requests Contacts access in context before querying the linked source records.
2. `classifyReconciliation()` compares name, methods, birthday, and photo identity against Orbit using canonical method equality. It emits additive, conflict, removed-from-source, or distinct missing-source outcomes.
3. The detail flow applies only selected values. It re-reads scalar baselines before writing, snapshots overwritten local values, and records the source value reviewed for that link and family.
4. A batch scan persists only changed contacts as cards in one session. Additive, non-photo selections can use a safe bulk source-values action; conflict and removed cases remain manually reviewed.
5. A card remains until all actionable differences resolve. Completion reports durable disposition counts; pending work survives process death and offers Resume or Discard on a later foreground launch.

### Handling a missing source

1. An unavailable linked source becomes `missing_source`, never a synthetic set of removals.
2. Keep leaves the Orbit contact untouched; Unlink retires only its active external link.
3. Relink preflights globally active source identity, retires the stale link, attaches the selected source, and runs normal reconciliation review without resetting Orbit data.

### Merging duplicate Orbit contacts

1. A user begins from profile overflow or a reconciliation duplicate path, chooses a survivor, and resolves genuine scalar, photo, and competing-primary conflicts.
2. `mergeContacts()` resolves method and active-link collisions before reparenting compatible children — including any pending `interaction_assists` — to the survivor inside one write transaction, so a later assist confirmation logs against the survivor with no survivor lookup.
3. The writer preserves field-history snapshots for overwritten or dropped meaningful values, recomputes `last_contact` through the recency core, deletes the absorbed row, and writes a generic contact tombstone.
4. It reparents knowledge rows before deletion, clears links that would become a self-link, and demotes a colliding current-state value so retained history survives.
5. The UI lands on the survivor only after the transaction succeeds; an error leaves both contacts intact.

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| Reconciled families | name, phones, emails, birthday, photo | `src/logic/reconcile-diff.ts` | Keeps source comparison narrowly scoped. |
| Bulk source-values rule | additive-only, non-photo | `src/logic/reconcile-bulk-eligibility.ts` | Prevents a bulk source overwrite of conflicts. |

## Decisions

- **ADR-003:** `READ_CONTACTS` on API 37+ for Reconcile — gates current-source reads behind an in-context permission request.
- **ADR-068:** User-Triggered, Source-Only Reconciliation with Durable Review — defines bounded one-way reconciliation and resumable review.
- **ADR-069:** Atomic Tombstone-Backed Orbit Contact Merge — defines explicit atomic consolidation and absorbed-contact retirement.
- **ADR-073:** Merge-Reparented, Purge-Cascaded Interaction Assists — extends the merge reparent loop to the pending-assist child table so redirect needs no lazy lookup.
- **ADR-089:** Recoverable Memory Lifecycle and Contact-Operation Integrity — extends merge reparenting to typed contact-knowledge rows and their collision rules.

## Gotchas

1. **Missing is not removed.** A missing source must never delete, archive, unbind, or clear Orbit data.
2. **Do not re-nag an unchanged source discrepancy.** Snapshot the canonical source value actually reviewed; a changed-again source must surface again.
3. **Stage before, promote after commit.** A failed photo promotion leaves its snapshot unwritten so the source photo remains reviewable later.
4. **Do not nest the transaction mutex.** Session and apply helpers expose non-mutexed cores for composition inside their owning transaction.
5. **Merge has no simple undo.** Never use the normal archive lifecycle for the absorbed identity; tombstoning prevents resurrection.
6. **Reconciled method additions have no v1 provenance row.** Imported methods retain stronger source attribution than reconciliation-added methods.
7. **Every contact-owned child must join the reparent loop.** The merge reparents children explicitly (not by cascade); a new child table — like `interaction_assists` in phase 21 — that is not added to `mergeContacts()` would be stranded on the absorbed identity. Do not rely on `ON DELETE CASCADE` for merge.
8. **Clear prospective relationship self-links before reparenting.** The migration-level CHECK is a backstop, not permission to let a merge fail after other choices were resolved.

## Related Systems

- **Contacts** — owns contact identity, field history, recency, and external links that reconciliation reads or consolidates.
- **Contact methods** — supplies canonical endpoint identity and primary-method semantics.
- **Photos** — supplies durable source-photo staging and post-commit mastering.
- **Contact import** — establishes the linked source records and owns the selected-contact native bridge.
- **Persistence core** — runs migration 013 and the shared transaction boundary.
- **Interaction Assist & Reach Out** — its pending assists are reparented to the survivor inside the merge transaction.
- **Contact Knowledge** — reparents Memories, relationships, and current-state history through the same atomic merge seam.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-26 | 20 | Created user-triggered durable reconciliation, safe relinking, and atomic tombstone-backed merge documentation. |
| 2026-08-31 | 21 | Extended the merge reparent loop to pending `interaction_assists` so a merged target's later confirmation logs against the survivor. |
| 2026-09-03 | 24.1 | Extended merge reparenting with typed contact-knowledge rows, self-link safety, and current-state collision preservation. |
