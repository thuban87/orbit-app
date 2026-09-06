# ADR-082: Universal Capture FAB, Canonical Picker, and Truthful Quick Log

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 22-app-shell-navigation
**Source decisions:** dossier `phase-01-app-shell-navigation` amendment; §§F, G, H
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Orbit needed one consistent capture surface across browse and read screens without pulling later workflow forms into the shell. Contact-specific actions also needed one local target-selection rule, while the fastest logging path had to remain truthful about whether its SQLite write had actually committed.

## Decision

The shell uses one fixed-order, six-action universal FAB: Add Contact, Quick Log, Log Contact, Group Log, Update Contact, and Memory. It preselects the current profile contact where applicable; otherwise contact-specific actions use one reusable local picker, while Group Log opens its own semantic route directly. Quick Log records an immediate current-time touchpoint only after a target is known, then shows Undo and success feedback only after commit; a failure shows retryable feedback instead.

## Alternatives Considered

- **Keep the dashboard-local Add speed dial** — Rejected because capture actions must be consistently available across browse and read surfaces.
- **Use Dashboard search as a contact picker** — Rejected because a compact reusable picker serves capture flows without changing the user's dashboard context.
- **Treat favourite rank as picker order** — Rejected because favourites are a membership band; their ordering remains interaction recency then alphabetical order.
- **Show Quick Log success optimistically** — Rejected because the UI must not claim a touchpoint that SQLite did not commit.

## Consequences

### Positive

- Global and profile-origin actions share fixed semantics and target resolution.
- Quick Log reuses the canonical recency writer and its guarded delete path, preserving history and derived status.

### Negative

- The shell owns transient picker, snackbar, and refresh coordination in addition to navigation.
- Later workflow phases must replace semantic placeholder routes without changing the universal action contract.

### Risks

- A duplicate dispatch could create duplicate touchpoints; write, undo, and retry paths stay single-flight.
- A picker read must remain on-device and must not expose archived contacts except through an explicit search.

## Implementation

**Key files:**
- `src/components/UniversalFab.tsx` — mounts the six-action speed dial and dispatches guarded Quick Log work.
- `src/components/universal-fab-logic.ts` — defines fixed action order and profile/global target intent resolution.
- `src/components/ContactPicker.tsx` — provides the reusable accessible local target picker.
- `src/db/picker-read.ts` — reads picker contacts by favourite membership, recency, and name.
- `src/components/Snackbar.tsx` — presents resolved commit, Undo, and retry feedback.
- `src/db/recency-dao.ts` — owns the reused touchpoint insert and delete transactions.

**Depends on:** ADR-023 (Structured Touchpoints and One-Tap Defaults); ADR-075 (Binary Favourite Membership Without a User-Facing Order); ADR-080 (Four-Tab Bottom Navigation Shell with Per-Tab Stacks)
**Required by:** _None._
