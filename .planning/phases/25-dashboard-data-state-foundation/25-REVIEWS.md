---
phase: 25
cycle: 2
reviewers: [codex, claude]
reviewed_at: 2026-09-05T01:15:16Z
plans_reviewed: [25-01-PLAN.md, 25-02-PLAN.md, 25-03-PLAN.md, 25-04-PLAN.md, 25-05-PLAN.md, 25-06-PLAN.md, 25-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "opus (read-only subagent)"
model_sources:
  codex: "banner"
  claude: "subagent-invocation"
note: >
  Cycle 2 of the convergence loop. Plans revised after cycle-1 (commits 10a485e, d83c685) and
  owner decision D-12 (25-CONTEXT.md). D-12 (snooze-clause relocation out of Active/Default into
  the Needs-Attention filter) is OWNER-AUTHORIZED and was NOT re-escalated — its implementation was
  verified for correctness instead. The Claude lane ran as an owner-authorized read-only subagent
  (the `claude -p` lane has a known Write-permission gap in this repo). Every load-bearing claim in
  both reviews was independently re-verified against the code on disk by the orchestrator.
---

# Cross-AI Plan Review — Phase 25 (Dashboard Data & State Foundation) — CYCLE 2

## Consensus Summary

Both reviewers agree the revisions **closed the entire cycle-1 cluster**: D-12 is implemented
cleanly and consistently (a new `ACTIVE_SEGREGATION_WHERE` = the three ADR-011 clauses with no
snooze drives Active/Default and the All-Contacts union; the snooze clause relocates verbatim into
the Needs-Attention filter in Plan 03; the legacy `BASE_WHERE` at `dashboard-read.ts:155-158` is
byte-unchanged). Migration numbering (019, head+1 of 018 / `TARGET_VERSION 18`) is correct and
re-verified on disk, with a `checkpoint:decision` HALT if head ≠ 018 at execution. The §H
population-aware Default-sort model, the birthday JS→SQL seam, the multi-population precedence, the
scorer partial-coverage redesign (a new additive coverage-aware aggregator; the existing all-terms
gate untouched), the additive Plan-05 empty-state signature (no Wave-2 `tsc` break), the
backup-format-5/Phase-36 wording, and the Plan-06/07 consumer sweeps are all now specified correctly
and match the code.

**But cycle 2 surfaced NEW, verified execution-blocking issues the revisions introduced or missed —
the two reviewers found DIFFERENT, complementary problems on Plans 04, 06, and 07.** The engineering
architecture is sound; the residual risk is a cluster of concrete, on-disk-verified plan bugs plus
one owner sequencing decision. Overall risk: **MEDIUM–HIGH**, gated on amending Plans 04, 06, 07
(and a Plan 01 test-scope gap) before execution.

### Agreed Strengths (both reviewers, verified)

- **D-12 implemented correctly and consistently** across every population and filter; legacy
  `BASE_WHERE` byte-unchanged; the ADR-011 segregation trip-wire honored. A currently-snoozed
  status-bearing contact appears in Active, All Contacts, and Snoozed (deduped) and is suppressed
  only from Needs Attention — matching the dossier §Snoozed [DECIDED] pair.
- **Migration numbering verified head+1 = 019** (`database.ts:53` `TARGET_VERSION = 18`, migrations
  top out at `018`); additive `ADD COLUMN` only, no edit to shipped migrations, one-way gate.
- **`CARD_STATUS` CASE-wrap preserved** (`dashboard-read.ts:127-132`): never-contacted rows read
  NULL status/progress, never bucketed 'stable' (the HIGH-1 guard); snooze doesn't null
  `last_contact`, so snoozed contacts keep real status.
- **Injection posture uniformly strong**: static SQL, closed code-constants, `?`-bound runtime
  values, `escapeLike` for LIKE; JSON-TEXT columns defended by DAO validators + store parse-guards +
  known-token-only mapping.
- **Gravity kept out of SQL** as a reversible post-query TS pass reusing `computeContactGravity` /
  `GRAVITY_TIERS`; the cached-column alternative is reserved as an owner decision.
- **ADR-031 (no FTS/no index) grep-gated; ADR-075 favourite-rank retirement keeps the column** and
  its picker/sun/merge/capture internal reads intact.

### Agreed Concerns (raised or corroborated by both — highest priority)

1. **Plan 04 corpus completion (Task 1) is not implementable as written** — both reviewers flagged
   the search corpus, from different angles, and both are verified on disk:
   - *(Claude, HIGH — NEW)* The instruction sources `phone`/`email` from `contacts`
     (`25-04-PLAN.md:100`), but **migration 009 rebuilt `contacts` WITHOUT those columns**
     (`CREATE_CONTACTS_V9`, `009-contact-method-normalization.ts:16-34`; values migrated into the new
     `contact_methods` table, `:183-196`). `SELECT ... phone, email FROM contacts` throws
     `no such column` at `TARGET_VERSION 18`; Plan 04's own AC ("a phone/email term matches its
     in-scope contact", `:107`) cannot pass. Re-point to a `contact_methods` LEFT JOIN
     (`method_type IN ('phone','email')`). The category-label half (`categories` join) is fine.
   - *(Codex, HIGH — NEW)* Even for entries that DO exist, the corpus carries insufficient provenance
     to build the DASHQ-10 / UI-SPEC descriptor. A memory entry is `{ source: "memory", text }`
     collapsing custom-label/value/note (`knowledge-search-read.ts:101-108`); the SQL never selects
     `memories.type` (`:73-82`), and relationships select only `person_name` (`:61-65`) despite
     `relation_type`/`note` existing (`016-contact-knowledge.ts:31-44`). So the descriptor builder
     cannot assign `sourceKind` `note-or-body` vs `memory-or-custom-field`, derive `fieldLabel` from
     `MEMORY_TYPE_REGISTRY[type].displayName`, or (MEDIUM) reconstruct highlight offsets, because
     `tokenize()` discards offsets (`knowledge-search.ts:32-40`). UI-SPEC:199-207/255 require the
     4-way `sourceKind`, `fieldLabel`, and highlight offsets **in the foundation** ("foundation
     carries full text + highlight offsets"), so this is in-scope for Phase 25, not deferrable.

2. **Plan 07 Not-Contacted retrieval gap persists (owner sequencing decision).** Deleting
   `NeverContactedScreen` and re-pointing `navigate("NeverContacted")` (`HomeScreen.tsx:417`,
   `DigestScreen.tsx:163`) to Home leaves no user-facing way to select the Not-Contacted population
   until its chip lands in Phase 26 (Home still renders legacy `listDashboard`). Plan 07 now surfaces
   this as an explicit owner-visible `flagged-unverified` assumption (`25-07-PLAN.md:53`: "If the
   owner wants the screen kept until Phase 26, that is an owner sequencing call") — correct handling
   per the decision-authority guardrail (the E-02 retirement is the dossier's decision; the sequencing
   risk is surfaced, not papered over). It remains an **open owner sequencing decision**; the gap is
   real and unchanged in substance.

### Divergent Views

- **Plan 04 severity framing.** Claude rates overall risk MEDIUM (residual is the one
  schema-impossible instruction + the owner call); Codex rates HIGH until Plans 04/06/07 are amended.
  Both agree on the underlying facts; the difference is aggregation weight. Given the widget
  compile/runtime break (below) and the unbound-search leak are both deterministic, MEDIUM–HIGH is
  the reconciled rating.
- **Plan 06 / Plan 07 each carry a HIGH that only ONE reviewer surfaced** (widget-intent break;
  unbound-search leak). These are not disagreements — they are non-overlapping coverage. Both were
  independently re-verified against disk by the orchestrator and are treated as live.

---

## Codex Review

<!-- model: gpt-5.6-terra (reasoning=low); source-grounded, file:line evidence; independently re-verified on disk -->

The revised plan set correctly incorporates D-12’s authorized move of snooze suppression out of Active/All Contacts: the existing legacy predicate still contains snooze at `dashboard-read.ts:155`, while the planned additive path explicitly avoids reusing it. Migration head is genuinely 018 / target 18 today (`database.ts:53`, `:74`).

Three implementation seams remain unresolved: migration-test consumers omitted from Plan 01, insufficient corpus provenance for Plan 04 descriptors, and retirement paths in Plans 06–07 that would either crash or still expose Unbound contacts through legacy Dashboard search. **Risk assessment: HIGH** until Plans 04, 06, and 07 are amended.

### Plan 01 — Schema, DAO, store, Active tracer — Risk: MEDIUM
- **MEDIUM — Plan 01 omits an existing hard-coded v18 migration consumer.** `restore-apply.test.ts:45-66` imports only through `migration018`, builds a local array, and runs it at target `18`. Once `getAppSettings()` is widened to select the new (non-null) dashboard columns, this v18 test DB can fail when a restore path reads settings. It is not in Plan 01's `files_modified`. Fix: add `restore-apply.test.ts` to Plan 01, register migration 019 in its local chain at target 19 — but audit the *intentional* partial-chain tests separately; do not blindly bump tests that specifically validate migration 018.
- Strengths: repo is genuinely at 018/target 18 so 019 is head+1 (`database.ts:42-53,74`); legacy `BASE_WHERE` preserved with its three ADR-011 clauses (`dashboard-read.ts:155-158`); portable-settings precedent exists (`app-settings-dao.ts:184-200`, `backup-schema.ts:132-166`).

### Plan 02 — Population union engine — Risk: LOW
- No new concerns. `CARD_STATUS` already nulls status/progress for `last_contact IS NULL`
  (`dashboard-read.ts:127-132`); the new path safely leaves legacy queries untouched
  (`:179-199`, still consumed by `HomeScreen.tsx:194-202`); `listBirthdayCandidates` is deliberately
  broader with another live consumer (`:391-399`), so filtering final ids is correct. Keep the
  explicit test that a snoozed status-bearing contact has non-null status in Active/All Contacts/Snoozed.

### Plan 03 — Filters, sort, Gravity — Risk: LOW
- **LOW — the Gravity read contract does not specify a consistent `now` source.**
  `computeContactGravity(inputs, now)` needs a local wall-clock string (`impact.ts:88-100`), but the
  proposed `listDashboardPopulation` contract states no `now` parameter — per-row computation and
  tests can become nondeterministic. Fix: amend the signature to accept one read-scoped `now: string`
  (or derive it once before the SQL/Gravity pass) and reuse it in fixtures and the Gravity loader.
- Strengths: Gravity is derived at read time, not stored (`impact.ts:63-100`); `getImpactInputs`
  gives a one-statement per-contact snapshot (`impact-read.ts:52-90`); legacy needs-attention uses
  `PROGRESS_SQL` only inside `BASE_WHERE` (`dashboard-read.ts:250-264`), so relocating snooze is clean.

### Plan 04 — Scoped semantic search — Risk: HIGH
- **HIGH — corpus lacks provenance for the required descriptor labels/source kinds.** (See Agreed
  Concern 1.) Memory entries are `{source:"memory", text}` with no `type` selected
  (`knowledge-search-read.ts:73-82,101-108`); relationships carry only `person_name` (`:61-65`)
  despite `relation_type`/`note` (`016-contact-knowledge.ts:31-44`). Descriptor cannot derive
  `MEMORY_TYPE_REGISTRY[type].displayName`, distinguish value/label from note, or assign note-or-body
  priority.
- **MEDIUM — the tokenizer cannot produce raw-text highlight ranges.** `tokenize()` diacritic-folds
  and returns strings only (`knowledge-search.ts:32-40`); `tokenScore()` returns a number
  (`:81-87`). Offsets into raw text (e.g. `café`) cannot be reconstructed downstream. Fix: add an
  offset-preserving match-info surface inside `knowledge-search.ts` that maps normalized matches back
  to original-string offsets (do not ask `dashboard-search-match.ts` to infer them). Widen
  `KnowledgeSearchEntry` with a closed user-facing subtype + semantic metadata (memory `type` + part;
  relationship `relationType` + part; direct-field/category labels). Add fixtures for a
  registry-labelled memory note, a relationship note/type, and a diacritic-folded match with asserted
  highlight offsets.
- Strengths: corpus is term-free/TS-matched (`knowledge-search-read.ts:1-7`); the additive
  coverage-aware scorer correctly does NOT alter the existing all-terms `scoreQuery` gate
  (`knowledge-search.ts:111-121`); no production caller invokes `listKnowledgeSearchCandidates` yet
  (`:116-118`), so the scoped signature is safe to introduce with tests updated.

### Plan 05 — Ephemeral session state + empty-state gate — Risk: LOW
- No new concerns. Empty gate is a pure single-decision fn (`dashboard-empty-logic.ts:74-115`);
  `HomeScreen.tsx:308-317` is the sole legacy caller so additive optional fields avoid a Wave-2 screen
  change; in-memory Zustand precedent is plain `create` (`shell-transient-store.ts:1-22`). Suggestion:
  add a test reset helper for the singleton session store so tests don't depend on execution order.

### Plan 06 — Favourites retirement — Risk: HIGH
- **HIGH — repointing `orbit://favourites` to `[{ name: "Home" }]` breaks the intent + guard
  contracts.** `WidgetNavIntent` only permits two-route tuples with `index: 1` (incl. the
  ManageFavourites variant) (`widget-linking.ts:61-93`), and the guard unconditionally reads
  `intent.routes[1]` (`widget-quick-action-guard.ts:32-37`). A Home-only intent as prescribed by
  Plan 06 Task 3 (`25-06-PLAN.md` action) is both **non-typeable** (fails the plan's own
  `tsc --noEmit` gate) and a **runtime `undefined` dereference** once the ManageFavourites branch is
  removed. Fix: introduce an explicit Home-only `WidgetNavIntent` variant (`index: 0`,
  `routes: [{ name: "Home" }]`), update `guardWidgetIntent()` to accept it before reading
  `routes[1]`, and update resolver tests to assert `index: 0` + the one-route payload.
- Strengths: keeping the `favourite_rank` column is correct — genuinely read by capture
  (`capture-read.ts:58-66`), sun-picker (`sun-picker-read.ts:45`), merge (`merge-candidate-read.ts:29`),
  picker (`picker-read.ts:31-42`); the widget is rank-ordered through legacy Dashboard
  (`widget-data.ts:74-87`); the guard's `ManageFavourites` special-case is a real functional consumer
  (`widget-quick-action-guard.ts:32`).

### Plan 07 — Retire banner / Never Contacted, replace Unbound retrieval — Risk: HIGH
- **HIGH — deleting only the neutral-row helper does not stop Unbound contacts appearing in Dashboard
  search.** The legacy term branch filters only `archived_at IS NULL` — NOT `tracking_enabled = 1`
  (`dashboard-read.ts:230-239`) — so it returns `tracking_enabled = 0` (Unbound) rows; HomeScreen
  renders them directly (`HomeScreen.tsx:557-609`), and `dashboard-search-row-logic.ts:7-23` only
  changes their *presentation* to "Unbound". After the helper's removal (Plan 07), those rows render
  as normal `ContactCard`s, so DASHQ-08 ("Dashboard search never surfaces unbound") is **still**
  violated — arguably worse. Fix: in the same change, make the legacy Home term branch structurally
  bound-only (`AND tracking_enabled = 1`, aligned with D-07 now that `searchUnbound()` is the
  replacement), with an integration test asserting a matching Unbound contact is absent from Home's
  legacy search; OR wire Home's search to Plan 04's scoped search before removing the old presentation.
  Do not leave the data-layer leak to a later render phase while claiming DASHQ-08 complete.
- Strengths: old term branch is demonstrably broader (`dashboard-read.ts:230-239`); a dedicated
  Unbound route + `searchUnbound()` replacement already exists (`unbound-read.ts:23-38`) so it is not
  an ADR-062 reversal; banner freshness paths (focus/foreground/pull) are real and separable
  (`HomeScreen.tsx:229-262`).

---

## Claude Review

<!-- model: opus (read-only subagent, owner-authorized for this run); source-grounded; independently re-verified on disk -->

The revisions closed most of cycle-1's cluster. **D-12 is implemented consistently and correctly**
across all seven plans (a new `ACTIVE_SEGREGATION_WHERE` = the three ADR-011 clauses with no snooze
drives Active/Default and the All-Contacts union; the snooze clause relocates verbatim into the
Needs-Attention filter, Plan 03; the legacy `BASE_WHERE` at `dashboard-read.ts:155-158` is
byte-unchanged). The §H Default-sort model, the birthday JS→SQL seam, the scorer partial-coverage
redesign, the Plan-05 additive empty-state signature, the backup-format-5 wording, and the
Plan-06/07 consumer sweeps are now specified correctly and match disk. Overall risk: **MEDIUM**.

### HIGH

**C1 — [NEW] Plan 04 corpus completion targets non-existent `contacts.phone` / `contacts.email`
columns.** (See Agreed Concern 1.) Plan 04 Task 1 (`25-04-PLAN.md:100`) sources `phone`/`email` from
`contacts`, asserting "only fields that exist are added" and "verified on disk" — but it verified
`location`'s absence, not phone/email. migration 009 rebuilds the table
(`009-contact-method-normalization.ts:209` RENAME; `CREATE_CONTACTS_V9` `:16-34` has no phone/email;
copy INSERT `:171-178` omits them; values move to `contact_methods` `:183-196`). No later migration
re-adds them. `SELECT id, name, phone, email FROM contacts` throws `no such column: phone` at
`TARGET_VERSION 18`; Plan 04's own AC (`:107`) cannot pass. Fix: LEFT JOIN `contact_methods`
(`display_value`/`raw_value`, `method_type IN ('phone','email')`) — a normalized shared table with
its own writers (`contact-methods-dao.ts`) the plan does not mention. Not an owner decision (dossier
§J requirement intact); a wrong implementation target.

**C2 — [Cycle-1 HIGH, PARTIALLY RESOLVED / owner-flagged] Plan 07 re-point-to-Home strands
Not-Contacted retrieval for one phase.** (See Agreed Concern 2.) Now surfaced as a
`flagged-unverified` owner-visible assumption (`25-07-PLAN.md:53`). Correct handling per the
decision-authority guardrail; remains an open owner sequencing decision, gap persists.

### MEDIUM

**C3 — [NEW] Plan 06 `rewriteFavouriteRanks` grep acceptance gate cannot pass — `ring-seq-dao`
references it in comments and is unswept.** Plan 06's AC (`25-06-PLAN.md:47,129,186`) requires
`grep -rn 'rewriteFavouriteRanks' src` to return empty after the sweep, but `ring-seq-dao.ts:4`
("A near-VERBATIM clone of `rewriteFavouriteRanks` (favourites-dao.ts:105-143)") and
`ring-seq-dao.test.ts:6` reference the name in doc comments and are not in `files_modified`. Comments
only (no compile/test break), but (a) the gate fails as written and will block/confuse the executor,
and (b) the `ring-seq-dao.ts:4` comment cites `favourites-dao.ts:105-143`, a dangling line reference
once `rewriteFavouriteRanks` is deleted. Fix: scope the grep or add/update those two files. (The
`ManageFavourites` gate is clean by contrast — all references are in listed files.)

**C4 — [Cycle-1 MEDIUM, PARTIALLY RESOLVED — conscious deferral] Search-scope = post-Gravity id
set: contract recorded, but no Phase-25 test runs search over a Gravity-narrowed set.** Plan 03
Task 3 tests the fully-filtered id set excludes a Gravity-dropped contact (`25-03-PLAN.md:175,183`)
and the contract is recorded (`:89-92`; Plan 04 `:50`), but the end-to-end join (Plan 03's ids →
Plan 04's `searchDashboard`) is deferred to render phases 26-28. Given D-11 (nonvisual foundation)
and both halves independently tested, this deferral is acceptable; residual risk low but non-zero.
No further Phase-25 action strictly required — flagged as a conscious deferral.

### LOW

**C5 — [NEW] Stale doc-comment references survive the retirements (not load-bearing).** After the
Plan-06/07 deletions, prose comments still name removed routes/screens: `navigation/types.ts:80`,
`RootNavigator.tsx:121,125`, `DigestScreen.tsx:17`, plus the `ring-seq-dao` comments (C3). None break
compile/tests, and Plan 07's grep gates use specific patterns that avoid them. Cleanup pass, not
blocking.

**C6 — [Cycle-1 LOW, RESOLVED] `getValuesForContact` N+1 in the corpus read**
(`knowledge-search-read.ts:157`, per-contact) is now named as the Pixel-only search-perf gate
(Plan 04 verification, `25-04-PLAN.md:203`). Acknowledged and deferred to on-device UAT —
appropriate.

### Cycle-1 disposition (5 HIGH + 13 actionables)

| Cycle-1 finding | Disposition |
|-----------------|-------------|
| HIGH-1 Snooze vs Active (ESCALATION) | **RESOLVED by owner D-12** — not re-escalated; implemented consistently; legacy `BASE_WHERE` byte-unchanged. |
| HIGH-2 Default-sort fails §H; Birthdays seam; multi-pop undefined | **RESOLVED** — §H mapping correct, JS→SQL birthday seam + empty→constant-false + soonest post-query sort, multi-pop precedence defined. |
| HIGH-3 Plans 06/07 miss consumers; grep gates can't pass | **RESOLVED for ManageFavourites/NeverContacted** (real consumers now in `files_modified`); **NEW residual C3** (`ring-seq-dao` comments break the `rewriteFavouriteRanks` gate). |
| HIGH-4 Scorer term-coverage contradiction | **RESOLVED** — additive coverage-aware aggregator via `scoreCandidate`; existing gate untouched. |
| HIGH-5 Search has no integration owner | **RESOLVED as scope clarification** + PARTIAL on proof (C4); wiring deferred to render phases (D-11). |
| HIGH (Codex) Plan 05 storage not restoration | **RESOLVED as scope clarification** — state-shape foundation delivered; wiring deferred to 26-28. |
| HIGH (Codex) Plan 07 re-point strands Not-Contacted | **PARTIALLY RESOLVED / owner-flagged** (C2). |
| MED/HIGH Plan 05 breaks Wave-2 tsc | **RESOLVED** — additive optional signature; HomeScreen not edited. |
| MED Search corpus incomplete (category/phone/email) | **PARTIALLY RESOLVED** — category sound; **phone/email target non-existent columns (C1, NEW HIGH)**. |
| MED (both) Search scope must be post-Gravity | **PARTIALLY RESOLVED** (C4) — contract + id-set test; e2e deferred. |
| MED Gravity vs rowCount empty-state | **RESOLVED** — callers take post-Gravity `rows.length`. |
| MED Plan 06 phantom Settings/HomeScreen targets | **RESOLVED** — grep=0 stated, dropped; real consumers enumerated. |
| MED Plan 07 file/test inventory (HomeScreen.test.tsx) | **RESOLVED** — retirement + HomeScreen listed. |
| LOW JSON columns no CHECK → drop-unknown-token explicit | **RESOLVED** across Plans 01/02/03. |
| LOW Backup-format wording (v5/Phase 36) | **RESOLVED** — Plan 01 mandates format-5 wording. |
| LOW read_first names private scorer fns | **RESOLVED** — identified private; threads through `scoreCandidate`. |
| LOW `listNeverContacted` dead code | **RESOLVED (deliberate)** — `@deprecated`, retired with legacy `listDashboard`. |
| LOW Contact-Frequency bands → single tunable + test | **RESOLVED** — `CONTACT_FREQUENCY_BANDS` + boundary test. |
| LOW `getValuesForContact` N+1 | **ACKNOWLEDGED/deferred** to Pixel gate (C6). |

Net: all 5 cycle-1 HIGHs resolved or owner-decided **except** the Plan-07 sequencing gap (now
owner-flagged). The 13 actionables are incorporated except the phone/email corpus source (now a NEW
HIGH, C1) and the new `ring-seq-dao` grep-gate gap (C3).

---

## Cycle-2 Verdict (orchestrator synthesis)

All findings below were re-verified against the code on disk by the orchestrator (not taken from the
reviewers' summaries). The two reviewers found **non-overlapping** issues on Plans 04/06/07 — the
union is what must be addressed.

CYCLE_SUMMARY: current_high=5 current_actionable=4

### Current HIGH Concerns (unresolved — 5)

1. **[NEW] Plan 04 — search corpus sources `phone`/`email` from `contacts`, which have no such
   columns** (migration 009 moved them to `contact_methods`). Plan instruction throws
   `no such column` and fails its own AC. Fix in `25-04-PLAN.md` Task 1: source phone/email via a
   `contact_methods` LEFT JOIN (`method_type IN ('phone','email')`), not `contacts`.
2. **[NEW] Plan 04 — the descriptor contract (DASHQ-10 / UI-SPEC:199-207,255) is not deliverable
   from the current corpus/tokenizer.** The corpus collapses memory custom-label/value/note into one
   `{source:"memory"}` and never selects `memories.type`; relationships carry only `person_name` (no
   `relation_type`/`note`); `tokenize()` discards offsets. So `sourceKind` (`note-or-body` vs
   `memory-or-custom-field`), `fieldLabel` (from `MEMORY_TYPE_REGISTRY[type].displayName`), and
   `highlights` offsets — all required in the foundation — cannot be built. Fix in `25-04-PLAN.md`
   Tasks 1–2: widen `KnowledgeSearchEntry` provenance (memory type + part, relationship type + part,
   field labels) and add an offset-preserving match-info surface in `knowledge-search.ts`.
3. **[NEW] Plan 06 — repointing `orbit://favourites` to `routes: [{ name: "Home" }]` is a
   compile + runtime break.** `WidgetNavIntent` permits only `index:1` two-route tuples
   (`widget-linking.ts:61-93`); the guard reads `intent.routes[1]` unconditionally
   (`widget-quick-action-guard.ts:32-37`). As prescribed, Task 3 fails its own `tsc --noEmit` gate
   and dereferences `undefined` at runtime. Fix: add a Home-only `WidgetNavIntent` variant
   (`index:0`, one route) and update `guardWidgetIntent()` + resolver tests to handle it.
4. **[NEW] Plan 07 — legacy Home Dashboard search still surfaces Unbound contacts.** The term branch
   filters only `archived_at IS NULL`, not `tracking_enabled = 1` (`dashboard-read.ts:230-239`);
   removing `dashboard-search-row-logic.ts` (Plan 07) only strips their "Unbound" presentation, so
   they render as normal cards — DASHQ-08 still violated. Fix in `25-07-PLAN.md` Task 3: make the
   legacy term branch bound-only in the same change (with an integration test asserting an Unbound
   contact is absent from Home search), or wire Plan 04's scoped search before removing the helper.
5. **[Cycle-1 carryover — OWNER ESCALATION] Plan 07 Not-Contacted retrieval gap.** Retiring
   `NeverContactedScreen` in Phase 25 while the Not-Contacted chip lands in Phase 26 leaves one phase
   with no user-facing Not-Contacted retrieval (Home is on legacy `listDashboard`). Plan 07 correctly
   surfaces this as an owner sequencing call (`25-07-PLAN.md:53`) rather than reversing the E-02
   retirement. **This is the owner's decision to make** (keep the screen until Phase 26, or accept
   the transient gap) — not a plan fix an executor should silently apply.

### Current Actionable Non-HIGH Concerns (unresolved — 4)

1. **[MEDIUM] Plan 01 — add `src/backup/restore-apply.test.ts` to scope.** It hard-codes the 001–018
   chain at target 18 (`:45-66`) and is not in `files_modified`; widening `getAppSettings()` to
   select the new dashboard columns can break this v18 test DB. Register migration 019 in its local
   chain at target 19; do not blindly bump tests that intentionally validate a partial chain.
2. **[MEDIUM] Plan 06 — the `grep -rn 'rewriteFavouriteRanks' src` acceptance gate cannot pass.**
   `ring-seq-dao.ts:4` and `ring-seq-dao.test.ts:6` reference the name in doc comments and are
   unswept. Add those two files to Plan 06's sweep (update the comments / dangling line ref) or scope
   the grep pattern in the AC.
3. **[LOW] Plan 03 — specify a single read-scoped `now` source for the Gravity pass.** Amend
   `listDashboardPopulation`'s contract to take one `now: string` (or derive once) and reuse it in
   the Gravity loader and fixtures, so per-row Gravity computation and its tests are deterministic.
4. **[LOW] Plans 06/07 — clean up stale doc-comment references** to the retired routes/screens
   (`navigation/types.ts:80`, `RootNavigator.tsx:121,125`, `DigestScreen.tsx:17`, the `ring-seq-dao`
   comments). Non-blocking, but add a note/cleanup to the retirement tasks so the executor removes
   them.
