# Workpaper — 04-`log` × read surfaces (profile · dashboard · digest · orrery)

Investigated 2026-08-12. Every claim below was verified by opening the cited file in
`~/projects/Orbit` and reading it in full, per CLAUDE.md "Review the code, not the diff."
Where `docs/*.md` in the plugin disagrees with the plugin's code, the code is taken as
authoritative and the drift is called out explicitly.

Upstream inputs read first: `docs/dossier/01-data.md`, `docs/dossier/03-fuel.md`,
`HANDOFF.md` §1, §6, §7, §10, §12, `CLAUDE.md`.

---

## 0. The established fact, re-verified

`appendToInteractionLog` is declared at `~/projects/Orbit/src/services/ContactManager.ts:182-217`.

- **One call site.** `~/projects/Orbit/src/modals/OrbitHubModal.ts:208-213`, inside
  `handleSave`, gated on `if (data.note)` at `:206`.
- **Zero readers.** Repo-wide grep for `appendToInteractionLog` / `Interaction Log` /
  `interactionLog` across `src/`, `test/` and `docs/` returns only: the writer, its one call
  site, the settings string `interactionLogHeading`
  (`~/projects/Orbit/src/settings.ts:25,58,187-198`), and the writer's own unit tests
  (`~/projects/Orbit/test/unit/services/contact-manager.test.ts:340-409`). Nothing parses the
  section back.
- **Git history agrees.** `git -C ~/projects/Orbit log --all -S"appendToInteractionLog" -- src/`
  returns exactly two commits — `00e3dbc` (Phase 2, the writer) and `14e781e` (Phase 4, the one
  call site). No reader was ever written and then deleted.
- **Never planned.** `~/projects/Orbit/docs/Feature Priority List.md` — grepped for
  log / history / timeline / stats / streak / cadence / average — contains no history-view item,
  no cadence-stats item, and no timeline item at any phase. The only unchecked item in the whole
  list is #27 Health Score (`:96`).

**Precision that strengthens rather than weakens this.** The log has zero *programmatic*
readers, but it is not unread by the *user*: the log lives in the contact's markdown note, and
clicking a card opens that note in Obsidian (`~/projects/Orbit/src/components/ContactCard.tsx:66-69`).
The vault note *is* the plugin's de-facto profile screen, and the user reads the log there by eye.
**That read path is precisely what does not survive the port** — there is no note, no editor, and
nothing to open. So every interaction-history read surface on mobile is net-new product surface
with nothing to port. Nothing in this workpaper may be described as "carried over."

Two structural properties of the plugin's log, both of which the mobile design already rejects:

- **Newest-first, appended at the top of the section** (`ContactManager.ts:212` splices at
  `headerLineIndex + 1`).
- **Channel is smuggled into the entry text**, not stored as a field:
  `OrbitHubModal.ts:207` builds `` `${data.interactionType}: ${data.note}` `` and hands the
  whole string to the writer. This is the same "structure smuggled into text" anti-pattern
  03-fuel rejected for fuel markdown (`03-fuel.md:466-468`). 01-data already fixes it by giving
  the interaction row its own channel column (`01-data.md:118-122`).
- **The log line's date is not the user's date.** `ContactManager.ts:188` stamps
  `formatLocalDate()` evaluated internally; the signature (`:182-187`) has no date parameter,
  while `OrbitHubModal.ts:201` writes the user's chosen `last_contact`. Every backdated entry
  contradicts itself on disk (01-data F4, re-verified here).

---

## 1. What each read-side component renders about recency today

Read in full: `ContactGrid.tsx`, `ContactPickerGrid.tsx`, `ContactCard.tsx`, `OrbitHeader.tsx`,
`BirthdayBanner.tsx`, `views/OrbitDashboard.tsx`, `views/OrbitView.tsx`, `components/AiResult.tsx`,
`components/UpdatePanel.tsx`, `main.ts:294-356`.

**Headline finding: the plugin renders a numeric recency string in exactly two places in the
entire UI, and neither is on the dashboard.**

Repo-wide grep for `daysSinceContact` / `daysUntilDue` / `lastContact` outside `types.ts`:

| Site | What it renders |
|---|---|
| `~/projects/Orbit/src/main.ts:308-313` | Digest only. `"${days} days ago"` for decay rows; a bare `YYYY-MM-DD` for contacted rows. |
| `~/projects/Orbit/src/components/AiResult.tsx:61` | AI result modal header. `` `${category} · ${daysSinceContact}d ago` ``, with `'Never contacted'` for `Infinity`. |
| `~/projects/Orbit/src/components/ContactPickerGrid.tsx:96-102` | Sorts on `daysSinceContact`. Renders nothing. |
| `~/projects/Orbit/src/services/AiService.ts:98-101,107,130` | Prompt text only, off-device. |
| `~/projects/Orbit/src/services/OrbitIndex.ts:344-385` | `Logger.debug` dump + state file. Not user-visible. |
| `~/projects/Orbit/src/services/LinkListener.ts:108-116` | Once-per-day dedupe guard. Renders nothing. |

Per-component detail:

**`ContactCard.tsx:266-304`** — renders an avatar (photo or initials fallback,
`:276-301`), a status ring via the class `orbit-avatar--${contact.status}` (`:238`), and the
name (`:303`). **Nothing else.** No date, no day count, no channel, no category badge. Recency
reaches the user *only* as a ring colour — a 3-way bucket. The right-click menu
(`:78-143`) offers mark-contacted / snooze 7 / snooze 30 / unsnooze / open note; `markAsContacted`
(`:146-161`) writes `last_contact` and nothing else — no log row, no channel.
*Doc drift:* `~/projects/Orbit/docs/Orbit Hub.md:21` documents a **category badge** on each card.
The code renders none. Already recorded as 01-data F7; re-verified.

**`ContactGrid.tsx:49-146`** — groups into three hardcoded category sections plus "Other"
(`:11-24`, `:102-113`), applies filter (`:57-61`) and sort (`:64-70`). Sort is `name` or a
`statusOrder` lookup `{decay:0, wobble:1, stable:2, snoozed:3}` (`:68`). **Nothing log-derived,
and nothing recency-derived beyond the 3-bucket status enum.**

**`OrbitHeader.tsx:34-55`** — verified: sort is exactly `{status, name}` (`:41-42`); filter is
exactly `{all, charger, decay}` (`:52-54`), where `charger` filters `socialBattery === "Charger"`
(`ContactGrid.tsx:57-58`) and `decay` means `status === "decay" || status === "wobble"`
(`ContactGrid.tsx:60`). **The task brief's "All / Chargers / Needs Attention" is confirmed
exactly.**
*Doc drift:* `~/projects/Orbit/docs/Sidebar View.md:37-40` documents a **category filter** and a
**battery-type filter** on the sidebar. Neither exists in `OrbitHeader.tsx`. Both are fully built
— on the *picker* (`ContactPickerGrid.tsx:122-163`). Already recorded as 03-fuel F10; re-verified.

**`ContactPickerGrid.tsx:38-189`** — the richest read surface in the plugin: search
(`:110-119`), category filter (`:123-132`), battery filter (`:134-143`), a 3-way sort
(`:145-153`: status / least-recent-first / most-recent-first), and a decaying-only toggle
(`:155-162`). The two recency sorts (`:96-102`) are the plugin's **only** recency-ordered
affordance, and they sort on `daysSinceContact`, i.e. on the `last_contact` scalar — **not on
history**.

**`BirthdayBanner.tsx:8-58`** — reads `contact.birthday` only (`:16`), 7-day window (`:19`).
Touches no recency and no log. Included for completeness: it is the only other banner-shaped
surface at the top of the dashboard, so it competes for the same vertical space any
"contacted this week" strip would want (`OrbitDashboard.tsx:33`).

**`views/OrbitDashboard.tsx:26-44` / `views/OrbitView.tsx`** — pure shells.
`OrbitDashboard` composes `BirthdayBanner` → `OrbitHeader` → `ContactGrid` (`:33-42`).
`OrbitView` is the Obsidian `ItemView` host (`:33-45`). **There is no orrery in the plugin at
all** — no canvas, no Skia, no animation loop; grep for `setInterval` / `registerInterval` across
`src/` returns **zero hits**. The orrery is 100% net-new (HANDOFF §7).

**What each would render if a real interaction history existed** — i.e. the net-new surface:

| Component | Today | With a real log |
|---|---|---|
| `ContactCard` | ring colour only | a recency line ("12d ago"), a channel glyph on the last touchpoint, a touchpoint count |
| `ContactGrid` | name / 3-bucket status sort | sort by continuous progress; sort by raw recency; filter "contacted this week"; filter by channel |
| `OrbitHeader` | 2 sorts × 3 filters | the above, plus a "this week: N touchpoints" counter |
| `ContactPickerGrid` | recency sort on the scalar | same sorts, but honest — and a "never logged a call" style filter |
| `BirthdayBanner` | birthdays only | competes with a week-activity strip for the same slot |
| profile | **does not exist** | the entire timeline / stats surface |
| digest (`main.ts:294-356`) | state snapshot | an actual activity record — see §5 |
| orrery | **does not exist** | trails / actual-vs-intended cadence — see §6 |

---

## 2. The profile history view

**There is no contact profile screen in the plugin.** The "profile" was the markdown note, opened
in Obsidian (`ContactCard.tsx:66-69`, `:125-141`). Everything here is net-new.

### 2a. The option set is narrower than it looks — "no history in v1" is not actually available

01-data already decided (`01-data.md:95-100`):

> **[DECIDED] Interaction rows are fully editable after the fact — including date and time —
> and those edits DO change status.** … Owner's workflow, verbatim: log the touchpoint quickly
> with no date so it auto-stamps now, then fix the date and time later that night or a day or
> two after. **This is a primary workflow, not an edge case.**

**You cannot edit a row you cannot see.** So the real fork is not "history view or no history
view"; it is:

| Option | Cost | Unlocks | Breaks when |
|---|---|---|---|
| **A. Edit-the-newest-row only** (a "fix that" affordance on the recency line, no list) | Smallest. One row, one form, no list virtualisation, no grouping, no empty state. | The owner's stated verbatim workflow, and only that. | You logged two touchpoints since the one you want to fix. Also: a mistaken *older* row is permanently uncorrectable, and 01-data's MAX-recompute rule (`01-data.md:102-108`) means a wrong old row silently distorts nothing *until* the newest row is deleted, at which point recency jumps to the wrong value. |
| **B. Last-N summary line** ("last 3: 12 Aug · 30 Jul · 14 Jul") | Small. One query with `LIMIT 3`, no scroll container. | A cadence *impression* without a screen. Nothing else — it is a display, not an editor, so it does not discharge the editability decision on its own. | The moment the user taps one expecting to edit it. |
| **C. Full scrollable timeline** | Largest. Needs a list, per-row edit + delete, an empty state, and a delete confirmation (delete recomputes MAX and can move status backwards — `01-data.md:102-108`). | Everything: edit any row, cadence legible at a glance, notes findable, the only place a note added later can be attached to the right touchpoint. | Nothing structurally. The cost is screen work, not correctness. |
| **D. Grouped by month** | C plus grouping headers. At the owner's cadence (Monthly ⇒ ~12 rows/year, `types.ts:19-27`) most groups hold **one row**, so headers outnumber content. | Legible density at Weekly/Daily frequencies only. | Immediately, for Monthly-and-slower contacts — which is most of HANDOFF §10's list. |

**Recommendation-shaped observation, not a decision:** D is dominated by C at this scale — group
headers per single row is worse than a flat list. A and C are the live fork, and A's breaking
condition ("you logged two touchpoints since") is common enough for a Weekly contact to be worth
naming to the owner explicitly.

### 2b. The dominant row shape is a bare date, and that is what makes the timeline hard to design

This is the finding most likely to change the decision. Three upstream decisions compound:

1. Every touchpoint from every route inserts a row, including widget and notification one-taps,
   where **the note is null and the channel may be unspecified** (`01-data.md:71-78`,
   `01-data.md:430-431`).
2. Fuel is never consumed automatically and there is **no post-log prompt** — 03-fuel explicitly
   rejected one because it "would break the interchangeability of touchpoint routes that 01-data
   deliberately established: the widget and notification one-taps cannot show a prompt at all"
   (`03-fuel.md:184-193`). So nothing ever nudges a note onto a one-tap row.
3. The create form asks when you last spoke (`01-data.md:140-145`). Under MAX-recompute
   (`01-data.md:102-108`) that answer must materialise as an interaction row or it is destroyed by
   the first insert — so **every contact's timeline begins with a note-less, channel-less row**.

Net: for a user who mostly taps the widget, **the majority of timeline rows carry a date and
nothing else.** Option C degenerates into a list of dates. The forks that follow:

- **Does the row show a time?** 01-data stores a local datetime, not a date
  (`01-data.md:112-116`), specifically because the owner wants to correct "the date and/or time."
  But status resolves at local midnight (`01-data.md:168-173`), so **time is stored, correctable,
  and load-bearing for nothing the user reads.** Showing it fills the row; hiding it makes the
  edit form offer a field the display never reflects. Fork: show always / show only when
  non-default / never show but keep editable.
- **Does the row show a source-of-entry** (widget / notification / in-app / import)? 03-fuel put
  `source` on the fuel row from migration 1 precisely because it cannot be backfilled truthfully
  (`03-fuel.md:328-329`). The interaction row has no equivalent decision recorded. If it is ever
  wanted — even only to explain *why* a row is bare — it is a migration-1 column, not a later
  addition. **This is the one schema question in this workpaper with a deadline.**
- **Does the channel default, or stay null?** The plugin's picker defaults to `'call'` with no
  "unspecified" option (`~/projects/Orbit/src/components/UpdatePanel.tsx:20-26,40`), so the
  plugin's channel data is confidently wrong whenever the user did not touch the dropdown.
  01-data introduced a genuinely-unspecified channel (`01-data.md:71-74`) — a state the plugin
  never had. Fork: default a channel (fills the timeline, lies) vs. leave it null (honest, mostly
  empty column, and every channel glyph needs an empty state). This one decision determines
  whether a channel icon is worth putting on a card or a row **at all**.
- **Minimum viable row:** date is the only guaranteed field. Everything else — time, channel,
  note, source — is optional or undecided.

### 2c. Import writes synthetic rows, and 01-data has not said so

`01-data.md:423-424` decided: *"Vault contacts with no `last_contact` import with it genuinely
empty and land on the never-contacted screen. Do not fabricate a touchpoint."* That covers the
NULL case only. For a vault contact **with** `last_contact: 2026-07-01`, MAX-recompute
(`01-data.md:102-108`) forces one of two outcomes:

- the importer writes an interaction row for that date (a real date, but a fabricated *event* —
  no note, no channel), or
- it writes `last_contact` with no row, and the first insert/edit/delete recomputes MAX and
  **destroys the imported recency**.

Only the first is safe, so imports produce synthetic rows. Consequence at this seam:
**every imported contact's timeline shows exactly one entry on day one, for someone the user has
known for years** — and every cadence statistic reads "1 touchpoint ever." This is unowned
between domains 4 and 5 and needs stating to the owner.

---

## 3. Derived statistics

### 3a. Schema and index cost is zero for all of them, so cost is not the discriminator

01-data already indexes `interactions` on `(contact_id, date DESC)` (`01-data.md:132-136`), and
CLAUDE.md's index ban applies only to `contact_custom_values`. At HANDOFF §10 scale — 7–8 active
contacts, "design for tens" — a Monthly contact generates ~12 rows/year (`types.ts:19-27`:
Monthly = 30 days). Ten contacts at mixed cadence over a year is a few hundred rows total. **Every
statistic below is a full-table scan in TypeScript costing microseconds.** No statistic here needs
a new column, a new index, or a materialised aggregate. Anyone arguing v1-vs-later on performance
grounds is arguing from the wrong axis.

The single exception: **per-channel counts require the channel to be reliably captured**, which
per §2b it will not be if channel stays nullable with no default.

### 3b. The honest discriminator is low-N, and it bites hardest at the moment of maximum curiosity

A gap statistic needs ≥2 rows to exist and ≥3 to be an average rather than a single measurement.
Under §2c, an imported contact has exactly 1 row on day one. A Monthly contact reaches 3 rows
after ~60 days of use. So for the first two months — the window in which a new user opens the
profile most — **every cadence stat is either absent or derived from one or two gaps and reads as
noise.** The design cost of a cadence stat is therefore mostly its empty/low-confidence state,
not its query.

### 3c. Which are vanity, measured against HANDOFF §1

HANDOFF §1: *"familiarity is a function of contact frequency, not depth per contact… measured
against 'does this reduce the number of taps between the reminder and the message actually being
sent.'"* Applying that test honestly:

| Statistic | Verdict | Reasoning |
|---|---|---|
| **Actual vs. intended cadence** ("set to Monthly, actually every 47 days") | **The one non-vanity stat.** | It is the only statistic that says something neither `last_contact` nor status can, and the only one that is *actionable*: it tells the user a field they control is set wrong, and the fix is one tap on `interval_days`. It also directly serves §1's premise, which is about frequency. |
| **Average gap between touchpoints** (bare) | Weak. | It is the above with the actionable half removed. On its own it duplicates what the interval setting and status already communicate, and it is the stat most damaged by low N. |
| **"3rd call this month" / per-channel counts** | Blocked, not merely weak. | Depends entirely on channel reliability (§2b). With a nullable, undefaulted channel most rows contribute nothing; with a defaulted channel the count is confidently wrong — the plugin's exact failure (`UpdatePanel.tsx:40`). Decide channel first; this is downstream of that, not a separate call. |
| **Streaks** ("8 weeks without missing") | **Actively counter-product, not just vanity.** | HANDOFF §6 opens: *"The Obsidian version fell out of use because capture was too high-friction."* HANDOFF §1 specifies "no-obligation check-ins." A streak manufactures obligation and converts a missed week into a punishment for exactly the behaviour the product exists not to punish. It is also the one statistic that creates an incentive to log a touchpoint that did not happen — which corrupts the log that everything else in this workpaper reads. |
| **"Contacted N people this week"** | Real, but it is a digest line, not a profile stat. | It is cross-contact by nature and has no home on a per-contact profile. See §5. |
| **Longest gap / "you once went 4 months"** | Vanity with a sting. | Retrospective guilt with no action attached. |

---

## 4. The dashboard seam

### 4a. Card budget

Verified card content today: avatar + ring + name, three DOM rows total
(`ContactCard.tsx:276-303`). 03-fuel then made a one-line fuel preview **required** on every card
(`03-fuel.md:263-275`, exported at `:408-409`). So the card is already avatar + name + fuel line
before any log content is considered, on a screen HANDOFF §12.4 records as the owner's to design
directly.

**Format precedent exists and is the owner's own.** The single place the plugin ever rendered
recency on a card-like surface is `AiResult.tsx:61`:
`` `${category} · ${daysSinceContact}d ago` ``. That is exactly the compact form a dashboard card
would want, and it already pairs recency with a second metadatum on one line. So "12d ago" is
net-new *on the dashboard* but not net-new as a chosen format.

What competes for the card's remaining space:

1. the required fuel line (03-fuel, non-negotiable);
2. a recency line ("12d ago");
3. a channel glyph — blocked behind §2b's channel-default decision;
4. a category badge, which `~/projects/Orbit/docs/Orbit Hub.md:21` documents and the code never
   rendered — a wish-list item, not a port;
5. a favourite/rank indicator (01-data made favourites ordered, `01-data.md:256-260`);
6. the continuous progress value, which 01-data records the owner as having declined to surface
   as a number or bar for now (`01-data.md:485`).

**The sharp point for the owner:** recency and the fuel line are the same kind of object — a short
metadata line under the name — so the honest choice is whether they are *one* line
(`"12d ago · saved: NYT piece on…"`) or two. One line makes the recency free but truncates the fuel
preview, which is the thing 03-fuel fought to put there. Two lines makes the card tall enough that
a grid becomes a list. This is a layout decision, and it is the owner's (HANDOFF §12.4).

**A card carries nothing log-derived that `last_contact` cannot already provide.** "12d ago" is
`last_contact` arithmetic. The *only* genuinely log-derived card content is a touchpoint count or
a last-channel glyph — and both are marginal at 10 contacts.

### 4b. Sorting and filtering

The plugin's set, verified: sort `{status, name}` (`OrbitHeader.tsx:41-42`), filter
`{all, charger, decay}` (`:52-54`). The picker additionally has recency sorts
(`ContactPickerGrid.tsx:145-153`) and category/battery filters (`:123-143`); 03-fuel F10 already
directs domain 8 to inherit from the picker, not the header.

**The log does not add a sort. 01-data's continuous progress value already did — and it splits
one existing control into two.** In the plugin, "by status" and "by recency" are nearly the same
thing because status is a 3-bucket enum. With a continuous progress value
(`01-data.md:152-157`), they diverge sharply: a Daily contact 3 days out is 300% of interval and a
Yearly contact 100 days out is 27%, so *urgency order* and *recency order* are different
orderings of the same list. The plugin's picker conflates them (`:96-102` sorts on
`daysSinceContact`, labelled "least/most recent first", while the default is labelled "by
status"). Fork for the owner: does the dashboard offer one ordering (urgency) or two (urgency and
raw recency), and which is the default?

**What the log genuinely unlocks that `last_contact` cannot** — all of it *filters*, none of it
sorts:

- "contacted this week" (needs an event count; MAX cannot count);
- "only ever texted / never called" (needs channel history);
- "touchpoints with a note attached" (needs the note column across rows).

**Honest assessment:** filters are a scale feature. At 7–15 contacts the user can see everyone on
one screen, and none of the three earns a control. They become real only under HANDOFF §8's
public-release scenario. Worth recording as "later, if scale" rather than deciding now — with the
caveat that a channel filter is *permanently* foreclosed if §2b lands on a defaulted channel,
because the data will be wrong rather than merely sparse.

---

## 5. The digest seam — what the log makes possible (keep/cut NOT decided here)

### 5a. What it does today, verified

`generateWeeklyDigest` is `~/projects/Orbit/src/main.ts:294-356` (the brief's "roughly 294-356"
is exact). Registered as a manual command at `:171-177`.

The bucketing loop is `:304-316`, and it is an **`if / else if / else if` chain**:

```
if      (status === "snoozed")                  → snoozed
else if (status === "decay")                    → overdue,  "(last: N days ago)" or "never"
else if (lastContact && lastContact >= weekAgo) → contacted, "(YYYY-MM-DD)"
```

Report assembly is `:318-339`; file write and open, `:341-355`.

**Three things follow directly from that being an else-if chain, and all three are invisible in
the documentation:**

1. **The "Contacted This Week" bucket is a leftover, not a record.** A contact you *did* reach
   this week but who is currently `decay` or `snoozed` is listed only under Needs Attention or
   Snoozed, never under Contacted. This is reachable, not hypothetical: a `Daily` contact
   (`types.ts:20`: interval 1) reached three days ago is `decay` by `calculateStatus`
   (`types.ts:112-122`) while `lastContact >= weekAgo` is true. The digest silently undercounts
   the user's own activity.
2. **`lastInteraction` (channel) is never read by the digest at all.** Grep confirms no
   `lastInteraction` in `main.ts`. The channel the user picked at `UpdatePanel.tsx:97-105` reaches
   the AI prompt (`AiService.ts:98-101`) and nothing else.
3. **Notes are never read.** The interaction log the user typed at `UpdatePanel.tsx:110-116` does
   not appear in the digest, because nothing reads the log (§0).

**Doc drift, called out per the brief.** `~/projects/Orbit/docs/Weekly Digest.md` states:
*"### Contacted this week — Contacts whose `last_contact` date falls within the past 7 days."*
That describes a pure date predicate. **The code does not do that** — the else-if chain excludes
decay and snoozed contacts first. Trust the code. Second drift: the same doc advises
*"**Run it weekly** as part of a Sunday review"*, and the feature is named "Weekly Digest"
(`:174`), but **nothing makes it weekly** — grep for `setInterval` / `registerInterval` /
`setTimeout` across `src/` returns zero scheduling hits. It is an on-demand snapshot with a
weekly-sounding name.

### 5b. The precise reframe

**Today's digest is a status snapshot wearing an activity report's name.** Every one of its three
buckets is a function of *current state* (`status`, and `last_contact` compared to a cut-off). It
cannot answer "what did I do this week," only "who is currently in what state, plus whichever of
them happens to have a recent date and no worse status."

Structurally impossible from a scalar, and only unlocked by a real log:

- **how many** touchpoints occurred (MAX yields at most one date per contact — reach someone three
  times this week and the digest shows one line, one date);
- **which channel** each was;
- **what was said** (the notes);
- **anyone contacted this week regardless of current status** — fixes the else-if defect at the
  root rather than by re-ordering branches;
- **distribution across the week** ("you reached nobody Tue–Thu");
- **any week but this one**, and therefore week-over-week comparison;
- **the actual-vs-intended cadence stat** from §3c, aggregated across contacts.

Two constraints the mobile port inherits regardless of the keep/cut outcome:

- **Nothing schedules it.** CLAUDE.md: *"Nothing watches a timestamp… sweeps run at app launch."*
  A genuinely weekly digest needs either a `expo-notifications` trigger (domain 11) or a
  launch-time check. The plugin's manual command is not a scheduler and never was.
- **Never-contacted contacts.** `~/projects/Orbit/docs/Weekly Digest.md` shows
  `- 🔴 College Friend (last: never)` and the code produces it (`main.ts:308-310`, `"never"` for
  `Infinity`). 01-data excludes never-contacted from the dashboard and orrery and gives them a
  dedicated screen (`01-data.md:183-190`). **The digest is the one surviving surface where the
  plugin listed them inline** — so if the digest ships, whether it inherits
  `WHERE last_contact IS NOT NULL` is an open call, exactly parallel to the one 03-fuel had to
  make explicitly for the capture picker (`03-fuel.md:382-384`).

Keep/cut remains HANDOFF open question #7 and belongs to domain 14. Not decided here.

---

## 6. The orrery seam

### 6a. What the log could add that `last_contact` cannot

HANDOFF §7 makes angular position a function of progress through the interval, and 01-data makes
that the same continuous value the dashboard uses (`01-data.md:152-157`). That needs
`last_contact` and `interval_days` only — **the orrery as specified does not read the log at all.**

Three candidates that genuinely require history:

1. **Trail marks** — faint static marks on a contact's ring at the angles where past touchpoints
   fell, i.e. a visible cadence record on the ring itself.
2. **Actual-vs-intended cadence as a ring property** — ring thickness, dash period, or a second
   ghost ring at the *observed* mean interval rather than the declared one.
3. **Touchpoint density as body size or glow** — how much contact this person actually gets.

### 6b. The performance constraint is real but is not the reason to say no

CLAUDE.md and HANDOFF §7 both forbid driving animation from React state; Skia runs its own loop
off the JS thread. **All three candidates are computable once and are static thereafter.** A past
touchpoint's angle does not change as time passes — only the *live* body moves. So the correct
rule, and it should be recorded as a constraint rather than debated as a decision:

> The orrery reads the interaction log **once**, into an immutable snapshot, at screen mount and
> on data change — never inside the Skia render loop, and never per frame. History contributes
> static geometry only.

At HANDOFF §10 scale one query returns a few hundred rows total. The risk CLAUDE.md warns about is
method, not volume (HANDOFF §7 says exactly this) — and the specific failure to guard against is
re-running the per-contact history query on every `useIsFocused` transition or every AppState
resume, which is cheap-looking and wrong for the same reason a per-frame join is wrong.

### 6c. The reason it might be a bad idea, and the reason it might not

**Against.** HANDOFF §7 calls the orbit view *"a glanceable overview, not the primary interface"*
and rejected differentiated per-band animation on the grounds that *"motion encodes data, not
mood"* and that it *"destroys positional information precisely for the contacts the user most
needs to find and act on."* Trail marks add no motion, so they do not hit that rejection directly
— but they do attack the same value from the other side: with 01-data's global `ring_seq`
(`01-data.md:291-310`) every contact has their own ring, so 10 contacts × ~12 touchpoints/year =
~120 static marks competing with 10 moving bodies on a screen whose entire job is being
glanceable. And §7's elliptical, wider-than-viewport orbits make angle-to-time **piecewise**, so a
trail mark's angular position is not linearly readable as elapsed time — the visual would imply a
precision the geometry does not support.

**For, and this is the cross-link worth putting in front of the owner.** 01-data's `ring_seq`
reversal explicitly left frequency with **no visual encoding on the orrery**, and exported the
question of whether it needs another one (`01-data.md:442-444`, `:479-480`). Candidate 2 —
*actual* cadence as a ring property — is a direct candidate answer to that exported question, and
a strictly better one than re-encoding the declared frequency: it encodes what the user actually
does rather than what they once configured, it is the same computation as §3c's one non-vanity
statistic, and it costs one static ring property rather than N marks per ring. If the orrery is to
recover a frequency encoding, "observed cadence" is the version worth considering, and it is the
only orrery use of the log with a real argument behind it.

---

## Summary of forks surfaced (none decided here)

1. History view: **edit-newest-row-only vs. full timeline**. "No history" is foreclosed by
   01-data's editability decision — you cannot edit a row you cannot see.
2. **`source` on the interaction row is a migration-1 column or it never exists** — 03-fuel took
   exactly this decision for fuel rows; the interaction row has no equivalent on record.
3. **Channel: default it or leave it null.** Decides whether channel glyphs, channel filters and
   per-channel counts are worth building at all. The plugin defaults to `'call'` and is
   confidently wrong.
4. **Import writes synthetic interaction rows**, unaddressed by 01-data's NULL-only rule. Day-one
   timelines and all cadence stats read "1 touchpoint ever."
5. **Card layout:** the required fuel line and a recency line are the same shape of object — one
   line or two. Owner's, per HANDOFF §12.4.
6. **Sort axes:** the continuous progress value splits "by status" into urgency-order and
   recency-order. One control or two, and which default.
7. **Statistics:** actual-vs-intended cadence is the only one that passes HANDOFF §1's test.
   Streaks are argued here as counter-product, not merely vanity.
8. **Digest (domain 14, not decided):** today's is a state snapshot, not an activity record; the
   log converts it into one. Whether it inherits `WHERE last_contact IS NOT NULL` is a live call.
9. **Orrery:** if history is read at all, it is a mount-time immutable snapshot, never per-frame.
   Observed cadence is a candidate answer to 01-data's exported "frequency has no visual
   encoding" question.
