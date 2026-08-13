# Workpaper — `crud` ↔ `data` / `log` / `fuel` seam

**Investigator seam:** contact identity, the create/edit/archive/purge flows, and where
per-contact settings get edited.
**Prepared for:** the `06-crud` interrogation session.
**Method:** every claim below was read first-hand off disk — the four dossier files
(`01-data.md`, `04-log.md`, `03-fuel.md`) and the plugin source at `~/projects/Orbit`.
Citations are file:line into the plugin or §/line into the dossiers. Nothing here decides;
each item is a design question with the tradeoffs and the recorded constraints that bound it.

**Decisions this seam MUST NOT reopen** (verified against source; flagged if any question
below brushes them):
- 01-data cluster A: surrogate PK; rename = metadata-only UPDATE; duplicate names WARN not
  block; ARCHIVE (hidden, restorable) is the delete affordance; PURGE is a separate explicit
  permanent action mirroring §14.5 quarantine (`01-data.md:28-55`).
- 01-data cluster B/A: PURGE destroys everything the contact owns incl. photo file +
  scheduled notifications (`01-data.md:84-93`); `[log → crud]` adds interactions + events
  explicitly (`04-log.md:620-623`); `[fuel → crud]` adds fuel rows explicitly
  (`03-fuel.md:418-420`).
- 01-data cluster C: create form asks last-contact defaulting today, with explicit "not
  yet / don't know" that leaves it genuinely empty (`01-data.md:140-150`).
- `[log → crud]`: answering that question MUST insert an interaction row; never-contacted
  predicate = zero interaction rows (`04-log.md:624-626`).
- 04-log: "Rarely responds" is a per-contact VISIBLE label on the profile
  (`04-log.md:415-421`, `:116-126`).
- 01-data cluster E/F: favourites rank nullable, `ring_seq` global override, `sun_contact_id`
  NULL=self, all per-contact/global state that must be edited somewhere
  (`01-data.md:255-312`).

---

## 1. Archive vs purge — the surfaces are unowned

**Recorded (semantics only).** 01-data settled: archive hides from every screen, data
untouched, restorable; purge is a "second, deliberate action" that is permanent
(`01-data.md:48-55`). It settled **nothing about where these live**. The plugin gives zero
help — verified `ContactCard.tsx:78-143`: the context menu is mark-contacted / snooze 1wk /
snooze 1mo / unsnooze / open note / open in new tab. **There is no delete or archive
affordance anywhere** (F2, `01-data.md:596-603`). The Hub edit form (`OrbitHubModal.ts:102-176`)
has no delete path either. So every archive/purge/restore surface is net-new.

**Open questions for the owner:**

- **Where does ARCHIVE live?** Candidates, non-exclusive: (a) the contact profile as a
  low-emphasis action; (b) inside the edit form as a destructive-zone button; (c) a
  list/grid swipe or long-press. Each has a cost: a swipe collides with the gesture budget
  the read-side domains are already spending (03-fuel notes long-press is the only analogue
  of the plugin's right-click quick actions, `03-fuel.md:265-269`); an edit-form button
  buries the most common lifecycle action two taps deep.
- **Where does PURGE live?** It is the one irreversible operation in the app
  (`01-data.md:53-55`). Reasonable model: purge is reachable **only** from an
  archived-contacts screen, never from a live contact — so you must archive first, then
  purge from the archive. That makes "permanent delete" a deliberate two-stage act by
  construction, matching the §14.5 quarantine model the decision explicitly mirrors. Confirm
  the two-stage gate is intended, or whether purge is also offered directly on a live
  profile.
- **What confirmation does PURGE get?** Nothing is recorded. Given no server, no backup, no
  remote repair (`CLAUDE.md`, `01-data.md:53-55`), and that purge fans out to FK-unreachable
  targets (photo file, scheduled notifications — `01-data.md:92-93`), this needs a stronger
  gate than a yes/no dialog. Type-the-name? A count of what will be destroyed ("12
  interactions, 4 fuel items, 1 photo")? Owner's call — it is a **risk-posture** decision,
  explicitly the owner's bucket per CLAUDE.md.
- **Is there a RESTORE/unarchive surface, and where?** Archive is "restorable"
  (`01-data.md:48`) but no restore affordance is designed. It presumably lives on the same
  archived-contacts screen. Note `04-log.md:348-360` already commits **restore is an event
  row** in the `events` table (archive/restore recorded there), and `:362-370` requires
  merge-not-replace on restore — so the restore *surface* has a data contract waiting for it.
- **Does an archived-contacts screen even exist as a surface, and is it the same as the
  never-contacted screen?** 01-data created an unowned "never-contacted screen"
  (`01-data.md:183-195`, `:437-439`) and **explicitly deferred** "whether archived contacts
  appear there" (`01-data.md:477-478`). This seam is where that gets decided: one
  special-population screen with two sections, or two screens? 04-log separately warns
  against proliferating special-population screens ("a third special-population screen, and
  out of sight is out of mind", `04-log.md:135-136`) — a signal the owner dislikes screen
  sprawl, which argues for folding archived + never-contacted into one "not on the dashboard"
  surface. Surface the question; do not decide.

**Consequence to flag:** `04-log.md:644-645` leaves open "whether an archived contact's clock
keeps running." If it does, restoring lands the contact in instant deep decay / `rogue`. That
is a data/log question but it **changes what the restore surface must warn about**, so crud
inherits it.

---

## 2. Rename — trivial on mobile, but the duplicate-warning parity question is real

**Recorded.** Rename is a metadata-only UPDATE (`01-data.md:28-32`); the plugin's 4-defect
file-rename (`OrbitHubModal.ts:156-162`: no sanitization, no collision check, positional
`String.replace` on the path, category folder never reconciled — F1) simply evaporates
because there is no file. Verified: create sanitizes via `sanitizeFileName`
(`paths.ts:15-17`, called from `buildContactPath` `:27-29`); edit does **not** — it does a
bare `contact.file.path.replace(contact.file.name, ...)` (`OrbitHubModal.ts:157-160`). On
mobile both defects are moot.

**The one edge worth a decision:** create WARNS on a duplicate name with a *Create anyway*
button (`01-data.md:34-38`). **Does editing a contact's name to collide with an existing one
warn the same way?** The plugin never checked either path (F1: "no collision check"). This is
a genuine asymmetry to close deliberately:
- Warn on edit-rename too (symmetry; the "you already have a Chris" logic is UI-only and
  cheap, `01-data.md:38`), OR
- Don't — renaming to a name you already have is arguably rarer and more intentional than
  fat-fingering it at capture.

Not a reversal either way (the decision only names create). Surface as a small explicit
choice so edit doesn't silently diverge from create the way the plugin's sanitizer did.

---

## 3. The create form's last-contact question — an atomic two-row write

**Recorded and load-bearing.** `[log → crud]` (`04-log.md:624-626`): answering "when did you
last speak" MUST insert an interaction row, because 01-data defines never-contacted as
"equivalently, zero interaction rows" (`01-data.md:189-190`) — a scalar-only `last_contact`
write would make a contact that reads as contacted (non-null scalar) but never-contacted (zero
rows), corrupting the predicate. The plugin does exactly the broken thing: it stamps
`last_contact = today` unconditionally at creation (`ContactManager.ts:136-138`) and writes no
log row (F10, `01-data.md:682-691`).

**The flow questions this raises:**

- **Create is a multi-row atomic transaction.** A "create" writes a `contacts` row **and**,
  when a last-contact date is given, an `interactions` row — in one transaction. 01-data
  already scopes `last_contact` to a single-writer DAO that "also inserts the corresponding
  `interactions` row, in the same transaction" (`01-data.md:59-61`). So the create form must
  route its last-contact answer *through that same DAO*, not write the scalar itself. Confirm
  the create path calls the single-writer, rather than a create-specific insert that would
  reintroduce F3's multi-writer drift.
- **"Not yet / don't know" is exactly the zero-rows path.** Choosing it must write the
  contact row and **no** interaction row, leaving `last_contact` genuinely NULL
  (`01-data.md:140-150`) → the contact lands on the never-contacted screen
  (`01-data.md:189-190`, `:422-423`). Confirm this is the intended semantics of that button
  and that it is visually distinct from "today" (the default) so the importer-less,
  hand-typed backlog case is honest.
- **`source` and `direction` on the synthesised row.** `04-log.md` requires `source` on every
  interaction row (`manual`|`widget`|`notification`|`ai`, `:340-345`). A create-form row is
  `source = 'manual'`. But **direction?** The full logging flow asks direction
  (`04-log.md:88-94`); one-tap routes write `outbound` (`:501-522`). The create form is
  neither — it's a backdated "we last spoke on X" with no stated direction. Likely `null`
  (unknown), but this is unspecified and feeds `gravity`/`intensity` (`04-log.md:604-606`).
  Small, but worth naming so the create row isn't silently defaulted to `outbound` and
  polluting the intensity signal.
- **Backdated create = a backdated `occurred_at`.** The last-contact answer is by definition
  a past date. `04-log.md:295-303` bans a *future* `occurred_at` at entry but allows unlimited
  backdating — so the create form's date picker must apply the same future-date rejection.

---

## 4. Reach-methods presentation (phone / email / contact_link) — a product question worth asking now

**Recorded.** All three are fixed columns: `phone`, `email` nullable (`01-data.md:237-244`);
`contact_link` survives AND becomes actionable — tap to open in browser/app
(`01-data.md:348-356`). 01-data **explicitly deferred to phase discussion** "how `phone`,
`email` and the newly-actionable `contact_link` present together without three competing
'reach them' affordances" (`01-data.md:482-483`, exported at `:434-435`). But the **create/edit
form must still collect all three** — the presentation question is downstream (dashboard/
profile), the *collection* question is crud's.

**The question for the owner:** on the CREATE/EDIT form specifically —
- Are phone / email / contact_link three separate labelled inputs, or is `contact_link`
  folded into a generic "links" area (it is, after all, a URL, and 03-fuel already built a
  `url` column + link rendering for fuel items, `03-fuel.md:90-96`)?
- Is `contact_link` even worth keeping as a distinct form field, or does its "actionable link"
  job overlap enough with fuel-item URLs and a future notes area that a single contact should
  have one "links" concept? Note: this brushes a `[DECIDED]` — `contact_link` "survives as a
  fixed column AND becomes actionable" (`01-data.md:348-356`, orchestrator's recommendation to
  DROP it was REJECTED). **Do not re-propose dropping the column.** The live question is only
  its *form presentation*, which is untouched by that decision. If the owner wants to fold its
  input into a links area, that is a UI grouping choice over the same column, not a reversal —
  but say so explicitly if raised.

This is worth asking now because the form is the first place a v1 user meets these three, and
the deferred "coherent presentation" problem is easier to answer once the owner has said what
the *edit* form looks like.

---

## 5. Where do favourites-rank, ring_seq, sun-assignment, and "Rarely responds" get set? — a real gap

**Recorded (the data exists; the editing surface does not).** Four per-contact-or-global
settings have a column but no designed home:

| Setting | Column / shape | Recorded at | Scope |
|---|---|---|---|
| Favourites rank | nullable `rank` on `contacts` | `01-data.md:255-260` | per-contact, ordered |
| `ring_seq` | global radius override, nullable | `01-data.md:278-283`, `:291-312` | per-contact, **global ordering** |
| Sun assignment | `sun_contact_id`, NULL=self | `01-data.md:269-276` | **global setting** (one value app-wide) |
| "Rarely responds" | per-contact flag, VISIBLE label | `04-log.md:415-421`, `:574-575` | per-contact |

None of these existed in the plugin (favourites: zero hits, F13 `01-data.md:713-714`; sun/
ring_seq/rarely-responds: all net-new). **Where each is edited is unowned.** The tradeoffs,
per setting:

- **"Rarely responds"** — most clearly crud/profile's to own. It is a per-contact **visible
  label** that "shows on the profile" and "carries its behaviour with it"
  (`04-log.md:116-126`). It changes recency math (filtered-MAX, `04-log.md:574-575`) so it is
  a real setting, not decoration. Natural home: the edit form and/or a profile toggle that
  renders the label inline (*"Rarely responds · attempts don't reset the orbit"*,
  `04-log.md:416-417`). Flag: it must NOT fold into the frequency picker — that was explicitly
  REJECTED ("one control carrying two unrelated ideas", `04-log.md:123-125`).
- **Favourites rank** — ordering, not a boolean (`01-data.md:255-260`). Editing an *order* is
  a different interaction from toggling a flag. Candidates: a drag-reorder on a "favourites"
  management screen; a long-press "pin / move up" on the dashboard; or set-on-the-widget-
  config. The widget domain (12) is the consumer (`01-data.md:448-449`) so this may belong
  there, not crud. Flag which domain owns it.
- **`ring_seq`** — a **global** radius override (`01-data.md:291-312`, which itself REVERSES
  HANDOFF §7 — do not reopen that). Reordering a global sequence is inherently an orrery-screen
  gesture (drag a body to a radius) far more naturally than a form field. `01-data.md:479-481`
  already defers "whether `ring_seq` renumbers or leaves a gap on archive/purge" to phase
  discussion — a signal this belongs to orrery (domain 9), not crud. Almost certainly **not
  crud's**.
- **Sun assignment** — a single **global** setting (`sun_contact_id`, `01-data.md:269-276`).
  "Set as centre of orbit" is a per-contact action but writes one app-global value. Candidates:
  a profile action ("make this person my sun"), or an orrery long-press, or app settings.
  Likely orrery's or settings', **not** the contact edit form (it is not a property *of* the
  contact — it is a property of the app that happens to point at a contact).

**The gap to surface:** three of these four are plausibly **not** crud's — they belong to
orrery (`ring_seq`, sun) and widget (favourites rank). Only "Rarely responds" is
unambiguously a contact-editing concern. The interrogation should assign owners rather than
defaulting them all into the edit form, because cramming a global orrery-ordering control and
an app-global sun pointer into a per-contact form is exactly the kind of category error that
produces an incoherent screen. **Do not decide — surface which domain each belongs to and let
the owner rule.**

---

## 6. Frequency picker — presets only, or custom interval?

**Recorded.** `interval_days` is stored as an integer; the seven named presets (Daily=1 …
Yearly=365, `types.ts:19-27`) "become a UI picker that writes the number," and "every 45 days
/ every 6 weeks becomes possible later with zero migration" (`01-data.md:206-214`). The
storage decision is closed. **What the v1 form exposes is not.**

**The question:** does the v1 create/edit form show —
- only the 7 named presets (simplest, matches the plugin's dropdown, `types.ts:19-27`), or
- the 7 presets **plus** a custom-interval entry ("every N days")?

The data model already supports custom intervals for free (`01-data.md:210-212`), so this is
purely a v1 UI-scope call, not a schema question. The decision phrasing ("becomes possible
*later*") leans toward **presets-only in v1**, but it is worded as a storage-future note, not a
v1-UI ruling — so it is genuinely open and worth a one-line confirmation rather than an
assumption. Note also: the picker writes `interval_days`, and orrery ring **default** ordering
sorts on it (`01-data.md:338-343`), so a custom interval slots into the default ring order
numerically with no extra work — no downstream blocker either way.

---

## Summary of what changes decisions (for the dossier)

The high-value items — those that would change a `[DECIDED]` shape or assign an unowned
surface — are §1 (archive/purge/restore surfaces + the archived-vs-never-contacted screen
merge), §3 (create is an atomic two-row write through the single-writer DAO; direction/source
on the synthesised row), and §5 (three of four per-contact settings are probably not crud's —
assign owners). §2 (edit-rename duplicate warning), §4 (contact_link form grouping), and §6
(custom interval in v1) are smaller explicit choices that prevent silent divergence.
