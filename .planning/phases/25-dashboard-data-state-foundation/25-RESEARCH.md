# Phase 25: Dashboard Data & State Foundation - Research

**Researched:** 2026-09-04
**Domain:** On-device SQLite query engine + pure-TypeScript state/scoring layer (React Native / Expo, local-first). No new external dependency.
**Confidence:** HIGH (entire domain is in-repo; every claim below is read from disk this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

> CONTEXT.md is a shim. The authoritative decision record is the dossier + planning-notes (D-01/D-02).
> Every `[DECIDED]`/`[REJECTED]`/ADR item is settled — surface any conflict as a **stop-and-ask**, never "fix" it.

### Locked Decisions (verbatim)
- **D-01:** Read the phase dossier IN FULL before planning. Its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. `[DECIDED]`/`[REJECTED]` items and any Accepted ADR / HANDOFF.md entry are owner-only to reopen — stop and ask.
- **D-02:** Read the planning-notes file as a binding appendix: every REPLAN finding must be reflected in the plan, and **every trip-wire is a stop-and-ask**.
- **D-03:** This phase ships SQLite schema. Verify head+1 against `src/db/migrations/` and `TARGET_VERSION` on disk at plan time. Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences (population multi-select, view mode, sort mode incl. Default-vs-explicit) are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, **never AsyncStorage** — replacing today's non-portable `orbit-dashboard-prefs` (R-16).
- **D-04 (E-01, ADR-075):** Favourites are **binary membership with no user-visible ranking**. Manage-favourites drag-reorder screen is retired; the Dashboard never sorts by `favourite_rank`; the widget renders the Favorites population in Default order. Supersedes ADR-033. **Trip-wire: do not drop the `favourite_rank` column** without a decided fate for `ManageFavouritesScreen.tsx` and the rank-ordered capture / sun / merge picker reads.
- **D-05 (E-02, ADR-011 preserved):** Active Contacts stays **status-bearing only** and excludes never-contacted, archived, and unbound. A fifth population **All Contacts = Active ∪ Not Contacted** provides the union; archived and unbound stay outside it. D-04-027 does NOT ship. **Trip-wire: keep `BASE_WHERE` for Active and build All Contacts as an explicit union predicate — do not weaken `BASE_WHERE`.** Retiring the Never Contacted screen and `include_unbound_never_contacted` is a deletion-with-consumers; coordinate the key removal with the backup format bump.
- **D-06 (E-04, ADR-076):** ADR-034 superseded by ADR-076. Richer birthday presentation moves to the deferred "Your Week" phase; the Dashboard keeps only the Birthday population (next 30 days) and its entry point. **If the banner is removed while Your Week is unplanned, note the coverage gap** rather than silently dropping the surface.
- **D-07 (R-11, ADR-062):** Search is today the **only name-lookup path for Unbound contacts**, and this phase removes them from Dashboard search. Provide a replacement retrieval path (Unbound child-route search, or add Unbound to the shared picker's explicit-search path), coordinated with the Control Surface phase's R-11. Removing Unbound retrieval without a replacement weakens ADR-062 → trip-wire.
- **D-08 (R-10, ADR-031):** Typo tolerance and knowledge-wide search resolve as **TypeScript scoring over the already-filtered eligible set** — prefix/substring plus edit distance ≤ 1 per term (≤ 2 for six-or-more-character terms). **No FTS5, no new index**; FTS5 would reverse ADR-031 → stop and ask. Corpus depends on the Contact Knowledge phase landing first (it has — see below).
- **D-09:** Search is restricted to the currently eligible Population + Filters universe and never surfaces archived or unbound contacts; while search is active relevance is the primary order and the current Dashboard sort acts only as a tie-breaker. Global cross-universe search was explicitly **rejected**.
- **D-10 (architecture):** The query architecture must **not** be coupled to exactly two renderers. List and Card share one query state (never separate population/filter/sort selections), each axis is independently clearable, and a global Reset Dashboard View restores all four while preserving the List/Card preference.
- **D-11 (AF-08):** The "compact Card/Grid renderer" deferral is struck — Card View *is* the compact 3-column avatar-first grid; nothing separate remains deferred.

### Claude's Discretion (verbatim)
- Everything the dossier marks `[DERIVED]`, plus open implementation details that do not touch a `[DECIDED]` item, an ADR, or a HANDOFF.md entry — including the exact numerical search-scoring weights, which are tuned with fixtures and tests.

### Deferred Ideas — OUT OF SCOPE (verbatim)
Do-not-build here: **ranked Favorites as a product concept** (retired with the Manage-favourites screen + rank) and **richer imminent/upcoming birthday presentation** (relocated to the deferred Your Week phase; Dashboard keeps only the population + entry point). Also out: global search crossing Dashboard/Archived/Unbound universes (rejected), remote/indexed search infrastructure, advanced filter families beyond the initial five, arbitrary custom-field filtering, and permanent Dashboard summary modules.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support |
|----|-------------|------------------|
| DASHQ-01 | No population → Active Contacts (status-bearing only; excludes never-contacted/archived/unbound, ADR-011) | `BASE_WHERE` already encodes this exactly (`dashboard-read.ts:155-158`); keep it verbatim as the Active predicate |
| DASHQ-02 | Multi-select populations OR-union, dedupe, deselect-last → Active | Requires replacing the single-filter branch model with an OR-union engine (§Architecture Pattern 1) |
| DASHQ-03 | All Contacts = Active ∪ Not Contacted; archived/unbound out; Never Contacted screen + include-Unbound toggle retire | Union predicate over `BASE_WHERE ∪ (never-contacted predicate)`; retirement paths in §Runtime State Inventory |
| DASHQ-04 | Favorites binary, no rank sort (ADR-075); Birthdays = next 30 days | `favourite_rank IS NOT NULL` as membership only; birthday window via `birthday-logic.ts` |
| DASHQ-05 | Snoozed stays in Active but suppressed from Needs Attention; reachable via population/search/action | Snooze clause is already in `BASE_WHERE`; Needs-Attention is a filter over `PROGRESS_SQL` |
| DASHQ-06 | Five filter families, OR-within / AND-across, survive population change | Category/Battery/Frequency/Needs-Attention are SQL-expressible; **Gravity is NOT** — see Open Question 1 |
| DASHQ-07 | Sort Default (population-aware) + explicit overrides survive until reset | Persist literal `'default'`, resolve per-population at query build (dossier §H) |
| DASHQ-08 | Search scoped to Population + Filters; never archived/unbound; Unbound gets replacement path | Scope corpus read to eligible ids; D-07 replacement path |
| DASHQ-09 | Forgiving match + typo tolerance across semantic corpus; term-coverage ranking; identity prioritized; sort = tie-breaker only | `knowledge-search.ts` scorer already implements this (§Code Examples) — extend, don't rebuild |
| DASHQ-10 | Up to 3 prioritized highlighted snippets + "+N more"; name match doesn't suppress secondary | **Gap:** scorer does not yet emit match descriptors/highlights — must be added (§Architecture Pattern 2) |
| DASHQ-11 | List/Card + population + filters + sort persist across relaunch (durable, portable); search text + scroll do NOT | `app_settings` columns + `PORTABLE_SETTINGS_KEYS` allowlist (emission deferred to P36) |
| DASHQ-12 | Dashboard → Profile → Back restores full working state incl. search + scroll | In-memory ephemeral session store (§Architecture Pattern 3) |
| DASHQ-13 | One shared query state; each axis clearable; global Reset preserves List/Card | Single reducer/store owning the four axes + a deterministic reset transition |
| DASHQ-14 | Birthday banner removed (ADR-076); only Birthdays population remains | Retire `BirthdayBanner.tsx` (§Runtime State Inventory) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These carry the same authority as locked decisions — no recommendation below contradicts them:

- **Local-first (product commitment):** no network on any read path; the Dashboard must render offline. No FTS5, no new search index (D-08 / ADR-031).
- **Review the code, not the diff:** for anything touching a shared table read **every writer**. The graph cannot enumerate SQL writers — the `contacts`-column writer/reader survey in §Runtime State Inventory is a manual grep and must be re-verified at plan time.
- **SQLite migrations:** forward-only, strict order, **irreversible in production**, never edit a shipped migration. Ship schema as application code via `PRAGMA user_version`. There is no RPC — logic that would be a DB function lives in TypeScript.
- **Custom fields (ADR-001 / migration 006):** normalized `custom_field_values`; route any custom-field sort/filter through the single `sortExpr()` helper (`field-sort.ts`) — never interpolate a custom identifier into ORDER BY. (This phase does **not** filter/sort on custom fields — arbitrary custom-field filtering is out of scope — but search *reads* custom values.)
- **Dates:** use `formatLocalDate()` / the local-wall-clock convention — never `toISOString().split('T')[0]`. Stored columns (`last_contact`, `snooze_until`) are already local; never re-run through `'localtime'`.
- **Colours** resolve through theme tokens; **animation never driven from React state** (both are render-phase concerns; this foundation is nonvisual but exports the constraint to Phases 26–28).
- **Never push. No git worktrees. No worktree isolation for any spawned subagent.**
- **Zustand stores** in `src/stores/`; DAO queries in `src/db/`, never inline in components.

## Summary

Phase 25 is a **nonvisual state/query foundation**, not a UI phase. It replaces today's *single-population, single-filter, LIKE-only* Dashboard read with **one shared query/state engine** consumed later by the Control Surface (26), List View (27), and Card View (28). Almost everything it needs already exists in the repo as separable pieces; the work is composition, a deliberate rewrite of `dashboard-read.ts`, an extension of the already-built search scorer, a schema migration for durable prefs, and the careful **retirement** of four superseded surfaces — each of which has live consumers that must be re-pointed, not merely deleted.

Three findings dominate the plan. **(1)** The typo-tolerant knowledge scorer (`src/services/knowledge-search.ts`) and its corpus reader (`src/db/knowledge-search-read.ts`) were built in Phase 24.2 and have **no runtime consumer yet** — Phase 25 is where they get wired in. They already implement prefix/substring + bounded edit distance ≤1 (≤2 for 6+ chars) and term-coverage ranking exactly as D-08/D-09 require, but they do **not** yet emit the match descriptors (snippet, highlight ranges, sourceKind priority, `totalMatchCount`, `+N more`) the UI-SPEC's Search-Result Presentation Contract requires, and the corpus read is **unscoped** (reads all contacts, no archived/unbound/population filter). **(2)** Four of the five filter families are SQL-expressible from existing columns/fragments, but **Gravity/Closeness is derived in TypeScript over the entire interaction log** (`services/impact.ts` + `gravity-logic.ts`) — there is no gravity column — so a Gravity filter cannot be a WHERE predicate and forces an architectural choice (Open Question 1). **(3)** Durable prefs follow the *exact* staged pattern the Phase 23 theme keys established: add `app_settings` columns (migration **019**), add them to the `app-settings-dao` accessor/patch, allowlist them in `PORTABLE_SETTINGS_KEYS` — but **defer wire emission + the `BACKUP_FORMAT_VERSION` bump to Phase 36** (the theme keys sit in exactly this half-landed state today).

**Primary recommendation:** Rewrite `src/db/dashboard-read.ts` into an OR-union population engine + AND-across/OR-within filter composer over the existing status fragments; extend `knowledge-search.ts` to emit scoped match descriptors and feed it eligible ids from the same pipeline; store durable axes in new `app_settings` columns (migration 019, `TARGET_VERSION` 18 → 19) while a new in-memory Zustand store holds ephemeral search/scroll for Dashboard→Profile→Back; and sequence the four retirements (favourite_rank, Never-Contacted, birthday banner, include-Unbound) as consumer-repointing tasks, not deletions — coordinating the portable-key removal with Phase 36.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Eligible universe (populations, filters) | Database / SQLite read (`db/dashboard-read.ts`) | — | Set membership over `contacts` columns + query-time status fragments; belongs in the single read chokepoint |
| Gravity filtering | API/Business logic (`services/impact.ts`, TS) | Database (candidate id prefilter) | Gravity is derived over the interaction log in TS — not a column; cannot be a WHERE clause (Open Q1) |
| Semantic search scoring | Business logic (pure TS, `services/knowledge-search.ts`) | Database (term-free corpus read) | D-08: TS scoring over the SQL-eligible set; no FTS5, no index |
| Match descriptors / highlights | Business logic (pure TS, new) | — | Presentation-agnostic data shape both renderers bind to (UI-SPEC contract) |
| Durable prefs (view/pop/filter/sort) | Database (`app_settings`, migration 019) | Backup (Phase 36 emission) | D-03/R-16: portable settings, never AsyncStorage |
| Ephemeral session state (search text, scroll, working axes) | Client state (in-memory Zustand store) | — | DASHQ-12: survives navigation, resets on fresh launch |
| Query-state reducer (4 axes, reset) | Client state (Zustand store) | — | D-10/D-13: one shared state, each axis clearable, deterministic reset |

## Standard Stack

No new library is introduced. Everything is already a project dependency, verified present in the codebase this session.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sqlite` | (installed) | On-device SQLite; async `getAllAsync`/`getFirstAsync` only | The entire data layer; `database.ts:24` imports it [VERIFIED: src/db/database.ts:24] |
| `zustand` + `zustand/middleware` | (installed) | State stores (`persist` for durable, plain `create` for ephemeral) | The project's state-management convention (`stores/*`); `dashboard-prefs-store.ts:2-3` [VERIFIED: src/stores/dashboard-prefs-store.ts:1-3] |
| `@react-navigation/native` (`useFocusEffect`) | (installed) | Re-query on focus; the freshness path | Already the Dashboard freshness mechanism (`HomeScreen.tsx:31,230`) [VERIFIED: src/screens/HomeScreen.tsx:230-235] |

### Supporting (all in-repo modules to REUSE, not rebuild)
| Module | Path | Purpose | When to Use |
|--------|------|---------|-------------|
| Status/progress fragments | `src/db/status.ts` | `PROGRESS_SQL`, `STATUS_SQL`, `STABLE_MAX`, `STATUS_CADENCE_PRECONDITION` | Needs-Attention filter + Relationship-Status sort + Default sort. **Import, never re-type** (drift-guarded by parity tests) [VERIFIED: src/db/status.ts:40-78] |
| Knowledge scorer | `src/services/knowledge-search.ts` | `tokenize`, `boundedEditDistance`, `scoreCandidate`, `rankCandidates` | Search matching/ranking. Already matches D-08/D-09 exactly [VERIFIED: src/services/knowledge-search.ts:32-155] |
| Corpus reader | `src/db/knowledge-search-read.ts` | `listKnowledgeSearchCandidates` (name/memory/relationship/customField entries) | Search corpus; **must be scoped to eligible ids** (currently unscoped) [VERIFIED: src/db/knowledge-search-read.ts:116-172] |
| Empty-state gate | `src/logic/dashboard-empty-logic.ts` | `selectDashboardEmptyState` (cause-aware precedence) | EXTEND from filter enum to population model (UI-SPEC) [VERIFIED: src/logic/dashboard-empty-logic.ts:74-116] |
| Birthday domain | `src/logic/birthday-logic.ts` | Shared birthday-window parser (dossier §O: "continue using the shared birthday parser") | Birthdays population (next 30 days) |
| Gravity derivation | `src/services/impact.ts`, `src/services/gravity-logic.ts` | `computeContactGravity`, tiers `thin/building/solid/deep` | Gravity filter (Open Q1) [VERIFIED: src/services/impact.ts:63-101] |
| Unbound read / picker | `src/db/unbound-read.ts`, `src/db/picker-read.ts` | Unbound population + shared picker | D-07 replacement retrieval path [VERIFIED: src/db/unbound-read.ts:24-50; src/db/picker-read.ts:26-48] |
| Settings DAO | `src/db/app-settings-dao.ts` | Accessor/patch for `app_settings`; portable snapshot seam | New durable prefs (accessor + patch + allowlist; emission deferred) [VERIFIED: src/db/app-settings-dao.ts:180-207] |
| `sortExpr()` | `src/db/field-sort.ts` | Static custom-field ORDER BY over normalized value column | Required route for any future custom-field sort/filter (none in scope, but the rule stands) [VERIFIED: src/db/field-sort.ts:29-40] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OR-union in SQL (`WHERE popA OR popB`) | `UNION` of per-population SELECTs | UNION dedupes but discards per-population match reasons; a single WHERE with OR'd predicates keeps one row and lets the projection carry all reasons (dossier §D `[DERIVED]`). Recommend single-WHERE OR-union. |
| In-memory ephemeral store for nav state | React Navigation param/state persistence | Nav-param persistence is brittle for scroll offset + debounced search; a plain (non-persisted) Zustand store is the shipped idiom (`shell-transient-store.ts` precedent) and resets naturally on fresh launch. |
| Extend `knowledge-search.ts` in place | New parallel search module | A parallel module duplicates the tokenizer boundary the file explicitly guards ("the sole tokenization boundary"). Extend it. |

**Installation:** none — no `npm install`. (If the plan believes it needs a package, that is a signal to stop: this phase is composition of existing code.)

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** All modules referenced are first-party (`src/…`) or already-installed project dependencies (`expo-sqlite`, `zustand`, `@react-navigation/native`). No registry lookup required.

- Packages removed due to `[SLOP]` verdict: none
- Packages flagged as suspicious `[SUS]`: none

## Architecture Patterns

### System Architecture Diagram

```
                    ┌───────────────────────── DURABLE (survives relaunch) ─────────────────────────┐
                    │   app_settings columns (migration 019): view_mode, populations, filters, sort  │
                    │   → PORTABLE_SETTINGS_KEYS allowlist  (wire emission DEFERRED to Phase 36)      │
                    └───────────────▲──────────────────────────────────────────────┬────────────────┘
                                    │ hydrate on fresh launch          write-through │ on axis change
                                    │                                                ▼
   user input ──► Query-State Store (Zustand) ──────────────────────────────────────────────►┐
   (chips/sort)     • populations[] • filters{family:values[]} • sort • viewMode • RESET       │
                                    │                                                          │
   search box ─► Ephemeral Session Store (Zustand, in-memory) ─── search text, scroll offset ──┤
                 (NOT persisted; restored on Dashboard→Profile→Back; cleared on fresh launch)  │
                                    │                                                          │
                                    ▼                                                          ▼
        ┌─────────────────────  Shared Dashboard Read pipeline (db/dashboard-read.ts, rewritten) ─────────┐
        │  1. build ELIGIBLE UNIVERSE  = OR-union(selected populations)  [Active default if none]         │
        │     Active=BASE_WHERE · Favorites=favourite_rank NOT NULL · Birthdays · NotContacted · Snoozed   │
        │     AllContacts = Active ∪ NotContacted    (archived + unbound ALWAYS excluded)                  │
        │  2. narrow by FILTERS  = AND-across-family( OR-within-family )                                    │
        │     Category(category_id) · Battery(social_battery) · NeedsAttention(PROGRESS_SQL>=STABLE_MAX)   │
        │     Frequency(interval_days) · Gravity → NOT SQL (Open Q1)                                        │
        │  3. SORT  = resolve Default per-population, else explicit                                         │
        └───────────────────────────────────┬───────────────────────────────────────────────────────────┘
                                             │ eligible contact rows  (+ eligible id set)
                     ┌───────────────────────┴───────────────────────┐
          no term   │                                     term present│
                    ▼                                                 ▼
        ordered result set                        Search: listKnowledgeSearchCandidates(eligible ids)
        (feeds List / Card)                        → knowledge-search scorer → per-contact
                                                   match descriptors (≤3 snippets + "+N more",
                                                   highlights, priority) → relevance-primary,
                                                   current sort as tie-breaker only
                                                             │
                                                             ▼
                                             Shared Result Model  →  Empty-state gate → List / Card (26–28)
```

### Recommended Project Structure
```
src/db/dashboard-read.ts        # REWRITE: OR-union population + AND/OR filter composer (the read chokepoint)
src/db/knowledge-search-read.ts # EXTEND: accept an eligible-id scope; keep term-free corpus contract
src/services/knowledge-search.ts# EXTEND: emit match descriptors (snippet, highlight ranges, priority, totalMatchCount)
src/logic/dashboard-query-logic.ts   # NEW (pure): population/filter/sort → predicate model; Default resolution; Reset transition
src/logic/dashboard-search-match.ts  # NEW (pure): sourceKind priority mapping, ≤3 + "+N more", relevance-vs-sort tie-break
src/logic/dashboard-empty-logic.ts   # EXTEND: filter-enum → population model
src/stores/dashboard-query-store.ts  # NEW (Zustand): the 4 shared axes + reset (durable mirror to app_settings)
src/stores/dashboard-session-store.ts# NEW (Zustand, in-memory): search text + scroll offset (ephemeral)
src/db/migrations/019-dashboard-prefs.ts  # NEW: ALTER app_settings ADD COLUMN … (view/populations/filters/sort)
src/db/app-settings-dao.ts      # EXTEND: accessor + patch + allowlist for the new keys (emission deferred)
src/backup/backup-schema.ts     # EXTEND: add new keys to PORTABLE_SETTINGS_KEYS (do NOT emit / do NOT bump format)
# RETIREMENTS (consumer-repointing, sequenced):
src/stores/dashboard-prefs-store.ts  # RETIRE orbit-dashboard-prefs AsyncStorage store (R-16)
src/screens/ManageFavouritesScreen.tsx / NeverContactedScreen.tsx  # retire per D-04/D-05 (route + consumers)
src/components/BirthdayBanner.tsx    # retire per D-06/DASHQ-14
```

### Pattern 1: OR-union population + AND-across / OR-within filters (replaces the mutually-exclusive branch model)
**What:** Today `listDashboard` picks ONE of four mutually-exclusive WHERE branches (`hasTerm | favourites | snoozed | default`) — see the block comment at `dashboard-read.ts:180-198`. Phase 25 needs the eligible universe to be an **OR-union of selected populations**, then narrowed by **AND-across-family(OR-within-family)** filters, with each contact appearing once.
**When to use:** the core rewrite of `dashboard-read.ts`.
**Key rules (from disk):**
- Active predicate = keep `BASE_WHERE` **verbatim** (D-05 trip-wire): `c.archived_at IS NULL AND c.tracking_enabled = 1 AND c.last_contact IS NOT NULL AND (c.snooze_until IS NULL OR date(c.snooze_until) <= date('now','localtime'))` [VERIFIED: src/db/dashboard-read.ts:155-158].
- Never-contacted predicate = `c.archived_at IS NULL AND c.last_contact IS NULL` (+ the bound-vs-unbound clause) [VERIFIED: src/db/dashboard-read.ts:313-319]. All Contacts = `Active OR NeverContacted`.
- Archived + Unbound are **structurally excluded in every population** (`c.archived_at IS NULL`, `tracking_enabled = 1`) — All Contacts does NOT relax this (dossier §D amendment).
- Never re-derive status: a never-contacted or snoozed row must project `status`/`progress` as NULL via the CASE wrap `CASE WHEN c.tracking_enabled = 0 OR c.last_contact IS NULL THEN NULL ELSE (…) END` [VERIFIED: src/db/dashboard-read.ts:131-132] — never let `STATUS_SQL` bucket a NULL `last_contact` as `'stable'` (the HIGH-1 guard, `dashboard-read.ts:20-26`).
- Injection posture is load-bearing: every query is a static string; the only interpolated values are closed code-constants (status/threshold fragments, closed category/battery identifiers); every runtime value is `?`-bound (`dashboard-read.ts:43-51`). Preserve this exactly.

### Pattern 2: Scoped semantic search with match descriptors
**What:** The scorer and corpus reader exist but are **unwired and descriptor-less**. Phase 25 (a) scopes the corpus read to the eligible id set from Pattern 1, (b) runs the existing scorer, (c) adds a new pure module that turns matched entries into the UI-SPEC's descriptor shape.
**When to use:** the `hasTerm` path of the shared pipeline.
**Contract to produce (UI-SPEC §Search-Result Presentation Contract):** per deduped contact — `contactId`, opaque `score`, `matches[]` each `{ sourceKind, fieldLabel, snippet, highlights:[{start,length}], priority }`, `totalMatchCount`. Up to **three** highest-priority descriptors surfaced; remainder → `+{N} more`. Priority order `identity → relationship → memory-or-custom-field → note-or-body`. Relevance primary; current Dashboard sort is tie-breaker only; a name match never suppresses secondary knowledge matches.
**sourceKind mapping (from `KnowledgeSearchSource`):** `name → identity`, `relationship → relationship`, `customField → memory-or-custom-field`, memory `value`/`custom_label` → `memory-or-custom-field`, memory `note` → `note-or-body` [VERIFIED: src/db/knowledge-search-read.ts:15-19,101-108]. `fieldLabel` comes from semantic metadata (`MEMORY_TYPE_REGISTRY[type].displayName` [VERIFIED: src/db/memory-registry.ts:18-56] / custom-field def `label`), **not** a Dashboard-only hardcoded list (dossier §J).
**Reuse, do not rebuild:** the scorer already does `term===token→4, prefix→3, substring→2, editDistance≤limit→1`, per-term must-all-match, and rank by summed score [VERIFIED: src/services/knowledge-search.ts:81-141]. Exact weights are Claude's discretion (tune with fixtures).

### Pattern 3: Durable vs ephemeral state split
**What:** Two stores. Durable axes (view mode, populations, filters, sort incl. literal `'default'`) mirror to `app_settings` and survive relaunch. Ephemeral session state (search text, scroll offset) lives in a plain in-memory Zustand store, restored on Dashboard→Profile→Back and cleared on fresh launch.
**Why two:** dossier §M `[DERIVED]` "Distinguish durable Dashboard preferences from ephemeral navigation-session state." Fresh launch restores durable axes at top-of-collection with search cleared (§M); Profile→Back restores everything including scroll.
**Default-vs-explicit sort (dossier §H `[DERIVED]`):** persist the literal `'default'` sentinel, never a resolved population-specific ordering. Resolve Default → concrete ORDER BY at query-build time, per population (Active→status; Birthdays→soonest; All Contacts→status with never-contacted grouped last, mirroring the existing NULL-progress-sorts-last trick at `dashboard-read.ts:161-170`).

### Anti-Patterns to Avoid
- **Weakening `BASE_WHERE` to build All Contacts.** Union explicitly; do not drop `last_contact IS NOT NULL` (D-05 trip-wire; it is also what keeps `STATUS_SQL` safe).
- **A Gravity WHERE clause.** There is no gravity column; gravity is a TS reduction over every interaction. A SQL predicate would silently compute nothing (see Open Q1).
- **Re-typing status thresholds in the new code.** Import `PROGRESS_SQL`/`STATUS_SQL`/`STABLE_MAX` — parity tests guard against drift (`dashboard-read.ts:9-18`).
- **Persisting search text or scroll to `app_settings`/AsyncStorage.** Explicitly ephemeral (DASHQ-11).
- **Emitting the new prefs into the backup wire or bumping `BACKUP_FORMAT_VERSION` now.** Allowlist only; emission + bump are Phase 36 (mirrors the theme keys' current half-landed state, `app-settings-dao.ts:184-193`).
- **Dropping `favourite_rank`, deleting the Never-Contacted screen, or removing `include_unbound_never_contacted` unilaterally.** All have live consumers (§Runtime State Inventory) — repoint first, coordinate key removal with Phase 36.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typo-tolerant matching | A new Levenshtein / fuzzy matcher | `boundedEditDistance` + `tokenScore` in `knowledge-search.ts` | Already banded, bounded, diacritic-folding, and matches D-08's ≤1/≤2 rule exactly [VERIFIED: src/services/knowledge-search.ts:47-87] |
| Query-time status/progress | A JS status recompute or a stored column | `STATUS_SQL`/`PROGRESS_SQL` fragments | Derived-never-stored; a stored column rots with the clock (`status.ts:1-9`) |
| Gravity tiers | Inline threshold math | `computeContactGravity` + `GRAVITY_TIERS` | Owner-approved tunables; single tuning surface (`impact.ts:40-101`) |
| Birthday window | A Dashboard-only birthday calc | `birthday-logic.ts` shared parser | Dossier §O explicitly requires reuse; the legacy plugin had two off-by-one bugs this fixed |
| Corpus assembly | New SELECTs over memories/relationships | `listKnowledgeSearchCandidates` | Term-free, registry-searchable, `?`-bound; already the KNOW-10 corpus [VERIFIED: src/db/knowledge-search-read.ts:116-172] |
| Empty-state precedence | Inline count arithmetic in the screen | `selectDashboardEmptyState` (extended) | Cause-aware, node-tested; keeps arithmetic out of the render phases |
| Portable settings plumbing | A bespoke prefs table | New `app_settings` columns via the DAO accessor/patch | Single-row settings table is the shipped pattern; migration 015 shows the exact ALTER idiom |

**Key insight:** This phase's risk is *not* missing library capability — it is re-implementing things that already exist as separable, drift-guarded modules, and thereby forking the tokenizer boundary or the status fragments. Compose; don't recreate.

## Runtime State Inventory

> This is a refactor-with-retirements. A grep audit finds files; the four retirement paths below are **deletions-with-consumers**. Re-verify every cite at plan time (Review-the-code rule). Verified 2026-09-04.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `contacts.favourite_rank` (INTEGER, migration 001) still ordered/written by favourites-dao, capture/sun/merge/picker reads. `include_unbound_never_contacted` (INTEGER, migration 011) is a stored `app_settings` column read by `listNeverContacted`/`countNeverContacted`. `orbit-dashboard-prefs` AsyncStorage key holds `{sort, filter}` (device-local, non-portable). | favourite_rank: **keep the column** (D-04 trip-wire), stop using it as a *sort* key on the Dashboard, repoint widget to Default order. include_unbound: coordinate removal with Phase 36 backup bump. orbit-dashboard-prefs: superseded by `app_settings` columns; migrate intent, then retire the store. |
| **Live service config** | None — no external service holds Dashboard state (local-first, no backend). | State explicitly: None. |
| **OS-registered state** | Home-screen **widget** reads favourites via `listDashboard({filter:"favourites"})` truncated by rank (`services/widget/widget-data.ts`); `widget-quick-action-guard.ts:33` and `navigation/widget-linking.ts` route `orbit://favourites → ManageFavourites`. | Widget ordering source changes rank → Favorites-population Default order (ADR-043 consequence). Re-point or retire the `ManageFavourites` deep link (D-04). |
| **Secrets/env vars** | None. New prefs are non-secret enums; `PORTABLE_SETTINGS_KEYS` already excludes secret-shaped keys via `SECRET_SHAPED_KEY` [VERIFIED: src/backup/backup-schema.ts:168-169]. | None. |
| **Build artifacts** | None. | None. |

### The four retirement paths (each a trip-wire — sequence as consumer-repointing, not deletion)

1. **`favourite_rank` sort + Manage-favourites (D-04, ADR-075).** Consumers of the column that still ORDER BY it: `db/favourites-dao.ts` (rewriteFavouriteRanks / setFavouriteRank), `db/capture-read.ts:65-66`, `db/sun-picker-read.ts:45`, `db/merge-candidate-read.ts:29`, `db/picker-read.ts:34-45` (membership-flag order — note `picker-read.ts:5-7` already says "used only as a membership flag … order … is interaction recency then name (ADR-075)"), `services/widget/widget-data.ts:75`. Screen: `ManageFavouritesScreen.tsx` + route in `navigation/tabs/DashboardStack.tsx:68-69` + `navigation/types.ts:75`. **Do not drop the column**; the Dashboard just stops sorting by it and the widget uses Default order. Manage-favourites screen + `rewriteFavouriteRanks` retire; capture/sun/merge picker reads either keep rank ordering internally (harmless) or fall back to Default — this is an owner-visible fate decision, name it in the plan.
2. **Never Contacted screen + `include_unbound_never_contacted` (D-05, ADR-011).** Consumers: `db/dashboard-read.ts:278-360` (`listNeverContacted`/`countNeverContacted`/`readIncludeUnboundNeverContacted`), `screens/NeverContactedScreen.tsx`, footer entry `HomeScreen.tsx:417`, `screens/DigestScreen.tsx:163` (onPressBacklog → NeverContacted) and `DigestScreen.tsx:100` (`countNeverContacted`), Settings toggle `SettingsScreen.tsx:1170-1174`, route `DashboardStack.tsx:65` + `navigation/types.ts:65`, portable key `backup-schema.ts:89-90,153`, DAO fields `app-settings-dao.ts:82,182,251,275,322,356,387-526`, forward-migration seed `backup-schema.ts:88-91`. **`countNeverContacted` still has a live consumer in Digest** — the Not-Contacted *population* replaces the *screen*, but the count read may need to survive for Digest. Coordinate the portable-key removal with Phase 36's format bump (do not delete the allowlist entry now).
3. **Birthday banner (D-06, DASHQ-14, ADR-076).** Consumers: `components/BirthdayBanner.tsx`, mounted at `HomeScreen.tsx:321` (`<BirthdayBanner onPressContact={goToProfile} />`), reads `listBirthdayCandidates` (`dashboard-read.ts:391-399`). **Coverage gap to note (D-06):** Digest has no birthday read at all today (planning-notes E-04). If the banner is removed while Your Week (deferred) is unplanned, record the coverage gap in the plan rather than silently dropping the surface. `listBirthdayCandidates` also feeds `notification-read.ts` — verify before touching it.
4. **Unbound removed from Dashboard search → replacement path (D-07, ADR-062, R-11).** Today search returns Unbound as neutral retrieval rows (`dashboard-search-row-logic.ts:8-18`, rendered `HomeScreen.tsx:558-595`). After scoping search to Bound eligible contacts, Unbound loses its only name-lookup path. Provide a replacement: give `UnboundContactsScreen.tsx` its own search (it currently has none — only `listUnbound` [VERIFIED: src/screens/UnboundContactsScreen.tsx:6,30]), **or** add Unbound to the shared picker's explicit-search path (`picker-read.ts`). Coordinate with Phase 26 R-11. Removing without a replacement is a stop-and-ask.

**Nothing found in category:** Live service config, Secrets/env, Build artifacts — verified None as noted above.

## Common Pitfalls

### Pitfall 1: NULL last_contact bucketed as 'stable'
**What goes wrong:** `STATUS_SQL` has no NULL branch — over a NULL `last_contact` every comparison is false and the ELSE labels the row `'stable'`.
**Why it happens:** never-contacted (All Contacts / Not Contacted populations) and snoozed rows have no valid cadence status.
**How to avoid:** wrap every status/progress projection in `CASE WHEN c.tracking_enabled = 0 OR c.last_contact IS NULL THEN NULL ELSE (…) END` (the shipped `CARD_STATUS`, `dashboard-read.ts:131-132`); for the never-contacted branch select literal `NULL AS status`.
**Warning signs:** a never-contacted contact rendering a green/"Stable" ring in List/Card.

### Pitfall 2: Timezone double-conversion on stored dates
**What goes wrong:** re-running a stored local column through `'localtime'` shifts a late-night value a calendar day early.
**Why it happens:** `last_contact`/`snooze_until` are already local wall-clock; only `now` is UTC.
**How to avoid:** `date('now','localtime')` for now; **bare** `date(col)` for stored columns (`dashboard-read.ts:28-31`, `status.ts:44-59`). Use `formatLocalDate()` for any JS-side date; never `toISOString().split`.

### Pitfall 3: Gravity filter silently matches nothing
**What goes wrong:** a `WHERE gravity_tier = ?` clause compiles against a non-existent column or a mis-assumed one and returns empty/garbage.
**Why it happens:** Gravity is derived in TS over the whole interaction log (`impact.ts`/`gravity-logic.ts`), not stored.
**How to avoid:** resolve Gravity as a **post-query TS filter** over candidate ids (like search scoring) or make an explicit owner decision on a cached column (Open Q1). Do not add it to the SQL WHERE.
**Warning signs:** Gravity filter always empty, or performance cliff from N per-contact interaction reads.

### Pitfall 4: Deduplication drops population-match reasons
**What goes wrong:** using `UNION` collapses duplicates but loses which populations a contact belongs to.
**Why it happens:** dossier §D `[DERIVED]` wants the deduped row to *retain* all population-match reasons.
**How to avoid:** single WHERE with OR'd population predicates + a projection that flags membership, not a `UNION` of SELECTs.

### Pitfall 5: Freshness — the connection-scoped change notification is blind to cross-connection writes
**What goes wrong:** subscribing to SQLite's change notification misses headless widget / notification "mark contacted" writes on a different connection.
**How to avoid:** keep the shipped freshness triad — `useFocusEffect` + `AppState`→active + pull-to-refresh + the `useShellRefresh` in-process tick (`HomeScreen.tsx:12-15,227-262`). The new engine must preserve these entry points.

### Pitfall 6: Re-scattering ADR graph nodes / editing shipped migrations
**What goes wrong:** editing migration 001/011/015 to "add" a column, or renumbering.
**How to avoid:** new migration **019** only, `ADD COLUMN … NOT NULL DEFAULT …` (the migration-015 idiom, `ALTER TABLE app_settings ADD COLUMN … DEFAULT …` [VERIFIED: src/db/migrations/015-theme-settings.ts:31-46]); bump `TARGET_VERSION` 18 → 19 and register in the `MIGRATIONS` array (`database.ts:53-75`). A single-row DEFAULT fills the existing id=1 row — no separate UPDATE needed.

## Code Examples

### The Active predicate to preserve verbatim (D-05 trip-wire)
```ts
// Source: src/db/dashboard-read.ts:155-158  [VERIFIED]
const BASE_WHERE = `c.archived_at IS NULL
     AND ${DASHBOARD_BOUND_WHERE}                 // "c.tracking_enabled = 1"
     AND c.last_contact IS NOT NULL
     AND (c.snooze_until IS NULL OR date(c.snooze_until) <= date('now','localtime'))`;
```

### The status/progress fragments to import (never re-type)
```ts
// Source: src/db/status.ts:59-78  [VERIFIED]
export const PROGRESS_SQL = `CAST(julianday(date('now','localtime')) - julianday(date(last_contact)) AS REAL) / interval_days`;
export const STATUS_SQL = `CASE
    WHEN rarely_responds = 1 AND (${PROGRESS_SQL}) >= ${WOBBLE_MAX} THEN 'rogue'
    WHEN (${PROGRESS_SQL}) >= ${ROGUE_K}    THEN 'rogue'
    WHEN (${PROGRESS_SQL}) >= ${WOBBLE_MAX} THEN 'decay'
    WHEN (${PROGRESS_SQL}) >= ${STABLE_MAX} THEN 'wobble'
    ELSE 'stable'
  END`;
// STABLE_MAX = 0.8  → Needs-Attention filter = `(${PROGRESS_SQL}) >= ${STABLE_MAX}`
// (matches the shipped needs-attention branch, dashboard-read.ts:253-255)
```

### The scorer already implements D-08's typo rule (reuse)
```ts
// Source: src/services/knowledge-search.ts:81-87  [VERIFIED]
function tokenScore(term: string, token: string): number | null {
  if (term === token) return 4;
  if (token.startsWith(term)) return 3;
  if (token.includes(term)) return 2;
  const limit = term.length >= 6 ? 2 : 1;      // ≤2 for 6+ char terms, else ≤1  (D-08)
  return boundedEditDistance(term, token, limit) <= limit ? 1 : null;
}
```

### The corpus reader source kinds to map into descriptor sourceKind
```ts
// Source: src/db/knowledge-search-read.ts:15-19  [VERIFIED]
export type KnowledgeSearchSource = "name" | "memory" | "relationship" | "customField";
// name→identity · relationship→relationship · customField & memory value/label→memory-or-custom-field · memory note→note-or-body
// NOTE: this reader currently reads ALL contacts (LIST_CONTACTS = "SELECT id, name FROM contacts ORDER BY id",
//       knowledge-search-read.ts:56-59) — Phase 25 must scope it to the eligible id set (no archived/unbound).
```

### The migration ALTER idiom + version registration
```ts
// Source: src/db/migrations/015-theme-settings.ts:31-46  [VERIFIED]
ALTER TABLE app_settings ADD COLUMN theme_package TEXT NOT NULL DEFAULT 'galaxy'
  CHECK(theme_package IN ('galaxy', 'standard'));
// Phase 25 → migration 019 (ALTER app_settings ADD COLUMN for view/populations/filters/sort),
// then bump TARGET_VERSION 18→19 (database.ts:53) and append migration019 to MIGRATIONS (database.ts:56-75).
```

### The staged "allowlist now, emit later" pattern for portable prefs
```ts
// Source: src/backup/backup-schema.ts:155-166  [VERIFIED] — theme keys allowlisted, NOT emitted
// "allowlisted NOW so a future format-4 backup that CARRIES them is accepted … NOT emitted by
//  getPortableSettingsSnapshot this phase (emission + BACKUP_FORMAT_VERSION bump + FORWARD_MIGRATIONS
//  entry are Phase 36 / owner scope)."
// Source: src/db/app-settings-dao.ts:184-193  [VERIFIED] — declare the new keys OPTIONAL (?:) so a
// snapshot return that OMITS them still typechecks; do NOT add them to getPortableSettingsSnapshot's SELECT.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-population, single-filter `listDashboard` (4 exclusive branches) | OR-union populations + AND/OR filters (this phase) | Phase 25 | Core `dashboard-read.ts` rewrite |
| LIKE-only name/fuel search ordered by active sort (`dashboard-read.ts:230-240` shipped path) | TS scoring over eligible knowledge corpus, relevance-primary (D-08/D-09) | Phase 24.2 built scorer; Phase 25 wires it | Fuel is no longer a KNOW-10 search source (`knowledge-search-read.ts:6-8`) |
| `orbit-dashboard-prefs` AsyncStorage `{sort,filter}` | `app_settings` columns, backup-portable | Phase 25 (columns) + Phase 36 (emission) | Prefs survive backup/restore |
| Ranked favourites (ADR-033) | Binary favourites (ADR-075) | audit 2026-09-01 | Rank column kept but not sorted on |
| Dashboard birthday banner (ADR-034) | Birthdays population only (ADR-076) | audit 2026-09-01 | Banner retired; Your Week owns richer view |

**Deprecated/outdated:** `dashboard-prefs-store.ts` (AsyncStorage) — superseded by durable columns; the shipped comment "It is therefore AsyncStorage, not a SQLite row" (`dashboard-prefs-store.ts:9-12`) is reversed by R-16. `dashboard-search-row-logic.ts` (Unbound-in-search retrieval rows) — superseded by D-07's scoping + replacement path.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Durable prefs need columns for view mode + populations + filters + sort; filters ARE durable because DASHQ-11 lists "filters … persist across relaunch". Exact serialization (delimited TEXT vs per-family columns vs JSON TEXT) is Claude's discretion. | Pattern 3 / schema | Wrong serialization → migration churn (but forward-only, so an extra column is cheap; a wrong *shape* is not). Confirm column layout at plan/discuss time. |
| A2 | The Gravity filter should be a post-query TS filter over candidate ids rather than a new cached column. | Open Q1 | A cached-column approach is an owner-bucket perf/complexity decision (`impact.ts:11-13` names it as the fallback "if gravity ever profiles as expensive"). Must be raised, not assumed. |
| A3 | `countNeverContacted` survives (for Digest) even as the Never-Contacted *screen* retires. | Runtime Inventory #2 | If Digest's backlog surface is also being retired elsewhere, the count read may be fully removable — verify against Digest phase scope. |
| A4 | Ephemeral nav state should be a plain in-memory Zustand store (not React Navigation param persistence). | Pattern 3 | If the app already restores scroll via a different mechanism, duplicating it could conflict. `shell-transient-store.ts` is cited as precedent but was not read in full this session. |
| A5 | The `note-or-body` sourceKind maps to a memory `note`; there is no separate "body" corpus (fuel excluded). | Pattern 2 | If a future corpus adds long-form notes, the mapping widens — low risk this phase. |

**If this table looks large:** these are genuine forks a planner/owner must confirm; none is a silent assumption presented as fact.

## Open Questions (RESOLVED)

> All four resolved during Phase 25 planning (2026-09-04). The guarded risk — an unresolved decision leaking into execution — does not exist: each is answered in a plan, as noted inline below.

1. **Gravity/Closeness filter mechanism (DASHQ-06).** — **RESOLVED → Plan 25-03:** reversible post-query TS filter over candidate ids (reusing `computeContactGravity`/`GRAVITY_TIERS`), no cached column. Recorded as an explicit `<assumption>` with a Manual-Only Pixel perf gate; a cached column stays an owner one-way-door decision only if it profiles badly.
   - What we know: Gravity is derived in TS over the full interaction log via `computeContactGravity` (`impact.ts:88-101`) into tiers `thin/building/solid/deep` (`impact.ts:63-68`). There is **no gravity column** in `contacts` (verified: schema `001-initial.ts:61-82` has none; grep for gravity/closeness columns returned nothing).
   - What's unclear: whether to (a) resolve the Gravity filter as a **post-query TS pass** over candidate ids (batch-read each candidate's interactions, compute tier, filter) — simple but O(interactions) per filtered query, assessable for perf only on the physical Pixel; or (b) introduce a **cached gravity column with a single writer** — the explicit fallback `impact.ts:11-13` names, but that is new derived-state storage and a **risk/architecture decision in the owner's bucket**.
   - Recommendation: default to (a) for this phase (no new stored derived state, honors derived-never-stored), and **flag the perf/complexity fork to the owner** at discuss/plan. Do not add a gravity column without owner sign-off.

2. **Filter durability serialization (A1).** — **RESOLVED → Plan 25-01:** locked via a `checkpoint:decision` to the four-column JSON-TEXT shape; the durable set is exactly view/populations/filters/sort (search text + scroll explicitly excluded).

3. **Fate of the rank-ordered picker/sun/merge/capture reads (D-04).** — **RESOLVED → Plan 25-06:** keep internal rank ordering in `capture-read`/`sun-picker-read`/`merge-candidate-read`/`picker-read` (harmless, column stays per the D-04 trip-wire); only the Dashboard/widget stop ordering by rank.

4. **Digest coupling (D-05/D-06).** — **RESOLVED → Plan 25-07:** `countNeverContacted` is kept so Digest's count still reads; the Your-Week birthday coverage gap is recorded as a `flagged-unverified` prohibition, not silently dropped.

## Environment Availability

> This phase is code + schema only — no new external tool/service dependency. All runtime deps are already installed and exercised by the existing app.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-sqlite` | data layer | ✓ (imported `database.ts:24`) | project-pinned | — |
| `zustand` | state stores | ✓ (`dashboard-prefs-store.ts`) | project-pinned | — |
| Node 24 (tests) | vitest node-side proofs | ✓ (MEMORY: installed to /usr/local/bin) | 24.x | re-probe if codex sandbox regresses to v18 |
| Contact Knowledge corpus (migrations 016/017, memories/relationships/custom values) | search corpus (D-08) | ✓ landed (migrations 016/017 registered `database.ts:40-41`) | schema v16/17 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

> `nyquist_validation` not explicitly disabled → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (node-side), co-located `*.test.ts` beside every DAO/logic module |
| Config file | present (project uses vitest; every `src/db/*.ts` has a `.test.ts` sibling) |
| Quick run command | `npx vitest run src/db/dashboard-read.test.ts src/services/knowledge-search.test.ts` |
| Full suite command | `npx vitest run` (+ `npm run check` for biome/tsc, `npm run check:colors`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASHQ-01/02/03 | OR-union populations, dedupe, All Contacts = Active ∪ NotContacted, archived/unbound excluded | unit (in-memory SQLite via `__testkit__`) | `npx vitest run src/db/dashboard-read.test.ts` | ✅ exists (extend) |
| DASHQ-04/05 | Favorites binary membership; Snoozed in Active but out of Needs-Attention | unit | `npx vitest run src/db/dashboard-read.test.ts` | ✅ |
| DASHQ-06/07 | OR-within/AND-across filters; Default population-aware; explicit sort survives | unit | `npx vitest run src/logic/dashboard-query-logic.test.ts` | ❌ Wave 0 (new pure module) |
| DASHQ-08/09/10 | Scoped search, relevance-primary, ≤3 snippets + "+N more", identity priority, name doesn't suppress secondary | unit | `npx vitest run src/services/knowledge-search.test.ts src/logic/dashboard-search-match.test.ts` | ⚠️ scorer test exists; descriptor test ❌ Wave 0 |
| DASHQ-11 | Durable prefs round-trip through `app_settings`; search/scroll NOT persisted | unit | `npx vitest run src/db/app-settings-dao.test.ts src/db/migrations/019-dashboard-prefs.test.ts` | ❌ Wave 0 (new migration) |
| DASHQ-12 | Ephemeral session restore on Dashboard→Profile→Back | unit (store) + on-device UAT | `npx vitest run src/stores/dashboard-session-store.test.ts` | ❌ Wave 0 |
| DASHQ-13 | Reset restores 4 axes, preserves List/Card | unit | `npx vitest run src/logic/dashboard-query-logic.test.ts` | ❌ Wave 0 |
| DASHQ-14 | Birthday banner gone; population remains | unit + on-device UAT | migration/consumer tests | partial |
| — | Migration chain integrity to v19 | unit | `npx vitest run src/db/migrations/full-chain.test.ts` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** the quick run for the touched module + `npm run check` (biome + tsc).
- **Per wave merge:** `npx vitest run` full suite + `npm run check:colors`.
- **Phase gate:** full suite green + on-device UAT on the Pixel (search relevance + Profile→Back restore + retirement smoke) before `/gsd-verify-work`. Search perf and the Gravity filter (Open Q1) are **assessable only on the physical Pixel**, never the (absent) emulator.

### Wave 0 Gaps
- [ ] `src/logic/dashboard-query-logic.test.ts` — populations/filters/sort predicate model + Reset (DASHQ-06/07/13)
- [ ] `src/logic/dashboard-search-match.test.ts` — descriptor priority, ≤3 + "+N more", relevance-vs-sort tie-break (DASHQ-10)
- [ ] `src/db/migrations/019-dashboard-prefs.test.ts` — ALTER + defaults + v18→v19 jump (DASHQ-11)
- [ ] `src/stores/dashboard-session-store.test.ts` — ephemeral restore/clear semantics (DASHQ-12)
- [ ] Extend `src/db/dashboard-read.test.ts`, `src/db/app-settings-dao.test.ts`, `src/logic/dashboard-empty-logic.test.ts`, `src/db/migrations/full-chain.test.ts`

## Security Domain

> `security_enforcement` not disabled → included. This is a local-first, no-network read/state phase — the threat surface is data-scope and injection, not auth/session.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts, no auth (local-first, single device) |
| V3 Session Management | no | No server session |
| V4 Access Control | yes (data-scope) | Archived/Unbound/off-limits rows excluded **in-query**, never by a UI `.filter()` (`dashboard-read.ts:43-51`); search must not leak them (D-09) |
| V5 Input Validation | yes | Search term + filter identifiers are `?`-bound; queries are static strings with only closed code-constants interpolated (`dashboard-read.ts:43-51`) |
| V6 Cryptography | no | No secrets touched; new prefs are non-secret enums; `SECRET_SHAPED_KEY` guards the portable allowlist |

### Known Threat Patterns for SQLite + local RN
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via search term / filter value | Tampering | Parameterized `?` binds; never interpolate runtime values; `escapeLike` for LIKE (existing posture) |
| Private-data leak into search results | Information disclosure | Scope corpus to eligible Bound, non-archived contacts; never surface archived/unbound (D-09); off-limits/unconfirmed-AI excluded in corpus/query |
| Portable-settings exfiltration of secret-shaped keys | Information disclosure | `PORTABLE_SETTINGS_KEYS` + `SECRET_SHAPED_KEY` reject on export (`backup-schema.ts:187-197`) — new keys are plain enums |
| Network on read path | (local-first violation) | No network anywhere in the read pipeline; offline render required |

## Sources

### Primary (HIGH confidence — read from disk this session)
- `src/db/dashboard-read.ts` — the read chokepoint being rewritten (BASE_WHERE, branches, CARD_STATUS, never-contacted, favourites, birthday, counts)
- `src/db/database.ts` — migration registry, `TARGET_VERSION = 18`, PRAGMA order
- `src/db/status.ts`, `src/services/impact.ts`, `src/services/gravity-logic.ts` — derived status + gravity
- `src/services/knowledge-search.ts`, `src/db/knowledge-search-read.ts` — the built-but-unwired search scorer + corpus
- `src/backup/backup-schema.ts`, `src/db/app-settings-dao.ts`, `src/db/migrations/002-app-settings.ts`, `src/db/migrations/015-theme-settings.ts`, `src/db/migrations/018-custom-field-scope-history.ts`, `src/db/migrations/001-initial.ts`, `src/db/migrations/011-contact-lifecycle-schema.ts` — portable settings + migration idioms + schema
- `src/logic/dashboard-empty-logic.ts`, `src/screens/HomeScreen.tsx`, `src/screens/dashboard-search-row-logic.ts`, `src/db/field-sort.ts`, `src/db/picker-read.ts`, `src/db/unbound-read.ts`, `src/db/memory-registry.ts`, `src/db/orrery-read.ts`, `src/types.ts` — consumers, patterns, filter columns
- Grep sweeps for `favourite_rank`, `NeverContacted`/`include_unbound_never_contacted`, `BirthdayBanner`, gravity columns, knowledge-search consumers
- `docs/dossier/milestone-2/phase-04-dashboard-data-state-foundation-dossier.md` + `planning-notes/phase-04-planning-notes.md` (ground truth), `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (§Phase 25), `25-CONTEXT.md`, `25-UI-SPEC.md`

### Secondary / Tertiary
- None — no web search or external docs were needed; the domain is entirely in-repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module read from disk; no external package.
- Architecture: HIGH — the rewrite target, the reusable pieces, and the retirement consumers are all concretely located and quoted.
- Pitfalls: HIGH — drawn from the shipped code's own guard comments (HIGH-1 status NULL, timezone, injection).
- Gravity filter mechanism: MEDIUM — the *fact* (no column, TS-derived) is HIGH; the *recommendation* (post-query TS filter vs cached column) is an owner-bucket fork (Open Q1 / A2).

**Research date:** 2026-09-04
**Valid until:** ~2026-10-04 for the in-repo facts, but re-verify the migration head (`TARGET_VERSION`) and every retirement cite at plan time — schema numbers and consumers drift every schema phase (MEMORY: migration-005/006 renumber lesson).
</content>
</invoke>
