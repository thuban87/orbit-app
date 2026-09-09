# Phase 31: Profile Experience - Research

**Researched:** 2026-09-09
**Domain:** Local-first React Native Profile composition, durable presentation inheritance, and compact relationship knowledge
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text — this dossier has no standalone amendment block; the resolutions were folded inline, so read the amended §C and §D text as authoritative. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

### Phase-specific constraints
- **D-04:** The Profile "AI draft" entry (`src/screens/ContactProfileScreen.tsx:1075`) is **removed** (E-06 resolved). Drafting stays reachable in two taps via Message → Draft with AI. **ADR-079 supersedes ADR-052** on this point; do not restore a separate Profile AI action.
- **D-05:** An unguarded cadence read on an Unbound profile is an **ADR-062 violation**, not a cosmetic gap (trip-wire): `interval_days` is nullable, `computeContactIntensity` returns `{available:false}`, and Unbound profiles are reachable. Every cadence consumer on this screen — Intensity, Contact Frequency, Status explanation — must guard it.
- **D-06:** The Cycles heatmap and cadence-relative Intensity are **undefined for contacts with no cadence** (R-15). Define the fallback (hide the lens, or a fixed 7 Days / Month window) and decide it **once**, jointly with Phase 32's identical R-15 — not twice, differently.
- **D-07:** Layout/background templates, assignments, per-contact overrides, and expanded/collapsed persistence are **entirely unbuilt** (R-06). The existing single-row `profile` table is the *self record*, not a per-contact layout store — nothing there is reusable. Decide explicitly whether collapsed state is durable and whether it belongs in the backup. Custom snooze end date needs **no schema** (`snooze_until` is already a date; UI + DAO only).
- **D-08:** Phase 24's Contact Knowledge model gates every knowledge section (R-01). Do not plan against Memory types, pinning, visibility, relationships, Last Talked About, or Current Location as if they exist; verify on disk.
- **D-09:** Profile/Hero backgrounds are permitted: the `HANDOFF.md` §7 restriction against backgrounds behind text-heavy screens is **superseded** (owner-approved 2026-09-01). Readability comes from Phase 23's opacity-by-density surface rule, not from restricting placement. Background image-memory cost is a flagged hand-off to release hardening.
- **D-10:** Category assignments for layouts and backgrounds inherit **Category deletion fallout** (trip-wire) — Phase 37 owns Category CRUD, but the fallout behavior for layout/background assignment must be planned here. `Reset Profile Presentation` clears only contact-specific layout/collapse/background overrides — never contact data, Favorite, Snooze, AI permissions, or knowledge items.
- **D-11:** Interaction History is a minimal interim section behind a **replaceable renderer seam** that Phase 32 upgrades without touching layout persistence. Do not build the final heatmap/timeline/drill-down here.

### the agent's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.

### Deferred Ideas (OUT OF SCOPE)
See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Specifically do NOT build: unrestricted page-builder behavior — arbitrary x/y tile placement, arbitrary resizable tiles, a third nesting level, or manual drag ordering of individual memories; the final Interaction History heatmap/timeline/drill-down UX (Phase 32 owns it); new Status algorithm factors, user-tunable Status weighting, or a separate `Health` metric (explicitly rejected); and advanced background effects (blur/brightness/overlay/filters) or downloadable background packs.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | Fixed identity Hero with stable, disabled-capable Message/Call actions | Hero/actionability architecture and accessibility state pattern |
| PROF-02 | Constrained top-level and child customization | Closed module registry and validated versioned layout document |
| PROF-03 | Reusable layout templates and inheritance | Durable entity/assignment schema and pure resolution precedence |
| PROF-04 | Reusable cropped image backgrounds | Existing photo-pipeline sibling design and background file namespace |
| PROF-05 | Category changes affect inheritance, not explicit overrides | Resolve Category at read time; never copy inherited values onto contacts |
| PROF-06 | Focused Save/Cancel layout editor | Draft state separated from persisted assignment; dirty-dismiss guard |
| PROF-07 | Durable collapse state, switch/reset semantics | Atomic contact-presentation override write/delete operations |
| PROF-08 | Factory order and visible empty sections | Registry factory definition and empty-summary contract |
| PROF-09 | Auto-packed Relationship Overview tiles | Deterministic row packer over declared tile variants |
| PROF-10 | Literal, non-editable Status with truthful explanation | Existing status projection and guarded factor copy |
| PROF-11 | Gravity sphere and cadence/Unbound-aware Intensity histogram | Existing gravity tiers plus shared calendar-month Unbound fallback |
| PROF-12 | Immediate cadence update and preset/custom snooze | Existing transaction cores; new public composed writers only |
| PROF-13 | Full ordinary Contact Methods sets | Existing normalized groups and actionable-primary projection |
| PROF-14 | Configurable one-column Things to Remember | Presentation registry over current-state, relationship, Memory, custom-field, and Off Limits reads |
| PROF-15 | Compact cards, detail, long-press management | Existing compact Memory card shell plus type-specific adapters |
| PROF-16 | Recoverable Profile visibility | Existing item visibility semantics and management projections |
| PROF-17 | Visible Off Limits caution semantics | Dedicated Profile-only Off Limits projection; do not weaken other SQL exclusions |
| PROF-18 | Replaceable minimal History renderer | Stable semantic module ID and bounded interim reader |
| PROF-19 | Contact actions first; no Profile AI draft | Overflow migration to shared sheet and removal of superseded entry |
| PROF-20 | Non-precision reordering and textual state | Move buttons/custom accessibility actions plus state labels |
</phase_requirements>

## Summary

Phase 31 should be planned as a composition-system extraction, not as another incremental pass over the current 1,500-line Profile screen. The current screen already proves most domain reads and mutations, but it mixes loading, editing, presentation, navigation, and retired UI. The target architecture is a thin Profile host over (1) a coherent semantic view model, (2) pure presentation resolution, (3) a closed module metadata registry, and (4) independently replaceable renderers. [VERIFIED: `src/screens/ContactProfileScreen.tsx`; `docs/dossier/milestone-2/phase-10-profile-experience-dossier.md` §§A, AO]

The durable layer should use schema migration **024**, provided the planner re-verifies immediately before planning: the source currently says `export const TARGET_VERSION = 23;` and registers migrations `migration001` through `migration023`. [VERIFIED: `src/db/database.ts:25-58`] Store named templates as UID-addressed entities; store Category/contact assignments separately; store global/default assignment UIDs in new `app_settings` columns; and store per-contact collapse/freeform state separately from reusable templates. Resolution must remain `contact override → Category assignment → global/default → factory/theme`, computed at read time so Category changes naturally alter inheritance while contact overrides survive. [VERIFIED: `.planning/phases/31-profile-experience/31-CONTEXT.md` D-03, D-07, D-10; `docs/dossier/milestone-2/phase-10-profile-experience-dossier.md` §§D, G-I, AO]

The highest-risk seam is knowledge composition. The repository now has separate typed sources: `MemoryTypeKey = "general" | "imported" | "custom"`; current-state keys are `"last_talked_about"` and `"current_location"`; relationship rows have their own reader; custom fields have optional `field_group`; and Off Limits remains a `fuel.kind='off_limits'` concept available only through the editor projection. [VERIFIED: `src/db/memory-registry.ts:14-15,65-70`; `src/db/relationships-read.ts`; `src/db/migrations/018-custom-field-scope-history.ts:9-29`; `src/db/fuel-read.ts:19-65`] Build a Profile-specific semantic aggregator and a dedicated bound Off Limits reader; do not flatten these sources or reuse the all-kinds editor read in a read-only Profile renderer. [VERIFIED: `docs/dossier/milestone-2/phase-10-profile-experience-dossier.md` §§V-AI]

**Primary recommendation:** Plan data contracts and pure resolution/packing first, then schema/DAOs, then renderer extraction, then the focused editors/background pipeline, and only then replace the monolithic Profile host. [VERIFIED: `.planning/phases/31-profile-experience/31-CONTEXT.md` D-03 and dossier §AO]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Profile composition and focused editing | Browser / Client | Database / Storage | React Native owns rendering and draft interaction; SQLite owns saved presentation state. [VERIFIED: dossier §§E-F, AO] |
| Template definitions and assignment hierarchy | Database / Storage | Browser / Client | Durable local entities resolve into a client render plan; no backend exists. [VERIFIED: `AGENTS.md`; dossier §§G-I] |
| Relationship metrics | API / Backend (local TypeScript service tier) | Database / Storage | Existing local services derive Status/Gravity/Intensity from SQLite reads; values are not remotely computed. [VERIFIED: `src/services/impact.ts`; `src/db/contact-status-read.ts`] |
| Things to Remember aggregation | API / Backend (local read-model tier) | Database / Storage | A local semantic read model combines typed DAO outputs before UI presentation. [VERIFIED: dossier §§V-AI; `src/db/memory-registry.ts`] |
| Background crop and persistence | Browser / Client | Database / Storage | Gesture UI generates a crop; app-owned storage holds the derivative and SQLite holds its relative reference. [VERIFIED: `src/screens/CropPhotoScreen.tsx`; `src/services/photos/photo-pipeline.ts:1-25`] |
| Message/Call launch | Browser / Client | Database / Storage | Client launches external intents after normalized method readers determine actionability. [VERIFIED: `src/db/contact-methods-read.ts:4-47`] |
| Phase 32 History upgrade | Browser / Client | Database / Storage | Phase 31 preserves layout identity/position while Phase 32 swaps renderer/read internals. [VERIFIED: CONTEXT D-11; dossier §AJ] |

## Project Constraints (from AGENTS.md)

- Read `HANDOFF.md` completely and do not revisit `[DECIDED]` or re-propose `[REJECTED]` choices. [VERIFIED: `AGENTS.md`; `HANDOFF.md`]
- Contact data stays on device; there is no backend, telemetry, or blocking network dependency on any Profile read path. [VERIFIED: `AGENTS.md` “Local-first” and “Offline”]
- All SQLite changes are forward-only application-code migrations using `PRAGMA user_version`; shipped migrations are immutable and sequential. [VERIFIED: `AGENTS.md` “SQLite migrations”]
- Queries belong in `src/db/` DAOs/read modules, never inline in components. [VERIFIED: `AGENTS.md` “Conventions”]
- All colors resolve through theme tokens; Skia animation must not be driven by React state; animation pauses when unfocused/backgrounded. [VERIFIED: `AGENTS.md` “Conventions”]
- Local date values use `formatLocalDate()`, never UTC string splitting. [VERIFIED: `AGENTS.md` “Conventions”]
- Graphify is discovery only. This session's graph was 24 hours old and 118 commits behind, so its relationships were treated as approximate and all used pointers were checked against source files. [VERIFIED: `gsd-tools graphify status`, 2026-09-09]
- Never push and never use git worktrees. [VERIFIED: `AGENTS.md`; `.planning/config.json` has `"use_worktrees": false`]

## Standard Stack

### Core

| Library | Version / published | Purpose | Why Standard Here |
|---------|---------------------|---------|-------------------|
| Expo | 57.0.13 / 2026-08-14 | Application runtime | Already pinned by the repository; keep this phase inside the installed SDK. [VERIFIED: npm registry; `package.json`] |
| React Native | 0.86.2 / 2026-07-27 | Native Profile UI | Existing application framework. [VERIFIED: npm registry; `package.json`] |
| React | 19.2.3 / 2025-12-11 | Component model and edit state | Existing application framework. [VERIFIED: npm registry; `package.json`] |
| expo-sqlite | 57.0.1 / 2026-07-15 | Durable local templates, assignments, overrides | Existing canonical store; parameterized operations and application migrations match repository doctrine. [VERIFIED: npm registry; `package.json`; `src/db/database.ts`] |
| Zustand | 5.0.15 / 2026-08-13 | Existing cross-screen state where needed | Use only for truly shared transient state; durable presentation state stays in SQLite. [VERIFIED: npm registry; `package.json`; `AGENTS.md`] |

### Supporting

| Library | Version / published | Purpose | When to Use |
|---------|---------------------|---------|-------------|
| expo-image | 57.0.3 / 2026-08-14 | Efficient local Hero/background rendering | Render app-owned local background derivatives. [VERIFIED: npm registry; `package.json`] |
| expo-image-picker | 57.0.10 / 2026-08-14 | Choose custom background images | Background-template creation. [VERIFIED: npm registry; `package.json`] |
| expo-image-manipulator | 57.0.10 / 2026-08-14 | Crop/downscale derivative | Extend the existing crop pipeline with a screen-aspect target. [VERIFIED: npm registry; `package.json`; `src/services/photos/photo-pipeline.ts:27-104`] |
| React Native Gesture Handler | 2.32.0 / 2026-06-11 | Drag/pinch crop and reorder gestures | Crop editor and direct manipulation. [VERIFIED: npm registry; `package.json`] |
| Reanimated | 4.5.1 / 2026-07-02 | UI-thread crop transforms | Keep continuous gesture transforms off React state. [VERIFIED: npm registry; `package.json`; `src/screens/CropPhotoScreen.tsx`] |
| React Native Skia | 2.6.2 / 2026-04-04 | Gravity sphere and crop preview | Visual-only rendering with textual semantics alongside it. [VERIFIED: npm registry; `package.json`] |
| react-native-reorderable-list | 0.18.1 / 2026-07-12 | Pointer/touch reorder | Reuse for drag reordering, with accessible non-drag alternatives. [VERIFIED: npm registry; `package.json`] |
| Vitest | 4.1.10 / 2026-07-06 | Node-pure contract tests | Test schema, resolution, packing, and reducers without rendering RN. [VERIFIED: npm registry; `package.json`; `vitest.config.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQLite presentation records | AsyncStorage | Rejected by D-03; it would split durable/portable state and bypass transaction discipline. [VERIFIED: CONTEXT D-03] |
| Closed registry + auto packer | Page-builder/grid library | Rejected unrestricted x/y placement and arbitrary resizing. [VERIFIED: CONTEXT Deferred Ideas; dossier §§E, M] |
| Existing image stack | New crop/background dependency | Adds supply-chain and integration surface while the installed stack already performs crop, resize, and persistent copy. [VERIFIED: `src/screens/CropPhotoScreen.tsx`; `src/services/photos/photo-pipeline.ts`] |
| Profile-hosted overlay managers | New duplicated stack routes | The approved UI contract places the three managers as Profile-hosted overlay sheets and avoids duplicating routes across Dashboard/Orrery/Settings stacks. [VERIFIED: `31-UI-SPEC.md` “Layout, template, and background managers” and `src/navigation/types.ts:28-143`] |

**Installation:** none. This phase should introduce no external package. [VERIFIED: existing package registry audit and repository capabilities above]

## Package Legitimacy Audit

Not applicable: the recommended implementation installs no packages. Exact installed versions were confirmed in the npm registry on 2026-09-09, and none of the inspected packages exposes a registry `scripts.postinstall` entry. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
Profile route(contactId)
        |
        v
coherent local Profile read model -----> normalized DAOs/readers
        |                                  | contacts/category/methods
        |                                  | status/impact/interactions
        |                                  | current-state/relationships/memories
        |                                  | custom fields/Profile-only Off Limits
        v
presentation resolver <---------------- durable presentation snapshot
        |                                  | named layout/background templates
        | contact > category > global       | assignments + contact collapse/freeform
        | > factory/theme                    | app_settings global UIDs
        v
closed module registry
        |
        +--> fixed Hero (outside templates)
        +--> auto-packed Relationship Overview renderers
        +--> one-column Things to Remember renderers
        +--> Contact Methods renderer
        +--> History renderer slot -----> Phase 32 replaces internals only
        |
        v
focused Profile-hosted sheets
        | layout draft --Save--> one atomic local transaction
        | templates/assignments -> one atomic local transaction
        | background crop ------> app-owned derivative + DB reference
        + Cancel/dirty dismiss --> discard draft, no durable mutation
```

This flow has no network boundary. [VERIFIED: `AGENTS.md` local-first constraint]

### Recommended Project Structure

```text
src/
├── profile/
│   ├── module-registry.ts          # node-pure IDs, parentage, defaults, variants
│   ├── presentation-schema.ts      # versioned document parser/canonicalizer
│   ├── resolve-presentation.ts     # pure inheritance/default resolution
│   ├── pack-overview.ts            # deterministic width-aware tile packing
│   └── types.ts                    # renderer-independent contracts
├── db/
│   ├── migrations/024-profile-presentation.ts
│   ├── profile-presentation-read.ts
│   ├── profile-presentation-dao.ts
│   └── profile-read.ts             # coherent semantic Profile snapshot
├── components/profile/
│   ├── ProfileHero.tsx
│   ├── RelationshipOverview.tsx
│   ├── ThingsToRemember.tsx
│   ├── ProfileModuleHost.tsx
│   ├── ProfileLayoutEditor.tsx
│   ├── ProfileTemplateManager.tsx
│   └── ProfileBackgroundManager.tsx
└── services/photos/
    ├── background-crop-geometry.ts
    ├── background-pipeline.ts
    └── background-storage.ts
```

The metadata registry must remain Node-pure; keep React component functions in a separate renderer map so schema and ordering tests do not import React Native. [VERIFIED: `vitest.config.ts` is Node-only and render-free]

### Pattern 1: Versioned, Closed Presentation Documents

**What:** Persist a JSON layout snapshot containing a schema version and semantic module records, never component names. Parse it through one total validator that rejects unknown parents, duplicate IDs, illegal sizes, third-level nesting, and missing required structure; canonicalize order before saving. When a future registry adds a module, merge its registered factory default deterministically rather than making old templates invalid. [VERIFIED: dossier §AO and PROF-02/03/08]

**Recommended shape:**

```typescript
interface ProfileLayoutDocument {
  version: 1;
  topLevel: ModulePlacement[];
  overview: ModulePlacement[];
  thingsToRemember: ModulePlacement[];
}

interface ModulePlacement {
  id: ProfileModuleId;       // closed registry key
  visible: boolean;
  expanded: boolean;
  size?: OverviewSize;       // only registry-permitted sizes
}
```

The exact persisted identifiers should be declared once in `module-registry.ts`; do not copy literal IDs into migrations, render switches, accessibility handlers, and tests independently. [VERIFIED: dossier §AO]

### Pattern 2: Separate Definitions, Assignments, and Overrides

**What:** Use distinct records for named layout/background definitions, Category assignments, and contact overrides. Put global/default selected UIDs in `app_settings`. A contact override stores either an explicit template UID or a freeform layout snapshot, never both. Contact collapse overrides are keyed by semantic module ID and are deleted when switching layout. [VERIFIED: CONTEXT D-03/D-07/D-10; dossier §§G-I]

**Recommended migration-024 entities:**

| Record | Essential contract |
|--------|--------------------|
| `profile_layout_templates` | `uid UNIQUE`, user name, versioned canonical layout JSON, timestamps |
| `profile_background_templates` | `uid UNIQUE`, user name, safe relative derivative path, timestamps |
| `profile_category_presentation` | one row per Category; nullable layout/background template UID references; Category delete cascades assignment row |
| `profile_contact_presentation` | one row per contact; explicit layout/background template UID or freeform layout; validated collapse JSON; contact delete cascades |
| `app_settings` additions | nullable global/default layout UID and background UID, added to the existing portable-settings snapshot contract |

Use template UIDs rather than local row IDs in serialized assignment data so Phase 36 can reconcile portable entities without rewriting layout documents. [VERIFIED: CONTEXT D-03; existing backup records use UID identity in `src/backup/types.ts` and `src/backup/export-manifest.ts`]

Category deletion must clear only that Category's presentation-assignment row (via cascade or an explicit same-transaction delete), after which affected contacts resolve through global/factory state. It must not materialize the former Category values onto contacts. [VERIFIED: CONTEXT D-10 and PROF-05]

Template deletion must be transactional and observable: show usage counts, clear matching global/Category/contact references, delete the template row, and leave freeform contact snapshots untouched. Delete background bytes only after DB commit; a failed file deletion is an orphan-cleanup concern, not permission to roll back a committed reference graph. [VERIFIED: `src/services/photos/photo-storage.ts:13-39` establishes crash/recovery doctrine]

### Pattern 3: Pure Resolver, Stable Renderer IDs

**What:** Resolve one immutable `ResolvedProfilePresentation` from factory registry + selected global + current Category + explicit contact state. Render by semantic ID through a renderer map. Phase 32 keeps the same History ID and replaces only its renderer/read model. [VERIFIED: CONTEXT D-11; dossier §AO]

Resolution order:

```text
factory registry
  <- global/default assigned template
  <- current Category assignment
  <- explicit contact template OR freeform snapshot
  <- per-contact collapse state
```

Templates remain live references: editing a named template changes every profile currently assigned to it. A freeform contact snapshot is a copy and therefore never changes when a template changes. [VERIFIED: PROF-03]

### Pattern 4: Coherent Read Model, Narrow Mutation Writers

**What:** Load Profile data inside `inReadSnapshot()` when cross-table consistency matters, then return a renderer-neutral view model. The existing primitive says `export type ReadOnlyExecutor = Pick<SqlExecutor, "getFirstAsync" | "getAllAsync">;` and wraps reads in a mutex plus `BEGIN`/`COMMIT`. [VERIFIED: `src/db/transaction.ts:37-88`]

Mutations must use one outer `inWriteTransaction`; compose non-mutexed `*Core` operations inside it and bump the data revision exactly once. Never nest transaction wrappers. [VERIFIED: `src/db/transaction.ts:20-63`]

Frequency immediate-apply should get a named public Profile writer around the existing non-mutexed cadence core and its lifecycle side effects. Custom snooze should get a public wrapper that validates a local `YYYY-MM-DD` future date and composes the existing `snoozeContactCore`, event row, and revision bump. Existing preset values are exactly `"3d" | "1w" | "1m"`. [VERIFIED: `src/db/snooze-dao.ts:38-65,97-133`]

### Pattern 5: Semantic Knowledge Adapters

**What:** Build child renderers over their owning data models, not over a flattened generic card DTO. Share a compact shell, but keep semantics and actions typed per source. [VERIFIED: dossier §§W-AI]

- Current-state values use exact keys `"last_talked_about"` and `"current_location"` and their existing history surfaces. [VERIFIED: `src/db/memory-registry.ts:65-97`]
- Key People use structured relationship rows and distinguish linked contact IDs from unlinked names. [VERIFIED: `src/db/relationships-read.ts`]
- Memories use the exact types `"general" | "imported" | "custom"`; filter Profile visibility with the existing resolver, while management reads retain hidden rows. [VERIFIED: `src/db/memory-registry.ts:14-59`; `src/db/memories-read.ts`]
- Custom Fields remain normalized typed values; group by `field_group` only inside the Custom Fields child. History uses the existing newest-first reader. [VERIFIED: `src/db/migrations/018-custom-field-scope-history.ts:17-33`; `src/db/value-history-dao.ts:54-66`]
- Off Limits must use a new narrow Profile-only SQL reader with `contact_id = ? AND kind = 'off_limits'`, not `getRankedFuel()` and not the all-kinds `listFuelForEditor()`. This intentionally changes Profile visibility only; `RANKED_FUEL_EXCLUSIONS` must continue to read `kind != 'off_limits'` for dashboard/prompt-facing projections. [VERIFIED: `src/db/fuel-read.ts:19-65,133-153`; dossier §AH; ADR-078]
- Pinned/Featured is a reference projection over visible pinned Memories and relationships, capped at three, not a copied entity. [VERIFIED: dossier §Y; `src/db/memories-read.ts`; `src/db/relationships-read.ts`]

The Profile can display the sparkle on any item model that already carries `allow_ai=1`. Current Off Limits fuel rows carry no `allow_ai` field, so Phase 31 must preserve a renderer seam for that future state but must not invent permission from visibility, kind, source, or location. [VERIFIED: `src/db/fuel-read.ts:31-42`; `src/db/migrations/017-knowledge-egress-datamove.ts`; ADR-078/081]

### Pattern 6: Background Pipeline as a Sibling, Not an Avatar Hack

**What:** Reuse the established gesture/crop/derivative architecture, but create a background-specific target and aspect-ratio geometry. The current pipeline is explicitly one `512×512` JPEG avatar master and the storage target union is exactly `{ kind: "contact" } | { kind: "profile" } | { kind: "customField" }`; neither contract can safely represent reusable Profile backgrounds unchanged. [VERIFIED: `src/services/photos/photo-pipeline.ts:1-12,38-42,66-104`; `src/services/photos/photo-storage.ts:53-66`]

Use an app-owned, allowlisted background namespace and UID-derived filename. Crop against the actual rendered Hero aspect ratio, create a screen-class derivative, store only a safe relative path, and retain the crash-safe temporary/backup replacement strategy. [VERIFIED: `src/services/photos/photo-storage.ts:13-39`; `31-UI-SPEC.md` background crop contract]

RNGH's documented simultaneous composition is appropriate for pan + pinch: use `Gesture.Simultaneous(panGesture, pinchGesture)`. [CITED: https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/fundamentals/gesture-composition/]

### Pattern 7: Accessible Reordering and Disabled Actions

**What:** Every drag operation also exposes explicit Move up/Move down controls or custom accessibility actions. Disabled Message/Call retains its label and an explanatory hint; its disabled state is programmatic, not color-only. [VERIFIED: PROF-01/20; `31-UI-SPEC.md`]

React Native custom accessibility actions require both `accessibilityActions` and `onAccessibilityAction`, and disabled state is represented via `accessibilityState`. [CITED: https://reactnative.dev/docs/accessibility.html]

### Anti-Patterns to Avoid

- **Continue growing `ContactProfileScreen.tsx`:** it already owns unrelated editor, history, contact, and navigation concerns; extract contracts and renderers first. [VERIFIED: `src/screens/ContactProfileScreen.tsx`]
- **Copy resolved Category/global values onto contacts:** this freezes inheritance and breaks PROF-05. Resolve them on every read. [VERIFIED: PROF-03/05]
- **Persist React component names:** component refactors would become data migrations; use semantic IDs. [VERIFIED: dossier §AO]
- **Use screen-local `Promise.all` for the final model:** cross-table mutations can produce a mixed snapshot. Use the existing read snapshot for the aggregate. [VERIFIED: `src/db/transaction.ts:66-88`]
- **Reuse avatar storage paths or square geometry:** it creates collisions and incorrect Hero crops. [VERIFIED: `src/services/photos/photo-storage.ts:53-66`; `photo-pipeline.ts:38-42`]
- **Render Off Limits from ranked fuel:** ranked fuel deliberately excludes it. Add a narrowly scoped owner-facing reader without changing the exclusion constant. [VERIFIED: `src/db/fuel-read.ts:133-153`]
- **Guard Unbound only in JSX:** calculate a tagged availability/window model before any cadence arithmetic so Status explanation, Frequency, and Intensity share the same guard. [VERIFIED: CONTEXT D-05; `src/services/impact.ts:134-146`]
- **Turn empty sections invisible:** an enabled empty section remains collapsed with useful summary text. [VERIFIED: PROF-08]
- **Use React state per gesture/frame:** use shared/UI-thread values for Skia crop and visual animation. [VERIFIED: `AGENTS.md`; `src/screens/CropPhotoScreen.tsx`]
- **Make presentation reset a contact update:** reset deletes only the contact presentation override record. [VERIFIED: CONTEXT D-10; PROF-07]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistence | AsyncStorage serialization or ad-hoc files | Existing SQLite migration/DAO/transaction stack | Durable state, revision tracking, future portability, and atomic reset/assignment. [VERIFIED: CONTEXT D-03] |
| Crop/resize | Canvas snapshots or JS pixel manipulation | Existing Expo image manipulator + app-owned storage pattern | Source-pixel crop and durable relative paths already exist. [VERIFIED: `src/services/photos/photo-pipeline.ts`] |
| Gesture concurrency | Manual recognizer arbitration | RNGH simultaneous gesture composition | Existing crop screen and official API cover pan + pinch. [CITED: https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/fundamentals/gesture-composition/] |
| Relationship metrics | New Status/Gravity/Intensity formulas | Existing status/impact services | New factors/weighting are explicitly excluded. [VERIFIED: PROF-10/11] |
| Contact-method parsing | UI regexes | Existing normalized method rows/actionability | Preserves malformed imported values and canonical actionability. [VERIFIED: `src/db/contact-methods-read.ts`] |
| Knowledge storage | Generic Profile card table | Existing current-state, relationship, Memory, custom-field, and fuel owners | Flattening destroys domain semantics and edit/history behavior. [VERIFIED: dossier §§V-AI] |
| History framework | Final heatmap/timeline | Stable renderer slot + bounded existing read | Phase 32 owns the final experience. [VERIFIED: CONTEXT D-11] |

**Key insight:** The hard part is maintaining stable semantic identities and precedence across independently evolving renderers; a custom page builder or generic “profile item” model would erase the exact boundaries later phases rely on. [VERIFIED: dossier §AO]

## Common Pitfalls

### Pitfall 1: Inheritance becomes copied state
**What goes wrong:** Category changes no longer update inherited Profiles, or a template edit silently overwrites freeform contacts. [VERIFIED: PROF-03/05]
**Why it happens:** Assignment, resolved output, and overrides are stored in one blob. [VERIFIED: dossier §§G-I]
**How to avoid:** Separate template definitions, scope assignments, and contact overrides; resolve at read time. [VERIFIED: dossier §AO]
**Warning signs:** A category-assignment writer updates rows for every contact, or a template save rewrites contact JSON. [VERIFIED: PROF-03/05]

### Pitfall 2: Unbound cadence arithmetic leaks back in
**What goes wrong:** Null cadence is coerced, the histogram crashes, or Status copy implies a due schedule for an Unbound contact. [VERIFIED: CONTEXT D-05/D-06]
**Why it happens:** Existing cadence-relative intensity assumes a positive interval after its guard. [VERIFIED: `src/services/impact.ts:118-146`]
**How to avoid:** Implement one shared Profile/Phase-32 window resolver. The approved UI contract chooses calendar Month for Unbound: label `This month`, with Cycles omitted in Phase 32. [VERIFIED: `31-UI-SPEC.md` “Unbound cadence fallback”]
**Warning signs:** `intervalDays!`, `?? 30`, or separate fallback functions in Phase 31 and 32. [VERIFIED: CONTEXT D-06]

### Pitfall 3: Stale Off Limits comments override newer decisions
**What goes wrong:** Off Limits remains hidden from the human Profile because older code comments call it private, or its global SQL exclusion is weakened to make it visible. [VERIFIED: `src/db/fuel-read.ts:19-24`; ADR-078; dossier §AH]
**Why it happens:** ADR-078 superseded the human-visibility half while dashboard/prompt exclusions remain load-bearing. [VERIFIED: ADR-078 and ADR-081]
**How to avoid:** Add a Profile-only bound reader; preserve ranked/search/AI exclusions. [VERIFIED: `src/db/fuel-read.ts:133-153`]
**Warning signs:** `.filter(kind === 'off_limits')` in the component after loading all editor fuel, or edits to `RANKED_FUEL_EXCLUSIONS`. [VERIFIED: `src/db/fuel-read.ts`]

### Pitfall 4: Layout saves partial draft state
**What goes wrong:** Cancel still mutates the screen, Android Back discards silently, or a crash leaves an assignment and collapse state inconsistent. [VERIFIED: PROF-06/07]
**Why it happens:** Live preview edits durable records item-by-item. [VERIFIED: `31-UI-SPEC.md` focused editor contract]
**How to avoid:** Keep one in-memory canonical draft, validate once, and commit all affected records in one transaction only on Save. Dirty close routes through the specified discard confirmation. [VERIFIED: `31-UI-SPEC.md`]
**Warning signs:** DAO calls in drag callbacks or visibility toggles. [VERIFIED: PROF-06]

### Pitfall 5: Template or Category deletion leaves dangling references
**What goes wrong:** Profiles fail to resolve, or contact overrides are erased unnecessarily. [VERIFIED: CONTEXT D-10]
**Why it happens:** UID references in JSON/app settings cannot rely solely on SQLite FK enforcement. [VERIFIED: recommended schema]
**How to avoid:** Validate references on read, fail to the next precedence layer, and clear direct assignment rows/settings transactionally during deletion. [VERIFIED: CONTEXT D-10]
**Warning signs:** forced unwraps of template lookup results. [VERIFIED: PROF-03/05]

### Pitfall 6: Background files become unrecoverable or unsafe
**What goes wrong:** Cache eviction loses images, a replacement crash destroys the prior image, or user-controlled names escape the storage directory. [VERIFIED: `src/services/photos/photo-storage.ts:8-39`]
**Why it happens:** Reusing raw picker/cache URIs or constructing paths from template names. [VERIFIED: existing photo doctrine]
**How to avoid:** UID-derived allowlisted relative paths and the existing recoverable `.tmp`/`.bak` swap pattern. [VERIFIED: `src/services/photos/photo-storage.ts:13-39`]
**Warning signs:** absolute URI persisted in SQLite, template name in a filename, pre-delete before copy. [VERIFIED: `src/services/photos/photo-storage.ts`]

### Pitfall 7: Knowledge actions drift from owning DAOs
**What goes wrong:** Long-press Hide changes AI permission, Pin makes a hidden row reappear, or detail edits bypass history/soft-delete rules. [VERIFIED: PROF-15/16/17]
**Why it happens:** A generic Profile mutation writes source tables directly. [VERIFIED: dossier §§AE-AH]
**How to avoid:** Route each action through the existing domain DAO and refresh the coherent Profile model; presentation visibility outranks pinning. [VERIFIED: `src/db/memories-read.ts`; dossier §AF]
**Warning signs:** inline SQL in a renderer or a universal “update knowledge card” method. [VERIFIED: `AGENTS.md`]

### Pitfall 8: Immediate tile mutations omit side effects
**What goes wrong:** Frequency changes but lifecycle/notifications/revision do not, or a snooze date changes without its immutable event. [VERIFIED: `src/db/snooze-dao.ts:16-28,97-174`; `src/db/contacts-dao.ts`]
**Why it happens:** UI calls non-mutexed cores directly. [VERIFIED: `src/db/transaction.ts:20-28`]
**How to avoid:** Add/use one public composed writer per tile operation. [VERIFIED: repository transaction doctrine]
**Warning signs:** `snoozeContactCore()` or `setContactFrequencyCore()` imported by TSX. [VERIFIED: source APIs]

### Pitfall 9: History work expands into Phase 32
**What goes wrong:** Phase 31 spends its budget building heatmaps/drill-downs, then Phase 32 must delete it. [VERIFIED: CONTEXT D-11]
**Why it happens:** The existing timeline reader makes a rich timeline appear easy. [VERIFIED: `src/db/timeline-read.ts`]
**How to avoid:** Add a bounded latest-few reader/summary and stable renderer ID only. [VERIFIED: dossier §AJ]
**Warning signs:** date heatmap bins, final filters, detail editing, or unbounded timeline loading in this phase. [VERIFIED: CONTEXT Deferred Ideas]

### Pitfall 10: Accessibility is bolted on after gesture UI
**What goes wrong:** screen-reader users cannot reorder or understand size/assignment/collapse states. [VERIFIED: PROF-20]
**Why it happens:** drag is treated as the only interaction and icons/colors as sufficient labels. [VERIFIED: dossier §§AL-AM]
**How to avoid:** Define textual state and Move controls/custom actions in the editor reducer before the drag UI. Test reducer parity between both paths. [VERIFIED: PROF-20; RN accessibility docs]
**Warning signs:** `PanGesture` is the only reorder entry point or a sphere/histogram has no text. [VERIFIED: PROF-11/20]

## Code Examples

### One outer transaction for a presentation save

```typescript
// Source: src/db/transaction.ts:49-63 and repository core-composition convention
export function saveContactPresentation(
  exec: SqlExecutor,
  input: SaveContactPresentationInput,
): Promise<void> {
  const canonical = parseAndCanonicalizeProfileLayout(input.layout);
  return inWriteTransaction(exec, async () => {
    await upsertContactPresentationCore(exec, input, canonical);
    await bumpDataRevisionCore(exec);
  });
}
```

### Tagged Unbound window resolution shared with Phase 32

```typescript
// Source: 31-UI-SPEC.md joint Phase 31/32 ruling; exact tag names are local API design
export type ProfileIntensityWindow =
  | { kind: "cadence"; days: number; label: string }
  | { kind: "calendar-month"; start: string; endExclusive: string; label: "This month" };

export function resolveProfileIntensityWindow(
  trackingEnabled: number,
  intervalDays: number | null,
  todayLocal: string,
): ProfileIntensityWindow {
  if (trackingEnabled !== 1 || intervalDays === null) {
    return calendarMonthWindow(todayLocal);
  }
  return { kind: "cadence", days: intervalDays, label: cadenceLabel(intervalDays) };
}
```

### Simultaneous background crop gestures

```typescript
// Source: https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/fundamentals/gesture-composition/
const cropGesture = Gesture.Simultaneous(panGesture, pinchGesture);
```

### Accessible reorder parity

```tsx
// Source: https://reactnative.dev/docs/accessibility.html
<ProfileModuleRow
  accessibilityActions={[
    { name: "moveUp", label: "Move up" },
    { name: "moveDown", label: "Move down" },
  ]}
  onAccessibilityAction={({ nativeEvent }) =>
    dispatch({ type: nativeEvent.actionName, moduleId })
  }
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One monolithic read/edit Profile | Presentation-first modular host with focused child workflows | Phase 31 dossier | Extract renderers and keep business workflows in owning phases. [VERIFIED: dossier §§A, AO] |
| Conversation fuel as the broad knowledge surface | Typed Memories + current state + relationships + normalized custom fields, with legacy Off Limits retained separately | Phases 24.1/24.2 | Aggregate semantics without flattening; use a narrow Off Limits reader. [VERIFIED: migrations 016-018 and ADR-081] |
| Profile AI-draft entry | Message → Compose → Draft with AI | ADR-079, 2026-09-01 | Remove the Profile AI entry and `requestAiSuggestion` use from Profile. [VERIFIED: ADR-079; CONTEXT D-04] |
| Cadence-only Unbound ambiguity | Calendar Month Intensity fallback; Cycles omitted | Approved Phase 31 UI contract | One shared month boundary helper must be reusable by Phase 32. [VERIFIED: `31-UI-SPEC.md`] |
| Square avatar crop | Aspect-ratio-specific background crop derivative | Phase 31 | Generalize geometry, not avatar storage identity. [VERIFIED: `src/services/photos/photo-pipeline.ts`; PROF-04] |

**Deprecated/outdated:**

- The Profile AI draft entry is superseded by ADR-079 and must be removed. [VERIFIED: CONTEXT D-04]
- Fuel comments describing Off Limits as never human-glanceable are outdated for the owner-facing Profile, but the SQL exclusion remains correct for ranked/dashboard/prompt projections. [VERIFIED: ADR-078; dossier §AH; `src/db/fuel-read.ts`]
- `KNOWLEDGE_GROUP_ORDER = ["current_state", "relationships", "memories"]` is a source-model grouping aid, not the Phase 31 child-layout registry. The exact current values are quoted here to prevent accidental reuse as the eight-child presentation order. [VERIFIED: `src/db/memory-registry.ts:100-105`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. Recommendations above are derived from locked decisions and inspected repository contracts; unresolved product/ownership gaps are listed below rather than assumed. | — | — |

## Open Questions

1. **Off Limits sparkle has no current storage source**
   - What we know: Off Limits remains a `fuel` kind, and `FuelItem` has no AI-permission field; per-item `allow_ai` exists on typed Memories only. ADR-081 explicitly says Memories have no Off Limits kind. [VERIFIED: `src/db/fuel-read.ts:27-42`; `src/db/memory-registry.ts:14-59`; ADR-081]
   - What's unclear: PROF-17 requires that an AI-enabled Off Limits item show the ordinary sparkle, but no current row can represent that combined state. [VERIFIED: PROF-17]
   - Recommendation: Do not add or infer a new permission model in Phase 31. Render the existing visible Off Limits state, keep its adapter capable of accepting explicit permission later, and call the sparkle branch unreachable until the owning AI-permission phase supplies a durable gate. If acceptance requires toggling it now, stop and ask the owner because that expands the permission/storage model. [VERIFIED: CONTEXT D-01/D-08 and ADR-078/081]

2. **Custom-field rows with no `field_group` need display copy**
   - What we know: `field_group` is nullable and Profile must honor configured groups, but group customization is not a third layout level. [VERIFIED: `src/db/migrations/018-custom-field-scope-history.ts:17-19`; dossier §AG]
   - What's unclear: The approved documents do not name the null-group heading. [VERIFIED: dossier and `31-UI-SPEC.md`]
   - Recommendation: Use no extra heading when there is only one null group; when mixed with named groups, use the existing Custom Fields section heading and visually separate named groups without inventing a durable group name. This is presentation implementation detail, not stored state. [VERIFIED: dossier §AG grants exact variants to implementation]

3. **Template/background portability is sequenced after schema**
   - What we know: D-03 says schema → consumers → backup and assigns the backup v4 bump to Phase 36; durable preferences must enter `PORTABLE_SETTINGS_KEYS`. [VERIFIED: CONTEXT D-03]
   - What's unclear: Phase 31 cannot complete cross-device backup round-trip for new entity tables without taking Phase 36's coordinated format work. [VERIFIED: CONTEXT D-03]
   - Recommendation: Add new app-settings columns to the portable-settings snapshot/allowlist now so reads and validation know them, but do not widen the current backup wire format or invent partial entity restore. Phase 36 must add templates, assignments, and referenced files together. Record this explicit handoff in the plan and schema docs. [VERIFIED: CONTEXT D-03]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Build/tests | ✓ | 22.22.2 | — |
| npm | Build/package verification | ✓ | 10.9.7 | — |
| Android Debug Bridge | Device UAT | ✓ | 37.0.0 at `~/.local/bin/adb` | Never install Debian adb. [VERIFIED: `AGENTS.md`] |
| Physical Android device | Interaction/accessibility/background UAT | ✓ | Pixel 6 Pro connected on 2026-09-09 | Remote emulator may verify behavior but cannot support performance claims. [VERIFIED: `emu-connect status`; `AGENTS.md`] |
| Metro | Live device verification | ✓ | running on 2026-09-09 | Restart using project workflow if stale. [VERIFIED: `emu-connect status`] |
| SQLite node adapter | DAO/migration tests | ✓ | existing repository harness | — [VERIFIED: existing `src/db/**/*.test.ts`] |

**Missing dependencies with no fallback:** none. [VERIFIED: environment probes 2026-09-09]

**Missing dependencies with fallback:** none. [VERIFIED: environment probes 2026-09-09]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10, Node environment [VERIFIED: `package.json`; `vitest.config.ts`] |
| Config file | `vitest.config.ts` [VERIFIED: `vitest.config.ts`] |
| Quick run command | `npx vitest run <changed-test-file>` [VERIFIED: Vitest CLI in installed package] |
| Full suite command | `npm test` [VERIFIED: `package.json`] |

The runner includes exactly `src/**/*.test.ts` and `src/**/*.test.tsx`, and TSX tests must stay render-free. [VERIFIED: `vitest.config.ts`]

### Phase Requirements → Test Map

| Req IDs | Behavior | Test Type | Automated Command | File Exists? |
|---------|----------|-----------|-------------------|-------------|
| PROF-02/03/05/07/08 | Parser, factory merge, precedence, Category change, template switch/reset | unit | `npx vitest run src/profile/presentation-schema.test.ts src/profile/resolve-presentation.test.ts` | ❌ Wave 0 |
| PROF-03/04/05/07 | Migration, FK fallout, assignment CRUD, atomic reset/delete | integration | `npx vitest run src/db/migrations/024-profile-presentation.test.ts src/db/profile-presentation-dao.test.ts` | ❌ Wave 0 |
| PROF-09/20 | Width-aware packing and reorder reducer parity | unit | `npx vitest run src/profile/pack-overview.test.ts src/profile/layout-editor-reducer.test.ts` | ❌ Wave 0 |
| PROF-10/11 | Existing metric semantics and calendar-month fallback | unit | `npx vitest run src/services/profile-metrics.test.ts` | ❌ Wave 0 |
| PROF-12 | Frequency/snooze composed writes and side effects | integration | `npx vitest run src/db/profile-relationship-actions.test.ts` | ❌ Wave 0 |
| PROF-13 | Complete method groups and effective actions | unit/integration | `npx vitest run src/db/contact-methods-read.test.ts` | ✅ existing, extend |
| PROF-14/15/16/17 | Knowledge grouping, caps, pinned dedupe/visibility, narrow Off Limits query, history models | unit/integration | `npx vitest run src/db/profile-knowledge-read.test.ts src/profile/knowledge-presentation.test.ts` | ❌ Wave 0 |
| PROF-18 | Bounded interim history and stable renderer lookup | unit/integration | `npx vitest run src/db/profile-history-read.test.ts src/profile/module-registry.test.ts` | ❌ Wave 0 |
| PROF-01/04/06/15/19/20 | Hero geometry/actions, crop gestures, focused sheets, menus, long press, large text/screen reader | device UAT | `emu-connect && adb devices -l` plus scripted UI checklist | manual-only; native interaction/a11y behavior cannot be proven in Node [VERIFIED: `AGENTS.md`] |

### Sampling Rate

- **Per task commit:** targeted changed-file Vitest command plus `npm run check` when TypeScript/UI files change. [VERIFIED: `package.json` scripts]
- **Per wave merge:** `npm test && npm run check`. [VERIFIED: `package.json` scripts]
- **Phase gate:** full suite green, migration chain test green, and physical-device UAT for both themes, large text, screen reader semantics, drag alternatives, background crop, and origin-aware navigation. [VERIFIED: PROF-01/04/06/20; `AGENTS.md` device guidance]

### Wave 0 Gaps

- [ ] `src/profile/presentation-schema.test.ts` — closed/versioned persisted document
- [ ] `src/profile/resolve-presentation.test.ts` — hierarchy and fallout matrix
- [ ] `src/db/migrations/024-profile-presentation.test.ts` — fresh and 023→024 chains
- [ ] `src/db/profile-presentation-dao.test.ts` — atomic CRUD/reset/template deletion
- [ ] `src/profile/pack-overview.test.ts` — supported variants and no avoidable holes
- [ ] `src/profile/layout-editor-reducer.test.ts` — drag and accessible action parity
- [ ] `src/services/profile-metrics.test.ts` — truthful status and shared Unbound month fallback
- [ ] `src/db/profile-knowledge-read.test.ts` — source boundaries, hidden/pinned rules, grouping, caps, Off Limits
- [ ] `src/db/profile-history-read.test.ts` — bounded interim projection

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local single-user app; Phase 31 adds no authentication boundary. [VERIFIED: project architecture] |
| V3 Session Management | no | No server session is introduced. [VERIFIED: project architecture] |
| V4 Access Control | yes | Keep owner-facing Off Limits read separate from ranked/search/AI projections; never infer AI permission. [VERIFIED: ADR-078/081; `src/db/fuel-read.ts`] |
| V5 Input Validation | yes | Closed module/template parser; parameter-bound SQL; validated UIDs/dates/crop bounds/safe relative paths. [VERIFIED: repository DAO/photo patterns] |
| V6 Cryptography | no | No credential or encryption feature is introduced; do not hand-roll crypto. [VERIFIED: phase scope] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/tampered layout JSON causes invisible required content or render crash | Tampering / DoS | Total closed parser, safe factory fallback, reject duplicate/unknown/illegal nesting, property-style unit matrix. [VERIFIED: PROF-02/08/20] |
| User names/UIDs enter SQL text | Tampering | Bind every value with `?`; identifiers/order fragments come only from closed code constants. [VERIFIED: existing DAO doctrine] |
| Background path traversal or cache-only storage | Tampering / Data loss | UID-derived allowlisted relative paths and app-owned document directory. [VERIFIED: `src/services/photos/photo-storage.ts:32-39`] |
| Owner-only Off Limits data leaks onto dashboard/search/AI path | Information Disclosure | New narrow Profile query; preserve `RANKED_FUEL_EXCLUSIONS`; no network read path. [VERIFIED: `src/db/fuel-read.ts:133-153`; `AGENTS.md`] |
| Presentation reset deletes semantic contact data | Tampering / Data loss | Delete only contact presentation override in one transaction; test protected fields/tables unchanged. [VERIFIED: CONTEXT D-10] |
| Nested mutex transaction hangs UI | Denial of Service | One outer `inWriteTransaction`, internal `*Core` composition only. [VERIFIED: `src/db/transaction.ts:20-28`] |
| Oversized source images exhaust memory | Denial of Service | Decode/crop once, emit screen-class derivative, release raw preview; hand final memory profiling to release hardening. [VERIFIED: dossier §D; CONTEXT D-09] |

## Planning Decomposition

The following dependency order minimizes rewrites and gives each plan a runnable verification boundary. [VERIFIED: CONTEXT D-03 and dossier §AO]

1. **Contracts and Wave 0:** define node-pure module IDs/defaults, persisted document parser, resolver, packer, edit reducer, and tests. Lock the shared Phase 31/32 month window helper here.
2. **Migration 024 and durable DAOs:** templates, assignments, contact overrides/collapse, app-settings defaults, Category/template deletion fallout, atomic reset, full-chain migration tests.
3. **Profile aggregate reads and actions:** coherent semantic snapshot, narrow Off Limits projection, bounded history, guarded status/intensity/frequency, named frequency/custom-snooze writers.
4. **Renderer extraction:** Hero, overview tiles, TTR child adapters, methods, interim History slot, compact detail/context-menu sheets. Preserve existing contact administration actions.
5. **Focused layout/template editor:** draft reducer, live preview, explicit Save/Cancel, dirty dismissal, accessible reorder/size controls, contact/global/Category assignments.
6. **Background templates:** background-specific crop geometry/storage/pipeline, assignment manager, theme density scrim, file lifecycle.
7. **Host replacement and cleanup:** compose renderers in Profile, remove inline AI draft and duplicated mutation UI, retain origin-aware navigation/FAB, delete dead screen-local presentation code.
8. **Integration/device gate and docs:** both themes, Unbound/bound, empty/populated/hidden, Category change/deletion simulation, large text/screen reader, physical-device crop/performance smoke, system docs and Phase 36/32 handoffs.

Do not combine migration design and monolithic-screen replacement in one plan; schema/resolver tests should stabilize the contract before UI integration. [VERIFIED: CONTEXT D-03; dossier §AO]

## Sources

### Primary (HIGH confidence)

- `HANDOFF.md` and `AGENTS.md` — project decisions, local-first/data/UI constraints
- `.planning/phases/31-profile-experience/31-CONTEXT.md` — binding phase decisions and trip-wires
- `.planning/phases/31-profile-experience/31-UI-SPEC.md` — approved UI contract including joint Unbound ruling
- `docs/dossier/milestone-2/phase-10-profile-experience-dossier.md` — complete product/architecture decision record
- `docs/dossier/milestone-2/planning-notes/phase-10-planning-notes.md` — binding replan/trip-wire appendix
- `docs/decisions/ADR-079-...md`, `ADR-062-...md`, `ADR-078-...md`, `ADR-081-...md` — current decision boundaries
- Inspected repository source under `src/db`, `src/services`, `src/components`, `src/screens`, `src/navigation`, `src/backup` — live implementation contracts
- npm registry — exact installed package versions, publish timestamps, and postinstall checks

### Secondary (MEDIUM confidence)

- https://docs.expo.dev/versions/latest/sdk/sqlite/ — current Expo SQLite API cautions
- https://reactnative.dev/docs/accessibility.html — accessibility actions/state
- https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/fundamentals/gesture-composition/ — installed-major gesture composition

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every recommended package is already pinned and registry-confirmed; no install is proposed.
- Architecture: HIGH — derived directly from the full dossier/UI contract and verified current repository seams.
- Persistence: HIGH — current migration head, transaction primitive, settings/backup order, and knowledge schemas were opened on disk.
- Pitfalls: HIGH — grounded in explicit trip-wires, current code mismatches, and immutable ADR boundaries.
- Open questions: HIGH confidence that the gaps exist; no product/security choice was silently made.

**Research date:** 2026-09-09
**Valid until:** 2026-10-09, or immediately stale if `TARGET_VERSION`, Phase 32's Unbound ruling, ADR-078/081, or the Profile UI contract changes.
