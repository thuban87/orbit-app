# Phase 15: Weekly Digest - Pattern Map

**Mapped:** 2026-08-23
**Files analyzed:** 14 (4 new, 10 modified)
**Analogs found:** 14 / 14 (every file has a strong in-repo analog — this phase invents almost no new mechanism)

> Read the analog on disk before copying (CLAUDE.md "review the code, not the diff"). All line
> numbers below were verified against the working tree this session. Where a citation spans a range,
> the excerpt is the load-bearing part; open the full analog for surrounding context.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/digest-read.ts` *(new)* | model / DAO | CRUD (read-only) | `src/db/dashboard-read.ts` | exact (role + read posture) |
| `src/logic/digest-logic.ts` *(new)* | utility (pure logic) | transform | `src/db/status.ts` (string-const posture) + existing `src/logic/*-logic.ts` | role-match |
| `src/services/notifications/digest-schedule.ts` *(new)* | service | event-driven / batch (reconcile) | `src/services/notifications/notification-schedule.ts` (`reconcileSchedule` + sweep-hook + `scheduleOne`) | exact |
| `src/db/migrations/005-digest-settings.ts` *(new)* | migration | schema (ADD COLUMN) | `src/db/migrations/004-ai-settings.ts` | exact |
| `src/screens/DigestScreen.tsx` *(new)* | component (screen) | request-response (focus reload) | `src/screens/NeverContactedScreen.tsx` (chrome + focus-effect) | exact |
| `src/db/app-settings-dao.ts` *(mod)* | model / DAO | CRUD | its own `decayEnabled`/`birthdayEnabled` plumbing | exact (in-file) |
| `src/services/notifications/notification-ids.ts` *(mod)* | config | — | its own `BIRTHDAY_CHANNEL` / `birthdayBody` / `NotificationData` | exact (in-file) |
| `src/services/notifications/channels.ts` *(mod)* | config | — | its own `ensureChannels()` birthday channel | exact (in-file) |
| `src/services/notifications/notification-nav.ts` *(mod)* | utility (nav resolver) | transform | its own `birthday` navigate branch | exact (in-file) |
| `src/screens/SettingsScreen.tsx` *(mod)* | component (screen) | CRUD (persist) | its own "Birthday alerts" toggle row (:702-738) | exact (in-file) |
| `src/screens/HomeScreen.tsx` *(mod)* | component (screen) | request-response | its own top-bar `◎`/`⚙` Pressables (:485-514) | exact (in-file) |
| `src/navigation/RootNavigator.tsx` *(mod)* | route | — | existing `<Stack.Screen>` registrations | exact (in-file) |
| `src/navigation/types.ts` *(mod)* | config (types) | — | existing `RootStackParamList` entries | exact (in-file) |
| `src/db/database.ts` *(mod)* | config (migration registry) | — | existing migration004 registration | exact (in-file) |

---

## Pattern Assignments

### `src/db/digest-read.ts` (DAO, read-only) — 3 reads

**Analog:** `src/db/dashboard-read.ts` (read chokepoint) + SQL constants from `src/db/status.ts`.

**Read posture / imports** — pure async, `getAllAsync`/`getFirstAsync` only (NEVER the sync variants),
no transaction, no network. Header contract at `dashboard-read.ts:1-17`. Reuse `SqlExecutor` type and
import `PROGRESS_SQL`/`STATUS_SQL`/`REASON_SQL`/`ROGUE_K` from `status.ts` — **read, never re-derive**
(the CLAUDE.md single-shared-rogue-constant rule).

**Timezone rule (retrospective + overlooked)** — `status.ts:44-59` / `dashboard-read.ts:28-31`: only
`now` is converted to local; a STORED column (`occurred_at`, `last_contact`) is already local wall-clock
and is truncated with a **bare** `date(col)`. `PROGRESS_SQL` (status.ts:59):
```
CAST(julianday(date('now','localtime')) - julianday(date(last_contact)) AS REAL) / interval_days
```
Retrospective window uses `date('now','localtime','-6 days')` (7-day inclusive). Never
`toISOString().split` (the documented, once-fixed UTC off-by-one — dates.ts).

**Overlooked = the INVERSE of decay-suppression** — do NOT reuse `DECAY_ELIGIBLE_WHERE`
(decay-suppression.ts:58-62 excludes exactly rogue/rarely_responds/muted/never-contacted). Query
`STATUS_SQL = 'rogue'` directly, split by `REASON_SQL` (`'overdue'`→Drifting, `'unresponsive'`→Gone quiet
— status.ts:95-99 branch order is identical to STATUS_SQL so status/reason never disagree), and
**deliberately omit** the `reminders_off = 0` filter. Pre-filter `c.last_contact IS NOT NULL` (STATUS_SQL
has no NULL branch — status.ts NULL note at :52-57; a NULL `last_contact` would falsely bucket 'stable').

**Backlog count** — reuse verbatim, do not re-COUNT:
```typescript
// dashboard-read.ts:305-308
export function countNeverContacted(exec: SqlExecutor): Promise<number> {
  return count(exec, "archived_at IS NULL AND last_contact IS NULL");
}
```
The generic `count` helper (dashboard-read.ts:298-303) is the shape to mirror for the gentle-line tally
if a COUNT is used.

**Gentle-line quality tally** — `interactions.quality` is `good|fine|hard|null`; count idiom from
`ai-context-read.ts:122-140` (cited in RESEARCH Code Examples): tally `hard` vs total non-null, threshold
applied in `digest-logic.ts`, not SQL.

**Injection posture** — every query is a static string interpolating ONLY code-constants
(`PROGRESS_SQL`/`STATUS_SQL`/`ROGUE_K`); any runtime value `?`-bound. Matches status.ts / dashboard-read.ts.

**Testing** — `node:sqlite` DAO test (`src/db/digest-read.test.ts`) reusing `src/db/__testkit__/node-sqlite.ts`.

---

### `src/logic/digest-logic.ts` (pure utility, transform)

**Analog:** `src/db/status.ts` (top-of-file tunable-constant posture) + the repo's `src/logic/*-logic.ts`
node-tested convention (RESEARCH: "pure logic extracted to `src/logic/*-logic.ts`, react-native-free").

**Tunables at top of file** (single-number edits — CLAUDE.md convention; mirror status.ts:40-42):
delivery weekday (Sunday), morning hour, quiet-window bounds (shared with 11-notify), the retrospective
window length, the group cap (~6), and the "skews hard" threshold. RESEARCH Code Example (lines 348-357)
gives the conservative dual-gate shape — require BOTH an absolute floor AND a fraction:
```typescript
const show = hard >= EFFORTFUL_MIN_HARD && hard / Math.max(total, 1) >= EFFORTFUL_MIN_FRACTION;
```

**Core transforms:** day-tag ("Tue") derived from `MAX(occurred_at)` (NOT in SQL); Drifting/Gone-quiet
split by `reason`; group cap slice + "+N more" overflow math; the unified "all quiet" predicate.

**Testing** — `src/logic/digest-logic.test.ts` (vitest, node-pure).

---

### `src/services/notifications/digest-schedule.ts` (service, reconcile) — its OWN service + sweep hook

**Analog:** `src/services/notifications/notification-schedule.ts`. **Must NOT fold into `reconcileSchedule`** —
`isOwnedIdentifier` matches only `decay:`/`birthday:` (notification-schedule.ts:287-289) and a test asserts a
`digest:*` id is never cancelled (notification-schedule.test.ts:505). A `digest:weekly` id coexists safely.

**Schedule-one pattern** (mirror `scheduleOne`, notification-schedule.ts:339-355, but WEEKLY trigger):
```typescript
await scheduleNotificationAsync({
  identifier: "digest:weekly",
  content: { body: DIGEST_BODY, title: DIGEST_TITLE,
             data: { kind: "digest" }, autoDismiss: true },
  trigger: {
    type: SchedulableTriggerInputTypes.WEEKLY,   // sibling of the .DATE used at :351
    channelId: DIGEST_CHANNEL,                    // new digest-v1
    weekday: 1,                                   // 1 = Sunday (device-spike verify)
    hour: DELIVERY_HOUR, minute: 0,
  },
});
```

**Idempotent reconcile** (mirror the full-request diff, notification-schedule.ts:308-336): read
`digest_enabled` + master toggle + `deliveryHour` via `getAppSettings`; read
`getAllScheduledNotificationsAsync()`; enabled&absent→schedule; disabled(or master-off)&present→cancel;
enabled&drifted(weekday/hour)→cancel+reschedule. Running twice yields exactly one `digest:weekly`.

**Own launch-sweep hook** — mirror `registerNotificationScheduleSweep` verbatim (notification-schedule.ts:520-526):
```typescript
export function registerDigestScheduleSweep(getExec: () => SqlExecutor): void {
  registerSweepHook(async () => { await reconcileDigestSchedule(getExec()); });
}
```
`registerSweepHook` is at launch-sweep.ts:45; launch-sweep.ts:6 already NAMES "digest re-register" as a
future responsibility. Importing the module must run NOTHING (no module-scope side effect — launch-sweep.ts:11-13).

**Testing** — `src/services/notifications/digest-schedule.test.ts` (expo double): idempotent / toggle / drift.

---

### `src/db/migrations/005-digest-settings.ts` (migration, ADD COLUMN)

**Analog:** `src/db/migrations/004-ai-settings.ts` — exact structural copy.

**OWNER-RULED (CONTEXT:83-98):** add `app_settings.digest_enabled INTEGER NOT NULL DEFAULT 1`. This is an
owner decision, NOT a schema-violation "bug fix" — do not remove it. Phase 15 owns **005**; Phase 16's
`sync_tombstones` renumbers to **006**.

**Structure to copy** (004-ai-settings.ts:36-104): header documenting additive/irreversible-safe; exported
DDL const; a `Migration` object with `version` + `apply(exec, _deps)`:
```typescript
export const ADD_DIGEST_ENABLED = `
ALTER TABLE app_settings
  ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 1;`;

export const migration005: Migration = {
  version: 5,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(ADD_DIGEST_ENABLED);
  },
};
```
Additive, constant DEFAULT → `ADD COLUMN` legal in SQLite, starting-state-independent (004 header:5-13).
Register in `src/db/database.ts` alongside migration004. Add a `node:sqlite` migration test asserting the
column exists and defaults to 1 (mirror the 004 pragma-column-list test).

---

### `src/db/app-settings-dao.ts` (DAO, in-file extension)

**Analog:** the existing `decayEnabled`/`birthdayEnabled` plumbing in this same file — thread
`digestEnabled` through EVERY list it appears in:
- `WritableSettingsKey` union (:100-113) — add `"digestEnabled"`.
- `AppSettingsRow` interface (:116-135) — add `digest_enabled: number`.
- `TOGGLE_FIELDS` (:144-150) — add `"digestEnabled"` so `assertToggle` (:229-236) guards the 0/1 write
  (V5 input-validation, RESEARCH Security).
- `COLUMN_OF` map (:157-172) — add `digestEnabled: "digest_enabled"`.
- `getAppSettings` SELECT (:182-190) + return object (:194-217) — add the column and
  `digestEnabled: (row.digest_enabled ? 1 : 0) as 0 | 1`.
- The `AppSettings` type + `AppSettingsPatch` (wherever `birthdayEnabled` is declared).

---

### `src/screens/DigestScreen.tsx` (screen)

**Analog:** `src/screens/NeverContactedScreen.tsx` (chrome + focus-effect reload).

**Focus-effect reload with cancelled-flag guard** (NeverContactedScreen.tsx:66-82) — extend to run the
three digest reads (parallel), with a null-vs-loaded sentinel so "all quiet" never flashes before data
(UI-SPEC Interaction contract):
```typescript
useFocusEffect(useCallback(() => {
  let cancelled = false;
  (async () => {
    try { const next = await /* three digest reads */; if (!cancelled) setState(next); }
    catch (err) { Logger.error(LOG_SCOPE, "...", err); if (!cancelled) setError(); }
  })();
  return () => { cancelled = true; };
}, [/* deps */]));
```

**Chrome** — themed root over `colors.background` (NeverContactedScreen.tsx:85-88), header row with a
`goBack` Back control + 24/700 title "Your week"; `headerShown:false` (renders own Back). Reuse
`ContactCard`/`Avatar`/`RankedFuelLine`. All colours via `useTheme().colors.*` — no raw hex
(`check:colors` gate). Section order + copy + testIDs are locked in UI-SPEC §Screen Anatomy. Static content
— NO Skia loop / per-frame state.

---

### `src/services/notifications/notification-ids.ts` (config, in-file)

**Analog:** its own `BIRTHDAY_CHANNEL` (:44) + `birthdayBody` (:88) + `NotificationData` (:100-104). Add:
- `DIGEST_CHANNEL = "digest-v1"` alongside BIRTHDAY_CHANNEL (:42-44).
- Frozen copy consts `DIGEST_TITLE = "Your week in Orbit"` / `DIGEST_BODY = "A look back at who you reached."`
  (UI-SPEC Notification Copy) — frozen-generic, names no one (:81-83 posture).
- Extend `NotificationData.kind` to `"decay" | "birthday" | "digest"` and make `contactId`/`occurrenceKey`
  optional for digest (a digest carries no contactId).

---

### `src/services/notifications/channels.ts` (config, in-file)

**Analog:** the birthday channel in `ensureChannels()` (channels.ts:54-58). Add a `digest-v1` channel,
`AndroidImportance.LOW`, `AndroidNotificationVisibility.PRIVATE` (generic copy names no one → safe on a
public lock screen; mirrors birthday). **Never mutate an existing channel** — importance/visibility are
IMMUTABLE at creation (channels.ts:2-24); a future change ships as `digest-v2`.
```typescript
await setNotificationChannelAsync(DIGEST_CHANNEL, {
  name: "Weekly digest",
  importance: AndroidImportance.LOW,
  lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
});
```

---

### `src/services/notifications/notification-nav.ts` (nav resolver, in-file)

**Analog:** the `birthday` navigate branch (notification-nav.ts:74-79). Two edits:
- Extend `isNotificationData` narrowing (:43-52) to accept `kind === "digest"` **without** requiring a
  numeric `contactId` (untrusted OS-input boundary — V5; a digest intent carries nothing to forge).
- Add a `NavIntent` variant `{ type: "navigate"; name: "Digest" }` and a `data.kind === "digest"` branch
  returning it (no params). Back→dashboard is automatic (Home is `initialRouteName`). Malformed → null (unchanged).

**Testing** — extend `notification-nav.test.ts` (`digest → navigate "Digest"`; malformed → null).

---

### `src/screens/SettingsScreen.tsx` (screen, in-file)

**Analog:** the "Birthday alerts" toggle row (SettingsScreen.tsx:702-738) — copy the whole `<View style={styles.row}>`
block, inserted AFTER birthday (:738) and BEFORE lock-screen (:741). Change label→"Weekly digest",
`testID="settings-notifications-digest"`, `accessibilityLabel="Weekly digest"`, value/`checked`→`digestEnabled === 1`,
helper copy per UI-SPEC. Gated-label idiom (`masterOn ? textPrimary : textSecondary`, :713), `disabled={!masterOn}`,
`trackColor={{ false: colors.border, true: colors.accent }}`, `thumbColor={colors.surfaceElevated}`.

**Persist + reconcile** — the `persist` callback (:350-360) currently fires only `reconcileSchedule` (decay/birthday).
The digest toggle MUST also fire `reconcileDigestSchedule(exec)` (Pitfall 7). Either extend `persist` to fire both,
or give the digest row a sibling handler:
```typescript
onValueChange={(v) => void persistDigest({ digestEnabled: v ? 1 : 0 })}
// persistDigest = updateAppSettings + getAppSettings + void reconcileDigestSchedule(exec)
```

---

### `src/screens/HomeScreen.tsx` (screen, in-file)

**Analog:** the top-bar `◎` Orrery Pressable (HomeScreen.tsx:486-503). Add a discreet "Your week" TEXT
Pressable as the LEFTMOST item in `styles.topBar` (:485), so the `◎`/`⚙` glyph cluster stays grouped
right. 15/600 `textSecondary`, pressed→`accent` (the `({ pressed }) =>` idiom at :493-502),
`minHeight:44`, `accessibilityRole="button"`, `accessibilityLabel="Your week"`,
`testID="dashboard-your-week-entry"`, `onPress={() => navigation.navigate("Digest")}`. No badge (locked).

---

### `src/navigation/RootNavigator.tsx` + `src/navigation/types.ts` (route, in-file)

**Analog:** existing `<Stack.Screen>` registrations + `RootStackParamList` entries. Add `Digest: undefined`
to the param list and `<Stack.Screen name="Digest" component={DigestScreen} options={{ headerShown: false }} />`
(the screen renders its own Back chrome).

---

## Shared Patterns

### Read-only DAO posture
**Source:** `src/db/dashboard-read.ts:1-31`, `src/db/status.ts`
**Apply to:** `digest-read.ts` — async `getAllAsync`/`getFirstAsync` only, no transaction, no network;
import status/rogue SQL constants, never re-derive; bare `date(stored)` + `date('now','localtime')`;
interpolate ONLY code-constants, `?`-bind runtime values.

### Notification engine coexistence (do not fold in)
**Source:** `notification-schedule.ts:287-289,520-526`, `notification-schedule.test.ts:505`
**Apply to:** `digest-schedule.ts` — own register/cancel + own sweep hook; `reconcileSchedule` must stay
decay/birthday-only. Regression-guard the non-clobber in `notification-schedule.test.ts`.

### app_settings toggle plumbing
**Source:** `app-settings-dao.ts` `decayEnabled`/`birthdayEnabled` across `WritableSettingsKey` / `AppSettingsRow`
/ `TOGGLE_FIELDS` / `COLUMN_OF` / `getAppSettings`; `assertToggle` (:229-236)
**Apply to:** the `digest_enabled` thread + the Settings toggle row (0/1 validated on write — V5).

### Additive migration
**Source:** `migrations/004-ai-settings.ts`
**Apply to:** `005-digest-settings.ts` — `ADD COLUMN … NOT NULL DEFAULT 1`, register in `database.ts`,
`node:sqlite` pragma-column test. Forward-only, irreversible-safe.

### Focus-effect reload with cancelled guard
**Source:** `NeverContactedScreen.tsx:66-82` (also `HomeScreen.tsx:137-169`)
**Apply to:** `DigestScreen.tsx` — plus a null-vs-loaded sentinel to avoid an "all quiet" flash.

### Channel immutability
**Source:** `channels.ts:2-24,54-58`, `notification-ids.ts:35-44`
**Apply to:** the `digest-v1` channel — create only, version the id, never re-set an existing id.

---

## No Analog Found

None. Every file maps to a shipped analog (this is a composition-over-invention phase — RESEARCH Summary).
The single genuinely new *mechanism* is the `SchedulableTriggerInputTypes.WEEKLY` trigger; even it reuses
the `scheduleOne`/reconcile/sweep-hook scaffolding (the `.DATE` sibling), device-spike-gated for weekday/reboot.

## Metadata

**Analog search scope:** `src/db/`, `src/db/migrations/`, `src/logic/`, `src/services/notifications/`,
`src/services/launch-sweep.ts`, `src/screens/`, `src/navigation/`.
**Files read this session:** dashboard-read.ts, status.ts, migrations/004-ai-settings.ts, app-settings-dao.ts,
notification-schedule.ts, launch-sweep.ts, notification-nav.ts, notification-ids.ts, channels.ts,
SettingsScreen.tsx, HomeScreen.tsx, NeverContactedScreen.tsx (+ the three phase artifacts).
**Pattern extraction date:** 2026-08-23
