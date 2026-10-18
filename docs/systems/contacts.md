# Contacts

**Last updated:** 2026-10-18
**Updated by phase:** 38.12-lifecycle-import-settings-ux
**Owners:** `src/db/contacts-dao.ts`, `src/db/contact-read.ts`, `src/db/favourites-dao.ts`, `src/db/profile-dao.ts`, `src/db/contact-links-dao.ts`, `src/db/purge-dao.ts`, `src/db/recency-dao.ts`, `src/db/snooze-dao.ts`, `src/db/bulk-actions-dao.ts`

## Purpose

The contacts system holds the durable identity and core data for people in Orbit. It preserves a complete interaction history while maintaining a truthful `last_contact` summary for status and future contact surfaces.

## Architecture

### Data Model

All data is on-device SQLite. Migration 001 uses a surrogate `contacts.id` and a distinct unique `uid` on mergeable records; contact names are not unique.

**Tables:**
- `contacts` — person identity, category, interval, fixed contact data, lifecycle flags, timestamps, and `last_contact`.
  - `category_id` (`INTEGER`) — optional foreign key to `categories`.
  - `tracking_enabled` (`INTEGER`) — `1` for Bound active cadence management and `0` for an Unbound relationship record.
  - `interval_days` (`INTEGER`, nullable) — positive assigned cadence; `NULL` means cadence was never assigned and never means Unbound.
  - `last_contact` (`TEXT`) — maintained maximum qualifying interaction timestamp; `NULL` means never-contacted.
  - `rarely_responds` (`INTEGER`) — limits recency to connected interactions.
  - `archived_at` (`TEXT`) — archive lifecycle marker.
  - `photo` (`TEXT`, nullable) — validated relative path to the contact's local photo master.
  - `favourite_rank` (`INTEGER`, nullable) — legacy storage that marks membership; it is not user-facing Dashboard or widget order.
  - `snooze_until` (`TEXT`, nullable) — bare local `YYYY-MM-DD` that delays the next decay reminder without changing the contact clock. `9999-12-31` (`INDEFINITE_SNOOZE_UNTIL`) is the indefinite snooze, "Until I turn it off" (ADR-234).
  - `reminders_off` (`INTEGER`) — the retired per-person mute. Migration 034 converted every `1` to the indefinite snooze and cleared it; no UI writes it, and a restore maps `remindersOff = 1` to the indefinite snooze (ADR-234).
- `categories` — seeded Family, Friends, Work, and Community groups with display order.
- `profile` — one record for the user rather than a special contact row; its nullable `photo` holds the self master’s relative path.
- `contact_links` — ordered actionable web links belonging to a contact.
  - `uid` (`TEXT`) — stable mergeable row identity.
  - `contact_id` (`INTEGER`) — owning contact.
  - `url` / `label` (`TEXT`) — required destination and optional display label.
  - `display_order` (`INTEGER`) — insertion order for the v1 editor.
- `contact_methods` — ordered phone/email endpoints owned by a contact; scalar `contacts.phone` and `contacts.email` do not exist after migration 009.
  - `uid` (`TEXT`) — stable mergeable method identity.
  - `type`, `label`, `display_order`, and `is_primary` — grouping, optional durable label, ordering, and per-type default selection.
  - `canonical_value`, `canonical_region`, `extension`, and `actionable` — machine identity/provenance and safe action eligibility separate from stored presentation.
- `interactions` — individual touchpoints with local `occurred_at`, channel, connected state, source, and timestamps.
  - `direction` (`TEXT`, nullable) — `outbound`, `inbound`, or `mutual`; one-tap writes explicitly use `outbound`.
  - `quality` (`TEXT`, nullable) — optional `good`, `fine`, or `hard` refinement marker.
  - `note` (`TEXT`, nullable) — local-only free-text touchpoint detail.
- `events` — immutable archive, restore, snooze, and unsnooze history; these rows never participate in recency.
- `tombstones` — generic permanent retirement evidence; a merged-away contact has a `contact` tombstone and is not an archived contact.
- Contact Knowledge owns `memories`, `relationships`, `current_state_entries` and `off_limits`; their contact foreign keys cascade only for permanent contact removal, while contact merge reparents them explicitly.

**Types** (`src/db/contacts-dao.ts` and `src/db/recency-dao.ts`):
- `CreateContactFullInput` — a new contact, method drafts, optional first interaction, and custom values.
- `UpdateContactFullInput` — editable fixed metadata, method drafts, values, and a never-contacted first interaction.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Contact writer | `src/db/contacts-dao.ts` | Atomically creates and edits metadata, normalized method/custom-value pairs, and optional first interactions; archives and restores contacts with lifecycle-event composition. |
| Contact reads | `src/db/contact-read.ts` | Checks duplicate names, reads categories, and assembles scalar-free edit/header data. |
| Lifecycle DAO | `src/db/contact-lifecycle-dao.ts` | Performs guarded Bind and Unbind transitions without losing contact-owned data. |
| Favourites DAO | `src/db/favourites-dao.ts` | Marks and clears binary favourite membership without a rank-rewrite operation. |
| Profile DAO | `src/db/profile-dao.ts` | Reads and updates the single self record’s local photo reference. |
| Links DAO | `src/db/contact-links-dao.ts` | Lists and applies scoped add/edit/remove changes for ordered link rows. |
| Recency DAO | `src/db/recency-dao.ts` | Is the sole owner of `last_contact` recomputation. |
| Snooze DAO | `src/db/snooze-dao.ts` | Is the sole writer of `snooze_until` and records paired lifecycle events. |
| Purge DAO | `src/db/purge-dao.ts` | Computes the destruction summary and performs archive-guarded fan-out deletion, including normalized custom-value children. |

### Key Files

| File | Role |
|---|---|
| `src/db/contacts-dao.ts` | Composed create/edit path that seeds normalized custom-value pairs plus archive, restore, and archived-list reads. |
| `src/db/imported-contact-dao.ts` | Composes imported contact creation or explicit linking with source evidence and import-row resolution. |
| `src/db/contact-read.ts` | Duplicate-name, category, header, and edit-form data reads. |
| `src/db/picker-read.ts` | Local action-picker projection with favourite membership, recency, name, snooze, and archive state. |
| `src/db/contact-lifecycle-dao.ts` | Named lifecycle transitions with exact state guards and one revision increment. |
| `src/db/favourites-dao.ts` | Dedicated binary-membership writes that leave recency unchanged. |
| `src/db/profile-dao.ts` | Single-row self photo reads and writers. |
| `src/db/contact-links-dao.ts` | Ordered child-table CRUD for contact links. |
| `src/db/recency-dao.ts` | Single-writer interaction/recency cores used by composed contact writes. |
| `src/db/snooze-dao.ts` | Local-date snooze and clear writes with immutable event composition. |
| `src/db/events-dao.ts` | Insert-only lifecycle writer composed by archive and restore. |
| `src/db/bulk-actions-dao.ts` | Composes atomic Dashboard batch writes from existing transaction-owned cores. |
| `src/db/purge-dao.ts` | Explicit, transaction-scoped child deletion, including normalized custom-value pairs, and post-commit extension hook. |
| `src/db/merge-dao.ts` | Atomically consolidates two live contacts, reparents compatible children, and tombstones the absorbed identity. |
| `src/screens/CreateContactScreen.tsx` | Lean fixed-first create form. |
| `src/screens/EditContactScreen.tsx` | Always-show edit form for fixed fields, links, and custom values. |
| `src/screens/ArchivedContactsScreen.tsx` | The Bin (Settings → Bin; route id `Archived`): restore and impact-summary purge surface. It reloads on focus and after any failed write, and shows a loading line before its first read. Rows show avatar, name and the date moved to the Bin, a Restore button and Delete permanently behind a row ⋯ (ADR-232). |
| `src/screens/CaptureScreen.tsx` | Uses the existing name-only contact create path when a shared item has no owner yet. |
| `src/screens/ContactProfileScreen.tsx` | Provides the configured-provider AI draft entry without making a contact write. |

## How It Works

### Recording and maintaining recency

1. A caller creates a contact with an optional first interaction, or records, fully refines, or deletes an interaction for an existing contact.
2. `recency-dao` rejects future occurrence times, then runs the mutation inside the shared mutex and a hand-rolled SQLite transaction.
3. The DAO recomputes `last_contact` as `MAX(occurred_at)` across current interaction rows; a rarely-responds contact counts only connected rows.
4. A missing qualifying row produces `NULL`, which keeps the person out of normal status reads until an interaction exists.

### Creating and editing a contact

1. Add Contact starts with Identity, Relationship Basics, and Contact Methods; advanced relationship knowledge is behind Show More, duplicate names warn at submit but never block save, and Name is the only required field. Show More first reveals an open "Birthday, social battery & links" section (38.11 D-48).
2. `createContactFull()` opens one shared transaction, inserts the contact (including optional `birthday` and `social_battery` columns; a birthday must pass `isValidStoredBirthday` before the transaction opens), seeds one blank uid-bearing pair for every custom-field definition including quarantined definitions, and composes submitted methods, links (the non-bumping `addLinksCore`) and advanced knowledge through transaction-owned cores, with one `data_revision` bump. A create that sets a birthday reschedules notifications at once.
3. Today or Pick date uses recency cores to insert a manual, directionless interaction and recompute `last_contact`; “Not yet” writes no interaction and leaves `last_contact` `NULL`.
4. Edit Contact exposes fixed, custom-field, and direct-access knowledge sections under one form-level Save. Add and Edit Contact show Things to Remember inline in the Profile order (Last Talked About, Key People, Current Location, Memories, Thought of Them, Gift Ideas, Custom Fields, Off Limits, and on Edit Contact the Imported note), with solid Add buttons, the shared entry field, an always-visible dated box for Last Talked About and Current Location, and deletes held until Save (ADR-220, ADR-212). Changing `rarely_responds` recomputes recency because it changes the qualifying interaction set.
5. Contact aggregate saves compose method drafts and knowledge diffs (Off Limits rows in `off_limits`, every memory type, key people, dated current-state entries, Allow AI as draft state) in the same transaction, with one `data_revision` bump; held deletes call the tombstone cores with `bumpRevision: false`; same-contact canonical duplicates collapse with typed feedback while shared methods on different contacts remain legal.
6. No cadence starts a contact Unbound. Selecting a cadence coordinates Bound state, while a Bound-to-Unbound edit retains any assigned cadence as dormant rather than clearing it.
7. The Profile's Birthday sheet (38.11 D-59) writes only the birthday through `setContactBirthday` (`src/db/contacts-dao.ts`): an invalid value is rejected before the transaction opens, then one `?`-bound `UPDATE contacts SET birthday, modified_at`, a `changes === 1` guard and one `data_revision` bump. It does not go through `updateContactMetadataCore`, which rewrites every metadata column. The Profile then reschedules notifications and refreshes the widget.

### Managing links and lifecycle

1. The link DAO applies each add, edit, or remove with both the link and contact identities scoped to the intended row; phone and email live in normalized method rows rather than fixed contact columns. On Add and Edit a link row with a blank URL is dropped on Save (`buildLinksForDiff`); a row that has a label but no URL shows the warn-only caption "Add a link or this row won't be saved." and never blocks Save (`LinksEditor`, 38.11 D-88).
2. Archive sets `archived_at` from the profile only when the contact is live, then composes an immutable archive event in the same transaction. Live reads exclude archived contacts; Settings owns the distinct Bin (Settings → Bin), the user-facing name for archived contacts since 38.11 (D-69); the profile action that archives is "Move to Bin".
3. Restore clears the marker only when the contact is archived and records a matching restore event. The Bin list shows "Restored <name>" with Undo, which puts the original `archived_at` back, and reconciles the reminder schedule and widget after the write (ADR-232). A binned contact is refused by every lifecycle writer (bind, unbind, snooze, unsnooze, favourite rank, a participation change in `updateContactFull`) with `ContactInBinError` from `assertContactNotInBinCore`; Edit Contact disables its Bound/Unbound chips for them. Purge first verifies the archived state inside its write transaction, then explicitly counts and deletes interactions, events, Off Limits rows, normalized custom-value pairs, links, field history, and contact-knowledge children before deleting the contact. Pending interaction assists are the one child removed by FK cascade rather than the explicit fan-out (a documented exception — assists are device-local and transient; see ADR-073).
4. Photo-file and notification cleanup are idempotent best-effort post-commit extensions registered by their owning systems.
5. `purgeContactCore(exec, contactId, { now, requireArchived = true, bumpRevision = true })` runs the fan-out inside a caller's transaction and returns its post-commit cleanup as a closure; `purgeContact` wraps it with the archive gate on and one bump. Only share Undo of a share-created contact passes `requireArchived: false` (ADR-217). The Delete permanently dialog no longer lists a fuel line, and memory and key-person counts are live rows only (D-87, D-88).

### Binding and unbinding a relationship

1. A profile action uses the named lifecycle DAO; an aggregate edit persists its lifecycle change in the same contact transaction.
2. Unbind preserves cadence, favourite rank, interactions, and `last_contact`, then removes the contact from proactive projections. Bind reuses dormant cadence or requires a new positive cadence when none was assigned.
3. After a durable change, the lifecycle-effects service reconciles notifications and refreshes the widget. An effect failure cannot roll back the committed contact state.
4. On the Profile, Bind shows "Bound <name>" and Unbind "Unbound <name>", each with Undo running the opposite transition (`runProfileLifecycleTransition`, ADR-233). The Bind card's Change writes a new frequency through `setProfileContactFrequency` before binding, because `bindContact` keeps a dormant cadence.

### Reconciling portable contact data

1. Backup reconciliation identifies contacts and seeded categories by stable UID, never by a device-local integer primary key.
2. A winning contact tombstone removes mergeable children in the same transaction; an equal timestamp favors deletion.
3. Restore writes surviving contact rows before children, maps category UIDs back to local IDs, and recomputes `last_contact` from interactions rather than importing a cached summary.

### Managing contact and self photos

1. The edit form holds a contact photo separately from unsaved fixed-field edits and refreshes it on focus without reseeding the form.
2. Dedicated contact and profile DAO writers store or clear only the validated relative photo path; the ordinary metadata update deliberately does not own photo writes.
3. The shared photos pipeline owns file persistence and inline deletion, while contact reads supply `photo` and `modified_at` to the profile avatar.

### Managing favourites

1. The contact-profile star reads `favourite_rank` from the header and calls `setFavouriteRank()` or `clearFavouriteRank()`.
2. The star is the only user-facing favourite-order control: no Manage favourites screen or rank-rewrite writer exists.
3. Dashboard and Widget reads treat a non-NULL stored rank as binary membership and apply their own documented Default ordering; the DAO never writes `last_contact`.
4. Successful favourite, metadata, archive, restore, and photo-facing mutations publish a best-effort Widget refresh after their database work commits; this publisher does not alter the contact transaction.

### Applying Dashboard bulk contact changes

1. A Dashboard selection passes selected IDs to `bulk-actions-dao`; each non-empty operation opens one outer transaction, invokes the relevant non-mutexed contact core per ID, and bumps data revision once.
2. Category and frequency writes update only their named contact column and `modified_at`; category targets are revalidated against the current canonical catalog before the batch writer runs, and Uncategorized is stored as `NULL`. Frequency rejects non-positive or fractional values before the transaction. Favourite operations remain explicit add or remove membership, never rank ordering.
3. Archive composes the same guarded archive core and immutable event as the single-contact lifecycle path. It is recoverable; permanent deletion remains archive-gated in the Bin (Settings → Bin). The bulk action reads "Move to Bin".
4. Snooze resolves one SQLite-local target date for a whole batch. All selected IDs are passed to each action, including Unbound or never-contacted contacts, matching the single-contact command boundary.

### Selecting a contact for a shell action

1. A global contact-specific shell action opens the reusable picker rather than changing Dashboard state.
2. `listPickerContacts()` groups favourite membership first, then sorts by `last_contact` descending and name; `favourite_rank` never determines picker order.
3. Archived contacts are absent from the default list and appear only when an explicit matching search term is supplied. Snoozed contacts remain selectable and are marked.

### Supplying a live compose header

1. `getContactHeader()` returns contact identity, photo freshness, and archive state without a scalar endpoint projection.
2. Compose separately requests the DAO-selected actionable primary method and treats an archived header as unavailable rather than showing a live messaging surface.
3. Send and Copy remain handoff-only actions; the contacts system receives no interaction or recency write from them.

### Starting an AI draft from the profile

1. Profile has no direct AI-draft action. Message opens Compose with contact identity only; Compose owns every optional Draft with AI invocation under ADR-079.
2. The entry navigates to Compose with `{ contactId, requestAiSuggestion: true }`; it passes no contact snapshot, prompt, credential, or callback.
3. Compose consumes the intent and owns all generation state. AI generation, acknowledgement, and draft replacement never write `contacts`, `interactions`, knowledge rows, or `last_contact`.

### Snoozing reminders

1. The profile's Snooze tile and ⋯ Snooze… open the shared snooze sheet (3 days, 1 week, 1 month, Choose date from tomorrow up to ten years, Until I turn it off, Unsnooze when snoozed); the Contacts card and bulk snooze use the same sheet (38.11 D-45, D-37, D-64; ADR-234). Edit Contact has no mute switch. Unbound and binned people get no Snooze entry on the Profile (ADR-233).
2. "Until I turn it off" stores `INDEFINITE_SNOOZE_UNTIL` (`9999-12-31`). Every snooze reader treats it like any future date, so it hides the person from decay pushes, Digest, Up next and the Contacts filters exactly as a dated snooze does; only display sites special-case it, through `snoozeUntilLabel`.
3. `snoozeContact()` writes `snooze_until` with SQLite local-date arithmetic and records an immutable `snooze` event in the same transaction; Clear writes `NULL` and an `unsnooze` event.
4. Neither path writes `last_contact`. The notification scheduler re-reads the committed contact state and cancels or re-arms the derived OS reminder.

### Creating a contact during capture

1. The share screen's New contact sheet validates a non-blank name; `createContactAndShare` builds a name-only `createContactFullCore` input itself (no first interaction or enrichment can reach it).
2. The name-only path uses `NEW_CONTACT_DEFAULT_INTERVAL_DAYS` (monthly, 30) and leaves `last_contact` `NULL`, so the contact remains never-contacted.
3. The contact and its first share are written in one transaction (D-28); the share never becomes an interaction. Undo of that share may remove the contact too while it owns nothing else (ADR-217).

### Creating or linking an imported contact

1. Contact Import maps an accepted selected-contact snapshot into `createContactFullCore()`, with Unbound lifecycle defaults for bulk work.
2. `importContactRecord()` opens one outer write transaction that creates a contact or explicitly links an existing contact, writes source links and method provenance, and resolves the durable import row.
3. The imported path uses the same normalized methods, custom-field pair setup, birthday validation, and lifecycle constraints as manual creation; it never silently overwrites an existing name.

### Merging duplicate contacts

1. A user selects a survivor and explicitly resolves genuine scalar, photo, or competing-primary conflicts before confirmation.
2. `mergeContacts()` resolves method and active-link collisions, reparents compatible contact-owned children, and snapshots a meaningful overwritten or dropped value in `field_history` inside one transaction.
3. It recomputes `last_contact` through `recency-dao`, deletes the absorbed live contact, and writes a generic contact tombstone. The absorbed identity is not archived or normally restorable.
4. The same transaction reparents compatible Memory, relationship, and current-state rows before deleting the absorbed contact; it reparents `off_limits` rows, and current state needs no demotion since Most Recent follows date order (ADR-210); it clears would-be relationship self-links rather than dropping history.
5. It also reparents retained custom-field value-history rows to the survivor. An archive-gated purge instead tombstones and explicitly deletes those rows before contact deletion.

### Participating in Group Events

The shared multi-select picker admits archived contacts through explicit search and keeps snoozed contacts selectable. Adding an archived participant records an ordinary child at the event’s historical local timestamp and recomputes `last_contact` without restoring the contact or changing `archived_at`.

Permanent contact purge removes and tombstones that contact’s child Interactions but does not remove a Group Event parent: `PURGE_CHILDREN.group_event` is explicitly `null`. Other participants and a now-empty event remain valid. Duplicate-contact merge checks same-event membership before reparenting; a collision refuses the whole merge with typed remediation and preserves both records.

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `FREQUENCY_DAYS` | 1, 7, 14, 30, 60, 90, 365 | `src/types.ts` | Maps named frequency presets to stored cadence days. |

## Decisions

- **ADR-208:** Migration 033 — purge counts and deletes `off_limits` children with tombstones.
- **ADR-211:** Linked Interaction Notes — the recency writer saves and propagates linked entries.
- **ADR-213:** Moving Entries — the recency writer's set-only `note_ai_locked` clamp.
- **ADR-008:** Initial Contact Schema as a Cross-Phase Data Contract — establishes contact identity, categories, profile, and durable fixed fields.
- **ADR-009:** Crash-Safe Forward-Only SQLite Migrations — commits the initial contacts schema atomically.
- **ADR-010:** Single-Writer Interaction Recency Spine — makes recency a serialized materialization of the interaction log.
- **ADR-011:** Query-Time Status and Never-Contacted Segregation — relies on contact cadence and the maintained never-contacted marker.
- **ADR-001:** Normalized Custom-Field Values — seeds immutable custom-value pairs on contact creation and deletes them during purge.
- **ADR-016:** Fixed-First Contact Forms and Atomic Contact Creation — composes the form’s multi-table write in one transaction.
- **ADR-017:** Multi-Link Contact Reachability — stores many ordered web links alongside normalized contact methods.
- **ADR-018:** Archive-Gated Contact Purge with Explicit Fan-Out — makes permanent deletion a guarded, auditable lifecycle action (one exception, ADR-217).
- **ADR-207:** Knowledge Homes After Fuel — the aggregates write `off_limits` instead of fuel (partly supersedes ADR-131).
- **ADR-212:** One Delete Pattern — held form deletes become tombstoned hard deletes at Save.
- **ADR-216:** A Share Saves at Once — atomic create-and-share with the monthly default.
- **ADR-217:** Share Undo Also Removes a Contact the Share Created.
- **ADR-220:** Things to Remember Inline on Add and Edit Contact.
- **ADR-021:** Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup — adds dedicated relative-path writers and photo cleanup to contact lifecycle work.
- **ADR-023:** Structured Touchpoints and One-Tap Defaults — defines touchpoint axes and explicit one-tap values.
- **ADR-024:** Editable Touchpoint History and Recomputed Recency — preserves the single writer across refinement and deletion.
- **ADR-025:** Immutable Lifecycle Events in a Unified Timeline — adds state-guarded archive and restore events to contact lifecycle work.
- **ADR-026:** Rogue Status for Unresponsive or Far-Overdue Contacts — uses the contact's Rarely-responds policy to filter qualifying recency.
- **ADR-033:** Profile Marking and Shared Drag-Reordered Favourites — owns reversible profile marking and guarded favourite-rank ordering.
- **ADR-075:** Binary Favourite Membership Without a User-Facing Order — makes favourite rank ineligible as a contact-picker sort key.
- **ADR-093:** Scoped Composable Dashboard Population and Filter Model — keeps favourite storage as membership while Dashboard/Widget use shared Default ordering.
- **ADR-082:** Universal Capture FAB, Canonical Picker, and Truthful Quick Log — adds the shared local target picker.
- **ADR-131:** Progressive Contact Creation and Complete-Record Editing — keeps creation quiet while composing complete edit knowledge atomically.
- **ADR-160:** Committed-Identity Contact Edits and Exact-Source Reconciliation — makes committed write returns the authority for post-save baselines and retry-safe child identity.
- **ADR-089:** Recoverable Memory Lifecycle and Contact-Operation Integrity — extends merge and purge with explicit contact-knowledge integrity work.
- **ADR-090:** Additive Custom-Field Value History and Deferred Contact Scope — requires retained field history to follow explicit contact lifecycle handling.
- **ADR-035:** Native SMS Handoff with Guaranteed Clipboard Copy — partially superseded; native handoff and Copy remain the interaction boundary.
- **ADR-059:** Normalized Contact Methods, Canonical Actionability, and Local Provenance — replaces scalar endpoint fields with ordered mergeable method rows.
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — separates active cadence participation from relationship data ownership.
- **ADR-066:** Deliberate Reviewed Import with Unbound Bulk Defaults — requires intentional review or safe shared defaults before a contact write.
- **ADR-067:** Conservative Advisory Identity Matching and Explicit Source Consolidation — permits only explicit linking or approved multi-source creation.
- **ADR-036:** Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails — rejects archived headers on the reusable live compose surface.
- **ADR-038:** Contact-Owned Share Capture Fuel — preserves name-only, never-contacted inline creation and prohibits a capture recency write.
- **ADR-039:** Pre-Scheduled Inexact Decay Reminders — uses cadence, snooze, mute, lifecycle, and status fields to determine derived reminder eligibility.
- **ADR-040:** Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing — routes mark-contacted and snooze through the established contact write boundaries.
- **ADR-043:** Static Globally Mirrored Favourites Widget — reuses one guarded favourite-rank list for every widget instance.
- **ADR-045:** Event-Driven Widget Refresh and Boot Recovery — refreshes the widget after committed contact-visible changes.
- **ADR-052:** Compose-Owned AI Draft Lifecycle and Acknowledged Egress — adds a configured-provider profile entry while retaining the contact-write boundary.
- **ADR-108:** Durable Independent-Axis Profile Presentation and Inheritance — makes individual and bulk Category changes preserve explicit contact presentation while inherited axes fall through.
- **ADR-111:** Cadence-Guarded Profile Metrics and Composed Relationship Actions — keeps Profile Frequency and Snooze on public contact-owned writers.
- **ADR-056:** Tombstone-Backed UID Reconciliation for Portable Restores — governs deletion evidence, seeded identities, and UID merge behavior.
- **ADR-057:** Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots — exports contact state through the portable manifest.
- **ADR-069:** Atomic Tombstone-Backed Orbit Contact Merge — requires explicit conflict review, atomic child consolidation, and retirement of the absorbed identity.
- **ADR-071:** User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer — assist confirmation recomputes `last_contact` through the same sole recomputer without a bespoke write.
- **ADR-073:** Merge-Reparented, Purge-Cascaded Interaction Assists — purge removes pending assists via FK cascade; merge reparents them to the survivor.
- **ADR-103:** Atomic Composed Dashboard Bulk Mutations — requires Dashboard batches to compose contact cores in one transaction without rank or lifecycle shortcuts.
- **ADR-142:** User-Owned Categories with Stable Identity and Canonical Ordering — preserves category assignment through rename using local IDs rather than display names.
- **ADR-143:** Lock-Time-Revalidated Atomic Category Deletion and System Fallout — reassigns affected contacts atomically to a selected survivor or Uncategorized.
- **ADR-144:** Complete Category Selection and Grouped Orrery System Discovery — requires mutable category selections to refresh and validate before contact writes.
- **[ADR-028: Per-Item Conversational Fuel with Fixed Kinds](../decisions/ADR-028-per-item-conversational-fuel-with-fixed-kinds.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-029: In-Query Fuel Eligibility and a Shared Ranked Projection](../decisions/ADR-029-in-query-fuel-eligibility-and-a-shared-ranked-projection.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-030: Explicit Confirmation of AI-Proposed Fuel](../decisions/ADR-030-explicit-confirmation-of-ai-proposed-fuel.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-060: Versioned Portable Method Graph and Collision-Normalized Restoration](../decisions/ADR-060-versioned-portable-method-graph-and-collision-normalized-restoration.md)** — governs `src/db/purge-dao.ts`.
- **[ADR-061: DAO-Selected Actionable Primary SMS Handoff](../decisions/ADR-061-dao-selected-actionable-primary-sms-handoff.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-072: Shared Actionable Reach Out Router with Native Channel Handoff](../decisions/ADR-072-shared-actionable-reach-out-router-with-native-channel-handoff.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-074: Widget Contact Supersession and Strict Reach Deep-Link Fail-Safe](../decisions/ADR-074-widget-contact-supersession-and-strict-reach-deep-link-fail-safe.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-079: On-Demand AI Transparency and Compose-Only Three-Suggestion Invocation](../decisions/ADR-079-on-demand-ai-transparency-and-compose-only-three-suggestion-invocation.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-091: Imported Contact Notes as AI-Off Typed Memories](../decisions/ADR-091-imported-contact-notes-as-ai-off-typed-memories.md)** — governs `src/db/imported-contact-dao.ts`.
- **[ADR-096: Dashboard Header and Overflow Discovery Paths](../decisions/ADR-096-dashboard-header-and-overflow-discovery-paths.md)** — governs `src/screens/ArchivedContactsScreen.tsx`.
- **[ADR-109: Fixed-Hero Semantic Profile Composition and Focused Accessible Editors](../decisions/ADR-109-fixed-hero-semantic-profile-composition-and-focused-accessible-editors.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-114: Route-Aware App-Wide System Background Composition](../decisions/ADR-114-route-aware-app-wide-system-background-composition.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-116: Value-Remapped Interaction Vocabulary and Optional Descriptive Duration](../decisions/ADR-116-value-remapped-interaction-vocabulary-and-descriptive-duration.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-117: Per-Interaction Allow-AI Consent Gate, Default-Off and Fail-Closed on Restore](../decisions/ADR-117-per-interaction-allow-ai-consent-gate.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-118: Bind/Unbind Immutable Lifecycle Events Without a Migration](../decisions/ADR-118-bind-unbind-immutable-lifecycle-events-without-a-migration.md)** — governs `src/db/contact-lifecycle-dao.ts`, `src/db/events-dao.ts`.
- **[ADR-122: Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet Through the Sole Recency Writer](../decisions/ADR-122-canonical-interaction-detail-edit-and-shared-detail-sheet.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-123: Profile History Section Replacing the Vertical Timeline, with Detailed-Log Backfill Routing](../decisions/ADR-123-profile-history-section-replacing-the-vertical-timeline.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-124: Group Event Parents with Canonical Per-Contact Children](../decisions/ADR-124-group-event-parents-with-canonical-per-contact-children.md)** — governs `src/db/purge-dao.ts`, `src/db/recency-dao.ts`.
- **[ADR-128: Same-Group Contact Merge Refusal with Remediation](../decisions/ADR-128-same-group-contact-merge-refusal-with-remediation.md)** — governs `src/db/merge-dao.ts`.
- **ADR-222:** Add Contact Opens Bound, Monthly and Not Yet — the create seed: Bound, Monthly, Not yet.
- **ADR-223:** Birthday, Social Battery, Links and a Held Photo on Add Contact — birthday, social battery and links in the one create transaction; held photo; Open existing on a duplicate name.
- **ADR-224:** One Contact Form and a Four-Action + — Edit Contact is the only contact form; its save exit.
- **ADR-225:** Profile Top: Edit Contact, Compose, Name in a Solid Top Bar, Slimmer ⋯ — the Profile's Edit Contact button and plain Unbind entry.
- **ADR-226:** Archive Becomes the Bin — user-facing Archive is the Bin; Move to Bin confirms; internal names unchanged.
- **ADR-227:** One Snooze Sheet — bulk Snooze writes every selected id; bulk Unsnooze only the snoozed subset.
- **ADR-229:** Birthday on the Profile — `setContactBirthday` and the shared BirthdayField.
- **ADR-231:** Open/Closed Sections, Layout Tools in the Sheets, All-Default Reset Row — Reset's all-default presentation row and share Undo's ownership rule.
- **ADR-232:** A Binned Person Gets a Bin Banner, an "In the Bin" Status and DAO Guards — `ContactInBinError` on every lifecycle writer; the Bin list's reload, rows, Restore Undo.
- **ADR-233:** The Profile ⋯ Follows Lifecycle State — Bind/Unbind Undo, the Bind card frequency, the Unbound star, the Unbound list subtitle and Settings row.
- **ADR-234:** Per-Person Mute Becomes an Indefinite Snooze — the sentinel, migration 034's conversion and the restore mapping.
- **ADR-235:** Merge Starts from the Profile — Merge from any live Profile.
- **ADR-242:** Backup Format 9 Carries Favourites — favourite membership in backups; a Bin person is never favourited by a Merge restore.

## Gotchas

1. **Use local wall-clock timestamps.** `occurred_at` and `last_contact` must not be supplied as UTC ISO strings or near-midnight status calculations can shift a day.
2. **Do not write `last_contact` anywhere else.** Every interaction mutation must use the recency DAO so summary and history remain coherent.
3. **Respect the lifecycle cadence invariant.** Bound requires a positive integer cadence; only a never-assigned Unbound contact may have NULL, and an assigned cadence is never cleared.
4. **Never nest `inWriteTransaction()`.** The contact create/edit paths call non-mutexed `*Core` methods inside their one outer transaction.
5. **Purge does not rely on cascades — with one documented exception.** `field_history` has no contact foreign key, and every owned child table is explicitly deleted before the contact row. The lone exception is `interaction_assists`, removed by its migration-014 `ON DELETE CASCADE` (transient device-local rows excluded from the portable/merge schema; ADR-073). Do not add other cascade-only children.
6. **Do not use the metadata save to write `photo`.** Photo persistence has dedicated writers so file lifecycle and form refresh behavior remain separate.
7. **Never record a lifecycle event for a no-op transition.** Archive and restore guard the current state before changing it; otherwise the immutable history would claim a false transition.
8. **Deleting a touchpoint is permanent.** The profile must confirm it before calling the recency DAO; there is no undo or backup path.
9. **Do not restore a rank-rewrite writer.** `favourite_rank` persists for internal readers, but favourites are binary membership and no user-facing reorder surface exists.
10. **A by-id header can still be archived.** Live callers such as Compose must inspect `archived_at`; the header seek intentionally does not apply a live-list filter itself.
11. **A capture is not contact.** Creating or selecting a contact for a share must leave `last_contact` unchanged and write no interaction row.
12. **Keep snooze dates local.** `snooze_until` is already a local bare date; parse or render it as UTC and near-midnight users see the wrong day.
13. **The mute is now a snooze.** `reminders_off` is retired; an indefinite snooze (`9999-12-31`) hides the person from every snooze-aware surface, unlike the old mute, which suppressed decay pushes only. Birthday alerts are unaffected (ADR-234).
14. **Publish widget refresh only after a successful mutation.** A failed favourite mark/clear, archive, restore, or metadata save must not advertise a state that SQLite did not commit.
15. **Profile does not invoke AI directly.** Message routes serializable contact identity to Compose; drafting still must not record recency or a touchpoint.
16. **Never materialize Category presentation.** Category changes preserve explicit contact overrides and let inherited layout/background resolve through the new Category or global/factory fallback.
16. **Use `createContactFull()` for production creation.** It is the path that seeds the complete custom-field pair matrix; the exported recency test helper writes no custom values.
17. **A hard delete must write its tombstone first.** Purge captures every mergeable child UID in its existing transaction; transient `field_history` remains excluded.
18. **`last_contact` is derived.** Restore recomputes it from interactions and never lets an imported summary win a reconciliation decision.
19. **Do not clear dormant favourite rank on Unbind.** Bound-only query owners hide it; retaining it lets a rebind restore the prior preference without a second write.
20. **Do not use a compatibility shortcut for imported contacts.** Import must compose the canonical creation core so contact invariants remain identical to manual creation.
21. **Do not merge through archive or direct recency SQL.** Archive makes a normal restore possible, and a merge-local `MAX` bypasses the single recency writer.
22. **Picker ordering is not favourite-rank ordering.** A favourite is a membership band only; use recency and then name inside that band.
23. **Do not rely on cascade for a merge.** Contact deletion would discard knowledge rows; merge must reparent them and resolve relationship/current-state collisions first.
24. **Retained custom-field history is a child with evidence.** Edit appends its prior raw value in the contact transaction; merge reparents it and purge tombstones it before deletion.
25. **A bulk action is not a set-based update.** Calling a public writer inside the batch deadlocks the non-reentrant transaction mutex; compose its core inside `bulk-actions-dao` instead.
26. **Archive batch state must include its event.** Updating `archived_at` without the immutable archive event breaks the lifecycle timeline.
27. **Off Limits has its own table.** The complete-edit diff reduces Off Limits drafts to id/label/text/url and writes `off_limits` only, scoped by contact; a legacy `kind` key on a draft is ignored. This used to bite as NEW-1: Add Contact saved Off Limits as AI-eligible topic fuel because the kind was not forced; fixed by the table (ADR-207).
28. **A failed post-write refresh is not a failed write.** Advance edit baselines and generated child identities from the committed DAO result before refreshing projections, so a safe retry cannot duplicate rows or replay lifecycle events.

- **Archived participation is allowed.** An archive guard or automatic restore prompt on Group Event insertion would reverse the owner-accepted recency behavior.

## Related Systems

- **Status engine** — derives progress from `last_contact` and `interval_days`.
- **Persistence core** — supplies the SQLite schema and transaction environment.
- **Custom fields** — contributes values to the contact create/edit transaction.
- **App shell** — provides the create, profile, edit, and archived navigation routes.
- **Dashboard** — reads contact projections and owns shared population ordering; it has no favourite-management screen.
- **Contact methods** — consumes the lightweight phone and archive header for Compose gating.
- **Capture** — selects or name-only creates the owner of a share while retaining the never-contacted state.
- **Notifications** — derives decay eligibility from contact state and owns the OS schedule.
- **Widget** — mirrors binary favourite membership and contact-visible fields without storing another configuration record.
- **AI suggestions** — receives a profile-originated Compose intent but has no contact-write authority.
- **Backup & Restore** — exports UID-bearing contact state and restores it through tombstone-aware reconciliation.
- **Contact Import** — creates or explicitly links contacts through the shared transaction seam.
- **Interaction Assist & Reach Out** — its confirmation reuses the sole recency recomputer; purge cascade-deletes and merge reparents its pending assists.
- **Contact Knowledge** — owns typed knowledge rows that profile navigation reads and contact lifecycle operations preserve or explicitly retire.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-14 | 02 | Created the contact foundation and single-writer recency invariant. |
| 2026-08-14 | 04 | Added atomic create/edit, multi-link reachability, and archive/restore/purge lifecycle flows. |
| 2026-08-15 | 05 | Added dedicated contact/self photo references, avatar reads, and photo-aware lifecycle cleanup. |
| 2026-08-15 | 06 | Added structured touchpoint refinement, connection-aware recency, and immutable archive/restore events. |
| 2026-08-15 | 08 | Added profile favourite marking and guarded shared rank reordering. |
| 2026-08-16 | 09 | Exposed phone through the lightweight header read and gated archived contacts from Compose. |
| 2026-08-16 | 10 | Added name-only capture creation that remains never-contacted and does not write recency. |
| 2026-08-16 | 11 | Added local snooze writes, durable reminder muting, and scheduling-state reconciliation. |
| 2026-08-16 | 12 | Published widget refreshes after committed favourite and contact-visible mutations. |
| 2026-08-18 | 14 | Added the configured-provider profile entry for a Compose-owned AI draft without contact-side effects. |
| 2026-08-24 | 16 | Seeded normalized custom-field pairs on create and deleted them explicitly on purge. |
| 2026-08-24 | 17 | Added tombstone-aware purge and UID-based portable restore behavior. |
| 2026-08-27 | 18.1 | Replaced scalar endpoint fields with transactional normalized method drafts and scalar-free reads. |
| 2026-08-27 | 18.2 | Added Bound/Unbound lifecycle writes, nullable never-assigned cadence, and post-commit proactive-surface effects. |
| 2026-08-26 | 19 | Added reviewed selected-contact create/link composition without bypassing contact invariants. |
| 2026-08-26 | 20 | Added explicit atomic duplicate merge, tombstone retirement, and recency recomputation through existing cores. |
| 2026-08-31 | 21 | Purge cascade-deletes pending `interaction_assists` (documented exception to explicit fan-out); assist confirmation reuses the sole recency recomputer. |
| 2026-09-02 | 22 | Added the local shell action-picker projection with membership-only favourites ordering and explicit archive search. |
| 2026-09-03 | 24.1 | Extended merge and archive-gated purge with explicit contact-knowledge preservation and fan-out. |
| 2026-09-03 | 24.2 | Added atomic retained custom-field history capture plus explicit merge and purge lifecycle handling. |
| 2026-09-02 | 25 | Retired rank rewrites and made favourite membership feed shared Dashboard Default ordering. |
| 2026-09-02 | 28 | Added transaction-composed Dashboard bulk category, frequency, favourite, snooze, and archive actions. |
| 2026-09-02 | 31 | Added Profile presentation fallout to Category changes, retained source-owned relationship actions, and removed the direct Profile AI-draft entry. |
| 2026-09-17 | 37.1 | Added mutable single-category assignment with stale-target validation and atomic delete reassignment to a survivor or Uncategorized. |
| 2026-09-02 | 33 | Documented owner-accepted archived participation, Group Event parent survival on purge, and lossless same-event merge refusal. |
| 2026-09-02 | 34 | Made Add Contact progressively disclosed, made no-cadence creation Unbound, and composed complete-edit knowledge diffs in the atomic contact writer. |
| 2026-09-23 | 38.2 | Recorded full-editor Bind/Unbind events in the contact transaction and advanced Edit Contact knowledge/link baselines from committed write returns, preserving safe retries after partial saves. |
| 2026-10-15 | 38.10 | Contact aggregates write Off Limits, every memory type, key people and dated current state; inline Things to Remember on Add/Edit Contact with held deletes; `purgeContactCore` runs in a caller's transaction with an archive-gate option used only by share Undo; create-and-share is one transaction; merge reparents Off Limits; no fuel in purge (ADR-207, ADR-212, ADR-216, ADR-217, ADR-220). |
| 2026-10-16 | 38.11 | Add Contact writes birthday, social battery and links in the one create transaction (`addLinksCore`, D-48); Add and Edit share one Birthday control where switching Year unknown off asks for the year and Edit can clear a birthday (D-49, D-61). |
| 2026-10-16 | 38.11 | The Profile's Birthday sheet writes through the single-column `setContactBirthday` (validated before the transaction, one bump), then reschedules notifications and refreshes the widget (D-59). |
| 2026-10-16 | 38.11 | Snooze runs through one shared sheet from the Profile tile, the Profile ⋯, the Contacts card and bulk (D-45); Choose date starts tomorrow (D-37). Custom dates are validated as future local dates before any write by the shared `assertFutureLocalSnoozeDate`, used by the Profile writer and the new `bulkSnoozeUntil`. |
| 2026-10-16 | 38.11 | "Archive" reads "Bin" in user-visible text: Settings → Bin with Restore and Delete permanently, "Move to Bin" for the action; the Bin never empties itself. Internal names (`archived_at`, the archive core and DAOs, the `Archived` route, the `archive` event) are unchanged (D-69, D-70). |
| 2026-10-16 | 38.11 | Code review WR-04 / D-88: Add and Edit Contact's link rows with a label but no URL show the warn-only caption "Add a link or this row won't be saved."; Save is never blocked and the row is still dropped. |
| 2026-10-16 | 38.11 | Device review (38.11-14): Add Contact's Birthday control has no Clear (`showClear={false}`; Edit Contact and the Profile Birthday sheet keep it, D-49, D-59); Settings → Bin rows show the full name above the buttons; the bulk Move to Bin confirm shares the Profile's "hidden from your lists" body and destructive confirm (D-93). |
| 2026-10-16 | 38.11 | KB extraction: Decisions link ADR-222–ADR-227, ADR-229, ADR-231. |
| 2026-10-18 | 38.12 | Bin guards on every lifecycle writer (`ContactInBinError`); Bin list reloads on focus with Restore + Undo and Delete behind ⋯; Bind/Unbind Undo and the Bind card frequency; mute retired into the indefinite snooze (migration 034); favourites carried by backup format 9 (ADR-232–ADR-235, ADR-242).
