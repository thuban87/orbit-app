# Dashboard

**Last updated:** 2026-09-02
**Updated by phase:** 25-dashboard-data-state-foundation
**Owners:** `src/db/dashboard-read.ts`, `src/logic/dashboard-query-logic.ts`, `src/logic/dashboard-gravity-filter.ts`, `src/db/knowledge-search-read.ts`, `src/services/knowledge-search.ts`, `src/logic/dashboard-search-match.ts`, `src/stores/dashboard-query-store.ts`, `src/stores/dashboard-session-store.ts`, `src/screens/HomeScreen.tsx`

## Purpose

The Dashboard is Orbit's everyday local contact browser and detail-entry surface. It projects one shared eligible universe for all future List and Card renderers, then lets a person narrow it with populations, filters, sorting, and semantic search without exposing archived or Unbound contacts.

## Architecture

### Data Model

The Dashboard owns no table. It reads `contacts` and related local data, while its durable view preference is part of the singleton `app_settings` row. Search and scroll are deliberately in-memory navigation-session state, not durable state.

**Tables:**
- `contacts` — supplies lifecycle, cadence, recency, category, birthday, snooze, favourite, and status inputs.
- `app_settings` — holds the List/Card preference, explicit population set, filter object, and literal sort sentinel.
- `categories`, `contact_methods`, `memories`, `relationships`, `custom_field_defs`, `custom_field_values` — supply user-facing semantic search entries.
- `fuel` — continues to supply the legacy dashboard projection's eligible card line while the new query foundation is wired by later render phases.

**Types** (`src/logic/dashboard-query-logic.ts`):
- `DashboardQueryState` — the one renderer-independent durable state object.
- `DashboardPopulation` / `DashboardFilters` / `DashboardSortMode` — closed query-axis tokens validated before query construction.
- `DashboardRow` (`src/db/dashboard-read.ts`) — a scoped contact projection with population match reasons and nullable status for Not Contacted rows.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Durable state | `src/stores/dashboard-query-store.ts` | Hydrates and persists view mode, populations, filters, and sort through `app_settings`. |
| Session state | `src/stores/dashboard-session-store.ts` | Retains search text and scroll offset only while the navigation session lives. |
| Query logic | `src/logic/dashboard-query-logic.ts` | Builds closed population/filter predicates, resolves Default sort, and defines reset semantics. |
| Read DAO | `src/db/dashboard-read.ts` | Reads the scoped, deduplicated population result and applies SQL filtering plus post-query Gravity narrowing. |
| Search read | `src/db/knowledge-search-read.ts` | Reads only the eligible IDs' user-facing semantic corpus. |
| Search logic | `src/services/knowledge-search.ts` | Performs bounded typo-tolerant matching, coverage ranking, and raw-text offset mapping. |
| Descriptor logic | `src/logic/dashboard-search-match.ts` | Produces prioritized highlighted match descriptors for renderers. |
| Legacy surface | `src/screens/HomeScreen.tsx` | Retains refresh and destination behavior while later Dashboard render phases consume the foundation. |

### Key Files

| File | Role |
|---|---|
| `src/db/migrations/019-dashboard-prefs.ts` | Adds the durable Dashboard preference columns. |
| `src/db/app-settings-dao.ts` | Validates and persists Dashboard preference values. |
| `src/logic/dashboard-query-logic.ts` | Defines populations, filters, sorting, and reset transitions. |
| `src/db/dashboard-read.ts` | Owns the shared scoped population read and legacy read compatibility seams. |
| `src/logic/dashboard-gravity-filter.ts` | Narrows candidates by derived Gravity without stored state. |
| `src/stores/dashboard-query-store.ts` | SQLite-backed durable query-state mirror. |
| `src/stores/dashboard-session-store.ts` | Memory-only search and scroll state. |
| `src/db/knowledge-search-read.ts` | Builds the eligible-ID-scoped semantic corpus. |
| `src/services/knowledge-search.ts` | Provides bounded matcher and coverage-aware ranking. |
| `src/logic/dashboard-search-match.ts` | Builds semantic labels, highlights, snippets, and overflow copy. |
| `src/services/widget/widget-data.ts` | Consumes the Favorites population in Dashboard Default order. |
| `src/logic/birthday-logic.ts` | Parses local birthdays for the 30-day Birthdays population. |

## How It Works

### Building the eligible result universe

1. An empty explicit population set resolves to Active Contacts: non-archived, Bound, status-bearing contacts only.
2. Explicit Favorites, Birthdays, Not Contacted, Snoozed, and All Contacts selections combine as a deduplicated OR-union beneath the archived-and-Bound scope. All Contacts is Active Contacts plus Not Contacted.
3. SQL-expressible filters combine OR within a family and AND across families. Current snoozes stay in Active and All Contacts, but Needs Attention suppresses them.
4. `listDashboardPopulation()` orders the result with a population-aware Default or an explicit persisted override, then applies selected Gravity tiers in TypeScript without changing that order.
5. The returned rows are the sole eligible universe for Dashboard search and empty-state decisions.

### Persisting and restoring query state

1. `useDashboardQueryStore` hydrates `dashboard_view_mode`, `dashboard_populations`, `dashboard_filters`, and `dashboard_sort` from `app_settings`.
2. It validates and writes each durable axis through `updateAppSettings`; `default` remains a semantic sentinel until the read resolves it for the selected populations.
3. `useDashboardSessionStore` keeps search text and scroll offset in memory, so a fresh launch starts at top with search cleared.
4. `resetDashboardView()` restores Active Contacts, no filters, and Default sort while preserving List/Card preference; later control-surface work composes that reset with session clearing.

### Searching eligible knowledge

1. A renderer passes the fully filtered, ordered Dashboard IDs to `listKnowledgeSearchCandidates()`.
2. The read returns only those contacts' names, direct fields, semantic memories, relationships, searchable custom values, and user-facing notes; it never reads internal metadata into the corpus.
3. `searchDashboard()` performs prefix, substring, and bounded edit-distance matching in TypeScript. Matching more distinct query terms ranks above matching fewer; resolved Dashboard order only breaks equal-relevance ties.
4. `dashboard-search-match` returns at most three prioritized descriptors with raw-text highlight ranges and a `+N more` count. A name match does not hide useful secondary context.

### Retired legacy Dashboard surfaces

1. Favourites are binary membership; the widget reads Favorites in shared Default order instead of user-visible rank order.
2. The permanent birthday banner is absent. Birthdays remain reachable through the next-30-days population; richer upcoming-birthday presentation belongs to Your Week.
3. The standalone Never Contacted screen and Settings toggle are retired. The Not Contacted data path remains for the next control-surface phase, and `countNeverContacted()` remains a Digest input.
4. Legacy Home term search is Bound-only. The owner accepted a one-phase absence of typed Unbound lookup until Phase 26; the Unbound browse list remains available.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `DASHBOARD_SORT_MODES` | `default`, name, recency, status modes | `src/logic/dashboard-query-logic.ts` | Closed persisted sort vocabulary. |
| `CONTACT_FREQUENCY_BANDS` | weekly ≤7, monthly ≤31, quarterly ≤91, yearly thereafter | `src/logic/dashboard-query-logic.ts` | Dashboard contact-frequency filter boundaries. |
| Birthday window | 30 days | `src/db/dashboard-read.ts` | Limits the Birthdays population. |

## Decisions

- **ADR-011:** Query-Time Status and Never-Contacted Segregation — keeps Active Contacts status-bearing only.
- **ADR-031:** Bound Local Fuel Search without FTS5 — prohibits an indexed Dashboard search replacement.
- **ADR-032:** Flat Dashboard Discovery and In-Query Contact Search — establishes Dashboard local discovery; its legacy surface is superseded where ADR-093 documents the shared model.
- **ADR-033:** Profile Marking and Shared Drag-Reordered Favourites — superseded by ADR-075 for user-facing favourite order.
- **ADR-034:** Birthday Banner and Re-query Dashboard Freshness — superseded by ADR-076 for the banner; local refresh discipline remains.
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — keeps Unbound contacts outside the Dashboard universe.
- **ADR-075:** Binary Favourite Membership Without a User-Facing Order — makes rank ineligible as Dashboard or widget ordering.
- **ADR-076:** Population-Reached Birthdays Without a Dashboard Banner — routes birthdays through the population and defers richer presentation.
- **ADR-092:** Durable Shared Dashboard Query State — establishes the SQLite-backed durable and memory-only state boundary.
- **ADR-093:** Scoped Composable Dashboard Population and Filter Model — defines the common eligible universe and filter/sort contract.
- **ADR-094:** Eligibility-Scoped Semantic Dashboard Search — scopes corpus, relevance, descriptors, and highlights to that universe.

## Gotchas

1. **Do not weaken Active Contacts.** Its archived, Bound, and status-bearing clauses remain separate from the Snoozed and Not Contacted population rules.
2. **Do not interpolate query input into SQL.** Population and filter fragments are closed code constants; every runtime value and eligible ID is bound.
3. **Gravity filters after SQL.** It must receive the same injected read time and preserve existing order; adding a cached Gravity column is an owner decision.
4. **Search accepts only fully filtered IDs.** Passing a pre-Gravity or global ID set leaks results outside the visible Dashboard universe.
5. **Do not reintroduce FTS5 or a search index.** Dashboard typo tolerance stays bounded TypeScript scoring under ADR-031.
6. **`favourite_rank` remains storage, not product order.** Internal readers still use it, so it is not dropped or repurposed here.
7. **Upcoming birthdays have an intentional coverage gap.** Until Your Week lands, the 30-day population is the only Dashboard birthday surface.
8. **The temporary Unbound typed-lookup gap is owner-accepted.** Do not restore an Unbound search row to legacy Home; Phase 26 owns its replacement.

## Related Systems

- **Persistence core** — owns migration 019 and the singleton settings row.
- **Contact knowledge** — owns typed user-facing knowledge and semantic metadata used by the corpus.
- **Contacts** — owns contact lifecycle, favourite writes, and profile destinations.
- **Status engine** — supplies query-time status/progress and Needs Attention inputs.
- **Widget** — mirrors Favorites population Default order without a second ordering model.
- **Digest** — retains the never-contacted count while its prior screen destination is retired.
- **App shell** — owns the retired route and Settings-row navigation cleanup.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-15 | 08 | Created the dashboard, first-contact sibling list, favourites controls, birthday banner, and local refresh path. |
| 2026-08-16 | 11 | Activated the snoozed population through durable snooze writes and aligned reminder candidate semantics with dashboard status and birthdays. |
| 2026-08-16 | 12 | Added shared status rings and documented the widget's former rank-preserving favourites projection. |
| 2026-08-17 | 13 | Added the dashboard header entry to the status-default Orrery. |
| 2026-08-23 | 15 | Added the non-badged Your Week entry to the separate live digest surface. |
| 2026-08-24 | 17 | Added a temporary Backup & Restore entry and rare health-driven protection nudge. |
| 2026-08-27 | 18.2 | Added Bound-only active projections, neutral Unbound retrieval, dedicated browsing, and Never Contacted opt-in. |
| 2026-08-26 | 19 | Replaced direct creation with safe manual/import speed-dial choices. |
| 2026-09-02 | 22 | Made Dashboard a tab root, moved capture to the universal FAB, and added Group Events and Archived overflow destinations. |
| 2026-09-02 | 25 | Added shared durable query state, scoped populations/filters/search, and retired rank, banner, and Never Contacted Dashboard surfaces. |
