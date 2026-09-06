# ADR-099: Durable Global Dashboard Right-Swipe Action

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 27-dashboard-list-view
**Source decisions:** dossier `phase-06-dashboard-list-view` §O; 27-CONTEXT D-03, D-09
**Reversibility:** one-way
**Migration:** 020
**Supersedes:** None
**Superseded by:** None

## Context

Dashboard List rows need one committed right-swipe logging action, but people differ on whether a low-friction Quick Log or detailed Log Contact is appropriate. This preference must survive restarts and eventual portable backup without creating per-contact gesture configuration or a List-specific logging implementation.

## Decision

The system persists one global `dashboard_right_swipe_action` setting with the closed values `quick-log` and `log-contact`, defaulting to `quick-log`. Migration 020 adds the constrained column to the singleton `app_settings` row; the settings DAO validates every write, and the backup schema allowlists the future portable key without changing the backup format in this phase. A committed List right swipe and its accessibility equivalent use that preference, falling back to Quick Log when the setting cannot be read.

## Alternatives Considered

- **Per-contact swipe configuration** — tailor logging to individual contacts. Rejected because the product specifies one global preference.
- **A second tap on a revealed action** — avoid committing on swipe threshold. Rejected because both configured actions execute when the gesture commits.
- **AsyncStorage-only preference** — avoid schema work. Rejected because durable Dashboard preferences belong in `app_settings` and must be portable.
- **Emit a new backup format now** — carry the new value immediately. Rejected because Phase 36 owns the coordinated format bump and wire migration.

## Consequences

### Positive

- The default supports immediate low-friction logging while preserving one global detailed-flow choice.
- SQLite, TypeScript, and DAO validation provide layered protection against invalid persisted actions.

### Negative

- The new column is an irreversible on-device migration and the setting UI is owned by a later phase.

### Risks

- Restore data cannot be trusted solely because its key is allowlisted; the migration CHECK constraint remains the durable backstop until the later restore-format work.

## Implementation

**Key files:**
- `src/db/migrations/020-dashboard-swipe-pref.ts` — adds the defaulted CHECK-constrained settings column.
- `src/db/database.ts` — registers migration 020 in the strict forward-only sequence.
- `src/logic/dashboard-query-logic.ts` — defines the closed right-swipe action union.
- `src/db/app-settings-dao.ts` — reads, validates, and writes the typed action through the settings boundary.
- `src/backup/backup-schema.ts` — allowlists the deferred portable setting key.
- `src/screens/HomeScreen.tsx` — resolves the action only at List-gesture commitment and routes it through shared flows.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-092 (Durable Shared Dashboard Query State)
**Required by:** None
