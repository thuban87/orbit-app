# Orbit Dossier — Pre-Roadmap Interrogation Index

This is the command surface for `/oa-interrogate`. Each domain below is one interrogation
session: deep investigation of the plugin source and platform constraints, then structured
questioning of the owner until the top-level decisions are firm. Output lands in
`docs/dossier/NN-slug.md` (HANDOFF-style `[DECIDED]` / `[OPEN]` / `[REJECTED]` tags).

Run: `/oa-interrogate <number|slug>` — e.g. `/oa-interrogate 1` or `/oa-interrogate data`.
No argument shows this status table and suggests the next pending domain.

When every domain the owner cares about is **complete**, run `/gsd-new-project` (skip its
domain-research step and decline its brownfield-mapping offer — the dossier replaces both).

**Status legend:** `pending` · `in-progress` · `complete` · `cut` (owner removed from v1)

| # | Slug | Domain | Status |
|---|------|--------|--------|
| 1 | `data` | Core contact schema & status engine | **complete** |
| 2 | `fields` | Custom fields | **complete** (HANDOFF §14) |
| 3 | `fuel` | Conversational Fuel — storage & interaction | **complete** |
| 4 | `log` | Interaction log & touchpoint updates | **complete** |
| 5 | `import` | Obsidian vault importer | **cut** (owner, 2026-08-12 — see `04-log.md`) |
| 6 | `crud` | Contact create/edit flows & forms | **complete** |
| 7 | `photos` | Photo handling | pending |
| 8 | `dashboard` | Dashboard screen | pending |
| 9 | `orrery` | Orbit view | pending |
| 10 | `capture` | Share-sheet capture | pending |
| 11 | `notify` | Actionable notifications | pending |
| 12 | `widget` | Home screen widget | pending |
| 13 | `ai` | AI message suggestions | pending |
| 14 | `digest` | Weekly digest & birthday alerts | pending |
| 15 | `backup` | Backup, export & data portability | pending |

Domains are numbered in recommended interrogation order — data-model decisions first,
because they cascade into everything downstream. Order is a default, not a law.

---

## 1. `data` — Core contact schema & status engine ✓

The SQLite schema for the `contacts` table and everything derived from it. In the plugin,
contacts are markdown files: **the filename is the identity**, frontmatter is the schema,
and Obsidian parses/watches/writes it all. None of that survives the move to SQLite, so
this domain decides: primary identity (and rename semantics), which frontmatter keys become
columns (`frequency`, `last_contact`, `snooze_until`, `category`, `social_battery`,
`last_interaction`, `birthday`, `photo`), whether categories stay the plugin's four
hardcoded buckets or become user data, and the migration-1 scaffold (`PRAGMA user_version`
from day one, per HANDOFF §3). The status math itself (`calculateStatus`, 80%/100%
thresholds, snooze override) is a pure function that ports verbatim.

- Plugin source: `src/types.ts` (191), `src/services/OrbitIndex.ts` (425)
- HANDOFF: §3 (data layer), §4 (port list), §14 (custom-fields tables live beside this)
- Likely overlaps: every other domain; heaviest with `fields`, `log`, `import`, `orrery`

**Complete — see `docs/dossier/01-data.md`.** 28 questions over 7 rounds; no `[OPEN]` items.
Note that this run **reversed HANDOFF §7's frequency-ordered orbit radius** (owner's
explicit call) and **added a new screen** for never-contacted contacts that no domain in
this index currently owns.

## 2. `fields` — Custom fields ✓

Fully decided in **HANDOFF §14** after a dedicated design session; the invariants are also
restated in `CLAUDE.md`. See `docs/dossier/02-fields.md` for the pointer. Only remaining
[OPEN]: quarantine window length / configurability (HANDOFF §14.5).

## 3. `fuel` — Conversational Fuel — storage & interaction

The product's core loop depends on this and it needs the most reinvention. In the plugin,
fuel is a `## Conversational Fuel` markdown section in the contact's note body, regex-parsed
into a 300ms-hover tooltip. On mobile: there are no note bodies (storage model — structured
rows? one text blob? per-item rows with source/date?) and there is no hover (interaction —
long-press? bottom sheet? card face?). Fuel is also what share-sheet capture (#10) attaches
to and what AI prompts (#13) consume, so its shape constrains both.

- Plugin source: `src/components/FuelTooltip.tsx` (321, incl. pure parsers), `docs/AI Features.md`
- HANDOFF: §1 (premise), §6 (capture attaches "as Conversational Fuel")
- Likely overlaps: `capture`, `ai`, `data`, `dashboard`, `notify`

**Complete — see `docs/dossier/03-fuel.md`.** 23 questions over 6 rounds; no `[OPEN]` items.
Fuel became **per-item rows** with five kinds, of which `off_limits` is never transmitted and
never glanceable. This run **interprets HANDOFF §6's "with their Conversational Fuel visible"**
(the literal reading is not buildable on Android) and **adds an in-app compose screen** that no
domain in this index owns. It also **declined a zero-egress AI mode** (no local provider on
mobile) and put **fuel on the larger widget size**, both owner calls with costs recorded.

## 4. `log` — Interaction log & touchpoint updates

"Mark contacted" is the single most-fired action in the app — it's the tap the whole
product exists to make cheap. Plugin behavior: update panel writes `last_contact` +
`last_interaction` to frontmatter and appends `- date: type: note` lines under a markdown
heading. Mobile needs: an `interactions` table (or equivalent), what a touchpoint records,
how history renders on the profile, and how the one-tap versions (widget, notification,
quick action) differ from the full update flow.

- Plugin source: `src/components/UpdatePanel.tsx` (137), `src/services/ContactManager.ts:182-217`
- HANDOFF: §1, §6
- Likely overlaps: `data`, `widget`, `notify`, `crud`, `ai`

**Complete — see `docs/dossier/04-log.md`.** 37 questions over 10 rounds; no `[OPEN]` items.
This domain also absorbed **`gravity`** and **`intensity`** (Cluster G) — the
accumulated-familiarity and contact-rate quantities the owner identified as the reason the
plugin became an app. They had no home in this index.
The touchpoint row gained three axes the plugin never had — **channel** (with a first-class
`unspecified`), **direction**, and **whether it connected** — plus an optional quality marker.
This run **cut domain 5 entirely** (owner: no vault data migration; code porting per HANDOFF §4
is untouched), introduced a **fourth status, `rogue`**, extending 01-data's threshold model,
added a **separate `events` table**, and put **stable ids on every user-data table** so a
restore can merge. Platform verification established that **both one-tap routes write to SQLite
headlessly** — and that a timed undo is broken on Android 14+. The owner also introduced a
**two-view orrery** concept that no domain owns.

## 5. `import` — Obsidian vault importer ✂ CUT

**Cut by the owner on 2026-08-12** during the `log` interrogation. He was the plugin's only
user, the vault remains on disk as reference, and the app starts clean with contacts entered by
hand. This drops HANDOFF §15's first-move **#4** only.

> **Do not confuse the two "migrations."** *Data* migration (vault files → SQLite) is cut.
> *Code* porting (HANDOFF §4's port list — `AiService.ts`, `calculateStatus()`, schema types,
> `formatLocalDate()`) is **untouched and still the plan.** The distinction is the owner's.

Consequences: `[data → import]` ×3 and `[fuel → import]` are moot; the `import` value should be
dropped from the fuel and interaction `source` enums; and 01-data's **F17** risk — the importer
as a second, untrusted producer of `col_name` — disappears entirely (whitelist *construction*
remains correct for the field editor regardless).

<details>
<summary>Original scope, retained for the record</summary>

The bridge from the old life to the new one, and the de-facto seed-data mechanism
(HANDOFF §15.4: "the existing vault files are effectively the schema specification").
Decides: how vault files reach the phone at all, what gets parsed (frontmatter per the
known key set, fuel section, interaction log, photos in three formats, unknown frontmatter
keys → custom fields?), one-shot vs re-runnable, and collision/error behavior. The plugin's
pure frontmatter/YAML parsers (~250 lines) are portable but hand-rolled — decide whether to
reuse or replace them.

- Plugin source: `src/schemas/loader.ts` parsers, `src/services/OrbitIndex.ts:parseContact`
- HANDOFF: §15.4
- Likely overlaps: `data`, `fields`, `fuel`, `log`, `photos`

</details>

## 6. `crud` — Contact create/edit flows & forms

Add-person and edit-person, rebuilt as native screens driven by the schema-renderer
pattern. The plugin's `FormRenderer` (316 lines, 7 field types) ports structurally; the
markdown-file plumbing around it dies. Decides: create flow (what's asked up front vs
later, per HANDOFF §14.7 `show_on_new`), edit flow, validation-at-entry rules (§14.3),
delete/archive semantics for whole contacts (the plugin has none — vault files were the
user's problem; SQLite makes it ours).

- Plugin source: `src/components/FormRenderer.tsx`, `src/schemas/*.schema.ts`, `src/services/ContactManager.ts:57-146`
- HANDOFF: §14.3, §14.7, §14.8
- Likely overlaps: `fields`, `data`, `photos`, `log`

**Complete — see `docs/dossier/06-crud.md`.** 12 questions over 4 rounds; no `[OPEN]` items.
The create form is a **lean five-field set** (name, category, frequency, last-spoke, phone);
custom fields render as a block after the fixed columns; defining a field stays a **settings
trip** (no inline DDL from the form). This run **reversed 01-data** on `contact_link` —
the owner chose **many links in a `contact_links` child table**, phone/email staying single
columns. Contact lifecycle got its surfaces: **archive on the profile, purge+restore only from
a dedicated Archived list** (two-stage), purge gated by an **impact-summary confirm**;
never-contacted and archived are **separate homes**. Three net-new settings were **assigned
away from this domain** — favourites rank (widget/dashboard), `ring_seq` and sun (orrery) —
leaving only **"Rarely responds"** (edit form + profile label) here.

## 7. `photos` — Photo handling

The plugin resolves photos three separate times with divergent behavior (URL / wikilink /
vault path) and scrapes URLs to disk with re-entrancy guards. Mobile replaces all of it:
native image picker with local file storage (HANDOFF §14.3), one resolution path, the
initials-avatar fallback (deterministic HSL hash — ports), storage location/sizing, and
what the importer does with the vault's existing photo references.

- Plugin source: `src/utils/ImageScraper.ts` (151), `src/components/ContactCard.tsx:241-264`
- HANDOFF: §14.3 (photo field), §4 (ImageScraper listed as delete)
- Likely overlaps: `import`, `crud`, `data`, `dashboard`

## 8. `dashboard` — Dashboard screen

The everyday working screen (HANDOFF §7: distinct from the orrery, do not merge). Owner
intends to design the card/grid layout directly with an agent (HANDOFF §12.4), so this
interrogation settles the *operational* skeleton: what a card shows, sort/filter/group
model (plugin has status/name sort, charger/decay filters, four category buckets — and its
docs disagree with its code here; trust code), where fuel surfaces, birthday banner
placement, offline-render guarantee.

- Plugin source: `src/components/ContactGrid.tsx`, `OrbitHeader.tsx`, `ContactCard.tsx`, `BirthdayBanner.tsx`
- HANDOFF: §7, §12.4
- Likely overlaps: `fuel`, `data`, `photos`, `digest`, `orrery`

## 9. `orrery` — Orbit view

Mechanics are largely settled in HANDOFF §7 (per-contact rings, angular position = interval
progress, elliptical off-screen orbits, status without motion-changes, tap-to-freeze,
Skia + Reanimated, pause off-focus). Interrogation confirms the remainder: the piecewise
angle-to-time mapping, tap-target sizing, what tapping a body opens, sun/self handling,
and what the screen does at 0–2 contacts. Perf claims are physical-device-only (CLAUDE.md).

- Plugin source: none — this feature has no predecessor
- HANDOFF: §7 (mostly DECIDED, one REJECTED alternative recorded)
- Likely overlaps: `data`, `dashboard`, `theme` tokens (via CLAUDE.md conventions)

## 10. `capture` — Share-sheet capture

Zero-friction capture is why the plugin fell out of use and this exists (HANDOFF §6).
Register Orbit as an Android share target: share text/link → pick contact → lands as
fuel. Decides: accepted payload types, the pick-contact flow (speed is the whole point),
what gets stored (URL vs fetched title vs raw text), and the Expo mechanics (config
plugin / custom dev client implications — needs current-docs verification).

*(Corrected by domain 3: this line read "text/link/image". **Images are out of scope** —
HANDOFF §6 says "a link, article, or text" and the index had widened it with no decision
behind it. No `image/*` intent filter. Much of the rest is now settled — see `03-fuel.md`'s
`[fuel → capture]` constraints, including the required `EXTRA_SUBJECT` patch.)*

- Plugin source: conceptual heir to `src/services/LinkListener.ts` (deleted; Obsidian-shaped)
- HANDOFF: §6 (share-sheet DECIDED)
- Likely overlaps: `fuel`, `notify`, `crud`

## 11. `notify` — Actionable notifications

Local notifications that collapse reminder and action into one tap: decay alert → SMS
composer with fuel visible (HANDOFF §6 DECIDED). No backend and no scheduler daemon, so
decides: when decay checks actually run (launch sweep? scheduled local notifications
computed ahead?), notification actions and their limits on Android, the SMS-composer
handoff (what "fuel visible" concretely means), snooze-from-notification, and quiet-hours/
frequency-of-nagging policy.

- Plugin source: none (Obsidian had no notifications)
- HANDOFF: §6
- Likely overlaps: `fuel`, `log`, `data`, `digest`, `widget`

## 12. `widget` — Home screen widget

Favourites grid; tap = preset action (primary: mark contacted), long-press = deep link
(HANDOFF §6). Hard constraints: `react-native-android-widget`, custom dev client, **no
text input possible in a widget**. Decides: the exact preset action set (HANDOFF open
question #3), grid size/selection of favourites, staleness/update cadence, and the stretch
goal (widget self-updating into a profile view) in or out.

- Plugin source: none
- HANDOFF: §6, §12.3; CLAUDE.md widget note
- Likely overlaps: `log`, `notify`, `data`, `photos`

## 13. `ai` — AI message suggestions

`AiService.ts` (540 lines, 5 providers) ports nearly as-is — swap `requestUrl` for
`fetch`. What doesn't port: the prompt system's `{{Heading}}` mechanism extracted arbitrary
markdown sections from note bodies, which no longer exist — the prompt context must be
rebuilt from structured data (fuel, log, fields). Also decides: provider/key settings UX,
the privacy boundary (exactly what leaves the device, user-visible — any widening is an
owner decision per CLAUDE.md), Ollama-on-mobile (LAN endpoint?), and the BYO-key tie-in to
monetisation (HANDOFF open question #1).

- Plugin source: `src/services/AiService.ts` (already ported per HANDOFF §4 — verify), `src/modals/AiResultModal.ts`
- HANDOFF: §3 (AI = sole network exception), §8 (monetisation), §4
- Likely overlaps: `fuel`, `log`, `data`, `fields`, `backup` (settings surface)

## 14. `digest` — Weekly digest & birthday alerts

HANDOFF open question #7: neither has been discussed for mobile — this session is the
keep/cut/defer decision first, design second. Plugin behavior: digest = markdown report
file bucketing contacts (contacted this week / needs attention / snoozed); birthdays =
7-day-window banner from `MM-DD` or `YYYY-MM-DD`. Mobile candidates: digest as a
notification, a screen, or cut; birthdays folded into `notify`.

- Plugin source: `src/main.ts:294-356`, `src/components/BirthdayBanner.tsx`
- HANDOFF: §12.7
- Likely overlaps: `notify`, `dashboard`, `data`

## 15. `backup` — Backup, export & data portability

JSON export is agreed in principle (HANDOFF §3 [OPEN]); it is also the anti-lock-in
differentiator, not a chore. Decides: export format/scope, import (restore) semantics,
manual-only vs encrypted-to-user's-cloud vs local rotation, and where it lives in
settings. Note: the settings *screens* as a whole are cross-cutting and assembled from
other domains' decisions — they only get their own interrogation if something surfaces.

- Plugin source: `src/settings.ts` (504 — interface/defaults survive, UI dies)
- HANDOFF: §3 (backup [OPEN]), §8 (differentiators)
- Likely overlaps: `data`, `fields`, `photos`, `ai`

---

## Cross-domain constraint log

Appended by `/oa-interrogate` runs. When a domain's decision constrains a not-yet-run
domain, it's recorded here so the later run inherits it. Format:
`- [source domain → target domain] constraint — (date)`

*Full text of each entry lives in the source domain's "Cross-domain constraints exported"
section. Summarised here so a later run sees what binds it.*

- [data → fields] `col_name` must be whitelist-**constructed**, never escaped; the importer
  is a second, untrusted producer §14 did not anticipate — (2026-08-12)
- [data → fields] Contact purge destroys that contact's `field_history` rows — scopes
  §14.6, does not reverse it — (2026-08-12)
- [data → import] Replace `loader.ts`'s frontmatter parsers; they cannot read the plugin's
  own output. Contacts with no `last_contact` import genuinely empty — (2026-08-12)
- [data → log] Interaction rows carry a local datetime, nullable note and their own channel;
  fully editable, and edits change status. One DAO function alone writes `last_contact`,
  recomputed as MAX after every insert/edit/delete — (2026-08-12)
- [data → crud] Create form asks last-contact with a "not yet" option; duplicate names warn
  but do not block; archive is the delete affordance — (2026-08-12)
- [data → dashboard] Queries carry `WHERE last_contact IS NOT NULL`; never-contacted
  contacts need their **own screen**, which no domain in this index owns yet — (2026-08-12)
- [data → orrery] `ring_seq` is a global radius override (**reverses §7**), so frequency has
  no visual encoding left on that screen; the sun is assignable and glows its subject's
  status — (2026-08-12)
- [data → widget] Favourites are ordered via a rank column; a widget tap writes a full
  interaction row — (2026-08-12)
- [data → notify] Never-contacted contacts must not fire decay notifications; snooze
  suppresses notifications while the clock runs; SMS composer reads `contacts.phone` —
  (2026-08-12)
- [data → digest] `birthday` exists with an optional year; the keep/cut call is still
  HANDOFF open question #7 — (2026-08-12)
- [data → ai] Interaction channel must come from the newest interaction row, never a
  contact column — fixes an incoherent fact sent to the provider — (2026-08-12)
- [data → backup] **Export is load-bearing, not optional** — `allowBackup="false"` plus
  deletion-on-uninstall makes it the only barrier to total loss — (2026-08-12)
- [data → photos] `photo` is a nullable path column; purge must delete the file, which no
  foreign key can reach — (2026-08-12)
- [fuel → capture] `expo-share-intent` must be **patched to read `EXTRA_SUBJECT`** or links
  arrive unlabelled; capture writes the row on contact-pick (payload dies on background);
  picker must not inherit `WHERE last_contact IS NOT NULL`; **images out of scope** —
  (2026-08-12)
- [fuel → ai] Fuel rows carry `kind`/`created_at`/`source`/`url` from migration 1;
  `off_limits` is never transmitted and unreachable by any placeholder name; age must reach
  the prompt; **no local provider on mobile, so no zero-egress mode exists** — (2026-08-12)
- [fuel → notify] One collapsed line only (`BigTextStyle` hardcoded, 1024-char framework cap);
  the action opens an **in-app compose screen**, not the SMS composer (`expo-sms` cannot run
  headless); the lock-screen setting requires a **second channel** — (2026-08-12)
- [fuel → dashboard] Every contact card carries a required one-line fuel preview, constraining
  the grid layout — (2026-08-12)
- [fuel → widget] Fuel renders only at the larger widget size; no privacy control governs
  home-screen exposure — (2026-08-12)
- [fuel → import] Routing rule is **hooks vs data** — frontmatter keys → custom fields, prose
  bullets → fuel items; vault bold sub-headers map to kinds — (2026-08-12)
- [fuel → backup] **01-data's export list omits fuel and must be amended** to include `kind`,
  `label`, `url`, `created_at`, `source` — (2026-08-12)
- [fuel → crud] Purge must delete fuel rows explicitly — FKs are off inside
  `withExclusiveTransactionAsync`, so `ON DELETE CASCADE` is decorative — (2026-08-12)
- [fuel → **unowned**] The in-app **compose screen** has no owning domain in this index — the
  same gap 01-data created with the never-contacted screen — (2026-08-12)
- [log → data] `interactions` carries channel (6 values incl. `unspecified`), nullable
  direction, a connected flag, optional quality, `occurred_at`/`recorded_at`, `source` and a
  stable uid; a **separate `events` table** holds snooze/archive/restore — (2026-08-12)
- [log → data] `contacts` gains a **"Rarely responds"** flag; for those contacts `last_contact`
  is MAX over *connected* rows only — scopes 01-data's single-writer rule, does not reverse it
  — (2026-08-12)
- [log → data] **`rogue`** is a fourth status threshold plus a non-time entry path, with a
  `reason` attribute — **extends** 01-data's continuous-progress model — (2026-08-12)
- [log → **all**] **Every user-data table carries a stable, globally-unique id** so a restore
  can merge instead of only replacing — (2026-08-12)
- [log → notify] `rogue` fires no decay notifications; mark-contacted stays one-tap and writes
  **headlessly**, but the background path is gated to non-foreground, so a tap while the app is
  open is **silently dropped** unless both listeners are wired — (2026-08-12)
- [log → widget] Small tiles keep §6's one-tap; the larger tile shows *Quick mark* + *Log
  contact*. Widget taps are headless broadcasts with a **hardcoded 30 s budget**, and
  **Android 15+ force-stop greys the widget** until next app launch — (2026-08-12)
- [log → orrery] ⚠ **Owner introduced a TWO-VIEW orrery** (relationship-closeness vs status) —
  his answer to 01-data's frequency-encoding question. **No domain owns it.** `rogue`'s
  threshold and rendering are open; §7's rejected "floating free" was **not** adopted —
  (2026-08-12)
- [log → ai] History reaches the prompt as **aggregates only** — **no interaction note text is
  ever transmitted**, since a row has no `off_limits` analogue. Quality summary included —
  (2026-08-12)
- [log → backup] Export must include `interactions` and `events`, and must **not** restore
  `last_contact` as authoritative — (2026-08-12)
- [log → crud] Purge must delete interactions **and** events explicitly; answering "when did you
  last speak" **must insert a row** — (2026-08-12)
- [log → **index**] **Domain 5 (`import`) is cut**; four earlier constraints are moot and
  `import` leaves both `source` enums — (2026-08-12)
- [log → data] **`gravity`** (age-decayed accumulated familiarity, with a floor) and
  **`intensity`** (rate vs intended frequency, absorbing the cadence stat) are **derived, never
  stored** — matching 01-data's rule for `status` — (2026-08-12)
- [log → data] `gravity` depends on direction, so **one-tap routes write
  `direction='outbound'`** — revises 04-log's own Cluster A — (2026-08-12)
- [crud → data] ⚠ **`contact_link` shape reversed**: single scalar column → a `contact_links`
  child table (uid, url, optional label, order). phone/email stay single columns; actionable-tap
  survives per row. Owner's explicit reversal of 01-data F/E — (2026-08-13)
- [crud → data] Create is a **multi-row transaction through the single-writer DAO** (contact +
  optional interaction row); "not yet/don't know" writes no row (NULL `last_contact`); backdated
  create row is `source='manual'`, `direction=null` (never `outbound`) — (2026-08-13)
- [crud → fields] `custom_field_defs` needs a **display-order column from migration 1** (§14.10
  reorder; §14.1 has none); custom fields render as a block after fixed columns, never interleaved;
  the `label→col_name` slugifier stays a **single producer** and must reserve the full fixed-column
  name set — (2026-08-13)
- [crud → capture] Inline-create is **name-only**, `last_contact` defaults **empty**
  (never-contacted) — opposite of the standard form's "today" — (2026-08-13)
- [crud → backup / self] Export/restore and **purge** must include `contact_links` explicitly —
  (2026-08-13)
- [crud → dashboard / orrery / widget] **Three editing surfaces assigned out of `crud`**:
  favourites rank → dashboard/widget; `ring_seq` (drag) and sun assignment → orrery. Only "Rarely
  responds" stays on the contact edit form — (2026-08-13)
- [crud → data/log] Whether an **archived contact's clock runs** (open in 04-log) sets what the
  **restore** confirm must warn about — instant deep decay on restore if it does — (2026-08-13)
- [log → dashboard] The "nothing log-derived on the card" rule was **reaffirmed** when `gravity`
  was added — profile only — (2026-08-12)
- [log → orrery] `gravity` maps naturally onto body size or ring weight; **deliberately not**
  encoded there in v1, recorded so it reads as considered rather than overlooked — (2026-08-12)
