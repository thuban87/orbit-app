# ADR-140: Navigation-First Settings Directory and Canonical Sub-Routes

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 37-settings-personalization
**Source decisions:** phase-37 Settings & Personalization dossier §§A–C, M, Q, S; 37-CONTEXT D-01, D-03, D-09
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Settings had accumulated into one 2,168-line scrolling control surface while the feature phases had already established separate canonical managers and preference writers. A typed route declaration alone could not prove a native stack registration, and Category Management had no safe CRUD or deletion-cascade implementation to expose.

## Decision

The system uses the preserved `Settings` route as a navigation-first directory: eight conceptual category routes in a fixed user-facing order carry title/subtitle rows without live values, while utility actions stay separate from navigation. Category pages reuse canonical managers and preference sources; the phase reserves Category Management only as an inert internal destination, with no registered row or CRUD surface until its owning phase. A runtime route list and source-scan test make every advertised route registration observable.

## Alternatives Considered

- **Keep the scrolling monolith** — Retain every control on one surface. Rejected because it obscures conceptual ownership and makes new controls harder to find.
- **Build Category CRUD now** — Add a minimal manager beside the reservation. Rejected because deletion fallout across Systems, Profile, assignments, and backup had not been designed.
- **Use type declarations as registration proof** — Test only `SettingsStackParamList`. Rejected because erased types cannot prove a `<Stack.Screen>` exists at runtime.

## Consequences

### Positive

- Settings remains discoverable without duplicating feature-domain writers or managers.
- The hub cannot target a route absent from the tested runtime registration contract.

### Negative

- New settings destinations must be added to both the runtime list and native stack registration.

### Risks

- Moving a specialized setting through a generic writer can silently weaken its established behavior; the Interaction Assist migration retains ADR-070's queue-clearing writer.

## Implementation

**Key files:**
- `src/screens/SettingsHubScreen.tsx` — renders the navigation-first Settings directory.
- `src/screens/settings-hub-model.ts` — defines the ordered route/action rows and params-free route boundary.
- `src/navigation/settings-routes.ts` — supplies the runtime Settings route-registration contract.
- `src/navigation/tabs/SettingsStack.tsx` — registers category and canonical manager routes in the Settings stack.
- `src/screens/SettingsInteractionsScreen.tsx` — migrates interaction defaults while preserving the specialized Interaction Assist path.

**Depends on:** ADR-080 (Four-Tab Bottom Navigation Shell with Per-Tab Stacks)
**Required by:** None
