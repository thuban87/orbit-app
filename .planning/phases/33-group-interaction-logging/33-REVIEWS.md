---
phase: 33
cycle: 4
reviewers: [claude, codex]
reviewed_at: 2026-09-12T09:05:00Z
plans_reviewed: [33-01-PLAN.md, 33-02-PLAN.md, 33-03-PLAN.md, 33-04-PLAN.md, 33-05-PLAN.md, 33-06-PLAN.md, 33-07-PLAN.md]
models:
  claude: "opus (read-only verification agent)"
  codex: "gpt-5.6-terra (reasoning=high)"
model_sources:
  claude: "subagent"
  codex: "banner"
cycle_summary:
  current_high: 2
  current_actionable: 3
---

# Cross-AI Plan Review — Phase 33: Group Interaction Logging (Cycle 4)

> Cycle 4 of the convergence loop. The 7 plans were revised (commit f198004) to resolve cycle-3's
> 5 actionable findings (cycle 3 had 0 HIGH). Both lanes re-verified FRESH against the live repo,
> and the orchestrator independently verified every load-bearing claim below against the code on
> disk (`src/db/migrations/001,025`, `database.ts` `TARGET_VERSION`, `recency-dao.ts`,
> `merge-dao.ts`, `transaction.ts`, `ai-context-read.ts`, `history-read.ts`,
> `InteractionDetail.tsx`, `ContactPicker.tsx`, and the 7 plans) rather than trusting reviewer
> summaries — per the repo "review the code, not the diff" mandate.
>
> The `--codex` lane ran directly (`codex exec`, read-only sandbox) at **gpt-5.6-terra,
> reasoning=high** (cycle 3 was reasoning=low). The `--claude` lane ran as a read-only Opus agent
> (the `claude -p` reviewer fails on a Write-permission gap on this host; owner-approved
> substitution); it independently re-verified findings against disk and **converged with codex**
> rather than raising divergent ones.

## Consensus Summary

**All five cycle-3 findings are genuinely RESOLVED** — both lanes agree and the orchestrator
verified each against source, not prose:

1. **Parent-existence guard (Plan 03) — RESOLVED.** `updateGroupEvent` fetches/asserts the parent
   as the FIRST statement in its sole transaction and rejects a missing parent WITHOUT a revision
   bump, with tests for event-deleted-before-save and empty-patch (33-03:25,162,170,177; threat
   T-33-27). Matches the loud-failure pattern at `recency-dao.ts:329` (`changes !== 1`).
2. **Channel nullability (Plan 03) — RESOLVED.** The patch types `channel?: { value: string }`
   (never null), grounded in `interactions.channel TEXT NOT NULL DEFAULT 'unspecified'`
   (`001-initial.ts:103`) and `EditTouchpointFullInput.channel: string` (`recency-dao.ts:97`)
   (33-03:26,161,170,181).
3. **Group-child Delete affordance (Plan 07) — RESOLVED.** Plan 07 documents the history Delete of
   a group child as intentionally the generic `deleteTouchpoint` per D-11 (33-07:44,191,201);
   `deleteTouchpoint` (`recency-dao.ts:371`) is id+contact-scoped with a `changes !== 1` guard —
   removes exactly that one child. Not rerouted through `deleteGroupChild`.
4. **Convert return contract (Plan 05) — RESOLVED.** `convertInteractionToGroupEvent` explicitly
   RETURNS the new parent's `groupEventId` in behavior/action/acceptance and the key_link
   (33-05:41,51,190,196,209); Plan 07 navigates on it (33-07:191).
5. **`tsc --noEmit` in DAO verifies — RESOLVED.** Present in Plan 03 (all 3 tasks: 33-03:138,173,210),
   Plan 04 (both tasks: 33-04:100,127), and Plan 05 (all 3 tasks: 33-05:138,168,206).

The data-correctness spine remains sound and **reverses no recorded ADR/HANDOFF/dossier decision**:
migration 026 = head+1 (`TARGET_VERSION = INTERACTION_HISTORY_SCHEMA_VERSION`, head `025` on disk);
the single-writer fan-out composes the `*Core` primitives; the non-reentrant-mutex deadlock is
designed out via `editTouchpointFullCore`; and the Group-Note AI-egress ban is structurally
preserved (`ai-context-read.ts:117` selects only `channel, quality, connected FROM interactions`,
never joins `group_events`, reads no note column).

**Residual this cycle: 2 HIGH + 3 actionable MEDIUM — all NEW, none in any PLAN.md yet.** The
stronger codex model (terra/high vs cycle-3's low) surfaced two data-integrity paths the earlier
lower-effort pass missed, both verified against disk. Neither is a regression from the cycle-3
fixes; both are pre-existing cross-subsystem gaps the plans never closed.

### Agreed Strengths (maintainer-verified)
- `updateGroupEvent`'s first-statement parent guard mirrors the loud-failure idiom at
  `recency-dao.ts:295-335`; a missing parent throws before the trailing `bumpDataRevisionCore`.
- The AI egress boundary is a structural non-action: `ai-context-read.ts:8-27,116-121` is a closed
  projection; Plan 01 forbids editing it and tests group-note unreachability under allow_ai 0 and 1.
- Core-composition design respects transaction non-reentrancy (`transaction.ts`); every fan-out
  uses `editTouchpointFullCore`, never the mutexed wrapper.
- Cross-stack route registration (GroupEventDetail/EditGroupEvent/EditParticipant in all three
  Profile-hosting stacks) and the three-flag schema (`ge_follow_channel/quality/duration` only) are
  intact and correct (Plans 01/02/06/07).

### Divergent Views
- None material. The Opus lane converged with codex on every finding; it added one incidental
  disk-verified fact (ContactPicker exposes only a single `excludeContactId?: number`), which the
  orchestrator promotes to actionable #3 below.

### Owner escalation (surface, do not auto-resolve)
- **Contact-merge × Group-Event collision semantics (part of HIGH-2).** When two contacts who are
  both participants of the SAME Group Event are merged, the partial `UNIQUE(group_event_id,
  contact_id)` cannot hold two children for one contact. The *engineering gap* (the merge silently
  breaks) is a plan actionable (below). But the *resolution outcome* — reject the merge with
  remediation copy, vs. reconcile the two children into one while preserving one-child-per-participant
  + recency + tombstones — changes user-visible data semantics and is an **owner-bucket** decision.
  Do not let an executor silently pick a destructive survivor. Flag to owner before the fixing plan
  executes.
- **A3 restore orphan-repair outcome (D-10).** Unchanged from cycle 3: Plan 05 holds this
  `owner_pending` with a recommended default (detach-to-standalone) + Phase-36 handoff. The plan's
  *handling* is clean; per the review charter this is **not** counted as an unresolved HIGH/actionable.
  Surfaced only so the owner decision is not lost.

---

## Current HIGH Concerns (2)

1. **[HIGH — NEW — codex + Opus, disk-verified] The participant-editor Save is not atomic across the
   field classes it exposes (Plan 06 Task 3 + Plan 03).**
   `EditParticipantScreen`/`ParticipantOverrideEditor` expose Channel, Tone, Duration, Direction,
   Connected, and the participant note in one form with one Save (33-06:34,36,57,184-185). Save is
   wired to THREE separate Plan-03 DAO ops — `setParticipantOverride`, `clearParticipantOverride`
   (follow-fields) and `setParticipantFields` (direction/connected/note) — and each op independently
   `inWriteTransaction`s and owns its own trailing `bumpDataRevisionCore` (33-03:199-207). There is
   NO aggregate participant-save DAO. If a user changes a follow-field AND a direct field in one Save
   and the second op fails, the first has already committed: the screen's own must-have "Save/fan-out
   failure keeps the form open with all input intact, **nothing committed**" (33-06:38) and D-08's
   "participant changes … commit completely or roll back completely — no partial visible state"
   (33-CONTEXT.md:27) are both false. **Plan change:** add a single `updateParticipant` /
   `saveParticipantEdits` DAO to Plan 03 that composes every selected field-class edit (override
   value+flag writes AND direct direction/connected/note writes) in ONE `inWriteTransaction` with ONE
   trailing bump; have Plan 06's editor invoke only that op; add a mid-save injected-failure rollback
   test proving neither field persists.

2. **[HIGH — NEW — codex + Opus, disk-verified] Migration 026's per-event participant UNIQUE index
   breaks the existing contact-merge writer (Plan 01 vs `merge-dao.ts`).**
   Migration 026 creates `CREATE UNIQUE INDEX idx_group_member_unique ON interactions(group_event_id,
   contact_id) WHERE group_event_id IS NOT NULL` (33-01:193). `mergeContacts` reparents interactions
   with a blanket set-based `UPDATE interactions SET contact_id = ? … WHERE contact_id = ?`
   (`merge-dao.ts:89` via the `reparent()` loop at `:180`), all inside one `inWriteTransaction`
   (`merge-dao.ts:98`). If both the survivor and the absorbed contact are children of the SAME Group
   Event, the reparent sets the absorbed child to a `(group_event_id, contact_id)` pair that already
   exists → partial-UNIQUE violation → the ENTIRE contact merge rolls back with a raw SQLite error.
   No Phase-33 plan reads or modifies `merge-dao.ts` (absent from Plan 01 and Plan 05 `files_modified`).
   Independently, the blanket UPDATE mutates a group child outside the recency-core path (D-05
   trip-wire). **Plan change:** add a group-aware merge task (Plan 01 or Plan 05) that reads
   `merge-dao.ts`, handles the collision deterministically, keeps the one-child-per-participant
   invariant + recency + tombstones, and tests both the collision and the no-collision reparent. The
   collision-resolution *outcome* is an owner decision (see Owner escalation) — the task must carry
   that as a blocking checkpoint, not a silent choice.

## Current Actionable Non-HIGH Concerns (3)

1. **[MEDIUM — NEW — codex] `convertInteractionToGroupEvent` is guarded only by the UI, not by its
   DAO contract (Plan 05 Task 3).**
   The op reads the interaction, inserts a parent, then `UPDATE interactions SET group_event_id=…
   WHERE id=? AND contact_id=?` (33-05:196) — it never requires the source row's `group_event_id IS
   NULL`. Plan 07 only offers convert for `!interaction.groupLinked` (33-07:190), so the UI guards it,
   but a stale/direct caller could convert an already-group-linked child, silently detaching it from
   its original event and minting a duplicate parent — inconsistent with the DAO-level membership
   discipline every other op in this phase enforces. **Plan change:** in Plan 05, require a
   transaction-local source read asserting `group_event_id IS NULL` (or add `AND group_event_id IS
   NULL` to the UPDATE and assert `changes === 1`) before inserting the parent; add a test that a
   group-linked source leaves no new parent and no changed link.

2. **[MEDIUM — NEW — codex] Group Log's child-UID contract is underspecified (Plan 06 Task 2).**
   `createGroupEvent` requires each participant to carry its own `uid` and the parent its own `uid`
   (33-01:194-196), and `interactions.uid` is `NOT NULL UNIQUE` (`001-initial.ts:98`). But Plan 06
   Task 2 says only to call `createGroupEvent` "with the selected participants (passing **a**
   freshly-minted `uid`)" — singular (33-06:153). Read literally, an executor could pass one shared
   uid (collides across children) or conflate the parent uid with a child uid. **Plan change:** make
   Plan 06 Task 2 explicit — mint one parent uid AND map every selected contact to a distinct
   `{ contactId, uid: newUid(), … }` child input before the call; back it with a unit-tested input
   builder or a two-participant integration seam.

3. **[MEDIUM — NEW — Opus] Adding participants to an existing event cannot exclude current members
   (Plan 07 Task 2 / Plan 02).**
   `ContactPicker`'s shared props carry only a single `excludeContactId?: number`
   (`ContactPicker.tsx:27,91-93`); Plan 02's multi arm adds `initialSelected?: number[]` but no
   set-exclusion (33-02:104). Plan 07's Detail "Add Participant" opens the multi-select picker →
   `addParticipant` (33-07:158) without excluding the event's current participant set. A user can
   re-select an already-present contact; `addParticipant` then throws on `idx_group_member_unique`
   (Plan 05), turning a UX papercut into a hard, rolled-back add. **Plan change:** extend the picker
   base to `excludeContactIds?: number[]` (or have the Add-Participant flow filter out current
   participants before calling `addParticipant`), and have Plan 07/06 pass the current participant set;
   add a test that an already-present contact is not offered.

---

## Codex Review (gpt-5.6-terra, reasoning=high)

### Summary
Cycle 4 genuinely resolves all five named cycle-3 findings; the main data spine is carefully
designed around the non-reentrant transaction mutex and the closed AI egress projection. Two
high-severity paths remain without an atomic/invariant-preserving implementation, plus two
create/convert contract holes. Risk: **HIGH** until incorporated.

### Cycle-3 finding disposition (codex)
1. RESOLVED — parent existence asserted first, missing-parent/no-bump test prescribed (33-03:161-170,176-182).
2. RESOLVED — `channel` constrained to `{ value: string }` vs the NOT NULL column (33-03:161,170-181; 001-initial.ts:96-109).
3. RESOLVED — Plan 07 documents the generic `deleteTouchpoint` path for group children as intentional D-11 (33-07:191,201).
4. RESOLVED — convert's `groupEventId` return is in behavior/action/acceptance + caller contract (33-05:190-196,208-210; 33-07:191).
5. RESOLVED — `npx tsc --noEmit` in Plan 03/04/05 DAO task verifies (33-03:172-173,209-210; 33-04:99-100,126-127; 33-05:137-138,167-168,205-206).

### HIGH — participant-editor save is not atomic across the fields the form exposes
Separate `setParticipantOverride`/`clearParticipantOverride`/`setParticipantFields` ops, each its
own transaction + bump (33-06:183-185; 33-03:207-210); a first-succeeds/second-fails save leaves a
partial commit, contradicting 33-06:38 and D-08 (33-CONTEXT.md:27). Add one transaction-owning
participant-save DAO; editor invokes only that; add a mid-save rollback test. *(HIGH-1.)*

### HIGH — migration UNIQUE breaks the existing contact-merge writer
`UNIQUE(group_event_id, contact_id)` (33-01:193) vs `mergeContacts`' set-based `UPDATE interactions
SET contact_id` (`merge-dao.ts:88-90,180`); both-in-same-event → whole merge rolls back. No plan
touches `merge-dao.ts`. Needs a group-aware merge task + tests; collision outcome is an owner
decision (reject vs reconcile) — do not silently pick a destructive survivor. *(HIGH-2.)*

### MEDIUM — conversion guarded only by the UI, not its DAO contract
`convertInteractionToGroupEvent` never requires source `group_event_id IS NULL` (33-05:190-196);
a stale caller could relink an already-linked child. Add the standalone-source assertion + zero-write
linked-child test. *(Actionable #1.)*

### MEDIUM — Group Log does not specify a distinct UID per fan-out child
DAO requires per-participant `uid` (33-01:194-196) and `interactions.uid` is NOT NULL UNIQUE
(001-initial.ts:97-103), but Group Log says "a freshly-minted `uid`" singular (33-06:152-153). Make
the screen mint one parent uid + a distinct child uid per contact. *(Actionable #2.)*

### Verified coverage (codex)
- The AI boundary stays structural: `ai-context-read.ts:116-121` projects only channel/quality/connected, never joins `group_events` (33-01:249-250 leaves it untouched).
- `deleteTouchpoint` delegates to the id+contact-scoped core (`recency-dao.ts:340-377`) — the group-child history Delete removes exactly one child (D-11-correct).
- `updateGroupEvent`'s parent guard matches the loud-failure style at `recency-dao.ts:295-335`.

## Claude Review (read-only Opus verification agent)

### Summary
Independently re-verified all five cycle-3 fixes against the code on disk — **all five genuinely
landed** (parent guard, channel `{value:string}`, generic-delete documentation, convert return
contract, DAO `tsc`). Traced the new-cycle concerns codex raised and **corroborated them against
source**: confirmed `merge-dao.ts:89,180` performs a set-based `UPDATE interactions SET contact_id`
inside one `inWriteTransaction` (`:98`) that collides with migration 026's partial UNIQUE, and that
neither Plan 01 nor Plan 05 touches `merge-dao.ts`; confirmed the participant editor drives multiple
separate Plan-03 transactions with no aggregate save; confirmed Plan 01 requires a distinct uid per
participant while Plan 06 says "a freshly-minted uid" (singular). Additional disk-verified fact:
`ContactPicker` exposes only a single `excludeContactId?: number` (`ContactPicker.tsx:27`), so the
add-to-existing-event flow cannot exclude the current participant set (actionable #3). No decision
reversal; the spine and egress ban are sound.

### Risk Assessment — MEDIUM-HIGH
Architecture and the cycle-3 repairs are sound and verified in the plans, but two unaddressed
cross-subsystem data-integrity paths (participant-save atomicity vs D-08; merge-UNIQUE collision)
must be incorporated before convergence. Nothing reverses a `[DECIDED]`/ADR/HANDOFF item; the only
owner escalations are the merge-collision *semantics* and the already-flagged A3 orphan-repair
deferral (handling confirmed clean).

---

*Review method: codex lane via `codex exec` (gpt-5.6-terra, reasoning=high, read-only repo access);
Claude lane via a read-only Opus verification agent (owner-approved; `claude -p` lane unavailable on
this host). The orchestrator verified every load-bearing claim against code on disk and git, per the
repo "review the code, not the diff" mandate — no subagent summary was reported as fact without
independent verification.*
