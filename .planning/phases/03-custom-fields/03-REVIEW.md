---
phase: 03-custom-fields
reviewed: 2026-08-15T02:42:24Z
depth: deep
files_reviewed: 27
files_reviewed_list:
  - src/db/field-types.ts
  - src/db/reserved-columns.ts
  - src/db/col-name.ts
  - src/db/transaction.ts
  - src/db/mutex.ts
  - src/db/recency-dao.ts
  - src/db/field-parsers.ts
  - src/db/field-sort.ts
  - src/db/field-ddl.ts
  - src/db/field-defs-dao.ts
  - src/db/field-values-dao.ts
  - src/db/field-type-change.ts
  - src/db/database.ts
  - src/db/migrations/001-initial.ts
  - src/services/field-sweep.ts
  - src/services/launch-sweep.ts
  - src/components/field-widgets/types.ts
  - src/components/field-widgets/TextFieldWidget.tsx
  - src/components/field-widgets/TextAreaFieldWidget.tsx
  - src/components/field-widgets/NumberFieldWidget.tsx
  - src/components/field-widgets/DateFieldWidget.tsx
  - src/components/field-widgets/ToggleFieldWidget.tsx
  - src/components/field-widgets/DropdownFieldWidget.tsx
  - src/components/field-widgets/PhotoFieldWidget.tsx
  - src/components/FieldValueInput.tsx
  - src/components/CustomFieldValue.tsx
  - src/components/FieldDefForm.tsx
  - src/screens/CustomFieldsScreen.tsx
  - src/screens/HomeScreen.tsx
  - App.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-15T02:42:24Z
**Depth:** deep
**Files Reviewed:** 27 (plus mutex.ts + migrations/001-initial.ts read as subsystem context per "review the code, not the diff")
**Status:** issues_found

## Summary

Adversarial deep review of the HANDOFF §14 custom-fields subsystem, focused on the four highest-risk axes the prompt called out: non-reentrant-mutex concurrency, col_name SQL-injection surface, type-change blast radius, and the destructive-op / snapshot invariants. I traced the full `col-name → field-ddl → dao → field-sweep → CustomFieldsScreen` chain and grepped every writer of the three tables and every `${}` SQL interpolation across `src/`.

**The four non-negotiable invariant families hold.** Specifically verified:

- **Concurrency — no double-acquire, no deadlock.** Every writer of `contact_custom_values` / `custom_field_defs` / `field_history` routes through exactly one `inWriteTransaction` (grep-confirmed: `field-ddl`, `field-defs-dao`, `field-values-dao`, `field-type-change`, `field-sweep` prune, and the `recency-dao` writers — no bare UPSERT/UPDATE/DELETE reaches those tables). The three composed drop entries (`dropField`, `deleteOrQuarantineField`, `expireFieldIfStale`) all call the private non-mutexed `dropFieldColumns` core directly rather than nesting `dropField`; the sweep loop calls `expireFieldIfStale` directly and never re-wraps it. No `inWriteTransaction` is reachable from inside another. The sweep→restore TOCTOU is closed by the under-lock staleness re-check sharing the one FIFO mutex.
- **SQL injection — clean.** `col_name` is the only interpolated identifier at every site (`col-name`, `field-ddl`, `field-defs-dao.isFieldEmpty`, `field-values-dao`, `field-sort`, `field-type-change`), each guarded by `isSafeColName` and double-quoted; every runtime value is `?`-bound. Slugs are constructed from `[a-z][a-z0-9_]*`, so even a SQL-keyword or payload label produces a safe, always-quoted identifier.
- **Type change — blast radius zero.** `applyTypeChange` is a same-transaction `field_history` snapshot + `UPDATE custom_field_defs SET type` only; `contact_custom_values` value bytes are never rewritten, cleared, or coerced.
- **Destructive-op safety.** Snapshots to `field_history` occur in the same transaction as every drop/type-change; DELETE def + DROP COLUMN are both explicit; no index/UNIQUE is ever added to a value column; value columns are declared `TEXT`; strict `<` 30-day expiry with an under-lock re-verify.
- **UI.** No hardcoded colours in any reviewed component — every colour resolves through `useTheme().colors.*`; the tap-to-fix error state composes from existing tokens as documented. (Deferred `photo` picker + `share_with_ai` toggle correctly out of scope.)

No BLOCKER-level defects found. The findings below are correctness/robustness gaps that should be addressed, none of which risk data loss or corruption in Phase 3 as wired.

## Warnings

### WR-01: `sortExpr` SQL CAST diverges from the parser's canonicalization for non-canonical stored values

**File:** `src/db/field-sort.ts:44-51` (in concert with `src/db/field-parsers.ts:44-91`)
**Issue:** `sortExpr` sorts `number` via `CAST("col" AS REAL)` and `toggle` via `CAST("col" AS INTEGER)` over the **raw** TEXT bytes, but storage is never canonicalized — the parsers are explicitly read-time-only and `applyTypeChange` leaves value bytes byte-identical (§14.2). So a value that displays as clean can sort wrong:
- A `toggle` value of `"yes"`/`"true"` (arising from a `text → toggle` type change) parses to canonical `"1"` and renders **On** in `CustomFieldValue`, but `CAST('yes' AS INTEGER)` is `0`, so it sorts into the *false* group.
- A `number` value of `"1,000"` parses clean (commas stripped → 1000) and renders **1000**, but `CAST('1,000' AS REAL)` is `1.0`, so it sorts as 1.

`field-parsers.ts` comments assert the canonical forms exist "so CAST sorts correctly" — but that only holds if storage is canonical, which the TEXT-forever + no-rewrite design does not guarantee. This is latent in Phase 3 (grep confirms `sortExpr` has no runtime consumer yet — only doc references), but the Phase-8 dashboard sort and Phase-13 orrery ordering will inherit it, and CLAUDE.md designates `sortExpr` as *the* place the TEXT decision is made observable/correct.
**Fix:** Make the divergence impossible or explicit. Either (a) document in `field-sort.ts` that CAST-based ordering is only exact for widget-authored (canonical) values and that a post-type-change field may misorder non-canonical rows until re-edited; or (b) have `sortExpr` mirror the parser's canonicalization in SQL where feasible (e.g. for `number`, strip commas: `CAST(REPLACE("col", ',', '') AS REAL)`), accepting that `toggle` word-forms cannot be canonicalized in pure SQL and must be flagged. Do not change storage. Flag before Phase 8 wires a real sort.

### WR-02: Dropdown options are not de-duplicated — duplicate values cause React key collisions

**File:** `src/components/FieldDefForm.tsx:94-98` (`buildOptions`); surfaces in `src/components/field-widgets/DropdownFieldWidget.tsx:89-91`
**Issue:** `buildOptions` only trims and drops empties; it never de-duplicates. A user can create/edit a dropdown with options `["A","A"]`, persisted verbatim as the `options` JSON. `DropdownFieldWidget` renders the `FlatList` with `keyExtractor={(item) => item}`, so duplicate option strings produce duplicate React keys (dev warning + unstable reconciliation), and `isValueInOptions`/`includes` membership becomes ambiguous.
**Fix:** De-duplicate in `buildOptions` after trimming:
```ts
const cleaned = [...new Set(rows.map((r) => r.trim()).filter((r) => r.length > 0))];
```

### WR-03: Multi-part field edit applies as independent transactions — partial application on cancel or mid-sequence error

**File:** `src/screens/CustomFieldsScreen.tsx:163-225` (`handleEdit`)
**Issue:** `handleEdit` awaits `renameField`, then `updateFieldCuration`, then the type-change (gated behind an interactive `confirmSummary` Alert), then `changeFieldOptions` as four separate `inWriteTransaction`s. Label and curation are committed *before* the type-change confirmation dialog is shown, so cancelling the type change still persists the label/flag edits, and the reloaded editor shows a partially-applied result. Likewise, a throw in any later step leaves earlier steps committed. No data corruption (each op is individually atomic and guarded), but it violates the least-surprise expectation that "Save" is all-or-nothing.
**Fix:** Either (a) run the type-change pre-flight + confirmation *first* (before any write) and then apply all diffs, or (b) note explicitly in the UI/comment that edits apply incrementally. If atomicity is wanted, extract non-mutexed cores for the def-metadata ops (the core/wrapper pattern already documented in `transaction.ts`) and compose them inside one outer `inWriteTransaction` — never nest `inWriteTransaction`.

## Info

### IN-01: Dead ternary branch in the clean-value display path

**File:** `src/components/CustomFieldValue.tsx:90`
**Issue:** `presentValue(field.type, parsed.ok ? parsed.value : value)` is only reached when `flagged` is false, which requires `parsed.ok === true`. The `: value` alternative is therefore unreachable.
**Fix:** Simplify to `presentValue(field.type, parsed.value)` (narrowing already guarantees `parsed.ok`).

### IN-02: `upsertValue` guards `col_name` inside the transaction; sibling writers guard before

**File:** `src/db/field-values-dao.ts:107-109` vs `src/db/field-ddl.ts:76-78`
**Issue:** `createField` calls `quoteCol` before opening the transaction, so a bad col_name throws with no BEGIN issued. `upsertValue` runs `assertSafeCol` *inside* the `inWriteTransaction` body (after BEGIN), so an unsafe name opens and rolls back an empty transaction. Behaviourally safe (defence-in-depth still fires, values still `?`-bound), just inconsistent.
**Fix:** Hoist `assertSafeCol(colName)` above the `inWriteTransaction` call for consistency with `field-ddl`/`field-type-change`.

### IN-03: Date parser accepts structurally-valid but semantically-invalid dates

**File:** `src/db/field-parsers.ts:71-75`
**Issue:** The `date` parser matches `^(\d{4})-(\d{2})-(\d{2})` and canonicalizes the captured digits without validating month/day ranges, so `"2020-13-45"` parses "clean" and renders as-is rather than flagging tap-to-fix. Consistent with the deliberately-permissive parser philosophy, and ISO-prefix sort order is unaffected, so this is a minor data-quality note rather than a defect.
**Fix (optional):** Add a range check (or `Date` round-trip) if invalid calendar dates should surface the tap-to-fix state; otherwise leave as documented permissive behaviour.

---

_Reviewed: 2026-08-15T02:42:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
