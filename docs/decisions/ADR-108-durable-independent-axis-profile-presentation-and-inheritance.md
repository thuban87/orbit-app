# ADR-108: Durable Independent-Axis Profile Presentation and Inheritance

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 31-profile-experience
**Source decisions:** dossier `phase-10-profile-experience-dossier.md` §§D–I, AL, AO; 31-CONTEXT.md D-03, D-07, D-09, D-10; 31-01, 31-02, 31-08, and 31-15 summaries
**Reversibility:** one-way
**Migration:** 024
**Supersedes:** None
**Superseded by:** None

## Context

Profile layout, background, assignment, and collapse persistence did not exist. The single `profile` row represents the app owner and cannot store per-contact presentation. Reusable templates also need to propagate edits without converting inherited choices into silent contact-owned copies.

## Decision

The system uses four normalized Profile-presentation entities plus two nullable global settings. Layout and background are independent axes. Each resolves at read time through contact assignment or freeform override, Category assignment, global assignment, then factory or theme fallback. Reusable template edits propagate to assigned Profiles; freeform contact layouts are durable snapshots. Per-contact collapse state overrides template defaults, and switching layouts clears the old collapse overrides. Category changes or deletion make purely inherited axes fall through without materializing their former effective values. Reset deletes only contact presentation overrides.

Migration 024 introduces the schema through the forward-only migration runner. Profile entities and image bytes remain outside backup format 4; only the two global preference keys join its accepted settings allowlist for the later coordinated backup format.

## Alternatives Considered

- **Store presentation in the existing `profile` table** — Rejected because that table is the single self record, not per-contact state.
- **Combine layout and background in one assignment** — Rejected because changing either axis must preserve the other.
- **Materialize Category presentation onto contacts** — Rejected because inherited contacts must follow Category changes while explicit overrides survive.
- **Keep collapse state in component or session state** — Rejected because the chosen presentation must survive navigation and relaunch.
- **Let Reset clear contact or relationship data** — Rejected because reset is presentation-only.
- **Widen backup format 4 with partial Profile entities** — Rejected because its wire contract was already spent; transport must move the complete graph and referenced bytes together.

## Consequences

### Positive

- Layouts and backgrounds can be assigned and changed independently at global, Category, and contact scope.
- Missing or deleted template references fall through safely without rewriting durable intent.
- Presentation reset cannot alter Favorite, Snooze, cadence, knowledge, AI permission, or interaction history.

### Negative

- JSON layout and collapse documents require a closed, versioned semantic vocabulary.
- Dangling references must remain diagnosable even when rendering safely falls through.

### Risks

- A whole-row global or Category update can overwrite the sibling axis with stale state; axis-specific writers and regression tests are required.
- Deletion order or an incorrect foreign-key assumption can strand assignments or block Category deletion.
- Migration failure is irreversible for an unreachable device, so the complete schema and full chain require atomic proof before release.

## Implementation

**Key files:**
- `src/db/migrations/profile-presentation.ts` — creates the four presentation entities and global setting columns as migration 024.
- `src/db/database.ts` — registers the migration and imports its exported schema version as the target.
- `src/profile/persisted-contract.ts` — defines the closed persisted module and collapse vocabulary.
- `src/profile/presentation-schema.ts` — parses and canonicalizes versioned layout documents.
- `src/db/profile-presentation-read.ts` — reads templates, assignments, globals, and contact overrides.
- `src/db/profile-presentation-dao.ts` — owns atomic template, assignment, collapse, reset, and axis-specific mutations.
- `src/profile/resolve-presentation.ts` — resolves both axes independently and reports missing references.
- `src/db/app-settings-dao.ts` — validates the two nullable global presentation UIDs.
- `src/db/contacts-dao.ts` — preserves explicit overrides and fallthrough during individual Category changes.
- `src/db/bulk-actions-dao.ts` — applies the same inheritance contract to bulk Category changes.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-083 (Durable Multi-Package Theme Configuration and Restore-Before-Paint)
**Required by:** ADR-112 (App-Owned Profile Background Derivatives and Launch Reconciliation)
