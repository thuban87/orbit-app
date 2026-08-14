# Workpaper — Dashboard ↔ digest / notify / birthday-banner seam

**Domain 8 (`dashboard`) interrogation · overlap investigation**
Investigated 2026-08-13. Every claim below verified first-hand against the file cited, per
CLAUDE.md "Review the code, not the diff." Plugin paths are under `~/projects/Orbit/`; new-project
paths under `/home/bwales/projects/orbit-app/`.

This workpaper maps the seam between the **dashboard** and three not-yet-designed domains —
**14 `digest`** (weekly digest + birthday alerts), **11 `notify`** (actionable notifications), and
the historical **birthday banner** the dashboard carried. It surfaces design questions and
conflicts; it decides nothing. Domains 11 and 14 are both `pending` (`docs/dossier/INDEX.md:28,31`).

---

## 1. Birthday data facts (verified)

### Plugin banner behaviour — `src/components/BirthdayBanner.tsx`

- **Window = within 7 days.** `daysUntil !== null && daysUntil >= 0 && daysUntil <= 7`
  (`BirthdayBanner.tsx:19`). Header comment agrees ("within 7 days", `:6`).
- **Iterates ALL contacts.** `for (const contact of contacts)` (`:15`), skipping only rows with no
  birthday (`if (!contact.birthday) continue;`, `:16`). No filter for snooze, archive, or
  never-contacted. `contacts` comes straight from `useOrbit()` (`:9`) — the full index. (See §4.)
- **Sort = soonest first.** `upcoming.sort((a, b) => a.daysUntil - b.daysUntil)` (`:25`).
- **Tap action = open the contact's note.** `plugin.app.workspace.getLeaf().openFile(contact.file)`
  (`:42`) — an Obsidian-only affordance with no mobile analogue.
- **Renders nothing when empty.** `if (upcomingBirthdays.length === 0) return null;` (`:29-31`).
- **Two date formats, one parser.** `getDaysUntilBirthday` accepts `MM-DD` (`:68`) or a leading
  `YYYY-MM-DD` (`:69`); anything else returns `null` (`:77-78`). The year, when present, is never
  used except implicitly discarded — no age is computed anywhere.

### Placement in the plugin dashboard

`BirthdayBanner` sits at the **top** of the dashboard view: `views/OrbitDashboard.tsx:5` imports it
and `:33` renders `<BirthdayBanner />` above the grid. This is the "birthday banner placement"
question domain 8's INDEX entry names (`docs/dossier/INDEX.md:198`).

### New-project schema decision (already made, in 01-data)

**[DECIDED] `birthday` is a fixed column with an optional year** (`docs/dossier/01-data.md:328-336`).
One column, one parser, nullable year — because the day is often known when the year is not. The
same section explicitly scopes itself: *"whether birthday **alerts** ship at all is HANDOFF open
question #7 and belongs to domain 14 (`digest`). This decision only gives the data a home."*
(`01-data.md:335-336`). The optional-year parser is deferred to phase planning
(`01-data.md:506-507`). Cross-domain constraint recorded: `[data → digest]`
(`01-data.md:453-454`, mirrored `INDEX.md:328-329`).

### Bugs in the plugin's birthday logic

1. **The birthday DISAPPEARS on the actual day (day-of off-by-one).** `today` is `new Date()` and
   carries the current time-of-day (`:12`). `birthdayThisYear` is `new Date(thisYear, month, day)`
   — local **midnight** (`:83`). On the birthday itself, midnight-today is strictly earlier than
   now-with-time, so the guard `if (birthdayThisYear < today)` (`:86`) fires and rolls the date to
   **next year** (`:87`). `daysUntil` then computes to ~365 (`:91-94`), which fails the `<= 7`
   window (`:19`) and the contact is **dropped from the banner on their birthday**. Corollary: the
   `daysUntil === 0 → "🎉 Today!"` branch (`:47-48`) is effectively **dead code** — the only way to
   reach `diffTime === 0` is a birthday at exactly 00:00:00.000 evaluated at exactly 00:00:00.000.
   This is a genuine, reproducible bug, distinct from the classic `toISOString` UTC off-by-one
   CLAUDE.md warns about.
2. **Leap-day Feb-29 silently shifts to Mar-1.** `new Date(thisYear, 1, 29)` in a non-leap year
   overflows to March 1 (JS `Date` normalises), so a Feb-29 birthday surfaces on the wrong day in
   three years out of four rather than being handled deliberately. No crash, silent shift.
3. **No lower-bound protection beyond `>= 0`.** Fine given the roll-forward, but note the window is
   asymmetric by construction: it can never show "birthday was yesterday," which is the natural
   thing a user who missed one would want. (Design observation, not a defect.)

These are **the parser's problems to inherit or fix** — the new schema keeps a single parser
(`01-data.md:330-331`), so whoever writes it owns whether day-of and Feb-29 are handled.

---

## 2. The keep/cut entanglement (the sharpest conflict)

HANDOFF **open question #7** (`HANDOFF.md:267`): *"Whether to keep 'Weekly Digest' and 'Birthday
alerts' in v1 — both exist in the plugin; neither has been discussed for mobile."* The INDEX
assigns this keep/cut/defer call to **domain 14** (`docs/dossier/INDEX.md:272-282`, and the entry
says the session is "the keep/cut/defer decision first, design second").

The tension: the **birthday banner is a dashboard surface** (it renders in `OrbitDashboard.tsx:33`),
but **whether birthday alerts ship at all is a domain-14 decision** (`01-data.md:335`). Domain 8
must be careful which half it touches.

### What the dashboard run CAN legitimately decide now

- **Whether the dashboard has a banner *slot* at the top, and its visual treatment** — this is the
  card/grid/layout skeleton the interrogation exists to settle (INDEX `:198` names "birthday banner
  placement" explicitly; HANDOFF §12.4 gives the owner the layout, `HANDOFF.md:264`).
- **What a dashboard banner, *if populated*, would show and how a tap behaves on mobile** (the
  Obsidian `openFile` is dead; the mobile analogue is "open the contact profile").
- **The offline-render guarantee for anything on the dashboard** — the banner reads only local rows,
  so it satisfies CLAUDE.md's "dashboard must render with no network" for free.

### What MUST be deferred to domain 14 / 11 (and must not be pre-empted here)

- **Whether birthday alerts exist in v1 at all** — HANDOFF Q7, owner-facing keep/cut, domain 14.
- **Whether a birthday surfaces as a *notification*** (a `notify`/domain-11 concern) versus, or in
  addition to, an on-screen banner.
- **Whether the weekly digest exists, and in what form** — domain 14.
- **The birthday *window*** (plugin's 7 days) if birthdays become notifications, since notification
  lead-time is a notify-policy question, not a dashboard-layout one.

### Where the dashboard run could ACCIDENTALLY pre-empt domain 14/11

- **Deciding "a birthday banner appears on the dashboard" as a *committed feature* rather than a
  *reserved slot*** would quietly answer half of Q7 (the "keep birthday alerts" half) before domain
  14 runs. It also implicitly picks **banner-on-dashboard over birthday-as-notification** — a
  domain-11 call. Frame any dashboard birthday decision as conditional ("if domain 14 keeps
  birthdays, here is the slot"), or explicitly escalate, rather than deciding the feature's
  existence. Per CLAUDE.md, reversing/pre-empting a decision assigned elsewhere is the owner's call,
  not the planner's.
- **Deciding the banner's data population rule** (which contacts it lists) touches the snooze /
  archive / never-contacted invariants from 01-data — see §4. That is defensible as *enforcing* an
  existing decision, but only if framed as enforcement, not as new digest scope.

---

## 3. Surface conflict — the digest's output mechanism is dead on mobile

### How the plugin produces and triggers the digest

- **Trigger = manual command only.** `main.ts:171-179` registers command `weekly-digest` ("Weekly
  Digest"), invoked from the Obsidian command palette. There is **no interval, no startup hook, no
  scheduler** — grepped `main.ts` for `registerInterval` / `setInterval` (none) and the digest is
  never called from `onload`. `docs/Weekly Digest.md:5-9` confirms it is a user-run palette command.
  (This matches 01-data F9's finding that the plugin has no timers at all, `01-data.md:673-681`.)
- **Output = a markdown file, created and opened in the vault.** `generateWeeklyDigest`
  (`main.ts:294-356`) builds a markdown string and writes it to `Orbit Weekly Digest YYYY-MM-DD.md`
  in the vault root (`:342-348`), then opens it in a leaf (`:352-354`). `docs/Weekly Digest.md:13`
  documents the filename and location.

**On mobile there is no vault, no markdown file, and no "open a note" affordance.** The entire
output mechanism is dead — this is not a port, it is a redesign of *where digest information lives*.

### Candidate homes for "digest" information

| Candidate | Owning domain | Deciding it here vs domain 14 |
|---|---|---|
| A **dashboard section/summary strip** (counts: contacted this week, needs attention, snoozed) | shared 8 ↔ 14 | Genuinely tempting for domain 8 because the numbers are already on-screen data. But committing the dashboard to *carry the digest* answers Q7's "keep digest" half. Reserve the slot; defer the commitment. |
| A **weekly local notification** ("5 people need attention") | 11 `notify` / 14 | Pure notify+digest territory. Dashboard should not decide notification cadence. |
| A **dedicated digest screen** | 14 `digest` | Out of domain 8's scope entirely. |
| **Cut** (rely on the dashboard's own sort/filter to surface the same contacts) | 14 (owner call) | Plausible: the dashboard already sorts decay-first; the digest may be redundant on mobile. This is exactly the Q7 keep/cut call — domain 14's to make. |

### Candidate homes for "birthday" information

| Candidate | Owning domain | Deciding it here vs domain 14/11 |
|---|---|---|
| **Dashboard banner** (the plugin's placement) | 8 layout / 14 existence | Domain 8 owns the *slot and treatment*; domain 14 owns *whether it's populated at all*. |
| **A birthday notification** via domain 11 | 11 `notify` / 14 | Lead-time, quiet hours, and action all belong to notify. Note the `[fuel → notify]` constraint that a notification action opens an **in-app compose screen, not the SMS composer** (`INDEX.md:343-345`) — a birthday "wish them" action would inherit that. |
| **Folded into the digest** ("birthdays this week" section) | 14 | Ties birthday visibility to the digest's fate. |
| **Cut** | 14 (owner call) | Q7's other half. |

**Why the split matters:** deciding digest/birthday *homes* in domain 8 would set defaults that
domains 11 and 14 then have to argue against rather than design freely. The safe move is for domain
8 to decide only the dashboard-local surfaces (a reserved banner slot; optionally a reserved summary
strip) and export everything else as a constraint/question to 11 and 14.

---

## 4. The snoozed / hidden-population interaction (a real divergence)

01-data made three population decisions that the plugin's banner and digest both **violate**,
because the plugin had no such concepts:

- **Snooze = suppression, "Hidden from lists and notifications"** (`01-data.md:197-198`; constraint
  `[data → notify]` "snooze suppresses notifications", `:451-452`, `INDEX.md:326-327`).
- **Never-contacted contacts are excluded from the dashboard and orrery entirely** and get their own
  screen; dashboard queries carry `WHERE last_contact IS NOT NULL` (`01-data.md:183-190`, `:437-439`;
  `INDEX.md:318-319`).
- **Archived contacts are excluded from every normal query** via `archived_at IS NULL`
  (`01-data.md:542-543`).

Against those, the plugin's behaviour:

- **Banner iterates ALL contacts** (`BirthdayBanner.tsx:15`, verified §1) — no snooze, archive, or
  never-contacted filter. A snoozed contact with an upcoming birthday **appears** in the banner.
- **Digest surfaces snoozed contacts in a dedicated bucket** (`main.ts:305-306`, its own "⏸️
  Snoozed" section `:333-336`) — the exact opposite of "hidden from lists."
- **Digest surfaces never-contacted contacts** — `calculateStatus(null,…)` returns `"decay"`
  (`01-data.md:100-103` / F10 `:682-691`), so a null-`last_contact` contact lands in the "🔴 Needs
  Attention" bucket rendered as `(last: never)` (`main.ts:308-311`; `docs/Weekly Digest.md:33`).
  This directly contradicts `WHERE last_contact IS NOT NULL`.
- (The plugin has no archive at all — 01-data F2, `01-data.md:595-603` — so the archive divergence
  is net-new, not a plugin behaviour to preserve.)

**Design questions this forces (for domain 8 to raise, 14/11 to answer):**

1. Should the birthday banner (or any digest surface) show a contact whose birthday is upcoming but
   who is **snoozed**? Snooze says "hidden from lists and notifications" (`01-data.md:197-198`) — but
   a birthday is arguably a *reason to un-snooze*, not something snooze should hide. This is a real
   product tension, not a clear-cut filter. **Whoever builds the banner cannot just port the
   all-contacts loop** — they must decide the predicate.
2. Should it show an **archived** contact? Almost certainly no, per `archived_at IS NULL`
   everywhere — but it must be decided, because the plugin's loop would include them.
3. Should it show a **never-contacted** contact whose birthday is near? The dashboard excludes them
   by rule, but a birthday is birthday regardless of contact history. If the banner honours the
   dashboard's `last_contact IS NOT NULL`, a person you've entered but never logged will have their
   birthday silently omitted from the one surface that would remind you.

Each of these is a case where the banner's population rule either **enforces** an 01-data decision
(defensible, planner's call) or **carves an exception** to it (owner's call — it weakens a recorded
suppression/exclusion invariant). Domain 8 should name which it's doing for each.

---

## 5. Summary of exportable constraints / questions (for the dossier)

- `[dashboard → digest]` The plugin's digest output (markdown file created + opened in vault,
  `main.ts:342-354`) is **dead on mobile**; digest information needs a new home (dashboard strip /
  notification / dedicated screen / cut). Trigger was **manual command only** (`main.ts:171-179`) —
  no scheduler exists, matching 01-data F9.
- `[dashboard → digest]` Whether the dashboard carries a birthday **banner slot** is a domain-8
  layout call; whether it is **populated / birthday alerts ship at all** is HANDOFF Q7, domain 14's.
  Do not let the layout decision silently answer the keep/cut.
- `[dashboard → notify]` Birthday-as-notification vs banner-on-dashboard is a domain-11 choice; a
  "wish them" notification action inherits the `[fuel → notify]` in-app-compose constraint
  (`INDEX.md:343-345`), not the SMS composer.
- `[dashboard → digest/notify]` The banner's population predicate must be decided against 01-data's
  snooze-suppression (`01-data.md:197-198`), never-contacted exclusion (`:183-190`), and archive
  exclusion (`:542-543`) — the plugin's all-contacts loop honours none of them.
- **Parser bug to inherit-or-fix:** the plugin drops a birthday **on the actual day** (roll-forward
  off-by-one, `BirthdayBanner.tsx:82-87`) and shifts **Feb-29 → Mar-1**. The new single birthday
  parser (`01-data.md:330-331,506-507`) owns whether these are handled.
