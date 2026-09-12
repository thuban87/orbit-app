# Phase 33: Group Interaction Logging - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 13 (7 new, 6 modified/extended)
**Analogs found:** 13 / 13 (all in-repo; no external stack)

> All excerpts below were read on disk this session (per CLAUDE.md "Review the code, not the diff"), not lifted from RESEARCH.md. File:line references verified against the current working tree. Migration head verified: last registered step is `025-interaction-history-schema.ts` (`TARGET_VERSION = INTERACTION_HISTORY_SCHEMA_VERSION = 25`), so the new migration is **026**. Re-verify at plan time — D-03: numbers drift every schema phase.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/migrations/026-group-events-schema.ts` (new) | migration | schema (additive DDL) | `src/db/migrations/025-interaction-history-schema.ts` | exact |
| `src/db/group-events-dao.ts` (new) | DAO / service | CRUD + transactional fan-out | `src/db/contacts-dao.ts` (`createContactFull`) + `src/db/recency-dao.ts` (`editTouchpointFull`/`deleteInteractionCore`) | exact |
| `src/db/group-events-read.ts` (new) | DAO (read) | request-response (pure reads) | `src/db/history-read.ts` / `src/backup/export-manifest.ts` read idiom | role-match |
| `src/logic/group-inheritance.ts` (new) | logic (pure module) | transform | `src/components/history/interaction-detail-logic.ts` (`buildGroupContext`) | role-match |
| `src/db/tombstones-dao.ts` (modified) | DAO | event-driven (delete evidence) | itself — add `group_event` to the entity union | exact (self) |
| `src/db/ai-context-read.ts` (**do NOT extend**) | DAO (egress boundary) | request-response projection | itself — egress ban preserved by omission | n/a (non-action) |
| `src/screens/GroupEventsScreen.tsx` (replace placeholder) | screen | request-response (browse list) | `src/screens/GroupEventsScreen.tsx` placeholder + `ShellAppBar`/list idiom | role-match |
| `src/screens/GroupLogScreen.tsx` (new) | screen | request-response (create form) | `EditInteractionScreen.tsx` + `TouchpointRefineForm.tsx` | role-match |
| `src/screens/EditGroupEventScreen.tsx` (new) | screen | request-response (edit form) | `EditInteractionScreen.tsx` + `TouchpointRefineForm.tsx` | role-match |
| `src/screens/GroupEventDetailScreen.tsx` (new) | screen | request-response (detail) | `InteractionDetail.tsx` group block + `ListRow`/`MemoryCard` rows | role-match |
| `src/components/ContactPicker.tsx` (modified) | component | request-response (multi-select) | itself — extend single-select to multi-select | exact (self) |
| `src/components/history/GroupScopePrompt.tsx` (wire) | component | scope-select | itself — wire `onEditGroup` to real route | exact (self) |
| `src/navigation/types.ts` (modified) | config (route types) | — | itself — add `GroupEventDetail`/`EditGroupEvent`, reuse `GroupLog` | exact (self) |

---

## Pattern Assignments

### `src/db/group-events-dao.ts` (DAO, transactional fan-out) — THE load-bearing file

**Primary analog:** `src/db/contacts-dao.ts` `createContactFull` (lines 116-200) — the "reject-future-before-txn, then enter mutex once, compose `*Core`s" exemplar.

**Guard-then-single-mutex shape** (`contacts-dao.ts:142-152`):
```typescript
// GUARD 2 (CRUD-02): reject a FUTURE first-interaction occurredAt BEFORE any txn.
if (input.firstInteraction && input.firstInteraction.occurredAt > input.now) {
  return Promise.reject(new Error(...));
}
return inWriteTransaction(exec, () => createContactFullCore(exec, input));
```
For Phase 33: call `rejectFutureOccurredAt(input.occurredAt, input.now)` in a `try/catch` returning `Promise.reject(err)` (mirrors `recordTouchpoint`, `recency-dao.ts:249-253`), then one `inWriteTransaction`.

**Compose-the-cores-in-a-loop, never bulk INSERT** (`contacts-dao.ts:191-200`):
```typescript
let interactionId: number | null = null;
if (input.firstInteraction) {
  interactionId = await insertInteractionCore(exec, contactId, input.now, input.firstInteraction);
  await recomputeLastContactCore(exec, contactId, input.now);
}
```
Phase 33 loops this per participant. **`recomputeLastContactCore` after EVERY `insertInteractionCore`** (D-05). End the transaction body with `await bumpDataRevisionCore(exec)` (`contacts-dao.ts:441`).

**The `*Core` primitives it composes** (import from `@/db/recency-dao`, aliases at `recency-dao.ts:457-460`):
```typescript
export {
  insertInteraction as insertInteractionCore,     // (exec, contactId, now, i) -> rowid; assumes BEGIN open
  recomputeLastContact as recomputeLastContactCore, // (exec, contactId, now); ONLY last_contact writer
};
```
`insertInteractionCore` body is `recency-dao.ts:194-236` — a single `?`-bound `INSERT INTO interactions (...13 cols...)`. **Extend this core** to accept optional `groupEventId` + `ge_follow_*` params (all `?`-bound, default NULL) per RESEARCH A5 — keeps 100% of child inserts on the one write path.

**Shared-value fan-out edit** uses `editTouchpointFull` (`recency-dao.ts:281-337`). Critical contract: it **SETs every editable column unconditionally** (no COALESCE) and re-runs `rejectFutureOccurredAt`, so read the child row first and pass its whole current record with only the changed field overwritten:
```typescript
// recency-dao.ts:303-328 — UPDATE sets occurred_at,channel,direction,connected,
// quality,note,duration,allow_ai,modified_at WHERE id=? AND contact_id=?
if (result.changes !== 1) { throw new Error(...); }   // loud rollback, not silent corruption
await recomputeLastContact(exec, input.contactId, input.now);
await bumpDataRevisionCore(exec);
```

**Delete a child** uses `deleteInteractionCore` (`recency-dao.ts:340-368`) — writes an `interaction` tombstone (`insertTombstoneCore`) **before** the DELETE, then recomputes recency. Never raw `DELETE FROM interactions`; never rely on FK `ON DELETE CASCADE` (bypasses tombstone + recompute).

**Three-way Remove / Dissolve / Convert** (RESEARCH Patterns 3-5): "Keep as individual" / Dissolve detach is `UPDATE interactions SET group_event_id=NULL, ge_follow_*=NULL, modified_at=? WHERE id=?` + `bumpDataRevisionCore` (values already materialized, no recompute needed); **never copy `group_note` into the participant note** (dossier §O). Delete-Group-Event-&-Interactions loops `deleteInteractionCore` then `DELETE FROM group_events` + a `group_event` tombstone.

**ANTI-PATTERNS (trip-wires, stop-and-ask if tempted):** bulk `INSERT INTO interactions ... VALUES (?),(?)`; nesting `inWriteTransaction` (calling `deleteTouchpoint`/`recordTouchpoint`/`editTouchpointFull` wrappers inside a group txn → permanent hang — call the `*Core` inside your own txn instead); adding `group_events` to `ai-context-read.ts`; adding an archived-contact guard.

---

### `src/db/migrations/026-group-events-schema.ts` (migration, additive DDL)

**Analog:** `src/db/migrations/025-interaction-history-schema.ts` (read in full, lines 1-74).

**Version constant + Migration object shape** (`025:39-73`):
```typescript
export const INTERACTION_HISTORY_SCHEMA_VERSION = 25;
export const migration025: Migration = {
  version: INTERACTION_HISTORY_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`ALTER TABLE interactions ADD COLUMN duration INTEGER; ...`);
  },
};
```
Copy this exactly: export `GROUP_EVENTS_SCHEMA_VERSION = 26`, a `migration026` object, and a single `exec.execAsync` string of additive `CREATE TABLE group_events` + `ALTER TABLE interactions ADD COLUMN group_event_id / ge_follow_*` + partial `CREATE UNIQUE INDEX ... WHERE group_event_id IS NOT NULL`. **Additive only** — no rebuild, no DROP, no `note` rewrite (025's header comment, lines 22-24, states this rule verbatim). The header comment on 025 also documents the head+1 verification ritual — replicate it.

**Register it** in `src/db/database.ts`: add `migration026` to the `MIGRATIONS` array and set `TARGET_VERSION = GROUP_EVENTS_SCHEMA_VERSION` (currently `database.ts:63` = `INTERACTION_HISTORY_SCHEMA_VERSION`).

**Test analog:** `025-interaction-history-schema.test.ts` exists — mirror it for the additive shape + NULL-distinct UNIQUE behavior + version 26.

---

### `src/db/tombstones-dao.ts` (modified — add entity type)

**Self-analog.** Two edits, both mechanical, both verified needed:
- Add `"group_event"` to the `TombstoneEntityType` union (`tombstones-dao.ts:8-22`).
- Add a `case "group_event":` arm to `assertTombstoneEntityType` (`tombstones-dao.ts:39-54`) — the runtime allowlist that guards export/reconcile. Missing it makes every group-event tombstone throw.

`insertTombstoneCore` (`tombstones-dao.ts:61-80`) is already the reusable core the group DAO calls inside its own transaction — no change to its body.

---

### `src/logic/group-inheritance.ts` (new, pure transform module)

**Analog:** `src/components/history/interaction-detail-logic.ts` — a react-native-free `.ts` logic module (`buildGroupContext`, lines 146-159; `isGroupLinked`, `history-read.ts:104-106`). This is the node-testable pattern (RESEARCH: `.tsx` cannot load under vitest).

```typescript
// history-read.ts:104-106 — the group-link discriminator, now becomes live
export function isGroupLinked(row: { groupEventId?: number | null }): boolean {
  return row.groupEventId != null;
}
```
Phase 33's `group-inheritance.ts` holds the pure "resolve inherited-vs-override display + compute the fan-out target set (which children have `ge_follow_<field>=1`)" logic so it runs under the `node:sqlite`/vitest harness. Keep zero react-native imports.

---

### `src/db/group-events-read.ts` (new, pure reads)

**Analog:** the read idiom in `src/backup/export-manifest.ts:52` and `history-read.ts`. Reads select an explicit named column list (never `SELECT *`), `?`-bound, ordered deterministically. No transaction for reads (or `inReadSnapshot` from `transaction.ts:74-89` only if a consistent multi-table snapshot is needed). Browse search filters title + participant name — **parameterize the search term, never interpolate** (V5, the codebase's absolute rule).

---

### `src/db/ai-context-read.ts` (egress boundary — DO NOT EXTEND)

**The Group Note AI-egress ban (D-04/GRP-05) is enforced by a NON-ACTION.** The file header (`ai-context-read.ts:8-26`) is the load-bearing privacy contract: it selects only `name` + category name + `channel/quality/connected` aggregates, and **rule 2 (line 15-17) explicitly says the free-text interaction column and the events-table free-text column are NEVER selected here.** `group_events` (and `group_note`) simply must never be joined in. Any edit adding it reverses D-04/ADR-078 — stop and ask. The only allowed change is the **test**: extend `ai-context-read.test.ts` to assert `group_events`/group note is unreachable.

---

### `src/components/ContactPicker.tsx` (modified — add multi-select mode)

**Self-analog — extend, do NOT fork** (dossier §K, UI-SPEC). Current single-select contract:
```typescript
// ContactPicker.tsx:22-30
export interface ContactPickerProps {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (contactId: number) => void;   // <- single-select today
  excludeContactId?: number;
  allowArchivedSearch?: boolean;
}
```
`select` (`ContactPicker.tsx:100-106`) dismisses on tap and fires `onSelect`. Add a multi-select mode over the same `FlatList`/`listPickerContacts`/`filterPicker` foundation (the loading `ActivityIndicator`, `pickerRowMarkers` archived/snoozed markers per SHELL-10, and `shellTransientStore` registration all stay). Multi-select keeps the modal open, tracks a selected set, and confirms with a Done action + selected count. Selected state uses the `accent` token + a check icon (state never colour-alone — THEME-08).

---

### `src/components/history/GroupScopePrompt.tsx` (wire the dormant seam)

**Self-analog.** The component is complete (`GroupScopePrompt.tsx:35-58`) — a `Sheet variant="compact"` with "Edit individual interaction" / "Edit Group Event" buttons. Phase 33 supplies real `onEditIndividual` / `onEditGroup` callbacks routing to the participant override editor and the new `EditGroupEvent` route. The seam only fires once `isGroupLinked` returns true, which requires a real `group_event_id` (from migration 026). No component-body change expected — just wiring + activation.

---

### `src/screens/GroupEventsScreen.tsx` (replace placeholder) & new screens

**Browse-page analog:** current `GroupEventsScreen.tsx:8-26` gives the shell skeleton (`ShellAppBar variant="child"`, `ChromeScrim` panel). Replace the "Coming soon" body with a reverse-chron `FlatList` + search field; use `ListRow.tsx`/`MemoryCard.tsx` compact-row idiom for rows and the empty/no-results copy from the UI-SPEC Copywriting Contract.

**Form screens (`GroupLogScreen`, `EditGroupEventScreen`):** analog `EditInteractionScreen.tsx` structure + `TouchpointRefineForm.tsx` field controls (Channel/Direction/Connected/Tone/Note/Duration/Allow-AI); `Sheet` `expanded` variant for the focused workspace; shell discard/keep guard. Participant override editor reuses `TouchpointRefineForm` but exposes **only** the overridable fields (never date/time or title — dossier §L).

**Detail screen (`GroupEventDetailScreen`):** presentation-first; participant compact cards (ListRow idiom + `OverflowMenu.tsx`) open the existing child `InteractionDetail`/`EditInteraction`. The dormant `InteractionDetail` group block (`buildGroupContext`, `interaction-detail-logic.ts:146-159`) becomes non-null once `group_event_id` exists.

**Routing (`navigation/types.ts`):** `GroupLog: { participantIds?: number[] }` route already exists (`types.ts:45-51`, seam left by Phase 32). Add `GroupEventDetail` + `EditGroupEvent` route types (RESEARCH A2 — naming is discretion).

---

## Shared Patterns

### Single write transaction (apply to EVERY group mutation)
**Source:** `src/db/transaction.ts:49-64` (`inWriteTransaction`).
```typescript
export function inWriteTransaction<T>(exec, body): Promise<T> {
  return withMutex(async () => {
    await exec.execAsync("BEGIN");
    try { const value = await body(); await exec.execAsync("COMMIT"); return value; }
    catch (error) { await exec.execAsync("ROLLBACK").catch(() => {}); throw error; }
  });
}
```
**NON-REENTRANT** (`transaction.ts:11-29`): enter it exactly once per mutation; compose `*Core` primitives inside, never the mutexed wrappers. Never use expo `withTransactionAsync`.

### Recompute-not-write recency (apply after every child insert/edit/delete)
**Source:** `src/db/recency-dao.ts:174-191` (`recomputeLastContact`, the ONLY `contacts.last_contact` writer).
```typescript
UPDATE contacts SET last_contact = (
  SELECT MAX(i.occurred_at) FROM interactions i
   WHERE i.contact_id = contacts.id
     AND (contacts.rarely_responds = 0 OR i.connected = 1)
), modified_at = ? WHERE id = ?
```

### Future-date rejection (apply before opening any txn)
**Source:** `rejectFutureOccurredAt` from `@/db/log-guards`; call pattern `recency-dao.ts:249-253`. Reject as `Promise.reject(err)` so no transaction opens. Apply to the event date AND every fan-out `occurred_at` write (D-08/GRP-12).

### Parameterized SQL (apply to all group SQL, incl. title/search)
**Source:** every DAO — `?`-bound values only, never string interpolation (V5; `recency-dao.ts:214-234`). Title, Group Note, and browse search text are user free-text and MUST be bound.

### Data-revision bump (apply at the end of every mutation txn)
**Source:** `bumpDataRevisionCore` from `@/db/data-revision-dao`; called at `contacts-dao.ts:441`, `recency-dao.ts:335`, `tombstones-dao.ts:78`.

### Local wall-clock time (never UTC)
**Source:** CLAUDE.md + `recency-dao.ts:40-49`. Use `formatLocalDate()` / `localDateTime()` — never `toISOString().split('T')[0]`. `occurred_at` is stored verbatim; the DAO does no date math.

---

## Backup entity shape (define here, EXECUTE in Phase 36 — D-10)

**Do NOT edit `export-manifest.ts`/`restore-apply.ts` this phase.** But record the handoff spec:
- The current interaction export read (`export-manifest.ts:52`) selects `uid, contactUid, occurredAt, recordedAt, channel, direction, connected, quality, note, source, modifiedAt` — it already **omits `duration`/`allow_ai`** (a pre-existing Phase-36 gap). Phase 36 must add `duration`, `allow_ai`, `group_event_id`, and the `ge_follow_*` flags together.
- New `group_events` entity: `uid, title, occurredAt, channel, quality, duration, groupNote, createdAt, modifiedAt`.
- Add `group_event` to the tombstone vocabulary (done in `tombstones-dao.ts` this phase; serialized in `export-manifest.ts` line 62 idiom by Phase 36).
- **Orphan-repair rule (RESEARCH A3 — needs owner confirmation to lock):** a restored child whose parent `group_events` row is missing is **detached to standalone** (`group_event_id` cleared), never dropped (dossier §AC — prefer preserving a valid child interaction over losing contact history).

---

## No Analog Found

None. Every new file has a strong in-repo analog; this phase introduces no external packages and no novel data-flow shape. The one genuinely new construct — the per-field `ge_follow_*` live-inheritance flags — is a discretion storage-shape decision (RESEARCH A1), not a missing-pattern gap; its fan-out mechanics reuse `editTouchpointFull` verbatim.

## Metadata

**Analog search scope:** `src/db/` (recency-dao, contacts-dao, transaction, ai-context-read, tombstones-dao, migrations/025, database), `src/backup/export-manifest.ts`, `src/components/` (ContactPicker, history/GroupScopePrompt, history/interaction-detail-logic), `src/screens/GroupEventsScreen.tsx`, `src/navigation/types.ts`, `src/db/history-read.ts`.
**Files scanned:** ~14, all read on disk this session.
**Migration head verified:** last registered = migration 025; `TARGET_VERSION = INTERACTION_HISTORY_SCHEMA_VERSION = 25` → new migration is 026 (re-verify at plan time per D-03).
**Pattern extraction date:** 2026-09-11
</content>
</invoke>
