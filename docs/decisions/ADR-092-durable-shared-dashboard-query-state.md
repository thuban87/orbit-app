# ADR-092: Durable Shared Dashboard Query State

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 25-dashboard-data-state-foundation
**Source decisions:** dossier `phase-04-dashboard-data-state-foundation` §§B, F, M–N; CONTEXT D-03, D-10
**Reversibility:** one-way
**Migration:** 019
**Supersedes:** None
**Superseded by:** None

## Context

The legacy dashboard persisted one filter and sort in AsyncStorage and had no shared model for List and Card. The new Dashboard needs one renderer-independent query contract while preserving portable, SQLite-backed user preferences and keeping transient navigation state out of a fresh launch.

## Decision

The system uses one `DashboardQueryState` for view mode, selected populations, filters, and sort. Migration 019 stores those durable axes in `app_settings`; the literal `default` sort is persisted and resolved only at read time. Search text and scroll offset remain memory-only session state, and Reset Dashboard View clears query axes without changing the preferred view mode.

## Alternatives Considered

- **Keep renderer-local or AsyncStorage preferences** — Rejected because List and Card must share one portable query state.
- **Persist a resolved population-specific default sort** — Rejected because it would misrepresent an implicit default as an explicit user choice.
- **Persist search text and scroll position across launch** — Rejected because a fresh launch must restore durable preferences at the top of the collection with search cleared.

## Consequences

### Positive

- Both renderers consume the same state and can independently clear or reset every query axis.
- Portable settings validation protects closed population, filter, view, and sort tokens before they reach query construction.

### Negative

- Migration 019 is a forward-only schema commitment, and future portable-wire emission remains coordinated with its format bump.

### Risks

- A malformed durable JSON preference must fall back safely rather than widening the result universe.

## Implementation

**Key files:**
- `src/db/migrations/019-dashboard-prefs.ts` — adds the four durable Dashboard preference columns.
- `src/db/app-settings-dao.ts` — validates and reads/writes the SQLite-backed preference fields.
- `src/backup/backup-schema.ts` — allowlists the future-portable keys without emitting them on the current wire.
- `src/logic/dashboard-query-logic.ts` — defines the shared state, default resolution, and reset transition.
- `src/stores/dashboard-query-store.ts` — mirrors durable query state through the DAO.
- `src/stores/dashboard-session-store.ts` — owns memory-only search and scroll session state.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-083 (Durable Multi-Package Theme Configuration and Restore-Before-Paint)
**Required by:** ADR-095 (Live-Applying Dashboard Floating Control Surface)
