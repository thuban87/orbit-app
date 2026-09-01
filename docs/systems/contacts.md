# Contacts

**Last updated:** 2026-08-14
**Updated by phase:** 04-contact-crud-lifecycle
**Owners:** `src/db/contacts-dao.ts`, `src/db/contact-read.ts`, `src/db/contact-links-dao.ts`, `src/db/purge-dao.ts`, `src/db/recency-dao.ts`

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
- `categories` — seeded Family, Friends, Work, and Community groups with display order.
- `profile` — one record for the user rather than a special contact row.
- `contact_links` — ordered actionable web links belonging to a contact.
  - `uid` (`TEXT`) — stable mergeable row identity.
  - `contact_id` (`INTEGER`) — owning contact.
  - `url` / `label` (`TEXT`) — required destination and optional display label.
  - `display_order` (`INTEGER`) — insertion order for the v1 editor.
- `interactions` — individual touchpoints with local `occurred_at`, channel, connected state, source, and timestamps.

**Types** (`src/db/contacts-dao.ts` and `src/db/recency-dao.ts`):
- `CreateContactFullInput` — a new contact, optional first interaction, and custom values.
- `UpdateContactFullInput` — editable fixed metadata, values, and a never-contacted first interaction.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Contact writer | `src/db/contacts-dao.ts` | Atomically creates and edits metadata, custom values, and optional first interactions; archives and restores contacts. |
| Contact reads | `src/db/contact-read.ts` | Checks duplicate names, reads categories, and assembles edit/header data. |
| Links DAO | `src/db/contact-links-dao.ts` | Lists and applies scoped add/edit/remove changes for ordered link rows. |
| Recency DAO | `src/db/recency-dao.ts` | Is the sole owner of `last_contact` recomputation. |
| Purge DAO | `src/db/purge-dao.ts` | Computes the destruction summary and performs archive-guarded fan-out deletion. |

### Key Files

| File | Role |
|---|---|
| `src/db/contacts-dao.ts` | Composed create/edit path plus archive, restore, and archived-list reads. |
| `src/db/contact-read.ts` | Duplicate-name, category, header, and edit-form data reads. |
| `src/db/contact-links-dao.ts` | Ordered child-table CRUD for contact links. |
| `src/db/recency-dao.ts` | Single-writer interaction/recency cores used by composed contact writes. |
| `src/db/purge-dao.ts` | Explicit, transaction-scoped child deletion and post-commit extension hook. |
| `src/screens/CreateContactScreen.tsx` | Lean fixed-first create form. |
| `src/screens/EditContactScreen.tsx` | Always-show edit form for fixed fields, links, and custom values. |
| `src/screens/ArchivedContactsScreen.tsx` | Restore and impact-summary purge surface. |

## How It Works

### Recording and maintaining recency

1. A caller creates a contact with an optional first interaction, or records, edits, or deletes an interaction for an existing contact.
2. `recency-dao` runs the mutation inside the shared mutex and a hand-rolled SQLite transaction.
3. The DAO recomputes `last_contact` as `MAX(occurred_at)` across current interaction rows; a rarely-responds contact counts only connected rows.
4. A missing qualifying row produces `NULL`, which keeps the person out of normal status reads until an interaction exists.

### Creating and editing a contact

1. The create form renders name, category, frequency, last-spoke, and phone before eligible custom fields; duplicate names warn at submit but never block save.
2. `createContactFull()` opens one shared transaction, inserts the contact, and for Today or Pick date uses recency cores to insert a manual, directionless interaction and recompute `last_contact`.
3. “Not yet” writes no interaction and leaves `last_contact` `NULL`; custom values use their non-mutexed core in the same transaction.
4. The edit form shows every non-quarantined custom field after fixed fields. Changing `rarely_responds` recomputes recency because it changes the qualifying interaction set.

### Managing links and lifecycle

1. The link DAO applies each add, edit, or remove with both the link and contact identities scoped to the intended row; phone and email remain dedicated fields.
2. Archive sets `archived_at` from the profile. Live reads exclude archived contacts; Settings owns the distinct Archived contacts home.
3. Restore clears the marker. Purge first verifies the archived state inside its write transaction, then explicitly deletes interactions, events, fuel, custom values, links, field history, and the contact.
4. Photo-file and notification cleanup are idempotent best-effort post-commit extensions registered by their owning systems.

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

## Gotchas

1. **Use local wall-clock timestamps.** `occurred_at` and `last_contact` must not be supplied as UTC ISO strings or near-midnight status calculations can shift a day.
2. **Do not write `last_contact` anywhere else.** Every interaction mutation must use the recency DAO so summary and history remain coherent.
3. **Require a positive interval in callers.** Migration 001 does not enforce `interval_days > 0`; a zero or negative interval makes status SQL misleading.
4. **Never nest `inWriteTransaction()`.** The contact create/edit paths call non-mutexed `*Core` methods inside their one outer transaction.
5. **Purge does not rely on cascades.** `field_history` has no contact foreign key, and every owned child table is explicitly deleted before the contact row.

## Related Systems

- **Status engine** — derives progress from `last_contact` and `interval_days`.
- **Persistence core** — supplies the SQLite schema and transaction environment.
- **Custom fields** — contributes values to the contact create/edit transaction.
- **App shell** — provides the create, profile, edit, and archived navigation routes.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-14 | 02 | Created the contact foundation and single-writer recency invariant. |
| 2026-08-14 | 04 | Added atomic create/edit, multi-link reachability, and archive/restore/purge lifecycle flows. |
