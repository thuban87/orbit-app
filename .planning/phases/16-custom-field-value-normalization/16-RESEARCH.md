# Phase 16: Custom Field Value Normalization - Research

**Researched:** 2026-08-24
**Domain:** Forward-only SQLite schema migration and custom-field data-access normalization
**Confidence:** HIGH for existing behavior and integration seams; MEDIUM for the exact new table/SQL shape, which is delegated to planning.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Create one durable normalized value record for every live contact-and-field pair, including blank values. Clearing a value updates that same record to blank; it never deletes the record.
- **D-02:** Every value record has its own generated, immutable globally unique `uid`, in addition to its local numeric ID. Definitions retain their existing stable `uid`s.
- **D-03:** The database, not application convention alone, enforces exactly one current value record per contact-and-field pair. Value records remain the current-state store; `field_history` remains the separate temporary audit trail.
- **D-04:** When a field is permanently deleted after quarantine expiry, snapshot its values to `field_history` and remove the definition plus dependent value records in one transaction. Keep the existing fixed 30-day foreground-launch sweep that prunes history. Quarantine itself remains non-destructive.
- **D-05:** Migration 006 is one all-or-nothing conversion: copy and validate every legacy dynamic value (including custom photos), then retire the dynamic store and run normalized-only code. There is no temporary dual-read/dual-write mode and no future custom-field operation may rely on `ALTER TABLE` / `DROP COLUMN`.
- **D-06:** If an unexpected legacy inconsistency is found, fail closed: abort the transaction, keep the old database unchanged, and surface a clear upgrade failure rather than skipping data or inventing field definitions.
- **D-07:** Prove migration safety with a rich automated before-to-after fixture covering every field type, blank and populated values, custom-photo paths, retype, quarantine, expiry, permanent deletion, and existing populated profiles. Also perform a final physical-device upgrade check against populated test-profile data.
- **D-08:** A successful upgrade is silent and seamless. The app opens into the unchanged custom-fields experience; only a safety failure is surfaced to the user.
- **D-09:** Retain `custom_field_defs.col_name` as an immutable internal compatibility key, but it must never again be used as a dynamic SQL column identifier. A label rename still changes only the visible label.
- **D-10:** Preserve existing `field_history.field_col_name` entries and continue writing that key for new snapshots. `field_history` remains a transient local audit/recovery record, pruned after 30 days and excluded from backup/sync; do not add a definition-uid migration for it.
- **D-11:** Recreate the existing user-visible custom-field sort/filter semantics exactly from normalized rows. Preserve raw-TEXT behavior for unusual legacy values; do not rewrite values during migration and do not duplicate all parsers inside SQL.
- **D-12:** Do not use this phase to improve field displays or UX. A broad redesign of custom and built-in field presentation belongs to the next UI/UX milestone; Phase 16's job is behavioral preservation and data safety.

### the agent's Discretion

- Exact normalized table and index names, query shapes, DAO signatures, and migration mechanics, provided they implement every decision above; use parameter binding for runtime values and never interpolate a user-provided identifier.
- The precise test-fixture construction and the user-facing wording for the exceptional migration-failure state.

### Deferred Ideas (OUT OF SCOPE)

- **Custom and built-in field display/UX redesign** — the owner considers the present displays poor, but it is too large for this data-model migration. Address it in the next UI/UX milestone after Phase 16 preserves behavior on the safe normalized store.
- **Multi-device custom-field conflict policy** — whole-row vs field-level behavior around concurrent edits/retypes/deletions remains a v2 sync-milestone decision after its version-skew and conflict spikes; do not decide it here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CFN-01 | Migration 006 replaces dynamic columns with normalized value rows, preserves every value including custom photos, and gives definitions/values stable `uid`s. | Migration proof protocol, normalized table recommendation, and identity rules below. |
| CFN-02 | Existing create/edit/retype/quarantine/restore/permanent-delete/view behavior stays intact without custom-field DDL. | DAO seam map, lifecycle replacement, parser/history invariants. |
| CFN-03 | Reads, sorts, and filters retain user-visible results without interpolating a user identifier. | Static row-query shape and sort-expression migration. |
| CFN-04 | Tests prove populated-profile migration and lifecycle behavior, including retype/quarantine expiry/custom photos. | Before-to-after fixture matrix and device upgrade gate. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Local commits are permitted; use the configured Git identity.
- Do not add AI attribution trailers to commits.
- Do not push, create a PR, or perform another GitHub write without the owner's explicit current-conversation authorization.

## Summary

The shipped model stores one row per contact in `contact_custom_values`, then adds one dynamic `TEXT` column for each definition. The row contains `contact_id`, `uid`, and `modified_at`; definitions contain stable `uid` and `col_name`; `field_history` keeps `field_col_name` snapshots. [VERIFIED: src/db/migrations/001-initial.ts:127-163] This shape is now the only reason field creation/deletion needs dynamic SQL and DDL.

Phase 16 should replace that table with a normalized child table (recommended name: `custom_field_values`) with local `id`, immutable `uid`, `contact_id`, `field_def_id`, raw `TEXT` `value`, and row timestamps. Enforce `UNIQUE(contact_id, field_def_id)` in the table definition, not only in DAO code. [CITED: https://www.sqlite.org/lang_createtable.html] Keep the public UI-facing value map keyed by the definition's unchanged `col_name`; it remains a compatibility and filename/history key, not a SQL identifier.

**Primary recommendation:** Make migration 006 first validate the exact legacy table/definition correspondence, then create and populate one value row for every existing contact × definition pair, validate counts and byte-preserved values, drop the legacy dynamic table, and only then let rewritten DAOs run. The existing migration runner already makes all statements in a numbered migration one atomic `BEGIN`/`COMMIT` unit with rollback on an error. [VERIFIED: src/db/migrations/runner.ts:43-68]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Legacy-to-row conversion | Database / Storage | API / Backend | The migration creates, validates, and retires persisted representation atomically. |
| Field definition metadata and stable compatibility key | Database / Storage | API / Backend | Definitions already own `uid`, `col_name`, curation, quarantine, and display metadata. [VERIFIED: src/db/migrations/001-initial.ts:127-142] |
| Current custom values | Database / Storage | API / Backend | A value row must be uniquely constrained by contact + definition and updated under the existing write boundary. |
| Parser/type-change behavior | API / Backend | Browser / Client | The existing seven parser functions and preflight/history logic are node-pure DAO-layer behavior; widgets only render their outcome. [VERIFIED: src/db/field-parsers.ts:44-90] |
| Form/profile visibility and custom photo interaction | Browser / Client | API / Backend | Existing pure selectors decide placement; forms/profile consume their map without schema awareness. [VERIFIED: src/db/field-values-dao.ts:167-198] |
| Quarantine expiry/history retention | API / Backend | Database / Storage | A foreground-launch service invokes serialized database cleanup after its stale re-check. [VERIFIED: src/services/field-sweep.ts:83-133] |

## Standard Stack

### Core

| Library / component | Version | Purpose | Why standard here |
|---------------------|---------|---------|-------------------|
| Existing `expo-sqlite` adapter | `~57.0.1` [VERIFIED: package.json] | On-device SQLite connection | The app already exposes it through `SqlExecutor`; do not introduce an ORM or a second database layer. [VERIFIED: src/db/database.ts:57-88] |
| Existing migration runner | in-repo | Forward-only migration 006 | It already creates a per-version transaction and atomically advances `PRAGMA user_version`. [VERIFIED: src/db/migrations/runner.ts:56-66] |
| Existing `node:sqlite` test adapter | in-repo | Node-side migration and DAO proof | Existing DB tests use `SqlExecutor`, making actual SQL node-testable rather than mocked. [VERIFIED: src/db/__testkit__/node-sqlite.ts:1-52] |

### Supporting

| Component | Purpose | When to use |
|-----------|---------|-------------|
| `inWriteTransaction` | Shared mutex plus explicit transaction | Every standalone normalized value/definition mutation; extract non-mutexed cores when composing operations. [VERIFIED: src/db/transaction.ts:41-57] |
| `newUid` | App-generated immutable row identity | Migration-created values and each future value-row insert. [VERIFIED: src/db/uid.ts:18-42] |
| Existing parser map | Read-time type validation only | Retain unchanged for each of the seven field types. [VERIFIED: src/db/field-parsers.ts:44-90] |

**Installation:** None. This phase must add no external package.

## Architecture Patterns

### System Architecture Diagram

```text
Legacy database (v1–v5)
  custom_field_defs ── col_name ──> contact_custom_values dynamic TEXT column
            │                                  │
            └──────── Migration 006 validates exact correspondence ───────┐
                                                                            v
                          one transaction: create rows → copy raw values → validate
                                                                            │
                                                                            v
                     normalized custom_field_values (uid, contact_id, field_def_id, value)
                        │                         │
                        │                         └─ UNIQUE(contact_id, field_def_id)
                        v
  rewritten value DAO ──> value map keyed by unchanged definition col_name ──> forms / profile / AI projection
                        │
                        └─> row join for sort/filter; no dynamic identifier

Field management ──> definition metadata / row creation / history snapshot / row deletion
Launch sweep ──> re-check quarantine → snapshot → delete value rows + definition → prune history
```

### Recommended Project Structure

```text
src/db/
├── migrations/006-normalize-custom-field-values.ts  # legacy validation, atomic conversion, retirement
├── field-values-dao.ts                              # normalized reads/upserts + existing pure selectors
├── field-ddl.ts                                     # renamed row-lifecycle operations; no DDL
├── field-type-change.ts                             # query normalized rows; preserve history semantics
├── field-defs-dao.ts                                # metadata plus normalized emptiness query
└── field-types.ts                                   # add normalized value-row types/payloads
```

### Pattern 1: Stable row model with a compatibility projection

**What:** Treat `custom_field_defs.id` as the local relationship key and `custom_field_defs.uid` as the durable definition identity. A normalized value record references local IDs, but reads return the present `Record<col_name, string | null>` projection expected by the existing forms/profile/AI code. `col_name` remains an immutable compatibility key only. [VERIFIED: src/db/field-types.ts:25-51] [VERIFIED: src/db/field-values-dao.ts:63-86]

**When to use:** All current-value reads and writes after migration 006.

**Recommended row shape (new names and fields are a planning recommendation, not existing source):**

```sql
-- [ASSUMED: recommended migration-006 DDL; planner selects final names]
CREATE TABLE custom_field_values (
  id INTEGER PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_def_id INTEGER NOT NULL REFERENCES custom_field_defs(id) ON DELETE CASCADE,
  value TEXT,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  UNIQUE(contact_id, field_def_id)
);
```

The database constraint is required because DAO-level upsert alone cannot prove one current row per pair. SQLite supports `UNIQUE`, `NOT NULL`, and `FOREIGN KEY` table constraints; child-key indexes are recommended for efficient parent deletion. [CITED: https://www.sqlite.org/lang_createtable.html] [CITED: https://www.sqlite.org/foreignkeys.html]

### Pattern 2: One migration transaction, no compatibility mode

**What:** Migration 006 must use raw `SqlExecutor` calls inside the runner's already-open migration transaction—never `inWriteTransaction`, which would attempt a nested `BEGIN` and non-reentrant mutex. The migration must validate legacy structure before writes, insert all rows, verify the complete conversion, and retire `contact_custom_values` before return. [VERIFIED: src/db/migrations/runner.ts:56-66] [VERIFIED: src/db/transaction.ts:19-36]

**Migration proof protocol:**

1. Read all definitions, including quarantined ones; validate every `col_name` is safe and that `PRAGMA table_info(contact_custom_values)` contains exactly the legacy fixed columns plus those definition keys. The shipped fixed columns are verbatim: `contact_id`, `uid`, and `modified_at`. [VERIFIED: src/db/migrations/001-initial.ts:148-153]
2. Reject any missing definition column, unexpected dynamic column, wrong legacy field type, orphan legacy value row, or failure to read its values. This is the D-06 fail-closed boundary.
3. Create the normalized table and insert **one row for every existing contact × definition**, including `NULL` and empty-string values exactly as stored. Include archived contacts as well: they remain persisted contacts and omitting their custom values would violate CFN-01's preservation mandate. For legacy contacts without a `contact_custom_values` row, create blank (`NULL`) rows rather than manufacturing a legacy source value.
4. Use `deps.newUid()` once per new value row. Preserve each legacy source row's `modified_at` for its derived value rows when available; only no-source blank rows need the migration's `deps.now`. The old per-contact row uid is not a field-value identity and must not be reused.
5. Validate post-copy count equals `contacts × definitions`; validate each contact/definition source value byte-for-byte (including custom-photo relative paths); validate the unique pair count; then drop the old dynamic table. Any throw lets the runner roll back the whole migration. [VERIFIED: src/db/migrations/runner.ts:56-66]
6. Update `TARGET_VERSION` to 6 and register migration 006 in `openAndMigrate`. It currently imports migrations 001–005 and declares `TARGET_VERSION = 5`. [VERIFIED: src/db/database.ts:24-40] [VERIFIED: src/db/database.ts:109-116] Bootstrap already catches a rejected migration, logs it, and renders its themed error view rather than mounting the navigator; retain that path and improve only the exceptional wording if needed. [VERIFIED: App.tsx:43-57] [VERIFIED: App.tsx:109-126]

### Pattern 3: Preserve lifecycle semantics with set-based row operations

**What:** Reimplement existing operations against `custom_field_values`, retaining their transaction/mutex boundaries and existing public UI flow:

- Create a definition, then insert a blank value row for every existing contact in the same transaction; creation no longer runs `ALTER TABLE`. The legacy implementation currently does `INSERT INTO custom_field_defs` followed by `ALTER TABLE ... ADD COLUMN`. [VERIFIED: src/db/field-ddl.ts:72-102]
- On create-contact, insert blank rows for all definitions, then update provided `show_on_new` values. On edit/clear, update the same pair row's `value` and `modified_at`; never delete it.
- `isFieldEmpty`, preflight, and delete/quarantine test rows by `field_def_id`, not a dynamic column. Preserve current semantics: only non-null values make a field populated; an empty string remains a stored present value. [VERIFIED: src/db/field-defs-dao.ts:218-230] [VERIFIED: src/db/field-ddl.ts:165-186]
- Permanent delete and quarantine expiry must first insert every non-null row into `field_history` using the unchanged `field_col_name`, then delete dependent value rows and the definition in one transaction. The existing history schema's verbatim fields are `contact_id`, `field_col_name`, `old_value`, `operation`, and `created_at`. [VERIFIED: src/db/migrations/001-initial.ts:155-163]
- Keep quarantine non-destructive and retain the existing strict-older-than-30-days launch sweep plus history pruning. [VERIFIED: src/services/field-sweep.ts:53-58] [VERIFIED: src/services/field-sweep.ts:93-132]

### Pattern 4: Parser and raw-TEXT behavior stay outside SQL

**What:** Keep the current seven parser union verbatim: `"text" | "textarea" | "dropdown" | "date" | "toggle" | "number" | "photo"`. [VERIFIED: src/schemas/types.ts:20-27] Parser validation remains read-time and must not rewrite stored bytes; `applyTypeChange` still snapshots non-null values and changes definition metadata only. [VERIFIED: src/db/field-type-change.ts:145-189]

For normalized sort/filter queries, use a fixed SQL expression over the normalized row's `value` column. Recreate the current raw-TEXT `sortExpr` choices (`CAST(... AS REAL)` for number, `CAST(... AS INTEGER)` for toggle, raw text otherwise) but remove `col_name` from the generated expression. [VERIFIED: src/db/field-sort.ts:113-126] Do not replicate the seven JavaScript parsers in SQL or canonicalize legacy values—the current helper deliberately distinguishes raw ordering from parsed display. [VERIFIED: src/db/field-sort.ts:45-86]

### Anti-Patterns to Avoid

- **Dual read/write compatibility mode:** contradicts D-05 and lets the two stores diverge.
- **Reusing old `contact_custom_values.uid`:** it represented one contact-wide dynamic row, while D-02 requires each current field value to have its own immutable uid. [VERIFIED: src/db/field-values-dao.ts:121-144]
- **Deleting a value row to clear a value:** breaks D-01's durable blank state and future row reconciliation.
- **Doing `ALTER TABLE` / `DROP COLUMN` after migration:** reintroduces replicated-DDL risk identified by the sync investigation; Phase 16's row model is fixed, while its future conflict semantics remain explicitly open. [VERIFIED: .planning/sync-milestone/SYNC-MILESTONE-INVESTIGATION.md:B.6]
- **Changing `col_name` or `field_history` to definition uid:** D-09/D-10 require the existing key for compatibility, history, and custom-photo filenames.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction/mutex serialization | A second migration or DAO transaction wrapper | Existing runner and `inWriteTransaction` / extracted core pattern | The shared mutex is explicitly non-reentrant; nesting can permanently hang. [VERIFIED: src/db/transaction.ts:19-36] |
| Value type conversion | Pairwise converters or SQL parser copies | Existing `parsers` map and preflight | Existing parser outcomes flag unconvertible data without modifying it. [VERIFIED: src/db/field-parsers.ts:32-90] |
| Custom photo identifiers | New path scheme based on value uid | Existing `customFieldPhotoRelPath(contactId, colName)` | Stored value and filename already share one stable relative-path convention. [VERIFIED: src/components/field-widgets/photo-field-logic.ts:10-29] |
| UI field placement | New visibility policy | Existing pure selectors | They encode the create/edit/profile/quarantine contract without DB access. [VERIFIED: src/db/field-values-dao.ts:167-198] |

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Device SQLite databases at schema versions 1–5 contain `custom_field_defs`, legacy `contact_custom_values`, and `field_history`; custom photo values are relative strings, not separate DB blobs. [VERIFIED: src/db/migrations/001-initial.ts:127-163] [VERIFIED: src/components/field-widgets/photo-field-logic.ts:10-29] | Migration 006 converts database rows transactionally; preserve photo strings byte-for-byte. No filesystem data migration is required because filenames remain based on `contactId` + `col_name`. |
| Live service config | None found. Custom fields are local SQLite and foreground-launch logic; no remote service/config is involved. [VERIFIED: src/services/field-sweep.ts:83-133] | None. |
| OS-registered state | None found for custom-field values. | None. |
| Secrets/env vars | None found for custom-field storage. | None. |
| Build artifacts / installed packages | No schema-bearing generated artifact found; runtime schema version is application code. [VERIFIED: src/db/database.ts:24-40] | Ship the migration in the application build; do not rely on reinstalling an artifact to transform user data. |

## Common Pitfalls

### Pitfall 1: Valid-looking partial migration

**What goes wrong:** Creating the row table and dropping the legacy table before validating all dynamic-column correspondence can silently lose a field/value pair.

**How to avoid:** Run structural validation before writes and source/count/byte-value validation before legacy retirement; throw on every discrepancy so the runner's rollback retains the pre-006 database. [VERIFIED: src/db/migrations/runner.ts:56-66]

### Pitfall 2: Treating `NULL` and empty text as the same legacy value

**What goes wrong:** Converting `''` to `NULL` rewrites raw text and alters visible/presence behavior.

**How to avoid:** Copy raw values byte-for-byte. Add explicit fixture assertions for `NULL`, `''`, unusual number/toggle text, and photo relative paths. Existing profile visibility checks non-null rather than non-empty. [VERIFIED: src/db/field-values-dao.ts:184-198]

### Pitfall 3: Missing blank rows for contacts without a legacy value row

**What goes wrong:** The prior table is lazily created on first value write, but D-01 now requires a durable blank record per pair.

**How to avoid:** Cross product contacts and definitions in migration/create-contact/create-field paths, then update rather than delete. The existing DAO confirms a contact can have no legacy values row. [VERIFIED: src/db/field-values-dao.ts:57-86]

### Pitfall 4: Nested transaction deadlock

**What goes wrong:** Calling an `inWriteTransaction`-wrapped DAO from migration or another transaction can hang under the non-reentrant mutex.

**How to avoid:** Migration uses raw executor calls inside the runner transaction; composed post-migration operations use explicit non-mutexed cores. [VERIFIED: src/db/transaction.ts:19-57]

### Pitfall 5: Breaking type-change/history compatibility

**What goes wrong:** Refactoring the data model tempts a rewrite of text values or a `field_history` uid migration.

**How to avoid:** Preserve raw `TEXT`, leave all seven parsers/read-time behavior intact, and keep `field_history.field_col_name` snapshots. [VERIFIED: src/db/field-type-change.ts:145-189] [VERIFIED: src/db/migrations/001-initial.ts:155-163]

### Pitfall 6: Re-keying custom photos to the new value uid

**What goes wrong:** A new photo filename scheme would orphan existing files and expand Phase 16 beyond behavior-preserving normalization.

**How to avoid:** Preserve stored relative paths and keep derivation from `contactId` plus `col_name`; purge cleanup deliberately enumerates surviving photo definitions using that key. [VERIFIED: src/services/photos/purge-photo-cleanup.ts:62-99]

## Code Examples

### Normalized read projection

```ts
// [ASSUMED: illustrative normalized DAO query; exact aliases/signature are planner discretion]
const rows = await exec.getAllAsync<{ col_name: string; value: string | null }>(
  `SELECT d.col_name, v.value
     FROM custom_field_values v
     JOIN custom_field_defs d ON d.id = v.field_def_id
    WHERE v.contact_id = ?`,
  [contactId],
);
return Object.fromEntries(rows.map((row) => [row.col_name, row.value]));
```

This preserves the existing UI contract—a map keyed by `col_name`—while all runtime values are bound. The current dynamic projection is only needed because value names are physical columns. [VERIFIED: src/db/field-values-dao.ts:63-86]

### Safe permanent-delete core ordering

```text
1. INSERT field_history rows from normalized values where value IS NOT NULL
2. DELETE normalized values for the field definition
3. DELETE custom_field_defs row
4. commit the existing one transaction
```

The ordering preserves the existing snapshot-before-destruction rule while eliminating legacy `DROP COLUMN`; current code performs the analogous snapshot before definition/column removal. [VERIFIED: src/db/field-ddl.ts:113-136]

## State of the Art

| Old approach | Current Phase-16 approach | Impact |
|--------------|--------------------------|--------|
| One `contact_custom_values` row per contact with field data in dynamic `TEXT` columns | One stable value row per contact-definition pair | Removes custom-field DDL from routine lifecycle and gives each value a portable identity. |
| Dynamic `col_name` interpolation for reads/writes/sort/preflight | Fixed joins and bound values; `col_name` only returned as a compatibility key | Removes runtime custom SQL identifiers while preserving UI maps, history, and photos. |

Phase 17 is intentionally not designed here. The next phase must consume normalized rows but is re-discussed after Phase 16; it owns migration 007/tombstones, while multi-device definition/value conflict policy remains a later sync decision. [VERIFIED: .planning/phases/17-backup-export-restore/17-CONTEXT.md:Planned prerequisite and numbering] [VERIFIED: .planning/sync-milestone/SYNC-MILESTONE-INVESTIGATION.md:B.6]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended new table name `custom_field_values` and its exact column names/timestamp set. | Architecture Pattern 1 | Planner must choose final schema/API names consistently. |
| A2 | All persisted contacts, including archived ones, should receive blank pair rows when no legacy source row exists. | Migration proof protocol | Omitting archived values would lose data; owner wording says “live” but CFN preservation requires no loss. |
| A3 | A source legacy row's shared `modified_at` should seed each migrated value record; no-source blanks use migration time. | Migration proof protocol | A future reconciliation may need a different documented migration timestamp policy. |

## Open Questions

1. **Migration failure wording**
   - What we know: successful upgrades must be silent; App bootstrap already catches a migration rejection and renders an error view instead of mounting database consumers. [VERIFIED: App.tsx:43-57] [VERIFIED: App.tsx:109-126]
   - What's unclear: whether the existing generic copy is sufficiently clear for a migration-006 integrity failure.
   - Recommendation: reuse the existing error branch and add narrow, plain wording only for the exceptional fail-closed conversion error; do not add success UI.

2. **Normalized child-key indexing**
   - What we know: the unique pair constraint enforces correctness; SQLite documentation recommends child-key indexes for parent-delete efficiency. [CITED: https://www.sqlite.org/foreignkeys.html]
   - What's unclear: whether one additional non-unique `field_def_id` index is warranted at Orbit's tens-of-contacts scale.
   - Recommendation: use the unique pair constraint first; add only a targeted index justified by a lifecycle/query test, never a value-text index or uniqueness rule.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Existing node-side DB tests | ✗ too old in this shell | `v18.19.1`; `node:sqlite` import fails | Use the repository's Node 22+ test runtime before running migration/DAO tests. |
| npm | Test/typecheck commands | ✓ | `9.2.0` | — |
| Expo SQLite | Device migration | Present in project dependencies | `~57.0.1` [VERIFIED: package.json] | No fallback; device check is required. |

**Missing dependencies with no fallback:** A Node runtime that provides `node:sqlite` is required for the existing node database suite. The in-repo adapter explicitly imports `node:sqlite`. [VERIFIED: src/db/__testkit__/node-sqlite.ts:12-13]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` [VERIFIED: package.json] |
| Config file | `vitest.config.ts` [VERIFIED: vitest.config.ts] |
| Quick run command | `npm test -- src/db/migrations/006-normalize-custom-field-values.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CFN-01 | v5 fixture → v6 creates complete normalized rows, preserves definition UIDs/raw text/photo paths, gives each value a distinct immutable UID, retires legacy table | migration integration | `npm test -- src/db/migrations/006-normalize-custom-field-values.test.ts` | ❌ Wave 0 |
| CFN-01 | malformed legacy schema/value correspondence rolls back, leaves version/table/data unchanged | migration rollback | `npm test -- src/db/migrations/006-normalize-custom-field-values.test.ts` | ❌ Wave 0 |
| CFN-02 | create/edit/clear/retype/options/quarantine/restore/expiry/permanent delete use rows; history snapshots retain `field_col_name` | DAO + lifecycle integration | `npm test -- src/db/field-values-dao.test.ts src/db/field-ddl.test.ts src/db/field-type-change.test.ts src/services/field-sweep.test.ts` | existing files require conversion/extension |
| CFN-03 | map projection, sort/filter expression, unsafe `col_name` no longer reaches runtime SQL, raw text remains raw | DAO + pure unit | `npm test -- src/db/field-values-dao.test.ts src/db/field-sort.test.ts` | existing files require conversion/extension |
| CFN-04 | populated profile with all seven types, NULL/empty text, custom photo, retype, quarantine expiry, deletion | migration + UI-facing DAO integration | `npm test -- src/db/migrations/006-normalize-custom-field-values.test.ts src/db/contact-read.test.ts src/db/ai-context-read.test.ts` | migration fixture ❌; dependent readers need regression coverage |

### Sampling Rate

- **Per task commit:** targeted Vitest command for files changed, then `npx tsc --noEmit`.
- **Per wave merge:** `npm test`, `npx tsc --noEmit`, and `npm run check:colors`.
- **Phase gate:** Full suite green plus a physical-device upgrade from populated test-profile data before `$gsd-verify-work`.

### Wave 0 Gaps

- [ ] `src/db/migrations/006-normalize-custom-field-values.test.ts` — build a genuine v5 legacy fixture, apply migration 006 through `runMigrations`, and test both success and rollback.
- [ ] Convert existing dynamic-column fixture helpers in field DAO/lifecycle tests to normalized row fixture helpers while retaining their behavioral assertions.
- [ ] Add a regression test that uses the unchanged create/edit/profile/AI projections after migration rather than testing only raw table rows.
- [ ] Provide Node 22+ before running node SQLite tests in this shell.
- [ ] Run the owner-facing physical-device upgrade check against populated test-profile data; test a successful upgrade is silent and a deliberately malformed fixture fails plainly without partial changes.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No | Local on-device migration has no authentication flow. |
| V3 Session Management | No | No session state is changed. |
| V4 Access Control | Yes | SQLite foreign keys plus the existing single-write transaction boundary preserve owned contact/definition relationships. [VERIFIED: src/db/database.ts:103-107] |
| V5 Input Validation | Yes | Runtime SQL values remain `?`-bound; migration validates legacy identifiers only before its one-time compatibility read. |
| V6 Cryptography | No new cryptography | `uid` is identity, not a secret; retain existing generator and add no crypto mechanism. [VERIFIED: src/db/uid.ts:1-42] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection through field label/key | Tampering | Never interpolate labels or user values; normalized production SQL has no dynamic field identifier. Bind all values. |
| Partial/corrupt schema conversion | Tampering / Denial of service | Validate before retirement, execute in migration transaction, preserve original error and rollback. [VERIFIED: src/db/migrations/runner.ts:56-66] |
| Orphaned values | Integrity | Enforce non-null FKs and unique contact-definition pair; delete dependent rows transactionally after history snapshot. [CITED: https://www.sqlite.org/foreignkeys.html] |
| Custom photo path loss | Availability | Copy stored relative path exactly and retain existing `contactId` + `col_name` filename derivation. [VERIFIED: src/components/field-widgets/photo-field-logic.ts:10-29] |

## Sources

### Primary (HIGH confidence)

- `src/db/migrations/001-initial.ts` — shipped legacy custom-field and history schema.
- `src/db/migrations/runner.ts`, `src/db/database.ts`, and `src/db/transaction.ts` — transaction/version/write-boundary contracts.
- `src/db/field-values-dao.ts`, `field-ddl.ts`, `field-defs-dao.ts`, `field-type-change.ts`, and `field-sort.ts` — current behavior being preserved.
- `src/services/field-sweep.ts` and `src/services/photos/purge-photo-cleanup.ts` — lifecycle and photo cleanup integrations.
- `.planning/phases/16-custom-field-value-normalization/16-CONTEXT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/sync-milestone/SYNC-MILESTONE-INVESTIGATION.md` §§A.5/B.6, and Phase 17 context — scope and downstream fences.

### Secondary (MEDIUM confidence)

- [SQLite CREATE TABLE](https://www.sqlite.org/lang_createtable.html) — table constraint capabilities.
- [SQLite foreign-key documentation](https://www.sqlite.org/foreignkeys.html) — FK enforcement and child-key indexing guidance.
- [SQLite transaction documentation](https://www.sqlite.org/lang_transaction.html) — transaction semantics.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — uses only existing in-repo SQLite/migration/test infrastructure.
- Architecture: HIGH for seams/invariants; MEDIUM for exact new table/API names, which are delegated.
- Pitfalls: HIGH — grounded in existing code's explicit transaction, raw-text, history, sweep, and photo behavior.

**Research date:** 2026-08-24
**Valid until:** Implementation begins; recheck the local Node test runtime before execution.
