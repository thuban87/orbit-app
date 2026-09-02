# Phase 12 — Group Interaction Logging — Planning Notes

- **Phase:** 12 Group Interaction Logging
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-12-group-interaction-logging-dossier.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**None route directly to Phase 12.** One owner resolution constrains it:

**E-05 (AI egress gate) — Group Notes are never sent to AI.** The per-interaction "Allow AI" toggle
(default OFF, Phases 11/13/16) has **no Group Notes equivalent**: a Group Note is never transmitted
and gets no toggle. Build the Group Note storage so that the AI context read cannot reach it, and
say so in the plan. Today AI context reads only `channel, quality, connected` from interactions and
never a note (`src/db/ai-context-read.ts:114-120`) — preserve that property for group rows.

## REPLAN items for plan-phase

### R-02 — Group Interaction Logging is entirely unbuilt schema, with three hard write-path constraints

- **Unbuilt / needed:** a Group Event parent, a nullable `group_event_id` on children, per-field
  override/inheritance state, and membership uniqueness (D-12-007/009/022/027).
- **Code facts (verified 2026-09-01):** there is **no group table and no linkage column** in
  migrations 001–014; `events` is **per-contact lifecycle only**
  (`src/db/events-dao.ts:39` — archive/restore/snooze/unsnooze).
- **Constraints for the plan (copy these into the plan verbatim):**
  1. **Every child row must be created, updated, and deleted through `insertInteractionCore` /
     `editTouchpointFull` / `deleteTouchpoint` + `recomputeLastContactCore`**
     (`src/db/recency-dao.ts:159-214,258-346`; ADR-010/024/071) **inside one transaction**. The write
     mutex is **non-reentrant**, so this means **composing the cores**, not calling the top-level
     writers in a loop. A bulk `INSERT INTO interactions` (as `benchmark.ts:119` does) leaves
     `last_contact` wrong for every participant.
  2. **Archived participants.** D-12-060 lets archived contacts be participants without restoring
     them. `insertInteractionCore` has **no archived guard** (no `archived_at` / `tracking_enabled`
     check in `recency-dao.ts`), so the write succeeds and the archived contact's `last_contact`
     advances. **Owner resolution (2026-09-01): this is allowed — adding an archived contact as a
     Group Event participant is permitted, the recency recompute is accepted, and there is no
     restore prompt.** Archived participants stay archived (D-12-060).
  3. **Event-level date edits fan out** to N `occurred_at` updates → **N recency recomputes**
     (D-12-107). `rejectFutureOccurredAt` applies to each. Plan the fan-out as one transaction and
     bound its cost.
- **Trip-wires:**
  - Any set-based write to `interactions` that bypasses the recency cores is a correctness bug, not
    an optimization.
  - Read **every writer** of `interactions` and `contacts.last_contact` before asserting an
    invariant; the knowledge graph cannot enumerate SQL writers (`CLAUDE.md`).

### R-03 — Tone and the Message/Call/In Person channel vocabulary

- **Unbuilt / needed:** D-12-028/029 (group-level Tone and Channel with per-participant override).
- **Resolved path (owner, 2026-09-01):** backfill quality `good`→**Positive**, `fine`→**Neutral**,
  `hard`→**Negative**; channel `text`/`email`→**Message**, `call`→**Call**,
  `in-person`→**In Person**, `other`/`unspecified` kept as legacy values.
- **Constraint:** Group Log **defaults to In Person** and is **exempt** from the ordinary Default
  Interaction Channel preference (D-12-136, D-GE-002) — Phase 15's settings copy must say so.

### R-04 — the optional interaction `duration` column is unbuilt

- D-12-018/024 need duration at the Group Event level with per-participant override state.
  No duration column exists (`011-contact-lifecycle-schema.ts:98-105`); see
  `phase-11-planning-notes.md` for the shared design.

### R-09 — Group Events must be serializable, with validation and orphan repair

- **Code facts (verified 2026-09-01):** backup format 3's entity set is at
  `src/backup/export-manifest.ts:45-81`; group events are absent.
- **Resolved path (owner, 2026-09-01):** **the format-4 bump is Phase 16's final plan**, sequenced
  after all other schema. Phase 12 does **not** bump the format — it must carry its
  **validation and orphan-repair rules (D-12-126/127)** into its own plan and hand the entity shape
  to Phase 16.
- **Constraint:** a restored child interaction whose parent Group Event is missing must have a
  defined outcome (repair or orphan-drop), decided here, executed by Phase 16's restore path.

## Migration / sequencing

- Implies **one migration**: the Group Event parent table, a **nullable `group_event_id`** on
  `interactions`, per-field override/inheritance state, and a membership-uniqueness constraint.
- Coordinate with Phase 11/13's `interactions` migration (Tone/channel, `duration`, per-interaction
  Allow-AI) — these touch the same table and must be a single strictly ordered sequence, not
  competing edits.
- **Number it head+1 at plan time**, verified against `src/db/migrations/` on disk. Head at audit
  time was 14. Migrations are forward-only, must not assume a starting state, and are irreversible
  in production.
- **Must land before:** Phase 16's format-4 backup bump.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15:** the ordinary Default Interaction Channel setting must carry copy stating that
  **Group Log is exempt and defaults In Person** (D-12-136, D-GE-002, D-RM-053/054, D-MH-011).
- **Phase 18:** Group Event surface reflow and large-participant-count QA (D-12-131).
- **Phase 19 / Your Week:** Group Events are one of Your Week's inputs — see
  `phase-19-your-week-placeholder.md`.
