# ADR-170: Bounded Your Week Reads and Settled Orrery Resource Retirement

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.4-audit-remediation-ui-performance-release
**Source decisions:** dossier Workstream B; 38.4-CONTEXT D-05, D-06, D-18, D-19; RG-027 (`performance/AUD-PERF-001`), RG-028 (`performance/AUD-PERF-004`)
**Reversibility:** costly
**Migration:** 031
**Supersedes:** None
**Superseded by:** None

## Context

Your Week filtered interactions and Group Events with `date(occurred_at)` predicates. SQLite cannot use an index for those predicates, so every Digest read scanned the whole history, and `group_events` had no date index at all. Separately, the Orrery switch runtime merged departed bodies into the published resources and the UI-thread choreography even after a switch had settled, so geometry and scene resources from earlier systems accumulated.

## Decision

Your Week reads are period-bounded. Every period predicate is an index-usable range, `occurred_at >= date(?) AND occurred_at < date(?, '+1 day')`, followed by the original `date()` predicate as a residual. The residual keeps the local-date semantics exact for every stored form a live writer produces. Migration 031 adds `idx_interactions_occurred_at` and `idx_group_events_occurred_at`. Group deduplication, archived-participant semantics and ADR-148's "no persisted Digest cache" are unchanged, and the backup format is unchanged because indexes are not portable data. Query plans are proven on a migrated schema: EXPLAIN shows SEARCH on the new indexes, and parity is checked against the pre-change SQL as a test oracle.

Orrery resources are retired once a transition settles. The `finish` worklet runs `settleSwitchChoreography` after its generation check, compacting the choreography to destination bodies. Resource publication goes through `nextOrreryResources`: only a running switch merges departures, and a settled publish replaces resources outright. Worklet helpers are defined above their callers, and a source scan across every Orrery module guards the Hermes forward-reference crash. No frame-time or latency claim is made without physical-device measurement (D-05).

## Alternatives Considered

- **A persisted Digest cache** — rejected (D-18); ADR-148 decided that Your Week is a live read.
- **Rewriting stored `occurred_at` values into one canonical form** — rejected; it would be legacy-data repair, which 38.2 D-23 rules out while there is no installed base.

## Consequences

### Positive

- Your Week read cost scales with the selected period rather than total history, and Orrery memory no longer grows with the number of switches.

### Negative

- Two more indexes are maintained on every interaction and Group Event write.
- A body that departed in one switch and returns in the next now animates as entering rather than retained.

### Risks

- The range pre-filter assumes strict local `YYYY-MM-DD HH:MM:SS` values (T-38.4-01-04). The backup schema does not validate `occurredAt`, so an offset-bearing value that arrives only through restore can fall outside the range and be silently excluded. This was accepted, not repaired.
- The Pixel device pass recorded meminfo and gfxinfo numbers (UI/RenderThread only) but made no performance claim.

## Implementation

**Key files:**
- `src/db/migrations/031-your-week-occurred-at-indexes.ts` — adds the two `occurred_at` indexes.
- `src/db/database.ts` — schema head bump.
- `src/db/your-week-read.ts` — range-bounded metric, date-count and day SQL.
- `src/db/your-week-read.test.ts` — EXPLAIN, parity and boundary proof.
- `src/logic/orrery-switch-choreography.ts` — `settleSwitchChoreography` worklet.
- `src/components/orrery/use-orrery-switch-runtime.ts` — settled compaction and `nextOrreryResources` / `pruneOrreryResources`.
- `src/components/orrery/orrery-worklet-order.test.ts` — worklet define-before-use guard.

**Depends on:** ADR-148 (Portable Your Week Period and Group-Deduplicated Activity Aggregation); ADR-009 (Crash-Safe Forward-Only SQLite Migrations)
**Required by:** None
