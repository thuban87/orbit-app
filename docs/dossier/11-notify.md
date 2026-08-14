# Dossier 11 — `notify` — Actionable notifications

**Status:** complete · Interrogated 2026-08-13 → 2026-08-14 · 16 questions over 5 rounds · No
`[OPEN]` items remain (the alert-feel/channel-importance cosmetic is parked to the §12.4 design
pass, not open; several tunable constants are deferred to phase planning)

## Scope

Local notifications that collapse a reminder and its action into as few taps as possible: a
decay alert for an overdue contact that leads to reaching out, with that contact's
Conversational Fuel visible (HANDOFF §6 `[DECIDED]`). There is no backend and no scheduler
daemon, so this domain decides **when decay checks actually run** (launch sweep? pre-scheduled
dated notifications? periodic background task?), the **notification anatomy and action set**
(within Android's hard limits), the **tap→action flow** (what "fuel visible" and the SMS handoff
concretely become), **snooze-from-notification**, and the **nagging policy** (re-notification
cadence, quiet hours) that decides whether Orbit becomes the friction that killed the plugin.

This domain has **no plugin predecessor** — Obsidian had no notifications. It owns the
notification *mechanism*; the weekly digest and birthday alerts (domain 14, pending) may reuse
its channels/scheduling, and the widget (domain 12, pending) shares its headless-write path.

---

## Inherited & binding (settled upstream — not reopened here)

From completed domains; these are constraints this interrogation builds on, not questions.

- **The notification action opens an in-app COMPOSE SCREEN, not the SMS composer directly**, and
  never prefills fuel into the SMS draft. `expo-sms` cannot run headless (`SMSModule.kt:76`), so
  Orbit's Activity foregrounds in every design; the compose screen shows the contact's full fuel
  with a send control that hands off to the SMS composer. (03-fuel Cluster D.)
- **One collapsed line of ranked fuel.** `expo-notifications` hardcodes `BigTextStyle`; `body` is
  both collapsed line and expanded block; framework hard cap 1024 chars, silently truncated, so
  the app must truncate first. `off_limits` fuel is excluded in the query. (03-fuel.)
- **Action budget is 3 (AOSP `MAX_ACTION_BUTTONS=3`), spoken for as mark-contacted / snooze /
  open.** The decay notification carries no text-capture field. `RemoteInput` free-text reply is
  *possible* on this stack but declined on budget grounds. (03-fuel Cluster F.)
- **Lock-screen exposure is a user setting, default private**, implemented as a **second channel**
  (visibility is per-channel and immutable after creation). (03-fuel Cluster D; 01-data.)
- **Never-contacted contacts fire no decay notifications** (no progress value). **Snooze
  suppresses notifications while the clock keeps running.** **SMS composer reads `contacts.phone`.**
  (01-data.)
- **`rogue` contacts fire no decay notifications** — replaced by a non-nagging signal (this domain
  owns what that signal *is*). Mark-contacted stays a genuine one-tap and **writes headlessly**;
  the background path is gated to non-foreground, so a tap while Orbit is open is silently dropped
  unless the ordinary response listener is *also* wired — implement both. (04-log.)
- **The `rogue` time-threshold is a multiple of the contact's interval — a SINGLE shared constant**
  read by both the orrery's rogue rendering and this domain's decay-suppression. Do not compute
  rogue twice. (09-orrery.)
- **No per-notification large icon** for local notifications in managed expo-notifications — a
  contact's photo cannot appear on a decay notification without a bare-workflow native module.
  Scope call belongs to this domain. (07-photos.)
- **`launchMode="singleTask"` is imposed app-wide** by `expo-share-intent`. Notification taps reuse
  one activity via `onNewIntent`, not a fresh `onCreate`; combined with Android 15
  background-activity-launch limits, the post-tap back-stack needs explicit design here. (10-capture.)
- **One-tap routes write `channel='unspecified'`, connected=true, `direction='outbound'`,
  `quality=null`, `source='notification'`.** (04-log.)

---

## Decisions

### Cluster A — The reminder engine (when/how decay checks fire)

**[DECIDED] Delivery is fuzzy, Doze-batched, and takes NO exact-alarm permission.** Decay
notifications schedule on the inexact `setAndAllowWhileIdle` branch (`SCHEDULE_EXACT_ALARM` is
never declared), so they arrive within a delivery window, deferred during Doze.
Rationale: a decay nudge has no minute-level meaning — it is an accelerator, and the dashboard
stays the source of truth. Taking the permission would add a user-facing, revocable prompt (its
revocation cancels *every* pending alarm), a Play-policy justification for a "limited use case"
this fits weakly, and would cut against Orbit's "asks for almost nothing" posture.
**[REJECTED] `SCHEDULE_EXACT_ALARM` for minute-accurate delivery** — the cost above for precision
the feature does not need.

**[DECIDED] A due contact is nudged at a fixed morning hour, and nudges never deliver inside a
quiet window** (working figures: fire ~9am; hold 9pm–8am and roll to the next morning). Android
has **no quiet-hours API**, so the app computes the next allowed delivery instant itself and
schedules the alarm for it (verified: no time-of-day field on any trigger or channel;
`platform-lifecycle-channels.md` C, `platform-scheduling-background.md` Q4).
Rationale: one calm daily moment that respects sleep, with no settings surface to build in v1.
**[REJECTED] User-set delivery hour in v1** — one more settings row; addable later with no
migration. **[REJECTED] Fire at the exact due-instant, any hour** — can nudge at 2am.
*The exact hour and quiet-window bounds are tunable constants (CLAUDE.md: top of the service
file); deferred to phase planning.*

**[DECIDED — ⚠ further narrows HANDOFF §6 / 03-fuel Cluster D] The decay notification body is
GENERIC; the live fuel is shown on the in-app compose screen the notification opens, never in the
notification text itself.** The body reads e.g. *"Alice — time to reach out."*

> ⚠️ **This narrows a decided item, with the owner's explicit choice.** HANDOFF §6 wants "fuel
> visible" at the reminder; 03-fuel Cluster D already interpreted that as fuel visible *in the
> notification AND on the compose screen*. This decision drops the **notification-text** half:
> fuel is now visible only on the compose screen. The reason is a hard platform fact, not a
> preference — **scheduled-notification content is frozen at schedule time** (the full request is
> serialized to SharedPreferences and re-shown verbatim when the alarm fires;
> `platform-scheduling-background.md` A/Q2), so baked-in fuel goes stale, drifts as ranking ages,
> and fires for since-contacted contacts unless the app cancels+reschedules on every change. A
> generic body is never stale and cannot leak private fuel to the lock screen. The owner was shown
> the live-reschedule and accept-staleness alternatives and chose the generic body.

**[REJECTED] Live fuel in the body via cancel+reschedule on every fuel/due-time change** — keeps
§6 literal but still drifts between reschedules (time-based ranking has no mutation event), and
adds moving parts on the most-fired write paths. **[REJECTED] Fuel snapshot, accept staleness** —
knowingly ships stale text and post-contact misfires.
*Downstream: this likely moots 03-fuel's "second channel for lock-screen visibility" — see the
re-derivation flagged for Cluster D below. Body copy is phase-discussion.*

**[DECIDED] Notifications stay per-contact and actionable, delivered naturally staggered — not
batched into a summary.** One notification per due contact (each carrying that contact's own
mark-contacted / snooze / open actions), with delivery spread across the morning window so a burst
never forms.
Rationale: preserves HANDOFF §6's core — decay alert → *this* person → their fuel → text them —
which a summary notification cannot (it would open the app on nothing per-contact-actionable).
Verified platform pressure this manages rather than fights: Android 15 Notification Cooldown
auto-mutes a same-app burst for ~2 min, expo-notifications does no grouping, and every
notification posts with id 0 distinguished only by tag (`platform-lifecycle-channels.md` D/F).
Staggering across the window keeps each contact its own actionable entry without tripping cooldown.
At tens of contacts with independent due dates, bunching is rare anyway.
**[REJECTED] One 'N people are due' summary when many bunch** — fights the platform less but loses
per-contact action and fuel from the shade. **[REJECTED] Fire all due contacts at once** — a
same-morning burst gets cooldown-muted after the first, so later contacts are missed.
*A per-contact **stable notification identifier** (`decay:<contactId>`) is used so a re-nag
REPLACES rather than stacks (`platform-lifecycle-channels.md` D). Ranking/DDL are phase-planning.*

### Cluster B — Nagging policy & suppression

**[DECIDED] Reminders re-nag on a slow cadence (working figure: weekly), each re-nag REPLACING
the previous shade entry.** A contact crossing overdue fires once; while still overdue and unacted,
it re-reminds ~weekly until acted (mark-contacted resets it) or it goes silent at the rogue
threshold. The re-nag reuses the contact's stable identifier so it replaces rather than stacks
(`platform-lifecycle-channels.md` D).
Rationale: balances the product's purpose — actually get you to reach out — against the anti-nag
mandate of HANDOFF §1/§6. One-and-done risked silent decay (a missed nudge, then nothing until
rogue, which is also silent); daily would rebuild the plugin's friction.
**[REJECTED] One nudge per decay episode** — purest anti-nag, but a dismissed nudge means a
relationship can fade with no further prompt. **[REJECTED] Daily re-nag** — the friction that
killed the plugin.
*The cadence is a tunable constant (top of the service file); phase-planning owns the exact value
and any decay→rogue escalation shape.*

**[DECIDED] Rogue and "Rarely responds" contacts generate NO notifications at all — their state
is surfaced only in-app** (dashboard / orrery rogue visual / profile). This settles what 04-log
called "a non-nagging signal instead": the signal is the in-app rendering, not a notification.
Rationale: by the time a contact is rogue, nagging has demonstrably not worked (04-log); a
notification would be exactly the pestering §6 blames for abandonment.
**[REJECTED] A one-time 'gone quiet' nudge** at the rogue crossing — still a notification about
someone nagging hasn't reached. **[REJECTED] Folding them into the weekly digest (domain 14)** —
would create a dependency on a not-yet-interrogated domain for a signal this domain can just render
in-app. *(The digest may separately choose to list them — that stays domain 14's call.)*
*Mechanically this is already enforced by the shared rogue constant: scheduling stops at the rogue
threshold, the same multiple-of-interval the orrery uses (09-orrery → notify).*

**[DECIDED — owner, against the orchestrator's recommendation] A contact carries a permanent
"reminders off" toggle, separate from snooze.** A contact kept in Orbit but never nudged about
(e.g. someone seen daily anyway) can be muted permanently; snooze stays the temporary tool.
Rationale: owner's call — the graduated suppression (snooze / Rarely-responds / rogue / archive)
did not cover "keep them, track them, but stop reminding me," and he wants that as an explicit,
durable control rather than a workaround.
**Cost recorded:** a new nullable flag on `contacts`, a predicate on the scheduling path, and a
new control on an editing surface 06-crud deliberately kept lean. It also overlaps conceptually
with archive (keep-but-hidden) and Yearly frequency (rare nudges) — the distinction is that a
muted contact still appears everywhere and still decays; only the *notification* is suppressed.
**[REJECTED] No separate mute in v1** (orchestrator's pick) — judged redundant with snooze/archive;
owner overrode.

**[DECIDED] A decay notification shows the static app icon only — no per-contact photo — and no
native module is taken for it in v1.** Verified: managed expo-notifications has no
per-notification large icon for local notifications (the large icon is one static manifest
resource; the dynamic path is FCM-remote only, and Orbit has no FCM —
`platform-lifecycle-channels.md` E, 07-photos → notify).
Rationale: the contact's identity rides in the text, their photo is on the compose screen one tap
away, and this keeps the app in managed Expo with no native maintenance burden for a cosmetic gain.
**[REJECTED] A bare-workflow/native notification builder for contact avatars** — native code and
maintenance for a cosmetic identity cue already carried by the text and the compose screen.

### Cluster C — The tap → action flow

**[DECIDED] The Snooze action applies a fixed length headlessly** (working figure: +1 week),
writing a snooze event with no app launch — a genuine one-tap, matching mark-contacted. Longer or
custom snoozes are set in-app on the profile.
Rationale: a notification action cannot show a length picker, and the shade action should be as
cheap as mark-contacted. This resolves 01-data's open snooze-preset question *for the notification
surface* (the in-app profile presets stay 01-data/phase-discussion). The fixed length is a tunable
constant.
**[REJECTED] Snooze opens the app to a length picker** — more control, but costs a launch on a
near-dismiss action and cannot run headless.
*Consequence: the headless snooze writes a snooze row to the `events` table (04-log) and must be
wired through BOTH the background task and the foreground listener, exactly like headless
mark-contacted (04-log's double-write requirement) — else a snooze tapped while the app is open is
silently dropped.*

**[DECIDED — refines 03-fuel Cluster F's action set] Two action buttons: mark-contacted and
snooze. The notification body tap (default action) opens the compose screen; there is no separate
"open" button.** The freed third slot is left empty in v1.

> This does not reverse 03-fuel — it *implements* its "mark-contacted / snooze / open" more
> tightly. Since the default body tap already opens the compose screen, a dedicated "open" button
> is redundant, so it is dropped and the slot freed. 03-fuel explicitly left inline
> `RemoteInput` fuel-capture "available if the budget changes"; the budget just changed, and the
> owner declined to spend it.

**[REJECTED] Inline fuel-capture (`RemoteInput`) in the freed slot** — a real zero-friction typed
capture path (possible here, impossible on a widget), but it is typing at a reminder whose job is
to make you reach *out*, and the share-sheet + profile already own fuel capture. Recorded as
available-for-later, unchanged from 03-fuel's posture. **[REJECTED] Keeping an explicit "open"
button** — redundant with the body tap; spends a slot on discoverability.

**[DECIDED] A notification tap lands on the compose screen, and Back from there goes to the
dashboard.** The reminder drops the user into Orbit proper (home = dashboard), so they can keep
working rather than being ejected.
Rationale: standard, predictable "notification opens the app" behaviour. This settles the back-stack
question 10-capture exported: because `expo-share-intent` forces `launchMode="singleTask"`
app-wide, the tap arrives via `onNewIntent` on the one activity instance, and the compose screen is
pushed onto a stack rooted at the dashboard.
**[REJECTED] Back returns to the previous app** (compose-as-transient-overlay, like capture's
return-to-source) — fastest exit but strands the user from the rest of Orbit and is unusual for a
reminder tap.
*Phase-planning owns the concrete `onNewIntent` routing and the synthetic back-stack construction
(Android 15 background-activity-launch limits apply — 10-capture, `platform-scheduling-background.md`).*

### Cluster D — Scope & the settings surface

**[DECIDED] Birthday notifications ship in v1 and are owned by THIS domain.** Notify schedules a
birthday-morning notification (tap → profile), reusing the decay engine's scheduling, quiet-window
and morning-delivery logic on its own channel. This resolves the birthday half of HANDOFF Q7
(keep). Domain 14 retains the **weekly digest** and its own keep/cut.
Rationale: a birthday alert is a decay-notification's cousin — same primitives — so building it
here costs almost nothing and does not strand birthdays behind an un-interrogated domain 14.
**Suppression differs from decay, mirroring 08-dashboard's banner:** a birthday notification fires
for anyone with a birthday **except archived** contacts — it is **not** suppressed by
never-contacted, snooze, rogue, "Rarely responds", or the per-contact reminders-off mute (those
govern *decay* nudges; a birthday is not a decay nudge). It reuses the **single birthday parser**
08-dashboard owns — inheriting its two flagged bugs to fix (day-of drop; Feb-29→Mar-1 in non-leap
years).
**[REJECTED] Defer to domain 14** — creates a dependency on unscheduled work for a feature the
engine already supports. **[REJECTED] No birthday notification in v1** — leaves the 7-day banner as
the only birthday surface.

**[DECIDED — reaffirms 03-fuel Cluster D] Decay notifications keep a private-by-default lock-screen
posture, implemented as a second channel; the choice survives the generic-body decision.** Even
with fuel off the notification, the contact **name** is sensitive in a relationship CRM — a locked
glance should not reveal who you are overdue to reach. Per-channel visibility is immutable, so
honouring a user public/private toggle requires the second channel 03-fuel already flagged.

> ⚠️ **Considered for reversal, upheld.** The generic-body decision (Cluster A) removed 03-fuel's
> *stated* rationale (fuel on the notification). The owner was shown that this could justify
> collapsing to a single public channel and dropping the setting, and chose to **keep** the private
> default on the residual sensitivity of the contact name. 03-fuel's second-channel constraint
> stands.

**[REJECTED] Single public channel, drop the setting** — simpler channel architecture, but a
name-only body on the lock screen still discloses who is decaying, against the privacy posture.

**[DECIDED] The `POST_NOTIFICATIONS` runtime prompt is requested at a value moment** — when the
user first acts in a way that implies wanting reminders (first contact added, or reminders toggled
on) — not cold at first launch.
Rationale: higher grant rate, less jarring, and consistent with Orbit's "asks for almost nothing"
posture (the same posture that declined `READ_CONTACTS` in 01-data and `CAMERA` in 07-photos).
**[REJECTED] Prompt on first launch** — a cold permission ask before any demonstrated value.

**[DECIDED] Settings expose a master notifications on/off, per-type toggles (decay reminders;
birthday alerts), and the lock-screen visibility control.** Standard granularity — control without
clutter.
**[REJECTED] Master on/off only** — cannot silence birthdays and decay independently.
**[REJECTED] System settings only** — poor discovery, no single in-app off.
*The per-type toggles map onto the notification channels; wiring in-app toggles to channel state
(vs a separate app-level gate) is phase-planning, given channel immutability
(`platform-lifecycle-channels.md` A/B — recreate under a new versioned id to change behaviour).*

## Cross-domain constraints exported

- **[notify → data]** `contacts` gains a **nullable "reminders off" mute flag** (default off). It
  suppresses **decay** notification scheduling only; a muted contact still appears on every screen
  and still decays. It *can* be backfilled (default off), so it is not migration-critical, but it
  is decided now.
- **[notify → crud]** The mute toggle needs a **per-contact editing surface** (edit form and/or
  profile), alongside 06-crud's "Rarely responds". **Additive to 06-crud, not a reversal** — but it
  adds a second per-contact control to a form 06-crud kept deliberately lean. Its placement/label is
  phase-discussion.
- **[notify → fuel]** ⚠ **Refines 03-fuel Cluster D three ways.** (1) The decay notification body is
  **GENERIC** — fuel is shown only on the compose screen the tap opens, **not in the notification
  text** (narrows "fuel visible in the notification AND compose screen" to compose-only; forced by
  the frozen-content platform fact, chosen by the owner). (2) The action set is **two buttons —
  mark-contacted + snooze**; the "open" button is dropped (the body tap opens compose), and inline
  `RemoteInput` fuel-capture stays **available-for-later**, unchanged from 03-fuel's posture. (3)
  The **second lock-screen channel is REAFFIRMED** (considered for reversal after the generic-body
  decision, upheld on the residual sensitivity of the contact name).
- **[notify → log]** The **headless Snooze action** writes a snooze row to the `events` table and
  must be **double-wired** (background task + foreground listener), exactly like headless
  mark-contacted — else a snooze tapped while Orbit is open is silently dropped (04-log's
  double-write requirement now covers snooze too).
- **[notify → orrery/data]** The **shared rogue constant is the scheduling cutoff**: no decay
  notification is scheduled once a contact passes the rogue threshold (the single
  multiple-of-interval constant 09-orrery fixed — read, never recomputed here).
- **[notify → data/log]** Contacts that fire **no decay notification**: never-contacted, snoozed,
  rogue, "Rarely responds", and **muted**. **Birthday** notifications fire for **all except
  archived**, ignoring every one of those states (a birthday is not a decay nudge).
- **[notify → digest (14)]** Notify owns **all notifications, including birthday-morning alerts**;
  domain 14 owns the **weekly digest** and its own keep/cut. If the digest ships *as* a
  notification it reuses this domain's channel/scheduling infrastructure. Rogue / "gone quiet"
  contacts are surfaced **in-app** by notify (not notified); the digest **may** separately list them
  — that stays 14's call. **14 must not assume it owns birthday alerts.**
- **[notify → data / dashboard]** The birthday notification reuses **08-dashboard's single birthday
  parser** (annually scheduled, day-of morning) and therefore depends on 08's **two flagged parser
  fixes** (day-of drop; Feb-29→Mar-1) landing before it ships.
- **[notify → backup (15)]** Export must include the **notification settings** (master + per-type
  toggles, lock-screen visibility choice). The per-contact **mute flag** travels with the contact
  row already. The notification **schedule itself is derived, not exported** — a restore rebuilds it
  via the launch-sweep reconcile.
- **[notify → widget (12)]** Shares the **headless-write path** (mark-contacted) and the app-wide
  **`singleTask`/`onNewIntent` back-stack** model; 12's post-tap back-stack should inherit this
  domain's **"Back → dashboard"** resolution as the pattern (10-capture flagged 11/12 together).
- **[notify → planning]** Architecture: **pre-scheduled dated local notifications, reconciled on
  every launch/foreground** (cancel/replace keyed on `decay:<contactId>`), **cancelled** on
  mark-contacted / snooze / interval-edit / mute; **generic body** so content never goes stale;
  `expo-background-task` daily sweep is at most an **offline-intolerant best-effort backstop** (its
  worker is hard-gated on `NetworkType.CONNECTED`), never the primary/sole mechanism.

## Deferred to phase discussion

- The generic-body **copy** (e.g. "Alice — time to reach out") and the birthday-notification copy.
- **Alert feel / channel importance** — punted by the owner to the HANDOFF §12.4 design pass:
  decay quiet-vs-heads-up, and birthday assertiveness. Channel importance is immutable at creation,
  so this must be settled *before* the notify build, not after.
- **Birthday lead time** — day-of morning is the working default (the 7-day banner covers the
  lead-up); whether any earlier "birthday coming up" notification is wanted.
- Where the per-contact **"reminders off" toggle** lives (edit form vs profile) and its label —
  pairs with 06-crud's "Rarely responds" placement.
- The **compose screen** internals (already 03-fuel-deferred): how it renders fuel, the send
  control, the SMS handoff, and graceful degrade when a contact has no phone number.
- Whether the **decay→rogue window** uses escalating re-nag intervals rather than a flat weekly.
- **In-app snooze presets** (01-data-deferred) — the profile snooze lengths, distinct from the
  notification's single fixed headless snooze.

## Deferred to phase planning

- The scheduling reconcile concretely: trigger points, the `decay:<contactId>` / `birthday:<contactId>`
  identifier scheme, cancel points, and the **WAL + JS-mutex** the headless writes share with 04-log.
- The **single shared rogue-threshold constant** wired to both orrery rendering and decay-suppression
  (09-orrery) — one source of truth.
- **Channel identity/versioning** (channels are immutable; changing behaviour means recreating under
  a new versioned id — `platform-lifecycle-channels.md` A/B) and how in-app per-type toggles map to
  channel state vs an app-level gate.
- Tunable constants at the top of the service file: **fixed snooze length, re-nag cadence, morning
  delivery hour, quiet-window bounds, rogue multiple** (the last shared with orrery).
- **Device spike (carried from 04-log):** whether the headless notification-action task
  (`registerTaskAsync`) initialises with **no FCM / `google-services.json`** present.
- Birthday **annual rescheduling**; the shared parser fixes (08-dashboard).
- `onNewIntent` routing + synthetic back-stack construction under **Android 15 background-activity-
  launch** limits (10-capture).
- Wiring the **POST_NOTIFICATIONS value-moment** trigger point; degrade-to-in-app when denied.

## Decisions made without you

Orchestrator's picks on items with no articulable owner-visible divergence. **Read each as the
decision AS ADOPTED.** Veto any cheaply at review.

1. **Birthday notification fires day-of, in the morning window** (the 7-day banner covers the
   lead-up), **tap → profile**. Veto if you want an earlier "coming up" notification.
2. **Birthday alerts get their own channel**, separate from the two decay channels (decay ×2 for the
   lock-screen private/public split, birthday ×1 — or ×2 if birthdays also honour the visibility
   toggle; the simpler single birthday channel is assumed).
3. **Stable identifiers are namespaced** — `decay:<contactId>` and `birthday:<contactId>` — so a
   birthday and a decay reminder for the same person don't replace each other in the shade.
4. **A phone-less contact still gets decay notifications.** The compose screen degrades gracefully
   (fuel shown, SMS-send disabled with an "add number" affordance) rather than suppressing the
   nudge — hiding an overdue contact would be worse than a reach-out with one manual step.
5. **`autoDismiss = true`** (tapping clears the notification); **no sticky/ongoing reminder** —
   ongoing notifications are user-dismissible on Android 14+ anyway (`platform-lifecycle-channels.md`
   G), so pinning buys nothing.
6. **Permission denied degrades to in-app-only** (dashboard/orrery stay the source of truth); the
   app does not nag to re-grant.
7. **The generic body is trivially within the 1024-char cap** — no truncation logic needed for
   decay/birthday notifications (unlike a fuel-bearing body would have).

## Findings

Investigation 2026-08-13. **This domain has no plugin predecessor** (Obsidian had no
notifications), so there was no plugin source to read — the orchestrator instead read the notify
constraints already exported by six completed domains (01-data, 03-fuel, 04-log, 07-photos,
09-orrery, 10-capture) first-hand, and the two prior platform workpapers that had already verified
most of this domain's platform surface (`workpapers/03-fuel/platform-notify-storage.md`,
`workpapers/04-log/platform-onetap-write.md`). Two fresh platform verifiers closed the one real gap
those left — the **scheduling / background-execution architecture** — and both workpapers were
sanity-checked against their own file:line citations before being relied on.

### The crux: the platform dictates the architecture

- **Scheduled-notification content is frozen at schedule time.** `scheduleNotificationAsync`
  serialises the full request (title/body/data) to a **SharedPreferences** store; the AlarmManager
  `PendingIntent` carries only the identifier; on fire the stored request is re-shown verbatim
  (`platform-scheduling-background.md` A/Q2). So a body with live fuel baked in goes stale, drifts as
  ranking ages, and fires for since-contacted contacts — **this is why the notification body is
  generic** (Cluster A).
- **The background-task sweep cannot run offline.** `expo-background-task`'s WorkManager job is
  hard-gated on `NetworkType.CONNECTED` (`platform-scheduling-background.md` B) — fatal for a
  local-first no-network app as a *primary* mechanism. Hence pre-scheduled + launch-reconcile, with
  a background sweep only as an optional online backstop.
- **Same-identifier notifications REPLACE; different-identifier STACK** (`notify(tag=identifier,
  id=0)` — `platform-lifecycle-channels.md` D). A stable `decay:<contactId>` collapses re-nags; this
  is what makes the weekly re-nag clean.
- **Android 15 Notification Cooldown is official** (`platform-lifecycle-channels.md` F) — auto-mutes
  a same-app burst — reinforcing per-contact-staggered over fire-all-at-once.
- **No per-notification large icon** without native code (`platform-lifecycle-channels.md` E;
  07-photos) — app-icon-only decay notifications.
- **No quiet-hours field** anywhere (`platform-lifecycle-channels.md` C;
  `platform-scheduling-background.md` Q4) — quiet hours are Orbit's own scheduling logic.
- **Killed-app action buttons work** via a `registerTaskAsync` task (not the JS listener), pending
  the FCM-less-init device spike (`platform-scheduling-background.md` C; 04-log F5).

### Workpapers

- `workpapers/11-notify/platform-scheduling-background.md` — scheduling engine, frozen content,
  background-task offline gate, cancel/replace identity, alarm caps, killed-state actions.
- `workpapers/11-notify/platform-lifecycle-channels.md` — channel immutability + delete/recreate
  trap, DND/quiet-hours, replace-vs-stack, dismissal/ongoing, badging, Android 15 Cooldown, avatar.
- Reused first-hand: `workpapers/03-fuel/platform-notify-storage.md` (1024-char cap, BigTextStyle,
  3-action limit, SMS foreground requirement, lock-screen per-channel visibility) and
  `workpapers/04-log/platform-onetap-write.md` (headless write model, 30s budget, double-write).
