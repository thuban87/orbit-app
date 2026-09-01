# Interaction Log

**Last updated:** 2026-08-15
**Updated by phase:** 06-interaction-log-status-impact
**Owners:** `src/db/recency-dao.ts`, `src/db/events-dao.ts`, `src/db/timeline-read.ts`, `src/db/log-guards.ts`, `src/db/impact-read.ts`, `src/services/impact.ts`

## Purpose

The interaction log records contact touchpoints and lifecycle events on-device, then gives the profile one correctable, chronological history. It makes logging cheap while keeping optional detail, connection policy, derived gravity, and intensity readable without a backend or stored score.

## Architecture

### Data Model

All log data lives in local SQLite. A touchpoint is distinct from a lifecycle event: only qualifying interaction rows can advance a contact's maintained `last_contact`.

**Tables:**
- `interactions` — editable touchpoints belonging to one contact.
  - `uid` (`TEXT`) — stable interaction identity.
  - `contact_id` (`INTEGER`) — owning contact.
  - `occurred_at` / `recorded_at` (`TEXT`) — local wall-clock time of the touchpoint and immutable log time.
  - `channel` (`TEXT`) — `call`, `text`, `in-person`, `email`, `other`, or `unspecified`.
  - `direction` (`TEXT`, nullable) — `outbound`, `inbound`, or `mutual`.
  - `connected` (`INTEGER`) — whether the touchpoint connected; it controls qualifying recency for Rarely-responds contacts.
  - `quality` (`TEXT`, nullable) — `good`, `fine`, or `hard` when refined.
  - `note` (`TEXT`, nullable) — local timeline detail.
  - `source` (`TEXT`) — `manual`, `widget`, `notification`, or `ai` creation route.
- `events` — immutable, read-only lifecycle history.
  - `uid` (`TEXT`) — stable event identity.
  - `contact_id` (`INTEGER`) — owning contact.
  - `event_type` (`TEXT`) — `archive`, `restore`, `snooze`, or `unsnooze`.
  - `occurred_at` / `recorded_at` (`TEXT`) — local wall-clock event and immutable record times.
  - `detail` (`TEXT`, nullable) — event-specific display detail.

**Types** (`src/db/recency-dao.ts`, `src/db/timeline-read.ts`, and `src/db/events-dao.ts`):
- `RecordTouchpointInput` / `EditTouchpointFullInput` — scoped mutable touchpoint write contracts.
- `TimelineItem` — discriminated union of editable touchpoints and read-only events.
- `RecordEventInput` — immutable lifecycle event input.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Touchpoint writer | `src/db/recency-dao.ts` | Serializes touchpoint writes and remains the sole `last_contact` recomputer. |
| Event writer | `src/db/events-dao.ts` | Provides mutexed and transaction-composed insert-only lifecycle event writes. |
| Timeline read | `src/db/timeline-read.ts` | Reads both tables with a deterministic newest-first `UNION ALL`. |
| Input guard | `src/db/log-guards.ts` | Rejects malformed or future local occurrence times before writes. |
| Impact read | `src/db/impact-read.ts` | Supplies the shared read snapshot for gravity and intensity. |
| Derived service | `src/services/impact.ts` | Applies owner-approved gravity and intensity policy without persistence. |

### Key Files

| File | Role |
|---|---|
| `src/db/recency-dao.ts` | Writes, fully edits, or deletes touchpoints and recomputes qualifying recency. |
| `src/db/events-dao.ts` | Insert-only lifecycle event vocabulary and transaction core. |
| `src/db/timeline-read.ts` | Interleaves event and touchpoint history deterministically. |
| `src/db/log-guards.ts` | Enforces future-date rejection before a write transaction. |
| `src/db/impact-read.ts` | Reads contact policy and history for both derived quantities. |
| `src/services/impact.ts` | Orchestrates gravity and intensity from a shared snapshot. |
| `src/services/gravity-logic.ts` | Computes floor-bounded familiarity tiers. |
| `src/services/intensity-logic.ts` | Computes outbound/mutual neutral rate and trailing cadence. |
| `src/components/TimelineRow.tsx` | Renders touchpoints as editable and events as read-only. |
| `src/components/TouchpointRefineForm.tsx` | Controls optional touchpoint-detail refinement. |
| `src/components/GravityBar.tsx` | Displays a named gravity tier without a raw score. |
| `src/components/IntensityLine.tsx` | Displays neutral intensity and trailing cadence. |
| `src/screens/ContactProfileScreen.tsx` | Hosts one-tap logging, history correction, and profile-only impact views. |

## How It Works

### Logging and refining a touchpoint

1. The profile's one-tap action creates an outbound, connected, `unspecified`-channel manual touchpoint.
2. `recordTouchpoint()` rejects a future `occurred_at`, opens the serialized transaction, inserts the row, and recomputes qualifying `last_contact`.
3. The profile reloads its status, timeline, and impact views together.
4. The user can open `TouchpointRefineForm` to correct channel, direction, connection, quality, note, and local date/time; `editTouchpointFull()` writes every editable column then recomputes recency.
5. Deletion is explicitly confirmed, permanently removes the row, and recomputes recency.

### Reading history and lifecycle events

1. Archive and restore update contact lifecycle state only when their state guard matches.
2. The same transaction records an immutable event through `recordEventCore()`.
3. `listTimeline()` returns touchpoints and events newest first, ordering ties by id and kind.
4. `TimelineRow` permits touchpoint refinement/deletion but keeps events read-only.

### Deriving gravity and intensity

1. `getImpactInputs()` reads a contact's interval, Rarely-responds policy, and touchpoints once.
2. `computeContactGravity()` filters non-connected rows for Rarely-responds contacts, then sums age-decayed weights into a named tier.
3. `computeContactIntensity()` uses the same connection scope, counts outbound/mutual rows over the contact interval, and sorts qualifying history ascending for trailing cadence.
4. The profile presents both values together; neither produces a database write or appears on the dashboard card.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `HALF_LIFE_DAYS` | `365` | `src/services/impact.ts` | Gravity's owner-approved age-decay half-life. |
| `FLOOR_W` | `0.15` | `src/services/impact.ts` | Minimum weight retained by old interactions. |
| `GRAVITY_TIERS` | thin, building, solid, deep | `src/services/impact.ts` | Named, non-gamified gravity presentation tiers. |
| `ROGUE_K` | `3` | `src/db/status.ts` | Shared overdue multiple used by the related status system. |

## Decisions

- **ADR-023:** Structured Touchpoints and One-Tap Defaults — preserves independent interaction axes and explicit fast-path defaults.
- **ADR-024:** Editable Touchpoint History and Recomputed Recency — makes the timeline the correction path and retains one writer.
- **ADR-025:** Immutable Lifecycle Events in a Unified Timeline — separates event storage while unifying the profile read.
- **ADR-027:** Derived Profile-Only Gravity and Intensity — derives two non-stored relationship signals from this history.

## Gotchas

1. **Use local wall-clock strings.** Never convert a user-entered interaction time through `toISOString()`; it can change the recorded day.
2. **Do not add a second recency writer.** Every touchpoint mutation must recompute through `recency-dao`.
3. **Treat events as immutable.** `events-dao` has no update path; record a new event rather than altering history.
4. **Keep timeline identity prefixed by kind.** Event and touchpoint IDs can collide across tables.
5. **Sort cadence inputs ascending.** The DAO returns newest-first rows, which would otherwise produce negative gaps.

## Related Systems

- **Contacts** — owns contact policy, lifecycle transitions, and the materialized `last_contact` value.
- **Status engine** — derives rogue status and reason from qualifying recency.
- **App shell** — supplies the theme tokens used by the rogue and gravity profile presentation.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-15 | 06 | Created structured touchpoint logging, lifecycle history, and profile-only derived impact views. |
