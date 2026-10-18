# Contact Knowledge

**Last updated:** 2026-10-18
**Updated by phase:** 38.12-lifecycle-import-settings-ux
**Owners:** `src/db/memory-registry.ts`, `src/db/memories-dao.ts`, `src/db/memories-read.ts`, `src/db/relationships-dao.ts`, `src/db/relationships-read.ts`, `src/db/current-state-history-dao.ts`, `src/db/current-state-history-read.ts`, `src/db/off-limits-dao.ts`, `src/db/off-limits-read.ts`, `src/db/knowledge-move-dao.ts`, `src/db/linked-entry-dao.ts`, `src/db/undo-restore.ts`, `src/db/first-class-knowledge-read.ts`, `src/db/knowledge-search-read.ts`, `src/db/dashboard-knowledge-read.ts`, `src/services/knowledge-search.ts`

## Purpose

Contact Knowledge gives a contact one local Things to Remember surface without flattening different kinds of information into one record. It combines typed Memories (including Gift Ideas, Thought of Them and Imported notes), structured key people, dated Last Talked About and Current Location entries, an AI-free Off Limits list, first-class contact properties and read-only custom fields, all in on-device SQLite.

## Architecture

### Data Model

Migration 016 added `memories`, `relationships` and `current_state_entries`; migration 033 added `off_limits`, rebuilt `current_state_entries` with dates and links, added interaction links to `memories`, and dropped the retired `fuel` table (ADR-207, ADR-208). The in-code registry owns the Memory type set and the current-state fields; it is not a user-writable table.

**Tables:**
- `memories` — typed repeatable contact knowledge.
  - `uid` (`TEXT UNIQUE`), `contact_id` (`INTEGER`, cascaded on permanent contact deletion).
  - `type`, `custom_label`, `value`, `note`, `url`, `meaningful_date` (`TEXT`) — typed content; any type may carry a label (ADR-207).
  - `pinned`, `outdated` (`INTEGER`) — presentation and lifecycle state.
  - `allow_ai` (`INTEGER`) — explicit per-item egress permission, default off.
  - `hidden` (`INTEGER NULL`) — stored Profile visibility override; ignored for display while `HIDE_FROM_PROFILE_ENABLED` is false (ADR-218).
  - `provenance` (`TEXT`) — `user`, `import` or `share`.
  - `interaction_id` (`INTEGER NULL`, `ON DELETE SET NULL`), `link_source` (`note` | `group_note`) — the "Also save to" link; `UNIQUE(interaction_id, link_source)` where linked (ADR-211).
  - `group_note_copy` (`INTEGER`) — set on a Group Note copy; `CHECK (group_note_copy = 0 OR allow_ai = 0)`.
  - `created_at`, `modified_at`, `deleted_at` — `deleted_at` is never written any more (ADR-212).
- `relationships` — key people: `person_name`, `relation_type`, `note`, optional `linked_contact_id` (set NULL if that contact is deleted; `CHECK` against a self-link), `pinned`, `hidden`, timestamps.
- `current_state_entries` — Last Talked About and Current Location entries (ADR-210).
  - `field_key`, `value`, `entry_date` (`TEXT NOT NULL`, `YYYY-MM-DD`), `entry_time` (`HH:MM:SS`, linked entries only), `url`.
  - `interaction_id`, `link_source`, `group_note_copy`, `from_share` — link and origin markers; no `is_current` flag.
  - Index `idx_current_state_order (contact_id, field_key, entry_date, created_at)`.
- `off_limits` — topics to avoid: `label`, `text`, `url`, `group_note_copy`, `from_share`, timestamps. **No AI permission column** (ADR-207).
- `interactions.note_ai_locked` — set when a linked entry moves into Off Limits; `CHECK (note_ai_locked = 0 OR allow_ai = 0)` (ADR-213).

**Types** (`src/db/memory-registry.ts`):
- `MemoryTypeKey` — `general` (shown as "Memory"), `gift_idea` ("Gift Ideas"), `thought_of_them` ("Thought of Them"), `imported` ("Imported from Contacts App", `userPickable: false`).
- `MemoryTypeMeta` — display name, cardinality, search flag, new-item AI default, visibility default, order and `userPickable`.
- `CurrentStateFieldKey` — `last_talked_about`, `current_location`.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|-------|------|----------------|
| Registry | `src/db/memory-registry.ts` | Memory types, current-state fields, `HIDE_FROM_PROFILE_ENABLED`. |
| Memory writer | `src/db/memories-dao.ts` | Add, edit, delete-now and Undo; registered type and provenance kept; share/import/copy rows forced AI-off. |
| Memory reader | `src/db/memories-read.ts` | Live projections, `resolveVisibility`, `MEMORY_AI_ELIGIBILITY`. |
| Relationship writer/reader | `src/db/relationships-dao.ts`, `src/db/relationships-read.ts` | Key people, self-link rejection, delete-now and Undo; linked names. |
| Current-state writer | `src/db/current-state-history-dao.ts` | Plain dated inserts, edits (date, URL), delete and Undo. |
| Current-state reader | `src/db/current-state-history-read.ts` | `currentStateOrderSql` and every dated read. |
| Off Limits writer/reader | `src/db/off-limits-dao.ts`, `src/db/off-limits-read.ts` | Scoped writes by `(id, contact_id)`; `listOffLimitsForContact`. |
| Move writer | `src/db/knowledge-move-dao.ts` | Moves between sections, `fieldsDroppedByMove`, move Undo. |
| Linked entries | `src/db/linked-entry-dao.ts` | Linked inserts, text/date propagation, Group Note copies and detach. |
| Undo helpers | `src/db/undo-restore.ts` | `undoModifiedAt`, `deleteStampAt`, `resolveUndoLinkCore`. |
| First-class reader | `src/db/first-class-knowledge-read.ts` | Core contact fields. |
| Dashboard candidates | `src/db/dashboard-knowledge-read.ts` | Bounded visible candidates for List and Card. |

### Key Files

| File | Role |
|------|------|
| `src/db/migrations/016-contact-knowledge.ts` | Frozen original schema. |
| `src/db/migrations/033-knowledge-homes.ts` | Off Limits, dated current state, links, markers, the fuel move. |
| `src/db/legacy-fuel-mapping.ts` | The legacy kind → home mapping shared with the v7 backup converter. |
| `src/db/knowledge-search-read.ts` | Local, metadata-free search corpus. |
| `src/services/knowledge-search.ts` | Bounded matching with raw-text offsets. |
| `src/screens/SectionEditorScreen.tsx` | Editor for Memories, Thought of Them, Gift Ideas and Imported. |
| `src/screens/KeyPeopleEditorScreen.tsx` | Key People editor. |
| `src/screens/OffLimitsEditorScreen.tsx` | Off Limits editor (`off-limits-editor-controller.ts`, `OffLimitsForm.tsx`). |
| `src/screens/MemoryHistoryScreen.tsx` | Last Talked About / Current Location history page. |
| `src/screens/MemoryAddScreen.tsx` | + → Memory add form. |
| `src/components/MemoryEditor.tsx` | Memory draft form, card edit mode, Allow AI in the draft. |
| `src/components/MoveEntrySheet.tsx` | Move sheet and drop confirm. |
| `src/db/compose-research-read.ts` | Compose Research projection with source-owned AI eligibility; photo-type custom fields are never listed (ADR-248). |

## How It Works

### Reading Things to Remember

The Profile reads every source in one snapshot (`profile-knowledge-read.ts`, see `profile.md`). Each section has its own editor: Memories, Thought of Them, Gift Ideas and Imported → `SectionEditorScreen`; Key People → `KeyPeopleEditorScreen`; Off Limits → `OffLimitsEditorScreen`; Last Talked About and Current Location → `MemoryHistoryScreen`; Custom Fields → Edit Contact (ADR-219). Each editor uses a gated read with loading and Retry (ADR-168), applies the 38.9 standards, and reloads after a write. On these pages each card has a pencil that opens its form in place with Move and Delete; the Add sits at the top and morphs into a bottom-left section button when scrolled away (ADR-219).

### Reading Compose Research

1. Compose opens a sibling Research screen that calls `readComposeResearch()` locally on focus; it owns no writer.
2. The read composes populated, visible memories (every type, grouped by section name; a label becomes the item's label line), key people, current-state entries (with their date), first-class fields, custom fields (toggles read Yes/No through the Profile formatter) and Off Limits into `ResearchItem` records. Grouping uses a first-seen map by group id, not consecutive runs (D-29).
3. Each item carries the source-owned `aiEligible` result: a memory is eligible only if it is in `listAiEligibleMemories`; custom fields follow `share_with_ai`; key people, first-class values, current state and Off Limits never are.
4. Off Limits renders under an "Off Limits" heading (formerly "Avoid"; the Profile helper "Avoid bringing these up" stays); an item with no label shows its text once (D-87, D-105, D-111). Contact frequency reads "Every 30 days"; the empty state reads "Nothing to remember yet" (D-125, D-126).

### Creating and maintaining a Memory

1. `MemoryEditor` keeps the draft (text, label, type, note, link, meaningful date, Allow AI) and has no DAO access; it reports `{open, dirty}` so Back and Cancel prompt only for typed text (ADR-200). The meaningful date is a native picker with Clear, stored as `YYYY-MM-DD` (ADR-205). A link must be a valid http(s) URL (`url-validation.ts`).
2. `addMemory` / `editMemory` validate the registry key; blank optional metadata becomes NULL. `editMemory` writes a changed Allow AI with the text in one transaction and one revision bump (ADR-214).
3. The editor keeps the stored type on save and Imported is never offered in the picker (ADR-207, D-35); `ImportedTypeProvenanceError` guards the type.
4. Live reads return rows with `deleted_at IS NULL`.

### Last Talked About and Current Location

1. Entries are dated: a direct add takes a date picker (today by default, never after today); a linked entry takes its interaction's date and time; a share is dated today (ADR-210).
2. Every reader orders through `currentStateOrderSql`: date, then time where present, else creation time. Most Recent is the first row; the Profile shows it plus up to five Previous and "See all (N)".
3. The history page shows dates only, opens a linked entry's interaction on tap (Edit on long-press), deletes with Undo, and has no Make current.
4. History (`history-read.ts`) shows unlinked current-state rows as knowledge rows; linked entries appear only as a section tag on their interaction (see `interaction-history.md`).

### Linked notes ("Also save to")

1. Log Interaction, the Add Note sheet and Group Log can save a non-blank note to one section (ADR-211). `insertLinkedEntryCore` writes the entry in the same transaction, copying the interaction's (clamped) `allow_ai`; a Group Note copy is always 0.
2. Text moves only through the interaction writer: an edit on the interaction propagates to the entry (`propagateInteractionEditCore`); an edit on the entry routes through `editInteractionNoteCore`. A participant's own linked note may not be cleared (`LinkedNoteBlankError`).
3. A Group Note copy detaches on its own edit (D-117), and all copies detach when the Group Note is cleared, the event deleted, the participant detached or the group dissolved; the lock stays (D-102, D-113).
4. Deleting the interaction leaves a standalone entry (`ON DELETE SET NULL`).

### Deleting and Undo

1. Every item deletes at once with an Undo snackbar, then permanently with a tombstone (ADR-212). The delete core returns a snapshot; Undo re-inserts the row live with the same uid, reusing the old id only when free and resolving links by uid.
2. Deleting a linked entry removes only the entry; the interaction and its note stay.
3. Delete cores take `{ bumpRevision }`; Undo cores never bump; each wrapper bumps once.
4. On Add/Edit Contact a delete is held until Save (D-104).

### Moving entries

1. `moveKnowledgeEntry` moves between Memories, Thought of Them, Gift Ideas, Last Talked About and Off Limits (ADR-213). Within memories it is a type change; across tables the source delete core runs (no bump), then the destination insert, in one transaction.
2. `fieldsDroppedByMove` lists what the target cannot hold (note, meaningful date, pinned, label, linked note, entry date…); `MoveEntrySheet` confirms before dropping.
3. A move into Off Limits sets the entry AI-off for good and, if linked, locks the interaction note (`note_ai_locked`). Cross-table moves offer Undo; the AI-off effect stays.
4. A moved share keeps its share marker (`from_share` / provenance) for picker recency.

### Controlling AI eligibility and local search

1. A new memory seeds `allow_ai` from its type's default (`ai_default_memory_allow`, `ai_default_gift_idea_allow`, `ai_default_thought_of_them_allow`); shares, imports and Group Note copies are always 0 (ADR-214).
2. `listAiEligibleMemories()` applies `MEMORY_AI_ELIGIBILITY` in SQL. Off Limits, Last Talked About and Current Location never reach an AI read.
3. The search corpus covers names, methods, category, searchable memory types, key people, every current-state entry and Off Limits label and text, each hit naming its section (ADR-215).

### Rapid Update Contact editing (retired)

Update Contact, which offered focused editors for Memories, Key People, Last Talked About, Current Location, Off Limits and custom fields from the universal +, was retired in 38.11 (D-62); its code is kept as reference in `docs/archive/update-contact/`. Edit Contact is the single contact form; the Profile sections' own editors and add actions cover the same knowledge (memories are added from the Profile sections, Add/Edit Contact, the post-Quick-Log step and sharing, D-66). Current-state writes still never create an interaction or change `last_contact`.

### Importing contact notes

A selected Android contact note becomes an `imported` memory with `provenance='import'` and `allow_ai=0`; the import row keeps the committed identity so a resumed batch never duplicates it. Edit Contact shows it in its own Imported section with a fixed type (D-116).

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `HIDE_FROM_PROFILE_ENABLED` | `false` | `src/db/memory-registry.ts` | Switches Hide from Profile off everywhere; the stored flag is ignored (D-134). |
| `DEFAULT_MEMORY_TYPE_KEY` | `general` | `src/db/memory-registry.ts` | Default type; displays as "Memory". |

## Decisions

- **ADR-088:** Additive Contact-Knowledge Schema and Application-Owned Memory Registry — the original tables and fixed type boundary (partly superseded by ADR-207 and ADR-210).
- **ADR-089:** Recoverable Memory Lifecycle and Contact-Operation Integrity — merge and purge fan-out integrity (its Recently Deleted half is superseded by ADR-212).
- **ADR-081:** Retire AI-Proposed Fuel for Explicit Per-Item Permission — explicit Memory consent; migration 017's history.
- **ADR-091:** Imported Contact Notes as AI-Off Typed Memories.
- **ADR-094:** Eligibility-Scoped Semantic Dashboard Search.
- **ADR-098:** Scan-First, Accessible Dashboard List Rows.
- **ADR-100:** Relevance-First, Visibility-Safe Dashboard List Search.
- **ADR-101:** Avatar-First Accessible Dashboard Card Renderer.
- **ADR-107:** Off Limits Excluded from All AI Egress.
- **ADR-110:** Coherent Local Profile Snapshot and Source-Owned Knowledge Projection.
- **ADR-119:** Reusable Count-Only History Aggregation and Canonical History Read.
- **ADR-131:** Progressive Contact Creation and Complete-Record Editing.
- **ADR-132:** Focused Rapid Capture Workflows.
- **ADR-134:** Read-Only Compose Research and Permission-Bounded Message Focus.
- **ADR-136:** Permission-Bounded Prompt Assembly and AI Transparency.
- **ADR-160:** Committed-Identity Contact Edits and Exact-Source Reconciliation.
- **ADR-161:** Durable Post-Commit Import Recovery and AI-Off Provenance.
- **ADR-164:** Shared Post-Commit Assist Publisher with Surfaced Assist Failures.
- **ADR-168:** Truthful Read Phases — the editors' loading and Retry states.
- **ADR-174:** Fit-to-Width Heatmaps and Large-Text Reachability for Dialogs and Sheets.
- **ADR-200:** Unsaved-Work Guard — Memory, key-person and Off Limits drafts.
- **ADR-201:** Shared Child Header with a Chevron Back and a Person Line.
- **ADR-205:** One Date-Only Display Formatter, and Native Pickers for Memory and Custom-Field Dates.
- **ADR-207:** Knowledge Homes After Fuel — the Off Limits table, Gift Ideas and Thought of Them types, labels on every memory.
- **ADR-208:** Migration 033 — the fuel move, soft-deleted purge and table drop.
- **ADR-210:** Dated Last Talked About and Current Location — newest date is Most Recent.
- **ADR-211:** Linked Interaction Notes Through "Also Save To".
- **ADR-212:** One Delete Pattern — at once with Undo, then permanent.
- **ADR-213:** Moving Entries Between Things to Remember Sections.
- **ADR-214:** AI Permission for the New Knowledge Homes.
- **ADR-215:** Search and Glanceable Surfaces After Fuel.
- **ADR-218:** Things to Remember on the Profile — Hide from Profile switched off.
- **ADR-219:** Per-Section Editors Replace the Things to Remember and Memory Screens.
- **ADR-220:** Things to Remember Inline on Add and Edit Contact.
- **ADR-224:** One Contact Form and a Four-Action + — Update Contact's focused editors retired; knowledge is edited from Edit Contact and the Profile sections.
- **ADR-245:** A Flagged Custom-Field Value Opens Edit at That Field — Things to Remember shows one "Needs attention" marker and opens Edit at the field.
- **ADR-248:** AI Egress Narrows — `compose-research-read.ts` and `readPopulatedCustomFields` leave out photo-type custom fields.

## Gotchas

1. **Profile presentation does not change source semantics.** The Profile may cap or group a card; edits stay with the owning source's editor.
2. **Memory types are not user-created.** Labels are per item; a user-writable type set would reverse ADR-028's app-owned vocabulary, kept by ADR-207.
3. **AI permission is explicit.** Visibility, provenance, section and type are never permission; only `MEMORY_AI_ELIGIBILITY` admits a row.
4. **Off Limits has no AI column on purpose.** Never join Off Limits into a memory-shaped AI read; the guarantee is structural.
5. **There is no current flag.** Most Recent is the first row in `currentStateOrderSql` order; never add an `is_current`-style column or read.
6. **Linked text has one writer.** Never update a note-linked entry's text directly; route through `editInteractionNoteCore` so the interaction stays the source.
7. **Locks are set-only.** `note_ai_locked` and `group_note_copy` never clear; writers clamp `allow_ai` to 0 in SQL rather than fail a CHECK.
8. **Delete is hard.** Nothing writes `deleted_at`; the trash sweep and Recently Deleted are gone (ADR-212). This used to bite: soft-deleted rows written by debug builds between migration 033 and plan 18 could never be cleared (review IN-04; none found on the test phones).
9. **A round-trip move drops import provenance.** Moving an `import`-provenance `general` memory to Last Talked About or Off Limits and back recreates it as `user` ("Added by you"), and the drop confirm does not say so (review IN-05, open; reachable only for legacy rows, since imports write type `imported`, which cannot move).
10. **Hidden is ignored for display.** While `HIDE_FROM_PROFILE_ENABLED` is false, previously hidden items show on the Profile, in search, as Orrery satellites and in Message Focus (ADR-218).
11. **Current-state is not a touchpoint.** Last Talked About and Current Location writes never write an interaction or `last_contact`.
12. **Search scope is supplied by Dashboard.** The corpus never broadens the eligible-ID set.
13. **Permission defaults are new-item-only.** Changing a type default never rewrites existing rows.
14. **Imported provenance is not permission.** Every imported note persists `provenance='import'` and `allow_ai=0`.
15. **Nothing watches timestamps.** No timer or trigger; maintenance runs at launch.

## Related Systems

- **Persistence core** — runs migrations 016 and 033.
- **Contacts** — the contact-form aggregates and purge fan-out.
- **Contact reconciliation** — reparents knowledge and Off Limits rows in a merge.
- **Interaction log / history** — linked notes and History section tags.
- **Group Events** — Group Note copies.
- **Capture** — shares land in Thought of Them and move between sections.
- **Profile presentation** — the sections, heading actions and Pin.
- **AI suggestions** — consumes only the SQL-gated memory projection.
- **Backup & restore** — format 8 carries every home and marker.
- **Dashboard** — bounded candidates and the search corpus.
- **Conversational fuel** — retired in 38.10; its rows moved here through migration 033.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-09-03 | 24.1 | Created the typed local contact-knowledge model, recovery lifecycle, and unified Things to Remember surface. |
| 2026-09-03 | 24.2 | Added explicit default-off Memory egress permission, local knowledge-search corpus, and imported Notes type. |
| 2026-09-02 | 25 | Added eligible-ID-scoped semantic search provenance, matching, and highlight offsets for Dashboard consumption. |
| 2026-09-02 | 27 | Added bounded visibility-safe candidates for deterministic List context and tightened List search presentation boundaries. |
| 2026-09-02 | 28 | Reused bounded candidates and shared descriptors for compact Card View context and search presentation. |
| 2026-09-02 | 31 | Added typed source-owned knowledge projections to one coherent Profile snapshot, including explicit local-only Off Limits presentation. |
| 2026-09-02 | 32 | Widened `getCurrentStateHistory` to a read-only executor surface so the canonical History read composes it. |
| 2026-09-02 | 34 | Added focused Update Contact knowledge editors, registry-keyed rapid Memory creation, and complete-edit transaction composition. |
| 2026-09-02 | 35 | Added populated-only, read-only Compose Research with source-owned eligibility and structural Off Limits Avoid context. |
| 2026-09-02 | 36 | Added creation-time AI permission defaults, central review, and bounded resolved-prompt Memory context. |
| 2026-09-23 | 38.2 | Made imported-note creation explicitly AI-off and recovery-safe, and advanced complete-edit knowledge baselines from committed identities. |
| 2026-09-25 | 38.3 | Memory screen read-error state; editor never opens over a failed read (RG-035). |
| 2026-09-23 | 38.4 | Memory hosts decide AI availability with `isAiMasterEnabled`; `MemoryEditor` switches are named and themed (RG-008, RG-030; ADR-135, ADR-174). |
| 2026-10-11 | 38.9 | A Memory's meaningful date is a native date picker stored as `YYYY-MM-DD`; Memory and key-person drafts are guarded on Back, Cancel and fold (ADR-200, ADR-205). |
| 2026-10-13 | 38.10 | Code review IN-06: removed the test-only exports `setMemoryAllowAi`, `setCurrentStateValue`, `KNOWLEDGE_GROUP_ORDER` and `getFirstClassDerived`; tests use the live cores. |
| 2026-10-15 | 38.10 | Fuel retired: Off Limits table, Gift Ideas / Thought of Them types, labels on every memory, dated current state with no current flag, linked "Also save to" entries, one delete-with-Undo pattern (Recently Deleted and the trash sweep removed), moves between sections, per-section editors, Hide from Profile switched off (ADR-207..215, ADR-218..220). |
| 2026-10-16 | 38.11 | Update Contact retired (D-62) and its rapid knowledge editors archived in `docs/archive/update-contact/`; Memory left the universal + but stays reachable from the Profile in all five stacks (D-66). |
| 2026-10-16 | 38.11 | KB extraction: Decisions link ADR-224. |
| 2026-10-18 | 38.12 | Compose Research and the Research count leave out photo-type custom fields; a flagged custom value shows one marker and opens Edit at its field (ADR-245, ADR-248). |
