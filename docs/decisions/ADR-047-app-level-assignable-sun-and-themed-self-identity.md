# ADR-047: App-Level Assignable Sun and Themed Self Identity

**Status:** Accepted
**Date:** 2026-08-17
**Phase:** 13-orrery
**Source decisions:** dossier `09-orrery` Cluster D; 13-CONTEXT; plans 01, 04, and 06
**Reversibility:** one-way
**Migration:** 003
**Supersedes:** None
**Superseded by:** None

## Context

The orrery needs a centre that can be the self record or a chosen contact, while self has no relationship status from which to derive a meaningful glow. This is durable application state, not a per-contact rendering attribute, and all visible colours must continue to come from theme tokens.

## Decision

The system stores nullable `sun_contact_id` and `self_sun_colour` in the singleton `app_settings` row. NULL means self; a contact sun uses its status glow, while self resolves a validated themed `starPalette` value or its ordered default. Settings, rather than an orrery gesture, owns sun assignment and self-star selection.

## Alternatives Considered

- **Store the sun selection on each contact** — Rejected because the centre is one application-level preference, not contact state.
- **Give self a fixed or status-derived colour** — Rejected because self has no decay relationship and the owner chose a personal themed star.
- **Use freeform or hardcoded colour values** — Rejected because they would bypass theme retuning and the DAO's validated write contract.
- **Assign the sun by long-pressing the canvas** — Rejected because it collides with radial drag and is too easy to trigger accidentally.

## Consequences

### Positive

- A hard-purged sun contact safely falls back to self through `ON DELETE SET NULL`.
- Palette changes remain centralized and every selected star is writable through the DAO validator.

### Negative

- Soft-archived or missing occupants need a shared read-time self fallback because a foreign key cannot observe archive updates.

### Risks

- Reordering `starPalette` restyles persisted selections; its order is therefore a stable theme contract.

## Implementation

**Key files:**
- `src/db/migrations/003-orrery-settings.ts` — adds nullable sun and self-colour settings with the hard-purge fallback FK.
- `src/db/app-settings-dao.ts` — validates, reads, and updates the singleton sun settings.
- `src/logic/sun-occupant-logic.ts` — resolves self or a visible contact sun through one archived/missing fallback rule.
- `src/theme/theme-types.ts` — defines the star, muted, and extinguished-rogue token contract.
- `src/theme/theme-presets.ts` — provides the ordered themed palette values.
- `src/screens/SettingsScreen.tsx` — exposes the self-star swatches and Sun / centre picker.

**Depends on:** ADR-006 (Theme-Token Architecture); ADR-009 (Crash-Safe Forward-Only SQLite Migrations).
**Required by:** ADR-048 (Status-Default Static Orrery with a Single-Canvas Morph)
