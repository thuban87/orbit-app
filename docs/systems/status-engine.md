# Status Engine

**Last updated:** 2026-08-14
**Updated by phase:** 02-data-foundation-status-engine
**Owners:** `src/db/status.ts`, `src/db/queries.ts`, `src/db/recency-dao.ts`

## Purpose

The status engine derives relationship progress from the time since a qualifying interaction and the contact's interval. It gives normal contact surfaces a stable, wobble, decay, or rogue view without storing a value that becomes stale as the clock advances.

## Architecture

### Data Model

Status is a query-time projection over the contacts and interactions schema; no status or progress table column exists.

**Tables:**
- `contacts` — supplies `last_contact`, `interval_days`, `rarely_responds`, and `archived_at`.
- `interactions` — supplies the ordered history used to maintain `last_contact` and read newest touchpoints.

**Types** (`src/db/status.ts`):
- _None._ Status and progress are SQL fragments rather than persisted TypeScript records.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Status SQL | `src/db/status.ts` | Defines progress and status bucket SQL fragments. |
| Read DAO | `src/db/queries.ts` | Composes the dashboard scan and newest-interaction queries. |
| Recency DAO | `src/db/recency-dao.ts` | Maintains the already-local timestamp that the status read consumes. |

### Key Files

| File | Role |
|---|---|
| `src/db/status.ts` | Query-time progress, status thresholds, and rogue rule. |
| `src/db/queries.ts` | Normal-population status scan and newest-per-contact reads. |
| `src/db/recency-dao.ts` | Preserves the source recency invariant. |

## How It Works

### Reading current contact status

1. A normal contact read filters out archived and never-contacted people.
2. `STATUS_SCAN` computes elapsed local calendar days divided by `interval_days`.
3. The query maps continuous progress to stable, wobble, decay, or rogue, and orders normal contacts by progress.
4. A separate newest-per-contact query uses `occurred_at DESC, id DESC` to deterministically choose the latest interaction row.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|
| `STABLE_MAX` | `0.8` | `src/db/status.ts` | Upper boundary for stable status. |
| `WOBBLE_MAX` | `1.0` | `src/db/status.ts` | Upper boundary for wobble status. |
| `ROGUE_K` | `3` | `src/db/status.ts` | Progress multiple at which a contact is rogue. |

## Decisions

- **ADR-011:** Query-Time Status and Never-Contacted Segregation — status/progress are derived and never-contacted people are excluded from normal reads.

## Gotchas

1. **Convert only the current time to local date.** `last_contact` is stored as a local wall-clock string; converting it with `localtime` again day-shifts late-night values.
2. **Apply the never-contacted predicate.** The raw status CASE is not a substitute for `last_contact IS NOT NULL` in normal-population reads.
3. **Keep threshold changes synchronized by convention.** The existing pure TypeScript status helper shares the stable/wobble thresholds but cannot be directly imported into SQLite SQL.

## Related Systems

- **Contacts** — provides the maintained recency and interval values.
- **Persistence core** — provides the queryable local SQLite database.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-14 | 02 | Created query-time progress/status reads and never-contacted exclusion. |
