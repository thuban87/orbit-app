# ADR-083: Durable Multi-Package Theme Configuration and Restore-Before-Paint

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 23-theme-visual-system
**Source decisions:** dossier `phase-02-theme-visual-system` §§A, C–D; CONTEXT D-03, D-08–D-10
**Reversibility:** one-way
**Migration:** 015
**Supersedes:** ADR-006 (partial)
**Superseded by:** None

## Context

Orbit's original token system persisted one `space-dark` selection in AsyncStorage and had no finished light palette. Theme package, appearance mode, accent, background, and per-package memory must instead be durable non-secret preferences that restore before the main UI appears and remain ready for the already-sequenced future backup-format change.

## Decision

The system uses `app_settings` migration 015 for a Galaxy/Standard package axis and separate remembered mode, accent-id, and background-id values per package. Galaxy plus Follow System is seeded by schema defaults; the legacy `orbit-theme` Zustand envelope is imported once, compare-before-write, then cleared. The boot gate hydrates the in-memory theme store before navigation mounts, while format-3 backups allowlist the seven keys without emitting them until the future format-4 work.

## Alternatives Considered

- **Continue using AsyncStorage for theme preferences** — Rejected because durable theme preferences must participate in the validated local settings boundary and future portable backup.
- **Store palette hex values in SQLite** — Rejected because storage holds stable option IDs or NULL; palette resolution belongs at render time.
- **Emit the new keys in format-3 backups** — Rejected because it would silently change the existing wire shape before its owner-sequenced format-4 migration.
- **Hydrate after mounting the main navigator** — Rejected because it permits a visible wrong-theme flash.

## Consequences

### Positive

- A package restores its own last-used mode, accent, and background without a network read.
- A fresh v0-to-v15 migration lands with safe Galaxy/Follow-System defaults.

### Negative

- Seven new columns are an irreversible on-device schema step.
- Theme-key export remains intentionally deferred until the backup format changes.

### Risks

- A repeat legacy import must compare values before writing because an empty settings update still advances revision metadata.

## Implementation

**Key files:**
- `src/db/migrations/015-theme-settings.ts` — adds the seven additive, constrained theme settings columns.
- `src/db/app-settings-dao.ts` — validates, reads, and writes typed theme preference IDs and modes.
- `src/theme/theme-option-ids.ts` — provides the canonical accent and background option IDs shared by validation and render resolvers.
- `src/theme/orbit-theme-migration.ts` — maps the legacy Zustand-persist envelope into durable settings values.
- `src/theme/hydrate-theme-at-boot.ts` — performs the idempotent legacy import and returns the boot-hydrated settings.
- `src/stores/theme-store.ts` — holds the SQLite-hydrated in-memory selection that drives rendering.
- `src/backup/backup-schema.ts` — allowlists the future-portable theme keys without changing format-3 emission.
- `App.tsx` — keeps the main shell behind the migration and theme-hydration gate.

**Depends on:** ADR-006 (Theme-Token Architecture)
**Required by:** ADR-084 (Four Semantic Theme Palettes, Curated Accents, and Contrast Validation); ADR-092 (Durable Shared Dashboard Query State)
