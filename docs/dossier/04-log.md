# Dossier 04 — `log` — Interaction log & touchpoint updates

**Status:** complete · Interrogated 2026-08-12 · 37 questions over 10 rounds · No `[OPEN]`
items remain in this domain (the `rogue` threshold value is exported to domain 9)

## Scope

What a touchpoint *is* as a record, every route that creates one, and every surface that
reads them back. "Mark contacted" is the app's most-fired action — the tap the whole product
exists to make cheap — so this domain owns the shape of the `interactions` row, the contract
the one-tap routes (widget tile, notification action, quick action) must satisfy, the full
in-app logging flow, editing and deleting touchpoints, and the history/statistics surfaces
that read the table. Dossier 01-data already settled the recency spine (single-writer
`last_contact` as a maintained MAX, local datetimes, rows editable and edits changing status,
every route inserting a row); this domain settles what those rows *contain* and what they are
*for*. It excludes the status math (01-data), fuel (03-fuel), and the widget/notification
mechanics themselves (domains 11 and 12), but owns the constraints those inherit.

**Added mid-session:** this domain also owns **`gravity`** and **`intensity`** (Cluster G) — the
accumulated-familiarity and contact-rate quantities derived from the interaction log. The owner
identified `gravity` as the idea that motivated turning the plugin into an app at all, and it
had no home anywhere in the dossier index.

---

## Decisions

> **Terminology.** Inherited from 01-data and restated because it keeps mattering: an
> interaction **row** is not an interaction **note**. Every touchpoint creates a row; the
> note, the channel and the direction on that row are optional and may be filled in later.
> New here: a row's **channel** is *how* you reached them; its **direction** is *who reached
> whom*; whether it **connected** is a third, independent axis. Do not collapse them.

### Cluster A — What a touchpoint record is

**[DECIDED] The channel vocabulary is the plugin's five values plus an explicit
`unspecified`:** `call` · `text` · `in-person` · `email` · `other` · `unspecified`. A closed
enum, so the AI resolver, the digest and any channel-variety rule can depend on it.
Rationale: `unspecified` is not a null-shaped afterthought, it is the *common* case — one-tap
routes (widget tile, notification action) structurally cannot ask, and the vault importer
cannot recover a channel at all (see Findings). The plugin instead defaults the dropdown to
`'call'` (`UpdatePanel.tsx:40`) and writes that value whether or not the user touched it, so
the app asserts a channel the user never chose and then ships it to a third-party model.
Making "we don't know" representable is the fix.
**[REJECTED] A richer fixed set** (WhatsApp/DM, video call, voice note, letter) — better
fidelity, but a longer picker in the flow that exists to be cheap; addable later as enum
members without a migration. **[REJECTED] A user-editable `channels` table** on the
`categories` pattern — the AI prompt and digest would come to depend on rows the user can
delete, which is the same objection 01-data used to reject category-as-a-custom-field.
**[REJECTED] No channel at all in v1.**

**[DECIDED — owner's design, adopted over all three offered options] Connection is recorded
per touchpoint; whether it moves recency is a per-contact policy.**

Three independent axes, deliberately not collapsed:

1. **Every row records whether it connected.** A voicemail, an unanswered text, a message
   they never replied to — all are real touchpoints and all get rows.
2. **By default, recency moves either way.** Reaching out is the behaviour the product
   exists to make cheap; the app does not adjudicate whether they replied.
3. **A per-contact setting turns that default off**, so for that contact a non-connecting
   attempt does *not* move `last_contact`.

Owner's rationale, verbatim in substance: *"I have a bunch of friends I frequently don't
connect with but we get each other's messages still and respond eventually — I'd keep
recency moving there regardless. Then there are people who never respond, so even though I'm
reaching out, the orbit IS technically decaying on that person."*

This is a stronger model than any option offered, because it separates **did this touchpoint
connect** (a fact about the event) from **does connecting matter for this person** (a
judgement about the relationship), and puts the judgement where it is stable — on the
contact, set once — rather than in the app's most-fired action, where the orchestrator's
"didn't connect" option would have demanded it every time.

**Consequence, sharp and recorded before it is designed:** for a contact with the setting on
who genuinely never responds, `last_contact` stops advancing while the user keeps reaching
out. That contact decays to red permanently and, without further design, would fire decay
notifications forever about someone the user is already contacting. The status engine's
recency read therefore becomes MAX over a *filtered* set for those contacts, not a plain MAX
— which scopes 01-data's single-writer recompute rule (it does not reverse it; the rule is
still one DAO function, still recomputed after every insert/edit/delete). See the follow-up
decisions below.

**[REJECTED] Every row counts, with no connection concept** — simplest query, but makes the
never-responds case invisible and unrepresentable. **[REJECTED] A mandatory "did it connect"
judgement at log time for every contact** — puts a decision into the one-tap path.

**[DECIDED] Direction is a nullable column — `outbound` / `inbound` / `mutual` — asked only
in the full logging flow.** One-tap routes leave it null.
Rationale: unlocks "you initiate every time with Chris", which is a genuine relationship
insight nothing in the plugin can express and which sits directly on HANDOFF §1's premise.
Recorded explicitly: unlike `created_at`, `ring_seq` or `source`, this column *can* be added
later — old rows would be honestly unknown — so it is being taken now on product value, not
on migration fear.
**[REJECTED] No direction in v1.** **[REJECTED] Required direction** — the widget and
notification routes cannot ask, so they would have to guess a value that lives in history
forever: the same class of lie as the plugin's silent `'call'` default.

**[DECIDED] A row carries `occurred_at`, `recorded_at`, and `source`.**
`occurred_at` is when it happened — editable, and the value the status engine reads.
`recorded_at` is when it was written down — immutable. `source` is how the row was created:
full flow / widget / notification / import / AI.
Rationale: `occurred_at` + `recorded_at` is exactly the owner's stated primary workflow made
representable ("log it now, fix the date and time tonight") and lets the app be honest that
something was logged late. **`source` is required, and the driver is the importer, not
provenance-for-its-own-sake:** two investigators converged independently on the finding that
because `last_contact` is now a maintained MAX over rows (01-data), any vault contact that
*has* a `last_contact` must be given a synthesised row or lose its recency — and that
synthesised row is necessarily the **newest row for that contact**, which is exactly where
the AI prompt's channel now comes from. Without `source`, a fabricated import entry is
indistinguishable from a real touchpoint on the profile timeline, in every cadence
statistic, and in the prompt. Neither column can be backfilled truthfully — the same
argument 01-data used for `created_at`/`ring_seq` and 03-fuel used for fuel's `source`.
**[REJECTED] `occurred_at` + `source` only**; **[REJECTED] `occurred_at` only.**

**[DECIDED] The per-contact reciprocity setting is a visible label on the contact, not a
hidden switch.** It shows on the profile and carries its behaviour with it, so a contact
whose orbit behaves differently says why on screen.
Rationale (owner's choice): a quiet toggle means that months later an oddly-decaying contact
has no on-screen explanation. **Naming constraint, flagged and accepted:** the owner
initially called this a "status", but `status` already means `stable`/`wobble`/`decay`/
`snoozed` (`types.ts:32`) — the two must not share a word. See the `rogue` decisions below.
**[REJECTED] A quiet toggle with no label**; **[REJECTED] folding it into the frequency
picker** — one control carrying two unrelated ideas; **[REJECTED] the app auto-suggesting it
from the log** — a rule that can guess wrong about a real person, firing at an arbitrary
moment.

**[DECIDED] For a contact who never responds, decay notifications are suppressed and
replaced by a non-nagging signal.** The information survives ("you've reached out 3 times
since March with no reply"); the pestering does not.
Rationale: recurring notifications about someone you are already contacting is precisely the
friction HANDOFF §6 blames for the plugin falling out of use, and HANDOFF §1 promises
"no-obligation" check-ins.
**[REJECTED] Leaving them decaying and notifying** (maximum honesty, maximum nagging);
**[REJECTED] moving them off the main screens** — a third special-population screen, and out
of sight is out of mind.

**[DECIDED] "Didn't connect" is marked in the full logging flow only. One-tap routes always
record a normal touchpoint, and a row is downgraded later from the history view.**
Rationale: keeps the fast path at one tap, and puts the judgement where the information
actually exists — after waiting for a reply. The notification's three action slots are
already spoken for (03-fuel: mark-contacted / snooze / open) and a widget tile cannot ask
anything at all.
**[REJECTED] A dedicated "reached out, no reply" one-tap action** — would consume one of
exactly three notification action slots (AOSP `MAX_ACTION_BUTTONS = 3`), so something already
decided gets cut. **[REJECTED] Asking in the full flow every time** with a connected default.

### Cluster B — The one-tap contract

**[DECIDED] Same-day repeat taps insert a second row. Duplicates are allowed and visible.**
Both taps are real events; recency is unaffected (already today); an accident is removed from
the history view.
Rationale: a no-op would be a lie the moment you genuinely call *and* text the same person on
the same day, which is a normal pattern rather than an edge case. The plugin's only defence
against this (`isContactedToday`, `LinkListener.ts:107-118`) guarded a single path that does
not port.
**[REJECTED] No-op with "already logged today" feedback** (the plugin's guard, generalised);
**[REJECTED] updating the existing row's timestamp** — silently destroys the earlier time and
makes "we spoke twice today" unrepresentable.

**[DECIDED] `rogue` is one state reached two ways, with a `reason` attribute recording which.**
The name is the owner's (a rogue planet has left orbit) and was verified free: zero hits for
"rogue" across this repo's docs, `HANDOFF.md` and the dossier, and zero across the plugin's
`src/`, `docs/` and `test/`. Existing vocabulary is `stable | wobble | decay | snoozed`
(`types.ts:32`).

`rogue` means **"no longer in a working orbit."** It is entered either because the contact
does not respond (the per-contact reciprocity label) or because the user has not reached out
in far too long (a threshold beyond `decay`). The state describes the orbit; `reason`
records the cause, so the UI can still explain itself. Notification suppression applies to
both paths — by the time a contact is rogue, nagging has demonstrably not worked.

**This extends 01-data, it does not reverse it.** 01-data decided status is a *continuous
progress value* with `stable`/`wobble`/`decay` as presentation thresholds at 80% and 100%.
`rogue` is one more threshold over the same number, plus one non-time entry path. The model
is untouched.
**[REJECTED] `rogue` as the never-responds label only** — leaves `decay` covering both 40
days overdue and 400. **[REJECTED] `rogue` as a beyond-decay bucket only** — needs a second
invented word for the reciprocity label. **[REJECTED] Two separately-named concepts** — most
vocabulary to hold, and they can co-occur on one contact, which then needs a precedence rule.

**[OPEN → domain 9] The rogue threshold value** (what multiple of the interval, or what
absolute elapsed time, makes a contact rogue) is not settled here.

### Cluster C — The in-app logging flow

**[DECIDED] Instant log, optional refine.** One tap logs the touchpoint immediately with
everything defaulted; an "add detail" affordance on the resulting row opens channel, note,
direction and the date/time correction.
Rationale: this is the owner's stated primary workflow made literal — log it fast, fix it
tonight — and it confines the cost of Android's two-dialog date+time entry to the moments
the user actually wants it. Verified first-hand: **Android has no combined date+time
picker.** `@react-native-community/datetimepicker@9.1.0` defines `ANDROID_MODE` from the
common modes only, and `@expo/ui@57.0.10` states in its own source comment that Android has
no inline datetime picker and falls back to date-only — so `mode:'datetime'` silently
collects no time at all. Date *and* time is unavoidably two sequential dialogs.
**[REJECTED] A form every time** (the plugin's `UpdatePanel` shape) — puts a form in front of
the app's most-fired action. **[REJECTED] Two separate entry points everywhere** — every
surface carries two affordances for one concept, and you choose before you know which you
need.

**[DECIDED] The widget's two logging paths are split by widget size, which extends HANDOFF §6
without reversing it.** Small tiles keep §6 exactly as recorded — tap = quick mark, long-press
= deep link to the profile. The larger widget size shows **Quick mark** and **Log contact** as
two visible buttons.

> The owner initially recalled the widget tap as *not* being a logging event and proposed a
> tap-to-menu instead. §6 was quoted back verbatim (`Tap → one-tap preset action (primary:
> "mark contacted")`, with only *the exact set of preset actions* marked `[OPEN]`), along with
> 01-data's `[data → widget]` export. He chose this option, which **preserves the one-tap
> property on small tiles** and puts the second path on a surface that has room for it.
> Nothing recorded is reversed.

This also costs nothing new in layout terms: 03-fuel already committed the project to two
widget layouts by putting the fuel line only on the larger size.
His underlying objection is separately answered by the `unspecified` channel decision above —
a quick mark no longer has to guess "call", which was the specific thing that felt wrong.
**[REJECTED] A 2-item menu on every tile size** (⚠ would have changed §6's decided
`tap → action` into `tap → menu → action`); **[REJECTED] keeping §6 unchanged on both sizes.**

**[DECIDED] The decay notification's "mark contacted" action stays a genuine one-tap.**
A notification is already a deliberate context — the user is reading a card about that
specific person — so mis-taps are far less likely than on a home screen. Verified: the action
writes headlessly with no app launch (see Findings), so the reminder→action collapse HANDOFF
§6 exists to deliver survives intact.
**[REJECTED] Matching whatever the widget does** — buys almost nothing here and spends
interaction budget in the flow §6 most wants at one tap.

**[DECIDED] There is no undo affordance for a logged touchpoint. The history view is the
correction path.** A mis-tap is fixed by opening the contact and deleting the row.
Rationale: rows are already fully editable and deletable by decision, so the fix exists
without new machinery — and a timed undo is not merely inelegant here but **broken**. Verified
against Android's own documentation: cached app processes are frozen ~10 seconds after
entering the cached state and all their threads suspend, so a JS `setTimeout` undo window does
not fire once the user leaves the app — which is the *ordinary* case for a home-screen tap,
not an edge case.
**Consequence, recorded plainly:** this also settles that **deleting an interaction row is not
recoverable** — the owner was offered the `field_history`-style snapshot (HANDOFF §14.6's
pattern) for interactions and declined it. A deleted touchpoint is gone, and per HANDOFF §3
there is no server, no backup and no remote access. The blast radius is one row, usually
holding one date.
**[REJECTED] A persisted "recent activity" strip with undo on next app open**;
**[REJECTED] snapshotting deleted interaction rows.**

### Cluster D — Reading the log back

**[DECIDED] The contact profile carries a full scrollable timeline of every touchpoint,
newest first, each row editable and deletable in place.**
Rationale: this is not a nice-to-have, it is load-bearing for three decisions already taken —
it is the correction path for a mis-tap, the surface where a row is downgraded to "didn't
connect" after the fact, and the only place a synthesised import entry can be inspected. At
HANDOFF §10's scale a Monthly contact accrues ~12 rows a year, so the list stays short for
years. **This is entirely net-new product surface:** verified first-hand that the plugin's
`appendToInteractionLog` (`ContactManager.ts:182-217`) has exactly one call site
(`OrbitHubModal.ts:208`) and **zero readers** — nothing in the plugin has ever read its own
interaction log.
**[REJECTED] Last-N inline with a "show all" screen** — two surfaces instead of one.
**[REJECTED] Newest row only** — breaks as soon as two touchpoints accumulate since the one
you wanted to fix, which the log-fast-fix-later workflow makes routine.

**[DECIDED] The AI prompt receives interaction history as AGGREGATES ONLY. No note text from
an interaction row is ever transmitted.** Counts and cadence — e.g. "6 touchpoints in 90
days, last was a call" — computed by the app.

Rationale, and this is the decisive asymmetry: **an interaction row has no `off_limits`
analogue.** 03-fuel made off-limits fuel structurally never-transmitted and absent from the
placeholder resolver's search space; an interaction row carries one nullable free-text note
with no polarity field at all. Transmitting notes verbatim would route around the strongest
privacy control the AI seam has, for data that is *less* curated than fuel rather than more —
notes are written in a hurry, at the moment of logging. Aggregates are integers and enum
names the app derived, so this option adds **zero new third-party content egress** while
still letting the model distinguish a fading friendship from a steady one.
**[REJECTED] Notes verbatim in the prompt** — the largest quality gain and the sharpest
boundary; declined on privacy posture, which is explicitly the owner's call under CLAUDE.md.
**[REJECTED] Newest N rows as channel + date** — more disclosure than aggregates for largely
the same information, itemised. **[REJECTED] Nothing beyond today's baseline.**

**[DECIDED — later SUPERSEDED within this session by Cluster G] One statistic ships in v1:
actual versus intended cadence.** "Set to Monthly — actually every 47 days."

> ⚠ **Superseded, not reversed.** Cluster G's `intensity` absorbs this statistic as its
> long-run trailing view. The decision below still holds — exactly one cadence-shaped metric
> ships — it is simply now a component of `intensity` rather than a standalone stat. Read
> Cluster G for the live definition.
Rationale: it is the only stat that is *actionable* at HANDOFF §10's scale — it either tells
the user they are slipping or that the interval they chose was unrealistic, and the fix is one
tap on `interval_days`. Every other candidate is decoration when a Monthly contact has three
rows after two months.
**[REJECTED] Streaks** — argued against and declined: HANDOFF §1 promises *no-obligation*
check-ins and §6 blames friction for the plugin's abandonment, while a streak manufactures
obligation and creates a real incentive to log touchpoints that did not happen, corrupting the
log that every other feature reads. **[REJECTED] A fuller set** (counts, channel distribution,
longest gap) — vanity metrics at this scale. **[REJECTED] No statistics at all.**

**[DECIDED] `occurred_at` may be backdated without limit; a future `occurred_at` is rejected
at entry.**
Rationale: correcting history is the entire point of an editable row, but a future date is not
a fact — and in the plugin it is a silent trap: `daysSince` goes negative, so the contact
becomes permanently `stable` and drops out of every reminder with no error and no explanation.
One validation rule closes it.
**[REJECTED] Future dates as "planned contact"** — a different concept wearing the log's
clothes, and it collides with snooze, which already suppresses without pretending contact
happened. **[REJECTED] Bounding nothing** (the plugin's behaviour).

### Cluster F — Scope: no vault data migration

**[DECIDED — owner, cuts a domain] There is no Obsidian vault importer. Domain 5 (`import`)
is cut.** The owner was the plugin's only user, the vault stays on disk as reference, and the
app starts clean with contacts typed in by hand.

> **Two different "migrations", separated at the owner's insistence** — the distinction is his
> and it is the correct one:
>
> | | Status |
> |---|---|
> | **Data migration** — vault contact files → SQLite rows | **CUT** |
> | **Code porting** — plugin source → app source (HANDOFF §4, §15 first-move #2) | **UNTOUCHED.** Port whatever is equally or more effective in the app. |
>
> Only HANDOFF §15's first-move **#4** ("Write the importer that parses existing Obsidian
> markdown frontmatter into SQLite") is dropped. §4's port analysis and the extraction of
> `AiService.ts`, `calculateStatus()`, the schema types and `formatLocalDate()` are entirely
> unaffected.

**What this removes, recorded so nobody rebuilds it:** the reconciliation problem between a
frontmatter `last_contact` and contradictory log lines; every fabricated-import-row hazard
(the reason `source` was first argued to be mandatory); the re-runnability and import-dedupe
question; a hand-rolled parser that could never be tested against real-world variety; and
01-data's **F17** risk entirely — the importer was the "second, untrusted producer of
`col_name`" that HANDOFF §14 never anticipated, and it no longer exists. Whitelist
*construction* of `col_name` remains correct regardless, since the field editor is still a
producer.

**Constraints made moot:** `[data → import]` ×3 (01-data) and `[fuel → import]` (03-fuel).
The value `import` in both the fuel `source` enum and the interaction `source` enum becomes
vestigial and should be dropped from both.
**[REJECTED] Deferring the importer to post-v1** — leaves it on the roadmap as an obligation
while the schema drifts further from the vault's shape. **[REJECTED] A minimal contacts-only
import** — still a parser and a screen, to save typing eight people in once.

**[DECIDED] `source` stays on the interaction row**, with values `manual` · `widget` ·
`notification` · `ai`.
Rationale: its strongest justification (labelling synthesised import rows) died with the
importer, but the rest survives — it is the only way the timeline can distinguish a considered
entry from a one-tap, it keeps the cadence statistic honest, and 03-fuel already set the
precedent that AI-originated rows must be marked. Cannot be backfilled truthfully.
**[REJECTED] Dropping it.**

**[DECIDED] Non-touchpoint events go in a SEPARATE events table**, not in `interactions`.
Snooze, unsnooze, archive and restore are recorded there.
Rationale: `interactions` stays exactly what its name says, so no query on the recency path
can forget a type predicate — which is the failure mode 01-data's single-writer rule exists to
prevent. Repeated snoozing ("I've deferred Chris four times since March") is arguably the most
diagnostic signal a relationship CRM can surface, and the plugin records it nowhere:
`ContactCard.tsx:163-197` writes only the date and unsnooze *deletes* the key
(`:189`), so snooze history does not exist there at all.
**This resolves part of an item 01-data deferred** — "whether expired snoozes are retained as
history" — in the affirmative.
**[REJECTED] One table with an event-type column** — every query needs a predicate and one
omission silently corrupts recency. **[REJECTED] Recording nothing** — the history would
simply not exist to mine later.

**[DECIDED] Every interaction row carries a stable, globally-unique id, so a restore can MERGE
rather than only replace.**
Rationale: export is the *only* backstop against total loss (01-data cluster G:
`allowBackup="false"` plus deletion-on-uninstall), and a replace-only restore means recovering
from a three-month-old backup destroys three months of logging — on the very mechanism that
exists to prevent loss. Also the groundwork if the opt-in sync layer HANDOFF §3 kept open is
ever built.
**[REJECTED] Replace-only restore.**

**[DECIDED] Stable ids extend to every user-data table** — contacts, interactions, events,
fuel items, custom field defs and values, categories.
Rationale: merging interactions alone is incoherent, because an interaction belongs to a
contact and merged rows need something to attach to. This makes an export a portable document
rather than a snapshot that only fits back into the hole it came from. One column per table,
decided once, in migration 1.
**[REJECTED] Interactions and contacts only**; **[REJECTED] interactions only.**

**[DECIDED] The events table is read in v1: the profile timeline shows touchpoints and events
interleaved.** Separate storage, unified view. Events render read-only and visually distinct
("snoozed 1 month", "archived", "restored").
Rationale: the timeline already exists, so this is nearly free, and it puts "why does this
relationship look like this" in one place. It also avoids deliberately repeating the plugin's
central mistake — a log with zero readers, which is why the plugin's own interaction log was
useless.
**[REJECTED] A snooze count as the only consumer**; **[REJECTED] storing events with nothing
reading them in v1.**

**[DECIDED] A touchpoint records how it went: an optional 3-way marker (good / fine / hard),
in the full logging flow only.** One-tap routes leave it null.
Rationale (owner's call over the orchestrator's recommendation to omit it): it lets the digest
and the AI aggregates surface a relationship that has become effortful — a signal nothing else
in the schema carries. The orchestrator's argument against, recorded because it is the cost:
a rating turns logging a chat with your dad into an evaluation *of* your dad, which is a
heavier act than the premise wants, and such fields tend to quietly stop being filled in
honestly.
**[REJECTED] No quality field at all** (orchestrator's recommendation).

**[DECIDED] Nothing log-derived is added to the dashboard contact card.** It keeps avatar,
status ring, name, and 03-fuel's required one-line fuel preview.
Rationale: the status ring already encodes recency — that is what it is for — so a "12d ago"
string is largely redundant with it while competing for the one text row fuel already owns.
Leaves HANDOFF §12.4's layout design pass maximally free.
**[REJECTED] A recency string** (precedent exists in the plugin's own AI result header,
`AiResult.tsx:61`, which renders `category · Nd ago`); **[REJECTED] a channel glyph** — it
would read `unspecified` on most cards, since one-tap routes record no channel.

**[DECIDED] The quality marker rides along in the AI aggregates.** The prompt may say "recent
contacts have mostly gone well" / "…have been hard lately".
Rationale: it is an enum the app summarised, not text the user wrote, so it stays inside the
boundary drawn above — and tone is exactly where a suggested message most needs to change.
**[REJECTED] Keeping it strictly local to the profile and digest.**

**[DECIDED] The per-contact setting is labelled "Rarely responds."** Plain and descriptive,
obviously about them rather than about the user, and it reads naturally on a profile:
*"Rarely responds · attempts don't reset the orbit."* The **state** it can lead to is `rogue`;
the **setting** is "Rarely responds". Two names, two concepts, no collision with `status`.
**[REJECTED] "One-sided"** (characterises the relationship rather than the behaviour);
**[REJECTED] "Doesn't reciprocate"** (precise but formal and long); **[REJECTED] "Adrift"** —
stays in the space metaphor and pairs with `rogue`, but is evocative rather than descriptive
and would need a subtitle to explain what it does.

**[DECIDED] Times are stored as local wall-clock, as written.** "Called Dad at 7:45pm" reads
as 7:45pm forever, in any timezone, and DST is a non-event.
Rationale (owner's call): the log is a record of what the user did, not a scientific timeline.
Verified: SQLite has **no named-timezone support** — the complete modifier set is
`localtime`/`utc`/`auto` plus arithmetic — so any zone-aware rendering would have to happen in
TypeScript, where Hermes' timezone cache is independently known to be unreliable when the
device zone changes at runtime.
**Cost accepted and recorded:** rows sort by wall clock rather than by true instant, and
`contacts.last_contact` is a MAX over exactly these values — so touchpoints logged either side
of a flight can order oddly against one another. At a personal scale this is a curiosity, not
a corruption.
**[REJECTED] UTC with conversion on display** — ordering always exact, but a row hand-corrected
to "Aug 3, 7:45pm" in London renders as 2:45pm in New York and can shift to a different
calendar *day*, landing directly on the log-fast-fix-later workflow. **[REJECTED] Wall clock
plus captured offset** — best on paper, but for a hand-corrected row the offset records where
the user was when they typed, not when the event happened, so it is wrong by construction in
exactly the case it was added for.

### Cluster G — Impact and intensity

> **Added late in the session at the owner's request.** This is the concept that motivated
> turning the plugin into an app, and it had no home in any domain. Owner's premise: people
> are more graceful with you when you have a large pool of shared interactions — a small
> disagreement gets blown out of proportion when measured against a thin history, and the same
> disagreement lands softly for someone with a thick one. **Orbit status remains the product's
> number one concept; impact is a close second.**

**[DECIDED] The concept is TWO quantities, named `gravity` and `intensity`, presented together
and never blended into one score.**

| Quantity | What it is | Moves |
|---|---|---|
| **Gravity** | Accumulated familiarity — the grace buffer | Slowly, across the whole relationship |
| **Intensity** | This period's contact rate versus intended frequency | Weekly-ish |

**Naming is the owner's call**, taken over his own working title of "impact". `gravity` is the
force that literally holds an orbit — more shared history holds more strongly — and it pairs
with `rogue`, which is something that escaped it. It also survives next to `status`, `orbit`,
`decay` and `frequency` without collision, and it maps cleanly onto a visual (body size / ring
weight) if the orrery ever encodes it.
**[REJECTED] "Impact"** — the owner's working name; colloquially reads as *how much I affect
them*, rather than *how much history we have*. **[REJECTED] "History + Rate"** — plainest, but
"history" already means the interaction timeline throughout this dossier. **[REJECTED] "Mass"**
— technically the better physics (mass creates gravity) but reads oddly in a sentence about a
person.

Rationale: the owner's *examples* described a flow (5 contacts against a Weekly setting →
"getting annoying"; 2 → "way to go the extra mile") but his *motivation* described a stock (the
pool of history that buys grace). They can point in opposite directions for the same person on
the same day — someone contacted constantly for three years and then not for two months has a
large stock and a dead flow. Collapsing them leaves one motivation unserved.
**[REJECTED] A single blended score** — hides its inputs, so when it moves you cannot tell which
half moved, and the weighting becomes an arbitrary constant to fiddle with forever.
**[REJECTED] Stock only** (no brake on over-contact — the half the owner said needs a home);
**[REJECTED] flow only** (cannot express "we have twenty years of history", the motivating case).

**[DECIDED] Gravity decays with age, toward a floor rather than to zero.** Recent
interactions weigh more; old ones fade but never fully evaporate.
Rationale: a pure lifetime total only ever rises, so it stops being informative and cannot show
a relationship thinning — which is the signal wanted. A pure decay says a lapsed best friend is
a stranger, which is false. The floor means history already built is never entirely lost, but it
stops growing when you stop showing up.
**[REJECTED] Lifetime total, no decay**; **[REJECTED] a rolling window** — a hard cutoff drops
history off a cliff on an arbitrary date, and "we've known each other twenty years" becomes
inexpressible.

**[DECIDED] Intensity is displayed as a neutral rate, with no judgement.** "5× this week vs
Weekly intended" — stated as fact, conclusion left to the user.
Rationale: **frequency in this project is a FLOOR** ("reach out at least this often"), not a
ceiling. An app that scolds you for talking to your mother daily because you set her to Weekly
is wrong, and slightly insulting. The neutral rate delivers the visibility wanted with no risk
of the app being wrong about a real relationship.
**[REJECTED] A per-contact comfort ceiling** — another per-contact setting, guessed at precisely
for the people you know least well, who are the ones this matters for. **[REJECTED] Deriving the
threshold from `social_battery`** — that column describes *their effect on you*, not *their
tolerance for you*: the wrong axis wearing a convenient hat. **[REJECTED] A fixed multiple of
frequency** — one global constant governing every relationship.

**[DECIDED — REVISES a decision taken earlier in this same session] One-tap routes record
`direction = 'outbound'` rather than leaving it null.**

> ⚠ **This modifies Cluster A**, which read: *"Direction is a nullable column … asked only in
> the full logging flow. One-tap routes leave it null."* The nullable column survives and the
> full flow still asks; what changes is that widget and notification taps now write `outbound`
> instead of null.

Rationale: intensity must know that *you* reached out — if they texted you five times that is
not you being annoying — and direction was otherwise null on exactly the highest-volume paths,
starving the feature that motivated the app.
**Cost stated plainly:** this *is* a guess, and it is the same class of thing this dossier
criticised the plugin for (F3's silent `'call'` default). It is defensible only because tapping
"mark contacted" overwhelmingly does mean you reached out, and because it is correctable from
the timeline. If it proves wrong in practice, the rejected alternative below is a drop-in
replacement requiring no migration.
**[REJECTED] Storing null and having the impact calculation treat null as outbound** — keeps the
database strictly honest and confines the assumption to one documented place; rejected as more
subtle to explain, but retained here as the escape hatch. **[REJECTED] Impact ignoring
direction** — the "am I contacting too much" signal would fire when *they* are blowing up your
phone, inverting its meaning. **[REJECTED] Asking direction on the quick path** — a widget tile
physically cannot ask.

**[DECIDED] Intensity ABSORBS the actual-versus-intended cadence statistic decided earlier in
this session.** One quantity at two time horizons: intensity for the current period, and the
long-run average as its trailing view — *"Monthly intended · 47-day average · 2× this month."*
Rationale: two derived metrics over the same rows would sometimes tell contradictory stories,
which is precisely the drift 01-data avoided by making status one number.
**This supersedes the Cluster D cadence decision** rather than sitting beside it; that decision
is now the trailing half of this one.
**[REJECTED] Keeping cadence as a separate profile statistic.**

**[DECIDED] Gravity and intensity appear on the contact profile ONLY.**
Rationale: this **preserves** the Cluster D decision that nothing log-derived goes on the
dashboard card, and leaves HANDOFF §12.4's layout pass free. The owner was explicitly shown that
choosing otherwise would revise a decision taken hours earlier, and chose to preserve it.
**Cost accepted:** a concept billed as the product's number two is only visible when you go
looking for it — and the grace-buffer insight is arguably most useful *before* a difficult
conversation rather than during a browse.
**[REJECTED] A card encoding** (⚠ would have revised the card decision); **[REJECTED] a card
encoding plus an orrery dimension** — a screen already carrying radius, angle, colour and ring
style.

**[DECIDED] Gravity is expressed as named tiers with a bar, never as a raw number.**
Rationale, and it is a deliberate consistency check: streaks were rejected earlier in this
session because a climbing number manufactures obligation and creates an incentive to log
contact that did not happen — corrupting the log every other feature reads. A raw gravity score
has the same shape. **Coarse tiers are what makes gravity unlike a streak:** they do not move
for one more tap, so there is nothing to optimise. It still answers the only question being
asked of it — *do I have a buffer with this person* — without inviting gamification.
**[REJECTED] A raw 0–100 score** — the most gameable form. **[REJECTED] A plain phrase only** —
least gameable, most human, but not comparable across contacts, so you cannot scan for who is
thin.

**Confirmed to the owner so it is not rebuilt:** the "I reach out and they never respond" half of
his concern is already fully served by earlier decisions this session — the connected flag, the
"Rarely responds" setting, and `rogue`. His instinct that the under-contact side can lean on
orbit status is correct; it already does.

---

## Cross-domain constraints exported

- **[log → data]** Migration 1 must create `interactions` with: stable uid, `contact_id`,
  `occurred_at` (local wall-clock, editable), `recorded_at` (immutable), `channel`
  (`call`|`text`|`in-person`|`email`|`other`|`unspecified`), `direction`
  (`outbound`|`inbound`|`mutual`|null), a connected flag, `quality`
  (`good`|`fine`|`hard`|null), `note` (nullable), `source`
  (`manual`|`widget`|`notification`|`ai`). `recorded_at`, `source` and the uid **cannot be
  backfilled truthfully**.
- **[log → data]** A **separate `events` table** (snooze / unsnooze / archive / restore) ships
  in migration 1. It must never be unioned into the recency path.
- **[log → data]** `contacts` gains a **"Rarely responds"** flag. For those contacts,
  `last_contact` is MAX over a **filtered** set (connected rows only) — this *scopes* 01-data's
  single-writer recompute rule, it does not reverse it.
- **[log → data]** `rogue` is a **fourth status threshold** plus a non-time entry path, with a
  `reason` attribute. This **extends** 01-data's continuous-progress model; it reverses nothing.
- **[log → data / all domains]** **Every user-data table carries a stable, globally-unique id**
  — contacts, interactions, events, fuel, custom field defs and values, categories.
- **[log → notify]** `rogue` contacts fire **no decay notifications**; they get a non-nagging
  signal instead. The "mark contacted" action stays a genuine one-tap and **writes headlessly**.
  ⚠ **The background task path is gated to non-foreground** (`ExpoHandlingDelegate.kt:160`), so
  an action tapped while Orbit is open is **silently dropped** unless the ordinary response
  listener is also wired. Implement both, or double-write.
- **[log → widget]** Small tiles keep HANDOFF §6 exactly (tap = quick mark, long-press =
  profile); the **larger** tile shows *Quick mark* and *Log contact* as visible buttons. A
  widget tap is a **headless broadcast with a hardcoded 30-second budget**
  (`RNWidgetBackgroundTaskWorker.java`). ⚠ **Android 15+ force-stop cancels all PendingIntents
  and greys the widget** until the app is next launched — the widget can never be the only
  route into the log.
- **[log → orrery]** ⚠ **The owner introduced a new concept this run: the orrery needs TWO
  VIEWS** — a *relationship* view where radius is closeness and does not move with decay, and a
  *status* view where position tracks orbital state. This is his answer to 01-data's exported
  question about frequency losing its visual encoding. **No domain owns it yet.** Also open:
  the `rogue` threshold value and how `rogue` renders. **HANDOFF §7's [REJECTED] "floating free
  with no orbit lines" was NOT adopted** — `rogue` must stay on rails and stay tappable.
- **[log → dashboard]** Nothing log-derived is added to the contact card — **reaffirmed** when
  `gravity` was added and the owner declined a card encoding for it.
- **[log → data]** Two new derived quantities: **`gravity`** (age-decayed accumulated
  familiarity, with a floor) and **`intensity`** (this period's rate vs intended frequency,
  absorbing the cadence statistic). Both are **derived, never stored**, matching 01-data's rule
  for `status`. If either ever profiles as expensive, the answer is a cached column with a
  single writer — never a stored score that rots.
- **[log → data]** Gravity depends on `direction`, so **one-tap routes write
  `direction='outbound'`** (revises this dossier's own Cluster A). Gravity also depends on the
  connected flag, so the "Rarely responds" contacts feed it differently.
- **[log → orrery]** `gravity` maps naturally onto body size or ring weight and was
  **deliberately not** given an orrery encoding in v1 — recorded so domain 9 knows the option
  was considered and left open rather than overlooked.
- **[log → ai]** Interaction history reaches the prompt as **aggregates only** — counts,
  cadence, and the quality summary. **No interaction note text is ever transmitted**, because an
  interaction row has no `off_limits` analogue. The channel resolver must handle `unspecified`
  explicitly and tiebreak on `occurred_at DESC, id DESC`, or it rebuilds 01-data's F5 in new
  code.
- **[log → backup]** Export must include `interactions` **and** `events`. It must **not** restore
  `contacts.last_contact` as authoritative — it is stored-but-derived, and re-importing it over a
  differing row set leaves it asserting a date no row supports. Omit it, or recompute and let
  rows win. An export that loses interaction rows silently **relocates those contacts to the
  never-contacted screen**.
- **[log → crud]** Purge must `DELETE FROM interactions` **and** `events` explicitly in the same
  transaction — foreign keys are unconditionally off inside `withExclusiveTransactionAsync`, so
  `ON DELETE CASCADE` is decorative. 01-data named only the photo file and scheduled
  notifications.
- **[log → crud]** Answering the create form's "when did you last speak" **must insert an
  interaction row** — 01-data defines the never-contacted predicate as "equivalently, zero
  interaction rows", so a scalar-only write breaks it.
- **[log → INDEX]** **Domain 5 (`import`) is cut.** Four previously-exported constraints are
  moot, and the `import` value should be removed from both the fuel and interaction `source`
  enums.

---

## Deferred to phase discussion

- The `rogue` threshold — what multiple of the interval, or what elapsed time, and whether it
  is user-tunable.
- The exact form of the non-nagging `rogue` signal, and how many unanswered attempts precede it.
- How `rogue` renders on each surface (constrained: on rails, tappable — HANDOFF §7).
- The two orrery views the owner introduced: names, how you switch, which is default.
- Where the cadence statistic sits on the profile, and how it phrases an unrealistic interval.
- Timeline presentation: how events are visually distinguished from touchpoints, whether the
  quality marker is visible at a glance or only on opening a row.
- The shape of the "add detail" affordance on a just-logged row.
- Whether an archived contact's clock keeps running — 01-data ruled explicitly on snooze but
  not on archive. If it does, restoring lands the contact in instant deep decay.
- UI copy for the connected / didn't-connect distinction (avoid "failed").
- Whether the digest reads the quality marker (domain 14 also still owns keep/cut).
- **Gravity's decay half-life and its floor value** — both tunable constants, and per CLAUDE.md
  they sit at the top of their service file so tuning is a single-number edit.
- **Gravity's tier count, boundaries and names** (thin / building / solid / deep are
  placeholders), and how the bar renders.
- **Intensity's period** — rolling 7 days, calendar week, or one interval-length as set per
  contact. The last is probably right, since a Yearly contact has no meaningful "this week".
- How gravity and intensity sit together on the profile without reading as a scorecard.
- Whether gravity is ever surfaced *before* a difficult conversation, which is the use case that
  motivated it but which "profile only" does not directly serve.

---

## Deferred to phase planning

- Exact DDL for `interactions` and `events`; index on `(contact_id, occurred_at DESC)`.
- **`PRAGMA journal_mode = WAL` and a non-zero `busy_timeout` at bootstrap, before migrations.**
  Verified: `expo-sqlite@57.0.1` sets neither — zero hits for `journal_mode`/`WAL` across
  `src/`, `android/` and `ios/`.
- **A JS-level mutex around the single-writer DAO.** The headless widget/notification contexts
  share the app's JS runtime, process and SQLite connection, so a headless write landing inside
  a foreground `withTransactionAsync` is merged into it and rolled back with it.
- **Launch sweeps must be gated on a real foreground launch, not module scope.**
  `expo-task-manager` loads the JS bundle "as well as any side effects which may happen as a
  consequence of requiring any JS modules" (`registerTaskAsync.ts:14`), so CLAUDE.md's
  launch-time quarantine and history sweeps would otherwise run on every widget tap, inside a
  30-second budget.
- The filtered-MAX recompute for "Rarely responds" contacts, and its trigger points.
- `withExclusiveTransactionAsync` masks the original error the same way its sibling does
  (`SQLiteDatabase.ts:187-190`, verified) — needs a wrapper that preserves it.
- Chaining Android's two sequential date-then-time dialogs without losing the carried time.
- Wiring both notification response paths (foreground listener + background task) exactly once.
- Pushing a widget refresh on data change via `requestWidgetUpdate` rather than polling;
  `updatePeriodMillis` is clamped to a 30-minute floor by the library itself.
- On-device spike: whether the notification background task runs with no FCM /
  `google-services.json` present.

---

## Decisions made without you

Orchestrator's picks with no articulable divergence. **Read each as the decision AS ADOPTED.**
Veto any cheaply at review.

1. **A quick mark writes** `channel='unspecified'`, connected = true, `direction` = null,
   `quality` = null, `source` = `widget` or `notification`.
2. **`import` is dropped from both `source` enums** (fuel and interactions), following the
   domain-5 cut.
3. **`interactions` is indexed on `(contact_id, occurred_at DESC)`.** CLAUDE.md's index ban
   applies only to `contact_custom_values` columns.
4. **Interaction notes are plain text, not markdown** — mirrors 03-fuel's identical call for
   fuel text.
5. **Event rows are immutable.** Interactions are editable; events are a record of what the app
   did and are not hand-corrected.
6. **`recorded_at` is set from the device clock at insert and never changes.**
7. **The timeline orders by `occurred_at DESC`, tiebroken by `id DESC`.**
8. **Intensity ignores rows that did not connect** for "Rarely responds" contacts, matching the
   recency rule, so the metric and the status never disagree.
9. **`gravity` and `intensity` are derived at query time, never stored** — same reasoning
   01-data used for `status`: a stored score rots silently because no trigger fires on the
   passage of time.
10. **Both reach the AI prompt**, since they are aggregates and the aggregates channel is
    already decided. The gravity *tier name* is sent, not a number.

---

## Findings

Investigation 2026-08-12. The orchestrator read the plugin's full logging path on disk; five
subagents produced workpapers in `workpapers/04-log/`. **Every claim below was verified
first-hand against the file, package or documentation cited**, per CLAUDE.md — including
re-extracting `expo-sqlite@57.0.1`, `react-native-android-widget@0.22.0`,
`expo-notifications@57.0.10` and `@react-native-community/datetimepicker@9.1.0` from npm.

### F1 — The plugin's interaction log has one writer and zero readers

`appendToInteractionLog` (`ContactManager.ts:182-217`) has exactly one call site
(`OrbitHubModal.ts:208`) and nothing in `src/` reads it back. Confirmed by grep and by reading
every candidate consumer: `parseContact` reads frontmatter only, `calculateStatus` takes a date
and a frequency, and the weekly digest (`main.ts:294-356`) buckets on status and `lastContact`.
**Every history surface in this domain is therefore net-new product surface, not a port.** The
log's only human reader was Obsidian itself — and that read path dies with the vault.

### F2 — The log is sparse by design, and self-contradicting when backdated

The append is gated on a non-empty note (`OrbitHubModal.ts:206`), so the *cheap* paths — quick
action, note-less update — leave no record. And `appendToInteractionLog` stamps the line with
`formatLocalDate()` evaluated inside itself (`ContactManager.ts:188`); its signature has no date
parameter, so a backdated update writes the user's chosen date to frontmatter and today's date
to the log line. Every backdated entry contradicts itself on disk.

### F3 — The plugin asserts a channel the user never chose

`UpdatePanel.tsx:40` initialises the dropdown to `'call'` and `handleSubmit` passes it through
untouched (`:43-45`). Save without touching it and the app records "call". `ContactManager.ts:141`
separately writes `last_interaction = ''` at creation, which `AiService.ts:100`'s `??` does not
catch — so a new contact ships `Last interaction: <date> ()` to the model. This is the direct
argument for a first-class `unspecified` member.

### F4 — The vault's real log lines do not match the format the code writes

The writer emits `- ${date}: ${type}: ${note}` (two colons). An exhaustive grep of the plugin's
`docs/` and `test/` finds **six** human-authored log lines and **zero** in that shape — every one
is the one-colon, channel-free form (`docs/Updating and Editing.md:96-98`), and two bold the date
(`test/unit/services/ai-context.test.ts:42-43`). Channel recovery from a real vault was worth
approximately nothing. Also verified by reading `ContactManager.ts:212-213`: a multi-line note is
spliced as one array element and re-joined, producing continuation lines indistinguishable from
new entries. **Moot as of this run — the importer is cut — but recorded so it is not
rediscovered.**

### F5 — Both one-tap routes CAN write to SQLite with the app never foregrounded

Verified in the published packages, not from documentation alone:

- **Widget:** `RNWidget.java:208` builds click intents with `PendingIntent.getBroadcast`, not
  `getActivity`; `RNWidgetProvider.java` starts an Activity only for the two reserved strings
  `OPEN_APP`/`OPEN_URI` (`:54,:57,:126,:136`), so a custom action is headless by default.
  `RNWidgetBackgroundTaskWorker.java` configures `HeadlessJsTaskConfig("RNWidgetBackgroundTask",
  …, 30 * 1000, true)` — a **hardcoded 30-second budget**.
- **Notification:** `expo-notifications@57.0.10` documents it at `registerTaskAsync.ts:7`:
  *"Only on Android, the task also runs in response to a notification action tap when the app is
  backgrounded or terminated."* Gated at `ExpoHandlingDelegate.kt:160` to non-foreground responses
  with a non-default action identifier.

This is the opposite of the `expo-sms` constraint 03-fuel hit, and it is what makes the one-tap
promise real. **The hazard is not lock contention** — both contexts share the app's ReactHost,
process and `expo-sqlite` connection — **it is transaction capture**: a headless write landing
inside a foreground transaction is committed or rolled back with it.

### F6 — A timed undo is broken on Android 14+

Android's own documentation states that cached app processes are frozen 10 seconds after
entering the cached state, with all threads suspended. A JS `setTimeout` undo window therefore
does not fire once the user leaves the app — the ordinary case for a home-screen tap. This
removed an entire option class from the mis-tap question rather than merely disfavouring it.

### F7 — Android has no combined date+time picker

`@react-native-community/datetimepicker@9.1.0` defines `ANDROID_MODE` from the common modes
only — `datetime` is iOS-only. `@expo/ui@57.0.10` states in its own source comment that Android
has no inline datetime picker and falls back to date-only, so `mode:'datetime'` **silently
collects no time**. Correcting date *and* time is unavoidably two sequential dialogs, which is
why "instant log, optional refine" confines that cost to the moments it is wanted.

### F8 — `withExclusiveTransactionAsync` masks errors too

01-data's F15 recorded this defect for `withTransactionAsync` only. Verified in
`expo-sqlite@57.0.1`: the exclusive variant's `catch` awaits `ROLLBACK` **before** assigning
`error = e` (`SQLiteDatabase.ts:187-190`), so a throwing rollback still discards the original
error. **Extends F15; reverses nothing.** Also verified: `journal_mode` and `busy_timeout` are
never set anywhere in the package.

### F9 — SQLite has no named-timezone support

The complete modifier set is `localtime` / `utc` / `auto` plus arithmetic. Any zone-aware
rendering must happen in TypeScript. This is what made the time-storage question a genuine fork
rather than an implementation detail.

### Workpapers

- `workpapers/04-log/platform-onetap-write.md` — widget and notification headless write model
- `workpapers/04-log/platform-datetime-sqlite.md` — datetime entry, timezones, transaction APIs
- `workpapers/04-log/overlap-ai.md` — the `log` ↔ `ai` seam
- `workpapers/04-log/overlap-read-surfaces.md` — profile / dashboard / digest / orrery
- `workpapers/04-log/overlap-import-crud-backup.md` — the import, CRUD and export seams
  (largely superseded by the domain-5 cut; retained for its parse and export findings)
