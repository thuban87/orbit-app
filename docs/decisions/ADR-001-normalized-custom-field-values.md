# ADR-001: Normalize Custom-Field Values

- **Status:** Accepted — 2026-08
- **Decision scope:** Migration 006 / Phase 16

## Context

The shipped custom-field store used `custom_field_defs` for field definitions and
`contact_custom_values` for data. Each field was a dynamic `TEXT` column in the
latter table, with one row per contact. This made a field's visible key double as
SQLite schema: creating, renaming, or permanently deleting a field required DDL.

That model preserves raw text well on one device, but it is a poor prerequisite
for backup, restore, or eventual multi-device sync. It has replicated-DDL risk,
does not give each current value a portable identity, and makes a schema change
the unit of custom-field replication. Devices cannot be remotely inspected or
repaired, so the replacement must be a forward-only, all-or-nothing migration.

## Decision

Migration 006 retires `contact_custom_values` and creates this normalized current
state table:

```text
custom_field_values(
  id, uid, contact_id, field_def_id, value, created_at, modified_at
)
```

- `uid` is an immutable, globally unique identity for each value row.
- `value` remains raw `TEXT` (or `NULL`); field type continues to select the UI
  widget and parser, not a database storage type.
- `UNIQUE(contact_id, field_def_id)` enforces **at most one** current row for a
  contact-and-definition pair, while `uid` is separately `UNIQUE`.
- There is one durable value row for every contact × definition pair, including
  blank values and quarantined definitions. Clearing writes `NULL` to the same
  row; it does not delete the row. Completeness is maintained by migration
  seeding, seeding at every contact/field creation point, and UPSERT self-heal.
  It is deliberately not described as a lower-bound database constraint:
  SQLite cannot enforce that cardinality with a simple table constraint.
- New and changed values use pair-keyed UPSERTs. The update branch preserves
  `uid` and `created_at`, and changes only `value` and `modified_at`.
- `col_name` remains an immutable compatibility, history, and photo-filename
  key; it is no longer interpolated as a runtime SQL column identifier.

Migration 006 validates and copies every legacy value in one transaction, proves
the copied pair matrix, then drops the retired table. A loss-bearing legacy
inconsistency (for example, a definition whose backing column is missing) fails
closed and leaves the database unchanged. Under D-06a, a non-loss-bearing orphan
legacy column is instead snapshot to `field_history`, dropped in the same
transaction, and the migration proceeds.

### Timestamp provenance

For a migrated contact that had a legacy value row, that row's `modified_at`
becomes both `created_at` and `modified_at` of each derived value row. A contact
without a legacy value row receives synthesized blank pairs stamped with the
migration's local `now`. Later inserts use their own creation timestamp and
updates retain `created_at` while changing `modified_at`. Phase 17 must consume
this documented provenance rather than infer an unavailable per-value legacy
creation time.

## Rejected Alternatives

### Dual-read / dual-write compatibility mode

Rejected. Keeping both stores would make every future mutation synchronize a
row-based model and dynamic DDL, increasing divergence risk on an unreachable
device. D-05 requires one forward-only cutover to normalized-only code.

### A JSON value column on `contacts`

Rejected. It would make values opaque to relational pair identity and require
rewriting a contact-wide JSON document for individual field updates, complicating
integrity, inspection, and future reconciliation.

### Keeping `ALTER TABLE` / `DROP COLUMN` field DDL

Rejected. Dynamic schema changes are the replicated-DDL risk this decision
removes. Creating, deleting, quarantining, restoring, and retyping fields now
operate on definition and value rows; no future custom-field operation relies on
dynamic value-table DDL.

## Consequences

- `CLAUDE.md` records the normalized model; the old dynamic-column rules are
  superseded by this ADR and migration 006.
- The old ban on indexes or `UNIQUE` constraints on dynamic value columns does
  not apply to the retired table. `custom_field_values.uid UNIQUE` and
  `UNIQUE(contact_id, field_def_id)` are intentional integrity constraints.
- D-03 is enforced honestly: the database guarantees at-most-one pair row;
  complete coverage is maintained by migration/creation seeding and UPSERT
  self-heal, not a lower-bound SQL constraint.
- `createContactFull` is the only production contact-creation path that seeds
  the complete pair matrix. The exported test helper
  `createContactWithInteraction` writes no custom values and must not become a
  production creation path without equivalent seeding.
- A permanent deletion snapshots applicable values to `field_history` and
  removes the definition plus dependent rows transactionally. A photo file for
  a permanently deleted photo definition is a bounded local orphan: contact
  purge enumerates surviving definitions, so it does not reclaim that deleted
  definition's files. A future cleanup mechanism owns that concern.
- The D-06a orphan-column snapshot is a bounded, local 30-day audit trace with
  no read surface and no backup path. It is not a recovery mechanism.
- `field_history.field_col_name` remains the compatibility/audit key and the
  launch sweep, not a timer, retains the bounded history/quarantine lifecycle.
- Phase 17 can consume normalized value rows and their timestamp provenance, but
  backup format, restore reconciliation, tombstones, and multi-device conflict
  policy remain explicitly open.

