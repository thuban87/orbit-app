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
| 1 | `data` | Core contact schema & status engine | pending |
| 2 | `fields` | Custom fields | **complete** (HANDOFF §14) |
| 3 | `fuel` | Conversational Fuel — storage & interaction | pending |
| 4 | `log` | Interaction log & touchpoint updates | pending |
| 5 | `import` | Obsidian vault importer | pending |
| 6 | `crud` | Contact create/edit flows & forms | pending |
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

## 1. `data` — Core contact schema & status engine

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

## 5. `import` — Obsidian vault importer

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
Register Orbit as an Android share target: share text/link/image → pick contact → lands as
fuel. Decides: accepted payload types, the pick-contact flow (speed is the whole point),
what gets stored (URL vs fetched title vs raw text), and the Expo mechanics (config
plugin / custom dev client implications — needs current-docs verification).

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

*(empty — no interrogations complete yet)*
