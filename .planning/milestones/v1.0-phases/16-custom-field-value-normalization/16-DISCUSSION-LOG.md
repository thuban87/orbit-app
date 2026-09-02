# Phase 16: Custom Field Value Normalization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-24
**Phase:** 16-custom-field-value-normalization
**Areas discussed:** Value-row identity and blank values, one-way migration and legacy cutover, legacy field metadata and history, sort/filter parity and safety

---

## Value-row identity and blank values

| Option | Description | Selected |
|--------|-------------|----------|
| Durable row per contact + field | Every live pair has a stable row; clearing sets it blank. | ✓ |
| Lazy durable row | Create only on first touch, retaining it after clear. | |
| Sparse non-blank row | Delete row when cleared. | |

**User's choice:** Durable row per contact + field.
**Notes:** Value records receive their own generated immutable uid. The database enforces one current record per contact/field pair. Permanent deletion snapshots values then removes the field and values atomically; snapshots stay bounded by the existing 30-day launch-sweep prune.

---

## One-way migration and legacy cutover

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic clean cutover | Convert all values in migration 006, validate, and use only normalized storage. | ✓ |
| Dual read/write period | Temporarily maintain old and new stores. | |
| Best-effort field migration | Keep fields that migrate and skip the rest. | |

**User's choice:** Atomic clean cutover.
**Notes:** Unexpected legacy inconsistency must fail closed with the old database unchanged. Safety proof is a rich automated before-to-after fixture plus a populated physical-device upgrade. A successful upgrade remains silent and seamless.

---

## Legacy field metadata and history

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve immutable `col_name` metadata | Keep it for compatibility/history, never as a SQL column identifier. | ✓ |
| Replace it with definition uid only | Remove legacy key now. | |
| Regenerate it from labels | Change internal key on a visible rename. | |

**User's choice:** Preserve immutable `col_name` metadata.
**Notes:** Preserve `field_history.field_col_name` as-is; it is short-lived and excluded from backup/sync, so no risky history-uid migration is needed.

---

## Sort/filter parity and safety

| Option | Description | Selected |
|--------|-------------|----------|
| Exact behavioral parity | Preserve current TEXT-based sort/filter outcomes. | ✓ |
| Rewrite values during migration | Canonicalize legacy text to improve sorting. | |
| Smarter query-only rules | Change sorting without changing stored values. | |

**User's choice:** Exact behavioral parity.
**Notes:** The owner explicitly deferred broad custom and built-in field display/UX cleanup to the next UI/UX milestone; Phase 16 must not absorb it.

---

## the agent's Discretion

- Exact normalized schema/index/DAO/query shapes, migration mechanics, test-fixture construction, and migration-failure copy within the decisions in CONTEXT.md.

## Deferred Ideas

- Redesign custom and built-in field displays/UX in the next UI/UX milestone.
- Decide multi-device custom-field conflict policy only in the future sync milestone.
