# Phase 16: Custom Field Value Normalization - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the shipped dynamic-column custom-value store with a normalized, row-based
model in forward-only migration 006. Preserve every existing custom-field value and
the established custom-field experience—seven parsers, TEXT storage, type-change
preflight, quarantine/restore/expiry, history, custom-photo values, visibility,
forms, profile reads, sorting, and filtering—while giving definitions and values
stable identities for later backup and sync work.

This phase changes no backup behavior, implements no sync, and intentionally makes
no field-display/UI redesign.

</domain>

<decisions>
## Implementation Decisions

### Normalized value records
- **D-01:** Create one durable normalized value record for every live contact-and-field pair, including blank values. Clearing a value updates that same record to blank; it never deletes the record. — **Reversibility:** one-way — migration 006 establishes the persisted representation that Phase 17 backup/restore and later sync must consume.
- **D-02:** Every value record has its own generated, immutable globally unique `uid`, in addition to its local numeric ID. Definitions retain their existing stable `uid`s. — **Reversibility:** one-way — portable row identity is Phase 16's prerequisite for Phase 17 reconciliation and the later sync milestone.
- **D-03:** The database, not application convention alone, enforces exactly one current value record per contact-and-field pair. Value records remain the current-state store; `field_history` remains the separate temporary audit trail. — **Reversibility:** costly — every custom-field DAO and read surface will rely on this invariant.
- **D-04:** When a field is permanently deleted after quarantine expiry, snapshot its values to `field_history` and remove the definition plus dependent value records in one transaction. Keep the existing fixed 30-day foreground-launch sweep that prunes history. Quarantine itself remains non-destructive.

### Migration 006 and safety proof
- **D-05:** Migration 006 is one all-or-nothing conversion: copy and validate every legacy dynamic value (including custom photos), then retire the dynamic store and run normalized-only code. There is no temporary dual-read/dual-write mode and no future custom-field operation may rely on `ALTER TABLE` / `DROP COLUMN`. — **Reversibility:** one-way — migrations are forward-only on unreachable user databases.
- **D-06:** If an unexpected legacy inconsistency is found, fail closed: abort the transaction, keep the old database unchanged, and surface a clear upgrade failure rather than skipping data or inventing field definitions.
  - **D-06b (owner resolution, cycle-2 review):** Extend the D-06a copy honesty fix beyond the classified custom-field migration branch to the **app-wide generic bootstrap error** copy (`App.tsx` generic branch ~211-213 and the corresponding `16-UI-SPEC.md` "preserve verbatim" row). Drop the "contact support" promise there as well — the project has no support channel to honor for any deterministic startup failure. This is a deliberate, owner-authorized slight widening of Phase 16 scope beyond custom-fields. Keep the "Your data is safe and unchanged" reassurance where accurate; only remove the false support-channel promise. — **Reversibility:** reversible (user-facing copy).
  - **D-06a (owner resolution, cycle-1 review):** Distinguish two classes of inconsistency. **Loss-bearing** (a definition whose backing value column is missing — real data cannot be preserved): **fail closed, unchanged.** **Non-loss-bearing** (an orphan dynamic value column with no matching definition — nothing to lose): do **not** brick; snapshot the orphan column's data to `field_history` and drop it inside the same transaction, then **proceed**. This refines D-06, it does not reverse it — the strict fail-closed path stays exactly as-is for any case that would lose data. The classified migration-failure UI copy must also be corrected: it must name the state honestly for a deterministic permanent failure and must not promise a support/recovery channel the project cannot keep (revise `16-UI-SPEC.md` classified migration-failure body). — **Reversibility:** one-way — the snapshot-and-proceed path writes to `field_history` and advances `user_version`.
- **D-07:** Prove migration safety with a rich automated before-to-after fixture covering every field type, blank and populated values, custom-photo paths, retype, quarantine, expiry, permanent deletion, and existing populated profiles. Also perform a final physical-device upgrade check against populated test-profile data.
- **D-08:** A successful upgrade is silent and seamless. The app opens into the unchanged custom-fields experience; only a safety failure is surfaced to the user.

### Legacy metadata and audit history
- **D-09:** Retain `custom_field_defs.col_name` as an immutable internal compatibility key, but it must never again be used as a dynamic SQL column identifier. A label rename still changes only the visible label. — **Reversibility:** costly — history and existing compatibility paths preserve this stable key.
- **D-10:** Preserve existing `field_history.field_col_name` entries and continue writing that key for new snapshots. `field_history` remains a transient local audit/recovery record, pruned after 30 days and excluded from backup/sync; do not add a definition-uid migration for it.

### Query behavior and scope boundary
- **D-11:** Recreate the existing user-visible custom-field sort/filter semantics exactly from normalized rows. Preserve raw-TEXT behavior for unusual legacy values; do not rewrite values during migration and do not duplicate all parsers inside SQL. — **Reversibility:** costly — preserves the established TEXT-forever/type-change contract across all read surfaces.
- **D-12:** Do not use this phase to improve field displays or UX. A broad redesign of custom and built-in field presentation belongs to the next UI/UX milestone; Phase 16's job is behavioral preservation and data safety.

### the agent's Discretion
- Exact normalized table and index names, query shapes, DAO signatures, and migration mechanics, provided they implement every decision above; use parameter binding for runtime values and never interpolate a user-provided identifier.
- The precise test-fixture construction and the user-facing wording for the exceptional migration-failure state.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and future boundaries
- `.planning/ROADMAP.md` §"Phase 16: Custom Field Value Normalization" and cross-phase constraints — source of CFN success criteria, migration 006, and the rule that the dynamic-column design is superseded.
- `.planning/REQUIREMENTS.md` §"Custom Field Value Normalization (CFN)" — locked CFN-01 through CFN-04 acceptance requirements.
- `.planning/phases/17-backup-export-restore/17-CONTEXT.md` §"Planned prerequisite and numbering" — why normalized rows precede backup; do not pre-decide Phase 17 backup/sync conflict policy.
- `.planning/sync-milestone/PHASE-17-SYNC-READINESS.md` — Phase 16/17 ordering, portable identity, and tombstone/reconciliation boundary.
- `.planning/sync-milestone/SYNC-MILESTONE-INVESTIGATION.md` §§A.5, B.6, 6 — normalized rows remove replicated DDL risk; future multi-device custom-field conflict semantics remain explicitly open.

### Existing custom-fields contract
- `HANDOFF.md` §14 — authoritative v1 custom-field behavior to preserve. Its dynamic-column storage model is superseded only where `.planning/ROADMAP.md` says Phase 16 replaces it.
- `docs/dossier/02-fields.md` — domain hand-off and cross-domain custom-field constraints.
- `CLAUDE.md` §§"SQLite migrations" and "Custom fields — invariants" — forward-only migration discipline and the data-safety rules that remain applicable after normalization.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/db/migrations/runner.ts` — each migration already runs in its own explicit transaction and atomically bumps `PRAGMA user_version`; migration 006 must use this contract.
- `src/db/field-parsers.ts`, `src/db/field-type-change.ts`, and `src/db/field-sort.ts` — the seven parser/read-time type-change and single-sort-expression behavior to preserve without rewriting stored text.
- `src/db/field-defs-dao.ts` — established definition metadata, curation, quarantine/restore, reorder, and `share_with_ai` DAO patterns.
- `src/services/field-sweep.ts` — fixed 30-day quarantine/history launch sweep, including its non-reentrant transaction and restore-race safeguards.
- `src/components/field-widgets/` and `src/components/field-def-form-logic.ts` — current field-widget and photo presentation behavior that the new data source must continue feeding.

### Established Patterns
- `src/db/field-values-dao.ts` currently owns dynamic reads/writes and pure visibility selectors; replace its dynamic-column access with normalized row queries while preserving those selectors' results.
- `src/db/field-ddl.ts` currently couples definition changes to `ALTER TABLE` / `DROP COLUMN`; replace that role with row operations while retaining same-transaction history snapshots and shared write serialization.
- `src/db/migrations/001-initial.ts` shows the shipped legacy shape: one custom-value row per contact, a row-level uid, and dynamic TEXT columns. Never edit it; migration 006 upgrades it.
- Database logic is node-testable through `SqlExecutor`; database writes use the shared transaction/mutex boundary. Runtime SQL values use `?` binding, never string interpolation.

### Integration Points
- Contact create/edit/profile flows load `listDefs` plus `field-values-dao` placement/value projections; normalized DAO replacements must keep their public behavior usable by `CreateContactScreen`, `EditContactScreen`, and contact-profile paths.
- `src/screens/CustomFieldsScreen.tsx` drives creation, retype, options changes, curation, quarantine, restore, and delete; every action must be moved off custom DDL without changing its user-facing flow.
- AI prompt-context reads use the live `share_with_ai` custom-field projection; normalized reads must preserve its privacy and visibility exclusions.
- `src/services/field-sweep.ts` and the launch-sweep registry must call normalized permanent-delete cleanup after migration.

</code_context>

<specifics>
## Specific Ideas

- Explain migration failures plainly because the owner is newer to app/database management, but do not ask for confirmation or show a success banner when the conversion is safe.
- Treat a blank value as real current state, not as an absent/deleted value: this is what makes a user clearing a field intelligible to later backup/sync work.
- Preserve the existing 30-day history retention: snapshots are a bounded local recovery trail, not indefinitely growing backup data.

</specifics>

<deferred>
## Deferred Ideas

- **Custom and built-in field display/UX redesign** — the owner considers the present displays poor, but it is too large for this data-model migration. Address it in the next UI/UX milestone after Phase 16 preserves behavior on the safe normalized store.
- **Multi-device custom-field conflict policy** — whole-row vs field-level behavior around concurrent edits/retypes/deletions remains a v2 sync-milestone decision after its version-skew and conflict spikes; do not decide it here.

</deferred>

---

*Phase: 16-custom-field-value-normalization*
*Context gathered: 2026-08-24*
