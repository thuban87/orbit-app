# Phase 11: Actionable Notifications - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey areas accepted per area by the owner

<domain>
## Phase Boundary

The decay + birthday reminder engine: pre-scheduled dated local notifications, reconciled on
every launch/foreground (cancel/replace keyed on a stable per-contact identifier), generic-body
(fuel lives on the compose screen, never in the notification text), quiet-windowed, with headless
one-tap mark-contacted + snooze actions and the per-contact "reminders off" mute — the body tap
opening the Phase 9 compose screen, Back → dashboard.

This phase OWNS the notification mechanism. Its architecture and platform constraints are almost
entirely `[DECIDED]` in `docs/dossier/11-notify.md` (16 questions, no `[OPEN]` items) and in the
ROADMAP cross-phase constraint log. Those decisions are inherited, not reopened here. Discuss only
resolved the dossier's *deferred-to-phase-discussion* items (copy, alert feel, cadence, snooze
lengths, timing, mute placement) plus the 7 orchestrator picks.

</domain>

<decisions>
## Implementation Decisions

### Copy & tone (accepted as recommended)
- **Decay notification body is generic** (no fuel — fuel is shown on the compose screen the tap
  opens): copy pattern `"{Name} — time to reach out."`.
- **Birthday notification body**: `"It's {Name}'s birthday today."` — plain text, no emoji. Tap → profile.
- **Birthday lead time**: day-of morning only. No earlier "coming up" notification (the existing
  7-day dashboard banner covers the lead-up).
- **Alert feel / channel importance**: DEFAULT importance — silent, no heads-up peek — for BOTH
  decay and birthday channels. Calm, consistent with the anti-nag mandate. (Channel importance is
  immutable at creation, so this is fixed before the build per the dossier.)

### Cadence & snooze (accepted as recommended)
- **Re-nag cadence**: flat weekly. A still-overdue, unacted contact re-reminds ~weekly, each
  re-nag REPLACING the prior shade entry (stable `decay:<contactId>` identifier). Not escalating.
- **Notification snooze (headless action)**: one fixed length, **+1 week**.
- **In-app snooze presets (profile)**: **3 days · 1 week · 1 month** (distinct from the
  notification's single fixed snooze).

### Timing & controls (accepted, with an owner reversal on tunability)
- **Morning delivery hour**: default **~9:00 am**.
- **Quiet window**: default **9:00 pm – 8:00 am**; a nudge that would land inside it rolls to the
  next morning. (Android has no quiet-hours/time-of-day trigger API — the app computes the next
  allowed fire instant itself on each reconcile.)
- **[OWNER DECISION — reverses a recorded `[REJECTED]` item] The morning delivery hour AND the
  quiet-window bounds are USER-TUNABLE in Settings in v1**, not merely top-of-file constants.
  - This reverses dossier `11-notify.md` Cluster A: **`[REJECTED] User-set delivery hour in v1`**
    (and extends the same treatment to the quiet-window bounds). The owner is the authority for
    reversing a recorded decision and did so explicitly during discuss.
  - The 9am / 9pm–8am figures become the DEFAULTS for these new settings controls.
  - Rationale it's low-risk: the reconcile already recomputes each fire instant from the app's own
    scheduling logic, so a user-set hour/window is just a new input to that same recompute — it does
    NOT touch the immutable-channel constraint. Cost: two settings controls + persisted state that
    backup must export (see `[notify → backup]`).
- **"Reminders off" mute placement & label**: on the **edit form**, beside "Rarely responds",
  labelled **"Mute reminders"**. (NOTE: `reminders_off` already exists as a contacts column and the
  edit form already maps it — see code context. Verify the toggle control is already present rather
  than rebuilding it; Phase 11's new work is wiring it into the decay-scheduling suppression predicate.)

### Orchestrator picks — accepted as a set (dossier "Decisions made without you", all 7)
1. Birthday fires day-of, morning window, tap → profile.
2. Birthday alerts get their own channel (separate from the two decay channels).
3. Namespaced stable identifiers: `decay:<contactId>` and `birthday:<contactId>` (a birthday and a
   decay reminder for the same person don't replace each other).
4. A phone-less contact STILL gets decay notifications; the compose screen degrades gracefully
   (fuel shown, SMS-send disabled + "add number" affordance — already built in Phase 9).
5. `autoDismiss = true` (tap clears it); no sticky/ongoing reminder.
6. Permission denied degrades to in-app-only (dashboard/orrery stay source of truth); no nagging
   to re-grant.
7. The generic body is trivially within the 1024-char cap — no truncation logic for decay/birthday.

### Claude's Discretion (delegated to plan-phase research/planner)
- Exact numeric values and storage of tunable constants NOT surfaced in Settings (re-nag cadence
  value, fixed snooze length, rogue multiple) — top of the service file per CLAUDE.md.
- Storage mechanism for notification settings (AsyncStorage/Zustand vs SQLite) — must be readable by
  the scheduling logic AND exportable by backup (Phase 16). The launch-sweep reconcile is the
  authority on the live schedule; settings only feed it.
- The `onNewIntent` routing + synthetic back-stack construction under Android 15 BAL limits.
- Channel identity/versioning scheme and how in-app per-type toggles map to channel state vs an
  app-level gate.
- The FCM-less headless-task init device spike (carried from 04-log).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/db/status.ts` — `ROGUE_K = 3` (and `WOBBLE_MAX`, `PROGRESS_SQL`). The SINGLE shared rogue
  constant; Phase 11's decay-suppression cutoff reads it (`progress >= ROGUE_K` ⇒ no decay nudge).
  Do NOT recompute rogue.
- `src/logic/birthday-logic.ts` — the single birthday parser (day-of-drop + Feb-29 bugs already
  fixed, both date formats). Birthday scheduling reuses it; no re-implementation.
- `src/db/recency-dao.ts` — the single-writer `last_contact` DAO behind the shared JS mutex. Headless
  mark-contacted MUST write through it (never a direct UPDATE).
- `src/db/events-dao.ts` — immutable insert-only events writer. Headless snooze writes a snooze
  event here, composed in a transaction; must be DOUBLE-WIRED (background task + foreground listener).
- `src/services/launch-sweep.ts` — the once-per-real-foreground-launch sweep + hook registry. The
  notification schedule reconcile registers as a sweep responsibility (never on module import or a
  headless tap).
- Phase 9 compose surface: `Compose: { contactId: number }` route + `ComposeScreen.tsx` (fuel
  visible, Send→SMS / Copy, phone-less graceful degrade, Back→dashboard). The notification body tap
  opens this; nothing new to build on the compose side.
- `src/screens/SettingsScreen.tsx` — hosts the new notification settings (master + per-type toggles
  + lock-screen visibility + the owner's new delivery-hour + quiet-window controls).

### Established Patterns
- Un-backfillable columns exist from migration 1: `reminders_off` and `snooze_until` are ALREADY on
  `contacts` (frozen day one). `edit-contact-logic.ts:148` maps `remindersOff: c.reminders_off`.
- `dashboard-read.ts:33` documents a "SNOOZE STORAGE CONTRACT (for Phase 11's future writer)":
  `snooze_until` compares against `date('now','localtime')`; the snoozed count + 'snoozed' filter
  segment are wired and legitimately empty until this phase writes `snooze_until`.
- No hardcoded colours (incl. any status colours on notifications-adjacent UI); `formatLocalDate()` /
  `date('now','localtime')` for all local-date math; single-writer recency via the shared mutex.
- Tunable constants sit at the top of their service file (single-number edits).

### Integration Points
- Launch/foreground reconcile → `launch-sweep.ts` hook registry.
- Decay-suppression predicate consumes: never-contacted, snoozed (`snooze_until`), rogue (`ROGUE_K`),
  "Rarely responds", and `reminders_off` — all already represented in the data layer.
- Birthday suppression is DIFFERENT: fires for all-except-archived, ignoring the decay suppressors
  (mirrors the 08-dashboard birthday banner).
- Purge already registers `onPurgeExtensions` (Phase 4/5) — a scheduled notification cancel for a
  purged contact registers there (Phase 4 note: "notification cancel runs POST-COMMIT via
  onPurgeExtensions — Phase 11 registers it").
- Settings state must be exportable (Phase 16 backup `[notify → backup]`).

</code_context>

<specifics>
## Specific Ideas
- Decay body copy string: `"{Name} — time to reach out."`
- Birthday body copy string: `"It's {Name}'s birthday today."` (plain, no emoji).
- In-app profile snooze presets: 3 days / 1 week / 1 month.
- Settings gains, beyond the DECIDED master/per-type/lock-screen controls: a **delivery-hour**
  control and a **quiet-window** control (owner reversal), defaulting to 9am and 9pm–8am.
- Mute toggle label: "Mute reminders", on the edit form beside "Rarely responds".

</specifics>

<deferred>
## Deferred Ideas
- Escalating decay→rogue re-nag intervals (owner chose flat weekly for v1; recorded as a
  possible-later, not built).
- Inline `RemoteInput` free-text fuel-capture in the freed 3rd action slot (dossier: available-for-
  later, declined on budget grounds — the share sheet + profile already own fuel capture).
- Per-contact avatar on the notification (needs a bare-workflow native module; declined in v1).
- Weekly digest as a notification (Phase 15 / domain 14 owns it; may reuse this domain's
  channels/scheduling — not built here).
- Widget headless-write path + its Back→dashboard model (Phase 12 inherits this domain's pattern).

</deferred>
