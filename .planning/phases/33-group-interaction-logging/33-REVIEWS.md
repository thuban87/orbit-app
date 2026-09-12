---
phase: 33
cycle: 3
reviewers: [claude, codex]
reviewed_at: 2026-09-12T08:15:00Z
plans_reviewed: [33-01-PLAN.md, 33-02-PLAN.md, 33-03-PLAN.md, 33-04-PLAN.md, 33-05-PLAN.md, 33-06-PLAN.md, 33-07-PLAN.md]
models:
  claude: "opus (read-only subagent)"
  codex: "gpt-5.6-sol (reasoning=low)"
model_sources:
  claude: "subagent"
  codex: "banner"
cycle_summary:
  current_high: 0
  current_actionable: 5
---

# Cross-AI Plan Review — Phase 33: Group Interaction Logging (Cycle 3)

> Cycle 3 of the convergence loop. The 7 plans were revised (commit 623e5b3) to resolve cycle-2's
> 5 HIGH + 9 actionable findings. Both lanes re-verified FRESH against the live repo, and the
> orchestrator independently verified every load-bearing claim below against the code on disk
> (`src/db/migrations/` 001/025, `database.ts`, `recency-dao.ts`, `transaction.ts`,
> `data-revision-dao.ts`, `mutex.ts`, `history-read.ts`, `ai-context-read.ts`, `purge-dao.ts`,
> `tombstones-dao.ts`, `InteractionDetail.tsx`, `navigation/types.ts`, the three tab stacks, and the
> phase dossier) rather than trusting the reviewers' summaries.
>
> The `--claude` lane ran as a read-only Opus subagent (the `claude -p` reviewer fails on a
> Write-permission gap on this host; owner-approved substitution). The `--codex` lane ran via the
> gsd-tools review-lane machinery at reasoning=low (cycle 2 used terra/high).

## Consensus Summary

**Every cycle-2 HIGH and actionable finding is genuinely RESOLVED** — both lanes agree and the
orchestrator verified each against source, not prose:

- **Cross-stack route registration (cycle-2 HIGH #1):** route TYPES `GroupEventDetail`/`EditGroupEvent`/`EditParticipant` are added to `DashboardStackParamList` + `OrreryStackParamList` + `SettingsStackParamList` (Plan 02), and the `Stack.Screen`s are registered in all three stacks (EditGroupEvent/EditParticipant in Plan 06; GroupEventDetail in Plan 07); `GroupLog` and the `GroupEvents` browse body stay Dashboard-only by design. This mirrors the existing `EditInteraction`/`ThingsToRemember`/`MemoryHistory` cross-stack pattern (`navigation/types.ts:195-215`) and the `RootStackParamList` type-intersection trap (`types.ts:246-249`) is correctly understood. Verified: all three stacks register `ContactProfileScreen` ("Profile") at DashboardStack.tsx:45 / OrreryStack.tsx:52 / SettingsStack.tsx:59.
- **Follow-flag schema conforms to the dossier (cycle-2 HIGH #2, irreversible migration):** exactly three flags `ge_follow_channel|quality|duration`; `group_events` has NO direction/connected column and there is NO `ge_follow_direction`/`ge_follow_connected`. Direction/Connected are participant-editable child fields with no event-level value (dossier §D/§E/§G/§L). This is enforcement of the recorded decision, **not a reversal** — no CONTEXT D-01…D-11 item requires event-level direction/connected.
- **`editTouchpointFullCore` cannot persist `ge_follow_*` (cycle-2 HIGH #3):** Plan 01 extracts the non-mutexed core that writes only ordinary columns; Plan 03/05 persist every flag change via an explicit scoped `UPDATE interactions SET ge_follow_<field>=? WHERE id=? AND contact_id=? AND group_event_id=?` in the SAME transaction, asserting `changes===1`.
- **Single-transaction `updateGroupEvent` + Group-Note write path (cycle-2 HIGH #4/#5):** one `inWriteTransaction` applies date + shared patch + groupNote with one trailing `bumpDataRevisionCore`; the per-field ops map distinguishes omit from `{value:null}`; Group Note updates `group_events.group_note` only (no child fan-out).
- **DAO group-membership scoping (cycle-2 MED):** every override/clear/field-set/detach requires `groupEventId` and scopes by `AND group_event_id=?` with `changes===1`.
- **purge-dao exhaustive-Record compile break (cycle-2 MED):** Plan 01 Task 2 adds `PURGE_CHILDREN.group_event = null` and `npx tsc --noEmit` to its verify (verified: `purge-dao.ts:79-94` is indeed an exhaustive `Record<TombstoneEntityType,…>` literal that would TS2741-break).

The data-correctness spine (migration 026 = head+1, confirmed `TARGET_VERSION=25`/`migration025` head on disk; single-writer fan-out composing the `*Core` primitives; non-reentrant-mutex deadlock designed out via `editTouchpointFullCore`; Group-Note AI-egress ban structurally preserved — `ai-context-read.ts` never joins `group_events` and reads no note column) is sound and **reverses no recorded ADR/HANDOFF/dossier decision.**

**Residual this cycle: 0 HIGH, 5 actionable (3 MEDIUM + 2 LOW).** The two lanes found *different*,
complementary gaps (no overlap) — all verified against disk, all new this cycle, none yet in any
PLAN.md. The plan set is very close to converged; the residuals are localized write-contract and
verify-gate refinements, not structural problems.

### Agreed Strengths (maintainer-verified)
- The `editTouchpointFullCore` extraction correctly avoids the permanent hang that nesting the mutexed `editTouchpointFull` inside a fan-out `inWriteTransaction` would cause (`transaction.ts:49`, `recency-dao.ts:281-337`, `mutex.ts`).
- Group-Note egress ban is structural, not procedural: `ai-context-read.ts` reads only `channel/quality/connected` aggregates and no note column; keeping `group_events` out of it is sufficient and test-guarded (Plan 01 forbids editing the file and tests the absence under allow_ai 0 and 1).
- The two InteractionDetail mis-wires Plan 07 claims to fix are real on disk: `onPress={onEdit}` for "View Group Event" (InteractionDetail.tsx:178) and the no-op `onEditGroup` placeholder (InteractionDetail.tsx:215-218).
- Migration 026 is additive/forward-only and never rewrites `interactions.note`; the partial `UNIQUE(group_event_id, contact_id) WHERE group_event_id IS NOT NULL` correctly excludes standalone (NULL) rows from the index entirely.

### Divergent Views
- **Codex labeled its delete-path finding HIGH; the orchestrator downgrades it to MEDIUM.** Not a factual dispute — the fact (history Delete of a group child routes through the generic `deleteTouchpoint`, not `deleteGroupChild`) is verified true. But that path removes *exactly that one child* by `id + contact_id` with a `changes===1` guard, which is precisely what D-11 mandates ("Deleting one child removes only that participant's record"); there is no data corruption and no cross-event contamination (membership scoping matters for UPDATEs that could cross groups, not for an id-scoped delete). So it is a completeness/clarity gap in Plan 07, not a HIGH correctness bug.

### Owner escalation (surface, do not auto-resolve)
- **A3 restore orphan-repair outcome (D-10).** Plan 05 holds this `owner_pending` with a recommended default of detach-to-standalone and a handoff to Phase 36. Per the review charter and the plan-checker, this is a correctly-deferred owner-bucket decision, **not** an execution blocker for the phase goal and **not** counted as an unresolved HIGH/actionable. Codex re-raised it (its MEDIUM #3) asking for a blocking checkpoint before `33-BACKUP-HANDOFF.md` is finalized; the orchestrator confirms the plan's *handling* of the deferral is clean. Included here only so the owner decision is not lost.

---

## Current HIGH Concerns

None. All five cycle-2 HIGHs are resolved and verified against source; no new HIGH was raised this
cycle that survives code-grounded verification.

## Current Actionable Non-HIGH Concerns (5)

1. **[MEDIUM — NEW — codex] `updateGroupEvent` has no parent-existence / affected-row assertion (Plan 03).**
   The prescribed sequence runs optional `UPDATE group_events … WHERE id=?` statements + child fan-outs
   but never fetches/asserts the parent or requires `changes===1` on the parent update. If the event is
   deleted between form-load and save, the op completes with zero affected rows, bumps the data revision,
   and reports success — contradicting the plan's own atomic-rollback / "failed Save leaves the form open"
   semantics (D-08) and diverging from the loud-failure pattern at `recency-dao.ts:295-335`. Verified: the
   `changes===1` assertions in Plan 03 cover only the child-scoped override/clear/field-set ops, never the
   parent UPDATE. **Plan change:** require `updateGroupEvent` to fetch/assert the parent inside its sole
   transaction (assert one parent-row mutation, or a guarded SELECT) and reject a missing parent WITHOUT a
   revision bump; add a test for an event deleted before save and an empty patch.

2. **[MEDIUM — NEW — claude] `updateGroupEvent` patch types `channel` as unsettable, but `interactions.channel` is NOT NULL (Plan 03).**
   `interactions.channel TEXT NOT NULL DEFAULT 'unspecified'` (migration `001-initial.ts:103`) and
   `EditTouchpointFullInput.channel: string` (recency-dao.ts:96) — whereas direction/quality/duration are
   nullable. Plan 03 defines the patch as `channel?: { value: string | null }` (33-03:25,163) and asserts
   the must-have truth "an event with a shared value unset fans out NULL/unset to following children without
   error" (33-03:30); for `channel` that is false — fanning a null channel to a following child via
   `editTouchpointFullCore` fails `tsc` or violates NOT NULL at runtime (full rollback surfaced only as a
   generic error). Tell: acceptance criteria test the null-unset path for quality/duration only (33-03:172),
   never channel. **Plan change:** constrain the patch to `channel?: { value: string }` (channel is never
   truly unset — it defaults "In Person"), or coerce a null event channel to `'unspecified'` before the
   child write; add a DAO test that channel survives the fan-out and channel-null is rejected/coerced. (This
   is a fan-out/type fix; `group_events.channel` staying nullable is fine — no migration-026 change.)

3. **[MEDIUM — NEW — codex, downgraded from HIGH] Plan 07 is silent on the group-child Delete affordance (Plan 07).**
   Plan 07 rewires InteractionDetail's Edit/View/Convert callbacks but leaves the existing Delete button on
   the generic `deleteTouchpoint(contactId, interactionId)` path (recency-dao.ts:359), so a group-linked
   child deleted from Contact History does not go through Plan 05's `deleteGroupChild` membership-scoped DAO.
   The generic path is **D-11-correct** (removes only that child, tombstones it, recomputes recency; no
   corruption), so this is not a HIGH. **Plan change (clarification):** Plan 07 should explicitly state the
   intended group-child Delete path — either route it through `deleteGroupChild(groupEventId,…)` for a
   uniform membership guarantee (with a test that a mismatched event id rolls back and that deleting the last
   child leaves a valid zero-participant parent), or document that the generic per-child path is intentional
   on the history surface per D-11 — so the gap is not re-litigated.

4. **[LOW — NEW — claude] `convertInteractionToGroupEvent` return contract is undocumented, but Plan 07 navigates on it (Plan 05).**
   Plan 07 calls `convertInteractionToGroupEvent(…)` then `navigation.navigate("GroupEventDetail", { groupEventId })`
   (33-07:187), but Plan 05's signature `(exec, { interactionId, contactId, title, uid, now })` and action
   body (33-05:191) never state it returns the new parent's `groupEventId` (unlike `createGroupEvent`, which
   Plan 01 documents as returning one). **Plan change:** make returning the new `groupEventId` (or the new
   parent row) an explicit part of Plan 05's `convertInteractionToGroupEvent` contract.

5. **[LOW — NEW — claude] DAO plans omit `tsc --noEmit` from per-task verify (Plans 03, 04, 05).**
   Their `<verify>` blocks run `npx vitest … && npm run check:colors` only (33-03:132/166/201,
   33-04:97/124, 33-05:133/163/201); Plan 01 Task 2 and the UI plans (02/06/07) do run `tsc`. A type-level
   DAO regression (e.g. the channel `string|null` mismatch in #2) would then surface only in a later
   whole-suite/UI `tsc` run, not at the DAO task boundary. **Plan change:** add `&& npx tsc --noEmit` to the
   verify blocks of Plan 03 Tasks 2/3 and Plan 05 Tasks 1-3 (and Plan 04) for a tighter loop.

---

## Claude Review (read-only Opus subagent)

### Summary
Strong, unusually disciplined plan set. Every cycle-2 fix verified against the actual code on disk — all
six specified claims genuinely landed: cross-stack route registration (types in all three Profile-hosting
param lists per Plan 02, screens registered in Dashboard/Orrery/Settings per Plans 06/07, `GroupLog`
correctly Dashboard-only); follow-flag set exactly `ge_follow_channel/quality/duration` with no
direction/connected flag (dossier §D/§E); `updateGroupEvent` a single atomic transaction; DAO mutations
scoped by `group_event_id` with `changes===1`; migration `026 = head+1` (confirmed `TARGET_VERSION=25`,
`migration025` head), additive/forward-only; and `tsc --noEmit` in every UI-plan verify. The write path
composes the non-mutexed `*Core` primitives (incl. the newly extracted `editTouchpointFullCore`) to avoid
the non-reentrant-mutex deadlock, and the Group-Note egress ban is structurally preserved. One genuine new
data-layer inconsistency (MEDIUM, channel nullability), plus two LOWs. No decision reversal.

### Strengths
- Non-reentrant-mutex deadlock correctly designed out (`recency-dao.ts:281-337`, `transaction.ts`); every fan-out composes `editTouchpointFullCore`, never the mutexed wrapper.
- Group-Note egress ban is structural: `readInteractionAggregates` selects only `channel, quality, connected` (`ai-context-read.ts:117-120`), never `group_events`/a note column.
- `history-read.ts` "inert seam" claim is accurate — current `groupLinked: isGroupLinked({})` hard-false (:174), `SELECT_INTERACTIONS` omits `group_event_id` (:139); Plan 01 Task 3 activates it for local presentation only.
- The two InteractionDetail mis-wire bugs Plan 07 fixes are real (:178 `onPress={onEdit}`; :215-218 no-op `onEditGroup`; `onEditIndividual` → EditInteraction, redirected to EditParticipant).
- Backup linkage handoff correct: serializes durable `groupEventUid` via JOIN (mirroring `c.uid AS contactUid`, export-manifest.ts:52).
- Membership scoping + tombstone-UID-from-fetched-row consistently applied (Plans 03/05).

### Concerns
- **[MEDIUM][NEW]** `updateGroupEvent` treats `channel` as nullable/unsettable, but `interactions.channel` is NOT NULL (migration 001:103; `EditTouchpointFullInput.channel: string`, recency-dao.ts:96). The "unset fans out NULL without error" invariant is false for channel; acceptance criteria test only quality/duration null-unset. Constrain the patch to `channel?: { value: string }` or coerce null→'unspecified'. Plan/fan-out fix, not a migration change.
- **[LOW][NEW]** `convertInteractionToGroupEvent`'s return is unspecified (33-05:184-191) yet Plan 07 navigates with `groupEventId` (33-07:187). Document the return.
- **[LOW][NEW]** DAO plans 03/05 omit `tsc --noEmit` from per-task verify; add it for a tighter loop (esp. given the channel type issue).
- **[INFORMATIONAL — not a Phase-33 defect]** Pre-existing backup gap: `export-manifest.ts:52` omits `duration`/`allow_ai`; Plan 05 correctly identifies and hands it to Phase 36.

### Risk Assessment — LOW
Architecture sound; every high-severity cycle-2 fix verifiably present in code, not just prose. Write path
respects the single-writer recency spine and non-reentrant mutex; egress ban structural; migration
additive/forward-only at the correct version; cross-stack routing complete and mirrors a verified existing
pattern. The one MEDIUM is a latent contract/constraint mismatch on channel — unlikely reachable through the
built UI (channel is a required selector defaulting "In Person") and cannot corrupt data (worst case: a
build-time `tsc` failure or a silently-ignored unset) — but contradicts a stated invariant and should be
fixed before Plan 03 executes. Nothing reverses a `[DECIDED]`/ADR/HANDOFF item; the only owner escalation is
the already-flagged A3 orphan-repair deferral (confirmed handled cleanly, not broken).

---

## Codex Review (gpt-5.6-sol, reasoning=low)

### HIGH — group-child deletion from Contact History bypasses the planned group-scoped DAO
Plan 05 makes `deleteGroupChild` require/enforce `groupEventId`, but Plan 07 does not route the existing
**Delete** action in `InteractionDetail` through it — it only changes group edit/view callbacks. A
group-linked child opened from Contact History still follows the generic delete path:
`InteractionDetail.tsx:102-114` calls `deleteTouchpoint` with only `contactId`/`interactionId`;
`recency-dao.ts:340-367` selects/deletes by `id`+`contact_id` with no `group_event_id` predicate. Amend
Plan 07 so a group-linked detail passes its `groupEventId` to `deleteGroupChild` (retaining the ordinary
path only for standalone interactions), with a test that a mismatched event id rolls back and that deleting
the last child leaves the parent valid.

> **Orchestrator disposition:** verified true, **downgraded to MEDIUM** — the generic path removes exactly
> that one child (D-11-correct: "deleting one child removes only that participant's record"); no corruption,
> no cross-event risk for an id-scoped delete. Tracked as actionable #3 (a Plan 07 clarification).

### MEDIUM — `updateGroupEvent` has no required parent-existence / affected-row assertion
The Plan 03 contract opens one transaction but performs only optional `UPDATE group_events … WHERE id=?`
statements + child fan-outs; it does not fetch/assert the parent or require `changes===1`. An event deleted
between form-load and save lets an update with no affected rows complete and bump the revision while
reporting success — conflicting with the claimed rollback/form-preservation semantics and with the
loud-failure pattern at `recency-dao.ts:295-335`. Require `updateGroupEvent` to fetch/assert the parent
inside its sole transaction before any fan-out, reject a missing parent without a revision bump, and cover
an event deleted before save + an empty patch. *(Actionable #1.)*

### MEDIUM — backup orphan outcome (A3 / D-10) remains explicitly undecided
Plan 05 labels A3 "OWNER-PENDING" with only a recommended detach-to-standalone outcome; D-10 requires a
*decided* repair-or-drop rule this phase; the dossier gives only a derived preference
(`…phase-12-…dossier.md:406-410`). Resolve A3 before approving Plan 05, then make the result normative in
`33-BACKUP-HANDOFF.md` and Phase-36 restore tests.

> **Orchestrator disposition:** correctly-deferred owner-bucket decision; the plan's *handling* is clean
> (flagged `owner_pending` with a recommended default + Phase-36 handoff). Per the review charter, **not**
> counted as an unresolved HIGH/actionable. Surfaced under "Owner escalation" above.

### Verified coverage (codex)
- ContactProfile hosts are Dashboard/Orrery/Settings (DashboardStack.tsx:45, OrreryStack.tsx:52, SettingsStack.tsx:59); Plans 02/06/07 add the new history-reachable route types + registrations to all three — no route-registration finding.
- Schema follows the dossier: event-owned Channel/Tone/Duration only; exactly `ge_follow_channel/quality/duration`; no direction/connected event columns or flags.
- Plan 03 specifies one `updateGroupEvent` transaction (date + shared + Group Note) with core-based fan-out, avoiding the non-reentrant-transaction trap (`transaction.ts:12-23`).
- Non-graph-visible exceptional writers identified: restore upserts interactions (`restore-apply.ts:190-201`), purge deletes interactions (`purge-dao.ts:79-84`), canonical recency write recomputes `last_contact` (`recency-dao.ts:174-190`); the group fan-out composes the canonical cores rather than a bulk write.

---

*Review method: codex lane via gsd-tools review-lane machinery (reasoning=low, repo read access); Claude
lane via read-only Opus subagent (owner-approved; `claude -p` lane unavailable on this host). Orchestrator
verified every load-bearing claim against code on disk and git, per the repo "review the code, not the
diff" mandate — no subagent summary was reported as fact without verification.*
