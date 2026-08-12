# Dossier 01 — `data` — Core contact schema & status engine

**Status:** complete · Interrogated 2026-08-11 → 2026-08-12 · 28 questions over 7 rounds
· No `[OPEN]` items remain

## Scope

The SQLite `contacts` table and everything derived from it: primary identity and rename
semantics, which plugin frontmatter keys become fixed columns, contact lifecycle
(create/archive/delete) which the plugin never had, the status engine (`calculateStatus`,
80%/100% thresholds, snooze override), the recency spine (`last_contact` /
`last_interaction` and their relationship to an `interactions` table), and the migration-1
scaffold. Excludes the custom-fields tables themselves ([DECIDED], HANDOFF §14) but
includes the boundary question of which keys are fixed columns versus custom fields.

---

## Decisions

> **Terminology.** An interaction **row** is not an interaction **note**. Every touchpoint
> creates a row; the note and channel on that row are optional and may be filled in later.
> Say "log an interaction" for the row and "add a note" for the content — the same
> row-versus-content ambiguity that CLAUDE.md warns about for custom fields caused a
> clarification in round 1 here.

### Cluster A — Contact identity & lifecycle

**[DECIDED] `contacts` gets a surrogate primary key.** Identity is never the name and never
a file path. Rationale: the plugin's rename is lossless only because its index holds nothing
but derived data (F1); the moment contacts own interactions, fuel, custom values, photos and
favourites, a mutable key becomes a data-corruption source. Renaming a contact must be a
metadata-only `UPDATE`.

**[DECIDED] Duplicate names are allowed, with a warning at create time.** "You already have
a Chris," plus a *Create anyway* button. No `UNIQUE` constraint on `name`.
Rationale: two Chrises are real; a hard block argues with reality and fails at the worst
moment — mid-capture. The surrogate key already removes the plugin's actual bug (F1's
first-match-wins name scan). The warning is UI-only, so it costs no schema.

**[REJECTED] `UNIQUE` index on `contacts.name`.** Would make export collision-free and
simplify the mental model, but breaks importing a vault that already contains two, and
blocks creation at capture time — the one moment the product exists to make cheap.

**[DECIDED] Removing a contact is an archive, with a separate explicit purge.** Archived
contacts are hidden from every screen with data untouched, and are restorable. Permanent
deletion is a second, deliberate action.
Rationale: consciously mirrors the quarantine model already chosen for custom fields
(HANDOFF §14.5), and for the same reason — no server, no backup, no way to reach the
device. The plugin had no lifecycle at all (F2), so this is net-new responsibility either
way; matching §14.5 keeps one mental model for "destructive thing you might regret."

**[REJECTED] Hard delete with an undo snackbar** — the undo window dies when the app
backgrounds, leaving no recovery path. **[REJECTED] Hard delete with a confirm dialog** —
the only operation in the app with no backstop. **[REJECTED] Archive with no purge** —
leaves "delete my data" with no honest answer, which matters if this ships publicly.

### Cluster B — The recency spine

**[DECIDED] `contacts.last_contact` is a stored column with exactly one writer.** That
single DAO function also inserts the corresponding `interactions` row, in the same
transaction. Recency and history are reconciled *by construction*, not by derivation.
Rationale: derivation (`MAX(interactions.date)`) is NULL for a new contact, and
`calculateStatus(null, …)` returns `"decay"` (`types.ts:102-103`) — every contact would be
born red unless creation fabricated a synthetic row (F10). A stored column keeps status a
trivial read and keeps the orrery's per-frame math off a join.

**[REJECTED] Independent `last_contact` and interactions** (the straight plugin port) — it
re-creates the exact four-writer drift of F3 permanently, and it is what makes the AI ship
an incoherent date/channel pair to a third party (F5).

**[DECIDED] Every touchpoint inserts an interaction row — including one-tap paths.** The
widget tile and the notification action each write a row, not just a date. The note is
optional (null) and the channel may be unspecified.
Rationale: complete history is what unlocks a profile timeline, cadence statistics and
AI-from-log — none of which the plugin can support, because its log is sparse by design
(gated on a non-empty note, `OrbitHubModal.ts:206`) and write-only (F3). The cost is one
insert on the app's most-fired action.

**[REJECTED] Log only when a note or channel is supplied** (plugin behaviour) — the
most-used paths would leave no trace, so the log would record the rare case and miss the
common one. **[REJECTED] Log in-app but not from widget/notification** — same failure, worse.

**[DECIDED] Purge destroys everything the contact owns, including its `field_history`
rows.** Interactions, fuel, custom values, the photo file on disk, scheduled notifications,
and field history all go.
Rationale: archive is already the undo for contact deletion, so §14.6's snapshot is scoped
to *field-level* operations. Retaining shadow copies of a purged contact's values for up to
30 days would undermine the exact promise purge exists to make.
**This scopes HANDOFF §14.6, it does not reverse it** — the snapshot-before-destructive-op
rule still governs every type conversion and column drop. Flagged to the owner as touching
a `[DECIDED]` item before recording.
Note: the photo file and scheduled notifications are unreachable by foreign key and need
explicit application-level cleanup in the same operation.

**[DECIDED] Interaction rows are fully editable after the fact — including date and time —
and those edits DO change status.** Correcting a date is the entire reason to touch it; a
correction that could not move status would be useless.
Owner's workflow, verbatim: log the touchpoint quickly with no date so it auto-stamps now,
then fix the date and time later that night or a day or two after. This is a primary
workflow, not an edge case.

**[DECIDED] `last_contact` = MAX over the interaction rows' *current* values, recomputed
after every insert, edit and delete.** Not "last write wins on the row just touched" —
that would wrongly move recency when an older, non-newest row is corrected.
Consequences: correcting the newest row's date *does* walk recency backwards (intended —
the corrected value is the accurate one); inserting an older row alongside a newer one does
*not*. `last_contact` is therefore a maintained materialisation of MAX, still a stored
column with a single writer.
**Open consequence:** this re-opens the born-red problem (F10) — a contact with no
interaction rows has MAX = NULL. See cluster C.

**[DECIDED] Interactions store a local datetime, not a date.** The plugin stored
`YYYY-MM-DD` only (`formatLocalDate`, `utils/dates.ts`). The owner explicitly wants to
correct "the date and/or time," so time is captured. Storage must use
`date('now','localtime')` semantics, never `date('now')` — the `toISOString()` off-by-one
exists in SQL too (F15).

**[DECIDED] The interaction channel lives on the interaction row only.** No cached column on
`contacts`; "last channel" is read off the newest row.
Rationale: kills F5's incoherent date/channel pair sent to the AI provider at the root, and
enables both the per-touchpoint question ("when did I last actually phone him rather than
text") and the unbuilt "vary the channel" idea from `Feature Priority List.md` item 29.
Scale was raised by the owner in light of a likely public release, and answered: with the
index below, newest-per-contact is one index seek per contact **independent of history
depth** — O(N log M), estimated low single-digit ms for 1,000 contacts × 100 interactions on
a mid-range Android device. Not measured on device; a benchmark is cheap and worth doing
before the dashboard phase ships.

**[REJECTED] A cached `last_interaction` column on `contacts` alongside the row.** Trades a
reintroduced second writer for microseconds.

**[DECIDED] `interactions` is indexed on `(contact_id, date DESC)`.** CLAUDE.md's
"never add an index" rule applies **only** to columns in `contact_custom_values`, and only
because `DROP COLUMN` fails on indexed columns. `interactions` is an ordinary table with no
dynamic DDL against it; indexing it is correct and necessary. Recorded so the rule is not
over-applied.

### Cluster C — The status engine

**[DECIDED] The create form asks when you last spoke, defaulting to today, with an explicit
"not yet / don't know" that leaves the value genuinely empty.** The plugin's new-person form
has no last-contact field and silently stamps today (`ContactManager.ts:136-138`).
Rationale: covers both real cases — someone you just met, and a backlog of people you have
been neglecting — and gives the importer an honest place to put unknowns rather than
fabricating a touchpoint.
**[REJECTED] Always seeding a synthetic "Added to Orbit" row** — puts an event in the
timeline that never happened. **[REJECTED] Always stamping today, unasked** (plugin
behaviour) — quietly asserts you spoke to someone you may never have spoken to.
*Consequence:* an empty `last_contact` is now reachable by design, so the never-contacted
display state needs its own decision (see below).

**[DECIDED] Status is a continuous progress value; the three buckets are a view over it.**
One quantity — elapsed ÷ interval — drives everything. `stable` / `wobble` / `decay` become
presentation thresholds at 80% and 100%, and the orrery reads the *same* number for its
angular position.
Rationale: this completes `docs/Feature Priority List.md:96` ("Health Score … Math TBD"),
the one item the owner planned and never built, essentially for free — because HANDOFF §7
already commits the orrery to computing exactly this quantity. It also makes sorting
granular *within* a bucket.
**[REJECTED] Buckets only, with the orrery deriving its angle separately** — two pieces of
code computing the same quantity independently, which is the cheapest thing to build and
the easiest to let drift.
**Supersedes a port note:** HANDOFF §4 lists `calculateStatus()` as "Copy verbatim." It is
now a thin bucketing layer over the progress function. §4 was assessing portability, not
mandating shape; flagged to the owner before recording.

**[DECIDED] Progress is continuous underneath, day-granular on screen.** The derived value is
continuous, so the orrery drifts smoothly and sort order is finely resolved. Everything the
user reads — the "12 days ago" counter, the colour, notification triggers — resolves at
**local midnight**, so status never changes mid-conversation.
**[REJECTED] Whole days everywhere** (plugin's `Math.floor`, `types.ts:108`) — loses the
smooth orrery. **[REJECTED] Fully continuous everywhere** — the day counter and the colour
could disagree at a glance, and notification timing gets fiddly.

**[DECIDED] Status is never stored.** It is computed at query time. The plugin already has
this bug in a milder form — there is no `setInterval` anywhere in `src/`, so status is
frozen at parse time (F9). A stored column rots the same way, because no trigger fires on a
date change, and an expression index is illegal (SQLite rejects non-deterministic
`julianday('now')` in `CREATE INDEX`). At the scale in HANDOFF §10 a query-time `CASE` over
a full scan is free. If indexing ever becomes necessary, store `due_date` — not `status`.
*(Orchestrator's call — see "Decisions made without you".)*

**[DECIDED] Never-contacted contacts are excluded from the dashboard and the orrery
entirely, and get their own dedicated screen.** *Owner's design, adopted over the
orchestrator's recommendation — it is strictly simpler.*
The predicate is `last_contact IS NULL` (equivalently, zero interaction rows). Those
queries carry `WHERE last_contact IS NOT NULL`, which removes in one move: the NULL-sorting
hazard from F10, the need for a fourth status state, the undefined orrery position, and any
fabricated clock. A contact joins the normal population automatically on their first
interaction, and would return here if every interaction row were later deleted.
**[REJECTED] A user toggle for whether never-contacted entries sort to the oldest or newest
end of the dashboard** — the owner raised and dismissed it as too complex for the value.
**[REJECTED] Running the clock from date-added with a "Never contacted" label** (the
orchestrator's recommendation) — well-defined, but it invents progress that did not happen
and keeps them in screens where they are noise.

**[DECIDED] Snooze is suppression only — the clock keeps running.** Hidden from lists and
notifications; elapsed time is not altered. Un-snoozing reveals the true state.
Rationale: time really did pass and the app must not pretend otherwise. Matches the
plugin's actual semantics (F11), now made deliberate rather than incidental.
**[REJECTED] Pausing the clock** — repeated snoozing could hide a relationship decaying for
a year. **[REJECTED] Snooze as a soft reset** — silently manufactures contact that never
happened.
*Still open from F11 and deferred:* preset lengths for mobile, whether snooze is visible on
the profile, and whether expired snoozes are retained as history (the plugin discards them).

**[DECIDED] Frequency is stored as an integer interval in days.** The seven named presets
(Daily=1 … Yearly=365, `types.ts:19-27`) become a UI picker that writes the number.
Rationale: "every 45 days" or "every 6 weeks" becomes possible later with **zero
migration** — and per CLAUDE.md a migration against devices you cannot reach is permanent
for that user. Orrery ring ordering also sorts numerically for free, where an enum needs a
lookup table to order at all.
**[REJECTED] Storing the enum** (plugin port) and **[REJECTED] storing both label and days**
— the latter is two columns that can disagree.

### Cluster D — Categories & grouping

**[DECIDED] Categories are a user-editable, single-select list, seeded with the plugin's
four (Family, Friends, Work, Community).** A real `categories` table: rename, add, reorder.
`contacts.category_id` is a foreign key.
Rationale: fixes F6's four-way incoherence at the root, keeps dashboard grouping and the AI
prompt's `{{category}}` on ground that cannot be quarantined out from under them, and lets
the owner add "Service" if it turns out to be real. Category is **not** part of any file
path — that plugin coupling (`ContactManager.ts:106-110`) dies with the vault.
**[REJECTED] Multi-select tags** — truthful (a colleague who became a friend is both), but
forces dashboard grouping to decide where a two-category contact appears, and adds a join
table to migration 1.
**[REJECTED] Category as just a custom dropdown field** — §14 machinery would cover it, but
grouping, the AI prompt and the importer would then depend on a field the user can
quarantine or delete.
**[REJECTED] Four hardcoded values** — cannot add one without shipping an app update.
**[REJECTED] Freeform text** (the plugin's de-facto behaviour) — this is what produced F6,
including the `category: 2024` crash.

### Cluster E — Fields the mobile product needs that have no predecessor

**[DECIDED] `phone` and `email` are nullable columns on `contacts`.** This closes F13's
biggest gap: HANDOFF §6 `[DECIDED]` requires a decay notification to open the SMS composer
for a contact, and **nothing in the plugin holds a phone number** — `contact_link` is
free-text that nothing reads.
Rationale: the SMS composer needs exactly one number. A richer typed `reach_methods` table
later is a *new table*, i.e. a routine migration — the "cheap now, impossible later" logic
that justified `interval_days` does not apply here, so there is no penalty for starting
simple.
**[REJECTED for v1] A typed, ordered `reach_methods` table** — better if "WhatsApp Mom, SMS
Dad" becomes real; costs a table plus CRUD UI now.
**[REJECTED] Reading the Android contact book via `ContactsContract`** — no double entry and
always-current numbers, but requires the `READ_CONTACTS` runtime permission. It sends
nothing off-device, yet it is a frightening prompt that cuts against the "privacy is the
product" positioning (HANDOFF §3, §8) and attracts Play Store policy scrutiny. Declined on
security/positioning posture, which is explicitly the owner's call.
*Note:* phone and email are third-party PII at rest on the device — see the
`android:allowBackup` decision.

**[DECIDED] Favourites are ordered — a nullable rank column on `contacts`.**
Rationale is product, not migration cost (adding a rank later would be trivial): the
primary widget tap is "mark contacted," a write with **no undo on a home screen**. Tiles
that reshuffle by status overnight make muscle memory log the wrong person.
**[REJECTED] Boolean flag with status ordering** — surfaces urgency without curation, but
accepts moving tiles. **[REJECTED] Boolean with alphabetical ordering.**

**[DECIDED] "Me" is a profile record separate from `contacts`** — a single-row profile
table holding the user's name and photo. `contacts` continues to mean "other people," so no
query must remember to exclude the user.
**[REJECTED] A `contacts` row flagged `is_self`** — every query would need `WHERE
is_self = 0`, and one omission puts the user in their own digest, notifications, or decay
list.

**[DECIDED] The orrery's sun is assignable — to the user, or to any contact.** *Owner's
extension.* Default is the user. `sun_contact_id` is a nullable setting (NULL = self), not
a column on `contacts`.
Rationale (owner's): someone may want their partner at the centre.
**Widens HANDOFF §7**, which decided "Sun at centre, carrying the user's own profile photo."
It does not reverse anything §7 decided — the sun still exists and still carries a photo —
but whose photo is now configurable. Flagged to the owner before recording. The separate
profile record above is still required, since self remains the default.

**[DECIDED] Ring ordering uses `created_at` as the general tiebreaker, with an optional
user-set `ring_seq` override.** *Owner asked for both.* `created_at` is needed anyway
(archive/purge sweeps, history retention, export), so the default tiebreaker is free and
deterministic, and rings close their gap automatically when a contact is archived.
**[REJECTED] Contact id / insertion order alone** — same result, but leans on an
implementation detail that export/import would have to preserve to keep the orrery stable.
**[DECIDED] The sun glows the status colour of whoever occupies it, and has no ring.** No
duplication, no lost information, and the status of the person you care most about sits at
the most prominent point on screen.
**[REJECTED] A decorative sun with the contact also orbiting normally** — the same person
appears twice and reads as a bug. **[REJECTED] A purely decorative sun** — loses that
contact's decay from the orrery entirely.

**[DECIDED — REVERSES HANDOFF §7] `ring_seq` is a GLOBAL override: any contact may be placed
at any radius, independent of frequency.**

> ⚠️ **This reverses a recorded decision.** HANDOFF §7 decided: *"Rings are ordered by
> frequency, so `Daily` contacts sit innermost and `Yearly` outermost, and radius continues
> to read as 'how close this person is meant to be.'"* The owner was shown that this option
> reverses that half of §7, chose it explicitly, and gave his reasoning.
>
> **What dies:** radius no longer encodes frequency; "Daily innermost → Yearly outermost"
> no longer holds.
> **What survives untouched:** every contact still gets their own ring so no two share a
> radius; angular position still encodes progress through the contact interval; status is
> still encoded without altering motion; elliptical off-screen orbits; tap-to-freeze.

Owner's rationale, which is the stronger model: **emotional closeness is not contact
frequency.** A cousin spoken to monthly may sit closer than an old coworker texted
fortnightly. §7 implicitly assumed the two were the same axis; they are not.
**[REJECTED] `ring_seq` breaking ties only within a frequency band** — preserves §7 but
locks the user into bands, which is exactly the constraint the owner rejected.
**[REJECTED] Dropping `ring_seq`.**
*Consequence for domain 9 (`orrery`):* frequency now has no visual encoding on that screen.
Whether it needs one is an orrery decision, not a data decision — exported below.

### Cluster F — The fixed-column boundary

Which plugin frontmatter keys earn a fixed column on `contacts`, given that §14 custom
fields can express most of them. The test applied throughout: **a field earns a fixed column
if something that must not break reads it** — a filter, the AI prompt, the status engine,
the importer, or a notification. Custom fields can be quarantined or deleted by the user.

**[DECIDED] `social_battery` (Charger / Neutral / Drain) stays a fixed column**, values
unchanged. It is read by the dashboard's "Chargers Only" filter (`ContactGrid.tsx:57-58`)
and fed to the AI prompt (`AiService.ts:108`) — neither may depend on a user-deletable
field.
**[REJECTED] Demoting it to a custom field**; **[REJECTED] cutting it from v1**;
**[REJECTED] renaming the values** (the owner kept "Drain").

**[DECIDED] `birthday` is a fixed column with an optional year.** The plugin stores either
`MM-DD` or `YYYY-MM-DD` — two formats in one field, parsed in two places. Formalised to one
column with one parser and a nullable year, because the day is often known when the year is
not (§14.7 makes the same observation).
**[REJECTED] Requiring the year** (would unlock age and "turning 40," but forces a guess);
**[REJECTED] custom field only**; **[REJECTED] no birthday data in v1** — the importer would
have discarded vault birthdays in the meantime.
*Note:* whether birthday **alerts** ship at all is HANDOFF open question #7 and belongs to
domain 14 (`digest`). This decision only gives the data a home.

**[DECIDED] Default ring arrangement is frequency, then `created_at`.** Applies to every
contact the user has not explicitly placed — everyone on day one, and every new contact
after.
This recovers most of what the §7 reversal gave up: §7's model survives as the **sensible
default** rather than as a law. Daily innermost, Yearly outermost, until the user moves
someone. The global override stays opt-in.
**[REJECTED] `created_at` only** — honest but arbitrary-looking on day one.
**[REJECTED] Forcing placement at creation** — adds a required step to the flow the product
exists to keep cheap.

**[DECIDED] `contact_link` survives as a fixed column AND becomes actionable** — tap to open
in the browser or the relevant app. *Owner chose to build what the plugin only implied.*
In the plugin this was dead data (F8): written, prefilled back into its own edit form, and
read by nothing else. It now earns its column by having a real reader.
**[REJECTED] Dropping it** (the orchestrator's recommendation — phone/email cover the
actionable cases and §14 text fields cover the rest).
**[REJECTED] Keeping it as inert storage.**
*Exported to domain 6 (`crud`) and domain 8 (`dashboard`):* this competes with `phone` and
`email` for the same "reach them" job, so the three need a coherent presentation.

### Cluster G — Data safety posture

**[DECIDED] `android:allowBackup="false"`, paired with a first-class user-driven export.**
Recorded as load-bearing so it is never "fixed" back to the template default.

Verified against Android's current documentation during this session: `allowBackup` is a
**build-time manifest attribute with no runtime API** — an app cannot let a user toggle it,
and the only user-facing control is device-wide in Android Settings. The literal hybrid the
owner asked for does not exist.

The export feature *is* the hybrid: the user explicitly exports an (optionally encrypted)
file and places it wherever they choose — Drive, Nextcloud, local, nowhere. Fully opt-in,
visible, verifiable, on demand, and no native code. It is already HANDOFF §3's `[OPEN]`
item and §8's anti-lock-in differentiator.

**[REJECTED] `allowBackup="true"` with a custom `BackupAgent` gated on a user setting** —
a genuine technical hybrid, and the custom dev client the widget already requires means the
config plugin is no new constraint. Rejected because it is opaque to the user and Android
only runs it on idle + charging + wifi + 24h elapsed, with a 25 MB cap, so it may never run
at all — an unreliable backup is worse than a known absence of one.
**[REJECTED] Plain Auto Backup** — puts third parties' private notes and phone numbers in
Google Drive by default, which is precisely the argument §3 used to reject cloud storage.

**[DECIDED — owner] Every migration version step is wrapped in a transaction, for
per-step atomicity.** *Owner-originated: he specifically wanted rollback-ability here.*

If the v4 step throws halfway, SQLite rolls v4 back entirely and the device sits cleanly at
v3 with `user_version` unchanged, so the next launch retries v4 from a known state. This
works because SQLite's DDL is transactional — verified empirically during this run by
rolling back a `DELETE` + `ALTER TABLE … DROP COLUMN` pair and observing the column return.

**Scope, stated precisely:** this is *per-step atomicity*, **not** down-migrations.
Deliberately going v4 → v3 remains impossible, and HANDOFF §3 `[DECIDED]` migrations are
forward-only. Nothing here reverses that.

This also corrects HANDOFF §3's inaccurate claim that expo-sqlite ships a `user_version`
helper (F16.2). It ships a docs *example* that runs statements in autocommit and writes
`user_version` last, outside any transaction — so a mid-migration throw leaves the database
half-migrated with the version unchanged, and the next launch re-runs from the top and
wedges permanently. Given "no remote access to a user's database," that failure is
unrecoverable for that user. No Expo guidance on transaction-wrapping exists either way.

**Consequence, and it is sharp:** the database lives at `/data/data/<pkg>/files/SQLite/` and
is **deleted on uninstall** (F15). With `allowBackup="false"` and no export feature yet, a
lost, wiped or reset phone is total, unrecoverable loss. **This promotes HANDOFF §3's
`[OPEN]` backup question from nice-to-have to urgent** — see the constraint exported to
domain 15.

---

## Cross-domain constraints exported

- **[data → fields]** `col_name` must be **constructed from a whitelist, never escaped**.
  Identifiers cannot be parameter-bound, and naive double-quoting was demonstrated
  insufficient (a label of `a" TEXT; DROP TABLE ccv; --` executed and dropped the table).
  §14.9's label→slug function does not exist in the plugin and must be written new — F16.3.
- **[data → fields]** The importer is a **second, untrusted producer of `col_name`**; §14
  assumed the field editor was the only one. Vault keys permit hyphens (`loader.ts:133`), so
  `contact-link` is a legal vault key and an illegal bare SQL identifier — F17.
- **[data → fields]** Contact purge destroys that contact's `field_history` rows. This
  *scopes* §14.6 to field-level operations; it does not reverse it.
- **[data → import]** Replace `loader.ts`'s frontmatter parsers, do not reuse them — they
  cannot read the plugin's own `tags:` block-sequence output (F18). Resolves a domain-5 open
  question in advance.
- **[data → import]** Vault contacts with no `last_contact` import with it genuinely empty
  and land on the never-contacted screen. Do not fabricate a touchpoint.
- **[data → import]** `category` maps to the seeded `categories` table; unmatched values
  create new rows rather than falling into an "Other" bucket.
- **[data → log]** Interaction rows carry a **local datetime** (not a date), a nullable note,
  and their own channel. Rows are fully editable including date/time, and those edits change
  status. `contacts.last_contact` is recomputed as MAX over current row values after every
  insert, edit and delete.
- **[data → log]** Every touchpoint from every route inserts a row — including widget and
  notification one-taps. Exactly one DAO function may write `last_contact`.
- **[data → crud]** The create form asks when you last spoke, defaulting to today, with an
  explicit "not yet / don't know". Duplicate names warn but do not block.
- **[data → crud]** `phone`, `email` and an actionable `contact_link` compete for the same
  "reach them" job and need a coherent presentation.
- **[data → crud]** Archive is the delete affordance; purge is a separate, explicit action.
- **[data → dashboard]** Dashboard queries carry `WHERE last_contact IS NOT NULL`.
  Never-contacted contacts get their **own dedicated screen** — new product surface, not in
  INDEX.md's original domain list.
- **[data → dashboard]** A continuous progress value is available, so sorting can be granular
  *within* a status bucket, not just between buckets.
- **[data → orrery]** `ring_seq` is a **global** radius override — HANDOFF §7's
  frequency-ordered radius is now only the default. **Frequency therefore has no visual
  encoding on the orrery; decide whether it needs another one.**
- **[data → orrery]** The sun is assignable to the user or any contact, and glows that
  subject's status colour with no ring of its own. Never-contacted contacts are excluded
  from the orrery.
- **[data → widget]** Favourites are **ordered** via a nullable rank column — tiles hold
  position. A widget tap writes a full interaction row, not just a date.
- **[data → notify]** Never-contacted contacts must not fire decay notifications (they have
  no progress value). Snooze suppresses notifications while the clock keeps running. The SMS
  composer reads `contacts.phone`.
- **[data → digest]** `birthday` exists as a fixed column with an optional year. Whether
  birthday alerts and the weekly digest ship at all remains HANDOFF open question #7.
- **[data → ai]** The prompt's interaction channel must come from the **newest interaction
  row**, never a contact-level column — this is the fix for F5, where the app's sole network
  egress asserts a fresh date paired with a stale channel.
- **[data → ai]** `category` is a stable foreign key, safe for `{{category}}` to depend on.
- **[data → backup]** **Export is now load-bearing, not optional.** `allowBackup="false"`
  plus deletion-on-uninstall means it is the only thing standing between a wiped phone and
  total loss. Export must cover: contacts, interactions, the `categories` table, the separate
  profile record, `ring_seq`, favourites rank, custom field defs and values, and (decide)
  `field_history`.
- **[data → photos]** `photo` is a nullable path column; purge must delete the file on disk,
  which no foreign key can reach.

---

## Deferred to phase discussion

Real questions at the wrong altitude — they need implementation context that does not exist
yet. `/gsd-discuss-phase` should inherit these.

- Snooze preset lengths for mobile (the plugin hardcoded 7 and 30 days on a right-click
  menu); whether an active snooze is visible on the profile; whether expired snoozes are
  retained as history (the plugin discards them, so snooze history does not exist).
- The never-contacted screen: name, placement in navigation, whether it carries a count
  badge, and whether archived contacts appear there.
- Whether frequency needs a non-radius visual encoding on the orrery, now that `ring_seq`
  has taken radius over.
- Whether `ring_seq` renumbers or leaves a gap when a contact is archived or purged.
- How `phone`, `email` and the newly-actionable `contact_link` present together without
  three competing "reach them" affordances.
- Whether the continuous progress value is ever surfaced to the user as a number or bar
  (owner declined for now; taste call, revisitable).
- A dashboard sort toggle for where never-contacted entries land — owner raised it and
  deprioritised it as too complex for the value. Recorded in case they ever appear there.

---

## Deferred to phase planning

Structural implementation detail with no owner-visible ripple. This is the hand-off to the
planner/researcher.

- Migration-1 scope and table split — which tables ship in the first migration versus later
  ones. Note `created_at` and `ring_seq` **cannot be backfilled truthfully** and must be
  present from the start.
- Exact DDL: column types, nullability, constraint choices, foreign key declarations.
- The single-writer DAO's signature and transaction boundaries.
- The precise recompute-MAX trigger points across the insert, edit and delete paths.
- Launch-sweep implementation covering quarantine expiry, history retention, and archived
  contact purge in one pass.
- An on-device benchmark of the newest-interaction-per-contact query (the scale estimate
  given to the owner was calculated, not measured).
- The birthday parser handling an optional year, and the importer's handling of the
  plugin's two formats.
- Replacement frontmatter parsers for the importer.
- An on-device probe confirming SQLite's `'localtime'` modifier behaves on Android/bionic
  (verified on this host via glibc only).

---

## Decisions made without you

Orchestrator's picks on items that failed the divergence test or had no real alternative.

**Read each entry as the decision AS ADOPTED, stated in the affirmative** — not as a
proposal, and not as something being overturned. "Never stored" means the value is derived
and that is now the rule. These are settled; they are listed separately only to mark that
the owner was not asked. If he disagrees with one, it changes.

1. **`contacts` gets a surrogate primary key.** Identity is never a name or a path. No
   alternative survives contacts owning child rows (F1).
2. **`status` is never stored** — computed at query time. Storing it rots silently (no
   trigger fires on a date change) and an expression index is illegal. Free at this scale.
3. **`daysSince`, `daysUntilDue` and progress are likewise never stored** — all derived.
4. **`interactions` is indexed on `(contact_id, date DESC)`.** CLAUDE.md's index ban applies
   only to `contact_custom_values` columns, and only because `DROP COLUMN` fails on indexed
   columns.
5. **`tags` is dropped.** The plugin's membership tag exists only to identify contact files
   inside a vault; the `contacts` table *is* the membership.
6. **`PRAGMA foreign_keys = ON` in `onInit`, before any transaction opens.** Off by default
   and a silent no-op inside a transaction — without this every `ON DELETE CASCADE` is
   decorative (F15).
7. *(Promoted out of this list — see "Migration crash-safety" under cluster G. The owner
   confirmed this was his intent, not an orchestrator pick.)*
8. **Dates use `date('now','localtime')`, never `date('now')`.** The `toISOString()`
   off-by-one exists in SQL too, and is easier to write by accident.
9. **`formatLocalDate()` remains the only date formatter on the TypeScript side.**
10. **`photo` is a nullable TEXT path column** on `contacts`.
11. **Archived contacts are excluded from every normal query** via an `archived_at IS NULL`
    predicate.

---

## Cross-domain constraints exported

*(populated at wrap-up)*

---

## Deferred to phase discussion

*(populated at wrap-up)*

---

## Deferred to phase planning

*(populated at wrap-up)*

---

## Decisions made without you

*(populated at wrap-up — veto any of these cheaply at review)*

---

## Findings

Investigation conducted 2026-08-11. Orchestrator read the plugin source for this domain in
full; four subagents produced workpapers in `workpapers/01-data/`. **Every claim below was
verified first-hand against the file cited**, per CLAUDE.md "Review the code, not the diff."

### F1 — There is no stable identity anywhere in the plugin

No UUID, no created-at, no hash. The index is keyed by mutable `file.path`
(`OrbitIndex.ts:78`); the display name is `file.basename` (`OrbitIndex.ts:149`) and is
deliberately never written to frontmatter (`ContactManager.ts:130`). Rename is lossless
**only because the index holds nothing but derived data** — a property that dies the
instant contacts have children rows in SQLite. This is the strongest argument in the
source for a surrogate key.

The edit form *does* rename the file (`OrbitHubModal.ts:155-162`), with four defects in
eight lines: no sanitization (create sanitizes via `paths.ts:15-17`, edit does not, so
**create and edit disagree on what a legal name is**), no collision check, a positional
`String.replace` on the path (mis-targets when a folder shares the contact's name, e.g.
`People/Dad/Dad.md`), and the category folder is never reconciled.

Names are not unique and nothing detects it. `LinkListener.findContactByName` is a
first-match-wins lowercased linear scan in filesystem order (`LinkListener.ts:88-100`).

### F2 — The plugin has no contact deletion or archival at all

Grepped repo-wide: `handleFileDelete` only *reacts* to Obsidian deleting a file
(`OrbitIndex.ts:285-291`); there is no delete affordance in the Hub action bar or the card
context menu (`ContactCard.tsx:78-143`). `Archive` appears only as an ignored-path default
string (`settings.ts:54`). Vault file lifecycle was Obsidian's problem; SQLite makes it
ours. Two cascade targets a foreign key cannot reach: the photo file on disk and any
scheduled notification.

### F3 — Four writers of `last_contact`, and they disagree

| Writer | `last_contact` | `last_interaction` | log entry |
|---|---|---|---|
| Full update flow (`OrbitHubModal.ts:200-214`) | ✅ | ✅ | only if a note was typed |
| Quick action (`ContactCard.tsx:146-161`) | ✅ | ❌ | ❌ |
| Tether / link listener (`LinkListener.ts:147-157`) | ✅ | ❌ | ❌ |
| Snooze / unsnooze (`ContactCard.tsx:163-197`) | ❌ | ❌ | ❌ |

The log append is gated on a non-empty note (`OrbitHubModal.ts:206`) — pinned as intended
by `test/unit/modals/orbit-hub-modal.test.ts:652-671`. Tap Update, choose "text", save
without typing: the scalars move and no record of the interaction exists. **The log is
therefore sparse by design and can never be a source of truth for recency.**

The log is also entirely **write-only** — zero readers in `src/`. A profile history view,
cadence analytics, or AI-from-log is new product surface, not a port.

### F4 — A second, distinct date bug (not the known UTC off-by-one)

`handleSave` writes the user's chosen date to frontmatter (`OrbitHubModal.ts:201`), then
calls `appendToInteractionLog`, which stamps the line with `formatLocalDate()` evaluated
internally (`ContactManager.ts:188`) — the signature has no date parameter. **Every
backdated entry contradicts itself on disk.** There is also no monotonic guard, so
backdating moves `last_contact` *backwards* and flips status.

### F5 — The AI feature ships an incoherent fact to a third party

`AiService.ts:98-101` composes `${dateStr} (${type})` from `last_contact` and
`last_interaction` — two independently-updated columns — and presents it as one fact. After
any quick action, it asserts a new date paired with a months-old channel. This is the
app's sole network egress (HANDOFF §3).

### F6 — Category is incoherent four ways

The built-in form offers exactly four options (`new-person.schema.ts:22-28`:
Family/Friends/Work/Community). `ContactGrid.tsx:11-24` groups display into three sections
plus "Other" using eleven different tokens. The four form values collapse into only two
sections (Family/Friends → §1; Work/Community → §2), so a user who separates Work from
Community sees them silently merged. The "Service" section and the "Other" bucket are
unreachable from any built-in form — 7 of 11 tokens are dead.

`category` is never validated on read (`OrbitIndex.ts:150` raw passthrough) — notably
`frequency` *is* validated two lines above (`OrbitIndex.ts:122-125`). A YAML
`category: 2024` parses as a number and crashes the grid at `ContactGrid.tsx:31`
(`.toLowerCase()` on a number). Category is also baked into the vault file path at creation
(`ContactManager.ts:106-110`) and never reconciled on edit, so path and category drift.

### F7 — The docs describe features the code does not have, and the drift reads as intent

- `docs/Sidebar View.md:38-40` documents a **category filter** and a **3-way battery
  filter**. `OrbitHeader.tsx:46-55` has All / Chargers / Needs-Attention only.
- `docs/Orbit Hub.md:21` documents a **category badge** on each card.
  `ContactCard.tsx:266-304` renders avatar + name only.

Per CLAUDE.md, trust the code — but read as a wish list, this is input for domain 8.

### F8 — Dead data in both directions

- `contact.fuel` is read (`FuelTooltip.tsx:61-62`) and **never written** by
  `parseContact` (`OrbitIndex.ts:147-161`) — a permanently dead branch. Do not port it as
  a working design.
- `daysUntilDue` and `snoozeUntil` are computed and surfaced to the user **nowhere** — yet
  `daysUntilDue` is exactly the value the orrery's angular encoding needs, so that feature
  has no UI precedent to port.
- `contact_link` is a real 7th field on both built-in schemas
  (`new-person.schema.ts:65`, `edit-person.schema.ts:65`) that round-trips only its own
  edit form (`OrbitHubModal.ts:118`). Never rendered, never opened, absent from
  `OrbitContact` and the state dump. INDEX.md's key list omits it entirely.

### F9 — Status is already stale in the plugin, and cannot be indexed on mobile

There is **no `setInterval` anywhere in `src/`** — status is frozen at parse time and only
refreshes when a file changes. Storing `status` in SQLite silently rots the same way (no
trigger fires on a date change). An expression index is illegal — SQLite rejects
non-deterministic `julianday('now')` in `CREATE INDEX`. So `ORDER BY status` must be a
query-time `CASE` over a full scan, which is free at 7–15 rows (HANDOFF §10). The
indexable alternative, if ever needed, is storing `due_date`.

### F10 — Never-contacted contacts are born red, and NULL/Infinity is a live port bug

`calculateStatus(null, …)` returns `"decay"` (`types.ts:102-103`). The plugin never hits
this because creation always seeds `last_contact` to today
(`ContactManager.ts:136-138`) — but the importer can, and a derived-recency model would
hit it for every new contact. `calculateDaysSince` returns `Infinity`
(`types.ts:131-137`), harmless in string templates; in SQL the equivalent is NULL, which
sorts **last** and is **excluded** by `WHERE daysSince > x` — dropping the most-overdue
contacts from the exact filter meant to find them.

### F11 — Snooze is an afterthought in the plugin

No field on either schema. Written only by a right-click menu with hardcoded 7- and 30-day
presets (`ContactCard.tsx:93-109`); unsnooze *deletes* the key (`:189`). `snoozeUntil` is
discarded on read once past (`OrbitIndex.ts:158`), so snooze history does not exist.
`snoozeUntil > new Date()` (`OrbitIndex.ts:134`) compares against local midnight, so
"snoozed until today" evaluates as **not snoozed**. Snooze never touches `last_contact`,
so decay keeps accruing underneath — un-snoozing drops you straight into red.

### F12 — The one feature the owner planned and never built is a data-model decision

`docs/Feature Priority List.md:96` — *"**[ ] Health Score** — Add 0-100% health score for
granular status sorting. (Math TBD)"* — the sole unchecked item in Phase 6. HANDOFF §7's
orrery encodes angular position as progress through the contact interval, which **is** that
number. The two features are the same computation.

Item 29's rationale is also unbuilt: `last_interaction` was tracked "for variety
suggestions" — nothing consumes it that way.

### F13 — Three fields the mobile product needs that have no predecessor

1. **Favourites** for the widget (HANDOFF §6). Grepped repo-wide: zero hits for
   favourite / pin / star. Net-new.
2. **The user's own record** — the orrery's sun carries the user's photo (HANDOFF §7,
   [DECIDED]). `OrbitContact` is the only entity in the plugin; settings hold config, not
   identity. There is nowhere for "me" to live.
3. **A phone number or reach method.** HANDOFF §6 [DECIDED] requires a decay notification
   to open the SMS composer for that contact. **No phone number field exists anywhere in
   the plugin** — `contact_link` is a free-text URL that nothing acts on. The single
   most-cited friction-reduction feature has no schema behind it.

### F14 — Orrery ring assignment needs a tiebreaker that cannot be reconstructed later

HANDOFF §7 [DECIDED]: every contact gets its own ring, ordered by frequency. But frequency
does not produce a total order — several of the owner's seven contacts share "Monthly",
and per-contact rings exist precisely so no two share a radius. A stored tiebreaker
(`created_at` or an explicit sequence) is therefore a **migration-1** decision: it cannot
be backfilled truthfully once rows exist.

### F15 — Platform verification (expo-sqlite), current as of 2026-08-11

Verified against the published artifact, not docs alone. Independently re-confirmed by the
orchestrator: `expo-sqlite@57.0.1`, `expo@57.0.12` (Expo SDK 57, RN 0.86), bundled SQLite
**3.50.3** at `package/vendor/sqlite3/sqlite3.h`.

**Risks closed:**

- **HANDOFF §14 is safe.** expo-sqlite vendors its own SQLite on *both* platforms (Android
  CMake and the iOS podspec compile the identical `vendor/sqlite3/sqlite3.c`, symbols
  renamed `exsqlite3_*` so it cannot link against Android's system library). 3.50.3 clears
  the 3.35.0 `DROP COLUMN` floor everywhere; minSdk is irrelevant. All three `ALTER TABLE`
  forms verified working. The old "Android uses the OS SQLite" hazard is closed.
- §14.5 atomicity verified empirically — `DELETE` + `DROP COLUMN` in one transaction rolled
  back completely.
- §14.11 verified — `DROP COLUMN` fails with an index present, succeeds after `DROP INDEX`.
  Note the failure surfaces at *drop* time (during the launch sweep), not at index creation.
- §14.2 `sortExpr()` justified — TEXT sort gives `10, 100, 9`; `CAST(v AS REAL)` gives
  `9, 10, 100`.
- The legacy `openDatabase` API was **removed** (not deprecated) in expo-sqlite 15.0.0 /
  SDK 52. The current async API has been stable for five SDKs.
- DB lives at `/data/data/<pkg>/files/SQLite/` — private, encrypted on Android 10+,
  survives app updates, deleted on uninstall. That makes HANDOFF §3's `[OPEN]`
  backup/export the only backstop against total loss.

**New constraints:**

- **`PRAGMA foreign_keys` is OFF by default**, per-connection, and a silent no-op inside a
  transaction. Orchestrator confirmed independently: `SQLITE_DEFAULT_FOREIGN_KEYS` appears
  only as a conditional inside the vendored source, never set in any build config, and the
  package contains no runtime `PRAGMA foreign_keys=ON`. **Every `ON DELETE CASCADE` in the
  schema is currently decorative** unless enabled in `onInit` before any transaction opens.
- `withExclusiveTransactionAsync` opens a fresh connection and issues `BEGIN` before the
  callback runs, with no hook to set a PRAGMA first — so foreign keys are unconditionally
  off inside every exclusive transaction. This *enforces* §14.5's "both statements
  explicitly, in one transaction"; it does not reverse it.
- `withTransactionAsync` masks errors: its `catch` issues an unconditional `ROLLBACK`,
  which itself throws `cannot rollback - no transaction is active`, discarding the original
  error. It also uses a DEFERRED `BEGIN` on the *shared* connection, so unrelated async
  queries join the transaction.
- **`'localtime'` is compiled in and correct** (including historical DST), but `date('now')`
  is UTC — **the `toISOString()` off-by-one exists in SQL too**, and is easier to write by
  accident. Status queries must use `date('now','localtime')`.
- `android:allowBackup="false"` in the Expo template is load-bearing for the product
  promise: if true, Android Auto Backup copies the contacts DB to the user's Google Drive.

### F16 — Corrections to HANDOFF.md (factual, not decision reversals)

1. **§4 and §14.8 say several files are "already ported."** `~/projects/orbit-app/src/`
   does not exist. Nothing has been ported. The port is still entirely ahead.
2. **§3 says "`expo-sqlite` ships a helper for this" (the `user_version` pattern).** It
   does not. It ships a docs *example* (`migrateDbIfNeeded` + `SQLiteProvider.onInit`), and
   that example is **not crash-safe** — statements run in autocommit and `user_version` is
   written last, outside any transaction. A mid-migration throw leaves the DB half-migrated
   with `user_version` unchanged, so the next launch re-runs from the top and wedges
   permanently. Given "no remote access to a user's database," each version step needs
   wrapping. No Expo guidance exists either way.
3. **§14.9 says to "salvage only `keyToLabel()` … for deriving `col_name` from a
   user-entered label."** `loader.ts:36-39` runs the opposite direction — key → label. The
   label → slug function §14 depends on **does not exist and must be written new**.
   `keyToLabel` is still salvageable, but for the *importer*, to label auto-created defs
   rows.

### F17 — The importer is a second, untrusted producer of `col_name`

HANDOFF §14 assumed the field editor was the only producer of custom-field column names.
The vault is a second one, and it is not sanitized: `loader.ts:133`'s key regex
`/^(\w[\w_-]*)\s*:\s*(.*)$/` **permits hyphens**, so `contact-link` is a legal vault key and
an illegal bare SQL identifier. Identifiers cannot be parameter-bound, so `col_name` must be
interpolated into §14.1's DDL and §14.2's `sortExpr()`. Naive double-quoting is
demonstrably insufficient — a label of `a" TEXT; DROP TABLE ccv; --` executed cleanly and
dropped the table. This needs whitelist **construction**, not escaping.

Related: `RESERVED_KEYS` (`loader.ts:23-29`) protects schema metadata only — not `tags`. A
user schema declaring `tags` overwrites the membership tag `ContactManager.ts:125` sets, and
the contact becomes silently invisible to the app.

### F18 — `loader.ts`'s parsers cannot parse the plugin's own output

`parseFrontmatter` (`loader.ts:120-157`) is single-line `key: value` only and cannot read a
YAML block sequence — i.e. exactly the `tags:` / `  - people` form that
`ContactManager.ts:125` writes and `docs/Getting Started.md:38-45` teaches. It would
classify every contact as untagged. This resolves an open question in domain 5 in advance:
**replace the parsers, do not reuse them.**

### F19 — Custom-schema contacts are permanently uneditable in the plugin

`handleEdit` always renders `editPersonSchema` with seven hardcoded prefill keys
(`OrbitHubModal.ts:111-123`), never the schema that created the contact. Unknown keys
survive on disk (merge-only, `ContactManager.ts:163-167`) but are unreachable through the
UI. HANDOFF §14.7 already fixes this by decree (the edit form always shows every
non-quarantined field).

### Workpapers

- `workpapers/01-data/overlap-log.md` — the `data` ↔ `log` seam
- `workpapers/01-data/overlap-read-side.md` — the `data` ↔ `dashboard` / `orrery` / `widget` seam
- `workpapers/01-data/overlap-identity-import-fields.md` — the `data` ↔ `import` / `fields` / `crud` seam
- `workpapers/01-data/platform-expo-sqlite.md` — platform verification, with URLs and versions
