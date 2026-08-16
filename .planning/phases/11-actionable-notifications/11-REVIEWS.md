---
phase: 11
reviewers: [codex]
reviewed_at: 2026-08-16T19:45:35Z
reviewer_models:
  codex: codex-cli 0.144.1 (default model, --dangerously-bypass-hook-trust)
plans_reviewed:
  - 11-01-PLAN.md
  - 11-02-PLAN.md
  - 11-03-PLAN.md
  - 11-04-PLAN.md
  - 11-05-PLAN.md
  - 11-06-PLAN.md
  - 11-07-PLAN.md
  - 11-08-PLAN.md
  - 11-09-PLAN.md
  - 11-10-PLAN.md
  - 11-11-PLAN.md
  - 11-12-PLAN.md
  - 11-13-PLAN.md
---

# Cross-AI Plan Review — Phase 11 (Actionable Notifications)

Cross-AI reviewer: **Codex** (codex-cli 0.144.1). This session (Claude/Opus) ran the
source-grounding verification pass and the convergence assessment below. Per the project's
"review the code, not the diff" mandate, every load-bearing Codex claim was re-checked against
the actual source on disk before being accepted; the results are in the Verification Coverage
and Assessment sections.

---

## Codex Review

## Summary

**Overall risk: HIGH — do not execute unchanged.** The plans fit several existing project invariants well, but the proposed scheduler cannot actually pre-schedule future decay or birthday alerts, and the action path is not safe for replay/duplicate delivery.

## Strengths

- The migration approach is compatible with the forward-only runner: migrations are sorted, transaction-wrapped, and atomically advance `user_version` in [src/db/migrations/runner.ts:32](/home/bwales/projects/orbit-app/src/db/migrations/runner.ts:32). Plan 11-02 is correctly additive; `snooze_until`, `reminders_off`, and `modified_at` already exist on `contacts` in [001-initial.ts:61](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:61).

- Plans 11-03 and 11-07 respect the single-writer design. `recordTouchpoint` is mutexed and recomputes recency in one transaction ([recency-dao.ts:214](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:214)); `recordEventCore` is the intended non-mutexed composition primitive ([events-dao.ts:55](/home/bwales/projects/orbit-app/src/db/events-dao.ts:55)).

- Plan 11-04 correctly reuses the shared status and birthday primitives. `ROGUE_K`, `WOBBLE_MAX`, and local-date progress SQL already live in [status.ts:40](/home/bwales/projects/orbit-app/src/db/status.ts:40), while the dashboard’s snooze comparison is exactly the intended bare-date contract ([dashboard-read.ts:28](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:28)).

- Plans 11-08 and 11-09 align with existing extension points: purge cleanup is explicitly post-commit ([purge-dao.ts:158](/home/bwales/projects/orbit-app/src/db/purge-dao.ts:158)), and the edit toggle is already wired to `form.remindersOff` ([EditContactScreen.tsx:679](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:679)).

- The navigation design is sound in principle: `Compose` and `Profile` routes accept the proposed `{contactId}` parameters ([types.ts:20](/home/bwales/projects/orbit-app/src/navigation/types.ts:20)), and the existing `navigationRef`/ready-gate pattern is reusable ([linking.ts:34](/home/bwales/projects/orbit-app/src/navigation/linking.ts:34)).

## Concerns

### Cross-cutting scheduler — HIGH

**Plans 11-04 and 11-10 do not pre-schedule future notifications.** The decay read explicitly requires progress in `[WOBBLE_MAX, ROGUE_K)` ([11-04-PLAN.md:58](/home/bwales/projects/orbit-app/.planning/phases/11-actionable-notifications/11-04-PLAN.md:58)); stable and wobble contacts are excluded. Plan 11-10 then schedules only those returned candidates ([11-10-PLAN.md:60](/home/bwales/projects/orbit-app/.planning/phases/11-actionable-notifications/11-10-PLAN.md:60)). A contact that is stable when the app is last opened therefore has no notification pending for its future due date.

The same flaw affects snoozes: a future `snooze_until` excludes the contact entirely, so the action cancels its reminder and no post-snooze reminder exists unless the user opens Orbit again after expiry.

Birthday scheduling is also day-of-only: plan 11-04 filters with `daysUntilBirthday(...) === 0` ([11-04-PLAN.md:60](/home/bwales/projects/orbit-app/.planning/phases/11-actionable-notifications/11-04-PLAN.md:60)). This cannot deliver a birthday alert on a day when the app was not launched first.

**Suggestion:** split “eligible to receive at a future date” from “currently overdue.” Schedule:

- Decay for all contacted, live, non-muted, non-rarely-responding, non-rogue contacts, at `max(dueDate, snoozeUntil)` and then weekly ticks.
- The next birthday occurrence for every valid, non-archived birthday, not just today’s.
- Tests proving a stable contact, a future-snoozed contact, and a birthday next week receive a dated OS schedule.

### Plans 11-10 and 11-11 — HIGH

**Settings changes will not update existing scheduled notifications.** Plan 11-10 intentionally leaves an existing desired identifier untouched ([11-10-PLAN.md:65](/home/bwales/projects/orbit-app/.planning/phases/11-actionable-notifications/11-10-PLAN.md:65), [11-10-PLAN.md:93](/home/bwales/projects/orbit-app/.planning/phases/11-actionable-notifications/11-10-PLAN.md:93)). But delivery time, quiet hours, and lock-screen channel are all user-editable, and plan 11-11 promises immediate reconciliation.

Because identifier presence is the only comparison, changing 9 AM to 10 AM, enabling public lock-screen names, or altering quiet hours leaves the old trigger/channel in place.

**Suggestion:** diff the full desired request (date, channel, category, content/data) against the OS request. On mismatch, cancel and re-schedule using the same stable identifier. Add regression tests for every tunable setting changing an existing reminder.

### Plans 11-01, 11-06, and 11-07 — HIGH

**`decay-actions` is not a supported Expo category identifier.** The plans define `DECAY_CATEGORY="decay-actions"` ([11-01-PLAN.md:102](/home/bwales/projects/orbit-app/.planning/phases/11-actionable-notifications/11-01-PLAN.md:102)). Expo SDK 57 explicitly warns against `:` and `-` in category identifiers because categories may not work as expected. Use `decay_actions` before this unshipped identifier becomes permanent. [Expo Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)

**“DEFAULT importance” is not silent.** Plan 11-06 sets `AndroidImportance.DEFAULT` while calling it silent. Android defines DEFAULT as making noise; LOW is the non-audibly-intrusive tier. This contradicts the calm/silent requirement. [Android NotificationManager](https://developer.android.com/reference/android/app/NotificationManager)

**Suggestion:** retain DEFAULT only if required by product policy, but explicitly configure `sound: null` and vibration off, then validate physical-device behavior. Otherwise use LOW and revise the decision record.

### Plans 11-07, 11-12, and 11-13 — HIGH

**The headless task cannot obtain a database executor in a fresh process.** Plan 11-07 directs the task to use `getExecutor()` ([11-07-PLAN.md:58](/home/bwales/projects/orbit-app/.planning/phases/11-actionable-notifications/11-07-PLAN.md:58)), but that accessor throws until `openAndMigrate()` has completed ([database.ts:115](/home/bwales/projects/orbit-app/src/db/database.ts:115)). In a headless TaskManager launch, React never mounts, so App’s `useEffect` at [App.tsx:67](/home/bwales/projects/orbit-app/App.tsx:67) does not run.

**`expo-task-manager` is also absent.** [package.json:5](/home/bwales/projects/orbit-app/package.json:5) has neither `expo-notifications` nor `expo-task-manager`; plan 11-01 installs only the former. Expo requires `expo-task-manager` plus a module-scope `TaskManager.defineTask` before notification task registration. [Expo Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) and [Expo TaskManager SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/)

**Suggestion:** install and mock `expo-task-manager`; have the headless task `await openAndMigrate()` before calling `getExecutor()`. Keep that path limited to migration/open + action write—never the launch sweep.

### Plans 11-07 and 11-12 — HIGH

**Action writes are not idempotent and cold-start replay can duplicate them.** Plan 11-07 mints a new UID every handler invocation ([11-07-PLAN.md:57](/home/bwales/projects/orbit-app/.planning/phases/11-actionable-notifications/11-07-PLAN.md:57)). That defeats the existing unique UID protections on interactions ([001-initial.ts:96](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:96)) and events ([001-initial.ts:115](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:115)): duplicate handler calls create valid duplicate rows.

Plan 11-12 reprocesses `getLastNotificationResponseAsync()` but never clears or deduplicates it ([11-12-PLAN.md:77](/home/bwales/projects/orbit-app/.planning/phases/11-actionable-notifications/11-12-PLAN.md:77)). Expo provides `clearLastNotificationResponseAsync()` specifically to prevent already-handled response routing from recurring. [Expo Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)

This is the concrete warm/cold double-write risk: a background Task action, response listener, or later cold-start replay can each call the shared handler, and each currently produces a fresh interaction/event.

**Suggestion:** make action processing exactly-once:

- Include a per-scheduled-occurrence action token in notification data.
- Persist a unique receipt/token transactionally with the interaction or snooze event, so duplicate delivery is a no-op.
- Clear the last notification response after successful routing/handling.
- Serialize the response gate through one `handleResponseOnce` function and test Task + listener + cold-start replay of the same response.

### Plan 11-13 — MEDIUM

**Channel/category initialization races the first reconcile.** The plan fires `ensureChannels()` and `ensureNotificationCategories()` without awaiting them, then immediately calls `installSweepTrigger`, whose cold-start sweep starts immediately ([App.tsx:83](/home/bwales/projects/orbit-app/App.tsx:83), [launch-sweep.ts:102](/home/bwales/projects/orbit-app/src/services/launch-sweep.ts:102)). The first schedule can therefore run before its channel/category exists.

**Suggestion:** register the hook, then asynchronously await channel/category initialization, and only then install the sweep trigger. Also ensure channels before requesting permission at the Settings value moment.

### Plan 11-09 — MEDIUM

**The proposed snooze display call is type-incorrect and risks UTC parsing.** `formatLocalDate` accepts a `Date`, not a string ([dates.ts:17](/home/bwales/projects/orbit-app/src/utils/dates.ts:17)), but the plan proposes `formatLocalDate(snooze_until)` ([11-09-PLAN.md:90](/home/bwales/projects/orbit-app/.planning/phases/11-actionable-notifications/11-09-PLAN.md:90)).

**Suggestion:** display the stored zero-padded `YYYY-MM-DD` directly, or parse it into `new Date(year, monthIndex, day)` using local components—never `new Date("YYYY-MM-DD")`.

### Plan 11-12 — MEDIUM

The warm listener is installed before `isReady`, but it does not queue a response that arrives before navigation readiness. It can no-op against `navigationRef.current` and never retry. The existing Share gate avoids this by keying work to reactive readiness ([linking.ts:40](/home/bwales/projects/orbit-app/src/navigation/linking.ts:40)).

**Suggestion:** store a pending body-tap response until `isReady`, then route once; treat only Expo’s default action identifier as a body tap.

## Plan coverage notes

- **11-01:** Good shared-contract boundary, but add TaskManager and replace the category identifier.
- **11-02 / 11-03:** Structurally solid and compatible with existing migrations/mutex composition. Define whether `clearSnooze` always records `unsnooze`; “optional” makes the audit trail inconsistent.
- **11-04 / 11-05:** Good reuse of status/date primitives, but revise candidate semantics for actual pre-scheduling.
- **11-06:** Versioned channels are the right approach; correct the silence behavior.
- **11-07 / 11-12 / 11-13:** Need the headless bootstrap, initialization ordering, and exactly-once response design before implementation.
- **11-08:** Correctly targets the existing post-commit extension slot in [ArchivedContactsScreen.tsx:122](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:122).
- **11-09:** The UI placement and DAO routing are appropriate after fixing local-date rendering.
- **11-10 / 11-11:** Reconciliation needs full-request replacement, permission-state handling, and future-date scheduling.

The foundational DAO, migration, purge, and navigation choices are strong. The execution order should be amended around scheduling and action delivery first; those are currently the blockers to a safe Phase 11.

---

## Verification Coverage (source-grounding pass — Claude/Opus)

Every symbol the 13 PLAN.md files cite (functions, DAOs, columns, migrations, channel ids, file
paths) was enumerated and checked against the source on disk with ripgrep/Read. Symbols listed
under each plan's **"Artifacts this plan produces"** are EXCLUDED — they are NEW, created by this
phase, and their absence is expected (not drift). A cited-but-missing EXISTING symbol is a HIGH
finding.

**Result: 0 MISSING existing symbols. All cited existing symbols VERIFIED.** (The one apparent gap —
`edit-contact-logic.ts` — is a path imprecision, not a missing symbol: the file lives at
`src/screens/edit-contact-logic.ts`, not `src/logic/`, and the cited mapping is present.)

| Cited existing symbol | Plan(s) | Status | Evidence (file:line) |
|---|---|---|---|
| `WOBBLE_MAX` (=1.0), `ROGUE_K` (=3), `PROGRESS_SQL`, `STATUS_SQL` | 04, 10 | VERIFIED | src/db/status.ts:41,42,59,62 |
| `daysUntilBirthday`, `FEB_29_OBSERVED_DAY` | 04, 05 | VERIFIED | src/logic/birthday-logic.ts:136, :29 |
| `recordTouchpoint` + `RecordTouchpointInput` {contactId,uid,occurredAt,now,channel,direction,connected,quality,source}; `source` doc lists `notification` | 07 | VERIFIED | src/db/recency-dao.ts:215, :57-76 |
| single-writer mutex / `inWriteTransaction` non-reentrancy note | 03, 07 | VERIFIED | src/db/recency-dao.ts:149-155 |
| `recordEventCore` (non-mutexed core), `recordEvent`, `EventType` incl. `snooze`/`unsnooze` (RESERVED) | 03 | VERIFIED | src/db/events-dao.ts:62, :88, :38 |
| `registerSweepHook`, `installSweepTrigger`, `SweepHook` | 10, 13 | VERIFIED | src/services/launch-sweep.ts:45, :102, :27 |
| `registerFieldSweep` (lazy `getExec`, pushes one hook) | 10 | VERIFIED | src/services/field-sweep.ts:83-88 |
| SNOOZE STORAGE CONTRACT, `BASE_WHERE` snooze clause, `listBirthdayCandidates` | 03, 04 | VERIFIED | src/db/dashboard-read.ts:33, :142-144, :336 |
| contacts DDL: `reminders_off`, `snooze_until`, `interval_days`, `archived_at`; `interactions.uid`/events `uid` UNIQUE | 02, 03, 04, 09 | VERIFIED | src/db/migrations/001-initial.ts:79, :77, :67, :76, :99 |
| `runMigrations` (forward-only user_version) | 02 | VERIFIED | src/db/migrations/runner.ts:32, :60 |
| `TARGET_VERSION` (=1, pre-phase), migrations array `[migration001]`, `getExecutor`, `localDateTime` | 02, 07, 09, 13 | VERIFIED | src/db/database.ts:36, :106, :132, :45 |
| `Migration`, `MigrationDeps`, `SqlExecutor` types | 02 | VERIFIED | src/db/types.ts:46, :36, :17 |
| favourites-dao `inWriteTransaction` + `changes===1` + ?-bound UPDATE idiom | 02, 03 | VERIFIED | src/db/favourites-dao.ts:35-63 |
| `onPurgeExtensions` POST-COMMIT best-effort hook | 08 | VERIFIED | src/db/purge-dao.ts:67, :214 |
| `buildPhotoPurgeCleanup` (adapter-builder analog) | 08 | VERIFIED | src/services/photos/purge-photo-cleanup.ts:62 |
| `doPurge` + `onPurgeExtensions: buildPhotoPurgeCleanup(exec)` single slot | 08 | VERIFIED | src/screens/ArchivedContactsScreen.tsx:122, :134 |
| edit-form `reminders_off` Switch (testID `edit-contact-reminders-off`, `form.remindersOff`), "Rarely responds" neighbour | 09 | VERIFIED | src/screens/EditContactScreen.tsx:685, :687, :663 |
| `remindersOff: c.reminders_off` mapping | 09 (context cites `edit-contact-logic.ts:148`) | VERIFIED (path is src/screens/, not src/logic/) | src/screens/edit-contact-logic.ts:148 |
| `getContactHeader` (additive-widening idiom: favourite_rank, phone) | 09 | VERIFIED | src/db/contact-read.ts:65, :112 |
| ContactProfile `Header` type, unified `load()`, Message/Log-contact action block | 09 | VERIFIED | src/screens/ContactProfileScreen.tsx:101, :159, :586-614 |
| `FilterChipRow` (filled-accent chip idiom) | 09 | VERIFIED | src/components/FilterChipRow.tsx:40 |
| `formatLocalDate` (takes a `Date`) | 09 | VERIFIED | src/utils/dates.ts:17 |
| `newUid` | 07, 09 | VERIFIED | src/db/uid.ts:18 |
| `navigationRef`, `ShareIntentGate`, reactive `isReady` gate | 12, 13 | VERIFIED | src/navigation/linking.ts:34, :19, :40 |
| `Profile { contactId }`, `Compose { contactId }` routes | 12 | VERIFIED | src/navigation/types.ts:25, :66 |
| SettingsScreen `useFocusEffect` reload, `styles.row`, ScrollView | 11 | VERIFIED | src/screens/SettingsScreen.tsx:59, :92, :66 |
| App.tsx module guards `fieldSweepRegistered`/`photoReconcileRegistered`, ready-gated effect, `navReady`, ShareIntentGate mount | 13 | VERIFIED | App.tsx:48, :51, :62, :15 |
| app.config.ts `stringPlugins` Set (expo-sqlite, datetimepicker, expo-image) | 01 | VERIFIED | app.config.ts:63-68 |
| `@react-native-community/datetimepicker` dependency | 11 | VERIFIED | package.json (9.1.0) |

**UNCHECKABLE (OS-runtime / third-party API semantics, not resolvable from this repo):** expo's
warm-vs-headless notification-response delivery semantics; whether `Notifications.registerTaskAsync`
functions without `expo-task-manager`; whether Android `IMPORTANCE_DEFAULT` is audibly silent;
whether Expo rejects `-`/`:` in category identifiers. These are exactly the surfaces the plans
queue for Pixel-UAT — but three of them (below) are also HIGH design/dependency concerns the code
already contradicts and should not be deferred to on-device discovery.

---

## Assessment (convergence — Claude/Opus, code-verified)

Codex's HIGH findings were re-verified against source. **Five hold as HIGH** (all code-grounded),
including the pre-identified warm-tap double-write. Two of Codex's HIGH sub-claims are
factually confirmed in this repo (`getExecutor` throws pre-open; `expo-task-manager` absent). One
sub-claim (category-id hyphen) is downgraded to LOW (uncertain, and the plan uses hyphens in
channel ids that Codex did not flag).

### Confirmed HIGH concerns (unresolved in the plans)

- **H1 — Headless action write will throw: no DB bootstrap + missing dependency (11-07, 11-01,
  11-13).** `handleNotificationAction` obtains the executor via `getExecutor()`, which throws
  `"getDb() called before openAndMigrate() completed"` (src/db/database.ts:119-140) whenever the DB
  isn't open. `openAndMigrate` runs ONLY from App.tsx's mount effect — which never runs in a killed-app
  headless TaskManager launch. So the marquee "killed-app one-tap mark/snooze" write fails. Additionally
  `expo-task-manager` is absent from package.json and no plan installs it (11-01 installs only
  expo-notifications), yet the headless task calls `TaskManager.defineTask`/`registerTaskAsync`. **Fix:**
  11-07's headless task must `await openAndMigrate()` before `getExecutor()`; 11-01 must install +
  mock `expo-task-manager`.

- **H2 — Action writes are not idempotent; warm double-delivery AND cold-start replay duplicate
  them (11-07, 11-12).** [the pre-identified concern] `handleNotificationAction` mints a fresh
  `newUid()` per call (11-07). `interactions.uid` and events `uid` are `UNIQUE`
  (001-initial.ts:99,:118) — that constraint WOULD dedupe a re-delivered tap if the uid were
  deterministic, but a freshly-minted uid defeats it. Both the headless task (11-07) and the
  foreground `addNotificationResponseReceivedListener` (11-12) funnel to the same handler, and
  11-12 additionally re-reads `getLastNotificationResponseAsync()` on every cold start without ever
  calling `clearLastNotificationResponseAsync()` — so a single tap can write twice (warm overlap) or
  re-write on each relaunch (cold replay). The single-writer mutex serialises these writes; it does
  NOT dedupe them → duplicate interaction rows / duplicate snooze events in an immutable,
  un-repairable local DB. The plans only assert mutual exclusivity in a comment; there is no runtime
  guard or test. **Fix:** derive a deterministic per-occurrence idempotency uid (so a re-delivery
  collides on the UNIQUE key and no-ops), route both wirings through one `handleResponseOnce`, call
  `clearLastNotificationResponseAsync()` after handling, and test Task + listener + cold-start replay
  of the same response.

- **H3 — Settings changes do not update already-scheduled notifications (11-10, 11-11).** 11-10's
  reconcile diffs by identifier PRESENCE only and explicitly leaves an already-scheduled desired
  identifier untouched (11-10-PLAN.md:65). But delivery hour, quiet-window, and the private/public
  lock-screen channel are all user-editable (the owner's tunability reversal), and 11-11 promises an
  immediate reconcile. As written, changing 9am→10am, flipping quiet hours, or turning lock-screen
  public OFF again leaves the stale trigger/channel in place until it fires — including a **privacy
  regression** (a name stays glanceable on the lock screen after the user re-privatises). **Fix:**
  reconcile must diff the FULL desired request (fire date, channel, category, data) against the OS
  request and cancel+reschedule on mismatch under the same stable identifier; add a regression test
  per tunable.

- **H4 — DEFAULT channel importance is not silent (11-06) [contradicts a DECIDED item — owner
  ruling required].** 11-CONTEXT §"Alert feel" records `[DECIDED] AndroidImportance.DEFAULT —
  silent, no heads-up`. That equivalence is factually wrong at the Android layer: `IMPORTANCE_DEFAULT`
  makes a sound; `IMPORTANCE_LOW` is the silent tier. 11-06 faithfully implements DEFAULT with no
  `sound: null`, so channels will make noise — contradicting the calm/anti-nag mandate. Channel
  importance is **immutable at creation**, so shipping this wrong forces a channel-version bump for
  every user to fix. This corrects/reverses a recorded decision, so per project rules it is the
  **owner's** call to resolve — flagged, not endorsed. **Options:** keep DEFAULT but explicitly set
  `sound: null` + vibration off (and validate on-device), OR change to `LOW` and revise the decision
  record.

- **H5 — Decay/birthday are only scheduled once already due; future occurrences are not
  pre-scheduled (11-04, 11-10) [confirm product intent].** `listDecayDueCandidates` returns only
  contacts already in `[WOBBLE_MAX, ROGUE_K)` (11-04); the birthday read returns only
  `daysUntilBirthday()===0`. 11-10 schedules only those. So a contact that is stable/wobble (not yet
  due) — or a birthday next week — has NO OS-scheduled notification; and a future `snooze_until`
  excludes a contact so no post-expiry reminder is armed. The phase's premise is *pre-scheduled dated
  notifications that fire without the app open*; as designed, a decaying contact gets nothing until
  the user next launches Orbit (precisely when a disengaged user won't). This may be an accepted
  "reconcile-on-launch" limitation, so it needs an explicit product-intent confirmation — but as the
  plans stand it undercuts the stated architecture. **Fix (if intent is true pre-scheduling):**
  schedule the next occurrence for every eligible live/non-muted/non-rogue contact at
  `max(dueDate, snooze_until)` + weekly ticks, and the next birthday occurrence for every valid
  birthday; test a stable contact, a future-snoozed contact, and a next-week birthday each receiving
  a dated schedule.

### Actionable non-HIGH concerns (not yet incorporated in a PLAN.md)

- **A1 (11-13) — MEDIUM:** `ensureChannels()`/`ensureNotificationCategories()` are fire-and-forget,
  then `installSweepTrigger` fires the cold-start sweep immediately (App.tsx:83, launch-sweep.ts:102)
  — the first `scheduleNotificationAsync` can run before its channel/category exists. Await channel +
  category init before installing the sweep trigger (and ensure channels before the Settings
  permission value moment).
- **A2 (11-09) — MEDIUM:** The snooze-status line proposes `formatLocalDate(snooze_until)`, but
  `formatLocalDate` takes a `Date`, not a string (src/utils/dates.ts:17); coercing via
  `new Date("YYYY-MM-DD")` reintroduces the UTC evening off-by-one CLAUDE.md forbids. Render the
  stored `YYYY-MM-DD` directly, or parse with local components `new Date(y, mIdx, d)`.
- **A3 (11-12) — LOW/MEDIUM:** The warm response listener is not queued against nav readiness; a
  response arriving before `isReady` can no-op on `navigationRef.current` and never retry (the cold
  path IS isReady-gated). Queue a pending body-tap until ready; treat only Expo's default action
  identifier as a body tap.
- **A4 (11-01/11-06) — LOW:** Category id `decay-actions` (and channel ids) use `-`. Codex flags
  hyphens as risky in Expo category identifiers; uncertain (unverified against SDK 57, and the plan
  hyphenates channel ids too). Cheap to switch the category id to `decay_actions` before it ships as
  a permanent identifier — worth doing defensively.
- **A5 (11-03) — LOW:** `clearSnooze` records an `unsnooze` event only "optionally"; make it always
  record for a consistent audit trail (the events log is the only recovery mechanism).

### Strengths corroborated (code-verified)

The DAO/migration/purge/navigation foundations are sound: additive forward-only migration 002 fits
`runMigrations` exactly; snooze-dao/recency composition respects the single-writer mutex and the
`recordEventCore` non-mutexed primitive; 11-04 correctly reuses `status.ts` + `birthday-logic.ts`
rather than recomputing; 11-08 targets the real POST-COMMIT `onPurgeExtensions` slot; the nav design
reuses `navigationRef`/`ShareIntentGate` correctly. The blockers are concentrated in scheduling
coverage (H5), settings reconciliation (H3), and the action-delivery path (H1, H2) — plus the
immutable-channel importance decision (H4).

### Consensus

Single external reviewer (Codex) + this session's code-grounded verification. No divergence to
reconcile; every HIGH retained is independently confirmed against the source on disk. The plans are
**not safe to execute unchanged** — H1 and H2 break the headless action feature and risk duplicate
writes into an un-repairable local DB; H3 has a privacy dimension; H4 is an immutable, expensive-to-
reverse channel decision resting on a factual error; H5 needs a product-intent ruling.

---

## Claude Review (read-only subagent) — Cycle 1

> Second independent reviewer alongside Codex (the Claude CLI reviewer is skipped by the self-review
> guard + a write-permission gap, so this read-only subagent substitutes — owner-approved override).

CYCLE_SUMMARY (Claude): current_high=2 current_actionable=3

### HIGH
- **[11-07/11-13] Killed-app headless write throws and is silently swallowed.** `getExecutor()`→`getDb()`
  throws `"getDb() called before openAndMigrate() completed"` (database.ts:119-124); `openAndMigrate()`
  runs only in App.tsx's on-mount effect (App.tsx:14,28). A `registerTaskAsync` headless tap loads the
  JS bundle but does not mount React, so `cachedDb` is null → every killed-app mark/snooze throws →
  11-07's own try/catch swallows it, dropping the write silently. Defeats NOTIF-02's headless path.
  FIX: `await openAndMigrate()` (idempotent) before `getExecutor()` in the shared handler / headless
  task; assert the write in the A2 Pixel-UAT (read the row back via `run-as`).
- **[11-07/11-12] Warm-tap double-write unguarded & untested.** Both wirings funnel to
  `handleNotificationAction`, which mints a fresh `newUid()` per call; a warm tap delivered to both →
  two touchpoints / two immutable snooze events (silent, permanent). No idempotency guard; VALIDATION
  manual matrix only exercises the killed-app path. FIX: idempotency guard keyed on notification
  identifier + actionIdentifier (or foreground-skips-when-headless-owns) + a Pixel-UAT assertion of
  exactly-one-write-per-warm-tap.

### Actionable (MEDIUM/LOW)
- **[11-13]** `ensureChannels()` fire-and-forget races the reconcile that schedules to those channels;
  channel visibility is immutable → privacy landmine on a restore-into-fresh-install path. FIX: await
  channel/category init before registering/running the reconcile.
- **[11-10/11-11]** A delivery-hour/quiet-window change does not reschedule already-pending
  notifications (diff keys on identifier presence only, not fire instant). FIX: compare desired fire
  instant vs the existing scheduled trigger; cancel+reschedule on mismatch.
- **[11-12]** A foreground action tap for a stale/purged contactId becomes an unhandled promise
  rejection (`void handleNotificationAction(...)`, no `.catch`). FIX: wrap the foreground call in a
  Logger-guarded catch, mirroring the headless task.

(Claude found NO unauthorized reversal of a [DECIDED]/[REJECTED]/owner-LOCKED item.)

---

## Orchestrator Merged Actionable Set — Cycle 1 (Codex + Claude, deduped)

The `--reviews` replan MUST incorporate each item into the relevant PLAN.md
(task/`<action>`/`<acceptance_criteria>`/`<verify>`/`must_haves`/`<threat_model>`) **or** explicitly
defer/reject it with rationale in that PLAN.md. Verified against source this cycle:
`expo-task-manager` and `expo-notifications` are BOTH absent from package.json.

**HIGH**
1. **[11-01/11-07/11-13] Headless DB-not-open.** `await openAndMigrate()` in the headless task before
   `getExecutor()` (idempotent → safe on foreground too). Install + mock `expo-task-manager` in 11-01
   (currently absent — `registerTaskAsync` needs it). Assert the killed-app write SUCCEEDS in A2 Pixel-UAT.
2. **[11-07/11-12] Non-idempotent action writes** (warm double-delivery + cold-start
   `getLastNotificationResponseAsync` replay). Deterministic per-occurrence idempotency uid; ONE
   `handleResponseOnce`; `clearLastNotificationResponseAsync()` after handling. Add a Task+listener+
   cold-replay unit test AND a Pixel-UAT single-write-per-tap assertion.
3. **[11-10/11-11] Settings changes don't update scheduled notifications.** Diff the FULL desired
   request (fire instant, channel, category, data) and cancel+reschedule on mismatch under the same
   identifier — else delivery-hour/quiet-window/lock-screen-channel edits never apply (privacy
   regression on re-privatising).
4. **[11-06] "DEFAULT importance — silent, no heads-up" is inconsistent.** Android `IMPORTANCE_DEFAULT`
   plays a sound. Implement the owner's stated INTENT (silent, no heads-up, still visible in
   shade/lock-screen) via `IMPORTANCE_LOW` (or DEFAULT + `sound:null` + no vibration). Channel
   importance is immutable at creation — get it right + version the channel id. This HONORS the owner's
   decision (calm/silent); it is NOT a reversal. [Orchestrator note: surfacing to owner at the pause.]
5. **[11-04/11-10] Pre-schedule FUTURE occurrences** (the dossier's "pre-scheduled dated" architecture),
   not only already-overdue contacts. For every eligible (non-suppressed) contact, schedule the next
   occurrence at its computed next-due morning instant (≥ `max(dueDate, snooze_until)`) plus the weekly
   re-nag ticks, so a contact crossing overdue while the app is closed still fires; reconcile on launch.
   Birthdays: schedule the next day-of morning. This realises NOTIF-01's "fires without the app open."

**Actionable (MEDIUM/LOW)**
6. **[11-13]** `await` `ensureChannels()` / `ensureNotificationCategories()` before installing the sweep trigger.
7. **[11-09] UTC off-by-one.** `formatLocalDate(snooze_until)` passes a string to a `Date`-typed fn
   (dates.ts:17) → reintroduces the forbidden UTC off-by-one. Render the stored `YYYY-MM-DD` directly or
   parse with local components. (CLAUDE.md's already-fixed bug — must not reintroduce.)
8. **[11-12]** Wrap the foreground `handleNotificationAction` in a Logger-guarded catch (stale/purged
   contactId) AND queue the body-tap until navigation `isReady` (a pre-`isReady` response no-ops);
   treat only Expo's default action id as a body tap.
9. **[11-01/11-06]** Rename category id `decay-actions` → `decay_actions` (permanent identifier, defensive).
10. **[11-03]** `clearSnooze` ALWAYS records an `unsnooze` event (not "optionally") — the events log is
    the only recovery mechanism.

---

# Orchestrator Merged Actionable Set — Cycle 2

Cross-AI reviewer: **Codex** (codex-cli 0.144.1, default model). Re-reviewed the CURRENT (revised,
commit bb99d4e) 13 PLAN.md files against the source on disk. This session (Claude/Opus) ran the
source-grounding verification and the convergence assessment. Every load-bearing Codex claim was
re-checked against the actual code before being accepted.

CYCLE_SUMMARY: current_high=1 current_actionable=4

## Cycle-1 HIGH disposition (all five RESOLVED, code-verified)

- **H1 — RESOLVED.** `openAndMigrate()` is idempotent (`if (cachedDb) return cachedDb`,
  src/db/database.ts:95) and `getExecutor()`→`getDb()` throws before open (database.ts:119); 11-07's
  handler now `await openAndMigrate()` BEFORE `getExecutor()` — safe (no-op) on the foreground path,
  and it opens+migrates in a fresh headless process. 11-01 installs + mocks `expo-task-manager`
  (was absent from package.json). Killed-app write is logically sound; on-device headless delivery
  stays an A2 Pixel-UAT gate.
- **H2 — RESOLVED.** `actionUid(action,data)` is a PURE function
  `notif:{action}:{kind}:{contactId}:{occurrenceKey}` (11-01), and `occurrenceKey` is minted at
  schedule time (11-10) and carried IN the notification data payload — so it is stable across a
  process restart. Both `interactions.uid` and events `uid` are `UNIQUE` (001-initial.ts:44,:99,:118);
  the DAO inserts inside its transaction, so a re-delivered/cold-replayed tap collides on the UNIQUE
  key and rolls back cleanly. The in-process `handledSet` is only the warm fast-path guard; the
  durable dedup is the deterministic uid + UNIQUE rollback. `clearLastNotificationResponseAsync()`
  is called after handling the cold-start response.
- **H3 — RESOLVED.** 11-10 `reconcileSchedule` now does a FULL-REQUEST diff (`requestsEqual`
  compares fire instant + channelId + categoryIdentifier + data) and cancels+reschedules under the
  same stable identifier on ANY mismatch; 11-11 calls reconcile on every settings change. A
  delivery-hour / quiet-window / lock-screen-channel edit now re-arms pending notifications
  (re-privatise regression closed).
- **H4 — RESOLVED (owner-ratification still pending).** All three channels are created at
  `AndroidImportance.LOW` (11-06) — the genuinely silent, no-heads-up tier that is still visible in
  the shade/lock screen; lock-screen visibility is expressed by PRIVATE/PUBLIC channel choice, never
  a mutation. NOTE: 11-CONTEXT §"Alert feel" still records the DECIDED value as
  `AndroidImportance.DEFAULT`; the plan hard-codes LOW to honour the stated INTENT (silent). This was
  surfaced to the owner in cycle 1 and remains an owner sign-off item (the DECIDED text literally
  says DEFAULT). Not a new finding.
- **H5 — RESOLVED.** `listDecayEligibleCandidates` (11-04) drops the `>= WOBBLE_MAX` lower bound and
  surfaces stable/wobble contacts plus `snooze_until`; `listBirthdayNotificationCandidates` returns
  every non-archived contact with a birthday. 11-10 pre-schedules the future occurrence at
  `max(dueDate, snooze_until)` + weekly ticks and the next day-of birthday. Reuses status.ts
  (WOBBLE_MAX=1.0, ROGUE_K=3) and birthday-logic (this-year-or-next occurrence) — verified.

## Current HIGH Concerns

- **[11-07 / 11-09 / and the edit-save path] State changes made OUTSIDE a foreground reconcile do
  not update the OS schedule, so a pre-scheduled notification can fire during a snooze / after a mute
  — violating NOTIF-03.** The reconcile is launch/foreground-sweep-only (the DECIDED NOTIF-01
  cadence). But: (a) the in-app profile snooze (11-09 Task 3) writes `snooze_until` and only re-runs
  the profile `load()` — it neither cancels the already-scheduled `decay:<id>` alarm nor arms the
  post-snooze one; (b) the edit-save path relabels the mute toggle (11-09 Task 1) but nothing cancels
  the pending notification when a contact is muted or its interval changes; (c) the headless snooze
  (11-07) cancels the current notification but does not pre-arm the +1-week occurrence. Because H5 now
  keeps a future-dated notification sitting in the OS queue for every eligible contact, an in-app
  snooze/mute of a contact whose notification is imminent (e.g. tomorrow morning) is defeated if the
  user does not foreground the app again before it fires. This is a NOTIF-03 correctness gap, not a
  reversal of the reconcile-on-foreground decision — the fix is ADDITIVE and compatible with it.
  **Fix:** call `reconcileSchedule(getExecutor())` (or a targeted per-contact cancel+reschedule) after
  the in-app snooze/clear write (11-09), after the edit-save mute/interval write, and after the
  headless mark/snooze (11-07) so the OS schedule reflects the change immediately; add a
  "snooze-before-scheduled-fire suppresses the notification" test. Confirm with the owner whether the
  headless-snooze post-arm may remain launch-deferred (within the DECIDED cadence).

## Current Actionable Non-HIGH Concerns

- **[11-13 / 11-01] MEDIUM — No foreground-presentation handler is planned.** No
  `Notifications.setNotificationHandler` anywhere in the plans or src; App init (11-13) only creates
  channels/category and installs the sweep. Expo's default suppresses a notification that fires while
  the app is foregrounded. Impact is narrow (a morning nudge landing while the app is open is an edge
  case, and suppressing an in-app nudge may even be desirable), and tap/action routing is unaffected
  (it uses the response listener + `getLastNotificationResponseAsync`, independent of the handler).
  **Change:** make an explicit decision in 11-13; if presentation is wanted, add a module-scope
  `setNotificationHandler` that preserves silence (`shouldPlaySound:false`, no banner, list/shade
  only) and add its stub to the 11-01 mock.
- **[11-10] MEDIUM — Malformed birthday is not guarded before scheduling.**
  `listBirthdayNotificationCandidates` returns every row with `birthday IS NOT NULL` (11-04:69) with
  no parseability check; 11-10's behavior computes `nextBday = today + daysUntilBirthday(birthday,
  today)`, but `daysUntilBirthday` returns `null` for malformed/calendar-invalid input
  (birthday-logic.ts:140) — `today + null` yields an Invalid Date, not a throw, so the per-candidate
  try/catch does not necessarily catch it. **Change:** in 11-10, skip the candidate when
  `daysUntilBirthday(...)` is `null`; add a malformed-birthday-row test.
- **[11-10] LOW — `requestsEqual` omits the content body.** The full-request diff compares fire
  instant + channel + category + data, but not `content.body`; `decayBody(name)`/`birthdayBody(name)`
  freeze the contact name at schedule time, so a renamed contact keeps stale (generic, name-only)
  text until its fire-instant/occurrenceKey changes. **Change:** include `content.body` (and title) in
  `requestsEqual`, or document the accepted staleness.
- **[11-05 / 11-10] LOW (confirm intent) — Overdue-while-closed contacts may wait up to ~6 days for
  the first nudge.** `nextNudgeDate` anchors the weekly cadence to the due date and returns the next
  today-or-future tick (11-05:61), so a contact that crossed overdue while the app was closed can have
  its first post-reopen notification scheduled up to a week out rather than the next morning. Confirm
  this matches the intended calm cadence; if an overdue contact should get a next-morning nudge on
  reopen, add a "schedule today if already overdue" branch.

Minor/cosmetic (no change to behavior): 11-06 Task-1 `<name>` still reads "DEFAULT-importance channel
set" — a stale leftover; the task body correctly specifies `AndroidImportance.LOW`.

## Assessment (convergence — Claude/Opus, code-verified)

The revision cleanly resolves all five cycle-1 HIGHs, and each fix is grounded in the real code
(openAndMigrate idempotency, UNIQUE(uid) rollback with a payload-carried deterministic occurrenceKey,
the full-request diff, LOW importance, the lower-bound/​snooze-surfacing read change). No cycle-1 HIGH
remains open. The one remaining HIGH is a still-open (not newly-introduced) coherence gap that H5
made more consequential: user/headless state changes do not push to the OS schedule until the next
foreground reconcile, so an in-app snooze/mute can be defeated by an already-pre-scheduled
notification — a NOTIF-03 violation whose fix is additive and does not touch the DECIDED
reconcile-on-foreground cadence. The four actionable items (foreground handler, malformed-birthday
guard, body in the diff, overdue-cadence intent) are incremental. No unauthorized reversal of a
[DECIDED]/[REJECTED]/owner-LOCKED item was found; the H4 LOW-vs-DECIDED-DEFAULT choice remains the
already-surfaced owner sign-off item.

### Consensus
Single external reviewer (Codex) + this session's code-grounded verification. Codex rated two NEW
concerns HIGH; on source-grounding, one (state-change reconcile / NOTIF-03) is retained as HIGH and
the other (foreground handler) is downgraded to MEDIUM (narrow impact, tap routing unaffected). H1–H5
independently confirmed RESOLVED against the source.

---

## Claude Review (read-only subagent) — Cycle 2

CYCLE_SUMMARY (Claude): current_high=1 current_actionable=2

All five cycle-1 HIGH (H1–H5) verified RESOLVED against code. NEW issues introduced by the H5 fix:

### HIGH
- **[11-04/11-10] Unbounded pre-scheduled set — no horizon/cap → silent drops.** `DECAY_ELIGIBLE_WHERE`
  has no lower progress bound (returns ~the whole address book incl. all `stable`); 11-10 schedules a
  DATE trigger per candidate + birthday with no bound/prioritization/horizon. Android/expo SILENTLY
  DROPS scheduled notifications past its pending cap — a silent-failure class CLAUDE.md elevates, in an
  un-repairable local DB. FIX: bound the horizon (pre-schedule only contacts whose fire instant is
  within N days, or the soonest-N; the launch reconcile rolls it forward); Pixel-UAT at realistic
  volume proving no drops. N is a top-of-file tunable.

### Actionable (MEDIUM/LOW)
- **[11-10] MEDIUM — index-based stagger churns the diff + missing ORDER BY + unspecified
  `requestsEqual` granularity.** Stagger keyed on array index with NO `ORDER BY` → fire-minute shifts on
  any earlier-contact change → reschedule churn + brittle test; exact-instant compare churns, date-only
  misses an hour edit. FIX: deterministic `ORDER BY id`; stagger by contactId; specify granularity.
- **[11-06] LOW — stale task title** "DEFAULT-importance channel set" while behavior is `IMPORTANCE_LOW`.

---

## Orchestrator Merged Actionable Set — Cycle 2 (Codex + Claude, deduped)

Cycle-1 H1–H5 are RESOLVED (both reviewers, code-grounded). NEW items — all consequences of the H5
pre-scheduling fix — MUST be incorporated into the relevant PLAN.md or explicitly deferred/rejected:

**HIGH**
A. **[11-04/11-10] Bound the pre-scheduled horizon** (Claude). Do NOT pre-schedule a DATE trigger for
   every eligible contact — Android's pending cap causes silent drops. Pre-schedule only
   contacts/birthdays whose next fire instant is within a bounded horizon (top-of-file tunable
   HORIZON_DAYS) or the soonest-N; the launch/foreground reconcile rolls it forward. Pixel-UAT asserting
   no drops at realistic volume (e.g. 200+ contacts).
B. **[11-07/11-09/edit-save] In-app state changes must cancel/reschedule the pre-parked notification
   IMMEDIATELY** (Codex) — else an in-app snooze/mute/interval-edit is DEFEATED by an already-scheduled
   future notification that fires anyway (NOTIF-03 violation). Additive to the foreground-reconcile
   cadence, NOT a reversal: call `reconcileSchedule(getExecutor())` (or targeted per-contact
   cancel+reschedule) AFTER the in-app snooze/clear write (11-09), AFTER the edit-save mute/interval
   write, and AFTER the headless mark/snooze (11-07). Add a "snooze/mute-before-scheduled-fire suppresses
   it" test. (Realises NOTIF-01's "cancelled on mark/snooze/mute/interval-edit".)

**Actionable (MEDIUM/LOW)**
C. [11-10] Deterministic `ORDER BY id` + stagger by contactId (not array index) + specify `requestsEqual`
   fire-instant granularity (catch an hour change, invariant to stagger). (Claude)
D. [11-13/11-01] Decide foreground presentation: add a module-scope `Notifications.setNotificationHandler`
   preserving silence (`shouldPlaySound:false`, no banner) OR document deliberate foreground suppression;
   add the handler stub to the 11-01 mock. (Codex)
E. [11-10] Guard malformed birthdays: `today + daysUntilBirthday(null)` yields an Invalid Date (not a
   throw) — SKIP the candidate when `daysUntilBirthday()` returns null; add a malformed-row test. (Codex)
F. [11-10] `requestsEqual` omits `content.body`/title → a renamed contact keeps stale text. Include
   body+title in the diff, or document accepted staleness. (Codex)
G. [11-05/11-10] Ensure a contact that crossed overdue while the app was CLOSED gets its first nudge at
   its due-date morning (the pre-scheduled fire), not a weekly tick up to ~6 days later — schedule the
   first occurrence at the due-date morning (≥ today's window if already past), then weekly ticks. (Codex)
H. [11-06] Retitle 11-06 Task-1 → "LOW-importance channel set" (both).

Also (orchestrator, this cycle): 11-CONTEXT.md §"Timing & controls" alert-feel wording reconciled
DEFAULT→`IMPORTANCE_LOW` to match the silent intent (honors the owner's choice; flagged for the pause).
