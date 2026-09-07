# Phase 29 coverage and planning decisions

No external API integration: this phase consumes installed native rendering/gesture libraries and on-device SQLite. It introduces no remote API, service, authentication, network read, package installation, or schema push.

The schema change is a separate Phase 29 additive app_settings migration. Current head is 20; execution must recheck head+1 before allocating the filename. Density, satellites and last System are durable; camera/focus are session-only. Current backup wire version is already 4; Phase 36 retains ownership of coordinated emission/version changes. Optional portable preference acceptance is included here, current export emission is not.

Assumption-delta decision: contact remains the primary identity; decision no-change. The detector's “second tap” signal describes gesture sequencing, not another contact identity/model. Category Systems use category UID, never a display name as identity.

Reorder retains current code's contacted, Bound, live, sun-excluded eligibility; ADR-046 defines guarded rendered scope without explicitly mandating contacted-only population. Displaying a neutral body does not authorize changing its rank persistence. A filtered reorder validates System identity, expected eligible contacted visible membership, complete order, saved sun and ID/UID fingerprints under the shared write lock, using current local-day/status/snooze predicates. It then permutes only visible slots; hidden slots and existing uniqueness/count/scoped-update guards remain. Cached generations/dataRevision cannot replace that check: membership can change without full-order/sun changes, and local midnight can change it without any write.

Global contact-sun action eligibility is separate from System membership. Plan03 resolves sun ID/UID independently; plan08 validates the current global occupant and live identity for focus/Profile/cluster actions. A nonmember sun appends after System-ordered ambiguous candidates and never enters the companion. Plan12 covers Favorites/category exclusion and stale occupant/reused-ID cases in integration and pending native checks.

Governance discovery: graph links for OrreryScreen, ring-seq DAO and app-settings DAO are INFERRED from ADR Key-files. ADR-048 is partially superseded by ADR-077. Files and governing decisions are reviewed directly; missing graph edges are not absence of governance.

Planning evidence does not claim implementation, native gesture, accessibility, or performance passes.

## Source audit and implementation ownership

All rows below are COVERED by executable tasks; this is planned coverage, not passing implementation evidence. Plan numbers are 29-NN, with one plan per sequential wave because the screen/world/camera adapters are shared mutable files. There is no independent same-wave file ownership conflict.

| Source | Item | Plans |
|---|---|---|
| GOAL | Canonical health world, pan/zoom/tilt/yaw, billboards and derived Gravity | 01, 04, 05, 07 |
| GOAL | Readable bounded Home, world growth, persisted spacing-only density | 02, 04, 06 |
| GOAL | Three semantic levels, stable nudges, single/group focus | 04, 05, 08 |
| GOAL | Session return, Polaris/Recenter, deliberate reorder | 07, 09, 11 |
| GOAL | Systems, neutral contacts, satellites, accessible list, Reduced Motion | 03, 08, 10, 11 |
| CONTEXT | D-01/D-02 full dossier and binding REPLAN appendix | 01 and all plan read_first/context |
| CONTEXT | D-03 separate sequential app_settings migration; portable optional keys | 02 |
| CONTEXT | D-04 remove modes and morph behavior | 01 |
| CONTEXT | D-05 explicit neutral read widening; default unchanged | 03 |
| CONTEXT | D-06 settled separate preference migration | 02 |
| CONTEXT | D-07 memory-only Profile Back session | 11 |
| CONTEXT | D-08 live motion hook, shared-value controls, inactivity | 07, 11 |
| CONTEXT | D-09 actual relationships, subordinate moon semantics | 10 |
| CONTEXT | D-10 UID categories, no CRUD, physical-phone evidence boundary | 03, 12 |
| RESEARCH / appendix | E-02 explicit All/Not Contacted widening | 03 |
| RESEARCH / appendix | E-03 removal of the two-mode split | 01 |
| RESEARCH / appendix | R-05 preference schema/portable acceptance; camera excluded | 02, 11 |
| RESEARCH / appendix | R-17 consume existing Phase 23 hook and fix seed race | 11 |
| RESEARCH | One authoritative interpolated frame; native sibling sun depth | 01, 05, 08 |
| RESEARCH | Bounded invertible projection; minimum spacing; deterministic nudges | 04, 07 |
| RESEARCH | Real delayed stationary-hold ownership and guarded complete permutation | 09 |
| RESEARCH / checker | One transaction-composable current System predicate core; lock-time filtered membership and ID/UID validation including local-midnight change and reused IDs | 03-01 produces core/snapshot; 09-01 consumes under write lock; 09-02 captures; 12-01 integrates |
| RESEARCH / checker | Global contact-sun action eligibility independent of active System; deterministic ambiguity without companion widening | 03-01 supplies sun ID/UID; 08-01/02 validates and orders; 08-03 exact companion; 12-01/02 automated/native coverage |
| RESEARCH | Same-snapshot sun/member/impact reads; no Dashboard state leakage | 01, 03 |
| RESEARCH | Measured shell obstacles, overlay focus restoration, full text | 05, 06, 08 |
| RESEARCH | Request generations, coherent failures, fresh visit vs background | 02, 03, 10, 11 |
| RESEARCH | Neutral-rank extension OPTIONAL; preserve eligibility | 09 (extension excluded, no blocker) |
| RESEARCH | Installed stack only; no external API or dependency installation | all |
| RESEARCH | Final integrated SQL/lifecycle and native evidence handoff | 12 |

| Requirement | Implementing plans |
|---|---|
| ORRC-01 | 01; 12 integration |
| ORRC-02 | 01, 04, 07; 12 integration |
| ORRC-03 | 04, 05; 12 integration |
| ORRC-04 | 04, 06; 12 integration |
| ORRC-05 | 02, 04; 12 integration |
| ORRC-06 | 04, 05, 08; 12 integration |
| ORRC-07 | 01, 05, 08; 12 integration |
| ORRC-08 | 11; 12 integration |
| ORRC-09 | 06, 07; 12 integration |
| ORRC-10 | 07, 09; 12 integration |
| ORRC-11 | 03, 11; 12 integration |
| ORRC-12 | 03; 12 integration |
| ORRC-13 | 02, 06, 11; 12 integration |
| ORRC-14 | 10; 12 integration |
| ORRC-15 | 03, 06, 08, 10; 12 integration |
| ORRC-16 | 07, 11; 12 integration |

## Approved UI states: 55 of 55 lifted into must_haves

The exact UI-SPEC acceptance text is copied into the designated plan's must_haves truth. Each row covers every listed consideration, not just its populated case. Related wiring/finish tasks are also listed so a renderer row is not mistaken for isolated unit coverage.

| UI row | Considerations | Count | Must-have owner | Completing tasks |
|---|---|---|---|---|
| E1 World | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | 8 | 29-05 | 01-01,05-01,11-03 |
| E2 System selector | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | 8 | 29-03 | 03-02,03-03 |
| E3 View options | empty, loading, error, partial, long-text | 5 | 29-02 | 02-01,02-02 |
| E4 Contacts/Recenter | loading, error, overflow, long-text | 4 | 29-06 | 06-02,08-03 |
| E5 Companion sheet | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | 8 | 29-08 | 08-03 |
| E6 Cluster panel | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | 8 | 29-08 | 08-01,08-02 |
| E7 Focus labels | loading, error, overflow, long-text | 4 | 29-08 | 08-01,10-02,11-03 |
| E8 Polaris | empty, loading, error, populated, overflow, long-text | 6 | 29-06 | 06-02,07-02 |
| E9 Feedback | loading, error, overflow, long-text | 4 | 29-11 | 11-03 |

## Spec-less edge probe: all 37 authored

Input inventory: /tmp/orbit-phase29-edge-coverage.json. Resolution is planning-time: 31 explicit testable predicates, zero generic backstops, six unclassified flagged assumptions. No unresolved item is silently treated as verified. Every row below is copied verbatim into its owning plan's must_haves; the owning behavioral tests and task12 integration must exercise explicit rows. Unclassified rows stay assumptions for the checker/native review and do not invent an owner decision or reduce scope.

| Edge | Requirement / category | Disposition | Plan | Predicate or flagged assumption |
|---|---|---|---|---|
| EDGE-01 | ORRC-01 / idempotency | EXPLICIT | 29-01 | The same input snapshot and camera pose yields the same placement and intent; repeated focus of the same live ID does not duplicate navigation. |
| EDGE-02 | ORRC-01 / concurrency | EXPLICIT | 29-03 | A stale or cancelled scene/read generation cannot replace a newer System snapshot, including A→B→A completion order. |
| EDGE-03 | ORRC-02 / unclassified | FLAGGED ASSUMPTION | 29-07 | ASSUMPTION: ORRC-02 was unclassified by the probe; no extra behavior is inferred. Bounded camera, frame authority and native gesture recognition use the explicit canonical contracts; device proof remains pending. |
| EDGE-04 | ORRC-03 / empty | EXPLICIT | 29-04 | Empty, sun-only and one-contact worlds produce finite geometry and a readable scale. |
| EDGE-05 | ORRC-03 / encoding | EXPLICIT | 29-05 | Names containing emoji, combining marks and non-Latin scripts preserve complete original accessible identity and use measured native text truncation. |
| EDGE-06 | ORRC-04 / boundary | EXPLICIT | 29-04 | Test each legal zoom/tilt/perspective and Home-readability threshold exactly, just below and just above; clamp to finite legal camera bounds. |
| EDGE-07 | ORRC-04 / adjacency | EXPLICIT | 29-04 | Two adjacent rings exactly at minimum spacing remain separate rings; numerical equality never merges identities. |
| EDGE-08 | ORRC-04 / empty | EXPLICIT | 29-04 | Zero/one/many members have defined Home framing and never disable All Contacts. |
| EDGE-09 | ORRC-04 / ordering | EXPLICIT | 29-04 | Equal ring ranks order by created_at then id; UID-based nudges remain stable across refresh. |
| EDGE-10 | ORRC-04 / precision | EXPLICIT | 29-04 | At every legal pose the projection denominator stays positive and project/inverse error is at most 1e-6 world units. |
| EDGE-11 | ORRC-05 / unclassified | FLAGGED ASSUMPTION | 29-02 | ASSUMPTION: ORRC-05 was unclassified; no new edge semantics are inferred. The approved three spacing presets preserve membership and use Balanced factory default. |
| EDGE-12 | ORRC-06 / boundary | EXPLICIT | 29-05 | Semantic zoom thresholds are tested on both sides with hysteresis preventing boundary flicker. |
| EDGE-13 | ORRC-06 / empty | EXPLICIT | 29-05 | Zero labels is valid at overview and absent optional context creates no placeholder row. |
| EDGE-14 | ORRC-06 / encoding | EXPLICIT | 29-05 | Label truncation does not split grapheme identity; companion and accessibility retain full Unicode text. |
| EDGE-15 | ORRC-06 / precision | EXPLICIT | 29-04 | Collision nudges obey a documented small angular/world displacement budget and are deterministic across identical inputs. |
| EDGE-16 | ORRC-07 / adjacency | EXPLICIT | 29-08 | A touch on an inclusive shared target boundary includes both plausible targets and opens the group. |
| EDGE-17 | ORRC-07 / empty | EXPLICIT | 29-08 | No hit clears/dismisses focus; zero surviving cluster rows closes it, one stays actionable and many scroll. |
| EDGE-18 | ORRC-07 / encoding | EXPLICIT | 29-08 | Contact identity comparisons use stable UID/id, never normalized display-name equality. |
| EDGE-19 | ORRC-07 / ordering | EXPLICIT | 29-08 | Ambiguous candidates retain deterministic System order with stable identity tie-breaking. |
| EDGE-20 | ORRC-08 / unclassified | FLAGGED ASSUMPTION | 29-11 | ASSUMPTION: ORRC-08 was unclassified; no extra durable camera state is inferred. Profile Back restores the live session; fresh visit resets and background alone does not mean fresh visit. |
| EDGE-21 | ORRC-09 / unclassified | FLAGGED ASSUMPTION | 29-07 | ASSUMPTION: ORRC-09 was unclassified; no alternate recovery behavior is inferred. Recenter resets all axes, Polaris yaw only, with bounded recovery. |
| EDGE-22 | ORRC-10 / unclassified | FLAGGED ASSUMPTION | 29-09 | ASSUMPTION: ORRC-10 was unclassified; no widening of rank eligibility is inferred. Contacted-only persisted reorder uses the existing guards plus expected order and saved-sun checks. |
| EDGE-23 | ORRC-11 / adjacency | EXPLICIT | 29-03 | Duplicate Category names remain separate UID-identified Systems; overlapping memberships do not merge Systems. |
| EDGE-24 | ORRC-11 / empty | EXPLICIT | 29-03 | No Categories omits only Category rows; empty built-ins remain selectable and sun-only scene membership stays explicit. |
| EDGE-25 | ORRC-11 / ordering | EXPLICIT | 29-03 | Built-ins have canonical fixed ordering, Categories display_order then UID; out-of-order read completions cannot reorder selection. |
| EDGE-26 | ORRC-12 / adjacency | EXPLICIT | 29-03 | All Contacts/Not Contacted membership overlaps remain separate queries; null progress never equates to zero progress. |
| EDGE-27 | ORRC-12 / empty | EXPLICIT | 29-03 | Null last-contact rows exist only under explicit All/Not widening, with null progress/status and fixed neutral resting angle. |
| EDGE-28 | ORRC-12 / ordering | EXPLICIT | 29-03 | Neutral members have deterministic dense scene ordering without inventing durable rank eligibility. |
| EDGE-29 | ORRC-13 / adjacency | EXPLICIT | 29-02 | Selecting the already saved option is a no-op; duplicate/conflicting saves serialize and only a successful save publishes durable choice. |
| EDGE-30 | ORRC-13 / empty | EXPLICIT | 29-02 | Missing optional preference values use factory defaults; a failed read exposes retry and never writes defaults over unread durable state. |
| EDGE-31 | ORRC-13 / ordering | EXPLICIT | 29-02 | Density controls order Spacious, Balanced, Compact; conflicting async saves preserve the last successful committed value and retry intent. |
| EDGE-32 | ORRC-14 / empty | EXPLICIT | 29-10 | Zero eligible relationship rows yields no moons, one/many deterministic moons; a failed read remains distinguishable from an empty result. |
| EDGE-33 | ORRC-14 / encoding | EXPLICIT | 29-10 | Person and relationship text round-trips unchanged in Unicode; absent relation uses the approved key-person fallback. |
| EDGE-34 | ORRC-15 / adjacency | EXPLICIT | 29-08 | Sun and ordinary member identities are deduplicated before companion rows; shell/overlay obstacle intersections do not create duplicate actions. |
| EDGE-35 | ORRC-15 / empty | EXPLICIT | 29-08 | Companion opens for empty/loading/error states; zero has approved copy, one a normal row, many a scrolling list. |
| EDGE-36 | ORRC-15 / ordering | EXPLICIT | 29-08 | Companion order equals the active System member order and every qualifying contact, including the contact sun, appears once. |
| EDGE-37 | ORRC-16 / unclassified | FLAGGED ASSUMPTION | 29-11 | ASSUMPTION: ORRC-16 was unclassified; no new motion exception is inferred. Live Reduced Motion cancels existing inertia and stale seed publication while manual control remains. |

## Prohibition projection

The canonical projectProhibitions producer was called with descriptor-less judgment entries and the resulting flat shape is included in plan12 must_haves.prohibitions. Two bespoke intent prohibitions are kept: do not equate Gravity with human worth or portray never-contacted contacts as decaying; do not give moons independent-contact semantics. Both require presentation review. “Resolved / judgment” classifies verification intent, not a passed human review. No fabricated check_target or fail-first proof is supplied. Local privacy is already the project's standing prohibition; this phase adds no transmission path.

## Shared-table writer inventory and execution reread

The graph cannot enumerate SQL writers. The manual SQL scan and dynamic restore/merge paths identify these production entry points; executors must read complete current files before altering their shared invariants, including their transaction helpers and caller lifecycle. Test fixtures are additional validation data, not production authority.

- contacts: src/db/contacts-dao.ts; src/db/contact-lifecycle-dao.ts; src/db/recency-dao.ts; src/db/ring-seq-dao.ts; src/db/snooze-dao.ts; src/db/favourites-dao.ts; src/db/bulk-actions-dao.ts (composes category/frequency/favorite/snooze/recency/lifecycle cores); src/db/imported-contact-dao.ts; src/db/merge-dao.ts; src/db/purge-dao.ts; src/db/benchmark.ts; src/services/import/source-consolidation.ts; src/backup/restore-apply.ts. src/services/widget/widget-mark.ts delegates to the interaction/recency transaction path and must retain its existing semantics.
- app_settings: src/db/app-settings-dao.ts; src/db/data-revision-dao.ts; src/backup/restore-apply.ts; app-setting updates in merge/purge/lifecycle paths; the database migration runner and all app_settings migrations (002,003,004,005,014,015,019,020 plus the new next migration).
- relationships: src/db/relationships-dao.ts; src/db/merge-dao.ts; src/db/purge-dao.ts; src/backup/restore-apply.ts; foreign-key contact deletion/cascade behavior and migration016.
- Migration chain: read src/db/database.ts and every migration it registers; never change shipped migrations. Historical contacts writers include initial schema,007 tombstones,009 normalization,011 lifecycle; imports/restores can change recency-derived membership and sun/rank assumptions indirectly.
- Read consumers include src/db/orrery-read.ts, new System read, src/db/relationships-read.ts, src/db/impact-read.ts, src/services/impact.ts, src/logic/sun-occupant-logic.ts, current settings/export schema, and all Orrery components/stores. Dashboard's query store remains distinct.

## Dependency context

Phase23 supplies live theme tokens, text/icon/overlay primitives and the actual useReducedMotion hook. Phase24.2 supplies current relationships/knowledge visibility and lifecycle support. Current code overrides stale “hook absent” observations in discussion without reversing D-08. Relevant completed summaries and actual code are the executor's dependency evidence; the plans extend these existing subsystems, not a hypothetical relationship schema. Category CRUD remains Phase37, custom Systems Phase30, coordinated backup emission Phase36, final density/neighbor/large-System calibration Phase40.

## Design sampling audit

All 28 implementation/documentation tasks include automated commands; all newly owned test paths have file-existence guards. Two or three tasks per plan; the first task is a real local data-to-interaction tracer. Read-first lists include every modified path, with current-content-if-present preconditions for new paths. Native Skia, gesture recognition, navigation reachability, TalkBack and phone calibration remain explicit human evidence obligations. No implementation checks were run by the planner.
