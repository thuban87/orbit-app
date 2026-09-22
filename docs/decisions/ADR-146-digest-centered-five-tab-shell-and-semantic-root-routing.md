# ADR-146: Digest-Centered Five-Tab Shell and Semantic Root Routing

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 38-your-week
**Source decisions:** D-01, D-03 from phase CONTEXT.md; dossier §§A–B, K–N
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-080 (partial); ADR-141 (partial)
**Superseded by:** None

## Context

The former four-tab shell made the contact browser its default and kept Backup as a second root even after Settings gained the canonical Backup tree. Phase 38 replaces that home model while retaining migration readiness, independent stacks, origin-aware Back behavior, and the global FAB.

## Decision

The system uses equal Contacts, Events, Digest, Orrery, and Settings tabs, with Digest centered and selected on a fresh launch. Each tab owns an independent stack and reselecting its active tab returns only that stack to root; external Digest entry points reset to the semantic Digest root, and Backup remains available only through the Settings-hosted canonical tree.

## Alternatives Considered

- **Keep the four-tab shell** — Rejected because Digest must become the permanent home model and Backup already has a Settings home.
- **Make Digest a raised special action** — Rejected because all five tabs are equal peers.
- **Preserve obsolete nested route shapes for external entry** — Rejected because notifications and links must target current semantic destinations.

## Consequences

### Positive

- Digest opens directly without discarding the user’s active stack on resume.
- Backup has one surviving host while origin-local Profile Back paths remain intact.

### Negative

- Navigation contracts and semantic reset helpers must distinguish product labels from retained internal route identities.

### Risks

- A reset into an obsolete stack shape could strand Back navigation or drain the shared backup intent at the wrong host.

## Implementation

**Key files:**
- `src/navigation/RootNavigator.tsx` — registers the five-tab root and shared reselect behavior.
- `src/navigation/shell-contract.ts` — defines tab order, initial tab, and canonical product labels.
- `src/navigation/reset-intents.ts` — builds semantic tab-root reset states.
- `src/navigation/notification-gate.tsx` — routes Digest notification responses to the Digest root.
- `src/navigation/tabs/SettingsStack.tsx` — owns the surviving Settings-hosted Backup tree.
- `src/components/UniversalFab.tsx` — retains the shell-global capture affordance across promoted roots.

**Depends on:** ADR-080 (Four-Tab Bottom Navigation Shell with Per-Tab Stacks); ADR-141 (Explicit-Host Dual-Home Backup Navigation)
**Required by:** None.
