# Dossier — Dashboard Data & State Foundation

**Status:** complete · Interrogated through 2026-08-30 · Shared Dashboard data/state contracts settled. List/Card presentation details are owned by later phases.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope
This dossier defines the nonvisual Dashboard foundation consumed by the Dashboard Control Surface, Dashboard List View, and Dashboard Card View.

It covers Dashboard product identity, result-universe rules, special populations, filter semantics, sort semantics, Dashboard-specific semantic search, result deduplication, search-match contracts, persistence, navigation-state restoration, and the shared data/query architecture needed by later Dashboard renderers.

It intentionally does **not** define exact List/Card row/card composition, card density, final status-label placement, row actions, or renderer-specific visual styling.

## A. Dashboard Product Role
**[DECIDED]** Dashboard is primarily Orbit's contact browser and contact-detail/update entry surface, with a secondary relationship-command-center role.

**[DECIDED]** Orrery remains the more relationship-health / attention-centric visualization.

**[DECIDED]** Dashboard should remain lean rather than becoming a portal packed with permanent summary modules.

**[DERIVED]** Dashboard data architecture should optimize for switching/querying one contact collection rather than coordinating multiple simultaneous collections on one scroll surface.

## B. Shared Presentation Modes
**[DECIDED]** Initial Dashboard presentation modes are List and Card.

**[DECIDED]** Both modes consume the same Population / Filters / Sort / Search state.

**[DEFERRED]** Compact Card/Grid presentation mode.

## C. Default Dashboard Universe
**[DECIDED]** With no explicit special population selected, Dashboard shows **Active Contacts**.

**[DECIDED]** Active Contacts is the implicit/default universe rather than an explicit multi-select population.

**[DECIDED]** Selecting one or more special populations replaces the implicit Active Contacts universe.

**[DECIDED]** Archived contacts are outside the Dashboard result universe.

**[DECIDED]** Unbound contacts are outside the Dashboard result universe.

**[DERIVED]** The shared query model should represent the eligible universe explicitly rather than treating `all contacts` as a catch-all branch with later exclusions.

## D. Special Populations
**[DECIDED] Initial special populations:**
- Favorites
- Birthdays
- Not Contacted
- Snoozed

**[DECIDED]** Special populations are multi-select.

**[DECIDED]** Multiple selected populations combine as an OR-union.

**[DECIDED]** Duplicate population membership collapses to one contact result.

**[DERIVED]** Shared result data may retain all population-match reasons even though the contact is deduplicated.

**[DECIDED]** Population combinations start unrestricted; only real future contradictions should introduce compatibility rules.

**[DECIDED]** Deselecting the final explicit population returns immediately to Active Contacts.

## E. Population-Specific Rules

### Favorites
**[DECIDED]** Favorites are binary membership, not a user-visible ranking system.

**[DERIVED]** Any legacy/internal `favourite_rank` implementation detail must not be treated as evidence for ranked-Favorites UX.

### Birthdays
**[DECIDED]** Dashboard Birthday population covers the next **30 days**.

**[DECIDED]** Richer imminent/upcoming birthday presentation belongs to **Your Week**, not to a permanent Dashboard banner/module.

**[DERIVED]** Under Sort = Default, Birthday population naturally orders soonest birthday first.

### Not Contacted
**[DECIDED]** Never-contacted contacts remain eligible for Active Contacts with a neutral/no-status state.

**[DECIDED]** They also have a dedicated Not Contacted population.

### Snoozed
**[DECIDED]** Snoozed contacts remain in Active Contacts.

**[DECIDED]** Snoozed contacts are suppressed from Needs Attention.

Explicit population selection, eligible Dashboard search, and deliberate user actions can still surface/select them.

## F. Population, Filter, Sort, and Search Mental Model
**[DECIDED]** These are separate query axes:

- **Population** = who is eligible for the pool.
- **Filters** = how that pool is narrowed.
- **Sort** = how the resulting set is ordered.
- **Search** = how the already-defined eligible set is queried/narrowed.

**[DERIVED]** Represent these axes independently in Dashboard state rather than collapsing them into one opaque filter object.

## G. Filter Semantics
**[DECIDED] Initial Dashboard filters:**
1. Category
2. Social Battery
3. Relationship Status / Needs Attention
4. Gravity / Closeness
5. Contact Frequency

**[DEFERRED]** Filters for contact-method presence, remembered-information presence, AI-enabled data, recently updated data, arbitrary custom fields, and similar operational/data-quality predicates.

**[DECIDED]** Multiple values within one filter category combine with OR semantics.

**[DECIDED]** Different filter categories combine with AND semantics.

Example: `(Family OR Friends) AND (Charger OR Neutral) AND Needs Attention`.

**[DECIDED]** Needs Attention is a filter, not a population.

**[DECIDED]** Existing Filters remain applied when Population changes.

This behavior may be revisited only if actual usability testing shows it is confusing.

## H. Sort Model
**[DECIDED]** Sort exposes:
- Default
- Name A–Z
- Name Z–A
- Least Recently Contacted
- Most Recently Contacted
- Relationship Status

**[DECIDED]** `Default` is population-aware.

Examples:
- Active Contacts → normal Dashboard relationship-health/default ordering.
- Birthdays → soonest birthday.
- Favorites → normal Dashboard ordering; no favorite-rank sort.
- Not Contacted → natural not-contacted ordering.
- Snoozed → natural snooze ordering.

**[DECIDED]** An explicit sort overrides population-natural ordering until the user returns Sort to `Default`.

**[DECIDED]** Changing Population does not erase an explicit sort.

**[DECIDED]** Sort is independently resettable to `Default`.

**[DERIVED]** Persist `Default` versus an explicit user choice; do not persist a resolved population-specific default as though the user explicitly selected it.

## I. Dashboard Search Scope
**[DECIDED]** Dashboard search is restricted to the currently eligible **Population + Filters** result universe.

**[DECIDED]** Dashboard search never surfaces Archived contacts.

**[DECIDED]** Dashboard search never surfaces Unbound contacts.

**[DERIVED]** Search should consume the same eligibility pipeline as ordinary Dashboard browsing rather than running a separate global query and repairing scope afterward.

## J. Searchable Knowledge
**[DECIDED]** Dashboard search uses the semantic contact-knowledge abstraction established by Contact Knowledge Foundation.

**[DECIDED]** Searchability should follow semantic field/type metadata where available rather than a Dashboard-only hardcoded list.

Searchable user-facing knowledge includes, where appropriate:
- contact identity/name
- Memory labels and values
- Memory notes
- relationship names/structured relationship content
- appropriate custom-field content
- first-class user-facing contact information such as phone/email/location/category

**[DECIDED]** Internal metadata is not searched.

## K. Search Matching & Relevance
**[DECIDED]** Search supports forgiving prefix/substring matching plus reasonable typo tolerance.

**[DECIDED]** Multi-term queries are evaluated both as combined phrase/intent and as individual terms.

Example: `Andrew kids`.

**[DECIDED]** Ranking favors **query-term coverage**. A contact matching both `Andrew` and `kids` across meaningful searchable fields/items ranks above one matching only `Andrew`.

**[DECIDED]** Exact identity/name matches receive strong priority.

**[DECIDED]** Field/type importance also contributes to relevance.

Broad priority direction:
1. identity/direct field or value matches
2. structured relationship matches
3. Memory/custom-field matches
4. note/body matches

**[DECIDED]** Search relevance is primary while search is active; the current Dashboard sort acts as a tie-breaker.

**[DERIVED]** Search ranking needs a contact-level score capable of combining phrase strength, term coverage, match strength, and field/type priority.

**[DERIVED]** Exact numerical weights are implementation details to tune with representative fixtures/tests.

## L. Search Match Context
**[DECIDED]** Search results may expose multiple matching contextual snippets for one contact.

**[DECIDED]** Up to **three** useful matches are visible, then `+N more` semantics may represent additional matches.

**[DECIDED]** Matched text is highlighted.

**[DECIDED]** A direct name match does not suppress useful secondary knowledge matches.

**[DERIVED]** Shared result data should carry prioritized match descriptors/snippets plus total match count so List and Card can render the same semantic result differently.

## M. Dashboard State Persistence
**[DECIDED] Persist across app relaunch:**
- List/Card presentation preference
- Population selection
- Filters
- Sort state

**[DECIDED]** Search text does not persist across relaunch.

**[DECIDED]** Scroll position does not persist across a fresh launch.

**[DECIDED]** Dashboard → Profile → Back restores the working Dashboard state, including search/filter/population/sort and scroll position.

**[DECIDED]** Fresh launch restores persisted view/population/filter/sort at the top of the collection with search cleared.

**[DECIDED]** List and Card share the same query state rather than remembering separate Population/Filter/Sort selections.

**[DERIVED]** Distinguish durable Dashboard preferences from ephemeral navigation-session state.

## N. Clear / Reset Semantics
**[DECIDED]** Each query axis is independently clearable/resettable:
- Population clear → Active Contacts
- Filters clear → no filters
- Sort reset → Default
- Search clear → empty query

**[DECIDED]** Dashboard also has a global **Reset Dashboard View** action.

It restores:
- Active Contacts
- no Filters
- Sort = Default
- search cleared

It preserves List/Card presentation preference.

**[DERIVED]** Represent Reset Dashboard View as one deterministic state transition rather than a chain of UI-specific resets.

## O. Shared Dashboard Read / Result Architecture
**[DERIVED]** Build one shared Dashboard controller/query layer consumed by Control Surface, List View, and Card View.

It should own:
- eligible contact universe
- population union/deduplication
- filter evaluation
- resolved/default versus explicit sort
- semantic search
- contact-level relevance scoring
- match descriptors
- persisted versus ephemeral Dashboard state

**[DERIVED]** List and Card should consume a stable Dashboard result/presentation model rather than duplicate query logic.

**[DERIVED]** Preserve useful existing Dashboard read-domain logic where it still matches the new contracts, but the old exact filter/search precedence and old visual layout are not authoritative.

**[DERIVED]** Continue using the shared birthday parser/domain helper rather than introducing a Dashboard-only birthday implementation.

## P. Cross-Phase Constraints
- **Dashboard Control Surface:** operates against the independent query axes defined here.
- **Dashboard List View:** consumes the shared result model; does not implement its own query semantics.
- **Dashboard Card View:** same shared model as List.
- **Your Week:** owns richer birthday/upcoming presentation; Dashboard owns Birthday population plus the entry point.
- **Orrery:** remains the primary relationship-health visualization.
- **Contact Knowledge:** Dashboard search uses semantic knowledge/searchability metadata.
- **Archived / Unbound:** remain outside the Dashboard universe and use dedicated management routes.
- **Accessibility:** later renderers cannot rely on relationship-status color alone.
- **Future compact renderer:** query architecture should not be coupled to exactly two renderers.

## Explicitly Deferred
- Compact Card/Grid Dashboard renderer
- ranked Favorites product concept
- advanced filter categories beyond the initial five
- arbitrary custom-field filtering
- global search crossing Dashboard/Archived/Unbound universes
- exact numerical search-scoring weights
- remote/indexed search infrastructure
- final List View row composition
- final Card View composition
- exact search-snippet visual treatment
- final contact-status presentation in List/Card

## Phase Success Criteria
1. Dashboard has one shared query/state contract independent of List/Card rendering.
2. No explicit population means Active Contacts; special populations OR-union and dedupe.
3. Favorites, Birthdays, Not Contacted, and Snoozed follow the settled population rules.
4. Filters support OR-within-category and AND-across-category semantics using the initial five families.
5. Needs Attention behaves as a filter and excludes snoozed contacts.
6. Sort supports population-aware Default plus explicit overrides.
7. Dashboard search is restricted to the current eligible Population + Filters universe and never leaks Archived/Unbound.
8. Search consumes semantic knowledge, supports multi-token coverage and typo tolerance, and strongly ranks identity/full-query coverage.
9. Search results carry up to three prioritized highlighted context matches plus additional-match count.
10. Durable preferences and ephemeral navigation/search/scroll state restore according to the settled contract.
11. Reset Dashboard View returns query state to baseline without changing List/Card preference.

## Notes for GSD / Roadmapper
- Treat this as a distinct integer execution phase before Dashboard Control Surface and the two renderers.
- Do not recreate query/search logic separately in List and Card phases.
- Do not interpret legacy `favourite_rank` as a requirement for ranked Favorites UX.
- Do not make Dashboard search global.
- Do not dynamically rewrite the Sort option list per population; keep `Default` semantic and population-resolved.
- Preserve existing proven database/domain helpers where compatible, but old Dashboard UI/query precedence is not automatically authoritative.
- Exact search-scoring weights are implementation details; the behavior and priorities above are authoritative.
