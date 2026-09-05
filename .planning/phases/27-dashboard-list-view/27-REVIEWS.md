---
phase: 27
reviewers: [codex, claude]
reviewed_at: 2026-09-05T23:26:37Z
cycle: 5
plans_reviewed: [27-01-PLAN.md, 27-02-PLAN.md, 27-03-PLAN.md, 27-04-PLAN.md, 27-05-PLAN.md, 27-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8 (in-harness read-only source-grounded lane)"
model_sources:
  codex: "banner"
  claude: "self"
cycle_summary:
  current_high: 1
  current_actionable: 1
---

# Cross-AI Plan Review — Phase 27 (Dashboard List View), Cycle 5 (final)

## Consensus Summary

Both reviewers independently read the six plans against the code on disk and reached
the same conclusion: the plans are unusually thorough and, apart from a single
execution-affecting defect, execution-ready. Every load-bearing `file:line` claim the
plans cite was verified true on disk (migration head 019 / `TARGET_VERSION = 19`;
`DashboardRow` lacks `last_contact`/`snooze_until`; `fuel-age.ts` parser/day-math
private at :33/:65; `resolveVisibility` memories-read.ts:101; `resolveRelationshipVisibility`
relationships-read.ts:39; `is_current` current-state-history-read.ts:31/:48; corpus read's
`deleted_at`-only filter + per-contact `getValuesForContact` N+1 at :281; `LogContact`/`Edit`
routes DashboardStack.tsx:37/:57 with no `EditContact`; Quick Log Success haptic
UniversalFab.tsx:255 vs dial-open Light impact :165; `STATUS_LABEL` private StatusGlyph.tsx:37;
`favorite` registry still heart at icon-registry.ts:37; `renderItem` reads
`item.favourite_rank !== null` at HomeScreen.tsx:688). All cycle-1→cycle-4 resolutions
(C1–C4) were re-verified and still hold. The known false positive (BASE_WHERE "does not
exist") did not recur; BASE_WHERE is present at dashboard-read.ts:172.

One NEW execution-affecting concern surfaced this cycle, found by Codex and confirmed by
Claude against source: **Plan 04's optimistic-favourite SUCCESS path clears the overlay
while nothing refreshes the base `rows` state, so the star visibly reverts after every
successful toggle.** This is not a re-raise of any prior finding — cycle-3 MED #5 fixed the
overlay surviving a *reload race*, and cycle-4 HIGH fixed the *React-state binding*; neither
addressed what happens on a clean success when no reload is triggered at all.

### Agreed Strengths
- Plan 01 widens the real shared read chokepoint (not per-row queries); the DST-safe
  calendar-day extraction from the private `fuel-age.ts` helpers into `dates.ts` is
  necessary and correctly scoped (both reviewers).
- Plan 02 correctly identifies migration head 019 → standalone 020; the one-way schema
  change is human-gated (blocking-human checkpoint).
- Plan 03's batched `contact_id IN (...)` read with per-contact `ROW_NUMBER` bound +
  visibility over-fetch/re-cap is a sound starvation guard; current-state `is_current = 1`
  predicate correctly required.
- Plan 05 targets the real navigation routes and preserves the FAB's Success-on-write
  haptic semantics (single-sourced `runQuickLog`).
- Plan 06 fixes real privacy (hidden/outdated leak) and performance (custom-value N+1)
  defects in the corpus reader *before* wiring it into visible search, via the existing
  visibility choke points and a quarantine-preserving JOIN.

### Agreed Concerns
- **HIGH (Claude) / MEDIUM (Codex) — Plan 04 favourite SUCCESS path reverts the star.**
  On a successful toggle, `resolve(...)` drops the overlay ("so reload truth shows"), but
  `setFavouriteRank`/`clearFavouriteRank` bump only `bumpDataRevisionCore` (favourites-dao.ts:49/:76),
  NOT `bumpShellRefresh`, and HomeScreen's `reload()` fires only on focus / AppState-active /
  pull / shell-refresh (HomeScreen.tsx:341-376) — never on a data-revision bump (the
  shell-refresh store comment at shell-refresh-store.ts:14-16 explicitly notes data-revision
  is the change channel dashboard reads *avoid*). So after the write resolves, the star reads
  `overlayFor(id) ?? (item.favourite_rank !== null)` = `undefined ?? staleBase` and flips back
  to the pre-toggle value, staying wrong until an unrelated reload. This defeats LISTV-04's
  "immediate fill/unfill" on the common happy path for both favourite and unfavourite.

### Divergent Views
- **Severity of the Plan 04 finding.** Codex rates it MEDIUM ("reduced to LOW after the
  correction") on the grounds that it is localized and the DB value is correct — only the
  in-memory display is stale. Claude rates it HIGH: it fires on *every* successful toggle
  (not an edge case), it is user-visible, the star does not merely fail to update but
  visibly *reverts*, and it stays reverted until an unrelated reload event — a core-requirement
  (LISTV-04) behavior appearing broken in normal use. The disagreement is only about the
  label; both agree it is real, execution-affecting, source-confirmed, and must be fixed in
  Plan 04 before execution. It is NOT a decision reversal (the fix preserves the intended
  immediate-durable-star behavior; it touches no ADR / HANDOFF / D-NN).

---

## Codex Review

*Model: gpt-5.6-terra (reasoning=low), banner-resolved. Source-grounded lane (prompt-fed, repo-accessible).*

## Summary

The six plans are unusually thorough and largely execution-ready. They trace real repository seams correctly: the shared dashboard read lacks the proposed recency/snooze fields, HomeScreen owns the single cancellation-aware reload path, migration head is 019, and the current knowledge-search reader has the visibility/N+1 gaps Plan 06 addresses. One execution-affecting issue remains in Plan 04's optimistic-favourite success reconciliation.

## Strengths

- Plan 01 correctly widens the real shared read chokepoint rather than querying per row. `DashboardRow` currently lacks both `last_contact` and `snooze_until` at `dashboard-read.ts:91`, while both population and search projections are the appropriate shared insertion points at `dashboard-read.ts:368` and `dashboard-read.ts:421`.
- The local-calendar refactor is necessary and correctly scoped. The existing DST-safe parser/day calculation is private in `fuel-age.ts:33` and `fuel-age.ts:65`; extraction to `dates.ts` avoids a duplicate implementation.
- The planned ListRow status behavior respects the source primitive. `ringVisual()` currently varies width by status at `contact-card-ring.ts:45`, so deliberately consuming only its color with a constant row border width correctly implements the Phase 27 decision.
- Plan 02 accurately identifies a standalone migration. The repo currently ends at migration 019 and has `TARGET_VERSION = 19` in `database.ts:54`, with 019 already owning dashboard preferences at `019-dashboard-prefs.ts:10`.
- Plan 03's batch-read direction is sound. The existing corpus reader already uses `IN (...)` placeholder construction at `knowledge-search-read.ts:86`, while current-state history demonstrably requires a current-row predicate. The plan's per-contact `ROW_NUMBER` plus visibility over-fetch/re-cap is an appropriate guard against starvation.
- Plan 05 correctly targets real navigation names: `LogContact` and `Edit` exist in `DashboardStack.tsx:37` and `DashboardStack.tsx:57`. It also correctly preserves the existing Quick Log success haptic semantics: the FAB emits notification success only after `recordTouchpoint` resolves at `UniversalFab.tsx:247`.
- Plan 06 addresses real privacy and performance defects before wiring corpus search into visible UI. The existing corpus reader returns relationships with only `deleted_at IS NULL` at `knowledge-search-read.ts:99`, memory rows with the same incomplete filtering at `knowledge-search-read.ts:124`, and performs one `getValuesForContact` call per contact at `knowledge-search-read.ts:281`. The planned visibility choke points, batched custom-value query, and quarantine-preserving join are warranted.

## Concerns

- **MEDIUM — Plan 04 clears the optimistic overlay on success before the row's base state is updated.** The proposed rule is to clear the overlay on the latest success and rely on subsequent reload truth. But HomeScreen renders favourite state directly from `item.favourite_rank !== null` today at `HomeScreen.tsx:688`, and `reload()` replaces the entire rows array only when its independently triggered read completes at `HomeScreen.tsx:282` and `HomeScreen.tsx:313`. `setFavouriteRank`/`clearFavouriteRank` update SQLite and data revision but do not publish HomeScreen's shell refresh at `favourites-dao.ts:32` and `favourites-dao.ts:59`.

  Mechanism: after a successful mark, clearing `overlayFor(id)` immediately makes the star read the stale in-memory `favourite_rank` value again, so it visibly flips back until a future focus/refresh reload. The same issue occurs for un-favouriting.

## Suggestions

- Fix Plan 04's success path explicitly. Either:
  - atomically patch the matching `rows` entry's `favourite_rank` membership before clearing the overlay; or
  - retain a settled overlay until a post-write refresh has returned and confirmed the database value, with generation-aware reconciliation.

  The first is simpler: on latest success, update the local base row to a non-null sentinel for favourite or `null` for unfavourite, then clear the reactive overlay. Keep the existing generation guard for stale settlements and reload races.
- Add a unit test for this exact sequence: base membership `false` → `begin(true)` → latest successful resolve → rendered membership remains `true` without requiring `reload()`.
- Plan 01's `isSnoozed()` should fail closed (`false`) for malformed non-null stored date text, matching SQLite's `date(...) > date(...)` behavior rather than allowing a renderer exception. The schema stores `snooze_until` as unconstrained `TEXT` in `001-initial.ts:77`, even though normal writers use valid local dates.

## Risk Assessment

**Overall: MEDIUM, reduced to LOW after the Plan 04 reconciliation correction.**

The migration is correctly human-gated, privacy-sensitive search work is explicitly protected, and dependency ordering is coherent. The remaining favourite-success issue is user-visible and directly violates the intended immediate, durable star state, but it is localized to Plan 04 and has a straightforward, testable fix.

---

## Claude Review

*Model: claude-opus-4-8, in-harness read-only source-grounded lane. The `claude -p` CLI lane
was not spawned (this review is itself running inside Claude Code — the workflow skips the
self-CLI for independence, and the owner pre-authorized performing the Claude lane in-session
as a read-only, source-grounded analysis aggregated here). Every finding below was checked
against the actual files on disk, not the plan text.*

### Summary

I read all six PLAN.md files in full and verified every load-bearing `file:line` claim plus
each of the C1–C4 resolutions against the code on disk. The plans are execution-ready with a
single exception. The cycle-4 HIGH (overlay held in React state via `useSyncExternalStore`/
`useState`, `renderItem` deriving the star from `overlayFor(id) ?? (favourite_rank !== null)`)
is correctly incorporated into Plan 04, verified against HomeScreen.tsx:688. The one remaining
defect is a NEW angle on the same optimistic-favourite machinery, independently found by Codex
and confirmed below.

### Verification of prior-cycle resolutions (all HOLD)
- C1: relevance-first search (D-12/DASHQ-09) preserved in Plan 06 (`composeDashboardSearch`
  preserves `searchDashboard()` order; fuel-only appended after) — dashboard-search-match.ts:128
  ("Relevance remains primary") + sort at :140-142 confirm the engine ranks coverage→score→
  Dashboard-tiebreak. Plan 03 `is_current = 1` confirmed (current-state-history-read.ts:31/:48).
  Plan 04 line-3 folded into cancellation-aware `reload()` confirmed (HomeScreen.tsx:282/:312/:313).
- C2: Plan 06 corpus hidden/outdated exclusion via `resolveVisibility`/`resolveRelationshipVisibility`
  + `outdated` drop, batched custom-value read (replacing the :281 N+1), and `viewMode === "list"`
  gating all match source facts (`reload()` currently branches on TERM not viewMode at
  HomeScreen.tsx:301-302 — the gate Plan 06 adds is correct and necessary). Plan 03 per-contact
  ROW_NUMBER bound confirmed. Plan 05 typed nav (`LogContact`/`Edit`, no `EditContact`) confirmed.
- C3: Plan 01 `widget-data.test.ts` `row()` fixture (:22-40) is a typed `DashboardRow` literal
  that WILL break `tsc` on the additive widen — the fix is real and necessary. Plan 05 haptic
  prose (Success-on-write only) matches UniversalFab.tsx:255 vs :165. Plan 04 `statusDisplayLabel`
  export matches the private `STATUS_LABEL` at StatusGlyph.tsx:37. Plan 06 quarantine JOIN +
  live-def-id restriction matches field-values-dao.ts:31 + knowledge-search-read.ts:206.
- C4: Plan 04 overlay-in-React-state (not `useRef`) + `renderItem` derivation verified against
  HomeScreen.tsx:688. Plan 03 over-fetch+re-cap around the TS visibility filter present.
  Plan 05 `runQuickLog(deps)` testable core present.
- Known false positive did NOT recur: BASE_WHERE exists (dashboard-read.ts:172-175).

### Concerns

- **HIGH — Plan 04 optimistic-favourite SUCCESS path reverts the star (no reload is triggered
  by a favourite write).** Verified mechanism against source:
  1. `setFavouriteRank`/`clearFavouriteRank` (favourites-dao.ts:32-51 / :59-76) perform the
     UPDATE + `bumpDataRevisionCore(exec)` ONLY. They do **not** call `bumpShellRefresh`.
  2. HomeScreen's `reload()` is re-invoked only by `useShellRefresh(reload)` (HomeScreen.tsx:341),
     `useFocusEffect` (:344), AppState→active (:356), and pull-to-refresh (:372). `useShellRefresh`
     fires on the shell-refresh-store `revision` bump (shell-refresh-store.ts:18-27), which is
     bumped only by `bumpShellRefresh()` (:29-30) — e.g. the Quick Log path (UniversalFab.tsx:211).
     A `bumpDataRevisionCore` write is deliberately NOT a shell-refresh (store doc comment :14-16).
  3. Therefore a successful favourite write triggers **no** HomeScreen reload, so `rows` keeps the
     pre-toggle `favourite_rank`.
  4. Plan 04's rule clears the overlay on latest success ("drop overlay so reload truth shows";
     acceptance test asserts `overlayFor(id) === undefined` after a success resolve). With the
     overlay gone and the base stale, `renderItem`'s `overlayFor(id) ?? (item.favourite_rank !== null)`
     (HomeScreen.tsx:688, per Plan 04) reads the STALE base and the star flips back — on every
     successful toggle, both favourite and unfavourite, until an unrelated reload.

  This is distinct from cycle-3 MED #5 (reload *race* — overlay must survive an overlapping reload)
  and cycle-4 HIGH (React-state *binding*). It is the clean-success case with no reload at all.
  It defeats LISTV-04's "immediate fill/unfill" durability on the happy path.

  Required PLAN.md change (planner's implementation choice; not a decision reversal): on a latest
  success, make the base truth reflect the committed write before/instead of clearing the overlay —
  e.g. (a) patch the matching `rows` entry's `favourite_rank` membership atomically on success, then
  clear the overlay; or (b) treat the settled overlay as authoritative until a confirming reload; or
  (c) `bumpShellRefresh()` after the favourite write so `reload()` re-reads the DB truth. Keep the
  existing generation guard. Add a test: base `false` → `begin(true)` → latest success resolve →
  rendered membership stays `true` without a `reload()`.

- **LOW (actionable) — Plan 01 `isSnoozed()` should fail closed on unparseable `snooze_until`.**
  Plan 01 mandates `isSnoozed` reuse "the SAME local-ms parsing as the calendar-day helper." That
  parser (`parseLocalMs`, fuel-age.ts:37-39) **throws** on unparseable input. `snooze_until` is
  unconstrained `TEXT` (migration 001), so a malformed non-null value would throw inside a FlatList
  `renderItem` cell rather than failing closed like the SQL predicate it claims to mirror
  (`date(snooze_until) > date('now','localtime')`, which yields false/NULL on garbage). Writers are
  controlled and a storage contract exists (dashboard-read.ts:33), so the probability is low — but
  the divergence from the mirrored SQL semantics is invisible to the executor unless the plan adds
  it. Add one line to `isSnoozed`'s spec/test: return `false` on unparseable input (parity with the
  SQL predicate), rather than propagating a parser exception.

### Risk Assessment

**Overall: MEDIUM before the Plan 04 fix, LOW after.** Dependency ordering (5 waves) is coherent,
the one-way migration is human-gated, local-first/privacy invariants are actively strengthened
(Plan 06 corpus exclusions, quarantine boundary), theme-token and no-animation-from-state rules
are honored (the discrete favourite toggle in React state is the correct sanctioned exception,
not a violation), and `formatLocalDate`/local-calendar discipline is enforced. The single HIGH is
localized to Plan 04's success reconciliation and has a straightforward, testable fix; the LOW is a
one-line robustness/parity addition. No decision-reversal escalation triggers were found — no
finding deletes, weakens, or inverts any ADR / HANDOFF / DASHQ / LISTV / D-NN decision.
