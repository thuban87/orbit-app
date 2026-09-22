# ADR-148: Portable Your Week Period and Group-Deduplicated Activity Aggregation

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 38-your-week
**Source decisions:** D-05, D-08, D-09 from phase CONTEXT.md; dossier §§H–J, O
**Reversibility:** one-way
**Migration:** 030
**Supersedes:** ADR-145 (partial)
**Superseded by:** None

## Context

Your Week needs one period definition for its metrics, heatmap, and inline day detail, but it cannot create a relationship-domain cache or count a Group Event once per participant. The owner also ruled that the period choice is a portable singleton preference, requiring a forward database migration and backup format v7.

## Decision

The system persists a validated `your_week_period` app setting, defaulting to Rolling 7 Days and optionally using the device locale’s Calendar Week. A read-only aggregate derives people reached, interactions, events, heatmap counts, and inline day records from canonical tables; a Group Event contributes one event record while only non-archived participants contribute to people reached. The setting is exposed in Settings and Digest and is included in backup format v7.

## Alternatives Considered

- **Persist a Digest snapshot or cache** — Rejected because Digest remains derived from canonical local data.
- **Use a fixed Sunday/Monday calendar week** — Rejected because Calendar Week follows device locale conventions.
- **Count each group participant as a separate event** — Rejected because it misrepresents one shared encounter.

## Consequences

### Positive

- Every Your Week surface shares one local date window and portable user choice.
- Existing heatmap language is reused without parallel metrics or group-event inflation.

### Negative

- Migration and backup-format chains must supply a safe default for earlier backups.

### Risks

- A later aggregation path that includes group-linked child interactions would double-count a Group Event.

## Implementation

**Key files:**
- `src/db/migrations/030-your-week-period.ts` — additively adds the validated singleton setting.
- `src/db/app-settings-dao.ts` — validates, persists, exports, and restores `yourWeekPeriod`.
- `src/services/history/week-window.ts` — defines Rolling 7 Days and locale-aware Calendar Week once.
- `src/db/your-week-read.ts` — performs read-only metrics, heatmap, and day-detail aggregation.
- `src/components/digest/YourWeekSection.tsx` — synchronizes the selected period and inline day detail.
- `src/components/digest/YourWeekHeatmap.tsx` — presents the shared heatmap language and structural selection.
- `src/backup/types.ts` — declares backup format v7.
- `src/backup/backup-schema.ts` — forwards v6 manifests with the safe period default.

**Depends on:** ADR-120 (Shared-Window Heatmap and Intensity with Globally-Persisted Lenses); ADR-145 (Category-Aware Portable Backup Format v6 and Exact Taxonomy Restore)
**Required by:** None.
