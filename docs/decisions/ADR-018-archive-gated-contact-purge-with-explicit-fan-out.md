# ADR-018: Archive-Gated Contact Purge with Explicit Fan-Out

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 04-contact-crud-lifecycle
**Source decisions:** dossier `06-crud` Cluster C; 04-CONTEXT Area 1; plans 04-08 and 04-09
**Reversibility:** one-way
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Orbit has no server or automatic recovery path, so permanent contact deletion needs a structural safety gate and an honest account of its blast radius. Archive and never-contacted describe distinct populations and must not share a misleading home.

## Decision

The system requires archive before purge: archive is reversible from the profile, while restore and permanent deletion live only in Settings’ Archived contacts list. Purge verifies the archived state inside one transaction, explicitly deletes every owned database row, and follows a single impact-summary confirmation; destructive UI uses the owner-approved `danger` theme token.

## Alternatives Considered

- **Put archive and purge together on the profile** — Rejected because it puts the irreversible action adjacent to the reversible one.
- **Require typing the contact name** — Rejected because an exact impact summary provides sufficient protection with less friction.
- **Use a plain yes/no confirmation** — Rejected because it does not communicate what will be lost.
- **Combine archived and never-contacted contacts** — Rejected because retired contacts and live contacts awaiting a first interaction are different states.

## Consequences

### Positive

- A direct DAO caller cannot bypass the two-stage lifecycle guard.
- Explicit deletion makes the durable blast radius auditable, including `field_history` which cannot rely on a foreign key cascade.

### Negative

- Photos and scheduled notifications require best-effort post-commit cleanup adapters when their owning subsystems arrive.

### Risks

- Permanent deletion remains unrecoverable; the archive gate, transaction rollback, impact summary, and single confirm are the safeguards.

## Implementation

**Key files:**
- `src/db/contacts-dao.ts` — archives, restores, and lists archived contacts with lifecycle-scoped predicates.
- `src/db/purge-dao.ts` — computes impact, enforces the archived guard, and performs explicit one-transaction fan-out deletion.
- `src/screens/ArchivedContactsScreen.tsx` — presents restore and the danger-styled single-confirm purge action.
- `src/theme/theme-types.ts` — declares the destructive `danger` palette token.
- `src/theme/theme-presets.ts` — defines the owner-approved `danger` value in the space-dark preset.

**Depends on:** ADR-008 (Initial Contact Schema as a Cross-Phase Data Contract); ADR-013 (Runtime Two-Table Custom Fields with Whitelist-Constructed DDL); ADR-006 (Theme-Token Architecture).
**Required by:** None.
