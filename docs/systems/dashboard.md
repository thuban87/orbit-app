# Dashboard

**Last updated:** 2026-09-02
**Updated by phase:** 28-dashboard-card-view
**Owners:** `src/db/dashboard-read.ts`, `src/logic/dashboard-query-logic.ts`, `src/logic/dashboard-gravity-filter.ts`, `src/db/knowledge-search-read.ts`, `src/services/knowledge-search.ts`, `src/logic/dashboard-search-match.ts`, `src/stores/dashboard-query-store.ts`, `src/stores/dashboard-session-store.ts`, `src/stores/dashboard-selection-store.ts`, `src/components/control-surface/`, `src/screens/HomeScreen.tsx`

## Purpose

The Dashboard is Orbit's everyday local contact browser and detail-entry surface. It projects one shared eligible universe for List and Card renderers, then lets a person narrow it with populations, filters, sorting, and semantic search without exposing archived or Unbound contacts. Its List renderer is a scan-first three-line local contact browser with accessible status and gesture equivalents.

## Architecture

### Data Model

The Dashboard owns no table. It reads `contacts` and related local data, while its durable view preference is part of the singleton `app_settings` row. Search and scroll are deliberately in-memory navigation-session state, not durable state.

**Tables:**
- `contacts` — supplies lifecycle, cadence, recency, category, birthday, snooze, favourite, and status inputs.
- `app_settings` — holds the List/Card preference, explicit population set, filter object, literal sort sentinel, and the global right-swipe action.
- `categories`, `contact_methods`, `memories`, `relationships`, `custom_field_defs`, `custom_field_values` — supply user-facing semantic search entries.
- `fuel` — continues to supply the legacy dashboard projection's eligible card line while the new query foundation is wired by later render phases.

**Types** (`src/logic/dashboard-query-logic.ts`):
- `DashboardQueryState` — the one renderer-independent durable state object.
- `DashboardPopulation` / `DashboardFilters` / `DashboardSortMode` — closed query-axis tokens validated before query construction.
- `DashboardRow` (`src/db/dashboard-read.ts`) — a scoped contact projection with population match reasons and nullable status for Not Contacted rows.
- `RightSwipeAction` — the closed `quick-log` / `log-contact` preference vocabulary.

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
| List knowledge read | `src/db/dashboard-knowledge-read.ts` | Batches visible, bounded line-three candidates for the loaded List contacts. |
| List selection | `src/logic/list-row-selection.ts` | Prioritizes imminent and pinned knowledge, then returns a stable completeness prompt when no candidate qualifies. |
| Control surface | `src/components/control-surface/` | Separates option content from the floating panel presentation and durable query writes. |
| Dashboard screen | `src/screens/HomeScreen.tsx` | Hosts controls, session search, refresh, List loading, Favourite reconciliation, destinations, and the List/Card renderer seam. |

### Key Files

| File | Role |
|---|---|
| `src/db/migrations/019-dashboard-prefs.ts` | Adds the durable Dashboard preference columns. |
| `src/db/migrations/020-dashboard-swipe-pref.ts` | Adds the constrained global right-swipe action with the Quick Log default. |
| `src/db/app-settings-dao.ts` | Validates and persists Dashboard preference values. |
| `src/logic/dashboard-query-logic.ts` | Defines populations, filters, sorting, and reset transitions. |
| `src/db/dashboard-read.ts` | Owns the shared scoped population and term-bearing reads plus bound-only empty-state counts. |
| `src/logic/dashboard-gravity-filter.ts` | Narrows candidates by derived Gravity without stored state. |
| `src/stores/dashboard-query-store.ts` | SQLite-backed durable query-state mirror. |
| `src/stores/dashboard-session-store.ts` | Memory-only search and scroll state. |
| `src/db/knowledge-search-read.ts` | Builds the eligible-ID-scoped semantic corpus. |
| `src/services/knowledge-search.ts` | Provides bounded matcher and coverage-aware ranking. |
| `src/logic/dashboard-search-match.ts` | Builds semantic labels, highlights, snippets, and overflow copy. |
| `src/db/dashboard-search-read.ts` | Composes relevance-ranked semantic matches with deterministic name/fuel fallbacks for List search. |
| `src/db/dashboard-knowledge-read.ts` | Reads visibility-safe, bounded candidates for List's adaptive third line. |
| `src/logic/list-row-selection.ts` | Selects deterministic third-line context or a stable gentle prompt. |
| `src/components/ListRow.tsx` | Renders the scan-first, tokenized, accessible List row. |
| `src/components/GridCard.tsx` | Renders the avatar-first Card View row with status, context/search, favourite, and selection semantics. |
| `src/components/CardGrid.tsx` | Owns the keyed responsive virtualized Card View renderer. |
| `src/components/CardContextMenu.tsx` | Renders the fixed safe per-contact Card View action sheet. |
| `src/components/BulkActionSurface.tsx` | Renders explicit selection-mode bulk actions and the frequency-only sensitive subsurface. |
| `src/components/list-row-content.ts` | Formats local-calendar recency, row narration, and search explanations. |
| `src/logic/card-line3-selection.ts` | Applies a compactness-only within-tier context choice for cards. |
| `src/logic/dashboard-bulk-action-session.ts` | Owns the synchronous host-side bulk-action claim and selection-session validation contracts. |
| `src/stores/dashboard-selection-store.ts` | Holds ephemeral frozen-universe multi-select state. |
| `src/services/widget/widget-data.ts` | Consumes the Favorites population in Dashboard Default order. |
| `src/logic/birthday-logic.ts` | Parses local birthdays for the 30-day Birthdays population. |
| `src/components/control-surface/AnchoredPanel.tsx` | Renders the centered, in-tree floating control surface with a scroll cap, scrim, focus handoff, and reduced-motion-aware animation. |
| `src/components/control-surface/DashboardControlRow.tsx` | Opens Population, Filters, and Sort, summarizes each axis, and sends intent-derived durable writes through the query store. |
| `src/components/control-surface/DashboardOverlayHost.tsx` | Hosts the root-level in-tree Dashboard panel request. |
| `src/screens/dashboard-overflow-actions.ts` | Defines the fixed Dashboard management and reset entries. |

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

### Changing the visible Dashboard state

1. `DashboardControlRow` renders Population, Filters, and Sort as separate equal controls. Their summaries use one control-label source and collapse additional selected names to `+N`.
2. A control opens intent-only option content through `DashboardOverlayHost`; the host presents one centered in-tree floating surface at a time. The visible Dashboard stays readable behind its themed scrim, but its background regions are touch- and accessibility-inert until dismissal.
3. Option changes derive their next value from the current query-store state and persist through the validated settings DAO. They apply immediately; no Apply or Done step exists, and a zero-result selection leaves the panel open.
4. The floating surface dismisses on a repeat press, outside press, or shell transient-first Back. Its content scrolls within a viewport cap so every Filter option remains reachable.

### Searching the Dashboard

1. Home keeps the Dashboard term in `dashboard-session-store`, debounces it, and clears it when the search affordance collapses; it survives Dashboard → Profile → Back but not a fresh app session.
2. A term uses `listDashboardSearch()`; no term uses `listDashboardPopulation()`. Both receive one injected local wall-clock value for list and birthday-count coherence.
3. A term relaxes only the implicit Active search scope to non-archived Bound contacts. Explicit populations and filters retain their selected boundaries, and all term matching remains LIKE-escaped and bound.
4. The semantic reader still receives only fully filtered eligible IDs. It returns user-facing names, fields, semantic memories, relationships, searchable custom values, and notes; bounded TypeScript matching provides descriptors and highlights without FTS5.

### Rendering and acting from a List row

1. `HomeScreen` loads the shared Dashboard rows, batches line-three candidates for their IDs, and passes the selected deterministic context into `ListRow`; the row does not issue its own database reads.
2. A normal row shows name, local-calendar recency plus category, and the selected context or a stable completeness prompt. Its same-weight tokenized border and decorative glyph communicate a real status; null status is neutral and glyph-less, while a current snooze uses the neutral snooze presentation without mutating domain status.
3. The Favourite star is binary membership. The screen keeps an optimistic per-contact overlay while a write is pending, records every successful durable settlement into the base row, and reveals that committed membership if a newer write fails.
4. A closed row opens Profile. A partially open row closes first. Right swipe and its accessibility action read the global action only at commitment, then run shared Quick Log or navigate to Log Contact; left swipe and its accessibility action route to Edit Contact. Only one row remains open.
5. Search keeps identity on line one and replaces normal secondary content with a compact match explanation and strongest highlighted descriptor. Relevance-ranked corpus matches stay in scorer order; name-only and fuel-only fallbacks append in Dashboard order.

### Rendering and acting from a Card

1. `HomeScreen` passes the same shared rows, local read time, candidates, and search descriptors to `CardGrid`; Card View does not issue a renderer-specific query.
2. `CardGrid` remounts its keyed `FlatList` when width or font scale changes the responsive column count. `GridCard` presents name, recency, and one compact context item; it uses a status ring plus glyph, neutralizes the ring with a snooze glyph when snoozed, and suppresses the glyph for a never-contacted row.
3. The Card star uses the host-owned optimistic binary favourite path. Card context and search retain the shared semantic priorities and descriptors; compactness only breaks ties within a context tier.
4. A normal tap opens Profile. Long-press and equivalent accessibility actions expose the fixed per-contact action menu; Card View does not copy List swipe gestures.

### Selecting and applying bulk actions

1. Select Contacts enters an in-memory session with an entry-time frozen eligible-ID universe. While active, the renderer filters refreshed rows to that universe, the normal query controls are replaced, and Select All uses only the snapshot.
2. Card taps toggle selection, stars remain visible but non-interactive, and Back exits selection before route navigation. Ordinary committed operations retain the session; Archive removes only its committed IDs from both selection and frozen universe.
3. The replacement control area exposes Quick Log, count-aware detailed logging, explicit favourite and snooze actions, category, Archive, and Frequency as the sole Sensitive Operation. Two or more detailed-log targets navigate with serializable `GroupLog.participantIds`; Group Event behavior remains outside Dashboard.
4. Every writer is claimed synchronously before asynchronous work. Committed batches refresh Dashboard state and notify widget and shell consumers once; failures report without claiming a completed outcome.

### Retired legacy Dashboard surfaces

1. Favourites are binary membership; the widget reads Favorites in shared Default order instead of user-visible rank order.
2. The permanent birthday banner is absent. Birthdays remain reachable through the next-30-days population; richer upcoming-birthday presentation belongs to Your Week.
3. The standalone Never Contacted screen and Settings toggle are retired. The Not Contacted data path remains for the next control-surface phase, and `countNeverContacted()` remains a Digest input.
4. Unbound contacts remain outside the Dashboard universe. Their child browse route now filters its loaded local rows by name and distinguishes a true empty state from no matching rows.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `DASHBOARD_SORT_MODES` | `default`, name, recency, status modes | `src/logic/dashboard-query-logic.ts` | Closed persisted sort vocabulary. |
| `CONTACT_FREQUENCY_BANDS` | weekly ≤7, monthly ≤31, quarterly ≤91, yearly thereafter | `src/logic/dashboard-query-logic.ts` | Dashboard contact-frequency filter boundaries. |
| Birthday window | 30 days | `src/db/dashboard-read.ts` | Limits the Birthdays population. |
| `RIGHT_SWIPE_ACTIONS` | `quick-log`, `log-contact` | `src/logic/dashboard-query-logic.ts` | Closes the durable List right-swipe preference vocabulary. |

## Decisions

- **ADR-011:** Query-Time Status and Never-Contacted Segregation — keeps Active Contacts status-bearing only.
- **ADR-031:** Bound Local Fuel Search without FTS5 — prohibits an indexed Dashboard search replacement.
- **ADR-032:** Flat Dashboard Discovery and In-Query Contact Search — establishes Dashboard local discovery; its legacy surface is superseded where ADR-093 documents the shared model.
- **ADR-033:** Profile Marking and Shared Drag-Reordered Favourites — superseded by ADR-075 for user-facing favourite order.
- **ADR-034:** Birthday Banner and Re-query Dashboard Freshness — superseded by ADR-076 for the banner; local refresh discipline remains.
- **ADR-043:** Static Globally Mirrored Favourites Widget — partially superseded by ADR-075 for ordering, while the Dashboard remains the widget's local favourites projection source.
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — keeps Unbound contacts outside the Dashboard universe.
- **ADR-075:** Binary Favourite Membership Without a User-Facing Order — makes rank ineligible as Dashboard or widget ordering.
- **ADR-076:** Population-Reached Birthdays Without a Dashboard Banner — routes birthdays through the population and defers richer presentation.
- **ADR-092:** Durable Shared Dashboard Query State — establishes the SQLite-backed durable and memory-only state boundary.
- **ADR-093:** Scoped Composable Dashboard Population and Filter Model — defines the common eligible universe and filter/sort contract.
- **ADR-094:** Eligibility-Scoped Semantic Dashboard Search — scopes corpus, relevance, descriptors, and highlights to that universe.
- **ADR-095:** Live-Applying Dashboard Floating Control Surface — keeps separate query controls live-applying in one swappable in-tree presentation surface.
- **ADR-096:** Dashboard Header and Overflow Discovery Paths — establishes the header destinations, fixed overflow, and management-route entry behavior.
- **ADR-097:** Scoped Dashboard Search and Dedicated Unbound Retrieval — separates term-bearing Dashboard search from the population read and preserves Unbound retrieval on its child route.
- **ADR-098:** Scan-First, Accessible Dashboard List Rows — establishes the dense List renderer, deterministic third line, binary star, and redundant status treatment.
- **ADR-099:** Durable Global Dashboard Right-Swipe Action — adds the constrained persisted logging choice used by List gestures.
- **ADR-100:** Relevance-First, Visibility-Safe Dashboard List Search — preserves scorer order and confines List search to visible local knowledge.
- **ADR-101:** Avatar-First Accessible Dashboard Card Renderer — establishes the shared-model Card renderer and compact presentation rules.
- **ADR-102:** Frozen-Universe Dashboard Multi-Select — makes selection the Dashboard bulk-management surface and records its routing boundary.
- **ADR-103:** Atomic Composed Dashboard Bulk Mutations — requires host orchestration to call the invariant-preserving batch composers.

## Gotchas

1. **Do not weaken Active Contacts.** Its archived, Bound, and status-bearing clauses remain separate from the Snoozed and Not Contacted population rules.
2. **Do not interpolate query input into SQL.** Population and filter fragments are closed code constants; every runtime value and eligible ID is bound.
3. **Gravity filters after SQL.** It must receive the same injected read time and preserve existing order; adding a cached Gravity column is an owner decision.
4. **Search accepts only fully filtered IDs.** Passing a pre-Gravity or global ID set leaks results outside the visible Dashboard universe.
5. **Do not reintroduce FTS5 or a search index.** Dashboard typo tolerance stays bounded TypeScript scoring under ADR-031.
6. **`favourite_rank` remains storage, not product order.** Internal readers still use it, so it is not dropped or repurposed here.
7. **Upcoming birthdays have an intentional coverage gap.** Until Your Week lands, the 30-day population is the only Dashboard birthday surface.
8. **Keep the panel presentation separate from option content.** A future HUD may replace the container, but it must not reimplement query state, persistence, or option semantics.
9. **Search collapse clears the term.** Leaving a hidden session term active would make a filtered list look unexplained; do not retain it without a visible active indication.
10. **Long filter content must scroll.** The panel cap is deliberate, but clipping lower filter families or Clear filters makes the live controls unreachable.
11. **Keep List status presentation separate from status state.** Snooze changes the row to neutral plus a snooze glyph; it does not rewrite `status` or create an Unknown status.
12. **Timestamp text is untrusted at the renderer boundary.** Local-date parsing rejects rollover values; malformed recency renders neutral copy and malformed snoozes are inactive.
13. **Do not re-sort scored List corpus results.** Dashboard order is a tie-breaker for corpus matches and the append order only for name/fuel fallbacks.
14. **A stale Favourite write can still be durable.** Every successful settlement updates the base membership, even if a newer optimistic intent remains over it.
15. **Do not re-seed selection after entry.** The store membership guard and render-side frozen-universe filter both matter; only a committed archive removes IDs.
16. **Do not use public single-contact writers inside a batch.** They own their own transaction; Dashboard bulk actions call the composed DAO instead.

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
| 2026-09-02 | 26 | Added the live Population/Filters/Sort floating control surface, session search and view toggle, fixed Dashboard discovery entries, and dedicated Unbound name retrieval. |
| 2026-09-02 | 27 | Added the scan-first List renderer, deterministic knowledge context, binary Favourite reconciliation, constrained swipe actions, and relevance-first List search. |
| 2026-09-02 | 28 | Added the responsive Card renderer, frozen-universe multi-select, explicit bulk controls, and count-aware detailed-log handoff. |
