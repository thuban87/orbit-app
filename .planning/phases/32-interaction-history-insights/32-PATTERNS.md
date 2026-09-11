# Phase 32: Interaction History & Insights - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 24 (new + modified)
**Analogs found:** 22 / 24 (2 pure-new services have partial analogs only)

> Read with `32-RESEARCH.md` — it already carries the verified, exhaustive `quality`/channel
> consumer list and the single-writer-spine enumeration. This file assigns each new/modified
> file its closest on-disk analog and the exact code to copy from. All references below were
> opened on disk this session.
>
> **Migration head re-verified this session:** `TARGET_VERSION = PROFILE_PRESENTATION_SCHEMA_VERSION = 24`
> (`src/db/database.ts:62`), `MIGRATIONS` ends `…, migration023, profilePresentationMigration`
> (`database.ts:88-89`). **Next migration = 025.** Filenames 001–023 are numbered; the head file is
> the unnumbered `profile-presentation.ts` (version 24). Follow the numbered convention: create
> `src/db/migrations/025-<name>.ts`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/migrations/025-<name>.ts` (NEW) | migration | transform (data + schema) | `019-dashboard-prefs.ts` (ADD COLUMN) + `017-knowledge-egress-datamove.ts` (data-move + `allow_ai`) | exact (two analogs) |
| `src/db/database.ts` (MODIFY: register 025) | config | — | its own existing `migration023` registration | exact |
| `src/db/ai-context-read.ts` (MODIFY: remap literals) | service/read | CRUD (read) | itself (`readInteractionAggregates`) | in-place edit |
| `src/db/digest-read.ts` (MODIFY: remap literals) | service/read | CRUD (read) | itself (`readGentleLine`) | in-place edit |
| `src/ai/prompt-types.ts` (MODIFY?: `QualityAggregate` fields) | model/type | — | itself | in-place edit (FLAG) |
| `src/components/TouchpointRefineForm.tsx` (MODIFY: Tone/channel vocab + duration + Allow AI) | component | request-response (form) | itself | in-place edit |
| `src/components/TimelineRow.tsx` (MODIFY: EVENT_LABELS bind/unbind; verify quality copy) | component | — | itself | in-place edit |
| `src/db/recency-dao.ts` (MODIFY: accept Tone values, add duration/allow_ai columns to INSERT/UPDATE) | service/DAO | CRUD (write) | itself (`editTouchpointFull`/`insertInteraction`) | in-place edit |
| `src/db/events-dao.ts` (MODIFY: extend `EventType` union) | service/DAO | event-driven (insert-only) | itself | in-place edit |
| `src/db/contact-lifecycle-dao.ts` (MODIFY: emit bind/unbind events in-txn) | service/DAO | event-driven | `interaction-assist-dao.ts:91-124` (core composition) | role+flow match |
| `src/db/interaction-assist-dao.ts` (MODIFY: map assist channel→Message at log time) | service/DAO | transform | itself | in-place edit |
| `src/backup/backup-schema.ts` (MODIFY: allowlist history prefs, declare-only) | config | — | `PORTABLE_SETTINGS_KEYS` Phase 25/29/30/31 entries | exact |
| `src/db/history-read.ts` (NEW) | service/DAO | CRUD (read) | `profile-history-read.ts` (interim, being superseded) | role+flow match |
| `src/services/history/window.ts` (NEW) | service (pure) | transform | `src/services/intensity-logic.ts` / `impact.ts` (pure derive) | role match |
| `src/services/history/buckets.ts` (NEW) | service (pure) | transform (aggregate) | `src/services/impact.ts` `computeIntensity` core | role match |
| `src/services/history/cycles.ts` (NEW) | service (pure) | transform | `impact.ts:134-147` (nullable-cadence guard) | exact (guard pattern) |
| `src/services/history/intensity-window.ts` (NEW) | service (pure) | transform | `impact.ts` `computeContactIntensity` | exact |
| `src/components/history/ActivityHeatmap.tsx` (NEW) | component | request-response (static render) | `SegmentedControl.tsx` (theme-token static View) + `IntensityLine.tsx` (presentational) | role match |
| `src/components/history/IntensityChart.tsx` (NEW / extend `IntensityLine`) | component | request-response | `IntensityLine.tsx` | exact |
| `src/components/history/RolodexWheel.tsx` (NEW) | component | event-driven (gesture) | `orrery/OrreryCanvas.tsx` (Reanimated/GH/Skia/reduced-motion render-loop discipline) | role match |
| `src/components/history/DateDetailSheet.tsx` (NEW) | component | request-response | `ui/Sheet.tsx` (`detail` variant) + `TimelineRow.tsx` (row renderer) | role match |
| `src/components/history/InteractionDetail.tsx` (NEW) | component | request-response | `ui/Sheet.tsx` + `IntensityLine.tsx` (presentational, token-driven) | role match |
| `src/screens/EditInteractionScreen.tsx` (NEW) | screen/route | request-response (form) | `screens/EditContactScreen.tsx` | exact |
| `src/theme/theme-types.ts` + `theme-presets.ts` (MODIFY: `heatmapScale`/marker tokens) | config | — | `gravityTiers`/`starPalette` seed pattern | exact |

---

## Pattern Assignments

### `src/db/migrations/025-<name>.ts` (migration, data+schema transform)

**Analog A — additive ADD COLUMN + CHECK + DEFAULT + `app_settings` prefs:** `019-dashboard-prefs.ts`

```ts
// 019-dashboard-prefs.ts:1-29 — the whole shape to copy: versioned Migration,
// head+1 note, execAsync of ALTER … ADD COLUMN … NOT NULL DEFAULT … CHECK(...).
export const migration019: Migration = {
  version: 19,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN dashboard_view_mode TEXT NOT NULL DEFAULT 'list'
          CHECK(dashboard_view_mode IN ('list', 'card'));
      ...
    `);
  },
};
```

**Analog B — the `allow_ai` column verbatim precedent + forward-only integrity discipline:** `017-knowledge-egress-datamove.ts`

```ts
// 017:35-37 — copy this column definition verbatim onto `interactions`:
export const ADD_MEMORIES_ALLOW_AI = `
ALTER TABLE memories
  ADD COLUMN allow_ai INTEGER NOT NULL DEFAULT 0;`;
// 017 also models: a named integrity error, copy-and-prove, and the runner-owned
// per-step transaction (017:5-8) — the pattern for an irreversible data move.
```

**Migration 025 body (from RESEARCH §migration shape; keep column name `quality`, remap VALUES only):**
```sql
ALTER TABLE interactions ADD COLUMN duration INTEGER;                 -- nullable seconds
ALTER TABLE interactions ADD COLUMN allow_ai INTEGER NOT NULL DEFAULT 0
  CHECK(allow_ai IN (0,1));                                           -- mirrors memories.allow_ai
UPDATE interactions SET quality =
  CASE quality WHEN 'good' THEN 'Positive' WHEN 'fine' THEN 'Neutral'
               WHEN 'hard' THEN 'Negative' ELSE quality END;
UPDATE interactions SET channel =
  CASE channel WHEN 'text' THEN 'Message' WHEN 'email' THEN 'Message'
               WHEN 'call' THEN 'Call' WHEN 'in-person' THEN 'In Person'
               ELSE channel END;                                       -- other/unspecified pass through
ALTER TABLE app_settings ADD COLUMN history_lens TEXT NOT NULL DEFAULT 'cycles';
ALTER TABLE app_settings ADD COLUMN history_cycle_count INTEGER NOT NULL DEFAULT 10;
```
**Column-rename decision — FLAG for planner/owner (RESEARCH A1):** keep SQL `quality`; rename only in TS/UI. A real rename breaks `export-manifest.ts:52` + `restore-apply.ts:65,189` and couples to Phase 36.

**Register in `database.ts`:** import `migration025`, append it to the `MIGRATIONS` array after `profilePresentationMigration` (`database.ts:88-89`), and set `TARGET_VERSION = 25`. This breaks `full-chain.test.ts`/`runner.test.ts` snapshots until updated (RESEARCH Wave-0).

---

### `src/db/recency-dao.ts` (MODIFY — the single writer; add duration/allow_ai to INSERT + UPDATE)

**This is THE only per-interaction writer (D-05). Do NOT create a new UPDATE path.** Read the whole
file header (`:1-51`) before touching it — the invariant is load-bearing.

**INSERT core** (`insertInteraction`, `:194-213`) and **edit path** (`editTouchpointFull`, `:280-309`)
must gain `duration` and `allow_ai` columns. Copy the existing shape exactly:

```ts
// recency-dao.ts:280-309 — the SINGLE edit path. Note: scope by BOTH id AND
// contact_id, assert changes === 1, then ALWAYS recomputeLastContact.
const result = await exec.runAsync(
  `UPDATE interactions
      SET occurred_at = ?, channel = ?, direction = ?, connected = ?,
          quality = ?, note = ?, modified_at = ?
    WHERE id = ? AND contact_id = ?`,
  [ /* … add duration, allow_ai to SET + params … */ ],
);
if (result.changes !== 1) throw new Error(/* loud rollback, not silent corruption */);
await recomputeLastContact(exec, input.contactId, input.now);
```

**Future-date guard** is done BEFORE the txn opens via `rejectFutureOccurredAt` (`:268`) — the Edit route
inherits this; never re-implement it.

**Delete path:** `deleteTouchpoint`/`deleteInteractionCore` (`:313-351`) writes a tombstone
(`insertTombstoneCore`, entityType `"interaction"`) inside the same txn, DELETEs, asserts `changes === 1`,
recomputes. The Hard-delete confirmation UI calls this — copy nothing, consume it.

---

### `src/db/contact-lifecycle-dao.ts` (MODIFY — emit bind/unbind events in the existing txn)

**Analog for in-txn core composition:** `interaction-assist-dao.ts:91-124` (composes
`insertInteractionCore` + `recomputeLastContactCore` + `bumpDataRevisionCore` inside ONE
`inWriteTransaction`).

Inside `bindContact`'s existing `inWriteTransaction` (`contact-lifecycle-dao.ts:43-80`) and
`unbindContact`'s (`:92-106`), call `recordEventCore(exec, {...})` **before** `bumpDataRevisionCore(exec)`:

```ts
// events-dao.ts:60-79 — the composition primitive to call in-txn (insert-only, non-mutexed):
export async function recordEventCore(exec: SqlExecutor, input: RecordEventInput): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO events (uid, contact_id, type, occurred_at, detail, recorded_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.uid, input.contactId, input.type, input.occurredAt, input.detail ?? null, input.now, input.now],
  );
  return result.lastInsertRowId;
}
```
**Do NOT nest `inWriteTransaction`** (permanent hang, `mutex.ts:32-36`) — bind/unbind already open one.
Mint `uid` with `newUid()` (Hermes has no `crypto`).

### `src/db/events-dao.ts` (MODIFY — extend the union; no migration)

```ts
// events-dao.ts:36 — extend this TS union. events.type is CHECK-less TEXT, so NO migration:
export type EventType = "archive" | "restore" | "snooze" | "unsnooze" | "bind" | "unbind";
```
**Verify (RESEARCH):** no downstream reader switches exhaustively on `EventType` and throws on an
unknown value; confirm restore round-trips the new strings (`restore-apply.ts:190` inserts `type` verbatim).

---

### `src/db/ai-context-read.ts` + `src/db/digest-read.ts` (MODIFY — remap value literals WITH the migration)

**Highest-risk sites — a partial rename silently zeroes AI-context + digest counts.** RESEARCH §A/§B/§C has
the exhaustive list; the two literal-comparison hotspots:

```ts
// ai-context-read.ts:124-142 — remap 'good'/'fine'/'hard' → 'Positive'/'Neutral'/'Negative'.
if (r.quality === "good") good += 1;
else if (r.quality === "fine") fine += 1;
else if (r.quality === "hard") hard += 1;
// … and the returned shape { good, fine, hard } — QualityAggregate (prompt-types.ts:113-114). FLAG:
// keep internal field names OR rename to positive/neutral/negative (ripples into prompt builder).
```
```ts
// digest-read.ts:158-166 — same remap; note this file also builds SQL with a windowModifier()
// string interpolation (:150) — keep that pattern, only change the compared literals.
if (r.quality === "good" || r.quality === "fine" || r.quality === "hard") total += 1;
if (r.quality === "hard") { hard += 1; /* names the effortful person */ }
```
Add a node test asserting the aggregate/tally over a migrated fixture (RESEARCH Pitfall 1).

---

### `src/screens/EditInteractionScreen.tsx` (NEW route)

**Analog:** `src/screens/EditContactScreen.tsx` — the canonical "always-show edit form → save through the
single-writer DAO in one transaction → return to Profile" screen.

Copy from `EditContactScreen.tsx:1-60`:
- The header doc contract (`:1-24`): screen is the RN shell + navigation; it **builds NO SQL and
  re-implements NO widget** — correctness lives in a node-tested `-logic.ts`; every colour via
  `useTheme().colors.*`.
- Imports: `@react-native-community/datetimepicker` (`:25-27`) for the date/time correction control
  (same lib `TouchpointRefineForm` already uses), `useFocusEffect` from `@react-navigation/native` (`:29`).
- **The screen wraps `TouchpointRefineForm` (controlled value) + `editTouchpointFull`** — never a set-based
  `UPDATE interactions`. Reject future dates via the DAO's `rejectFutureOccurredAt` (inline copy
  `Future dates aren't allowed — pick today or earlier.` per UI-SPEC).
- Primary action = `Save changes` (`accent`/`onAccent`) via `Button` role `primary`.

**Route registration:** `Profile` route lives in every stack (`DashboardStackParamList:51`,
`OrreryStackParamList:131`, `SettingsStackParamList:172`) merged into `RootStackParamList`
(`navigation/types.ts:209-212`). Add `EditInteraction` params alongside `Profile`/`Edit`
(`ProfileRouteParams` model at `types.ts:13`). `headerShown:false` + own Back chrome per EditContact convention.

---

### `src/components/TouchpointRefineForm.tsx` (MODIFY — Tone/channel vocab, + duration + Allow AI)

```ts
// TouchpointRefineForm.tsx:40-73 — the controlled value + the two enums to migrate.
export interface TouchpointRefineValue {
  occurredAt: string; channel: string; direction: string | null;
  connected: number; quality: string | null; note: string | null;
}
const CHANNEL_OPTIONS = ["call","text","in-person","email","other","unspecified"] as const; // → Message/Call/In Person + legacy
const QUALITY_OPTIONS = ["good","fine","hard"] as const;                                     // → Positive/Neutral/Negative, relabel "Tone"
```
Extend `TouchpointRefineValue` with `duration: number | null` (seconds; entry in min/hr presets
5m/15m/30m/1h/2h/Custom) and `allowAi: number` (default 0). This form is reused by the new
`EditInteractionScreen` and by the group-linked participant override editor.

### `src/db/interaction-assist-dao.ts` (MODIFY — map assist channel at log time)

`markAssistLogged` (`:98-111`) copies `transactionAssist.channel` (`call|text|email`, per `014` CHECK) into
`insertInteractionCore`. Map at insert: `call`→`Call`, `text`→`Message`. The `interaction_assists` CHECK
stays as transport (NOT rebuilt, D-06).

---

### `src/db/history-read.ts` (NEW — canonical single-contact history read)

**Analog being superseded:** `profile-history-read.ts` (its header, `:38-41`, explicitly invites Phase 32
to replace the renderer contract without changing persistence). Copy its closed-SELECT, `?`-bound,
row-shape-typed style (`:43-55`); drop the `LIMIT 3`, add date-indexed markers, and **exclude Group Event
parents from counts** (D-10 — resolve counts from canonical child interaction rows only). This is a
`ReadOnlyExecutor` pure read — no transaction.

---

### `src/services/history/{window,buckets,cycles,intensity-window}.ts` (NEW — pure, node-testable)

**Analog:** `src/services/impact.ts` / `intensity-logic.ts` — pure derive functions, "DERIVED-NEVER-STORED,
no write", tunable constants at file top. `cycles.ts` and `intensity-window.ts` MUST reuse the nullable-cadence
guard verbatim:

```ts
// impact.ts:134-140 — the canonical Unbound/no-cadence guard. Copy this tagged-unavailable shape;
// never divide by a null interval (D-09).
export function computeContactIntensity(inputs: ImpactInputs, now: string): ContactIntensity {
  if (inputs.trackingEnabled !== 1 || inputs.intervalDays === null) return { available: false };
  return computeIntensity(inputs.interactions, intensityPeriodDays(inputs.intervalDays), inputs.rarelyResponds, now);
}
```
All date math uses `formatLocalDate()` / `localDateTime()` from `src/utils/dates.ts` — **never**
`toISOString().split('T')[0]`. Keep threshold/geometry constants in a single tunable object at file top.

---

### `src/components/history/ActivityHeatmap.tsx` + `IntensityChart.tsx` (NEW — static, no render loop)

**Render as plain RN `View` cells (UI-SPEC §1, RESEARCH A5) — NO Skia, NO animation** → sidesteps the
worklet-forward-ref hazard entirely.

**Analog for token-driven static presentational component:** `SegmentedControl.tsx` (header `:1-18`) and
`IntensityLine.tsx` (header `:1-24`). Both prove the contract: **purely presentational, parent-owned value,
NO DB/DAO import, every colour via `useTheme().colors.*`.** IntensityChart extends/mirrors `IntensityLine`
and consumes a `computeContactIntensity` result passed in.

- Heatmap saturation reads the new `heatmapScale` token (below), indexed by a pure `heatmapLevel(count, lens)`
  bucket helper — never a colour literal in a `View` style.
- Intensity stays **neutral** (`textPrimary` figure / `textSecondary` caption); MUST NOT borrow a warning hue
  (IntensityLine contract, `:10-19`).

### `src/components/history/RolodexWheel.tsx` (NEW — the ONE animated surface)

**Analog:** `src/components/orrery/OrreryCanvas.tsx` — the proven-on-device render-loop discipline.

```ts
// OrreryCanvas.tsx:23-37 — imports pattern: Skia primitives, GestureDetector + ComposedGesture from
// react-native-gesture-handler, useDerivedValue from reanimated, useReducedMotionShared from theme.
```
Copy these disciplines (all in the OrreryCanvas header `:1-22`):
- **Reanimated + gesture-handler** drive the scroll/inertia; **never `setState` per frame** — write shared
  `.value` (`use-reduced-motion.ts:104,112` proves writing `.value` ≠ setState).
- **Pause on blur/background:** conditionally MOUNT the animated subtree only when measured AND
  focused/foregrounded (unmounting stops the loop — the clock has no pause arg, `OrreryCanvas.tsx:1-6`).
- **Reduced motion:** `useReducedMotionShared()` in a worklet (`use-reduced-motion.ts:106-118`) — simplify
  depth/inertia, never remove navigation. Use `useReducedMotion()` (`:125-135`) only for React-tree branches.
- **Worklet forward-reference hazard (MEMORY f979263):** define helper worklets ABOVE their callers or Hermes
  crashes undefined-on-device (vitest can't catch it). UAT on the physical Pixel.
- **All colours through theme tokens even in Skia draws** — OrreryCanvas takes `background`/`starColors` as
  props (`:45-48`); the wheel's Galaxy glow reads tokens the same way.

### `src/components/history/{DateDetailSheet,InteractionDetail}.tsx` (NEW)

**Analog:** `src/components/ui/Sheet.tsx` (`detail` variant — `sheet-contract.ts:2-9`, `detail: "60%"`) +
`TimelineRow.tsx` as the per-record row renderer. Add `bind`/`unbind` to `TimelineRow` `EVENT_LABELS`
(`:25-30` — currently falls back to raw `item.type`). Rows distinguish record family by **semantic icon +
text label, never colour** (UI-SPEC Color §). Allow-AI sparkle: `sparkle` semantic icon in `accentText`,
`icon-size sm`, rendered ONLY when `allow_ai` is ON (D-04).

---

### `src/theme/theme-types.ts` + `theme-presets.ts` (MODIFY — new visual tokens)

**Analog:** `gravityTiers` / `starPalette` (both `readonly string[]`, `theme-types.ts:170-190`; seeded
per-palette at `theme-presets.ts:93,102,162,165,221,270`). Add `heatmapScale: readonly string[]` (length 5),
`heatmapCellEmpty`, `markerInteraction`, `markerLifecycle` to `ThemePalette`, and seed one entry per palette
slot in `theme-presets.ts` (the sole colour-literal file), authored to pass the palette contrast tests like
`gravityTiers`. Consumers read via `useTheme().colors.*` — no literals in Views or Skia (`npm run check:colors`).

---

### `src/backup/backup-schema.ts` (MODIFY — declare-only allowlist)

**Analog:** the Phase 23/25/29/30/31 declare-only entries in `PORTABLE_SETTINGS_KEYS`
(`backup-schema.ts:133-187`). Add `"historyLens"`, `"historyCycleCount"` (camelCase) with a
"Phase 32: accepted for restore only; emission + BACKUP_FORMAT_VERSION bump are Phase 36" comment mirroring
lines 167-187. **Do NOT** add them to `getPortableSettingsSnapshot` emission or bump the format this phase.

---

## Shared Patterns

### Single-writer recency spine (apply to Edit route, Delete confirm, group-linked edit/delete)
**Source:** `src/db/recency-dao.ts` (`editTouchpointFull:258-310`, `deleteTouchpoint:344-351`,
`recomputeLastContact:159-176`). Every interaction mutation routes here; UI supplies inputs only. Never
write a set-based `UPDATE/DELETE interactions` in the new route. `contacts.last_contact` has exactly one
writer (`recency-dao.ts:159-176`).

### In-transaction core composition (apply to bind/unbind events + any group-linked composite write)
**Source:** `src/db/interaction-assist-dao.ts:91-124` — compose non-mutexed *cores*
(`insertInteractionCore` / `recomputeLastContactCore` / `recordEventCore` / `bumpDataRevisionCore`) inside
ONE `inWriteTransaction`. Never nest `inWriteTransaction` (permanent hang, `mutex.ts:32-36`).

### Local-date formatting (apply to all history window/bucket math)
**Source:** `src/utils/dates.ts` — `formatLocalDate()` / `localDateTime()`. Never
`toISOString().split('T')[0]` (UTC evening off-by-one, already fixed once). The recency contract
(`recency-dao.ts:36-50`) depends on local wall-clock strings.

### Presentational, token-driven, DB-free components (apply to all `components/history/*`)
**Source:** `IntensityLine.tsx:1-24`, `SegmentedControl.tsx:1-18`. Parent owns state; component takes derived
data; no DAO/service import; every colour `useTheme().colors.*`; `npm run check:colors` enforces no literals
(including Skia draws).

### Reduced-motion + render-loop discipline (apply to RolodexWheel only)
**Source:** `OrreryCanvas.tsx:1-52`, `use-reduced-motion.ts:106-135`. Worklet flag via
`useReducedMotionShared()`; unmount subtree to pause; helper worklets defined above callers.

### Allow-AI gate precedent (apply to `allow_ai` column + future Phase 16 read wiring)
**Source:** `017-knowledge-egress-datamove.ts:35-37` (`allow_ai INTEGER NOT NULL DEFAULT 0`) +
`src/db/memories-read.ts:31` (`MEMORY_AI_ELIGIBILITY = "allow_ai = 1 AND deleted_at IS NULL"`). Phase 32
adds the column + UI; the egress read is Phase 16 and should mirror this WHERE fragment.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/services/history/buckets.ts` | service (pure) | aggregate transform | Count-only date-bucket aggregation is genuinely new; closest is `impact.ts`'s pure-derive style, but no existing bucket-count-by-window function. Build fresh as a pure, node-tested function; keep threshold tables in one tunable constant (UI-SPEC New Tokens §). |
| `src/components/history/RolodexWheel.tsx` | component | gesture | No synchronized multi-wheel picker exists in-repo (STATE: "pickers hand-built from Pressable+Modal+FlatList, zero picker deps"). Reuse the OrreryCanvas Reanimated/GH/reduced-motion *discipline*, but the wheel mechanics are new — no drop-in analog. |

Legacy Obsidian plugin (`~/projects/Orbit`) has **no** heatmap/Rolodex/intensity (History was a plain list);
per HANDOFF §4 nothing ports for this phase's visualizations (RESEARCH §State of the Art).

---

## Metadata

**Analog search scope:** `src/db/`, `src/db/migrations/`, `src/services/`, `src/components/`,
`src/components/ui/`, `src/components/orrery/`, `src/screens/`, `src/theme/`, `src/backup/`, `src/navigation/`
**Files opened on disk this session:** `database.ts`, `019-dashboard-prefs.ts`, `017-knowledge-egress-datamove.ts`,
`recency-dao.ts`, `interaction-assist-dao.ts`, `events-dao.ts`, `contact-lifecycle-dao.ts`, `ai-context-read.ts`,
`digest-read.ts`, `impact.ts`, `profile-history-read.ts`, `backup-schema.ts`, `TouchpointRefineForm.tsx`,
`OrreryCanvas.tsx`, `use-reduced-motion.ts`, `SegmentedControl.tsx`, `sheet-contract.ts`, `ConfirmDialog.tsx`,
`IntensityLine.tsx`, `EditContactScreen.tsx`, `theme-types.ts`, `theme-presets.ts`, `navigation/types.ts`
**Pattern extraction date:** 2026-09-11
</content>
</invoke>
