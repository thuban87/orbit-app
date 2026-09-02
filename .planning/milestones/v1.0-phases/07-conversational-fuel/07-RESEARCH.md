# Phase 7: Conversational Fuel - Research

**Researched:** 2026-08-15
**Domain:** Local-first per-item data (SQLite DAO + query-time projection + RN profile editor)
**Confidence:** HIGH — every claim verified first-hand against files on disk; no external dependencies, no web/registry lookups needed.

## Summary

Phase 7 is a pure-in-repo phase: the `fuel` TABLE already exists (migration 1, `src/db/migrations/001-initial.ts:167-179`) with every un-backfillable column FUEL-01 needs (`uid`, `contact_id NOT NULL`, `kind`, `label`, `text`, `url`, `created_at`, `source`, `modified_at`). **No new migration is needed — confirmed.** Purge already deletes fuel explicitly (`src/db/purge-dao.ts:188`) and `computeImpact`/`impactSummaryLines` already count fuel items (`purge-dao.ts:103-107, 149-151`). So the CRUD-06 fan-out and impact summary are done; Phase 7 adds only the writer, the read projections, and the UI.

The work is four correctness-critical seams plus a profile editor and a search predicate, all built on patterns this repo has already settled six times over: a `*Core`/mutexed-wrapper DAO (`events-dao.ts`, `recency-dao.ts`), `?`-bound SQL through the single `inWriteTransaction` (`transaction.ts`), pure node-tested logic modules over `node:sqlite` (`gravity-logic.ts`, `intensity-logic.ts`), and a list-editor screen (`CustomFieldsScreen.tsx` + `FieldDefForm`). The single hazardous novelty is the **`off_limits` structural exclusion**: it must be a SQL predicate inside the one shared ranked projection (and the search query), never a UI-side `.filter()`, so it cannot leak to any glanceable surface or the AI prompt.

**Primary recommendation:** Build a `fuel-dao.ts` (add/edit/delete, `*Core` + mutexed wrappers, `?`-bound) + a pure `fuel-ranking.ts` logic module (kind-priority-then-recency ordering with `off_limits` structurally absent) + a `fuel-read.ts` (ranked projection SQL + cross-contact search SQL, both excluding `off_limits` in-query) + a `fuel-age.ts` pure "N days/months ago" formatter (local wall-clock, never `toISOString`) + a `FuelEditor` profile section. Node-test the ranking, the age math, the search predicate, and the `off_limits`/`source='ai'` exclusions. Ship the search QUERY here; the search BOX UI is Phase 8 (dossier's lead).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fuel item persistence (add/edit/delete) | Database / DAO (`src/db`) | — | All writes go through DAOs, never inline (CLAUDE.md); serialized via `inWriteTransaction` |
| Single ranked projection | Database / query-time derivation | Pure logic (`src/services` or `src/db`) | Mirrors status/gravity: derived-never-stored, one source of truth reused by many surfaces |
| `off_limits` exclusion | Database (SQL predicate) | — | Must be structural (in-query) so it cannot leak to a glanceable line or the AI prompt |
| Fuel age "N days/months ago" | Pure logic (node-tested) | UI render (profile) | Local wall-clock math; drives ranking recency + display, never destroys data |
| Cross-contact search | Database (`LIKE` scan) | UI (Phase 8 dashboard box) | Query ships here; the search box is the Phase-8 dashboard search surface |
| `source='ai'` unconfirmed state | Database (column semantics) + UI (render) | Prompt assembly (Phase 14) | Rendered unconfirmed on profile; excluded from prompt query until confirmed |
| Profile fuel editor | Screen / component (`src/components`, `src/screens`) | DAO | List-editor pattern from `CustomFieldsScreen` |

## Standard Stack

No new libraries. Everything is already in the repo and proven across Phases 1–6.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sqlite` | SDK 57 (installed) | On-device DB; DAOs call it via the `SqlExecutor` adapter | Already the sole data layer (`database.ts`) `[VERIFIED: src/db/database.ts]` |
| `node:sqlite` | Node built-in (SQLite 3.51.2) | Node-side unit harness for every SQL string / pure logic | The repo's entire DB test convention `[VERIFIED: src/db/__testkit__/node-sqlite.ts]` |
| `react-native` / Expo RN | SDK 57 | The profile editor UI primitives | Existing screen/component stack `[VERIFIED: src/screens/*]` |
| `vitest` | installed | Test runner for `.test.ts` node suites | Every `src/**/*.test.ts` uses it `[VERIFIED]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/db/uid` `newUid()` | in-repo | Mint the per-row merge `uid` on INSERT | Every fuel INSERT (mergeable table) `[VERIFIED: src/db/uid.ts]` |
| `@/db/database` `localDateTime()` | in-repo | Local wall-clock `YYYY-MM-DD HH:MM:SS` for `created_at`/`modified_at` | Every write timestamp `[VERIFIED: database.ts:45]` |
| `@/utils/dates` `formatLocalDate()` | in-repo | Local `YYYY-MM-DD`; the age-math base | Age display + any date math `[VERIFIED: dates.ts:17]` |
| `@/db/transaction` `inWriteTransaction` | in-repo | The ONE shared non-reentrant write mutex+txn | Every fuel write `[VERIFIED: transaction.ts:42]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `LIKE` scan search | FTS5 virtual table | **[REJECTED by dossier Cluster F]** — FTS5 is compiled into the vendored SQLite (3.50.3) but is real complexity (triggers, sync-on-write) for tens of contacts × tens of items. Deferred to v2. |
| Query-time ranked projection | Stored `rank`/`sort_order` column | **[REJECTED: dossier "Decisions made without you" #3]** — no `pinned`/`sort_order` column in v1; ranking is derived, mirroring status/gravity being derived-never-stored. |

**Installation:** None. `npm install` adds nothing this phase.

## Package Legitimacy Audit

**No external packages are installed in this phase.** All code is in-repo TypeScript over `expo-sqlite` and `react-native`, both already present since Phase 1. The Package Legitimacy Gate is N/A.

- **Packages removed due to [SLOP] verdict:** none
- **Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────┐
   Profile screen  ──add/edit/delete──▶  fuel-dao.ts (writer)        │
   (FuelEditor)    ◀──list all incl. off_limits──  fuel-read.ts      │
                          │   INSERT/UPDATE/DELETE via                │
                          │   inWriteTransaction (?-bound, uid, now)  │
                          ▼                                           │
                    ┌──────────────┐                                 │
                    │  fuel table  │  (migration 1 — already exists) │
                    └──────┬───────┘                                 │
                           │ read paths                              │
        ┌──────────────────┼───────────────────────┬────────────────┤
        ▼                  ▼                        ▼                │
  RANKED PROJECTION   CROSS-CONTACT SEARCH    PROFILE LIST READ      │
  (fuel-read +        (fuel-read, LIKE,       (all kinds, incl.      │
   fuel-ranking)       off_limits EXCLUDED    off_limits — the ONLY  │
   off_limits          in-query, name OR       read that surfaces it)│
   EXCLUDED in-query    fuel text)                                   │
        │                  │                                         │
        │ head [0]         │ rows                                    │
        ▼                  ▼                                         │
  card preview (Ph8)   dashboard search box (Ph8)                    │
  notification line (Ph11)                                           │
  widget line (Ph12)                                                 │
  compose full list (Ph9)   ◀── same ranked ordering, off_limits out │
  AI prompt fuel (Ph14)     ◀── ranked + off_limits out + source='ai'-unconfirmed out
                          └─────────────────────────────────────────┘
```

The load-bearing structural fact: **`off_limits` is filtered by a `WHERE kind != 'off_limits'` predicate in exactly the shared read functions**, so every downstream glanceable/transmitted surface inherits the exclusion for free. Only the profile editor's list read omits that predicate (you must be able to edit an off_limits item).

### Recommended Project Structure
```
src/db/
├── fuel-dao.ts          # add/edit/delete — *Core + mutexed wrappers, ?-bound
├── fuel-dao.test.ts     # node:sqlite behavioural proof
├── fuel-read.ts         # ranked projection SQL + search SQL (off_limits excluded in-query) + profile list read
├── fuel-read.test.ts    # node:sqlite: exclusion, ordering, search predicate, source='ai' gating
src/services/
├── fuel-ranking.ts      # PURE kind-priority-then-recency comparator + kind-priority tunable (top-of-file)
├── fuel-ranking.test.ts
├── fuel-age.ts          # PURE "N days/months ago" from created_at (local math)
├── fuel-age.test.ts
src/components/
├── FuelEditor.tsx       # profile section: list by kind + add/edit/delete + kind picker + optional label + url + unconfirmed state
├── FuelItemForm.tsx     # (optional split) the add/edit form — mirrors FieldDefForm
src/screens/
└── ContactProfileScreen.tsx  # MOUNT the FuelEditor + the top-ranked line (edit in place)
```

### Pattern 1: The `*Core` + mutexed-wrapper DAO
**What:** Each write op has a non-mutexed `xCore(exec, ...)` (assumes BEGIN open) and a public `x(exec, ...)` that wraps it in one `inWriteTransaction`. Compose by calling cores inside one outer transaction — NEVER nest `inWriteTransaction` (permanent hang).
**When to use:** Every fuel write. Multi-attach from capture (Phase 10) will need the core to write N rows in one txn — provide the core now.
**Example:**
```typescript
// Source: src/db/events-dao.ts:62-93 (verbatim pattern)
export async function addFuelCore(exec: SqlExecutor, input: NewFuelItem): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO fuel (uid, contact_id, kind, label, text, url, created_at, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.uid, input.contactId, input.kind, input.label ?? null, input.text ?? null,
     input.url ?? null, input.createdAt, input.source, input.now],
  );
  return result.lastInsertRowId;
}
export function addFuel(exec: SqlExecutor, input: NewFuelItem): Promise<number> {
  return inWriteTransaction(exec, () => addFuelCore(exec, input));
}
```

### Pattern 2: The single ranked projection (kind priority THEN recency)
**What:** ONE ordering rule, reused by card/notification/widget/compose/AI. Precedence is strictly kind-first: newest `recent`, else `gift`, else `topic`, else `fact`. `off_limits` is excluded in-query.
**Exact rule (from dossier Cluster D `03-fuel.md:240-251`):** kind priority order = `recent (0) > gift (1) > topic (2) > fact (3)`; within a kind, newest `created_at` wins. A `recent` from last week outranks a `fact` from yesterday (the explicitly-rejected "newest regardless of kind"). Put the priority array at top-of-file as a tunable (CLAUDE.md).
**When to use:** Any glanceable/transmitted surface takes `ranked[0]`; compose/AI take the whole ranked list (off_limits still out).
**Example (SQL ordering — do it in SQL so the index backs it):**
```sql
-- kind rank via CASE; off_limits excluded structurally.
SELECT id, contact_id, kind, label, text, url, created_at, source
  FROM fuel
 WHERE contact_id = ? AND kind != 'off_limits'
 ORDER BY CASE kind WHEN 'recent' THEN 0 WHEN 'gift' THEN 1
                    WHEN 'topic' THEN 2 WHEN 'fact' THEN 3 ELSE 4 END,
          created_at DESC, id DESC
```
Keep the `CASE` mapping in sync with the top-of-file `FUEL_KIND_PRIORITY` tunable (a pure `fuel-ranking.ts` comparator that node-tests the same order; the SQL and the pure comparator must agree — assert it in a test).
*Index note (dossier "Deferred to planning" `03-fuel.md:441`):* consider `CREATE INDEX idx_fuel_ranking ON fuel (contact_id, kind, created_at DESC)`. CLAUDE.md's index ban is scoped to `contact_custom_values` ONLY — indexing `fuel` is allowed. **But this is a schema touch:** migration 1 is shipped, so a new index must be a NEW forward-only migration 2 (do not edit migration 1). Given the tens-of-rows scale, an index is optional; the planner should decide whether it earns a migration. If added, it is forward-only and irreversible-safe (index create is trivially safe).

### Pattern 3: `off_limits` structural exclusion
**What:** `WHERE kind != 'off_limits'` lives in the shared read functions (ranked projection + search), not in any component. The AI prompt (Phase 14) consumes the ranked projection, so it inherits the exclusion; additionally `off_limits` must be absent from the placeholder resolver's search space (Phase 14 concern, note it).
**Anti-pattern:** filtering off_limits in `FuelEditor` / the card component with `.filter(i => i.kind !== 'off_limits')`. A second read path that forgets the filter leaks private notes to a glanceable surface — exactly the plugin's live bug F4 (`03-fuel.md:514-518`).
**Warning sign:** any `getAllAsync` over `fuel` in a component; any fuel read that does not go through `fuel-read.ts`.

### Pattern 4: Pure logic module, node-tested
**What:** Correctness-critical math (ranking comparator, age formatter, search-input normalization) lives in a react-native-free `.ts` with a sibling `.test.ts` run under `node:sqlite`/vitest. UI `.tsx` stays a thin renderer.
**Example:** `gravity-logic.ts` / `intensity-logic.ts` — pure, injected tunables, local-wall-clock parsing (`parseLocalMs`, `gravity-logic.ts:82-98`) reused for fuel age.

### Anti-Patterns to Avoid
- **Using `Contact.fuel?: string[]`** (`src/types.ts:88`) — this is the ported-plugin CACHED BLOB field, the REJECTED "one text blob per contact" design (`03-fuel.md:38-40`). It is dead (the F11 dead-cache branch). Phase 7's model is per-item DB rows; never read/write this field.
- **`{{Conversational Fuel}}` placeholder in `AiService.ts:31-39`** — the ported plugin prompt template. Phase 14 rebuilds prompt assembly from the ranked projection; do not wire fuel into AiService this phase.
- **UI-side off_limits filtering** — see Pattern 3.
- **Nesting `inWriteTransaction`** — permanent hang (`transaction.ts:12-29`). Compose via `*Core`.
- **`toISOString().split('T')[0]`** for age or timestamps — UTC evening off-by-one (CLAUDE.md); use `formatLocalDate`/`localDateTime`/`parseLocalMs`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Write serialization | A new mutex/transaction wrapper | `inWriteTransaction` (`transaction.ts`) | One shared non-reentrant mutex; a second one races the launch sweep |
| Merge uid | Ad-hoc id | `newUid()` (`uid.ts`) | Every mergeable row uses it; Phase-16 merge depends on it |
| Timestamps | `Date.now()`/ISO | `localDateTime()` / `formatLocalDate()` | Local wall-clock contract (DATA-05); UTC off-by-one bug |
| Local date parsing for age | `new Date(str)` (UTC-ambiguous) | `parseLocalMs` pattern from `gravity-logic.ts:82` | Stored strings are local wall-clock; UTC parse shifts the day |
| Node DB test setup | Custom harness | `openTestDb` + `nodeSqliteExecutor` (`__testkit__/node-sqlite.ts`) | The repo's proven harness; runs real migration-1 fixture |
| Purge fuel deletion | New delete | Already done (`purge-dao.ts:188`) | CRUD-06 fan-out ships; do NOT add a second path |
| Impact summary of fuel | New count | Already done (`purge-dao.ts:103-107,149-151`) | Counts + pluralized line exist |

**Key insight:** This phase is ~90% assembly of existing seams. The only genuinely new logic is the ranking comparator, the age formatter, and the `off_limits`/`source='ai'` predicates — all pure and node-testable.

## Runtime State Inventory

> Phase 7 is additive (a feature over an already-shipped empty table), not a rename/refactor. This inventory is included because the task touches shared tables and downstream surfaces.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `fuel` table exists and ships EMPTY (`001-initial.ts:167`, verified). No existing fuel rows on any device (feature never shipped). | None — no data migration; new rows only. |
| Live service config | None. Fuel is fully local; no external service holds fuel. | None — verified (no backend, CLAUDE.md). |
| OS-registered state | None this phase. (Notifications/widget that will read the ranked line are Phases 11/12.) | None. |
| Secrets/env vars | None. | None. |
| Build artifacts / schema | `fuel` table + all FUEL-01 columns already frozen in migration 1. Any index for ranking = a NEW migration 2 (forward-only), never an edit to migration 1. | Planner decides whether an index earns migration 2; otherwise no schema touch. |

**The canonical question — after code lands, what still holds stale state?** Nothing: the table is empty everywhere, so there is no cached/registered fuel string anywhere to reconcile.

## Common Pitfalls

### Pitfall 1: off_limits leaks via a forgotten second read path
**What goes wrong:** A card/notification/widget/compose surface reads `fuel` directly instead of through `fuel-read.ts`, omitting `kind != 'off_limits'`, and private notes render on a glanceable surface or reach the AI.
**Why it happens:** UI-side filtering feels natural; the exclusion is invisible in the DB.
**How to avoid:** Single choke-point read module; the exclusion is a SQL predicate; node-test asserts an `off_limits` row NEVER appears in the ranked projection or search results, for every kind-population combination.
**Warning signs:** any `getAllAsync("...fuel...")` outside `fuel-read.ts`; a component importing the raw executor for fuel.

### Pitfall 2: Ranking collapses to "newest regardless of kind"
**What goes wrong:** ORDER BY `created_at DESC` alone — a `fact` from yesterday outranks a `recent` from last week. This is the explicitly-rejected behaviour (`03-fuel.md:249`).
**How to avoid:** kind-priority CASE is the PRIMARY sort key, recency the tiebreak. Node-test the exact precedence (recent > gift > topic > fact) with cross-kind date inversions.
**Warning signs:** a test that only checks recency; no cross-kind ordering assertion.

### Pitfall 3: SQL CASE order and the pure comparator drift apart
**What goes wrong:** The card uses the pure `fuel-ranking.ts` comparator, the notification query uses SQL `CASE`; someone edits the priority in one place. Two surfaces disagree — the drift the "single projection" decision exists to prevent (`03-fuel.md:246-248`).
**How to avoid:** Derive both from ONE top-of-file `FUEL_KIND_PRIORITY` constant; a node-test feeds the same fixture through the SQL query and the pure comparator and asserts identical order.

### Pitfall 4: `source='ai'` unconfirmed rows reach the prompt or render as user-authored
**What goes wrong:** An AI-proposed item is transmitted back (feedback loop) or shown on the profile indistinguishable from a hand-written item (`03-fuel.md:322-328`).
**How to avoid:** Decide the confirm MECHANISM now (see Open Questions Q1 — a `confirmed` flag vs flipping `source`). The ranked projection used for AI must exclude unconfirmed `source='ai'` rows in-query; the profile MUST render them visually distinct (or at least tagged — `03-fuel.md:435` deferred "distinct vs tagged" to this phase). **This phase renders unconfirmed and excludes-from-prompt-query; the prompt itself is Phase 14.**
**Warning sign:** the ranked projection has no `source`/confirmed predicate.

### Pitfall 5: Age math via UTC / age destroys data
**What goes wrong:** `new Date(created_at)` parses local wall-clock as UTC → off-by-one "days ago"; or someone auto-hides old `recent` items.
**How to avoid:** Reuse `parseLocalMs` (local components); age only DISPLAYS and RANKS — "Nothing is ever destroyed or hidden by age" (`03-fuel.md:199-209`). No launch sweep, no auto-archive, no auto-delete.
**Warning sign:** any DELETE/UPDATE keyed on `created_at`; any age-based visibility filter.

### Pitfall 6: LIKE search — ASCII-only case-insensitivity + wildcard injection
**What goes wrong:** (a) surprise that non-ASCII case-folding doesn't work — this is EXPECTED (ICU not compiled; `03-fuel.md:355-357`), record it, don't "fix" it. (b) User types `%` or `_` and it acts as a wildcard; or the term is string-concatenated into SQL.
**How to avoid:** `?`-bind the search term (`WHERE name LIKE ? OR text LIKE ?` with `%term%` built in JS and bound). Consider escaping `%`/`_` with an `ESCAPE` clause if literal matching matters (minor; note for planner). ASCII-only casing is acceptable for English notes.
**Warning sign:** any interpolated search term.

## Code Examples

### Cross-contact search (name OR fuel text, off_limits excluded, ?-bound)
```typescript
// off_limits rows never match — structural. Search matches contact name OR fuel text.
// Returns contacts (dedup) with a matched-snippet if desired. Excludes archived.
const like = `%${term}%`;
const rows = await exec.getAllAsync<SearchRow>(
  `SELECT DISTINCT c.id, c.name
     FROM contacts c
     LEFT JOIN fuel f ON f.contact_id = c.id AND f.kind != 'off_limits'
    WHERE c.archived_at IS NULL
      AND (c.name LIKE ? OR f.text LIKE ?)
    ORDER BY c.name`,
  [like, like],
);
```
*(Exact shape is the planner's call — this proves the predicate + binding + off_limits exclusion. The dossier `[dashboard → fuel]` says this query IS the Phase-8 dashboard search box; ship the QUERY here, node-tested; the BOX is Phase 8.)*

### Ranked top line for a glanceable surface
```typescript
// The ONE shared read; card/notification/widget take rows[0], compose/AI take all.
export async function getRankedFuel(exec: SqlExecutor, contactId: number): Promise<FuelItem[]> {
  return exec.getAllAsync<FuelItem>(
    `SELECT id, contact_id, kind, label, text, url, created_at, source
       FROM fuel
      WHERE contact_id = ? AND kind != 'off_limits'
      ORDER BY CASE kind WHEN 'recent' THEN 0 WHEN 'gift' THEN 1
                         WHEN 'topic' THEN 2 WHEN 'fact' THEN 3 ELSE 4 END,
               created_at DESC, id DESC`,
    [contactId],
  );
}
```

### Age formatter (pure, local, node-tested)
```typescript
// "N days ago" / "N months ago" from created_at. Local components (never toISOString).
// Reuse gravity-logic's parseLocalMs pattern. Drives display; ranking uses created_at DESC directly.
```

## State of the Art

| Old Approach (plugin) | Current Approach (Orbit v1) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `## Conversational Fuel` markdown blob, regex-parsed | Per-item DB rows with `kind`/`label`/`text`/`url`/`created_at`/`source` | Dossier 03 (2026-08-12) | Rankable, partially-withholdable, dated |
| `⛔` emoji off-limits convention, shipped whole to AI | `off_limits` kind, excluded in-query everywhere glanceable/transmitted | Dossier 03 | Fixes live bug F4 |
| Undated fuel → "how was the trip?" 2yr late | `created_at` on every row; age reaches ranking + (Phase 14) prompt | Dossier 03 | Fixes F5 half |
| `{{Small Talk Data}}` name-bound placeholder fails silently | Closed kind set; all logic keys off `kind` | Dossier 03 | No silent fail-open |

**Deprecated/outdated in this repo:**
- `Contact.fuel?: string[]` (`src/types.ts:88`) — dead cached-blob field, never use.
- `AiService.ts` `{{Conversational Fuel}}` template — Phase 14 rewrites; not this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `source='ai'` confirm flips `source` to a non-`ai` value OR sets a separate `confirmed` flag — dossier says "or a confirmed flag" (`03-fuel.md:324`) but does not fix which. There is NO `confirmed` column in migration 1, so a flag would need migration 2. | Pitfall 4 / Open Q1 | Wrong mechanism → either an un-needed migration or a lossy `source` overwrite. **Needs owner/planner decision.** |
| A2 | An index on `fuel` for ranking is OPTIONAL at this scale; if added it is a new migration 2. | Pattern 2 | Over-building (needless migration) or a slow scan (unlikely at tens of rows). |
| A3 | Compose (Phase 9) shows the ranked list with `off_limits` EXCLUDED (it's a send surface); only the profile EDITOR surfaces `off_limits`. Dossier lists compose as a ranked-projection consumer and off_limits as "never glanceable"; it does not explicitly rule on whether the in-app compose screen may show off_limits as a private reminder. | Arch map / A-map | If owner wants off_limits visible-but-unsendable on compose, that's a Phase-9 nuance, not Phase 7. Phase 7's ranked projection excludes it regardless. |
| A4 | The profile shows unconfirmed `source='ai'` items visually distinct (not merely tagged). Dossier deferred "distinct vs merely tagged" to this phase (`03-fuel.md:435`) — a taste/visual call = owner's bucket. | Pitfall 4 | Minor UI; owner's visual call. |
| A5 | Cross-contact search matches `text` (display text). Whether it should also match `label` is unspecified; dossier says "name AND fuel text". Assuming `text` only (labels are user grouping, not content). | Search example | Under-matching on labels; low risk. |

## Open Questions

1. **`source='ai'` confirm mechanism — flip `source` or add a `confirmed` flag?**
   - What we know: proposals store `source='ai'`, render unconfirmed, excluded from prompts until confirmed (`03-fuel.md:322-330`). `source` enum is `user|share|ai|import` (import cut) (`03-fuel.md:472`).
   - What's unclear: confirming — does it rewrite `source` (losing the "was AI-proposed" provenance) or set a separate `confirmed` boolean? No `confirmed` column exists in migration 1.
   - Recommendation: **Ask the owner (risk/data-provenance = owner's bucket).** A separate `confirmed`/`ai_confirmed` column preserves provenance but needs migration 2 (un-backfillable-safe: default 0 for new rows, and there are no existing ai rows). Flipping `source` needs no migration but erases provenance. Lean: add a nullable `ai_confirmed_at TEXT` in migration 2 (keeps `source='ai'` provenance; NULL = unconfirmed). Confirm before planning.

2. **Does a ranking index earn a migration 2?** See A2. Recommendation: skip for v1 (tens of rows); revisit if the Pixel benchmark (DATA-07 pattern) shows a cost.

3. **Profile editor: ordering within a kind, empty state, label autocomplete** — dossier deferred these to phase discussion (`03-fuel.md:430-433`). Ordering within a kind = `created_at DESC` (no manual sort column). Empty state + label autocomplete are UI/taste calls — surface to owner if building the editor raises them.

## Environment Availability

> No external dependencies. Fuel is fully local (`expo-sqlite` + in-repo modules), all present since Phase 1. `node:sqlite` test harness verified (Node 22.22.2 / SQLite 3.51.2). No probe needed. Section otherwise N/A.

## Validation Architecture

`nyquist_validation: true` (config). This phase is correctness-critical and highly node-testable — the ranked projection, off_limits exclusion, age math, search predicate, and `source='ai'` exclusion are ALL pure/SQL seams that run under `node:sqlite`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (installed) |
| Config file | present (repo runs `src/**/*.test.ts`) |
| Node DB harness | `src/db/__testkit__/node-sqlite.ts` (`openTestDb` + `nodeSqliteExecutor`) `[VERIFIED]` |
| Quick run command | `npx vitest run src/db/fuel-dao.test.ts src/db/fuel-read.test.ts src/services/fuel-ranking.test.ts src/services/fuel-age.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FUEL-01 | add/edit/delete write exactly one row, `?`-bound, uid+now stamped, all columns verbatim | unit (node:sqlite) | `npx vitest run src/db/fuel-dao.test.ts` | ❌ Wave 0 |
| FUEL-02 | 5 kinds accepted; optional label stored; `off_limits` NEVER in ranked projection (all kind-population combos) | unit | `npx vitest run src/db/fuel-read.test.ts` | ❌ Wave 0 |
| FUEL-03 | ranked projection = kind priority (recent>gift>topic>fact) then recency; SQL order == pure comparator order on same fixture | unit | `npx vitest run src/db/fuel-read.test.ts src/services/fuel-ranking.test.ts` | ❌ Wave 0 |
| FUEL-04 | age "N days/months ago" from `created_at` local math; age never deletes/hides; ranking uses recency | unit | `npx vitest run src/services/fuel-age.test.ts` | ❌ Wave 0 |
| FUEL-05 | search matches name OR fuel text via LIKE, `?`-bound, `off_limits` excluded, archived excluded | unit | `npx vitest run src/db/fuel-read.test.ts` | ❌ Wave 0 |
| FUEL-06 | unconfirmed `source='ai'` excluded from the prompt-facing ranked read; rendered/tagged unconfirmed | unit | `npx vitest run src/db/fuel-read.test.ts` | ❌ Wave 0 |
| FUEL-01 UI | add/edit/delete on the profile; off_limits editable there | device UAT (Pixel) | manual (build+drive, per MEMORY runbook) | screen |

### Sampling Rate
- **Per task commit:** the quick run command (fuel suites) — < 5 s.
- **Per wave merge:** `npx vitest run` (full suite) + `tsc` + `npm run check:colors` + biome.
- **Phase gate:** full suite green, then on-device UAT on the Pixel (UI is device-verified per MEMORY: build release APK, drive add/edit/delete + confirm off_limits never on a glanceable surface + AI-unconfirmed rendering), then `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/db/fuel-dao.test.ts` — FUEL-01 writer proof (mirror `events-dao.test.ts`)
- [ ] `src/db/fuel-read.test.ts` — FUEL-02/03/05/06 (exclusion, order, search, ai-gating)
- [ ] `src/services/fuel-ranking.test.ts` — FUEL-03 pure comparator + SQL-parity assertion
- [ ] `src/services/fuel-age.test.ts` — FUEL-04 age math (local, boundaries, no-destroy)
- [ ] Framework install: none — vitest + node-sqlite harness already present.

*(UI `.tsx` — `FuelEditor`, profile wiring — is device-UAT per the repo's -logic.ts convention: correctness lives in the pure/SQL modules; the screen is a thin renderer verified on the Pixel.)*

## Security Domain

`security_enforcement: true`, ASVS L1. Fuel is private third-party notes; the ONLY egress is the AI feature (Phase 14). The security surface here is data-leak prevention and injection.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local single-user app, no auth |
| V3 Session Management | no | — |
| V4 Access Control | yes (data confidentiality) | `off_limits` structural exclusion (SQL predicate) is the access control that keeps private notes off glanceable/transmitted surfaces |
| V5 Input Validation | yes | `?`-bind every value (SQL injection); `kind` constrained to the closed enum; search term bound, `%`/`_` treated as data |
| V6 Cryptography | no | `uid` is an identifier, not a secret (`uid.ts` header); no crypto this phase |

### Known Threat Patterns for {expo-sqlite + local fuel}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via fuel text/label/search term | Tampering | `?`-bound params only; no identifier interpolation (there are no dynamic identifiers in fuel SQL — unlike custom fields, `fuel` has fixed columns) |
| `off_limits` leaks to notification/widget/card/AI | Information disclosure | `WHERE kind != 'off_limits'` in the one shared read; node-test proves absence; absent from Phase-14 placeholder resolver |
| AI-proposed item transmitted back / rendered as user's | Information disclosure / Repudiation | unconfirmed `source='ai'` excluded from prompt-facing read; rendered distinct |
| Wildcard/`LIKE` abuse | Tampering | bound term; ASCII-only casing is an accepted limitation, not a vuln |
| No network on read path | — | Fuel reads are pure SQLite; CLAUDE.md read-path rule preserved (no fetch anywhere in fuel-read) |

## Sources

### Primary (HIGH confidence — verified first-hand on disk)
- `docs/dossier/03-fuel.md` (588 lines) — the authoritative fuel decisions; every cluster read.
- `docs/dossier/INDEX.md` — cross-domain `[fuel → *]` / `[* → fuel]` constraints.
- `.planning/REQUIREMENTS.md` FUEL-01…06; `.planning/ROADMAP.md` Phase 7 + cross-phase constraints; `.planning/STATE.md`.
- `src/db/migrations/001-initial.ts:167-179` — the `fuel` DDL (confirmed: table + all FUEL-01 columns exist, no new migration needed).
- `src/db/purge-dao.ts:103-107,149-151,188` — fuel already counted + deleted in purge.
- `src/db/events-dao.ts`, `src/db/recency-dao.ts` (referenced), `src/db/transaction.ts`, `src/db/field-values-dao.ts`, `src/db/field-defs-dao.ts` — DAO patterns.
- `src/services/gravity-logic.ts`, `src/services/impact.ts`, `src/services/intensity-logic.ts` (referenced) — pure-logic + tunable + local-date-parse patterns.
- `src/db/uid.ts`, `src/db/database.ts`, `src/utils/dates.ts`, `src/db/types.ts`, `src/db/__testkit__/node-sqlite.ts` — utilities + test harness.
- `src/screens/ContactProfileScreen.tsx`, `src/screens/CustomFieldsScreen.tsx` — mount point + list-editor pattern.
- `src/types.ts:88`, `src/services/AiService.ts:31-39`, `src/navigation/types.ts` — legacy/dead surfaces to avoid.
- `.planning/config.json` — nyquist + security flags.

### Secondary / Tertiary
- None. No web search or external registry lookup was required; this is an in-repo phase over a shipped schema.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all patterns verified on disk.
- Architecture (ranked projection, off_limits exclusion, DAO): HIGH — dossier is explicit and the code patterns exist.
- Pitfalls: HIGH — drawn from the dossier's own recorded live bugs (F4/F5/F11) and the repo's mutex/UTC rules.
- Open items: A1 (ai-confirm mechanism) is the one genuine decision gap — flagged for owner.

**Research date:** 2026-08-15
**Valid until:** stable (in-repo, decisions locked) — ~30 days; the only external fact (FTS5/ICU in vendored SQLite) is dossier-recorded and not on the build path this phase.
