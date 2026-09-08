# ADR-104: Durable Orrery Preferences and Live System Scope

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 29-orrery-camera-scale-exploration
**Source decisions:** dossier `phase-08-orrery-camera-scale-exploration` §§H, S, V; CONTEXT D-05/D-06
**Reversibility:** one-way
**Migration:** 021
**Supersedes:** None
**Superseded by:** None

## Context

The expanded Orrery needs durable density, satellite-visibility, and last-System choices without turning a camera pose into persistent state. Its Systems must reflect live contact data, include neutral never-contacted contacts only where explicitly selected, and reuse domain predicates without inheriting Dashboard state.

## Decision

The system stores validated density, satellite-toggle, and closed last-System tokens in `app_settings` through migration 021. It resolves built-in and category-UID Systems from a coherent live snapshot; All Contacts and Not Contacted explicitly include neutral never-contacted contacts, while camera pose and focus remain navigation-session state only.

## Alternatives Considered

- **Persist camera position and focus** — Rejected because a fresh Orrery visit must start at canonical Home framing.
- **Store frozen System member IDs** — Rejected because Systems must follow current contact, status, and Category data.
- **Bind Orrery to Dashboard query state** — Rejected because Orrery has its own sparse System control surface and no conventional sort controls.

## Consequences

### Positive

- Preferences survive local upgrades and retain a valid default when no prior choice exists.
- A renamed Category keeps its UID identity, while a removed Category has an explicit recovery state.

### Negative

- System reads compose settings, lifecycle-aware sun identity, Category catalog, members, and complete rank fingerprints in one snapshot.

### Risks

- Restore accepts omitted preference keys without changing the existing settings; export emission remains deferred to Phase 36.

## Implementation

**Key files:**
- `src/db/migrations/021-orrery-preferences.ts` — adds constrained density, satellite, and last-System settings.
- `src/db/app-settings-dao.ts` — validates and persists the singleton Orrery preferences.
- `src/logic/orrery-system-logic.ts` — defines closed System identities and bound live-membership predicates.
- `src/db/orrery-system-read.ts` — composes the coherent System, sun, member, and rank snapshot.
- `src/stores/orrery-preferences-store.ts` — publishes a choice only after its serialized SQLite commit.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-011 (Query-Time Status and Never-Contacted Segregation); ADR-047 (App-Level Assignable Sun and Themed Self Identity); ADR-093 (Scoped Composable Dashboard Population and Filter Model)
**Required by:** _None._
