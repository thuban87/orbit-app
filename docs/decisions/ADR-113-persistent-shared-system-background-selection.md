# ADR-113: Persistent Shared System Background Selection

**Status:** Accepted
**Date:** 2026-09-10
**Phase:** 31.1-app-wide-system-backgrounds
**Source decisions:** CONTEXT D-01–D-03, D-08–D-09, D-12–D-13, D-17, D-20–D-21
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Phase 23 supplied bundled assets, durable per-package setting columns, and a background renderer, but production offered no System-background picker or live app-wide selection. The completion path must stay local, reuse the existing SQLite settings contract, and remain separate from Profile's app-owned photo templates.

## Decision

The system uses one shared selectable library containing the eight approved bundled WebPs plus None/Solid. Settings → Appearance shows all choices grouped by Galaxy and Standard, switches immediately, and writes only the active package's remembered background through the theme store and `app_settings`; invalid or failed local assets fall back safely to the package default or solid, and Profile background management remains a separate workflow.

## Alternatives Considered

- **Package-filtered picker** — Show only the active package's four assets. Rejected because all eight approved assets belong to the shared library even though each package remembers its own selection.
- **Focused picker sheet or separate screen** — Move selection outside Appearance. Rejected because an inline grouped grid provides live preview beside the other immediate theme controls.
- **Profile-to-System navigation hint** — Link the two background managers. Rejected by the owner because their assets, persistence, and navigation must remain independent.
- **AsyncStorage or a new schema** — Add another preference source. Rejected because migration 015 and the validated `app_settings` DAO already own both package selections.
- **Animated transition** — Crossfade between selections. Rejected as unnecessary phase work; switching is immediate and any future transition must respect Reduced Motion.

## Consequences

### Positive

- Every approved local asset is selectable in either package while Galaxy and Standard retain independent durable choices.
- Selection adds no network read, migration, backup-format change, or second source of truth.

### Negative

- The picker presents nine choices at once and must reflow at large text sizes.

### Risks

- A corrupt stored ID or asset decode failure could otherwise break appearance; DAO validation and render-time package-default/solid fallbacks contain both cases.

## Implementation

**Key files:**
- `assets/backgrounds/README.md` — records the approved local assets and brightness bounds.
- `src/theme/theme-option-ids.ts` — owns the accepted stable background IDs.
- `src/theme/backgrounds.ts` — owns library ordering, package defaults, local asset resolution, and fallback behavior.
- `src/stores/theme-store.ts` — applies the live selection to only the active package.
- `src/db/app-settings-dao.ts` — validates and persists the package-specific setting.
- `src/screens/SettingsScreen.tsx` — implemented the phase's inline grouped picker before the Settings surface was later split.

**Depends on:** ADR-087 (Bundled Background Presets and Package-Specific Surface Treatment)
**Required by:** None
