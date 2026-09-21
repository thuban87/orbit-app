# Contact Knowledge

**Last updated:** 2026-09-02
**Updated by phase:** 35-messaging-ai-compose
**Owners:** `src/db/memory-registry.ts`, `src/db/memories-dao.ts`, `src/db/memories-read.ts`, `src/db/relationships-dao.ts`, `src/db/relationships-read.ts`, `src/db/current-state-history-dao.ts`, `src/db/current-state-history-read.ts`, `src/db/first-class-knowledge-read.ts`, `src/db/knowledge-search-read.ts`, `src/db/dashboard-knowledge-read.ts`, `src/services/knowledge-search.ts`, `src/services/memory-trash-sweep.ts`

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
| State-history reader | `src/db/current-state-history-read.ts` | Reads the current value, full backlist, and batched recognized fields. `getCurrentStateHistory` accepts a read-only `Pick<SqlExecutor,"getAllAsync">` surface so the History read (`history-read.ts`) can compose it without a writable executor. |
| First-class reader | `src/db/first-class-knowledge-read.ts` | Projects core contact fields plus local gravity/intensity display values. |
| Dashboard candidate reader | `src/db/dashboard-knowledge-read.ts` | Batches bounded, visibility-safe candidates for loaded List and Card result sets. |
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
| `src/db/dashboard-knowledge-read.ts` | Batches visible candidates for deterministic Dashboard List and Card context. |
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
| `src/db/compose-research-read.ts` | Builds the compact, populated-only Compose Research projection with source-owned display and AI eligibility. |
| `src/screens/ComposeResearchScreen.tsx` | Renders the read-only Compose sibling surface; it owns no knowledge writer. |

## How It Works

### Reading Things to Remember

1. From a contact profile, `ContactProfileScreen` opens `ThingsToRemember` with only the contact ID.
2. `ThingsToRememberScreen` loads Memory, relationship, current-state, first-class, and existing custom-field reads through DAOs; no component issues inline SQL or a network request.
3. The screen presents featured/current information first, then grouped Key People and Memory content. Visibility is a presentation rule: a Memory override wins over the registry default but does not change storage or privacy.
4. The screen owns writer calls and reloads the same local projection after a successful add, edit, hide/show, delete, or Undo action.

### Reading Compose Research

1. Compose enters a sibling Research screen that calls `readComposeResearch()` locally on focus; it is not another Profile or Things to Remember editor.
2. The read composes populated, visible Memories, relationships, current-state entries, first-class fields, custom fields, and Off Limits into normalized `ResearchItem` records.
3. Each item carries the source-owned `aiEligible` result. Memory `allow_ai` and custom-field `share_with_ai` can admit an item; relationships, first-class values, current state, and Off Limits do not infer consent.
4. Off Limits renders as an Avoid group for the human. The read marks it structurally non-eligible, so neither the screen nor session state can add it to Message Focus.

### Creating and maintaining a Memory

1. `MemoryEditor` keeps draft form state and returns a typed input to its parent; it has no DAO access.
2. `addMemory` or `editMemory` validates the registry key and requires a label for `custom`; optional blank metadata normalizes to NULL.
3. The writer runs inside the shared write transaction, scopes edits to both row and owning contact, and bumps the portable data revision.
4. Live reads return only rows with `deleted_at IS NULL`, ordered pinned first, then meaningful date, creation time, and ID.

### Controlling AI eligibility and local search

1. A new Memory seeds `allow_ai` from its registry type default; the imported type defaults off and existing rows are never retroactively changed.
2. `setMemoryAllowAi()` scopes a toggle by Memory and contact identity, while `listAiEligibleMemories()` enforces `allow_ai = 1 AND deleted_at IS NULL` in SQL.
3. The knowledge-search read accepts only eligible Dashboard IDs and exposes names, phone/email, category, searchable Memory content, relationship content, and eligible custom-field values. Its pure TypeScript scorer supplies bounded typo tolerance and raw-text offsets; identifiers, provenance, timestamps, and other internal metadata never enter searchable text.

### Supplying Dashboard renderer context

1. After Dashboard has determined its eligible result IDs, it calls `readLine3Candidates()` once for the loaded set rather than issuing a read from each List row.
2. The reader applies registry-owned visibility semantics, live lifecycle conditions, and per-contact bounds before returning candidates. Its headroom prevents a future hidden-by-default type from starving visible content.
3. Dashboard selection prioritizes imminent information, pinned context, then other useful knowledge. If none qualifies, it shows a contact-stable gentle prompt; birthdays and AI-generated copy are excluded.

### Current-state history

1. A user sets Last Talked About or Current Location through `MemoryHistoryScreen`.
2. `setCurrentStateValue` demotes any existing current row and inserts the new current row in one transaction.
3. The drill-in renders the current value separately from earlier entries; editing an earlier entry is scoped by contact, field, and row identity.
4. Promoting an earlier value atomically demotes the displaced current value instead of deleting it.
5. The History & Insights Detail Sheet surfaces current-state changes as its third "knowledge-change" record family: `history-read` unions `getCurrentStateHistory` over **every** registered current-state field (calling it once would drop the others), and each row carries its `fieldKey` so a Detail Sheet tap routes back to `MemoryHistoryScreen` for editing. See `interaction-history.md`.

### Rapid Update Contact editing

1. Update Contact provides focused local editors for Memories, Key People, Last Talked About, Current Location, Off Limits, Contact Method, Contact Frequency, and existing custom fields; it returns to the targeted chooser after each independent save until Done.
2. Last Talked About and Current Location use the current-state writer, so they retain prior values as history and never create an interaction or change `last_contact`.
3. Quick Log's post-save editor stores either an Interaction Note or a basic Memory, never both. Full Memory creation and in-place editing stay in the Update Contact Memory editor.

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
| `DEFAULT_MEMORY_TYPE_KEY` | `general` | `src/db/memory-registry.ts` | Stable registry key requested by rapid capture; its display name is Memory. |

## Decisions

- **ADR-088:** Additive Contact-Knowledge Schema and Application-Owned Memory Registry — defines the new tables and fixed in-code type boundary.
- **ADR-089:** Recoverable Memory Lifecycle and Contact-Operation Integrity — defines recovery, expiry, merge, and purge behavior.
- **ADR-081:** Retire AI-Proposed Fuel for Explicit Per-Item Permission — moves retired fuel into default-off Memories and establishes explicit Memory consent.
- **ADR-091:** Imported Contact Notes as AI-Off Typed Memories — adds the searchable imported type and durable import boundary.
- **ADR-094:** Eligibility-Scoped Semantic Dashboard Search — preserves typed provenance in an eligible-ID-scoped Dashboard corpus.
- **ADR-098:** Scan-First, Accessible Dashboard List Rows — uses bounded visible knowledge for deterministic List context without adding a row-local read path.
- **ADR-100:** Relevance-First, Visibility-Safe Dashboard List Search — preserves only safe knowledge in List search explanations and snippets.
- **ADR-101:** Avatar-First Accessible Dashboard Card Renderer — reuses the same bounded candidates and semantic search descriptors for compact Card context.

- **ADR-110:** Coherent Local Profile Snapshot and Source-Owned Knowledge Projection — lets Profile shape compact knowledge while each source retains its writer and permission semantics.
- **ADR-119:** Reusable Count-Only History Aggregation and Canonical History Read — the canonical History read composes the read-only `getCurrentStateHistory` surface to expose current-state changes as the Detail Sheet's knowledge-change record family.
- **ADR-131:** Progressive Contact Creation and Complete-Record Editing — composes complete-edit knowledge changes under the contact aggregate transaction.
- **ADR-132:** Focused Rapid Capture Workflows — supplies focused update and Memory-editor paths without flattening knowledge semantics.
- **ADR-134:** Read-Only Compose Research and Permission-Bounded Message Focus — adds the normalized Research projection and source-owned focus eligibility.
- **ADR-107:** Off Limits Excluded from All AI Egress — keeps human-visible Avoid context out of Message Focus and every AI-bound shape.
- **ADR-136:** Permission-Bounded Prompt Assembly and AI Transparency — applies durable new-item defaults and consumes only explicit egress permission.

## Gotchas

1. **Profile presentation does not change source semantics.** The coherent Profile snapshot may cap, group, or hide a card, but edits and durable visibility stay with the owning Memory, relationship, current-state, custom-field, or fuel workflow.

1. **Memory types are not user-created records.** A user-labelled Custom item is allowed; a user-writable type set would reverse ADR-028.
2. **Memory AI permission is explicit.** Visibility, provenance, and type are not egress permission; only the SQL eligibility predicate may admit an opted-in live row.
3. **Search is local but not SQL fuzzy search.** Do not add FTS5 or an index; the SQL read establishes eligibility and the TypeScript scorer ranks its bounded result set.
4. **Nothing watches timestamps.** Retention is a foreground launch sweep, never a timer or trigger.
5. **Do not nest transaction wrappers.** Sweep expiry calls a non-mutexed core after obtaining its own write transaction.
6. **Current-state promotion preserves history.** The partial unique index enforces one current row; it does not authorize deleting the displaced value.
7. **Relationships are Undo-only after removal.** Recently Deleted is a Memory recovery surface, not a general relationship trash browser.
8. **Search scope is supplied by Dashboard.** The corpus must never broaden that eligible-ID set or add an unscoped global reader.
9. **Dashboard List context is also visibility-scoped.** Do not select hidden, deleted, outdated, or quarantined data merely because it would fill a sparse row.
10. **Card compactness is presentation, not a new relevance tier.** Card View may choose a concise candidate only within the same imminent, pinned, and other priority tier ordering.
11. **Current-state is not a touchpoint.** Last Talked About and Current Location writes preserve knowledge history but must never write an interaction or `last_contact`.
12. **Local visibility is not Message Focus eligibility.** Compose Research may display an item that lacks AI permission; only its normalized `aiEligible` value can enable Add to AI.
13. **Permission defaults are new-item-only.** Changing a type default must not rewrite existing Memory permissions; the manager's explicit review and bulk actions own those rows.

## Related Systems

- **Persistence core** — runs migration 016 and the launch-sweep registry.
- **Contacts** — owns the profile entry point and explicit contact-purge fan-out.
- **Contact reconciliation** — reparents knowledge rows inside a contact merge.
- **App shell** — registers the typed routes in both contact-navigation stacks.
- **Custom fields** — remain structured and render as a read-only grouped portion of Things to Remember.
- **Conversational fuel** — legacy share and AI-proposal rows migrate into Memories through the verified phase-24.2 data move.
- **AI suggestions** — consumes only the explicit, SQL-gated Memory projection.
- **AI suggestions** — consumes the closed prompt projection; Compose Research remains useful even when no item is AI-eligible.
- **Contact import** — supplies imported Notes as AI-off typed Memories.
- **Dashboard** — consumes bounded visible candidates for List and Card context and the visible corpus for semantic search.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-09-03 | 24.1 | Created the typed local contact-knowledge model, recovery lifecycle, and unified Things to Remember surface. |
| 2026-09-03 | 24.2 | Added explicit default-off Memory egress permission, local knowledge-search corpus, and imported Notes type. |
| 2026-09-02 | 25 | Added eligible-ID-scoped semantic search provenance, matching, and highlight offsets for Dashboard consumption. |
| 2026-09-02 | 27 | Added bounded visibility-safe candidates for deterministic List context and tightened List search presentation boundaries. |
| 2026-09-02 | 28 | Reused bounded candidates and shared descriptors for compact Card View context and search presentation. |
| 2026-09-02 | 31 | Added typed source-owned knowledge projections to one coherent Profile snapshot, including explicit local-only Off Limits presentation. |
| 2026-09-02 | 32 | Widened `getCurrentStateHistory` to a read-only executor surface so the canonical History read composes it; current-state changes now surface as the History Detail Sheet's knowledge-change record family, routing edits back to `MemoryHistoryScreen` by `fieldKey`. |
| 2026-09-02 | 34 | Added focused Update Contact knowledge editors, registry-keyed rapid Memory creation, and complete-edit transaction composition. |
| 2026-09-02 | 35 | Added populated-only, read-only Compose Research with source-owned eligibility and structural Off Limits Avoid context. |
| 2026-09-02 | 36 | Added creation-time AI permission defaults, central review, and bounded resolved-prompt Memory context. |
