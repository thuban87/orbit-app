# ADR-043: Static Globally Mirrored Favourites Widget

**Status:** Accepted
**Date:** 2026-08-16
**Phase:** 12-home-screen-widget
**Source decisions:** dossier `12-widget.md` Clusters A, C, D, and F
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-075 (partial — ordering source only)

## Context

The home-screen surface needs a dependable shortcut board without duplicating favourite configuration, persisting per-instance state, or misrepresenting people without contact history. The widget must also give an empty installation a productive next step.

## Decision

The system renders a resizable, static manually ranked grid from the shared favourites projection. Every instance mirrors that single list with no configuration or persisted widget state; excess favourites truncate by rank, and an empty widget links to Manage favourites rather than substituting an overdue-contact feed or mini-profile.

## Alternatives Considered

- **Status-weighted overdue-first ordering** — rejected because positions would move beneath an un-undoable mark action.
- **Per-instance configuration** — rejected because it requires a configuration activity and per-widget persistence.
- **Widget self-swap to a mini-profile** — rejected for v1 because the existing profile deep link is richer and avoids mode persistence and rerasterisation.
- **Generic branding or most-overdue empty state** — rejected because neither directs the user to configure favourites.

## Consequences

### Positive

- Favourite positions remain familiar and all instances stay consistent with Manage favourites.

### Negative

- Users cannot choose different sets or modes for separate widget placements.

### Risks

- Layout capacity is bounded by device-specific bitmap and render costs; the constants remain device-tunable.

## Implementation

**Key files:**
- `app.config.ts` — declares the resizable, event-push-only `OrbitFavourites` widget provider.
- `src/services/widget/widget-data.ts` — projects dashboard favourites in manual rank and truncates to a tunable capacity.
- `src/services/widget/widget-render.tsx` — renders small, large, and empty RemoteViews layouts.
- `src/db/dashboard-read.ts` — supplies the local favourites projection with derived status and eligible fuel.
- `src/screens/ManageFavouritesScreen.tsx` — owns the shared drag order and empty-state destination.

**Depends on:** ADR-011 (Query-Time Status and Never-Contacted Segregation); ADR-032 (Flat Dashboard Discovery and In-Query Contact Search); ADR-033 (Profile Marking and Shared Drag-Reordered Favourites)
**Required by:** ADR-074 (Widget Contact Supersession and Strict Reach Deep-Link Fail-Safe)
