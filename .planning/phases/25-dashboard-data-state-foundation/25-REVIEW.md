---
phase: 25-dashboard-data-state-foundation
reviewed: 2026-09-05T04:56:59Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - src/backup/backup-schema.ts
  - src/db/app-settings-dao.ts
  - src/db/dashboard-read.test.ts
  - src/db/dashboard-read.ts
  - src/db/database.ts
  - src/db/favourites-dao.ts
  - src/db/migrations/019-dashboard-prefs.ts
  - src/logic/dashboard-empty-logic.test.ts
  - src/logic/dashboard-empty-logic.ts
  - src/logic/dashboard-query-logic.test.ts
  - src/logic/dashboard-query-logic.ts
  - src/navigation/widget-linking.ts
  - src/screens/DigestScreen.tsx
  - src/screens/HomeScreen.tsx
  - src/screens/SettingsScreen.tsx
  - src/services/widget/widget-data.ts
  - src/services/widget/widget-quick-action-guard.ts
  - src/stores/dashboard-query-store.test.ts
  - src/stores/dashboard-query-store.ts
  - src/stores/dashboard-session-store.test.ts
  - src/stores/dashboard-session-store.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-09-05T04:56:59Z
**Depth:** deep
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the Phase 25 "dashboard data & state foundation": migration 019, the
`app_settings` DAO extension, the shared dashboard query-logic + read chokepoint,
the two new Zustand stores, the empty-state gate, the widget favourites shaper,
and the surface-retirement edits to Home/Digest/Settings. I read the full files
on disk (not the diff), grepped every reader/writer of the columns involved, and
traced the call chains across `dashboard-query-logic → dashboard-read →
HomeScreen/widget-data` and `app-settings-dao → dashboard-query-store`.

Verdict: the correctness-critical surface is sound. No BLOCKER-class defect was
found. Specifically I verified and confirm HOLDING:

- **Migration 019 is irreversibility-safe.** Additive `ALTER TABLE ADD COLUMN`
  only; every new column is `NOT NULL` with a `DEFAULT` that satisfies its own
  `CHECK`; no prior migration is edited; `TARGET_VERSION` bumped 18→19 and
  `migration019` is registered last in `MIGRATIONS`; no assumption about the
  starting row state beyond `app_settings` existing (guaranteed since migration
  002). The full-`MIGRATIONS` store test exercises it on node-sqlite.
- **D-05 holds:** `include_unbound_never_contacted` survives as the
  `AppSettings` key, the `AppSettingsRow` column, a `COLUMN_OF`/`TOGGLE_FIELDS`
  writable, and a `PORTABLE_SETTINGS_KEYS` entry; only the Settings UI row was
  removed (comment at SettingsScreen.tsx:1148-1153).
- **D-13 holds:** `listDashboard` Branch 1 (term) gained `AND
  ${DASHBOARD_BOUND_WHERE}` only; `BASE_WHERE` and every other branch are
  byte-unchanged (git-confirmed + a byte-lock test at dashboard-read.test.ts:834).
  No `searchUnbound` was added.
- **`countNeverContacted` is still exported** (dashboard-read.ts:527) and
  consumed by DigestScreen (import + `Promise.all` backlog read).
- SQL is fully parameterized (every runtime id/value is `?`-bound; only closed
  code-constant fragments are interpolated); dates use `date('now','localtime')`
  / `formatLocalDate()` (no `toISOString`); colours resolve through theme tokens
  (no hex literals in the changed screens/widget); reads are async on-device
  SQLite with no network on the read path.
- Retired `NeverContacted` route is fully removed; `navigate("Home")` from both
  Digest and Home resolves inside the same `DashboardStack` (no dangling target).

The findings below are two WARNINGs (a load-bearing doc/code contradiction and an
owner-accepted dead control) and three INFO nits.

## Warnings

### WR-01: First-run gate doc comment says "ALL FOUR" but the gate requires FIVE populations empty

**File:** `src/logic/dashboard-empty-logic.ts:27, 30, 167`
**Issue:** The `firstrun` decision at lines 169-176 checks **five** counters
(`live === 0 && neverContacted === 0 && snoozed === 0 && archived === 0 &&
unbound === 0`). The header comment is internally contradictory: line 25 correctly
says "ALL FIVE empty", but lines 27, 30, and the inline comment at line 167 all
say "ALL FOUR". This is a load-bearing gate — the `unbound === 0` clause is what
keeps an all-Unbound install from showing "Add your first contact" (there is even
a locking test: dashboard-empty-logic.test.ts:186 "an all-Unbound install is
hidden, never first-run"). A maintainer who trusts the "FOUR" comments could drop
`unbound === 0` as "an extra clause the docs don't mention," silently
reintroducing the first-run mislabel for an all-Unbound user. Not a runtime bug
today, but a genuine correctness-regression trap in a documented invariant.
**Fix:** Make the comment agree with the code — replace the three "ALL FOUR"
references with "ALL FIVE" and enumerate the fifth counter:
```
// (4) The unfiltered default list: first-run ONLY when ALL FIVE populations
//     (live, neverContacted, snoozed, archived, unbound) are empty; otherwise
//     the people exist in a hidden bucket → point the user there.
```

### WR-02: HomeScreen "Not yet contacted" footer is a no-op self-navigation (dead control)

**File:** `src/screens/HomeScreen.tsx:417`
**Issue:** The footer entry renders `Not yet contacted (${counts.neverContacted})`
with `onPress={() => navigation.navigate("Home")}`. On HomeScreen the current
route already *is* `Home`, so React Navigation treats the navigate as a no-op —
tapping the row (which can advertise a non-zero count and looks actionable) does
nothing visible. This is distinct from the DigestScreen backlog tap, where
`navigate("Home")` is a real pop back to the dashboard. The code comment marks it
as the owner-accepted D-14 one-phase gap (the Not-Contacted chip lands in Phase
26), so this is surfaced for visibility, **not** as an escalation — it is honoring
a recorded decision, not reversing one. Flagging so the human can confirm the dead
tap is acceptable interim UX rather than an accidental regression.
**Fix:** If a visible affordance is undesirable in the interim, either drop the
`Pressable` to a non-interactive `View`/`Text` row for the one-phase gap, or make
it scroll-to-top / open the not-contacted population once Phase 26 lands. No code
change required if the owner is content with the documented D-14 gap.

## Info

### IN-01: `readIncludeUnboundNeverContacted` reads the setting, discards it, and returns void

**File:** `src/db/dashboard-read.ts:466-475`
**Issue:** The helper runs a full `SELECT include_unbound_never_contacted ...`
solely to throw if the `id=1` row is missing, then discards the value; the actual
list/count queries re-read the same flag via a correlated subquery. The name reads
like an accessor ("read ... never contacted policy") but returns `Promise<void>`,
and the value is fetched twice per call. Defensible (it makes a missing settings
row a loud failure rather than a silent Unbound exclusion), but the double-read and
void-returning "read" name are mildly misleading.
**Fix:** Either rename to `assertAppSettingsRowExists`, or have it return the flag
and let `listNeverContactedWithPolicy` / `countNeverContacted` bind it as a `?`
param instead of re-issuing the correlated subquery.

### IN-02: New stores and the deprecated read have no runtime consumer yet (intentional foundation)

**File:** `src/stores/dashboard-query-store.ts`, `src/stores/dashboard-session-store.ts`, `src/db/dashboard-read.ts:459` (`listNeverContacted` `@deprecated`)
**Issue:** `useDashboardQueryStore` and `useDashboardSessionStore` are exercised
only by their tests (grep-confirmed: no non-test importer), and `listNeverContacted`
is `@deprecated` with no runtime caller. This is consistent with the phase being a
foundation whose renderers land in Phases 26-28, and the retention is documented
in-code — noting it only so a future dead-code sweep does not remove them
prematurely (they mirror the `sortExpr()` "required route, no consumer yet"
pattern in CLAUDE.md).
**Fix:** None required this phase; ensure the Phase 26 render plans actually wire
`useDashboardQueryStore`/`useDashboardSessionStore` and retire `listNeverContacted`
so these do not rot.

### IN-03: `parseStoredState` partial-parse asymmetry on malformed prefs

**File:** `src/stores/dashboard-query-store.ts:39-49`
**Issue:** `populations` and `filters` are parsed in one `try` block. If
`dashboardPopulations` parses but `dashboardFilters` throws, `populations` keeps
its parsed value while `filters` falls back to `{}` — a half-applied recovery. The
migration seeds valid `'[]'`/`'{}'` defaults so this only arises from external
corruption, and the fallback is safe (empty axes), so this is a robustness nit, not
a bug.
**Fix:** If strict all-or-nothing recovery is wanted, parse each field in its own
`try`, or reset both to defaults on any parse failure.

---

_Reviewed: 2026-09-05T04:56:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
