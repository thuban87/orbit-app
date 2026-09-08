# Phase 30: Orrery Systems - Research

**Researched:** 2026-09-08
**Domain:** SQLite schema design + a Skia/Reanimated Orrery authoring surface (React Native / Expo, local-first)
**Confidence:** HIGH (all claims grounded in files read on disk this session; no external packages introduced)

## Summary

Phase 30 turns the Orrery's read-only System *switcher* (built by Phase 29) into a full authoring surface: users define named custom Systems from rules + manual members, manage/reorder/hide/delete them, preview them full-canvas, and switch between them with a polished animation. Almost every capability this phase needs already has a canonical home on disk — the phase's job is to **extend closed unions and reuse existing seams**, not to invent parallel infrastructure. The single genuinely new artifact is the persisted Systems table set (definitions + rules + inclusions/exclusions), created by one forward-only migration.

The most important on-disk findings that correct the upstream documents: (1) the last-active-System preference **already exists** as `app_settings.orrery_last_system` (migration 021, Phase 29) and is **already** in `PORTABLE_SETTINGS_KEYS` and `updateAppSettings` — this phase does not add it, it *widens its grammar* to accept a new `custom:<uid>` token; (2) backup format is **already 4** (`BACKUP_FORMAT_VERSION`, bumped in 24.1 per STATE.md), not 3 as CONTEXT D-06 / the dossier state — "declare-only" this phase means adding nothing to the wire; (3) the reduced-motion hook exists exactly as the UI-SPEC's D-09 correction says (`src/theme/use-reduced-motion.ts`, ADR-085).

**Primary recommendation:** Model a custom System as a third `OrrerySystemRef` kind (`{ kind: "custom"; uid }`) alongside the existing `builtin`/`category` kinds, persist it in a new table set behind a new `systems-dao.ts`, and resolve its membership with a new function that composes the existing `dashboard-query-logic` SQL fragments (rules), the existing `dashboard-gravity-filter` post-query pass (gravity), and stored inclusion/exclusion rows — then feed the result through the *unchanged* Phase 29 `readOrrerySystemMembersCore` → store → renderer → `ring-seq-dao` pipeline.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ground truth and process**
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask. This dossier carries **no** dated 2026-09-01 amendment block and no auto-fixes; all body decisions stand as originally written, and no escalation routed here — read `phase-08-planning-notes.md` first for the E-02/E-03 constraints this phase inherits.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

**Phase-specific constraints**
- **D-04:** Systems persistence is **entirely unbuilt** (R-05). Today the only orrery persistence is `sun_contact_id` + `self_sun_colour` (`003-orrery-settings.ts:38-48`) and `contacts.ring_seq`; no systems/rules/include-exclude/order/visibility state exists. This phase creates the Systems table set (definitions, rule rows, explicit inclusion/exclusion rows, with ordering and visibility as definition columns). Verify all of this against the files on disk before asserting it.
- **D-05:** The last-active System is a **preference**, not a Systems-table row — it belongs in `app_settings` (possibly sharing Phase 29's orrery-prefs migration). Per-System camera position and per-System density are out of scope.
- **D-06:** Systems must be serializable by the backup bump (R-09). Backup format 3 (`src/backup/export-manifest.ts:45-81`) has no Systems; the v4 bump is Phase 36's final plan, so this phase **only declares its entity shape plus validation and orphan-repair expectations** — it does not bump the format itself.
- **D-07:** Category deletion fallout is real and is owned here (trip-wire): deleting a Category removes its generated System, and a custom-System rule referencing a deleted Category stays visible as *needing attention* rather than being silently deleted or rewritten — other valid rules and manual inclusions keep resolving. Category CRUD itself is Phase 37 and calls this handling; build no Category/System reconciliation wizard.
- **D-08:** The knowledge graph **cannot enumerate SQL writers** (trip-wire). Before asserting any invariant about the tables this phase adds, read every writer of them by hand.
- **D-09:** Reduced motion consumes Phase 23's hook (R-17), which does not exist yet — [**STALE — see correction below**]. The Reduced Motion System-switch path depends on it landing first.
- **D-10:** Consume Phase 29 rather than redefining it: camera, Home framing, projection, density, focus/cluster focus, high-count rendering, the switcher, and the built-in Systems. Phase 29's E-02 (never-contacted population membership) and E-03 (single canonical view) outcomes constrain what Systems may render. No arbitrary product cap on System membership — scale is solved with culling/LOD/virtualization.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.

### Deferred Ideas (OUT OF SCOPE)
Do NOT build: System-to-System composition/nesting or an arbitrary boolean-query expression builder; static-snapshot, AI-generated, or shared Systems; System folders/tags, a Recent Systems section, or a separate startup/default System preference (last-active persistence is sufficient); and general Category CRUD (Phase 37 owns it — this phase owns only the deletion fallout). Also deferred per the dossier: System-level sorting, per-System camera/density persistence, and the future Social Graph / Satellite Orrery model.

### Corrections to stale upstream text (verified on disk this session)
- **D-06 / dossier — "backup format 3":** STALE. `BACKUP_FORMAT_VERSION` resolves to **4** (`src/backup/export-manifest.ts` imports it; `FORWARD_MIGRATIONS` has a `3 → 4` step; STATE.md line 41 records 24.1 bumping 3→4 at commit d677e2c). [VERIFIED: src/backup/export-manifest.ts:97-104, 16] "Declare-only" still holds — the meaning is unchanged; only the current-version number is different.
- **D-09 — "reduced-motion hook does not exist yet":** STALE, as the UI-SPEC and the critical-research brief both flag. `useReducedMotion()` and `useReducedMotionShared()` exist in `src/theme/use-reduced-motion.ts` (ADR-085). [VERIFIED: src/theme/use-reduced-motion.ts:106-135]
- **D-05 — "possibly sharing Phase 29's orrery-prefs migration":** The column *already landed* in migration 021. This phase does **not** add a last-active column; see Standard Stack. [VERIFIED: src/db/migrations/021-orrery-preferences.ts:16-17]

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORRS-01 | Create named custom System from rules / manual / both; OR-within-family, AND-across-family over 8 axes | Reuse `dashboard-query-logic` fragments + `dashboard-gravity-filter` (Rule Semantics §). New `systems-dao` persists rules. |
| ORRS-02 | Manual include (durable) / exclude (discarded when it stops matching); Reset Overrides | New inclusion/exclusion rows; dynamic-bucket exclusion pruning at resolve time (Architecture §). |
| ORRS-03 | Built-in / per-Category immutable base; not-renamable; hideable (except All Contacts); overridable w/ indicator; duplicable | Consume existing `builtin`/`category` refs; add visibility + override rows; duplicate → new `custom` System. |
| ORRS-04 | Category rename renames generated System; delete removes it, leaves referencing rules "needs attention" | Broken-rule detection at resolve time; category `uid` join (Category-Deletion Fallout §). Phase 37 calls this. |
| ORRS-05 | Multi-page floating HUD (name, accordion rules, live count, Manage Members, Save) operable without canvas | UI-SPEC Interaction Contracts; new HUD components over Phase 29 canvas; reuse `useDiscardKeepGuard`. |
| ORRS-06 | Manage Members: searchable virtualized avatar grid, rule matches preselected, Excluded in place, counts | Reuse `contact-picker-selection` + `contact-picker-source` logic; ContactPicker is single-select — build multi-select grid on the same *logic* foundation (Member Manager §). |
| ORRS-07 | Full-canvas Preview over real layout/scale, simplified render; Save from Preview or HUD; Discard/Keep | Reuse Phase 29 projection/renderer with simplified body markers; `useDiscardKeepGuard`. |
| ORRS-08 | Save-new switches; edit-active stays active; edit-non-active returns without switching | Store `select()` semantics (Phase 29 store); switch on save-new only. |
| ORRS-09 | Flat Systems Management screen; CRUD/duplicate/reorder/hide-show/override-reset; All Contacts pinned; unique CI names | New screen + `systems-dao`; case-insensitive uniqueness constraint (Schema §). |
| ORRS-10 | Delete custom: simple confirm, Undo snackbar, never touches contacts, fall back to All Contacts if active | Reuse `snackbar-store`; delete cascades value rows; store falls back to `ALL_CONTACTS_SYSTEM`. |
| ORRS-11 | Switcher in management order, live counts, hidden omitted, empty-vs-broken distinct indicators | Extend `OrrerySystemSelector` + `buildSystemChoices` to include custom + visibility/order + severity icons. |
| ORRS-12 | Last-active persists; switch lands at Home framing; preserve focus present in both | `orrery_last_system` column (exists); Phase 29 Home framing + focus preservation seam. |
| ORRS-13 | Normal switch = spin+shedding/capture scaled to membership delta; Reduced Motion = crossfade/reposition | Skia render loop + `useReducedMotionShared()`; never per-frame React state. |
| ORRS-14 | Backup/restore preserves defs, rules, inc/exc, ordering, visibility, last-active | Declare-only: entity shape + validation/orphan-repair for Phase 36; `orreryLastSystem` already portable. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| System definitions / rules / inc-exc persistence | Database / Storage (`src/db/migrations`, new `systems-dao.ts`) | — | Durable local SQLite; DAO-only writes per CLAUDE.md |
| Membership resolution (rules + gravity + overrides) | Business logic (`src/logic`, `src/db` read layer) | Database | Reuses shared predicates; gravity is a post-query TS pass |
| Last-active System preference | Database (`app_settings`) | — | Preference, not a Systems row (D-05); column already exists |
| System authoring HUD / Manage Members / Preview | UI (`src/screens`, `src/components/orrery`) | Business logic | Focused workflow over Phase 29 canvas |
| Switcher + Management screen | UI | Business logic | Extends Phase 29 `OrrerySystemSelector` + new screen |
| Switch animation (spin/shed/capture, reduced-motion) | UI render loop (Skia/Reanimated) | — | Never driven from React state (CLAUDE.md, D-07/§W) |
| Backup serialization of Systems | Database / wire | — | Declare-only this phase; emission is Phase 36 |

## Standard Stack

All dependencies are **repository-native** — no new external package is introduced. This is a deliberate constraint from the UI-SPEC Registry Safety table ("no third-party registry or new external component dependency").

### Core (existing, consume as-is)
| Module | Path | Purpose | Why Standard |
|--------|------|---------|--------------|
| Migration runner | `src/db/migrations/runner.ts` | Forward-only `PRAGMA user_version` stepper, atomic per-step txn | The only sanctioned schema-change path (DATA-01) [VERIFIED: runner.ts:32-69] |
| App-settings DAO | `src/db/app-settings-dao.ts` | Reads/writes `app_settings`; owns `orrery_last_system` grammar | Single writer of the last-active preference [VERIFIED: app-settings-dao.ts:74-84, 883-884] |
| System logic | `src/logic/orrery-system-logic.ts` | `OrrerySystemRef` union, `systemRefId`, `parseSystemRef`, `buildOrrerySystemWhere` | The closed System-identity + WHERE-builder to extend for `custom` [VERIFIED: orrery-system-logic.ts:24-115] |
| System read | `src/db/orrery-system-read.ts` | `readOrrerySystemMembersCore`, `readOrrerySystemSnapshotCore`, `MissingOrreryCategoryError` | The unchanged resolve→snapshot pipeline custom Systems feed into [VERIFIED: orrery-system-read.ts:54-171] |
| System store | `src/stores/orrery-system-store.ts` | Zustand generation-guarded `select`/`reload`/`persist` state machine | Switch behavior, persistence, fallback all live here [VERIFIED: orrery-system-store.ts:46-164] |
| Dashboard query logic | `src/logic/dashboard-query-logic.ts` | `buildFilterWhere`, `ACTIVE_SEGREGATION_WHERE`, `FAVOURITES_WHERE`, `NOT_CONTACTED_WHERE`, `SNOOZED_WHERE` | The canonical shared predicate source (ADR-093) [VERIFIED: dashboard-query-logic.ts:75-160] |
| Gravity filter | `src/logic/dashboard-gravity-filter.ts` | `filterByGravity` post-query pass over `computeContactGravity` | Gravity is NEVER a SQL WHERE — reversible TS pass [VERIFIED: dashboard-gravity-filter.ts:19-38] |
| Ring-seq DAO | `src/db/ring-seq-dao.ts` | `commitRingReorder`, `rewriteRingSeq` over the *complete* orbiting population | Reorder guard scope must not be narrowed to a System (trip-wire) [VERIFIED: ring-seq-dao.ts:80-198] |
| Reduced motion | `src/theme/use-reduced-motion.ts` | `useReducedMotion()` (React), `useReducedMotionShared()` (Skia SharedValue) | ADR-085; the switch reduced-motion path [VERIFIED: use-reduced-motion.ts:106-135] |
| Switcher | `src/components/orrery/OrrerySystemSelector.tsx` + `orrery-controls-logic.ts` (`buildSystemChoices`, `systemSelectorLabel`) | The dropdown to extend for custom/hidden/order/severity | Consume Phase 29 E2 [VERIFIED: OrrerySystemSelector.tsx:22-50; orrery-controls-logic.ts:7-45] |
| Contact selection logic | `src/logic/contact-picker-selection.ts`, `contact-picker-source.ts`, `contact-picker-order.ts` | `toggleSelection`, `matchesQuery`, `filterRows` | The multi-select foundation for Manage Members [VERIFIED: contact-picker-selection.ts:3-38] |
| Snackbar / discard guard | `src/stores/snackbar-store.ts`, `src/navigation/discard-keep-guard.ts` | Undo snackbar; unsaved-changes contract | Reuse verbatim (§P/§R) [VERIFIED: file existence confirmed] |

### Supporting (existing UI primitives)
`AppText`, `Button` (`src/components/ui/Button.tsx`), `GlassSurface`, `Avatar`, `Icon`/`icon-registry.ts`, theme tokens (`SPACING`, `RADII`, `ICON_SIZE`, typography roles). Per UI-SPEC: add two central semantic icon keys `system-empty` (statusWobble) and `system-broken` (danger), plus `system-overrides` (neutral) — never inline glyphs.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `OrrerySystemRef` to a 3rd `custom` kind | A separate parallel custom-System type | Rejected — would fork every consumer (store, read, ring-seq, switcher, target validation). Extending the closed union keeps one pipeline. |
| Reusing `dashboard-query-logic` fragments | Re-implementing rule predicates in Systems | Forbidden by ADR-093 / dossier §C-§D ("reuse canonical shared domain predicates"). |
| Building Manage Members on `contact-picker-selection` logic | Adapting `ContactPicker.tsx` (single-select Modal) directly | `ContactPicker.tsx` is a single-select bottom-sheet Modal (`onSelect(contactId)`); the *logic* modules are the reusable multi-select foundation. Build a grid on the logic, don't bend the Modal. |

**Installation:** none — `npm install` adds nothing. Verify with `npm ls` that no new dependency is proposed.

## Package Legitimacy Audit

Not applicable — this phase installs **no external packages**. All modules are repository-native (`src/…`). No registry lookup required. If planning surfaces any `npm install`, treat it as a red flag against the UI-SPEC Registry Safety contract and gate it behind `checkpoint:human-verify`.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────── AUTHORING (new, UI) ───────────────────────────┐
  user gesture ─────────▶│  Systems HUD wizard  ──▶  Definition page (rule accordions, live count)    │
                         │        │                        │                                          │
                         │        │                        ├──▶ Manage Members (virtualized grid) ─────┼──┐
                         │        │                        └──▶ Preview (full-canvas, simplified) ──────┤  │
                         │        ▼                                                                     │  │
                         │  Systems Management screen (CRUD / reorder / hide / duplicate / override)   │  │
                         └───────────────────────────────────┬────────────────────────────────────────┘  │
                                                              │ writes (DAO only)                          │ reads
                                                              ▼                                            ▼
   ┌──────────────────────────── PERSISTENCE (new migration 022 + systems-dao.ts) ─────────────────────────────┐
   │  systems (def: uid, name, ordering, visibility, kind-of-base)   system_rules (family, value rows)          │
   │  system_manual_inclusions (contact_id)   system_manual_exclusions (contact_id)                             │
   │  app_settings.orrery_last_system  ◀── ALREADY EXISTS (migration 021); grammar widened to custom:<uid>      │
   └───────────────────────────────────────────────┬───────────────────────────────────────────────────────────┘
                                                    │
        ┌───────────────────── RESOLUTION (extend orrery-system-logic + read) ──────────────────────┐
        │  buildOrrerySystemWhere(ref)  ── builtin/category: static WHERE (unchanged)                │
        │                               └─ custom: NEW resolver =                                    │
        │        buildFilterWhere(stored rules)  [SQL: category/battery/needs-attn/frequency]        │
        │        + FAVOURITES/NOT_CONTACTED/SNOOZED fragments   [SQL]                                │
        │        → candidate ids  →  filterByGravity(...)  [post-query TS pass, no SQL]              │
        │        →  ∪ manual inclusions  ∖ manual exclusions (prune exclusions that stopped matching)│
        └───────────────────────────────────┬───────────────────────────────────────────────────────┘
                                             ▼
   readOrrerySystemMembersCore ─▶ readOrrerySystemSnapshotCore ─▶ orrery-system-store ─▶ OrreryWorld (Skia)
                                             │                             │
                                             │                             └─▶ OrrerySystemSelector (switcher)
                                             └─▶ ring-seq-dao (reorder over COMPLETE population, filtered view)
```

### Recommended Project Structure
```
src/
├── db/
│   ├── migrations/022-orrery-systems.ts   # NEW: systems table set (head+1)
│   └── systems-dao.ts                      # NEW: all Systems reads/writes (DAO-only rule)
├── logic/
│   ├── orrery-system-logic.ts             # EXTEND: add {kind:"custom"} to OrrerySystemRef, grammar
│   └── system-rule-resolver.ts            # NEW: compose dashboard predicates + gravity + overrides
├── screens/
│   ├── SystemBuilderScreen.tsx            # NEW: the floating HUD wizard (Definition/Members/Preview)
│   └── SystemsManagementScreen.tsx        # NEW: flat CRUD/reorder/hide screen
└── components/orrery/
    ├── OrrerySystemSelector.tsx           # EXTEND: custom + hidden + order + empty/broken severity
    ├── ManageMembersGrid.tsx              # NEW: virtualized multi-select over contact-picker-* logic
    └── SystemPreviewCanvas.tsx            # NEW: simplified full-canvas render over Phase 29 layout
```
*(Names are illustrative — Claude's discretion where they don't touch a decision.)*

### Pattern 1: Extend the closed `OrrerySystemRef` union (do not fork it)
**What:** Add a third kind so custom Systems ride the whole Phase 29 pipeline.
**When to use:** Every consumer of a System identity.
```typescript
// Source: extends src/logic/orrery-system-logic.ts:24-31 (verified on disk)
export type OrrerySystemRef =
  | { kind: "builtin"; id: OrreryBuiltinId }
  | { kind: "category"; uid: string }
  | { kind: "custom"; uid: string };   // NEW
// systemRefId must emit `custom:<uid>`; parseSystemRef must round-trip it;
// assertOrreryLastSystem (app-settings-dao.ts:74-84) must accept `custom:<uid>`.
```
The `orrery_last_system` SQL CHECK is only `length(...) BETWEEN 9 AND 265` [VERIFIED: 021-orrery-preferences.ts:16-17], so a `custom:<uid>` token already passes the column constraint — but the **TypeScript** grammar `assertOrreryLastSystem` currently rejects it (allows only builtin ids or `category:…`) [VERIFIED: app-settings-dao.ts:74-84]. Widen the validator and the `OrrerySystemId` type (`app-settings-dao.ts:58-60`) together; the `PORTABLE_SETTINGS_KEYS` allowlist already contains `orreryLastSystem` [VERIFIED: backup-schema.ts:178].

### Pattern 2: Custom-System membership resolver (compose, don't re-implement)
**What:** `buildOrrerySystemWhere` returns a static `{sql, params}` for builtin/category [VERIFIED: orrery-system-logic.ts:73-115]. Custom Systems cannot be a single WHERE because (a) gravity is a post-query TS pass and (b) manual inc/exc are rows. Add a resolver that returns a *member id set*, then hand it to the read layer.
**When to use:** Custom System resolution only; builtin/category keep the fast static WHERE path.
```typescript
// Source: composes dashboard-query-logic.ts:75-160 + dashboard-gravity-filter.ts:19-38
// 1. SQL candidate read: buildFilterWhere(storedRules) AND ACTIVE_SEGREGATION_WHERE,
//    plus FAVOURITES_WHERE / NOT_CONTACTED_WHERE / SNOOZED_WHERE for those axes.
// 2. Gravity: filterByGravity(candidateIds, tiers, loadInputs, now)  — NO SQL.
// 3. members = (candidates ∪ manualInclusions) ∖ manualExclusions.
// 4. Prune exclusions whose contact is NOT in the current candidate set
//    (dynamic buckets, not ledgers — dossier §E).
```
**Gravity tier names (verbatim):** `"thin"`, `"building"`, `"solid"`, `"deep"` [VERIFIED: src/services/impact.ts:64-67]. Rule-family filter tokens (verbatim): `"category"`, `"social-battery"`, `"needs-attention"`, `"gravity"`, `"contact-frequency"` [VERIFIED: dashboard-query-logic.ts:14-20]; social-battery values `"Charger"`, `"Neutral"`, `"Drain"` [VERIFIED: dashboard-query-logic.ts:38]; frequency buckets `weekly`/`monthly`/`quarterly`/`yearly` [VERIFIED: dashboard-query-logic.ts:29-34]; needs-attention value `"on"` [VERIFIED: dashboard-query-logic.ts:39]. The eight dossier axes map: Category→`category`, Favorite→`FAVOURITES_WHERE`, Status/Needs-Attention→`needs-attention`, Gravity→post-query pass, Social Battery→`social-battery`, Contact Frequency→`contact-frequency`, Not Contacted→`NOT_CONTACTED_WHERE`, Snoozed→`SNOOZED_WHERE`. Birthday is omitted (dossier §D).

### Pattern 3: Migration mirrors the neighbor conventions exactly
**What:** One additive, forward-only migration; number = head+1.
```typescript
// Source: mirrors src/db/migrations/016-contact-knowledge.ts conventions (verified on disk)
// uid TEXT UNIQUE NOT NULL; contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE;
// UNIQUE indexes for integrity; runner owns the transaction (no BEGIN in the migration body).
export const migration022 = { version: 22, async apply(exec) { await exec.execAsync(`...`); } };
```
Categories table shape (for the category-join / rename / delete fallout): `id, uid TEXT NOT NULL UNIQUE, name, display_order, created_at, modified_at` [VERIFIED: src/db/migrations/001-initial.ts:41-49].

### Anti-Patterns to Avoid
- **Driving the switch animation from React state.** CLAUDE.md + §W: use the Skia render loop / Reanimated shared values, pause on `useIsFocused===false` and `AppState` background. `OrrerySystemSelector` already models the focus/AppState dismiss pattern [VERIFIED: OrrerySystemSelector.tsx:71-79].
- **Narrowing `ring-seq-dao` scope to a System.** `commitRingReorder`/`rewriteRingSeq` operate over the *complete* orbiting population with three guards; a System is a *filtered view* reconciled via `mergeVisibleRingOrder` [VERIFIED: ring-seq-dao.ts:114-133]. Removing/narrowing a guard corrupts ring order (trip-wire, UI-SPEC line 250).
- **Inline SQL in components.** DAO-only (CLAUDE.md). All Systems SQL goes through `systems-dao.ts`.
- **A worklet calling a worklet defined later in the same file.** MEMORY worklet forward-ref hazard — undefined-on-device Hermes crash vitest can't catch; define helpers above callers. Directly relevant to the new Skia switch animation.
- **`toISOString().split('T')[0]` for dates.** Use `formatLocalDate()` / `localDateTime()` (CLAUDE.md; ring-seq uses `localDateTime()`).
- **A hardcoded colour in a Skia draw.** All colours via `useTheme().colors[...]` (`npm run check:colors` gate).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rule predicates | New SQL per axis | `dashboard-query-logic` fragments (ADR-093) | Drift from Dashboard = truth bugs; already `?`-bound + injection-safe |
| Gravity filtering | A gravity SQL column | `filterByGravity` post-query pass | Gravity is derived at read time; a cached column is a one-way owner decision |
| Contact multi-select | A second selection system | `contact-picker-selection`/`-source`/`-order` logic | Dossier §M explicitly forbids a second selection system |
| Reduced-motion signal | `AccessibilityInfo` wiring | `useReducedMotion` / `useReducedMotionShared` | ADR-085; the live-toggle subtleties are already solved (RN reanimated's own hook reads at boot only) |
| Migration mechanics | Bespoke `user_version` logic | `runMigrations` | Crash-safe atomic-step contract (DATA-01) |
| Undo after delete | Custom snackbar | `snackbar-store` | §R contract; no 30-day quarantine for Systems |
| Unsaved-changes guard | Custom dialog | `useDiscardKeepGuard` | §P: reuse the shell contract verbatim |
| Last-active persistence | AsyncStorage / new column | `app_settings.orrery_last_system` (exists) | D-03/D-05; already portable |

**Key insight:** This phase is ~90% *composition* of existing, battle-tested seams. The new code is the persistence layer, the custom-System resolver, and the authoring UI. Everything else is a call into Phase 25/29/23 infrastructure.

## Runtime State Inventory

> This is a schema-*adding* phase, not a rename/refactor. The five categories are answered for completeness because the phase mutates durable state and a preference grammar.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No `systems`/rules/inc-exc tables exist — verified no `TABLE …system…` in migrations except the `app_settings` orrery columns [VERIFIED: grep, migrations 001-021]. `app_settings.orrery_last_system` default `'builtin:all-contacts'` [VERIFIED: 021:16]. | Create table set (migration 022); no data migration of existing rows needed (nothing to migrate). |
| Live service config | None — local-first, no backend, no external service holds System state. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — no secret touched. `orreryLastSystem` is a non-secret portable key. | None. |
| Build artifacts | None — pure TS/SQL additions. | None. |

**Canonical question — after the migration lands, what still holds the old grammar?** The `assertOrreryLastSystem` validator and `OrrerySystemId` type: an existing device's `orrery_last_system` can only ever be `builtin:*` or `category:*` today, so widening the grammar to also accept `custom:*` is purely additive and starting-state-independent. No stored value becomes invalid.

## Common Pitfalls

### Pitfall 1: Assuming last-active needs a new column (it doesn't)
**What goes wrong:** Plan adds a `orrery_last_system` column, colliding with migration 021.
**Why it happens:** CONTEXT D-05 says "possibly sharing Phase 29's orrery-prefs migration"; Phase 29 already *did* land it.
**How to avoid:** The column exists [VERIFIED: 021:16-17]. Phase 30 only widens the TS grammar (`assertOrreryLastSystem`, `OrrerySystemId`) to accept `custom:<uid>`.
**Warning signs:** A migration 022 body that touches `app_settings`.

### Pitfall 2: Treating a custom System as a static SQL WHERE
**What goes wrong:** Custom-System resolver tries to be one `buildOrrerySystemWhere` string; gravity and manual inc/exc can't fit.
**Why it happens:** builtin/category *are* static WHEREs, so it looks uniform.
**How to avoid:** Gravity is a post-query TS pass (`filterByGravity`) and inc/exc are rows — resolve to an id-set, not a WHERE (Pattern 2).
**Warning signs:** A gravity term appearing in a SQL string.

### Pitfall 3: Narrowing the ring-seq guard to System scope
**What goes wrong:** Reorder inside a filtered System writes `ring_seq` over a partial list, tripping Guard 2 (count mismatch) or corrupting order.
**Why it happens:** Reorder feels like it should be per-System.
**How to avoid:** `commitRingReorder` already takes an `OrrerySystemRef` and reconciles the visible subset against the complete population via `mergeVisibleRingOrder` [VERIFIED: ring-seq-dao.ts:114-127]. A custom System is just another `system` argument — do not bypass the guards.
**Warning signs:** Any change to `rewriteRingSeqCore`'s count/scope guards.

### Pitfall 4: Emitting Systems into the backup wire this phase
**What goes wrong:** Adding to `getPortableSettingsSnapshot` SELECT or `FORWARD_MIGRATIONS` silently changes the format-4 wire shape and hard-rejects backups on older builds.
**Why it happens:** ORRS-14 says backup must preserve Systems.
**How to avoid:** Declare-only (D-06). The established idiom: allowlist keys in `PORTABLE_SETTINGS_KEYS` / mark shapes optional, but **do not** emit or bump — exactly how Phase 23/25/29 deferred to Phase 36 [VERIFIED: backup-schema.ts:156-179; app-settings-dao.ts:250-274]. Systems are *tables*, not settings — the plan must define the entity shape + validation + orphan-repair expectations as a documented contract Phase 36 consumes, and write nothing to the wire now.
**Warning signs:** Any edit to `export-manifest.ts` or `BACKUP_FORMAT_VERSION`.

### Pitfall 5: Silently rewriting a broken rule
**What goes wrong:** A rule referencing a deleted Category gets dropped or repointed.
**Why it happens:** Feels like cleanup.
**How to avoid:** §I/D-07: keep the rule visible as *needs attention*; keep resolving the rest. The existing `missing-category` status + `MissingOrreryCategoryError` model the builtin-category case [VERIFIED: orrery-system-read.ts:59-65, 166-171]; custom Systems need an analogous per-rule broken-flag at resolve time (a rule whose `category:<uid>` no longer joins `categories`). This is a **decision reversal risk** if done wrong — a reviewer flagging silent rule removal is an escalation trigger (CLAUDE.md).
**Warning signs:** A DELETE of a `system_rules` row triggered by category deletion.

## Code Examples

### Verifying the migration number at plan time (do this, don't assume)
```bash
# Source: verified this session
ls src/db/migrations/            # highest is 021-orrery-preferences.ts
grep -n TARGET_VERSION src/db/database.ts   # => export const TARGET_VERSION = 21;
# head = 21  =>  Phase 30 migration = 022 (register in MIGRATIONS array + bump TARGET_VERSION to 22)
```

### Reusing the shared predicates for a stored rule set
```typescript
// Source: src/logic/dashboard-query-logic.ts:75-116 (verified)
import { buildFilterWhere, ACTIVE_SEGREGATION_WHERE } from "@/logic/dashboard-query-logic";
const { sql, params } = buildFilterWhere(storedRules); // OR within family, AND across families
const where = sql ? `${ACTIVE_SEGREGATION_WHERE} AND (${sql})` : ACTIVE_SEGREGATION_WHERE;
// gravity handled AFTER this read via filterByGravity(); never in `where`.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Orrery Systems = 6 builtins + N category Systems only | + user-authored `custom` Systems | This phase | Extend the closed union, not fork it |
| Backup format 3 | Format 4 | 24.1 (commit d677e2c) | "Declare-only" targets format 4; emission still Phase 36 |
| No reduced-motion hook | `use-reduced-motion.ts` (ADR-085) | Phase 23 | Switch reduced-motion path is unblocked |
| Status/Relationship mode split | Single canonical view (ADR-077 supersedes ADR-048) | Phase 8/29 | A System renders one canonical world; never a mode |

**Deprecated/outdated in the upstream docs (do not act on):** "backup format 3" (now 4); "reduced-motion hook does not exist" (it does); "add last-active column" (already added, migration 021).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | New Systems tables should be modeled as `systems` (def, with ordering+visibility columns) + `system_rules` + `system_manual_inclusions` + `system_manual_exclusions` | Schema/Architecture | Table decomposition is [DERIVED]/Claude's discretion (dossier §B "separately represent rules, manual inclusions, and exclusions"). Exact table count/naming is a plan-time design choice; the *separation* is decided. |
| A2 | Custom-System membership resolves to an id-set (not a static WHERE), composing SQL fragments + gravity TS pass + inc/exc | Architecture Pattern 2 | If a future gravity SQL column lands (owner decision), the resolver could simplify — but today gravity is TS-only [VERIFIED]. Low risk. |
| A3 | Manage Members builds a new virtualized grid on the `contact-picker-*` *logic* modules rather than reusing `ContactPicker.tsx` (a single-select Modal) | Member Manager | If the planner expects to reuse the `.tsx` directly, it will hit the single-select `onSelect(contactId)` shape. The dossier says reuse the *selection foundation* — interpreted as the logic modules. Confirm at plan time. |
| A4 | `system-empty`/`system-broken`/`system-overrides` icon keys are added centrally to `icon-registry.ts` | UI | UI-SPEC prescribes these keys; exact Ionicons glyphs are implementation detail. Low risk. |

**All four are [DERIVED]/discretion items — none reverses a [DECIDED] item or an ADR.**

## Open Questions (RESOLVED)

*All three are resolved by their landing spot in the Phase 30 plan set (committed `e3de53e`); none is an execution-ambiguity blocker.*

1. **Exact Systems table decomposition and column set.** — **RESOLVED → plan `30-01` (`checkpoint:decision`, one-way door).**
   - What we know: rules, manual inclusions, and exclusions must be *separately* represented (dossier §B); ordering + visibility are definition columns (D-04); uid UNIQUE + cascade conventions from migration 016.
   - What's unclear: whether rules are one row-per-value (family, value) or a JSON blob per family; whether built-in/category *overrides* share the custom inc/exc tables (keyed by the builtin/category ref) or use their own.
   - Recommendation (carried into plan 30-01's gated decision, Option A): one row-per-value rule rows (queryable, matches the `filters` family/values shape) and a single inc/exc table keyed by System ref so builtin/category overrides reuse it. **Owner signs off the final table shape at the plan 30-01 `checkpoint:decision` before the migration is written (irreversible in production).**

2. **How the switcher shows live counts without eager full resolution at scale (§Z).** — **RESOLVED → plan `30-05` + device-verify.**
   - What we know: `buildSystemChoices` currently maps categories; counts must be live; large Systems must not eagerly mount (§Z, culling/LOD).
   - What's unclear: whether counts are a cheap `COUNT(*)` per System per open, or cached.
   - Recommendation (adopted by plan 30-05): compute counts via lightweight `COUNT(*)` over the resolver's SQL candidate set at dropdown-open (gravity Systems need the TS pass — acceptable for a count on open, or count pre-gravity with a note). Carried to on-device verification at large counts.

3. **Focus preservation across a switch (§V, device-tuning).** — **RESOLVED → plan `30-10` + device-UAT.**
   - What we know: preserve a focus present in both source and destination, else clear; land at Home framing.
   - What's unclear: exact behavior is explicitly device-test-and-simplify-if-disorienting (§V [DERIVED]).
   - Recommendation (adopted by plan 30-10): implement the preserve-if-in-both rule; carried to on-device UAT (simplify only if disorienting).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-sqlite | All persistence | ✓ (in-repo, all migrations) | as pinned | — |
| react-native-skia | Preview + switch animation | ✓ (Phase 29 uses it) | as pinned | — |
| react-native-reanimated | Shared values, reduced-motion | ✓ | as pinned | — |
| Pixel 6 Pro (device) | Skia perf, switch animation, reduced-motion, large-System scale | device-dependent | — | Desktop emulator CANNOT assess Skia render-loop perf (CLAUDE.md, §Z) |

**Missing dependencies with no fallback:** none for build. **Perf verification** *must* run on the physical Pixel — the orrery is a Skia render-loop feature and the emulator (Ivy Bridge box) cannot render it (MEMORY: no local emulator by hardware).

## Validation Architecture

> `workflow.nyquist_validation` treated as enabled (not explicitly false). Test framework confirmed on disk.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` [VERIFIED: package.json:55] |
| Config file | `vitest.config.ts` [VERIFIED: exists] |
| DB test substrate | `node:sqlite` (migrations tested node-side via `SqlExecutor`; runner is node-testable by design) [VERIFIED: runner.ts:13-14] |
| Quick run command | `npx vitest run <path>` |
| Full suite command | `npm test` (→ `vitest run`) [VERIFIED: package.json:71] |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| ORRS-01/02 | Rule resolution (OR/AND), inc/exc, dynamic-bucket exclusion pruning | unit (node:sqlite) | `npx vitest run src/logic/system-rule-resolver.test.ts` | ❌ Wave 0 |
| ORRS-02/09 | Migration 022 shape: uid UNIQUE, `UNIQUE(system, contact)`, case-insensitive name uniqueness, cascade of value rows on delete | unit (node:sqlite) | `npx vitest run src/db/migrations/022-orrery-systems.test.ts` | ❌ Wave 0 |
| ORRS-03 | Duplicate deterministic naming (`Copy`/`Copy 2`), builtin immutability | unit | `npx vitest run src/db/systems-dao.test.ts` | ❌ Wave 0 |
| ORRS-04 | Broken-rule detection: rule referencing deleted category flagged, others resolve | unit | `npx vitest run src/logic/system-rule-resolver.test.ts` | ❌ Wave 0 |
| ORRS-10 | Delete → fallback to All Contacts; never touches contacts | unit (store + dao) | `npx vitest run src/stores/orrery-system-store.test.ts` | partial (store exists) |
| ORRS-12 | Grammar round-trips `custom:<uid>`; last-active persists | unit | `npx vitest run src/logic/orrery-system-logic.test.ts src/db/app-settings-dao.test.ts` | partial |
| ORRS-14 | Backup declare-only: `assertPortableSettings` accepts `custom:*`; no wire emission | unit | `npx vitest run src/backup/export-manifest.test.ts` | exists (extend) |
| ORRS-05/06/07/11/13 | HUD operable w/o canvas; grid preselect/exclude; Preview; switcher severity; switch animation + reduced motion | **on-device UAT** | manual on Pixel (see below) | n/a |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green + on-device UAT before `/gsd-verify-work`.

### On-device-verify-only (cannot be unit-proven)
Skia full-canvas Preview render; spin+shedding/capture switch animation and its membership-delta intensity (§W); Reduced Motion crossfade path (§X, `useReducedMotionShared`); large-System scale/culling/LOD (§Z); largest-text/long-name layout in HUD/switcher/management rows; empty-state restrained comet; canonical Home framing + focus preservation (§V). Use the device UAT run-as / debug-build pattern (MEMORY: device-UAT-runas-pattern; Orbit Metro on :8082).

### Wave 0 Gaps
- [ ] `src/db/migrations/022-orrery-systems.test.ts` — schema invariants (uid UNIQUE, unique CI names, cascades)
- [ ] `src/db/systems-dao.test.ts` — CRUD, duplicate naming, immutability, visibility/order
- [ ] `src/logic/system-rule-resolver.test.ts` — rule composition, gravity pass, inc/exc pruning, broken-rule flag
- [ ] Extend `src/logic/orrery-system-logic.test.ts`, `src/db/app-settings-dao.test.ts`, `src/backup/export-manifest.test.ts` for the `custom:<uid>` grammar
- [ ] Framework install: none (Vitest present)

## Security Domain

> `security_enforcement` treated as enabled. Local-first, no network on any read path (CLAUDE.md) — no auth/session/transport surface. Relevant category is input validation of persisted/restored System data.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts/backend |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single on-device datastore |
| V5 Input Validation | **yes** | Closed-grammar validators (`assertOrreryLastSystem` extended for `custom:*`); `?`-bound SQL only; rule tokens select from closed constants (never interpolated); System name length/uniqueness checks in the DAO |
| V6 Cryptography | no | No secrets introduced (Systems carry no credentials) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via rule/name values | Tampering | `?`-bound params everywhere; identifiers never interpolated (the `buildFilterWhere` idiom [VERIFIED: dashboard-query-logic.ts:83-115]) |
| Malformed System token in a restored/hand-edited backup | Tampering | Grammar validator on restore (`assertPortableSettings` calls `assertOrreryLastSystem` [VERIFIED: backup-schema.ts:213-220]) — extend to accept, not silently coerce, `custom:*`; orphan-repair expectations declared for Phase 36 |
| Half-applied migration wedging an unreachable device | Denial of Service | Atomic per-step txn in `runMigrations` (DATA-01); additive-only, starting-state-independent [VERIFIED: runner.ts:56-67] |

## Sources

### Primary (HIGH confidence — files read on disk this session)
- `src/db/database.ts` (TARGET_VERSION=21), `src/db/migrations/runner.ts`, `021-orrery-preferences.ts`, `003-orrery-settings.ts`, `001-initial.ts`, `016-contact-knowledge.ts`
- `src/logic/orrery-system-logic.ts`, `src/db/orrery-system-read.ts`, `src/db/orrery-action-read.ts`, `src/stores/orrery-system-store.ts`
- `src/logic/dashboard-query-logic.ts`, `src/logic/dashboard-gravity-filter.ts`, `src/services/impact.ts` (GRAVITY_TIERS)
- `src/db/app-settings-dao.ts`, `src/backup/backup-schema.ts` (PORTABLE_SETTINGS_KEYS), `src/backup/export-manifest.ts` (BACKUP_FORMAT_VERSION / FORWARD_MIGRATIONS)
- `src/db/ring-seq-dao.ts`, `src/theme/use-reduced-motion.ts`, `src/components/ContactPicker.tsx`, `src/logic/contact-picker-selection.ts`
- `src/components/orrery/OrrerySystemSelector.tsx` + `orrery-controls-logic.ts`
- `.planning/REQUIREMENTS.md` (ORRS-01…14), `.planning/STATE.md`, the phase dossier, planning-notes (08 & 09), 30-CONTEXT.md, 30-UI-SPEC.md

### Secondary / Tertiary
- None — no web/external source was needed; the phase introduces no new package.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module read on disk; no external deps.
- Architecture: HIGH — consumers/pipeline traced end-to-end; table decomposition is the one [DERIVED] design area (A1).
- Pitfalls: HIGH — each corresponds to a verified seam or an explicit trip-wire.
- Backup / migration facts: HIGH — corrected against actual files (format 4, head=21).

**Research date:** 2026-09-08
**Valid until:** ~2026-10-08 for stack facts; **migration number and TARGET_VERSION must be re-verified at plan time** (they drift every schema phase) — head+1 is **022** as of this reading.
