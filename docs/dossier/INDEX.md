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
| 7 | `photos` | Photo handling | **complete** |
| 8 | `dashboard` | Dashboard screen | **complete** |
| 9 | `orrery` | Orbit view | **complete** |
| 10 | `capture` | Share-sheet capture | **complete** |
| 11 | `notify` | Actionable notifications | **complete** |
| 12 | `widget` | Home screen widget | **complete** |
| 13 | `ai` | AI message suggestions | **complete** |
| 14 | `digest` | Weekly digest & birthday alerts | **complete** |
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

**Complete — see `docs/dossier/07-photos.md`.** 7 questions over 3 rounds; no `[OPEN]` items.
Photo becomes **one 512×512 JPEG master** per contact under the persistent document dir, via a
**library-only** picker (no camera, no permissions) with an **in-app Skia crop**. This run
**reverses §14.3** — a URL entry path is **kept** alongside the picker — and **partially
un-deletes §4's `ImageScraper`** (its download logic only, as `fetch`), the end state always a
local file so §3's offline-read rule survives. The ported HSL-avatar hash is **quantized to a
themed swatch set** to satisfy CLAUDE.md's no-hardcoded-colour rule. Platform verification
established three hard downstream facts with no owning domain: the **widget can't read `file://`
(needs base64)**, **notifications have no per-contact large icon** in managed Expo, and the
**Skia `file://` path is undocumented** (spike or go base64).

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

**Complete — see `docs/dossier/08-dashboard.md`.** 16 questions over 4 rounds; no `[OPEN]` items.
The dashboard is a **flat list** (no category grouping), the picker's full sort/filter set, and a
**name+fuel search** that becomes the home for 03-fuel's previously-unowned cross-contact fuel
search. The dashboard is the app's **home screen**; it **adopts the never-contacted screen** (a
domain-8-owned sibling list), gives **snoozed** contacts a reveal-on-demand segment, and shows
**counts** on the actionable hidden populations. Cards gain a **category label** and a **favourite
marker**; favourites are **marked on the profile, ordered on a shared "Manage favourites" screen**
(resolving 06-crud's punt). A **birthday banner ships** (resolving the dashboard half of HANDOFF
Q7) that **overrides snooze/never-contacted suppression except archived** — a scoped exception,
not a reversal; the digest and birthday notifications stay open for domains 14/11. Platform
verification established the **change-listener is blind to headless one-tap writes** (re-query on
focus instead) and flagged **two birthday-parser bugs** to fix.</new_string>


## 9. `orrery` — Orbit view

Mechanics are largely settled in HANDOFF §7 (per-contact rings, angular position = interval
progress, elliptical off-screen orbits, status without motion-changes, tap-to-freeze,
Skia + Reanimated, pause off-focus). Interrogation confirms the remainder: the piecewise
angle-to-time mapping, tap-target sizing, what tapping a body opens, sun/self handling,
and what the screen does at 0–2 contacts. Perf claims are physical-device-only (CLAUDE.md).

- Plugin source: none — this feature has no predecessor
- HANDOFF: §7 (mostly DECIDED, one REJECTED alternative recorded)
- Likely overlaps: `data`, `dashboard`, `theme` tokens (via CLAUDE.md conventions)

**Complete — see `docs/dossier/09-orrery.md`.** 13 questions over 5 rounds; no `[OPEN]` items. The
owner's **two-view orrery** (04-log's unowned concept) is now owned and specified: **both views
ship, status is the default**, they **share a closeness-radius (`ring_seq`)** and differ only in
motion+colour, and a **toggle morphs between them on one Skia canvas**. This run **drops HANDOFF
§7's `tap-to-freeze` by obsolescence** — the owner confirmed **no live body-loop** (bodies are
placed by timestamp on focus; at ~5°/day nothing visibly moves), so there is nothing to freeze.
`rogue` (04-log's export) is settled: **max-drift cold/extinguished body, ring faded to a trace,
threshold = a multiple of the interval** (value deferred). **Frequency gets no visual encoding**
(closing 01-data's exported question), and **`gravity` stays off the orrery** (confirming 04-log).
The owner **added a user-selectable self-sun colour** (rejecting all three offered options — self
has no status, so "pick your own star"). An **empty-state prompt** ships for the sun-only new-user
orrery. Cosmetics: an **animated twinkle starfield + a pulsing sun**, which keeps pause-on-blur
live. Platform verification (Expo SDK 57: Skia 2.6.2 + Reanimated 4.5.1) **resolved 07-photos'
`file://` question** (works directly, base64 fallback wired) and corrected §7's stale "Skia render
loop" wording — Reanimated is now the animation engine.

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

**Complete — see `docs/dossier/10-capture.md`.** 10 questions over 3 rounds; no `[OPEN]` items.
The heavy investigation was already produced during the 03-fuel run and read first-hand this
run; the platform facts were **re-verified 2026-08-13** (nothing changed). The picker is a
**grid of faces, keyboard closed, ordered favourites → capture-MRU**; **single tap commits,
long-press enters multi-select** (owner refinement); capture offers an **optional skippable
note** (owner, over the orchestrator's fire-and-forget pick) that edits display text while the
`url` stays canonical. Post-capture: **toast, then return to the source app** via a plain
`finish()`. Payload is **split** (URL canonical, best-available text). The intent filter
registers **`text/plain` only** (not the library's `text/*` default — `text/*` errors on
`text/html`). **Capture is never a touchpoint** and **Direct Share is out** (native cost +
system-ranked ordering + names/avatars leaving the sandbox + 30-day-staleness fighting the decay
premise). **No capture inbox — `contact_id` stays NOT NULL** (settled now, not retrofittable).
This run **records `launchMode="singleTask"` as an app-wide side effect** binding domains 11/12's
back-stack design, and flags that **domain 8's never-contacted screen must render fuel** or
captures onto new/never-contacted people are invisible.

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

**Complete — see `docs/dossier/11-notify.md`.** 16 questions over 5 rounds; no `[OPEN]` items. Two
platform verifiers closed the one gap the prior fuel/log runs left — the **scheduling
architecture** — and the platform dictated it: **scheduled-notification content freezes at schedule
time** and the **background-task sweep is hard-gated on network** (won't run offline), so the engine
is **pre-scheduled dated notifications, reconciled at launch/foreground, cancelled on
mark/snooze/mute**, with **fuzzy (no-permission) delivery** at a **fixed morning hour inside a quiet
window**, **per-contact and naturally staggered** (Android 15 Cooldown penalises bursts). The
notification body is **GENERIC** — this run **⚠ further narrows HANDOFF §6 / 03-fuel Cluster D**
(fuel is visible only on the compose screen the tap opens, not in the notification text) because
frozen content cannot show live fuel. The action set is **refined to two buttons** (mark-contacted +
snooze; body-tap opens compose, "open" dropped), reminders **re-nag ~weekly (replacing)**, and
rogue/"Rarely responds" get **no notification — in-app only**. The owner **added a per-contact
"reminders off" mute** (against the recommendation), **kept the private lock-screen second channel**
(considered for reversal after the generic-body call, upheld), and **claimed birthday notifications
for this domain** (resolving HANDOFF Q7's birthday half — **domain 14 keeps only the weekly
digest**). **No per-contact photo** on notifications without native code (declined). Alert
feel/importance is **punted to the §12.4 design pass**.

## 12. `widget` — Home screen widget

Favourites grid; tap = preset action (primary: mark contacted), long-press = deep link
(HANDOFF §6). Hard constraints: `react-native-android-widget`, custom dev client, **no
text input possible in a widget**. Decides: the exact preset action set (HANDOFF open
question #3), grid size/selection of favourites, staleness/update cadence, and the stretch
goal (widget self-updating into a profile view) in or out.

- Plugin source: none
- HANDOFF: §6, §12.3; CLAUDE.md widget note
- Likely overlaps: `log`, `notify`, `data`, `photos`

**Complete — see `docs/dossier/12-widget.md`.** 9 questions over 3 rounds; no `[OPEN]` items. The
widget has **no plugin predecessor**, so the run is inbound constraints + platform verification of
`react-native-android-widget@0.22.0` (rasterised-PNG architecture) and current Android App-Widget
APIs. Closes HANDOFF §12.3 **open-question #3** (the action set): tap = mark-contacted (small tile,
per 04-log); the **larger tile carries Quick mark · Log contact · Message**, the Message action a
**net-new** path deep-linking to **11-notify's compose screen**. Status is now **shown on the tile**
(status-colour avatar) but never **reorders** it — favourites stay in **static manual rank**; ~6 at
default size, exact count a **device spike**. ⚠ **HANDOFF §6's literal `long-press` is unbuildable**
(RemoteViews has no long-press) — replaced by **two tap regions** (whole tile = mark, name/chevron =
profile); flagged as a mechanism change, not an intent reversal. The **self-swap-to-profile stretch
goal is CUT from v1**; config is a **global mirror** (no per-instance state, so the widget adds **no
new schema and nothing for backup**); freshness is **event-push + launch-refresh** (accepting
as-of-last-render staleness). Platform verification established **Android 15 force-stop greys the
widget** (never the sole route; re-push on boot) and that **"Back → dashboard" is a JS-navigation
concern** (`TaskStackBuilder` doesn't compose with app-wide `singleTask`).

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

**Complete — see `docs/dossier/13-ai.md`.** 9 questions over 4 rounds; no `[OPEN]` items.
**Verified `AiService.ts` is NOT yet ported — the repo `src/` is empty** (HANDOFF §4's "already
ported" is the plan, not the state). Most of the AI privacy boundary was **already decided
upstream** (03-fuel Cluster E, 04-log Cluster D) and was not reopened. This run settled the
gaps: AI Suggest lives on **both the compose screen and the profile**, a suggestion becomes an
**editable draft → Send** (Copy is the only guaranteed handoff — SMS prefill is unreliable);
custom fields reach the prompt **only via a new opt-in `share_with_ai` per-field flag**; **one
global editable template** survives; **all three cloud providers** ship with a **HTTPS-only
Custom endpoint** (⚠ **upholds the [REJECTED] LAN zero-egress path** — an `http://` LAN endpoint
would reopen it and force app-wide cleartext); models chosen by **dynamic fetch**; **keys in
`expo-secure-store`, excluded from export**; and AI stays **free BYO-key, monetisation deferred**
(HANDOFF Q1's AI half). Platform verification (2026-08-14) established the endpoints/shapes are
current, only Anthropic's Sonnet 4 ID is dead, `fetch` doesn't throw on 4xx/5xx, and a plain-http
LAN endpoint is blocked without a global cleartext switch. Exports a **new `custom_field_defs`
flag** to fields/crud and confirms the **compose screen** (still unowned) has a second consumer.

## 14. `digest` — Weekly digest & birthday alerts

HANDOFF open question #7: neither has been discussed for mobile — this session is the
keep/cut/defer decision first, design second. Plugin behavior: digest = markdown report
file bucketing contacts (contacted this week / needs attention / snoozed); birthdays =
7-day-window banner from `MM-DD` or `YYYY-MM-DD`. Mobile candidates: digest as a
notification, a screen, or cut; birthdays folded into `notify`.

- Plugin source: `src/main.ts:294-356`, `src/components/BirthdayBanner.tsx`
- HANDOFF: §12.7
- Likely overlaps: `notify`, `dashboard`, `data`

**Complete — see `docs/dossier/14-digest.md`.** 7 questions over 3 rounds; no `[OPEN]` items.
Investigation established the plugin digest is a **manual palette command**, not scheduled — and
that **both birthday surfaces were already owned** (banner→08, notification→11), leaving domain 14
**only the weekly digest**. It **ships (keep)** as a **weekly Sunday-morning notification opening a
dedicated "your week" screen** — resolving HANDOFF Q7's digest half. The screen's payload is the
two things the dashboard cannot give on a schedule: a **retrospective** ("who you reached this
week" — **all** touchpoints, no connected/direction predicate, honoring §1 no-obligation) and **the
overlooked** — the non-nagged `rogue` / "Rarely responds" / never-contacted populations 11-notify
keeps out of the shade. The digest **reads the quality marker** for a gentle "felt effortful" line
(the purpose 04-log added it for; streak-caution recorded). Delivery is **one native
`WEEKLY` trigger** (platform-verified: Android-native, AlarmManager-backed, survives reboot, fires
even if the app is never opened), **static generic body + compute-on-open** (frozen content), a
**third notification type defaulting on**, **firing unconditionally** with a calm empty state. The
digest adds **no new schema** (a pure read surface, like the widget).

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
- [photos → data] `contacts.photo` stores a **relative filename** under the document dir
  (resolved to absolute at read), never an absolute/device-specific path — (2026-08-13)
- [photos → crud/self] Replace/remove **deletes the old file inline** and is **non-undoable**
  (no `field_history` for binaries); purge also deletes custom photo-field files — (2026-08-13)
- [photos → fields] A custom field of type **`photo`** reuses this exact pipeline (512px master,
  themed fallback, orphan/backup rules); not dropped from the §14.8 type set — (2026-08-13)
- [photos → dashboard/orrery] One **512px master** per contact; `expo-image` for grid/profile,
  Skia for the orrery; fallback is a **themed swatch + initials**, deterministic per contact —
  (2026-08-13)
- [photos → widget] Widget photos **must be base64 `data:` URIs** (RemoteViews can't read
  `file://`), re-encoded from the 512px master, within RemoteViews byte ceilings — (2026-08-13)
- [photos → notify] ⚠ **No per-notification large icon** in managed expo-notifications — a
  contact photo on a decay notification needs a **bare-workflow native module**; scope call for
  `notify` — (2026-08-13)
- [photos → backup] Export **embeds photo bytes as base64** (contacts + self); restore writes
  fresh files and **repoints paths**, never restoring stored paths verbatim — (2026-08-13)
- [photos → **index**] This run **reverses §14.3** (URL entry kept) and **partially un-deletes
  §4's `ImageScraper`** (download logic only); both owner-chosen and flagged — (2026-08-13)
- [dashboard → fuel] 03-fuel's unowned **cross-contact fuel search is the dashboard search box**
  (name AND fuel text, `LIKE`, `off_limits` excluded) — (2026-08-13)
- [dashboard → INDEX/self] Domain 8 **adopts and owns the never-contacted screen** (separate
  sibling list, counted entry); the **dashboard is the app home screen**; nav mechanism deferred —
  (2026-08-13)
- [dashboard → data] Default query excludes never-contacted, archived, and snoozed; a **snoozed
  segment** reveals snoozed on demand (does not reverse 01-data C) — (2026-08-13)
- [dashboard → widget (12)/profile] Favourites are **marked with a profile star** and **ordered on
  a net-new "Manage favourites" screen shared with the widget config** — resolves 06-crud's
  8/12 punt; the (unowned) profile screen gains a favourite toggle — (2026-08-13)
- [dashboard → orrery (9)] Rogue is **not** hidden from the dashboard; the card's rogue rendering
  **inherits domain 9's rogue visual** rather than inventing one — (2026-08-13)
- [dashboard → 14 (digest)/11 (notify)] Domain 8 owns the **birthday BANNER** (7-day, tap→profile,
  **overrides snooze/never-contacted suppression, excludes archived only** — scoped exception, not
  a reversal). It does **not** own birthday notifications (11) or the weekly digest (14); both stay
  open under HANDOFF Q7 and must not assume dashboard space — (2026-08-13)
- [dashboard → 14/planning] The ported birthday parser has **two bugs to fix** in the new single
  parser: a **day-of drop** (contact vanishes on their birthday; `"🎉 Today!"` branch dead) and
  **Feb-29→Mar-1** in non-leap years — (2026-08-13)
- [dashboard → data/photos] Freshness = **re-query on focus + AppState-active**, because
  `addDatabaseChangeListener` (connection-scoped `sqlite3_update_hook`) is **blind to headless
  one-tap writes**; async query API only; `recyclingKey` is a correctness requirement — (2026-08-13)
- [orrery → dashboard] The card's **rogue visual** = cold/extinguished desaturated body + faded
  status ring (no rings/drift on a card); resolves 08-dashboard's inherit-domain-9 note —
  (2026-08-13)
- [orrery → notify/data] `rogue` time-threshold = **a multiple of the interval**, a **single shared
  constant** for both orrery rendering and notify's decay-suppression (never computed twice) —
  (2026-08-13)
- [orrery → theme] New tokens: a **`rogue`/extinguished** status colour, a **themed star-colour
  palette** (user-selectable self-sun), and the **relationship-view muted palette** — all through
  tokens, incl. Skia (P1 confirms Skia accepts runtime token/HSL colours) — (2026-08-13)
- [orrery → data/backup] Orrery adds **no new per-contact columns** (radius=`ring_seq`;
  angle/status/`rogue` derived). Only new state is **one app-level self-sun colour setting**,
  exported with the sun assignment — (2026-08-13)
- [orrery → photos] Closes 07-photos' Skia `file://` item for this surface: planets use
  `useImage(file://)` on the 512px master, fallback = themed swatch + initials via **bundled font /
  Paragraph API**; orrery needs **no** base64 (unlike widget); one Pixel spike lands in this
  domain's build phase — (2026-08-13)
- [orrery → INDEX] ⚠ **HANDOFF §7 `tap-to-freeze` dropped by obsolescence** (owner-confirmed no
  live body-loop; nothing moves to freeze). §7's "Skia runs its own render loop" wording is stale —
  **Reanimated is the animation engine** (Skia's own clock removed). Orrery **runs in Expo Go**;
  only the widget forces a custom dev client — (2026-08-13)
- [orrery → INDEX] Frequency gets **no visual encoding** on the orrery (closes 01-data's exported
  question); `gravity` stays **off** the orrery in v1 (confirms 04-log) — (2026-08-13)
- [capture → fuel] The captured **display text is user-editable prose; the `url` column stays
  canonical and separate**; `contact_id` on a fuel row is **NOT NULL** (no inbox, settled now as
  not-retrofittable) — (2026-08-13)
- [capture → notify/widget] ⚠ Adopting `expo-share-intent` imposes **`launchMode="singleTask"`
  app-wide**; notification/widget/deep-link taps reuse one activity via `onNewIntent` (not fresh
  `onCreate`), and with Android 15 background-activity-launch limits the **post-tap back-stack needs
  explicit design in 11/12** — (2026-08-13)
- [capture → dashboard] Domain 8's **never-contacted screen must render fuel**, or captures onto a
  never-contacted / inline-created contact are invisible until first contact — (2026-08-13)
- [capture → data/planning] A **cold-start share runs migrations + launch sweeps before the picker
  can query**; whether the picker may read first is a planning call (a read-only `contacts` query is
  untouched by a `contact_custom_values` DROP COLUMN) — (2026-08-13)
- [capture → log/crud] Reaffirmed: capture is **not a touchpoint** (no `last_contact`/interaction
  write, not even opt-in) and creates contacts only via the **name-only** inline path — (2026-08-13)
- [capture → self] Registers **`text/plain` only** (not the library's `text/*` default, which errors
  on `text/html`); **Direct Share declined** (native module + system-ranked ordering + names/avatars
  to system storage + 30-day-staleness vs the decay premise) — (2026-08-13)
- [notify → fuel] ⚠ **Refines 03-fuel Cluster D:** the decay notification body is **generic** (fuel
  only on the compose screen, **not the notification text** — narrows §6 further, owner-chosen,
  forced by frozen scheduled content); action set is **two buttons** (mark-contacted + snooze;
  body-tap opens compose, "open" dropped; inline capture stays available-for-later); the **second
  lock-screen channel is reaffirmed** (considered for reversal, upheld on name sensitivity) — (2026-08-14)
- [notify → data] New nullable **"reminders off" mute** column on `contacts` (owner add, suppresses
  decay scheduling only; contact still decays/appears); scheduling cutoff is the **shared rogue
  constant** (09-orrery). No decay notif for never-contacted/snoozed/rogue/Rarely-responds/muted —
  (2026-08-14)
- [notify → crud] The mute toggle needs a per-contact **edit surface** beside "Rarely responds"
  (**additive** to 06-crud's lean form, not a reversal) — (2026-08-14)
- [notify → log] The **headless Snooze action** writes an `events` snooze row and must be
  **double-wired** (background task + foreground listener), extending 04-log's mark-contacted
  double-write to snooze — (2026-08-14)
- [notify → digest (14)] Notify owns **all notifications incl. birthday-morning alerts** (resolves
  HANDOFF Q7's birthday half — **keep**); **14 owns only the weekly digest** and must not assume it
  owns birthday alerts. Rogue/"gone quiet" are surfaced **in-app**, not notified — (2026-08-14)
- [notify → dashboard] Birthday notification reuses **08's single birthday parser** and depends on
  its **two flagged fixes** (day-of drop; Feb-29→Mar-1) landing first — (2026-08-14)
- [notify → widget (12)] Shares the **headless-write path** and app-wide **singleTask/onNewIntent**
  back-stack; 12 inherits notify's **"Back → dashboard"** resolution as the pattern — (2026-08-14)
- [notify → backup (15)] Export the **notification settings** (master + per-type toggles, lock-screen
  visibility); the **schedule is derived** (rebuilt by launch-reconcile on restore), not exported —
  (2026-08-14)
- [notify → planning] Engine = **pre-scheduled dated notifications + launch/foreground reconcile**
  (cancel/replace on `decay:<contactId>`), **generic body**, fuzzy no-permission delivery;
  `expo-background-task` is an **offline-intolerant** best-effort backstop only (hard-gated on
  `NetworkType.CONNECTED`). Device spike: headless action task init with **no FCM** — (2026-08-14)
- [widget → data/backup] The widget adds **no new schema and no new persistent state** (global
  mirror + self-swap cut + no per-instance config): it only reads favourites rank, derived status,
  fuel and photo path, all already present. **Backup needs nothing widget-specific** — (2026-08-14)
- [widget → log] Small-tile tap and larger-tile **Quick mark** write 04-log's exact `source='widget'`
  row via the single-writer DAO + JS mutex inside the **30 s** headless budget; **Log contact**
  deep-links the full log flow — (2026-08-14)
- [widget → notify/capture] ⚠ **"Back → dashboard" is a JS-navigation concern** — native
  `TaskStackBuilder` does **not** compose with app-wide `singleTask`+`onNewIntent` (sharpens
  11-notify's exported pattern into its mechanism); widget/notify share the same back-stack model —
  (2026-08-14)
- [widget → photos] Tile uses **base64 `data:` thumbnails pre-scaled below the 512px master**, never
  the full master, never `http(s)`; safe favourites-count per resolution is a **device spike**
  (RemoteViews bitmap-memory ceiling real but unquantified) — (2026-08-14)
- [widget → notify] The larger tile's **Message** action deep-links to **11-notify's in-app compose
  screen** (fuel visible), not the OS SMS app — one compose surface, no second design — (2026-08-14)
- [widget → INDEX] ⚠ **HANDOFF §6's literal `long-press` is unbuildable** on RemoteViews — replaced
  by **two tap regions** (whole tile = mark, name/chevron = profile); mechanism change, not an intent
  reversal. **Self-swap stretch CUT from v1.** No new screen introduced (Message/profile reuse
  existing surfaces); only net-new UI is the widget layouts + an in-app "Add widget" button — (2026-08-14)
- [ai → fields/crud] `custom_field_defs` gains a **`share_with_ai`** flag (default false); the field
  editor needs a per-field toggle; the prompt binds flagged fields to `col_name`, shows by label. A
  *defs*-table column (not `contact_custom_values`), so §14 index/DROP rules are untouched — (2026-08-14)
- [ai → backup] **API keys are NEVER exported** (in `expo-secure-store`, re-entered per provider on a
  new device); exportable AI settings are the non-secret ones (provider, model, template, HTTPS
  custom-endpoint URL, `share_with_ai` flags), which live in SQLite settings — (2026-08-14)
- [ai → compose(unowned)/notify/widget] The compose screen must host an **"AI Suggest"** → **editable
  draft**; **Copy is the guaranteed handoff** (SMS prefill unreliable, 03-fuel F8). AI is a **second
  consumer** of the still-unowned compose screen; the profile is the second entry point — (2026-08-14)
- [ai → data] AI adds **no per-contact columns**; reads recency via 04-log's single query and flagged
  custom fields by `col_name`; writes only via decided `source='ai'` paths — (2026-08-14)
- [ai → self/INDEX] ⚠ **Custom endpoint is HTTPS-only** — an `http://` LAN endpoint would reopen the
  **[REJECTED] LAN zero-egress path** (03-fuel) and force app-wide `usesCleartextTraffic`; both
  declined, boundary upheld. Only Anthropic `claude-sonnet-4-20250514` is a dead model ID — (2026-08-14)
- [ai → planning] Port hazards: `fetch` doesn't throw on 4xx/5xx (add `response.ok` checks);
  `AbortController` Cancel is **on-device-unverified** for `expo/fetch`; no built-in timeout; redact
  the assembled-prompt debug log (`AiService.ts:139`) — (2026-08-14)
- [digest → INDEX] HANDOFF Q7's **digest half = KEEP**; birthdays are untouched (banner→08,
  notification→11, "14 must not assume it owns birthday alerts"). Digest = a **weekly Sunday-morning
  notification → a dedicated "your week" screen** — (2026-08-14)
- [digest → data/self] The digest adds **NO new schema and no persistent/scheduled per-contact
  state** (a pure read surface, like the widget); nothing for backup to carry but the on/off toggle
  — (2026-08-14)
- [digest → notify] Third notification **type** on 11's settings (master + decay + birthday +
  **digest**), **defaults on**, rides 11's single `POST_NOTIFICATIONS` value-moment (no new ask),
  delivers in 11's morning quiet-window; but mechanism is **one native `WEEKLY` trigger** (not
  per-contact dated), tap → digest screen, **Back → dashboard** (inherits 11's back-stack) —
  (2026-08-14)
- [digest → data/log] Retrospective counts **all** interaction rows in a 7-day window (no
  connected/direction predicate, archived excluded); the overlooked section is **NOT** suppressed by
  the reminders-off mute (mute governs decay *pushes* only) — a muted contact gone rogue still shows;
  rogue uses the **shared rogue constant** (09) — (2026-08-14)
- [digest → backup] Export only the **digest on/off toggle** (with 11's notification settings); the
  weekly **schedule is derived** (re-register the WEEKLY trigger on restore/launch), not exported —
  (2026-08-14)
- [digest → planning] Device spike: confirm the **`WEEKLY` trigger fires once/week on the physical
  Pixel** (pre-57 repeat bugs #34782/#30577; emulator won't do) and re-registers across reboot;
  idempotent re-registration; the "skews hard" quality threshold and delivery-day/hour constants —
  (2026-08-14)
