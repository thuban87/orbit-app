# Phase 7 (Conversational Fuel) — Code Review

**Date:** 2026-08-15
**Reviewers:** codex (gpt-5.6-terra, read-only sandbox) + claude (read-only, subsystem-level)
**Scope reviewed:** full files on disk (not diff-scoped) — `src/db/fuel-dao.ts`(+test), `src/db/fuel-read.ts`(+test), `src/services/fuel-ranking.ts`(+test), `src/services/fuel-age.ts`(+test), `src/components/FuelEditor.tsx`, `src/components/RankedFuelLine.tsx`, `src/components/FuelSearchResultRow.tsx`, `src/screens/ContactProfileScreen.tsx`, `src/screens/FuelSearch.tsx`, `src/screens/SettingsScreen.tsx`, `src/navigation/{types,RootNavigator}.tsx`; cross-read `src/db/transaction.ts`, `src/db/mutex.ts`, `src/db/migrations/001-initial.ts`, `src/db/database.ts`, `src/db/purge-dao.ts`, `src/types.ts`, `src/services/AiService.ts`.

**Test status:** all 43 fuel tests pass (`fuel-dao`, `fuel-read`, `fuel-ranking`, `fuel-age`).

## Summary

**blockers=0  high=1  medium=3  low=2**

The phase is in strong shape. Every invariant in the review charter holds:

- **Single read choke point / no leak:** `getRankedFuel` (fuel-read.ts:104-110) and `searchFuel` (fuel-read.ts:171-191) both exclude `off_limits` AND `source='ai'` **in the SQL WHERE** (search does so in BOTH the snippet subquery and the EXISTS predicate) — never a UI `.filter()`. `getRankedFuel` also drops blank text in-query. `listFuelForEditor` is the only read that surfaces `off_limits`. `RankedFuelLine` consumes `rankedFuel[0]?.text` only. No off_limits / unconfirmed-AI path reaches a glanceable or search surface.
- **Ranking parity:** SQL `RANK_CASE` (fuel-read.ts:79-82) and pure `compareFuel` (fuel-ranking.ts:70-81) both derive from the one `FUEL_KIND_PRIORITY` constant; both order kind → `created_at DESC` (string-compared on both sides) → `id DESC`. A parity test over an eligible-only fixture (fuel-read.test.ts:307) locks it.
- **searchFuel SQL:** `LIKE ? ESCAPE '\'` on all three predicates; `escapeLike` escapes `\` first, then `%`, then `_` (fuel-read.ts:142-144); term `?`-bound ×3; empty/whitespace short-circuits to `[]`; one row per contact (SELECT over `contacts`); archived excluded (`archived_at IS NULL`).
- **Writer safety:** `*Core` (non-mutexed) + mutexed wrappers composed inside a single non-reentrant `inWriteTransaction` — cores never open a txn or take the mutex, so no nesting/deadlock. `assertOneChange` scoped by `(id AND contact_id)`. `confirmFuel` = one `UPDATE source='manual', modified_at=?` (no migration, no `ai_confirmed_at`). `TARGET_VERSION` still 1, migration list still `[migration001]` — **no new migration**. `uid` per row, every value `?`-bound, timestamps are caller-supplied `localDateTime()` (no `toISOString`). Fuel never writes `contacts.last_contact` (verified: no reference in fuel-dao.ts or the profile fuel handlers).
- **FuelEditor:** existing-row inputs are UNCONTROLLED (`defaultValue`, keyed by `item.id`, commit on `onEndEditing`); the new-item draft is the only persistent local state; off_limits + AI-unconfirmed treatments use existing theme tokens only (`borderStrong`/`accent`/`textSecondary`); no DAO import in any presentational component. blank→NULL normalized once at the `blankToNull` commit boundary.
- **No duplication / dead surfaces:** purge-dao's fuel count (:105) and delete (:188) are untouched (not re-implemented). Pre-existing dead surfaces (`src/types.ts:88 fuel?: string[]`, `AiService.ts:32 {{Conversational Fuel}}`) were correctly left un-wired — the new subsystem uses `FuelItem`, not `Contact.fuel`, and does not feed AiService (that is Phase 14). See LOW-2.

---

## Findings (most severe first)

### HIGH-1 — Concurrent field-blur edits can silently revert an edit
**Reviewers:** codex + claude (both flagged independently)
**File:** `src/screens/ContactProfileScreen.tsx:376-399` (`doEditFuel`), interacting with `src/components/FuelEditor.tsx:274,331-357`

`doEditFuel` rebuilds the *full* `(kind,label,text,url)` row by merging the single-field patch onto `current = fuel.find(...)`, where `fuel` is captured from the render closure. `onEdit` is invoked fire-and-forget (`void doEditFuel`) from each uncontrolled input's `onEndEditing` and immediately from the kind picker's `onSelect`. If a second field commits for the same row before the first `editFuel(...) → load()` round-trip has refreshed `fuel` state, the second write merges onto the **stale** snapshot and overwrites the first field back to its pre-edit value.

Concrete trigger: edit the text field, then tap the kind picker (or the label field) of the same row within the write+reload window — the kind/label commit re-writes `text` = stale-old, discarding the just-typed text. The mutex serializes the *writes* but cannot refresh the captured `fuel` snapshot between them. This is silent data loss of a user edit, which is exactly the data-layer correctness class the project treats as high-priority.

**Fix (owner/planner call on approach):** either (a) have `editFuel` update only the submitted field(s) — a patch-scoped `UPDATE` that sets only the keys present in `FuelEditPatch` (leaving the merge out of the UI entirely); or (b) serialize per-row edits and read the latest row snapshot inside the mutex-held write body rather than from the React closure. Option (a) is the cleaner structural fix and keeps `created_at` and other columns untouched.

---

### MEDIUM-1 — `fuel-age` calendar-day delta is wrong across spring-forward DST
**Reviewer:** codex (verified by claude)
**File:** `src/services/fuel-age.ts:80-83`

`days = Math.floor((startOfLocalDay(nowMs) - startOfLocalDay(createdMs)) / MS_PER_DAY)` divides *elapsed local-midnight milliseconds* by a fixed 24h. On a spring-forward day two consecutive local midnights are only 23h apart, so `floor(23h/24h) = 0`. A fuel item created the day before the transition, viewed the day after, reads **"today"** instead of "1 day ago" (verified: `2026-03-08 → 2026-03-09` yields `0.958 → 0`). Any span straddling spring-forward is also under-counted by one day. Cosmetic (age is display + ranking-tiebreak only — `created_at DESC` string ordering is unaffected), once per year, environment-dependent.

**Fix:** compute the day delta from calendar components, not elapsed ms — e.g. `Math.round((Date.UTC(ny,nm,nd) - Date.UTC(cy,cm,cd)) / MS_PER_DAY)` using the local Y/M/D of each stamp — and add a DST-boundary test case.

### MEDIUM-2 — Blank-text in-query filter misses non-ASCII / vertical whitespace
**Reviewers:** codex + claude
**File:** `src/db/fuel-read.ts:109`

`NULLIF(TRIM(text, char(9) || char(10) || char(13) || ' '), '')` only strips tab/LF/CR/space. A row whose text is only a vertical tab `char(11)`, form feed `char(12)`, or a non-breaking space (` `) survives the filter, can win ranking, and then `RankedFuelLine` (which uses JS `String.trim()`, a wider whitespace set) renders nothing — suppressing the real next-ranked item and showing an empty strip position. Narrow in practice: the UI `blankToNull` (`String.trim()`) already NULLs such input for user-typed rows; the exposure is AI-written rows (Phase 14) that are confirmed to `'manual'` and were never trimmed at the UI boundary.

**Fix:** extend the SQL TRIM character set to match the app's `String.trim()` acceptance (at minimum add `char(11)`, `char(12)`; consider `char(160)` for NBSP), and add coverage. Keep the choke point in SQL.

### MEDIUM-3 — New-item draft discarded even when the insert fails
**Reviewer:** codex
**File:** `src/components/FuelEditor.tsx:566-569` (`commitDraft`) with `ContactProfileScreen.tsx:348-370` (`doAddFuel`)

`commitDraft` calls `onAdd(draft)` (fire-and-forget) and immediately `setDrafting(false)`, unmounting the `DraftRow` and destroying its local `text/label/url` state. If `addFuel` later throws, the parent surfaces an alert but the user's typed content is already gone with no way to recover it.

**Fix:** have `onAdd` return a `Promise<boolean>` (or resolve/reject) and clear `drafting` only after a successful write + reload; on failure keep the draft mounted so the user can retry.

### LOW-1 — Uncontrolled row inputs don't reflect post-commit normalization until remount
**Reviewer:** claude
**File:** `src/components/FuelEditor.tsx:330,342,354`

Existing-row `TextInput`s use `defaultValue` keyed by `item.id`. After a blur commits a trimmed value (e.g. `"  hi  " → "hi"`) and `load()` returns the normalized text, the field is not remounted (same key), so it keeps displaying the user's raw pre-trim text until the next remount/reorder. Purely cosmetic — the persisted value is correct — and inherent to the (correct) uncontrolled-input choice; noted for awareness, no change recommended.

### LOW-2 — Pre-existing dead surfaces remain (expected, informational)
**Reviewer:** claude
**Files:** `src/types.ts:88` (`fuel?: string[]`), `src/services/AiService.ts:31-32` (`{{Conversational Fuel}}` prompt placeholder)

Both are legacy plugin-port remnants and were correctly **not** wired into the new subsystem (the new code uses `FuelItem` and does not feed AiService — AI is Phase 14). No action this phase; flagged only so they aren't mistaken for the new feature's integration points and to avoid a future reviewer wiring `Contact.fuel` by instinct.

---

## Verification notes
- `npx vitest run` over the four fuel suites: **43 passed**.
- Migration invariant: `TARGET_VERSION = 1` (database.ts:36); runner list is `[migration001]` (database.ts:106). No migration added.
- Transaction non-reentrancy: `inWriteTransaction` wraps `withMutex` + hand-rolled BEGIN/COMMIT/ROLLBACK (transaction.ts); fuel cores are plain `async (exec) => …` with no mutex/txn, so wrappers never nest.
- No `last_contact` write from any fuel path (grep-verified).
