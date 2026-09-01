# ADR-032: Flat Dashboard Discovery and In-Query Contact Search

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 08-dashboard-never-contacted-screen
**Source decisions:** dossier `08-dashboard` Clusters A–B; 08-CONTEXT Areas 3–4
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-031 (partial)
**Superseded by:** None

## Context

Orbit needed an everyday home that makes a small contact population actionable without making hidden populations disappear. The existing local fuel search also needed a permanent home after Phase 7 intentionally shipped it as a reusable temporary surface.

## Decision

The system uses a flat dashboard as Home, with persisted sort/filter controls and a live, in-place search over contact names and eligible fuel. One parameter-bound dashboard read owns population branching, status projection, ranked fuel, counts, and search snippets; never-contacted contacts remain a separate sibling list.

## Alternatives Considered

- **Category-grouped dashboard** — rejected because thin sections waste space at Orbit's expected scale.
- **A smaller control set or name-only search** — rejected because it hides useful picker controls and leaves cross-contact fuel retrieval incomplete.
- **Never-contacted as a dashboard filter** — rejected because first-contact work needs its own visible backlog.
- **A Settings-reached standalone search screen** — replaced as the primary surface because search belongs in the everyday dashboard.

## Consequences

### Positive

- The home screen has one tested local read boundary with structural fuel-privacy exclusions.
- Search and hidden-population entry points are reachable where day-to-day contact work happens.

### Negative

- The dashboard query deliberately has distinct population branches and must retain their precedence.

### Risks

- A never-contacted row must remain `null` status/progress, and every search predicate must preserve escaped, bound LIKE terms and in-query exclusions.

## Implementation

**Key files:**
- `src/db/dashboard-read.ts` — owns the dashboard, never-contacted, count, birthday-candidate, and search projections.
- `src/db/fuel-read.ts` — exports the shared eligible ranked-fuel fragments and literal-safe LIKE helper.
- `src/screens/HomeScreen.tsx` — mounts the dashboard as the application home.
- `src/screens/NeverContactedScreen.tsx` — renders the separate first-contact backlog.
- `src/navigation/RootNavigator.tsx` — registers the sibling dashboard destinations.
- `src/screens/SettingsScreen.tsx` — replaces the Search row with the Manage favourites entry.
- `src/screens/FuelSearch.tsx` — removed after the dashboard search surface shipped.

**Depends on:** ADR-011 (Query-Time Status and Never-Contacted Segregation); ADR-029 (In-Query Fuel Eligibility and a Shared Ranked Projection); ADR-031 (Bound Local Fuel Search without FTS5)
**Required by:** _None._
