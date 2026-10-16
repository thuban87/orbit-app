# ADR-228: Truthful Relationship Overview — Never Contacted, Honest Unbound Reasons, Plain Definitions and a Custom Frequency Row

**Status:** Accepted
**Date:** 2026-10-16
**Phase:** 38.11-everyday-screens-ux
**Source decisions:** D-05, D-23, D-24, D-87, D-74, D-75, D-54 (38.11-CONTEXT.md; ledger Q-08, Q-15, Q-35; phase code review WR-03; owner ruling 39 D-77); carried D-08, D-14, D-20; device-pass decision B11
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Every new contact's Orbit Status read "Not tracked — Set a contact frequency to see Orbit Status." even when it had a frequency: one literal covered Unbound, no-frequency and never-contacted alike. Gravity read "Not available yet" for anyone with no interactions. The stat sheets showed numbers without saying what they measure, and a 45-day frequency selected nothing on the Profile's Frequency sheet.

## Decision

`resolveProfileStatus` returns an unavailable `reason`, classified after the unchanged availability gate, in the order archived → unbound → no-frequency → not-contacted (D-23):

- **Bound with a frequency and no interaction:** "Never Contacted" (D-05, D-08), "Orbit Status starts after your first logged interaction." A Rarely Responds contact reads "…after your first interaction that connects." (D-87). No progress, no status bucket; the clock does not start.
- **Unbound with a frequency:** stays "Not tracked" and asks the user to bind; Unbound with no frequency asks to set one and bind (D-24).
- **Archived:** keeps the previous result in this phase (38.12 owns archived display).

`getContactStatus` and the never-contacted segregation are untouched (D-20, ADR-011).

With no interactions, Gravity reads "No interactions yet" and its sheet says "Gravity builds as you log interactions." (D-74). The Orbit Status, Gravity and Intensity sheets open with a plain definition (`RELATIONSHIP_DEFINITIONS`): about one line for Status, more for Intensity, the most for Gravity. Each definition is built from the code's own tunables (for example the Gravity tier names). Last Interaction drops its repeated "Last interaction" prefix (D-75).

The Profile's Frequency sheet adds a "Custom…" row with a days box and Apply. Presets still apply on tap with no sheet-level Save, and a current custom value (such as 45 days) shows as the selected Custom row with "Every N days" (D-54, D-14).

## Alternatives Considered

- **One-line definitions only** — the owner asked for "as long as it needs" (Q-35).
- **Keep "Not available yet" for Gravity** — rejected for "No interactions yet" (Q-15).
- **Show a custom value but don't allow setting it** — rejected for Add Custom… (Q-08).
- **One Never Contacted line for everyone** — rejected; Rarely Responds gets its own line (D-87).

## Consequences

### Positive

- The status never tells a user to do something they already did.

### Negative

- The Custom row is the one Overview choice that needs an explicit Apply.

### Risks

- 38.12's archived arm edits the same function after this ordering; it must keep the reason union.
- The "Not available yet" Last Interaction text on a history-read error is kept as a bug-only state.

## Implementation

**Key files:**
- `src/services/profile-metrics.ts` — `resolveProfileStatus` reasons, Never Contacted contexts, `GRAVITY_EMPTY_LABEL`, `GRAVITY_EMPTY_CONTEXT`.
- `src/db/profile-read.ts` — passes `archived` to the status resolver.
- `src/db/profile-history-read.ts` — the date-only Last Interaction summary.
- `src/profile/relationship-sheet-model.ts` — `RELATIONSHIP_DEFINITIONS`, `frequencySheetSelection`, `customFrequencyApplyState`.
- `src/components/profile/ProfileRelationshipSheets.tsx` — definitions and the Custom… row.
- `src/constants/glossary.ts` — `NEVER_CONTACTED`, `RARELY_RESPONDS`.

**Depends on:** ADR-011 (Query-Time Status and Never-Contacted Segregation); ADR-111 (Cadence-Guarded Profile Metrics and Composed Relationship Actions); ADR-206 (Glossary — Canonical Terms Kept, Retired Forms Enforced, Plain-Word Rewrites, and a Shared Plural Helper)
**Required by:** None
