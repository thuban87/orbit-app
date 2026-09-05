---
phase: 25
reviewers: [codex, claude]
reviewed_at: 2026-09-05T00:19:56Z
plans_reviewed: [25-01-PLAN.md, 25-02-PLAN.md, 25-03-PLAN.md, 25-04-PLAN.md, 25-05-PLAN.md, 25-06-PLAN.md, 25-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "subagent"
---

# Cross-AI Plan Review — Phase 25 (Dashboard Data & State Foundation)

Two independent source-grounded reviewers (Codex `gpt-5.6-terra`, Claude `opus` via read-only subagent) reviewed all 7 plans against the code on disk. Both verified file:line claims and grep-swept for consumers. The orchestrator independently re-verified every load-bearing finding below against source before recording it.

## Consensus Summary

Both reviewers rate the engineering **genuinely strong** — reuse-first, injection-clean, migration-disciplined (head+1=019 verified: `src/db/database.ts:53` `TARGET_VERSION = 18`, migrations top out at `018`), and honest about the Gravity fork (reversible post-query TS pass, no column, owner-bucket cached-column escalation flagged). Both rate **overall risk HIGH / MEDIUM-HIGH** — not for architecture, but for **one owner escalation and a cluster of concrete, verified execution gaps**.

### Agreed Concerns (raised by BOTH reviewers)

1. **HIGH / ESCALATION — Snooze vs Active is a papered-over recorded-decision conflict.** `BASE_WHERE` excludes currently-snoozed contacts (`src/db/dashboard-read.ts:155-158`: `... AND (c.snooze_until IS NULL OR date(c.snooze_until) <= date('now','localtime'))`), and Plans 01/02 preserve it **verbatim** (D-05 trip-wire). Yet **DASHQ-05** (`.planning/REQUIREMENTS.md:76`) and the **dossier §Snoozed [DECIDED]** both state *"Snoozed contacts remain in Active Contacts."* Plan 02's must-have truth literally asserts *"Snoozed contacts remain inside the Active universe"* — which its own preserved predicate makes **false**. Side effect: "All Contacts" (= Active ∪ Not-Contacted) then silently excludes currently-snoozed contacts (they have `last_contact` set, so they are not Not-Contacted either) — "All" that is not all. **This cannot be resolved in implementation without either changing `BASE_WHERE` (reverses the current snooze exclusion) or reinterpreting DASHQ-05 (reverses a recorded requirement). Owner decision required before Plans 01/02 execute.** Verified independently.

2. **HIGH — Default-sort model does not meet dossier §H; Birthdays membership/ordering seam mechanistically unspecified.** The dossier requires population-aware Default: Not Contacted → *natural not-contacted ordering*, Snoozed → *natural snooze ordering*, All Contacts → *never-contacted grouped after status-bearing*, Birthdays → *soonest*. Plan 02's `resolveDefaultSort` collapses Favourites/Snoozed/All-Contacts → `'status'`, and the `SORT` map (`src/db/dashboard-read.ts:161-170`) has only `status`(=`progress DESC`)/`name`/`least-recent`/`most-recent` — no natural-snooze, no soonest-birthday token. And `buildPopulationWhere` is a **pure, synchronous SQL builder** that cannot compute the 30-day birthday set (that needs `daysUntilBirthday`, `src/logic/birthday-logic.ts:165-204`); the SQL/JS seam (JS-computed ids → `IN (?)` + ordering) is hand-waved. Multi-population Default (e.g. `['favourites','birthdays']`) is undefined.

3. **HIGH — Plans 06/07 miss live route/test consumers; their own grep acceptance gates cannot pass.** Verified on disk, NOT in either plan's `files_modified`:
   - `src/services/widget/widget-quick-action-guard.ts:33` — functional `if (target.name === "ManageFavourites")` guard.
   - `src/navigation/focused-route-classification.test.ts:38,40` — arrays listing `"NeverContacted"` and `"ManageFavourites"`.
   - `src/db/data-revision-dao.test.ts:13` — `import { setFavouriteRank, rewriteFavouriteRanks } from "@/db/favourites-dao"` (Plan 06 removes `rewriteFavouriteRanks`).
   - `src/logic/favourites-reorder-logic.test.ts` — tests the module Plan 06 deletes; not listed for removal.
   Removing the routes/exports breaks `tsc`/tests, and Plan 06 Task 3's `grep -rn 'ManageFavourites' src` = empty gate fails while these remain.

4. **MEDIUM — Search scope is never proven to be the post-filter/post-Gravity id set.** Plan 04 (`depends_on: [25-01]`) is designed/tested before filters (Plan 03) and the Gravity post-query TS pass exist. No Phase-25 test proves search excludes a Gravity-filtered contact, so DASHQ-08 / D-09 ("scoped to the current Population + Filters universe") rests on whatever id set a render-phase consumer passes. Needs a recorded contract: the eligible-id set handed to search MUST be the fully-filtered, Gravity-narrowed set.

### Divergent / single-reviewer Views

- **Plan 05 empty-state breaks the Wave-2 `tsc` gate (Claude MEDIUM/HIGH; verified).** Task 2 changes `selectDashboardEmptyState`'s input shape but omits its sole caller `src/screens/HomeScreen.tsx:308` from `files_modified`; the Task-2 `npx tsc --noEmit` gate will fail. Fix: list HomeScreen, or make the signature additive (safer — Plans 05 and 07 both edit HomeScreen in different waves). Codex framed Plan 05 differently — as "state storage, not DASHQ-12 restoration" (the store is built but nav/scroll/search-input wiring is deferred to render phases 26-28).
- **Plan 04 scorer term-coverage contradiction (Codex HIGH; verified).** `scoreQuery` returns `null` if ANY query term fails to match (`src/services/knowledge-search.ts:111-123`; doc comment: "Every query token must match at least one corpus token"), so a partial-coverage candidate is **excluded, not ranked lower**. Plan 04 promises "a contact matching more query terms outranks one matching fewer" **while** "preserving existing scorer behaviour" — mutually exclusive. The plan must explicitly redesign the contact-level scorer or revise the product interpretation.
- **Plan 07 re-point-to-Home strands Not-Contacted retrieval (Codex HIGH).** Home uses legacy `listDashboard` and has no Not-Contacted population control until Phase 26, so deleting Never-Contacted and navigating to Home removes the practical retrieval surface; the dossier requires Not Contacted as the dedicated replacement population. The plan documents Home as a "safe live target until then" — reviewers disagree it is safe. Sequence after Phase 26 or get explicit owner acceptance of the transient gap.
- **Search corpus completeness (Codex MEDIUM).** Corpus assembles name/memory/relationship/custom-field but not category/phone/email/location; the dossier includes first-class contact data. Plan 04 calls the corpus contract "unchanged," so the gap is unowned.
- **Gravity vs rowCount for the empty-state gate (Claude MEDIUM).** A Gravity-narrowed count is only known after the TS pass; the SQL `count()` helpers (`dashboard-read.ts:337-343`) can't see it, so feeding a SQL rowCount to the empty-state gate can mis-fire `filter-empty` vs `none`.
- **Plan 06 phantom targets (Codex MEDIUM; verified).** Plan 06 Task 3 says to edit SettingsScreen and HomeScreen for a Manage-favourites affordance, but `grep -c ManageFavourites` = 0 in both files — the plan targets consumers that do not exist while missing the ones that do (see Agreed Concern 3).
- **Lower-severity (Claude/Codex):** JSON columns `dashboard_populations`/`dashboard_filters` have no DB CHECK — make "ignore unknown tokens, never interpolate" explicit at query-build (last defense for a hand-edited/restored row); backup-format wording (use v5/Phase 36, do not mirror the stale "format-4" theme comment); Plan 04 `read_first` names non-existent scorer functions (`scoreQuery`/`rankByCorpus` — real exports are `scoreCandidate`/`rankCandidates`/`searchKnowledge`); `listNeverContacted` becomes dead code after the screen is removed; Contact-Frequency band boundaries should be a single tunable constant + test; `getValuesForContact` N+1 in the corpus read is the Pixel search-perf hot spot.

### Agreed Strengths

- Migration 019 is a correctly-handled one-way door: additive `ADD COLUMN` only, no edit to 001–018, forward-only, checkpoint:decision gate, full-chain v0→v19 test; head+1=019 verified on disk.
- Durable-pref deferral mirrors the half-landed theme-key posture exactly: OPTIONAL `?:` snapshot members + `WritableSettingsKey`/`COLUMN_OF`/`PORTABLE_SETTINGS_KEYS` allowlisting, but NOT emitted in `getPortableSettingsSnapshot` and no `BACKUP_FORMAT_VERSION` bump (`app-settings-dao.ts:184-200`; `backup-schema.ts:155-166`).
- `BASE_WHERE` preserved verbatim; All Contacts is an explicit `(BASE_WHERE) OR (never-contacted)` union with archived+unbound ANDed on every population (D-05 honored, modulo the snooze semantics question).
- Birthdays route through the shared `daysUntilBirthday` parser (local-midnight, Feb-29-explicit), never a SQL `date()` window or `toISOString().split` — the exact reuse the two prior off-by-one bugs demand.
- Never-contacted/snoozed rows keep the `CARD_STATUS` CASE-wrap → NULL status/progress, never bucketed 'stable' (HIGH-1 guard).
- Gravity kept out of SQL: reversible post-query TS pass reusing `computeContactGravity`/`GRAVITY_TIERS`, cached-column reserved as an owner decision; injection-clean throughout (static SQL, closed code-constants, `?`-bound values, `escapeLike`).
- ADR-031 "no FTS / no index" enforced by a negative grep gate; ADR-075 favourite-rank retirement keeps the column + internal picker reads intact.

---

## Codex Review

# Plan Review — Phase 25

## Summary

The plan set has strong source grounding around migrations, existing SQL safeguards, and consumer-retirement discovery. However, it is not yet execution-ready: several requirements are contradicted by the current `BASE_WHERE` semantics, search is never wired into the shared result pipeline, navigation-session restoration is only a standalone store, and retirement plans omit live compile/test consumers. Overall risk: **HIGH**.

## Strengths

- Migration sequencing is correctly based on the actual schema head: `TARGET_VERSION = 18` and migrations stop at `018` today. [src/db/database.ts:53](/home/bwales/projects/orbit-app/src/db/database.ts:53), [src/db/database.ts:56](/home/bwales/projects/orbit-app/src/db/database.ts:56)

- Plan 01 correctly preserves the Active predicate as a distinct, restrictive SQL fragment. `BASE_WHERE` excludes archived, Unbound, never-contacted, and future-snoozed rows. [src/db/dashboard-read.ts:150](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:150), [src/db/dashboard-read.ts:155](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:155)

- The proposed durable-preference approach fits the DAO’s established design: preferences are typed in `AppSettings`, mapped through `COLUMN_OF`, and use bound update values. [src/db/app-settings-dao.ts:44](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:44), [src/db/app-settings-dao.ts:336](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:336), [src/db/app-settings-dao.ts:841](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:841)

- Deferring backup-wire emission is correct. Theme fields already use optional snapshot members while intentionally remaining absent from `getPortableSettingsSnapshot`. [src/db/app-settings-dao.ts:184](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:184), [src/backup/backup-schema.ts:155](/home/bwales/projects/orbit-app/src/backup/backup-schema.ts:155)

- Plan 04 correctly builds on a currently unscoped but term-free corpus reader, which is the appropriate place to add eligible-ID scoping. [src/db/knowledge-search-read.ts:56](/home/bwales/projects/orbit-app/src/db/knowledge-search-read.ts:56), [src/db/knowledge-search-read.ts:116](/home/bwales/projects/orbit-app/src/db/knowledge-search-read.ts:116)

- Plan 03 correctly avoids inventing a gravity SQL column. Gravity is explicitly read-time derived from interactions, with cached storage named only as a future performance fallback. [src/services/impact.ts:8](/home/bwales/projects/orbit-app/src/services/impact.ts:8), [src/services/impact.ts:88](/home/bwales/projects/orbit-app/src/services/impact.ts:88)

- Plan 07 correctly recognizes the Unbound-search trip-wire: the dedicated Unbound screen currently has no search. [src/screens/UnboundContactsScreen.tsx:22](/home/bwales/projects/orbit-app/src/screens/UnboundContactsScreen.tsx:22), [src/db/unbound-read.ts:23](/home/bwales/projects/orbit-app/src/db/unbound-read.ts:23)

## Concerns

- **HIGH — ESCALATION: DASHQ-05 conflicts with the locked Active predicate.** Plans 01/02 state that Snoozed contacts remain in Active, while also preserving `BASE_WHERE` verbatim. But `BASE_WHERE` expressly excludes future-snoozed contacts. [src/db/dashboard-read.ts:155](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:155) The dossier likewise says Snoozed remain in Active. [phase dossier:104](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-04-dashboard-data-state-foundation-dossier.md:104) This cannot be resolved by implementation without weakening a recorded invariant. Owner clarification is required: whether “Active” means the default visible list or the broader active lifecycle universe.

- **HIGH — Plan 02’s Default-sort model does not meet the dossier.** It maps Favorites/Snoozed/All Contacts to `status`; but the dossier requires natural not-contacted ordering, natural snooze ordering, and All Contacts with never-contacted after status-bearing rows. [phase dossier:154](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-04-dashboard-data-state-foundation-dossier.md:154) Current `SORT.status` merely sorts `progress DESC`, which cannot produce the required Snoozed or Not Contacted behavior. [src/db/dashboard-read.ts:161](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:161)

- **HIGH — Birthday membership cannot be represented by the proposed synchronous SQL predicate builder.** The only shared birthday domain function is JavaScript `daysUntilBirthday(stored, today)`, including local-midnight and Feb-29 behavior. [src/logic/birthday-logic.ts:153](/home/bwales/projects/orbit-app/src/logic/birthday-logic.ts:153) Plan 02 says `buildPopulationWhere()` returns SQL synchronously but separately suggests a JS birthday prefilter. It does not specify how JS-derived IDs participate in an OR-union, membership flags, filtering, and ordering without invalid `IN ()` SQL or inconsistent universes.

- **HIGH — Search has no integration owner.** Plan 04 creates scoped search components, but depends only on 25-01 while its required eligible-ID producer is built in Plans 02/03. No plan wires `listDashboardPopulation` → eligible IDs → `listKnowledgeSearchCandidates` → `searchDashboard` into a single result read. The current runtime search remains the legacy branch, which relaxes to archived-only and therefore includes Unbound contacts. [src/db/dashboard-read.ts:230](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:230), [src/screens/HomeScreen.tsx:558](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:558) This leaves DASHQ-08–10 unfulfilled.

- **HIGH — Plan 04’s stated ranking behavior conflicts with the existing scorer.** `rankCandidates()` requires every query term to match the combined corpus; a candidate matching only one term is excluded rather than ranked below a two-term match. [src/services/knowledge-search.ts:111](/home/bwales/projects/orbit-app/src/services/knowledge-search.ts:111), [src/services/knowledge-search.ts:148](/home/bwales/projects/orbit-app/src/services/knowledge-search.ts:148) The plan promises a two-term result outranks a one-term result while also preserving existing scoring behavior. It must explicitly redesign the contact-level scorer or revise the product interpretation.

- **MEDIUM — Search corpus remains incomplete relative to the decision record.** Existing corpus assembly includes names, memories, relationships, and custom fields, but not category, phone, email, or location. [src/db/knowledge-search-read.ts:120](/home/bwales/projects/orbit-app/src/db/knowledge-search-read.ts:120) The dossier explicitly includes appropriate first-class contact data. [phase dossier:184](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-04-dashboard-data-state-foundation-dossier.md:184) Plan 04 calls the existing contract unchanged, so this gap remains unowned.

- **HIGH — Plan 05 implements state storage, not Dashboard → Profile → Back restoration.** The current screen owns its own search state and list rendering. [src/screens/HomeScreen.tsx:180](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:180), [src/screens/HomeScreen.tsx:554](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:554) No plan connects the session store to search input, scroll callbacks/ref restoration, profile navigation, or cold-launch hydration. A fresh Zustand store test cannot prove DASHQ-12.

- **HIGH — Plan 06 misses several consumers of `ManageFavourites` / rank rewrite.** Removing the route breaks the widget intent guard, which branches on `ManageFavourites`. [src/services/widget/widget-quick-action-guard.ts:32](/home/bwales/projects/orbit-app/src/services/widget/widget-quick-action-guard.ts:32) It also omits tests and imports that will fail after deletion: [src/navigation/focused-route-classification.test.ts:38](/home/bwales/projects/orbit-app/src/navigation/focused-route-classification.test.ts:38), [src/db/data-revision-dao.test.ts:13](/home/bwales/projects/orbit-app/src/db/data-revision-dao.test.ts:13), [src/logic/favourites-reorder-logic.test.ts:5](/home/bwales/projects/orbit-app/src/logic/favourites-reorder-logic.test.ts:5).

- **MEDIUM — Plan 06 targets phantom consumers.** It lists Settings and Home edits for a Manage Favourites affordance, but repository searches show no `ManageFavourites` reference in either file; the actual deep-link and stack consumers are elsewhere. [src/navigation/widget-linking.ts:144](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:144), [src/navigation/tabs/DashboardStack.tsx:68](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:68)

- **HIGH — Plan 07’s “re-point to Home” does not provide the replacement population route.** The current Home UI uses legacy `listDashboard` and has no Not Contacted population control. [src/screens/HomeScreen.tsx:194](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:194), [src/db/dashboard-read.ts:199](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:199) Deleting Never Contacted and navigating to Home therefore removes the practical retrieval surface until a later render phase. The dossier requires Not Contacted to be the dedicated replacement population. [phase dossier:99](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-04-dashboard-data-state-foundation-dossier.md:99)

- **MEDIUM — Plan 07’s file/test inventory is incomplete.** `HomeScreen.test.tsx` imports the legacy Unbound-row presentation helper. [src/screens/HomeScreen.test.tsx:2](/home/bwales/projects/orbit-app/src/screens/HomeScreen.test.tsx:2) The plan removes the runtime rendering but neither updates this test nor clearly decides whether the helper remains. It also describes editing `HomeScreen.tsx` in Tasks 2–3 without listing it in Task 2’s file ownership.

- **LOW — Backup format wording is inconsistent.** Plan 01 says a future “format-5” backup in one action, while the repository is already at format 4 and the established deferred-emission comment refers to format 4. [src/backup/types.ts:13](/home/bwales/projects/orbit-app/src/backup/types.ts:13), [src/backup/backup-schema.ts:155](/home/bwales/projects/orbit-app/src/backup/backup-schema.ts:155)

## Suggestions

1. Stop before Plan 02 and obtain an owner ruling on the Snoozed/Active contradiction. Record the exact replacement semantics in the dossier or an ADR.

2. Add a dedicated shared `dashboard-result-read` orchestration plan after Plans 02–04. It must own ordinary browse and search paths, derive eligible IDs once, apply search relevance/tie-breaks, and return one renderer-neutral result model.

3. Split birthday handling from SQL predicate composition. First calculate birthday eligibility/order using `daysUntilBirthday`, then pass the resulting bounded ID/order data into the union engine with defined empty-set behavior and explicit membership-reason rules.

4. Revise the search scoring contract: decide whether partial multi-term matches are allowed, then add fixtures for coverage, phrase strength, exact-name boosts, and descriptor highlighting over normalized/diacritic-folded text.

5. Add a navigation integration task for session restoration: screen focus hydration, `FlatList` offset capture/restore, search-store binding, and a component/navigation test—not just a Zustand unit test.

6. Expand Plan 06/07 retirement inventories to include all source and test consumers, especially `widget-quick-action-guard.ts`, focused-route tests, data-revision tests, reorder tests, and HomeScreen tests.

7. Do not retire Never Contacted’s user-facing route until a live population-control route can select Not Contacted. If Phase 26 owns that UI, sequence the retirement after it or explicitly add a temporary parameterized Home entry that actually activates the shared population state.

## Risk Assessment

**HIGH.** The implementation foundations are thoughtfully scoped, but unresolved semantic contradictions, unowned search integration, incomplete session restoration, and deletion plans with known unlisted consumers are likely to cause either requirement failures or immediate test/TypeScript breakage.

---

## Claude Review

# Cross-AI Plan Review — Phase 25 (Dashboard Data & State Foundation)

**Reviewer:** Claude (Opus) · read-only · verified against code on disk 2026-09-04
**Scope:** 7 plans (25-01…25-07), 4 waves. Claims below were traced to the actual files; `file:line` evidence is load-bearing.

**Verification anchors confirmed on disk:**
- Migration head is `018` and `TARGET_VERSION = 18` (`src/db/database.ts:53`; `ls src/db/migrations/` tops out at `018-custom-field-scope-history.ts`). So `019` / `TARGET_VERSION = 19` is genuinely head+1. ✓
- `BASE_WHERE` at `src/db/dashboard-read.ts:155-158`; `CARD_STATUS` CASE-wrap at `:131-132`; `SORT` map at `:161-170`; injection posture comment at `:43-51`; never-contacted predicate in `listNeverContacted` at `:313-319`; snoozed reveal branch at `:248`; `listBirthdayCandidates` at `:391-399`. All as the plans cite. ✓
- `app-settings-dao.ts` OPTIONAL theme-key deferred-emission pattern at `:184-200`; validator idiom (`assertThemeMode`/`assertAccentId`/`assertPhoneRegionOverride`) present; `getPortableSettingsSnapshot` SELECT deliberately omits theme keys (`:498-507`). ✓
- `PORTABLE_SETTINGS_KEYS` at `src/backup/backup-schema.ts:132-166`; `SECRET_SHAPED_KEY` at `:168-169`; `assertPortableSettings` rejects any non-allowlisted key on restore (`:193-197`). ✓
- `birthday-logic.ts` `daysUntilBirthday` is pure JS, compares local-midnight to local-midnight, explicit Feb-29 branch, never `toISOString().split` (`:165-204`). ✓
- `status.ts`: `STABLE_MAX = 0.8`, `WOBBLE_MAX = 1.0`, `ROGUE_K = 3` (`:40-42`). ✓
- `impact.ts`: `GRAVITY_TIERS` (`:63`), `computeContactGravity` (`:88`). ✓
- Scorer public surface: `tokenize`/`boundedEditDistance`/`scoreCandidate`/`rankCandidates`/`searchKnowledge` (`knowledge-search.ts:32,47,94,148,168`).

---

## HIGHEST-SEVERITY FINDING (read first) — snooze/Active conflict is papered over

**HIGH / ESCALATION — DASHQ-05 "snoozed remain in Active Contacts" conflicts with the preserved `BASE_WHERE`, and Plan 02 asserts a truth its own code makes false.**

`BASE_WHERE` **excludes** currently-snoozed contacts: `... AND (c.snooze_until IS NULL OR date(c.snooze_until) <= date('now','localtime'))` (`src/db/dashboard-read.ts:155-158`). Plans 01/02 keep `BASE_WHERE` **verbatim** for the Active universe (D-05 trip-wire).

But **DASHQ-05** states: *"Snoozed contacts **remain in Active Contacts** but are suppressed from Needs Attention while staying reachable via population selection…"* and **D-05's exclusion list for Active is only `{never-contacted, archived, unbound}` — snoozed is *not* listed.** Under a verbatim `BASE_WHERE`, a currently-snoozed contact is in **neither** Active **nor** All Contacts (= Active ∪ Not-Contacted; snoozed rows have `last_contact` set, so they're not Not-Contacted either) — reachable **only** via the Snoozed population.

Plan 02's own must-have truth claims *"Snoozed contacts **remain inside the Active universe**"* (gsd-review-plan-01.md, truths bullet 6) — which is **factually false** given the `BASE_WHERE` the same plan preserves verbatim.

This is a genuine requirement-vs-trip-wire collision the plans resolve silently:
- If the intent is "snooze suppression should move out of `BASE_WHERE` into the Needs-Attention filter" (so Active *includes* snoozed), then keeping `BASE_WHERE` verbatim is **wrong** and DASHQ-05 is unmet.
- If the intent is "`BASE_WHERE` stays as-is and snoozed are only reachable via the Snoozed population," then DASHQ-05's "remain in Active Contacts" wording and D-05's snoozed-omitting exclusion list are wrong, and Plan 02's truth statement must be corrected.

Either branch is an **owner decision** (it reverses/reinterprets a recorded requirement or the `BASE_WHERE` trip-wire). **Stop and confirm the dossier's snooze semantics before executing Plans 01/02.** Do not ship Plan 02 with a must-have truth that its own preserved predicate contradicts. *(The dossier itself was not in the review packet; downgrade to an open question only if the dossier amendment explicitly reconciles this — but the plan text as written is self-contradictory regardless.)*

---

## 25-01 — Schema (migration 019) + durable-pref DAO + query-state tracer [Wave 1]

**Summary.** The strongest-designed plan. It correctly treats migration 019 as a one-way door, mirrors the exact half-landed theme-key posture for portable-key deferral, and proves the schema→DAO→store→query contract end-to-end before any expansion. The migration number, ALTER idiom, DAO surfaces, and deferred-emission pattern all match disk. Two real gaps: the snooze contradiction above (inherited), and a soft spot in the JSON-column tamper story.

**Strengths.**
- Head+1 is real: migration head `018` / `TARGET_VERSION 18` confirmed (`src/db/database.ts:53`; migrations dir), and Task 1's checkpoint re-verifies with `ls` + `grep` before writing — exactly the "numbers drift every schema phase" discipline (MEMORY: migration-005/006 renumber).
- The deferred-emission mirror is precise: the plan adds keys as OPTIONAL `?:` to `PortableSettingsSnapshot`, to `WritableSettingsKey` + `COLUMN_OF`, and to `PORTABLE_SETTINGS_KEYS`, but **not** to the `getPortableSettingsSnapshot` SELECT — matching the theme keys verbatim (`app-settings-dao.ts:184-200,498-507`; `backup-schema.ts:155-166`). This keeps the format-4 wire shape byte-stable, which the acceptance criterion `grep`-guards.
- Additive ALTER idiom matches `015-theme-settings.ts` (`ADD COLUMN … NOT NULL DEFAULT … CHECK(…)`); a single-row DEFAULT fills the id=1 row with no separate UPDATE — correct for this single-row table.
- Validator idiom is faithful: `assertDashboardViewMode/Sort/Populations/Filters` run in `validateAppSettingsPatch` **before** the UPDATE opens (the T-11-05 posture, `app-settings-dao.ts:707-768,783-785`), so a tampered blob can't reach a query.
- `SORT.status = "progress DESC, …"` (`dashboard-read.ts:166`) genuinely sorts NULL progress last in DESC, so "Default → status, NULLs-last" is accurate.

**Concerns.**
- **HIGH / ESCALATION** — snooze/Active contradiction (see top section); the Task-2 behavior "the Active read… a seeded… currently-snoozed contact [is] absent" is correct *for `BASE_WHERE`* but is asserted alongside Plan 02's "snoozed remain inside the Active universe." Reconcile before execution.
- **LOW** — the two JSON-TEXT columns (`dashboard_populations`, `dashboard_filters`) get **no DB-level CHECK** (only `view_mode`/`sort` are CHECK'd enums, per the plan's own column spec). Integrity therefore rests entirely on (a) the DAO validators, (b) the store's parse-guard-to-`[]`/`{}`, and (c) `buildPopulationWhere` mapping only *known* tokens to closed constants. That triad is sound **iff** `buildPopulationWhere` never interpolates an unrecognized token and silently drops it. Make that explicit in Plan 02/03 (an unknown population/family token must be ignored, never concatenated) — it is the last line of defense for a row written by a path that bypasses the DAO (e.g. a future restore of a hand-edited backup).
- **LOW** — the plan says the new keys are allowlisted so "a future format-**5** backup carrying them is accepted." That is *more* correct than the stale theme-key comment (which still says "format-4", `backup-schema.ts:155-158`) because `FORWARD_MIGRATIONS` already reaches 4 (`backup-schema.ts:96-102`; MEMORY: v4 landed early). Just don't "mirror verbatim" the stale "format-4" wording — use v5/Phase 36.

**Suggestions.** State the unknown-token drop rule in the query-logic contract now (it's cheap and closes the JSON tamper gap). Add a full-chain test that jumps v0→v19 in one launch (the plan already implies it — keep it explicit, since a device may skip 18 intermediate versions).

**Risk: MEDIUM** (LOW on mechanics; MEDIUM only because it carries the unresolved snooze question into the tracer's asserted behavior).

---

## 25-02 — Populations OR-union engine [Wave 2]

**Summary.** Architecturally correct (single-WHERE OR-union + membership flags, not `UNION`; archived/unbound ANDed on every predicate; birthdays via the shared JS parser). But it contains the false snooze truth, under-specifies the Birthdays SQL/JS seam, and leaves multi-population Default sort undefined.

**Strengths.**
- Dedupe strategy is right: single SELECT with OR'd population predicates + per-population membership-flag columns retains match reasons (Pitfall 4), verified against the mutually-exclusive legacy branch model it replaces (`dashboard-read.ts:180-265`).
- All Contacts is built as an explicit union `(BASE_WHERE) OR (never-contacted)` with archived+unbound still ANDed — not a weakening of `BASE_WHERE` (D-05 trip-wire honored). The never-contacted predicate it unions is the real one at `dashboard-read.ts:313-319`.
- Birthdays correctly routed through `birthday-logic.ts`'s `daysUntilBirthday` (pure, local-midnight, Feb-29-explicit — `birthday-logic.ts:147,179-204`) rather than a SQL `date()` window; the plan explicitly forbids reintroducing `toISOString().split` — this is the exact reuse the dossier §O and the two legacy off-by-one bugs demand.
- Never-contacted/snoozed rows keep the `CARD_STATUS` CASE-wrap projecting NULL (`dashboard-read.ts:131-132`), never bucketed 'stable' (HIGH-1 guard preserved).
- Favourites population = `favourite_rank IS NOT NULL` as membership only, Default order, no `favourite_rank` in ORDER BY (ADR-075).

**Concerns.**
- **HIGH** — must-have truth "Snoozed contacts remain inside the Active universe" is false under the preserved `BASE_WHERE` (see top). Also a **consequence worth surfacing to the owner:** because Active excludes future-snoozed and Not-Contacted requires `last_contact IS NULL`, **"All Contacts" silently excludes currently-snoozed contacts** — a population named "All" that is not all. Confirm this is intended.
- **MEDIUM** — the Birthdays predicate seam is under-specified across the pure layer (Task 1 `buildPopulationWhere`, which cannot read the DB) and the read layer (Task 2, which computes the 30-day set in JS). `buildPopulationWhere` is pure and can only emit a placeholder; the read must inject a JS-computed `c.id IN (?, …)` set. If an executor tries to make `buildPopulationWhere` self-contained for birthdays, they'll reintroduce SQL date arithmetic (the UTC/Feb-29 bug). Nail the seam: read layer computes ids via `daysUntilBirthday` and binds them; the pure layer only names the token.
- **MEDIUM** — **multi-population Default sort is undefined.** `resolveDefaultSort('default', populations)` takes a *set*, but the plan only maps single populations (Active/Fav/Snoozed/All → status; Birthdays → soonest-first). What does Default resolve to for `['favourites','birthdays']`? And "soonest-first" needs a JS-provided days-until ordering that doesn't exist in the `SORT` map (`dashboard-read.ts:161-170`) — carrying it into a single ORDER BY alongside an OR-union of other populations is non-trivial (e.g. an id-position `CASE`). Specify the precedence and the birthday-ordering mechanism.

**Suggestions.** Define Default-sort precedence for mixed selections explicitly (e.g. "if Birthdays ∈ selection and it is the sole population → soonest-first; otherwise → status"). Add a test for a Favourites+Birthdays combined Default order so the ambiguity can't ship silently.

**Risk: MEDIUM-HIGH** (carries the snooze escalation + two real under-specifications on birthday ordering).

---

## 25-03 — Filters (5 families) + reversible Gravity TS filter + sort [Wave 3]

**Summary.** Solid and injection-clean. The Gravity post-query decision is the phase's one real fork and is handled correctly (reversible, no column, flagged as an owner one-way-door only if it profiles badly). Main gaps are around how the Gravity post-filter interacts with search scope and count consistency.

**Strengths.**
- The four SQL-expressible families map to real columns/fragments: Category→`c.category_id`, Battery→`c.social_battery`, Frequency→`c.interval_days`, Needs-Attention→`(PROGRESS_SQL) >= STABLE_MAX` — the last is exactly the shipped needs-attention branch (`dashboard-read.ts:253-255`; `STABLE_MAX = 0.8`, `status.ts:40`). Every value `?`-bound; family keys/columns are closed constants.
- Gravity is correctly kept OUT of SQL (no gravity column exists — confirmed `impact.ts` has `computeContactGravity`/`GRAVITY_TIERS` but `contacts` has no tier column) and resolved as a pure post-query TS pass reusing the owner-approved tunables (`impact.ts:63,88`). The `<assumption>` records it as reversible with a Pixel-only perf gate and a cached column reserved for the owner — this is the right disposition for Open Q1/A2, not a silent choice.
- `filterByGravity` is injected a `loadInputs` reader → node-testable without a live DB; input-order preservation keeps the SQL ORDER BY intact.

**Concerns.**
- **MEDIUM** — **Gravity post-filter and search scope are not reconciled.** Search (Plan 04) scopes to an `eligibleIds` set; Plan 03's Gravity filter removes rows *after* the SQL read. Nothing in Phase 25 states whether the id set fed to search is pre- or post-Gravity. If a consumer passes the pre-Gravity SQL ids, search will surface a contact the active Gravity filter excluded — violating D-09 ("scoped to the current Population + **Filters** universe"). Record the contract: the eligible-id set handed to search must be the **fully-filtered** set, Gravity pass included.
- **MEDIUM** — **counts vs Gravity.** Populations/filters counts feed the empty-state gate (Plan 05). A Gravity-filtered result count can only be known *after* the TS pass, but the SQL `count()` helpers (`dashboard-read.ts:337-343`) can't see it. If the empty-state gate is fed a SQL rowCount while the rendered set is Gravity-narrowed, `filter-empty` vs `none` can misfire. Note how rowCount is sourced when Gravity is active.
- **LOW** — Contact-Frequency "bucket→band over `interval_days`" mapping is left to the executor as a code-constant. Fine, but the band boundaries are a product-ish choice; make sure they're a single tunable constant (CLAUDE.md convention) and covered by a test, since a wrong band silently mis-filters.

**Suggestions.** Add an integration test that runs the full `population → SQL filter → Gravity post-pass → id set` and asserts the id set that would scope search excludes a Gravity-dropped contact. Document the rowCount-with-Gravity path for the empty-state input.

**Risk: MEDIUM** (mechanics sound; the cross-plan Gravity/search/count seam is the exposure).

---

## 25-04 — Scoped semantic search + match descriptors [Wave 2]

**Summary.** The reuse posture is exactly right (scope the corpus read, reuse the scorer/tokenizer, add a pure descriptor module) and the ADR-031 "no FTS/no index" line is grep-gated. The main risk is the same scope-completeness seam as Plan 03, plus a couple of naming mismatches against the actual scorer surface.

**Strengths.**
- Corpus read is genuinely unscoped today: `LIST_CONTACTS = "SELECT id AS contactId, name FROM contacts ORDER BY id"` (`knowledge-search-read.ts:56-59`) reads all contacts; the plan adds an `eligibleIds` scope with `?`-bound `IN (…)` expansion. Because candidates are assembled by iterating the (now-scoped) contacts (`:143-171`), scoping `LIST_CONTACTS` alone already prevents out-of-scope emission; scoping the memory/relationship/custom reads too is a correct perf win.
- The corpus is already metadata-safe: only `name`, memory `custom_label`/`value`/`note`, relationship `person_name`, and live non-blank custom values enter `entries` — no uid/provenance/timestamps/`allow_ai` (`knowledge-search-read.ts:101-167`). The "a term matching only provenance returns nothing" test is satisfiable by construction.
- Structural exclusion of archived/unbound is real: they never enter the eligible id set (produced by the archived/unbound-excluding population WHERE), so search can't surface them — an in-query guarantee, not a UI `.filter()`.
- `MEMORY_TYPE_REGISTRY[type].displayName` as the `fieldLabel` source is a real registry (`memory-registry.ts`), not a Dashboard hardcode (dossier §J).
- ADR-031 preserved and grep-gated (`fts5|VIRTUAL TABLE|CREATE INDEX` must be empty) — the escalation trip-wire is enforced mechanically.

**Concerns.**
- **MEDIUM** — same scope-completeness seam as Plan 03: Plan 04 `depends_on: [25-01]` only, so it is designed and tested **before** filters/Gravity exist. That's fine for unit isolation, but **no Phase-25 test proves search excludes a Gravity-filtered contact**, and the plan's DASHQ-08 claim ("scoped to the current Population + Filters universe") is only as true as the id set a future consumer passes. Add a recorded contract (and ideally a render-phase test hook) that the id set is post-filter+post-Gravity.
- **LOW** — read_first names scorer functions `scoreQuery` and `rankByCorpus` (gsd-review-plan-03.md Task 2 read_first), but the module's actual public surface is `scoreCandidate`/`rankCandidates`/`searchKnowledge` (`knowledge-search.ts:94,148,168`); `tokenScore` is private (not exported). Not load-bearing (same module, "read in full"), but the executor should thread descriptors through the *real* seam (`scoreCandidate`/private `tokenScore`), not the named-but-absent functions.
- **LOW** — `getValuesForContact` is called per-contact (`knowledge-search-read.ts:157`) — an N+1 that the eligible-id scope shrinks but does not eliminate. On a large corpus with a large eligible set this is the perf hot spot the "Pixel-only" search-perf gate must actually exercise.

**Suggestions.** Make the eligible-id-set contract explicit in this plan's key_links ("the id set MUST be the fully-filtered/Gravity-narrowed set"), even though the wiring lands in 26–28. Fix the read_first function names to the real exports to avoid an executor chasing a non-existent symbol.

**Risk: MEDIUM** (self-contained and well-guarded; exposure is the deferred scope wiring shared with Plan 03).

---

## 25-05 — Ephemeral session store + empty-state population model [Wave 2]

**Summary.** The session store is trivial and correct. The empty-state extension is fine in isolation but has a **files_modified gap that will break the Wave-2 `tsc` gate**: it changes a shared function's input shape without listing its only caller.

**Strengths.**
- Ephemeral-by-construction is verifiable: a plain `create(...)` store with `searchText:''`/`scrollOffset:0`, no `persist`/AsyncStorage/DAO — the `shell-transient-store.ts` precedent is the right idiom, and the grep gate (`async-storage|persist|createJSONStorage` empty) is a real proof that search/scroll never reach durable storage (DASHQ-11/12).
- Keeping the empty-state precedence single-gate (rowCount>0 → none → hasTerm → search-empty → active-filter → filter-empty → population fallback) preserves the HIGH-2/MEDIUM-4 fixes and keeps arithmetic out of render screens.

**Concerns.**
- **MEDIUM/HIGH** — **`files_modified` omits `src/screens/HomeScreen.tsx`, the only caller of `selectDashboardEmptyState`** (`HomeScreen.tsx:308`, confirmed by grep — the sole non-test consumer). Task 2 changes `DashboardEmptyInput` from the filter enum to the population model (a breaking signature change) and its verify runs `npx tsc --noEmit && npx vitest run`. With `HomeScreen.tsx:308` still passing the old shape, **tsc will fail at the Wave-2 gate**. Either (a) add `HomeScreen.tsx` to `files_modified` and update the call site, or (b) make the extension additive (accept both shapes) so the legacy caller keeps compiling until Plan 07/render phases. Note Plan 07 (Wave 4) also edits HomeScreen — so at Wave 2 HomeScreen must still be internally consistent.
- **LOW** — the plan says "update all existing callers/tests (grep first)" in the action but doesn't reflect that caller in the manifest; the grep the plan mandates would find `HomeScreen.tsx:308` — make the manifest match the action.

**Suggestions.** Prefer the additive-signature approach (new optional population fields; keep the old filter enum accepted) so the shared gate never depends on a same-wave HomeScreen edit — it also de-risks the Plan-05/Plan-07 HomeScreen contention. If instead you cut over, list HomeScreen in `files_modified`.

**Risk: MEDIUM** (a concrete build-break at the wave gate; easy fix).

---

## 25-06 — Favourites retirement (ADR-075) [Wave 3]

**Summary.** Right intent (keep the column, retire the rank-order UX, re-point the widget to Default order) and correctly identifies the picker/sun/merge/capture reads to leave intact. But its consumer sweep is **incomplete** — it misses two live references to the `ManageFavourites` route name, so its own `grep -rn 'ManageFavourites' src` = empty acceptance criterion cannot pass as written, and one of the misses is a functional quick-action guard.

**Strengths.**
- `favourite_rank` column is genuinely kept; the internal rank reads it protects are real and still ORDER BY it: `capture-read.ts:65-66`, `sun-picker-read.ts:45`(via research), `merge-candidate-read.ts:29`, `picker-read.ts:34,42` — all `(favourite_rank IS NULL), favourite_rank ASC` orderings that must survive (D-04 trip-wire honored; no migration added).
- Widget re-point is well-targeted: `widget-data.ts` today calls `listDashboard({filter:'favourites', sort:'status'})` and relies on the branch ignoring sort and ordering by `favourite_rank ASC` (`widget-data.ts:74-84`; `dashboard-read.ts:241-245`) — exactly the rank ordering ADR-075/ADR-043 retire.
- Screen/route/deep-link removals are otherwise enumerated (DashboardStack `:68-69`, types `:75`, widget-linking `:92,148`).

**Concerns.**
- **MEDIUM** — **missed consumer: `src/services/widget/widget-quick-action-guard.ts:33`** does `if (target.name === "ManageFavourites")` — a **functional** guard on the retired route name, and it is **not** in Plan 06 `files_modified`. Removing the route without updating this guard leaves dead/misrouting logic and (depending on typing against `RootStackParamList`) can break `tsc`. Add it.
- **MEDIUM** — **missed consumer: `src/navigation/focused-route-classification.test.ts:40`** lists `"ManageFavourites"` (and `:38` `"NeverContacted"`). If these arrays are typed against the route-name union, removing the routes from `navigation/types.ts` breaks this test's compile. Task 3's acceptance `grep -rn 'ManageFavourites' src` = "no match" **will fail** while this test file references it. Add the test to the sweep or update it.
- **LOW** — Task 1 offers a fallback "*or the legacy favourites read re-pointed to Default order*." That fallback **contradicts Plan 02's freeze** ("Do NOT modify the legacy `listDashboard`/`listFavourites`"). Drop the fallback; the widget must re-point to the new `listDashboardPopulation(['favourites'])` entry, not the frozen legacy branch.

**Suggestions.** Expand `files_modified` to include `widget-quick-action-guard.ts` and `focused-route-classification.test.ts`; make Task 3's grep gate cover test files too (or scope it to `src --include=*.ts --include=*.tsx` excluding tests, consciously). Confirm the widget uses the Plan-02 population entry only.

**Risk: MEDIUM** (correct core; two real missed consumers that its own acceptance gate would trip on).

---

## 25-07 — Retire banner + Never-Contacted screen + include-Unbound toggle; Unbound replacement search [Wave 4]

**Summary.** Handles the four trip-wire retirements as consumer-repointing (not blind deletes), keeps `countNeverContacted` + the portable key/column for Phase 36, provides a real ADR-062 replacement (Unbound child-route search), and flags the D-06 birthday coverage gap rather than dropping it silently. Mostly complete; one missed route-name reference and a legacy-search loose end.

**Strengths.**
- ADR-062 replacement is real: `unbound-read.ts` today has only `listUnbound`/`countUnbound` (`:24,42`) — no search — so `searchUnbound` (`?`-bound `LIKE ? ESCAPE '\'` via `escapeLike` from `fuel-read.ts:168`, scoped to `archived_at IS NULL AND tracking_enabled = 0`) genuinely restores the only name-lookup path Dashboard search removes (D-07/R-11). Injection-clean.
- `countNeverContacted` correctly kept for Digest (`dashboard-read.ts:346-360`; `DigestScreen.tsx:100` consumes it); the column + `PORTABLE_SETTINGS_KEYS` entry + DAO field are explicitly **not** dropped (coordinated with Phase 36 backup bump — D-05 deletion-with-consumers). This is the right, non-unilateral posture.
- Birthday coverage gap is `flagged-unverified`, not silently dropped (D-06); `listBirthdayCandidates` is kept because `notification-read.ts` consumes it (`dashboard-read.ts:391-399`).
- Freshness triad (useFocusEffect/AppState/pull-to-refresh) explicitly retained on banner removal (ADR-076).

**Concerns.**
- **MEDIUM** — **`focused-route-classification.test.ts:38` references `"NeverContacted"`** and is not in `files_modified`. Same failure mode as Plan 06: removing the route from `navigation/types.ts:65` can break this test's compile, and a broad `grep` for the route name won't be clean. Include it.
- **LOW** — legacy-search loose end: the legacy `listDashboard` term branch relaxes to archived-only and **still returns unbound rows** (`dashboard-read.ts:230-240`), and Plan 02 froze `listDashboard`. Plan 07 removes the `isNeutralDashboardSearchRow` *rendering* from HomeScreen (`HomeScreen.tsx:70`), but if HomeScreen still lists the rows `listDashboard` returns on a term search, unbound contacts may still appear (just un-styled) until the render phases replace the screen. Low stakes (legacy screen is superseded), but state that the legacy term-search path still returns unbound rows and is retired wholesale in 26–28, so DASHQ-08's guarantee rests on the *new* scoped search, not the legacy screen.
- **LOW** — `listNeverContacted` (the deleted screen's data source, `dashboard-read.ts:278-322`) will become dead code once `NeverContactedScreen` is removed; `countNeverContacted` is kept but `listNeverContacted` isn't mentioned. Harmless, but note it (leave it or remove it deliberately).

**Suggestions.** Add `focused-route-classification.test.ts` to the retirement sweep for both this plan and Plan 06. In the SUMMARY, state that the legacy HomeScreen term-search still returns unbound rows and is fully superseded in the render phases, so the DASHQ-08 exclusion guarantee is the new scoped search's, not the legacy screen's.

**Risk: MEDIUM** (well-sequenced; one missed test-file route reference + a legacy-search clarification).

---

## Cross-cutting

**Dependency ordering / waves.**
- Wave graph is coherent: 25-01 (schema+store+Active) → {02 populations, 04 search, 05 session/empty} → {03 filters/gravity, 06 favourites} → 07 retirements. 07 correctly depends on [03,04,06].
- **Cross-plan seam not owned by any plan:** the *fully-filtered, Gravity-narrowed* eligible-id set that Plan 04's search must consume is produced by Plans 02+03 but wired to search only in the render phases. **No Phase-25 test proves search-scope = post-Gravity set.** Flag as a recorded contract (Concern in Plans 03/04). This is the phase's biggest silent gap after the snooze question.
- **Wave-2 build coupling:** Plan 05's breaking change to `selectDashboardEmptyState` needs HomeScreen updated in the same wave or made additive (Plan 05 Concern). Plan 05 and Plan 07 both edit HomeScreen in different waves — additive is safer.

**Injection / tamper posture.** Uniformly strong and matches the shipped model (`dashboard-read.ts:43-51`): static SQL, closed code-constants, `?`-bound runtime values, `escapeLike` for LIKE. The one new surface — JSON-TEXT `dashboard_populations`/`dashboard_filters` — is defended by DAO validators + store parse-guard + known-token mapping, but has **no DB CHECK**; make the "ignore unknown tokens, never interpolate" rule explicit at query-build (Plan 01 LOW).

**Migration one-way-door.** Correct: additive `ADD COLUMN` only, no edit to 001–018, forward-only, v0→v19-in-one-launch full-chain test, checkpoint:decision gate. Head+1=019 verified on disk.

**Dates / off-by-one.** Birthdays route through `daysUntilBirthday` (local-midnight, Feb-29-explicit); the plans explicitly forbid a SQL `date()` window and `toISOString().split`. The residual risk is only the *seam* (pure layer can't compute it) — Plan 02 MEDIUM.

**BASE_WHERE / All Contacts / archived+unbound.** All Contacts is an explicit union; archived+unbound ANDed on every population — verified against `dashboard-read.ts:155-158,313-319`. The **only** BASE_WHERE issue is the snooze semantics (top finding), which is a recorded-decision reconciliation, not a code weakening.

**Favourites (ADR-075).** No plan sorts by `favourite_rank` on Dashboard/widget; column kept; internal picker reads preserved. Compliant — modulo Plan 06's two missed route consumers.

---

## Overall Risk: MEDIUM-HIGH

The engineering is genuinely good — reuse-first, injection-clean, migration-disciplined, and honest about the Gravity fork. Risk is **MEDIUM-HIGH not LOW** because of one escalation and a cluster of concrete gaps that will bite at execution:

1. **HIGH / ESCALATION** — the snooze/Active contradiction (DASHQ-05 "remain in Active" vs verbatim `BASE_WHERE`; D-05's exclusion list omits snoozed; Plan 02 asserts a false must-have truth). Owner must confirm the dossier's snooze semantics before Plans 01/02 execute.
2. **MEDIUM** — search-scope must be the post-filter/post-Gravity id set; no Phase-25 test proves it (Plans 03/04).
3. **MEDIUM** — Plan 05 breaks the Wave-2 `tsc` gate unless HomeScreen is updated or the empty-state signature is made additive.
4. **MEDIUM** — Plans 06/07 miss `widget-quick-action-guard.ts` and `focused-route-classification.test.ts` route-name consumers; their own grep acceptance gates would fail.
5. **MEDIUM** — Birthdays Default-sort / multi-population Default sort and the pure/read birthday seam are under-specified (Plan 02).

None of these require re-architecting; (1) needs an owner decision, (2)–(5) are manifest/spec tightenings. Resolve (1) first — it is the only item that can invert a recorded decision.
