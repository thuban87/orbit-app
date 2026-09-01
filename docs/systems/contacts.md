# Contacts

**Last updated:** 2026-08-16
**Updated by phase:** 10-share-sheet-capture
**Owners:** `src/db/contacts-dao.ts`, `src/db/contact-read.ts`, `src/db/favourites-dao.ts`, `src/db/profile-dao.ts`, `src/db/contact-links-dao.ts`, `src/db/purge-dao.ts`, `src/db/recency-dao.ts`

## Purpose

The contacts system holds the durable identity and core data for people in Orbit. It preserves a complete interaction history while maintaining a truthful `last_contact` summary for status and future contact surfaces.

## Architecture

### Data Model

All data is on-device SQLite. Migration 001 uses a surrogate `contacts.id` and a distinct unique `uid` on mergeable records; contact names are not unique.

**Tables:**
- `contacts` — person identity, category, interval, fixed contact data, lifecycle flags, timestamps, and `last_contact`.
  - `category_id` (`INTEGER`) — optional foreign key to `categories`.
  - `interval_days` (`INTEGER`) — contact cadence in days.
  - `last_contact` (`TEXT`) — maintained maximum qualifying interaction timestamp; `NULL` means never-contacted.
  - `rarely_responds` (`INTEGER`) — limits recency to connected interactions.
  - `archived_at` (`TEXT`) — archive lifecycle marker.
  - `phone` (`TEXT`, nullable) — dedicated number used by user-invoked SMS handoff when present.
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
- `interactions` — individual touchpoints with local `occurred_at`, channel, connected state, source, and timestamps.
  - `direction` (`TEXT`, nullable) — `outbound`, `inbound`, or `mutual`; one-tap writes explicitly use `outbound`.
  - `quality` (`TEXT`, nullable) — optional `good`, `fine`, or `hard` refinement marker.
  - `note` (`TEXT`, nullable) — local-only free-text touchpoint detail.
- `events` — immutable archive, restore, snooze, and unsnooze history; these rows never participate in recency.

**Types** (`src/db/contacts-dao.ts` and `src/db/recency-dao.ts`):
- `CreateContactFullInput` — a new contact, optional first interaction, and custom values.
- `UpdateContactFullInput` — editable fixed metadata, values, and a never-contacted first interaction.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Contact writer | `src/db/contacts-dao.ts` | Atomically creates and edits metadata, custom values, and optional first interactions; archives and restores contacts with lifecycle-event composition. |
| Contact reads | `src/db/contact-read.ts` | Checks duplicate names, reads categories, and assembles edit/header data, including the lightweight phone-capable header seek. |
| Favourites DAO | `src/db/favourites-dao.ts` | Marks, clears, and atomically rewrites ordered favourite ranks. |
| Profile DAO | `src/db/profile-dao.ts` | Reads and updates the single self record’s local photo reference. |
| Links DAO | `src/db/contact-links-dao.ts` | Lists and applies scoped add/edit/remove changes for ordered link rows. |
| Recency DAO | `src/db/recency-dao.ts` | Is the sole owner of `last_contact` recomputation. |
| Snooze DAO | `src/db/snooze-dao.ts` | Is the sole writer of `snooze_until` and records paired lifecycle events. |
| Purge DAO | `src/db/purge-dao.ts` | Computes the destruction summary and performs archive-guarded fan-out deletion. |

### Key Files

| File | Role |
|---|---|
| `src/db/contacts-dao.ts` | Composed create/edit path plus archive, restore, and archived-list reads. |
| `src/db/contact-read.ts` | Duplicate-name, category, header, and edit-form data reads. |
| `src/db/favourites-dao.ts` | Dedicated favourite-rank writes that leave recency unchanged. |
| `src/db/profile-dao.ts` | Single-row self photo reads and writers. |
| `src/db/contact-links-dao.ts` | Ordered child-table CRUD for contact links. |
| `src/db/recency-dao.ts` | Single-writer interaction/recency cores used by composed contact writes. |
| `src/db/snooze-dao.ts` | Local-date snooze and clear writes with immutable event composition. |
| `src/db/events-dao.ts` | Insert-only lifecycle writer composed by archive and restore. |
| `src/db/purge-dao.ts` | Explicit, transaction-scoped child deletion and post-commit extension hook. |
| `src/screens/CreateContactScreen.tsx` | Lean fixed-first create form. |
| `src/screens/EditContactScreen.tsx` | Always-show edit form for fixed fields, links, and custom values. |
| `src/screens/ArchivedContactsScreen.tsx` | Restore and impact-summary purge surface. |
| `src/screens/CaptureScreen.tsx` | Uses the existing name-only contact create path when a shared item has no owner yet. |

## How It Works

### Recording and maintaining recency

1. A caller creates a contact with an optional first interaction, or records, fully refines, or deletes an interaction for an existing contact.
2. `recency-dao` rejects future occurrence times, then runs the mutation inside the shared mutex and a hand-rolled SQLite transaction.
3. The DAO recomputes `last_contact` as `MAX(occurred_at)` across current interaction rows; a rarely-responds contact counts only connected rows.
4. A missing qualifying row produces `NULL`, which keeps the person out of normal status reads until an interaction exists.

### Creating and editing a contact

1. The create form renders name, category, frequency, last-spoke, and phone before eligible custom fields; duplicate names warn at submit but never block save.
2. `createContactFull()` opens one shared transaction, inserts the contact, and for Today or Pick date uses recency cores to insert a manual, directionless interaction and recompute `last_contact`.
3. “Not yet” writes no interaction and leaves `last_contact` `NULL`; custom values use their non-mutexed core in the same transaction.
4. The edit form shows every non-quarantined custom field after fixed fields. Changing `rarely_responds` recomputes recency because it changes the qualifying interaction set.

### Managing links and lifecycle

1. The link DAO applies each add, edit, or remove with both the link and contact identities scoped to the intended row; phone and email remain dedicated fields.
2. Archive sets `archived_at` from the profile only when the contact is live, then composes an immutable archive event in the same transaction. Live reads exclude archived contacts; Settings owns the distinct Archived contacts home.
3. Restore clears the marker only when the contact is archived and records a matching restore event. Purge first verifies the archived state inside its write transaction, then explicitly deletes interactions, events, fuel, custom values, links, field history, and the contact.
4. Photo-file and notification cleanup are idempotent best-effort post-commit extensions registered by their owning systems.

### Managing contact and self photos

1. The edit form holds a contact photo separately from unsaved fixed-field edits and refreshes it on focus without reseeding the form.
2. Dedicated contact and profile DAO writers store or clear only the validated relative photo path; the ordinary metadata update deliberately does not own photo writes.
3. The shared photos pipeline owns file persistence and inline deletion, while contact reads supply `photo` and `modified_at` to the profile avatar.

### Managing favourites

1. The contact-profile star reads `favourite_rank` from the header and calls `setFavouriteRank()` or `clearFavouriteRank()`.
2. The Manage favourites screen obtains the live non-archived set and passes its reordered ids to `rewriteFavouriteRanks()`.
3. The DAO verifies a unique, complete current set and applies all rank updates inside one write transaction; it never writes `last_contact`.

### Supplying a live compose header

1. `getContactHeader()` returns the contact's identity, photo freshness, phone, and archive marker through its lightweight by-id seek.
2. Compose trims the optional phone to decide SMS availability and treats an archived header as unavailable rather than showing a live messaging surface.
3. Send and Copy remain handoff-only actions; the contacts system receives no interaction or recency write from them.

### Snoozing reminders

1. The edit form exposes the durable Mute reminders policy, while the profile exposes 3-day, 1-week, and 1-month snooze actions plus Clear.
2. `snoozeContact()` writes `snooze_until` with SQLite local-date arithmetic and records an immutable `snooze` event in the same transaction; Clear writes `NULL` and an `unsnooze` event.
3. Neither path writes `last_contact`. The notification scheduler re-reads the committed contact state and cancels or re-arms the derived OS reminder.

### Creating a contact during capture

1. The Capture New contact tile validates a non-blank name and calls `createContactFull()` without `firstInteraction`.
2. The name-only path uses the monthly 30-day interval and leaves `last_contact` `NULL`, so the contact remains never-contacted.
3. Capture then writes an owned fuel row in a separate acceptable transaction; it does not turn the share into an interaction or prompt for further contact detail.

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `FREQUENCY_DAYS` | 1, 7, 14, 30, 60, 90, 365 | `src/types.ts` | Maps named frequency presets to stored cadence days. |

## Decisions

- **ADR-008:** Initial Contact Schema as a Cross-Phase Data Contract — establishes contact identity, categories, profile, and durable fixed fields.
- **ADR-009:** Crash-Safe Forward-Only SQLite Migrations — commits the initial contacts schema atomically.
- **ADR-010:** Single-Writer Interaction Recency Spine — makes recency a serialized materialization of the interaction log.
- **ADR-011:** Query-Time Status and Never-Contacted Segregation — relies on contact cadence and the maintained never-contacted marker.
- **ADR-016:** Fixed-First Contact Forms and Atomic Contact Creation — composes the form’s multi-table write in one transaction.
- **ADR-017:** Multi-Link Contact Reachability — stores many ordered web links while phone and email remain dedicated fields.
- **ADR-018:** Archive-Gated Contact Purge with Explicit Fan-Out — makes permanent deletion a guarded, auditable lifecycle action.
- **ADR-021:** Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup — adds dedicated relative-path writers and photo cleanup to contact lifecycle work.
- **ADR-023:** Structured Touchpoints and One-Tap Defaults — defines touchpoint axes and explicit one-tap values.
- **ADR-024:** Editable Touchpoint History and Recomputed Recency — preserves the single writer across refinement and deletion.
- **ADR-025:** Immutable Lifecycle Events in a Unified Timeline — adds state-guarded archive and restore events to contact lifecycle work.
- **ADR-026:** Rogue Status for Unresponsive or Far-Overdue Contacts — uses the contact's Rarely-responds policy to filter qualifying recency.
- **ADR-033:** Profile Marking and Shared Drag-Reordered Favourites — owns reversible profile marking and guarded favourite-rank ordering.
- **ADR-035:** Native SMS Handoff with Guaranteed Clipboard Copy — uses the nullable phone field for a user-invoked, non-writing handoff.
- **ADR-036:** Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails — rejects archived headers on the reusable live compose surface.
- **ADR-038:** Contact-Owned Share Capture Fuel — preserves name-only, never-contacted inline creation and prohibits a capture recency write.
- **ADR-039:** Pre-Scheduled Inexact Decay Reminders — uses cadence, snooze, mute, lifecycle, and status fields to determine derived reminder eligibility.
- **ADR-040:** Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing — routes mark-contacted and snooze through the established contact write boundaries.

## Gotchas

1. **Use local wall-clock timestamps.** `occurred_at` and `last_contact` must not be supplied as UTC ISO strings or near-midnight status calculations can shift a day.
2. **Do not write `last_contact` anywhere else.** Every interaction mutation must use the recency DAO so summary and history remain coherent.
3. **Require a positive interval in callers.** Migration 001 does not enforce `interval_days > 0`; a zero or negative interval makes status SQL misleading.
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

## Related Systems

- **Status engine** — derives progress from `last_contact` and `interval_days`.
- **Persistence core** — supplies the SQLite schema and transaction environment.
- **Custom fields** — contributes values to the contact create/edit transaction.
- **App shell** — provides the create, profile, edit, and archived navigation routes.
- **Dashboard** — reads contact projections and provides favourite-management entry points.
- **Contact methods** — consumes the lightweight phone and archive header for Compose gating.
- **Capture** — selects or name-only creates a fuel owner while retaining the never-contacted state.
- **Notifications** — derives decay eligibility from contact state and owns the OS schedule.

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
