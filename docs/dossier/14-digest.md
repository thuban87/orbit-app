# Dossier 14 — `digest` — Weekly digest & birthday alerts

**Status:** complete · Interrogated 2026-08-14 · 7 questions over 3 rounds · No `[OPEN]` items
remain (the screen layout/copy and the streak-caution count-vs-list framing are the owner's
§12.4 design pass, not open; several tunable constants and one device spike are deferred to
phase planning).

## Scope

HANDOFF open-question #7 was "keep the Weekly Digest and Birthday alerts in v1?" — but by the
time this domain runs, **both birthday surfaces are already owned elsewhere**: the 7-day birthday
**banner** is domain 8 (dashboard, `08-dashboard.md` Cluster E) and the birthday-morning
**notification** is domain 11 (`11-notify.md` Cluster D). So this domain owns **only the weekly
digest** — its keep/cut/defer decision and, if kept, its form, content, and delivery.

The plugin's digest (`main.ts:294-356`) was a **manual palette command** (verified: no interval,
no scheduler) that wrote a markdown file to the vault root bucketing *contacted-this-week /
needs-attention(decay) / snoozed* with a total-count footer, then opened it. None of that file
plumbing has a mobile analogue.

> **Inherited and already settled — not reopened here.** These bound this run:
> - **Birthdays are NOT this domain's** — banner (08) and morning notification (11) are decided.
>   14 "must not assume it owns birthday alerts" (11-notify → digest).
> - The **dashboard is always-current** and already surfaces needs-attention (filter), snoozed
>   (counted segment), and never-contacted (counted sibling screen) — so the digest must earn its
>   keep on what the dashboard *cannot* show, not by repeating it (08-dashboard).
> - **Notify owns all notifications**; if the digest ships as a push it **reuses notify's
>   engine** (scheduling, quiet-window, morning delivery, launch-reconcile). Rogue / "gone quiet"
>   are surfaced **in-app** by notify, which explicitly leaves it to 14 whether the digest *lists*
>   them (11-notify → digest).
> - **Scheduled-notification content is FROZEN at schedule time** (11-notify Cluster A, platform-
>   verified) — a notification body cannot carry live counts; a digest push must open a
>   live-computed screen.
> - **Streaks are REJECTED** (04-log Cluster —): HANDOFF §1 promises *no-obligation* check-ins and
>   §6 blames friction for the plugin's abandonment. The digest must not manufacture obligation or
>   gamify. Coarse, non-judgemental framing only.
> - The **quality marker (good/fine/hard)** exists partly so "the digest and the AI aggregates
>   [can] surface a relationship that has become effortful" (04-log). Whether the digest *reads*
>   it was explicitly deferred **to this domain** (04-log Deferred).
> - Every user-data table already carries a stable id; the digest is a **read surface** and is
>   expected to add **no new schema** (like the widget).

---

## Decisions

### Cluster A — The gate: does the digest ship, and in what form

**[DECIDED] The weekly digest ships in v1 as a WEEKLY LOCAL NOTIFICATION that opens a dedicated
digest ("your week") SCREEN.** This resolves the remaining half of HANDOFF open-question #7
(**keep**). The notification reuses domain 11's scheduling engine; the screen is computed live on
open (no stored/frozen content), and is the digest's real payload — the retrospective the
dashboard cannot give (who you *reached* this week) plus a calm, non-nagging home for the
populations notify deliberately won't push about (rogue / "Rarely responds" / gone-effortful).

Rationale (owner): the always-current dashboard already answers who-needs-attention / snoozed /
never-contacted, so a digest that only repeats those would not earn its place — but a weekly
*retrospective* is a genuinely different function (the dashboard is a due-list, not a "what I did"
view), and it is the natural non-nagging surface for the contacts 11-notify keeps out of the
shade. A push is what makes it a weekly *ritual* rather than a screen nobody visits (the plugin's
manual command fell out of use). Because the platform freezes notification content, the push is a
generic prompt and the numbers live on the screen it opens — the same generic-body pattern
11-notify already adopted for decay.

**[REJECTED] In-app digest screen only, no notification** — zero-permission and zero-nag, but weak
discoverability; this is essentially the plugin's manual command, which fell out of use.
**[REJECTED] Weekly notification that opens the existing dashboard (no new screen)** — leanest, but
adds little over the dashboard the user already opens and gives no retrospective.
**[REJECTED] Cut from v1** — the dashboard subsumes the *current-state* buckets, but cutting drops
the retrospective and the non-nagged-populations home, and cuts against the owner's already-made
investment in the quality marker "for the digest."

### Cluster B — Content (the screen's buckets)

**[DECIDED] The retrospective bucket ("Reached this week") counts EVERY logged touchpoint in the
trailing 7 days — outbound or inbound, connected or not, one-tap or full-log.** A one-way text
that got no reply still counts; so does an inbound "they called me" and a one-tap widget mark.
Rationale (owner): matches HANDOFF §1's *no-obligation* premise — the user is never penalised in
their own retrospective for someone else's silence. "You did your part" is the frame.
**[REJECTED] Connected touchpoints only** — reads as penalising the user for a non-reply.
**[REJECTED] Outbound-only** — drops reconnections that came the other way, also worth celebrating.
*Query: interaction rows with `occurred_at` in the window; no `connected`/`direction` predicate.
Archived contacts excluded (graveyard). Presentation — list vs count — is the design pass, with
the streak-caution below.*

**[DECIDED] The second section is "the overlooked" — the contacts that have slipped WITHOUT being
nagged: `rogue` + "Rarely responds" gone-quiet, plus the never-contacted backlog.** This is the
digest's distinctive job and the thing the dashboard shows only if you go looking: notify
deliberately keeps rogue / "Rarely responds" out of the shade (11-notify Cluster B), so the weekly
digest is their calm home. Never-contacted appears as a gentle backlog nudge ("3 people you added
but never reached").
Rationale (owner): the dashboard already owns everything *push* covers (decay) with a filter and a
count, so repeating it would not earn the digest's keep; the overlooked populations are exactly
what nothing else surfaces on a schedule.
**[REJECTED] Full needs-attention list (all decay + rogue)** — duplicates the dashboard filter and
the decay pushes. **[REJECTED] Both a due-count + overlooked** — risks the digest reading as a
second dashboard. **[REJECTED] Retrospective only** — drops the non-nagging home for slipped
contacts, a stated reason to keep the digest at all.
*The overlooked section is IN-APP screen content, not a push, so it is not suppressed by the
per-contact reminders-off mute (which governs decay *pushes* only, 11-notify) — a muted contact
that goes rogue still appears here. Rogue's threshold is the single shared rogue constant
(09-orrery), read never recomputed.*

### Cluster C — The effortful-relationship signal (quality marker)

**[DECIDED] The digest READS the quality marker (good/fine/hard) and surfaces a gentle,
non-judgemental line when recent contacts skew "hard"** — e.g. "A few recent chats have felt
effortful," pointing at those people (tap → profile). This is the exact purpose 04-log added the
marker for.
Rationale (owner): honours the marker's stated digest purpose while staying coarse and kind — a
soft nudge toward a relationship that has become work, never a score or a verdict.
**Cost recorded (from 04-log):** a quality signal edges the digest toward "a weekly evaluation of
your relationships," the same obligation-manufacturing the rejected streaks were rejected for. The
mitigation is that it is coarse, appears only when the signal is real, and never prints a rating —
consistent with gravity's "coarse tiers are what makes it unlike a streak" (04-log).
**[REJECTED] No quality callout** — safest against the judgment feeling, but leaves the marker's
stated digest purpose unused (against the owner's own 04-log call). **[REJECTED] Fold in with no
label** — informs the overlooked section silently; the owner chose the explicit-but-gentle line.
*How "skews hard" is computed (a threshold over recent marks) and the exact copy are phase-level.*

### Cluster D — Delivery & settings

**[DECIDED] The digest fires as ONE native weekly notification on SUNDAY MORNING, framed as a
retrospective ("here's your week").** Sunday matches the content (a look back at who you reached)
and the plugin's own doc suggested a Sunday review. Platform-confirmed: a single
`SchedulableTriggerInputTypes.WEEKLY` trigger (`weekday:1` = Sunday) is Android-native,
AlarmManager-backed, and survives reboot with no custom receiver — so it keeps firing even if the
app is never opened. It delivers in the morning window reusing 11-notify's quiet-window logic.
Rationale (owner): a reflective weekly close, not a forward-planning nag (which would lean toward
duplicating the dashboard).
**[REJECTED] Monday "week ahead" framing** — more forward-looking, leans into the dashboard's job.
**[REJECTED] User-set day/time in v1** — a new settings surface; notify deferred a user-set hour
post-v1 with no migration cost, and the same applies here.
*Because scheduled content is frozen (platform-verified), the notification body is STATIC generic
copy ("Your week in Orbit") and every number is computed live on the screen it opens — the same
generic-body pattern 11-notify uses for decay. The exact morning hour and quiet-window bounds are
tunable constants (top of the service file), deferred to planning.*

**[DECIDED] The Sunday notification fires unconditionally every week; a genuinely empty week opens
to a calm "all quiet this week" state on the screen, not a suppressed ping.** The app cannot know
the coming week's state at schedule time (content is frozen), so suppression would require
cancel/reschedule logic that only runs when the app is open — sacrificing the native trigger's key
asset (it fires even if the app is never opened). A truly empty week is rare (you almost always
reached someone or someone is slipping), so the reliability is worth the occasional quiet ping.
**[REJECTED] Suppress the notification on an empty week** — trades the never-open reliability win
for avoiding a rare dull ping, and re-introduces app-open reconciliation the native trigger avoids.

**[DECIDED] The digest is a third notification type (with decay reminders and birthday alerts),
independently toggleable, and DEFAULTS ON once notifications are granted.** All notifications stay
gated behind 11-notify's single value-moment `POST_NOTIFICATIONS` prompt; the digest adds no new
permission ask. Default-on is consistent with choosing the push form specifically to make the
digest a weekly ritual; a user who dislikes it flips one toggle.
**[REJECTED] Default off / opt-in** — most minimal, but a digest nobody discovers repeats the
plugin's fate (its manual digest fell out of use).
*This is a third per-type toggle on 11-notify's settings surface (master + decay + birthday +
**digest**). Whether it maps to its own notification channel vs an app-level gate is phase-planning,
per 11-notify's channel-immutability note.*

## Cross-domain constraints exported

- **[digest → data / self]** The digest adds **NO new schema and no new persistent state** (like the
  widget, 12). It is a pure read surface: the retrospective reads `interactions` in a 7-day window;
  the overlooked section reads derived `status`/`rogue`, the "Rarely responds" flag, and
  `last_contact IS NULL`; the gentle line reads the existing `interactions.quality` marker. Nothing
  is stored or scheduled per-contact.
- **[digest → notify (11)]** The digest is a **third notification type** on 11-notify's settings
  surface (master + decay + birthday + **digest**), **defaults on**, rides 11-notify's single
  value-moment `POST_NOTIFICATIONS` prompt (no new permission ask), and delivers in the **morning
  quiet-window** 11-notify computes. Mechanism differs from decay: **one native
  `SchedulableTriggerInputTypes.WEEKLY` trigger** (`weekday:1` = Sunday), not per-contact dated
  notifications — so it needs no launch-reconcile loop. Tap → digest screen, **Back → dashboard**
  (inherits 11-notify's `singleTask`/`onNewIntent` back-stack pattern).
- **[digest → data/log]** The retrospective counts **all** interaction rows in the window (no
  `connected`/`direction` predicate); the overlooked section is **not** suppressed by the
  per-contact reminders-off mute (mute governs decay *pushes* only) — a muted contact that goes
  rogue still appears in the digest. Rogue uses the **single shared rogue constant** (09-orrery),
  read never recomputed. Archived contacts are excluded from every digest section.
- **[digest → dashboard (8)]** The digest does **not** reserve or need dashboard space (08 already
  ruled it ships no digest surface). The digest's overlooked section and the dashboard's
  needs-attention filter read overlapping data but are distinct surfaces; the digest deliberately
  covers the **non-nagged** populations the dashboard shows only on demand.
- **[digest → backup (15)]** Export the **digest on/off toggle** (a settings row, alongside
  11-notify's other notification settings). The weekly **schedule is derived** — rebuilt by
  re-registering the single WEEKLY trigger on restore/launch — not exported. No digest-specific
  contact data exists to export.
- **[digest → theme]** The digest screen and the "all quiet this week" empty state resolve all
  colours through tokens (CLAUDE.md); no new status colours beyond those 09-orrery/01-data export
  (it reuses the rogue/extinguished colour for overlooked-rogue contacts).

## Deferred to phase discussion

- The digest screen's **layout and copy** (owner's design pass, HANDOFF §12.4): how the
  retrospective renders, the "all quiet this week" empty state, and the overlooked section.
- ⚠ **Streak-caution for the retrospective presentation:** whether it shows a **headline count**
  ("you reached 5 people") or only the *list* of who. A bare number edges toward a scoreboard, the
  thing the rejected streaks (04-log) warned against; the list of names is safer. Behavior is
  decided (all touchpoints, no obligation framing); the count-vs-list framing is design.
- The **gentle quality line's exact copy** and its tone ("felt effortful" vs alternatives) — must
  read as kind, never as a verdict on the person (04-log's stated cost).
- The **static notification copy** ("Your week in Orbit" is a placeholder).
- Whether the digest screen has an **in-app entry point** besides the weekly push, and where
  (a dashboard overflow action, or from settings) — see without-you #3.
- Birthday **lead-time interplay**: none here — birthdays are wholly 08/11; recorded so a future
  reader does not re-add a birthday section to the digest.

## Deferred to phase planning

- The three digest **queries**: retrospective (`interactions` in a 7-day window, no
  connected/direction predicate, archived excluded); overlooked (`rogue` via the shared constant +
  "Rarely responds" gone-quiet + `last_contact IS NULL` backlog, mute ignored, archived excluded);
  and the "skews hard" **threshold** over recent `quality` marks for the gentle line.
- **Channel identity**: whether the digest maps to its own notification channel or an app-level
  gate, given 11-notify's channel-immutability trap (recreate under a new versioned id to change
  behaviour).
- **Device spike (carried from the platform verifier):** confirm the `WEEKLY` trigger fires
  **once per week** on the physical Pixel (pre-57 repeat bugs #34782/#30577 warrant one on-device
  check; emulator won't do — CLAUDE.md), and that it re-registers across a reboot as documented.
- Re-registering the single WEEKLY trigger idempotently (avoid duplicate registrations on repeated
  launches); cancel/re-register when the digest toggle flips or the day/hour constant changes.
- Tap routing (`data` payload → `getLastNotificationResponseAsync` cold / response listener warm →
  digest screen), reusing 11-notify's `onNewIntent` back-stack under Android 15 BAL limits (a user
  tap is user-initiated, so it is allowed — platform-verified).
- Tunable constants at the top of the digest service file: **delivery weekday** (Sunday),
  **morning hour** and **quiet-window bounds** (shared with 11-notify), and the **"skews hard"
  threshold**.

## Decisions made without you

Orchestrator's picks on items with no articulable owner-visible divergence. **Read each as the
decision AS ADOPTED.** Veto any cheaply at review.

1. **The plugin's "snoozed" digest bucket is DROPPED.** The dashboard already has a counted snoozed
   segment (08); repeating it in a weekly digest adds nothing. (The plugin also mis-bucketed
   snoozed/never-contacted against mobile's suppression rules — 08 F3.) Veto if you want snoozed
   listed in the digest.
2. **The plugin's markdown-file mechanics are gone entirely** — no exported/openable/annotatable
   file, no vault. The digest is a live in-app screen. (No mobile analogue exists; not a real
   choice.)
3. **The digest screen is also reachable in-app**, not push-only — otherwise it is visible once a
   week only. Placement (a dashboard overflow action and/or a settings entry) is the design pass.
   Veto if you want it push-only.
4. **A `rogue`/overlooked contact in the digest taps through to its profile**; the retrospective's
   names and the gentle line's names likewise tap to profile. Standard.
5. **The digest reuses the single birthday parser's fixes and the rogue constant rather than
   recomputing** — the digest introduces no new date or threshold math of its own.
6. **No digest badge/count on an app icon or nav entry** — the weekly push is the prompt; a
   persistent unread badge would nag between weeks, against the posture.

## Findings

Investigation 2026-08-14. The orchestrator read the plugin's digest path first-hand on disk —
`main.ts:291-356` (`generateWeeklyDigest`), its two invocation sites (`main.ts:171-176` the palette
command; `OrbitHubModal.ts:248-255,341-342` the Hub button), `components/BirthdayBanner.tsx` in
full, and `docs/Weekly Digest.md` — and the three completed dossiers that bind this domain
(08-dashboard, 11-notify, 04-log) at the passages that carved birthdays away and left the digest.

### The plugin's digest, verified first-hand

- **It is a MANUAL command, not scheduled.** Registered as palette command `weekly-digest`
  (`main.ts:171-176`) and a Hub "📊 Digest" button (`OrbitHubModal.ts:341-342`) — **no interval, no
  timer, no scheduler** anywhere. The "weekly" is a *suggested habit* in the doc ("Run it weekly as
  part of a Sunday review"), not automation. This corrected the INDEX framing (which implied a
  recurring feature) and directly informed making the mobile digest a real scheduled push.
- **It writes a markdown file** (`Orbit Weekly Digest YYYY-MM-DD.md`) to the vault root, re-running
  the same day updates it in place, then opens it. **No mobile analogue** — this plumbing dies.
- **Three buckets + footer**: contacted-this-week (`lastContact >= weekAgo`), needs-attention
  (`status === "decay"`, rendering never-contacted as "(last: never)"), snoozed, and a total count.
  On mobile the needs-attention/snoozed/never-contacted buckets are already the always-current
  dashboard's job (08), which is why the digest was re-pointed at the **retrospective** (a look
  *back*, which the dashboard's due-list cannot give) and the **non-nagged overlooked** populations
  (which nothing else surfaces on a schedule).
- The plugin digest **honoured none of mobile's suppression rules** (buckets snoozed, surfaces
  never-contacted) — so nothing ported verbatim; the buckets were redesigned from the status model.

### Why birthdays are absent from this domain

HANDOFF Q7 paired "Weekly Digest" and "Birthday alerts," but both birthday surfaces were decided
before this run: the **7-day banner** in 08-dashboard Cluster E (excludes archived only; overrides
snooze/never-contacted suppression) and the **birthday-morning notification** in 11-notify Cluster D
(own channel, tap → profile). 11-notify's export is explicit: "14 must not assume it owns birthday
alerts." This domain therefore closes Q7's **digest half** only (keep), and touches birthdays not
at all — recorded so a later reader does not re-open a birthday section here.

### Platform verification (2026-08-14, Expo SDK 57 / expo-notifications 57.0.9)

A single platform verifier established the scheduling mechanic, all consistent with 11-notify's
already-verified frozen-content / quiet-window facts:

- **Native weekly repeat works on Android.** `SchedulableTriggerInputTypes.WEEKLY`
  (`{weekday,hour,minute}`, `weekday:1` = Sunday) is Android-native, AlarmManager-backed, and
  survives reboot — expo-notifications auto-declares `RECEIVE_BOOT_COMPLETED` and re-registers, so
  **no custom boot receiver**. It keeps firing even if the app is never opened — the property that
  made it the right mechanic and drove the fire-always empty-week decision.
- **Content is frozen, same as one-shot notifications** — no per-occurrence callback; fresh weekly
  copy would need cancel+reschedule (app-open, unreliable offline). Hence **static generic copy +
  compute-on-open**, mirroring 11-notify's generic decay body.
- **Tap-to-open is standard and unblocked** — `data` payload + `getLastNotificationResponseAsync`
  (cold) / response listener (warm); Android 15's background-activity-launch limit does not apply to
  a **user tap** (user-initiated). No code change to the existing `singleTask`/`onNewIntent` path.
- **Caveat → device spike:** pre-57 repeat bugs (#34782, #30577) warrant one on-device confirmation
  the trigger fires exactly once/week; must be the physical phone, not the emulator (CLAUDE.md).

### Workpapers

- `workpapers/14-digest/platform-weekly-notification.md` — the WEEKLY trigger, weekday numbering,
  frozen content, reboot/AlarmManager persistence, tap-to-open, and the pre-57 repeat-bug caveat,
  with doc URLs and versions.
- Reused first-hand: `workpapers/11-notify/platform-scheduling-background.md` and
  `platform-lifecycle-channels.md` (frozen content, quiet-window, channel immutability, morning
  delivery) and `workpapers/08-dashboard/overlap-birthday-digest.md` (the dashboard↔digest seam).
