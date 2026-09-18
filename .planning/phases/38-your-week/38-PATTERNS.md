# Phase 38: Digest & Navigation Restructure - Pattern Map

**Mapped:** 2026-09-18
**Files analyzed:** 13 (create/modify)
**Analogs found:** 13 / 13 (all excerpts verified against code on disk this session)

> Every excerpt below was opened and confirmed on disk (per CLAUDE.md "review the
> code, not the diff"). Line numbers are current as of 2026-09-18. RESEARCH.md was
> the guide; the signatures/paths here are re-verified, not copied from it.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/your-week-read.ts` (NEW) | DAO (read-only) | request-response / aggregate read | `src/db/digest-read.ts` | exact (read-only DAO, same injection posture) |
| `src/db/migrations/030-your-week-period.ts` (NEW) | migration | batch schema DDL | `src/db/migrations/029-ai-configuration.ts` | exact (additive `ALTER TABLE app_settings`) |
| `src/db/migrations/database.ts` (MODIFY — registry) | config | — | self (append to list, bump `TARGET_VERSION`) | exact |
| `src/db/app-settings-dao.ts` (MODIFY) | DAO / model | CRUD (settings) | self (existing declare-optional keys) | exact |
| `src/services/history/week-window.ts` (NEW) | service (pure) | transform | `src/services/history/window.ts` (`buildSevenDays`) | role-match (new locale-aware builder) |
| `src/screens/DigestScreen.tsx` (REWRITE) | screen/component | event-driven (focus reads) | self (shipped focus-effect + `digest-read` composition) | exact |
| `src/screens/HomeScreen.tsx` (MODIFY) | screen/component | — (remove header shortcuts) | self (§K) | n/a |
| `src/navigation/RootNavigator.tsx` (MODIFY) | navigation shell | request-response | self (existing `Tab.Screen` + `handleActiveTabPress`) | exact |
| `src/navigation/tabs/DigestStack.tsx` (NEW) | navigation stack | — | `src/navigation/tabs/DashboardStack.tsx` | exact (plain native-stack) |
| `src/navigation/tabs/EventsStack.tsx` (NEW) | navigation stack | — | `src/navigation/tabs/DashboardStack.tsx` | exact |
| `src/navigation/tabs/DashboardStack.tsx` (MODIFY) | navigation stack | — | self (remove `Digest` + `GroupEvents` roots) | n/a |
| `src/navigation/types.ts` (MODIFY) | config/types | — | self (param-list registration) | exact |
| `src/services/notifications/notification-nav.ts` (MODIFY) | service | event-driven (nav intent) | self (`resolveNotificationNav` digest branch) | exact |

---

## Pattern Assignments

### `src/db/your-week-read.ts` (NEW read-only DAO, aggregate read)

**Analog:** `src/db/digest-read.ts` — the canonical read-only Digest DAO. Copy its file-header contract (static string, async-only, local-wall-clock discipline, no writer/no network) verbatim in spirit.

**Import + read-only posture** (`digest-read.ts:43-49, 86-100`):
```typescript
import { PROGRESS_SQL, REASON_SQL, STATUS_SQL } from "@/db/status";
import type { SqlExecutor } from "@/db/types";
// Pure READ-ONLY: no transaction, no writer, no migration, no network —
// async getAllAsync / getFirstAsync only (NEVER the sync variants).
export function readRetrospective(exec: SqlExecutor): Promise<RetrospectiveRow[]> {
  const sql = `SELECT c.id AS id, ... MAX(i.occurred_at) AS last_reached
   FROM interactions i JOIN contacts c ON c.id = i.contact_id
  WHERE c.archived_at IS NULL
    AND date(i.occurred_at) >= date('now','localtime','${windowModifier(RETROSPECTIVE_WINDOW_DAYS)}')
  GROUP BY c.id ORDER BY last_reached DESC, c.name COLLATE NOCASE, c.id`;
  return exec.getAllAsync<RetrospectiveRow>(sql);
}
```

**Timezone rule to copy** (`digest-read.ts:30-35`, `status.ts:44-59`): only `now`
gets `'localtime'`; a STORED column (`occurred_at`, `last_contact`) is already
local wall-clock — truncate with a **bare `date(col)`**, never re-run through
`'localtime'`. Never `toISOString().split`. This is the exact rule the Your Week
date→count / metrics SQL must follow.

**Your Week app-wide date→count** — NEW aggregation (no app-wide read exists today;
every history read is per-contact). Bind period start/end as `?` params (unlike
`digest-read`'s interpolated integer modifier, the period bounds are dates → bind
them). Shape verified against `readRetrospective` idiom:
```sql
SELECT date(i.occurred_at) AS d, COUNT(*) AS n
  FROM interactions i JOIN contacts c ON c.id = i.contact_id
 WHERE c.archived_at IS NULL
   AND date(i.occurred_at) BETWEEN date(?) AND date(?)
 GROUP BY d;
-- People reached = COUNT(DISTINCT i.contact_id) over the same window.
-- Events = COUNT(*) FROM group_events WHERE date(occurred_at) BETWEEN ? AND ?.
```

**Group-Event double-count guard (§J / Pitfall 3):** group participation is stored
as `interactions` rows carrying `group_event_id` (migration 026). A naïve
`COUNT(*) FROM interactions` inflates a group event by its participant count. The
`Events` metric = `COUNT(group_events)`; day detail shows a Group Event as ONE
record. Whether group-linked child `interactions` contribute to the `Interactions`
metric + heatmap saturation is a PLANNER RECONCILIATION (RESEARCH Open Q2 / A2 =
children count unless reconciled). Note: `buckets.ts:6-9` documents the count-only
invariant on the Phase-32 side.

**Overlooked reuse (do not re-derive):** `readOverlooked` (`digest-read.ts:109-124`)
returns rogue rows via `STATUS_SQL = 'rogue'`, deliberately OMITS the mute filter,
and pre-filters `last_contact IS NOT NULL` (load-bearing — `STATUS_SQL` has no NULL
branch). Reuse verbatim for Horizon → Overlooked; do NOT write a second rogue query.

**Never-contacted reuse:** `countNeverContacted` (`dashboard-read.ts:540-554`) —
honors `include_unbound_never_contacted`. Reuse verbatim for Horizon → Never Contacted.

---

### `src/db/migrations/030-your-week-period.ts` (NEW migration)

**Analog:** `src/db/migrations/029-ai-configuration.ts` (latest shipped; version 29).

**Migration number is VERIFIED on disk:** `src/db/migrations/` runs `001`…`029`
with `024` tombstoned/renumbered (present as `profilePresentationMigration` in the
registry, not a `024-*.ts` file). Latest = **029**; new = **030**. Never assume —
this was checked against the directory listing.

**Exact additive-column pattern to copy** (`029-ai-configuration.ts:15-28`):
```typescript
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";
export const YOUR_WEEK_PERIOD_SCHEMA_VERSION = 30;
export const migration030: Migration = {
  version: YOUR_WEEK_PERIOD_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN your_week_period TEXT NOT NULL DEFAULT 'rolling7'
          CHECK(your_week_period IN ('rolling7','calendar_week'));
    `);
  },
};
```
Forward-only, irreversible in production, additive-with-DEFAULT (safe on a v1→v30
jump). This is NOT relationship-domain schema and does NOT bump
`BACKUP_FORMAT_VERSION` — satisfying D-02. The `PRAGMA user_version` sequencing is
owned by the runner (`runner.ts`), not the migration; the migration only declares
`version` + `apply`, exactly as 029 does.

---

### `src/db/migrations/database.ts` (MODIFY — the one migration registry)

**Analog:** self. Two edits, verified against current file (`database.ts:66-100`):
```typescript
// 1. Point TARGET_VERSION at the new head (currently AI_CONFIGURATION_SCHEMA_VERSION=29):
export const TARGET_VERSION = YOUR_WEEK_PERIOD_SCHEMA_VERSION; // 30
// 2. Append to the authoritative MIGRATIONS list (after migration029):
export const MIGRATIONS: Migration[] = [ ...migration028, migration029, migration030 ];
```
Also add the `import { migration030 } from "@/db/migrations/030-your-week-period"`.
`TARGET_VERSION` currently aliases `AI_CONFIGURATION_SCHEMA_VERSION` — repoint it to
the new constant so the two never drift.

---

### `src/db/app-settings-dao.ts` (MODIFY — declare-optional / emission-deferred)

**Analog:** self — the established Phase 25/31/32/34/35 pattern
(`app-settings-dao.ts:464-491`). Add `yourWeekPeriod?: 'rolling7' | 'calendar_week'`
to `PortableSettingsSnapshot` as an OPTIONAL (`?:`) field so it enters
`AppSettingsPatch` (writable via `updateAppSettings`) AND a
`getPortableSettingsSnapshot` return that OMITS it still typechecks.

**Exact contract comment to mirror** (`app-settings-dao.ts:464-473`):
```typescript
// --- History keys (Phase 32, D-11) — allowlisted + writable NOW, EMISSION
//  DEFERRED. Declared OPTIONAL (?:) ... Do NOT add these to the
//  getPortableSettingsSnapshot SELECT this phase and do NOT bump BACKUP_FORMAT_VERSION
historyLens?: HistoryLens;
historyCycleCount?: HistoryCycleCount;
```
Do the same for `yourWeekPeriod`: writable + readable now, DO NOT add to the
snapshot SELECT, DO NOT bump `BACKUP_FORMAT_VERSION` (currently 6). This is what
keeps D-02 satisfied without a backup bump.

---

### `src/services/history/week-window.ts` (NEW — locale-aware Calendar Week)

**Analog:** `src/services/history/window.ts` — `buildSevenDays` (`window.ts:90-100`).

Rolling-7 already exists and is node-tested — REUSE `buildSevenDays` for the
`rolling7` period, do not re-build it. Only the **Calendar Week** builder is new:
```typescript
// buildSevenDays (REUSE for rolling7): window.ts:90-100 — clamped-to-today,
// local-date-safe. Returns HistoryWindow { lens, ref, start, end, cells }.
function buildSevenDays(refDate: string, today: string): HistoryWindow { ... }
```
`window.ts` hardcodes Sunday-first padding (`weekdayOf` → `getDay()===0`, see
`buildMonth` at :108). The NEW `week-window.ts` must derive the first day of week
from `expo-localization` `getCalendars()[0].firstWeekday` (§I: no Orbit-specific
Sunday/Monday preference), degrading to Sunday-first if unavailable. Emit the same
`HistoryWindow` cell shape so it feeds `buckets()`/`ActivityHeatmap` unchanged.

---

### `src/screens/DigestScreen.tsx` (REWRITE → Up Next / Horizon / Your Week)

**Analog:** self — keep the shipped focus-effect read pattern; swap the reads.

**Focus-effect + cancelled-flag + null-vs-loaded sentinel to KEEP** (`DigestScreen.tsx:91-119`):
```typescript
useFocusEffect(useCallback(() => {
  let cancelled = false;
  (async () => {
    try {
      const exec = getExecutor();
      const [retrospective, overlooked, gentle, backlog] = await Promise.all([
        readRetrospective(exec), readOverlooked(exec),
        readGentleLine(exec), countNeverContacted(exec),
      ]);
      if (!cancelled) setState({ phase: "loaded", data: {...} });
    } catch (err) { if (!cancelled) setState({ phase: "error" }); }
  })();
  return () => { cancelled = true; };
}, []));
```
Rewrite the `Promise.all` reads to the new composition: Up Next + Horizon-Overlooked
via `status.ts` fragments + `readOverlooked`; Birthdays via `listBirthdayCandidates`
+ `daysUntilBirthday` (7-day filter — see Shared Patterns); Your Week via the new
`your-week-read.ts`. Async only, no writer, no network (local-first read path).

**Up Next ordering (D-04):** ORDER BY the same `progress DESC` idiom `readOverlooked`
uses (`digest-read.ts:122`) so overdue/rogue naturally outrank approaching — no
Digest-local urgency classification. Cap at 3. Up Next takes first claim; Horizon
Overlooked must exclude Up Next's chosen contact ids for the same condition (NEW
dedup logic, must be explicit + tested — Pitfall 4/§E).

**Presentation constraints (UI-SPEC):** `AppText` roles (heading/body/label/caption),
`SPACING` tokens (module gap = `lg`), status via shared `ContactCard` status ring
only (`colors.rogue`/`statusDecay`/`statusWobble`/`statusStable`), heatmap via
`colors.heatmapScale` verbatim, day-selection structural (border + a11y state), no
new colour token. Migrate the legacy inline `fontSize`/`padding:16`/`gap:12/24`
literals to roles/tokens.

**Your Week heatmap (RESEARCH Open Q1 / A3 — planner decides):** reuse the
`buckets`/`heatmapLevel` (`buckets.ts:52-86`) + `classifyHeatmapCell` +
`heatmapScale` cell helpers, NOT the whole `ActivityHeatmap` component (it ships a
lens switcher + prev/next nav that §J forbids). Day detail is app-wide, but
`DateDetailSheet` shows no contact name (built per-contact) — extend rows with
who, or render an inline app-wide list (Open Q3).

---

### `src/navigation/RootNavigator.tsx` (MODIFY — 4→5 tabs)

**Analog:** self. Current shell verified: `initialRouteName="DashboardTab"`
(`RootNavigator.tsx:191`), four `Tab.Screen`s (`:215-250`), each wiring
`handleActiveTabPress` (`:91-118`, popToTop, route-agnostic).

**Exact `Tab.Screen` + reselect-to-root pattern to replicate for Digest + Events**
(`RootNavigator.tsx:215-223`):
```tsx
<Tab.Screen
  name="DashboardTab" component={DashboardStack}
  options={({ route }) => tabOptions("Dashboard", route, "Home")}
  listeners={({ navigation, route }) => ({
    tabPress: (event) => handleActiveTabPress(event, navigation, route),
  })}
/>
```
Changes: add `DigestTab` (component `DigestStack`) + `EventsTab` (component
`EventsStack`); remove `BackupTab` (`:233-241`); order Contacts·Events·Digest·
Orrery·Settings; set `initialRouteName="DigestTab"`; relabel the `tabOptions`
title `"Dashboard"→"Contacts"`. **Do NOT rename the internal `DashboardTab` route
name** — the FAB hardcodes `navigate("DashboardTab", …)` (Pitfall 1); relabel only
the visible title. Icons resolve via `TAB_ICON[route.name]` (`:205-212`) — add
registry entries for the new tab route names.

---

### `src/navigation/tabs/DigestStack.tsx` + `EventsStack.tsx` (NEW)

**Analog:** `src/navigation/tabs/DashboardStack.tsx` (plain native-stack). Copy its
structure exactly (`DashboardStack.tsx:30-75`):
```tsx
const Stack = createNativeStackNavigator<DigestStackParamList>();
export function DigestStack() {
  return (
    <Stack.Navigator initialRouteName="Digest" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Digest" component={DigestScreen} />
      <Stack.Screen name="Profile" component={ContactProfileScreen} />
      {/* + shared child routes needed for origin-aware Profile Back (§L) */}
    </Stack.Navigator>
  );
}
```
DigestStack root = `DigestScreen`; EventsStack root = `GroupEventsScreen`. Register
the shared child routes each needs so Digest→Profile→Back→Digest and
Events→…→Profile→Back→Events work (§L/S.2). **Do NOT copy `OrreryStack`'s
blur/`useOrrerySessionStore` listener** (`OrreryStack.tsx:29-46`) — that is
orrery-session-specific; the plain `DashboardStack` shape is the correct analog.

---

### `src/navigation/tabs/DashboardStack.tsx` (MODIFY)

Remove the `Digest` (`DashboardStack.tsx:69`) and `GroupEvents` (`:39`) screens —
they become tab roots in DigestStack/EventsStack. Keep everything else. Verify no
in-stack `navigate("Digest"|"GroupEvents")` callers remain within DashboardStack's
own screens before removing.

---

### `src/navigation/types.ts` (MODIFY)

**Analog:** self. Add `DigestTab` + `EventsTab`, remove `BackupTab` from
`TabParamList`; add `DigestStackParamList` + `EventsStackParamList`; register
`Profile` (and other shared children) in each new list — mirroring how `Profile` is
already registered in `DashboardStackParamList`/`OrreryStackParamList`/
`SettingsStackParamList` (RESEARCH S.2, `types.ts:14-26,74,170,290`). Confirm
`focused-route-classification.ts` treats the Digest/Events roots as NOT
focused-workflows.

---

### `src/services/notifications/notification-nav.ts` (MODIFY)

**Analog:** self — the digest branch of `resolveNotificationNav`
(`notification-nav.ts:83-93`). Currently resets `[Home, Digest]` at index 1
*inside DashboardTab*:
```typescript
if (... (data as Record<string, unknown>).kind === "digest") {
  return { type: "reset", index: 1, routes: [{ name: "Home" }, { name: "Digest" }] };
}
```
Repoint the digest intent to select/reset the **Digest tab root** (Digest is now its
own tab, not a pushed screen inside DashboardTab) — §N/S.13. Audit
`notification-gate.tsx` nesting. No legacy-migration machinery (no production users,
§N). The digest payload carries no `contactId` — keep the pre-narrowing check.

---

## Shared Patterns

### Query-time status (DERIVED-NEVER-STORED)
**Source:** `src/db/status.ts:40-104` (`PROGRESS_SQL`/`STATUS_SQL`/`REASON_SQL`;
thresholds `STABLE_MAX=0.8`, `WOBBLE_MAX=1.0`, `ROGUE_K=3`).
**Apply to:** Up Next ordering + Horizon Overlooked (via `readOverlooked`). Never
invent a Digest-local urgency score (D-04). Only closed constants are interpolated —
no user free-text.

### Local-wall-clock date discipline
**Source:** `status.ts:44-59`, `digest-read.ts:30-35`. `date('now','localtime')` for
now; **bare `date(col)`** for stored columns; bind period dates as `?`. In TS use
`formatLocalDate()` (`src/utils/dates.ts:17`), never `toISOString().split('T')[0]`.
**Apply to:** every new Your Week read + week-window builder.

### Birthday days-until (single parser)
**Source:** `src/logic/birthday-logic.ts:165-204` (`daysUntilBirthday`) +
`src/db/dashboard-read.ts:620-628` (`listBirthdayCandidates` → `{id,name,birthday}`).
**Apply to:** Horizon → Birthdays. Reuse the parser but filter to a NEW 7-day
forward window `0 <= days <= 6`, soonest-first (§F/D-06). Do NOT reuse
`resolveBirthdayWindow`/`countBirthdayPopulation` — those are the Dashboard's 30-day
population (`dashboard-read.ts:585-600`, ADR-076), a different surface. Window is
independent of the Your Week period (§I).

### Settings declare-optional / emission-deferred
**Source:** `src/db/app-settings-dao.ts:464-491`. **Apply to:** `yourWeekPeriod` —
writable/readable now, NOT emitted in the snapshot SELECT, NO `BACKUP_FORMAT_VERSION`
bump (currently 6). Guards D-02.

### Heatmap bucketing helpers (count-only)
**Source:** `src/services/history/buckets.ts:52-86` (`buckets`, `heatmapLevel`) +
`heatmap-cell.ts` (`classifyHeatmapCell`) + `colors.heatmapScale`.
**Apply to:** Your Week heatmap — reuse helpers, not the whole `ActivityHeatmap`
chrome. Count-only invariant already prevents Group-Event double-count on the Phase-32
side (`buckets.ts:6-9`), but the NEW app-wide SQL must handle `group_event_id`
explicitly (Pitfall 3).

### Reselect-tab-to-root
**Source:** `RootNavigator.tsx:91-118` (`handleActiveTabPress`, route-agnostic
popToTop). **Apply to:** all five tabs via identical `listeners={{ tabPress }}`.

---

## No Analog Found

None. Every file has a close on-disk analog. The only genuinely NEW *logic* (no
direct analog, must be built + tested fresh) is:

| Work | Role | Data Flow | Note |
|------|------|-----------|------|
| App-wide (all-contacts) date→count + period metrics | DAO aggregate read | request-response | No app-wide history read exists; every current history read is per-contact. Built from `digest-read` posture + `buckets` shape. |
| Locale-aware Calendar Week builder | service (pure) | transform | Only Rolling-7 exists (`buildSevenDays`); Calendar Week is new (`expo-localization firstWeekday`). |
| Up Next ↔ Horizon dedup | screen/composition logic | transform | No existing helper (§E); must be explicit + tested. |

---

## Metadata

**Analog search scope:** `src/db/`, `src/db/migrations/`, `src/logic/`,
`src/services/history/`, `src/services/notifications/`, `src/navigation/`,
`src/navigation/tabs/`, `src/screens/`.
**Files opened + verified this session:** `digest-read.ts`, `status.ts`,
`dashboard-read.ts`, `birthday-logic.ts`, `app-settings-dao.ts`,
`migrations/029-ai-configuration.ts`, `migrations/database.ts` (registry),
`services/history/window.ts`, `services/history/buckets.ts`,
`notifications/notification-nav.ts`, `RootNavigator.tsx`, `tabs/DashboardStack.tsx`,
`tabs/OrreryStack.tsx`, `DigestScreen.tsx`, plus the `migrations/` directory listing.
**Pattern extraction date:** 2026-09-18
</content>
</invoke>
