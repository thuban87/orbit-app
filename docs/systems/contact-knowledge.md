# Contact Knowledge

**Last updated:** 2026-09-02
**Updated by phase:** 25-dashboard-data-state-foundation
**Owners:** `src/db/memory-registry.ts`, `src/db/memories-dao.ts`, `src/db/memories-read.ts`, `src/db/relationships-dao.ts`, `src/db/relationships-read.ts`, `src/db/current-state-history-dao.ts`, `src/db/current-state-history-read.ts`, `src/db/first-class-knowledge-read.ts`, `src/db/knowledge-search-read.ts`, `src/services/knowledge-search.ts`, `src/services/memory-trash-sweep.ts`

## Purpose

Contact Knowledge gives a contact one local Things to Remember surface without flattening different kinds of information into one record. It combines typed Memories, structured key people, retained current-state values, first-class contact properties, and read-only custom fields while keeping all data in on-device SQLite.

## Architecture

### Data Model

Migration 016 adds three tables without moving conversational fuel or changing custom-field storage. The in-code registry owns the Memory type set and current-state field metadata; it is not a user-writable SQLite table.

**Tables:**
- `memories` — typed repeatable contact knowledge.
  - `uid` (`TEXT UNIQUE`) — durable identity.
  - `contact_id` (`INTEGER`) — owning contact, cascaded on permanent contact deletion.
  - `type`, `custom_label`, `value`, `note`, `url`, `meaningful_date` (`TEXT`) — typed content and optional metadata.
  - `pinned`, `outdated` (`INTEGER`) — presentation and lifecycle state.
  - `allow_ai` (`INTEGER`) — explicit per-item egress permission, defaulting to off; it is independent of visibility and provenance.
  - `hidden` (`INTEGER NULL`) — three-state Profile visibility override: inherit, show, or hide.
  - `provenance` (`TEXT`) — lightweight `user`, `import`, or `share` origin shown in edit/detail views.
  - `created_at`, `modified_at`, `deleted_at` (`TEXT`) — local timestamps; a non-NULL `deleted_at` is Recently Deleted state.
- `relationships` — repeatable key-person records.
  - `uid` (`TEXT UNIQUE`) and `contact_id` (`INTEGER`) — durable identity and owner.
  - `person_name`, `relation_type`, `note` (`TEXT`) — relationship content.
  - `linked_contact_id` (`INTEGER NULL`) — optional Orbit-contact link, set NULL if the linked contact is deleted.
  - `pinned`, `hidden`, `created_at`, `modified_at`, `deleted_at` — presentation and bounded Undo lifecycle state.
  - `CHECK (linked_contact_id IS NULL OR linked_contact_id != contact_id)` — prevents a relationship self-link even if a future writer bypasses the DAO guard.
- `current_state_entries` — retained values for first-class current-state fields.
  - `uid` (`TEXT UNIQUE`), `contact_id` (`INTEGER`), `field_key` (`TEXT`), and `value` (`TEXT`) — identity, owner, registry field, and raw value.
  - `is_current` (`INTEGER`) — partial unique index permits at most one current value for a contact and field.
  - `created_at`, `modified_at` (`TEXT`) — local timestamps for deterministic history ordering.

**Types** (`src/db/memory-registry.ts`):
- `MemoryTypeKey` — application-owned `general`, `custom`, and `imported` Memory keys; a Custom item carries its own required label.
- `MemoryTypeMeta` — display, cardinality, history, search, new-item AI default, visibility, and presentation metadata.
- `CurrentStateFieldKey` — `last_talked_about` and `current_location`.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|-------|------|----------------|
| Registry | `src/db/memory-registry.ts` | Defines application-owned Memory types, current-state fields, and group order. |
| Memory writer | `src/db/memories-dao.ts` | Validates, adds, patches, soft-deletes, restores, and guarded-purges Memory rows. |
| Memory reader | `src/db/memories-read.ts` | Produces live and Recently Deleted projections with deterministic ordering and visibility resolution. |
| AI eligibility reader | `src/db/memories-read.ts` | Exposes only live Memories with explicit `allow_ai = 1` for the AI context boundary. |
| Relationship writer | `src/db/relationships-dao.ts` | Writes structured relationships, rejects self-links, and owns their Undo lifecycle. |
| Relationship reader | `src/db/relationships-read.ts` | Reads live rows and optional linked-contact display names. |
| State-history writer | `src/db/current-state-history-dao.ts` | Atomically sets, promotes, and edits retained current-state values. |
| State-history reader | `src/db/current-state-history-read.ts` | Reads the current value, full backlist, and batched recognized fields. |
| First-class reader | `src/db/first-class-knowledge-read.ts` | Projects core contact fields plus local gravity/intensity display values. |
| Maintenance service | `src/services/memory-trash-sweep.ts` | Expires stale Memory and relationship trash at foreground launch. |
| Screen owner | `src/screens/ThingsToRememberScreen.tsx` | Composes local reads, owns persistence calls, and reloads after a mutation. |

### Key Files

| File | Role |
|------|------|
| `src/db/migrations/016-contact-knowledge.ts` | Frozen additive schema, constraints, and query indexes. |
| `src/db/memory-registry.ts` | Single source for type and history-field semantics. |
| `src/db/memories-dao.ts` | Transactional Memory lifecycle boundary. |
| `src/db/memories-read.ts` | Memory read and visibility choke point. |
| `src/db/knowledge-search-read.ts` | Produces the local, metadata-free knowledge-search corpus. |
| `src/services/knowledge-search.ts` | Performs bounded matching and preserves raw-text offsets for descriptors. |
| `src/db/relationships-dao.ts` | Structured relationship writer and stale-expiry core. |
| `src/db/relationships-read.ts` | Relationship projection with optional linked name. |
| `src/db/current-state-history-dao.ts` | Non-destructive current/history transitions. |
| `src/db/current-state-history-read.ts` | Current and backlist reads. |
| `src/db/first-class-knowledge-read.ts` | First-class data projection for Things to Remember. |
| `src/services/memory-trash-sweep.ts` | Strict foreground retention hook. |
| `src/screens/ThingsToRememberScreen.tsx` | Unified grouped contact-knowledge screen. |
| `src/screens/RecentlyDeletedScreen.tsx` | Restore and confirmed permanent deletion surface. |
| `src/screens/MemoryHistoryScreen.tsx` | Current-state backlist edit and promote surface. |

## How It Works

### Reading Things to Remember

1. From a contact profile, `ContactProfileScreen` opens `ThingsToRemember` with only the contact ID.
2. `ThingsToRememberScreen` loads Memory, relationship, current-state, first-class, and existing custom-field reads through DAOs; no component issues inline SQL or a network request.
3. The screen presents featured/current information first, then grouped Key People and Memory content. Visibility is a presentation rule: a Memory override wins over the registry default but does not change storage or privacy.
4. The screen owns writer calls and reloads the same local projection after a successful add, edit, hide/show, delete, or Undo action.

### Creating and maintaining a Memory

1. `MemoryEditor` keeps draft form state and returns a typed input to its parent; it has no DAO access.
2. `addMemory` or `editMemory` validates the registry key and requires a label for `custom`; optional blank metadata normalizes to NULL.
3. The writer runs inside the shared write transaction, scopes edits to both row and owning contact, and bumps the portable data revision.
4. Live reads return only rows with `deleted_at IS NULL`, ordered pinned first, then meaningful date, creation time, and ID.

### Controlling AI eligibility and local search

1. A new Memory seeds `allow_ai` from its registry type default; the imported type defaults off and existing rows are never retroactively changed.
2. `setMemoryAllowAi()` scopes a toggle by Memory and contact identity, while `listAiEligibleMemories()` enforces `allow_ai = 1 AND deleted_at IS NULL` in SQL.
3. The knowledge-search read accepts only eligible Dashboard IDs and exposes names, phone/email, category, searchable Memory content, relationship content, and eligible custom-field values. Its pure TypeScript scorer supplies bounded typo tolerance and raw-text offsets; identifiers, provenance, timestamps, and other internal metadata never enter searchable text.

### Current-state history

1. A user sets Last Talked About or Current Location through `MemoryHistoryScreen`.
2. `setCurrentStateValue` demotes any existing current row and inserts the new current row in one transaction.
3. The drill-in renders the current value separately from earlier entries; editing an earlier entry is scoped by contact, field, and row identity.
4. Promoting an earlier value atomically demotes the displaced current value instead of deleting it.

### Relationships and removal

1. `RelationshipEditor` collects a required person name, optional relation details, and optional link to another Orbit contact.
2. The relationship DAO and the table CHECK both reject a link from a contact to itself.
3. Removing a relationship soft-deletes it so the immediate Undo control can restore it; it is not listed in Recently Deleted.
4. Removing a Memory soft-deletes it into Recently Deleted. The user can restore it or open a confirmation-gated permanent purge.

### Foreground retention sweep

1. `App.tsx` registers the Memory trash hook only after database migration readiness.
2. At foreground launch, the hook scans candidates and invokes each transaction-composable expiry writer.
3. Each writer rechecks the strict age predicate under the shared write lock before it permanently deletes a stale row, avoiding restore/re-delete races.

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `MEMORY_TRASH_WINDOW_DAYS` | `30` | `src/services/memory-trash-sweep.ts` | Shared retention window for Memory and relationship trash. |
| `PROVISIONAL_MEMORY_LABEL` | `Memory` | `src/db/memory-registry.ts` | Single-source provisional terminology pending owner reconciliation. |
| `PROVISIONAL_DEFAULT_MEMORY_TYPE_NAME` | `General` | `src/db/memory-registry.ts` | Provisional display name for the default type. |

## Decisions

- **ADR-088:** Additive Contact-Knowledge Schema and Application-Owned Memory Registry — defines the new tables and fixed in-code type boundary.
- **ADR-089:** Recoverable Memory Lifecycle and Contact-Operation Integrity — defines recovery, expiry, merge, and purge behavior.
- **ADR-081:** Retire AI-Proposed Fuel for Explicit Per-Item Permission — moves retired fuel into default-off Memories and establishes explicit Memory consent.
- **ADR-091:** Imported Contact Notes as AI-Off Typed Memories — adds the searchable imported type and durable import boundary.
- **ADR-094:** Eligibility-Scoped Semantic Dashboard Search — preserves typed provenance in an eligible-ID-scoped Dashboard corpus.

## Gotchas

1. **Memory types are not user-created records.** A user-labelled Custom item is allowed; a user-writable type set would reverse ADR-028.
2. **Memory AI permission is explicit.** Visibility, provenance, and type are not egress permission; only the SQL eligibility predicate may admit an opted-in live row.
3. **Search is local but not SQL fuzzy search.** Do not add FTS5 or an index; the SQL read establishes eligibility and the TypeScript scorer ranks its bounded result set.
4. **Nothing watches timestamps.** Retention is a foreground launch sweep, never a timer or trigger.
5. **Do not nest transaction wrappers.** Sweep expiry calls a non-mutexed core after obtaining its own write transaction.
6. **Current-state promotion preserves history.** The partial unique index enforces one current row; it does not authorize deleting the displaced value.
7. **Relationships are Undo-only after removal.** Recently Deleted is a Memory recovery surface, not a general relationship trash browser.
8. **Search scope is supplied by Dashboard.** The corpus must never broaden that eligible-ID set or add an unscoped global reader.

## Related Systems

- **Persistence core** — runs migration 016 and the launch-sweep registry.
- **Contacts** — owns the profile entry point and explicit contact-purge fan-out.
- **Contact reconciliation** — reparents knowledge rows inside a contact merge.
- **App shell** — registers the typed routes in both contact-navigation stacks.
- **Custom fields** — remain structured and render as a read-only grouped portion of Things to Remember.
- **Conversational fuel** — legacy share and AI-proposal rows migrate into Memories through the verified phase-24.2 data move.
- **AI suggestions** — consumes only the explicit, SQL-gated Memory projection.
- **Contact import** — supplies imported Notes as AI-off typed Memories.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-09-03 | 24.1 | Created the typed local contact-knowledge model, recovery lifecycle, and unified Things to Remember surface. |
| 2026-09-03 | 24.2 | Added explicit default-off Memory egress permission, local knowledge-search corpus, and imported Notes type. |
| 2026-09-02 | 25 | Added eligible-ID-scoped semantic search provenance, matching, and highlight offsets for Dashboard consumption. |
