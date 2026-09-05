---
phase: 27
cycle: 2
reviewers: [codex, claude]
reviewed_at: 2026-09-05T00:00:00Z
plans_reviewed: [27-01-PLAN.md, 27-02-PLAN.md, 27-03-PLAN.md, 27-04-PLAN.md, 27-05-PLAN.md, 27-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=medium)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "in-session-orchestrator"
---

# Cross-AI Plan Review — Phase 27 (Cycle 2)

> Cycle 2 of the plan-review convergence loop. Plans were revised (commit 6d41224) to address the four cycle-1 HIGHs. Both lanes reviewed the revised plans against the source on disk. The Claude lane was produced by the orchestrating Claude Code session as a read-only, source-grounded analysis (the `claude -p` CLI sub-lane was bypassed in favour of the in-session reviewer, per the owner-approved fallback for this run); the Codex lane ran via `codex exec` (read-only sandbox, gpt-5.6-terra, reasoning=medium).

## Consensus Summary

Both reviewers agree the revised six-plan sequence is substantially stronger than cycle 1 and that **all four cycle-1 HIGHs are FULLY RESOLVED at the plan level, each verified against source** (not merely against the plan's self-description):

- **HIGH #1 (D-12 / DASHQ-09 relevance-first):** `searchDashboard()` sorts coverage → score → Dashboard-rank tie-break (`dashboard-search-match.ts:131-150`, doc comment :127-130); Plan 06 preserves that order for corpus matches and appends fuel-only (`match === null`) matches in Dashboard order with a defined + tested merge rule. Enforces DASHQ-09; not a reversal.
- **HIGH #2 (is_current=1):** canonical current-state reads filter `is_current = 1` (`current-state-history-read.ts:31,:48`); `current_state_entries` retains history. Plan 03 adds the predicate + an `is_current=0`-never-returned regression test.
- **HIGH #3 (async line-3 in cancellation-aware reload):** `HomeScreen.reload()` cancellation structure is exactly as cited (`:283` cancelled flag, `:312` guard, `:313` setRows). Plan 04 folds line-3 into that same flow, committed atomically under the same guard.
- **HIGH #4 (golden test on listDashboardSearch):** `listDashboardSearch` structure at `dashboard-read.ts:398-446` confirmed; Plan 06 requires a byte-for-byte golden/snapshot test locking rows/order/snippet across the scope-helper extraction, explicitly beyond "existing tests stay green."

However, the Codex lane surfaced **two NEW HIGH concerns**, both independently verified against the code by the Claude lane, that block approval until addressed. Neither is a decision reversal — both are correctness/privacy gaps not previously flagged:

1. **Plan 06 — hidden/outdated corpus leakage.** `listKnowledgeSearchCandidates` (the previously-unwired corpus reader Plan 06 wires into visible List search) filters only `deleted_at IS NULL` on memories (`knowledge-search-read.ts:135`, plus type) and only `deleted_at IS NULL` on relationships (:104). `memories` has `hidden` and `outdated` columns and `relationships` has `hidden` (migration `016-contact-knowledge.ts:22-23,:40`), so wiring this reader surfaces content the user deliberately hid or marked outdated — inconsistent with line-3 (Plan 03) and fuel, both of which exclude those. Plan 06's threat model T-27-11 ("reads only live, user-facing entries") is **false against current code**.
2. **Plan 03 — per-source `LIMIT` does not bound per contact.** A `LIMIT N` on a `contact_id IN (...)` batch query caps the whole result set, not each contact, so contacts later in SQL order receive zero candidates and wrongly render a completeness prompt despite having knowledge. The plan's own boundedness acceptance test seeds a **single** contact and would not catch the multi-contact failure.

### Agreed Strengths (2+ reviewers)

- Additive read widening is correctly scoped; `DashboardRow` currently lacks `last_contact`/`snooze_until` while `contacts` already carries them and drives the predicates — projecting without touching Active exclusions is right (`dashboard-read.ts:91-113`).
- Status treatment correctly avoids the escalating border width (`ringVisual` returns 2/3/4/3 at `contact-card-ring.ts:45`) and correctly guards the null glyph (`StatusGlyph` renders neutral for null).
- Migration 020 is correct head+1 (`TARGET_VERSION=19`, head `019-dashboard-prefs.ts`), gated behind a blocking-human one-way-door checkpoint, and re-verified at execution time.
- Plan 02's DAO route faithfully mirrors the shipped `dashboardSort` precedent, including the MED #2 optional-key writability trap (`app-settings-dao.ts:224,:229,:255`); allowlist-now/emit-later matches the Phase 25 precedent with no unauthorized `BACKUP_FORMAT_VERSION` bump.
- ADR-075 binary favourites respected: `setFavouriteRank`/`clearFavouriteRank` used strictly as binary mark/clear; the List never sorts by rank and never calls `listFavourites`.
- Plan 05 correctly single-sources Quick Log (`runQuickLog`) so FAB and swipe cannot diverge; both lanes confirm the FAB path (undo/snackbar/haptic/widget+shell refresh) is the right thing to extract.
- Plan 06's ordering fix is correctly grounded in the real scorer; both lanes confirm the corpus modules are genuinely unwired (no `src/` consumer) so wiring them is legitimately part of this phase.

### Agreed Concerns (2+ reviewers)

- **Plan 05 nav targets must be named/typed.** The real Dashboard routes are `Edit` and `LogContact` (`DashboardStack.tsx:37,:57`) — there is no `EditContact` route. "screen+params" leaves an executor room to target a non-existent screen. (Codex MED; Claude flagged the same routing family.)
- **Plan 05 `runQuickLog` extraction shape is under-specified.** `UniversalFab.logContact` is hook/ref-bound (single-flight `useRef`, snackbar/haptic context); a plain `src/services` function cannot call those hooks and a module-scoped single-flight guard changes semantics from per-instance to global. The injection boundary (hook vs injected deps) should be named. (Claude LOW/MED; Codex implicitly via the extraction concern.)

### Divergent Views

- **Severity of the two new findings.** Codex rates both Plan 03 (per-contact bound) and Plan 06 (hidden/outdated leakage) as HIGH. The Claude lane concurs on both after verifying them against source — the leakage is an information-disclosure gap under the local-first privacy posture, and the per-contact bound is a correctness defect the plan's own test would miss. No divergence on disposition: both are unresolved HIGHs, both actionable in-plan, neither a decision reversal.
- **Plan 04 optimistic-favourite race.** Codex raises a per-contact in-flight/generation rule for rapid double-taps (MED); the Claude lane did not independently raise it but agrees it is a legitimate, cheap-to-address gap.

---

## Codex Review

<!-- gpt-5.6-terra (reasoning=medium), via codex exec, read-only sandbox, source-grounded. -->

## Summary

The revised six-plan sequence is substantially stronger and addresses all four Cycle-1 HIGH findings at the plan level. The main remaining blockers are (1) Plan 03's supposed per-contact bounded read is not actually guaranteed by a plain SQL `LIMIT`, and (2) Plan 06 would wire an existing corpus reader that currently includes hidden/outdated knowledge. Fix those before execution.

## Plan 01 — Tracer

Strengths

- The additive read projection is correctly scoped: `DashboardRow` currently lacks both fields at `dashboard-read.ts:91`, while `contacts.last_contact` and `contacts.snooze_until` already drive the dashboard predicates. Adding projections without changing the Active exclusions preserves semantics.
- The status plan correctly avoids the legacy escalating border width: `ringVisual()` returns widths 2/3/4/3 at `contact-card-ring.ts:45`, so the plan's constant row-border width is necessary.
- The null-glyph guard is necessary and correctly identified: `StatusGlyph` renders a neutral glyph for null, contrary to the List requirement.

Concerns

- **MEDIUM:** The plan says to "reuse" the DST helpers from `fuel-age.ts`, but both `parseLocalMs` and `calendarDaysBetween` are private functions (`fuel-age.ts:33,:65`; only `formatFuelAge` is exported at :92). This cannot be done as written without exporting/refactoring them or duplicating logic.

Suggestions

- Extract a shared exported local-calendar-day helper into `src/utils/dates.ts`, then have both fuel age and list recency use it. Keep `formatLocalDate()` as the local-date renderer.

Risk: **MEDIUM** — sound tracer scope, but correct DST reuse needs an explicit implementation seam.

## Plan 02 — Swipe Preference Migration

Strengths

- Migration 020 is correctly next on disk (`TARGET_VERSION = 19`, `migration019` last in the ordered registry).
- The DAO route correctly follows the writable-patch architecture (`AppSettingsPatch` derives from `PortableSettingsSnapshot`; dashboard fields enumerated in `WritableSettingsKey`).
- Allowlist-now/emit-later matches the existing dashboard-preference precedent.

Concerns

- **LOW:** Allowlisting alone does not validate restored values; `assertPortableSettings()` checks only key membership and secret-shaped names. The SQLite CHECK is the durable backstop, but the Phase 36 restore-format work must add value validation. (Plan already states this.)

Suggestions

- Add an explicit migration test for a database that has an `app_settings` singleton from a genuinely early schema version, not merely a freshly bootstrapped latest-schema fixture.

Risk: **LOW** — appropriate irreversible-change checkpoint and a well-established pattern.

## Plan 03 — Line-3 Data and Selection

Strengths

- Correctly accounts for retained current-state history (`is_current = 1`, matching `current-state-history-read.ts:31,:48`).
- The chosen source set matches the phase research's adaptive-line corpus: memories, relationships, current-state entries.
- The registry change is correctly single-source (`favorite` is presently a heart pair).

Concerns

- **HIGH:** "A per-source `LIMIT`" does not create a bounded candidate budget per contact. With `contact_id IN (...)`, a plain `LIMIT 10` caps the entire source query, so contacts later in SQL order receive no candidate at all. This violates the plan's own "per contact" claim and can incorrectly show completeness prompts despite available knowledge.
- **MEDIUM:** The proposed candidate shape omits a stable candidate `id`, while the selection contract requires stable-ID tie-breaking. The pure selector should not depend on accidental input ordering.
- **LOW:** `current_state_entries` has no `hidden`, `outdated`, or `deleted_at` columns; the plan should state exclusions per source, rather than implying those predicates apply universally.

Suggestions

- Use a `ROW_NUMBER() OVER (PARTITION BY contact_id ORDER BY …)` subquery and filter `row_number <= candidateBudget`; add a multi-contact regression test.
- Include `id` and `createdAt` in candidates, then define selector ties explicitly.
- Document source-specific filters: memories use hidden/deleted/outdated, relationships use hidden/deleted, current state uses `is_current = 1`.

Risk: **HIGH** until the per-contact bound is corrected.

## Plan 04 — Row Content, Favourite, Accessibility

Strengths

- Folding async line-3 loading into the existing cancellation-aware `reload()` is the right design (`HomeScreen.tsx:282,:312`).
- Binary favourite writes use the established single-column transactional DAO ops (`favourites-dao.ts:32,:59`).
- Accessibility labels reuse the real status terms (`StatusGlyph.tsx:37`).

Concerns

- **MEDIUM:** The optimistic favourite plan lacks a per-contact in-flight/sequence rule. Rapid double taps can leave an older failed write reverting a newer optimistic choice. DAO write serialization does not by itself prevent stale UI failure handlers from overwriting newer local state.
- **LOW:** The stale-load invariant is excellent, but no HomeScreen test file is in the plan's modified files. The acceptance criterion should require a focused test around cancellation/state commit, not only a code-reading assertion.

Suggestions

- Track a per-contact mutation generation; revert only when the failed request still owns the latest generation.
- Add a HomeScreen reload-controller extraction or test seam that proves cancelled line-3 work cannot commit state.

Risk: **MEDIUM** — architecture sound; optimistic-write races need an explicit rule.

## Plan 05 — Swipe Gestures

Strengths

- Correctly uses the installed Reanimated `ReanimatedSwipeable` with worklet-backed action renderers.
- Extracting Quick Log avoids a second `recordTouchpoint` path; the current FAB path includes undo, snackbar, haptics, widget refresh, and shell refresh (`UniversalFab.tsx:198-276`).
- Root navigation is correctly required for Edit: the actual Dashboard route is `Edit`, not an `EditContact` route (`DashboardStack.tsx:57`).

Concerns

- **MEDIUM:** The plan should explicitly name the navigation targets and type them: `LogContact` and `Edit`. "screen+params" leaves an executor room to use a non-existent `EditContact` screen.
- **LOW:** A failed `getAppSettings()` during right-swipe commit has no stated fallback/error behavior. The schema default protects normal cases, but a DAO/read failure should not silently consume the gesture.

Suggestions

- Define a typed helper such as `navigateDashboardContactAction(contactId, "LogContact" | "Edit")`.
- Treat preference-read failure as Quick Log fallback plus error telemetry, or show a retryable notification; choose one explicitly.

Risk: **MEDIUM** — shared-command extraction is valuable, but navigation and preference-read failure need tighter contracts.

## Plan 06 — Search, Motion, Shared States

Strengths

- Cycle-1 ordering correction is correctly grounded in the real scorer (`dashboard-search-match.ts:131-149`).
- The corpus-first/fuel-only-second merge preserves the owner's D-12 relevance-first decision.
- Correctly recognizes that the current HomeScreen search route is still the old name/fuel query (`HomeScreen.tsx:299`), so wiring is still required.
- The existing motion gate is available and correctly scoped to focused/foreground/non-reduced-motion (`HomeScreen.tsx:215`).

Concerns

- **HIGH:** `listKnowledgeSearchCandidates()` currently does **not** exclude hidden or outdated knowledge. Its relationship SQL filters only `deleted_at IS NULL` (`knowledge-search-read.ts:99`) and its memory SQL filters only `deleted_at IS NULL` and type (:124). Wiring this reader into visible List search would surface hidden/outdated memory or relationship content. Plan 06's threat-model claim is therefore false against current code.
- **MEDIUM:** The supposedly batch corpus reader still makes one `getValuesForContact()` call per eligible contact (`knowledge-search-read.ts:281`). On a broad search universe this is N+1 database work; Plan 06 neither changes that file nor bounds it.
- **MEDIUM:** HomeScreen serves both list and card modes, but the Plan 06 `reload()` replacement is global (branches on term, not viewMode). D-12 specifies **List View** relevance ordering; applying `composeDashboardSearch()` universally changes Card View's pre-Phase-28 behavior and is scope creep unless Card View explicitly adopts the same order.

Suggestions

- Add `src/db/knowledge-search-read.ts` and tests to Plan 06. Filter memories with `deleted_at IS NULL AND hidden IS NOT 1 AND outdated = 0`; filter relationships with `deleted_at IS NULL AND hidden IS NOT 1`.
- Replace per-contact custom-field reads with one joined normalized-value batch query over eligible IDs and live definitions.
- Invoke corpus composition only for `query.viewMode === "list"` until the Card View plan explicitly adopts the shared relevance order.

Risk: **HIGH** until corpus privacy filters are fixed.

## Cycle-1 HIGH Findings (Codex verdict)

- **HIGH #1 — FULLY RESOLVED at plan level.** Plan 06 preserves `searchDashboard()` order; source confirms relevance-first. Fuel-only ordering explicitly defined and testable.
- **HIGH #2 — FULLY RESOLVED at plan level.** Plan 03 adds `is_current = 1`, matching the canonical reads.
- **HIGH #3 — FULLY RESOLVED at plan level.** Plan 04 places line-3 loading in the existing cancellation flow, whose stale-result guard is real.
- **HIGH #4 — FULLY RESOLVED at plan level.** Plan 06 requires a golden regression test around the scope extraction; no longer relies on ordinary test pass-through as proof.

Overall: **HIGH risk pending two revisions** — correct Plan 03's per-contact batching and Plan 06's hidden/outdated corpus leakage before approval.

---

## Claude Review

**Mechanism:** produced by the orchestrating Claude Code session (claude-opus-4-8) as a read-only, source-grounded analysis; the `claude -p` CLI sub-lane was bypassed per the owner-approved fallback for this run.

## Summary

Cycle-2 plans are strong and materially improved. All four cycle-1 HIGHs are genuinely resolved and each was verified against the code on disk, not merely against the plan's self-description. No decision reversal (ADR-075, D-04..D-12, migration ordering) is introduced; the plans consistently ENFORCE recorded decisions. Independently re-verifying the Codex lane's two new HIGHs against source confirms both hold: the corpus reader leaks hidden/outdated content, and the Plan 03 per-source LIMIT does not bound per contact.

## Cycle-1 HIGH verification (against source)

- **HIGH #1 — FULLY RESOLVED.** `dashboard-search-match.ts:131-150` sorts coverage → score → Dashboard tie-break; doc comment :127-130 confirms relevance primary. Plan 06 preserves that order and defines + tests the fuel-only (`match === null`) merge. Enforces DASHQ-09.
- **HIGH #2 — FULLY RESOLVED.** `current-state-history-read.ts:31,:48` filter `is_current = 1`; `getCurrentStateHistory` reads without it (history retained). Plan 03 adds the predicate + `is_current=0` regression test.
- **HIGH #3 — FULLY RESOLVED.** `HomeScreen.reload()` at :282-336 matches cited lines exactly (:283 flag, :312 guard, :313 setRows). Plan 04 folds line-3 in atomically under the same guard.
- **HIGH #4 — FULLY RESOLVED.** `listDashboardSearch` at :398-446 with scope :412-415, both search + population using `applyPopulationPostProcessing`. Plan 06 requires a byte-for-byte golden test across the extraction.

## Strengths

- Plan 02 mirrors the shipped `dashboardSort` precedent precisely (`app-settings-dao.ts:224` optional key + :202-210 trap comment, :229 patch derivation, :255 writable key, :400 COLUMN_OF, :744 validator); MED #2 writability trap guarded by a round-trip test.
- Migration head verified: `019-dashboard-prefs.ts`, `TARGET_VERSION = 19` → 020 correct; blocking-human one-way-door checkpoint + re-verify at execution.
- ADR-075 binary favourites respected: `favourites-dao` mark/clear used as binary membership; no rank-as-order, no `listFavourites` for the star.
- Corpus modules confirmed unwired (no non-test `src/` consumer of `searchDashboard`/`listKnowledgeSearchCandidates`).
- Plan 05 single-sources Quick Log and routes Log/Edit via the FAB's `navigationRef` dispatch.

## Concerns

- **HIGH (concurs with Codex) — Plan 06 hidden/outdated leakage.** Verified: `memories` has `hidden`(:23)/`outdated`(:22), `relationships` has `hidden`(:40) (migration `016`); the corpus read excludes only `deleted_at`. Wiring it into visible search surfaces content the user hid/marked outdated — inconsistent with line-3/fuel and with local-first privacy. Plan 06 T-27-11 is false. Actionable: add the hidden/outdated exclusions to `knowledge-search-read.ts` (add file + regression test to Plan 06), or escalate the visibility tradeoff.
- **HIGH (concurs with Codex) — Plan 03 per-contact bound.** Verified SQL semantics: a single `LIMIT` over `contact_id IN (...)` bounds the whole query; the plan's single-contact boundedness test would not catch multi-contact starvation. Actionable: specify a partitioned/windowed per-contact cap + a multi-contact coverage test.
- **LOW — Plan 04 star initial membership source is implicit.** Must derive from `DashboardRow.favourite_rank !== null` (projected via `CARD_FAVOURITE_RANK` in both reads at :375/:428); `isFavourite?` is only populated for the favourites population. Plan 04 should state this so an executor does not reach for `listFavourites` (prohibited) or rely on an undefined field.
- **LOW/MED — Plan 05 `runQuickLog` extraction shape.** `logContact` is hook/ref-bound; a plain services function cannot call those hooks. Name the injection boundary (hook vs injected snackbar/haptic/undo deps) so the module-scoped single-flight does not silently change semantics.
- **LOW (terminology) — Plan 01 references `BASE_WHERE`.** No such literal constant exists in `dashboard-read.ts` (Active exclusions live in `ACTIVE_SEGREGATION_WHERE`/`buildPopulationWhere`). Intent is correct; the name is not. Non-blocking.
- **LOW (pre-existing, out of scope) — `FavouriteRow` / "Manage-favourites reorder screen" comment at `dashboard-read.ts:115-122`.** ADR-075 retired that screen; not introduced or touched by Phase 27. Noting so it is not mistaken for a regression — removing it is not this phase's call.

## Decision-reversal check

None. Every plan enforces its governing decision (D-12 relevance-first, ADR-075 binary star, forward-only migration ordering, allowlist-now/emit-later). The two new HIGHs are correctness/privacy gaps, not reversals.

## Risk Assessment

**MEDIUM-HIGH pending the two new HIGHs.** Cycle-1 resolutions are solid and decision-faithful; the two newly-surfaced HIGHs (corpus privacy leakage; per-contact bound) must be incorporated into Plan 06 and Plan 03 respectively before execution. Remaining items are cheap clarifications.
