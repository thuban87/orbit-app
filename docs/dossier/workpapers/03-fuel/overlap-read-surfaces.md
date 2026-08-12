# Workpaper 03-fuel — Where fuel is READ: dashboard, notification, widget, profile

**Scope.** The four surfaces that must *display* Conversational Fuel on mobile: the dashboard
(domain 8), the decay notification (domain 11), the home-screen widget (domain 12), and the
contact profile screen. Plus the never-contacted screen that `01-data` created and no domain
owns.

**Method.** Every plugin claim below was verified by opening the file at `~/projects/Orbit`.
Every platform claim below was verified by reading the **published** `expo-notifications`
package (`npm pack expo-notifications` → 57.0.10), not from documentation or memory.
Citations are `file:line` against `~/projects/Orbit` unless prefixed.

**Status.** Investigation only. Nothing here is decided. §9 is the owner question set.

---

## 0. The one-paragraph version

The plugin has exactly one fuel read surface and it is a hover tooltip, so **every mobile read
surface is net-new**. Three of the four new surfaces — the dashboard card, the notification,
and the widget — independently need the same thing the plugin never had: **one short line per
fuel item**. That single shared requirement is the strongest constraint on fuel's storage
shape, and it is a data decision, not a UI one. Separately, `HANDOFF.md:153` (`[DECIDED]`) is
**not implementable as literally written** — see §3.4, which is an escalation, not a finding.

---

## 1. What the plugin actually does — verified

### 1.1 One read surface, and it is impossible on a touch screen

`ContactCard.tsx:199-209` — `onMouseEnter` starts a 300 ms timer; `ContactCard.tsx:307-317`
portals `<FuelTooltip>` into `document.body` when it fires. `ContactCard.tsx:211-221` gives a
400 ms grace period so the pointer can travel into the tooltip. There is no touch equivalent
of any of that. The whole interaction is built out of pointer states Android does not have.

Size is hardcoded: `FuelTooltip.tsx:83` `tooltipWidth = 280`, `FuelTooltip.tsx:95`
`tooltipHeight = 300 // max-height`. At the plugin's own type sizes that is roughly 8–12
lines. **That is the plugin's entire fuel display budget**, and it was chosen for a desktop
sidebar next to a 1440 px-wide vault, not for a 411 dp phone.

### 1.2 There is no "does this person have fuel" affordance anywhere

`ContactCard.tsx:266-304` renders exactly three things: the photo (`:276-290`), an initials
fallback (`:293-301`), and the name (`:303`). No count, no dot, no badge. So the user hovers
blind and discovers emptiness — `FuelTooltip.tsx:119-140` renders *"No conversational fuel
found."*

On desktop that costs 300 ms. **On mobile it costs a deliberate gesture**, and whichever
gesture is chosen in §2 will be spent on nothing a large fraction of the time. Any read
surface decision therefore drags a **has-fuel indicator on the card** along with it.

### 1.3 Fuel is read-only in the plugin UI — there is no write surface at all

Grepped repo-wide for `fuel` (case-insensitive, `src/`): the only hits are `ContactCard.tsx`,
`FuelTooltip.tsx`, `types.ts:87-88`, `AiService.ts:26-34`, and the file template in
`ContactManager.ts:19-26`. **`src/modals/` has zero fuel references.** The Hub cannot edit
fuel. `UpdatePanel.tsx` — the "log a touchpoint" form — does not show or edit it either.

The only way to add fuel in the plugin is to open the note in Obsidian and type markdown under
`## Conversational Fuel`. That is precisely the friction `HANDOFF.md:145` blames for the
plugin falling out of use. Worth stating plainly to the owner: **the feature the product is
named around has never had a capture surface, and has been read-only its entire life.**

### 1.4 Fuel is not a flat list — it has internal structure, including a *do-not-say* section

`FuelTooltip.tsx:267-305` parses three line kinds: `listItem` (`:277`), `subheader` (a fully
bold line, `:288`), and `text` (`:295`). So the section is a small document, not an array.

The owner's own convention, from the test fixture that mimics a real contact file
(`test/unit/services/ai-context.test.ts:18-28`):

```markdown
## 🗣️ Conversational Fuel
**Last Thing We Talked About:**
- His startup DevPulse got into TechStars
- We debated Rust vs Go

**Safe Topics (Go-To):**
- Tech and programming
- Board games

**⛔ Off-Limits / Triggers:**
- His ex (messy breakup)
```

Three sub-kinds — *recent*, *safe*, **and *off-limits***. This is not incidental: the parser
carries hardcoded knowledge of that emoji at `FuelTooltip.tsx:272`
(`trimmed.replace(/⛔/g, "🚫")`).

**This is the single most decision-changing fact in this workpaper.** Fuel contains at least
one class of item that must *never* appear on a glanceable surface. "Off-limits: his ex
(messy breakup)" on a lock screen, or on a home-screen widget visible to a room, is the worst
possible failure of a product whose positioning is *"privacy is the product"*
(`HANDOFF.md:46`). A naive "show the top 3 fuel items" ranking will surface it eventually —
it sorts identically to every other item.

Consequence: either fuel rows carry a **kind**, or they carry a **glanceable** flag, and every
glance surface filters on it. A single free-text blob cannot express this at all.

### 1.5 The sibling sections exist and the AI prompt reads two of them

`AiService.ts:26-30` sends **both** `{{Conversational Fuel}}` **and** `{{Small Talk Data}}`;
`AiService.ts:34` names both again in the guidelines. The fixture also carries
`## 🎁 The Gift Locker` (`ai-context.test.ts:37`), and `docs/AI Features.md:83-89` documents
`{{Any Heading}}` as a supported placeholder.

So "fuel" as a mobile domain has a boundary question the INDEX does not raise: **are Small
Talk Data and Gift Locker fuel rows of a different kind, custom `textarea` fields (HANDOFF
§14), or dropped?** It matters here because the profile screen has to render all of them and
the notification has to *not* render most of them. Note `ContactManager.ts:19-26` — the
plugin's own default template — creates only `## Conversational Fuel` and
`## Interaction Log`, so the richer sections are the owner's personal convention, not a
shipped default.

### 1.6 Corrections to two things that look true and are not

- **No caching, despite the plan claiming it.** `docs/Feature Priority List.md:75` marks item
  22 *"[x] Caching — Store parsed 'Fuel' in memory to avoid repeated reads."* The code does
  the opposite: `FuelTooltip.tsx:45` calls `vault.read(contact.file)` inside an effect keyed
  on `[contact.file.path, plugin]` (`:76`), and the component is conditionally mounted per
  hover (`ContactCard.tsx:307`). **Every hover re-reads the whole file from disk.** On mobile
  the equivalent is a SQL round trip per gesture — cheap at this scale, but do not port the
  belief that a cache exists.
- **The dead `contact.fuel` branch is dead twice over.** Confirmed as established: never
  written by `parseContact`. It is also **never reached** — the fallback at
  `FuelTooltip.tsx:58-66` requires `useOrbitOptional()` to return null, i.e. rendering outside
  `OrbitProvider`, and both render paths wrap it (`views/OrbitDashboard.tsx:17-19` and
  `modals/OrbitHubModal.ts:361-363`). I checked this specifically because "the picker shows
  empty fuel" looked like a live bug; it is not. Do not report it as one.

---

## 2. Hypothesis 1 — replacing hover: the gesture budget is already oversubscribed

### 2.1 What is competing for the same gestures

A dashboard card has four available inputs: **tap**, **long-press**, **swipe** (×2
directions), and **a dedicated hit target drawn on the card**. Claimants, with citations:

| Claimant | Evidence | Notes |
|---|---|---|
| Open the profile | `ContactCard.tsx:60-70` — click opens the note | The only "more detail" route on a phone |
| Mark contacted | `01-data.md:71-78` — every touchpoint writes an interaction row; `INDEX.md:80-81` calls it "the single most-fired action" | Must be the cheapest gesture in the app |
| Quick actions (snooze 1w / 1m / unsnooze) | `ContactCard.tsx:81-141` — the right-click menu | Long-press is the only mobile analogue of right-click |
| **Glance at fuel** | this domain | Net-new |

Four claimants, and only tap and long-press are discoverable. **Fuel is the newest claimant
and the weakest, so on a naive assignment it loses and ends up profile-only** — which
recreates the plugin's failure mode: fuel you have to navigate to is fuel you never read.

### 2.2 A cross-surface collision the owner should be told about explicitly

`HANDOFF.md:161` assigns **widget** long-press to "deep link to that contact's profile."
If the **dashboard** card gives long-press to the quick-action menu or to fuel, then the same
gesture on two surfaces that render the same round photo tile means two different things.
That is not fatal, but it is the kind of thing that is free to decide now and expensive to
change after muscle memory forms.

### 2.3 The options, priced

| Option | Fuel items it can realistically show | Cost | Conflicts with |
|---|---|---|---|
| **Always-visible preview line on the card** | **1**, ~35–45 chars | Card grows; forces a ranking rule and a short form | Nothing — no gesture spent. Only option that works *while scrolling* |
| **Long-press → popover** (closest to the plugin) | 6–10 | Long-press is slow (~500 ms) and undiscoverable; needs a has-fuel badge (§1.2) or it opens empty | Quick-actions menu; widget long-press semantics (§2.2) |
| **Long-press → bottom sheet** | 10+, scrollable = unbounded | Modal: you must dismiss it before looking at the next person. Kills the "scan the list" use case | Same as above |
| **Tap-to-expand accordion inline** | 3–5 | Reflows the list; **hostile to a grid of round avatars**, which is the layout `HANDOFF.md:173` and `:181` implies | Tap = open profile |
| **Card back face (flip)** | 4–6 | Charming, and it fits the space theme; but it needs a gesture *and* an animation budget, and it hides the avatar/status ring while flipped | Tap; Skia render loop ownership |
| **Swipe on the card** | n/a (swipe reveals an action, not content) | Swipe is better spent on mark-contacted — a one-way action with a natural "swipe it away" reading | List scroll (vertical) is fine; horizontal is free |
| **Profile only** | unbounded | Zero cost, zero conflict — and zero glanceability. This is the plugin's failure repeated | — |
| **Dedicated affordance drawn on the card** (a small fuel chip showing count + first item) | 1 line + tap target | Costs card real estate; but it *is* the has-fuel indicator §1.2 demands, and it is self-labelling | Card layout density |

**The shape of the answer this table suggests:** the *glance* is a one-line preview drawn on
the card (no gesture), and the *full read* is the profile screen (or a sheet reached from the
preview). Long-press stays with the quick actions, matching `ContactCard.tsx:81-141` and
leaving the mark-contacted path cheapest. That is a recommendation, not a decision — but it is
the only assignment where all four claimants in §2.1 get something.

### 2.4 Whichever wins, it forces the same data question

Every option except "profile only" and "bottom sheet" has to answer: **which item shows, and
in what form?** That is §4 and §5, and it is where this domain's real decisions are.

---

## 3. Hypothesis 2 — the notification is the sharpest constraint

### 3.1 Platform facts, verified against the published package

Read from `expo-notifications@57.0.10` (`npm pack`, extracted to scratchpad). Paths below are
inside that tarball; a separate agent is verifying the platform API surface independently and
should be able to reproduce all of this.

1. **There is exactly one expandable text region, and no way to choose a style.**
   `android/src/main/java/…/presentation/builders/ExpoNotificationBuilder.kt:109`:
   ```kotlin
   builder.setStyle(NotificationCompat.BigTextStyle().bigText(content.text))
   ```
   This is unconditional — no branch, no option. **`InboxStyle` is unreachable**, so
   per-line structure (`addLine` × N) is impossible through expo-notifications.
2. **Three text slots, and their JS names are misleading.**
   `android/src/main/java/…/ArgumentsNotificationContentBuilder.java:20-23` +
   `ExpoNotificationBuilder.kt:104-109`:
   | JS field | Android call | Where it renders |
   |---|---|---|
   | `title` | `setContentTitle` | Bold first line |
   | `subtitle` | `setSubText` | Small text in the *header* row, next to the app name |
   | `body` | `setContentText` **and** `bigText` | The one-line collapsed body **and** the expanded block |
   | `data` | notification extras (JSON) | Not rendered — this is the payload channel |
3. **Action buttons come from a pre-registered category**, read from a SharedPreferences store
   at build time (`ExpoNotificationBuilder.kt:39-73`). Buttons are declared by
   `setNotificationCategoryAsync`, not per notification. Labels are therefore *static per
   category* unless you register a throwaway category per contact — possible, but it leaves
   persisted junk to clean up.
4. **Text input from the notification shade is possible.**
   `ExpoNotificationBuilder.kt:82-90` builds a `RemoteInput` action; the JS surface is
   `NotificationAction.textInput` (`build/Notifications.types.d.ts:625-647`) and the typed
   result comes back as `NotificationResponse.userText`
   (`build/Notifications.types.d.ts:601-604`).
5. **Lock-screen visibility is per-channel and settable**:
   `lockscreenVisibility: AndroidNotificationVisibility`
   (`build/NotificationChannelManager.types.d.ts:78`).

Not verified here, flagged for the platform agent: the exact number of `BigTextStyle` lines
Android renders before truncating (commonly quoted as ~5–6, and shade-height dependent), the
5120-char `CharSequence` cap, and the 3-action display limit. **Every design consequence below
holds under any plausible value of those**, because they all reduce to "a handful of short
lines, one line when collapsed."

### 3.2 What that forces on fuel's shape

- **Fuel must be flattenable into one string with `\n`s.** Not a list the platform renders —
  a string *you* assemble. Structure (§1.4's subheaders) survives only as characters you type
  into that string.
- **The collapsed notification shows one line.** Most decay notifications will never be
  expanded. So the design must assume the user sees: `title` (the name), `subtitle` (a short
  header word), and **one line of body**. If fuel is to be visible at the moment that matters,
  **the product needs exactly one great fuel line**, and everything beyond it is a bonus for
  users who expand.
- **Ranking is therefore mandatory and is a data decision.** With one to five slots, "which
  items" is not a rendering detail — it is a query, and the columns it needs must exist in the
  schema.

### 3.3 The frozen-content problem — the constraint nobody has named yet

`expo-notifications` schedules a local notification with **fixed content, resolved at schedule
time**. There is no fire-time callback that can rewrite the body (that is exactly the
scheduler/daemon that `HANDOFF.md:391` and `CLAUDE.md` say does not exist on this platform).

So a decay notification scheduled today, firing in 12 days, carries **today's** fuel. If the
user shares three articles to that contact next week, the notification still shows the stale
top item. Consequences, all of which change decisions:

- **Every fuel write must reschedule that contact's pending notifications.** Insert, delete,
  edit, pin, and mark-used all become notification-invalidating operations. That is a
  cross-domain rule (`fuel` → `notify`) that has to be written down or it will be missed.
- It also means a **denormalized per-contact "glance line"** is worth considering: one derived
  string, recomputed on fuel write, read by the notification scheduler *and* by the widget
  updater (§4) *and* by the dashboard card preview (§2.3). One projection, three consumers,
  one invalidation rule. The alternative is three places independently re-implementing the
  ranking, which is exactly the drift `01-data.md:158-162` rejected for status.
- Alternatively: **do not schedule ahead.** Compute decay at launch and post notifications
  immediately (the launch-sweep pattern `01-data.md` already uses for quarantine). Then the
  content is always fresh — but the app must have been opened, which defeats the point of the
  reminder. This is a genuine `notify` decision that fuel's staleness materially affects.

### 3.4 ESCALATION — `HANDOFF.md:153` is not implementable as written

> *"A decay notification must carry a direct action that opens the SMS composer for that
> contact, with their Conversational Fuel visible. Reminder and action collapse into one tap."*
> — `HANDOFF.md:153`, tagged `[DECIDED]`

Read literally, "with their Conversational Fuel visible" attaches to the SMS composer. **You
cannot render your app's content over another app's activity on Android** without
`SYSTEM_ALERT_WINDOW` — a scary runtime permission with Play policy scrutiny, and
`01-data.md:247-251` already declined `READ_CONTACTS` on exactly that
security-and-positioning ground (an owner-bucket call per `CLAUDE.md`). Three readings survive:

| Reading | Taps | Verdict |
|---|---|---|
| **(a)** Fuel is in the notification body; the action opens the composer with an empty draft | 1 | The only one satisfying both halves of `:153`. Forces §3.2 and §3.3 |
| **(b)** Fuel is prefilled *into the SMS draft* | 1 | **Reject.** It is text you must delete before sending, and one slip sends your private notes about someone to that someone — including §1.4's off-limits line |
| **(c)** The action opens Orbit's contact screen (fuel + a Text button) | 2 | Breaks "collapse into one tap"; but it is the only reading where fuel is scrollable and always fresh |

This does not reverse `§6` — it is the same decision, made precise. But it *does* pick between
readings that have very different costs, and per `CLAUDE.md` "whose decision is it," the
owner picks. Recommend (a), with (c) as the long-press / expanded-view fallback.

### 3.5 The ranking rule — the actual data decision

Candidates, each priced by the schema it requires:

| Rule | Query | New columns | What it gets wrong |
|---|---|---|---|
| **Newest N** | `ORDER BY created_at DESC LIMIT n` | none (`created_at` needed anyway) | An important item captured 6 months ago is permanently invisible; and the newest items are the ones you most recently *thought about*, so likely already discussed |
| **Unused first** | `WHERE used_at IS NULL ORDER BY created_at DESC` | `used_at` (nullable) | Needs a "mark used" affordance, i.e. a new write surface. But it is the only rule that models fuel as *consumed*, which is what the word means |
| **Pinned first** | `ORDER BY pinned_at DESC NULLS LAST, created_at DESC` | `pinned_at` | User-curated, so it is right by construction — but it is manual work, and this product's entire thesis is that manual work does not happen (`HANDOFF.md:145`) |
| **Shortest** | `ORDER BY length(text)` | none | Optimises for the display constraint rather than for the human. Reject |
| **Glanceable only** (a filter, not an order) | `WHERE kind <> 'off_limits'` | `kind` or `is_glanceable` | **Not optional** — see §1.4 |

The combination that costs two nullable columns and covers all three surfaces:
**`WHERE is_glanceable AND used_at IS NULL ORDER BY pinned_at DESC NULLS LAST, created_at DESC`.**

Both `pinned_at` and `used_at` are cheap to add later (they are nullable columns on a table
that will exist), so unlike `created_at`/`ring_seq` in `01-data.md:496-498` there is **no
"impossible later" argument** forcing them into migration 1. The one that *is* hard to
retrofit is `kind` / `is_glanceable`, because retrofitting it means asking the user to
re-classify every existing row — and the importer is what populates it from the vault's
`**⛔ Off-Limits / Triggers:**` subheaders. **If the importer is going to read that structure
at all, the column has to exist when the importer first runs.**

---

## 4. Hypothesis 3 — the widget

`HANDOFF.md:157-161` and `CLAUDE.md`: `react-native-android-widget`, `RemoteViews`, custom
dev client, **text input impossible**. Display is not impossible, so the question is real.

**Can fuel appear on a widget? Yes, but only in the stretch state, and it inherits every
constraint above plus two more.**

1. **Space.** `HANDOFF.md:161` fixes the primary widget as *a grid of favourite contacts*. A
   4×2 home-screen cell holding 4–6 tiles gives each tile a photo, a name, and — at best — one
   line of ~15–20 characters. That is not a fuel item; that is a fragment of one. Fuel does not
   fit on the favourites grid. It fits only in the **stretch goal** at `HANDOFF.md:161`
   ("tapping to swap the widget into a profile view"), where one contact owns the whole area.
2. **Staleness, worse than §3.3.** `RemoteViews` only change when the app pushes an update.
   A widget showing fuel is a cache with no invalidation unless every fuel write pushes a
   widget update. Same rule as the notification, same argument for one shared glance
   projection (§3.3).
3. **Exposure, worse than the lock screen.** A notification is transient and can be hidden by
   channel `lockscreenVisibility` (§3.1.5). A home screen is *persistently* visible to anyone
   in the room. `01-data.md:252-253` already flags phone/email as third-party PII at rest;
   fuel is third-party PII **on display**. §1.4's off-limits filter is not sufficient here —
   even a benign item ("his divorce is final") is not something to leave on a home screen.

**Design consequence:** if fuel goes on the widget at all, it needs the short "headline" form
(same one the notification and the card preview need) **and** a separate, stricter opt-in than
the notification's. Recommended default: no fuel on the widget; revisit with the stretch
profile state.

---

## 5. Hypothesis 4 — ordering and volume

### 5.1 How much accumulates

`HANDOFF.md:245` fixes the working set at 7–8 active contacts. Share-sheet capture is designed
to be near-zero friction (`HANDOFF.md:149`), so the realistic ceiling is "how often do I see
something that reminds me of someone." A defensible range: 2–4 captures per week across all
contacts → **100–200 items/year total**, skewed hard: 40–60 on the top contact (Mom, best
friend), 5–10 on the tail. **So the design point at year one is ~50 items on the heaviest
contact and ~10 on a typical one.** Fifty is not a scale problem for SQLite; it is a *human*
problem.

### 5.2 What breaks at 50 items with no ordering

- **The profile screen becomes a landfill.** Fifty undifferentiated lines with no notion of
  used/unused is a to-read pile, and to-read piles get abandoned. The plugin's own fuel
  section had structure precisely to fight this (§1.4) — flattening to a bare list is a
  regression, not a simplification.
- **"Newest 3" degenerates.** With 50 items, the top of the list is always last week's three
  links, which are the three you have most likely already sent. The notification says the same
  thing every time until you share something new.
- **Nothing is ever consumed.** There is no state transition in the plugin's model — fuel is
  written and read forever. Without `used_at` (or deletion), an item you discussed in March
  reappears in December. This is the strongest argument for a consumption model, and it wants
  a cheap affordance: e.g. logging an interaction offers "which of these did you talk about?"
  — which also ties fuel to the `log` domain (`01-data.md:71-78`).
- **Retention/deletion has no owner.** Fuel is the only user content with no lifecycle
  decision recorded anywhere. Archive-on-use? Manual delete? Never delete? Note that
  `01-data.md:82-88` already decided **purge destroys everything the contact owns** — fuel
  included — so contact-level deletion is settled; item-level is not.

### 5.3 Explicit ordering vs pinning vs recency

Recency is free and is the right default. Pinning is the only thing that lets an evergreen
item ("always ask about the dog") stay visible — and evergreen items are exactly what "Safe
Topics (Go-To)" was in the vault (`ai-context.test.ts:23-25`). **Manual drag-ordering is not
worth it**: it is the highest-effort curation model on the smallest screen, and the pinned +
used-at pair covers the same intent for two nullable columns.

---

## 6. Hypothesis 5 — the never-contacted screen

`01-data.md:183-190` `[DECIDED]`: never-contacted contacts are excluded from dashboard and
orrery (`WHERE last_contact IS NOT NULL`) and get **their own screen**, which
`INDEX.md:57-58` notes no domain owns.

Three consequences land squarely on fuel:

1. **Yes, you can capture fuel for someone you have never contacted — and it is the most
   valuable case there is.** You met them once; you have no history; the *only* reason to
   reach out is the thing you saved. So the share-sheet contact picker (domain 10) **must not
   inherit the dashboard's `WHERE last_contact IS NOT NULL` predicate.** That predicate is
   going to get copy-pasted into the picker query by default, and it would silently make the
   highest-value capture target unreachable. Write it down as a constraint.
2. **The never-contacted screen is the screen that most needs fuel visible**, because it has
   nothing else to show — no last-contact date, no status colour, no progress. A card there is
   a name and a photo unless fuel fills it. Whatever glance treatment §2 picks for the
   dashboard, this screen probably needs a *stronger* one.
3. **Fuel captured for a never-contacted person can never surface via the notification.**
   `01-data.md:450`: never-contacted contacts fire no decay notifications, because they have
   no progress value. So for exactly the people whose fuel matters most, the notification path
   is dead and the only read surface is a screen the user must deliberately visit. That is a
   real gap and it may be an argument for a different nudge on that screen (out of scope here,
   but it belongs to whoever ends up owning it).

---

## 7. Hypothesis 6 — `Sidebar View.md` versus the code, with line numbers

Trust the code (`CLAUDE.md`). The drift is real, and its *shape* is more informative than its
existence: **the doc is not hallucinating — it is describing a different component.**

### 7.1 Sort — accurate, one omission

`Sidebar View.md:28-31` claims Status and Name. `OrbitHeader.tsx:41-42` offers exactly
`"⚡ By Status"` and `"🔤 By Name"`; `ContactGrid.tsx:64-70` implements both. The doc's Status
description ("Decaying first, then wobble, then stable") omits the fourth rank —
`ContactGrid.tsx:68` is `{ decay: 0, wobble: 1, stable: 2, snoozed: 3 }`. Minor.

### 7.2 Filter — wrong on both rows

`Sidebar View.md:37-40` claims two filters:

| Doc claim | Reality |
|---|---|
| **Category** — "Show only Family, Friends, Work, etc." | **Does not exist** in the sidebar. `OrbitHeader.tsx:46-55` has no category control |
| **Battery type** — "Show only Charger, Neutral, or Drain" | **1-way, not 3-way.** `OrbitHeader.tsx:53` offers only `"🔋 Chargers Only"`; `ContactGrid.tsx:57-58` filters `socialBattery === "Charger"`. Neutral and Drain are not selectable |

And the doc **omits the filter that does exist**: `OrbitHeader.tsx:54` `"🔴 Needs Attention"`,
implemented at `ContactGrid.tsx:59-61` as `status === "decay" || status === "wobble"`.

### 7.3 Where the doc's claims are actually true — `ContactPickerGrid.tsx`

Both missing filters exist, fully built, in the **picker modal**:

- Category dropdown, options derived dynamically from the data:
  `ContactPickerGrid.tsx:46-52` (extraction) and `:123-132` (control); applied at `:81-86`.
- Battery dropdown, **all three values**, likewise dynamic: `:55-61` and `:134-143`; applied
  at `:88-91`.
- Plus two more the sidebar lacks: **search by name** (`:110-119`, applied `:66-72`) and
  **sort by last contacted, both directions** (`:145-153`, applied `:96-102`).
- Plus a "Decaying only" toggle (`:155-162`) that duplicates the sidebar's "Needs Attention".

**The precise diagnosis: `Sidebar View.md` documents `ContactPickerGrid`'s filter set as
though it were `OrbitHeader`'s.** Per `INDEX.md:136-137`, domain 8 was already told to read
this drift as a wish list — this sharpens it considerably. **The owner already built the
richer control set once; it just landed on the modal instead of the main screen.** Porting
the picker's controls to the mobile dashboard is closing a gap the owner has already
expressed twice (once in code, once in docs), not inventing a feature.

### 7.4 Other drift in the same doc

- **Grouping is undocumented.** `ContactGrid.tsx:11-24` groups contacts into
  "Family & Friends" / "Community & Professional" / "Service" / "Other" sections
  (`:117-143`). `Sidebar View.md` never mentions sections at all — it describes category as a
  *filter* that does not exist while ignoring the category *grouping* that does.
- **Quick actions under-documented.** `Sidebar View.md:52-57` lists three items. The code has
  six: mark contacted (`ContactCard.tsx:81-88`), snooze 1 week (`:93-100`), **snooze 1 month**
  (`:102-109`), **unsnooze** (conditional, `:111-120`), open note (`:125-132`), **open in new
  tab** (`:134-141`).
- **Header controls omitted:** the contact count (`OrbitHeader.tsx:28-31`) and the refresh
  button (`:58-64`).
- **The fuel line is right but incomplete.** `Sidebar View.md:20-22` describes the hover
  tooltip correctly and mentions neither the 300 ms delay (`ContactCard.tsx:206-208`) nor that
  it re-reads the file every time (§1.6).

Net for domain 8: the dashboard's operational skeleton should be built from
**`ContactPickerGrid.tsx` + `Sidebar View.md`'s wish list**, not from `OrbitHeader.tsx`.

---

## 8. The convergence: one glance line, three consumers

Independently derived above, and worth stating as one claim:

- §2.3 — the only dashboard treatment that survives "glance while scrolling" is a **one-line
  preview on the card**.
- §3.2 — the collapsed notification shows **one line** of body, and expanded shows a handful.
- §4 — a widget tile has room for **one short line**, if anything.

All three want *the same string*: a short, glance-safe headline for the top-ranked fuel item.
That produces three concrete, decision-changing requirements on fuel's storage (domain 3's
own seam, but the read side is what forces them):

1. **Fuel is per-item rows, not one text blob.** A blob cannot be ranked, cannot be filtered
   for glance-safety, and cannot be truncated without cutting mid-sentence.
2. **Each item needs a short display form.** A shared URL's natural headline is the page
   title, which is often 60–90 characters — already too long for a widget tile and marginal
   for a collapsed notification. So either capture constrains length, or every item stores a
   separate short label, or every glance surface truncates and accepts it.
3. **A shared projection beats three re-implementations.** One derived per-contact glance
   line, invalidated on every fuel write, read by the card, the notification scheduler and the
   widget updater. Same argument `01-data.md:158-162` used to make status one number.

---

## 9. Questions for the owner (in the order that unblocks the most)

1. **`HANDOFF.md:153` — which reading?** (§3.4) Fuel *in* the notification and a clean SMS
   draft (a), fuel prefilled into the draft (b, recommend reject), or a two-tap route via an
   Orbit screen (c)? This is a `[DECIDED]` item being made precise, and it decides how much
   else in this workpaper matters.
2. **Is there a class of fuel that must never leave the profile screen?** (§1.4) The vault
   convention already has one — `**⛔ Off-Limits / Triggers:**`. If yes, fuel items carry a
   kind or a glance flag, and the importer must populate it from day one.
3. **Which gesture does the dashboard's fuel glance get, given that tap opens the profile,
   long-press is the quick-action menu, and mark-contacted must stay cheapest?** (§2.3)
4. **Ranking for the one-line slot:** newest, unused-first, pinned-first, or the combination?
   (§3.5) Are `pinned_at` and `used_at` worth their columns?
5. **Is fuel ever "used up"?** (§5.2) Does logging an interaction offer to mark fuel as
   discussed? Nothing in the plugin has this concept and it is the main defence against the
   50-item landfill.
6. **Fuel on the widget: never, or only in the stretch profile state?** (§4) Home-screen
   persistence is a different exposure class from a notification.
7. **Do Small Talk Data and Gift Locker survive as fuel kinds, as custom fields, or not at
   all?** (§1.5) The AI prompt reads Small Talk Data today (`AiService.ts:29-30`).
8. **Does the never-contacted screen show fuel, and does the capture picker include
   never-contacted people?** (§6) The second one is a bug waiting to be copy-pasted.

---

## 10. Cross-domain constraints this seam would export

- **[fuel → notify]** Notification content is frozen at schedule time
  (`ExpoNotificationBuilder.kt:109`, and no fire-time hook exists). **Every fuel write must
  reschedule that contact's pending notifications**, or the reminder shows stale fuel.
- **[fuel → notify]** The only styling available is `BigTextStyle` over the single `body`
  string — `InboxStyle` is unreachable, and action-button labels come from a pre-registered
  category (`ExpoNotificationBuilder.kt:39-73`). Fuel items cannot be rendered as lines or as
  buttons; they are characters in one string you assemble.
- **[fuel → notify]** `NotificationAction.textInput` exists and works on Android via
  `RemoteInput` (`ExpoNotificationBuilder.kt:82-90`,
  `build/Notifications.types.d.ts:625-647`). **Free-text capture from the notification shade
  is possible even though it is impossible in a widget** — a capture surface nobody has
  costed.
- **[fuel → notify / widget]** Any glance surface must exclude off-limits-class fuel
  (§1.4); the notification channel needs an explicit `lockscreenVisibility` decision
  (`build/NotificationChannelManager.types.d.ts:78`).
- **[fuel → widget]** Fuel does not fit on the favourites grid; only the
  `HANDOFF.md:161` stretch profile state has room, and it needs an app-side push on every
  fuel write or it is a cache with no invalidation.
- **[fuel → dashboard]** The card needs a **has-fuel indicator** regardless of which gesture
  wins, or the gesture is spent on an empty sheet (§1.2).
- **[fuel → dashboard]** Build the dashboard's sort/filter skeleton from
  `ContactPickerGrid.tsx:39-163`, not `OrbitHeader.tsx:33-65`. The picker already has search,
  a real category filter, a 3-way battery filter, and last-contacted sort in both directions
  (§7.3).
- **[fuel → capture]** The contact picker must **not** carry `WHERE last_contact IS NOT NULL`.
  Capturing fuel for a never-contacted person is the highest-value case (§6.1).
- **[fuel → capture]** If a fuel item needs a short headline (§8.2), the share-sheet flow is
  where it gets produced — from a page title, a first line, or a prompt.
- **[fuel → ai]** `AiService.ts:26-34` sends both `{{Conversational Fuel}}` and
  `{{Small Talk Data}}`. If off-limits items are a fuel kind, **they must be excluded from —
  or explicitly labelled as prohibitions in — the prompt**, which is the app's sole network
  egress (`HANDOFF.md:73`). Sending "his ex (messy breakup)" to a third-party provider
  unlabelled invites the model to reference it.
- **[fuel → import]** `is_glanceable` / `kind` is the one fuel column that cannot be
  retrofitted cheaply, because only the importer can read the vault's
  `**⛔ Off-Limits / Triggers:**` subheaders (`ai-context.test.ts:27-28`). If that structure
  is to survive the import, the column must exist when the importer first runs.
- **[fuel → log]** "Mark fuel as discussed" is the cheapest consumption affordance and it
  belongs on the interaction-logging flow (§5.2).
