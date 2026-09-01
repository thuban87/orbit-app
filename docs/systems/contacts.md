# Contacts

**Last updated:** 2026-08-26
**Updated by phase:** 19-system-contact-import
**Owners:** `src/db/contacts-dao.ts`, `src/db/contact-read.ts`, `src/db/favourites-dao.ts`, `src/db/profile-dao.ts`, `src/db/contact-links-dao.ts`, `src/db/purge-dao.ts`, `src/db/recency-dao.ts`

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
  - `favourite_rank` (`INTEGER`, nullable) — ordered membership in the dashboard and widget favourites set.
  - `snooze_until` (`TEXT`, nullable) — bare local `YYYY-MM-DD` that delays the next decay reminder without changing the contact clock.
  - `reminders_off` (`INTEGER`) — permanent decay-reminder mute; it does not archive, hide, or stop status progression for the contact.
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

**Types** (`src/db/contacts-dao.ts` and `src/db/recency-dao.ts`):
- `CreateContactFullInput` — a new contact, method drafts, optional first interaction, and custom values.
- `UpdateContactFullInput` — editable fixed metadata, method drafts, values, and a never-contacted first interaction.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Contact writer | `src/db/contacts-dao.ts` | Atomically creates and edits metadata, normalized method/custom-value pairs, and optional first interactions; archives and restores contacts with lifecycle-event composition. |
| Contact reads | `src/db/contact-read.ts` | Checks duplicate names, reads categories, and assembles scalar-free edit/header data. |
| Lifecycle DAO | `src/db/contact-lifecycle-dao.ts` | Performs guarded Bind and Unbind transitions without losing contact-owned data. |
| Favourites DAO | `src/db/favourites-dao.ts` | Marks, clears, and atomically rewrites ordered favourite ranks. |
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
| `src/db/contact-lifecycle-dao.ts` | Named lifecycle transitions with exact state guards and one revision increment. |
| `src/db/favourites-dao.ts` | Dedicated favourite-rank writes that leave recency unchanged. |
| `src/db/profile-dao.ts` | Single-row self photo reads and writers. |
| `src/db/contact-links-dao.ts` | Ordered child-table CRUD for contact links. |
| `src/db/recency-dao.ts` | Single-writer interaction/recency cores used by composed contact writes. |
| `src/db/snooze-dao.ts` | Local-date snooze and clear writes with immutable event composition. |
| `src/db/events-dao.ts` | Insert-only lifecycle writer composed by archive and restore. |
| `src/db/purge-dao.ts` | Explicit, transaction-scoped child deletion, including normalized custom-value pairs, and post-commit extension hook. |
| `src/screens/CreateContactScreen.tsx` | Lean fixed-first create form. |
| `src/screens/EditContactScreen.tsx` | Always-show edit form for fixed fields, links, and custom values. |
| `src/screens/ArchivedContactsScreen.tsx` | Restore and impact-summary purge surface. |
| `src/screens/CaptureScreen.tsx` | Uses the existing name-only contact create path when a shared item has no owner yet. |
| `src/screens/ContactProfileScreen.tsx` | Provides the configured-provider AI draft entry without making a contact write. |

## How It Works

### Recording and maintaining recency

1. A caller creates a contact with an optional first interaction, or records, fully refines, or deletes an interaction for an existing contact.
2. `recency-dao` rejects future occurrence times, then runs the mutation inside the shared mutex and a hand-rolled SQLite transaction.
3. The DAO recomputes `last_contact` as `MAX(occurred_at)` across current interaction rows; a rarely-responds contact counts only connected rows.
4. A missing qualifying row produces `NULL`, which keeps the person out of normal status reads until an interaction exists.

### Creating and editing a contact

1. The create form renders name, category, frequency, last-spoke, and phone before eligible custom fields; duplicate names warn at submit but never block save.
2. `createContactFull()` opens one shared transaction, inserts the contact, seeds one blank uid-bearing pair for every custom-field definition including quarantined definitions, and for Today or Pick date uses recency cores to insert a manual, directionless interaction and recompute `last_contact`.
3. “Not yet” writes no interaction and leaves `last_contact` `NULL`; submitted custom values use pair-keyed non-mutexed cores in the same transaction.
4. The edit form shows every non-quarantined custom field after fixed fields. Changing `rarely_responds` recomputes recency because it changes the qualifying interaction set.
5. Contact aggregate saves compose method drafts through the method DAO in the same transaction; same-contact canonical duplicates collapse with typed feedback while shared methods on different contacts remain legal.
6. Bound is the default create/edit choice and requires a positive cadence. A never-assigned Unbound contact may save with NULL cadence; a Bound-to-Unbound edit retains any assigned cadence as dormant rather than clearing it.

### Managing links and lifecycle

1. The link DAO applies each add, edit, or remove with both the link and contact identities scoped to the intended row; phone and email live in normalized method rows rather than fixed contact columns.
2. Archive sets `archived_at` from the profile only when the contact is live, then composes an immutable archive event in the same transaction. Live reads exclude archived contacts; Settings owns the distinct Archived contacts home.
3. Restore clears the marker only when the contact is archived and records a matching restore event. Purge first verifies the archived state inside its write transaction, then explicitly deletes interactions, events, fuel, normalized custom-value pairs, links, field history, and the contact.
4. Photo-file and notification cleanup are idempotent best-effort post-commit extensions registered by their owning systems.

### Binding and unbinding a relationship

1. A profile action uses the named lifecycle DAO; an aggregate edit persists its lifecycle change in the same contact transaction.
2. Unbind preserves cadence, favourite rank, interactions, and `last_contact`, then removes the contact from proactive projections. Bind reuses dormant cadence or requires a new positive cadence when none was assigned.
3. After a durable change, the lifecycle-effects service reconciles notifications and refreshes the widget. An effect failure cannot roll back the committed contact state.

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
2. The Manage favourites screen obtains the live non-archived set and passes its reordered ids to `rewriteFavouriteRanks()`.
3. The DAO verifies a unique, complete current set and applies all rank updates inside one write transaction; it never writes `last_contact`.
4. Successful favourite, metadata, archive, restore, and photo-facing mutations publish a best-effort Widget refresh after their database work commits; this publisher does not alter the contact transaction.

### Supplying a live compose header

1. `getContactHeader()` returns contact identity, photo freshness, and archive state without a scalar endpoint projection.
2. Compose separately requests the DAO-selected actionable primary method and treats an archived header as unavailable rather than showing a live messaging surface.
3. Send and Copy remain handoff-only actions; the contacts system receives no interaction or recency write from them.

### Starting an AI draft from the profile

1. Profile reads ordinary app settings alongside the contact header and shows its additive AI draft entry only when a provider is configured.
2. The entry navigates to Compose with `{ contactId, requestAiSuggestion: true }`; it passes no contact snapshot, prompt, credential, or callback.
3. Compose consumes the intent and owns all generation state. AI generation, acknowledgement, and draft replacement never write `contacts`, `interactions`, `fuel`, or `last_contact`.

### Snoozing reminders

1. The edit form exposes the durable Mute reminders policy, while the profile exposes 3-day, 1-week, and 1-month snooze actions plus Clear.
2. `snoozeContact()` writes `snooze_until` with SQLite local-date arithmetic and records an immutable `snooze` event in the same transaction; Clear writes `NULL` and an `unsnooze` event.
3. Neither path writes `last_contact`. The notification scheduler re-reads the committed contact state and cancels or re-arms the derived OS reminder.

### Creating a contact during capture

1. The Capture New contact tile validates a non-blank name and calls `createContactFull()` without `firstInteraction`.
2. The name-only path uses the monthly 30-day interval and leaves `last_contact` `NULL`, so the contact remains never-contacted.
3. Capture then writes an owned fuel row in a separate acceptable transaction; it does not turn the share into an interaction or prompt for further contact detail.

### Creating or linking an imported contact

1. Contact Import maps an accepted selected-contact snapshot into `createContactFullCore()`, with Unbound lifecycle defaults for bulk work.
2. `importContactRecord()` opens one outer write transaction that creates a contact or explicitly links an existing contact, writes source links and method provenance, and resolves the durable import row.
3. The imported path uses the same normalized methods, custom-field pair setup, birthday validation, and lifecycle constraints as manual creation; it never silently overwrites an existing name.

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `FREQUENCY_DAYS` | 1, 7, 14, 30, 60, 90, 365 | `src/types.ts` | Maps named frequency presets to stored cadence days. |

## Decisions

- **ADR-008:** Initial Contact Schema as a Cross-Phase Data Contract — establishes contact identity, categories, profile, and durable fixed fields.
- **ADR-009:** Crash-Safe Forward-Only SQLite Migrations — commits the initial contacts schema atomically.
- **ADR-010:** Single-Writer Interaction Recency Spine — makes recency a serialized materialization of the interaction log.
- **ADR-011:** Query-Time Status and Never-Contacted Segregation — relies on contact cadence and the maintained never-contacted marker.
- **ADR-001:** Normalized Custom-Field Values — seeds immutable custom-value pairs on contact creation and deletes them during purge.
- **ADR-016:** Fixed-First Contact Forms and Atomic Contact Creation — composes the form’s multi-table write in one transaction.
- **ADR-017:** Multi-Link Contact Reachability — stores many ordered web links alongside normalized contact methods.
- **ADR-018:** Archive-Gated Contact Purge with Explicit Fan-Out — makes permanent deletion a guarded, auditable lifecycle action.
- **ADR-021:** Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup — adds dedicated relative-path writers and photo cleanup to contact lifecycle work.
- **ADR-023:** Structured Touchpoints and One-Tap Defaults — defines touchpoint axes and explicit one-tap values.
- **ADR-024:** Editable Touchpoint History and Recomputed Recency — preserves the single writer across refinement and deletion.
- **ADR-025:** Immutable Lifecycle Events in a Unified Timeline — adds state-guarded archive and restore events to contact lifecycle work.
- **ADR-026:** Rogue Status for Unresponsive or Far-Overdue Contacts — uses the contact's Rarely-responds policy to filter qualifying recency.
- **ADR-033:** Profile Marking and Shared Drag-Reordered Favourites — owns reversible profile marking and guarded favourite-rank ordering.
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
- **ADR-056:** Tombstone-Backed UID Reconciliation for Portable Restores — governs deletion evidence, seeded identities, and UID merge behavior.
- **ADR-057:** Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots — exports contact state through the portable manifest.

## Gotchas

1. **Use local wall-clock timestamps.** `occurred_at` and `last_contact` must not be supplied as UTC ISO strings or near-midnight status calculations can shift a day.
2. **Do not write `last_contact` anywhere else.** Every interaction mutation must use the recency DAO so summary and history remain coherent.
3. **Respect the lifecycle cadence invariant.** Bound requires a positive integer cadence; only a never-assigned Unbound contact may have NULL, and an assigned cadence is never cleared.
4. **Never nest `inWriteTransaction()`.** The contact create/edit paths call non-mutexed `*Core` methods inside their one outer transaction.
5. **Purge does not rely on cascades.** `field_history` has no contact foreign key, and every owned child table is explicitly deleted before the contact row.
6. **Do not use the metadata save to write `photo`.** Photo persistence has dedicated writers so file lifecycle and form refresh behavior remain separate.
7. **Never record a lifecycle event for a no-op transition.** Archive and restore guard the current state before changing it; otherwise the immutable history would claim a false transition.
8. **Deleting a touchpoint is permanent.** The profile must confirm it before calling the recency DAO; there is no undo or backup path.
9. **Rewrite the complete favourite set in one transaction.** A partial, duplicate, stale, archived, or non-favourite id list must fail rather than leave ranks inconsistent.
10. **A by-id header can still be archived.** Live callers such as Compose must inspect `archived_at`; the header seek intentionally does not apply a live-list filter itself.
11. **A capture is not contact.** Creating or selecting a contact for a share must leave `last_contact` unchanged and write no interaction row.
12. **Keep snooze dates local.** `snooze_until` is already a local bare date; parse or render it as UTC and near-midnight users see the wrong day.
13. **Mute does not hide a contact.** `reminders_off` suppresses decay scheduling only; Dashboard, status, and birthday behavior remain otherwise unchanged.
14. **Publish widget refresh only after a successful mutation.** A failed favourite rewrite, archive, restore, or metadata save must not advertise a state that SQLite did not commit.
15. **The AI profile entry is not a contact action.** It routes serializable identity only; Compose may generate an editable draft but must not record recency or a touchpoint.
16. **Use `createContactFull()` for production creation.** It is the path that seeds the complete custom-field pair matrix; the exported recency test helper writes no custom values.
17. **A hard delete must write its tombstone first.** Purge captures every mergeable child UID in its existing transaction; transient `field_history` remains excluded.
18. **`last_contact` is derived.** Restore recomputes it from interactions and never lets an imported summary win a reconciliation decision.
19. **Do not clear dormant favourite rank on Unbind.** Bound-only query owners hide it; retaining it lets a rebind restore the prior preference without a second write.
20. **Do not use a compatibility shortcut for imported contacts.** Import must compose the canonical creation core so contact invariants remain identical to manual creation.

## Related Systems

- **Status engine** — derives progress from `last_contact` and `interval_days`.
- **Persistence core** — supplies the SQLite schema and transaction environment.
- **Custom fields** — contributes values to the contact create/edit transaction.
- **App shell** — provides the create, profile, edit, and archived navigation routes.
- **Dashboard** — reads contact projections and provides favourite-management entry points.
- **Contact methods** — consumes the lightweight phone and archive header for Compose gating.
- **Capture** — selects or name-only creates a fuel owner while retaining the never-contacted state.
- **Notifications** — derives decay eligibility from contact state and owns the OS schedule.
- **Widget** — mirrors favourite rank and contact-visible fields without storing another configuration record.
- **AI suggestions** — receives a profile-originated Compose intent but has no contact-write authority.
- **Backup & Restore** — exports UID-bearing contact state and restores it through tombstone-aware reconciliation.
- **Contact Import** — creates or explicitly links contacts through the shared transaction seam.

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
