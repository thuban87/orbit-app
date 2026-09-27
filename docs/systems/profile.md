# Profile presentation

**Last updated:** 2026-09-26
**Updated by phase:** 38.4-audit-remediation-ui-performance-release
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

1. `ContactProfileScreen` runs `readProfileSnapshot()` through `createProfileSnapshotLoader()` (`src/screens/contact-profile-logic.ts`). The load is latest-request gated, so an older read can never overwrite a newer snapshot or error. It runs on focus, on the shell tick (`useShellRefresh`), and on the post-sweep foreground tick (`useForegroundRefresh`, 38.3 D-14 ordering). The shell subscription returns early while the app is backgrounded (`shouldRunProfileShellRefresh(AppState.currentState)`, over the shared `isAppBackgrounded` predicate in `src/utils/screen-visibility.ts`; 38.3 VERIFICATION W2, 38.4 D-10), so a warm notification Mark/Snooze delivered in the background costs no Profile read; the foreground tick stays ungated because it only fires after resume. Each current successful publication bumps `historyRevision`, which `ProfileModuleHost` passes to `HistorySection` as `revision`. The Profile snapshot is the single invalidation owner for both projections: Status, Gravity, Intensity and Last Interaction refresh from the same trigger as History (RG-024).
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
| `src/components/profile/ProfileModuleHost.tsx` | Resolved semantic body and collapse readback host; owns the in-Profile History reveal. |
| `src/profile/module-host-model.ts` | Pure section-header state, `resolveHistoryReveal`, and the `createHistoryRevealScroll` scroll bookkeeping. |
| `src/profile/relationship-sheet-runner.ts` | Owner-scoped submit/Retry settlement for the Contact Frequency and Snooze selectors. |
| `src/components/profile/ProfileLayoutEditor.tsx` | Draft-only complete-layout editor with drag and Move alternatives. |
| `src/components/profile/ProfileTemplateManager.tsx` | Reusable layout templates, assignments, usage, and deletion fallback. |
| `src/components/profile/ProfileBackgroundManager.tsx` | Local picker/crop/template/assignment workflow. |
| `src/screens/SettingsAppearanceScreen.tsx` | Exposes only the global layout/background defaults; per-contact managers remain Profile-scoped. |

## Behavior contracts

### Fixed identity and origins

The Hero is fixed structure, not a draggable/sticky layout module. It always supplies identity, Favorite, Message, Call, and one overflow entry point. Missing/unusable methods remain readable with explicit disabled reasons. Its Message action opens Compose with `origin: 'profile'`, so Back or a confirmed logged handoff returns by stack pop to the Profile that launched it; widget and notification resets remain built at their external routing boundaries.

### Message eligibility (38.3, RG-021)

Hero Message is decided by `profileHeroActionState(methods, { archived, settingsHosted })` in `src/profile/relationship-sheet-model.ts`, checked in this order:

1. **Archived contact, in any host → disabled** with "Archived contacts can't be messaged." (owner ruling D-09). Messaging an archived contact stays prohibited.
2. **Profile hosted in the Settings stack → disabled** with "Open this contact from Contacts to send a message." (owner ruling D-25). This covers the archived Profile (Settings → Contacts → Archived → Profile) and a live participant Profile reached inside Settings through a group event.
3. **No actionable phone or email → disabled** with the existing add-a-method reason.

Message is always rendered — disabled with its reason caption, never hidden. Lifecycle is not an input: a live Unbound contact outside Settings can still open Compose. Call keeps its phone-only rule in every host, and the Contact Methods row's native SMS handoff stays enabled for archived contacts (D-27).

The host is explicit, not inferred from navigation state: `SettingsStack` registers `Profile` through `SettingsProfileHostRoute`, which renders `ContactProfileScreen` with `host="settings"` (the same pattern as the Backup host wrappers). Compose and ComposeResearch are **never registered under Settings** and there is no cross-tab jump to message; `SETTINGS_HOST_EXCLUDED_PROFILE_ROUTES` in `src/navigation/shell-contract.ts` names them, and `settings-routes.test.ts` fails if either is registered. Every other route in `PROFILE_REACHABLE_ROUTES` (including `RecentlyDeleted`) must be registered wherever Profile is hosted.

The controller never creates a second Profile data writer. Favorite, archive, lifecycle, frequency, and Snooze route through their existing public DAOs/services; after a successful write it reloads the coherent local snapshot. User-triggered call/message/email handoffs use the established interaction-assist service. No read depends on network access.

### Semantic body and relationship facts

The module registry owns persisted semantic IDs, not component names. Relationship Overview auto-packs the six supported facts while preserving source order and text reflow. Every nullable cadence consumer is guarded: an Unbound contact is `Not tracked`; Intensity uses the shared current-calendar-month fallback rather than inventing a cadence. Status, Gravity, and Intensity are derived read models, never stored Profile scores.

Things to Remember is a one-column, source-owned presentation. Its cards emit owner targets for Memory, relationships, current state, normalized custom fields/history, and fuel; Profile does not reinterpret or directly mutate them. Ordinary Off Limits stays local caution content with no sparkle and no inferred permission. There is no Profile AI-draft entry: Compose remains the sole AI-suggestion invocation surface under ADR-079.

Section headings identify their section only. Module bodies own values, empty states, and distinct subsections, so nested renderers never repeat a parent heading or place inferred state beside it. Temporal current-state knowledge renders one Most Recent item and at most five non-current Previous items; full history remains in Memory History. Heading actions open source-owned editors: existing Edit Contact for relationships/custom fields and the scoped Off Limits editor for fuel. Its controller filters reads, forces `off_limits` writes, validates delete IDs against the filtered collection, and reloads controlled items after successful mutations.

Unbind remains a confirmed lifecycle action for Bound contacts but lives in the Profile overflow; the meaningful Bind experience remains visible for Unbound contacts. Relationship Overview retains the existing compact/wide preference, then derives only a visual full-row span for compact row orphans. It preserves configured order and semantic size while centering every tile's content.

### Layout preview geometry (38.4, RG-033)

The layout editor's live preview uses the same geometry as the real Relationship Overview (`ui-accessibility/AUD-UIA-021`). Both go through `src/components/profile/overview-geometry.ts`. `overviewColumnWidth` is `(width − SPACING.sm·(columns − 1)) / columns`, and `overviewTileWidth` is `span·column + (span − 1)·SPACING.sm`.

The preview packs its modules against the **Profile overview's** width basis, not its own. `profileOverviewWidthBasis(window)` is the window width minus 66dp, which is the overview's full inset chain: `ContactProfileScreen` content padding, the `ProfileSection` body padding and the section card's `GlassSurface` border. So at any window width and font scale, the preview shows the same column count, row membership and spans as the Profile, including the 360dp point where the real overview drops to one column.

Tiles are then **sized** from the preview card's own measured width with the same formulas and `SPACING.sm` gaps. The card sits inside the sheet padding, so it is narrower than the Profile overview, and using Profile pixel widths would overflow it. The preview renders no tiles until that width is measured. A test reads the three inset style sites and fails if any of them drifts from the 66dp constant. Saved layouts, layout controls and orphan stretching are unchanged.

The editor's per-module visibility switch uses the themed `trackColor`/`thumbColor` tokens and keeps its "Show {module}" accessible name (RG-030 `ui-accessibility/AUD-UIA-003`).

Interaction History renders the full History & Insights section (Heatmap, Intensity, Rolodex, Detail Sheet) behind the stable `interaction-history` semantic key via `ProfileModuleHost.renderHistory()`; the replacement of the earlier bounded stub migrated no layouts or collapse state. Knowledge-change rows in its Detail Sheet route back through the screen's existing knowledge navigation via a threaded `onOpenKnowledgeChange`. See `interaction-history.md`.

### History actions reveal the in-Profile History section (38.3, RG-021)

The Last Interaction overview tile and the Orbit Status sheet's **View history** both reveal the Profile's own History section (owner rulings D-10, D-11, D-28). There is no History route and no timeline screen — ADR-123 replaced the timeline with this section.

- `resolveHistoryReveal({ topLevel, collapse })` decides availability from the resolved layout: History is available only when a visible `interaction-history` placement exists. Expanded state uses the section header's own rule, so the reveal and a header tap agree.
- `revealHistory()` in `ProfileModuleHost` closes the relationship sheet first. If History is collapsed it expands through the **same persisted `toggle`** a header tap uses (D-28) — there is no temporary expansion state, and the user can collapse it again. It then asks the screen to scroll to host y + History y via `onRequestScrollTo`.
- The header's y does not move on expand, but a ScrollView clamps `scrollTo` to its current content height. So an expanding reveal scrolls on the first expanded History layout (`createHistoryRevealScroll`), or immediately if the expand write failed; an already-expanded History scrolls at once.
- `ContactProfileScreen` scrolls its single `ScrollView` by ref, instant when reduced motion is on (`useReducedMotion`). Every Profile host (Contacts, Events, Digest, Orrery, Settings) renders this same screen.
- The reveal never resets History's period or selection. An expanded History is not written to or remounted; a collapsed one had no mounted state to keep.
- **When the layout hides History, neither action is offered (D-11).** The host passes no History handler. The Last Interaction tile then renders as an informational `View` with the same content and label, no button role and no `onPress`. The Status explanation (`relationshipExplanation`, `historyAvailable: false`) omits its `history` route. Nothing mutates the layout or temporarily shows History.

### Relationship selector settlement (38.3, RG-025)

The Contact Frequency and Snooze sheets settle every write through `createRelationshipSheetRunner` (D-24). A submit records its selector and operation as the retry target. Submit and **Retry** share one `settle` path: start, await, then `success` and close, or `failure`. So a Retry touches only the selector that failed and always leaves it non-pending. Close/Back and a reopened sheet keep both selectors usable, and a repeated Retry failure stays recoverable. A submit or Retry for a selector that is already pending is ignored. Values are never deduped, so a repeated Snooze is a real event. The component keeps a synchronous mirror of both selector states so the runner's pending checks never read a stale render. Snooze semantics and choices are unchanged.

### Customization and reset

Layout and background resolution is independent. A Category change/deletion removes only the Category assignment; inherited contacts fall through and explicit contact/freeform choices survive. A contact's freeform layout is a snapshot, whereas editing a reusable template affects its assigned Profiles.

The sole overflow order is Edit Contact, Snooze/Unsnooze, Archive, separator, Profile Layout, Background, conditional Save Current Layout as Template, and conditional Reset. Archive remains recoverable; Reset removes only this contact's layout/template, collapse, and background overrides. It never touches contact data, Favorite, Snooze, AI permission, knowledge, or interaction history.

Background bytes stay in app-owned `profile-backgrounds/<uid>.jpg` paths. Picker/cache paths never enter SQLite. A launch-time reconciliation sweep, registered after migration readiness, cleans interrupted local derivative writes; no timer or network work is used.

Background rendering follows the already-resolved presentation axis rather than checking only a contact override. A resolved contact, Category, or global app-owned background URI wins. When resolution falls through to `source: "theme"`, Profile passes no app-owned URI to its own `BackgroundHost`, which then renders the active package's selected System background. Bundled System slots never enter `profile_background_templates`, and the Profile manager does not navigate to the System-background selector.

Both template managers obtain categories in canonical order and use a bounded complete searchable Sheet with no Uncategorized row. Category rename preserves the local-ID assignment. Category deletion removes only the deleted row's presentation inside the same fallout transaction, so affected contacts fall through to global/factory inheritance while contact-specific choices remain unchanged.

## Backup and cross-phase boundaries

Backup format v5 emits and restores both nullable global Profile preference keys, reusable layout/background templates, and the `profile_contact_presentation` / `profile_category_presentation` assignment rows. Presentation rows travel under their parent contact or Category UID; freeform layout JSON and collapse JSON remain intact. Each background template also carries its image bytes, which restore stages before the database transaction and rehydrates after commit to the UID-derived `profile-backgrounds/<uid>.jpg` path.

The full History UX is owned by the History & Insights subsystem and mounts behind the preserved `interaction-history` key. Settings exposes the nullable global layout/background defaults but does not link the per-contact managers; Category management remains a separate lifecycle concern. Phase 40 owns background-image memory/performance hardening.

## Decisions

- **ADR-143:** Lock-Time-Revalidated Atomic Category Deletion and System Fallout — removes the deleted Category presentation assignment so inherited axes fall through.
- **ADR-144:** Complete Category Selection and Grouped Orrery System Discovery — keeps Profile category assignment real-only and complete at arbitrary catalog size.
- **ADR-108:** Durable Independent-Axis Profile Presentation and Inheritance — owns the normalized template/assignment/override model, precedence, collapse persistence, and presentation-only reset.
- **ADR-109:** Fixed-Hero Semantic Profile Composition and Focused Accessible Editors — fixes Hero geometry and constrains the semantic body and editor workflows.
- **ADR-110:** Coherent Local Profile Snapshot and Source-Owned Knowledge Projection — keeps one local snapshot while preserving each knowledge source's ownership and permission semantics.
- **ADR-111:** Cadence-Guarded Profile Metrics and Composed Relationship Actions — defines truthful Bound/Unbound facts and source-owned Frequency/Snooze writes.
- **ADR-112:** App-Owned Profile Background Derivatives and Launch Reconciliation — owns local crop, safe derivative storage, reference-aware cleanup, and fallback rendering.
- **ADR-114:** Route-Aware App-Wide System Background Composition — preserves resolved Profile-photo precedence and uses the selected System background only as the theme fallback.
- **ADR-062:** Bound/Unbound lifecycle — cadence is nullable and all Profile consumers guard it.
- **ADR-078:** Off Limits remains a local caution surface and is not an AI/search/dashboard permission proxy.
- **ADR-079:** Compose is the only suggestion invocation; the Profile AI draft entry is retired.
- **ADR-081:** Per-item explicit AI permission replaces proposed fuel permission; no implicit permission is inferred here.
- **ADR-123:** Profile History Section Replacing the Vertical Timeline — mounts the full History & Insights section behind the `interaction-history` renderer seam without migrating layout/collapse state; the knowledge-change edit reuses the screen's existing navigation.
- **ADR-133:** Session-Scoped Compose Modes and Truthful External Handoff — Profile supplies the origin-aware Message entry into session-only Compose.
- **ADR-138:** Complete Portable Backup Format v5 — carries the complete Profile presentation graph and staged background bytes by durable parent UID.
- **ADR-150:** Semantic Profile Hierarchy and Source-Owned Knowledge Editing — assigns heading/body ownership, bounded temporal preview, source-owned edit routes, and overflow Unbind placement.
- **ADR-151:** Visual-Only Relationship Overview Orphan Packing — fills row-local compact gaps without changing persisted layout semantics.

## Gotchas

1. **Use one aggregate read.** Do not add component-owned SQL or a second ranking/metric read; refresh the controller snapshot after committed writes.
2. **Hero is fixed.** Layout documents may reorder only the semantic body, never avatar, identity, Favorite, Message, Call, or overflow.
3. **Keep axes independent.** A layout write at Category/global scope must preserve the existing background UID and vice versa.
4. **Never materialize inheritance.** Missing references diagnose and fall through; Category changes must not copy effective presentation into contact rows.
5. **No AI inference.** Hidden-from-Profile and Off Limits do not imply privacy, deletion, AI exclusion, or permission.
6. **No literal migration number.** Refer to `profilePresentationMigration` and `PROFILE_PRESENTATION_SCHEMA_VERSION`; the ordered registry is authoritative.
7. **Keep presentation backup atomic.** A v5 change must preserve the settings, templates, parent-keyed assignments, and background bytes together; never add an emitter without its restore writer.
8. **Resolve before choosing the background host input.** Contact-only checks skip Category and global assignments; pass the fully resolved app-owned URI or `null` for the System fallback.
9. **Keep bundled slots out of Profile templates.** System backgrounds are settings-owned packaged assets, while Profile templates are app-owned photo derivatives with independent assignment and cleanup.
10. **Compose completion must pop to the originating Profile.** Do not reset a Profile-originated, confirmed Compose flow to Dashboard or leave the finished draft in Back history.
11. **Presentation backup is not a path backup.** Restore must use embedded background bytes and UID-keyed staging; source-device image paths never cross the portable boundary.
12. **Keep Settings global-only.** A Settings default must not become a shortcut to a contact-specific layout or background manager.
13. **Do not turn heading metadata into content state.** Normal headings have no duplicated values or inferred empty caption; render meaningful state in the semantic body.
14. **Scoped Off Limits writes stay scoped.** Filtering UI items is insufficient: force the kind and validate deletions at the controller/DAO boundary, then reload the controlled collection.
15. **Orphan span is not layout persistence.** The computed stretch must not rewrite the compact/wide preference or reorder modules.
16. **Do not make Message work in Settings by registering Compose there.** Settings-hosted Profiles disable Message by ruling (D-09, D-25, RG-021); registering Compose/ComposeResearch under Settings or adding a cross-tab jump reverses those rulings and is an owner decision.
17. **History actions never navigate.** Last Interaction and Status → View history reveal the in-Profile History section (D-10). Routing them to Things to Remember, a new History route, or a timeline screen contradicts D-10 and ADR-123. When the layout hides History, omit the actions; never reveal History temporarily or edit the layout (D-11).
18. **Selector Retry settles only its owner.** Route every Frequency/Snooze write and Retry through the relationship-sheet runner. A Retry that dispatches to both reducers, or that never dispatches `success`, leaves a selector `pending`, and `close()` then refuses to reset it (RG-025).
19. **The preview packs at the Profile width, not its own.** Packing against the narrower preview card would show fewer columns than the real Profile. If the Profile overview's padding or card border changes, update `PROFILE_OVERVIEW_HORIZONTAL_INSET` in `overview-geometry.ts`. The inset-chain test fails until you do.

## Related systems

- **Contact knowledge** — supplies source-owned remembered-information facts and writers.
- **Contact methods / Interaction assist** — supplies actionable methods and user-triggered native handoff.
- **Status engine / Interaction log** — supplies truthful derived metrics and bounded interim history.
- **Photos** — owns app-local background derivative lifecycle.
- **Backup & restore** — owns the v5 presentation graph and background-byte recovery boundary.

## Changelog

| Date | Phase | What changed |
|------|-------|--------------|
| 2026-09-02 | 31 | Established the durable independent-axis presentation model, fixed-Hero semantic composition, coherent local snapshot, guarded relationship facts, focused editors, and app-owned background lifecycle. |
| 2026-09-02 | 36 | Added parent-UID-keyed Profile presentation, templates, global preferences, and crash-consistent background bytes to backup format v5. |
| 2026-09-10 | 31 | Final acceptance reconciliation: all seven bounded owner-smoke journeys are complete after targeted direct-drag, template-discovery/arbitrary-contact assignment, and clear-to-theme repairs. The owner approved the final template lifecycle check; Preview functionality passed while its visual polish remains intentionally deferred. |
| 2026-09-10 | 31 | Reconciled the six owner-reported Profile UAT gaps against Plans 31-11 through 31-13. Retained physical-Pixel evidence closes the background, sheet, manager, factory-collapse, and compact-bar reports; the owner directly approved the final crop editor's genuine touch/pinch behavior. This does **not** convert the independent unexercised native-checklist rows into passes. |
| 2026-09-09 | 31 | A droid-built standalone release was installed and inspected on the physical Pixel: Galaxy and Standard local backgrounds rendered full bleed with a compact factory Profile, the release layout chooser/editor remained reachable at 1.15x text after the shared Sheet geometry repair, and the actual empty local Background manager was nonblank. Populated/crop/assistive-technology and owner visual acceptance remain explicitly gated in `31-NATIVE-CHECKLIST.md`. |
| 2026-09-09 | 31 | Physical Pixel objective pass confirmed the fixed Hero, origin Back, inert Profile actions sheet, and reachable overflow/layout chooser controls; broader theme, assistive-technology, varied-data, crop, and local-only acceptance remains owner-gated in `31-NATIVE-CHECKLIST.md`. |
| 2026-09-09 | 31 | Added the Profile presentation controller, local snapshot/resolution architecture, customization boundaries, and Phase 32/36/37/40 handoffs. |
| 2026-09-10 | 31.1 | Established resolved Profile-photo precedence over the app-wide System background while keeping bundled slots and Profile templates independent. |
| 2026-09-02 | 32 | `ProfileModuleHost.renderHistory()` now mounts the full History & Insights section behind the preserved `interaction-history` key (replacing the bounded stub, no layout/collapse migration); threaded `onOpenKnowledgeChange` for Detail Sheet knowledge rows. |
| 2026-09-17 | 37.1 | Added complete bounded real-category assignment, rename-stable inheritance, and atomic deletion cleanup with fallback to the next presentation axis. |
| 2026-09-02 | 35 | Profile Message now passes a Compose origin so Back and confirmed handoff completion return to the launching Profile. |
| 2026-09-02 | 37 | Exposed global layout/background defaults in Settings while retaining per-contact template managers on Profile. |
| 2026-09-19 | 38.1 | Made headings identifier-only, added bounded temporal knowledge/edit routes, moved Unbind to overflow, and added visual-only orphan packing with centered Overview cards. |
| 2026-09-25 | 38.3 | Coherent snapshot + History revision (RG-024): the snapshot load is latest-request gated and also refreshes on the post-sweep foreground tick; each successful publication bumps the History revision so the metrics and History share one trigger. |
| 2026-09-25 | 38.3 | Message eligibility by archive state and host (D-09, D-25, RG-021): hero Message is disabled with a reason for archived contacts in every host and for any Settings-hosted Profile; Compose stays unregistered under Settings, and Settings now registers `RecentlyDeleted`. |
| 2026-09-25 | 38.3 | History actions reveal the in-Profile History section (RG-021, D-10, D-11, D-28): Last Interaction and Status → View history close the sheet, expand a collapsed History through the persisted collapse toggle, and scroll to it (instant under reduced motion). When the layout hides History, neither action is offered and the Last Interaction tile is informational. The Things to Remember history route is gone. |
| 2026-09-25 | 38.3 | Selector Retry settlement (RG-025, D-24): Contact Frequency and Snooze submit/Retry settle through `createRelationshipSheetRunner`, so a Retry settles only the failed selector and both stay usable after reopening. |
| 2026-09-26 | 38.4 | Layout preview geometry (RG-033 AUD-UIA-021): the preview packs against the Profile overview width basis (window − 66dp) and sizes tiles with the shared `overviewColumnWidth`/`overviewTileWidth` helpers and `SPACING.sm` gaps, so compact/auto/wide rows match the real Profile; the layout switch uses themed track/thumb tokens (RG-030 AUD-UIA-003). |
| 2026-09-26 | 38.4 | Profile shell refresh skips while the app is backgrounded (38.3 VERIFICATION W2, D-10): the shell subscription is gated by `shouldRunProfileShellRefresh(AppState.currentState)`; focus and the post-sweep foreground (resume) reads are unchanged, and hidden-but-foregrounded behavior is untouched (Plan 15 owns that evidence-gated decision). No legacy-data repair (38.2 D-23). |
