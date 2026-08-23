# Phase 15: Weekly Digest - Research

**Researched:** 2026-08-23
**Domain:** On-device weekly retrospective — one native WEEKLY local notification + a live-computed read-only "your week" screen, riding the 11-notify engine and the existing status/read layer. React Native / Expo SDK 57, local-first SQLite.
**Confidence:** HIGH (near-entirely code-grounded — every reuse claim carries a file:line citation from disk; the one external fact, the `WEEKLY` trigger, was platform-verified in the dossier at expo-notifications 57.0.9 and is confirmed installed at 57.0.11)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from CONTEXT.md ## Implementation Decisions)

**Retrospective — "Reached this week" (Grey Area 1 — accepted)**
- Presentation is a LIST of people, never a headline scoreboard count (resolves the dossier's ⚠ streak-caution — a bare number edges toward the rejected-streaks scoreboard). A gentle lead phrase may introduce it (e.g. "You caught up with these people this week"); no bold "N" figure.
- Each row: avatar + name + the day reached (e.g. "Tue"); tap → profile.
- Ordering: most recent first (reverse-chronological within the 7-day window).
- Empty retrospective: a calm, no-guilt line ("No catch-ups logged this week"); when the overlooked section is also empty this folds into the single "all quiet this week" state.
- Query semantics (DECIDED, dossier B): counts EVERY logged touchpoint in the trailing 7 days — outbound or inbound, connected or not, one-tap or full-log; **no `connected`/`direction` predicate**; archived contacts excluded.

**The overlooked (Grey Area 2 — accepted)**
- Gently sub-labelled groups: "Drifting" (rogue) · "Gone quiet" (Rarely-responds that have slipped) · a never-reached backlog nudge. Calm labels, not alarms.
- Never-contacted backlog = ONE gentle line with a count ("3 people you added but never reached") → taps through to the Never-Contacted screen; NOT re-listed inline.
- Ordering: most-slipped first (rogue → gone-quiet); the backlog nudge comes last.
- Cap ~6 people per group, then a "+N more →" tap-through (keeps the section calm, not overwhelming).
- Semantics (DECIDED, dossier B): the overlooked section is IN-APP screen content, **not suppressed by the per-contact reminders-off mute** (mute governs decay *pushes* only) — a muted contact that goes rogue still appears here. Rogue = the single shared rogue constant (09-orrery), read never recomputed. Archived excluded.

**The gentle "effortful" line — quality marker (Grey Area 3 — accepted)**
- Copy: **"A few recent conversations have felt effortful."** — coarse, kind, never a rating/verdict.
- Names the people: small, tappable names under the line (→ profile), since pointing at them is the marker's stated purpose (04-log).
- Placement: a quiet aside below the retrospective, above the overlooked section (not a headline).
- Trigger posture: **rare & real — conservative, err toward NOT showing.** The exact "skews hard" threshold over recent `quality` marks is a planning decision (a tunable constant); the design steer is "only when clearly real, never routine."

**Delivery, copy & entry point (Grey Area 4 — accepted)**
- Static notification copy (frozen at schedule time): **title "Your week in Orbit" · body "A look back at who you reached."** Every number is computed live on the screen it opens.
- In-app entry point in ADDITION to the Sunday push: a discreet dashboard header action ("Your week") → digest screen.
- Delivery (DECIDED, dossier D): ONE native `SchedulableTriggerInputTypes.WEEKLY` trigger, `weekday:1` = Sunday, morning window reusing 11-notify's morning-hour + quiet-window constants; AlarmManager-backed, survives reboot, no custom boot receiver. Fires unconditionally every week; a genuinely empty week opens to the calm "all quiet this week" state (no suppression).
- Third notification type (decay + birthday + digest), independently toggleable in the Settings Notifications section, defaults ON once notifications are granted; rides 11-notify's single value-moment `POST_NOTIFICATIONS` prompt (no new permission ask).
- All 6 dossier "decided without you" picks ACCEPTED.

### Claude's Discretion (deferred to planning per dossier)
- The three queries: retrospective (7-day `interactions`, no connected/direction predicate, archived excluded); overlooked (rogue via shared constant + Rarely-responds gone-quiet + `last_contact IS NULL`, mute ignored, archived excluded); the "skews hard" threshold over recent `quality` marks.
- Channel identity: digest's own notification channel vs an app-level gate (respect 11-notify's channel-immutability trap — recreate under a new versioned id to change behaviour).
- Idempotent re-registration of the single WEEKLY trigger on launch (via the launch sweep's digest re-register hook); cancel/re-register when the digest toggle flips or the weekday/hour constant changes.
- Tap routing (`data` payload → cold `getLastNotificationResponseAsync` / warm response listener → digest screen; Back → dashboard, reusing the `singleTask`/`onNewIntent` back-stack).
- Tunable constants at the top of the digest service file: delivery weekday (Sunday), morning hour, quiet-window bounds (shared with 11-notify), and the "skews hard" threshold.
- Export of the digest on/off toggle is a Phase-16 concern; the schedule is derived (re-registered), never exported.

### Deferred Ideas (OUT OF SCOPE)
- **[→ Phase 16] Markdown as an export FORMAT option.** Data export is Phase 16; the owner would like markdown considered as an export-format option there. Explicitly OUT of Phase 15. Phase 15 stays a pure read-only screen.
- **Birthday sections: NONE in the digest** — birthdays are wholly owned by 08-dashboard (banner) and 11-notify (morning notification). Recorded so a later reader does not re-add a birthday section here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DGST-01** | A single native WEEKLY notification fires Sunday morning (generic body, survives reboot) and opens a live "your week" screen; it fires unconditionally with a calm empty state; defaults on, independently toggleable. | Reuse `SchedulableTriggerInputTypes.WEEKLY` (notification-schedule.ts already imports `SchedulableTriggerInputTypes`); register under a `digest:*` identifier the existing decay/birthday reconcile already leaves untouched (notification-schedule.ts:287-289; test asserts it at notification-schedule.test.ts:505); re-register idempotently via a new launch-sweep hook (`registerSweepHook`, launch-sweep.ts:45); frozen generic copy per `notification-ids.ts`. **The "defaults on / independently toggleable" bit needs a durable persisted flag — see the Open Questions escalation (no such column exists in `app_settings`).** |
| **DGST-02** | The digest screen shows a retrospective ("reached this week" — all touchpoints in the window, no connected/direction predicate) and "the overlooked" (rogue + Rarely-responds gone-quiet + never-contacted backlog, mute ignored, archived excluded). | Retrospective = a new read over `interactions` (schema at 001-initial.ts:96-110) with a `date('now','localtime','-6 days')` window and NO `connected`/`direction` predicate. Overlooked = a new read over `STATUS_SQL`/`REASON_SQL` (status.ts:67-99) split by `rarely_responds`; **must NOT reuse `DECAY_ELIGIBLE_WHERE`** (decay-suppression.ts:58-62 excludes exactly the populations the digest wants). Backlog reuses the shipped `countNeverContacted()` (dashboard-read.ts:306). |
| **DGST-03** | The digest surfaces a gentle, non-judgemental line when recent quality marks skew "hard"; it adds no new schema (for the read surface). | `interactions.quality` is `good\|fine\|hard\|null` (001-initial.ts:106; counting idiom at ai-context-read.ts:122-140). A new read counts recent `hard` marks against a conservative tunable threshold. No new table/column for the read surface. |
</phase_requirements>

## Summary

Phase 15 is an **additive read-and-schedule phase over already-shipped subsystems** — it invents almost no new mechanism. The digest is (a) one native `SchedulableTriggerInputTypes.WEEKLY` trigger riding the 11-notify engine, re-registered idempotently by the launch sweep; (b) three new **read-only** DAO queries over existing tables (`interactions`, `contacts` via `STATUS_SQL`, `interactions.quality`); (c) one new native-stack screen + route; (d) a dashboard header entry; and (e) a fourth Settings toggle row. The heavy lifting — status/rogue computation, the timezone-correct date engine, the reconcile/back-stack/tap-routing plumbing, the settings persist path — all exists and must be **read, never re-derived** (CLAUDE.md).

Three findings dominate planning. **(1)** The overlooked query is the semantic *inverse* of the decay-suppression predicate: `DECAY_ELIGIBLE_WHERE` excludes rogue, rarely_responds, muted, and never-contacted — which are exactly the populations the digest surfaces. Reusing it (the instinctive move, since it is the "notification read layer") would produce an empty overlooked section. The digest must query `STATUS_SQL = 'rogue'` directly, split "Drifting" vs "Gone quiet" by the `rarely_responds` flag (equivalently `REASON_SQL` `'overdue'` vs `'unresponsive'`), and deliberately **omit** the `reminders_off = 0` filter. **(2)** The existing decay/birthday reconcile (`reconcileSchedule`) already coexists safely with a `digest:*` identifier — `isOwnedIdentifier` matches only `decay:`/`birthday:` (notification-schedule.ts:287-289) and a test explicitly asserts `digest:daily` is never cancelled (notification-schedule.test.ts:505). So the digest gets its **own** register/cancel function and its **own** launch-sweep hook; it must NOT be folded into `reconcileSchedule`. **(3) An escalation:** the dossier's `[DECIDED]` "adds NO new schema" collides with the same dossier's `[DECIDED]` "independently toggleable, defaults ON, exportable" digest flag. `app_settings` has no digest column, every prior toggle (decay, birthday, ai_*, sun) was added by an `ALTER TABLE ADD COLUMN` migration, and a durable OFF choice **cannot** be derived from trigger presence (the sweep would re-enable it). A persisted flag is genuinely required → a migration → "new schema." This is an owner decision, not a silent migration.

**Primary recommendation:** Plan three read-only DAOs in `src/db/` (retrospective, overlooked, gentle-line) with pure logic extracted to `src/logic/*-logic.ts` for node testing; a digest schedule service (`src/services/notifications/digest-schedule.ts`) owning the `WEEKLY` trigger under a `digest:weekly` identifier + its own launch-sweep hook + a new `digest-v1` LOW/PRIVATE channel; a new `Digest` route + screen; a dashboard header entry; and a fourth Settings toggle. **Before any of that, get an owner ruling on where the digest-enabled flag persists** (recommended: new `app_settings.digest_enabled` column via migration 005, renumbering Phase-16's reserved 005 tombstones to 006).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| WEEKLY notification firing | OS / AlarmManager (native trigger) | Launch sweep (JS re-register) | The trigger is AlarmManager-backed and survives reboot without the app; JS only re-arms it idempotently and on toggle/constant change. |
| Digest-enabled persistence | Database (`app_settings`) | Settings UI | A durable, exportable, backup-native flag belongs in the single-row settings table, read by the schedule service — **needs a new column (escalation)**. |
| Retrospective / overlooked / gentle-line reads | Database read layer (DAO in `src/db/`) | Pure logic (`src/logic/`) for day-tag + threshold | Reads go through DAOs, never inline in components (CLAUDE.md); pure transforms extracted for node tests. |
| Rogue / status classification | Database read layer (reads `STATUS_SQL`/`ROGUE_K`) | — | The single shared rogue constant is READ, never recomputed (status.ts is the sole source). |
| "Your week" screen rendering | UI / screen (`src/screens/DigestScreen.tsx`) | Navigation (new route) | A live-computed, static (non-animated) read surface; focus-effect reload with a cancelled-flag guard. |
| Tap routing (notification → screen) | Navigation gate (existing `NotificationResponseGate`) | Pure nav resolver (`notification-nav.ts`) | Extend the existing serializable-intent resolver + gate; no new OS wiring. |
| Settings toggle | UI / screen (`SettingsScreen`) | Database (`updateAppSettings`) + schedule service | A fourth per-type row on the existing persist path. |

## Standard Stack

**No new packages.** Every dependency this phase needs is already installed and proven in shipped phases. [VERIFIED: package.json + on-disk usage]

### Core (all already installed)
| Library | Version | Purpose | Why Standard (evidence) |
|---------|---------|---------|--------------------------|
| `expo-notifications` | ~57.0.11 | The `WEEKLY` trigger, channel creation, tap listeners | Already the whole 11-notify engine; `SchedulableTriggerInputTypes` imported at notification-schedule.ts:65. [VERIFIED: package.json:18] |
| `@react-navigation/native-stack` | (installed) | New `Digest` route | The app's navigation shell (RootNavigator.tsx:1,38). [VERIFIED: RootNavigator.tsx] |
| `expo-sqlite` | (installed) | The three read queries | Every read goes through DAOs on `expo-sqlite` (dashboard-read.ts posture). [VERIFIED] |
| `react-native` `Switch` | (RN core) | The 4th Settings toggle | Identical idiom to decay/birthday toggles (SettingsScreen.tsx:682-695). [VERIFIED] |
| `react-native-safe-area-context` / RN primitives | (installed) | Screen chrome | Mirrors NeverContactedScreen / SettingsScreen. [VERIFIED via UI-SPEC citations] |

### Supporting (in-repo modules to import, never re-implement)
| Module | Path | Purpose |
|--------|------|---------|
| `PROGRESS_SQL` / `STATUS_SQL` / `REASON_SQL` / `ROGUE_K` | `src/db/status.ts` | Rogue & status classification (READ) |
| `countNeverContacted` | `src/db/dashboard-read.ts:306` | Backlog count (reuse verbatim) |
| `formatLocalDate` | `src/utils/dates.ts` | Local `YYYY-MM-DD`; the day-tag + window math |
| `registerSweepHook` | `src/services/launch-sweep.ts:45` | Register the digest re-register hook |
| `getAppSettings` / `updateAppSettings` | `src/db/app-settings-dao.ts` | Read/write the (new) digest flag + shared morning-hour/quiet-window |
| channel/id/body constants pattern | `src/services/notifications/notification-ids.ts` | Add the digest channel id + frozen body here |
| `resolveNotificationNav` + `NotificationResponseGate` | `src/services/notifications/notification-nav.ts`, `src/navigation/notification-gate.tsx` | Extend for the digest tap |
| Quality-count idiom | `src/db/ai-context-read.ts:122-140` | The `good/fine/hard` tally pattern for the gentle line |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Own `digest-schedule.ts` + own launch-sweep hook | Fold digest into `reconcileSchedule` | Rejected — `reconcileSchedule` is decay/birthday-owned (only `decay:`/`birthday:` are "owned"); folding it in would force widening `isOwnedIdentifier` and risk the cancel-all path clobbering the weekly trigger. Keep them separate (already tested-for). |
| New `app_settings.digest_enabled` column | Derive "enabled" from `digest:weekly` trigger presence | Rejected — cannot represent a durable user-OFF (the sweep would re-arm it every launch). See escalation. |
| New `app_settings.digest_enabled` column | AsyncStorage / MMKV | Rejected — violates "no new persistent state" too AND is not captured by the Phase-16 JSON backup (which must export the toggle). The settings column is the backup-native home. |

## Package Legitimacy Audit

**Not applicable — this phase installs NO external packages.** Every module is either already in `package.json` (verified installed) or an in-repo file. No npm/PyPI/crates lookup is required; no `checkpoint:human-verify` install gates are needed.

## Architecture Patterns

### System Data-Flow Diagram

```
SUNDAY MORNING (app closed)                          IN-APP ENTRY (any time)
   AlarmManager fires digest:weekly                     Dashboard "Your week" press
   (frozen generic body)                                        │
          │  user taps                                          │ navigation.navigate("Digest")
          ▼                                                     ▼
   OS delivers response ─────► NotificationResponseGate ───► Digest route (no params)
   (cold: getLastNotificationResponseAsync,     │                     │
    warm: response listener)                    │                     │
          │  resolveNotificationNav(data)        │                     │
          │  kind:"digest" → navigate "Digest"   │                     │
          └──────────────────────────────────────┘                     │
                                                                        ▼
                                             DigestScreen focus-effect (cancelled-flag guard)
                                                        │  three READ-ONLY DAOs (parallel)
                        ┌───────────────────────────────┼───────────────────────────────┐
                        ▼                               ▼                               ▼
              readRetrospective(exec)        readOverlooked(exec)            readGentleLine(exec)
              interactions in 7-day window   STATUS_SQL='rogue' split by     recent interactions.quality
              archived excluded              rarely_responds; mute IGNORED   count 'hard' vs total
              no connected/direction         archived excluded               conservative threshold
              → [{id,name,photo,day}]        + countNeverContacted()         → {show, people[]}
                        │                    → {drifting[], goneQuiet[],                 │
                        │                        backlogCount}                           │
                        └───────────────┬───────────────┴───────────────────────────────┘
                                        ▼
                          Section render (fixed order): Retrospective → Gentle line
                          → Overlooked(Drifting, Gone quiet, Backlog nudge) → else "All quiet"
                          every row Pressable → Profile / backlog → NeverContacted / Back → Home

LAUNCH SWEEP (every real foreground launch)
   runLaunchSweep() → [decay/birthday reconcile hook] → [NEW digest re-register hook]
                                                             reconcileDigestSchedule(exec):
                                                             read digest_enabled + hour/weekday
                                                             getAllScheduledNotificationsAsync()
                                                             enabled & absent → schedule WEEKLY
                                                             disabled & present → cancel
                                                             enabled & drifted → cancel + reschedule
```

### Recommended Structure (additive files)
```
src/
├── db/
│   ├── digest-read.ts              # readRetrospective / readOverlooked / readGentleLine (READ-ONLY)
│   └── migrations/
│       └── 005-digest-setting.ts   # ⚠ ESCALATION-GATED: ADD COLUMN digest_enabled (see Open Questions)
├── logic/
│   └── digest-logic.ts             # day-tag formatting, "skews hard" threshold, group cap/split (node-pure)
├── services/notifications/
│   └── digest-schedule.ts          # WEEKLY trigger register/cancel + reconcileDigestSchedule + sweep hook
├── screens/
│   └── DigestScreen.tsx            # the "your week" read surface (device-UAT)
└── (edits) notification-ids.ts, notification-nav.ts, notification-gate.tsx,
           channels.ts, RootNavigator.tsx, navigation/types.ts,
           SettingsScreen.tsx, HomeScreen.tsx, app-settings-dao.ts
```

### Pattern 1: The retrospective query (trailing-7-day, all touchpoints, per-person)
**What:** One row per contact who has ANY interaction in the window, showing their most-recent touch day; reverse-chronological; archived excluded; NO `connected`/`direction` predicate.
**Grounding:** `interactions` schema at 001-initial.ts:96-110 (`occurred_at TEXT`, `connected`, `direction`, `quality`); timezone rule from status.ts:44-59 (stored `occurred_at` is local wall-clock → truncate with **bare** `date()`, convert only `now`).
```sql
-- Source: composed from status.ts timezone rule + dashboard-read.ts read posture
SELECT c.id, c.name, c.photo, MAX(i.occurred_at) AS last_reached
  FROM interactions i
  JOIN contacts c ON c.id = i.contact_id
 WHERE c.archived_at IS NULL
   AND date(i.occurred_at) >= date('now','localtime','-6 days')  -- 7-day inclusive window
 GROUP BY c.id
 ORDER BY last_reached DESC, c.name COLLATE NOCASE, c.id
```
- **NO `connected`/`direction` filter** (DECIDED, dossier B): a one-way text with no reply counts; an inbound counts; a one-tap widget mark counts.
- The "day reached" tag ("Tue") is derived in `digest-logic.ts` from `last_reached` — not in SQL.
- Window boundary (`-6 days` = today + 6 prior = 7 inclusive) is a **planning tunable**; confirm "this week" vs "prior 7 days" intent. Uses `date('now','localtime')`, never `toISOString().split` (documented UTC off-by-one; dates.ts).

### Pattern 2: The overlooked query — the INVERSE of decay-suppression
**What:** Two rogue groups + a backlog count. Reuses `STATUS_SQL`/`REASON_SQL`; **omits** the mute filter; splits by `rarely_responds`.
**Grounding:** status.ts:67-99. A `rarely_responds=1` contact reaches `'rogue'` at `progress >= WOBBLE_MAX` with `REASON_SQL='unresponsive'`; a time-drift contact reaches `'rogue'` at `progress >= ROGUE_K` with `REASON_SQL='overdue'` (branch order identical, so status/reason never disagree — status.ts:77-83).
```sql
-- Drifting (rogue by time) + Gone quiet (rogue by rarely_responds), mute IGNORED
SELECT c.id, c.name, c.photo, c.rarely_responds,
       (${PROGRESS_SQL}) AS progress,
       (${STATUS_SQL})   AS status,
       (${REASON_SQL})   AS reason
  FROM contacts c
 WHERE c.archived_at IS NULL
   AND c.last_contact IS NOT NULL          -- rogue needs progress; never-contacted excluded here
   AND (${STATUS_SQL}) = 'rogue'
 ORDER BY progress DESC, c.name COLLATE NOCASE, c.id
```
- Split in `digest-logic.ts`: `reason === 'overdue'` (equivalently `rarely_responds = 0`) → **Drifting**; `reason === 'unresponsive'` (`rarely_responds = 1`) → **Gone quiet**.
- **DELIBERATELY no `reminders_off = 0`** — a muted contact that goes rogue still appears (DECIDED, dossier B).
- **DO NOT reuse `DECAY_ELIGIBLE_WHERE`** (decay-suppression.ts:58-62): it excludes `rarely_responds`, `reminders_off`, and `progress >= ROGUE_K` — the exact populations the overlooked section is *for*.
- Backlog nudge = `countNeverContacted(exec)` (dashboard-read.ts:306, `archived_at IS NULL AND last_contact IS NULL`) — reuse verbatim; it taps to the existing `NeverContacted` route.
- Cap ~6/group: apply in `digest-logic.ts` (slice + `+N more`), or `LIMIT 7` per group and derive overflow. Interpolate ONLY code-constants into SQL (no user free-text) — matches the injection posture in status.ts/dashboard-read.ts.

### Pattern 3: The gentle "effortful" line (conservative quality read)
**What:** Read recent `interactions.quality` marks; show the line only when they "skew hard" by a conservative tunable; name the people.
**Grounding:** `quality` is `good|fine|hard|null` (001-initial.ts:106); the count idiom at ai-context-read.ts:122-140.
- Query recent marks over a bounded window (e.g. last N interactions or a trailing window — a planning tunable). Count `hard` vs total non-null.
- Threshold lives at the **top of `digest-logic.ts`** as a single-number tunable (e.g. `EFFORTFUL_MIN_HARD` count AND/OR a `hard`-fraction floor). Design steer: "err toward NOT showing" — require both a minimum absolute count and a fraction, so one bad chat never triggers it.
- The named people tap → Profile. This read returns their `{id, name}`.

### Pattern 4: The WEEKLY trigger + its own reconcile hook
**What:** Register one `SchedulableTriggerInputTypes.WEEKLY` trigger under `digest:weekly`, re-registered idempotently by a NEW launch-sweep hook and on toggle/constant change.
**Grounding:** notification-schedule.ts imports `SchedulableTriggerInputTypes` (line 65) and uses `.DATE`; `WEEKLY` is the sibling verified in the dossier (Findings, SDK 57.0.9). `isOwnedIdentifier` matches only `decay:`/`birthday:` (notification-schedule.ts:287-289), and a test asserts a `digest:*` id is never cancelled (notification-schedule.test.ts:505) — so a `digest:weekly` id coexists safely.
```typescript
// Source: composed from notification-schedule.ts:339-355 (scheduleOne) + dossier WEEKLY verification
await scheduleNotificationAsync({
  identifier: "digest:weekly",
  content: { body: DIGEST_BODY, title: DIGEST_TITLE,
             data: { kind: "digest" }, autoDismiss: true },
  trigger: {
    type: SchedulableTriggerInputTypes.WEEKLY,
    channelId: DIGEST_CHANNEL,          // new digest-v1 channel
    weekday: 1,                         // 1 = Sunday (device-spike verify)
    hour: DELIVERY_HOUR, minute: 0,
  },
});
```
- `reconcileDigestSchedule(exec)`: read `digest_enabled` + master toggle + `deliveryHour`/quiet-window from `getAppSettings`; read `getAllScheduledNotificationsAsync()`; **enabled & absent** → schedule; **disabled (or master off) & present** → cancel; **enabled & present but weekday/hour drifted** → cancel + reschedule (mirror the H3 full-request diff idea, notification-schedule.ts:308-336). Idempotent: no duplicate registrations across repeated launches.
- Register it as its OWN hook via `registerSweepHook` (mirror `registerNotificationScheduleSweep`, notification-schedule.ts:520-526). The Settings persist path fires it after a toggle flip (mirror `void reconcileSchedule(exec)` at SettingsScreen.tsx:356).
- Frozen generic copy in `notification-ids.ts` (`DIGEST_TITLE`/`DIGEST_BODY`); a digest carries NO contactId, so extend `NotificationData.kind` to `"decay" | "birthday" | "digest"` and make `contactId`/`occurrenceKey` optional for digest.

### Pattern 5: The new channel (respect the immutability trap)
**What:** A new `digest-v1` channel, LOW importance, PRIVATE visibility, added to `ensureChannels()`.
**Grounding:** channels.ts:1-25 — importance/visibility are IMMUTABLE at creation; version the id (`-v1`); never mutate an existing channel. The generic copy names no one, so PRIVATE is safe on a public lock screen (mirrors birthday, channels.ts:54-58).
- Recommendation: a dedicated `digest-v1` channel (not the decay/birthday channel) so the user can independently silence it at the OS level and so a future visibility change ships as `digest-v2` without touching reminders. Add the constant to notification-ids.ts alongside `BIRTHDAY_CHANNEL`.

### Pattern 6: Tap routing + the new screen
- Extend `resolveNotificationNav` (notification-nav.ts:58-80): `kind === "digest"` → `{ type: "navigate", name: "Digest" }` (no params). Extend `isNotificationData` narrowing (notification-nav.ts:43-52) to accept `"digest"` without a numeric `contactId`.
- Extend the gate's `NotificationData` handling only insofar as the resolver changes — the gate already routes `DEFAULT_ACTION_IDENTIFIER` body taps through `resolveNotificationNav` (notification-gate.tsx:82-96,168-169). Back → dashboard is automatic for a `navigate` onto the existing stack (Home is `initialRouteName`, RootNavigator.tsx:55); no reset needed since the digest carries no compose deep-link.
- Add `Digest: undefined` to `RootStackParamList` (navigation/types.ts) and a `<Stack.Screen name="Digest" component={DigestScreen} />` (RootNavigator.tsx). `headerShown:false` — the screen renders its own Back chrome (UI-SPEC Screen Anatomy).
- Screen reload: focus-effect with a `cancelled`-flag guard (the shipped pattern, NeverContactedScreen.tsx:66-82 / HomeScreen.tsx:137-169); null-vs-loaded sentinel so "all quiet" never flashes before data (UI-SPEC Interaction contract).

### Pattern 7: The dashboard entry + the Settings row
- Dashboard: add a discreet "Your week" text `Pressable` to the top bar (`HomeScreen.tsx:485-515` `topBar`), leftmost, `onPress={() => navigation.navigate("Digest")}`, pressed→accent idiom (HomeScreen.tsx:493-502), `testID="dashboard-your-week-entry"`. No badge (locked).
- Settings: a 4th toggle row after "Birthday alerts" (SettingsScreen.tsx:702-738) and before lock-screen (:741), copying `styles.row` + the gated-label/`Switch` idiom (SettingsScreen.tsx:682-695); `onValueChange={(v) => void persist({ digestEnabled: v ? 1 : 0 })}` — but note `persist` currently fires `reconcileSchedule` (SettingsScreen.tsx:350-357); it must ALSO fire `reconcileDigestSchedule` (or the digest persist uses a sibling handler). Default ON once granted.

### Anti-Patterns to Avoid
- **Reusing `DECAY_ELIGIBLE_WHERE` / `notification-read.ts` for the overlooked section.** It suppresses exactly what the digest surfaces. Write a fresh `STATUS_SQL='rogue'` read.
- **Recomputing rogue / any threshold.** Read `ROGUE_K`/`STATUS_SQL` from status.ts. Never a second rogue constant (CLAUDE.md; decay-suppression.ts:44-45).
- **Folding the digest into `reconcileSchedule`.** Keep a separate `digest-schedule.ts` + hook.
- **Mutating an existing notification channel.** Create `digest-v1`; never `setNotificationChannelAsync` an existing id to change importance/visibility (channels.ts:16-24).
- **`toISOString().split('T')[0]` for the window.** Use `date('now','localtime','-6 days')` / `formatLocalDate` (dates.ts; the documented, once-fixed UTC bug).
- **A background timer / custom boot receiver for the weekly fire.** The `WEEKLY` trigger is AlarmManager-backed and auto-re-registers via expo's `RECEIVE_BOOT_COMPLETED` (dossier Findings). The sweep re-register is a belt-and-braces idempotent guard, not the primary mechanism.
- **Driving the screen from per-frame state / animation.** The digest is static content; no Skia loop (UI-SPEC).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rogue / status classification | A digest-local rogue threshold | `STATUS_SQL` / `REASON_SQL` / `ROGUE_K` (status.ts) | Single shared constant; a second one silently drifts (CLAUDE.md). |
| Never-contacted backlog count | A new `COUNT(*)` | `countNeverContacted()` (dashboard-read.ts:306) | Already the dashboard's exact predicate. |
| 7-day window / day tags | `toISOString`-based date math | `date('now','localtime',…)` + `formatLocalDate` | UTC off-by-one is a documented, already-fixed bug. |
| Weekly firing that survives reboot | A custom `BOOT_COMPLETED` receiver + timer | `SchedulableTriggerInputTypes.WEEKLY` | AlarmManager-backed; expo auto-re-registers on boot (dossier). |
| Idempotent re-arm | Ad-hoc "already scheduled?" logic | `getAllScheduledNotificationsAsync()` diff, mirroring `reconcileSchedule` | Proven full-request-diff pattern (notification-schedule.ts:462-478). |
| Tap → screen routing | New OS listener wiring | Extend `resolveNotificationNav` + reuse `NotificationResponseGate` | Cold/warm/replay-guard already solved (notification-gate.tsx). |
| Quality tally | A new aggregate | The `good/fine/hard` count idiom (ai-context-read.ts:122-140) | Same shape, already tested. |
| Settings persist + reconcile | New write path | `updateAppSettings` + `persist(...)` (SettingsScreen.tsx:350-357) | Validated (0/1 toggles) + fires reconcile. |

**Key insight:** This phase's correctness lives almost entirely in *choosing the right existing predicate* and *not re-deriving constants*. The single genuinely new mechanism is the `WEEKLY` trigger; everything else is composition of shipped, tested code.

## Runtime State Inventory

> Included because this phase registers OS-level state (a native weekly alarm) and (pending the escalation) may add stored settings state — a launch/reboot correctness surface, not a greenfield screen.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | No digest state exists today — grep for `digest_enabled`/`digestEnabled` in `src/db`/`src/services` returns **nothing** (only an unrelated `deliveryHour` comment and a test fixture id). A durable enabled flag must be introduced. | **Escalation** — a new `app_settings.digest_enabled` column (migration) OR an owner-approved alternative. Data migration writes the default (ON) for existing installs. |
| **Live service config** | The single native `digest:weekly` scheduled notification (in the OS's pending set, not in git). Coexists with `decay:*`/`birthday:*`; the decay/birthday reconcile already leaves `digest:*` untouched (notification-schedule.ts:287-289; test :505). | New `digest-schedule.ts` owns register/cancel; launch-sweep hook re-arms idempotently. |
| **OS-registered state** | The `WEEKLY` AlarmManager alarm survives reboot via expo's auto `RECEIVE_BOOT_COMPLETED` (no new manifest entry expected — verify the existing notify manifest covers it). A new `digest-v1` notification channel is created idempotently in `ensureChannels()`. | Device spike: confirm once-per-week fire + reboot persistence on the physical Pixel (pre-57 bugs #34782/#30577). Add the channel to `ensureChannels()`. |
| **Secrets / env vars** | None — the digest touches no keys, no SecureStore, no network. | None. |
| **Build artifacts / installed packages** | None — no new npm dep, no native module, no prebuild change (unlike Phase 12's widget / Phase 14's `orbit-secure-fetch`). Pure JS + one new migration. | None. |

**The canonical question — after every file is updated, what still has old/derived state?** The OS pending-notification set (owned by the reconcile hook) and, if approved, the `app_settings.digest_enabled` value on existing installs (owned by the migration default). Both are addressed above; nothing else persists digest state.

## Common Pitfalls

### Pitfall 1: The "enabled" flag cannot be derived from trigger presence
**What goes wrong:** If digest-enabled is inferred from "does `digest:weekly` exist?", the launch-sweep re-register can't tell "user turned it OFF" from "default ON, not yet armed" — it re-arms every launch, defeating the toggle.
**Why:** The reconcile hook must re-register when enabled; with no stored OFF bit, "enabled" always reads true.
**How to avoid:** Persist an explicit `digest_enabled` flag (the escalation). The sweep reads it; absence of the trigger ≠ user intent.
**Warning signs:** Toggling OFF, backgrounding, and re-foregrounding re-enables the digest.

### Pitfall 2: WEEKLY weekday numbering and pre-57 repeat bugs
**What goes wrong:** `weekday` off-by-one (some platforms use 1=Sunday, others 1=Monday) fires on the wrong day; pre-57 repeat bugs (#34782/#30577) fired multiple times or not weekly.
**Why:** Platform/version-specific trigger behavior; emulator cannot validate timing (CLAUDE.md — Ivy Bridge box has no local emulator, and the desktop emulator's timing is not authoritative).
**How to avoid:** Dossier verified `weekday:1 = Sunday` at SDK 57.0.9; **device spike is mandatory** on the physical Pixel — confirm exactly-once/week + reboot re-register.
**Warning signs:** Digest arrives Saturday/Monday, or twice.

### Pitfall 3: Overlooked section renders empty (wrong predicate)
**What goes wrong:** Reusing the notification read layer / `DECAY_ELIGIBLE_WHERE` yields nothing — it excludes rogue, rarely_responds, muted, never-contacted.
**How to avoid:** Query `STATUS_SQL = 'rogue'` directly, omit the mute filter, split by `rarely_responds`. See Pattern 2.
**Warning signs:** A known-rogue or muted-rogue contact is absent from Drifting/Gone-quiet.

### Pitfall 4: rarely_responds rogue mis-grouped
**What goes wrong:** A `rarely_responds=1` contact past `ROGUE_K` gets put in "Drifting" instead of "Gone quiet".
**Why:** STATUS_SQL's branch order makes the rarely_responds path win first → `REASON_SQL='unresponsive'` even past ROGUE_K (status.ts:77-83).
**How to avoid:** Split by `reason` (`'unresponsive'`→Gone quiet, `'overdue'`→Drifting) or equivalently the `rarely_responds` flag — never by the raw progress value.

### Pitfall 5: Timezone double-conversion on the window
**What goes wrong:** Applying `'localtime'` to the stored `occurred_at`, or using `toISOString`, shifts late-evening rows a calendar day and drops/adds people at the window edge.
**How to avoid:** `occurred_at` is already local wall-clock — truncate with **bare** `date(i.occurred_at)`; convert only `now` (`date('now','localtime','-6 days')`). Exactly status.ts:44-59 / dashboard-read.ts:28-31.

### Pitfall 6: Empty week must still open the screen
**What goes wrong:** Suppressing the fire on a predicted-empty week (impossible anyway — content is frozen at schedule time) or the screen crashing on all-empty reads.
**How to avoid:** Fire unconditionally (DECIDED, dossier D); the screen's unified "All quiet this week" state (UI-SPEC §4) handles all-empty. Test the empty path explicitly.

### Pitfall 7: `persist()` only reconciles decay/birthday
**What goes wrong:** Flipping the digest toggle via the existing `persist` (SettingsScreen.tsx:350-357) writes the flag but fires only `reconcileSchedule` (decay/birthday) — the WEEKLY trigger never arms/cancels.
**How to avoid:** The digest toggle handler must also call `reconcileDigestSchedule(exec)` (or `persist` is extended to fire both). Verify the toggle actually schedules/cancels `digest:weekly`.

## Code Examples

### Registering the digest re-register as a launch-sweep hook
```typescript
// Source: mirrors registerNotificationScheduleSweep (notification-schedule.ts:520-526)
export function registerDigestScheduleSweep(getExec: () => SqlExecutor): void {
  registerSweepHook(async () => {
    await reconcileDigestSchedule(getExec());
  });
}
```

### The quality tally for the gentle line
```typescript
// Source: idiom from ai-context-read.ts:122-140
let hard = 0, total = 0;
for (const r of rows) {
  if (r.quality === "good" || r.quality === "fine" || r.quality === "hard") total += 1;
  if (r.quality === "hard") hard += 1;
}
// digest-logic.ts tunable: conservative — require BOTH an absolute floor and a fraction
const show = hard >= EFFORTFUL_MIN_HARD && hard / Math.max(total, 1) >= EFFORTFUL_MIN_FRACTION;
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Obsidian plugin: manual palette command writing a markdown vault file (`generateWeeklyDigest`, main.ts:294-356) | Native scheduled `WEEKLY` push → live in-app screen | This phase | No file plumbing ports; the buckets are redesigned from the status model (dossier Findings). |
| Plugin buckets: contacted / needs-attention(decay) / snoozed | Retrospective (all touchpoints) + overlooked (rogue/gone-quiet/backlog) + gentle quality line | This phase | Dashboard already owns needs-attention/snoozed; the digest earns its keep on the retrospective + non-nagged populations. |

**Deprecated/outdated:** the plugin's markdown mechanics (dropped entirely, dossier "decided without you" #2); the "snoozed" bucket (dropped, #1); any per-occurrence notification content (frozen-content platform fact).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The digest-enabled flag persists as a new `app_settings.digest_enabled` column (migration 005). | Escalation / Open Q1 | **Owner decision** — reverses the dossier "no new schema" line; wrong home breaks Phase-16 export or "default ON". |
| A2 | Retrospective window = `date('now','localtime','-6 days')` (7 days inclusive of today). | Pattern 1 | Off-by-one on the window edge (6 vs 7 days); a planning tunable, easily adjusted. |
| A3 | "Gone quiet" = `rarely_responds=1 & rogue`; "Drifting" = `rarely_responds=0 & rogue`. | Pattern 2 | Mis-grouping; grounded in REASON_SQL branch order but the label→branch mapping is my read of CONTEXT copy. |
| A4 | The "skews hard" trigger uses both a min-count and a min-fraction over a recent-marks window. | Pattern 3 | Too eager/too shy a gentle line; the exact threshold + window is explicitly a planning tunable, owner-tunable later. |
| A5 | A dedicated `digest-v1` channel (not an app-level gate reusing an existing channel) is preferred. | Pattern 5 | CONTEXT lists this as Claude's discretion; a channel is one-way (immutable), so the choice is near-permanent — worth an owner nod. |
| A6 | `weekday:1 = Sunday` and once-per-week firing hold on the physical Pixel at 57.0.11. | Pitfall 2 | Wrong day / duplicate fires — the **mandatory device spike** exists precisely to de-risk this. |
| A7 | The existing notify manifest already grants what the `WEEKLY` alarm needs (no new manifest/prebuild). | Runtime State | If a manifest entry is missing, reboot persistence fails — verify during the device spike. |

## Open Questions

1. **[ESCALATION — owner decision] Where does the digest-enabled flag persist, given the dossier's `[DECIDED]` "adds NO new schema"?**
   - What we know: `app_settings` has **no** digest column (verified — the columns are `notifications_enabled, decay_enabled, birthday_enabled, lockscreen_public, delivery_hour, quiet_start_hour, quiet_end_hour, sun_contact_id, self_sun_colour, ai_*`, app-settings-dao.ts:116-135). Every prior toggle (decay/birthday migration 002, ai_* migration 004, sun migration 003) was added by `ALTER TABLE app_settings ADD COLUMN`. A durable OFF **cannot** be derived from trigger presence (Pitfall 1). AsyncStorage would violate "no new persistent state" AND miss the Phase-16 backup export.
   - What's unclear: whether the dossier's "no new schema" was meant to forbid a single settings-column addition, or only to forbid new *contact-data* tables/columns for the read surface. The same dossier also `[DECIDED]` the toggle is "independently toggleable, defaults ON" and "[digest → backup] export the digest on/off toggle" — which *require* durable, exportable state. The two decided lines conflict.
   - Recommendation: treat as an owner escalation (CLAUDE.md — reversing/interpreting a recorded decision is the owner's call; a reviewer-flagged control removal-by-name is an escalation trigger). **Recommended resolution:** add `app_settings.digest_enabled INTEGER NOT NULL DEFAULT 1` via **migration 005**, consistent with how every prior toggle shipped and with the Phase-16 export requirement. Note this is `[DECIDED]`-adjacent — do NOT plan the migration until the owner rules.

2. **[Migration numbering collision] Phase 16 has reserved migration 005 (`sync_tombstones`).**
   - What we know: `.planning/sync-milestone/PHASE-16-SYNC-READINESS.md:41` reserves "New **migration 005**: a `sync_tombstones` table." If Phase 15 takes 005 for `digest_enabled`, Phase 16's tombstones migration must become **006** (migrations are strictly ordered by ship order; Phase 15 ships first).
   - Recommendation: if Q1 resolves to a migration, Phase 15 = 005 (`digest_enabled`), Phase 16 = 006 (`sync_tombstones`); update the Phase-16 readiness doc/ROADMAP note. Flag to the owner alongside Q1 so both migrations are renumbered coherently.

3. **[Design tunable] The retrospective window boundary and the "+N more →" destination.**
   - What we know: window is `-6 days` (assumed) — inclusive-7. The "+N more →" destination (in-place expand vs a filtered route) is explicitly a planner decision (UI-SPEC §Overlooked); there is no existing rogue-list screen.
   - Recommendation: in-place expand (no new route) keeps the phase minimal and matches "pure read surface"; the affordance copy/accent/44px target are already locked by the UI-SPEC. Confirm at planning.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-notifications` | WEEKLY trigger, channel, tap | ✓ | ~57.0.11 | — |
| `SchedulableTriggerInputTypes.WEEKLY` | DGST-01 | ✓ (per dossier platform-verify @57.0.9) | 57 | none — core to the phase |
| Physical Pixel 6 Pro (device spike) | Verify weekly fire + reboot | ✓ (owner's phone, per CLAUDE.md `emu-connect device`) | — | none — emulator cannot verify timing (CLAUDE.md) |
| Desktop build pipeline (`ssh droid` → APK → Pixel) | On-device UAT | ✓ | — | — |
| vitest + `node:sqlite` testkit | Node-side query/logic tests | ✓ | vitest ^4.1.10 | — |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none. The only *gated* item is the device spike, which requires the owner's phone to be plugged in and authorized (owner-only action, CLAUDE.md).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (`node:sqlite`-backed DAO tests; pure logic in `src/logic`) |
| Config file | package.json `"test": "vitest run"` (:52); `check:colors` (:50); `tsc --noEmit`; biome |
| Quick run command | `npx vitest run src/db/digest-read.test.ts src/logic/digest-logic.test.ts` |
| Full suite command | `npm test` (currently ~1305 tests green) then `npx tsc --noEmit && npm run check:colors && npx biome check <touched>` |

### Phase Requirements → Test Map
| Req | Behavior (critical correctness property) | Type | Command | File Exists? |
|-----|------------------------------------------|------|---------|-------------|
| DGST-02 | Retrospective counts ALL touchpoints in the window — a `connected=0` / `direction=null` row still counts; archived excluded | unit (node:sqlite) | `vitest run src/db/digest-read.test.ts -t retrospective` | ❌ Wave 0 |
| DGST-02 | Window boundary math: a row at local 23:59 on the 7th-prior day is in/out correctly; no UTC off-by-one (DST + late-evening) | unit | `vitest run src/db/digest-read.test.ts -t window` | ❌ Wave 0 |
| DGST-02 | Retrospective is per-person (dedup), most-recent-first; day-tag derives from `MAX(occurred_at)` | unit | `vitest run src/logic/digest-logic.test.ts -t "day tag"` | ❌ Wave 0 |
| DGST-02 | Overlooked = `STATUS_SQL='rogue'`; a **muted** rogue contact IS present (mute ignored); archived excluded | unit | `vitest run src/db/digest-read.test.ts -t overlooked` | ❌ Wave 0 |
| DGST-02 | Rogue read from `ROGUE_K`/`STATUS_SQL`, not recomputed; `rarely_responds` rogue → "Gone quiet", time rogue → "Drifting" | unit | `vitest run src/db/digest-read.test.ts -t "drifting vs gone"` | ❌ Wave 0 |
| DGST-02 | Backlog count == `countNeverContacted()` (parity) | unit | `vitest run src/db/digest-read.test.ts -t backlog` | ❌ Wave 0 |
| DGST-02 | Group cap ~6 + "+N more" overflow math | unit | `vitest run src/logic/digest-logic.test.ts -t cap` | ❌ Wave 0 |
| DGST-03 | "Skews hard" is conservative — one `hard` mark does NOT trigger; threshold both count- and fraction-gated | unit | `vitest run src/logic/digest-logic.test.ts -t effortful` | ❌ Wave 0 |
| DGST-01 | Idempotent WEEKLY re-registration — running the reconcile twice yields exactly one `digest:weekly`, no duplicates | unit (expo double) | `vitest run src/services/notifications/digest-schedule.test.ts -t idempotent` | ❌ Wave 0 |
| DGST-01 | Toggle OFF cancels `digest:weekly`; toggle ON (master on) schedules it; master OFF cancels it | unit | `vitest run src/services/notifications/digest-schedule.test.ts -t toggle` | ❌ Wave 0 |
| DGST-01 | Weekday/hour constant change → cancel + reschedule (drift diff) | unit | `vitest run ...digest-schedule.test.ts -t drift` | ❌ Wave 0 |
| DGST-01 | The decay/birthday reconcile still does NOT touch `digest:weekly` (regression guard, mirrors notification-schedule.test.ts:505) | unit | `vitest run src/services/notifications/notification-schedule.test.ts` | ✅ (extend) |
| DGST-01 | `resolveNotificationNav({kind:"digest"})` → navigate "Digest"; malformed → null | unit | `vitest run src/services/notifications/notification-nav.test.ts -t digest` | ✅ (extend) |
| DGST-01 | Empty week still opens → "all quiet" (all three reads empty → unified empty state) | unit + device-UAT | `vitest run src/logic/digest-logic.test.ts -t "all quiet"` | ❌ Wave 0 |
| DGST-01 | Weekly fire once/week + reboot re-register on the physical Pixel | manual (device spike) | on-device UAT (CLAUDE.md) | manual-only |

### Sampling Rate
- **Per task commit:** the quick run for the touched DAO/logic/schedule file + `tsc --noEmit`.
- **Per wave merge:** `npm test` (full) + `check:colors` + biome on touched files.
- **Phase gate:** full suite green before `/gsd-verify-work`; the device spike (weekly fire + reboot) is the one owner-gated manual checkpoint and is release-blocking for DGST-01.

### Wave 0 Gaps
- [ ] `src/db/digest-read.test.ts` — retrospective/overlooked/gentle-line queries (covers DGST-02/03) with a `node:sqlite` seed harness (reuse `src/db/__testkit__/node-sqlite.ts`).
- [ ] `src/logic/digest-logic.test.ts` — day-tag, cap/overflow, group split, "skews hard" threshold (DGST-02/03).
- [ ] `src/services/notifications/digest-schedule.test.ts` — idempotent WEEKLY register/cancel/drift against the expo double (DGST-01).
- [ ] Extend `notification-nav.test.ts` + `notification-schedule.test.ts` — digest routing + the `digest:weekly` non-clobber regression.
- [ ] Screen (`DigestScreen.tsx`) is device-UAT (`.tsx` render is not node-tested, per repo convention).

## Security Domain

> `security_enforcement: true`, ASVS L1. This is a **local-first, read-only, zero-network** surface — the threat surface is minimal but not empty.

### Applicable ASVS Categories
| ASVS | Applies | Standard Control (in this phase) |
|------|---------|-----------------|
| V2 Authentication | no | No auth surface (local-only app). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No multi-user; all data is the device owner's. |
| V5 Input Validation | yes | The digest toggle writes 0/1 through `updateAppSettings`, already guarded by `assertToggle` (app-settings-dao.ts:229-236) — add `digestEnabled` to `TOGGLE_FIELDS`. The notification `data` payload is re-narrowed by `isNotificationData`/`resolveNotificationNav` (untrusted OS input boundary) — extend the narrowing to accept `kind:"digest"` **without** trusting a `contactId`. |
| V6 Cryptography | no | No secrets, no crypto in this phase. |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| SQL injection via the three new reads | Tampering | All three queries are static strings interpolating ONLY code-constants (`PROGRESS_SQL`/`STATUS_SQL`/`ROGUE_K`); any runtime value `?`-bound. Matches status.ts/dashboard-read.ts injection posture — there is no user free-text in the digest reads. |
| Spoofed/malformed notification tap payload | Spoofing/Tampering | The gate treats OS-delivered `data` as untrusted and revalidates via `resolveNotificationNav`; a `digest` intent carries no contactId, so there is nothing to forge into a profile navigation. Cold-start replay is already cleared (`clearLastNotificationResponseAsync`, notification-gate.tsx:173). |
| Data egress | Information disclosure | **None** — the digest is a pure read surface with NO network on any path (local-first commitment, CLAUDE.md). Verify no read path introduces a fetch. |
| Lock-screen leakage of names | Information disclosure | Frozen generic copy ("A look back at who you reached.") names no one → safe on a PUBLIC lock screen; the `digest-v1` channel is PRIVATE regardless (mirrors birthday). |

## Project Constraints (from CLAUDE.md)
- **Local-first, no network on any read path** — the digest is a pure read surface; introducing any fetch is forbidden and would need owner sign-off.
- **All colours via theme tokens** (`check:colors` gate) — the digest reuses existing tokens only; no new status colour (UI-SPEC).
- **Migrations forward-only, never edit a shipped one, irreversible in production** — if Q1 resolves to migration 005, it is `ADD COLUMN … NOT NULL DEFAULT 1` (additive, safe like 004).
- **No worktrees, never push** — commit in place on `main`; the owner pushes.
- **Reads through DAOs, never inline in components; tunables at the top of the service file; `formatLocalDate` never `toISOString().split`.**
- **Reversing/weakening a recorded decision is the owner's call** — the "no new schema" vs "toggle persistence" conflict (Q1) is an escalation, not a silent migration.
- **Custom-fields invariants** — not touched by this phase (no custom-field read/write here); noted so a planner does not wander into them.

## Sources

### Primary (HIGH confidence — code on disk, this session)
- `src/services/notifications/notification-schedule.ts` — reconcile engine, `SchedulableTriggerInputTypes`, `isOwnedIdentifier` (:287-289), sweep-hook registration (:520-526), full-request diff (:308-336).
- `src/services/notifications/notification-schedule.test.ts:493-506` — the `digest:daily` non-clobber guard (proof a `digest:*` id coexists).
- `src/services/launch-sweep.ts` — hook registry + `registerSweepHook` (:45), digest re-register named as a future responsibility (:7).
- `src/db/status.ts` — `PROGRESS_SQL`/`STATUS_SQL`/`REASON_SQL`/`ROGUE_K` (:40-99), timezone rule (:44-59).
- `src/services/notifications/decay-suppression.ts:58-62` — `DECAY_ELIGIBLE_WHERE` (the inverse of what overlooked needs).
- `src/db/notification-read.ts` — the decay/birthday read layer (why NOT to reuse for overlooked).
- `src/db/dashboard-read.ts:306-333` — `countNeverContacted` / count helpers / timezone posture.
- `src/db/app-settings-dao.ts` — full `app_settings` column set (no digest column), `assertToggle`, persist/validation.
- `src/db/migrations/001-initial.ts:96-113` — `interactions` schema (`occurred_at`, `connected`, `direction`, `quality`). `004-ai-settings.ts` — the `ALTER TABLE ADD COLUMN` precedent.
- `src/db/ai-context-read.ts:122-140` — the `good/fine/hard` tally idiom.
- `src/navigation/notification-gate.tsx`, `notification-nav.ts`, `RootNavigator.tsx`, `navigation/types.ts` — tap routing + route registration.
- `src/screens/SettingsScreen.tsx:350-357,608-738` — persist path + notification toggle rows. `src/screens/HomeScreen.tsx:485-515,364-378` — top bar + footer-entry idioms.
- `src/services/notifications/channels.ts`, `notification-ids.ts` — channel immutability + id/body/`NotificationData` contract.
- `docs/dossier/14-digest.md` — all `[DECIDED]` product-shape items + the SDK-57 platform verification of the `WEEKLY` trigger.
- `.planning/phases/15-weekly-digest/15-CONTEXT.md`, `15-UI-SPEC.md`; `.planning/config.json`; `.planning/sync-milestone/PHASE-16-SYNC-READINESS.md:41` (migration-005 reservation).

### Secondary (MEDIUM)
- Dossier platform-verification of `SchedulableTriggerInputTypes.WEEKLY` / `weekday:1=Sunday` / reboot persistence (expo-notifications 57.0.9; installed 57.0.11) — CITED to the workpaper, to be re-confirmed by the device spike.

### Tertiary (LOW)
- None. (Context7/web providers are disabled in `.planning/config.json`; no unverified web claims were used.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every module verified on disk and installed.
- Architecture / queries: HIGH — grounded in the exact SQL constants and read posture already shipped; the overlooked-inverse and digest-id-coexistence findings are proven by code + an existing test.
- Delivery mechanism (WEEKLY trigger): MEDIUM-HIGH — dossier-verified at 57.0.9, but weekly-fire timing + reboot is device-spike-gated (pre-57 bug history).
- Persistence home: the mechanism is HIGH-clear; the DECISION is an owner escalation (Q1), not the researcher's to lock.

**Research date:** 2026-08-23
**Valid until:** ~2026-09-22 (stable — internal code + a pinned Expo SDK; re-check only if expo-notifications or the migration numbering changes).
