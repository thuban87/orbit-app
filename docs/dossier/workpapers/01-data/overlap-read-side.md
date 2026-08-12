# Workpaper 01-data — What the read side demands of `contacts`

**Scope.** Three consumers: the dashboard (exists in the plugin), the orrery (no predecessor),
and the home-screen widget (no predecessor). Every claim below was verified by reading the
file on disk at `~/projects/Orbit`, not from a diff or a summary. Citations are `file:line`
against that repo unless prefixed `orbit-app/`.

**Status.** Investigation only. Nothing here is decided. §6 is the question set for the owner.

---

## 1. The category incoherence — confirmed, and worse than stated

There are **three** vocabularies, not two, and a fourth implied by the docs.

### 1a. The form: a closed 4-value enum

`src/schemas/new-person.schema.ts:22-28`

```ts
key: 'category', type: 'dropdown',
options: ['Family', 'Friends', 'Work', 'Community'],
default: 'Family', required: true,
```

`src/schemas/edit-person.schema.ts:23-28` is identical **except it has no `default`**. The
session log records that the missing default on the *new* form was a real bug — the first
option was not submitted when left untouched (`docs/UX Overhaul Session Log.md:970`). The edit
form still carries the same shape without the fix; because it is always pre-filled from the
contact (`src/modals/OrbitHubModal.ts:113`) it does not bite, but it is the same latent defect.

### 1b. The display grouping: a closed 11-token vocabulary

`src/components/ContactGrid.tsx:11-24`

| Section | Accepted tokens (lowercased) |
|---|---|
| Family & Friends | `family`, `friends`, `friend` |
| Community & Professional | `community`, `professional`, `work`, `business`, `colleague` |
| Service | `service`, `vendor`, `contractor` |
| Other | anything else — `getSectionIndex` returns `-1` (`:38`), collected at `:104`, rendered at `:134-143` |

### 1c. What is actually reachable from the built-in form

Map the four form options through `getSectionIndex` (`ContactGrid.tsx:30-39`):

- `Family` → section 0. `Friends` → section 0.
- `Work` → section 1. `Community` → section 1.

Consequences, all verifiable by reading those two files together:

- **The "Service" section is dead.** No built-in form path can produce `service`, `vendor`, or
  `contractor`. The section header never renders (it is skipped when empty, `:119`).
- **The "Other" bucket is unreachable from the form.** `category` is `required: true`
  (`new-person.schema.ts:27`) and every option maps to a section.
- **7 of the 11 tokens are dead**: `friend`, `professional`, `business`, `colleague`, `service`,
  `vendor`, `contractor`.
- **The four form options collapse into two sections.** A user who deliberately separates Work
  from Community sees them merged on the dashboard with no indication of why. This is the
  user-visible half of the incoherence and the one worth naming to the owner.

The dead tokens are reachable *only* by hand-written frontmatter (documented as a supported
creation path, `docs/Getting Started.md:33-52`) or by a user-authored custom schema
(`docs/Custom Schemas.md:56-58`).

### 1d. Is `category` validated on read? No — and it is the only enum-shaped field that isn't

`src/services/OrbitIndex.ts:150` — `category: frontmatter.category`. Raw passthrough.

Contrast with the field immediately above it, `frequency`, at `OrbitIndex.ts:122-125`:

```ts
const frequency: Frequency = isValidFrequency(rawFrequency) ? rawFrequency : "Monthly";
```

`isValidFrequency` (`src/types.ts:188-191`) checks membership in `FREQUENCY_DAYS`. So the
plugin already has the validate-and-default pattern; it applies it to `frequency` and to
nothing else. `social_battery` (`OrbitIndex.ts:157`) and `last_interaction` (`:159`) are
also raw passthroughs despite both being declared as union types in `types.ts:37` and `:42`.

**So yes, `category` can hold arbitrary text.** It can also hold arbitrary *types*, and that is
a live crash:

- YAML `category: 2024` parses to a JS number. `ContactGrid.tsx:31` runs
  `(contact.category || "").toLowerCase()` — on a number that is a `TypeError`, and it is
  inside the render path of the whole grid, so one malformed contact blanks the dashboard.
  Same for a YAML list (`category:\n  - Work`).
- `OrbitContact.category` is typed `string | undefined` (`types.ts:55`) and TypeScript believes
  it, because the value crosses an untyped `frontmatter` boundary with no runtime check.

**Port implication:** the SQLite column can be TEXT and the DAO can normalize on write, which
removes the crash class entirely — but only if normalization is a write-side invariant rather
than a hopeful convention. This is the read side's strongest demand: *the read layer should
not be the thing that validates category.*

### 1e. Three different case-sensitivity policies for the same class of value

| Site | Behavior |
|---|---|
| `ContactGrid.tsx:31,34` | category grouping — **case-insensitive** (lowercases both sides) |
| `ContactPickerGrid.tsx:84` | category filter — **case-insensitive** comparison… |
| `ContactPickerGrid.tsx:46-52` | …but the dropdown's option list is built from **raw** values |
| `ContactGrid.tsx:58` | social battery — `c.socialBattery === "Charger"`, **case-sensitive** |
| `ContactPickerGrid.tsx:90` | social battery — `=== batteryFilter`, **case-sensitive** |

The picker combination is a visible defect: `Family` and `family` in two contacts produce
**two separate entries in the category dropdown** that return **identical result sets**
(`:46-52` dedupes on raw case, `:84` compares lowercased). And a contact whose frontmatter says
`social_battery: charger` is silently invisible to the "Chargers Only" filter forever.

### 1f. Do the docs describe categories a third way? Yes — and the docs are wrong about more than categories

`docs/dossier/INDEX.md:132-134` claims "its docs disagree with its code here; trust code."
**Confirmed, and the disagreement is larger than category.** Verified doc-vs-code:

| Doc claim | Reality |
|---|---|
| `docs/Adding People.md:22` — "Family, Friends, Work, or Community" | ✅ matches the form |
| `docs/Sidebar View.md:39` — sidebar has a **Category filter** ("Show only Family, Friends, Work, etc.") | ❌ **No such control.** `OrbitHeader.tsx:46-55` offers exactly `All` / `Chargers Only` / `Needs Attention` |
| `docs/Sidebar View.md:40` — sidebar has a **Battery type** filter with three values | ❌ Only a `Chargers Only` option exists (`OrbitHeader.tsx:53`, `ContactGrid.tsx:57-58`). Neutral and Drain cannot be filtered |
| `docs/Orbit Hub.md:21` — each card shows a **Category badge** | ❌ `ContactCard.tsx:266-304` renders avatar + name only. No badge in either `sidebar` or `picker` mode |
| `docs/Sidebar View.md:53-57` — right-click has 3 items | ❌ `ContactCard.tsx:81-142` builds 5–6 items (adds *Snooze 1 month*, *Open in new tab*, and a conditional *Unsnooze*) |
| `docs/Getting Started.md:22` — "category folders (Family, Friends, Work, **etc.**)" | Implies an **open** vocabulary |
| `docs/Custom Schemas.md:56-58` | `category` shown as a user-definable field with arbitrary options — explicitly **open** |

So the fourth vocabulary is: *the docs treat `category` as an open, user-extensible set used for
filtering and badging.* Neither the filtering nor the badging exists in code, and the set is
closed in the form and differently closed in the grid.

**The doc drift matters beyond trivia.** `docs/Sidebar View.md` and `docs/Orbit Hub.md` are the
best surviving statement of *intended* dashboard behavior. Read as intent rather than as
description, they say the owner wanted: category filtering on the dashboard, three-way battery
filtering, and a category badge on the card. None of it was built. That is a feature list for
domain 8 (`dashboard`), not just a documentation bug.

---

## 2. Every field the read side actually reads

`OrbitContact` is defined at `src/types.ts:47-89`; every field is populated in one place,
`OrbitIndex.parseContact` (`src/services/OrbitIndex.ts:111-162`).

| Field | Source | Read by | Drives |
|---|---|---|---|
| `file` (`TFile`) | `parseContact` arg | everywhere | identity, open-note, React keys |
| `file.path` | Obsidian | `ContactGrid.tsx:126,139`; `ContactPickerGrid.tsx:178,182`; `BirthdayBanner.tsx:40`; index Map key `OrbitIndex.ts:78` | **de-facto primary key** and selection equality |
| `name` | `file.basename` (`OrbitIndex.ts:149`) | `ContactGrid.tsx:65`; `ContactPickerGrid.tsx:69-71`; `ContactCard.tsx:300,303` | name sort, search, initials, avatar colour hash |
| `category` | frontmatter, unvalidated (`:150`) | `ContactGrid.tsx:31`; `ContactPickerGrid.tsx:49,84`; `AiResult.tsx:61`; `AiService.ts:106` | section grouping, picker filter, AI prompt tone |
| `frequency` | validated + defaulted (`:122-125`) | `calculateStatus`, `calculateDaysUntilDue` | status math only — **never displayed on a card** |
| `lastContact` | `parseDate(frontmatter.last_contact)` (`:128`) | `main.ts:312-314` (digest); status math | status, digest bucketing |
| `status` | computed (`:137-142`) | `ContactGrid.tsx:60,68`; `ContactPickerGrid.tsx:77,95`; `ContactCard.tsx:111,238`; `main.ts:305-307` | **the primary sort and the primary filter**, ring colour, menu contents |
| `daysSinceContact` | computed (`:144`) | `ContactPickerGrid.tsx:98,101`; `AiResult.tsx:61`; `AiService.ts:107`; `main.ts:308` | recency sort (both directions), AI context, digest text |
| `daysUntilDue` | computed (`:145`) | **nothing** — see below | — |
| `photo` | frontmatter (`:156`) | `ContactCard.tsx:241-264`; `UpdatePanel.tsx:48-50`; `AiResultModal.ts:59` | avatar; three divergent resolution paths |
| `socialBattery` | frontmatter, unvalidated (`:157`) | `ContactGrid.tsx:58`; `ContactPickerGrid.tsx:58,90`; `AiService.ts:108` | "Chargers Only" filter, picker filter, AI context |
| `snoozeUntil` | computed-conditional (`:158`) | **nothing user-facing** — see below | — |
| `lastInteraction` | frontmatter, unvalidated (`:159`) | `AiService.ts:100`; `OrbitHubModal.ts` prefill | AI context only — never displayed |
| `birthday` | frontmatter (`:160`) | `BirthdayBanner.tsx:16-19` | 7-day banner only |
| `fuel` | **never set** — see below | `FuelTooltip.tsx:61-62` | dead branch |

### 2a. Read but never written

**`fuel` (`types.ts:88`).** `FuelTooltip.tsx:58-67` has a branch for "no plugin (picker mode) —
use cached fuel from contact" that reads `contact.fuel`. `parseContact` never populates it
(`OrbitIndex.ts:147-161` — the returned object literal has no `fuel` key). The branch is
permanently dead; in picker mode the tooltip always shows nothing. Do not port the "cached fuel
on the contact record" idea as if it were a working design — it was never exercised.

### 2b. Written/computed but nothing reads

- **`daysUntilDue`** (`types.ts:70`, computed `OrbitIndex.ts:145`) is consumed by exactly two
  non-UI sinks: the debug dump (`:355`) and the AI-agent state JSON (`:382-385`). No screen ever
  shows "due in 3 days." Given HANDOFF §7 makes *progress through the interval* the orrery's
  core visual encoding, this is the one derived value the mobile app will lean on hardest — and
  it has no UI precedent to port. Design it fresh.
- **`snoozeUntil`** (`types.ts:79`) is set at `OrbitIndex.ts:158` and read only by the state JSON
  dump (`:388-390`). The user is never told *until when* someone is snoozed. `ContactCard.tsx:111`
  keys the Unsnooze menu item off `status === "snoozed"` alone. A mobile snooze that gives no
  end date is a support question waiting to happen.
- **`contact_link`** is written by both schemas (`new-person.schema.ts:64-69`,
  `edit-person.schema.ts:64-69`), persisted by `ContactManager.ts:129-133`, and read back at
  `OrbitHubModal.ts:118` **solely to re-prefill the edit form**. It is absent from
  `OrbitContact` entirely (`types.ts:47-89`). Nothing consumes it. On mobile this is precisely
  the field a widget tap or a notification action would need to launch a message — dead data in
  the plugin, load-bearing here.

### 2c. Identity: the path is the key, and the path moves

Three separate things make `file.path` an unstable identity, and all three are read-side facts:

1. Renaming a contact changes the path (`OrbitHubModal.ts:156-162`, `OrbitIndex.ts:296-310`).
2. Creation places the file under `{contactsFolder}/{category}/{name}.md`
   (`ContactManager.ts:106-110`), so **category is baked into the path**.
3. But editing the category does **not** move the file — `handleEdit` renames only on a name
   change (`OrbitHubModal.ts:143-162`). So path and category drift apart silently.

The read side then uses that path as a React key *and* as selection equality
(`ContactPickerGrid.tsx:182`). Mobile needs a surrogate `id` that no user-visible attribute can
change. Worth stating explicitly in the migration-1 decision, because it is the single thing the
plugin's identity model gets most wrong and it looks fine until a rename.

---

## 3. Ordering and derived values — computed where, and what SQL can and cannot do

### 3a. In the plugin: computed once at parse time, then frozen

`status`, `daysSinceContact`, and `daysUntilDue` are all computed inside `parseContact`
(`OrbitIndex.ts:137-145`) and stored in the in-memory `Map` (`:78`, `:205`). They are recomputed
**only** on: full vault scan (`:53`), a file-change event (`:194-218`), a settings change
(`:417-423`), or the user pressing the Refresh button (`OrbitHeader.tsx:58-64` →
`OrbitContext.tsx:51-54`).

**There is no timer.** `grep -rn "setInterval\|registerInterval" src/` returns nothing.

`statusOrder` is not stored anywhere — it is a literal object **duplicated in three files**:
`OrbitIndex.ts:323`, `ContactGrid.tsx:68`, `ContactPickerGrid.tsx:26-31`. All three currently
agree (`decay 0, wobble 1, stable 2, snoozed 3`). Port it once.

**The staleness bug already exists.** A plugin session left open across midnight shows yesterday's
statuses. It is invisible on desktop because Obsidian gets restarted and files get touched. A
mobile app resumed from background after three days would show it constantly. Whatever the schema
decides, the RN side needs a recompute on `AppState` → active **plus** a local-date change check —
and per `orbit-app/CLAUDE.md` it must not be a per-frame or polling timer.

### 3b. What can be a SQL expression

Storable columns: `last_contact`, `frequency`, `snooze_until`. Everything else is derived.

- `daysSinceContact` — SQL-expressible:
  `CAST(julianday('now','localtime') - julianday(last_contact) AS INTEGER)`.
  Note `'localtime'`: `orbit-app/CLAUDE.md` already forbids `toISOString().split('T')[0]` for the
  UTC off-by-one; bare `julianday('now')` is UTC and reintroduces exactly that bug in SQL.
- `daysUntilDue` — SQL-expressible **only if the interval is a number in the row.**
  `FREQUENCY_DAYS` is a TypeScript constant map (`types.ts:19-27`). In SQL it becomes either a
  seven-arm `CASE` ladder repeated in every query, or a denormalized `interval_days INTEGER`
  column written alongside `frequency`. The second also makes a future "every 10 days" custom
  interval a data change rather than a schema change. → decision Q3.
- `status` — **not** cleanly SQL-expressible as a stored value, and this is the important one.

### 3c. `status` depends on today, so it is not a storable column — concrete consequences

`status = f(last_contact, interval_days, snooze_until, TODAY)`. Only the first three are storable.

1. **A stored `status` column is wrong the moment the date rolls over, and nothing can fix it.**
   Per `orbit-app/CLAUDE.md`, SQLite has no scheduler and triggers fire only on data events. A
   contact silently transitioning stable → wobble → decay produces **no** data event. The launch
   sweep that already exists for quarantine expiry (HANDOFF §14.5) is the only mechanism, which
   means a stored status is correct only as of the last app launch.
2. **You cannot index `status` at all — by either route.**
   - An index on a stored `status` column indexes a value that is silently stale.
   - An index on the *expression* is rejected: SQLite requires index expressions to be
     deterministic, and `date('now')` / `julianday('now')` are non-deterministic by definition.
     `CREATE INDEX ... ON contacts (julianday('now') - julianday(last_contact))` will not compile.
   There is no third option. **Accept that there is no durable index on status.**
3. **Therefore `ORDER BY` status is a query-time `CASE`**, mirroring the 0/1/2/3 literal from
   §3a, evaluated over a full scan. At the 7–15 rows HANDOFF §10 specifies, and at any scale this
   app will ever see, the scan is free. Do not let anyone "optimize" this into a stored column
   later; it trades a non-problem for a correctness bug that cannot be repaired on a device you
   cannot reach.
4. **The indexable alternative, if one is wanted:** store `due_date` (= `last_contact +
   interval_days`) and `wobble_date` (= `last_contact + 0.8 × interval_days`), written on every
   touch. Those are deterministic and indexable. Status then becomes two comparisons against
   `date('now','localtime')` at read time, and "who is overdue" is `WHERE due_date < date('now')`
   against a real index. Cost: two more columns to keep in sync on every write to `last_contact`
   or `frequency`, in the same transaction, from every writer — and per `orbit-app/CLAUDE.md` the
   plugin already demonstrates that its `last_contact` writers disagree with each other (§5c).
   → decision Q4.
5. **`snooze_until` is the same class of value.** `OrbitIndex.ts:134` compares it to `new Date()`
   at parse time. Snooze *expiry* is a read-time comparison, not an event. It must never be
   modeled as "something flips the status back."

### 3d. The `Infinity` / `NULL` trap — a real port bug, not a hypothetical

`calculateDaysSince` returns `Infinity` for a null `lastContact` (`types.ts:131-137`);
`calculateDaysUntilDue` returns `-Infinity` (`types.ts:150`); `calculateStatus` returns
`"decay"` (`types.ts:102-104`). In the plugin these sentinels only ever reach string templates
(`OrbitIndex.ts:354-355`, `main.ts:308-310`, `AiResult.tsx:61`), so nothing breaks.

In SQLite the sentinel is `NULL`, and NULL behaves the opposite way:

- `julianday(NULL)` is NULL, so `daysSince` is NULL, so **the row sorts *last* under `ORDER BY
  daysSince DESC`** — but a never-contacted contact is the *most* overdue and must sort *first*.
- `WHERE daysSince > 30` **excludes** NULL rows. The never-contacted contact vanishes from the
  "needs attention" filter — the exact filter that exists to find them.

Every read query must handle this explicitly (`COALESCE`, `IS NULL` first in the ORDER BY, or a
`NOT NULL` column with a sentinel date). Note that this path is **only reachable via the
importer**: `ContactManager.ts:136-138` sets `last_contact` to today on creation, so a
form-created contact always has a value. HANDOFF §15.4 makes the importer the seed-data
mechanism, so the mobile app hits this on day one with the owner's own vault. → decision Q5.

In Skia the same sentinel is worse: `Infinity` into a transform yields NaN geometry, and a body
at NaN either vanishes or takes the render loop with it.

---

## 4. What the orrery demands that does not exist today

HANDOFF §7 (line 192): *"Every contact gets their own orbit ring… Rings are ordered by frequency,
so `Daily` contacts sit innermost and `Yearly` outermost."*

### 4a. Frequency does not produce a total order — a per-contact ring ordinal is net-new

With the owner's own list (HANDOFF §10: Phil, Chris, Andrew, David, Mom, Dad, Daniel), several
contacts will share `Monthly`. But the entire justification for per-contact rings is that
*"contacts marked on the same day share an angle but never a radius"* (HANDOFF §7). Two Monthly
contacts sharing a radius reintroduces the stacking problem the design exists to solve. **So the
schema needs a tiebreaker within a frequency band, and the three candidate designs behave
visibly differently when the contact set changes:**

| Design | Add a contact | Delete a contact | Change frequency |
|---|---|---|---|
| **(a) Derived only** — `ORDER BY interval_days, name` at render | every ring at/beyond that band renumbers | same | same |
| **(b) Stored `ring_ordinal INTEGER`** | renumber the tail, or leave gaps | gap or compaction | must move within band, can drift out of frequency order if unmaintained |
| **(c) Hybrid** — stored monotonic `ring_seq`, sort by `(interval_days, ring_seq)` | lands at the outside of its band, nothing else moves | no gap (sort is over survivors) | moves between bands, relative order inside preserved |

(a) is free and destroys spatial memory on every edit — "Mom is the third ring in" stops being
true the first time a contact is added. (c) costs one `INTEGER` column and cannot be
reconstructed retroactively: **creation order is not recoverable from a database that never
recorded it.** That is an independent argument for a `created_at` column in migration 1
regardless of which ring design wins. → decision Q6.

### 4b. Body identity must survive re-ordering — and today it doesn't

If rings can renumber, a body's *colour* is what keeps it recognisable. The plugin derives avatar
colour from a deterministic HSL hash of the name (`ContactCard.tsx:34-43`) — free, but it means
**renaming a contact changes their colour**. On a card grid nobody notices; in an orrery where
colour is the only stable identity cue across a re-layout, it matters. Either accept it or store
a per-contact colour seed. → part of Q6.

### 4c. The sun / self — the plugin has no user record of any kind. Confirmed.

`OrbitContact` (`types.ts:47-89`) is the only entity in the type system. `OrbitIndex` indexes
only files carrying the `people` tag (`OrbitIndex.ts:167-188`). `src/settings.ts` holds plugin
configuration, not a user identity. **The user has no name, no photo, and no row anywhere.**
HANDOFF §7 nonetheless marks *"Sun at centre, carrying the user's own profile photo"* as
`[DECIDED]`. So the sun's photo has literally nowhere to live. Three shapes:

- **`user_profile` singleton table** (or one row in an app-settings KV). Clean separation. But it
  is the schema's first non-contact entity, and it needs a photo — which means the photo-storage
  decision in domain 7 must cover a non-contact subject, not just contacts.
- **A self row in `contacts` flagged `is_self`.** Reuses photo handling, the profile screen, and
  the edit form for free. **The trap:** every read path must now exclude it — the dashboard grid,
  the header count (`OrbitHeader.tsx:29`), the status sort, the digest totals (`main.ts:339`),
  the birthday banner, the widget favourites, the AI context, export. Per `orbit-app/CLAUDE.md`
  ("read every writer of a shared table"), this is the same hazard from the read direction: one
  forgotten `WHERE is_self = 0` and the user appears in their own contact list, or is counted as
  overdue with themselves.
- **No self record.** The sun is a themed graphic. Costs nothing; reverses a `[DECIDED]` item, so
  it is the owner's call and nobody else's.

→ decision Q7.

### 4d. Ring radius is a function of N, which decides the 0/1/2-contact case

Radius allocation is upstream of, and coupled to, the ordinal choice:

- **(i) Radius = f(ring ordinal, N)** — rings distributed across the available viewport. Uses the
  space well at any N. But **every ring moves whenever a contact is added or deleted**, which
  compounds (a) above: the diagram reflows entirely on a routine edit.
- **(ii) Radius = f(frequency band) with sub-slots** — a Monthly contact is always at roughly the
  same distance. Stable and semantically honest ("radius reads as how close this person is meant
  to be", HANDOFF §7). Wastes space when a band is empty, and needs a bounded sub-slot count.

Then the degenerate cases fall out: at **N = 1** the ring-spacing constant under (i) is
meaningless and the single body must be placed by fiat; at **N = 0** there is a sun and nothing
else, and the screen needs a deliberate empty state rather than an accidental one. At **N = 2**
under (i), two rings at the extremes of the viewport looks broken. Under (ii) all three cases are
just sparse — which is an argument for (ii) that has nothing to do with aesthetics. → Q6.

### 4e. Angular position needs a bounded progress value

Angle = progress = `daysSince / interval_days`. For a decayed contact this exceeds 1.0, and
HANDOFF §7 says they drift outward past their assigned ring — so the value is **unbounded above**
and feeds a radius offset as well as an angle. Combined with §3d: a never-contacted contact has
`daysSince` = NULL (SQL) or `Infinity` (the ported TS), and either produces NaN geometry. The read
layer must clamp progress before it reaches Skia, and the clamp ceiling is a product decision —
how far out does "out of orbit" go before it stops moving? → Q5/Q8.

---

## 5. What the widget demands that does not exist today

### 5a. There is no favourite/pin/star concept anywhere. Confirmed by grep.

`grep -rni "favou\?rite\|pinned\?\|starred\|star" --include=*.ts --include=*.tsx --include=*.md .`
over the whole repo returns only unrelated hits ("pinned to midnight" in
`test/unit/components/birthday-banner.test.tsx:7` and `docs/Testing Overhaul Plan.md:278`).
`OrbitContact` has no such field (`types.ts:47-89`); neither built-in schema defines one
(`new-person.schema.ts:13-70`, `edit-person.schema.ts:13-70`). **Net-new schema.**

### 5b. Boolean or ordered? The grid makes this a product question, not a storage question

HANDOFF §6 specifies *a grid of favourite contacts*. A grid has positions, so something must
order them. If `favourite` is a boolean, order falls back to another sort — and the obvious
candidate is status order, which means **the tiles move by themselves.**

That is the argument against a bare boolean, and it is a friction argument, not a purity one:
HANDOFF §1 says every decision is measured against *"does this reduce the number of taps between
the reminder and the message actually being sent."* A home-screen widget the user can hit without
looking is worth several taps; a widget whose tiles reshuffled overnight costs a
mis-tap — and the primary action is **"mark contacted"** (HANDOFF §6), which is a *destructive,
silently-wrong* write when applied to the wrong person. There is no undo surface on a home screen.

The counter-argument is real: a status-sorted widget tells you who needs attention **without
opening the app**, which is also exactly the point of the widget.

These are two different products:

- *"Who I care about most"* → `favourite_rank INTEGER NULL` (NULL = not a favourite), fixed
  positions, status shown as ring colour only.
- *"Who needs attention now"* → `is_favourite BOOLEAN` defining a pool, ordered dynamically by
  status at snapshot time.

→ decision Q9. Note the second can be built on the first's schema, but not the reverse.

### 5c. What the widget needs to render without opening the app

Android widgets are `RemoteViews` (HANDOFF §6, `orbit-app/CLAUDE.md`). The widget process has no
JS runtime and no SQLite handle in the normal case — `react-native-android-widget` renders from
data the app pushes to it. So the widget needs a **denormalized snapshot**, and each element of it
is a schema demand:

| Needs | Source today | Problem on mobile |
|---|---|---|
| `name` | `file.basename` (`OrbitIndex.ts:149`) | fine |
| photo | `photo` frontmatter (`:156`), resolved 3 ways (`ContactCard.tsx:241-264`) | must be **a file path the launcher's process can read**, not an app-sandbox URI. Domain 7 decides this; the widget is the constraint that makes it non-negotiable |
| initials + colour fallback | `ContactCard.tsx:22-43` | pure functions, port directly |
| status colour | derived, date-dependent (§3c) | **stale by construction** in a snapshot |
| the tap action's target | — | see below |

Two consequences worth stating now:

1. **Snapshot staleness needs a cadence decision.** HANDOFF §12.3 lists the *preset actions* as
   the open widget question; the staleness/refresh cadence is a second open question that has not
   been named. Status changes with the date and nothing else, so the honest refresh trigger is
   "on date change and on any relevant write" — not a periodic alarm, which is a battery
   complaint (cf. HANDOFF §7 on the starfield).
2. **A write must be pushed to the snapshot.** Any mutation changing a favourite's `name`,
   `photo`, or `last_contact` invalidates the widget. That is a fan-out from the DAO layer, and it
   is exactly the kind of writer the graph cannot enumerate for you (`orbit-app/CLAUDE.md`: no
   TypeScript→SQL edges).

### 5d. The plugin already has the "one-tap version diverges from the full version" bug

The widget's tap writes `last_contact` from outside the app. Per `orbit-app/CLAUDE.md`, every
writer of a shared table must agree. **The plugin has three writers of `last_contact` and they
do not:**

- `ContactCard.tsx:146-161` (right-click → mark contacted): writes `last_contact` **only**.
- `OrbitHubModal.ts:200-214` (update panel): writes `last_contact` **and** `last_interaction`,
  **and** appends an interaction-log entry when a note is present.
- `ContactManager.ts:136-141` (create): writes `last_contact` = today and initializes
  `last_interaction` to `''`.

So a contact marked from the sidebar gets no interaction type and no log entry, while the same
logical action from the hub gets both. On mobile this reproduces four times over — widget tap,
notification action, quick action, full update flow (INDEX.md domain 4 names exactly this). The
read side's demand: **whatever a touchpoint records must be defined once**, or the interaction
history will be full of holes whose shape depends on which surface the user happened to use.
This is domain 4's decision but the widget forces it early.

---

## 6. Decisions for the owner

Each is framed with what actually diverges downstream.

**Q1 — Is `category` a closed enum, a user-editable list, or free text?**
Closed enum → grouping is total, no "Other" section needed, and the four form values must be
reconciled with the three display groups (today they collapse 4→2, §1c). User-editable list →
needs its own table and a management UI, and the dashboard's section headers become data. Free
text → the current situation, plus the crash at `ContactGrid.tsx:31` unless the DAO normalizes.
*Consequence that decides it:* if categories are user data, the dashboard's section grouping
becomes user-configurable and domain 8 grows a settings surface; if closed, domain 8 ships fixed
sections and `category` is a plain CHECK-constrained TEXT column.

**Q2 — Do the plugin's dead display groups mean anything, or were they aspiration?**
"Service / vendor / contractor" (`ContactGrid.tsx:22`) is unreachable from any built-in form. Was
that a planned fifth form option, or leftover scaffolding? If planned, it belongs in Q1's
vocabulary; if not, it should not be ported and the four-value form is the whole truth.

**Q3 — Store `interval_days` alongside `frequency`, or `CASE` on frequency in every query?**
Storing it makes every ordering pure SQL and makes a future custom interval ("every 10 days") a
data change. Not storing it keeps `frequency` the single source of truth and avoids a
denormalization that can drift. The orrery needs `interval_days` numerically for both ring order
and angular progress (§4), so it will be computed *somewhere* on every render either way.

**Q4 — Compute status at read time, or store `due_date` / `wobble_date` and index those?**
Read-time `CASE` = zero sync burden, no index possible, full scan (free at 7–15 rows). Stored
dates = indexable, `WHERE due_date < date('now')` is exact, but two columns must be rewritten
inside the same transaction as every `last_contact` and `frequency` write, from every writer —
and §5d shows the plugin's writers already disagree about side effects. *This is a risk-posture
call as much as a technical one, so it is the owner's.*

**Q5 — What does "never contacted" mean in the schema: NULL `last_contact`, or a sentinel?**
NULL is honest and makes every ordering and filter query handle it explicitly or silently drop
the most-overdue contacts (§3d). A NOT NULL sentinel (creation date, as `ContactManager.ts:136-138`
effectively does) makes queries trivial and records something untrue — and, per HANDOFF §15.4,
the importer is the path that produces these rows from the owner's real vault.

**Q6 — Ring order: derived, stored ordinal, or stored creation sequence? And radius: f(N) or
f(frequency band)?**
These two must be decided together (§4a, §4d). The decisive question is behavioral: *when you add
an eighth contact, should the existing seven rings stay where they are?* Yes → stored `ring_seq`
plus band-based radius. Don't care → derived, and accept the diagram reflowing on every edit.
`ring_seq`/`created_at` cannot be reconstructed later, so this is a migration-1 decision.

**Q7 — Where does the user's own identity live: a `user_profile` singleton, an `is_self` contact
row, or nowhere?**
The singleton is clean but forces domain 7's photo storage to handle a non-contact subject. The
`is_self` row is cheap and puts a `WHERE is_self = 0` obligation on **every** read path already
enumerated in §2 — miss one and the user is in their own contact list or counted as overdue.
"Nowhere" reverses a HANDOFF §7 `[DECIDED]` item.

**Q8 — What is the ceiling on "how far out of orbit"?**
Angular progress is unbounded above for decayed contacts and undefined for never-contacted ones
(§4e). Somewhere a clamp exists. Is a contact 400 days overdue drawn at the same distance as one
30 days overdue (clamp low, keeps them tappable, loses information), or does the ring keep
growing until it leaves the screen (honest, but they stop being reachable — which HANDOFF §7
explicitly rejects for the differentiated-animation alternative, on exactly the grounds that
decayed contacts must stay findable and tappable)?

**Q9 — Widget favourites: ordered list or boolean pool?**
Fixed positions optimize for eyes-free tapping and make the destructive "mark contacted" safe;
dynamic status ordering surfaces who needs attention without opening the app. The second design
can be built on the first's schema; the reverse is a migration. Related: **what does the widget do
when there are fewer favourites than grid cells, or none at all?**

**Q10 — Does `contact_link` survive the port, and what is it for?**
Today it is written and read back only to re-prefill its own edit form (§2b). On mobile it is the
natural target for a widget tap or a notification action ("open the SMS composer for that
contact", HANDOFF §6) — which needs a phone number or a messaging deep link, not a website URL.
If the one-tap action is to be *actionable*, the schema needs a contact method, and
`contact_link` as currently shaped is not it.

---

## Appendix — read-side facts most likely to be assumed wrong

- `frequency` is validated and defaults to `Monthly` (`OrbitIndex.ts:122-125`); `category`,
  `social_battery`, and `last_interaction` are not validated at all (`:150`, `:157`, `:159`).
- `statusOrder` is duplicated verbatim in three files (`OrbitIndex.ts:323`, `ContactGrid.tsx:68`,
  `ContactPickerGrid.tsx:26-31`).
- Nothing displays `frequency` on a card. It only feeds the status math.
- Nothing displays `daysUntilDue` or `snoozeUntil` anywhere in the UI.
- `contact.fuel` is read (`FuelTooltip.tsx:61`) and never written (`OrbitIndex.ts:147-161`).
- The dashboard has no category filter and no category badge, despite
  `docs/Sidebar View.md:39` and `docs/Orbit Hub.md:21`.
- A new contact is never "decay" — `ContactManager.ts:136-138` backfills `last_contact` to today.
- There is no timer anywhere in `src/`; nothing recomputes status on the clock.
