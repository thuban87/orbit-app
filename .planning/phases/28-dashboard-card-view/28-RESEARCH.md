# Phase 28: Dashboard Card View - Research

**Researched:** 2026-09-06
**Domain:** React Native / Expo dashboard renderer (avatar-first grid) + multi-select bulk contact management composed over the existing local-first SQLite data layer
**Confidence:** HIGH (data layer, reuse map, entry points all verified on disk this session)

## Summary

Phase 28 builds a *sibling renderer* to Phase 27's List View plus the multi-select bulk-management surface. It ships **no schema migration** (D-03): every bulk action is N single-contact operations composed inside transactions, reusing existing writers. There are **no new external packages** — the grid is a virtualized `FlatList numColumns` (or FlashList only if Pixel perf forces it) and every visual primitive already exists in `src/`.

The single highest-value finding: **the composition cores are not uniformly available.** Only recency (`insertInteractionCore`/`recomputeLastContactCore`) and events (`recordEventCore`) expose non-mutexed `*Core` primitives today. **Archive, favourites, snooze all expose only mutexed top-level writers** (each opens its own `inWriteTransaction`), and **category/frequency have no single-column setter at all** — they route through `updateContactMetadataCore`, which rewrites every metadata column. Because the write mutex is **non-reentrant** (a nested `inWriteTransaction` is a permanent hang), a bulk action cannot loop the mutexed writers *inside* one transaction. To honour D-04's "N composed single-contact operations inside one transaction," the planner must **extract non-mutexed `*Core` variants** for archive, favourite, snooze, category, and frequency — mirroring the established pattern already used by recency/events/`bulk-review-dao`.

The wiring point is concrete and already stubbed: `HomeScreen.tsx` renders a `FlatList` that branches on `query.viewMode`; the `"card"` branch currently renders the **legacy `ContactCard` in a single column** — a placeholder Phase 28 replaces with the real avatar-first grid + selection layer. The `viewMode: "list" | "card"` toggle, the `dashboard-select-contacts-entry` overflow item (currently `disabled: true`), and the shared query/result model already exist.

**Primary recommendation:** Extract non-mutexed single-contact cores for the five mutating bulk actions, compose them per-action inside one `inWriteTransaction` per bulk operation, and build the grid + selection as a new renderer branch/component that reuses every primitive in the Reuse Map. Do not fork status, recency, search, favourite, or query logic; do not add a schema column; do not loop mutexed top-level writers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. `[DECIDED]`/`[REJECTED]` items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships **no migration of its own** — every bulk operation composes existing writers against the existing schema. Explicitly **not** implied: no quarantine column, no purge-deadline column, no launch-time auto-purge sweep (E-08). If any migration proves unavoidable, number it head+1 verified against `src/db/migrations/` and `TARGET_VERSION` on disk at plan time — never assume a number; coordinate any portable-key change with the backup format bump (Phase 36's final plan).
- **D-04 (R-19 REPLAN):** **No bulk mutation exists** for Quick Log, favourites, snooze, category, archive, or frequency. Build each as **N composed single-contact operations inside one transaction**, reusing the existing cores — never a set-based SQL update.
- **D-05 (R-19 trip-wire, ADR-010/024/071):** Bulk Quick Log must compose `insertInteractionCore` + `recomputeLastContactCore` inside one transaction. The write mutex is **non-reentrant** — compose the cores, never loop top-level writers. A bulk `INSERT INTO interactions` leaves `last_contact` wrong and bypasses the single recency writer. `rejectFutureOccurredAt` applies to every logged interaction, bulk included.
- **D-06 (R-19 trip-wire, ADR-025):** Bulk archive must compose **N immutable lifecycle-event writes**. A bare `UPDATE contacts SET archived_at=…` silently skips the event trail → do not do it.
- **D-07 (E-08, ADR-018):** **Bulk Delete is removed.** Bulk Archive is the recoverable removal (confirmation required, sits outside Sensitive Operations as a reversible lifecycle operation); permanent deletion stays a manual per-contact action on the Archived Contacts list. Sensitive Operations contains **Change Contact Frequency only**; Gravity is never offered as a bulk action.
- **D-08 (E-08 trip-wire):** **Do not build a contact quarantine state or a launch-time auto-purge sweep** — neither exists and neither will. Archive retention is indefinite with manual purge, and confirmation copy must describe **archiving**, not quarantine.
- **D-09 (E-01, ADR-075):** Binary favourite membership — the top-right star toggles membership with immediate visual and restrained haptic feedback; in multi-select, stars become non-interactive. The drag-reorder Manage-favourites screen and its rank are retired; **rank must never leak into Card UX**. Bulk favourite and snooze actions are explicit (Add to / Remove from Favorites, Snooze / Unsnooze) — never an ambiguous "toggle all".
- **D-10 (Group Events amendment):** Multi-select keeps Quick Log distinct and adds count-aware routing: **1 contact → the canonical individual detailed Log Interaction flow; 2+ → Group Log with the selected contacts preloaded as participants.** This phase owns only the action, the routing, and multi-select UX preservation — all Group Event domain behavior belongs to the Group Interaction Logging phase — and the layout must stay compatible with that phase's Dashboard header and overflow Group Events entries.
- **D-11 (R-17 REPLAN):** [SUPERSEDED BY UI-SPEC "Verified Codebase State" — see note below] Status is a thin status-coloured avatar ring **plus** a distinct glyph attached to the avatar edge, never colour-only; snoozed contacts get a neutral ring and a snooze glyph. Consume the Theme phase's deliverables and **do not fork a second icon source**.
- **D-12 (multi-select model):** Multi-select **is** the bulk-management surface — no separate standalone screen. It **locks and replaces** the Dashboard control area (Population/Filters/Sort and Search cease to function) rather than adding a bottom bar; Select All operates over the **frozen** eligible result universe as it stood when selection mode began; after a successful ordinary bulk operation the selection and mode persist; Back exits multi-select before route navigation.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry — including final status-icon artwork, exact card dimensions, gaps, avatar diameter, breakpoints, animation timings, and the bulk Quick Log confirmation threshold.

### Deferred Ideas (OUT OF SCOPE)
Bulk Delete; any contact quarantine / launch-time auto-purge sweep; a separate standalone bulk-management screen; contact import (belongs to Backup/Restore — the overflow entry is "Select Contacts", not an import surface); Bulk Edit Contact; multi-recipient messaging; custom per-contact card layout; multi-category membership; Gravity as mutable state.
</user_constraints>

> **D-11 staleness correction (VERIFIED this session).** D-11/R-17 state the status glyphs, semantic icon registry, and reduced-motion hook "do not exist." **That is stale.** All three exist and are consumed by Phase 27: `src/components/icons/icon-registry.ts` (`ICON_REGISTRY`), `src/components/icons/StatusGlyph.tsx`, `src/components/contact-card-ring.ts` (`ringVisual`/`statusGlyph`, `StatusDisplayState`), `src/theme/use-reduced-motion.ts`. The UI-SPEC's "Verified Codebase State" section already caught this and it is confirmed correct on disk. The *intent* of D-11 (ring + glyph, never colour-only, single icon source, no fork) is unchanged and binding.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CARDV-01 | Compact avatar-first grid (3 col normal / 2 narrow-or-large-text / more wide), floating bubbles | `FlatList numColumns` (or FlashList) over `DashboardRow[]`; columns derived from measured width + text scale. See Grid Architecture. Dims `[DEFERRED]` to Pixel UAT. |
| CARDV-02 | Name + recency + one adaptive item; status = ring + glyph never colour-only; snooze neutral ring + moon | Reuse `ringVisual`/`statusGlyph` + `StatusGlyph` + `StatusDisplayState`; `formatListRecency`; `readLine3Candidates`. Status source = `DashboardRow.status` (nullable). |
| CARDV-03 | Always-visible favourite star (binary); search keeps geometry (name / matched label / snippet) | `favourites-dao` mark/clear + `favourite_rank !== null` membership; `formatMatchExplanation`/`formatMatchCategories` + `HighlightedSnippet`; `DashboardRow.snippet`. |
| CARDV-04 | Tap → Profile; long-press → per-contact menu (locked order); Delete/Archive excluded; no swipe | `OverflowMenu`/`Sheet` pattern; nav via caller (HomeScreen owns nav, per Phase 27). |
| CARDV-05 | Enter multi-select from long-press or overflow Select Contacts; circles only in selection mode; taps toggle; count shown | Enable `dashboard-select-contacts-entry` (currently `disabled: true`); new selection store; `Icon` `select` pair (missing — F-1). |
| CARDV-06 | Multi-select locks/replaces control area; Select All over frozen universe | Reuse `src/components/control-surface/*` region; freeze the query snapshot when selection begins. |
| CARDV-07 | Bulk actions: Quick Log, Log Interaction, Fav add/remove, Snooze/Unsnooze, Set Category, Archive, Sensitive Ops; no Bulk Edit / multi-recipient Message | See Data-Layer Composition Map — each is N composed cores in one transaction. |
| CARDV-08 | Bulk Quick Log: one generic current-time interaction per contact (immediate+Undo small, confirm large) via canonical recency writers | `insertInteractionCore` + `recomputeLastContactCore` in ONE `inWriteTransaction`; `rejectFutureOccurredAt` per contact; `snackbar-store` Undo. **Trip-wire D-05.** |
| CARDV-09 | Detailed Log routes by count: 1 → individual flow; 2+ → Group Log preloaded | Card owns routing only; Group domain = Phase 33/12. |
| CARDV-10 | Bulk Archive = recoverable removal + confirmation; permanent delete stays manual per-contact | Compose N `recordEventCore` archive writes; **no bulk `UPDATE archived_at`.** **Trip-wire D-06.** |
| CARDV-11 | Sensitive Ops = Change Contact Frequency only + confirmation; Gravity never bulk | Frequency = `interval_days` write respecting v11 CHECK/trigger. |
| CARDV-12 | After ordinary bulk op selection persists (archived cards vanish); explicit exit; Back exits multi-select first | Selection store + Android back handler; Archive removes rows from the frozen universe. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Grid layout / virtualization | UI (component) | — | Presentational renderer over shared result model |
| Adaptive-context selection (compactness bias) | Logic (`src/logic`) | DB read (`readLine3Candidates`) | Ranking is pure logic over a shared candidate read |
| Status ring + glyph resolution | UI (pure mappers) | — | `ringVisual`/`statusGlyph` are pure token mappers |
| Query / populations / filters / sort / search | DB read (Phase 25) | — | Card MUST NOT re-implement; consumes `dashboard-read` |
| Selection state (mode, selected ids, frozen universe) | Store (Zustand) | — | In-memory UI session state; no persistence, no DB |
| Bulk mutations (Quick Log / Archive / Fav / Snooze / Category / Frequency) | DB write (DAO cores) | — | Correctness lives in the single-writer/immutable-event DAOs; UI only orchestrates |
| Confirmation / Undo / feedback | UI (`ConfirmDialog`/`Snackbar`) | Store (`snackbar-store`) | Existing commit-truthful contract |
| Detailed Log / Group Log / Message / Edit / Profile routing | Nav (App Shell) | — | Card exposes + routes only; forms/business rules owned elsewhere |

## Standard Stack

**No new external packages are required or recommended.** Every capability is met by an existing in-repo module or an already-installed dependency (React Native `FlatList`, Reanimated, expo-image via `Avatar`). See the Reuse Map.

### Core (existing, reuse verbatim)
| Module | Path | Purpose |
|--------|------|---------|
| Shared query/result | `src/db/dashboard-read.ts` | Populations/filters/sort/search → `DashboardRow[]` |
| Status reads | `src/db/contact-status-read.ts` | `ProfileStatus` union source |
| Search match | `src/logic/dashboard-search-match.ts` | Match descriptors |
| Row content helpers | `src/components/list-row-content.ts` | Recency, a11y desc, match formatting |
| Status mappers | `src/components/contact-card-ring.ts` | `ringVisual`, `statusGlyph`, `StatusDisplayState` |
| Status glyph | `src/components/icons/StatusGlyph.tsx` | Celestial silhouettes |
| Icons | `src/components/icons/{icon-registry.ts,Icon.tsx}` | Semantic icon names |
| Avatar | `src/components/Avatar.tsx` | Recycling-safe photo (`contactId` + `cacheBust`) |
| Glass scrim | `src/components/ui/GlassSurface.tsx` | Card scrim (Galaxy/Standard) |
| Feedback | `src/components/Snackbar.tsx` + `src/stores/snackbar-store.ts` | Undo / commit-truthful |
| Confirm | `src/components/ui/ConfirmDialog.tsx` | Bulk confirmations |
| Overlays | `src/components/ui/{Sheet.tsx,Modal.tsx,overlay-base.tsx}`, `src/components/OverflowMenu.tsx` | Context menu, bulk surface |
| Control surface | `src/components/control-surface/*` | Region multi-select locks/replaces |
| Reduced motion | `src/theme/use-reduced-motion.ts` | Gate transitions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `FlatList numColumns` | `@shopify/flash-list` | FlashList recycles better on long grids, but adds a dependency and its own recycling semantics. **Only** adopt if Pixel perf testing proves `FlatList` janks (UI-SPEC F-4/F-6). Default to `FlatList`; measure before adding a package. |
| Per-card `GlassSurface` blur | Tinted-token fallback (`blurAvailable=false`) | Per-card blur across a scrolling grid may cost frames on the Pixel; the tinted fallback carries identical semantics (UI-SPEC F-4). Recommend fallback default, measure on device. |

**Installation:** none.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** All modules are in-repo (`src/`) or already-installed dependencies verified present by existing imports. If Pixel perf testing later forces `@shopify/flash-list`, run the Package Legitimacy Gate and gate the install behind a `checkpoint:human-verify` task at that point (it is a real, widely-used package but must still be verified against an authoritative source before install).

## Data-Layer Composition Map (the central deliverable — all verified on disk this session)

> **CLAUDE.md "Review the code, not the diff":** every writer of `contacts` below was read directly. `contacts` is a shared table; the single-writer recency invariant and immutable-event trail are load-bearing.

### The transaction/mutex mechanics (do not violate)

- **`inWriteTransaction(exec, body)`** wraps `withMutex` + hand-rolled `BEGIN`/`COMMIT`/`ROLLBACK` `[VERIFIED: src/db/transaction.ts:49-64]`.
- **The mutex is non-reentrant.** `withMutex` is one module-level promise chain: `const run = chain.then(fn, fn) as Promise<T>; chain = run.catch(() => {}); return run;` `[VERIFIED: src/db/mutex.ts:32-36]`. A function already inside `inWriteTransaction` that calls another `inWriteTransaction` **hangs permanently** `[VERIFIED: src/db/transaction.ts:11-29]`.
- **Consequence for bulk:** you cannot loop the mutexed top-level writers *inside* one transaction. You may either (a) call them sequentially as N separate transactions (safe from deadlock, but **not atomic** and violates D-04's "inside one transaction"), or (b) **extract a non-mutexed `*Core`** and call it N times inside one outer `inWriteTransaction` (atomic; the established pattern). **Recommend (b).**
- **`rejectFutureOccurredAt(occurredAt, now): void` throws synchronously** and is **not** called inside the cores — it is called by the top-level wrappers before opening the transaction `[VERIFIED: src/db/log-guards.ts:68-82; src/db/recency-dao.ts:227-231]`. Bulk Quick Log must call it itself for each contact's `occurredAt` (or once for the shared current-time value) before/at the top of the transaction.

### 1. Bulk Quick Log — cores EXIST (compose them)

`insertInteractionCore` and `recomputeLastContactCore` are aliased exports of the private cores `[VERIFIED: src/db/recency-dao.ts:425-428]`:
```
export {
  insertInteraction as insertInteractionCore,
  recomputeLastContact as recomputeLastContactCore,
};
```
Signatures (verbatim, `[VERIFIED: src/db/recency-dao.ts:159-214]`):
- `recomputeLastContact(exec: SqlExecutor, contactId: number, now: string): Promise<void>` — the ONLY writer of `contacts.last_contact`; recomputes `MAX(occurred_at)` over current rows (connected-only for `rarely_responds`).
- `insertInteraction(exec, contactId: number, now: string, i: { uid; occurredAt; channel?; direction?; connected?; quality?; note?; source? }): Promise<number>` — returns `lastInsertRowId`.

Both are **non-mutexed cores; call ONLY inside an already-open `inWriteTransaction`** `[VERIFIED: src/db/recency-dao.ts:151-157,414-424]`. Bulk pattern (per D-05):
```
inWriteTransaction(exec, async () => {
  for (const id of selectedIds) {
    // rejectFutureOccurredAt(now, now) — trivially passes for current time; still call for a per-contact occurredAt
    await insertInteractionCore(exec, id, now, { uid: newUid(), occurredAt: now, source: "manual" /* or a bulk source */ });
    await recomputeLastContactCore(exec, id, now);
  }
  await bumpDataRevisionCore(exec);
});
```
**Never** `INSERT INTO interactions` set-wise — it leaves `last_contact` wrong (the exact failure `benchmark.ts` exhibits, per planning-notes). `[CITED: planning-notes R-19]`

### 2. Bulk Archive — NO core exists (extract one)

`archiveContact(exec, id: number, now: string): Promise<void>` is a **mutexed top-level writer**; it runs `UPDATE contacts SET archived_at = ?, modified_at = ? WHERE id = ? AND archived_at IS NULL` (the `IS NULL` guard makes a no-op re-archive throw), then composes `recordEventCore` **inside its own** `inWriteTransaction` `[VERIFIED: src/db/contacts-dao.ts:536-563]`. There is **no `archiveContactCore`**. The immutable-event writer to compose is:
- `recordEventCore(exec, { contactId, uid, type, occurredAt, detail?, now }): Promise<number>` — non-mutexed core, call inside an open transaction `[VERIFIED: src/db/events-dao.ts:63-82]`.
- `EventType = "archive" | "restore" | "snooze" | "unsnooze"` `[VERIFIED: src/db/events-dao.ts:39]`.

**Planner action:** extract a non-mutexed `archiveContactCore(exec, id, now)` (the body of `archiveContact` minus the `inWriteTransaction`/`bumpDataRevisionCore`) and compose it N times in one transaction, per D-06. A bare bulk `UPDATE contacts SET archived_at=…` skips the event trail and is forbidden.

### 3. Bulk Favourite — NO core exists (extract one); rank must not leak

`favourites-dao.ts` exposes only mutexed top-level writers `[VERIFIED: src/db/favourites-dao.ts:32-76]`:
- `setFavouriteRank(exec, id: number, now: string): Promise<void>` — sets `favourite_rank = (SELECT COALESCE(MAX(favourite_rank), -1) + 1 FROM contacts)`.
- `clearFavouriteRank(exec, id: number, now: string): Promise<void>` — sets `favourite_rank = NULL`.

Membership is `favourite_rank !== null` (this is how HomeScreen reads it `[VERIFIED: src/screens/HomeScreen.tsx:1072,1099]`). Per ADR-075/D-09, **rank is vestigial storage and must never surface as order in Card UX** — the `MAX+1` append is an implementation detail, never read for ordering. Bulk "Add to Favorites" / "Remove from Favorites" are **explicit** (never toggle-all). **Planner action:** extract non-mutexed cores (`setFavouriteRankCore`/`clearFavouriteRankCore`) to compose N in one transaction.

### 4. Bulk Snooze / Unsnooze — NO core exists (extract one); composes events internally

`snooze-dao.ts` exposes only mutexed top-level writers `[VERIFIED: src/db/snooze-dao.ts:79-146]`:
- `snoozeContact(exec, { contactId, uid, preset, now }): Promise<void>` — sets `snooze_until` via SQLite `date('now','localtime', <modifier>)` and composes `recordEventCore` type `"snooze"`.
- `clearSnooze(exec, { contactId, uid, now }): Promise<void>` — sets `snooze_until = NULL`, composes `recordEventCore` type `"unsnooze"` (unconditional).
- `SnoozePreset = "3d" | "1w" | "1m"`; `PRESET_MODIFIERS = { "3d": "+3 days", "1w": "+7 days", "1m": "+1 month" }` `[VERIFIED: src/db/snooze-dao.ts:39,46-50]`.

Bulk snooze/unsnooze are explicit (D-09). **Planner action:** extract non-mutexed cores, composing `recordEventCore` inside the same outer transaction (never the mutexed `recordEvent`). Note: the bulk snooze UX must choose a preset — likely surfaced as a sub-choice (implementation/product detail; Claude's discretion within existing presets).

### 5. Bulk Set Category — NO single-column setter exists

There is **no** dedicated category writer. Category is written only by `updateContactMetadataCore(exec, input: UpdateContactFullInput): Promise<void>`, which rewrites **every** metadata column: `name, category_id, interval_days, tracking_enabled, social_battery, birthday, rarely_responds, reminders_off, modified_at` `[VERIFIED: src/db/contacts-dao.ts:312-339]`. Using it for bulk category means read-modify-write of each contact's full metadata (clobber risk). **Recommend:** extract a dedicated single-column `setContactCategoryCore(exec, id, categoryId, now)` mirroring the existing `setContactPhotoCore` single-column pattern `[VERIFIED: src/db/contacts-dao.ts:637-658]` — a `?`-bound single-column `UPDATE contacts SET category_id = ?, modified_at = ? WHERE id = ?` with a `changes === 1` guard — to avoid clobbering unrelated columns. Follows the single-category model (W); multi-category is deferred.

### 6. Bulk Change Contact Frequency — NO single-column setter; respect v11 constraints

Frequency = `interval_days`, also only writable via `updateContactMetadataCore`. The schema constrains it `[VERIFIED: src/db/migrations/011-contact-lifecycle-schema.ts:36-37]`:
```
CHECK (interval_days IS NULL OR (typeof(interval_days) = 'integer' AND interval_days > 0)),
CHECK (tracking_enabled = 0 OR interval_days IS NOT NULL)
```
and a trigger `[VERIFIED: src/db/migrations/011-contact-lifecycle-schema.ts:181-185]`:
```
CREATE TRIGGER contacts_prevent_cadence_clear
BEFORE UPDATE OF interval_days ON contacts
WHEN OLD.interval_days IS NOT NULL AND NEW.interval_days IS NULL
BEGIN
  SELECT RAISE(ABORT, 'assigned interval_days cannot be cleared');
```
**Implications for bulk frequency:** applying one **positive integer** interval to all selected contacts is safe — it passes both CHECKs (positive) and never trips the trigger (never sets NULL). Setting a positive interval on an Unbound contact (`tracking_enabled = 0`, `interval_days` possibly NULL) is allowed and assigns a dormant cadence without flipping tracking. The existing TS guard shape to mirror: `!Number.isInteger(x) || x <= 0` rejects `[VERIFIED: src/db/contacts-dao.ts:355-368; src/db/contact-lifecycle-dao.ts:14-20]`. **Recommend:** extract a single-column `setContactFrequencyCore(exec, id, intervalDays, now)` with the positive-integer guard. Confirmation is required (Z): summarize count + value.

### Established idiom the planner should copy

`bulk-review-dao.ts` demonstrates the exact core/wrapper split to replicate: a non-mutexed `resolveBulkReviewFlagCore(exec, input)` that reads a metadata row and calls `updateContactMetadataCore`, plus a mutexed public `resolveBulkReviewFlag = inWriteTransaction(exec, () => …Core(exec, input))` `[VERIFIED: src/db/bulk-review-dao.ts:72-136]`. New bulk cores should follow: define `xxxCore` (assumes open transaction), keep a mutexed single wrapper for existing single-contact callers if needed, and compose the cores N times in one outer transaction for bulk.

### `bumpDataRevisionCore`

Every write path ends with `await bumpDataRevisionCore(exec)` `[VERIFIED: src/db/data-revision-dao.ts:5-20; usages across recency/events/favourites/snooze/contacts DAOs]`. A bulk transaction should call it **once** at the end (not per contact) — it bumps a single `app_settings` counter.

## Grid & Renderer Architecture (verified entry points)

### Where Card View plugs in — already stubbed

`HomeScreen.tsx` owns the data + navigation (Phase 27 pattern) and renders one `FlatList` whose `renderItem` branches on `query.viewMode` `[VERIFIED: src/screens/HomeScreen.tsx:1055-1104]`. The `"card"` branch currently renders the **legacy `ContactCard` in a single column** (no `numColumns`, star non-functional: `isFavourite={item.favourite_rank !== null}` with no `onToggle`) — a placeholder Phase 28 replaces `[VERIFIED: src/screens/HomeScreen.tsx:1091-1104]`.

- `viewMode: "list" | "card"` exists as `DashboardViewMode` from `@/logic/dashboard-query-logic`; the toggle (`VIEW_TOGGLE_OPTIONS`, `SegmentedControl`) and persistence (`dashboard-query-store.setViewMode`) already work `[VERIFIED: src/screens/HomeScreen.tsx:88,118-124,538-540,1045-1052; src/stores/dashboard-query-store.ts:62-89]`.
- The `dashboard-select-contacts-entry` overflow item exists and is `disabled: true` (label `"Select Contacts"`) — Phase 28 enables it and wires it to enter selection mode (switching to Card view if needed) `[VERIFIED: src/screens/dashboard-overflow-actions.ts:40-43]`. Phase 26 note confirms: "Select Contacts remains disabled until Phase 28." `[CITED: .planning/STATE.md:466]`

### `numColumns` gotcha (RN)

`FlatList` cannot change `numColumns` on the fly without a full re-mount — RN throws/does-not-update unless the `FlatList` is given a `key` that changes with `numColumns`. Because the responsive grid changes column count with width/text-scale, the grid `FlatList` must set `key={`grid-${numColumns}`}` (accepting a re-mount on breakpoint change). Also, mixing the single-column List and multi-column grid in one `FlatList` is awkward; **recommend a dedicated grid renderer** (its own `FlatList numColumns` or a `CardGrid` component) selected when `viewMode === "card"`, rather than overloading the shared list. `[ASSUMED — RN numColumns re-mount behavior; standard RN knowledge, confirm at build]`

### Row data is sufficient

`DashboardRow` already carries everything a card needs `[VERIFIED: src/db/dashboard-read.ts:91-110]`: `id, name, photo, modified_at, categoryLabel, favourite_rank, last_contact, snooze_until, status (ProfileStatus | null), progress, fuelText, snippet`. No new read is needed for the base card. Status is **nullable** (never-contacted → `null`, never `'stable'`) — render neutral ring + no glyph for `null` (D-11/§J).

### Adaptive context (row 3) — currently list-only

The adaptive-context pipeline is `readLine3Candidates(exec, …)` `[VERIFIED: src/db/dashboard-knowledge-read.ts:161]` + `selectLine3(...)` from `@/logic/list-row-selection`, run in HomeScreen only when `query.viewMode === "list"` `[VERIFIED: src/screens/HomeScreen.tsx:79,93,600-630]`. Card view needs the **same candidate pool** but a **compactness-biased selection** (dossier §I: prefer short values, exclude birthdays, deterministic per contact). **Recommend:** reuse `readLine3Candidates` and add a Card-specific selection variant (or a bias parameter) in `src/logic/` — do not fork the read. `Line3CandidateKind = "memory" | "relationship" | "current-state"` `[VERIFIED: src/db/dashboard-knowledge-read.ts:20]`.

### Avatar (anti-face-flash correctness)

`Avatar` takes `contactId` (recyclingKey) and `cacheBust` `[VERIFIED: src/components/Avatar.tsx:32-45,78]`. In a virtualized grid, pass `contactId={item.id}` + `cacheBust={item.modified_at}` — a correctness requirement, not an optimization (recycled cells otherwise show the wrong face).

### Selection state — no store exists yet

There is **no** selection/multi-select store; stores present are `dashboard-query-store`, `dashboard-session-store` (holds `searchText`), `dashboard-prefs-store`, `snackbar-store`, etc. `[VERIFIED: ls src/stores/]`. Phase 28 must create an in-memory selection store (mode on/off, selected id `Set`, and the **frozen eligible universe** snapshot captured when selection begins — D-12/§S). This is pure UI session state: no persistence, no DB, no migration.

## Icon Registry Gap (UI-SPEC F-1 — confirmed on disk)

`ICON_REGISTRY` currently has: `close, settings, favorite (star-outline/star), search, back, add, message, call, edit, sparkle, filter, sort, list, grid, your-week, group-events, chevron-down, dashboard, orrery, backup, warning, status-stable, status-wobble, status-decay, status-rogue, status-neutral, status-snoozed (moon)` `[VERIFIED: src/components/icons/icon-registry.ts:35-72]`. **Missing for Phase 28:** a `select` pair (unselected circle / selected check), `select-all`, `archive`, an action `snooze` (only the `status-snoozed` glyph exists), `category`/tag, `frequency`/repeat, and `overflow`/more. **A missing registry entry fails `tsc` at `Icon.tsx`** — add these semantic names to the single registry (never a second icon source, D-11). `favorite` already resolves to a real star (F-2 resolved) — do not copy legacy `ContactCard`'s literal `★`.

## Architecture Patterns

### System data flow

```
Dashboard query state (dashboard-query-store: viewMode, generation)
Dashboard session state (dashboard-session-store: searchText)
        │
        ▼
dashboard-read.ts  ──►  DashboardRow[] (status/snippet/favourite_rank/…)
        │                        │
        │                        ├─ (list) selectLine3 ─► ListRow
        │                        └─ (card) compactness-biased line3 ─► GridCard
        ▼
  ┌─ Normal Card View ──────────────────────────────────────────┐
  │  FlatList numColumns  ─► GridCard (Avatar+ring+glyph+star)   │
  │      tap → Profile   long-press → context menu (Sheet)       │
  └──────────────────────────────────────────────────────────────┘
        │  enter selection (long-press Select | overflow Select Contacts)
        ▼
  ┌─ Multi-Select Surface ──────────────────────────────────────┐
  │  selection-store: {mode, Set<id>, frozenUniverse}           │
  │  control-surface region LOCKED/REPLACED with bulk actions   │
  │  tap → toggle selection (not Profile)                       │
  │      │                                                       │
  │      ▼ bulk action                                           │
  │  inWriteTransaction(exec, () => {                            │
  │     for id of selected: <actionCore>(exec, id, …)           │
  │     bumpDataRevisionCore(exec)                              │
  │  })  ─► Snackbar/ConfirmDialog ─► refresh shared model      │
  └──────────────────────────────────────────────────────────────┘
```

### Pattern: bulk action = one transaction of N cores

Every mutating bulk action (Quick Log, Archive, Fav ±, Snooze ±, Category, Frequency) follows the same shape: validate inputs up front (future-date guard, positive-int guard), open **one** `inWriteTransaction`, loop the extracted non-mutexed `*Core` over the selected ids, `bumpDataRevisionCore` once, commit; on any error the whole transaction rolls back (partial-failure safety). Feedback is commit-truthful (Snackbar/announcement); Quick Log adds Undo for small selections.

### Anti-Patterns to Avoid
- **Set-based bulk `UPDATE`/`INSERT`** for any contact mutation — breaks the single-writer recency invariant (Quick Log) or the immutable-event trail (Archive). (D-05/D-06)
- **Looping a mutexed top-level writer inside `inWriteTransaction`** — permanent hang (non-reentrant mutex).
- **Reading `favourite_rank` for ordering** in Card UX — rank is retired (ADR-075/D-09).
- **A bulk metadata rewrite for category/frequency** via `updateContactMetadataCore` without reading current values — clobbers unrelated columns. Use a dedicated single-column core.
- **Forking status/recency/search/query logic** — Card is a renderer over the shared model (dossier §A).
- **A separate bulk-management screen**, a quarantine state, or an auto-purge sweep — explicitly out of scope (D-07/D-08).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recency after bulk log | Set-based `INSERT INTO interactions` | `insertInteractionCore` + `recomputeLastContactCore` | Single-writer invariant; `MAX` recompute is the whole correctness story |
| Archive audit trail | `UPDATE contacts SET archived_at` | `recordEventCore` composed per contact | Immutable lifecycle events (ADR-025) |
| Favourite membership | New boolean/toggle path | `favourites-dao` mark/clear | One favourite concept across Profile/List/Card/widget |
| Recency/match formatting | New formatter | `list-row-content.ts` helpers + `HighlightedSnippet` | Card differs in layout, not semantics |
| Status colour/glyph | New mapping | `ringVisual`/`statusGlyph`/`StatusGlyph` | Single source; CVD-safe redundant channels |
| Grid virtualization | Custom scroller | `FlatList numColumns` (FlashList only if perf forces) | Recycling + `Avatar` recyclingKey correctness |
| Transaction/mutex | New mutex or expo `withTransactionAsync` | `inWriteTransaction` | Non-reentrant shared mutex; expo wrapper captures unrelated writes |

**Key insight:** in this repo the expensive bugs live in the data layer. The correct-by-construction path is to compose the existing cores; the phase's risk is entirely about *where the transaction boundary sits* and *which writers get composed*, not about new UI.

## Runtime State Inventory

*(Included for completeness; Phase 28 is a feature phase, not a rename/migration.)*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema change (D-03); bulk ops write existing `contacts`/`interactions`/`events` columns via existing DAOs | None |
| Live service config | None — no external services | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

**Migration:** none (D-03). Head verified: latest migration is `020-dashboard-swipe-pref` and `TARGET_VERSION = 20` `[VERIFIED: ls src/db/migrations/; src/db/database.ts:55]`. If a migration ever proved unavoidable it would be **021** (head+1) — but this phase must not need one; a required migration is a stop-and-ask (D-03).

## Common Pitfalls

### Pitfall 1: Nesting the write mutex
**What goes wrong:** a bulk action loops `archiveContact`/`setFavouriteRank`/`snoozeContact` inside its own `inWriteTransaction` → permanent hang.
**Why:** `withMutex` is a single non-reentrant promise chain `[VERIFIED: src/db/mutex.ts:32-36]`.
**How to avoid:** extract non-mutexed `*Core`s; enter the mutex exactly once per bulk operation.
**Warning signs:** a bulk action never resolves; the app freezes on the first multi-contact action in dev.

### Pitfall 2: `last_contact` silently wrong after bulk Quick Log
**What goes wrong:** a direct multi-row `INSERT` (or forgetting `recomputeLastContactCore`) leaves recency stale, corrupting status/gravity.
**How to avoid:** compose both cores per contact; the recompute is a `MAX` over current rows so it is correct regardless of ordering.
**Warning signs:** contacts logged in bulk still show old recency / wrong status band.

### Pitfall 3: Skipping the archive event trail
**What goes wrong:** a bare bulk `UPDATE archived_at` hides contacts but records no `archive` event → the profile timeline lies.
**How to avoid:** compose `recordEventCore` type `"archive"` per contact in the same transaction (D-06).

### Pitfall 4: `numColumns` not re-mounting
**What goes wrong:** changing column count on text-scale/rotation does nothing or throws.
**How to avoid:** key the grid `FlatList` by `numColumns`.

### Pitfall 5: Favourite rank leaking into Card order
**What goes wrong:** ordering/reading `favourite_rank` reintroduces retired rank semantics.
**How to avoid:** membership is `favourite_rank !== null`; never sort by it (D-09/ADR-075).

### Pitfall 6: Selection surviving a changing result set
**What goes wrong:** if Population/Filters/Search stay live during selection, Select All / selected ids become ambiguous as rows move.
**How to avoid:** lock/replace the control area and freeze the eligible universe snapshot at selection start (D-12/§R/§S).

### Pitfall 7: UTC date drift
**What goes wrong:** using `toISOString()` for `now`/`occurred_at` reintroduces the evening off-by-one day bug.
**How to avoid:** use the local wall-clock helpers (`localDateTime()`/`formatLocalDate()`), never `toISOString().split('T')[0]` (CLAUDE.md; `log-guards` validates the strict `YYYY-MM-DD HH:MM:SS` shape).

## Code Examples

### Bulk Quick Log (compose recency cores in one transaction)
```typescript
// Pattern derived from src/db/recency-dao.ts recordTouchpoint + the *Core exports.
// Extract into e.g. src/db/bulk-actions-dao.ts (planner's call).
export function bulkQuickLog(exec: SqlExecutor, ids: number[], now: string): Promise<void> {
  rejectFutureOccurredAt(now, now); // throws synchronously if malformed; current-time trivially passes
  return inWriteTransaction(exec, async () => {
    for (const id of ids) {
      await insertInteractionCore(exec, id, now, { uid: newUid(), occurredAt: now, source: "manual" });
      await recomputeLastContactCore(exec, id, now);
    }
    await bumpDataRevisionCore(exec);
  });
}
```
*(Source: composed from `src/db/recency-dao.ts:159-214,425-428` + `src/db/transaction.ts:49-64`.)*

### Bulk Archive (compose immutable events; extract a core)
```typescript
// archiveContact (contacts-dao.ts:536-563) is mutexed; extract its body as a core:
async function archiveContactCore(exec: SqlExecutor, id: number, now: string): Promise<void> {
  const result = await exec.runAsync(
    "UPDATE contacts SET archived_at = ?, modified_at = ? WHERE id = ? AND archived_at IS NULL",
    [now, now, id],
  );
  if (result.changes !== 1) throw new Error(`archiveContactCore: no live contact id=${id}`);
  await recordEventCore(exec, { contactId: id, uid: newUid(), type: "archive", occurredAt: now, detail: null, now });
}
export function bulkArchive(exec: SqlExecutor, ids: number[], now: string): Promise<void> {
  return inWriteTransaction(exec, async () => {
    for (const id of ids) await archiveContactCore(exec, id, now);
    await bumpDataRevisionCore(exec);
  });
}
```
*(Source: `src/db/contacts-dao.ts:536-563` + `src/db/events-dao.ts:63-82`.)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Legacy grid `ContactCard` (48px avatar, category chip, `★`) | New avatar-dominant floating-bubble `GridCard` reusing shared primitives | Phase 28 | `ContactCard` is reference only; the card branch in HomeScreen is a placeholder |
| Drag-reorder favourites + rank (ADR-033) | Binary membership (ADR-075) | 2026-09-01 | No rank in Card UX; explicit bulk fav add/remove |
| "Bulk Log Interaction not offered" | Count-aware routing (1→individual, 2+→Group Log) | 2026-09-01 amendment | Card owns routing only; Group domain = Phase 33/12 |
| "Bulk delete → 30-day quarantine" (false) | Bulk Archive (recoverable) + manual per-contact purge | 2026-09-01 (E-08) | No quarantine, no auto-purge, no bulk delete |

**Deprecated/outdated:** the D-11/R-17 claim that glyphs/registry/reduced-motion "do not exist" — superseded by Phase 23 shipping them (verified on disk).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `FlatList` `numColumns` requires a `key` change to re-mount on column-count change | Grid Architecture / Pitfall 4 | Low — standard RN behavior; verified at build. If wrong, layout just needs a different reflow trigger |
| A2 | `FlatList` is sufficient for grid perf on the Pixel (no FlashList needed) | Standard Stack / Alternatives | Medium — only assessable on the physical Pixel (UI-SPEC F-4/F-6); if it janks, adopt FlashList behind a legitimacy checkpoint |
| A3 | A single positive-integer `interval_days` applied to any selected contact (Bound or Unbound) is schema-safe | Data-Layer §6 | Low — verified against v11 CHECKs + trigger; only NULL-clearing is blocked, which bulk frequency never does |
| A4 | Bulk snooze needs a preset sub-choice from the existing `SnoozePreset` set | Data-Layer §4 | Low — UX detail (Claude's discretion); presets are fixed in `snooze-dao` |

**Note:** claims about DAO signatures, schema constraints, registry contents, `TARGET_VERSION`, the HomeScreen wiring, and the overflow entry are all `[VERIFIED]` against disk this session, not assumed.

## Open Questions (RESOLVED)

1. **Bulk snooze preset selection UX.**
   - What we know: `snooze-dao` fixes presets to `3d`/`1w`/`1m`; single-contact snooze uses them.
   - What's unclear: whether bulk Snooze presents a preset picker or defaults one.
   - Recommendation: surface the same 3 presets (Claude's discretion, §V/§U); no new domain.
   - **RESOLVED (Plan 28-07):** bulk Snooze surfaces the existing 3 presets; no new domain behavior.
2. **Where the new bulk cores live.**
   - What we know: `bulk-review-dao.ts` is import-review specific; the new cores belong in a general place.
   - Recommendation: a new `src/db/bulk-actions-dao.ts` (or extend each source DAO with a `*Core` export). Extending each source DAO keeps the writer next to its invariant — recommend that.
   - **RESOLVED (Plan 28-02):** the extracted non-mutexed `*Core` exports live in their source DAOs (writer next to its invariant); the N-per-action composers live in a new `src/db/bulk-actions-dao.ts`.

## Environment Availability

*(No external tools/services on any read or write path — local-first, on-device SQLite. Skip condition met except for build tooling, which is unchanged from Phase 27.)*

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Existing RN/Expo toolchain | Build/run | ✓ (Phase 27 shipped) | unchanged | — |
| Physical Pixel 6 Pro | Grid perf + blur + dims UAT | ✓ (per CLAUDE.md device access) | — | Perf claims cannot be made on the emulator |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node env) via node:sqlite adapter for DAO/logic; RN component render is device-UAT |
| Config file | existing repo Vitest config (unchanged) |
| Quick run command | `npm test -- <file>` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CARDV-08 | Bulk Quick Log writes 1 interaction/contact + recomputes `last_contact`; future/malformed `now` rejected; rolls back on error | unit (node:sqlite) | `npm test -- src/db/bulk-actions-dao.test.ts` | ❌ Wave 0 |
| CARDV-10 | Bulk Archive writes N `archive` events + `archived_at`; no-op re-archive throws; rollback leaves no partial state | unit (node:sqlite) | `npm test -- src/db/bulk-actions-dao.test.ts` | ❌ Wave 0 |
| CARDV-07/11 | Bulk favourite/snooze/category/frequency compose cores in one transaction; frequency rejects non-positive; trigger not tripped | unit (node:sqlite) | `npm test -- src/db/bulk-actions-dao.test.ts` | ❌ Wave 0 |
| CARDV-02/03 | Compactness-biased line3 selection is deterministic + excludes birthdays; search row mapping | unit (pure logic) | `npm test -- src/logic/card-line3-selection.test.ts` | ❌ Wave 0 |
| CARDV-05/06/12 | Selection store: enter/exit, toggle, Select All over frozen universe, persistence across ops, archived removal | unit (store) | `npm test -- src/stores/dashboard-selection-store.test.ts` | ❌ Wave 0 |
| CARDV-01/02/03/04 | Grid render, ring+glyph, star, long-press, tap→Profile | manual device-UAT | Pixel UAT (uiautomator; see CLAUDE.md) | manual |
| CARDV-06 | Control-area lock/replace visuals; no bottom bar | manual device-UAT | Pixel UAT | manual |
| CARDV-01 | Text-scale reflow (3→2 cols) / column count by width | manual device-UAT | Pixel UAT (only assessable on device) | manual |

### Sampling Rate
- **Per task commit:** `npm test -- <touched file>` + `tsc --noEmit` + `check:colors`.
- **Per wave merge:** `npm test` (full node suite).
- **Phase gate:** full suite green + Pixel UAT of the grid, multi-select, and each bulk action (partial-failure rollback observed) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/db/bulk-actions-dao.ts` + `.test.ts` — the extracted cores + bulk composers (or per-DAO `*Core` exports with tests)
- [ ] `src/stores/dashboard-selection-store.ts` + `.test.ts` — selection mode, frozen universe
- [ ] `src/logic/card-line3-selection.ts` + `.test.ts` — compactness-biased adaptive context
- [ ] Icon registry entries (`select`, `select-all`, `archive`, `snooze`, `category`, `frequency`, `overflow`) — a missing entry fails `tsc`

*(Existing DAO test suites — `recency-dao.test.ts`, `contacts-dao.test.ts`, `events-dao.test.ts`, `favourites-dao.test.ts`, `snooze-dao.test.ts`, `011-contact-lifecycle-schema.test.ts` — already cover the single-contact invariants the bulk composers depend on.)*

## Security Domain

Local-first, no network on any path (CLAUDE.md). ASVS categories that apply:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Positive-integer guard for frequency; `rejectFutureOccurredAt` strict `YYYY-MM-DD HH:MM:SS` validation for Quick Log; category id bound with `?` |
| V6 Cryptography | no | No crypto in this phase |
| V2/V3 Auth/Session | no | No auth surface |
| V4 Access Control | no | Single-user device DB |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via bulk args | Tampering | All values `?`-bound in every DAO; only static column names are literal (verified across recency/events/favourites/snooze/contacts DAOs) |
| Partial-write corruption on bulk failure | Tampering | One `inWriteTransaction` per bulk op → atomic rollback |
| Recency/audit divergence | Repudiation | Single-writer recency + immutable events composed, never bypassed |

## Sources

### Primary (HIGH confidence — read on disk this session)
- `src/db/recency-dao.ts`, `src/db/events-dao.ts`, `src/db/favourites-dao.ts`, `src/db/snooze-dao.ts`, `src/db/contacts-dao.ts`, `src/db/contact-lifecycle-dao.ts`, `src/db/transaction.ts`, `src/db/mutex.ts`, `src/db/log-guards.ts`, `src/db/data-revision-dao.ts`, `src/db/bulk-review-dao.ts`, `src/db/dashboard-read.ts`, `src/db/dashboard-knowledge-read.ts`, `src/db/database.ts`, `src/db/migrations/011-contact-lifecycle-schema.ts`
- `src/screens/HomeScreen.tsx`, `src/screens/dashboard-overflow-actions.ts`
- `src/components/Avatar.tsx`, `src/components/icons/icon-registry.ts`, `src/components/contact-card-ring.ts`, `src/components/list-row-content.ts`
- `src/stores/` (directory), `src/stores/dashboard-query-store.ts`
- `docs/decisions/ADR-010, ADR-018, ADR-024, ADR-025, ADR-071, ADR-075`
- Dossier `docs/dossier/milestone-2/phase-07-dashboard-card-view-dossier-v0.2.md` + planning-notes; `28-CONTEXT.md`; `28-UI-SPEC.md`; `.planning/REQUIREMENTS.md`; `.planning/STATE.md`

### Secondary (MEDIUM)
- UI-SPEC "Verified Codebase State" and Reuse Map (cross-checked against disk; confirmed accurate)

### Tertiary (LOW)
- RN `FlatList numColumns` re-mount behavior (training knowledge; A1 — verify at build)

## Metadata

**Confidence breakdown:**
- Data-layer composition map: HIGH — every writer, core, signature, and schema constraint read on disk with file:line + verbatim quotes
- Renderer entry points: HIGH — HomeScreen wiring, viewMode toggle, overflow entry verified on disk
- Grid perf / dimensions: LOW/MEDIUM — deferred to Pixel UAT by dossier; not assessable on the emulator
- Reuse map: HIGH — spot-verified against UI-SPEC's disk audit; primitives confirmed present

**Research date:** 2026-09-06
**Valid until:** ~2026-10-06 (stable; re-verify migration head and `TARGET_VERSION` at plan time per D-03)
