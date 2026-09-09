# Profile presentation

**Last updated:** 2026-09-09
**Updated by phase:** 31-profile-experience
**Owners:** `src/screens/ContactProfileScreen.tsx`, `src/db/profile-read.ts`, `src/db/profile-presentation-read.ts`, `src/db/profile-presentation-dao.ts`, and `src/profile/`

## Purpose

Profile is Orbit's local, presentation-first read surface for one contact. It keeps identity and practical actions fixed while letting the body resolve a safe, semantic layout, background, and collapse state without altering contact, knowledge, cadence, Favorite, Snooze, or AI-permission data.

## Architecture

### Data model

The Profile's durable presentation state is local SQLite application state. It is independent from relationship facts and resolves each layout/background axis at read time:

`contact override → Category assignment → global assignment → factory/theme fallback`

**Tables:**

- `profile_layout_templates` — reusable named, versioned layout documents.
- `profile_background_templates` — named app-owned relative image paths.
- `profile_category_presentation` — independent nullable layout/background template UIDs per Category.
- `profile_contact_presentation` — contact-specific template/freeform layout/background overrides and the per-module collapse map.
- `app_settings` — global nullable layout/background template UIDs.

The stable migration object is `profilePresentationMigration`; `src/db/database.ts` imports its exported `PROFILE_PRESENTATION_SCHEMA_VERSION` as `TARGET_VERSION` and registers it in the normal ordered migration list. Consumers must use those exports, not a literal migration number.

### Read and render flow

1. `ContactProfileScreen` runs `readProfileSnapshot()` on focus and shell-refresh events.
2. The reader opens one local read snapshot, aggregates identity, methods, metrics inputs, knowledge, history, and presentation inputs, then classifies only explicitly optional knowledge/history failures.
3. `resolveProfilePresentation()` resolves independent axes and records dangling template diagnostics without rewriting durable UIDs.
4. The screen keeps `ProfileHero` structurally fixed and passes the snapshot plus resolved presentation to `ProfileModuleHost`.
5. The module host renders semantic IDs (`relationship-overview`, `things-to-remember`, `contact-methods`, `interaction-history`), writes collapse only through the public presentation DAO, then publishes DAO readback.
6. Layout/template/background managers and relationship sheets are topmost overlays. Their dismissal leaves the underlying Profile inert; ordinary Back otherwise remains the originating native-stack Back path.

### Key files

| File | Role |
|------|------|
| `src/screens/ContactProfileScreen.tsx` | Thin controller, one local snapshot, fixed Hero, overlay state, and source-owner handoffs. |
| `src/db/profile-read.ts` | Coherent renderer-neutral aggregate read. |
| `src/db/profile-presentation-read.ts` | Durable presentation inputs and template read helpers. |
| `src/db/profile-presentation-dao.ts` | Transactional template, assignment, collapse, reset, and fallback writes. |
| `src/profile/resolve-presentation.ts` | Pure independent-axis precedence and missing-reference diagnostics. |
| `src/profile/module-registry.ts` | Closed renderer identities that protect the Phase 32 History replacement seam. |
| `src/components/profile/ProfileHero.tsx` | Fixed identity and Message/Call/Favorite/overflow geometry. |
| `src/components/profile/ProfileModuleHost.tsx` | Resolved semantic body and collapse readback host. |
| `src/components/profile/ProfileLayoutEditor.tsx` | Draft-only complete-layout editor with drag and Move alternatives. |
| `src/components/profile/ProfileTemplateManager.tsx` | Reusable layout templates, assignments, usage, and deletion fallback. |
| `src/components/profile/ProfileBackgroundManager.tsx` | Local picker/crop/template/assignment workflow. |

## Behavior contracts

### Fixed identity and origins

The Hero is fixed structure, not a draggable/sticky layout module. It always supplies identity, Favorite, Message, Call, and one overflow entry point. Missing/unusable methods remain readable with explicit disabled reasons. Dashboard, Orrery, Settings, widget, and notification entries retain the native stack's origin-aware Back behavior; widget and notification resets are built at their external routing boundaries.

The controller never creates a second Profile data writer. Favorite, archive, lifecycle, frequency, and Snooze route through their existing public DAOs/services; after a successful write it reloads the coherent local snapshot. User-triggered call/message/email handoffs use the established interaction-assist service. No read depends on network access.

### Semantic body and relationship facts

The module registry owns persisted semantic IDs, not component names. Relationship Overview auto-packs the six supported facts while preserving source order and text reflow. Every nullable cadence consumer is guarded: an Unbound contact is `Not tracked`; Intensity uses the shared current-calendar-month fallback rather than inventing a cadence. Status, Gravity, and Intensity are derived read models, never stored Profile scores.

Things to Remember is a one-column, source-owned presentation. Its cards emit owner targets for Memory, relationships, current state, normalized custom fields/history, and fuel; Profile does not reinterpret or directly mutate them. Ordinary Off Limits stays local caution content with no sparkle and no inferred permission. There is no Profile AI-draft entry: Compose remains the sole AI-suggestion invocation surface under ADR-079.

Interaction History is deliberately bounded and rendered behind the stable `interaction-history` semantic key. Phase 32 may replace that renderer without migrating layouts or collapse state.

### Customization and reset

Layout and background resolution is independent. A Category change/deletion removes only the Category assignment; inherited contacts fall through and explicit contact/freeform choices survive. A contact's freeform layout is a snapshot, whereas editing a reusable template affects its assigned Profiles.

The sole overflow order is Edit Contact, Snooze/Unsnooze, Archive, separator, Profile Layout, Background, conditional Save Current Layout as Template, and conditional Reset. Archive remains recoverable; Reset removes only this contact's layout/template, collapse, and background overrides. It never touches contact data, Favorite, Snooze, AI permission, knowledge, or interaction history.

Background bytes stay in app-owned `profile-backgrounds/<uid>.jpg` paths. Picker/cache paths never enter SQLite. A launch-time reconciliation sweep, registered after migration readiness, cleans interrupted local derivative writes; no timer or network work is used.

## Backup and cross-phase boundaries

`BACKUP_FORMAT_VERSION` remains 4. The two nullable global Profile preference keys are accepted/allowlisted in the portable settings schema, but Profile templates, Category/contact assignments, freeform layouts, collapse maps, background-template rows, and image bytes are **not emitted or restored** by format 4. This is deliberate: Phase 36 owns the coordinated format decision. Do not add partial Profile entities to an existing format projection.

Phase 32 owns the full History UX while preserving `interaction-history`. Phase 36 owns the eventual Profile presentation backup-wire decision. Phase 37 may reuse the Profile template managers from Settings and owns Category CRUD; its Category deletion must preserve this resolver's fallout contract. Phase 40 owns background-image memory/performance hardening.

## Decisions

- **ADR-062:** Bound/Unbound lifecycle — cadence is nullable and all Profile consumers guard it.
- **ADR-078:** Off Limits remains a local caution surface and is not an AI/search/dashboard permission proxy.
- **ADR-079:** Compose is the only suggestion invocation; the Profile AI draft entry is retired.
- **ADR-081:** Per-item explicit AI permission replaces proposed fuel permission; no implicit permission is inferred here.

## Gotchas

1. **Use one aggregate read.** Do not add component-owned SQL or a second ranking/metric read; refresh the controller snapshot after committed writes.
2. **Hero is fixed.** Layout documents may reorder only the semantic body, never avatar, identity, Favorite, Message, Call, or overflow.
3. **Keep axes independent.** A layout write at Category/global scope must preserve the existing background UID and vice versa.
4. **Never materialize inheritance.** Missing references diagnose and fall through; Category changes must not copy effective presentation into contact rows.
5. **No AI inference.** Hidden-from-Profile and Off Limits do not imply privacy, deletion, AI exclusion, or permission.
6. **No literal migration number.** Refer to `profilePresentationMigration` and `PROFILE_PRESENTATION_SCHEMA_VERSION`; the ordered registry is authoritative.
7. **No partial backup widening.** Allowlisting a settings key is not permission to emit entities under the current format.

## Related systems

- **Contact knowledge** — supplies source-owned remembered-information facts and writers.
- **Contact methods / Interaction assist** — supplies actionable methods and user-triggered native handoff.
- **Status engine / Interaction log** — supplies truthful derived metrics and bounded interim history.
- **Photos** — owns app-local background derivative lifecycle.
- **Backup & restore** — owns the deferred portable-wire boundary.

## Changelog

| Date | Phase | What changed |
|------|-------|--------------|
| 2026-09-09 | 31 | Added the Profile presentation controller, local snapshot/resolution architecture, customization boundaries, and Phase 32/36/37/40 handoffs. |
