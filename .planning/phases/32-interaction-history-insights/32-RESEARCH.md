# Phase 32: Interaction History & Insights - Research

**Researched:** 2026-09-11
**Domain:** On-device SQLite data migration + reusable temporal-aggregation read layer + Skia/Reanimated history-visualization UI (heatmap, intensity, Rolodex wheel), inside an established RN/Expo local-first app
**Confidence:** HIGH (data layer verified file-by-file on disk; UI patterns verified against existing Orrery/Profile code)

---

<user_constraints>
## User Constraints (from CONTEXT.md — the dossier is ground truth over this shim)

### Locked Decisions (verbatim from 32-CONTEXT.md `## Decisions`)

- **D-01:** Read the phase dossier IN FULL before planning. Its dated "Amendment — audit resolutions 2026-09-01" overrides older text. `[DECIDED]`/`[REJECTED]` items are settled; reopening one, or reversing any Accepted ADR / HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the planning-notes file as a binding appendix: every REPLAN finding must be reflected in the plan; every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` on disk at plan time. Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.
- **D-04:** Per-interaction **Allow AI** defaults **OFF** (E-05). Consumed in two places: Interaction Detail shows a restrained sparkle when ON and nothing when OFF; Edit Interaction can change it. Today AI context reads only `channel, quality, connected` and never a note (`src/db/ai-context-read.ts:114-120`) — the gate must exist before any note is transmitted. **Trip-wire:** shipping default-ON, or letting a Group Note through, reverses an owner decision — stop and ask. Group Notes are never transmitted and get no toggle (ADR-078).
- **D-05:** Every group-linked edit and delete must route through `editTouchpointFull` / `deleteTouchpoint` + `recomputeLastContactCore` (`src/db/recency-dao.ts:159-214,258-346`), composing cores inside **one transaction** (R-02). Write mutex is non-reentrant; any set-based write bypassing the recency cores is a correctness bug (ADR-010/024/071). Read every writer before asserting an invariant.
- **D-06:** Tone replaces Quality and Message/Call/In Person replaces the six-value channel vocabulary — a **real data migration** (R-03): `good→Positive, fine→Neutral, hard→Negative`; `text`/`email`→Message, `call`→Call, `in-person`→In Person; `other`/`unspecified` kept as legacy representable values. **Trip-wire:** update *every* literal consumer with the migration — a partial rename silently corrupts AI context and digest text. `interaction_assists` is **not** rebuilt; its channel CHECK stays as transport, mapped to Message at log time.
- **D-07:** Decide **once** whether this phase or Phase 34 owns the shared `interactions` migration (Tone/channel, nullable `duration` seconds, per-interaction Allow AI default OFF), with the other consuming it, and coordinate with Phase 33's `group_event_id` column as one strictly ordered sequence — never competing edits. **(Per the additional-context brief: Phase 32 plans first, so Phase 32 owns this migration.)**
- **D-08:** Bind/Unbind lifecycle events do not exist (R-12): `EventType` covers only archive/restore/snooze/unsnooze and `contact-lifecycle-dao.ts:62-98` writes no event. Add the two types with insert-only producers inside the existing bind/unbind transactions (ADR-025 immutable). Verify new type strings pass restore validation. No migration needed (`events.type` has no CHECK).
- **D-09:** The Cycles lens is undefined for contacts with no cadence (R-15): `interval_days` nullable, ADR-062 requires guarding; Unbound profiles are reachable. Define the fallback **once**, jointly with Phase 31's identical note.
- **D-10:** Heatmap encodes **interaction count only**; a Group Event parent is never a second History row and never increments heatmap counts, Intensity, Last Interaction, Status, or Gravity. Deleting a group-linked child removes only that participant's Interaction; group-linked timestamps are event-owned; group-linked Edit requires an explicit individual-vs-group scope prompt (no hybrid editor).
- **D-11:** History lens and cycle-count preset are new durable preferences as `app_settings` columns, portable via backup manifest, not AsyncStorage (R-16). Interaction deletion stays hard-delete with an explicit irreversible confirmation — no trash/quarantine subsystem.

### Claude's Discretion
- Everything the dossier marks `[DERIVED]`, plus open implementation details that do not touch a `[DECIDED]` item, an ADR, or a HANDOFF.md entry. (Thresholds, wheel row counts, chart geometry, inertia values, marker artwork are explicitly dossier-tuning.)

### Deferred Ideas (OUT OF SCOPE — do not plan)
Conventional vertical timeline as a first-class view; duration-based Gravity/Status/Intensity weighting; Intensity prediction/forecasting; Heatmap channel encoding; History search/filtering; batch interaction editing; interaction trash/quarantine; account-level analytics dashboards; Category/group analytics UI; Your Week integration; historical-frequency cycle reconstruction; missed-cycle severity encoding; Contact Frequency / Category changes in History.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (abridged) | Research Support |
|----|-------------|------------------|
| HIST-01 | Profile History section = Heatmap + Intensity + History Browser, replacing vertical timeline | `profile-history-read.ts` is the interim projection Phase 32 replaces (its header says so, `:38-41`); ProfileModuleHost routing at `ContactProfileScreen.tsx:393-419` |
| HIST-02 | Heatmap = interaction count only; re-date/delete updates buckets | Aggregate from canonical interaction rows; recency spine already recomputes on delete/edit (`recency-dao.ts`) |
| HIST-03 | Lens switch (Cycles/7 Days/Month/Year); last lens persists globally, backup-portable | `app_settings` column + `PORTABLE_SETTINGS_KEYS` declare-only pattern (`backup-schema.ts:133-187`) |
| HIST-04 | Cycles default; current-frequency cycles; 5/10/15/20 presets (default 10); Unbound fallback | Nullable cadence guard `impact.ts:138`; ADR-062 |
| HIST-05 | 7 Days rolling / Month geometry / Year grid; prev-next; block future | `formatLocalDate()` date math; no toISOString |
| HIST-06 | Intensity over same window as Heatmap; no prediction | `computeContactIntensity` (`impact.ts:134-147`) is the existing intensity core |
| HIST-07 | Heatmap cell tap → small context card first → shared detail sheet | New UI; count popup must exclude lifecycle (D-10) |
| HIST-08 | Rolodex Month/Day/Year wheels, markers, clamping, today-max | Reanimated + Gesture Handler; reduced-motion hook `use-reduced-motion.ts` |
| HIST-09 | Drawer summarizes date; no auto-open on scroll | New UI |
| HIST-10 | Shared detail sheet interleaves 3 record families; lifecycle read-only incl. Bind/Unbind | Bind/Unbind types added (D-08); timeline-read is a model to extend/replace |
| HIST-11 | Interaction Detail fields + Edit/Delete + sparkle when Allow AI ON | New surface; `allow_ai` column added |
| HIST-12 | Canonical Edit Interaction route; all fields incl. Allow AI; reject future; refresh | `editTouchpointFull` is the sole edit writer (`recency-dao.ts:258-310`) |
| HIST-13 | Hard-delete + explicit irreversible confirmation naming consequences | `deleteTouchpoint` (`recency-dao.ts:344-351`); tombstone written in-txn |
| HIST-14 | Optional duration; presets; never Quick Log; display when present; excluded from metrics | New nullable `duration` column (seconds) |
| HIST-15 | Empty dates route to detailed logging, contact preselected + date prefilled | Phase 13 owns the log form; Phase 32 owns the route/context contract |
| HIST-16 | Group Event parent never a 2nd row / never increments counts; child shows group context | Aggregation reads canonical child rows only (dossier §amendment) |
| HIST-17 | Group-linked Edit asks scope (individual vs group); delete removes only participant | Routes through the single recency spine (D-05) |
| HIST-18 | Usable without color/gesture/marker; Reduced Motion simplifies wheel | `useReducedMotion()` / `useReducedMotionShared()` |
</phase_requirements>

---

## Summary

This phase is **60% data-layer surgery and 40% new visualization UI**. The riskiest work is not the heatmap or the wheel — it is a forward-only, irreversible **data migration** that rewrites the stored `quality` and `channel` vocabularies on the `interactions` table, plus every literal consumer of those values, in lockstep. Get the consumer list wrong and AI context + the weekly digest silently produce wrong text on real users' unreachable devices.

The good news: the data-layer invariants are already strong and well-documented. `interactions` and `contacts.last_contact` have a genuine single-writer spine (`recency-dao.ts`) — verified: the only INSERT/UPDATE/DELETE of `interactions` outside migrations/restore/benchmark are the three statements in that one file, plus a whole-contact purge and the restore path. The `allow_ai` per-record gate has an exact precedent (migration 017 added the identical column to `memories`). Bind/Unbind events are additive at the TS layer only (`events.type` is CHECK-less TEXT). The Skia render-loop, reduced-motion shared value, and worklet discipline all exist and are proven on-device in the Orrery.

**Primary recommendation:** Sequence the phase as **(1) migration 025** [Tone/channel data migration + nullable `duration` seconds + `allow_ai INTEGER NOT NULL DEFAULT 0` on `interactions`, + `app_settings` history-lens/cycle-count columns] → **(2) consumer updates** [every `quality`/channel literal site, in the same PR as the migration] → **(3) reusable History read/aggregation layer** → **(4) UI: Heatmap, Intensity, Rolodex, detail sheet, Interaction Detail, Edit Interaction route] → **(5) Bind/Unbind event producers**. Keep the SQL column named `quality` (store Tone values in it) to avoid churning the backup serializer and restore path; rename to `tone` only at the TS/UI layer. Emission of the new prefs into backup and any format bump stay **Phase 36** (matches the established declare-only allowlist pattern).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tone/channel data migration | Database / Storage (migration 025) | — | Irreversible schema+data change; must be application code via `PRAGMA user_version` |
| `quality`→Tone literal consumers | API/domain reads (`src/db/*.ts`) | UI | AI-context, digest, timeline reads compare literals; must change atomically |
| Interaction edit/delete | Data layer (`recency-dao.ts`) | UI (Edit route) | Single-writer recency spine owns all mutation; UI only supplies inputs |
| Allow AI gate | Data layer (`allow_ai` column) | UI (Detail sparkle + Edit toggle) | Column is the durable gate; transmission itself is Phase 16 |
| History aggregation (heatmap/intensity buckets) | Domain read layer (new) | — | Reusable temporal seam per dossier §M/§AB; pure functions, node-testable |
| Heatmap grid render | UI (RN Views or light Skia) | Theme tokens | Static colored cells; count-only; no render loop needed |
| Rolodex wheel | UI (Reanimated + Gesture Handler) | Skia (Galaxy glow only) | Gesture-driven scroll; Skia only for optional celestial theming |
| History lens / cycle preset persistence | Database (`app_settings`) | Backup manifest (declare-only) | Durable global prefs; never AsyncStorage |
| Bind/Unbind lifecycle events | Data layer (`events` insert-only) | UI (detail-sheet read-only row) | Immutable events (ADR-025); TS union + in-txn producers |

---

## Verified Migration Head & Coordination (D-03, D-07)

**Observed on disk this session — do NOT re-derive from roadmap/dossier:**

- **Current migration head = version 24**, defined in `src/db/migrations/profile-presentation.ts:4` — `export const PROFILE_PRESENTATION_SCHEMA_VERSION = 24;` `[VERIFIED: src/db/migrations/profile-presentation.ts:4]`
- **`TARGET_VERSION = PROFILE_PRESENTATION_SCHEMA_VERSION` (= 24)** at `src/db/database.ts:62` `[VERIFIED: src/db/database.ts:62]`
- The `MIGRATIONS` array ends with `migration023` then `profilePresentationMigration` (`database.ts:88-89`). `[VERIFIED: src/db/database.ts:65-90]`
- **Next migration for Phase 32 = version 25.** Note the filename convention drifted: the last migration file is unnumbered (`profile-presentation.ts`) but is version 24. Follow the numbered convention: create `src/db/migrations/025-<name>.ts` exporting `version: 25`, register it in `database.ts` `MIGRATIONS`, and set `TARGET_VERSION` to it. `[VERIFIED: src/db/migrations/ listing + database.ts:62,88-90]`

**Coordination (D-07, one strictly-ordered sequence):**
- **Phase 32 owns migration 025** (Tone/channel remap + `duration` + `allow_ai` on `interactions`, + `app_settings` prefs) because it plans first.
- **Phase 33** later adds `group_event_id` to `interactions` in a *later-numbered* migration (026+). Phase 32 must NOT add it.
- **Phase 34 (Rapid Capture)** consumes the 025 columns (it is the other `interactions` writer via the log form).
- **Phase 36** owns the backup format bump (v4→v5) that serializes duration / Tone / Allow-AI / group linkage. Phase 32 adds columns and declare-only allowlist entries; it does NOT bump the format or emit new keys.

---

## The `quality` / channel data migration — FULL consumer list (D-06, highest risk)

This is R-03, "the highest-risk item." The migration UPDATEs stored values; **every literal consumer must change in the same change**. Below is the exhaustive consumer list, grepped across `src/` and verified by reading each file this session.

### Stored schema (source of truth)
`interactions` has **no CHECK** on `channel` or `quality`; `channel TEXT NOT NULL DEFAULT 'unspecified'`, `quality TEXT` (nullable). `[VERIFIED: src/db/migrations/011-contact-lifecycle-schema.ts:98-105]` and identically at `001-initial.ts:103,106`. This means the migration is **ALTER ADD COLUMN + UPDATE only — no table rebuild.**

### A. Value-literal consumers of `quality` (`'good'`/`'fine'`/`'hard'`) — MUST remap to `'Positive'`/`'Neutral'`/`'Negative'`

| # | File:lines | What it does | Required change |
|---|-----------|--------------|-----------------|
| 1 | `src/db/ai-context-read.ts:132-142` | Aggregates `good`/`fine`/`hard` counts into `QualityAggregate` | Remap literals; also update the `QualityAggregate` shape (below) `[VERIFIED: src/db/ai-context-read.ts:124-145]` |
| 2 | `src/db/digest-read.ts:158-164` | Gentle-line tally: counts `good\|fine\|hard`, flags `hard` | Remap literals `[VERIFIED: src/db/digest-read.ts:141-167]` |
| 3 | `src/components/TouchpointRefineForm.tsx:73` | `QUALITY_OPTIONS = ["good","fine","hard"]` + label "Quality" | Rename to Tone vocab + relabel `[VERIFIED: src/components/TouchpointRefineForm.tsx:72-73,242-267]` |
| 4 | `src/components/TimelineRow.tsx:77-78` | Pushes raw `item.quality` string into the meta line | Will show new values automatically; verify copy `[VERIFIED: src/components/TimelineRow.tsx:77-79]` |

### B. `QualityAggregate` type surface (good/fine/hard field names) — consumed by AI prompt layer

- `src/ai/prompt-types.ts:113-114` — `readonly quality: QualityAggregate;` and its `{ good, fine, hard }` shape (`ai-context-read.ts:142`, re-exported `:291`). Renaming the fields to `positive/neutral/negative` ripples into the prompt builder. `[VERIFIED: src/ai/prompt-types.ts:58,113-114; src/db/ai-context-read.ts:112,142,291]` Decide whether to rename the type fields or keep internal names and only remap the SQL literals — keeping internal field names minimizes blast radius but risks confusion. **Flag for planner.**

### C. Column readers/writers (touch `quality`, not literal-dependent) — verify each still round-trips

| File:lines | Role |
|-----------|------|
| `src/db/recency-dao.ts:74,99,118,189,197,207,286,295` | THE writer — INSERT/UPDATE `quality`. Interfaces/comments say `good\|fine\|hard`; update doc + accept Tone values `[VERIFIED: src/db/recency-dao.ts]` |
| `src/db/profile-history-read.ts:11,35,49,69` | Interim profile projection (Phase 32 replaces it) `[VERIFIED]` |
| `src/db/timeline-read.ts:36,63,75,78,85,123` | The "timeline row renderer" read model named in D-06 |
| `src/backup/export-manifest.ts:52` | Backup serializer — `SELECT i.quality` |
| `src/backup/restore-apply.ts:65,189` | Restore INSERT of `quality` |

### D. Channel vocabulary consumers (six-value → Message/Call/In Person; `other`/`unspecified` kept)

| File:lines | Role | Required change |
|-----------|------|-----------------|
| `src/types.ts:43` | channel type union incl. `"in-person"` | Add new vocab; keep legacy representable `[VERIFIED: src/types.ts:43]` |
| `src/components/TouchpointRefineForm.tsx:44,60-67` | `CHANNEL_OPTIONS` (6 values) | Present Message/Call/In Person `[VERIFIED]` |
| `src/db/interaction-assist-dao.ts:98-111` | `markAssistLogged` copies assist `channel` (`call\|text\|email`, per `014` CHECK) into a new interaction | **Map at log time**: `call`→Call, `text`→Message (`interaction_assists` CHECK stays as transport — NOT rebuilt, per D-06) `[VERIFIED: src/db/interaction-assist-dao.ts:98-111; migrations/014-interaction-assists.ts:12]` |
| Default `'unspecified'` writers: `widget-mark.ts:58`, `quick-log-command.ts:92`, `notification-actions.ts:152`, `bulk-actions-dao.ts:61`, `benchmark.ts:123` | Write `'unspecified'` on Quick/instant logs | Keep `'unspecified'` (legacy representable) — no change needed `[VERIFIED via grep]` |

**Migration shape recommendation:**
```sql
-- 025 (illustrative; keep column name `quality`, remap values)
ALTER TABLE interactions ADD COLUMN duration INTEGER;          -- nullable seconds
ALTER TABLE interactions ADD COLUMN allow_ai INTEGER NOT NULL DEFAULT 0
  CHECK(allow_ai IN (0,1));                                    -- mirrors memories.allow_ai
UPDATE interactions SET quality =
  CASE quality WHEN 'good' THEN 'Positive' WHEN 'fine' THEN 'Neutral'
               WHEN 'hard' THEN 'Negative' ELSE quality END;
UPDATE interactions SET channel =
  CASE channel WHEN 'text' THEN 'Message' WHEN 'email' THEN 'Message'
               WHEN 'call' THEN 'Call' WHEN 'in-person' THEN 'In Person'
               ELSE channel END;   -- 'other'/'unspecified' pass through
ALTER TABLE app_settings ADD COLUMN history_lens TEXT NOT NULL DEFAULT 'cycles';
ALTER TABLE app_settings ADD COLUMN history_cycle_count INTEGER NOT NULL DEFAULT 10;
```
`allow_ai` — column names/type verbatim-verified against the identical `memories` precedent: `ALTER TABLE memories ADD COLUMN allow_ai INTEGER NOT NULL DEFAULT 0;` `[VERIFIED: src/db/migrations/017-knowledge-egress-datamove.ts:35-37]` and its eligibility gate `MEMORY_AI_ELIGIBILITY = "allow_ai = 1 AND deleted_at IS NULL"` `[VERIFIED: src/db/memories-read.ts:31]`.

**Column-rename decision (flag for planner):** Renaming SQL `quality`→`tone` would force changes to `export-manifest.ts:52` and `restore-apply.ts:65,189` (the serialized key) and thus the backup shape — coupling this phase to Phase 36. **Recommend: keep SQL column `quality`, model it as Tone in TS/UI.** The stored *values* still migrate; the *column name* does not. `[ASSUMED — recommendation, not a locked decision; owner/planner call]`

---

## The single-writer recency spine (D-05) — every writer enumerated

`recency-dao.ts` header declares `contacts.last_contact` "is written by NO other module" `[VERIFIED: src/db/recency-dao.ts:1-12]`. Verified against the whole tree:

**Actual DML on `interactions` (grep `INSERT/UPDATE/DELETE ... interactions`):**
- `src/db/recency-dao.ts:195` INSERT (`insertInteraction` core), `:281` UPDATE (`editTouchpointFull`), `:332` DELETE (`deleteInteractionCore`) — **the spine.** `[VERIFIED]`
- `src/db/purge-dao.ts:82` — whole-contact purge (`DELETE FROM interactions WHERE contact_id = ?`); contact-scoped, not a per-interaction edit path. `[VERIFIED]`
- `src/db/benchmark.ts:120` — benchmark seeding only (dev). `[VERIFIED]`
- `src/backup/restore-apply.ts:189` — restore INSERT ON CONFLICT (bulk restore, its own transaction). `[VERIFIED]`

**The only `contacts.last_contact` writer** is `recomputeLastContact` (`recency-dao.ts:159-176`), a single correlated `UPDATE ... SET last_contact = (SELECT MAX(i.occurred_at) ...)`. `[VERIFIED: src/db/recency-dao.ts:159-176]`

**Contract the Edit Interaction route MUST honor:**
- Edit → `editTouchpointFull(exec, input)` — rejects future `occurred_at` before opening the txn; SETs every editable column; scopes by BOTH `id AND contact_id`; asserts `changes === 1`; then ALWAYS `recomputeLastContact`. `[VERIFIED: src/db/recency-dao.ts:258-310]`
- Delete → `deleteTouchpoint` / `deleteInteractionCore` — writes a tombstone (`insertTombstoneCore`, entityType `"interaction"`) inside the same txn, DELETEs, asserts `changes === 1`, recomputes. `[VERIFIED: src/db/recency-dao.ts:313-351]`
- **Non-reentrancy:** cores (`recomputeLastContactCore`, `insertInteractionCore`) take NO mutex and must be called ONLY inside an already-open `inWriteTransaction`; a nested `inWriteTransaction` is a **permanent hang** (`mutex.ts:32-36`). Group-linked composite writes must compose cores inside ONE outer transaction, never nest. `[VERIFIED: src/db/recency-dao.ts:144-176,419-433]`
- **Precedent for composing cores across tables in one txn:** `interaction-assist-dao.ts:91-124` composes `insertInteractionCore` + `recomputeLastContactCore` + `bumpDataRevisionCore` inside one `inWriteTransaction`. Group-linked edit/delete (D-17) follows this shape. `[VERIFIED: src/db/interaction-assist-dao.ts:91-124]`

**Flag any path that would do a set-based write to `interactions` bypassing these cores → correctness bug, stop-and-ask.**

---

## The per-interaction Allow AI gate (D-04)

- Today `readInteractionAggregates` selects ONLY `channel, quality, connected` and "DELIBERATELY not the free-text interaction column" — **the note is never transmitted today.** `[VERIFIED: src/db/ai-context-read.ts:101-122]`
- Phase 32 adds the `allow_ai` column (default 0) and surfaces it: Interaction Detail sparkle when ON (nothing when OFF), Edit Interaction can toggle it. **Phase 32 does NOT make `ai-context-read` start reading notes** — actual transmission is Phase 16 (§Z). The gate = column + UI now; the read/egress wiring later. `[CITED: dossier §V, §W, amendment E-05]`
- **Exact structural precedent** for a gated egress read: memories use `MEMORY_AI_ELIGIBILITY = "allow_ai = 1 AND deleted_at IS NULL"` as a reusable WHERE fragment `[VERIFIED: src/db/memories-read.ts:31]`. When Phase 16 wires interaction notes, it should mirror this (`allow_ai = 1`) rather than invent a new gate.
- **Trip-wire (owner decision):** default must be `0` (OFF). The `CHECK(allow_ai IN (0,1))` + `DEFAULT 0` in the migration is the durable guarantee. Group Notes get no toggle and are never sent (ADR-078). `[CITED: CONTEXT D-04]`

---

## Bind/Unbind lifecycle events (D-08) — exact edit surface

- `EventType = "archive" | "restore" | "snooze" | "unsnooze"` — a TS union with no bind/unbind. `[VERIFIED: src/db/events-dao.ts:36]`
- `events.type` is `TEXT NOT NULL` with **no CHECK**. `[VERIFIED: src/db/migrations/001-initial.ts CREATE_EVENTS block — type TEXT NOT NULL]` → **no migration needed**; additive at TS layer.
- `bindContact` / `unbindContact` currently write **no event** — they only UPDATE `contacts.tracking_enabled` + `modified_at` inside their `inWriteTransaction`. `[VERIFIED: src/db/contact-lifecycle-dao.ts:27-106]`
- **Edit surface:**
  1. Extend `EventType` union in `events-dao.ts:36` to add `"bind" | "unbind"`.
  2. Inside the existing `inWriteTransaction` in `bindContact` (`contact-lifecycle-dao.ts:43-80`) and `unbindContact` (`:92-106`), call `recordEventCore(exec, {...})` **before `bumpDataRevisionCore`** (insert-only, non-mutexed core; ADR-025 immutable). `recordEventCore` is the composition primitive designed for exactly this. `[VERIFIED: src/db/events-dao.ts:60-79]`
  3. Add labels in `TimelineRow.tsx` `EVENT_LABELS` (`:25-30`) — currently falls back to raw `item.type` for unknown types, so unlabeled is safe but ugly. `[VERIFIED: src/components/TimelineRow.tsx:25-30,47-48]`
- **Restore validation:** `restore-apply.ts:190` inserts `events` with `type` verbatim (no event-type string allowlist found in `backup-schema.ts`). The `event` tombstone entity type is already registered (`restore-apply.ts:51`). Bind/unbind should round-trip, but the planner must **verify** no downstream reader switches exhaustively on `EventType` and throws on an unknown value. `[VERIFIED: src/backup/restore-apply.ts:51,66,190]`

---

## The Cycles lens over nullable cadence (D-09)

- `interval_days` is nullable; `computeContactIntensity` returns `{ available: false }` when `trackingEnabled !== 1 || intervalDays === null` — the canonical guard. `[VERIFIED: src/services/impact.ts:134-140]`
- ADR-062 requires **every** cadence consumer to guard nullable cadence; Unbound profiles are reachable (the profile screen renders an "Unbound" panel with a Bind button, `ContactProfileScreen.tsx:341-372`). `[VERIFIED]`
- **Phase 31's handling of the identical note:** the profile's RelationshipOverview / intensity already treats "no cadence" as an unavailable/absent state rather than crashing (it consumes `computeContactIntensity`'s tagged `available:false`). **Define the Cycles-lens fallback ONCE, consistent with that:** for an Unbound / no-cadence contact, the Cycles lens is not meaningful — recommend **defaulting the lens to `7 Days`** (or hiding the Cycles segment) for such contacts, and never dividing by a null interval. Decide the exact behavior with Phase 31's owner note so both surfaces agree. `[CITED: dossier §F, R-15; impact.ts:138]`

---

## Skia / Reanimated / reduced-motion patterns (heatmap + Rolodex)

**Reusable, proven-on-device patterns (the Orrery is the reference render-loop feature — Phases 13/29/30):**

- **Render loop:** `useClock()` from `@shopify/react-native-skia` drives ambient animation; it lives in exactly ONE component and unmounting that subtree stops the loop (there is no pause arg). `[VERIFIED: src/components/orrery/OrreryCanvas.tsx:1-29]`
- **Reduced motion, two hooks:** `useReducedMotionShared(): SharedValue<boolean>` — read `.value` inside `useDerivedValue` in a worklet WITHOUT re-rendering; and `useReducedMotion(): boolean` — state-backed twin for React-tree consumers. **Never drive Skia/worklet animation from the boolean.** `[VERIFIED: src/theme/use-reduced-motion.ts:106-135]`
- **Never drive animation from React `setState` per frame** (CLAUDE.md, HANDOFF §7). Writing a shared `.value` is not a setState. `[VERIFIED: use-reduced-motion.ts:104,112]`
- **Pause on blur/background:** all animation pauses on `useIsFocused === false` and `AppState` background (CLAUDE.md). The Orrery achieves this by conditionally mounting the `<Canvas>` only when measured AND focused/foregrounded. `[VERIFIED: OrreryCanvas.tsx:1-6]`
- **Worklet forward-reference hazard (MEMORY, fix f979263):** a worklet calling a worklet defined LATER in the same file = undefined-on-device Hermes crash that vitest cannot catch. **Define helper worklets ABOVE their callers.** Phase 29 pinch+reorder crashed on exactly this.
- **All colours through theme tokens, including in Skia draws** — `OrreryCanvas` passes `background`/`starColors` as props; no literal ever appears in a draw call. The heatmap saturation ramp and wheel glow MUST resolve through `src/theme/` tokens. `[VERIFIED: OrreryCanvas.tsx:20-21,45-48]`
- **Hermes has no `crypto` global** (MEMORY): guard `.subtle`/`.randomUUID`; use `newUid()` from `src/db/uid.ts` for row UIDs (already the app-wide minting path).

**Applied to this phase's UI:**
- **Heatmap** is a *static* count-colored grid (D-10, no animation). Recommend plain RN `View` cells styled from theme tokens; no render loop, no Skia required. This sidesteps the whole worklet-hazard surface for the heatmap.
- **Intensity** is a static bar/time-series over the shared window — also no render loop.
- **Rolodex wheel** is the one genuinely animated surface: **Reanimated + `react-native-gesture-handler`** for the scroll/inertia; the dossier explicitly says use existing Reanimated/Gesture Handler primitives and "do not add a heavy dependency unless implementation evidence justifies it" (§AB). Galaxy glow/depth may use Skia; Standard is a flat roller (§P). Reduced Motion simplifies wheel depth/inertia without removing navigation (§AA, HIST-18).
- **Performance claims:** the orrery/wheel perf can only be judged on the physical Pixel, not the desktop emulator (CLAUDE.md, MEMORY verify-ui-on-pixel).

---

## History/Heatmap invariants + persistence pattern (D-10, D-11)

- **Heatmap count-only; Group Event parent never a second row / never increments counts** — aggregation resolves from canonical child interaction rows only; do NOT union Group Event parents into counting queries (dossier §amendment "[DERIVED] Phase 11 aggregation/read paths must continue resolving … from canonical child Interaction rows only"). `[CITED: dossier lines 60-66,156-157]`
- **Group-linked child delete removes only that participant's interaction** — routes through `deleteTouchpoint` (single-writer spine); does not cascade to siblings or the parent. `[CITED: dossier lines 133-146; D-05 spine]`
- **Group-linked Edit requires an explicit individual-vs-group scope prompt (no hybrid editor)** — standalone interactions use the plain Edit Interaction route; group-linked first asks scope (Edit individual → participant override editor; Edit Group Event → Phase 12 route). `[CITED: dossier lines 88-116]`
- **Deletion = hard-delete + explicit irreversible confirmation** naming Status/Gravity/Intensity consequences; NO trash/quarantine. `[CITED: dossier §X]`
- **New durable prefs = `app_settings` columns + declare-only allowlist** (NOT AsyncStorage). Verified pattern: `PORTABLE_SETTINGS_KEYS` is a `Set` of camelCase keys; recent phases (23 theme, 25 dashboard, 29 orrery, 30, 31 profile) **allowlist new keys NOW for restore-acceptance but defer emission + format bump + forward-migration to Phase 36**. `[VERIFIED: src/backup/backup-schema.ts:133-187]` Precedent migrations that ALTER `app_settings ADD COLUMN <pref>`: `019-dashboard-prefs.ts`, `020-dashboard-swipe-pref.ts`, `023-orrery-system-selection-revision.ts`. `[VERIFIED: migrations listing]`
  - **Do:** migration 025 adds `history_lens` + `history_cycle_count` columns; `backup-schema.ts:133` allowlist gains `"historyLens"`, `"historyCycleCount"` (camelCase) with a "Phase 32: accepted for restore only; emission is Phase 36" comment mirroring lines 167-187.
  - **Do NOT:** add them to `getPortableSettingsSnapshot` emission or bump `BACKUP_FORMAT_VERSION` this phase.

---

## Standard Stack (all already in the repo — no new dependencies)

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sqlite` | in-repo | On-device DB; migration 025 | The app's only datastore `[VERIFIED: database.ts:24]` |
| `@shopify/react-native-skia` | in-repo | Optional Galaxy wheel glow; NOT needed for heatmap | Proven render-loop feature (Orrery) `[VERIFIED: OrreryCanvas.tsx:23-29]` |
| `react-native-reanimated` | in-repo | Rolodex wheel animation; shared values | Reduced-motion hooks built on it `[VERIFIED: use-reduced-motion.ts]` |
| `react-native-gesture-handler` | in-repo | Wheel scroll/pan gestures | Composed gesture pattern in Orrery `[VERIFIED: OrreryCanvas.tsx:31-35]` |
| `@react-native-community/datetimepicker` | in-repo | Edit Interaction date/time correction | Already used by `TouchpointRefineForm` `[VERIFIED: TouchpointRefineForm.tsx:20-22]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reanimated/GH hand-built wheel | A third-party picker/wheel lib | Dossier §AB forbids adding a heavy dependency without implementation evidence; the repo already hand-builds pickers (STATE: "Dropdown built from Pressable+Modal+FlatList, zero picker deps") |
| Skia heatmap | Plain RN `View` grid | Count-only static grid needs no GPU loop; RN Views avoid the worklet-hazard surface entirely — **recommended** |

**Installation:** none — no new packages. (Package Legitimacy Audit therefore omitted: this phase installs nothing.)

---

## Architecture Patterns

### Recommended module structure (dossier §M/§AB — build the reusable seam)
```
src/services/history/         # NEW — pure, node-testable temporal aggregation
├── window.ts                 # lens → date-window generation (Cycles/7d/Month/Year); formatLocalDate only
├── buckets.ts                # window + interactions → bucket counts (count-only, D-10)
├── intensity-window.ts       # reuse computeContactIntensity over the shared window
└── cycles.ts                 # current-frequency cycle math; nullable-cadence guard (D-09)
src/db/history-read.ts        # NEW — canonical single-contact interaction/history read; date-indexed markers
src/components/history/       # NEW — Heatmap, IntensityChart, RolodexWheel, DateDetailSheet, InteractionDetail
src/screens/EditInteractionScreen.tsx   # NEW — canonical Edit route (wraps refine form + editTouchpointFull)
```
- **Separate query / window-gen / aggregation / presentation / renderer** (dossier §M) so future Your Week/analytics can supply a different query source. Keep window+bucket math as **pure functions** node-tested in `.test.ts` (the repo convention: correctness-critical logic extracted from `.tsx` into `-logic.ts`/service modules — see `touchpoint-refine-logic.ts`, `create-contact-logic.ts`). `[VERIFIED via repo convention in STATE decisions]`

### Edit Interaction route registration
- Register the route in the appropriate stack param list (`src/navigation/types.ts` — `Profile` lives in `SettingsStackParamList:172`, but Contact Profile is reachable from multiple stacks via `RootStackParamList:209`). Follow canonical Back/unsaved-change behavior (dossier §AC). The route wraps the existing `TouchpointRefineForm` value shape + `editTouchpointFull`. `[VERIFIED: src/navigation/types.ts:164-212]`

### Anti-Patterns to Avoid
- **Driving heatmap/wheel animation from React state** — crawls on the JS thread (HANDOFF §7).
- **A worklet calling a later-defined worklet** — undefined-on-device Hermes crash vitest can't catch (MEMORY).
- **Partial `quality`/channel rename** — silently wrong AI context + digest (D-06 trip-wire).
- **Nesting `inWriteTransaction`** — permanent hang (`mutex.ts:32-36`).
- **A set-based `UPDATE interactions` in the Edit route** bypassing `editTouchpointFull` — recency silently wrong (D-05).
- **`toISOString().split('T')[0]`** — UTC evening off-by-one; use `formatLocalDate()` (`src/utils/dates.ts`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interaction edit/delete | A new `UPDATE/DELETE interactions` | `editTouchpointFull` / `deleteTouchpoint` | Single-writer recency + tombstone + future-date guard already correct `[VERIFIED: recency-dao.ts]` |
| Recompute last_contact | Manual last-write-wins | `recomputeLastContactCore` | Idempotent MAX over current rows, connected-scoped for rarely_responds |
| Lifecycle event insert | Ad-hoc INSERT | `recordEventCore` (in-txn) | Immutable insert-only contract (ADR-025) |
| Intensity math | New tier logic | `computeContactIntensity` (`impact.ts:134`) | Already guards nullable cadence; tuning lives at file top |
| Reduced-motion detection | New AccessibilityInfo listener | `useReducedMotion` / `useReducedMotionShared` | Worklet-safe + React-tree variants exist |
| Local date formatting | `toISOString()` | `formatLocalDate()` / `localDateTime()` | UTC off-by-one already fixed once |
| Row UID minting | `crypto.randomUUID()` | `newUid()` (`src/db/uid.ts`) | Hermes has no `crypto` global |
| Pref persistence | AsyncStorage | `app_settings` column + declare-only allowlist | D-11; portability via backup manifest |

**Key insight:** the interactions subsystem's correctness invariants are load-bearing and already enforced at exactly one chokepoint each. New UI must *consume* those chokepoints, never replicate their SQL.

---

## Runtime State Inventory (this is a data-migration phase)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `interactions.quality` (values `good/fine/hard`) and `interactions.channel` (6-value) in every user's DB | **Data migration** (UPDATE) in 025 — irreversible on unreachable devices |
| Stored data | No `duration`, no `allow_ai` column on `interactions` today (verified absent) | **Schema migration** — ADD COLUMN in 025 |
| Live service config | None — no external service stores these vocabularies | None (local-first; no backend) |
| OS-registered state | None — no Task Scheduler / pm2 / launchd references to interaction vocab | None |
| Secrets/env vars | None reference `quality`/`channel` | None |
| Build artifacts | `TARGET_VERSION`/`MIGRATIONS` array in `database.ts` must register 025; stale test snapshots (`full-chain.test.ts`, `runner.test.ts`) will need the new version | **Code edit** + test updates |

**Canonical question answered:** after every repo file is updated, the only runtime state still carrying the old vocabulary is **each user's on-device `interactions` rows** — which is exactly what the 025 UPDATE migration rewrites. There is no other cached/registered copy (no server, no backup service that stores it live). `interaction_assists.channel` deliberately keeps its `call/text/email` CHECK as transport (mapped at log time), so it is intentionally NOT migrated.

---

## Common Pitfalls

### Pitfall 1: Partial vocabulary rename
**What goes wrong:** AI context aggregate and the weekly digest gentle-line compare `=== 'good'`/`'hard'` against rows now storing `'Positive'`/`'Negative'` → counts silently zero.
**How to avoid:** change all four literal-consumer sites (§A above) in the same PR as the migration; add a node test asserting the aggregate over a migrated fixture.
**Warning signs:** digest "effortful" line vanishes; AI prompt shows empty quality distribution.

### Pitfall 2: Rewriting the SQL column name
**What goes wrong:** renaming `quality`→`tone` breaks `export-manifest.ts:52` + `restore-apply.ts:65,189` and couples the phase to Phase 36's format bump.
**How to avoid:** keep the SQL column; rename only in TS/UI.

### Pitfall 3: Non-reentrant mutex hang on group-linked composite writes
**What goes wrong:** wrapping `editTouchpointFull` (already mutexed) inside another `inWriteTransaction` → permanent hang.
**How to avoid:** compose **cores** (`insertInteractionCore`/`recomputeLastContactCore`/`recordEventCore`) inside ONE outer transaction, mirroring `interaction-assist-dao.ts:91-124`.

### Pitfall 4: Worklet forward reference
**What goes wrong:** wheel helper worklet defined below its caller → undefined-on-device Hermes crash vitest cannot catch.
**How to avoid:** define helper worklets above callers; UAT on the physical Pixel.

### Pitfall 5: Allow AI defaulting ON
**What goes wrong:** reverses an owner decision (E-05).
**How to avoid:** `DEFAULT 0 CHECK(allow_ai IN (0,1))`; a test asserting migrated + new rows default to 0.

---

## Validation Architecture

`workflow.nyquist_validation: true` and `security_enforcement: true` (`.planning/config.json:24,46`). `[VERIFIED]`

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node environment); migrations/DAOs proven node-side against `node:sqlite` |
| Config file | repo root (vitest); `.test.ts` beside sources |
| Quick run command | `npx vitest run <path>` (single file) |
| Full suite command | `npm test` (2927 tests pass as of 31.1 per STATE) |

### Phase Requirements → Test Map (Wave-0 gaps marked)
| Req | Behavior | Test Type | Command | Exists? |
|-----|----------|-----------|---------|---------|
| D-06 | migration remaps good/fine/hard→Positive/Neutral/Negative; channel remap; NULL untouched; `other`/`unspecified` pass through | unit (migration) | `npx vitest run src/db/migrations/025-*.test.ts` | ❌ Wave 0 |
| D-06 | AI-context aggregate + digest tally correct over migrated values | unit | extend `ai-context-read.test.ts`, `digest-read.test.ts` | ❌ Wave 0 (files exist; add cases) |
| D-04 | migrated + new interactions default `allow_ai=0` | unit | migration test | ❌ Wave 0 |
| D-05 | Edit route routes through `editTouchpointFull`; recency recomputes; future-date rejected | unit | extend `recency-dao.test.ts` | ⚠️ exists; add Edit-route coverage |
| D-08 | bind/unbind write immutable events in-txn; restore round-trips new type strings | unit | extend `contact-lifecycle-dao.test.ts` + restore test | ❌ Wave 0 |
| D-09 | Cycles lens fallback for Unbound (no divide-by-null) | unit | `src/services/history/cycles.test.ts` | ❌ Wave 0 |
| HIST-02/04/05 | window + bucket count math (Cycles/7d/Month/Year), count-only, future blocked | unit | `src/services/history/*.test.ts` | ❌ Wave 0 |
| D-10 | Group Event parent excluded from counts | unit | history-read test | ❌ Wave 0 |
| Heatmap/wheel render, gestures, Reduced Motion | manual/device | UAT on Pixel (`.tsx` not node-loadable) | manual-only |

### Sampling Rate
- **Per task commit:** `npx vitest run` on the touched file(s).
- **Per wave merge:** `npm test` (full suite green).
- **Phase gate:** full suite + on-device Pixel UAT (heatmap counts, wheel navigation, Edit/Delete, Allow-AI sparkle) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/db/migrations/025-*.test.ts` — vocabulary remap + duration/allow_ai defaults (D-06/D-04)
- [ ] `src/services/history/window.test.ts`, `buckets.test.ts`, `cycles.test.ts` — pure aggregation (HIST-02/04/05, D-09)
- [ ] `src/db/history-read.test.ts` — canonical read incl. Group-parent exclusion (D-10)
- [ ] extend `recency-dao.test.ts` (Edit route), `contact-lifecycle-dao.test.ts` (bind/unbind events), `ai-context-read.test.ts` + `digest-read.test.ts` (migrated literals), restore round-trip for bind/unbind
- [ ] Migration registration in `database.ts` (`TARGET_VERSION`=25, MIGRATIONS array) — will break `full-chain.test.ts`/`runner.test.ts` until updated

---

## Security Domain

`security_enforcement: true`. This phase touches the AI-egress boundary and irreversible local data.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Future-date rejection (`rejectFutureOccurredAt`); duration parsed to bounded seconds; all values `?`-bound (no interpolation) — `recency-dao.ts:32` |
| V6 Cryptography | no (local-only) | No new crypto; `newUid()` for UIDs; guard Hermes `crypto` |
| V4 Access Control | yes (privacy) | **Allow AI default OFF** is the access control on note egress; Group Notes never sent (ADR-078) |
| V2/V3 Auth/Session | no | No auth surface |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via custom/date input | Tampering | Parameterized (`?`) everywhere — already enforced in DAOs |
| Unintended data egress (note to AI) | Information disclosure | `allow_ai=0` default gate; transmission wired only in Phase 16 |
| Irreversible migration corrupting user data | Tampering/DoS | Forward-only, order-independent (runner sorts), test over jump-from-v1 fixture; never edit a shipped migration |
| Local-first violation (network on read path) | Information disclosure | No new network dependency; heatmap/intensity/wheel are pure local reads |

---

## State of the Art / Reuse notes

- **Legacy Obsidian plugin (`~/projects/Orbit`)** had no heatmap/Rolodex/intensity — History was a plain list. Per HANDOFF §4 the UI does not port; only user-side feature intent (`docs/Weekly Digest.md`, `Updating and Editing.md`) is reference. Nothing to port for this phase's visualizations. `[CITED: HANDOFF §4-5]`
- **`profile-history-read.ts` is explicitly interim** ("Phase 32 can replace this renderer contract without changing persistence") — the read model to supersede, not the persistence. `[VERIFIED: src/db/profile-history-read.ts:38-41]`
- **`timeline-read.ts` / `TimelineRow.tsx`** are the "vertical timeline" being replaced; they are `quality`-literal consumers to update (or retire) with the migration. Verify whether any live screen still mounts them before deleting.

## Environment Availability
No external tooling beyond the existing RN/Expo/Vitest toolchain and the Pixel/desktop-build pipeline (MEMORY build-test-pipeline). This is code + on-device DB work; no new services. Section otherwise N/A.

## Assumptions Log
| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Keep SQL column `quality` (store Tone values), rename only in TS/UI | Data migration | If owner wants a real column rename, backup serializer/restore + Phase 36 coupling changes — planner/owner decision |
| A2 | Cycles-lens fallback for no-cadence contacts = default to 7 Days / hide Cycles | D-09 | Must be reconciled with Phase 31's owner note so both surfaces agree — confirm at discuss/plan |
| A3 | `QualityAggregate` field names may stay `good/fine/hard` internally while SQL literals migrate | §B | If prompt-layer semantics require renamed fields, ripple into `prompt-types.ts` |
| A4 | History prefs are declare-only in the allowlist this phase; emission is Phase 36 | D-11 | If planner emits now, it must also bump BACKUP_FORMAT_VERSION (Phase 36 scope) — avoid |
| A5 | Heatmap built from RN Views (no Skia render loop) | UI | If Galaxy heatmap needs GPU glow, revisit — but count-only grid does not |

## Open Questions
1. **Does any live screen still mount `TimelineRow`/`timeline-read`?**
   - Known: only `profile-read` imports the history projection; `TimelineRow` had no other importer in grep. Resolve before deleting vs. updating.
2. **Column rename `quality`→`tone`?** (A1) — recommend no; owner/planner confirm.
3. **Exact Cycles fallback for Unbound** (A2) — coordinate with Phase 31.

## Sources
### Primary (HIGH — read on disk this session)
- `src/db/database.ts`, `src/db/migrations/{001,011,014,017,023,profile-presentation}.ts`, `src/db/recency-dao.ts`, `ai-context-read.ts`, `digest-read.ts`, `contact-lifecycle-dao.ts`, `events-dao.ts`, `interaction-assist-dao.ts`, `profile-history-read.ts`, `memories-read.ts`
- `src/components/{TouchpointRefineForm,TimelineRow}.tsx`, `src/components/orrery/OrreryCanvas.tsx`, `src/theme/use-reduced-motion.ts`, `src/backup/backup-schema.ts`, `src/backup/restore-apply.ts`, `src/services/impact.ts`, `src/navigation/types.ts`, `src/screens/ContactProfileScreen.tsx`
- Dossier `phase-11-interaction-history-insights-dossier-v0.2-group-events.md`; planning-notes `phase-11-planning-notes.md`; `HANDOFF.md`; `32-CONTEXT.md`; `.planning/REQUIREMENTS.md`; `.planning/config.json`
### Secondary (MEDIUM)
- STATE.md accumulated decisions; project MEMORY entries (worklet hazard, verify-on-Pixel, migration renumber, build pipeline)

## Metadata
**Confidence breakdown:**
- Migration head / data-layer facts: HIGH — every cited file opened this session, values quoted verbatim
- Consumer list completeness: HIGH — full-tree grep + per-file read
- UI patterns: HIGH — verified against existing Orrery/Profile/reduced-motion code
- Cycles fallback / column-rename recommendations: MEDIUM — sound but owner-confirmable
**Research date:** 2026-09-11
**Valid until:** ~2026-10-11 (stable local codebase; re-verify migration head at plan time per D-03 — it drifts every schema phase)
