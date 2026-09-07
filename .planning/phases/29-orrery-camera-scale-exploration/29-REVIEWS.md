---
phase: 29
latest_cycle: 2
reviewers: [codex, claude]
reviewed_at: 2026-09-07T06:50:19.539Z
plans_reviewed: [29-01-PLAN.md, 29-02-PLAN.md, 29-03-PLAN.md, 29-04-PLAN.md, 29-05-PLAN.md, 29-06-PLAN.md, 29-07-PLAN.md, 29-08-PLAN.md, 29-09-PLAN.md, 29-10-PLAN.md, 29-11-PLAN.md, 29-12-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=medium)"
  claude: "claude-opus-5 (reasoning=medium)"
model_sources:
  codex: "pinned"
  claude: "pinned"
---

# Cross-AI Plan Review — Phase 29

## Cycle 2 — Current Review

### Codex Review

## Summary

The twelve-plan Phase 29 set has converged. I found no current actionable HIGH, MEDIUM, or LOW planning concerns.

All cycle-1 actionable findings are fully resolved in executable task actions, acceptance criteria, verification, dependencies, or the explicit end-of-phase native gate. The plans preserve ADR-011, ADR-046, ADR-047, ADR-077, ADR-080, and ADR-085, including the owner’s D-11 ruling.

Current counts:

| Severity | Current count |
|---|---:|
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 0 |

Graph execution was attempted first for the relevant existing files, but every query failed with a sandbox `tsx` IPC `EPERM` error. I therefore used the coordinator’s successful grounding results: all reported governance edges are **INFERRED document claims**, not EXTRACTED code citations. ADR-048’s dual-view half is superseded by ADR-077; absence of an edge for `OrreryStack.tsx` was not treated as evidence of no governance. The ADR bodies and source files were checked directly.

## Strengths

- The ordinary-drag collision is explicitly removed before camera pan becomes reachable. Plan 01 deletes the legacy radial recognizer, rank bridge, mirrored drag state, and ghost preview, and makes camera pan the sole ordinary-drag owner. Plan 09 later restores reorder only through the prolonged-hold recognizer and guarded DAO request. [Plan 29-01](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-01-PLAN.md:108>), [Plan 29-09](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-09-PLAN.md:104>)

- The five snapshot prerequisites are concrete and correctly limited to type capability. `ReadOnlyExecutor` exposes only `getFirstAsync` and `getAllAsync`; Plan 01 changes the five named reader signatures while keeping writers on `SqlExecutor`. This is feasible against the current reader implementations and transaction contract. [transaction.ts](</home/bwales/projects/orbit-app/src/db/transaction.ts:42>), [Plan 29-01](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-01-PLAN.md:96>)

- D-05 is enforced without weakening the legacy default read. The current read still requires `last_contact IS NOT NULL`; Plan 03 introduces explicit All Contacts/Not Contacted widening with null health/progress and exports one transaction-composable membership core for both snapshots and reorder validation. [orrery-read.ts](</home/bwales/projects/orbit-app/src/db/orrery-read.ts:89>), [29-CONTEXT.md](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-CONTEXT.md:24>), [Plan 29-03](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:99>)

- Gravity expansion now has a named owner and preserves semantic parity. Plan 04 batches complete interaction histories through a read-only core inside the coherent snapshot, explicitly prohibiting truncation and per-contact queries. That matches the existing single-contact reader and `computeContactGravity`, including the `rarelyResponds` connected-only filter. [impact-read.ts](</home/bwales/projects/orbit-app/src/db/impact-read.ts:23>), [impact.ts](</home/bwales/projects/orbit-app/src/services/impact.ts:88>), [Plan 29-04](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-04-PLAN.md:103>)

- Action validation is bounded rather than scene-sized. Plan 08 owns a fresh ID/UID/member/current-sun probe with at most three SELECTs, shares Plan 03’s predicate builder, prohibits Gravity/history/full-scene reads, and rechecks generation after awaiting SQLite. [Plan 29-08](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-08-PLAN.md:108>)

- Reorder protection strengthens rather than removes the existing controls. The current DAO already checks uniqueness, complete contacted population, scoped one-row updates, and atomic rollback. Plan 09 adds expected full order, sun, ID/UID fingerprints, filtered membership, hidden-slot preservation, and current-local-day validation under the same write lock. [ring-seq-dao.ts](</home/bwales/projects/orbit-app/src/db/ring-seq-dao.ts:60>), [ADR-046](</home/bwales/projects/orbit-app/docs/decisions/ADR-046-query-time-orrery-placement-and-transactional-ring-ordering.md:18>), [Plan 29-09](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-09-PLAN.md:92>)

- The SQLite midnight test is now executable without changing production clock authority. Plan 09 owns a per-connection, test-only `date('now','localtime')` override, delegates every other date call to an untouched SQLite connection, and tests a queued write after the day changes. Plan 12 reuses it in production-path integration. [Plan 29-09](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-09-PLAN.md:92>), [Plan 29-12](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-12-PLAN.md:106>)

- D-11 is consistent across membership, actions, companion rows, satellite reads, rendering, invalidation, and integration. A nonmember configured contact sun retains focus/Profile behavior but receives no moons, satellite targets, companion membership, or relationship context; membership restoration restores eligibility. [29-CONTEXT.md](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-CONTEXT.md:29>), [Plan 29-03](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:100>), [Plan 29-08](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-08-PLAN.md:132>), [Plan 29-10](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-10-PLAN.md:92>), [Plan 29-12](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-12-PLAN.md:106>)

- Native evidence is represented honestly. The early automated tracer enables expansion but does not claim Skia/navigation proof. Plan 12 requires the complete native checklist to remain pending UAT and prevents phase verification from completing until those obligations are resolved. The configured mode is `end-of-phase`. [Plan 29-01](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-01-PLAN.md:110>), [Plan 29-12](</home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-12-PLAN.md:118>), [config.json](</home/bwales/projects/orbit-app/.planning/config.json:41>)

## Concerns

### HIGH

None.

### MEDIUM

None.

### LOW

None.

No new product, visual, priority, risk, security, ADR-reversal, or HANDOFF-reversal decision was uncovered.

## Suggestions

No replanning is required.

During execution:

- Treat Plan 01’s automated tracer and removal of the legacy reorder path as a hard expansion prerequisite.
- Retain query-count instrumentation for the Plan 04 batch reader and Plan 08 action probe.
- Keep Plan 12’s native checklist open until evidence is actually recorded; do not infer native rendering, gesture, TalkBack, or physical-phone performance from Node tests.
- If the committed graph is expected to be current at phase close, assess whether the comment citation changes warrant the permitted `npm run graph:build`; this is maintenance advice, not a missing Phase 29 task.

## Risk Assessment

Planning risk is **moderate but controlled**. The residual risk comes from implementation breadth—30 tasks across a shared screen/world/camera subsystem—and from native gesture, Skia depth, accessibility, and physical-device behavior that cannot be established before implementation.

Data-integrity risk is well covered: plans preserve the existing contacted-only rank boundary, explicit never-contacted widening, current-local-day membership semantics, ID/UID validation, transaction ownership, and local-only architecture. The manual writer audit found no conflicting alternate rank policy or satellite lifecycle model in the contacts, settings, relationships, merge, purge, restore, import, recency, favorite, snooze, and lifecycle writer families.

## Current disposition

| Prior-cycle item | Disposition | Basis |
|---|---|---|
| HIGH: camera pan could coexist with legacy radial reorder | **fully resolved** | Plan 01 removes the complete legacy path before pan; Plan 09 introduces the only replacement recognizer. |
| Five reader signatures could not consume snapshot `ro` | **fully resolved** | Plan 01-00 changes exactly the five reader parameter types and verifies their regressions/type compatibility before the tracer. |
| Gravity expansion lacked a batched complete-history owner | **fully resolved** | Plan 04 owns the read-only batched DAO, complete-history parity, query-count tests, and same-snapshot integration. |
| Target revalidation risked a full scene/history reload per action | **fully resolved** | Plan 08 owns a bounded, narrow probe with shared predicates and at-most-three-SELECT verification. |
| Local-midnight reorder invalidation lacked an executable test mechanism | **fully resolved** | Plan 09 owns the isolated SQLite local-day fixture and queued-lock test; Plan 12 reuses it. |
| Excluded configured sun satellite behavior was unspecified | **fully resolved** | D-11 is encoded across Plans 03/08/10/12 with action, companion, context, invalidation, requalification, automated, and native cases. |
| ADR-048/ADR-077 source citations could remain misleading | **fully resolved** | Plan 12 updates actual source comments, preserves only ADR-048’s live static behavior, regenerates the registry, and verifies comment-only changes. |
| Native checks were pending | **fully resolved as a planning concern** | They remain honestly pending implementation, but the executable end-of-phase completion gate prevents a false completed verdict. |
| Suggestion to move the preference migration into Wave 1 | **resolved with rationale; not actionable** | Plan 02 documents the shared `OrreryScreen` ownership conflict and absence of an intervening release. Current schema head is still 20, with an explicit head+1 execution precondition. [database.ts](</home/bwales/projects/orbit-app/src/db/database.ts:55>) |
| Shell/navigation files listed as modified | **informational; not actionable** | Plans 06 and 11 give those files concrete obstacle-measurement and session-lifecycle work with tests. |

**Current disposition: APPROVE — ready for execution, with 0 HIGH, 0 MEDIUM, and 0 LOW current findings.**

---

### Claude Review

# Cross-AI Plan Review — Phase 29, Cycle 2 (Orrery Camera, Scale & Exploration)

Reviewed on disk, against source, at commit `21a9136`. Graph queries executed successfully (`npm run graph:ask -- governs …`) for `OrreryScreen.tsx`, `OrbitBody.tsx`, `ring-seq-dao.ts`, `orrery-read.ts`, `app-settings-dao.ts`, `impact-read.ts`, `relationships-read.ts`, `OrreryStack.tsx`; **every returned edge was `INFERRED`** (ADR Key-files attribution), none `EXTRACTED`. `OrreryStack.tsx` returned "No ADR is recorded" — treated as no citation written, not as absence of governance. No files were edited; no device action was taken.

## Summary

The revised twelve-plan set resolves the cycle-1 HIGH and all five actionable non-HIGH concerns, and it does so with contracts I could verify against installed code rather than against the upstream artifacts. I verified each claimed mechanism independently rather than trusting the plans' own citations:

- The legacy radial reorder path the cycle-1 HIGH named is exactly where the plan says it is (`OrreryScreen.tsx:463-647` — `bodiesShared`, `dragMetrics`, `activeDragId`, `commitRingSeq`/`commitRef`, `Gesture.Pan()` at :558, ghost preview at :636-647, `rewriteRingSeq` import at :76), and 29-01-01's action retires all of it in the same task that introduces camera pan.
- The five reader signatures 29-01-00 adapts are at the lines it cites (`app-settings-dao.ts:425`, `contact-read.ts:67`, `contact-status-read.ts:54`, `profile-dao.ts:96`, `orrery-read.ts:89`), and `ReadOnlyExecutor` is a real `Pick<SqlExecutor,"getFirstAsync"|"getAllAsync">` (`transaction.ts:42`), so the widening is type-only and structurally safe at every existing caller.
- **I ran the SQLite-clock mechanism myself.** On this repo's Node 22, `DatabaseSync.function('date',{varargs:true},…)` overrides the builtin: intercepting exactly `('now','localtime')` returns the controlled day, `date('2020-05-05','+1 day')` and `date(NULL)` delegate correctly to a second untouched connection, and `julianday('now')` is unaffected. Because `PROGRESS_SQL` is `julianday(date('now','localtime')) - julianday(date(last_contact))` (`status.ts:60`) and `SNOOZED_WHERE` uses `date('now','localtime')` (`dashboard-query-logic.ts:158-159`), a day-only override genuinely moves Snoozed and Needs Attention membership — 29-09-01's lock-time invalidation test is buildable exactly as specified.
- The batched Gravity contract matches `getImpactInputs` field-for-field, including its `LEFT JOIN` no-history case and `occurred_at DESC, id DESC` ordering (`impact-read.ts:52-90`), and correctly refuses a history cutoff because `computeContactGravity` has a nonzero floor (`impact.ts:88-101`).
- The Skia depth claim holds in the installed native recorder: `GroupProps.zIndex` exists (`Common.ts:92-94`) and `RNRecorder.h:59-66` sorts sibling groups with an explicit `order` tiebreak, so equal-depth ties are deterministic.

Remaining risk is concentrated where the plans already say it is: native Skia, gesture arbitration, TalkBack and phone performance, all carried honestly as end-of-phase obligations under `human_verify_mode: end-of-phase` (`.planning/config.json:41`). I raise no current HIGH. Two MEDIUM and three LOW findings are new, and none is a product decision.

## Strengths

1. **The HIGH fix is placed in the only task that could close it.** Retiring the legacy writer *inside* 29-01-01 (not a follow-up task) plus a behavioral assertion that pan leaves `ring_seq`, `modified_at` and `dataRevision` byte-identical closes the window rather than narrowing it. The DAO guards it must not weaken are intact and unchanged (`ring-seq-dao.ts:72-112`: uniqueness, complete-effective-count, per-row `changes===1`).
2. **Reorder integrity is stronger than the shipped writer.** `RingReorderRequest` adds expected complete order, saved sun, ID/UID fingerprints and re-resolved eligible membership at lock time, and correctly identifies that numeric IDs are reusable (`011-contact-lifecycle-schema.ts:18` — `INTEGER PRIMARY KEY` with separate `uid UNIQUE`). Composing `readOrrerySystemMembersCore` on the already-locked executor respects the non-reentrancy contract documented at `transaction.ts:12-28`.
3. **Never-contacted segregation is enforced, not asserted.** 29-03-01 preserves `listOrbitingContacts`' `last_contact IS NOT NULL` default (`orrery-read.ts:96`) and widens only All Contacts / Not Contacted, with explicit `CASE` null health rather than `STATUS_SQL`'s `ELSE 'stable'` fallback (`status.ts:73-79`). That is D-05 and ADR-011 honored at the mechanism level.
4. **D-11 is encoded consistently across four plans** (03-01 parent-eligibility, 08-03 companion/context exclusion, 10-01/10-02 read+render eligibility and requalification, 12-01/12-02 automated + native). The owner's ruling is applied without deferring satellite capability.
5. **Baseline corrections are all true on disk:** `TARGET_VERSION = 20` (`database.ts:55`), `BACKUP_FORMAT_VERSION = 4` (`backup/types.ts:14`), the theme-key precedent for allowlisting-without-emission (`backup-schema.ts:155-162`), and the live reduced-motion seed race (`use-reduced-motion.ts:78-88`: a `.then` seed emits after a live event with no generation guard) — 29-11-02 enforces ADR-085's own stated risk rather than reversing it.
6. **Honest evidence separation.** Automated tracer-before-expansion and native end-of-phase evidence are kept distinct in 29-01-01 and 29-12-02, with no new interim approval gate invented.

## Concerns

### MEDIUM — 1. The Orrery read path newly serializes on the single global write mutex, and nothing defines behavior when a long holder has it

`inReadSnapshot` is `withMutex` + `BEGIN` (`transaction.ts:74-88`) over the one module-level promise chain (`mutex.ts:23,33-34`). Today its **only** production consumer is the backup export manifest (`export-manifest.ts:93`), whose own docstring says it "holds the shared mutex for the entire snapshot and can delay every app write" (`transaction.ts:66-72`). The current Orrery load takes no mutex at all — it issues plain reads (`OrreryScreen.tsx:215-268`).

Phase 29 moves the Orrery onto that mutex twice over: 29-03-01/29-04-01 put the whole scene snapshot (settings, sun, members, batched impact inputs) inside one `inReadSnapshot`, and 29-08-01's `readOrreryContactTargetValidation` opens "one short `inReadSnapshot`" **per tap**.

Failure scenario: an automatic backup export begins; the user taps a contact; the tap→Profile probe queues behind the export's full photo-inclusive snapshot and the Profile does not open for seconds, with no busy state — E4/E7's "loading" treatments cover reads, not lock waits, and no plan mentions the contention. A less extreme version happens on every Quick Log: the scene snapshot now blocks app writes on the app's core-value path.

The plans partially mitigate the *size* of the work (T-29-04-03 bounds statement count; the probe is capped at three SELECTs), but the *contention* and its UX are unaddressed in any task, acceptance criterion, threat row or native check. Cheapest fix: state the tradeoff explicitly in 29-04-01/29-08-01 (or defer it with rationale to the hardening phase, per D-10), and add one native-checklist line for "tap during an automatic backup."

### MEDIUM — 2. ADR-027 still records "orrery encodings — rejected" for Gravity, and no plan captures the supersession

`npm run graph:ask -- governs src/db/impact-read.ts` returns ADR-027 (INFERRED), status **Accepted**, no supersession flag. Its Decision is "derives gravity and intensity at read time and shows them together **only on the contact profile**", and its rejected alternatives include "**Dashboard or orrery encodings** — rejected to preserve the contact-card surface and avoid overloading it" (`ADR-027…md:18,25`).

ORRC-03 (Gravity-driven body mass) and ORRC-15 (Gravity context in the companion list) implement exactly that rejected encoding. This is **not** an escalation: the owner ratified it in dossier §E ([DECIDED], "Gravity as Visual Mass") and in the ORRC requirement set, and ADR-093 already broke "profile-only" for the Dashboard ("Gravity narrows the fully filtered result in TypeScript", `ADR-093…md:18,25`) without recording a supersession either. So the decision is settled; the **record** is not.

The consequence is the one AGENTS.md warns about: after Phase 29 ships, an agent asking the graph what governs gravity gets a live Accepted ADR whose rejected-alternatives list names this exact feature. 29-12-02 owns ADR upkeep but scopes it to ADR-048/ADR-077 tokens in `OrreryScreen.tsx`/`OrbitBody.tsx` — nothing notes the ADR-027 tension. Add one line to 29-12-02 recording it (and flagging it for the KB extraction that mints superseding ADRs), or explicitly defer it with rationale.

### LOW — 3. The new Orrery data path will be invisible to the ADR graph

Per AGENTS.md, "a file is only connected to an ADR if the file cites `ADR-NNN` in a comment." Phase 29 creates the new authoritative Orrery read/write surface — `orrery-system-read.ts`, `orrery-impact-read.ts`, `orrery-action-read.ts`, `orrery-world-logic.ts`, `orrery-camera-logic.ts` — while `orrery-read.ts` and `ring-seq-dao.ts` (currently the only ADR-046-linked Orrery data files) become secondary. 29-12-02's citation task lists only `OrreryScreen.tsx`, `OrbitBody.tsx` and the generated registry in `files_modified`. Result: the files that actually enforce ADR-046's guarded ordering and ADR-011's segregation carry no citation. Extending 29-12-02's comment-only pass to the new files costs nothing and keeps `graph:ask` truthful.

### LOW — 4. 29-04-01 has no `<acceptance_criteria>` block

Task counts per plan: every plan matches tasks to acceptance blocks except 29-04 (3 tasks, 2 blocks). The missing one is 29-04-01 — the task added in this cycle to resolve the Gravity concern. The executor workflow treats `<acceptance_criteria>` as a hard verification gate (`execute-plan.md` step `execute`, item 3); with the block absent, only `<done>` and the `<verify>` command apply. The task's own `<behavior>` already states testable predicates (exact parity, query counts, no writable-capability use); promoting them into an acceptance block restores parity with the other 29 tasks.

### LOW — 5. Native sibling depth sorting batches only *consecutive* Group children — unstated

`RNRecorder.h:73-88`: `playGroup` accumulates pending sibling `Group`s and **flushes the sorted batch as soon as a non-Group child is encountered**. So a single non-Group sibling (a ring `Circle`, a stray `Paragraph`, a backplate) interleaved between body groups silently splits depth sorting into two independent batches, and a near body will no longer cross the sun. 29-05-01 gets the architecture right ("direct siblings within a single shared body layer", rings behind bodies) but never states this constraint, and no Node test can detect it — it is a native-only regression that would surface as "depth sometimes doesn't work." The plan's human-check ("near-body occlusion of sun") would catch it late; one sentence in 29-05-01's action would prevent it.

## Suggestions

- Record in 29-12-02 that ADR-077's Implementation section is stale on one point: it says `src/components/SegmentedControl.tsx` is "retired with its only consumer," but the component now has a second consumer (`HomeScreen.tsx:74,1765` — Dashboard view mode). The plans correctly do **not** delete it; the ADR body is immutable, so the living system doc is the right place to note it. (Advisory drift — not counted.)
- 29-03-01 needs a category read that returns `uid`; `listCategories` returns only `{id, name}` (`contact-read.ts:49-55`) and `contact-read.ts` is not in 29-03's `files_modified`. The plan can satisfy this inside `orrery-system-read.ts` (`categories.uid` exists — `001-initial.ts:44`), but saying so explicitly avoids an executor reaching for a sixth file mid-task.
- Consider naming, in 29-09-02, what a drag across an *interleaved neutral body* does in All Contacts. Never-contacted rows have `ring_seq NULL` and sort last under `COALESCE(ring_seq,1e9), created_at, id`, so they occupy outer rings; "nearest eligible contacted slot" is defined, but the visual outcome of dragging past them is the kind of thing that gets re-litigated during execution.

## Risk Assessment

**Plan risk: LOW–MEDIUM. Execution risk: MEDIUM–HIGH (unchanged, and correctly owned).**

*Data-layer risk: LOW.* Every existing `ring_seq` guard is preserved and four are added; the migration is additive, correctly numbered against verified head 20, and correctly withholds wire emission; the default never-contacted exclusion survives; no shipped migration is edited. The one previously-unverifiable mechanism (the SQLite clock fixture) I executed myself and it works.

*Product-decision risk: LOW.* No `[DECIDED]`/`[REJECTED]` item is reopened. D-11 is applied as ruled. The one recorded-decision tension I found (ADR-027, Concern 2) is a record-keeping gap behind an owner decision that was already ratified twice, not a reversal — no escalation required.

*Integration/sequencing risk: MEDIUM.* Twelve strictly serial waves with shared mutable adapters (`OrreryScreen.tsx`, `OrreryWorld.tsx`, `use-orrery-camera.ts`) means a contract error in wave 1 propagates. Reordering is unreachable from wave 1 to wave 9 — accepted, unreleased, and explicitly stated.

*Performance/latency risk: MEDIUM.* Concern 1 is the substantive new one; it will be invisible at the owner's scale until a backup runs concurrently.

*Verification risk: MEDIUM.* Automated coverage of pure math, real SQL and controllers is strong. A large share of ORRC-02/03/07/09/10/16 still rests on a native checklist with no device time scheduled — accurately represented, never overstated.

## Current disposition

| Prior-cycle concern | Disposition | Evidence in the revised plan |
|---|---|---|
| HIGH — legacy radial reorder live when camera pan lands | **fully resolved** | 29-01-01 action retires the `Gesture.Pan` registration, `commitRingSeq`/`commitRef`/`commitFromWorklet`, `bodiesShared`/`dragMetrics`/`activeDragId` and ghost preview in the same task as pan; `<behavior>` asserts no rank DAO call and byte-identical `ring_seq`/`modified_at`/`dataRevision`; 29-09-02 restores hold-reorder |
| MEDIUM — Gravity batch reader unowned / per-member work under the mutex | **fully resolved** | 29-04-01 owns `readOrreryImpactInputsCore(ReadOnlyExecutor, ids)` with exact `getImpactInputs` parity, complete history (no cutoff), 256-ID chunking, query-count and ro-only tests; per-member loops prohibited |
| MEDIUM — controlled SQLite-clock executor not buildable | **fully resolved** | 29-09-01 owns `openSqliteLocalDayFixture`; mechanism independently verified by this review on Node 22 (builtin `date` override, native delegation for other forms, `julianday` untouched, day override does move `PROGRESS_SQL`/`SNOOZED_WHERE`) |
| MEDIUM — full System snapshot re-read on every tap | **fully resolved** *(as stated)* | 29-08-01 owns `readOrreryContactTargetValidation`: ≤3 SELECTs, bound target identity, shared `buildOrrerySystemWhere`, `sunOccupantIsSelf` policy, no catalog/member/Gravity read. See new Concern 1 for the adjacent contention issue it does not address |
| MEDIUM — excluded global-sun satellites unspecified | **fully resolved** | Owner ruling recorded as D-11 (`29-CONTEXT.md:30`) and encoded in 29-03-01, 29-08-03, 29-10-01/02, 29-12-01/02 |
| MEDIUM — move the migration to wave 1 | **not actionable (explicitly rejected with rationale)** | 29-02-01 action states the rejection: `OrreryScreen.tsx` ownership overlaps the tracer and preference wiring; no release between waves |
| LOW — Plan 29-06 touches shell-owned files | **fully resolved** | 29-06-01 scopes edits to measured obstacles and preserves FAB position, capture routes, tab-height consumers and Back |
| LOW — ADR citation/registry upkeep absent | **partially resolved** | 29-12-02 covers `OrreryScreen.tsx`/`OrbitBody.tsx` comment tokens + `gen:adr-registry`; the new Orrery DAO/logic files remain uncited (new LOW 3) and the ADR-027 tension is unrecorded (new MEDIUM 2) |
| LOW — `orrery_last_system` cannot be CHECK-constrained | **fully resolved** | 29-02-01 requires documenting the partial SQL constraint and enforcing the closed builtin/`category:<UID>` grammar in both the public validator and `updateAppSettingsCore` |
| Codex HIGH — native acceptance not blocking | **fully resolved / not counted** | 29-01-01 separates automated tracer-before-expansion from native evidence; 29-12-02 carries the full E1–E9 native checklist as pending UAT under `human_verify_mode: end-of-phase` |

**Current counts (convergence semantics — new, partial and still-open only):**

- **HIGH: 0**
- **MEDIUM actionable: 2** — (1) global-mutex contention on the new Orrery read/tap paths; (2) unrecorded ADR-027 supersession for Orrery Gravity.
- **LOW actionable: 3** — (3) new Orrery data files carry no ADR citations; (4) 29-04-01 missing `<acceptance_criteria>`; (5) Skia consecutive-sibling depth batching constraint unstated.
- Excluded from counts: fully resolved cycle-1 items, the explicitly rejected wave-1 migration move, and advisory cross-artifact drift (ADR-077's stale `SegmentedControl` key-file note).

**Recommendation:** approve for execution. All five findings are additive edits to existing tasks; none requires an owner decision, and none blocks starting wave 1.

---

## Cycle 2 Consensus Summary

Both exact-model, source-grounded lanes agree that the cycle-one HIGH and all cycle-one actionable non-HIGH concerns are fully resolved by the revised executable plans. Both found the core design ready for execution: the legacy reorder path is removed with camera pan, five readers acquire read-only snapshot-compatible signatures first, Gravity is batched under one snapshot, target validation is bounded, the local-day test seam is executable, D-11 is consistent, and native evidence remains an honest end-of-phase gate.

The lanes diverged on new findings. Codex found no current planning concern. Claude found five additive non-HIGH gaps. Source and plan adjudication accepts all five as actionable wording/coverage changes because none is yet present in an executable action, acceptance criterion, verification item, threat row, or explicit deferral:

1. **MEDIUM — global mutex contention is unspecified.** The new scene snapshot and per-action validation both use the one shared mutex. Plans bound query counts and model loading/error states but do not name the interaction with a long automatic-backup snapshot, define the UX, or explicitly defer contention testing with rationale. Add the tradeoff and a native/integration contention check or explicit Phase 40 deferral to 29-04/08/12.
2. **MEDIUM — ADR-027 supersession traceability is absent.** The owner-approved dossier §E and ORRC-03/15 authorize Gravity in Orrery, while accepted ADR-027 still names Orrery encodings as rejected. This is already decided and requires no owner question or immutable ADR edit. Plan 29-12 must record the tension for living documentation and later KB extraction/superseding-ADR handling.
3. **LOW — new authoritative Orrery files lack planned ADR citations.** Plan 29-12 owns source-comment citation upkeep only for the existing screen/body. Extend its comment-only pass to the new DAO/logic files that enforce ADR-011/046/077 and regenerate the registry as already planned.
4. **LOW — 29-04-01 lacks an acceptance criterion.** Its behavior/action/done text is strong, but it is the only one of 30 tasks without an explicit `<acceptance_criteria>` gate. Add the already stated parity, bounded-query, read-only, and rendered-mass conditions.
5. **LOW — native depth batching requires consecutive sibling Groups.** Plan 29-05 correctly specifies direct sibling body Groups, a single shared body layer, rings behind bodies, and native occlusion verification. The installed recorder flushes its sorted Group batch at a non-Group child, so add one preventive sentence prohibiting interleaved non-Group children in the depth-sorted body layer.

The new findings are routine planning/doc details. They do not ask the owner to revisit product, visual, risk, security, ADR, or HANDOFF decisions. Planning risk remains low-to-medium; execution risk remains medium-to-high because the native camera/gesture/Skia/accessibility surface is broad.

### Current consensus disposition

- Current unresolved HIGH: **0**.
- Current actionable non-HIGH: **5** (2 MEDIUM, 3 LOW).
- Cycle-one unresolved count was 6; cycle two decreases it to 5, so convergence is progressing and is not stalled.
- Recommendation: incorporate the five bounded changes, then run the next independent check/review cycle.

## Cycle 2 Verification Coverage

### Source-grounding authority and graph coverage

- Effective authority: `grep`. Declarations and file existence can be VERIFIED. Type/signature compatibility, runtime behavior, native rendering, gesture arbitration, performance, and SQL semantics beyond source inspection are **UNCHECKABLE / INFO** under this authority unless separately exercised; they were never promoted to VERIFIED merely because a name exists.
- Coordinator `npm run graph:ask -- governs` queries succeeded for every existing `files_modified` path used by the phase. Every returned edge was **INFERRED** from ADR Key-files metadata. ADR-048's dual-view/morph portion was flagged partially superseded by ADR-077. `OrreryStack.tsx` returned no ADR; this was treated as missing citation evidence, not absence of governance. Codex disclosed sandbox `tsx` IPC `EPERM`; Claude and the coordinator successfully queried the graph. Both lanes still read ADR/source directly.

### Auditable existing-symbol matrix

| Plan citation | Existing symbol or contract | Grounding verdict and source |
|---|---|---|
| 29-01:96 | `getAppSettings`, `getContactHeader`, `getContactStatus`, `getProfile`, `listOrbitingContacts` | VERIFIED declarations at `src/db/app-settings-dao.ts:425`, `src/db/contact-read.ts:67`, `src/db/contact-status-read.ts:54`, `src/db/profile-dao.ts:96`, `src/db/orrery-read.ts:89`; proposed parameter compatibility is UNCHECKABLE under grep. |
| 29-01:96,108 | `ReadOnlyExecutor`, `SqlExecutor`, `inReadSnapshot` | VERIFIED at `src/db/transaction.ts:42`, `src/db/types.ts:17`, `src/db/transaction.ts:74`; transaction behavior verified by full source reading, signatures remain UNCHECKABLE. |
| 29-01:105-110 | `nodeSqliteExecutor`; current radial `Gesture.Pan`, `commitRingSeq`, ghost preview | VERIFIED at `src/db/__testkit__/node-sqlite.ts:30` and current `src/screens/OrreryScreen.tsx:463-647`; planned removal is new work. |
| 29-01:121-126 | `progressToAngle`, `polarToXY` | VERIFIED at `src/logic/orrery-geometry-logic.ts:109,118`. |
| 29-02:93-118 | `TARGET_VERSION`, `MIGRATIONS`, `getPortableSettingsSnapshot`, `updateAppSettings`, `updateAppSettingsCore`, `PORTABLE_SETTINGS_KEYS`, `BACKUP_FORMAT_VERSION` | VERIFIED at `src/db/database.ts:55,58`, `src/db/app-settings-dao.ts:519,910,961`, `src/backup/backup-schema.ts:132`, `src/backup/types.ts:14`; new migration/fields are excluded below. |
| 29-03:99-100 | `listOrbitingContacts`, `buildPopulationWhere`, `NOT_CONTACTED_WHERE`, `FAVOURITES_WHERE`, `SNOOZED_WHERE` | VERIFIED at `src/db/orrery-read.ts:89` and `src/logic/dashboard-query-logic.ts:157-183`; new shared System builder/core excluded below. |
| 29-03:99-100 | `listCategories`, `resolveSunOccupant`, `sunOccupantIsSelf` | VERIFIED at `src/db/contact-read.ts:49` and `src/logic/sun-occupant-logic.ts:103,120`; source confirms the existing category reader omits UID. |
| 29-04:103-114 | `getImpactInputs`, `computeContactGravity`, `ImpactInputs` | VERIFIED at `src/db/impact-read.ts:52`, `src/services/impact.ts:88`, and `src/services/impact-types.ts`; batched parity and new signature are UNCHECKABLE/new until implementation. |
| 29-05:93 | Skia `GroupProps.zIndex` and recorder sibling ordering | VERIFIED dependency declarations/implementation at `node_modules/@shopify/react-native-skia/src/dom/types/Common.ts:92` and `cpp/api/recorder/RNRecorder.h:55-88`; native runtime behavior remains UNCHECKABLE. |
| 29-06:89-101 | measured tab wrapper, `UniversalFab`, semantic `ICON_REGISTRY` | VERIFIED existing owners at `src/navigation/RootNavigator.tsx:47`, `src/components/UniversalFab.tsx:117`, `src/components/icons/icon-registry.ts:33`; obstacle registry/control symbols are new. |
| 29-07:90-102 | Gesture Handler 2 builders and `shortestAngleDelta` | VERIFIED installed builder APIs under `node_modules/react-native-gesture-handler` and declaration at `src/logic/orrery-geometry-logic.ts:221`; arbitration and worklet behavior are UNCHECKABLE. |
| 29-08:108-132 | `sunOccupantIsSelf`, existing Profile route, shared transient/Sheet primitives | VERIFIED source owners in `src/logic/sun-occupant-logic.ts:103`, navigation types/stack, and existing component/store source; the narrow target reader/focus logic are new. |
| 29-09:92-104 | `computeRingReorder`, `rewriteRingSeq`, shared mutex/write transaction, Node `DatabaseSync.function` | VERIFIED at `src/logic/ring-reorder-logic.ts:25`, `src/db/ring-seq-dao.ts:60`, `src/db/mutex.ts`/`transaction.ts`, and `node_modules/@types/node/sqlite.d.ts:367`; Claude separately exercised the date override. New fixture/signatures are excluded. |
| 29-10:90-102 | `resolveRelationshipVisibility` and relationships lifecycle schema | VERIFIED at `src/db/relationships-read.ts:39` and migration 016/relationship DAOs; satellite DAO/render symbols are new. |
| 29-11:97-121 | `createReducedMotionController`, `useReducedMotionShared`, current Orrery clock consumers | VERIFIED at `src/theme/use-reduced-motion.ts:61,103`, `src/components/orrery/OrreryCanvas.tsx:92`, and `src/components/orrery/SunBody.tsx:68`; race fix/session controller are new. |
| 29-12:106-120 | production writer families, `runMigrations`, ADR registry generator | VERIFIED source paths/declarations including `src/db/migrations/runner.ts:32`, contacts/recency/favourites/snooze/merge/purge/restore/relationships writers, and `scripts/gen-adr-registry.ts`; integrated behavior and new checklist are not yet implemented. |
| verify commands throughout | `--noEmit` TypeScript flag and named npm scripts | VERIFIED from installed `tsc` and `package.json`; successful future test/native results are UNCHECKABLE until execution. |

All existing paths named in the twelve plans' `files_modified` and `read_first` blocks were checked on disk. The review additionally read the full same-subsystem writers/readers enumerated in COVERAGE.md for contacts, interactions, relationships, categories, app_settings, and ring ordering before asserting invariants.

### Explicit new-artifact exclusions

These plan-declared outputs do not exist yet and were excluded from missing-symbol findings: `src/services/orrery-scene.ts`, `src/logic/orrery-camera-logic.ts`, `src/components/orrery/OrreryWorld.tsx`, `src/db/migrations/021-orrery-preferences.ts`, `src/stores/orrery-preferences-store.ts`, `src/components/orrery/OrreryViewOptions.tsx`, `src/logic/orrery-system-logic.ts`, `src/db/orrery-system-read.ts`, `src/stores/orrery-system-store.ts`, `src/components/orrery/OrrerySystemSelector.tsx`, `src/components/orrery/orrery-controls-logic.ts`, `src/db/orrery-impact-read.ts`, `src/logic/orrery-world-logic.ts`, `src/components/orrery/ProjectedOrbitRing.tsx`, `src/logic/orrery-label-logic.ts`, `src/components/orrery/OrreryLabel.tsx`, `src/stores/shell-obstacle-store.ts`, `src/components/orrery/OrreryControls.tsx`, `src/components/orrery/orrery-obstacle-logic.ts`, `src/components/orrery/use-orrery-camera.ts`, `src/logic/orrery-gesture-logic.ts`, `src/logic/orrery-recovery-logic.ts`, `src/components/orrery/Polaris.tsx`, `src/logic/orrery-focus-logic.ts`, `src/db/orrery-action-read.ts`, `src/components/orrery/OrreryClusterPanel.tsx`, `src/components/orrery/orrery-overlay-logic.ts`, `src/components/orrery/OrreryContactsSheet.tsx`, `src/components/orrery/orrery-companion-logic.ts`, `src/components/orrery/OrreryFocusContext.tsx`, `src/db/__testkit__/sqlite-local-day.ts`, `src/logic/orrery-reorder-logic.ts`, `src/db/orrery-satellites-read.ts`, `src/components/orrery/orrery-satellite-context.ts`, `src/logic/orrery-satellite-logic.ts`, `src/components/orrery/SatelliteBody.tsx`, `src/stores/orrery-session-store.ts`, `src/logic/orrery-session-logic.ts`, `src/components/orrery/OrreryFeedback.tsx`, the named new test files, and `29-NATIVE-CHECKLIST.md`.

Named signatures for new artifacts — including `readOrrerySystemMembersCore`, `buildOrrerySystemWhere`, `readOrreryImpactInputsCore`, `readOrreryContactTargetValidation`, `openSqliteLocalDayFixture`, and `mergeVisibleRingOrder` — are NEW and therefore excluded from presence checking. Their proposed TypeScript signatures are also UNCHECKABLE under grep until implemented.

### Cross-artifact fact drift (advisory; excluded from counts)

- Deterministic phase status is `uncheckable`: `.planning/STATE.md:38` says `Ready to execute`; ROADMAP's table says `Planned`, outside the seam's recognized vocabulary. Authority is STATE. This is recorded as coverage, never treated as consistent or counted.
- ROADMAP ORRC-01 through ORRC-16 match the union of plan requirement references, and the five roadmap success criteria are not contradicted by plan truths.
- CONTEXT D-03 now correctly says backup format 4 already shipped and defers coordinated preference emission/versioning to Phase 36 (`29-CONTEXT.md:20`); D-08 now names the existing Phase 23 live hook (line 27); D-11 records the owner's excluded-sun ruling (line 30). No glossary contradiction remains.
- ADR-077's stale statement that `SegmentedControl` retires with its only consumer is advisory document drift because Dashboard now consumes it; plans correctly do not delete it. It is not counted.

## Cycle 2 Current Finding Dispositions

| Finding | Current disposition |
|---|---|
| Cycle-one HIGH: camera pan vs legacy reorder | Fully resolved in 29-01-01; excluded from current counts. |
| Cycle-one Gravity batch owner | Fully resolved in 29-04-01; excluded. |
| Cycle-one local-day test capability | Fully resolved in 29-09/12 and independently exercised by Claude; excluded. |
| Cycle-one full-scene per-tap validation | Fully resolved by the bounded 29-08 probe; new mutex-contention concern remains separately actionable. |
| Cycle-one excluded-sun satellites | Fully resolved by owner D-11 and Plans 03/08/10/12; excluded. |
| Cycle-one migration wave suggestion | Explicitly rejected with executable rationale in Plan 02; excluded. |
| Cycle-one shell edit / partial CHECK notes | Incorporated or informational; excluded. |
| Cycle-one ADR citation upkeep | Partially resolved: existing screen/body coverage is planned, but new authoritative files and ADR-027 traceability remain current findings. |
| Cycle-one native completion gate | Fully resolved as a planning concern; native evidence remains correctly pending implementation. |
| New mutex contention | Actionable MEDIUM. |
| New ADR-027 traceability | Actionable MEDIUM; owner authorization already exists in dossier §E and ORRC-03/15. |
| New-file ADR citations | Actionable LOW. |
| Missing 29-04-01 acceptance criterion | Actionable LOW. |
| Consecutive Group depth batch constraint | Actionable LOW as a preventive implementation constraint. |

## Cycle 1 — Preserved History

# Cross-AI Plan Review — Phase 29, Cycle 1

## Codex Review

# Summary

Phase 29 is well designed and substantially complete, but I recommend conditional approval after resolving one blocking verification issue and two implementation-contract gaps.

The plan set correctly covers ORRC-01–16, follows the dossier and applicable ADRs, preserves existing SQLite invariants, and sequences the work coherently across 12 dependent waves. The strongest portions are the guarded filtered reorder, explicit neutral handling for never-contacted contacts, one-frame render/hit architecture, persistence boundary, and race-aware lifecycle design.

No files were edited and no device commands were run. The required `graph:ask` queries were attempted for the governed Orrery, settings, relationships, navigation, and backup files, but every invocation failed before reading the graph because `tsx` could not open its IPC socket (`EPERM`). I therefore made no inference from graph absence and verified governance directly against the ADR bodies and source.

# Strengths

- The canonical-view transition accurately implements the ratified ADR reversal. The current code still owns two modes, a morph shared value, and endpoint-specific hit geometry ([OrreryScreen.tsx:121](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:121), [OrreryScreen.tsx:179](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:179), [OrreryScreen.tsx:403](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:403)). Plan 29-01 removes only that superseded behavior while preserving static timestamp placement and the clock lifecycle, matching ADR-077 exactly ([ADR-077:18](/home/bwales/projects/orbit-app/docs/decisions/ADR-077-single-canonical-orrery-with-a-constrained-inspection-camera.md:18), [29-01-PLAN.md:94](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-01-PLAN.md:94)).

- Never-contacted semantics are handled correctly. The existing default Orrery read deliberately requires `last_contact IS NOT NULL` ([orrery-read.ts:89](/home/bwales/projects/orbit-app/src/db/orrery-read.ts:89)); removing that predicate would let SQL’s final `ELSE 'stable'` fabricate health ([status.ts:53](/home/bwales/projects/orbit-app/src/db/status.ts:53), [status.ts:72](/home/bwales/projects/orbit-app/src/db/status.ts:72)). Plan 29-03 instead keeps the default reader unchanged and introduces explicit All Contacts/Not Contacted null-health branches ([29-03-PLAN.md:98](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:98)). That honors both the dossier amendment and ADR-011.

- The filtered reorder design is unusually thorough. The current writer checks uniqueness, complete contacted population, and one affected row per update in one transaction ([ring-seq-dao.ts:60](/home/bwales/projects/orbit-app/src/db/ring-seq-dao.ts:60)). Plan 29-09 retains those controls and additionally revalidates saved sun, complete order, System membership at the current SQLite day, and ID/UID fingerprints under the same lock before merging visible slots ([29-09-PLAN.md:88](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-09-PLAN.md:88)). This closes stale Favorites/category/snooze/midnight and numeric-ID reuse cases without widening neutral-body rank eligibility.

- Preference migration and backup boundaries are correct. The live schema head is 20 ([database.ts:55](/home/bwales/projects/orbit-app/src/db/database.ts:55)), and Plan 29-02 requires an execution-time head recheck before allocating head+1 ([29-02-PLAN.md:93](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-02-PLAN.md:93)). It adds durable settings and restore validation while preserving current format 4 and deliberate export omission ([29-02-PLAN.md:116](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-02-PLAN.md:116), [types.ts:14](/home/bwales/projects/orbit-app/src/backup/types.ts:14), [app-settings-dao.ts:519](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:519)). Camera and focus remain nonportable session state.

- The projected-frame architecture directly addresses the current correctness fault: rendering interpolates while hit testing reads a JS endpoint map ([OrreryScreen.tsx:314](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:314), [OrreryScreen.tsx:414](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:414)). Plans 29-01/04/05 consistently establish one interpolated frame for drawing, labels, depth, and interaction. Installed Skia supports `Group.zIndex`, and its native recorder preserves source order at equal depth ([Common.ts:92](/home/bwales/projects/orbit-app/node_modules/@shopify/react-native-skia/src/dom/types/Common.ts:92), [RNRecorder.h:55](/home/bwales/projects/orbit-app/node_modules/@shopify/react-native-skia/cpp/api/recorder/RNRecorder.h:55)).

- Reduced Motion and lifecycle planning is grounded in the actual implementation. The hook already exists, but a live event can currently be overwritten by a late initial seed ([use-reduced-motion.ts:61](/home/bwales/projects/orbit-app/src/theme/use-reduced-motion.ts:61)). Plan 29-11 specifically fixes that race, cancels active camera continuation, and unmounts the clock-owning canvas subtree rather than merely freezing its output ([29-11-PLAN.md:108](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-11-PLAN.md:108)).

# Concerns

## HIGH

- Native acceptance is described but is not actually a blocking completion gate.

  Plan 29-01 calls its native tracer prerequisite “before expansion,” but explicitly permits recording it as pending while the task’s `<done>` condition says the tracer passed ([29-01-PLAN.md:88](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-01-PLAN.md:88), [29-01-PLAN.md:89](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-01-PLAN.md:89)). Plan 29-12 is autonomous, directs the executor to mark native checks pending, and accepts creation of a pending checklist as done ([29-12-PLAN.md:13](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-12-PLAN.md:13), [29-12-PLAN.md:114](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-12-PLAN.md:114), [29-12-PLAN.md:118](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-12-PLAN.md:118)).

  Node tests cannot establish native Skia depth, gesture arbitration, TalkBack focus, live animation cancellation, or real navigation reachability. Those are central parts of ORRC-02/03/07/10/15/16, not optional polish.

  Action: make Phase 29 completion explicitly block on an owner-confirmed native checkpoint. If the device is unavailable, execution may finish the code and checklist, but phase verification should remain `AWAITING HUMAN VERIFICATION`, not complete. Either enforce the Plan 29-01 tracer before Wave 2 or remove the “before expansion” claim and make the final native gate unambiguously blocking.

## MEDIUM

- The satellite policy for a globally assigned contact sun excluded from the active System is an unsettled product decision.

  Plan 29-03 deliberately keeps such a sun visible and actionable outside membership ([29-03-PLAN.md:98](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:98), [29-03-PLAN.md:100](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:100)). Plan 29-10, however, limits satellite parents to current System members and includes only a “qualifying” member sun ([29-10-PLAN.md:30](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-10-PLAN.md:30), [29-10-PLAN.md:90](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-10-PLAN.md:90)). The dossier says satellites appear around their parent Orbit contact and does not settle this nonmember-sun corner ([phase dossier:434](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-08-orrery-camera-scale-exploration-dossier.md:434)).

  This determines visible product behavior, so it belongs to the owner. Ask whether a visible global contact sun retains its moons when the selected System excludes that contact. Then encode the decision and a test; do not decide it during implementation.

- The coherent snapshot promises a read-only, scalable Gravity seam, but the necessary reader changes are not owned concretely.

  `inReadSnapshot` exposes only `getFirstAsync` and `getAllAsync` and holds the global mutex for the entire read ([transaction.ts:38](/home/bwales/projects/orbit-app/src/db/transaction.ts:38), [transaction.ts:67](/home/bwales/projects/orbit-app/src/db/transaction.ts:67)). Existing settings/category/impact helpers accept full `SqlExecutor` ([app-settings-dao.ts:425](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:425), [contact-read.ts:49](/home/bwales/projects/orbit-app/src/db/contact-read.ts:49), [impact-read.ts:52](/home/bwales/projects/orbit-app/src/db/impact-read.ts:52)). More importantly, `getImpactInputs` reads one contact and its complete interaction history per call.

  Plans 29-03/04 say to adapt read-only signatures and collect impact inputs in the snapshot, but neither plan owns `src/db/impact-read.ts` or specifies a batched implementation ([29-03-PLAN.md:8](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:8), [29-03-PLAN.md:99](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:99), [29-04-PLAN.md:8](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-04-PLAN.md:8)). The natural implementation would be N contact queries while holding the shared mutex, delaying every app write for large All Contacts scenes. The research explicitly recommended extending the impact reader ([29-RESEARCH.md:308](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-RESEARCH.md:308)).

  Action: add a concrete batched `ReadOnlyExecutor` Gravity-input reader to Plan 29-03 or 29-04, include `src/db/impact-read.ts` in ownership/artifacts, and prohibit closing over the outer writable executor merely to satisfy existing function signatures.

## LOW

No additional actionable LOW concerns. Minor native tuning, exact gesture constants, large-System performance calibration, and final artwork are already explicitly deferred to the proper later phase.

# Suggestions

- Add an explicit phase status transition: automated completion → `AWAITING NATIVE ACCEPTANCE` → verified only after the checklist passes.
- Record the owner’s nonmember-sun satellite ruling in Phase 29 context or an amendment before execution reaches Plan 29-10.
- Define the batch Gravity-reader signature in Plan 29-03 so Plans 04, 08, and the companion list consume the same coherent data rather than independently rebuilding it.
- Keep the current one-plan-per-wave ordering. The repeated ownership of `OrreryScreen`, `OrreryWorld`, camera state, and gesture composition makes parallel execution unsafe despite the long schedule.

# Overall Risk Assessment

**Plan risk: MEDIUM, conditional approval. Execution risk: HIGH.**

The data-integrity and decision-governance portions are strong enough to proceed once the two contract gaps are resolved. The remaining execution risk comes from the breadth of the shared native interaction rewrite—Skia projection/depth, four competing gestures, accessibility overlays, transient navigation, and SQLite-backed live populations—rather than from missing requirement coverage.

The plan set should achieve ORRC-01–16 if implemented faithfully and if native acceptance becomes a real completion gate. As written, it can finish with essential native behavior still marked pending, so it does not yet guarantee achievement of every phase goal.

---

## Claude Review

I verified the plans against the source on disk. Here is the review.

---

# Phase 29 Plan Review — Orrery Camera, Scale & Exploration

## Summary

Twelve plans, one per sequential wave, covering ORRC-01–16. I read every plan in full and verified their load-bearing claims against the repository at `/home/bwales/projects/orbit-app`: the migration chain, the ring-order writer and every guard it holds, the transaction primitives, the relationships schema, the reduced-motion controller, the categories/sun/status reads, the Skia depth API, and the current `OrreryScreen`.

**The factual base is unusually accurate.** Every schema, API, and ADR claim I checked was correct, including the ones that correct stale upstream notes (migration head, backup format, reduced-motion existence, relationships existence). The governance handling is correct: ADR-077's partial supersession of ADR-048 is real and recorded on both documents, and the plans preserve rather than erode ADR-011, ADR-046, ADR-047, and ADR-062. **I found no decision reversal requiring owner escalation.**

The concerns below are gaps in sequencing, verification mechanism, and efficiency — not in product intent.

---

## Strengths

**The reorder guard analysis is correct and the eligibility boundary is honored, not quietly widened.** `rewriteRingSeq` (`src/db/ring-seq-dao.ts:66-121`) holds three guards — uniqueness, an exact COUNT match against the effective orbiting population, and a per-row scoped `UPDATE` asserting `changes === 1` — over `last_contact IS NOT NULL AND archived_at IS NULL AND tracking_enabled = 1`. Plan 29-09 preserves all three, adds expected-order/sun/ID-UID fingerprints and a lock-time membership recheck, and explicitly records that displaying a never-contacted body does **not** authorize widening its rank persistence, routing that extension to the owner instead. That is exactly the AGENTS.md §"Whose decision is it" boundary applied correctly under pressure.

**The composition-under-one-lock design respects the non-reentrancy rule.** `inWriteTransaction` and `inReadSnapshot` both wrap `withMutex`, which `src/db/transaction.ts:14-27` documents as non-reentrant with a permanent-hang failure mode. Plan 29-03 answers this by exporting `readOrrerySystemMembersCore(exec: ReadOnlyExecutor, …)` as a mutex-free, transaction-composable core that 29-09 calls on the already-locked executor. `ReadOnlyExecutor` is a real exported type (`src/db/transaction.ts:42`) and `SqlExecutor` satisfies it structurally, so this compiles as specified.

**D-05 is implemented as a widening, not a deletion.** `listOrbitingContacts` (`src/db/orrery-read.ts:96-98`) pins `last_contact IS NOT NULL`, and `STATUS_SQL` ends in a `'stable'` fallback, so stripping that predicate would silently render never-contacted people as healthy. Plan 29-03 keeps the default read intact, adds explicit All Contacts / Not Contacted paths, and uses a null-progress/null-status branch modeled on the existing `CARD_STATUS` nullable projection. It also reuses the real closed predicates (`FAVOURITES_WHERE`, `SNOOZED_WHERE`, `NOT_CONTACTED_WHERE` at `src/logic/dashboard-query-logic.ts:157-160`) without importing Dashboard store state.

**The reduced-motion seed race is real and correctly diagnosed.** In `createReducedMotionController` (`src/theme/use-reduced-motion.ts:73-92`) the listener is registered synchronously but the `isReduceMotionEnabled()` seed resolves later and calls `emit(value)` guarded only by `disposed` — so a live `true` event that fires before the seed resolves is overwritten by a stale `false`. Plan 29-11-02's event-generation guard fixes precisely this, and does so by extending ADR-085's hook rather than replacing it.

**Schema facts are current, not inherited.** `TARGET_VERSION = 20` with `migration020` last registered (`src/db/database.ts:56,58-79`), making 021 correct; `BACKUP_FORMAT_VERSION = 4` (`src/backup/types.ts:14`), correctly contradicting the older "Phase 36 v4 bump" wording. The optional-key-without-emission pattern 29-02-03 copies is the real one — `PORTABLE_SETTINGS_KEYS` already allowlists theme and dashboard keys (`src/backup/backup-schema.ts:159-172`) that `PortableSettingsSnapshot` declares optional and does not emit (`src/db/app-settings-dao.ts:214-231`).

**The native depth strategy is verified, not assumed.** `GroupProps` declares `zIndex?: number` (`node_modules/@shopify/react-native-skia/src/dom/types/Common.ts:92-94`) and the native recorder sorts sibling groups by it with a stable equal-value tie (`cpp/api/recorder/RNRecorder.h:45-65`). Plan 29-05's requirement that sun and contact billboards be *direct siblings* under one depth parent follows from that sibling-local sort — a subtlety that would have produced a sun that can never be occluded if missed.

**Category identity is UID-based.** `listCategories` returns only `id, name` (`src/db/contact-read.ts:49-54`), while the table carries a `uid` from migration 001. Plan 29-03 correctly notes the header omits UID and reads it directly, keeping System identity off both display names and device-local integer IDs.

---

## Concerns

### HIGH — 1. The legacy radial reorder gesture is never retired, and waves 1–8 leave it live against a widened population

`OrreryScreen.tsx:556-624` currently races `Gesture.Tap` against a `Gesture.Pan` whose `onEnd` calls `commitFromWorklet` → `commitRingSeq` (`:500-542`), which maps the current `orbiting` array to IDs, runs `computeRingReorder`, and calls `rewriteRingSeq`.

Plan 29-01's action removes "its mode toggle and endpoint hit refs" and adds "real one-finger pan" — but says nothing about the existing pan-reorder. Reorder is only rebuilt in **29-09, wave 9**. Two mechanisms break in the interval:

- **Gesture ownership.** From wave 1, one-finger drag is claimed by camera pan while the legacy reorder pan is still composed into the canvas gesture. Whichever wins, the other silently stops working or fires alongside it — and ORRC-10's whole point is that ordinary drag must pan, never reorder.
- **Guard failure once membership widens.** From wave 3, the member list becomes the System list, which for All Contacts includes never-contacted rows. If `commitRingSeq` still derives `orderedIds` from that list, Guard 2's COUNT (`last_contact IS NOT NULL …`) mismatches and Guard 3's scoped `UPDATE` returns `changes !== 1`. Every drag then throws and shows the legacy `Alert.alert("Couldn't reorder")` — for six waves.

No task action, acceptance criterion, verify command, or explicit deferral in any of the twelve plans addresses this. The guards mean data is safe; the user-facing regression window is the problem.

### MEDIUM — 2. The "controlled SQLite-clock test executor" prescribed in 29-09 and 29-12 cannot be built as specified

Both plans require exercising local-midnight membership transitions "through a controlled SQLite-clock executor over real SQL," and 29-09 correctly notes that JS fake timers cannot move SQLite's clock. But the time source is hardcoded inside the SQL itself — `date('now','localtime')` in `PROGRESS_SQL` (`src/db/status.ts:59`) and in `SNOOZED_WHERE` (`src/logic/dashboard-query-logic.ts:159-160`) — and the test adapter is a thin `DatabaseSync` wrapper (`src/db/__testkit__/node-sqlite.ts:29-56`) with no hook that could intercept it. No such executor exists, and none can be written without changing shipped SQL.

This matters because it is the acceptance gate for the phase's most dangerous write path. An executor handed an unbuildable mechanism will either invent a fake one or stall. The invariant itself is fine — re-running the predicates inside the lock *does* naturally evaluate at the current SQLite day.

**Fix:** replace the mechanism with fixture-relative time. Seed `snooze_until` and `last_contact` at offsets that straddle the boundary relative to the real `date('now','localtime')`, so the same row is Snoozed under one fixture and not under another. That proves the same predicate without a clock hook. Alternatively, thread an explicit `currentLocalDay` parameter through `readOrrerySystemMembersCore` — which also makes the core deterministic — but that touches shared status SQL and deserves a deliberate decision rather than an executor's improvisation.

### MEDIUM — 3. Per-member Gravity has no owned batched read, and runs inside the global write mutex

Plan 29-04-01 derives body mass via `computeContactGravity` over "canonical impact inputs collected inside the scene snapshot." The only existing entry point is `getImpactInputs` (`src/db/impact-read.ts:52`), which is strictly per-contact and returns **every interaction row** for that contact. Running it per member means N queries × full history, and the scene snapshot runs under `inReadSnapshot`, which acquires the same non-reentrant mutex every writer uses (`src/db/transaction.ts:76-89`) — so the whole thing blocks all app writes for its duration, on every Orrery focus, refresh, and System switch.

RESEARCH says "Prefer batched impact/relationship input reads to a query per body." PATTERNS says "Research's optional batched impact adapter likewise needs its own file scope if selected." **No plan's `files_modified` or `artifacts` list contains one.** The optimization is recommended twice and owned by nobody, so the default outcome is the per-body path.

At the owner's stated scale (tens of contacts, PROJECT.md §10) this will function. It is still the wrong shape to ship, and it is the kind of thing Phase 40 hardening will be asked to unpick.

### MEDIUM — 4. Per-tap validation re-reads the full System snapshot on the core tap→Profile path

Plan 29-08-01 requires that focus and Profile dispatch "obtain authoritative validation through an injected `readOrrerySystemSnapshot` call." That snapshot is the coherent read defined in 29-03: settings, sun header, category catalog, all members, plus impact inputs — under `inReadSnapshot`'s mutex and `BEGIN`.

Running that on every unambiguous tap contradicts the project's stated core value ("collapse the taps between 'you're overdue with X' and the message actually being sent," PROJECT.md §Core Value) and compounds concern 3, since the snapshot carries the Gravity reads with it. The staleness the plan is defending against is real and worth defending against — but a narrow bound query (does this contact ID still carry this UID, is it still live, is it still a member of this System, is it still the resolved sun) answers it at a fraction of the cost.

Note this is not a correctness objection: the validation contract in 29-08 is well specified, and the excluded-sun cases it enumerates are genuinely subtle and correctly handled.

### MEDIUM — 5. Twelve strictly-chained waves, at least one of them chained without a dependency

Every plan declares `depends_on` on its immediate predecessor, producing a fully serial 12-wave chain. COVERAGE justifies this as shared mutable files (`OrreryScreen.tsx`, `OrreryWorld.tsx`, `use-orrery-camera.ts`), which is fair for most of the chain.

It is not fair for 29-02. That plan owns migration 021, the app-settings DAO extension, the preferences store, and the portable allowlist — it shares only `OrreryScreen.tsx`, and only for a control it admits will be replaced in its own second task. Blocking the phase's single irreversible schema step behind a rendering tracer delays the one artifact that most benefits from landing early and being exercised across the remaining waves.

### LOW — 6. Plan 29-06 modifies shell-owned files

`files_modified` includes `src/navigation/RootNavigator.tsx` and `src/components/UniversalFab.tsx` — the app shell delivered under ADR-080. The plan is explicit and narrow ("Preserve universal capture routes, existing FAB position, tab height consumers and Back behavior") and the measurement seam genuinely cannot live anywhere else, since the FAB is mounted beside `RootNavigator` in a different coordinate space from the canvas. Recording it here so the shell edit is a noticed decision rather than an incidental diff.

### LOW — 7. No task maintains the ADR graph bridge

AGENTS.md §"The ADR bridge" states that graphify mints ADR nodes **only** from `ADR-NNN` tokens in JS/TS comments, and that `docs/decisions/adr-registry.ts` must be regenerated when ADRs change. This phase strips the ADR-048 morph behavior out of `OrbitBody.tsx` and `OrreryScreen.tsx` and replaces it with ADR-077 behavior, but no plan updates citation comments or runs `npm run gen:adr-registry`. Plan 29-12 updates `docs/systems/orrery.md` only. Result: code→ADR edges pointing at the superseded half of ADR-048 go stale, in a repo whose stated first-stop discovery tool is the graph.

### LOW — 8. `orrery_last_system` cannot be constrained by a CHECK, leaving the DAO as sole guard

29-02-01 specifies closed built-in tokens or `category:<UID>` with "a bounded nonempty UID payload," existence deliberately not enforced by FK. A SQL `CHECK` can cover the built-in enum but not the open-ended category form, so validation rests entirely on `validateAppSettingsPatch` and `updateAppSettingsCore`. The plan does route restore through the core (correctly — that is where hand-edited backup values arrive), so the coverage is there; it is worth stating explicitly in the migration that the column-level constraint is intentionally partial, so a later reader does not mistake the absent CHECK for an oversight.

---

## Suggestions

1. **Add a task action and acceptance criterion to 29-01** that removes the legacy radial-reorder `Gesture.Pan`, `commitRingSeq`, `bodiesShared`/`dragMetrics`, and the ghost-ring preview from `OrreryScreen.tsx` at the same time it introduces camera pan — with an explicit, user-visible statement that ring reorder is unavailable until 29-09. Removing it is safer than leaving it: a live legacy writer against a widening member list is exactly the class of bug the guards exist to catch loudly, and no user should meet that alert.

2. **Replace the clock-executor language in 29-09 and 29-12** with fixture-relative straddling of `date('now','localtime')`, or make `currentLocalDay` an explicit parameter of the shared membership core. Either is testable today; the currently specified mechanism is not.

3. **Give the batched impact read an owner.** Add `src/db/orrery-impact-read.ts` (or equivalent) to 29-04's `files_modified` and `artifacts`, returning per-member Gravity inputs in one bound query, and state that the per-body `getImpactInputs` path is not to be used from the scene loader.

4. **Narrow 29-08's per-tap validation** to a bound identity/membership/sun probe rather than the full coherent snapshot, and say so in the task action so an executor does not reach for `readOrrerySystemSnapshot` because it is the closest thing to hand.

5. **Move 29-02 to wave 1** alongside (or ahead of) the tracer, dropping its `depends_on`. Its only overlap with 29-01 is a control it replaces itself, and landing the migration first gives every later wave a real preference column to read.

6. **Add ADR citation upkeep to 29-12-02**: update `ADR-048`/`ADR-077` tokens in the touched Orrery source comments and run `npm run gen:adr-registry`, so the graph reflects the supersession the code just enacted.

---

## Risk Assessment

**Overall: MEDIUM.** These plans are materially better grounded than the artifacts they derive from — they correct three stale upstream claims, verify the installed Skia depth API rather than assuming it, and identify a genuine latent race in shipped reduced-motion code. The two areas that would ordinarily carry the most risk in this phase are the ones handled best.

*Data-layer risk: LOW.* The reorder path preserves every existing guard, adds four more, composes correctly under the single non-reentrant lock, and refuses to widen rank eligibility without the owner. The migration is additive, correctly numbered, and correctly withholds backup emission. The only data-layer weakness is a verification mechanism (concern 2), not an invariant.

*Product-decision risk: LOW.* No `[DECIDED]`/`[REJECTED]` item is reopened and no accepted ADR is reversed. The one behavior change that could look like a reversal — replacing `OrreryScreen`'s "render with defaults, no error UI" catch (`OrreryScreen.tsx:255-262`) with explicit failure copy — is covered by the owner-approved UI-SPEC of 2026-09-06 and does not touch the offline read-path rule it cites, which concerns network calls, not local SQL failures. **No escalation is required.**

*Integration and sequencing risk: MEDIUM.* Concern 1 is the one I would fix before execution starts, because it degrades a shipped feature for most of the phase and the fix costs a paragraph in 29-01. Concerns 3 and 4 are efficiency debts that will function at the owner's scale and then need unpicking in hardening.

*Verification risk: MEDIUM.* Automated coverage is strong for pure math, SQL, and controllers. The plans are commendably honest that native Skia depth, gesture arbitration, TalkBack, and all performance claims remain unproven and phone-only (D-10) — but that means a large share of ORRC-02, -03, -07, -09, -10, and -16 rests on a native checklist that does not yet have device time scheduled. Nothing in the plans overstates this; it is simply where the residual risk sits.

---

## Consensus Summary

Both source-grounded reviewers found the 12-plan sequence unusually thorough on decision governance, never-contacted segregation, filtered reorder integrity, backup boundaries, reduced-motion lifecycle, and the shared projected-frame design. Both independently identified the missing owned batch reader for Gravity inputs. Claude found one unresolved HIGH sequencing defect: Plan 29-01 introduces one-finger camera pan without explicitly retiring the existing radial-reorder pan, while the replacement reorder gesture does not arrive until Plan 29-09.

### Agreed Strengths

- The plans preserve the contacted-only default read while widening only named Systems for never-contacted contacts.
- The complete-order and filtered-member rank guards remain transactional and are expanded for stale sun, membership, local-day, and ID/UID changes.
- Migration 021 is conditional on an execution-time head check; current backup format 4 and deferred emission are stated correctly.
- One current projected frame governs drawing, depth, labels, and hit testing; native-only claims stay assigned to human verification.

### Agreed Concerns

- **HIGH — legacy radial reorder remains live when camera pan lands.** Plan 29-01 introduces one-finger camera pan but does not retire the current radial-reorder `Gesture.Pan`, `commitRingSeq`, or ghost preview; the deliberate stationary-hold replacement does not arrive until Plan 29-09. Plan 29-01 must remove or disable the legacy gesture and assert that ordinary drag pans without a rank write throughout the intermediate waves.
- **MEDIUM — Gravity batch reader has no plan owner.** Both reviewers found that the only current reader, `getImpactInputs`, runs per contact and reads full interaction history. Plans collect Gravity inputs inside the global mutex-held snapshot but do not modify or replace `src/db/impact-read.ts`. Plan 29-03 or 29-04 must own a batched `ReadOnlyExecutor` reader and prohibit per-member calls or closing over the outer writable executor.

### Divergent Views and Dispositions

- **Codex HIGH — native acceptance is not blocking:** discounted as already incorporated. Plan 29-12 line 117 explicitly requires the complete native checklist as its human check; `.planning/config.json` sets `human_verify_mode: end-of-phase`; the execution workflow persists outstanding human verification as pending UAT and advances only after canonical verification passes. Device evidence correctly remains pending before execution and phase completion remains gated afterward. The raw finding is retained above.
- **Codex MEDIUM — satellites of a globally visible contact sun excluded from the active System:** accepted as an owner-decision checkpoint. The dossier says satellites appear around their parent Orbit contact but does not settle whether this visible nonmember sun remains an eligible parent. Plan 29-03 keeps that sun visible/actionable while Plan 29-10 restricts satellite parents to System members plus a qualifying member sun. The plan must record the owner's choice.
- **Claude MEDIUM — controlled SQLite-clock executor cannot exist over the current adapter:** accepted. `date('now','localtime')` is embedded in production SQL and the node SQLite adapter has no clock interception seam. Plans 29-09 and 29-12 must use an executable fixture-relative boundary method or explicitly add an approved injectable day seam.
- **Claude MEDIUM — full coherent System snapshot on every tap:** accepted as actionable unless explicitly deferred with rationale. Plan 29-08 currently makes the latency-sensitive focus/Profile path reread settings, category catalog, members, and Gravity inputs under the global mutex. It should own a narrow identity/membership/sun validation query, or explicitly justify and defer that optimization.
- **Claude MEDIUM — move migration Plan 29-02 earlier:** rejected as advisory. The existing fully serial order is deliberate because `OrreryScreen.tsx` is shared across the tracer and preference wiring, and no release occurs between waves.
- **Claude LOW — shell files are touched:** informational. Plan 29-06 explicitly owns the narrow measurement edits and preserves shell behavior.
- **Claude LOW — ADR graph citation upkeep absent:** accepted. Since Phase 29 replaces the superseded ADR-048 behavior with ADR-077 behavior in source, Plan 29-12 should update source comment citations and regenerate the ADR registry as needed; graph rebuilding remains outside this plan unless separately required.
- **Claude LOW — partial SQL CHECK for open-ended category System IDs:** discounted as already incorporated. Plan 29-02 explicitly puts closed validation in both the public DAO and restore core and intentionally avoids an existence foreign key; the migration can document the partial database constraint during implementation.

## Verification Coverage

### Source grounding

- Effective authority: `grep` (deterministic `drift-guard authority`). Under this authority, signatures and runtime behavior beyond declarations are **UNCHECKABLE / INFO** unless established by full source reading; they were not silently treated as symbol verification.
- Verified existing declarations include: `inReadSnapshot` (`src/db/transaction.ts:74`), `listOrbitingContacts` (`src/db/orrery-read.ts:89`), `progressToAngle` (`src/logic/orrery-geometry-logic.ts:109`), `polarToXY` (`src/logic/orrery-geometry-logic.ts:118`), `shortestAngleDelta` (`src/logic/orrery-geometry-logic.ts:221`), `computeRingReorder` (`src/logic/ring-reorder-logic.ts:25`), `rewriteRingSeq` (`src/db/ring-seq-dao.ts:60`), `buildPopulationWhere` and the four shared predicates (`src/logic/dashboard-query-logic.ts:154`), `getPortableSettingsSnapshot` (`src/db/app-settings-dao.ts:519`), `updateAppSettings` (`src/db/app-settings-dao.ts:910`), `updateAppSettingsCore` (`src/db/app-settings-dao.ts:961`), `computeContactGravity` (`src/services/impact.ts:88`), `resolveRelationshipVisibility` (`src/db/relationships-read.ts:39`), `resolveSunOccupant` (`src/logic/sun-occupant-logic.ts:120`), `useReducedMotionShared` (`src/theme/use-reduced-motion.ts:103`), `runMigrations` (`src/db/migrations/runner.ts:32`), `TARGET_VERSION` (`src/db/database.ts:55`), and `BACKUP_FORMAT_VERSION` (`src/backup/types.ts:14`).
- All referenced existing project and dependency paths were checked on disk. Paths declared in each plan's `Artifacts this phase produces` and plan output SUMMARY/checklist paths were excluded as new artifacts. No existing path or declaration was MISSING or AMBIGUOUS.
- Signature compatibility, worklet/native behavior, SQLite time behavior, gesture arbitration, Skia depth, TalkBack, and device performance remain **UNCHECKABLE / INFO** under grep; the plans assign these to source tracing, tests, or native human checks. The unavailable controlled SQLite-clock mechanism is separately actionable above.
- Graph-first queries succeeded in the orchestrator environment. All relevant returned governance edges were **INFERRED**, including ADR-048's partial supersession by ADR-077; none was presented as a code assertion. The Codex lane's own sandbox could not open the Graphify `tsx` IPC socket and disclosed that limitation in its raw review.
- Preflight structural codebase drift was skipped with reason `no-structure-md`; this is recorded as skipped, not passed.

### Cross-artifact fact drift

- Deterministic phase-status comparison returned `uncheckable`: STATE says `Ready to execute`; ROADMAP says `Planned`, a status outside the seam's recognized vocabulary. Authority is STATE.md. This is coverage-only and excluded from convergence counts.
- CONTEXT D-08 says Reduced Motion does not exist in `src/`, while current source exports and consumes the Phase 23 live hook and Plan 29-11 extends it. The actual source and plans carry the current fact; CONTEXT contains the stale copy.
- CONTEXT D-03 says a backup v4 bump belongs to Phase 36, while current `BACKUP_FORMAT_VERSION` is already 4 and the plans correctly reserve coordinated later preference emission/versioning for Phase 36. This is advisory artifact drift, excluded from convergence counts.
- ROADMAP requirements ORRC-01 through ORRC-16 exactly match the union of plan requirement references. No contradictory success-criterion or glossary pair was found beyond the two stale CONTEXT facts above.

## Current Cycle Disposition

- Current unresolved HIGH: 1.
- Current actionable non-HIGH: 5.
- Owner decision required before replanning: whether a globally assigned contact sun that remains visible while excluded from the active System retains its relationship satellites.

## Replanning incorporation — 2026-09-07, after cycle 1

The raw reviews and cycle-1 counts above are preserved as historical feedback. The following records planner incorporation, not reviewer sign-off or convergence. Independent checking and the next cross-AI cycle remain separate.

| Current finding / suggestion | Executable disposition |
|---|---|
| HIGH legacy radial reorder competing with camera pan | 29-01-01 removes old recognizer/commit bridge/shared drag state/ghost preview at camera introduction and tests pan causes no rank writes. 29-09-02 restores final deliberate hold reorder. No release between waves. |
| MEDIUM Gravity reader unowned / per-member mutex work | New29-04-01 owns readOrreryImpactInputsCore, exact full-history parity, bounded query count, ro-only snapshot composition and its first rendered derived mass. Subsequent04 tasks expand that working path. |
| MEDIUM SQLite clock test capability not present | 29-09-01 owns new test-only openSqliteLocalDayFixture using per-connection DatabaseSync.function; only exact date('now','localtime') is intercepted, other date calls delegate to a second native SQLite connection. 29-12-01 reuses it for queued lock-time invalidation; production SQL/clock APIs remain unchanged. |
| MEDIUM per-tap full snapshot | 29-08-01 owns readOrreryContactTargetValidation with at most three SELECTs, bound target identity, shared membership predicates/current sun policy and no member catalog/Gravity reads. Group and companion actions consume the same probe. |
| MEDIUM excluded global sun satellites | Owner answered “I would say hide them for now”; recorded as dated D-11. Plans03/08/10/12 preserve sun contact actions but hide moons, targets and relationship context until parent membership qualifies. |
| MEDIUM move migration to wave1 | Rejected in29-02-01 executable action: screen ownership overlaps tracer and preference wiring; all waves are unreleased sequential implementation. |
| LOW shell-owned edits | Existing29-06-01 explicitly limits scope to measured obstacles and preserves shell routes, FAB location, Back and tab consumers; no extra shell redesign. |
| LOW ADR citations/registry | 29-12-02 owns comment-only ADR-077/partially-live ADR-048 upkeep and npm run gen:adr-registry; registry never manually edited. Graph refresh only via npm run graph:build if separately needed. |
| LOW partial setting CHECK | 29-02-01 now requires documenting SQL's partial constraint and complete grammar enforcement in both public/core validators. |
| Discounted native-gate HIGH | 29-01-01 explicitly separates automated tracer-before-expansion from native end-of-phase evidence. 29-12-02 preserves existing end-of-phase pending UAT/verification obligations without adding a new owner approval checkpoint. |
| Advisory baseline drift | CONTEXT D-03/D-08 corrected to existing backup format4 and Phase23 live motion hook; original consumption/backup ownership decisions remain. Historical RESEARCH quotes retain their dated meaning. |

Clock-mechanism feasibility was exercised locally with Node's installed SQLite: dayD→D+1 changed Snoozed/Needs Attention results while stored rows and stored-date conversion stayed identical; native modifier and NULL date delegation passed. Reproduce during this session with node /tmp/orbit-phase29-sqlite-day-probe.cjs. This proves the test mechanism only, not the unimplemented Phase29 guarded DAO behavior.
