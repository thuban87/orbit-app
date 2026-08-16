# Phase 11: Actionable Notifications - Pattern Map

**Mapped:** 2026-08-16
**Files analyzed:** 15 planned files (13 new + 2 modified UI)
**Analogs found:** 15 / 15 (all have a strong in-repo analog; expo-notifications wiring itself is the only genuinely new code, and it composes existing DAOs/hooks)

> Read the ACTUAL analog on disk before copying — every file:line below was opened this session. This phase's hard parts were already solved by earlier phases' single-writer discipline; the new code is scheduling *policy* + *wiring* over existing, mutexed, node-tested primitives.

## File Classification

| Planned File | Role | Data Flow | Closest Analog | Match Quality |
|--------------|------|-----------|----------------|---------------|
| `src/db/snooze-dao.ts` (NEW) | model/dao (writer) | CRUD (write) | `src/db/favourites-dao.ts` (single-col UPDATE) + `src/db/events-dao.ts` (immutable insert, in one txn) | exact (compose of two) |
| `src/db/snooze-dao.test.ts` (NEW) | test | — | `src/db/recency-dao.test.ts` (in-memory sqlite + mutex) | exact |
| `src/db/notification-read.ts` (NEW) | model/dao (read) | request-response (read) | `src/db/dashboard-read.ts` (suppression predicate + status fragment reuse) | exact |
| `src/db/notification-read.test.ts` (NEW) | test | — | `src/db/dashboard-read.test.ts` (SQL-parity, in-memory sqlite) | exact |
| `src/services/notifications/fire-instant.ts` (NEW) | utility (pure) | transform | `src/logic/birthday-logic.ts` (pure, node-tested, tunable const at top) | exact (role+flow) |
| `src/services/notifications/fire-instant.test.ts` (NEW) | test | — | `src/logic/birthday-logic.test.ts` | exact |
| `src/services/notifications/decay-suppression.ts` (NEW) | utility (SQL fragment) | transform | `src/db/status.ts` (exported SQL string constants, no writes) | exact |
| `src/services/notifications/notification-schedule.ts` (NEW) | service | event-driven (reconcile) | `src/services/field-sweep.ts` (registerXSweep + registerSweepHook + lazy getExec) | exact |
| `src/services/notifications/channels.ts` (NEW) | service/config | request-response | (no in-repo analog — expo-notifications API; RESEARCH Pattern 3) | no analog |
| `src/services/notifications/notification-actions.ts` (NEW) | service | event-driven | `src/db/recency-dao.ts` `recordTouchpoint` + `events-dao` `recordEvent` (the writes it funnels to) | role-match |
| `src/services/notifications/headless-task.ts` (NEW) | service | event-driven | (no in-repo analog — TaskManager/registerTaskAsync; RESEARCH Pattern 4) | no analog |
| `src/services/notifications/permission.ts` (NEW) | service | request-response | (no in-repo analog — OS permission; RESEARCH §Permission) | no analog |
| `src/db/migrations/002-app-settings.ts` (NEW) | migration | CRUD (DDL) | `src/db/migrations/001-initial.ts` + `runner.ts` (forward-only user_version) | exact |
| `src/stores/notification-settings-*` OR settings-dao (NEW) | store/dao | CRUD | OWNER PICKED **SQLite** (OQ-1) → `favourites-dao.ts` writer + `dashboard-read.ts` reader; NOT `dashboard-prefs-store.ts` | role-match |
| `src/screens/SettingsScreen.tsx` (MODIFIED) | screen | — | self (`styles.row` idiom) + `EditContactScreen` Switch contract | exact |
| `src/screens/EditContactScreen.tsx` (MODIFIED) | screen | — | self (existing `reminders_off` Switch at :679-693 — COPY-ONLY relabel) | exact |
| `src/screens/ContactProfileScreen.tsx` (MODIFIED) | screen | — | self (`Message`/`Log contact` action block :591-620) + `FilterChipRow` chip idiom | exact |
| `App.tsx` (MODIFIED) | root wiring | — | self (`fieldSweepRegistered` / `photoReconcileRegistered` module-guard + ready-gated effect :83-103) | exact |
| `app.config.ts` (MODIFIED) | config | — | self (Set-dedupe string plugins :57-99) | exact |

---

## Pattern Assignments

### `src/db/snooze-dao.ts` (dao writer, first writer of `contacts.snooze_until`)

**Analogs:** `src/db/favourites-dao.ts` (single-column `?`-bound UPDATE + `changes===1` guard) and `src/db/events-dao.ts` (immutable insert composed inside one txn).

**Storage contract (load-bearing):** `dashboard-read.ts:33-36` — `snooze_until` must be a local `YYYY-MM-DD` (or `YYYY-MM-DD HH:MM:SS`) string, compared via **bare** `date(c.snooze_until) <= date('now','localtime')` (dashboard-read.ts:144). Write it with `formatLocalDate()` / local wall-clock — **never** `toISOString()` (RESEARCH Pitfall 8). This DAO is that contract's first writer; `countSnoozed` (dashboard-read.ts:314) and the `snoozed` filter branch (:231-235) go live once it ships.

**Single-column writer skeleton to copy** (`favourites-dao.ts:30-49`):
```typescript
export function setFavouriteRank(exec: SqlExecutor, id: number, now: string): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE contacts SET favourite_rank = (...), modified_at = ? WHERE id = ?`,
      [now, id],
    );
    if (result.changes !== 1) {
      throw new Error(`setFavouriteRank: no contact matched id=${id} (changed ${result.changes})`);
    }
  });
}
```
For snooze: `UPDATE contacts SET snooze_until = ?, modified_at = ? WHERE id = ?` (set path); `snooze_until = NULL` (clear path). **Must NOT touch `last_contact`** (DATA-04 — recency-dao is its sole writer; favourites-dao.ts:6-13 documents this "never references the recency column" discipline).

**Immutable snooze event in the SAME txn** — compose `recordEventCore` (NON-mutexed core, `events-dao.ts:62-81`) inside the one `inWriteTransaction`, NOT the mutexed `recordEvent` wrapper (nesting the non-reentrant mutex is a PERMANENT hang — recency-dao.ts:148-156, events-dao.ts:21-26). `EventType` already reserves `"snooze"`/`"unsnooze"` (events-dao.ts:38) with no producer yet — this DAO is the first producer. Set clear → optional `"unsnooze"` event.

```typescript
// inside ONE inWriteTransaction:
await exec.runAsync(`UPDATE contacts SET snooze_until = ?, modified_at = ? WHERE id = ?`, [until, now, id]);
if (result.changes !== 1) throw new Error(...);        // loud rollback (favourites-dao guard)
await recordEventCore(exec, { contactId: id, uid, type: "snooze", occurredAt: now, now, detail: null });
```
Both the in-app profile presets (3d/1wk/1mo) AND the headless +1wk snooze call THIS DAO — one writer, one contract.

---

### `src/db/notification-read.ts` (dao read — decay-suppression + birthday candidates)

**Analog:** `src/db/dashboard-read.ts` (pure read; async `getAllAsync` only; RE-USES status fragments, never re-derives).

**Reuse, never re-type** (dashboard-read.ts:54-55 imports): pull `PROGRESS_SQL`, `WOBBLE_MAX`, `ROGUE_K` from `@/db/status` (status.ts:40-59). Never a second rogue cutoff (RESEARCH Anti-pattern; CLAUDE.md).

**Decay-suppression predicate** — a contact is decay-eligible when ALL hold (mirror `BASE_WHERE` dashboard-read.ts:142-144 + the columns):
```sql
last_contact IS NOT NULL                                                       -- not never-contacted
AND (snooze_until IS NULL OR date(snooze_until) <= date('now','localtime'))     -- not snoozed (bare date())
AND rarely_responds = 0                                                         -- Rarely-responds excluded
AND reminders_off = 0                                                           -- muted excluded
AND (PROGRESS_SQL) >= 1.0 /*WOBBLE_MAX*/ AND (PROGRESS_SQL) < 3 /*ROGUE_K*/     -- overdue but not rogue
```
Interpolate ONLY the imported code-constants; every runtime value `?`-bound (dashboard-read.ts:44-51 injection posture).

**TIMEZONE (status.ts:14-24 / dashboard-read.ts:29-31):** convert only `now` via `date('now','localtime')`; a STORED column (`last_contact`, `snooze_until`) is already local — truncate with a **bare** `date(col)`, never re-run through `'localtime'`.

**Birthday candidates are DIFFERENT** (RESEARCH §NOTIF-04 / dashboard-read.ts:336-344 `listBirthdayCandidates`): `archived_at IS NULL AND birthday IS NOT NULL`, then filter in JS with `daysUntilBirthday(stored, today) === 0` (birthday-logic.ts:136). Ignores EVERY decay suppressor (mirrors the 08-dashboard banner) — do not AND the decay predicate onto it.

---

### `src/services/notifications/fire-instant.ts` (pure logic — next allowed fire instant)

**Analog:** `src/logic/birthday-logic.ts` — pure module, **no** react-native/expo import, node-tested via Vitest, tunable const at top (birthday-logic.ts:29 `FEB_29_OBSERVED_DAY`), null-safe never-throws contract, exhaustive JSDoc on the tricky calendar case.

Copy that shape: `nextAllowedFireInstant(dueDate, deliveryHour, quietStartHour, quietEndHour, staggerMinutes)`. The quiet-window wrap (21:00→08:00 crossing midnight) is the birthday-logic-equivalent tricky case — cover it explicitly in tests, as `birthday-logic` covers Feb-29/day-of. Validate hour bounds 0–23 / clamp on read (RESEARCH Security V5). Stagger per-contact to dodge the Android 15 cooldown (RESEARCH Pitfall 6). Use local wall-clock Date construction (`new Date(y,m,d,h)`), never UTC — mirror birthday-logic.ts:150-161.

---

### `src/services/notifications/decay-suppression.ts` (exported SQL fragment, optional split)

**Analog:** `src/db/status.ts` — exports only SQL STRING CONSTANTS + threshold numbers, issues NO write (status.ts:1-9). If the suppression predicate is factored out of `notification-read.ts`, follow this exact "string-constant module, code-constants only interpolated, no user input" posture (status.ts:65). Import `PROGRESS_SQL`/`WOBBLE_MAX`/`ROGUE_K` — do not restate them.

---

### `src/services/notifications/notification-schedule.ts` (service — launch-reconcile hook)

**Analog:** `src/services/field-sweep.ts` `registerFieldSweep` (field-sweep.ts:82-140) — the canonical `registerXSweep(getExec)` that pushes ONE idempotent hook onto the Phase-2 registry via `registerSweepHook` (launch-sweep.ts:45).

**Registration idiom to copy** (field-sweep.ts:82-90):
```typescript
export function registerNotificationScheduleSweep(getExec: () => SqlExecutor): void {
  registerSweepHook(async () => {
    const exec = getExec();               // lazy — registration can precede DB materialisation
    await reconcileSchedule(exec);        // idempotent: read candidates → diff getAll() → cancel/replace
  });
}
```

**Load-bearing negatives (launch-sweep.ts:10-24, RESEARCH Pitfall 5):** register the reconcile ONLY via `registerSweepHook` — NEVER on module import, NEVER reachable from the headless action path. Importing the module must run nothing; the sweep fires once per real `background→active` (or cold start) only.

**Concurrency (field-sweep.ts:16-42):** if the reconcile calls a wrapped DAO, never re-wrap it in a second `withMutex`/`inWriteTransaction` — the mutex is non-reentrant (permanent hang). Wrap each candidate op in its own try/catch so one failure does not abort the sweep (field-sweep.ts:105-112).

**Tunables at top of file** (CLAUDE.md; field-sweep.ts:56 `QUARANTINE_WINDOW_DAYS`): re-nag cadence (flat weekly), fixed snooze (+1 week), stagger minutes — single-number edits.

**Local-time stamp helper** (field-sweep.ts:64-74 `localNow`): if the service needs a local timestamp string without an expo import, copy that node-pure `formatLocalDate(date) + HH:MM:SS` helper — never `toISOString()`.

**App.tsx registration** (App.tsx:83-103): add a `notificationScheduleRegistered` module-scope one-shot guard beside `fieldSweepRegistered`/`photoReconcileRegistered`, register inside the SAME `ready`-gated effect BEFORE `installSweepTrigger(AppState)` fires the cold-start sweep:
```typescript
if (!notificationScheduleRegistered) {
  registerNotificationScheduleSweep(getExecutor);
  notificationScheduleRegistered = true;
}
```

---

### `src/services/notifications/notification-actions.ts` (shared double-wired handler)

**Analog for the WRITES it funnels to:** `recency-dao.ts` `recordTouchpoint` (:215-240) for mark-contacted; `snooze-dao` (this phase) for snooze. The handler itself (category ids + the shared `handleNotificationAction(data)`) has no in-repo analog — follow RESEARCH Pattern 4.

**Mark-contacted must route through `recordTouchpoint`** (recency-dao.ts:215) — never a raw `UPDATE contacts SET last_contact` (RESEARCH Anti-pattern; DATA-04). Pass the 04-log canonical one-tap values (RESEARCH A6): `source:"notification"` (the `source` field is already supported, recency-dao.ts:74-75), `direction:"outbound"`, `channel:"unspecified"` (DEFAULT_CHANNEL recency-dao.ts:138), `connected:1`, `quality:null`. Caller mints `uid` (`newUid()`) and local `now`/`occurredAt`.

**Both wirings funnel to ONE handler** then `cancelScheduledNotificationAsync(`decay:${id}`)`. Custom action buttons set `opensAppToForeground:false` to reach the headless path (RESEARCH Pattern 4 / Pitfall 4).

---

### `src/services/notifications/channels.ts`, `headless-task.ts`, `permission.ts` (no in-repo analog)

No existing analog — these are pure expo-notifications / TaskManager / OS-permission wiring. Follow RESEARCH Patterns 3 (versioned channel ids `decay-private-v1`/`decay-public-v1`/`birthday-v1`, importance DEFAULT, immutable), 4 (module-scope `registerTaskAsync`), and §Permission (POST_NOTIFICATIONS value-moment). OQ-2: **single** birthday channel (private). The nav idiom for the body-tap path DOES have an analog — see Shared Patterns §Body-tap navigation.

---

### `src/db/migrations/002-app-settings.ts` (NEW migration — `app_settings` table)

**Analogs:** `src/db/migrations/001-initial.ts` (table DDL as exported const strings, verbatim, operates on injected `SqlExecutor`, no expo import — 001-initial.ts:37-56) and `src/db/migrations/runner.ts` (forward-only `PRAGMA user_version`, each step its own atomic `BEGIN`/apply/`PRAGMA user_version=N`/`COMMIT` — runner.ts:47-68).

**Wiring (database.ts:25-106):** bump `TARGET_VERSION` 1→2 (database.ts:36), add `migration002` to the array passed to `runMigrations` (database.ts:106). The runner picks up any `version > current && <= target` (runner.ts:43-45) — a user jumping v0→v2 runs both in order.

**Irreversible-safe (CLAUDE.md data-layer rules; 001-initial.ts:2-13):** additive + defaulted only — no destructive change to shipped tables, no edit to migration 001. Never edit an already-shipped migration; add a new one. Treat as permanent on unreachable devices. Seed the default settings row(s) in the SAME migration transaction (001-initial.ts:seed idiom), every seed value `?`-bound; only the integer `user_version` bump is interpolated (runner.ts:59-60).

---

### Notification settings storage — **SQLite** (OWNER OQ-1: NEW table, NOT AsyncStorage)

Owner reversed the theme/dashboard-prefs AsyncStorage default: these settings must be exportable by Phase 16 backup, so they live in the `app_settings` SQLite table. **Do NOT mirror `src/stores/dashboard-prefs-store.ts`** (Zustand+AsyncStorage) for these — it documents itself as "NOT a SQLite row and not a migration" (dashboard-prefs-store.ts:7-16), the opposite of what OQ-1 requires.

Instead: writer follows `favourites-dao.ts` (`?`-bound UPDATE, `changes===1` guard, one `inWriteTransaction`); reader follows `dashboard-read.ts` (pure async read). Validate delivery-hour / quiet bounds 0–23 integer on write (RESEARCH Security V5). The per-contact `reminders_off` + `snooze_until` stay on the `contacts` row (already there) — `app_settings` is ONLY for app-level notification settings. A Zustand store MAY still front the DB for React reactivity, but the DB is the source of truth backup exports.

---

## Shared Patterns

### Single-writer + non-reentrant mutex
**Source:** `src/db/recency-dao.ts:22-51` (mutex + hand-rolled BEGIN/COMMIT rationale), `transaction.ts` via `inWriteTransaction`.
**Apply to:** `snooze-dao.ts`, the `app_settings` writer, `notification-actions.ts` writes.
- Every write wraps in `inWriteTransaction(exec, …)`; never expo `withTransactionAsync`.
- Never nest a mutexed wrapper inside an already-open txn — use the `*Core` non-mutexed primitives (`recordEventCore`, `recomputeLastContactCore`). Nesting = permanent hang (recency-dao.ts:148-156).
- Every value `?`-bound; only static column names / imported code-constants are literal.

### `changes===1` loud-failure guard
**Source:** `src/db/favourites-dao.ts:43-47`, repeated in recency-dao.ts:299-303.
**Apply to:** every single-row UPDATE in `snooze-dao.ts` and the settings writer — a bad id throws → rollback, never silent no-op.

### Local wall-clock dates (never `toISOString`)
**Source:** CLAUDE.md; status.ts:14-24; field-sweep.ts:64-74; dashboard-read.ts:29-36.
**Apply to:** `snooze-dao` (`snooze_until`), `fire-instant.ts`, `notification-read.ts`, settings.
- Write via `formatLocalDate()` / local components; compare stored columns with bare `date(col)`; convert only `now` with `date('now','localtime')`.

### Launch-sweep hook registration
**Source:** `src/services/launch-sweep.ts:45` (`registerSweepHook`) + `field-sweep.ts:82` + `App.tsx:83-103` (module-guard + ready-gated effect).
**Apply to:** `notification-schedule.ts` reconcile. Import runs nothing; register once; fires once per real foreground launch.

### Body-tap navigation (navigationRef + reset)
**Source:** `src/navigation/linking.ts` (`navigationRef` :34, `ShareIntentGate` :51-58 — imperative navigate without `useNavigation`, keyed on an `isReady` flag) + `App.tsx:139-140` (`<NavigationContainer ref={navigationRef} onReady={…}>` + gate mounted inside the ready branch).
**Apply to:** the notification body-tap router. Mirror `ShareIntentGate`'s `isReady`-gated effect for cold-start taps (read `getLastNotificationResponseAsync()` once nav is ready). Use `navigationRef.current?.reset({ index:1, routes:[{name:"Home"},{name:"Compose",params:{contactId}}] })` so Back → dashboard (RESEARCH Pattern 5 / Pitfall 7). Do NOT build a native back-stack.

### Post-purge notification cancel
**Source:** `src/db/purge-dao.ts:209-222` — POST-COMMIT `onPurgeExtensions(contactId)` adapter (best-effort, logged-not-fatal). Phase 4 explicitly deferred the notification-cancel here (CONTEXT code_context). Register a cancel of `decay:<id>` + `birthday:<id>` in that adapter, alongside the existing photo cleanup (`src/services/photos/purge-photo-cleanup.ts`).

### Switch control contract (UI)
**Source:** `src/screens/EditContactScreen.tsx:665-672` — `trackColor={{ false: colors.border, true: colors.accent }}`, `thumbColor={colors.surfaceElevated}`, `testID` + `accessibilityLabel` matching visible copy. UI-SPEC §Color pins this verbatim.
**Apply to:** every Settings notification Switch (master/decay/birthday/lock-screen). Edit-form mute is COPY-ONLY (see below).

### Settings row idiom (UI)
**Source:** `src/screens/SettingsScreen.tsx:89-151` — `styles.row` (`{ backgroundColor: colors.surface, borderColor: colors.border }`, radius 10, padding 12), `Pressable` rows with `testID` + `accessibilityRole="button"` + `accessibilityLabel`. `styles` at :156-184. All colours via `useTheme().colors.*` (no literals — `npm check:colors`).
**Apply to:** the new Notifications section container + its rows; `Pressable`→`datetimepicker` for the time/quiet controls.

### Filled-accent chip idiom (UI — snooze presets)
**Source:** `src/components/FilterChipRow.tsx:51-84` — active = `backgroundColor: colors.accent`, label `colors.background`; inactive = `colors.surface` + `border` + `textSecondary`; `accessibilityState={{ selected }}`; `testID` per key.
**Apply to:** the Profile 3d/1wk/1mo snooze presets. Place with the action block (`ContactProfileScreen.tsx:591-620` `Message`/`Log contact` `styles.logContact`).

---

## Edit-form mute — COPY-ONLY, do not rebuild

`EditContactScreen.tsx:679-693` already has the `reminders_off` Switch (`testID="edit-contact-reminders-off"`, wired to `form.remindersOff`). Phase 11 UI change is copy-only (UI-SPEC §2 / CONTEXT verify-don't-rebuild): relabel the visible `Text` and `accessibilityLabel` "Turn off reminders" → **"Mute reminders"** and add helper "Keep them in Orbit, but never get reminders about them." Keep testID, position, styling, on/off contract. The REAL Phase-11 work is wiring `reminders_off` into the decay-suppression predicate (`notification-read.ts`) — not UI. (Mapping already exists: `edit-contact-logic.ts:148` `remindersOff: c.reminders_off`.)

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/services/notifications/channels.ts` | service/config | request-response | No expo-notifications channel code exists yet — follow RESEARCH Pattern 3. |
| `src/services/notifications/headless-task.ts` | service | event-driven | No `TaskManager.defineTask`/`registerTaskAsync` in repo — follow RESEARCH Pattern 4; on-device FCM-less spike (A2) gates it. |
| `src/services/notifications/permission.ts` | service | request-response | No runtime-permission request in repo — follow RESEARCH §Permission. |

The DAO writes, the launch-sweep hook, the pure logic module, the SQL suppression fragment, the migration, and every UI surface DO have strong in-repo analogs (above).

## Metadata

**Analog search scope:** `src/db/`, `src/db/migrations/`, `src/services/`, `src/services/notifications/` (new), `src/logic/`, `src/stores/`, `src/screens/`, `src/navigation/`, `src/components/`, `App.tsx`, `app.config.ts`.
**Files opened this session:** recency-dao.ts, favourites-dao.ts, events-dao.ts, launch-sweep.ts, field-sweep.ts, dashboard-read.ts, status.ts, birthday-logic.ts, migrations/001-initial.ts, migrations/runner.ts, database.ts (grep), purge-dao.ts, dashboard-prefs-store.ts, App.tsx, navigation/linking.ts (grep), app.config.ts, SettingsScreen.tsx, EditContactScreen.tsx, ContactProfileScreen.tsx (grep), FilterChipRow.tsx (grep).
**Pattern extraction date:** 2026-08-16
</content>
</invoke>
