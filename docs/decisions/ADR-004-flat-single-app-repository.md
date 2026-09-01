# ADR-004: Flat Single-App Repository

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 01-project-scaffold-portable-code
**Source decisions:** SKELETON.md "Repo shape" / "Data layer"; 01-01-SUMMARY (scaffold)
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Orbit reuses quest-board's React Native / Expo scaffolding and theme-token pattern (HANDOFF §2), but quest-board is an npm-workspaces monorepo whose Android build depends on monorepo-specific machinery: `patch-build-gradle`, Metro `watchFolders`, and `packages/*` path aliases. Orbit is a single app, not a workspace tree, so the scaffold had to decide whether to copy that machinery or stand up a flat layout.

## Decision

The repository is a **flat single Expo app** with `src/` at the repo root — no npm workspaces, no `packages/*`, and none of quest-board's monorepo build hacks. Module resolution uses exactly one alias, `@/* → ./src/*` (`tsconfig.json`), and `expo-sqlite` is installed and registered as an Expo config plugin during the scaffold so the first `prebuild` already covers the native module and Phase 2 needs no second native rebuild.

## Alternatives Considered

- **Copy quest-board's monorepo scaffolding verbatim** — Rejected. It would import `patch-build-gradle`, Metro `watchFolders`, and `packages/*` aliases that only exist to serve a workspace tree Orbit does not have, adding build fragility for zero benefit.
- **Defer installing native modules (expo-sqlite) until their feature phase** — Rejected. Registering the SQLite config plugin up front means one prebuild covers it; deferring would force a second native rebuild when Phase 2 lands the data layer.

## Consequences

### Positive

- The Android build path is plain Expo prebuild + Gradle — no monorepo patching — which the cross-machine pipeline (ADR-007) relies on.
- A single `@/*` alias keeps imports uniform across the flat `src/` tree.
- Native deps are registered at scaffold time, so feature phases add TypeScript, not native rebuilds.

### Negative

- Sharing code with quest-board is copy-port (as done for the portable plugin files), not a shared workspace package — each port is a deliberate, tracked extraction.

### Risks

- None material. The layout is conventional single-app Expo; the only cost is a future migration to workspaces if Orbit ever needs to become multi-package, which is a costly repo-shape change and out of scope.

## Implementation

**Key files:**
- `package.json` — pins the Expo SDK 57 stack with no `workspaces` field (flat single app).
- `tsconfig.json` — declares the sole `@/* → ./src/*` alias; no monorepo package aliases.
- `app.config.ts` — functional config that merges `app.json` and registers the `expo-sqlite` config plugin (deduped).
- `babel.config.js` — `babel-preset-expo` only; no `patch-build-gradle` or monorepo transform machinery.

**Depends on:** None
**Required by:** None

---
