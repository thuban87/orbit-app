# ADR-076: Population-Reached Birthdays Without a Dashboard Banner

**Status:** Accepted
**Date:** 2026-09-01
**Phase:** milestone-2 pre-build audit (oa-audit-dossiers)
**Source decisions:** dossier `phase-04-dashboard-data-state-foundation` §E Birthdays; `phase-05-dashboard-control-surface` §A and Notes for GSD; `orbit-ui-ux-working-roadmap-v1.0` §4 (Your Week row) and §7; owner ratification 2026-09-01
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-034 (partial — banner)
**Superseded by:** None

## Context

ADR-034 gave the Dashboard a permanent seven-day, soonest-first birthday banner above the contact list. The milestone-2 dossiers require a visually lean Dashboard whose contact content appears early, with no permanent birthday or upcoming module and richer upcoming-birthday content owned by Your Week — a surface that had no phase slot when the audit raised it (finding E-04). The owner ratified the removal on 2026-09-01 and a provisional Your Week phase row was added to the roadmap in the same batch.

## Decision

The Dashboard has no permanent birthday banner or upcoming module between its controls and its contact collection. Upcoming birthdays are reached through the Phase 4 Birthday population, which covers the next 30 days and, under Sort = Default, orders soonest birthday first. Richer upcoming-birthday presentation belongs to the deferred-planning **Your Week** phase, placed after Phase 16 in the roadmap. ADR-034's re-query freshness model — refresh on screen focus, app foreground, and pull-to-refresh rather than a database change listener — and its single strict local-date birthday parser remain in force unchanged.

## Alternatives Considered

- **Keep the seven-day banner and amend Phases 4 and 5** — Rejected because the owner ratified the lean Dashboard; a permanent module contradicts the settled top-level composition.
- **Remove the banner with no owning surface for upcoming birthdays** — Rejected because it would delete the "reason to reconnect" prompt with nothing planned to replace it; a provisional Your Week phase now owns it.
- **Fold birthdays into the existing Weekly Digest now** — Rejected because Digest has no birthday read today and Your Week is the settled owner of that presentation.

## Consequences

### Positive

- Contact content appears earlier on the Dashboard, and birthdays follow the same population, filter, sort, and search model as everything else.
- The 30-day window and Default ordering come from the shared Dashboard read rather than a bespoke banner query.

### Negative

- Upcoming birthdays lose their unprompted at-a-glance surface until Your Week is planned and built; reaching them becomes a deliberate population selection.

### Risks

- Your Week is deferred planning, so the gap is open-ended; the roadmap row is the only thing keeping the relocated presentation from being lost.
- The Birthday population must keep ADR-034's local-midnight comparison and explicit February 29 handling; moving the read must not reintroduce the UTC off-by-one.

## Implementation

**Key files:**
- `src/components/BirthdayBanner.tsx` — retired; the permanent Dashboard banner this decision removes.
- `src/screens/HomeScreen.tsx` — stops mounting the banner; its focus, foreground, and pull refreshes are retained.
- `src/db/dashboard-read.ts` — serves birthdays as a 30-day Dashboard population instead of a seven-day banner candidate list.
- `src/logic/birthday-logic.ts` — retained unchanged as the strict local-date parser and days-until computation.

**Depends on:** ADR-011 (Query-Time Status and Never-Contacted Segregation); ADR-032 (Flat Dashboard Discovery and In-Query Contact Search)
**Required by:** _None._
