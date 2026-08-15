---
phase: 3
slug: custom-fields
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract. From `03-RESEARCH.md` §Validation Architecture (node:sqlite for the
> DDL/parser/type-change/sweep invariants; RN-component testing minimal).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.x` (installed) + **`node:sqlite`** (built-in, SQLite 3.51.2 — no new dep) for the transactional DDL, parser, type-change, `sortExpr`, and quarantine-sweep invariants. RN-component testing minimal (field-editor UX verified at the `--to 3` gate). |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx tsc --noEmit && npx biome check . && npx vitest run` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit && npx biome check <changed>`
- **After every plan wave:** `npx tsc --noEmit && npx biome check . && npx vitest run`
- **Before `/gsd-verify-work`:** full suite green (the field-editor UX is reviewed at the `--to 3` gate)
- **Max feedback latency:** ~25 seconds

---

## Per-Requirement Verification Map (node:sqlite, deterministic)

| Requirement | Invariant verified | Command |
|-------------|--------------------|---------|
| FLD-02 | create = `INSERT def + ALTER ADD COLUMN` in ONE transaction (rollback leaves table unchanged); `col_name` whitelist-constructed, CANNOT collide with a fixed column (reserved-set test vs `PRAGMA table_info`) | `npx vitest run src/db/**/fields-ddl.test.ts` |
| FLD-03 | rename updates `label` only (`col_name` stable); reorder via `display_order`; type/options change | same |
| FLD-04 | type change = `UPDATE defs.type` ONLY (a test asserts `contact_custom_values` bytes UNCHANGED); clean values valid under new type, unconvertible flagged (not coerced/cleared); `field_history` snapshot in the SAME transaction; 7 permissive parsers (one per target type) | `npx vitest run src/db/**/parsers.test.ts src/db/**/type-change.test.ts` |
| FLD-05 | delete dynamic (empty→Delete; populated→Quarantine, data untouched, restore NULLs `quarantined_at`); launch-sweep hook expires defs quarantined >30d (`DELETE def + DROP COLUMN` in ONE transaction) + prunes `field_history` >30d | `npx vitest run src/db/**/quarantine.test.ts src/**/sweep-fields.test.ts` |
| FLD-06 | every sort/filter routes through `sortExpr()` (number→CAST REAL, date→col, toggle→CAST INTEGER, else→col); NO index/UNIQUE on any value column (`PRAGMA index_list`); a test proves `DROP COLUMN` succeeds (would throw if indexed) | `npx vitest run src/db/**/sort-expr.test.ts` |
| FLD-07 | profile shows a field when it has a value or always-show; create form = `show_on_new` only; edit form = every non-quarantined field | `npx vitest run src/db/**/field-visibility.test.ts` |
| FLD-01 | tables exist (Phase 2) — this phase's DDL ops target them | (covered above) |

---

## Wave 0 Requirements

- [ ] `src/db/` field-defs + values DAOs, transactional DDL ops (add/rename/drop), `sortExpr`, 7 parsers, type-change pre-flight, quarantine-sweep hook
- [ ] node:sqlite test files above (reuse the Phase-2 testkit)
- [ ] Vitest installed (Phase 1/2) — no framework install

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Field-editor UX (create/rename/reorder/retype/delete-quarantine from Settings; the tap-to-fix error state) renders correctly + no hardcoded colours | FLD-02..05, 07 | RN-component UX; no component-test infra this phase (owner's `--to 3` review target) | Build/install on the Pixel via the proven pipeline; drive the Custom Fields settings screen; confirm `check:colors` clean |

---

## Validation Sign-Off

- [x] Every FLD-01..07 invariant has an automated node:sqlite/Vitest check; the field-editor UX is the sole manual item (reviewed at `--to 3`)
- [x] The type-change "no value rewrite" invariant is explicitly asserted (contact_custom_values bytes unchanged)
- [x] `DROP COLUMN`-succeeds test guards the no-index invariant
- [x] No watch-mode flags; `nyquist_compliant: true`

**Approval:** pending (completes after Wave 0 green + the field-editor UX review at the `--to 3` gate)
