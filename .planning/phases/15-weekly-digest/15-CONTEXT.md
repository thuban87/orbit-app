# Phase 15: Weekly Digest - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey areas proposed in tables, owner accepted per area

<domain>
## Phase Boundary

The optional weekly retrospective: **one native WEEKLY (Sunday morning) local notification** that
opens a **live-computed "your week" screen**. The screen is the payload — a retrospective the
always-current dashboard cannot give (who you *reached* this week) plus a calm, non-nagging home for
the populations 11-notify deliberately won't push about (rogue / "Rarely responds" gone-quiet /
never-contacted backlog), and a gentle line when recent quality marks skew "hard".

**Adds NO new schema and no new persistent state** (like the widget). Pure read surface:
- retrospective reads `interactions` in a trailing 7-day window;
- the overlooked section reads derived `status`/`rogue` (via the single shared rogue constant, read
  never recomputed), the `rarely_responds` flag, and `last_contact IS NULL`;
- the gentle line reads the existing `interactions.quality` marker.

All product-shape decisions are already `[DECIDED]` in `docs/dossier/14-digest.md`; this phase owns the
**design/copy/taste** pass (below) and the **queries/thresholds/channel/constants** (planning). See the
dossier's "decided without you" list — all 6 picks accepted by the owner (2026-08-23), with ONE
clarification captured under Deferred (markdown export → Phase 16).

</domain>

<decisions>
## Implementation Decisions

### Retrospective — "Reached this week" (Grey Area 1 — accepted)
- **Presentation is a LIST of people, never a headline scoreboard count** (resolves the dossier's ⚠
  streak-caution — a bare number edges toward the rejected-streaks scoreboard). A gentle lead phrase
  may introduce it (e.g. "You caught up with these people this week"); no bold "N" figure.
- Each row: avatar + name + the day reached (e.g. "Tue"); tap → profile.
- Ordering: most recent first (reverse-chronological within the 7-day window).
- Empty retrospective: a calm, no-guilt line ("No catch-ups logged this week"); when the overlooked
  section is also empty this folds into the single "all quiet this week" state.
- Query semantics (DECIDED, dossier B): counts EVERY logged touchpoint in the trailing 7 days —
  outbound or inbound, connected or not, one-tap or full-log; **no `connected`/`direction` predicate**;
  archived contacts excluded.

### The overlooked (Grey Area 2 — accepted)
- Gently **sub-labelled groups**: "Drifting" (rogue) · "Gone quiet" (Rarely-responds that have
  slipped) · a never-reached backlog nudge. Calm labels, not alarms.
- Never-contacted backlog = ONE gentle line with a count ("3 people you added but never reached") →
  taps through to the Never-Contacted screen; NOT re-listed inline.
- Ordering: most-slipped first (rogue → gone-quiet); the backlog nudge comes last.
- Cap ~6 people per group, then a "+N more →" tap-through (keeps the section calm, not overwhelming).
- Semantics (DECIDED, dossier B): the overlooked section is IN-APP screen content, **not suppressed by
  the per-contact reminders-off mute** (mute governs decay *pushes* only) — a muted contact that goes
  rogue still appears here. Rogue = the single shared rogue constant (09-orrery), read never recomputed.
  Archived excluded.

### The gentle "effortful" line — quality marker (Grey Area 3 — accepted)
- Copy: **"A few recent conversations have felt effortful."** — coarse, kind, never a rating/verdict.
- **Names the people**: small, tappable names under the line (→ profile), since pointing at them is the
  marker's stated purpose (04-log).
- Placement: a quiet aside **below** the retrospective, above the overlooked section (not a headline).
- Trigger posture: **rare & real — conservative, err toward NOT showing.** The exact "skews hard"
  threshold over recent `quality` marks is a planning decision (a tunable constant); the design steer is
  "only when clearly real, never routine."

### Delivery, copy & entry point (Grey Area 4 — accepted)
- Static notification copy (frozen at schedule time): **title "Your week in Orbit" · body "A look back
  at who you reached."** Every number is computed live on the screen it opens.
- **In-app entry point in ADDITION to the Sunday push**: a discreet dashboard header action ("Your
  week") → digest screen. (Not push-only — accepts dossier "without you" #3.)
- Delivery (DECIDED, dossier D): ONE native `SchedulableTriggerInputTypes.WEEKLY` trigger,
  `weekday:1` = Sunday, morning window reusing 11-notify's morning-hour + quiet-window constants;
  AlarmManager-backed, survives reboot, no custom boot receiver. Fires **unconditionally** every week;
  a genuinely empty week opens to the calm "all quiet this week" state (no suppression).
- **Third notification type** (decay + birthday + **digest**), independently toggleable in the Settings
  Notifications section, **defaults ON** once notifications are granted; rides 11-notify's single
  value-moment `POST_NOTIFICATIONS` prompt (no new permission ask).
- **All 6 dossier "decided without you" picks ACCEPTED** (owner, 2026-08-23): (1) plugin "snoozed"
  bucket dropped; (2) plugin markdown-file mechanics gone [see Deferred — this is NOT the user export];
  (3) digest screen reachable in-app, not push-only; (4) rogue/overlooked + retrospective names + gentle
  line all tap → profile; (5) reuse the single birthday-parser fixes + rogue constant, no new date/threshold
  math; (6) no digest badge/count on icon or nav.

### Persistence & schema — OWNER RULING (2026-08-23, escalated by research)
- **The digest ON/OFF toggle persists as `app_settings.digest_enabled` via NEW migration 005** — an
  `ALTER TABLE app_settings ADD COLUMN digest_enabled` mirroring the existing `decay_enabled` /
  `birthday_enabled` columns (app-settings-dao.ts:117-119), **defaults ON** (1). This is the durable,
  backup-exportable home consistent with its sibling notification toggles.
- **Dossier reconciliation:** the two `[DECIDED]` lines ("digest adds NO new schema" vs "independently
  toggleable / defaults on / exported") were in tension. Owner ruled: "no new schema" reads as **no new
  TABLES and no new per-contact state** (still true — the digest is a pure read surface, stores nothing
  per contact). The single global settings column is the toggle's proper home and is NOT a reversal of the
  read-surface promise. Do NOT "bug-fix" the migration away as a schema violation — it is an owner decision.
- **Migration numbering:** Phase 15 owns **005** (`digest_enabled`); Phase 16 now owns normalized
  custom-field migration **006**, and Phase 17 owns tombstones in **007**. Migrations remain
  forward-only and ordered by ship sequence; see `PHASE-17-SYNC-READINESS.md`.
- Migration 005 is forward-only + irreversible (CLAUDE.md data rules): register it in `database.ts`, add a
  `004-ai-settings`-style migration file + node:sqlite test, and thread `digest_enabled` through the
  app-settings DAO + its type. Backup (Phase 17) exports it as a settings row (dossier [digest → backup]).

### Claude's Discretion (deferred to planning per dossier, not owner-facing taste)
- The three queries: retrospective (7-day `interactions`, no connected/direction predicate, archived
  excluded); overlooked (rogue via shared constant + Rarely-responds gone-quiet + `last_contact IS NULL`,
  mute ignored, archived excluded); the "skews hard" threshold over recent `quality` marks.
- **Channel identity**: digest's own notification channel vs an app-level gate (respect 11-notify's
  channel-immutability trap — recreate under a new versioned id to change behaviour).
- Idempotent re-registration of the single WEEKLY trigger on launch (via the launch sweep's digest
  re-register hook); cancel/re-register when the digest toggle flips or the weekday/hour constant changes.
- Tap routing (`data` payload → cold `getLastNotificationResponseAsync` / warm response listener →
  digest screen; Back → dashboard, reusing the `singleTask`/`onNewIntent` back-stack).
- Tunable constants at the top of the digest service file: delivery weekday (Sunday), morning hour,
  quiet-window bounds (shared with 11-notify), and the "skews hard" threshold.
- Export of the digest on/off toggle is a Phase-16 concern (settings row); the schedule is derived
  (re-registered), never exported.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **11-notify engine** — `src/services/notifications/notification-schedule.ts` (scheduling, reconcile),
  channels, quiet-window logic, generic-body pattern, `POST_NOTIFICATIONS` value-moment. The digest is a
  new WEEKLY trigger type riding this engine (no per-contact reconcile loop needed).
- **Launch sweep** — `src/services/launch-sweep.ts` + hook registry (the digest re-register is a new
  sweep responsibility, per the ROADMAP cross-phase "one launch sweep" constraint).
- **Rogue constant** — the single shared rogue constant (used by orrery `orrery-geometry-logic.ts`,
  `decay-suppression.ts`, dashboard/notification reads). The digest READS it, never recomputes.
- **Status / reads** — `src/db/status.ts` (PROGRESS_SQL/STATUS_SQL), `src/db/dashboard-read.ts`,
  `src/db/notification-read.ts` (decay-suppression predicate, rarely-responds). `formatLocalDate()` /
  `date('now','localtime')` for the 7-day window (never `toISOString().split`).
- **Single birthday parser fixes** — reused (no new date math); birthdays are NOT this domain's.
- **Settings Notifications section** — `src/screens/SettingsScreen.tsx` (master + decay/birthday/
  lock-screen toggles + delivery hour + quiet window) — the digest toggle is a 4th per-type row here.
- **Dashboard header** — `src/screens/HomeScreen.tsx` (existing ◎ Orbit button + settings gear entry)
  — the "Your week" in-app entry point lands alongside these.
- **ContactCard / Avatar / RankedFuelLine** — reusable presentational primitives for digest rows.

### Established Patterns
- Reads go through DAOs in `src/db/`, node-tested with `node:sqlite`; pure logic extracted to
  `src/logic/*-logic.ts` (react-native-free) for unit testing; `.tsx` screens are device-UAT.
- Tunable constants at the top of the service file (single-number edits).
- All colours via theme tokens (`check:colors` gate); no network on any read path; offline-first.
- Notification content is FROZEN at schedule time → static generic copy + compute-on-open.

### Integration Points
- New WEEKLY trigger registered via the notification engine; re-registered idempotently by the launch
  sweep; toggle flip → cancel/re-register.
- New digest screen + route (additive to the navigator); dashboard header action + tap-routing entry.
- New Settings row (4th notification type) writing an `app_settings` toggle (existing settings DAO;
  no new schema).

</code_context>

<specifics>
## Specific Ideas

- Streak-safe retrospective: names, not a scoreboard number (owner explicitly ruled on the ⚠ flag).
- "Your week in Orbit" / "A look back at who you reached." as the frozen notification copy.
- Dashboard "Your week" header action as the in-app entry point (discreet).
- Device spike (planning/UAT): confirm the `WEEKLY` trigger fires exactly once/week on the physical
  Pixel and re-registers across reboot (pre-57 repeat bugs #34782/#30577; emulator won't do — CLAUDE.md).

</specifics>

<deferred>
## Deferred Ideas

- **[→ Phase 16] Markdown as an export FORMAT option (owner-originated, 2026-08-23).** During discuss the
  owner asked whether the digest's dropped "markdown mechanics" removed a user export. It does not — that
  pick only drops the *old Obsidian plugin's vault-file digest mechanism*. Data export is Phase 16
  (Backup, Export & Restore), currently `[DECIDED]` as a single plaintext **JSON** file (ROADMAP SC-1).
  The owner would like **markdown considered as an export-format option**. This is a **Phase 16 scope
  decision** (it would revise/extend Phase 16's JSON-only export format — an owner call) and is
  explicitly OUT of Phase 15. Captured here + as a project memory so it surfaces at Phase 16 planning.
  Phase 15 stays a pure read-only screen (GA4 accept-all upheld).
- Birthday sections: NONE in the digest — birthdays are wholly owned by 08-dashboard (banner) and
  11-notify (morning notification). Recorded so a later reader does not re-add a birthday section here.

</deferred>
