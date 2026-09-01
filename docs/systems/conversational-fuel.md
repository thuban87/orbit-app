# Conversational Fuel

**Last updated:** 2026-08-15
**Updated by phase:** 08-dashboard-never-contacted-screen
**Owners:** `src/db/fuel-dao.ts`, `src/db/fuel-read.ts`, `src/services/fuel-ranking.ts`, `src/services/fuel-age.ts`

## Purpose

Conversational fuel stores the individual notes that help a user reconnect with a contact. It keeps personal or sensitive material local in SQLite, lets the profile edit every item, and supplies a single eligible line for glanceable surfaces without a backend or network read path.

## Architecture

### Data Model

Fuel uses the on-device SQLite table established empty in migration 1 and activated by this phase.

**Tables:**
- `fuel` — one durable conversational item belonging to one contact.
  - `id` (INTEGER) — row identifier.
  - `uid` (TEXT) — unique merge-safe identifier.
  - `contact_id` (INTEGER) — owning contact, with an `ON DELETE CASCADE` relationship.
  - `kind` (TEXT) — `recent`, `topic`, `fact`, `gift`, or `off_limits`.
  - `label`, `text`, `url` (TEXT nullable) — optional grouping, note, and independently stored link.
  - `created_at`, `modified_at` (TEXT) — local wall-clock timestamps.
  - `source` (TEXT) — item provenance, including unconfirmed `ai` and confirmed `manual`.

**Types** (`src/db/fuel-dao.ts` / `src/db/fuel-read.ts`):
- `FuelKind` — the fixed five-kind vocabulary.
- `FuelItem` — a profile-reader row, including provenance and optional contents.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| DAO writer | `src/db/fuel-dao.ts` | Adds, patch-edits, confirms, and deletes rows through the serialized write transaction. |
| DAO reader | `src/db/fuel-read.ts` | Provides the full editor list, the ranked eligible projection, and cross-contact search. |
| Service | `src/services/fuel-ranking.ts` | Defines kind-first, recency-second ordering shared by SQL and pure comparisons. |
| Service | `src/services/fuel-age.ts` | Formats a stored local timestamp as a display-only relative age. |
| UI | `src/components/FuelEditor.tsx` | Renders the controlled per-item profile editor and review actions. |

### Key Files

| File | Role |
|---|---|
| `src/db/migrations/001-initial.ts` | Defines the nine-column `fuel` table. |
| `src/db/fuel-dao.ts` | Owns the mutexed writer wrappers and composable non-mutexed cores. |
| `src/db/fuel-read.ts` | Is the shared read boundary for editor, ranking, and search. |
| `src/services/fuel-ranking.ts` | Holds `FUEL_KIND_PRIORITY` and the SQL-parity comparator. |
| `src/services/fuel-age.ts` | Uses local calendar math for relative-age copy. |
| `src/components/RankedFuelLine.tsx` | Displays an already eligible top-ranked text line. |
| `src/components/FuelEditor.tsx` | Edits all fuel, including private and unconfirmed rows. |
| `src/screens/ContactProfileScreen.tsx` | Reloads fuel after every profile mutation. |
| `src/components/FuelSearchResultRow.tsx` | Provides the reusable fuel-match presentation pattern. |
| `src/db/dashboard-read.ts` | Reuses eligible ranked-fuel and search fragments for dashboard cards. |

## How It Works

### Editing fuel on a profile

1. `ContactProfileScreen` loads `listFuelForEditor` with the contact's other profile data.
2. `FuelEditor` normalizes blank optional fields to `NULL` and asks the profile handler to add or patch-edit a row.
3. `fuel-dao` performs one bound, both-key-scoped write inside `inWriteTransaction`.
4. The profile reloads the full fuel list and its ranked projection; deleting a row follows the same reload path.

### Producing a glanceable line

1. The profile asks `getRankedFuel` for the contact's eligible rows.
2. The SQL query excludes `off_limits`, `source='ai'`, and blank text before ordering by the shared kind-priority CASE, then creation time and id.
3. `RankedFuelLine` renders the first text only; it does not rank or filter in the UI.
4. `formatFuelAge` shows an item's local-calendar age without archiving, hiding, or deleting it.

### Reviewing an AI proposal

1. An unconfirmed `source='ai'` row remains visible only in the profile editor and has a distinct Confirm/Dismiss treatment.
2. Confirm runs `confirmFuel`, which changes the source to `manual` with a scoped update.
3. Reloading makes the confirmed row eligible for ranking and search; Dismiss uses the ordinary delete path.

### Finding saved fuel

1. The dashboard sends its live typed term to `listDashboard`, which reuses fuel's eligible ranked projection and literal-safe search rules.
2. The reader escapes `\\`, `%`, and `_`, binds the term to `LIKE ? ESCAPE '\\'`, and searches contact names or eligible fuel text.
3. A dashboard card shows a matching fuel snippet when fuel text caused the match; selecting it navigates to the contact profile.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `FUEL_KIND_PRIORITY` | `recent`, `gift`, `topic`, `fact` | `src/services/fuel-ranking.ts` | Defines the order for eligible fuel. |

## Decisions

- **ADR-008:** Initial Contact Schema as a Cross-Phase Data Contract — provides the migration-1 table boundary that contains fuel.
- **ADR-009:** Crash-Safe Forward-Only SQLite Migrations — governs the already-shipped migration that creates the fuel table.
- **ADR-010:** Single-Writer Interaction Recency Spine — shares the initial schema while fuel intentionally leaves interaction recency untouched.
- **ADR-023:** Structured Touchpoints and One-Tap Defaults — shares the contact-profile surface where fuel is edited without writing interaction history.
- **ADR-024:** Editable Touchpoint History and Recomputed Recency — shares profile reload behavior with fuel mutations.
- **ADR-026:** Rogue Status for Unresponsive or Far-Overdue Contacts — shares profile relationship feedback beside the fuel section.
- **ADR-028:** Per-Item Conversational Fuel with Fixed Kinds — fuel is structured, one-row-per-item data rather than a blob or custom field.
- **ADR-029:** In-Query Fuel Eligibility and a Shared Ranked Projection — private, unconfirmed, and blank rows are excluded before every glanceable read.
- **ADR-030:** Explicit Confirmation of AI-Proposed Fuel — a user must confirm an AI proposal before it becomes eligible.
- **ADR-031:** Bound Local Fuel Search without FTS5 — search stays local and literal-safe at the Phase-7 dataset scale.
- **ADR-032:** Flat Dashboard Discovery and In-Query Contact Search — relocates the reusable local search surface to the dashboard.

## Gotchas

1. **Only the editor reads private fuel.** `listFuelForEditor` intentionally includes `off_limits`; every projection must use the in-query exclusions, never a UI filter.
2. **Do not nest the write mutex.** Compose `addFuelCore` calls under one outer transaction for multi-item work; the public wrappers already own their transaction.
3. **Patch-edit only supplied fields.** A full row update from a stale render closure can revert another blur-committed change.
4. **Use local wall-clock dates.** UTC date conversion causes age boundary errors; the formatter compares local calendar days.
5. **Escape LIKE metacharacters.** Parameter binding prevents SQL injection but not `%` or `_` wildcard matches.
6. **Reuse the exported SQL fragments.** Dashboard projections must consume the shared exclusions and rank CASE rather than copy fuel eligibility logic.

## Related Systems

- **Contacts** — owns the profiles to which fuel rows belong and the contact lifecycle that removes them.
- **Custom fields** — stores structured sortable values, while fuel stores sayable conversational hooks.
- **Dashboard** — owns the live name-plus-fuel search surface and card preview.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-15 | 07 | Created structured fuel editing, eligible ranking, AI-proposal confirmation, and local search documentation. |
| 2026-08-15 | 08 | Reused the eligible ranked projection for dashboard cards and moved local search to the dashboard. |
