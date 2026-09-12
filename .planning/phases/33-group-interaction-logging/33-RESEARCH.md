# Phase 33: Group Interaction Logging - Research

**Researched:** 2026-09-11
**Domain:** On-device SQLite data modelling (parent/child fan-out), transactional composition through the single-writer recency spine, live inheritance/override semantics, backup/restore entity shape, React Native surface wiring onto dormant Phase-32 seams.
**Confidence:** HIGH (schema, atomic composition, AI-egress boundary, migration number all verified on disk); MEDIUM (exact override-state storage shape — dossier leaves it `[DERIVED]`/discretion).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

> The dossier (`docs/dossier/milestone-2/phase-12-group-interaction-logging-dossier.md`) and its planning-notes sibling are GROUND TRUTH, above CONTEXT.md. `[DECIDED]`/`[REJECTED]` items are settled; reversing one is an owner decision — stop and ask, never "fix" it.

### Locked Decisions
- **D-01:** Read the phase dossier IN FULL before planning. Its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. `[DECIDED]`/`[REJECTED]` items are settled; reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision.
- **D-02:** Read the phase planning-notes file as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time. Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.
- **D-04:** A **Group Note is never transmitted to AI**, under any participant's Allow AI state (amended, ADR-078). Build Group Note storage so the AI context read *cannot reach it*: AI context today reads only `channel, quality, connected` and never a note — preserve that property for group rows. Only a participant's own interaction note is ever eligible, gated by that child Interaction's per-interaction **Allow AI** toggle, default **OFF** (authored Phase 34, defaults owned Phase 36). Routing a Group Note through that toggle reverses an owner decision — stop and ask.
- **D-05:** Every child row must be created, updated, and deleted through `insertInteractionCore` / `editTouchpointFull` / `deleteTouchpoint` + `recomputeLastContactCore` inside **one transaction**, composing the cores — the write mutex is non-reentrant, so never a bulk INSERT. **Trip-wire:** any set-based write to `interactions` that bypasses the recency cores is a correctness bug, not an optimization. Read every writer of `interactions` and `contacts.last_contact` before asserting an invariant.
- **D-06:** The Group Event parent never counts as an additional interaction in history, Status, Gravity, Intensity, or Heatmap; each participant receives exactly one ordinary child Interaction. A zero-participant event is valid and creates no children.
- **D-07:** Archived contacts may be participants: `insertInteractionCore` has no archived guard, so their `last_contact` advances — **owner-accepted**, no restore prompt, they stay archived. Do not add a guard that reverses this.
- **D-08:** Event-level date edits fan out to N `occurred_at` updates and N recency recomputes, each subject to `rejectFutureOccurredAt`. Plan it as one transaction and bound the cost. Saves/updates/participant changes/dissolve/delete commit completely or roll back completely — no partial visible state; a failed Save leaves the form open with user input intact.
- **D-09:** Group Log defaults Channel to **In Person**, Tone unset, Duration unset, and is **exempt** from the ordinary Default Interaction Channel preference. The shared Tone/channel vocabulary migration is owned jointly with Phases 32/34 as one strictly ordered `interactions` sequence.
- **D-10:** Group Events must be serializable with validation and orphan repair. This phase **carries the validation/orphan-repair rules and hands over the entity shape**; the format-4 bump is Phase 36's final plan. A restored child interaction whose parent Group Event is missing must have a **decided outcome** (repair or orphan-drop) — decided here, executed by Phase 36's restore path.
- **D-11:** Editing a group-linked Interaction always asks Edit individual interaction vs Edit Group Event — never a hybrid implicit-scope editor. Deleting one child removes only that participant's record. Removing a saved participant prompts Delete interaction / Keep as individual interaction / Cancel; "Keep as individual" preserves resolved values and participant note and never copies the Group Note in. Converting an ordinary Interaction into a Group Event preserves its identity/UID.

### Claude's Discretion
- Everything the dossier marks `[DERIVED]`, plus open implementation details that do not touch a `[DECIDED]` item, an ADR, or a HANDOFF.md entry. (This explicitly includes the *storage shape* of per-field override/inheritance state — see Architecture Patterns.)

### Deferred Ideas (OUT OF SCOPE)
Per dossier "Explicitly Deferred": planned/future Group Events, in-app social calendar, Google Calendar integration; Group Event pin/favorite/archive/trash lifecycle; host/owner or other participant roles; Group Event or aggregate social-life analytics; user-facing restore/orphan-repair tools; the Mission Control Dashboard concept or any bottom-nav restructure; affected-participant `N of M` counts while editing shared defaults; arbitrary participant cap; rich event attachments/media.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRP-01 | Create Group Event: required title + date/time, participants optional, zero-participant valid | New `group_events` table (title NOT NULL, occurred_at NOT NULL); zero children when no participants — Architecture §Schema, §Atomic Fan-Out |
| GRP-02 | Each participant → exactly one canonical child Interaction; parent never counts anywhere | Child = ordinary `interactions` row with nullable `group_event_id`; parent lives in a separate table read by NO metric consumer; heatmap/status/AI already read `interactions` only — verified inert seam in `buckets.ts`, `history-read.ts`, `status.ts` |
| GRP-03 | Shared Channel/Tone/Duration at event level, live inheritance; Group Log defaults In Person / Tone unset / Duration unset, exempt from Channel-default pref | Shared values on `group_events`; materialized-value + per-field follow-flag model (§Inheritance); defaults are app-level constants |
| GRP-04 | Per-participant override of Channel/Tone/Duration/Direction/Connected; clear via "Follow event…"; date/time + title never overridable | Per-field follow flags on the child row; `editTouchpointFull` rewrites resolved value; title/occurred_at not exposed in participant editor |
| GRP-05 | One shared Group Note owned by event, distinct from participant note; never transmitted to AI | `group_events.group_note`; `ai-context-read.ts` never reads that table (verified line-cited) — structural ban |
| GRP-06 | Add/remove participants via shared multi-select picker (no cap); post-save add inherits current shared values stamped at event date/time; remove → Delete/Keep-as-individual/Cancel | Extend `ContactPicker` to multi-select; add = `insertInteractionCore` with event's current resolved values + occurred_at; three-way remove (§Remove-Participant) |
| GRP-07 | Convert ordinary Interaction → Group Event without losing identity/UID; values seed shared defaults | In-place `UPDATE interactions SET group_event_id=…` — no delete/recreate (§Conversion) |
| GRP-08 | Group Event Detail presentation-first (participant cards → child Interaction Detail); Edit Group Event separate | New `GroupEventDetail` + `EditGroupEvent` routes; participant cards → existing `EditInteraction`/`InteractionDetail` |
| GRP-09 | Lean reverse-chronological browse page searchable by title + participant, reachable from Dashboard header + overflow | Replace `GroupEventsScreen` placeholder; header/overflow entries already routed (SHELL-12/DASHC-02/08) |
| GRP-10 | Dissolve (children survive standalone, materialized) vs Delete Group Event & Interactions (permanent), each confirmed; deleting one child affects only that participant | §Dissolve vs Delete transactions; child delete = `deleteInteractionCore` |
| GRP-11 | All fan-out mutations atomic (complete or fully rolled back, form state preserved); every child write through canonical recency writers | Single `inWriteTransaction` composing `*Core` primitives (§Atomic Fan-Out); trip-wire enforced |
| GRP-12 | Historical/backdated through now supported; future-dated rejected | `rejectFutureOccurredAt` on event date and every fan-out `occurred_at` write |
| GRP-13 | Group Events, child links, shared values, Group Note, override state survive backup/restore without flattening | New backup entity + `group_event` tombstone + orphan-repair rule (decided here, executed Phase 36) — §Backup |
</phase_requirements>

---

## Summary

Phase 33 is a **data-layer phase with an activation layer of UI**. The hard part is the schema and the transactional fan-out; the UI is almost entirely reuse of primitives shipped in Phases 22–32 (verified in the UI-SPEC and on disk). Phase 32 deliberately planted **inert seams** — `isGroupLinked()`, `buildGroupContext()`, `GroupScopePrompt.tsx`, the `GroupEventsScreen` placeholder, and the `GroupLog { participantIds?: number[] }` route — that hard-resolve to false/coming-soon *because no `group_event_id` column exists yet*. This phase adds that column (plus a parent table) and makes the seams live. `[VERIFIED: src/db/history-read.ts:104-105, src/components/history/interaction-detail-logic.ts:146-159, src/components/history/GroupScopePrompt.tsx:13-16, src/navigation/types.ts:46-51]`

The single load-bearing correctness rule (D-05, ADR-010/024/071) is that **`contacts.last_contact` has exactly one writer** and every interaction insert/edit/delete recomputes it as `MAX(occurred_at)` over the contact's current rows. `insertInteractionCore` / `recomputeLastContactCore` are the non-mutexed composition primitives; the shared write mutex is **non-reentrant** (nesting `inWriteTransaction` is a permanent hang). Every group fan-out therefore enters the mutex exactly once and composes the `*Core` functions in a loop — never a bulk `INSERT`. `createContactFull` is the exact exemplar to copy. `[VERIFIED: src/db/recency-dao.ts:159-191,446-460; src/db/transaction.ts:11-29; src/db/contacts-dao.ts:116-199]`

The Group Note AI-egress ban (D-04/GRP-05) is preserved **structurally, for free**, provided the Group Note lives on the new parent table and nothing adds that table to `ai-context-read.ts` — which today reads only `name` + category + `channel/quality/connected` aggregates + opted-in fuel/memories/custom values, and **never a note column**. `[VERIFIED: src/db/ai-context-read.ts:108-152]`

**Primary recommendation:** Add migration **026** (`group_events` table + nullable `interactions.group_event_id` + per-field follow-flags + `UNIQUE(group_event_id, contact_id)`), store **resolved values materialized on the child row** (existing consumers stay untouched) with **explicit per-field follow flags** driving live inheritance via fan-out `editTouchpointFull`, and route 100% of child writes through the recency cores inside one `inWriteTransaction`. Do NOT bump the backup format (Phase 36 owns that) but DO define the entity shape, a `group_event` tombstone, and the orphan-repair rule.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Group Event persistence & fan-out | Database / DAO (`src/db/`) | — | New table + child linkage; all mutation atomic through the recency spine |
| Live inheritance resolution | Database / DAO | Service (pure logic module) | Follow-flag + materialized value; a pure `.ts` resolver is node-testable (the `.tsx` cannot load under vitest) |
| Group Note AI-egress ban | Database / DAO (`ai-context-read.ts` boundary) | — | Ban is a *non-action*: never join `group_events` into the egress projection |
| Group Log / Edit / Detail / browse UI | Screens (`src/screens/`) + components (`src/components/`) | — | Reuse `EditInteractionScreen`, `TouchpointRefineForm`, `ContactPicker`, `Sheet`, `ConfirmDialog` |
| Routing / FAB / Dashboard entry | Navigation (`src/navigation/`) | — | `GroupLog`/`GroupEvents` routes exist as placeholders; add `GroupEventDetail`/`EditGroupEvent` |
| Backup/restore entity shape | Database (backup layer) | — | Shape + tombstone + orphan rule defined here; serialization executed Phase 36 |

---

## Standard Stack

**No external packages are introduced by this phase.** Everything is in-repo. This is deliberate and correct for a local-first, offline, on-device-SQLite app (CLAUDE.md, HANDOFF.md §3). Do not add a dependency.

### Core (in-repo modules the plan builds on)
| Module | Path | Purpose | Why standard |
|--------|------|---------|--------------|
| Recency cores | `src/db/recency-dao.ts` | `insertInteractionCore`, `recomputeLastContactCore`, `editTouchpointFull`, `deleteInteractionCore`, `deleteTouchpoint` | The ONLY sanctioned interaction write path (ADR-010/024/071, D-05) `[VERIFIED: recency-dao.ts:238-378,446-460]` |
| Transaction primitive | `src/db/transaction.ts` | `inWriteTransaction` (mutexed BEGIN/COMMIT/ROLLBACK) | The one shared, non-reentrant write boundary `[VERIFIED: transaction.ts:49-64]` |
| Compose exemplar | `src/db/contacts-dao.ts` | `createContactFull` / `createContactFullCore` | Canonical "enter mutex once, call `*Core` only" pattern `[VERIFIED: contacts-dao.ts:116-199]` |
| Future-date guard | `src/db/log-guards.ts` | `rejectFutureOccurredAt` | GRP-12 rejection, applied before any transaction opens `[VERIFIED: recency-dao.ts:52,249-253]` |
| Tombstone core | `src/db/tombstones-dao.ts` | `insertTombstoneCore` | Delete → tombstone for backup-merge; add a `group_event` entity type `[VERIFIED: recency-dao.ts:53,353-357]` |
| Data-revision bump | `src/db/data-revision-dao.ts` | `bumpDataRevisionCore` | Every mutation bumps it (drives backup-nudge / cache invalidation) `[VERIFIED: recency-dao.ts:55,262]` |
| Group seams (dormant) | `history-read.ts`, `interaction-detail-logic.ts`, `GroupScopePrompt.tsx` | `isGroupLinked`, `buildGroupContext` | Activate by supplying a real `groupEventId` `[VERIFIED: history-read.ts:104-105; interaction-detail-logic.ts:146-159]` |

### Supporting (UI reuse — verified in UI-SPEC, confirmed on disk)
| Component | Path | Reuse |
|-----------|------|-------|
| `ContactPicker` | `src/components/ContactPicker.tsx` | **Currently single-select** (`onSelect: (contactId: number) => void`). Extend to multi-select — do NOT fork `[VERIFIED: ContactPicker.tsx:22-30,100-106]` |
| `EditInteractionScreen` / `TouchpointRefineForm` | `src/screens/`, `src/components/` | Group Log form + participant override editor field controls |
| `GroupEventsScreen` | `src/screens/GroupEventsScreen.tsx` | Replace the "Coming soon" placeholder `[VERIFIED: GroupEventsScreen.tsx:8-26]` |
| `GroupScopePrompt` | `src/components/history/GroupScopePrompt.tsx` | Wire `onEditGroup` to the real Edit Group Event route |
| `Sheet` / `ConfirmDialog` / `Button` / `AppText` | `src/components/ui/` | Focused workspace, destructive confirmations, three-way remove prompt |

### Alternatives Considered
| Instead of | Could Use | Tradeoff / why rejected |
|------------|-----------|-------------------------|
| Materialized child value + follow flags | Resolve shared values at read via `COALESCE(child.f, event.f)` | REJECTED: every existing consumer of `interactions.channel/quality/duration/direction/connected` (`ai-context-read`, `history-read`, `status`, intensity) would have to become group-aware — enormous blast radius, breaks "children are ordinary interactions." Dossier §D `[DERIVED]` explicitly says child *retains resolved canonical values*. |
| Extend `insertInteractionCore` with optional `groupEventId`+flags | Follow-up `UPDATE interactions` inside the same txn | Extending the core keeps 100% of writes through one primitive (D-05); a follow-up UPDATE is a second write path. Prefer extending the core (additive, `?`-bound, defaults NULL). |
| FK `ON DELETE CASCADE` for delete-with-interactions | Explicit per-child `deleteInteractionCore` loop | REJECTED cascade: it bypasses the recency recompute + tombstone write — the D-05 trip-wire. Delete children explicitly through the core; keep the FK `ON DELETE SET NULL` only as an orphan safety net. |

**Installation:** none.

---

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** All work is in-repo TypeScript against `expo-sqlite` (already present) and existing UI primitives.

---

## Architecture Patterns

### System Architecture Diagram

```text
                    ┌─────────────────────────────────────────┐
  FAB "Group Log" ──▶│  Group Log form  (reuses TouchpointRefine │
  Dashboard grid 2+ ─▶│   field controls + multi-select picker)  │
  Convert (overflow) ▶└───────────────┬──────────────────────────┘
                                       │ Save  (one inWriteTransaction)
                                       ▼
         ┌─────────────────────────────────────────────────────────┐
         │  GROUP EVENT DAO  (new — src/db/group-events-dao.ts)      │
         │  enters shared write mutex EXACTLY ONCE, composes *Core:  │
         │                                                            │
         │  INSERT group_events (parent — NOT an interaction)         │
         │  for each participant:                                     │
         │     insertInteractionCore(child, group_event_id, flags=1)  │◀── never bulk INSERT
         │     recomputeLastContactCore(contactId)                    │◀── the single last_contact writer
         │  bumpDataRevisionCore                                       │
         └───────────────┬───────────────────────────┬───────────────┘
                         │                             │
             group_events (parent)          interactions (child rows, ordinary)
             title/date/shared vals/note    group_event_id + per-field follow flags
                         │                             │
                         │                             ▼
                         │            EXISTING consumers read children ONLY:
                         │            status.ts · history-read · buckets(heatmap)
                         │            ai-context-read (channel/quality/connected)
                         ▼
             AI egress projection NEVER joins group_events  ──▶ Group Note can't leak (D-04)
```

### Component Responsibilities
| File (new unless noted) | Responsibility |
|-------------------------|----------------|
| `src/db/migrations/026-group-events-schema.ts` | The one additive migration (version 26) |
| `src/db/group-events-dao.ts` | All group mutations, composing recency `*Core`s in one `inWriteTransaction` |
| `src/db/group-events-read.ts` | Browse list, detail read, participant resolution (pure reads, no txn) |
| `src/logic/group-inheritance.ts` (pure) | Resolve inherited-vs-override display + compute fan-out target set (node-testable) |
| `src/screens/GroupEventsScreen.tsx` (replace placeholder) | Reverse-chron browse + title/participant search |
| `src/screens/GroupLogScreen.tsx` + `EditGroupEventScreen.tsx` | Create/edit focused forms |
| `src/screens/GroupEventDetailScreen.tsx` | Presentation-first detail + participant cards |
| `src/db/ai-context-read.ts` (existing — DO NOT extend to read group_events) | Egress ban preserved by omission |

### Recommended Migration 026 (schema)

`[VERIFIED: interactions table shape from src/db/migrations/001-initial.ts:97-113; migration025 columns from 025-interaction-history-schema.ts:44-72]`

Verbatim current `interactions` columns (migration 001 + 025): `id, uid, contact_id, occurred_at, recorded_at, channel, direction, connected, quality, note, source, modified_at, duration, allow_ai`. Migration 026 adds `group_event_id` + follow flags.

```sql
-- Migration 026 — version 26 (VERIFIED head+1: TARGET_VERSION = 25).
CREATE TABLE group_events (
  id          INTEGER PRIMARY KEY,
  uid         TEXT NOT NULL UNIQUE,          -- backup merge key (every entity has one)
  title       TEXT NOT NULL,                 -- required (dossier §C)
  occurred_at TEXT NOT NULL,                 -- local wall-clock 'YYYY-MM-DD HH:MM:SS'
  channel     TEXT,                          -- shared default; app seeds 'In Person'
  quality     TEXT,                          -- shared Tone; NULL default (unset)
  duration    INTEGER,                       -- shared duration seconds; NULL default
  group_note  TEXT,                          -- NEVER read by ai-context-read (D-04)
  created_at  TEXT NOT NULL,
  modified_at TEXT NOT NULL
);

ALTER TABLE interactions ADD COLUMN group_event_id INTEGER
  REFERENCES group_events(id) ON DELETE SET NULL;   -- safety net only; code deletes children explicitly

-- Per-field live-inheritance flags (NULL for non-group rows; 1 = follows event, 0 = overridden).
ALTER TABLE interactions ADD COLUMN ge_follow_channel   INTEGER;
ALTER TABLE interactions ADD COLUMN ge_follow_quality   INTEGER;
ALTER TABLE interactions ADD COLUMN ge_follow_duration  INTEGER;
ALTER TABLE interactions ADD COLUMN ge_follow_direction INTEGER;
ALTER TABLE interactions ADD COLUMN ge_follow_connected INTEGER;

-- Membership uniqueness: a contact appears at most once per event (dossier §E).
-- SQLite treats NULLs as distinct, so standalone interactions (group_event_id NULL)
-- are unconstrained; only real (event, contact) pairs are deduped. [VERIFIED: SQLite NULL-distinct semantics]
CREATE UNIQUE INDEX idx_group_member_unique
  ON interactions (group_event_id, contact_id)
  WHERE group_event_id IS NOT NULL;   -- partial index is the clean way to scope it
```

**Migration discipline (verified conventions):** additive `ALTER TABLE ... ADD COLUMN` + `CREATE`, no rebuild, no DROP, no `note` rewrite; forward-only, must not assume a starting state; irreversible on unreachable devices. Register `migration026` in the `MIGRATIONS` array in `database.ts` and set `TARGET_VERSION = GROUP_EVENTS_SCHEMA_VERSION` (26). `[VERIFIED: database.ts:63-92; 001-initial migration additive pattern]`

### Pattern 1: Atomic fan-out — enter the mutex once, compose `*Core`s (GRP-11, D-05)

**What:** Every multi-row group mutation is one `inWriteTransaction` that calls only the non-mutexed `*Core` primitives in a loop. **When:** create, add participant, event date/shared-value edit, dissolve, delete, convert. **Why:** the shared mutex is non-reentrant — a nested `inWriteTransaction` is a permanent hang; a bulk `INSERT INTO interactions` leaves `last_contact` wrong for every participant.

```typescript
// Source: pattern mirrors src/db/contacts-dao.ts:152,160-199 (createContactFull)
//         + src/db/recency-dao.ts:446-460 (*Core exports)
export function createGroupEvent(exec: SqlExecutor, input: CreateGroupInput) {
  // GRP-12: reject a future event date BEFORE opening any transaction.
  try { rejectFutureOccurredAt(input.occurredAt, input.now); }
  catch (err) { return Promise.reject(err); }

  return inWriteTransaction(exec, async () => {           // enter mutex EXACTLY once
    const parent = await exec.runAsync(
      `INSERT INTO group_events (uid,title,occurred_at,channel,quality,duration,group_note,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [input.uid, input.title, input.occurredAt, input.channel ?? "In Person",
       input.quality ?? null, input.duration ?? null, input.groupNote ?? null, input.now, input.now],
    );
    const groupEventId = parent.lastInsertRowId;

    for (const p of input.participants) {                 // NOT a bulk INSERT (D-05 trip-wire)
      await insertInteractionCore(exec, p.contactId, input.now, {
        uid: p.uid,
        occurredAt: input.occurredAt,                      // child stamp = event date/time (dossier §M)
        channel: input.channel ?? "In Person",             // resolved shared value, materialized on child
        quality: input.quality ?? null,
        duration: input.duration ?? null,
        // groupEventId + ge_follow_* flags: extend insertInteractionCore to accept them (all ?-bound)
      });
      await recomputeLastContactCore(exec, p.contactId, input.now);  // the single last_contact writer
    }
    await bumpDataRevisionCore(exec);
    return { groupEventId };
  });
}
```

### Pattern 2: Live inheritance — materialized value + follow flag (GRP-03/04)

**What:** The child row always holds the **resolved** value in its ordinary column (`channel/quality/duration/direction/connected`); a sibling `ge_follow_<field>` flag records whether that value follows the event. **Editing a shared event value fans out** an `editTouchpointFull` to every child whose flag for that field is `1`, rewriting the resolved value. **Overriding** sets the flag to `0`. **"Follow event tone"** sets the flag back to `1` and rewrites the resolved value from the current event value. **Why not resolve-at-read:** existing consumers read the resolved columns directly and must stay group-unaware.

```typescript
// Fan-out on a shared Tone change: rewrite only children still following.
return inWriteTransaction(exec, async () => {
  await exec.runAsync(`UPDATE group_events SET quality=?, modified_at=? WHERE id=?`,
                      [newTone, now, groupEventId]);
  const following = await exec.getAllAsync<ChildRow>(
    `SELECT id, contact_id, occurred_at, channel, direction, connected, quality, note, duration, allow_ai
       FROM interactions WHERE group_event_id=? AND ge_follow_quality=1`, [groupEventId]);
  for (const c of following) {
    await editTouchpointFull(...) // supply ALL editable columns from c, with quality=newTone
    // editTouchpointFull recomputes recency (a no-op MAX for a tone change) — correct + required by D-05
  }
  await bumpDataRevisionCore(exec);
});
```

Note: `editTouchpointFull` **requires every editable column** (it SETs each unconditionally) and re-applies `rejectFutureOccurredAt`, so read the child row first and pass its current values with only the changed field overwritten. `[VERIFIED: recency-dao.ts:89-109,281-337]`

### Pattern 3: Three-way Remove Participant (GRP-06, D-11, dossier §N/§O)

- **Delete interaction** → `deleteInteractionCore(child)` inside one txn (tombstone + recency recompute). `[VERIFIED: recency-dao.ts:340-368]`
- **Keep as individual** → `UPDATE interactions SET group_event_id=NULL, ge_follow_*=NULL, modified_at=? WHERE id=?` in one txn + `bumpDataRevisionCore`. Values already materialized, so nothing recomputes; **do NOT copy `group_note`** into the participant note (dossier §O). Recency unchanged.
- **Cancel** → no-op.

### Pattern 4: Dissolve vs Delete (GRP-10, dossier §X)

- **Dissolve:** for all children `UPDATE ... SET group_event_id=NULL, ge_follow_*=NULL` (detach, values already materialized), then `DELETE FROM group_events WHERE id=?` + write a `group_event` tombstone. One txn. Do not copy Group Note.
- **Delete Group Event & Interactions:** for each child `deleteInteractionCore` (tombstone + recompute each), then `DELETE FROM group_events` + `group_event` tombstone. One txn.

### Pattern 5: Convert ordinary Interaction → Group Event (GRP-07, dossier §P)

In-place, preserving the interaction's `id`/`uid`: create the `group_events` parent seeding shared values from the interaction's current values, then `UPDATE interactions SET group_event_id=<new>, ge_follow_channel=1, ge_follow_quality=1, ... WHERE id=<existing>`. Never delete/recreate. One txn.

### Anti-Patterns to Avoid
- **Bulk `INSERT INTO interactions` for participants** — leaves `last_contact` wrong for every participant (the exact `benchmark.ts:119` mistake called out in planning-notes R-02). `[VERIFIED: planning-notes R-02 constraint 1]`
- **Nesting `inWriteTransaction`** (e.g. calling `deleteTouchpoint` inside a group txn) — permanent hang; call `deleteInteractionCore` instead. `[VERIFIED: transaction.ts:11-29; recency-dao.ts:340-378]`
- **Relying on FK `ON DELETE CASCADE`** to remove children — bypasses recency recompute + tombstone.
- **Adding `group_events` to `ai-context-read.ts`** — reverses D-04/ADR-078. Stop and ask.
- **Adding an archived-contact guard** to block archived participants — reverses D-07. Stop and ask.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recompute `last_contact` after a group write | A per-row `SET last_contact = occurred_at` | `recomputeLastContactCore` | Single-writer invariant; last-write-wins corrupts recency on non-newest rows `[VERIFIED: recency-dao.ts:159-191]` |
| Interaction insert with all columns | A new `INSERT INTO interactions` in the group DAO | `insertInteractionCore` (extended for `group_event_id`+flags) | Keeps the one write path; `?`-bound; matches column DEFAULTs `[VERIFIED: recency-dao.ts:193-236]` |
| Delete a child + backup safety | Raw `DELETE FROM interactions` | `deleteInteractionCore` | Writes the tombstone so restore-merge doesn't resurrect it `[VERIFIED: recency-dao.ts:340-368]` |
| Write transaction | expo `withTransactionAsync` / `withExclusiveTransactionAsync` | `inWriteTransaction` | expo variants issue a DEFERRED BEGIN capturing unrelated writes + mask errors on rollback `[VERIFIED: transaction.ts:24-28]` |
| Future-date rejection | Ad-hoc date comparison | `rejectFutureOccurredAt` | Shared guard + locked UI copy; already unit-tested `[VERIFIED: recency-dao.ts:52,249-253]` |
| Multi-select contact picking | A new picker | Extend `ContactPicker` to multi-select | UI-SPEC + dossier §K: one shared picker foundation, no fork |
| Local date/time formatting | `toISOString().split('T')[0]` | `formatLocalDate()` / `localDateTime()` | UTC evening off-by-one bug (fixed once already) `[VERIFIED: database.ts:96-106; CLAUDE.md]` |

**Key insight:** The single-writer recency spine is the most fragile invariant in the codebase; the graph cannot enumerate SQL writers, so read every writer of `interactions`/`contacts.last_contact` manually (CLAUDE.md). The safest group DAO is one that adds *zero* new raw writes to `interactions` beyond the `group_event_id`/flag columns.

---

## Common Pitfalls

### Pitfall 1: Bulk-inserting participant children
**What goes wrong:** `last_contact` never advances for participants (or advances to the wrong row). **Why:** the recompute is a correlated `MAX` per contact; a set INSERT skips it. **How to avoid:** loop `insertInteractionCore` + `recomputeLastContactCore` per participant. **Warning signs:** a group DAO containing `INSERT INTO interactions ... VALUES (?),(?),...` or `SELECT ... FROM` inserts.

### Pitfall 2: Fan-out cost on large events (no cap)
**What goes wrong:** an event date edit on a 40-participant event issues 40 `editTouchpointFull` (each recomputes recency). **Why:** no product cap (dossier §K). **How to avoid:** keep it one transaction (D-08 "bound the cost"); accept the per-row cost — it is correct, and realistic sets are small (HANDOFF §10: tens of contacts). The UI-SPEC flags large-set reflow as a device backstop, not a correctness gate.

### Pitfall 3: `editTouchpointFull` needs every column
**What goes wrong:** a shared-value fan-out that passes only the changed field nulls out the child's other fields. **Why:** `editTouchpointFull` SETs each editable column unconditionally (no COALESCE). **How to avoid:** read the child row first, overwrite only the changed field, pass the whole record. `[VERIFIED: recency-dao.ts:281-337]`

### Pitfall 4: Group Note leaking to AI via a future read
**What goes wrong:** a well-meaning "include recent group context" join adds `group_events` to the egress read. **Why:** convenience. **How to avoid:** treat `ai-context-read.ts`'s closed projection as immutable for this phase; the ban is enforced by *not touching* that file. `[VERIFIED: ai-context-read.ts:8-27]`

### Pitfall 5: Restore flattening / orphaned children (GRP-13)
**What goes wrong:** a restored child whose parent `group_events` row is missing becomes an orphan, or links flatten. **Why:** partial/edited backups. **How to avoid (decided here, executed Phase 36):** restore validates the relationship graph; an orphaned child is **detached to standalone** (`group_event_id` cleared), never dropped — dossier §AC `[DERIVED]` "prefer preserving a valid child Interaction as standalone over losing contact history." Define this rule now; hand the entity shape + `group_event` tombstone to Phase 36.

### Pitfall 6: Backup entity omission
**What goes wrong:** `group_events` + the new columns aren't serialized, so groups vanish on restore. **Why:** the current `export-manifest.ts` interactions read selects a fixed column list and does NOT yet include even `duration`/`allow_ai` (a known Phase-36 gap). **How to avoid:** Phase 33 does NOT edit the backup format (D-10), but the plan must record the exact new entity + columns + tombstone so Phase 36's format-4 bump includes them. `[VERIFIED: export-manifest.ts:52 selects only uid,contactUid,occurredAt,recordedAt,channel,direction,connected,quality,note,source,modifiedAt — no duration/allow_ai/group_event_id]`

---

## Runtime State Inventory

Not applicable — this is an **additive greenfield schema + new UI** phase, not a rename/refactor/migration of existing runtime state. No stored strings are renamed, no OS-registered state, secrets, or build artifacts change. The one migration is purely additive (new table + new nullable columns).

---

## Code Examples

The three canonical skeletons are in **Architecture Patterns** (create fan-out, inheritance fan-out, three-way remove). The verbatim `*Core` contracts they depend on:

```typescript
// Source: src/db/recency-dao.ts:446-460  (the composition primitives) [VERIFIED]
export {
  insertInteraction as insertInteractionCore,     // (exec, contactId, now, i) -> rowid; assumes BEGIN open
  recomputeLastContact as recomputeLastContactCore, // (exec, contactId, now); the ONLY last_contact writer
};
// deleteInteractionCore(exec, {interactionId, contactId, now})  -> tombstone + recompute [VERIFIED: recency-dao.ts:340-368]
// editTouchpointFull(exec, {interactionId, contactId, occurredAt, now, channel, direction,
//                           connected, quality, note, duration, allowAi}) [VERIFIED: recency-dao.ts:89-109,281-337]
```

```typescript
// Source: src/db/transaction.ts:49-64  (non-reentrant — never nest) [VERIFIED]
export function inWriteTransaction<T>(exec, body): Promise<T> {
  return withMutex(async () => {
    await exec.execAsync("BEGIN");
    try { const v = await body(); await exec.execAsync("COMMIT"); return v; }
    catch (e) { await exec.execAsync("ROLLBACK").catch(() => {}); throw e; }
  });
}
```

---

## State of the Art

Not applicable — no external ecosystem is involved. The relevant "state of the art" is entirely internal: Phase 32 shipped the dormant group seams (`isGroupLinked`, `buildGroupContext`, `GroupScopePrompt`, `GroupEvents`/`GroupLog` routes) and migration 025 (Tone/channel vocabulary, `duration`, `allow_ai`). Phase 33 is the first phase to make `group_event_id` real.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Override/inheritance state stored as **discrete per-field `ge_follow_*` flag columns** on `interactions` (vs a JSON mask or a side table) | Schema / Inheritance | LOW — dossier leaves storage shape `[DERIVED]`/discretion; discrete columns give clean fan-out SQL + self-contained backup rows. A JSON mask or side table also satisfies the contract. Confirm at plan time; not a decision reversal either way. |
| A2 | New routes named `GroupEventDetail` and `EditGroupEvent` (plus reusing `GroupLog`) registered across Dashboard/Orrery/Settings stacks that can reach them | Routing | LOW — naming is discretion; the *requirement* (separate detail + edit surfaces, GRP-08) is fixed. |
| A3 | Restore orphan-repair outcome = **detach orphaned child to standalone** (clear `group_event_id`), never drop | Backup / Pitfall 5 | MEDIUM — dossier §AC `[DERIVED]` favours preserving history; confirm with owner as the decided outcome since D-10 requires a *decided* rule. |
| A4 | `group_event` added to the tombstone entity vocabulary for delete/dissolve backup-merge correctness | Backup | LOW — mirrors every other deletable entity; executed by Phase 36. |
| A5 | Group DAO extends `insertInteractionCore` with optional `groupEventId` + flag params (vs a follow-up UPDATE) | Atomic Fan-Out | LOW — both keep writes atomic; extending the core best honours D-05's "created through insertInteractionCore." |

**If A3 is confirmed by the owner it becomes a locked decision for Phase 36.** All other assumptions are Claude's-discretion implementation shape.

---

## Open Questions

1. **Exact override-state storage shape (A1).**
   - What we know: must be *explicit per-field* state (dossier §G: current-value equality is insufficient); child must retain resolved values.
   - What's unclear: discrete flag columns vs JSON mask vs side table.
   - Recommendation: discrete `ge_follow_*` columns — cleanest fan-out predicate and backup. Planner's call (discretion).

2. **Should `duration`/`allow_ai`/`group_event_id` be added to the backup entity shape *now* as a Phase-36 handoff spec, or fully deferred?**
   - What we know: Phase 33 must NOT bump the format (D-10) but MUST hand over the shape.
   - Recommendation: write the complete target entity list (columns + tombstone + orphan rule) into the plan/handoff doc; Phase 36 executes. Note the pre-existing `duration`/`allow_ai` backup gap so Phase 36 closes all three together.

3. **Where does "Convert to Group Event" title come from?**
   - dossier §P seeds shared defaults from the interaction but title is event-only and required (§C). Recommendation: prompt for a title in the convert flow (a required field), seed channel/tone/duration from the interaction.

---

## Environment Availability

Not applicable — code/config-only changes against the existing on-device SQLite stack (`expo-sqlite`, already installed) and existing UI primitives. No new external tools, services, runtimes, or CLIs. Tests run under the existing `vitest` + `node:sqlite` harness (below).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.10 `[VERIFIED: package.json:55]` |
| Config file | vitest project config (present; DB tests use `@/db/__testkit__/node-sqlite`) `[VERIFIED: recency-dao.test.ts:13]` |
| Quick run command | `npx vitest run <file>` (single-file) |
| Full suite command | `npm test` (→ `vitest run`) `[VERIFIED: package.json:71]` |
| DB test pattern | in-memory `node:sqlite` DB driven through the REAL migrations + REAL DAO — logic proven node-side; `.tsx` cannot load under node `[VERIFIED: recency-dao.test.ts:1-25]` |
| Colour gate | `npm run check:colors` (no hex literals; enforced) `[VERIFIED: package.json:62]` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRP-01 | Zero-participant event valid; title/date required | unit | `npx vitest run src/db/group-events-dao.test.ts` | ❌ Wave 0 |
| GRP-02 | Exactly one child per participant; parent absent from every metric | unit | same + `src/db/history-read.test.ts`, `src/services/history/buckets.test.ts` (assert parent never counts) | ❌ Wave 0 / ✅ extend |
| GRP-03/04 | Shared value inheritance + per-field override + "Follow event…" clear; date/title never overridable | unit | `npx vitest run src/logic/group-inheritance.test.ts` + dao | ❌ Wave 0 |
| GRP-05 | Group Note never in the AI projection | unit | extend `src/db/ai-context-read.test.ts` — assert no `group_events` read, group note absent from `PromptContext` | ✅ extend |
| GRP-06 | Add stamps event date/time + current shared values; three-way remove branches | unit | `group-events-dao.test.ts` | ❌ Wave 0 |
| GRP-07 | Convert preserves `id`/`uid` | unit | `group-events-dao.test.ts` (assert uid unchanged) | ❌ Wave 0 |
| GRP-10 | Dissolve materializes+detaches; delete-with-interactions removes children+tombstones | unit | `group-events-dao.test.ts` | ❌ Wave 0 |
| GRP-11 | Atomicity — fan-out rolls back fully on a mid-loop failure; `last_contact` correct for every participant | unit | `group-events-dao.test.ts` (inject a failing child; assert no partial rows, recency untouched) | ❌ Wave 0 |
| GRP-12 | Event date + every fan-out `occurred_at` reject future | unit | `group-events-dao.test.ts` (assert rejected promise, no txn) | ❌ Wave 0 |
| GRP-13 | Round-trip: export → restore preserves parent, links, shared values, note, override state; orphan child detaches | unit | extend `src/backup/restore-apply.test.ts` + `export-manifest.test.ts` (Phase-36-executed; shape asserted here) | ✅ extend (spec) |
| GRP-08/09 | Detail presentation-first, browse search by title+participant, scope prompt routing | manual/device | Pixel UAT (device-local fixtures) | manual |

### Sampling Rate
- **Per task commit:** `npx vitest run <the touched dao/logic test>` + `npm run check:colors`.
- **Per wave merge:** `npm test` (full vitest suite) green.
- **Phase gate:** full suite green + device UAT (drive the app on the Pixel per the desktop-build pipeline) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/db/group-events-dao.test.ts` — covers GRP-01/02/06/07/10/11/12 (fan-out atomicity, recency correctness, three-way remove, convert-preserves-uid, future reject)
- [ ] `src/logic/group-inheritance.test.ts` — covers GRP-03/04 (inherit vs override resolution + fan-out target set) as a pure node-testable module
- [ ] `src/db/migrations/026-group-events-schema.test.ts` — asserts additive shape, `UNIQUE(group_event_id, contact_id)` NULL-distinct behavior, version 26
- [ ] Extend `ai-context-read.test.ts` — assert Group Note / `group_events` never reachable (GRP-05)
- [ ] Extend `history-read.test.ts` / `buckets.test.ts` — activate `groupLinked` with a real `group_event_id`, assert parent still never counts (GRP-02)

*Correctness-critical validation (future-date reject, interval math, recency) must live in a react-native-free `.ts` module so it runs under the node/vitest harness — the `.tsx` files cannot load there (established Phase-4 pattern).* `[VERIFIED: recency-dao.test.ts harness]`

---

## Security Domain

`security_enforcement: true` `[VERIFIED: .planning/config.json:46]`. This is a local-first, on-device app with no backend and no network on any read path.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts, no auth (local-only) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single on-device user; no multi-tenant boundary |
| V5 Input Validation | yes | `?`-bound params on EVERY value (no string interpolation) — the recency DAO's T-02-06 rule extends to the group DAO; `rejectFutureOccurredAt` on dates `[VERIFIED: recency-dao.ts:33-34,214-234]` |
| V6 Cryptography | no | No crypto in this phase (Hermes crypto guard is a Phase-34+ concern) |
| V8/V9 Data Protection / Privacy | **yes (primary)** | The Group Note AI-egress ban (D-04/ADR-078/GRP-05) is the security-relevant control: Group Note lives on `group_events`, which the closed egress projection `ai-context-read.ts` never reads |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via title/note/participant search | Tampering | Parameterized (`?`) queries only — never interpolate title/search text; the codebase's absolute rule `[VERIFIED: recency-dao.ts:32-34]` |
| Unintended data egress (Group Note → AI) | Information Disclosure | Keep the egress projection closed; do not join `group_events` (D-04) `[VERIFIED: ai-context-read.ts:8-27,108-152]` |
| Data corruption via partial fan-out | Tampering / integrity | One `inWriteTransaction`, full rollback on failure; recompute-not-last-write-wins recency (GRP-11) |
| Irreversible migration error on unreachable device | Denial of Service (permanent, per-user) | Additive-only migration 026; no rebuild/DROP; forward-only; treat as irreversible in production (CLAUDE.md) |

---

## Sources

### Primary (HIGH confidence — read on disk this session)
- `src/db/recency-dao.ts` — single-writer spine, `*Core` exports, edit/delete contracts, future-date guard
- `src/db/transaction.ts` — `inWriteTransaction`, non-reentrancy
- `src/db/contacts-dao.ts` — `createContactFull` composition exemplar
- `src/db/ai-context-read.ts` — closed egress projection (Group Note ban)
- `src/db/events-dao.ts` — lifecycle events (Group Events must NOT be modeled as these — ADR-025)
- `src/db/database.ts` — `TARGET_VERSION = 25`, MIGRATIONS array (head = migration025) → next is 026
- `src/db/migrations/025-interaction-history-schema.ts` + `001-initial.ts` — current `interactions` column set
- `src/db/history-read.ts`, `src/components/history/interaction-detail-logic.ts`, `GroupScopePrompt.tsx`, `src/screens/GroupEventsScreen.tsx`, `src/navigation/types.ts` — dormant Phase-32 group seams
- `src/backup/export-manifest.ts`, `src/backup/restore-apply.ts` — backup entity set (group events absent; duration/allow_ai gap)
- `src/components/ContactPicker.tsx` — single-select foundation to extend
- `docs/dossier/milestone-2/phase-12-group-interaction-logging-dossier.md` (§A–AG) + `planning-notes/phase-12-planning-notes.md` (R-02/03/04/09) — ground-truth decision record
- `.planning/phases/33-group-interaction-logging/33-CONTEXT.md`, `33-UI-SPEC.md`, `.planning/REQUIREMENTS.md` (GRP-01…13)

### Secondary (MEDIUM confidence)
- SQLite `UNIQUE`/partial-index NULL-distinct semantics (standard SQLite behavior; recommend verifying in the migration test).

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Schema + migration number (026): HIGH — verified `TARGET_VERSION=25`, MIGRATIONS head = migration025 on disk.
- Atomic composition / recency invariant: HIGH — verified the cores, the mutex, and the `createContactFull` exemplar.
- AI-egress ban: HIGH — verified the closed projection reads no note and no `group_events`.
- Backup shape / orphan rule: MEDIUM — shape verified; the orphan-repair *outcome* (A3) needs owner confirmation to become a locked Phase-36 rule.
- Override-state storage shape: MEDIUM — dossier leaves it discretion; discrete flag columns recommended.

**Research date:** 2026-09-11
**Valid until:** 2026-10-11 (stable local domain; re-verify the migration head at plan time per D-03 — numbers drift every schema phase).
</content>
</invoke>
