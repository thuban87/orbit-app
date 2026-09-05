---
phase: 27
reviewers: [codex, claude]
reviewed_at: 2026-09-05T20:57:18Z
plans_reviewed: [27-01-PLAN.md, 27-02-PLAN.md, 27-03-PLAN.md, 27-04-PLAN.md, 27-05-PLAN.md, 27-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "sonnet (reasoning=low)"
model_sources:
  codex: "banner"
  claude: "pinned"
---

# Cross-AI Plan Review — Phase 27: Dashboard List View

## Consensus Summary

Two source-grounded reviewers (Codex `gpt-5.6-terra`, Claude `sonnet`) independently
reviewed the six Phase 27 plans against the code on disk. Both rate the plan set as
well-researched and correctly grounded: file:line citations spot-check clean, the
migration-020 facts (head=019, `TARGET_VERSION = 19`) are verified correct, the additive
read-model widen respects `BASE_WHERE`/the Active predicate, ADR-075 binary favourites are
honoured everywhere (no `favourite_rank` ordering leaks into the List), and no custom-fields
dynamic-column language is reintroduced. Risk is concentrated in **Plan 06's search
composition** — both reviewers make it their top concern — with two further data-correctness
HIGHs in Plans 03 and 04 raised by Codex and verified against source during this review.

The orchestrator independently verified every HIGH below against the code on disk (not just
the plan text or the reviewer summaries), per the repo's "review the code, not the diff" rule.

### Agreed Strengths

- **Additive read-model widen is correct** (both). `DashboardRow` genuinely lacks
  `last_contact` and `snooze_until` (`src/db/dashboard-read.ts:91`); Plan 01 widens the
  projection without touching `BASE_WHERE` (`dashboard-read.ts:168/175`), preserving the
  Active predicate. Verified.
- **Migration 020 is the correct next number** (both). `src/db/database.ts:54`
  `TARGET_VERSION = 19`; `019-dashboard-prefs.ts` is the last shipped migration. The
  CHECK-constraint + validator + allowlist-only backup posture mirrors the `dashboardSort`
  precedent, and the irreversible schema change is correctly gated behind a blocking-human
  checkpoint (CLAUDE.md). Verified.
- **Status treatment guarded against the two known traps** (both). The List uses
  `ringVisual().color` at a constant width (not the escalating `ring.width`), and the
  null-status glyph is not mounted — matching UI-SPEC §I/D-07.
- **ADR-075 honoured** (both). Binary favourites only; `favourite_rank`/`listFavourites`
  excluded from List consumption. No decision reversal here.
- **No per-row DB reads**: line-3 (Plan 03) and corpus search (Plan 06) both use batch
  `contact_id IN (...)` reads reusing the `placeholders()` idiom.

### Agreed Concerns

- **Plan 06's search-composition rewrite is the top risk (both reviewers, HIGH).** Codex
  flags that emitting rows "in eligible (Dashboard) order" discards `searchDashboard()`'s
  relevance ranking; Claude flags that the `listDashboardSearch` scope-extraction is a real
  production-search refactor whose "byte-for-byte unchanged" claim is asserted, not
  test-verified, and lands six plans deep. Both are confirmed below.

### Divergent Views

- Codex raises two additional data-correctness HIGHs (Plan 03 `is_current`, Plan 04 async
  lifecycle) that Claude did not surface; the orchestrator verified both against source and
  they stand. Claude's Plan 04 note instead treats the snooze path as safe dead code
  (verified correct — the column exists, unwritten until Phase 11).
- Claude treats the "unwired corpus modules" premise as a MEDIUM to re-verify; the
  orchestrator ran the recommended full-repo grep and confirmed **no `src/` consumer** of
  `searchDashboard`/`listKnowledgeSearchCandidates` exists — the premise holds, downgrading
  that concern to LOW/advisory.

### Verified HIGH findings (orchestrator confirmation)

1. **Plan 06 — search results ordered by Dashboard order, discarding relevance (Codex HIGH;
   confirmed).** `src/logic/dashboard-search-match.ts:130-144` `searchDashboard()` ranks by
   `coverage → score → dashboard-rank tie-breaker` ("Relevance remains primary" per its own
   doc comment). Plan 06 (27-06-PLAN.md:103/114) calls `searchDashboard()` but then emits
   rows "in eligible (Dashboard) order," using the ranked result only for membership +
   descriptor attachment. This **contradicts recorded requirement DASHQ-09**
   (`.planning/REQUIREMENTS.md:80`, marked complete: "ranks by term coverage ... treats the
   Dashboard sort as tie-breaker only"). No D-NN in 27-CONTEXT.md or E3 in 27-UI-SPEC.md
   decides Dashboard-order for search results. **See OWNER ESCALATION below.**
2. **Plan 03 — current-state candidates omit `is_current = 1` (Codex HIGH; confirmed).**
   Plan 03 Task 2 (27-03-PLAN.md:102/114) reads `current_state_entries` via
   `contact_id IN (...)` applying `hidden`/`deleted_at`/`outdated`/birthday exclusions but
   **not** `is_current = 1`. The table retains history, and the repo's own current-value read
   requires that predicate (`src/db/current-state-history-read.ts:47`
   `WHERE contact_id = ? AND is_current = 1`). Without it a stale former value can win the
   deterministic line-3. The `outdated`/`deleted_at` exclusions do not substitute for
   `is_current` (a superseded-but-not-outdated history row still passes).
3. **Plan 04 — async line-3 load has no lifecycle/race contract (Codex HIGH; confirmed).**
   Plan 04 (27-04-PLAN.md:144/150) says HomeScreen computes line-3 "ONCE per rendered result
   set ... memoized on the result set," but `readLine3Candidates()` is async and `useMemo`
   cannot await a DB read. HomeScreen's actual pattern is a cancellation-aware `reload`
   `useCallback` (`src/screens/HomeScreen.tsx:282`, cancel handles at :346/:359/:375); the
   line-3 read must be keyed to the loaded row-id set / query generation and drop stale
   responses, or fold into `reload()` returning rows + line3 atomically.
4. **Plan 06 — "byte-for-byte unchanged" extraction claim lacks a regression test (Claude
   HIGH; confirmed as a test-backing gap).** Extracting `listDashboardSearch`'s scope
   construction (`dashboard-read.ts:412-415`) into a shared helper is a real refactor of
   production search code; the plan's acceptance ("rows/order/snippet byte-for-byte
   unchanged") is guarded only by "existing tests stay green," which may not cover the exact
   row/order guarantee. A golden/snapshot test on `listDashboardSearch` before/after the
   extraction is needed.

### OWNER ESCALATION — DASHQ-09 relevance-first ordering

Finding #1 above would **invert recorded requirement DASHQ-09** ("ranks by term coverage ...
treats the Dashboard sort as tie-breaker only"), which is implemented today as the documented
contract of `searchDashboard()`. Plan 06 would present dashboard search results in Dashboard
(status/urgency) order and use relevance only to decide membership. DASHQ-09 lives in
`.planning/REQUIREMENTS.md` (not an ADR/HANDOFF), and no phase-27 decision record (CONTEXT
D-NN, UI-SPEC E3) authorizes the change — so this reads as a silent reversal, flagged by a
reviewer by name.

- **If the Dashboard-order presentation is deliberate** (a product choice for the List
  surface), that reverses DASHQ-09 and is an **owner/product decision** — it should be
  recorded as a D-NN (or a superseding requirement note), not shipped inside a plan.
- **If it is an oversight**, the planner fix is to preserve `searchDashboard()`'s
  relevance-first ordering for corpus matches (with a defined merge position for fuel-only
  matches), keeping Dashboard order as tie-breaker per DASHQ-09.

Either way the planner must not silently emit Dashboard-order search results. This is
surfaced for the owner to decide which half dies.

---

## Codex Review

# Plan Review — Phase 27 Dashboard List View

## Summary

The six plans are well researched and generally respect Orbit’s existing architecture: shared dashboard reads, local SQLite, theme tokens, DAO-owned SQL, and explicit accessibility requirements. The main issues are in execution feasibility and search semantics: Plan 06 would discard the existing relevance-ranked search order, and several plans need tighter async/state and data-selection contracts before implementation.

## Strengths

- The tracer correctly identifies the real read-model gap: `DashboardRow` currently lacks both `last_contact` and `snooze_until`, while both population and search projections omit them. [src/db/dashboard-read.ts:91](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:91), [src/db/dashboard-read.ts:369](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:369), [src/db/dashboard-read.ts:422](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:422)

- Plan 01 correctly preserves the Active predicate. The existing status/population logic explicitly relies on `last_contact IS NOT NULL`; widening the projection without changing `BASE_WHERE` is the right approach. [src/db/dashboard-read.ts:168](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:168)

- The status treatment is correctly guarded against two existing traps: `ringVisual()` has severity-varying widths, so the List must use only its color; and `StatusGlyph` currently renders a neutral glyph for null. [src/components/contact-card-ring.ts:45](/home/bwales/projects/orbit-app/src/components/contact-card-ring.ts:45), [src/components/contact-card-ring.ts:87](/home/bwales/projects/orbit-app/src/components/contact-card-ring.ts:87), [src/components/icons/StatusGlyph.tsx:55](/home/bwales/projects/orbit-app/src/components/icons/StatusGlyph.tsx:55)

- Plan 02’s migration direction and default are sound. The repository is at migration 019 / target version 19, so 020 is the correct next migration today. [src/db/database.ts:43](/home/bwales/projects/orbit-app/src/db/database.ts:43), [src/db/database.ts:54](/home/bwales/projects/orbit-app/src/db/database.ts:54)

- The plan correctly follows the existing settings plumbing structure: a writable-key union, snake-case column map, typed row projection, and pre-write validation. [src/db/app-settings-dao.ts:255](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:255), [src/db/app-settings-dao.ts:390](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:390), [src/db/app-settings-dao.ts:794](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:794)

- Plan 03 correctly avoids per-row database work. The existing knowledge-search reader already demonstrates parameterized batch `IN (...)` reads and an empty-input guard. [src/db/knowledge-search-read.ts:86](/home/bwales/projects/orbit-app/src/db/knowledge-search-read.ts:86), [src/db/knowledge-search-read.ts:190](/home/bwales/projects/orbit-app/src/db/knowledge-search-read.ts:190)

- Plan 05’s use of the shell’s existing Quick Log behavior is directionally right. The actual quick-log path owns immediate write, feedback, Undo, haptic, refresh, and retry. [src/components/UniversalFab.tsx:228](/home/bwales/projects/orbit-app/src/components/UniversalFab.tsx:228)

## Concerns

### Plan 01 — MEDIUM: stated three-line acceptance conflicts with deliberately omitted line 3

The plan’s must-haves call for “three-line row anatomy,” but its action explicitly says not to add adaptive line 3 until Plan 04. That makes the Plan 01 acceptance impossible as written. The current dashboard has only `ContactCard` with name plus fuel/snippet, so there is no existing third List line to satisfy it. [src/screens/HomeScreen.tsx:677](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:677), [src/components/ContactCard.tsx:150](/home/bwales/projects/orbit-app/src/components/ContactCard.tsx:150)

### Plan 02 — MEDIUM: `AppSettingsPatch` requires a portable-snapshot type change not listed in the implementation map

`AppSettingsPatch` is not independently declared; it derives from `PortableSettingsSnapshot`. Adding only `AppSettings`, `AppSettingsRow`, `WritableSettingsKey`, and `COLUMN_OF` will not make `dashboardRightSwipeAction` writable through `updateAppSettings`. [src/db/app-settings-dao.ts:202](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:202), [src/db/app-settings-dao.ts:229](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:229)

The plan should explicitly add an optional `dashboardRightSwipeAction?: RightSwipeAction` to `PortableSettingsSnapshot`, following the existing deferred dashboard-preference pattern. [src/db/app-settings-dao.ts:210](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:210)

### Plan 02 — LOW: backup validation claim overstates what allowlisting does

Adding a key to `PORTABLE_SETTINGS_KEYS` only permits the key; `assertPortableSettings` currently performs no value validation for dashboard keys. [src/backup/backup-schema.ts:194](/home/bwales/projects/orbit-app/src/backup/backup-schema.ts:194)

This is acceptable under the “allowlist now, emit/restore in Phase 36” decision, but the threat model should not claim that a tampered backup value is already revalidated on restore. That validation will not exist until Phase 36 actually consumes the key.

### Plan 03 — HIGH: current-state candidates need `is_current = 1`

The proposed line-3 reader includes `current_state_entries` as “other useful knowledge” but does not require filtering to current values. That table intentionally retains history, and the repository’s own current-value reads always require `is_current = 1`. [src/db/migrations/016-contact-knowledge.ts:48](/home/bwales/projects/orbit-app/src/db/migrations/016-contact-knowledge.ts:48), [src/db/current-state-history-read.ts:47](/home/bwales/projects/orbit-app/src/db/current-state-history-read.ts:47)

Without that predicate, a stale former location or old “last talked about” value can win the deterministic line.

### Plan 03 — MEDIUM: candidate reads are not actually bounded to one useful candidate per contact

The plan describes “at most one candidate line-3 item per contact,” but its task shape returns a flat candidate set across all memories, relationships, and current-state entries. On a contact with substantial history, this can load and sort a large corpus just to render one short line.

Add deterministic SQL ordering and either per-source limits/windowing or an explicit bounded candidate budget. Also add a test that a contact with many historical/current-state rows remains bounded.

### Plan 04 — HIGH: asynchronous line-3 loading has no lifecycle/race contract

`readLine3Candidates()` is asynchronous, but the plan says HomeScreen will compute and memoize values “once per rendered result set.” `useMemo` cannot await a database read, and HomeScreen currently only maintains `rows`, counts, error, and refreshing state. [src/screens/HomeScreen.tsx:184](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:184), [src/screens/HomeScreen.tsx:282](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:282)

The plan needs an explicit cancellation-safe effect or inclusion in `reload()` that:

- keys the candidate map to the exact loaded row IDs/query generation;
- drops stale responses after search/filter changes;
- clears/replaces stale line-3 values when the result universe changes; and
- defines loading behavior without causing per-row visual churn.

### Plan 05 — MEDIUM: swipe routing cannot simply reproduce Universal FAB routing from HomeScreen

The existing Quick Log implementation is private to `UniversalFab`, including its single-flight guard, undo controller, snackbar behavior, widget refresh, and shell refresh. [src/components/UniversalFab.tsx:126](/home/bwales/projects/orbit-app/src/components/UniversalFab.tsx:126), [src/components/UniversalFab.tsx:228](/home/bwales/projects/orbit-app/src/components/UniversalFab.tsx:228)

Likewise, detailed logging from the FAB is routed through the root navigation ref into `DashboardTab`, not a local stack navigation assumption. [src/components/UniversalFab.tsx:301](/home/bwales/projects/orbit-app/src/components/UniversalFab.tsx:301)

The plan should first extract a shared, callable Quick Log command/service, or explicitly define a shell dispatch API. Duplicating `recordTouchpoint()` from HomeScreen risks inconsistent Undo, retry, haptic, and refresh behavior.

### Plan 06 — HIGH: result ordering contradicts the shared search ranking contract

The plan says `composeDashboardSearch()` should emit rows in “Dashboard eligible order.” That discards the relevance order computed by `searchDashboard()`. The existing scorer explicitly ranks by term coverage, then score, and only uses dashboard order as a tie-breaker. [src/logic/dashboard-search-match.ts:127](/home/bwales/projects/orbit-app/src/logic/dashboard-search-match.ts:127), [src/logic/dashboard-search-match.ts:139](/home/bwales/projects/orbit-app/src/logic/dashboard-search-match.ts:139)

This conflicts with DASHQ-09’s relevance-first behavior. The composition must retain the corpus-ranked ordering for corpus matches while defining how fuel-only matches are merged without making Dashboard sort the primary ordering.

### Plan 06 — MEDIUM: corpus search behavior is not equivalent to current dashboard scope without an explicit decision

`listKnowledgeSearchCandidates()` includes names, categories, contact methods, memories, relationships, and custom fields. [src/db/knowledge-search-read.ts:185](/home/bwales/projects/orbit-app/src/db/knowledge-search-read.ts:185) The current `listDashboardSearch()` only searches name and eligible fuel. [src/db/dashboard-read.ts:416](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:416)

Wiring the corpus is intended, but the plan must test all population/filter post-processing paths—especially gravity, which is post-processed after the SQL read—so a corpus match cannot bypass the same eligible universe constraints. `applyPopulationPostProcessing()` is the relevant boundary. [src/db/dashboard-read.ts:388](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:388)

### Plan 06 — LOW: skeleton and transition implementation is underspecified

HomeScreen currently has no initial-load state or skeleton row component; it starts with an empty `rows` array and renders the empty host. [src/screens/HomeScreen.tsx:184](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:184), [src/screens/HomeScreen.tsx:424](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:424)

The plan should name the state fields and component/layout responsible for distinguishing initial load, delayed refresh, and ordinary fast query replacement. It should also specify focus/AppState gating for any new motion, consistent with the existing search animation guard. [src/screens/HomeScreen.tsx:215](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:215)

## Suggestions

- Amend Plan 01’s success criteria to call it a two-content-line tracer with reserved line-3 geometry, or defer the literal “three-line anatomy complete” criterion to Plan 04.

- Amend Plan 02 to update `PortableSettingsSnapshot` as well as the DAO structures, and narrow the backup claim to “allowlisted for a future format” rather than restore-validated today.

- Amend Plan 03 to require `current_state_entries.is_current = 1`, deterministic SQL ordering, and a bounded per-contact candidate strategy.

- Make Plan 04 load line-3 candidates within the existing cancellation-aware reload flow, returning `{ rows, line3ByContactId }` atomically for the same query generation.

- Before Plan 05, extract the current `UniversalFab.logContact` command into a shared shell/capture action. Reuse that command from FAB and List swipe so its truthful success/error/Undo behavior remains single-sourced.

- Rewrite Plan 06 ordering: retain `searchDashboard()` relevance ranking for corpus matches; explicitly merge fuel-only matches after relevance-ranked results or score them through the same shared matcher. Do not re-sort the final result set in dashboard order.

## Risk Assessment

**Overall: MEDIUM-HIGH.**

The foundation and migration work are solid, but the phase has two high-risk correctness gaps: stale/history knowledge can surface in line 3, and Plan 06 would undo the project’s relevance-first search behavior. The HomeScreen async wiring and capture-action reuse also need concrete contracts before execution. With those amendments, the plan set is executable without reopening any ADR or requiring an owner decision.

---

## Claude Review

# Cross-AI Plan Review — Phase 27: Dashboard List View (6 plans)

## Summary

The plan set is unusually well-grounded: nearly every claim I checked against the actual repo (`dashboard-read.ts`, `contact-card-ring.ts`, `icon-registry.ts`, `favourites-dao.ts`, `app-settings-dao.ts`, `backup-schema.ts`, `use-reduced-motion.ts`) matched what the plans assert, file:line references included. The migration-020 facts (head=019, TARGET_VERSION=19) are correct on disk. The architecture (additive read-model widen → batch knowledge read → presentational `ListRow` → swipe host → search composition) is sound and correctly sequences around real gaps in `dashboard-read.ts`. The most serious concern is in 27-06: it invents a new composition path (`listDashboardSearchEligible` + `composeDashboardSearch`) that is a genuine, non-trivial rewrite of search data-flow, staged very late (Wave 5) after four prior plans render against `listDashboardSearch`'s existing `snippet` — meaning search rendering logic partially built in earlier waves may need rework, and the "behaviour-preserving" extraction claim for `listDashboardSearch`'s scope needs careful verification, not just assertion.

## Strengths

- **27-01 (tracer)**: Correctly identifies the two real gaps — `DashboardRow` has no `last_contact` or `snooze_until` (verified: `dashboard-read.ts:91-113` truly lacks both) — and widens additively without touching `BASE_WHERE`. The P-2/P-3 pitfalls (ring width escalation, null-status glyph) are correctly diagnosed against `contact-card-ring.ts:51-60` and `StatusGlyph.tsx:55-63`/`contact-card-ring.ts:99-102`.
- **27-02 (migration)**: The `head+1=020` claim is verified correct (`database.ts:54` `TARGET_VERSION = 19`, `019-dashboard-prefs.ts` is the last shipped migration). The CHECK-constraint + validator + allowlist-only backup posture correctly mirrors the `dashboardSort` precedent (`app-settings-dao.ts:744-753`, `backup-schema.ts:166-173`). Correctly reserves the blocking-human gate for the irreversible schema change per CLAUDE.md.
- **27-03 (line-3 + star)**: The star-fix claim ("no `<Icon name="favorite">` consumer anywhere") is plausible from `icon-registry.ts:37` and matches ContactCard's literal `"★"` usage (`ContactCard.tsx:184-190`) rather than the registry — safe to change.
- **27-04/27-05**: Correctly reuse `favourites-dao.ts`'s binary mark/clear (never `favourite_rank` as order — `dashboard-read.ts:465-472`/`listFavourites` correctly excluded from the List's consumption per ADR-075). The swipe plan correctly identifies `ReanimatedSwipeable` as unused anywhere in `src/` and stages the worklet/JS-thread boundary correctly (translation never in React state).
- Every plan's `<read_first>` lists real files with real line ranges; spot-checking several found no fabricated citations.

## Concerns

- **HIGH — 27-06 introduces a substantively new, non-trivial data-composition layer very late, risking rework of earlier waves' search rendering.** The plan invents `listDashboardSearchEligible` (a new scope-extraction from `listDashboardSearch`) and `composeDashboardSearch` (unioning corpus search results from `listKnowledgeSearchCandidates`/`searchDashboard` with fuel-only fallback from the existing `listDashboardSearch`). This is architecturally sound in isolation, but: (a) `listDashboardSearch` at `dashboard-read.ts:398-446` is currently a single self-contained function — extracting its `scope` construction (lines 412-415) into a shared helper is a real refactor of production search code that has never been exercised by this new consumer before Wave 5, and the plan's own acceptance criteria ("`listDashboardSearch`'s existing rows/order/snippet output is byte-for-byte unchanged") is asserted but not test-verified beyond "existing tests stay green" — existing tests may not cover the exact byte-for-byte row/order guarantee under the refactor; (b) plans 27-04 (search... wait, actually rendering search is 27-06 only) — checking again: the earlier plans (27-01 through 27-05) do NOT render search mode at all, so there's no actual double-build risk from ordering, but the *architectural discovery* that `listDashboardSearch.snippet` is fuel-only and insufficient for LISTV-06 comes only in Research/27-06, six plans deep — meaning if this insight had been wrong or contested, the previous five plans' `ListRow` component would need a shape change to its props (adding a `DashboardSearchResult`-shaped field, not present in 27-01's or 27-04's `ListRow` prop contracts). Recommend front-loading a note in 27-01 or 27-04 flagging that search-mode props are still TBD until 27-06, to avoid an accidental "search mode is just `DashboardRow.snippet`" implementation being calcified by an executor working plan-by-plan without full context.
- **MEDIUM — 27-06's claim that `dashboard-search-match.ts` and `knowledge-search-read.ts` are "BUILT + TESTED but UNWIRED (no `src/` consumer)" is a strong, load-bearing claim that determines the whole plan's premise.** I traced imports: `dashboard-search-match.ts` exports `searchDashboard`/`buildDashboardSearchResult`, and `knowledge-search-read.ts` exports `listKnowledgeSearchCandidates`. Neither appears imported in `HomeScreen.tsx` or `dashboard-read.ts` in the files I read. This is consistent with the plan's claim, but I did not exhaustively grep all of `src/` for other consumers (e.g. a Profile-side "Contact Knowledge search" feature might already wire these for a different UI surface). If another screen already consumes `composeDashboardSearch`-equivalent logic differently, 27-06 risks diverging implementations. **Recommend the executor re-run a full-repo grep for `searchDashboard(` and `listKnowledgeSearchCandidates(` immediately before starting 27-06**, not trust the plan's assertion alone (per CLAUDE.md "review the code, not the diff").
- **MEDIUM — 27-01's Pitfall-P4/snooze composition is deferred entirely to "will simply never trigger until Phase 11."** This is explicitly flagged and reasonable, but note that `dashboard-read.ts:33-36` says the snooze contract is for "Phase 11's future writer," and `SNOOZED_WHERE`/`countSnoozed` already exist and are used by `dashboard-query-logic.ts`. Verified: `contacts.snooze_until` column already exists in the schema referenced by `BASE_WHERE` (`dashboard-read.ts:175`) and `SNOOZED_WHERE` (`dashboard-query-logic.ts:156-157`) — so the column exists, just unwritten by any UI flow yet. The plans are correct that this is safe to implement now (dead code path), not a fabrication.
- **LOW — 27-02's Task 1 checkpoint (`blocking-human`) is correctly gated**, but the plan text embeds the exact migration SQL as if final in the `<context>`/`<action>` blocks in both 27-02 and the pattern doc, before the human gate resolves. This is a plan-writing nit (not a functional issue) — the checkpoint exists, so it's fine, but a hurried executor could act on the "as-specified" SQL text appearing twice before reaching the gate. No code fix needed, just confirm the executor actually stops at Task 1 before Task 2 runs (Task 2 depends on Task 1 in the wave, which is correctly ordered).
- **LOW — Icon registry change (`favorite: heart → star`) in 27-03 Task 1 is a global, single-source change affecting any future Card View (Phase 28) consumer.** The plan correctly notes ContactCard's literal `"★"` is untouched, so no immediate collision, but Phase 28 (Card View, not yet planned) will need to know the registry semantic name now resolves to a star, not a heart — worth a one-line note forward, not a blocker.
- **LOW — DECISION-REVERSAL check**: No plan reopens or reverses a `[DECIDED]`/ADR item. ADR-075 (binary favourites, no rank) is correctly honored everywhere (`listFavourites`/`favourite_rank` explicitly excluded from List consumption in 27-04). No custom-fields dynamic-column language present. No concerns here.

## Suggestions

1. In 27-04 (or earlier), add an explicit note that `ListRow`'s prop contract must reserve a slot for the eventual search-mode `DashboardSearchResult | null` even though it's not implemented until 27-06 — this avoids an incompatible prop shape needing retrofit.
2. Before starting 27-06, have the executor grep the full repo (not just the files cited) for existing consumers of `searchDashboard`, `buildDashboardSearchResult`, and `listKnowledgeSearchCandidates` to confirm the "unwired" premise still holds, and confirm no divergent implementation exists elsewhere that should be reused instead.
3. Add a task-level test asserting `listDashboardSearch`'s output is unchanged before/after the scope-extraction refactor in 27-06 Task 1 (a snapshot/golden-row test), rather than relying on "existing tests stay green" as the sole regression guard for a production search path refactor.
4. Consider whether 27-06's Task 1 (search composition) could be resequenced earlier (e.g., Wave 2, alongside 27-02/27-03) so the `ListRow` prop contract for search mode is known before 27-04 builds the non-search row — reducing risk of a late prop-shape change. This is a scheduling suggestion, not a correctness blocker, since the current dependency graph (27-06 depends_on 27-04 and 27-05) does prevent any actual wasted work.

## Risk Assessment: **MEDIUM**

The plan set is well-researched and internally consistent, with strong verified grounding in the actual codebase and correct handling of the phase's non-negotiables (binary favourites/ADR-075, no hardcoded colour, no per-row DB reads, worklet-only animation, migration irreversibility gate). The risk is concentrated entirely in 27-06's late-discovered architectural correction to search data flow — a real improvement over the naive `listDashboardSearch.snippet`-only approach, but introduced six plans deep with a refactor to production search code whose "byte-for-byte unchanged" claim needs stronger test backing than currently specified, and whose "unwired" premise for the corpus search modules should be re-verified fresh (not trusted from the research doc) before execution.

---
