# ADR-130: Durable Scoped Default Interaction Channel

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 34-rapid-capture-update-flows
**Source decisions:** dossier `phase-13-rapid-capture-update-flows` §§P–Q; 34-CONTEXT D-03, D-09; owner-approved Quick Log adoption in 34-UAT
**Reversibility:** one-way
**Migration:** 027
**Supersedes:** None
**Superseded by:** None

## Context

Ordinary detailed logging needs a useful initial Channel without allowing an abandoned form to alter a durable setting. The preference must survive device-local backup/restore handling, while Group Log keeps its independently meaningful In Person default.

## Decision

The system uses two validated `app_settings` columns: `default_interaction_channel` chooses Remember Last Choice or a fixed Message, Call, or In Person value; `remembered_interaction_channel` always holds a concrete channel and seeds Remember Last Choice with Message. A successful ordinary single-contact save, including Quick Log, updates the remembered value; a cancelled or failed form does not. Group Log ignores the preference and defaults In Person; the keys are accepted and validated on restore but are not emitted or accompanied by a backup-format bump in this phase.

## Alternatives Considered

- **AsyncStorage preference** — rejected because this durable setting belongs in portable SQLite settings.
- **Update the remembered value when the form selection changes** — rejected because cancelled or failed forms must not change a saved preference.
- **Apply the ordinary preference to Group Log** — rejected because Group Log has its own In Person default.

## Consequences

### Positive

- Ordinary detailed logging has a portable, validated, deterministic Channel seed.

### Negative

- The best-effort post-save remembered-value update may lag a committed interaction if its separate settings write fails.

### Risks

- The migration's column vocabulary and defaults are permanent on upgraded devices.

## Implementation

**Key files:**
- `src/db/migrations/027-default-interaction-channel.ts` — adds the two validated singleton settings columns.
- `src/db/app-settings-dao.ts` — reads, validates, and writes the preference through the typed settings boundary.
- `src/screens/LogInteractionScreen.tsx` — resolves the ordinary initial value and updates the remembered value after a successful save.
- `src/backup/backup-schema.ts` — allowlists and validates the camelCase restore keys without emitting them.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-116 (Value-Remapped Interaction Vocabulary and Optional Descriptive Duration)
**Required by:** _None._
