---
phase: 27
cycle: 3
reviewers: [codex, claude]
reviewed_at: 2026-09-05T22:24:08Z
plans_reviewed: [27-01-PLAN.md, 27-02-PLAN.md, 27-03-PLAN.md, 27-04-PLAN.md, 27-05-PLAN.md, 27-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "in-session-subagent"
---

# Cross-AI Plan Review — Phase 27 (Cycle 3)

> Cycle 3 of the plan-review convergence loop. Plans were revised twice; the cycle-2 fixes
> landed in commit `e8021b0` (all six plans touched). Both lanes reviewed the revised plans
> against the source on disk (not the plan self-description). The Codex lane ran via
> `codex exec` (read-only sandbox, gpt-5.6-terra, reasoning=low). The Claude lane was produced
> by a read-only, source-grounded Claude subagent (the `claude -p` CLI sub-lane was bypassed in
> favour of the in-session subagent, per the owner-approved fallback for this run). The
> orchestrator independently re-verified every substantive finding against the code before
> aggregating.

## Consensus Summary

**Both lanes converge on the same verdict: the six-plan sequence is execution-ready with ZERO
unresolved HIGH concerns and NO decision reversals.** Both cycle-2 HIGHs are FULLY RESOLVED and
each was re-verified against source by both lanes:

- **Cycle-2 HIGH #1 (Plan 06 hidden/outdated corpus leakage):** the corpus read now routes
  through the established visibility choke points — `resolveVisibility(type, hidden)` at
  `memories-read.ts:101-109` (registry-default-aware) and `resolveRelationshipVisibility(hidden)`
  at `relationships-read.ts:39-43`, plus an `outdated = 1` drop. Both helpers verified at the
  cited lines. The pre-fix leak (corpus read filtered only `deleted_at IS NULL`) is confirmed
  real at `knowledge-search-read.ts:104,:135`; Plan 06 correctly closes it in-read. HOLDS.
- **Cycle-2 HIGH #2 (Plan 03 per-contact bound):** Plan 03 now specifies
  `ROW_NUMBER() OVER (PARTITION BY contact_id ...)` with `row_number <= candidateBudget` and a
  MULTI-contact regression test (A's deep history must not starve B), replacing the bare
  `LIMIT N` over `contact_id IN (...)` that bounded the whole set. HOLDS.

Cycle-1's four HIGHs also all still hold (relevance-first `searchDashboard` ordering; `is_current=1`
current-state reads; async line-3 folded into the cancellation-aware `reload()`; the golden
extraction test on `listDashboardSearch`). The known false positive is reconfirmed dead:
`BASE_WHERE` **exists** at `dashboard-read.ts:172` and is not re-raised.

The remaining findings are all MEDIUM (minor, actionable) or LOW/nit — none blocks the
architecture, and both lanes describe the set as at the "implementation-seam refinement /
asymptotic-nit" level rather than the substantive-defect level. Overall risk: **Codex MEDIUM,
Claude LOW** — the divergence is one of framing (Codex weights the implementation-seam MEDIUMs
higher), not of any disputed defect.

### Agreed Strengths (2+ reviewers)

- **Additive read widen is correctly scoped.** `DashboardRow` lacks `last_contact`/`snooze_until`
  (`dashboard-read.ts:91-113`) while `contacts` already carries them and they drive `BASE_WHERE`
  (`:172`); both `listDashboardPopulation` and `listDashboardSearch` use `getAllAsync<DashboardRow>`
  with explicit SELECT lists, so projecting the two columns without touching Active exclusions is
  the right move.
- **Status treatment avoids the escalating border.** `ringVisual()` returns widths 2/3/4/3
  (`contact-card-ring.ts:45/:51-57`), so a constant-width border using `.color` only is required;
  the null-glyph guard is correct (`StatusGlyph` renders neutral for null).
- **Migration 020 is correct head+1** (`TARGET_VERSION = 19`, head `019-dashboard-prefs.ts`), gated
  behind a blocking one-way-door checkpoint and re-verified at execution; the DAO route faithfully
  mirrors the shipped `dashboardSort` writable-key precedent (`app-settings-dao.ts:224/:229/:255/:368/:400/:744`).
- **ADR-075 binary favourites respected.** `favourite_rank !== null` used as binary membership
  (`dashboard-read.ts:152-153`, projected at `:375/:428`); `setFavouriteRank`/`clearFavouriteRank`
  used strictly as mark/clear (`favourites-dao.ts:32,:59`); the List never sorts by rank and never
  calls `listFavourites`.
- **Plan 05 real routes + single-sourced Quick Log.** The Dashboard routes are `LogContact`
  (`DashboardStack.tsx:37`) and `Edit` (`:57`); there is no `EditContact` route. The FAB Quick Log
  path (`UniversalFab.tsx:126/:228-278`) is per-instance ref-bound, and the named-boundary extraction
  (hook vs injected deps, forbidding a module-scoped single-flight boolean) correctly preserves the
  per-instance semantics.
- **Plan 06 closes real privacy + perf defects.** The corpus leak, the `getValuesForContact` N+1
  (`knowledge-search-read.ts:281`), and the D-12 List-only relevance-ordering gate
  (`HomeScreen.tsx:300`) are all grounded in the real source; the fix preserves parameterization
  and the eligible-universe post-processing (`applyPopulationPostProcessing`).

### Agreed Concerns (2+ reviewers)

- **Plan 04 favourite optimistic state vs. wholesale reload.** Both lanes note that HomeScreen
  reloads on focus/foreground/pull/shell-refresh and replaces `rows` wholesale
  (`HomeScreen.tsx:312/:338`); the mutation-generation rule addresses a stale *failure* handler but
  not an in-flight optimistic override being erased by an overlapping reload. Codex MEDIUM; Claude
  LOW (frames it as a smaller reconciliation gap). Actionable: specify a per-contact optimistic
  overlay that survives/yields to reload until the latest mutation settles.
- **Plan 06 fuel-only / batched-custom-field edges.** Codex (LOW) asks the batched custom-field
  query to preserve `getValuesForContact`'s join-to-defs + quarantined-definition boundary, not just
  an ID list; Claude (LOW) notes the fuel-only fallback assumes a non-null `snippet` and wants a
  `snippet == null` guard. Both are minor edge hardening on the same plan.

### Divergent Views

- **Overall risk framing.** Codex rates the sequence MEDIUM (its five implementation-seam MEDIUMs
  — snooze date-rule, Plan-03 registry-default visibility, Plan-04 private `STATUS_LABEL`, Plan-04
  reload/optimism reconciliation, Plan-05 haptic misdescription — weigh the verdict up); Claude
  rates it LOW (one substantive-but-minor MEDIUM plus four nits, "asymptotic-nit floor"). No finding
  is disputed between the lanes; the difference is weight, not substance. Neither lane found a HIGH
  or a decision reversal.
- **Findings unique to one lane (not contradicted, just not independently surfaced by the other):**
  Codex alone raised the Plan-05 haptic misdescription (verified: current Quick Log fires
  Success-on-write only at `UniversalFab.tsx:255`; the Light impact is dial-open only at `:158` — the
  plan's "Light-then-Success" phrasing is factually wrong and, taken "verbatim," could add a spurious
  Light haptic) and the Plan-03 registry-default visibility gap (verified latent: all 5 memory types
  and the relationships group currently default to `"show"`, so `hidden = 1` is functionally
  equivalent today, but it diverges from Plan 06's choke-point discipline and would leak a
  type-default-hidden row if a future type ships `visibilityDefault: "hide"`). Claude alone raised the
  Plan-01 `widget-data.test.ts` fixture typecheck break (verified: the required widen breaks the
  `row()` factory literal at `widget-data.test.ts:22-38`, and Plan 01 omits that file from its
  manifest while claiming "every consumer typechecks").

### Decision-Reversal Escalations

**None.** Both lanes independently confirmed every plan ENFORCES rather than weakens its governing
decision: ADR-075 (binary favourite membership; no rank-as-order, no `listFavourites` on the list
path; the heart→star registry change is a glyph choice within UI-SPEC/Claude discretion, not a
reversal of the ranking decision), D-07 (two-channel status; neutral + no glyph for null; no
fabricated fifth status), D-09 (exactly two non-destructive swipes + one global preference), D-12 /
DASHQ-09 (relevance-first ordering preserved; the rejected Dashboard-order re-emit stays rejected),
forward-only migration ordering, and allowlist-now/emit-later with no unauthorized
`BACKUP_FORMAT_VERSION` bump. No owner escalation is required this cycle.

---

## Codex Review

<!-- gpt-5.6-terra (reasoning=low), via codex exec, read-only sandbox, source-grounded. -->

## Overall summary

The plans are substantially source-grounded and correctly target the real seams: `DashboardRow` lacks recency/snooze projections, the current knowledge search is both visibility-incomplete and N+1 for custom values, and the actual Dashboard routes are `LogContact` and `Edit`. The wave ordering is mostly sound. I found two execution-impacting integration gaps and two medium implementation ambiguities; none require reversing a recorded product decision.

## Plan 01 — Tracer

### Strengths

- Correctly widens the shared read rather than querying from cells. `DashboardRow` currently has neither `last_contact` nor `snooze_until`, while both population and search SQL already operate on those contact columns: `dashboard-read.ts:91`, `dashboard-read.ts:172`, `dashboard-read.ts:398`.
- Correctly preserves Active semantics. `BASE_WHERE` explicitly requires `last_contact IS NOT NULL`; the plan's instruction not to change it is necessary and correct. `dashboard-read.ts:172`
- Correctly identifies that the existing DST-safe helper is private. Both `parseLocalMs` and `calendarDaysBetween` are non-exported in fuel age, so extracting them to `dates.ts` is required for actual reuse. `fuel-age.ts:33`, `fuel-age.ts:65`
- Correctly avoids `ringVisual().width`; that mapper intentionally escalates border widths by status, contrary to the List contract. `contact-card-ring.ts:45`
- Correctly guards the null glyph. The existing glyph component would render a neutral glyph for `null`, so the List must not mount it for unevaluated contacts. `StatusGlyph.tsx:55`, `contact-card-ring.ts:87`

### Concerns

- **MEDIUM — snooze "active" evaluation is underspecified.** The plan says the component composes `"snoozed"` when `snooze_until` is active, but does not define a local-calendar comparison input or pure helper. The established SQL contract uses `date(snooze_until) > date('now','localtime')`; a lexical timestamp comparison or UTC parsing in the renderer could disagree at date boundaries. `dashboard-read.ts:172`

### Suggestions

- Add a pure `isSnoozed(snoozeUntil, now)` helper, based on the same local-calendar parsing extracted to `dates.ts`, with today/expired/future tests. Pass one captured `now` into rows rather than calling the clock per recycled cell.

### Risk assessment

**MEDIUM.** The architecture is correct; snooze status needs an explicit, testable date rule.

---

## Plan 02 — Migration and preference DAO

### Strengths

- Migration 020 is correctly sequenced: the current migration head is 019 and `TARGET_VERSION` is 19. `database.ts:54`, `database.ts:57`
- The proposed additive-column style matches the established 019 migration style. `019-dashboard-prefs.ts:13`
- The plan correctly follows the full writable-key path. `AppSettingsPatch` is derived from `PortableSettingsSnapshot`, and `dashboardSort` demonstrates the needed optional snapshot field, writable-key union, column map, select, row map, and validator flow. `app-settings-dao.ts:224/:368/:417/:843`
- Allowlist-now/emit-later follows the existing dashboard-setting precedent. `backup-schema.ts:166`

### Concerns

- No substantive concern found. The migration checkpoint is appropriate for a one-way schema change.

### Suggestions

- Have the forward-jump test include a migration-002-era singleton row as stated, and retain a full-chain migration test run in the wave verification.

### Risk assessment

**LOW.** The shape follows well-established repository conventions and has appropriate migration-specific tests.

---

## Plan 03 — Line-3 read and selection

### Strengths

- Correctly recognizes that current-state history must be filtered with `is_current = 1`; the canonical reads do so. `current-state-history-read.ts:30`
- Correctly treats per-source columns differently. `current_state_entries` has no `hidden`, `outdated`, or `deleted_at`; memories and relationships do. `016-contact-knowledge.ts:10/:30/:48`
- The per-contact `ROW_NUMBER() OVER (PARTITION BY ...)` requirement addresses a real batch-query starvation failure.
- The favorite registry change is correctly constrained to the existing semantic source rather than adding a literal icon path.

### Concerns

- **MEDIUM — line-3 visibility is not fully specified for memory types whose registry default is hidden.** The plan's memory predicate lists `hidden = 1`, but repository visibility semantics include `hidden = null` inheriting the type's `visibilityDefault`. `resolveVisibility()` is the authoritative behavior and can hide a null-valued row. `memories-read.ts:101` This matters because D-11 permits visible structured knowledge, not content hidden by a default type policy. *(Orchestrator note: latent today — all 5 memory types and the relationships group currently declare `visibilityDefault: "show"`, so `hidden = 1` is functionally equivalent to `resolveVisibility` for present data; the finding is a consistency/robustness gap vs. Plan 06, which routes through the choke point.)*

### Suggestions

- Require `dashboard-knowledge-read.ts` to select `hidden` and filter candidates through `resolveVisibility(type, hidden) === "show"`, as Plan 06 correctly intends for corpus search.
- Add a test for a `hidden = null` memory whose registry default is hide, not only explicit `hidden = 1`.

### Risk assessment

**MEDIUM.** The batching, historical-state, and deterministic-order protections are strong; registry-default visibility needs to be carried through.

---

## Plan 04 — Row completion, line 3, and favorite

### Strengths

- Correctly uses `favourite_rank !== null` as binary membership. The ordinary dashboard projections carry `favourite_rank`, while `isFavourite` is population-specific and optional. `dashboard-read.ts:91`
- Correctly avoids rank ordering in the List. The existing write layer still stores a rank for implementation reasons, but documents it as non-user-facing membership. `favourites-dao.ts:12`
- The per-contact mutation-generation guard is a good response to stale failure handlers from rapid taps.
- Folding line-3 loading under HomeScreen's existing cancellation guard matches the actual reload lifecycle. `HomeScreen.tsx:282`

### Concerns

- **MEDIUM — "reuse StatusGlyph labels verbatim" is not implementable without changing the primitive.** `STATUS_LABEL` is private to `StatusGlyph.tsx`; Plan 04 cannot import it into its pure content module. Recreating the strings creates a second label source and risks drift. `StatusGlyph.tsx:37`
- **MEDIUM — favorite optimistic state needs an explicit reload reconciliation rule.** HomeScreen reloads on focus, foreground, pull refresh, and shell refresh, then replaces `rows` wholesale. `HomeScreen.tsx:312`, `HomeScreen.tsx:338` The plan specifies mutation-generation failure handling, but not how an in-flight optimistic override survives or yields to an overlapping reload. A stale database read can visually erase a newer optimistic choice before its write resolves.

### Suggestions

- Export a pure `statusDisplayLabel(state)` from the status primitive, then use it in both `StatusGlyph` and the List accessibility formatter.
- Specify a per-contact optimistic overlay map with generation metadata; merge it over reload results until the latest mutation settles, then clear it only if that generation is still current.

### Risk assessment

**MEDIUM.** The intended behavior is sound, but label single-sourcing and reload-versus-optimism reconciliation need explicit implementation requirements.

---

## Plan 05 — Swipe actions

### Strengths

- Correctly targets the actual navigation route names: `LogContact` and `Edit`, not `EditContact`. `DashboardStack.tsx:37`, `DashboardStack.tsx:57`
- Correctly requires reuse of the FAB's root navigation dispatch rather than assuming the local Home stack can navigate to every target.
- Correctly identifies that the existing Quick Log path has per-component-instance refs for pending state and undo control. `UniversalFab.tsx:126`
- The requirement to avoid module-scoped mutable single-flight state is important and correct.

### Concerns

- **MEDIUM — the plan misstates the current Quick Log haptic behavior, risking a non-preserving extraction.** It calls the current behavior "Light-then-Success," but the actual log path only sends a Success notification haptic after persistence succeeds. The Light impact is emitted when the FAB dial opens, not when Quick Log executes. `UniversalFab.tsx:158`, `UniversalFab.tsx:228`, `UniversalFab.tsx:255`

### Suggestions

- Correct the extraction contract to preserve Success-on-write behavior exactly. If a swipe-specific immediate Light haptic is desired, make it an explicit new List interaction decision rather than claiming it is a behavior-preserving FAB extraction.
- Include an automated test asserting retry runs after the pending guard has cleared; the current FAB retry callback invokes `logContact` from the failure path. `UniversalFab.tsx:261`

### Risk assessment

**MEDIUM.** Navigation and gesture architecture are good; the haptic mismatch can unintentionally change established FAB behavior.

---

## Plan 06 — Search, privacy, motion

### Strengths

- Correctly diagnoses the current privacy gap: corpus search currently selects live-but-hidden memories/relationships and does not select `hidden` or `outdated` for filtering. `knowledge-search-read.ts:99`, `knowledge-search-read.ts:124`
- Correctly points to the existing visibility choke points rather than inventing `hidden IS NOT 1`. `memories-read.ts:101`, `relationships-read.ts:39`
- Correctly identifies the real N+1: `listKnowledgeSearchCandidates()` calls `getValuesForContact()` once for every candidate contact. `knowledge-search-read.ts:281`, `field-values-dao.ts:20`
- Correctly preserves D-12's List-only relevance ordering by requiring a `viewMode === "list"` gate. Existing HomeScreen currently branches only on whether a term is present. `HomeScreen.tsx:300`
- Correctly preserves parameterization: the current read uses bound values for term inputs and static SQL fragments. `dashboard-read.ts:398`

### Concerns

- **LOW — the plan should explicitly ensure the new batch custom-field query preserves the existing "definitions supplied by caller" boundary.** `getValuesForContact()` joins definitions and restricts `field_def_id` to supplied live definitions. `field-values-dao.ts:20` The proposed batch query mentions live definition IDs, which is probably sufficient, but should require the same join and quarantined-definition behavior rather than relying solely on an ID list.

### Suggestions

- Require the batched custom-value query to join `custom_field_defs`, limit to the live definition IDs, and add a quarantined-definition regression test.
- Make the "meaningfully delayed skeleton" threshold a named constant with a unit-testable scheduling seam; otherwise it is too subjective to verify consistently.

### Risk assessment

**LOW.** This is the strongest plan: it closes concrete privacy and performance defects in existing source, preserves List-only ordering, and includes the right regression tests.

## Overall risk assessment

**MEDIUM.** The plans should achieve a functional List View with shared filtering, sorting, corpus-backed search, gestures, and accessibility. Before execution, resolve:

1. Plan 03's registry-default memory visibility.
2. Plan 04's exported status-label source and optimistic-state/reload reconciliation.
3. Plan 05's incorrect haptic-preservation claim.

These are substantive implementation requirements; the remaining plan structure and source references are solid.

---

## Claude Review

**Mechanism:** produced by a read-only, source-grounded Claude subagent (claude-opus-4-8); the `claude -p` CLI sub-lane was bypassed per the owner-approved fallback for this run. Every substantive finding below was independently re-verified against source by the orchestrator.

### Summary

This is a strong, execution-ready six-plan sequence. Every cycle-1 (4) and cycle-2 (2 new HIGH + several MED/LOW) finding is now reflected in the plan text, and I verified each against the code on disk rather than the plans' self-description — the citations that matter (relevance-ordered `searchDashboard`, `is_current=1` current-state reads, the cancellation-aware `reload()`, the `dashboardSort` writability precedent, the real `LogContact`/`Edit` routes, the hidden/outdated corpus leak and its choke-point fixes, the `getValuesForContact` N+1) all check out. The plans consistently *enforce* recorded decisions; I found no decision reversal. I surfaced one genuinely new, actionable finding not raised in prior cycles: the additive `DashboardRow` widen in Plan 01 breaks a `DashboardRow` object-literal fixture factory that Plan 01 neither lists nor reads, making its "every consumer typechecks" claim false until that fixture is updated. Everything else remaining is LOW/nit with no execution impact. `BASE_WHERE` is confirmed present at `src/db/dashboard-read.ts:172` (the known false positive — and notably the cycle-2 Claude lane's own "BASE_WHERE does not exist" LOW was itself wrong).

### Per-Plan Findings

**Plan 01 — Tracer**
- Strengths: The additive widen is mechanically sound — both `listDashboardPopulation` (`dashboard-read.ts:368-390`) and `listDashboardSearch` (`:421-446`) use `getAllAsync<DashboardRow>` with an explicit SELECT list and no per-field JS mapper, so adding `c.last_contact AS last_contact, c.snooze_until AS snooze_until` to each SELECT is sufficient; `c.last_contact`/`c.snooze_until` already exist on `contacts` and drive `BASE_WHERE` (`:172-175`). Status treatment is correct: `ringVisual` returns escalating widths 2/3/4/3 (`contact-card-ring.ts:51-57`) so a constant border width using `.color` only is required; `StatusDisplayState` includes `"snoozed"` (`:73`) and `statusGlyph` (`:87`) handles it. The DST-reuse seam is real: `parseLocalMs` (`fuel-age.ts:33`) and `calendarDaysBetween` (`:65`) are private, only `formatFuelAge` is exported (`:92`), so the extract-to-`dates.ts` instruction is executable, not hand-waving.
- Concern (MEDIUM) — `src/services/widget/widget-data.test.ts:24-38`: the `row()` fixture factory returns an explicitly-typed `DashboardRow` object literal (`photo…snippet` + `...over` where `over: Partial<DashboardRow>`). Adding `last_contact`/`snooze_until` as **required** interface fields makes this literal fail `tsc` ("Property 'last_contact' is missing"), because the `Partial` spread cannot supply a required field. Plan 01 does not list `widget-data.test.ts` in `files_modified` or `read_first`, yet its own verify (`npx tsc --noEmit`) will fail there. The fix is trivial (two defaults in the factory), but the plan's acceptance claim "every existing DashboardRow consumer still typechecks (review the code, not the diff)" is literally false until that fixture is updated, and the executor will otherwise edit an out-of-manifest file. (`lifecycle-consumer-ledger.test.ts:427-428` uses `DashboardRow` only in type-level asserts and is safe; `widget-data.ts:63` and `HomeScreen` are readers and are safe.)

**Plan 02 — Swipe preference migration**
- Strengths: head+1 verified — `ls src/db/migrations/` head is `019-dashboard-prefs.ts`, `database.ts:54 TARGET_VERSION = 19`, `migration019` last in `MIGRATIONS` (`:76`), so migration 020 is correct and the one-way-door checkpoint + execution-time re-verify is right. The DAO route faithfully mirrors `dashboardSort`: optional key on `PortableSettingsSnapshot` (`app-settings-dao.ts:224`) with the explicit writability-trap comment (`:202-210`), `AppSettingsPatch` derived via `Partial<Omit<…>>` (`:229-231`), `WritableSettingsKey` (`:255-287`), `COLUMN_OF` (`:368-400`, `dashboardSort:"dashboard_sort"` at `:400`), `assertDashboardSort` (`:744`), `validateAppSettingsPatch` (`:794`). Backup allowlist-now/emit-later matches: `PORTABLE_SETTINGS_KEYS` (`backup-schema.ts:132`), `dashboardSort` entry (`:172`), `assertPortableSettings` key-only check (`:201`), no `BACKUP_FORMAT_VERSION` bump.
- Concern (LOW/nit): Plan 02 cites the `AppSettings` read type at `:51`, but the `dashboardSort` read field actually sits in the `AppSettings` interface at `:121`. Line drift only; the "mirror `dashboardSort`" anchor is unambiguous.

**Plan 03 — Line-3 data + selection + star**
- Strengths: `is_current=1` grounding is exact — canonical reads filter it at `current-state-history-read.ts:31,:48`, and migration `016:48-56` confirms `current_state_entries` has `is_current` but **no** `hidden`/`outdated`/`deleted_at`, so the per-source exclusion split (LOW #3) is accurate. `id` + `created_at` exist on memories, relationships, and current_state_entries (migration 016), so the stable-id tie-break (MED #2) is feasible. `placeholders()` batch idiom exists at `knowledge-search-read.ts:86`. Registry change is single-source: `favorite` is currently `{outline:"heart-outline",filled:"heart"}` at `icon-registry.ts:37`.
- Concern (LOW): the per-contact bound relies on `ROW_NUMBER() OVER (PARTITION BY contact_id …)`. SQLite window functions (3.25+) are well within expo-sqlite's bundled version, and the plan offers "or an equivalent per-contact-scoped cap" as a fallback, so this is a note, not a risk. No existing window-function precedent in `src/db/` was found, so the executor is writing the first one.

**Plan 04 — Row content, favourite, accessibility**
- Strengths: The line-3 async fold-in targets the real cancellation structure (`HomeScreen.tsx:282` reload, `:283` `let cancelled`, `:312` `if (cancelled) return`, `:313` `setRows`). Star membership source is correct: `favourite_rank` is projected via `CARD_FAVOURITE_RANK` (`dashboard-read.ts:152-153`) in both reads (`:375`, `:428`); `isFavourite?` is populated only in the favourites-population selection (`:228`); `listFavourites` (`:465-470`) is ranked UX and correctly prohibited. Binary writes use `setFavouriteRank`/`clearFavouriteRank` (`favourites-dao.ts:32,:59`, `inWriteTransaction` + `changes===1` guard). A11y labels reuse `StatusGlyph` label strings.
- Concern (LOW) — Plan 04↔06 integration: Plan 04 Task 3 folds `readLine3Candidates(exec, loadedIds)` into `reload()` "after the population/search read resolves," without gating on non-search mode. In List search mode (Plan 06), lines 2–3 are replaced by the match explanation, so the line-3 map is computed but never consumed — harmless wasted DB work, not a correctness bug. Worth one line in Plan 04 or Plan 06 to skip line-3 when `term` is present in list mode.

**Plan 05 — Swipe gestures**
- Strengths: Real routes verified — `LogContact` (`DashboardStack.tsx:37`), `Edit` (`:57`); there is **no** `EditContact` route anywhere in `src/navigation/`, so the typed `navigateDashboardContactAction(contactId,"LogContact"|"Edit")` helper is the right guard (MED #6). The FAB extraction target is real and per-instance: `quickLogPending = useRef(false)` (`UniversalFab.tsx:126`), `quickLogUndoController = useRef(…)` (`:127`), `logContact` (`:228-278`) with single-flight (`:230-231`), `recordTouchpoint` (`:234`), `notifyWidgetDataChanged`+`bumpShellRefresh` (`:258-259`), undo/retry snackbars (`:252`/`:270`); root-nav dispatch via `navigationRef.current?.navigate("DashboardTab",…)` (`:290`,`:312`). The named-boundary requirement (hook vs injected deps, forbidding a module-scoped single-flight boolean) correctly protects the per-instance semantics. LOW #7 preference-read fallback is specified.
- Concern (LOW/nit): Plan 05 states `recordTouchpoint`/`deleteTouchpoint` "live in the services layer," but they are imported from `@/db/recency-dao` (`UniversalFab.tsx:28`). The plan hedges with "VERIFY the exact import paths on disk," so this is imprecise prose, not a defect. Likewise placing a React `useQuickLog()` hook under `src/services/` is slightly unconventional (services are otherwise non-React), but the plan explicitly permits it.

**Plan 06 — Search, motion, shared states**
- Strengths: The corpus leak is real and the fix is correctly grounded — `listKnowledgeSearchCandidates` filters only `deleted_at IS NULL` on relationships (`knowledge-search-read.ts:104`) and memories (`:135`), while `memories` has `outdated`(`016:22`)/`hidden`(`016:23`) and `relationships` has `hidden`(`016:40`); the reused choke points exist exactly as cited — `resolveVisibility(type,hidden)` is registry-default-aware (`memories-read.ts:101-109`), `resolveRelationshipVisibility(hidden)` (`relationships-read.ts:39-43`). The N+1 is real: `getValuesForContact` is called inside the per-contact loop at `:281`. Relevance-first ordering is grounded: `searchDashboard` sorts coverage→score→Dashboard-rank tie-break (`dashboard-search-match.ts:131-150`, doc `:127-130`); `DashboardSearchSourceKind`/`totalMatchCount`/`moreMatchesLabel` exist (`:17,:35,:37`). Eligible-universe integrity (MED #6) is sound — both reads run `applyPopulationPostProcessing` (`dashboard-read.ts:390`,`:446`) and the scope-relaxation lives at `:412-415`. The viewMode gate (MED #10) is justified — `reload()` currently branches on term only (`HomeScreen.tsx:300-302`). Batched custom-value read respects the normalized custom-field model (ADR-001): it reads `custom_field_values` by `contact_id IN … AND field_def_id IN …` for search matching, not sorting, so the `sortExpr()` rule does not apply.
- Concern (LOW) — fuel-only fallback edge: the merge rule is "ids in the `listDashboardSearch` fuel set but absent from the corpus result." `listDashboardSearch` matches via SQL `LIKE` on **name OR fuel** (`:416-419`), a different matcher than the corpus scorer (`matchCandidateEntries`). A name that `LIKE` catches but the corpus scorer misses would be appended as a fuel-only row with `match===null` and a **null** `snippet` (snippet is fuel-only, `:103-104`), rendering "1 match" + empty line 3. Given DASHQ-09's substring/prefix corpus matching this divergence is unlikely, but the plan's fuel-only fallback assumes a non-null `DashboardRow.snippet`; a `snippet == null` guard would close it.

### Cross-Plan / Dependency Concerns
Wave ordering is coherent: 01 (tracer) → {02 migration, 03 line-3 primitives} → 04 (row content, needs 01+03) → 05 (swipe, needs 02+04) → 06 (search, needs 04+05). The `HomeScreen.reload()` seam is touched by 04 (line-3 map) and 06 (search descriptor map + viewMode gate); both correctly commit under the single `if (cancelled) return` guard (`:312`) in the same state-set as `setRows` — this is the right shared contract, but 04 and 06 are edited in different waves against the same function, so the executor of 06 must merge onto 04's already-folded map rather than the pre-04 reload. Both plans note this. `ListRow.tsx` is progressively extended across 01/04/05/06 with a reserved `searchResult?: DashboardSearchResult | null` prop from Plan 04 to avoid a shape retrofit — good. The one unaddressed seam is the line-3-in-search-mode waste noted under Plan 04.

### Decision-Reversal Escalations
None found. Every plan enforces rather than weakens its governing decision: ADR-075 binary-favourite membership (no rank-as-order, no `listFavourites` on the list path); D-07 two-channel status (border + glyph, neutral+no-glyph for null, no fabricated fifth status); D-09 exactly-two non-destructive swipes with a global preference; D-12/DASHQ-09 relevance-first search ordering (the plan preserves `searchDashboard`'s order and appends fuel-only in Dashboard order — enforcing DASHQ-09, and the original Dashboard-order re-emit is kept rejected); forward-only migration ordering; allowlist-now/emit-later with no unauthorized `BACKUP_FORMAT_VERSION` bump. The heart→star registry change is an icon-shape choice within UI-SPEC/Claude discretion, not a reversal of ADR-075 (which governs ranking, not glyph). No rejected alternative is re-proposed.

### Verification of Prior-Cycle Resolutions
All hold against source:
- Cycle-1 relevance-first (D-12/DASHQ-09): `searchDashboard` order confirmed (`dashboard-search-match.ts:131-150`, doc `:127-130`); Plan 06 preserves it. HOLDS.
- Cycle-1 Plan 03 `is_current=1`: confirmed canonical at `current-state-history-read.ts:31,:48`; `current_state_entries` retains history (no soft-delete columns). HOLDS.
- Cycle-1 Plan 04 async into cancellation-aware reload: `:283/:312/:313` confirmed. HOLDS.
- Cycle-1 Plan 06 golden extraction test: required in Plan 06 Task 1 AC. HOLDS (plan-level).
- Cycle-2 corpus excludes hidden+outdated via `resolveVisibility` (memories-read.ts:101) and `resolveRelationshipVisibility` (relationships-read.ts:39): **both helpers verified at those exact lines and are registry-default-aware**; Plan 06 applies them over corpus rows plus an `outdated=1` drop. HOLDS.
- Cycle-2 T-27-11 corrected: Plan 06 threat register now states the correction. HOLDS.
- Cycle-2 Plan 03 per-contact bound via `ROW_NUMBER() PARTITION BY contact_id` + multi-contact test: required in Plan 03. HOLDS.
- Cycle-2 Plan 06 batched custom-field read (no N+1): N+1 confirmed at `knowledge-search-read.ts:281`; Plan 06 replaces it with one batched `contact_id IN … AND field_def_id IN …` read. HOLDS.
- Cycle-2 composeDashboardSearch gated on `viewMode==="list"`: reload's term-only branch confirmed (`:300-302`); Plan 06 gates. HOLDS.
- Cycle-2 typed nav to real routes (no `EditContact`): `Edit` (`:57`)/`LogContact` (`:37`) confirmed, no `EditContact` route. HOLDS.
- Cycle-2 Plan 04 favourite mutation-generation + Plan 01 exported DST helper + MED #2 optional-key writability + Plan 05 named runQuickLog boundary + Plan 04 `favourite_rank !== null` membership: all present in plan text and grounded in the source cited above. HOLD.
- Known false positive: `BASE_WHERE` exists at `dashboard-read.ts:172`. CONFIRMED present; moving on.

### Risk Assessment
**LOW.** The plans are execution-ready. The two cycle-2 HIGHs (corpus privacy leak; per-contact bound) are correctly incorporated and verified against source; no decision reversals; the local-first privacy trace (hidden/outdated excluded in-read via the established choke points, not a UI filter) is sound for line-3, fuel, and now corpus search. The only substantive remaining item is the Plan 01 widget-fixture typecheck gap, which is trivial to fix and will be caught by the plan's own `tsc` gate — it lowers confidence in Plan 01's file manifest, not in the architecture.

### Honest Nit Count
One substantive-but-minor finding and four LOW/nits — none block execution.
1. **MEDIUM (minor, actionable):** Plan 01 must add `last_contact`/`snooze_until` defaults to the `DashboardRow` factory at `widget-data.test.ts:24-38` and list that file; the "every consumer typechecks" claim is false until then.
2. **LOW:** Plan 04/06 — line-3 load runs (unconsumed) in list search mode; harmless waste, worth a one-line skip.
3. **LOW:** Plan 06 fuel-only fallback assumes a non-null `snippet`; add a `snippet==null` guard for a name-match the corpus scorer misses.
4. **LOW/nit:** Plan 05 calls `recordTouchpoint` a "services layer" symbol; it is in `@/db/recency-dao` (plan is self-correcting via "verify on disk").
5. **NIT:** Plan 02 cites `AppSettings` at `:51`; the field is at `:121` — line drift only.

If these are addressed inline (or explicitly deferred as non-blocking), the sequence is ready to execute — this is at the asymptotic-nit floor, not a substantive-defect level.

---

## Orchestrator Convergence Note (Cycle 3)

Independent re-verification against source confirms both lanes: **0 unresolved HIGH concerns, 0 decision reversals.** Both cycle-2 HIGHs are fully resolved and verified in the code (Plan 06 routes the corpus read through `resolveVisibility`/`resolveRelationshipVisibility`; Plan 03 uses `ROW_NUMBER() OVER (PARTITION BY contact_id)` + a multi-contact test). The remaining set is MEDIUM (minor, actionable implementation-seam refinements) and LOW/nit. Actionable non-HIGH items that the current PLAN.md files do not yet incorporate (candidates for inline fix or explicit deferral rather than a full replan):

1. **Plan 01 (MED):** add `src/services/widget/widget-data.test.ts` to the manifest and give the `row()` factory `last_contact`/`snooze_until` defaults — the required widen breaks `tsc` there. *(verified)*
2. **Plan 05 (MED):** correct the "Light-then-Success" haptic prose — current Quick Log is Success-on-write only (`UniversalFab.tsx:255`); a swipe Light haptic, if wanted, is a NEW decision, not a behavior-preserving extraction. *(verified)*
3. **Plan 04 (MED):** specify the exported status-label source (`STATUS_LABEL` is private at `StatusGlyph.tsx:37`) so "verbatim single-source reuse" is actually achievable, and list `StatusGlyph.tsx` among modified files. *(verified)*
4. **Plan 03 (MED, latent):** route line-3 memory candidates through `resolveVisibility(type, hidden) === "show"` rather than the SQL `hidden = 1` predicate, matching Plan 06's choke-point discipline — zero data impact today (all types default to `"show"`) but a consistency/robustness gap. *(verified)*
5. **Plan 04 (MED):** specify a reload-vs-optimistic reconciliation rule (a per-contact optimistic overlay that survives/yields to a wholesale reload), beyond the existing failure-path mutation-generation guard.
6. **Plan 01 (MED):** define the snooze "active" date rule as a pure `isSnoozed(snoozeUntil, now)` helper on local-calendar semantics matching `date(snooze_until) > date('now','localtime')`, with a captured `now`.
7. **Plan 06 (LOW):** require the batched custom-field query to join `custom_field_defs` + restrict to live definition IDs (preserve `getValuesForContact`'s quarantined-definition boundary), with a regression test.
8. **Plan 04/06 (LOW):** skip the line-3 load when a search term is present in list mode (unconsumed work).
9. **Plan 06 (LOW):** add a `snippet == null` guard on the fuel-only fallback row.

Pure nits with no execution impact (not counted as actionable): Plan 02 line-drift citation (`:51`→`:121`), Plan 05 "services layer" label for `@/db/recency-dao` (self-correcting), Plan 03 first-window-function note.
