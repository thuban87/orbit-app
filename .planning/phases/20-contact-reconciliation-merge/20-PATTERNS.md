# Phase 20: Contact Reconciliation & Merge - Pattern Map

**Mapped:** 2026-08-30
**Files analyzed:** 15 new/modified (5 DB DAO/migration, 2 pure logic, 1 service, 6 UI, plus reuse-wiring)
**Analogs found:** 15 / 15 (every net-new file has a strong shipped analog — this phase is composition, not new mechanism)

> Read alongside `20-RESEARCH.md` (Architectural Responsibility Map, Recommended Project Structure)
> and `20-UI-SPEC.md` (net-new component contracts). Excerpts below were pulled from the actual
> files on disk this session, not from research summaries. `TARGET_VERSION = 12` verified on disk
> (`src/db/database.ts:47`) → **Phase 20 migration is `013`**.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/migrations/013-reconciliation-and-merge.ts` | migration | schema-DDL | `src/db/migrations/012-import-sessions.ts` | exact |
| `src/db/reconcile-session-dao.ts` | DB DAO (writer) | CRUD / state-machine | `src/db/import-session-dao.ts` | exact |
| `src/db/reconcile-session-read.ts` | DB DAO (reader) | read / counts / resume | `src/db/import-session-read.ts` | exact |
| `src/db/reconcile-snapshot-dao.ts` | DB DAO (writer) | CRUD (upsert per link+field) | `src/db/import-session-dao.ts` (core-write idiom) | role-match |
| `src/db/merge-dao.ts` | DB DAO (writer) | atomic fan-out / transform | `src/db/purge-dao.ts` | exact (invert delete→reparent) |
| `src/logic/reconcile-diff.ts` | utility (pure) | transform / classify | `src/services/import/duplicate-evidence.ts` | role-match |
| `src/logic/survivor-recommendation.ts` | utility (pure) | transform / score | `src/services/import/duplicate-evidence.ts` (ladder idiom) | role-match |
| `src/services/import/reconcile-resume-sweep.ts` | service | event-driven (launch hook) | `src/services/import/contact-import-resume-sweep.ts` | exact |
| `src/components/FieldChoiceGroup.tsx` | component | request-response (selection) | `src/screens/ImportReviewScreen.tsx` choice-pair (388–420) | role-match |
| `src/components/PhotoChoice.tsx` | component | request-response (selection) | `CandidateCardGrid.tsx` photo render (162–179) + FieldChoiceGroup | role-match |
| `src/components/MergeImpactSummary.tsx` | component | read (count rows) | `src/screens/ImportCompleteScreen.tsx` `footerEntry` (141–220) | role-match |
| `src/screens/ReconcileDetailScreen.tsx` | screen | request-response | `src/screens/DuplicateReviewScreen.tsx` (header+sheet) | role-match |
| `src/screens/SurvivorSelectScreen.tsx` | screen | request-response | `src/screens/ImportReviewScreen.tsx` (choice-pair) | role-match |
| `src/screens/BulkReviewScreen.tsx` | screen | CRUD (per-item resolve) | `src/screens/ImportReviewScreen.tsx` (birthday input) | role-match |
| reuse-wiring: `CandidateCardGrid`, `ResumeImportPrompt`, `OverflowMenu`, `SettingsScreen`, `ContactProfileScreen` | components/screens | — | consumed unchanged (see Shared Patterns) | reuse |

---

## Pattern Assignments

### `src/db/merge-dao.ts` (DB DAO, atomic fan-out / transform)

**Analog:** `src/db/purge-dao.ts` — copy the transaction *structure* (one `inWriteTransaction`,
tombstone-then-mutate, assert-exactly-one-row, post-commit OS cleanup), **invert delete→reparent**.

**Imports pattern** (`purge-dao.ts:40-46`):
```typescript
import { inWriteTransaction } from "@/db/transaction";
import { insertTombstoneCore, type TombstoneEntityType } from "@/db/tombstones-dao";
import type { SqlExecutor } from "@/db/types";
import { Logger } from "@/utils/logger";
```
Merge additionally imports `recomputeLastContactCore` from `@/db/recency-dao` and
`updateContactMetadataCore` from `@/db/contacts-dao`.

**Write-boundary guard + assert-one-row** (`purge-dao.ts:209-219, 260-268`) — copy verbatim in shape:
```typescript
return inWriteTransaction(exec, async () => {
  const row = await exec.getFirstAsync<{ archived_at: string | null; uid: string }>(
    "SELECT archived_at, uid FROM contacts WHERE id = ?", [contactId]);
  if (!row || row.archived_at === null) {
    throw new Error(`purgeContact: contact id=${contactId} is not archived — refusing to purge (no rows deleted)`);
  }
  // ...
  const deleted = await exec.runAsync("DELETE FROM contacts WHERE id = ?", [contactId]);
  if (deleted.changes !== 1) {
    throw new Error(`purgeContact: expected exactly one contacts row deleted for id=${contactId} (deleted ${deleted.changes})`);
  }
});
```
For merge: read BOTH uids, assert both live (`archived_at IS NULL`), assert `survivorId !== absorbedId`;
assert exactly one `contacts` row deleted for the absorbed id.

**The exhaustive child-table fan-out list** — copy `PURGE_CHILDREN` (`purge-dao.ts:76-87`). For merge,
each child gets an `UPDATE <child> SET contact_id = ?, modified_at = ? WHERE contact_id = ?` (reparent),
NOT a DELETE. The verified child set with an FK to `contacts`:
`interactions, events, fuel, custom_field_values, contact_links, contact_methods, external_contact_links`
plus `contact_method_provenance` via `method_id → contact_methods.contact_id`. `field_history` has NO
FK and does not reparent by cascade — handle it explicitly if survivor-scalar snapshots are written.

**sun_contact_id redirect** (`purge-dao.ts:253-258`) — merge redirects instead of nulling:
```typescript
await exec.runAsync(
  `UPDATE app_settings SET sun_contact_id = ?, modified_at = ? WHERE id = 1 AND sun_contact_id = ?`,
  [survivorId, now, absorbedId]);
```

**Tombstone the absorbed identity** (`purge-dao.ts:236-240`):
```typescript
await insertTombstoneCore(exec, { entityType: "contact", entityUid: absorbedUid, deletedAt: now });
```

**Post-commit OS cleanup** (`purge-dao.ts:269-282`) — absorbed photo `unlink`, notification cancels for
`decay:<absorbedId>`, run in `.then()` after commit, best-effort try/catch, never inside the txn.

**Merge-specific ordering (from RESEARCH Pattern 1) — do BEFORE any reparent:**
1. Resolve competing primaries (both contribute `is_primary=1` for a `method_type`) — demote one.
2. Dedupe / retire duplicate active source links (both link same `(provider, external_contact_id)` with `is_active=1`).
3. THEN reparent; THEN survivor scalar resolutions; THEN `recomputeLastContactCore(exec, survivorId, now)` (LAST).

---

### `src/db/recency-dao.ts` usage (derived recompute — DO NOT re-implement)

**Analog / rule:** `recomputeLastContactCore` (`recency-dao.ts:159-176`, exported alias at `:427`) is
**THE ONLY** writer of `contacts.last_contact` (DATA-04). Merge must NOT write `last_contact` directly.
It is a non-mutexed CORE — call it only inside the already-open merge `inWriteTransaction` (never bare,
never nested — a nested `inWriteTransaction` permanently hangs on the shared mutex):
```typescript
// recency-dao.ts:164-175 — MAX over CURRENT rows, connected-only for rarely_responds. Idempotent.
await exec.runAsync(
  `UPDATE contacts SET last_contact = (
       SELECT MAX(i.occurred_at) FROM interactions i
        WHERE i.contact_id = contacts.id AND (contacts.rarely_responds = 0 OR i.connected = 1)),
       modified_at = ? WHERE id = ?`, [now, contactId]);
```
Call `recomputeLastContactCore(exec, survivorId, now)` AFTER interactions are reparented onto the survivor.
gravity / intensity / status are query-time derived (not materialized) — nothing to recompute.

---

### `src/db/reconcile-session-dao.ts` (DB DAO writer, state-machine)

**Analog:** `src/db/import-session-dao.ts` — copy the **core-vs-wrapper duality** and `assertOneChange`.

**Core/wrapper idiom** (`import-session-dao.ts:172-198`): each mutation ships a non-mutexed `*Core`
(callable inside a caller-owned txn) and a thin `inWriteTransaction` wrapper:
```typescript
export async function markRowStatusCore(exec, rowId, status, failureReason, now) {
  const result = await exec.runAsync(
    `UPDATE import_session_rows SET row_status = ?, failure_reason = ?, modified_at = ? WHERE id = ?`,
    [status, failureReason, now, rowId]);
  assertOneChange(result, "markRowStatusCore", rowId);
}
export function markRowStatus(exec, rowId, status, failureReason, now) {
  return inWriteTransaction(exec, () => markRowStatusCore(exec, rowId, status, failureReason, now));
}
```
**`assertOneChange`** (`import-session-dao.ts:109-119`) — copy verbatim.

**Terminal-completion / discard idiom** (`import-session-dao.ts:404-455`) — `finalizeSessionIfTerminal`
(complete when zero unresolved rows) and `discardSession` (mark `discarded`, delete unresolved rows,
return staged paths for post-commit cleanup) map directly onto reconcile session close/discard.

**Card status state-machine:** mirror the `row_status` CHECK. RESEARCH Pattern 2 proposes
`card_status IN ('unresolved','partial','resolved','missing_source')`.

---

### `src/db/reconcile-session-read.ts` (DB DAO reader, resume)

**Analog:** `src/db/import-session-read.ts`.

**Resume-newest / sweep-older** (`import-session-read.ts:109-127`) — copy exactly:
```typescript
export async function getResumableSession(exec, now) {
  const pending = await exec.getAllAsync(
    `SELECT ... FROM import_sessions WHERE status = 'pending' ORDER BY created_at DESC, id DESC`);
  const newest = pending[0];
  if (!newest) return null;
  const sweptPhotoRelPaths: string[] = [];
  for (const stale of pending.slice(1)) sweptPhotoRelPaths.push(...(await discardSession(exec, stale.id, now)));
  return { session: mapSession(newest), sweptPhotoRelPaths };
}
```
**Grouped count queries** (`import-session-read.ts:188-210, 226-281`) — model `sessionRowCounts` /
`sessionSummaryCounts` for the completion-summary buckets (`Checked / Changed / Updated / Kept Orbit / Source missing`).
`db-row → domain` mapper idiom (`mapSession`, `:54-67`) — copy for the reconcile row shape.

---

### `src/db/reconcile-snapshot-dao.ts` (DB DAO writer — narrow last-reviewed memory)

**Analog:** the `*Core` write idiom from `import-session-dao.ts`; the canonical-value concept from
`contact-methods-dao.ts`. One durable row per `(external_contact_link_id, field_family)` (RESEARCH
Pattern 3). Compare **canonical normalized identity** for phones/emails — reuse
`normalizeContactMethod` (`contact-methods-dao.ts:5-8`, `canonical_value`) so `(312) 555-1234` ==
`312-555-1234`; **label changes ARE meaningful** and must be part of the compared value.

---

### `src/logic/reconcile-diff.ts` (pure utility, classify)

**Analog:** `src/services/import/duplicate-evidence.ts` — the pure, Node-testable classify-with-a-tunable-
ladder idiom. Copy the shape: exported union types for signals/outcomes/recommendations, tunable
constants at top, no I/O.
```typescript
// duplicate-evidence.ts:5-32 — the idiom to mirror
export type DuplicateEvidenceSignal = "phoneMatch" | "emailMatch" | "nameOverlap" | "birthdayMatch";
export type DuplicateOutcome = "already_linked" | "probable" | "possible" | "new" | "needs_review";
export const PHONE_MATCH_WEIGHT = 80; // ... tunable constants at file top per CLAUDE.md
```
For reconcile-diff the per-field classification is `additive | conflict | removed-from-source |
missing-source | unchanged-since-review`, over field families `{name, phones, emails, birthday, photo}`.
Source shape is `PickedContact` (`modules/orbit-contact-picker/index.ts:14-25`). Missing/omitted source
(`omittedCount > 0` or contact absent from `readAllContacts`) is a **distinct card state**, never five
field-removals (Pitfall 3). Photo has no stable fingerprint — side-by-side manual choice is primary (Pitfall 5).

---

### `src/logic/survivor-recommendation.ts` (pure utility, score)

**Analog:** `duplicate-evidence.ts` ladder idiom (tunable weights, pure function). Advisory-only continuity
signals (older `created_at`, more interactions, stronger linkage, more complete data); output must be
overridable in the UI. Colourless `Recommended` badge per UI-SPEC.

---

### `src/services/import/reconcile-resume-sweep.ts` (service, launch hook)

**Analog:** `src/services/import/contact-import-resume-sweep.ts` — copy the registration shape verbatim.

**Launch-hook registration** (`contact-import-resume-sweep.ts:116-147`):
```typescript
export function registerImportResumeSweep(onResumable, { getExecutor, fs, now } = {}) {
  registerSweepHook(async () => {
    const exec = getExec();
    try {
      const resumable = await getResumableSession(exec, now());
      if (resumable) { cleanupDiscardedStagedPhotos(fs, resumable.sweptPhotoRelPaths); /* describe */ }
    } catch (error) { Logger.error(LOG_SCOPE, "...", error); }
    finally { /* reconcile orphan staged; */ onResumable(description); }
  });
}
```
Importing the module does no work; `App.tsx` registers after migration readiness. "Nothing watches a
timestamp" — resume is offered on foreground launch via `registerSweepHook`, never a timer.

---

### `src/components/FieldChoiceGroup.tsx` (component — net-new, UI-SPEC #5)

**Analog:** the create/import Bound-Unbound choice-pair fill idiom, `src/screens/ImportReviewScreen.tsx`
(388–420): selected option = `accent` fill + `borderStrong` outline + accent check. Single-select radio
semantics; each option row `≥44px`, radius 10, `surface` bg, `border`; value `15px/400 textPrimary` +
provenance label `13px/400 textSecondary`. Recommendation marker = colourless `surfaceElevated` chip.
Returns the user's selection to the screen — **performs no DB writes**. See UI-SPEC "Reusable widget
contract" for preselection rules (additive preselect source; conflict no-preselect; removed preselect Orbit,
`Remove` is `danger`-labelled and never recommended).

### `src/components/PhotoChoice.tsx` (component — net-new, UI-SPEC #6)

**Analog:** `CandidateCardGrid.tsx` photo render (162–179) + `ImportReviewScreen.tsx` (352–361). Photo is a
**pre-resolved `file://` URI** to `expo-image`'s `Image` with `onError` fall-through to
`Avatar photo={null}` — never a raw/staged path to `Avatar` (it throws synchronously; Phase-19 regression
guard). Same selected-outline idiom as FieldChoiceGroup; explicit `No meaningful change — keep Orbit photo` option.

### `src/components/MergeImpactSummary.tsx` (component — net-new, UI-SPEC #13)

**Analog:** `src/screens/ImportCompleteScreen.tsx` `footerEntry` count-row idiom (141–220, 316–324).
Count rows `{n} interactions / fuel items / events / contact methods / external links`. `danger` warning
block (`15px/600`): `{absorbed} will be retired.` / `This can't be simply undone.` Confirm button is
**accent** (OWNER-LOCKED 2026-08-30), NOT danger; native `Alert.alert({ style: "destructive" })` final guard.

### `src/screens/ReconcileDetailScreen.tsx` / `SurvivorSelectScreen.tsx` / `BulkReviewScreen.tsx`

**Analogs:** header (Back + `24px/600` title) from `DuplicateReviewScreen.tsx` (221–234); modal
action-sheet-over-scrim from `DuplicateReviewScreen.tsx` (262–301) / `OverflowMenu.tsx`; birthday input +
`normalizeEditedBirthday` + invalid-date error from `ImportReviewScreen.tsx` (170–182, 487–515) for
BulkReviewScreen. Compose `FieldChoiceGroup` / `PhotoChoice` rows. Apply reconcile selections through
existing writers (`updateContactMetadataCore`, `applyContactMethodDiffCore`) in one `inWriteTransaction`.

---

## Shared Patterns

### Atomic write transaction + assert-one-row
**Source:** `src/db/purge-dao.ts:204-283`, `src/db/transaction.ts` (`inWriteTransaction`).
**Apply to:** `merge-dao.ts` and every `*-session-dao.ts` core writer.
- One shared non-reentrant mutex; NEVER expo `withTransactionAsync`.
- `*Core` (non-mutexed, caller-owned txn) + thin wrapper duality (`import-session-dao.ts:172-198`).
- Every multi-table mutation asserts `result.changes === 1` and throws → rollback on mismatch.
- All values `?`-bound; table names are literals in constant SQL — no identifier interpolation (ASVS V5).

### Tombstone-based retirement (resurrection-proof)
**Source:** `src/db/tombstones-dao.ts:53-67`, `src/backup/reconciliation.ts:151-155`.
**Apply to:** `merge-dao.ts` (absorbed contact as `entity_type='contact'`).
```typescript
// compareRowAndTombstone: a merged-away contact beats any older incoming row on future sync/restore.
return row.modified_at > tombstone.deleted_at ? "row" : "tombstone";
```
Do NOT archive the absorbed contact and do NOT route through `archiveContact`/`restoreContact`/`listArchived`
(`contacts-dao.ts:514-596`) — retirement is a tombstone, not the reversible `archived_at` flag.

### Durable resumable session
**Source:** `src/db/migrations/012-import-sessions.ts:13-54`, `import-session-read.ts:109-127`,
`contact-import-resume-sweep.ts:116-147`.
**Apply to:** `reconcile-session-*` + `reconcile-resume-sweep.ts`.
- New tables mirror the 012 idiom: `id`/`uid UNIQUE`, `status` CHECK, `created_at`/`modified_at`,
  child `ON DELETE CASCADE`, `UNIQUE(session_id, contact_id)`, status index.
- Resume newest pending, discard older, cleanup staged files post-commit.

### Migration authoring
**Source:** `src/db/migrations/012-import-sessions.ts` (whole file); registration at
`src/db/database.ts:47,139`.
**Apply to:** `013-reconciliation-and-merge.ts`.
- `export const migration013: Migration = { version: 13, async apply(exec, _deps) { await exec.execAsync(\`...DDL...\`); } }`.
- Register in `MIGRATIONS` and bump `TARGET_VERSION` to `13`. Forward-only, irreversible on-device — never edit a shipped migration.
- **Partial unique indexes are the merge hazard** (`migration 011:178-180`):
  `idx_contact_methods_primary_type UNIQUE(contact_id, method_type) WHERE is_primary=1` and
  `idx_external_contact_links_active UNIQUE(provider, external_contact_id) WHERE is_active=1` — both
  `RAISE(ABORT)` on a naive reparent. Also `contacts_prevent_cadence_clear` trigger (`011:181-187`)
  ABORTs any `interval_days` → NULL — merge/reconcile must not clear assigned cadence.

### Reuse the shipped review UI (do not fork)
**Source:** `src/components/CandidateCardGrid.tsx`, `ResumeImportPrompt.tsx`, `OverflowMenu.tsx`.
**Apply to:** reconciliation grid + resume prompt + entry points.
- `CandidateCardGrid` reused unchanged: `onInspect`, `onBulkAction`, `bulkActions`,
  `recommendationExcludes: "needs_review"` (the locked safety seam — `apply-recommendation` filters out
  `needs_review` items, `CandidateCardGrid.tsx:95-102`), `scoring` state, per-card `failedIds` isolation.
- `Use Contact Values` bulk action passed into `bulkActions` ONLY when every selected card is additive-only
  (Cluster J safety invariant, not styling).
- Recommendation chips are colourless `surfaceElevated` + `textSecondary` (no caution hue — owner-locked).

### Apply reconcile selections through EXISTING writers only
**Source:** `src/db/contacts-dao.ts:308-335` (`updateContactMetadataCore`),
`src/db/contact-methods-dao.ts:99-287` (`applyContactMethodDiffCore`).
**Apply to:** the reconcile "Apply" path and merge scalar resolutions.
- Never introduce a new write path for name/birthday/category/methods. `updateContactMetadataCore` asserts
  one row; `applyContactMethodDiffCore` handles canonical dedupe + primary demotion + partial-unique ordering.
- On a survivor scalar overwrite during merge, snapshot the old value into `field_history` inside the same
  txn (CLAUDE.md destructive-op rule; Pitfall 6). Reparented child rows move, not destroy — no per-row snapshot.

---

## No Analog Found

None. Every net-new file has a strong shipped analog; Phase 20 is composition of existing mechanism plus
one migration. Two genuinely open *design* decisions (not missing analogs) remain for the planner/owner,
per RESEARCH Assumptions A2/A3:
- **Absorbed→survivor redirect table** in migration 013 (future-sync reference rewriting) — owner call.
- **Source-photo content-hash fingerprint** — no fingerprint exists today; manual side-by-side is primary.

---

## Metadata

**Analog search scope:** `src/db/`, `src/db/migrations/`, `src/logic/`, `src/services/import/`,
`src/components/`, `src/screens/`, `src/backup/`, `modules/orbit-contact-picker/`.
**Files opened in full or targeted this session:** `purge-dao.ts`, `recency-dao.ts`,
`import-session-dao.ts`, `import-session-read.ts`, `tombstones-dao.ts`, `contact-methods-dao.ts`,
`contact-methods-editor-model.ts` (signatures), `contacts-dao.ts` (updateContactMetadataCore + archive),
`migrations/012-import-sessions.ts`, `migrations/011-contact-lifecycle-schema.ts` (indexes/trigger),
`contact-import-resume-sweep.ts`, `backup/reconciliation.ts`, `CandidateCardGrid.tsx`,
`orbit-contact-picker/index.ts`, `duplicate-evidence.ts`, `source-consolidation.ts` (signatures),
`ResumeImportPrompt.tsx`/`ImportCompleteScreen.tsx` (signatures). `TARGET_VERSION=12` verified on disk.
**Pattern extraction date:** 2026-08-30
</content>
</invoke>
