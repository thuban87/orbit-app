# Contacts

**Last updated:** 2026-08-14
**Updated by phase:** 02-data-foundation-status-engine
**Owners:** `src/db/recency-dao.ts`, `src/db/migrations/001-initial.ts`, `src/db/mutex.ts`

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
- `contact_links` — ordered actionable links belonging to a contact.
- `interactions` — individual touchpoints with local `occurred_at`, channel, connected state, source, and timestamps.

**Types** (`src/db/recency-dao.ts`):
- `CreateContactInput` — a new contact and its optional first interaction.
- `RecordTouchpointInput` — a new interaction against an existing contact.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| DAO | `src/db/recency-dao.ts` | Creates, edits, and deletes touchpoints while maintaining contact recency. |
| Concurrency utility | `src/db/mutex.ts` | Ensures only one recency transaction is active in the JS runtime. |
| Schema | `src/db/migrations/001-initial.ts` | Defines contact, category, profile, link, and interaction tables. |

### Key Files

| File | Role |
|---|---|
| `src/db/recency-dao.ts` | Sole owner of `contacts.last_contact` writes. |
| `src/db/migrations/001-initial.ts` | Contact-system schema, foreign keys, and interaction recency index. |
| `src/db/mutex.ts` | Serializes all recency writes. |

## How It Works

### Recording and maintaining recency

1. A caller creates a contact with an optional first interaction, or records, edits, or deletes an interaction for an existing contact.
2. `recency-dao` runs the mutation inside the shared mutex and a hand-rolled SQLite transaction.
3. The DAO recomputes `last_contact` as `MAX(occurred_at)` across current interaction rows; a rarely-responds contact counts only connected rows.
4. A missing qualifying row produces `NULL`, which keeps the person out of normal status reads until an interaction exists.

## Configuration

_None._

## Decisions

- **ADR-008:** Initial Contact Schema as a Cross-Phase Data Contract — establishes contact identity, categories, profile, and durable fixed fields.
- **ADR-009:** Crash-Safe Forward-Only SQLite Migrations — commits the initial contacts schema atomically.
- **ADR-010:** Single-Writer Interaction Recency Spine — makes recency a serialized materialization of the interaction log.

## Gotchas

1. **Use local wall-clock timestamps.** `occurred_at` and `last_contact` must not be supplied as UTC ISO strings or near-midnight status calculations can shift a day.
2. **Do not write `last_contact` anywhere else.** Every interaction mutation must use the recency DAO so summary and history remain coherent.
3. **Require a positive interval in callers.** Migration 001 does not enforce `interval_days > 0`; a zero or negative interval makes status SQL misleading.

## Related Systems

- **Status engine** — derives progress from `last_contact` and `interval_days`.
- **Persistence core** — supplies the SQLite schema and transaction environment.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-14 | 02 | Created the contact foundation and single-writer recency invariant. |
