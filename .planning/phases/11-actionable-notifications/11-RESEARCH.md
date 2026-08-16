# Phase 11: Actionable Notifications - Research

**Researched:** 2026-08-16
**Domain:** Local (no-FCM) scheduled Android notifications — decay + birthday reminder engine, headless one-tap actions, launch-reconciled schedule, in-app settings/mute/snooze surfaces
**Confidence:** HIGH (platform facts first-hand-verified in the two dossier workpapers against expo-notifications@57.0.10 / expo-background-task@57.0.9 tarballs; every integration point read on disk this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Copied verbatim from `11-CONTEXT.md ## Implementation Decisions` — the planner MUST honour these; research does not offer alternatives to any of them.

**Copy & tone**
- Decay body is **generic** (no fuel in the notification text): `"{Name} — time to reach out."`
- Birthday body: `"It's {Name}'s birthday today."` — plain text, no emoji. Tap → profile.
- Birthday lead time: **day-of morning only**. No earlier "coming up" notification.
- Alert feel / channel importance: **DEFAULT importance** (silent, no heads-up peek) for BOTH decay and birthday channels. Immutable at channel creation.

**Cadence & snooze**
- Re-nag cadence: **flat weekly**, each re-nag REPLACING the prior shade entry (stable `decay:<contactId>`). Not escalating.
- Notification snooze (headless action): one fixed length, **+1 week**.
- In-app snooze presets (profile): **3 days · 1 week · 1 month** (distinct from the notification's fixed snooze).

**Timing & controls (OWNER REVERSAL — authoritative)**
- Morning delivery hour: default **~9:00 am**.
- Quiet window: default **9:00 pm – 8:00 am**; a nudge landing inside it rolls to the next morning. App computes the next allowed fire instant itself (Android has no time-of-day trigger).
- **[OWNER DECISION — reverses dossier `11-notify.md` Cluster A `[REJECTED] User-set delivery hour in v1`] The morning delivery hour AND the quiet-window bounds are USER-TUNABLE in Settings in v1**, not top-of-file constants. 9am / 9pm–8am become the DEFAULTS for these controls. This is the owner reversing a recorded decision — it is binding, and the planner must NOT re-apply the old `[REJECTED]` rationale. It does NOT touch channel immutability (the reconcile already recomputes each fire instant, so a user hour/window is just a new input to that recompute).
- "Reminders off" mute: on the **edit form**, beside "Rarely responds", relabelled **"Mute reminders"**. The `reminders_off` column + Switch ALREADY EXIST — verify, don't rebuild; wire it into the decay-suppression predicate.

**Orchestrator picks — accepted as a set (all 7)**
1. Birthday fires day-of, morning window, tap → profile.
2. Birthday alerts get their OWN channel (separate from the two decay channels).
3. Namespaced stable identifiers: `decay:<contactId>` and `birthday:<contactId>` (do not replace each other).
4. A phone-less contact STILL gets decay notifications; compose degrades (already built Phase 9).
5. `autoDismiss = true` (tap clears it); no sticky/ongoing reminder.
6. Permission denied → in-app-only; NO nagging to re-grant.
7. Generic body is within the 1024-char cap — no truncation logic.

### Claude's Discretion (delegated to plan-phase)
- Exact numeric values + storage of tunable constants NOT surfaced in Settings (re-nag cadence value, fixed snooze length, rogue multiple → read from `status.ts`, never redefine). Top of the service file per CLAUDE.md.
- Storage mechanism for notification settings (AsyncStorage/Zustand vs SQLite) — must be readable by the scheduling logic AND exportable by backup (Phase 16). **See Open Question OQ-1 — this has a real backup dependency and no SQLite settings table exists yet.**
- `onNewIntent` routing + synthetic back-stack construction under Android 15 BAL limits.
- Channel identity/versioning scheme; how in-app per-type toggles map to channel state vs an app-level gate.
- The FCM-less headless-task init device spike (carried from 04-log F5).

### Deferred Ideas (OUT OF SCOPE — do not build)
- Escalating decay→rogue re-nag intervals (flat weekly chosen for v1).
- Inline `RemoteInput` free-text fuel-capture in the freed 3rd action slot.
- Per-contact avatar on the notification (needs a bare-workflow native module).
- Weekly digest as a notification (Phase 15 / domain 14 — may reuse channels/scheduling, not built here).
- Widget headless-write path + its Back→dashboard model (Phase 12 inherits this domain's pattern).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-01 | Decay notifications: pre-scheduled dated local notifications, generic body, reconciled on launch/foreground (cancel/replace on `decay:<contactId>`), fuzzy no-exact-alarm delivery at a fixed morning hour outside a quiet window, per-contact + staggered. | Architecture #3 (launch-sweep reconcile over AlarmManager); §Scheduling maths; §Standard Stack (expo-notifications inexact branch); §Pitfall P1 frozen content; launch-sweep hook registry read on disk. |
| NOTIF-02 | Two headless actions (mark-contacted, +1wk snooze) both double-wired (background task + foreground listener) writing through the DAO / events table; body tap → compose; Back → dashboard. | §Headless action task; recency-dao (single-writer, already mutexed) + events-dao (`snooze`/`unsnooze` reserved, no producer yet); §onNewIntent + back-stack; device spike F5. |
| NOTIF-03 | No decay notification for never-contacted / snoozed / rogue / "Rarely responds" / muted; a user can permanently mute (reminders_off) a still-decaying contact. | §Decay-suppression predicate (reads `status.ts` ROGUE_K, `snooze_until`, `rarely_responds`, `reminders_off`); edit-form mute relabel; snooze_until first writer. |
| NOTIF-04 | Birthday notifications fire day-of morning for any non-archived contact on their own channel (tap→profile), reusing the single birthday parser. | `birthday-logic.ts` `daysUntilBirthday` (bugs already fixed); §Birthday scheduling (annual reschedule, different suppression). |
| NOTIF-05 | `POST_NOTIFICATIONS` requested at a value moment; settings expose master + per-type toggles + lock-screen visibility (private-by-default second channel); denial degrades to in-app only. | §Permission flow; §Channel architecture (private/public split); §Settings storage; UI-SPEC §1/§4. |
</phase_requirements>

## Summary

This is a **local-first, no-backend, no-FCM** notification engine. Two dossier workpapers already read the `expo-notifications@57.0.10` and `expo-background-task@57.0.9` Android tarballs first-hand and the platform *dictated the architecture*: scheduled-notification content is **frozen at schedule time** (serialized to SharedPreferences, re-shown verbatim on fire), the background-sweep is **hard-gated on network connectivity** (won't run offline), and there is **no time-of-day / quiet-hours trigger** anywhere. The forced answer — already `[DECIDED]` — is **pre-scheduled dated AlarmManager notifications with a GENERIC body, reconciled on every real foreground launch, cancelled/replaced on a stable per-contact identifier**, with the app computing each fire instant itself.

Everything the engine touches on the data side **already exists and is single-writer-disciplined**: `recency-dao` is the sole `last_contact` writer behind a shared JS mutex (headless mark-contacted routes through `recordTouchpoint`, already mutexed); `events-dao` reserves the `snooze`/`unsnooze` vocabulary with no producer yet (this phase is the first producer); `status.ts` owns the shared `ROGUE_K = 3` cutoff; `birthday-logic.ts` owns the single bug-fixed parser; `launch-sweep` is an empty-registry hook host waiting for the schedule-reconcile hook; and the purge fan-out already fires a POST-COMMIT `onPurgeExtensions` adapter that Phase 4 explicitly deferred the notification-cancel to Phase 11. `snooze_until` and `reminders_off` are frozen columns from migration 1; `reminders_off` is already written by `updateContactMetadataCore` and mapped in the edit form — **`snooze_until` has NO writer yet and this phase is its first**.

**Primary recommendation:** Build one `notification-schedule` service (tunables at top of file), install its reconcile as a `launch-sweep` hook, key every scheduled notification on `decay:<contactId>` / `birthday:<contactId>`, keep bodies generic, register a single headless `registerTaskAsync` task **and** a foreground `addNotificationResponseReceivedListener` (double-wired) that both funnel to the same DAO writes, route body taps through `navigationRef` (mirroring the existing `ShareIntentGate`) with a `reset` to `[Home, Compose]` so Back always lands on the dashboard, and gate the whole thing behind a `POST_NOTIFICATIONS` value-moment request with graceful in-app degrade. **Install `expo-notifications` first — it is NOT yet in `package.json`.**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deciding *when* a contact is due / suppressed | DB read (`status.ts` fragments + a decay-suppression predicate) | — | Status/progress is query-time DERIVED-NEVER-STORED; the predicate reads existing columns, never recomputes rogue. |
| Computing the next allowed fire instant (hour + quiet window) | Pure TS logic module (node-tested) | Settings store (user hour/window inputs) | Android has no time-of-day trigger; this is Orbit's own scheduling math. Owner made hour/window user-tunable. |
| Reconciling the scheduled set (cancel/replace) | `launch-sweep` hook → `notification-schedule` service | expo-notifications AlarmManager (OS) | Launch is the source of truth; the OS just holds the alarms. |
| Persisting the alarm + frozen content | OS (SharedPreferences + AlarmManager, via expo-notifications) | — | Frozen at schedule time — this is why bodies are generic. |
| Headless action writes (mark / snooze) | `recency-dao` / `events-dao` (single-writer, mutexed) | Headless `registerTaskAsync` task + foreground listener | 04-log double-write requirement; the DAOs already own atomicity + the mutex. |
| Body-tap navigation | JS navigation (`navigationRef` → Compose, Back→dashboard) | onNewIntent (singleTask, OS) | `TaskStackBuilder` doesn't compose with app-wide singleTask; Back-stack is a JS concern (12-widget confirmed). |
| Permission + channels + settings UI | React screens (Settings / Edit form / Profile) | OS channels (immutable) + AsyncStorage/SQLite settings | Per-channel visibility is immutable; in-app toggles are an app-level gate over channel state. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-notifications` | `~57.0.11` (SDK 57 bundled `~57.0.10`; registry latest 57.x = **57.0.11**) | Local scheduled notifications, channels, action categories, response listener, headless task registration, permission request | The only managed-Expo notification API; the dossier verified its Android internals first-hand. `[VERIFIED: npm registry + CITED: docs.expo.dev/versions/latest/sdk/notifications]` |
| `expo-background-task` | `~57.0.9` | Optional daily best-effort **backstop** sweep only (NEVER the primary/sole mechanism) | Successor to deprecated `expo-background-fetch`; WorkManager-backed, **no FCM**. `[VERIFIED: npm registry + CITED: workpaper platform-scheduling-background.md]` |
| `@react-native-community/datetimepicker` | `9.1.0` (already installed) | The `mode="time"` picker for the user-tunable delivery hour + quiet-window Settings controls | Already a dep + registered in `app.config.ts` (Phase 4). No new dep. `[VERIFIED: package.json]` |

### Supporting (already installed — reused, no new dep)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-native-async-storage/async-storage` | `2.2.0` | Candidate store for notification settings (Zustand-persist idiom) | If settings go the AsyncStorage route — see OQ-1. `[VERIFIED: package.json]` |
| `zustand` | `^5.0.15` | Settings store shape (mirror `dashboard-prefs-store.ts` / `theme-store.ts` verbatim) | Settings store implementation. `[VERIFIED: package.json + src/stores/dashboard-prefs-store.ts]` |
| `expo-sqlite` | `~57.0.1` | Alternative settings home (new migration) + the `snooze_until` writer + the suppression read | If settings go the SQLite route (backup-friendly). `[VERIFIED: package.json]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pre-scheduled + launch-reconcile (Architecture #3) | Periodic `expo-background-task` sweep as PRIMARY | REJECTED by platform: WorkManager job is hardcoded `NetworkType.CONNECTED` — will not run offline, fatal for a local-first no-network app. Use only as a coarse online backstop. `[CITED: workpaper Finding B]` |
| Inexact `setAndAllowWhileIdle` (no permission) | `SCHEDULE_EXACT_ALARM` | REJECTED in dossier + REQUIREMENTS Out-of-Scope: adds a revocable user prompt, Play-policy justification, cuts against "asks for almost nothing". A decay nudge has no minute-level meaning. `[CITED: 11-notify Cluster A]` |
| Two decay channels (private/public) | Single public channel, drop the lock-screen setting | REJECTED (considered for reversal after generic-body, UPHELD): a name-only body still discloses who is decaying. Per-channel visibility is immutable → the setting needs a second channel. `[CITED: 11-notify Cluster D]` |
| `expo-background-task` | `expo-background-fetch` | REJECTED: deprecated on SDK 57, emits a runtime warning. `[CITED: workpaper Finding D]` |

**Installation:**
```bash
npx expo install expo-notifications
# ONLY if a background backstop is actually planned (optional, see Architecture note):
npx expo install expo-background-task
```
`npx expo install` (not bare `npm install`) pins the SDK-57-bundled version. `expo-notifications` ships a config plugin — register it in `app.config.ts` `plugins` (respect the 01-01 dedupe idiom; the plugin accepts options but Orbit needs none beyond defaults since there is no custom icon/sound/FCM). No `google-services.json` is added — the FCM-less path is intentional and is the subject of the device spike.

**Version verification (run this session):**
- `npm view expo-notifications@57.0.10 version` → `57.0.10` (SDK-57 bundled, workpaper-read). Registry latest 57.x → `57.0.11` (a patch newer than the workpaper). `npx expo install` will resolve the SDK-pinned version; confirm what it picks on the build box.
- `npm view expo-background-task@57.0.9 version` → `57.0.9`.
- `expo@57.0.13` is the installed Expo; both packages are first-party `@expo`-org modules.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `expo-notifications` | npm | years (SDK-tracked) | millions/wk | github.com/expo/expo (monorepo) | OK | Approved — first-party Expo, SDK-bundled |
| `expo-background-task` | npm | SDK-57 era | high (Expo org) | github.com/expo/expo | OK | Approved (optional backstop only) — first-party Expo |
| `@react-native-community/datetimepicker` | npm | already installed Phase 4 | millions/wk | github.com/react-native-datetimepicker | OK | Already approved & installed |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none. All three are first-party / already-vetted; no `checkpoint:human-verify` gate required for install (contrast the Phase 8 reorderable-list checkpoint — not needed here).

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
   Real foreground        │           launch-sweep (once/launch)         │
   launch (cold start     │   registerSweepHook(scheduleReconcile)       │
   OR background→active) ─▶│   [runs AFTER openAndMigrate resolves]       │
                          └───────────────────┬─────────────────────────┘
                                              │ reconcile()
                                              ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  notification-schedule SERVICE  (tunables at top of file)      │
        │                                                                │
        │  1. read due/soon contacts  ── DB read: status.ts fragments    │
        │     + decay-SUPPRESSION predicate (never-contacted, snoozed,   │
        │       rogue≥ROGUE_K, rarely_responds, reminders_off)           │
        │  2. read birthday candidates ── daysUntilBirthday() (non-arch) │
        │  3. compute next-allowed fire instant  ── pure logic module:   │
        │       user delivery hour + quiet-window roll-forward           │
        │  4. getAllScheduledNotificationsAsync()  ── current OS set     │
        │  5. DIFF → cancel(decay:<id> no-longer-due) /                  │
        │            schedule(decay:<id>, generic body, DATE trigger)    │
        └───────────────┬───────────────────────────────┬───────────────┘
                        │ schedule/cancel               │
                        ▼                               ▼
      ┌───────────────────────────────┐   OS: AlarmManager (inexact,
      │ expo-notifications            │       setAndAllowWhileIdle) +
      │  content FROZEN → SharedPrefs │       SharedPreferences store
      └───────────────┬───────────────┘
                      │ alarm fires (morning window, Doze-batched)
                      ▼
            ┌─────────────────────────────┐   channels (importance DEFAULT, immutable):
            │  Notification in shade       │     decay-private (LOCKSCREEN PRIVATE, default)
            │  tag=decay:<id>, id=0        │     decay-public  (LOCKSCREEN PUBLIC)
            │  [mark] [snooze] + body tap  │     birthday (its own channel)
            └───┬──────────┬──────────┬────┘
      body tap │   [mark]  │  [snooze]│   (custom action buttons)
               ▼           ▼          ▼
   ┌──────────────┐  ┌──────────────────────────────────────────────┐
   │ navigationRef │  │ DOUBLE-WIRED:                                 │
   │  reset→[Home, │  │  • foreground: addNotificationResponse-       │
   │  Compose{id}] │  │    ReceivedListener (app alive)               │
   │  Back→Home    │  │  • killed/bg: registerTaskAsync headless task │
   └──────────────┘  │  both → recordTouchpoint() (recency-dao,      │
                     │  mutexed, source='notification') OR            │
                     │  recordEvent(type='snooze') + write snooze_until│
                     │  then cancelScheduledNotificationAsync(id)     │
                     └──────────────────────────────────────────────┘

   Purge (Archived list) ──▶ purgeContact(onPurgeExtensions) POST-COMMIT
                             ── compose photo-cleanup + notification-cancel(decay:<id>,birthday:<id>)
```

### Recommended Project Structure
```
src/
├── services/
│   ├── notifications/
│   │   ├── notification-schedule.ts     # tunables + reconcile() + schedule/cancel; registerNotificationScheduleSweep()
│   │   ├── fire-instant.ts              # PURE node-tested: nextAllowedFireInstant(dueDate, hour, quietStart, quietEnd)
│   │   ├── decay-suppression.ts         # PURE-ish: the "should this contact get a decay nudge" predicate / SQL fragment
│   │   ├── channels.ts                  # ensureChannels() — decay-private / decay-public / birthday, versioned ids
│   │   ├── notification-actions.ts      # category + action identifiers; the SHARED handler both wirings call
│   │   ├── headless-task.ts             # registerTaskAsync task def (module-scope registration — see Pitfall P5)
│   │   └── permission.ts               # POST_NOTIFICATIONS value-moment request + status read
│   └── launch-sweep.ts                  # EXISTING — register the reconcile hook here (like field-sweep/photo-reconcile)
├── db/
│   ├── snooze-dao.ts                    # NEW — the FIRST writer of contacts.snooze_until (+ clear); events snooze row
│   └── notification-read.ts            # NEW read: due/soon candidates + suppression, composing status.ts fragments
├── stores/
│   └── notification-settings-store.ts   # OR a SQLite settings table — see OQ-1
└── screens/
    ├── SettingsScreen.tsx               # ADD the Notifications section (master/per-type/lockscreen/hour/quiet)
    ├── EditContactScreen.tsx            # RELABEL existing reminders_off Switch → "Mute reminders" + helper
    └── ContactProfileScreen.tsx         # ADD the in-app snooze presets block (3d/1wk/1mo + clear)
```

### Pattern 1: Launch-reconcile hook registration (mirror field-sweep / photo-reconcile)
**What:** Register an idempotent reconcile on the existing `launch-sweep` registry — NOT on module import, NOT on a headless tap.
**When to use:** The schedule reconcile (NOTIF-01). App.tsx already gates hook registration behind `ready` + a one-shot module guard.
```typescript
// Source: src/services/field-sweep.ts (registerSweepHook) + src/App.tsx registration idiom
// notification-schedule.ts
import { registerSweepHook } from "@/services/launch-sweep";
export function registerNotificationScheduleSweep(getExec: () => SqlExecutor): void {
  registerSweepHook(async () => {
    // idempotent: read due/birthday candidates, diff against
    // getAllScheduledNotificationsAsync(), cancel/replace on stable ids.
    await reconcileSchedule(getExec());
  });
}
// App.tsx ready-gated effect adds, with a module-scope one-shot guard like
// fieldSweepRegistered / photoReconcileRegistered:
//   if (!notificationScheduleRegistered) { registerNotificationScheduleSweep(getExecutor); notificationScheduleRegistered = true; }
```

### Pattern 2: Schedule with a stable identifier + generic body (replace-not-stack)
**What:** Key every scheduled notification on `decay:<contactId>` so a re-nag REPLACES the prior shade entry and a mutation re-schedule overwrites the pending alarm.
```typescript
// Source: docs.expo.dev/versions/latest/sdk/notifications + workpaper Finding F/G, Q3
await Notifications.scheduleNotificationAsync({
  identifier: `decay:${contactId}`,               // stable → replace, not stack (Finding D)
  content: {
    title: name,                                   // or omit; body carries identity
    body: `${name} — time to reach out.`,          // GENERIC — never fuel (frozen content)
    data: { kind: "decay", contactId },            // read on tap to route to Compose
    categoryIdentifier: "decay-actions",           // the mark/snooze action buttons
    autoDismiss: true,                             // orchestrator pick 5
  },
  trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireInstant },
});
```
- `getAllScheduledNotificationsAsync()` is cheap — enumerate it in the reconcile to diff (Finding, Q3).
- `cancelScheduledNotificationAsync("decay:"+id)` on mark / snooze / mute / interval-edit / purge.

### Pattern 3: Channels created up-front, versioned ids, importance DEFAULT (immutable)
**What:** Create a SMALL stable set of channels once (idempotent) at app init; NEVER re-`set` an existing id to change behaviour (silent no-op).
```typescript
// Source: workpaper platform-lifecycle-channels.md Findings A/B, developer.android.com channels
// channels.ts — call once (idempotent) after permission is relevant
await Notifications.setNotificationChannelAsync("decay-private-v1", {
  name: "Reminders", importance: Notifications.AndroidImportance.DEFAULT,  // silent, no heads-up
  lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE, // default private
});
await Notifications.setNotificationChannelAsync("decay-public-v1", {
  name: "Reminders (show on lock screen)", importance: Notifications.AndroidImportance.DEFAULT,
  lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
});
await Notifications.setNotificationChannelAsync("birthday-v1", {
  name: "Birthdays", importance: Notifications.AndroidImportance.DEFAULT,
  lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE, // single birthday channel assumed
});
```
- **Version-suffix the id** (`-v1`): to ever change importance/visibility you MUST recreate under a NEW id — re-setting the same id is a no-op (Finding B, the biggest channel landmine).
- The lock-screen toggle chooses WHICH decay channel a scheduled notification posts to (private vs public); it does not mutate a channel.

### Pattern 4: Double-wired headless action handler (04-log requirement, now covers snooze)
**What:** The same action must be handled whether the app is foreground (JS listener) or killed/background (headless task) — else a tap while the app is open is silently dropped.
```typescript
// Source: workpaper Finding H / Q6 + 04-log double-write; recency-dao / events-dao read on disk
// headless-task.ts — registered at MODULE SCOPE (survives process death), NOT inside a component
const TASK = "orbit-notification-action";
TaskManager.defineTask(TASK, async ({ data }) => {
  await handleNotificationAction(data);  // shared handler
});
Notifications.registerTaskAsync(TASK);

// App.tsx (or a gate component) — foreground path, app alive:
Notifications.addNotificationResponseReceivedListener((response) => {
  const { actionIdentifier } = response;
  if (actionIdentifier === "mark" || actionIdentifier === "snooze") {
    void handleNotificationAction(response.notification.request.content.data);
  } else {
    // default (body tap) → navigate to Compose (see Pattern 5)
  }
});

// shared handler — both wirings funnel here:
async function handleNotificationAction(data) {
  const exec = getExecutor();
  if (data.action === "mark") {
    await recordTouchpoint(exec, { contactId: data.contactId, /* source: "notification",
       direction: "outbound", channel: "unspecified", connected: 1 */ ... }); // recency-dao, already mutexed
  } else {
    await snoozeContact(exec, data.contactId, PLUS_ONE_WEEK);  // snooze-dao: write snooze_until + events 'snooze'
  }
  await Notifications.cancelScheduledNotificationAsync(`decay:${data.contactId}`);
}
```
- The headless task is a `remote-notification` consumer; the JS listener is a **noop when killed** (source comment confirms). Both must exist. `[CITED: workpaper Q6/H]`
- Custom action buttons must set `opensAppToForeground: false` to reach the headless path (Finding H).

### Pattern 5: Body-tap → Compose, Back → dashboard (navigationRef + reset)
**What:** Route a body tap to `Compose({contactId})` and guarantee Back lands on the dashboard, under app-wide `singleTask`/`onNewIntent`.
```typescript
// Source: src/navigation/linking.ts (navigationRef + ShareIntentGate idiom) + 10-capture/12-widget back-stack note
// reset (not navigate) so the back-stack is exactly [Home, Compose] regardless of the prior stack:
navigationRef.current?.reset({ index: 1, routes: [{ name: "Home" }, { name: "Compose", params: { contactId } }] });
```
- Cold-start taps: read `Notifications.getLastNotificationResponseAsync()` once nav is ready (mirror the `ShareIntentGate` `isReady` gating) to route the initial tap.
- `TaskStackBuilder` does NOT compose with singleTask — Back-stack is a JS concern (12-widget confirmed). Do NOT try to build a native back-stack.

### Anti-Patterns to Avoid
- **Baking fuel (or any dynamic text) into a scheduled body.** Frozen at schedule time → goes stale, fires for since-contacted contacts. Body stays generic; fuel lives on the compose screen the tap opens. `[CITED: 11-notify Cluster A]`
- **Recreating a channel under the same id to change importance/visibility.** Silent no-op. Version the id.
- **Registering the reconcile on module import or inside the headless tap path.** The sweep must run once per REAL foreground launch only (launch-sweep contract; P5).
- **Writing `last_contact` or `snooze_until` with a raw UPDATE from the headless task.** Route mark-contacted through `recordTouchpoint` (single-writer mutex) and snooze through the new `snooze-dao` — never bypass the mutex.
- **Recomputing rogue.** Read `ROGUE_K`/`STATUS_SQL` from `status.ts`. Never a second cutoff.
- **Using `expo-background-task` as the primary timer.** Network-gated; offline no-op.
- **`toISOString().split('T')[0]` for any date math.** Use `formatLocalDate()` / `date('now','localtime')` (CLAUDE.md, already burned once in the plugin).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduling a dated local notification | A custom AlarmManager bridge / setTimeout | `expo-notifications` `scheduleNotificationAsync` (DATE trigger) | Reboot re-arm, inexact-alarm branch, SharedPrefs persistence all handled; setTimeout dies with the process. |
| Cancel/replace identity | A map of library-generated UUIDs | Stable `decay:<id>` identifier (Finding F) | The library keys the store + alarm on your identifier; replace = reuse it. |
| Headless write atomicity + recency | A raw `UPDATE contacts SET last_contact` | `recordTouchpoint` (recency-dao) | Single-writer MAX-recompute + shared mutex + rarely_responds filter already correct. |
| Snooze event immutability | A new events writer | `recordEvent(type:'snooze')` (events-dao) — vocabulary already reserved | Insert-only immutable contract already enforced; `snooze`/`unsnooze` are reserved for exactly this. |
| Birthday next-occurrence math | A new parser | `daysUntilBirthday()` (birthday-logic.ts) | The two Obsidian bugs (day-of drop, Feb-29 overflow) are already fixed; a re-implementation reintroduces them. |
| Rogue cutoff | A local constant | `ROGUE_K` from status.ts | Single shared constant with the orrery; recomputing risks drift. |
| Post-purge notification cleanup | A new purge path | `onPurgeExtensions` adapter (purge-dao) | Phase 4 already fires it POST-COMMIT; Phase 11 registers the notification-cancel there. |
| Time picker | A custom wheel | `@react-native-community/datetimepicker` `mode="time"` | Already installed + registered; UI-SPEC prescribes it. |

**Key insight:** Almost every hard part of this phase was solved by an earlier phase's single-writer discipline. The new code is the *scheduling policy* (fire-instant math, suppression predicate, reconcile diff) plus the *wiring* (channels, permission, double-wired actions, nav) — the *writes* all go through existing, mutexed, node-tested DAOs.

## Runtime State Inventory

> Not a rename/refactor phase, but this phase CREATES OS-level runtime state that a grep cannot see. Included because "what still holds state after the code runs" is the crux risk here.

| Category | Items | Action Required |
|----------|-------|------------------|
| OS-scheduled alarms | Each `scheduleNotificationAsync` writes an AlarmManager alarm + a SharedPreferences-serialized request (`notification_request-<identifier>`), **frozen at schedule time**, surviving reboot/app-update. | The launch reconcile is the single source of truth: `getAllScheduledNotificationsAsync()` diff → cancel stale / replace changed. Never assume the OS set matches intent without reconciling. |
| Notification channels | `decay-private-v1` / `decay-public-v1` / `birthday-v1` — importance + visibility **immutable** once created; deleted channels stay visible in system settings as a spam-count. | Create once, idempotent, versioned ids. A behaviour change = a NEW id, never a re-set. |
| Runtime permission | `POST_NOTIFICATIONS` grant state lives in the OS, revocable outside the app. | Read status on each relevant entry (not cached indefinitely); degrade to in-app on denied/revoked; no re-nag. |
| Stored DB rows | `contacts.snooze_until` (this phase's first writer), `contacts.reminders_off` (existing), `events` snooze rows. | `snooze-dao` writes snooze_until + an immutable events row in one transaction via the shared mutex. |
| Headless JS bundle bring-up | The `registerTaskAsync` task loads the JS bundle in a headless context on a killed-app action tap, with **no FCM / no google-services.json**. | **DEVICE SPIKE (carried from 04-log F5):** prove the headless task's JS actually runs on the FCM-less release build on the physical Pixel. Nothing in source requires FCM, but this must be proven on-device, not asserted. |
| Settings state | User delivery hour, quiet-window bounds, master/per-type/lock-screen toggles. | Persist somewhere backup can export (OQ-1). The schedule itself is DERIVED (rebuilt by reconcile on restore), not exported. |

**Nothing found for:** secrets/env vars (none — no keys involved); build artifacts (the only build-config change is adding the expo-notifications plugin to `app.config.ts`, requiring a `expo prebuild --clean` + release APK on the desktop pipeline).

## Common Pitfalls

### Pitfall 1: Frozen scheduled content
**What goes wrong:** A scheduled notification shows the text it had *at schedule time*, even after the contact was marked-contacted or their fuel changed — and it still fires.
**Why:** `scheduleNotificationAsync` base64-serializes the full request into SharedPreferences; the alarm carries only the identifier; on fire the stored request is re-shown verbatim. No live re-derivation.
**How to avoid:** Generic body (never stale on fuel) + cancel on mark/snooze/mute/interval-edit + reconcile-on-launch. `[CITED: workpaper Q2/A]`
**Warning signs:** A "time to reach out" firing for someone you contacted yesterday.

### Pitfall 2: Background sweep silently no-ops offline
**What goes wrong:** If the reconcile is treated as a background-task responsibility, it never runs while the device is offline (a local-first app's normal state).
**Why:** `expo-background-task`'s WorkManager job hardcodes `NetworkType.CONNECTED`.
**How to avoid:** Launch/foreground reconcile is PRIMARY (AlarmManager needs no network). Background task is at most an online backstop. `[CITED: workpaper Finding B]`

### Pitfall 3: Channel re-set no-op
**What goes wrong:** Changing importance/visibility by calling `setNotificationChannelAsync` with the same id does nothing; the old behaviour persists.
**Why:** OS spam-prevention — recreating a channel with its original id is a no-op.
**How to avoid:** Versioned channel ids; change = new id. `[CITED: workpaper Finding B]`

### Pitfall 4: Killed-app action drops the write
**What goes wrong:** Tapping "mark contacted" on a notification while the app is killed does nothing, because only the JS `addNotificationResponseReceivedListener` was wired.
**Why:** That listener is a noop when killed; only a `registerTaskAsync` task reaches a headless context.
**How to avoid:** Double-wire (task + listener), both funnel to the same handler; register the task at module scope. `[CITED: workpaper Q6/H + 04-log]`

### Pitfall 5: Reconcile runs on a headless tap and re-schedules everything
**What goes wrong:** If the reconcile is reachable from module import or the headless action path, a killed-app action tap (which loads the bundle in a 30s budget) triggers a full sweep it must never run.
**Why:** `launch-sweep`'s two load-bearing NEGATIVE rules: import runs nothing; sweep fires only on a real background→active transition.
**How to avoid:** Register the reconcile only via `registerSweepHook`; keep the headless handler doing ONLY the write + the single cancel. `[VERIFIED: src/services/launch-sweep.ts read on disk]`

### Pitfall 6: Android 15 Notification Cooldown mutes a morning burst
**What goes wrong:** Firing all due contacts at 9:00:00 → Android 15 auto-mutes the 2nd+ notifications for ~2 min.
**Why:** Official Android 15 cooldown feature for repetitive same-app notifications.
**How to avoid:** Stagger fire instants across the morning window (each contact its own minute-offset). `[CITED: workpaper Finding F]`

### Pitfall 7: Back from Compose doesn't reach the dashboard
**What goes wrong:** A tap that pushes Compose onto whatever screen was last open makes Back return there, not the dashboard.
**Why:** `navigate` pushes onto the existing stack; singleTask reuses the one activity.
**How to avoid:** `navigationRef.reset({ index:1, routes:[Home, Compose] })` so the stack is deterministic. `[CITED: 11-notify Cluster C + linking.ts idiom]`

### Pitfall 8: `snooze_until` written in a non-comparable format
**What goes wrong:** The dashboard snoozed-segment / suppression compares `date(snooze_until)` against `date('now','localtime')`; a UTC or ISO-T string breaks the comparison and the day-boundary.
**Why:** The stored contract (dashboard-read.ts:33) expects a local `YYYY-MM-DD` (or `YYYY-MM-DD HH:MM:SS`) string compared via bare `date()`.
**How to avoid:** Write snooze_until with `formatLocalDate()` / local wall-clock; never `toISOString()`. `[VERIFIED: dashboard-read.ts read on disk]`

## Code Examples

### Compute the next allowed fire instant (pure, node-testable)
```typescript
// Source: derived from 11-notify Cluster A (no OS quiet-hours field) — this is Orbit's own logic.
// fire-instant.ts — hour/quietStart/quietEnd come from user settings (owner reversal).
export function nextAllowedFireInstant(
  dueLocalDate: Date, deliveryHour: number,     // e.g. 9
  quietStartHour: number, quietEndHour: number, // e.g. 21, 8
  staggerMinutes: number,                        // per-contact offset to avoid a burst
): Date {
  // 1. candidate = dueLocalDate at deliveryHour + staggerMinutes (local).
  // 2. if candidate falls inside [quietStart, quietEnd) (wrapping midnight), roll to quietEnd next morning.
  // 3. if candidate is in the past (missed today), roll to the next day's delivery slot.
  // returns a local Date the DATE trigger fires on.
}
```
Node-tested with fixed local dates (Vitest, react-native-free), mirroring `birthday-logic.ts` / `fire-instant`'s sibling pure modules. Quiet-window wrap (21:00→08:00 crosses midnight) is the tricky case — cover it explicitly.

### Decay-suppression predicate (reads existing columns; never recomputes rogue)
```sql
-- Source: 11-notify [notify → data/log] + status.ts (ROGUE_K) + dashboard-read snooze contract.
-- A contact is eligible for a DECAY nudge when ALL hold:
--   last_contact IS NOT NULL                                    -- not never-contacted
--   AND (snooze_until IS NULL OR date(snooze_until) <= date('now','localtime'))  -- not snoozed
--   AND rarely_responds = 0                                     -- Rarely-responds → no notif
--   AND reminders_off = 0                                       -- muted → no notif
--   AND (PROGRESS_SQL) >= WOBBLE_MAX AND (PROGRESS_SQL) < ROGUE_K  -- overdue but not rogue
-- (import PROGRESS_SQL / WOBBLE_MAX / ROGUE_K from status.ts — never re-typed.)
```
Birthday suppression is DIFFERENT: fires for **all except archived**, ignoring every decay suppressor (mirrors the 08-dashboard banner) — reuse `daysUntilBirthday() === 0`.

### `snooze-dao` — the FIRST writer of `contacts.snooze_until`
```typescript
// Source: dashboard-read.ts:33 storage contract + events-dao reserved 'snooze'/'unsnooze' + mutex idiom.
// Writes snooze_until (local YYYY-MM-DD) AND an immutable events snooze row in ONE transaction.
// Clear = NULL snooze_until (profile "Clear snooze"); optionally an 'unsnooze' event.
// Must NOT touch last_contact (single-writer DATA-04). Both in-app presets and the headless +1wk
// snooze call in here — one writer, one contract.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `expo-background-fetch` | `expo-background-task` (WorkManager) | SDK 52+ (fetch deprecated) | Use background-task if a backstop is built; fetch emits a deprecation warning on 57. |
| Ongoing/sticky un-dismissible reminders | User-dismissible even with `sticky:true` | Android 14 | Don't design around a pinned reminder — orchestrator chose `autoDismiss:true` anyway. |
| Notification bursts fire freely | Android 15 Notification Cooldown auto-mutes repetitive same-app notifications | Android 15 (API 35) | Stagger fire instants. |

**Deprecated/outdated:**
- `expo-background-fetch` — deprecated, replaced by `expo-background-task`.
- The workpapers read `expo-notifications@57.0.10`; registry latest 57.x is now `57.0.11` (patch). `npx expo install` resolves the SDK-pinned version — confirm on the build box; API surface is unchanged for what this phase uses.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `npx expo install` will resolve `expo-notifications` to the SDK-57 bundled `~57.0.10`/`57.0.11`; API surface (channels, DATE trigger, categories, registerTaskAsync, response listener, getLastNotificationResponseAsync) is stable across that patch. | Standard Stack | Low — patch-level; verify the resolved version + that `getLastNotificationResponseAsync` exists on the installed build. |
| A2 | The headless `registerTaskAsync` JS actually runs on the FCM-less release build. | Runtime State / NOTIF-02 | **HIGH** — this is the explicit device spike (04-log F5). If it fails, killed-app action buttons don't write. Must be proven on the Pixel before NOTIF-02 is called done. |
| A3 | Notification settings can live in a Zustand/AsyncStorage store OR a new SQLite table; the planner picks per OQ-1. | Claude's Discretion / OQ-1 | Medium — wrong choice makes Phase 16 backup unable to export the settings (a recorded [notify → backup] requirement). |
| A4 | Single birthday channel (not a private/public split for birthdays). | Channels / orchestrator pick 2 | Low — dossier assumed the simpler single birthday channel; a birthday body is a name only. |
| A5 | `reset({index:1, routes:[Home, Compose]})` is the right back-stack shape for a notification tap. | Pattern 5 | Low-Medium — verify on-device that Back from a cold-start tap lands on the dashboard, not exits the app. |
| A6 | Mark-contacted from a notification writes the 04-log canonical row (`source='notification'`, `direction='outbound'`, `channel='unspecified'`, `connected=1`, `quality=null`). | Pattern 4 | Low — these are the 04-log DECIDED one-tap-route values; confirm the recordTouchpoint call passes them. |

## Open Questions

1. **OQ-1 — Where do notification settings live, given no SQLite settings table exists?**
   - What we know: All current app-level settings (theme, dashboard-prefs, photo-cache-bust) are **Zustand + AsyncStorage** stores; there is **NO SQLite settings/kv table** (grep-confirmed — migration 1 has no such table). Backup (Phase 16 / 15-backup) is described as exporting "all tables + non-secret settings," and 13-ai says non-secret AI settings "live in SQLite settings" — but that table doesn't exist yet. `[notify → backup]` REQUIRES the notification settings be exportable.
   - What's unclear: Whether Phase 11 (a) adds a SQLite settings kv table via a new forward-only migration (backup's table-export then covers it naturally, and it seeds the AI settings home too), or (b) uses an AsyncStorage Zustand store (mirroring dashboard-prefs) and defers to Phase 16 to read AsyncStorage keys.
   - Recommendation: **Lean SQLite settings table via a new migration** — it satisfies the backup-export requirement structurally, matches the "logic/state that backup carries lives in SQLite" posture, and gives Phase 14 AI settings a home. But this is a storage-architecture call with a migration cost → surface to the owner/planner (it touches migration ordering). If AsyncStorage is chosen, the plan MUST add an explicit note that Phase 16 backup export/import must include these keys.

2. **OQ-2 — Does the birthday channel honour the lock-screen visibility toggle?**
   - What we know: Orchestrator pick 2 gives birthdays their own channel; the note says "×1 (or ×2 if birthdays also honour the visibility toggle; the simpler single birthday channel is assumed)."
   - Recommendation: Single birthday channel (private), matching the assumed default. Flag for owner veto only if he wants birthday names on the public lock screen.

3. **OQ-3 — Is a background-task backstop built at all in v1?**
   - What we know: The dossier calls it an "offline-intolerant best-effort backstop only." Its correctness value for a local-first app is marginal (it can't run offline) and it needs its own FCM-less-init proof.
   - Recommendation: **Omit the background-task backstop from v1** unless the owner wants it — the launch-reconcile is the decided primary and AlarmManager survives reboot/update. This avoids a second device spike and a network-gated code path of dubious value. Surface as a scope call; do not install `expo-background-task` unless the answer is yes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-notifications` | The entire engine | ✗ (NOT installed) | — install `~57.0.10/11` via `npx expo install` | none — blocking; must install |
| `@react-native-community/datetimepicker` | Delivery-hour + quiet-window Settings controls | ✓ | 9.1.0 | — |
| `expo-background-task` | OPTIONAL online backstop only | ✗ | — | Launch-reconcile is the primary; backstop is skippable (OQ-3) |
| Physical Pixel 6 Pro (desktop-build pipeline) | On-device verification of headless FCM-less task, killed-app taps, real delivery timing | ✓ | — | none — emulator cannot assess this (no local emulator by hardware; render-loop/perf/headless bring-up are Pixel-only) |
| `google-services.json` / FCM | (intentionally absent) | ✗ by design | — | N/A — the no-FCM path is the decided architecture; the spike proves it works without it |

**Missing dependencies with no fallback:** `expo-notifications` (install it — first task). On-device Pixel verification of the headless FCM-less path (no substitute — emulator can't do it).
**Missing dependencies with fallback:** `expo-background-task` (skip per OQ-3 recommendation).

## Validation Architecture

> `workflow.nyquist_validation` is `true` in config — this section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (node environment; react-native-free logic only) |
| Config file | `package.json` `"test": "vitest run"` (no separate vitest.config visible; project convention is `*.test.ts` beside source) |
| Quick run command | `npx vitest run src/services/notifications` (target the new suite) |
| Full suite command | `npm test` (currently 676+ tests green as of Phase 8/9) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | `nextAllowedFireInstant` rolls a quiet-window hit to next morning; staggers; respects user hour/window | unit (pure) | `npx vitest run src/services/notifications/fire-instant.test.ts` | ❌ Wave 0 |
| NOTIF-01 | Reconcile diff: cancels no-longer-due `decay:<id>`, schedules due, leaves unchanged | unit (mock expo-notifications getAll/schedule/cancel) | `npx vitest run src/services/notifications/notification-schedule.test.ts` | ❌ Wave 0 |
| NOTIF-03 | Decay-suppression predicate excludes never-contacted / snoozed / rogue(≥ROGUE_K) / rarely_responds / reminders_off; SQL parity with status.ts | unit (in-memory sqlite, like dashboard-read.test.ts) | `npx vitest run src/db/notification-read.test.ts` | ❌ Wave 0 |
| NOTIF-03 | `snooze-dao` writes local `YYYY-MM-DD` snooze_until + immutable events snooze row in one txn; never touches last_contact; clear NULLs it | unit (in-memory sqlite + mutex) | `npx vitest run src/db/snooze-dao.test.ts` | ❌ Wave 0 |
| NOTIF-04 | Birthday candidates = non-archived with `daysUntilBirthday()===0`; ignores decay suppressors | unit | `npx vitest run src/db/notification-read.test.ts` | ❌ Wave 0 (reuses birthday-logic, already tested) |
| NOTIF-02 | Shared action handler: mark → recordTouchpoint(source='notification', direction='outbound'…) + cancel; snooze → snooze-dao + cancel | unit (mock DAOs / in-memory sqlite) | `npx vitest run src/services/notifications/notification-actions.test.ts` | ❌ Wave 0 |
| NOTIF-02 | Headless task runs on FCM-less killed-app tap; body tap→Compose; Back→dashboard; delivery timing | **manual-only (on-device Pixel UAT)** | desktop-build-pipeline → adb uiautomator | manual (device spike A2) |
| NOTIF-05 | POST_NOTIFICATIONS value-moment request; denied→degraded note once; master/per-type/lockscreen toggles gate scheduling | manual-only (permission dialog + channel state are OS) + unit for the app-level gate logic | partial unit + Pixel UAT | ❌ Wave 0 (gate logic) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/services/notifications src/db/snooze-dao.test.ts src/db/notification-read.test.ts` (< 30s).
- **Per wave merge:** `npm test` (full suite) + `npm run check:colors` + `tsc --noEmit` + biome.
- **Phase gate:** Full suite green, then **on-device Pixel UAT** (mandatory — this phase's core behaviours are OS-runtime and UI-observable only; UAT is the remaining gate exactly as Phase 10 was). Cover: real morning delivery, killed-app mark/snooze write (verify via `run-as com.bwales.orbit` reading the DB), body-tap→Compose→Back→dashboard, quiet-window roll, mute/snooze suppression, birthday day-of, permission grant/deny degrade, lock-screen private/public.

### Wave 0 Gaps
- [ ] `src/services/notifications/fire-instant.test.ts` — covers NOTIF-01 timing math (quiet-window wrap is the key case)
- [ ] `src/services/notifications/notification-schedule.test.ts` — covers NOTIF-01 reconcile diff (mock expo-notifications)
- [ ] `src/services/notifications/notification-actions.test.ts` — covers NOTIF-02 handler routing
- [ ] `src/db/notification-read.test.ts` — covers NOTIF-03/04 suppression + birthday candidates (in-memory sqlite, mirror dashboard-read.test.ts)
- [ ] `src/db/snooze-dao.test.ts` — covers NOTIF-03 snooze writer contract
- [ ] A test double / mock for `expo-notifications` (schedule/cancel/getAll/setChannel/registerTaskAsync) — the module is native; unit tests mock it and assert call shapes. No framework install needed (Vitest present).

*Manual-only items (headless FCM-less bring-up, real delivery timing, permission dialog, channel visibility) are justified: they are OS-runtime behaviours the emulator cannot assess and the JS harness cannot exercise — the Pixel UAT is the Nyquist sample for them.*

## Security Domain

> `security_enforcement: true`, ASVS L1. This phase adds NO network path (local-first intact) and NO secrets. The surface is local data exposure + input validation of persisted settings.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in a local-only app. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | Single-user on-device. |
| V5 Input Validation | yes | User delivery-hour / quiet-window are numeric 0–23 (validate bounds before persisting + before scheduling math). `snooze_until` is app-computed local date strings (never user free-text). All DB writes `?`-bound (existing DAO discipline). |
| V6 Cryptography | no | Nothing encrypted here (backup encryption is Phase 16). |
| V7 Error Handling / Logging | yes | Do NOT log contact names/fuel in notification-path logs (Logger scopes exist; keep payloads out). |
| V8 Data Protection | yes | **Lock-screen exposure is the real control:** decay notifications default to the PRIVATE channel so a locked-screen glance does not reveal a contact name (name is sensitive in a relationship CRM). Public channel only on explicit opt-in. `allowBackup=false` already keeps the DB off `adb backup`. |

### Known Threat Patterns for {expo-notifications / local Android}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Contact name disclosed on lock screen | Information disclosure | Private-by-default second channel (immutable per-channel visibility); public only on opt-in. `[CITED: 11-notify Cluster D]` |
| Fuel/PII baked into a frozen scheduled body leaking to lock screen or persisting stale | Information disclosure | Generic body only — no fuel in notification text (also the Cluster A decision). |
| Malformed persisted hour/window corrupts scheduling math (NaN → wrong fire time) | Tampering / DoS | Validate 0–23 integer bounds on write and clamp on read in `fire-instant`. |
| Headless task doing a raw DB write outside the mutex → recency corruption | Tampering | Route all headless writes through the single-writer DAOs (mutex-protected); never a raw UPDATE. |
| Deep-link/notification data spoofing a contactId → opening arbitrary compose | Spoofing | `data.contactId` is app-minted at schedule time (not user-supplied); Compose self-fetches by id and no-ops on a missing contact (existing ComposeScreen behaviour). |

**No `security_block_on: high` items expected** provided the private-channel default and the single-writer routing hold; the code-review depth is `deep` and should verify both explicitly (read every writer of `snooze_until`, `reminders_off`, `last_contact` — grep-confirmed this session: `snooze_until` has no writer yet; `reminders_off` is written only by `updateContactMetadataCore`; `last_contact` only by `recency-dao`).

## Sources

### Primary (HIGH confidence)
- `docs/dossier/workpapers/11-notify/platform-scheduling-background.md` — first-hand read of expo-notifications@57.0.10 / expo-background-task@57.0.9 Android tarballs (frozen content, inexact alarm branch, network gate, cancel/replace identity, killed-state headless task, 3 architectures).
- `docs/dossier/workpapers/11-notify/platform-lifecycle-channels.md` — channel immutability + delete/recreate no-op, no quiet-hours field, replace-vs-stack, Android 14 dismissibility, Android 15 cooldown, no per-notification large icon.
- `docs/dossier/11-notify.md` — all 16 `[DECIDED]`/`[REJECTED]` items (authoritative).
- Codebase read on disk this session: `launch-sweep.ts`, `recency-dao.ts`, `events-dao.ts`, `status.ts`, `birthday-logic.ts`, `dashboard-read.ts`, `purge-dao.ts`, `contacts-dao.ts`, `EditContactScreen.tsx`, `SettingsScreen.tsx`, `App.tsx`, `linking.ts`, `navigation/types.ts`, `RootNavigator.tsx`, `dashboard-prefs-store.ts`, `package.json`, `app.config.ts`, `migrations/001-initial.ts` (grep). Grep-verified table writers.
- `11-CONTEXT.md`, `11-UI-SPEC.md`, `REQUIREMENTS.md` (NOTIF-01..05), `docs/dossier/INDEX.md` cross-domain constraint log.

### Secondary (MEDIUM confidence)
- docs.expo.dev/versions/latest/sdk/notifications (channels, DATE trigger, categories/actions, registerTaskAsync, response listener) — API names corroborate the tarball reads.
- `npm view expo-notifications` / `expo-background-task` — version confirmation this session (57.0.10 bundled, 57.0.11 latest 57.x, 57.0.9 background-task).

### Tertiary (LOW confidence)
- None relied upon — every load-bearing claim traces to a workpaper first-hand read, official docs, or code on disk.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages first-party, versions registry-confirmed, one not-yet-installed (flagged).
- Architecture: HIGH — platform-forced and `[DECIDED]`; every integration point read on disk.
- Pitfalls: HIGH — each cites a first-hand workpaper finding or on-disk code.
- Headless FCM-less bring-up: MEDIUM — source supports it, but it is an explicit on-device spike (A2), not provable remotely.
- Settings storage: MEDIUM — a real open architecture call (OQ-1) with a backup dependency.

**Research date:** 2026-08-16
**Valid until:** ~2026-09-15 (30 days — Expo SDK 57 is stable; re-check the resolved `expo-notifications` patch at install time).
