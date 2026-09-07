# Phase 29 Plan Check

## ISSUES FOUND

**Review:** independent check after external cycle 1 replan, 2026-09-07.
**Reviewed plan commit:** `e94d7b2`; current external feedback: `29-REVIEWS.md` from cycle 1.
**Scope:** 12 numbered plans, 29 tasks, 12 sequential waves.
**Issues:** **0 BLOCKERS, 2 WARNINGS**. Both fixes are bounded planning edits; no owner decision or application change is required. This verdict concerns pre-execution plan completeness, not implementation or native acceptance.

## Current findings

### WARNING PC-R1-01 — Assign the tracer's read-only signature adaptations to wave 1

`29-01-PLAN.md:89` requires the existing settings/header/status/profile/contact readers inside `inReadSnapshot`. Its task file list (`:86`) and frontmatter (`:7`) own none of the five DAO files that currently require a full `SqlExecutor`:

| Existing reader | Actual source declaration |
|---|---|
| `getAppSettings` | `src/db/app-settings-dao.ts:425` |
| `getContactHeader` | `src/db/contact-read.ts:67` (executor parameter at `:68`) |
| `getContactStatus` | `src/db/contact-status-read.ts:54` (parameter at `:55`) |
| `getProfile` | `src/db/profile-dao.ts:96` (parameter at `:97`) |
| `listOrbitingContacts` | `src/db/orrery-read.ts:89` (parameter at `:90`) |

`ReadOnlyExecutor` intentionally exposes only `getFirstAsync`/`getAllAsync` (`src/db/transaction.ts:42`), and the snapshot callback receives that type (`:76`). Each listed function only needs read access. The plan set acknowledges adapting read-only signatures in `29-03-PLAN.md:99`, but wave 1's tracer and changed-contract typecheck precede wave 3. Without explicit ownership, execution must make an unplanned five-file adaptation or weaken the read-only boundary to wire the promised tracer.

**Minimal fix:** assign type-only read parameter adaptations for these five functions to `29-01-01`, list their files in that task and plan frontmatter, and require the loader to pass the snapshot callback's `ro` into them. Retain the existing SQL, return shapes, caller compatibility and every writer's full `SqlExecutor` contract. Keep the existing tracer and `tsc --noEmit` verification. This is a WARNING because the implementation path is straightforward and the final feature scope is already covered; it is an ownership/order gap, not missing product behavior.

### WARNING PC-R1-02 — Put D-05's reference in its implementing action

`29-03-01` fully implements D-05's explicit All Contacts/Not Contacted widening, null health branch, unchanged default contacted-only read, and Bound/archive guards. However, the literal `D-05` reference appears only in `29-03-PLAN.md:32` and `:154` (frontmatter and plan success criteria), not in any task action or rationale. The role's strict task-level decision-reference check therefore finds **10/11** numbered decisions in actions, although semantic implementation coverage is **11/11**.

**Minimal fix:** prefix the existing action at `29-03-PLAN.md:99` with `Per D-05`. No implementation change or scope reduction is needed.

## Current external review incorporation

All current actionable cycle 1 findings have executable dispositions. Historical resolved findings were not reopened.

| Cycle 1 concern | Current executable ownership | Independent assessment |
|---|---|---|
| HIGH: old radial reorder competes with new pan during waves 1–8 | `29-01-01` retires the old recognizer, commit bridge, mirrored drag state and ghost preview before ordinary pan; `29-09-02` restores deliberate hold reorder. Actual registered pan callbacks must leave rank/timestamps/revision unchanged. | Incorporated. Full current screen confirms that these named objects are the existing write path. DAO guards survive the temporary disconnection; all waves are one unreleased sequence. |
| Batch Gravity was unowned | `29-04-01` creates `readOrreryImpactInputsCore(ReadOnlyExecutor, ids)`, bounded deduplicated batches, complete history and exact single-reader parity, inside the same member snapshot; `29-04-02` renders derived mass. | Incorporated. Actual `impact-read.ts` and `services/impact.ts` require full histories and preserve the ancient-interaction floor and rarely-responds connected filtering. No per-member loop or nested read lock is prescribed. |
| Full-scene reread on every tap | `29-08-01` owns `readOrreryContactTargetValidation`, at most three SELECTs, shared closed membership predicate, ID/UID and current saved-sun/lifecycle validation, plus post-await generation gating. | Incorporated. Probe explicitly excludes catalog/full-order/Gravity/history reads. The existing sun helper treats missing, archived and Unbound occupants as self; the plan reuses that authority. |
| Clock-only queued reorder test was not executable | `29-09-01` owns the test-only `openSqliteLocalDayFixture`; `29-12-01` reuses it. | Incorporated. Current testkit exposes a real `DatabaseSync`, and read/write transactions use the same non-reentrant promise mutex. A held deferred mutex can queue the DAO while the connection-local day changes without row writes. |
| Excluded contact-sun satellites needed an owner policy | D-11 is implemented in `29-03-01`, `29-08`, `29-10` and integration: no moons/relationship context for a nonmember global sun; valid focus/Profile remains; membership is not inserted; later qualification restores eligibility under existing enabled/semantic rules. | Incorporated. This is the recorded owner choice, not an inferred scope reduction. |
| Source citations/registry upkeep | `29-12-02` updates source comments for ADR-077 and partial ADR-048 supersession and runs `npm run gen:adr-registry`; immutable ADR bodies remain untouched. | Incorporated. Actual ADR-048 and ADR-077 confirm partial supersession; generated registry must be regenerated, not hand-edited. |

The independent standalone SQLite probe (`node /tmp/orbit-phase29-sqlite-day-probe.cjs`) passed: controlled local day changed from 2026-09-07 to 2026-09-08, Needs Attention changed 0→1 and Snoozed 1→0, stored rows remained unchanged, and native modifier/NULL behavior matched. The planned helper intercepts only exactly `date('now','localtime')`; other arities/arguments delegate through an untouched second connection with bound parameters. This preserves three-argument snooze date operations and native `julianday`. Both connections have explicit idempotent cleanup. The probe validates the mechanism; the new composed DAO regression remains execution work and was not represented as already passing.

The earlier native tracer wording is corrected: automated tracer/source wiring precedes expansion, while native smoke is an explicitly pending end-of-phase obligation. Plan 12 cannot turn Node adapter tests into native Skia, gesture, navigation, accessibility or performance signoff.

## Coverage and contract checks

| Requirement | Implementing plans, besides final integration | Result |
|---|---|---|
| ORRC-01 | 01 | Covered |
| ORRC-02 | 01, 04, 07 | Covered |
| ORRC-03 | 04, 05 | Covered |
| ORRC-04 | 04 | Covered |
| ORRC-05 | 02, 04 | Covered |
| ORRC-06 | 04, 05, 08 | Covered |
| ORRC-07 | 01, 05, 08 | Covered |
| ORRC-08 | 11 | Covered |
| ORRC-09 | 06, 07 | Covered |
| ORRC-10 | 09 | Covered |
| ORRC-11 | 03, 11 | Covered |
| ORRC-12 | 03 | Covered |
| ORRC-13 | 02, 11 | Covered |
| ORRC-14 | 10 | Covered |
| ORRC-15 | 03, 06, 08, 10 | Covered |
| ORRC-16 | 07, 11 | Covered |

- All 16 ROADMAP requirement IDs appear in frontmatter and have concrete implementing actions. The PROJECT Orrery goal adds no unmapped Phase 29 requirement: custom-System authoring remains Phase 30. All 37 edge IDs and the approved nine UI rows/55 considerations remain accounted for.
- All 12 installed `verify.plan-structure` results are valid with no errors. Files/action/verification/done are present for all 29 tasks; the installed tool recognizes the tracer task. One tool warning about a one-way migration lacking a decision checkpoint is already resolved by D-03/D-06's recorded authorization, not a new permission requirement.
- Dependencies and wave numbers independently validate as the chain 01→02→…→12. There are no same-wave plan pairs, so no undeclared parallel mutable-state coupling. The wave-1 reader adaptation is the separate local ownership warning above.
- The same world/projection/frame supplies rendering, depth, labels, current hit bounds, focus and reorder inversion. Native sibling depth sorting, keyed resources, snapshot/UID identity, and generation checks are specified. No conflicting data transformations were found across plans.
- Filtered reorder preserves the original coherent full-order/sun/ID-UID/eligible-member expectation, then recomputes exact current System membership under the write lock through a mutex-free read core. It keeps uniqueness/completeness/scoped changes checks, hidden-slot order and no-op semantics. Merge, restore and reusable numeric IDs are covered by fingerprint tests; local-day changes do not depend on data revision.
- Responsibility-map tiers are respected: DAO SQL and guarded writes, pure geometry/predicate/permutation logic, UI-thread frame/gesture state, and discrete React/Zustand control/session state. No server, network read, telemetry, new package or owner posture reversal is introduced.
- Canonical mode removal follows ADR-077; global sun behavior and contacted-only durable rank eligibility remain preserved. Preferences use an additive migration and optional portable keys with unchanged current export. Camera/focus remain session-only; custom-System authoring, Category management and release calibration retain their recorded later-phase ownership.
- PATTERNS analogs and shared conventions are reflected in task read/action instructions. RESEARCH open questions are marked resolved. No project-local skill directories or configured plan-checker agent skills were found. AGENTS constraints are carried into execution rules, including full source/writer reading, no worktrees/push, theme tokens, local SQL, and animation lifecycle.

## Dimension 8: Nyquist compliance

`29-VALIDATION.md` exists. Every implementation task has an automated command and owns or depends on the corresponding test. No MISSING sentinel, watch mode, E2E-only command, tree-prefix grep, swallowed-error comparison or unexplained hard-coded pass count was found. New tests are planned artifacts; their absence before execution is not a failure.

| Plan / wave | Tasks with automated command | Command families | Result |
|---|---:|---|---|
| 01 | 2/2 | scene tracer; geometry/ring/sun | PASS |
| 02 | 3/3 | preferences DAO/store; portability | PASS |
| 03 | 3/3 | System reads/store/controls | PASS |
| 04 | 3/3 | batch impact/scene; world/impact; camera math | PASS |
| 05 | 2/2 | frame/scene; label/frame | PASS |
| 06 | 2/2 | obstacle; obstacle/controls | PASS |
| 07 | 2/2 | gesture/camera/frame; recovery/gesture | PASS |
| 08 | 3/3 | focus; overlay/focus; companion | PASS |
| 09 | 2/2 | permutation/rank/System DAO; reorder/gesture/rank | PASS |
| 10 | 2/2 | satellite reads; satellite logic/read | PASS |
| 11 | 3/3 | session; Reduced Motion/session/recovery; feedback/store/frame | PASS |
| 12 | 2/2 | real-SQL integration/tracer; registry generation/integration | PASS |

Sampling is 29/29, with every three-task window fully covered. No Wave 0 creation dependency is missing. Feedback latency and suite runtimes remain unmeasured; no application or unimplemented suite was run for this check.

## Scope estimates

| Plan / wave | Tasks | Files | Estimated tokens | Budget | Confidence |
|---|---:|---:|---:|---:|---|
| 01 | 2 | 8 | 36,000 | 100,000 | low |
| 02 | 3 | 10 | 32,000 | 100,000 | low |
| 03 | 3 | 11 | 33,000 | 100,000 | low |
| 04 | 3 | 9 | 38,000 | 100,000 | low |
| 05 | 2 | 8 | 30,000 | 100,000 | low |
| 06 | 2 | 9 | 26,000 | 100,000 | low |
| 07 | 2 | 7 | 31,000 | 100,000 | low |
| 08 | 3 | 13 | 36,000 | 100,000 | low |
| 09 | 2 | 10 | 29,000 | 100,000 | low |
| 10 | 2 | 10 | 26,000 | 100,000 | low |
| 11 | 3 | 13 | 28,000 | 100,000 | low |
| 12 | 2 | 7 | 23,000 | 100,000 | low |

Every `estimate-check --calibrated` reports within budget (23–38%); zero completed-phase calibration samples means these are not precise forecasts. The broader file sets remain the previously recorded execution watchpoints; bounded sequential tasks and existing analogs reveal no new concrete scope blocker. Account for the five small signature files when revising plan 01's estimate/file count.

## Grounding and limitations

Read the numbered plans and phase context/research/UI/pattern/coverage/validation/current reviews/previous check, phase goal and requirements, relevant PROJECT context, HANDOFF, AGENTS, full canonical Phase 08 dossier and binding planning notes. Governance discovery used `npm run graph:ask -- governs` before source searches. Returned governance edges for Orrery, settings, rank/relationships and shell were **INFERRED**, then relevant ADR bodies and actual source were inspected; missing edges were not treated as absence of governance.

Full-file source tracing covered the current Orrery screen, all existing Orrery body/canvas/clock components, geometry/ring/reorder/sun logic, settings and key contact/profile/status/impact readers, shared transaction/mutex and node SQLite fixture, status/Gravity services, relationships read/write owners, shell navigator/FAB/app bar and transient/refresh/layout stores, Orrery stack and live Reduced Motion hook. Manual writer searches were followed through contacts create/update, lifecycle, favourites, snooze, bulk actions, recency, import/source consolidation, merge, purge, restore application, settings/revision, widget delegation and benchmark; relevant schema creation/rebuild/settings/relationship migrations and database runner/head were read. This was subsystem plan analysis, not a whole-repository implementation audit.

No application, device, full app test suite, generated registry or graph rebuild was run. The only runtime experiment was the disposable SQLite clock-mechanism probe. Current head 20 supports conditional migration 21; execution must recheck the head. End-of-phase native evidence and implemented automated suites remain pending. No source or plan fixes were made by this checker.

## Structured issues

```yaml
issues:
  - id: PC-R1-01
    plan: "29-01"
    task: "29-01-01"
    dimension: task_completeness
    severity: warning
    finding: "The wave-1 snapshot tracer reuses five readers that require SqlExecutor, but their read-only signature adaptations are not owned until a general wave-3 instruction."
    affected_field: "29-01-PLAN.md:7 files_modified; :86 task files; :89 action; 29-03-PLAN.md:99 action"
    suggested_fix: "Assign type-only ReadOnlyExecutor/Pick adaptations for getAppSettings, getContactHeader, getContactStatus, getProfile and listOrbitingContacts to 29-01-01; list the five DAO files, pass snapshot ro, preserve writer contracts and run tracer plus tsc."
  - id: PC-R1-02
    plan: "29-03"
    task: "29-03-01"
    dimension: context_compliance
    severity: warning
    finding: "D-05 has full semantic implementation but no required task action/rationale citation; its token appears only in frontmatter and success criteria."
    affected_field: "29-03-PLAN.md:99 action (existing citations only at :32 and :154)"
    suggested_fix: "Add 'Per D-05' to the existing 29-03-01 action without changing its behavior."
```

**Recommendation:** apply these two bounded planning fixes, then independently recheck the affected ownership/decision references. External convergence remains the parent orchestrator's responsibility.

---

## Previous review history (preserved verbatim)

# Phase 29 Plan Check

**Verdict: VERIFICATION PASSED** — revision recheck 1, 2026-09-07.

12 plans / 28 tasks / 12 sequential waves. No remaining blockers or actionable warnings. This is a pre-execution plan review, not implementation or native verification.

## First-review findings resolved

| Previous finding | Final executable contract | Result |
|---|---|---|
| **BLOCKER**, 29-09: a filtered drag could commit after Favorites/category/snooze/recency or local-midnight changes while full order and sun stayed unchanged. | 29-03 supplies the shared non-locking `readOrrerySystemMembersCore(ReadOnlyExecutor, SystemRef)` and coherent full-order/sun/eligible-members/ID-UID snapshot. 29-09 carries the original System and expected snapshot into the existing write transaction, re-resolves current membership using current SQLite local-day predicates, compares ordered eligible IDs and ID/UID fingerprints, then merges only visible slots internally. No nested mutex, caller-trusted replacement full order, or refreshed expectation that blesses an old gesture. Existing completeness, uniqueness, affected-row, rollback and no-op guards remain. | Resolved. Tasks require predicate-only, queued-write, clock-only and real numeric-ID-reuse regressions with no rejected-write rank/timestamp/revision changes; 29-12 repeats integration obligations. |
| **WARNING**, 29-08: requiring System membership for every action disabled a visible globally assigned sun outside the System. | Explicit member/contact-sun target discriminants, current snapshot validation and ID/UID identity checks preserve sun focus/Profile independently of System membership. Member actions still require membership. Ambiguity deduplicates identities and appends a nonmember sun deterministically; reconciliation, labels and framing use the same target contract. The companion contains qualifying members only, including a qualifying sun once. | Resolved. Tests require excluded-System sun actions plus reassignment, lifecycle, merge/purge and reused-ID rejection; 29-12 retains end-to-end obligations. |

## Gate evidence

- All ORRC-01 through ORRC-16 have frontmatter ownership and concrete implementing tasks. All ten CONTEXT decisions, nine exact approved UI rows (55 applicable states), and 37 edge rows have plan coverage. Six edge rows remain explicitly identified as unclassified assumptions, not missing owner approvals.
- Installed `verify.plan-structure` returned valid with no errors for all 12 plans. Each task has an automated verification command; 28/28 are represented in `29-VALIDATION.md`. No missing-test sentinel, watch command or swallowed-error comparison blocks execution. Runtime and feedback latency remain unmeasured.
- Dependencies form the declared 01 → 02 → … → 12 chain. There are no same-wave plan pairs or undeclared parallel mutable-state dependencies. Tests, world/projection/frame ownership, interaction controller, DAO and screen wiring are explicit.
- Architectural responsibilities remain local: SQLite DAOs own predicates and guarded writes, pure logic owns geometry/permutations, UI-thread shared values own frames and gestures, and React/Zustand own discrete session state. No external API, server, ORM or new network read dependency is planned.
- Approved canonical-view removal, contacted-only rank eligibility, explicit neutral All Contacts/Not Contacted widening, session-only camera/focus, durable preference scope, and deferred custom-System authoring remain coherent across the plans and supporting documents. Research open questions are explicitly resolved; phone calibration is delegated execution work.
- The sole structural-tool warning is 29-02's one-way migration without a decision checkpoint. D-03/D-06 already record the selected option. `planner-reversibility.md` explicitly says not to gate a decision already made; no repeat approval is required.

| Plan / wave | Tasks | Files | Estimated tokens / 100,000 budget |
|---|---:|---:|---:|
| 01 | 2 | 8 | 36,000 |
| 02 | 3 | 10 | 32,000 |
| 03 | 3 | 11 | 33,000 |
| 04 | 2 | 6 | 28,000 |
| 05 | 2 | 8 | 30,000 |
| 06 | 2 | 9 | 26,000 |
| 07 | 2 | 7 | 31,000 |
| 08 | 3 | 12 | 32,000 |
| 09 | 2 | 9 | 29,000 |
| 10 | 2 | 10 | 26,000 |
| 11 | 3 | 13 | 28,000 |
| 12 | 2 | 4 | 23,000 |

All `estimate-check --calibrated` results were within budget. Confidence is low: zero completed-phase calibration samples. Wider file sets are execution watchpoints, but sequential bounded tasks reveal no concrete scope failure requiring revision.

## Checked artifacts and source grounding

Read all final `29-01-PLAN.md` through `29-12-PLAN.md`, CONTEXT, approved UI-SPEC, RESEARCH, PATTERNS, COVERAGE and VALIDATION; Phase 29 ROADMAP/REQUIREMENTS and relevant PROJECT context; full authoritative `phase-08-orrery-camera-scale-exploration-dossier.md` and binding `planning-notes/phase-08-planning-notes.md`; HANDOFF and AGENTS. The two fixes are in executable plans, not confined to review prose.

Governance discovery used `npm run graph:ask -- governs` before source searches. The returned ADR-046 and ADR-048/077 governance edges were **INFERRED**, then checked against actual ADRs and code; the new scene module had no graph node. Graph absence was not treated as proof of absent governance. ADR-047 does not explicitly mandate tap behavior, and ADR-046 does not explicitly mandate contacted-only eligibility: the existing screen and rank/read code establish those baseline policies.

Full-file source reading covered the existing Orrery screen/components/clock, geometry and reorder logic, sun resolution, relevant stores/navigation, System-predicate analogs, settings and contact read/write DAOs, transaction/query types, status/recency/impact and relationship owners, migration 011's reusable numeric contact IDs, and the migration runner/current head. Manual SQL-writer searches were followed through contact create/update/lifecycle, favorites, snooze, bulk actions, recency, import/source consolidation, merge, purge, backup restore, settings/data revision, widget recency delegation and benchmark paths. Research inventories were discovery aids; they were not substituted for reading the writers.

## Execution limitations

Current schema head is 20; planned migration 21 remains conditional on rechecking head immediately before execution. Current backup wire format is already 4: new portable preference keys remain optional while current wire emission stays unchanged until the coordinated Phase 36 work.

No application execution or device action was performed for this gate. New automated suites, native depth/gesture behavior, TalkBack, text scaling, live Reduced Motion and physical-phone performance evidence remain execution/end-of-phase obligations under `human_verify_mode`. Node mocks cannot establish those native claims.

```yaml
issues: []
```
