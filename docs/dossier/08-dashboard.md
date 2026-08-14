# Dossier 08 — `dashboard` — Dashboard screen

**Status:** complete · Interrogated 2026-08-13 · 16 questions over 4 rounds · No `[OPEN]` items
remain. This run **adopts the never-contacted screen** into domain 8, **resolves 03-fuel's
unowned cross-contact fuel search** (the dashboard search box), **assigns the favourites
rank-editing surface** (profile star + a shared "Manage favourites" screen), and **resolves the
dashboard half of HANDOFF open-question #7** (a birthday banner ships; digest and birthday
notifications stay open for domains 14/11).

## Scope

The everyday working screen (HANDOFF §7: distinct from the orrery, *do not merge*). The owner
intends to design the card/grid **layout** directly with an agent (HANDOFF §12.4), so this
interrogation settles the **operational skeleton**, not the visual design: how contacts are
organized (group/sort/filter/search), what a card is contractually required to carry, where
favourites are managed, how the app's hidden populations (never-contacted, archived, snoozed)
are reached from here, the birthday-banner/digest seam with the not-yet-designed domains 11 and
14, and the offline-render guarantee. Excludes the orrery (domain 9), the profile screen, the
custom-field/photo internals, and pure visual layout (owner's design pass).

> **Inherited and already settled — not reopened here.** These bound this run:
> - Dashboard queries carry `WHERE last_contact IS NOT NULL` — **never-contacted contacts are
>   excluded and get their own screen** (01-data C; 06-crud made it separate from archived).
> - **Archived contacts are excluded** from every normal query (`archived_at IS NULL`), living
>   behind a distinct low-traffic "Archived" entry (01-data A; 06-crud C).
> - **Snooze is suppression: snoozed contacts are hidden from lists** and notifications while the
>   clock keeps running (01-data C). So the dashboard also excludes currently-snoozed contacts.
> - Every card carries a **required one-line fuel preview** — the single top-ranked fuel line
>   (kind priority then recency; `off_limits` excluded in the query). No gesture (03-fuel D).
> - **Nothing log-derived goes on the card** — no recency string, no channel glyph, no
>   gravity/intensity; those are profile-only (04-log D, G).
> - Avatar = one **512px local JPEG** via `expo-image`; fallback = **themed swatch + initials**,
>   deterministic per contact (07-photos). Planet/ring styling is this domain's + orrery's call.
> - A continuous progress value underlies status, so sorting can be **granular within a status
>   bucket** (01-data C).
> - `category` is a **user-editable `categories` table** (single-select FK, seeded
>   Family/Friends/Work/Community, reorderable) (01-data D).
> - Favourites are an **ordered nullable rank column**; a widget tap writes a full interaction
>   row. Favourites-rank editing was assigned to **dashboard/widget config** (01-data E; crud D).
> - `birthday` is a fixed column with an **optional year**; whether birthday *alerts* / the
>   weekly digest ship at all is HANDOFF open question #7, owned by **domain 14** (01-data F).

---

## Decisions

### Cluster A — Organization & controls

**[DECIDED] The dashboard is a single FLAT list with no category grouping in v1. The sort
control is the only organizer.** The plugin's hardcoded category sections (Family&Friends /
Community&Professional / Service / Other, `ContactGrid.tsx:11-24`) are dropped.
Rationale (owner): at HANDOFF §10's 7–15-contact scale those sections routinely hold one or two
cards each and burn vertical space; a flat sorted list is cleaner and lets the sort choose what
leads.
**[REJECTED] Grouped by category always** (the plugin model, rebuilt on the real `categories`
table) — thin sections at this scale, and it buries urgency below headings.
**[REJECTED] Flat, status-sorted with category grouping as an optional toggle** (orchestrator's
recommendation) — owner judged an optional grouping toggle not worth building for v1.
*Consequence:* with no section headers to carry category, whether the **card** shows a category
label is now a live question (Cluster B), not a redundant one.

**[DECIDED] The sort menu offers the modal picker's full four: status, name, least-recent-first,
most-recent-first.** Status is the default. Ported from `ContactPickerGrid.tsx:33,94-102`, not
the sidebar's status/name-only pair.
Rationale (owner, over the orchestrator's leaner three): the picker already proves out all four
and the owner wanted the complete set on the working screen. Status sort uses the continuous
progress value for granular ordering within a band (01-data C).
**[REJECTED] Status / name / most-overdue only** (drop the redundant most-recent-first);
**[REJECTED] status + name only** (plugin sidebar).

**[DECIDED] The filter set is the picker's richer one: a "Needs attention" quick filter, filter
by category, filter by social battery, and a favourites-only view.** Inherited from
`ContactPickerGrid.tsx:110-163` per 03-fuel F10 ("inherit from the picker, not the header").
**[REJECTED] Needs-attention + category only**; **[REJECTED] needs-attention only** (plugin
sidebar).
*Interlock recorded:* category is a filter but not a grouping; a favourites filter exists, which
feeds the favourites-surface questions in Cluster C.

**[DECIDED] The dashboard carries a search box that matches BOTH contact name AND fuel text.
This is the home for 03-fuel's cross-contact fuel search.** 03-fuel decided that search ships as
a plain `LIKE` scan (no FTS5) but left its UI home unowned; it lands here.
Rationale (owner): answers "I saved this for someone — who was it?", the case capture-without-
thinking produces. The `LIKE` scan is ASCII-case-insensitive only (03-fuel: ICU not compiled),
acceptable for English notes.
**[REJECTED] Name-only search** (leaves the fuel search unowned); **[REJECTED] no search in v1**.
*Exported:* this **resolves 03-fuel's unowned cross-contact fuel-search surface** — it is the
dashboard search box. `off_limits` fuel must be excluded from the search index, matching every
other glanceable surface.

### Cluster B — Populations & navigation

The dashboard's default query excludes three populations: never-contacted
(`last_contact IS NULL`), archived (`archived_at IS NOT NULL`), and currently-snoozed (01-data C
"hidden from lists"). This cluster gives each a home and settles the app shell.

**[DECIDED] The dashboard is the app's HOME / landing screen.** The orrery and the other list
screens hang off it. Matches HANDOFF §15.5 ("build the dashboard before the orrery … the one
that gets used daily") and §7 (the orrery is glanceable, "not the primary interface").
**[REJECTED] Orrery as the landing screen** — more striking, but front-loads the
glanceable-not-primary view. **[REJECTED] Deferring the landing choice to planning.**
*The nav MECHANISM (tab bar vs drawer vs stack) is deferred to phase planning — this fixes only
that the dashboard is home and the other screens are reachable from it.*

**[DECIDED] Snoozed contacts are found via a "Snoozed" filter/segment on the dashboard, revealed
on demand.** They stay hidden from the default list (01-data C is preserved, not reversed); the
segment surfaces them for un-snoozing (inline or from the profile). It joins the Cluster-A filter
set (needs-attention / category / battery / favourites / **snoozed**).
**[REJECTED — would reverse 01-data C] Showing snoozed cards greyed in the main list** (the
plugin's behavior) — the owner was shown this un-hides them by default and declined it.
**[REJECTED] Reachable only via search/profile** — a snoozed contact would be too easy to lose.

**[DECIDED] "Not yet contacted" is a SEPARATE sibling list screen, owned and designed by this
domain.** It is reached from the dashboard and is distinct from Archived (06-crud C already made
never-contacted and archived separate homes). This **assigns the previously-unowned
never-contacted screen to domain 8.**
**[REJECTED] A dashboard filter/segment** (orchestrator's recommendation) — owner chose a
dedicated screen so the never-contacted backlog is its own place, not a transient toggle.
**[REJECTED] Separate screen with ownership deferred** — owner adopted it here.

**[DECIDED] The entries to the actionable hidden populations carry a count; Archived does not.**
"Not yet contacted (3)" and the "Snoozed (2)" segment show counts so a first-contact backlog or a
forgotten snooze stays visible; Archived is a quiet, count-less entry (a graveyard, not a to-do).
**[REJECTED] Counts on all three** (archived count is noise); **[REJECTED] no counts** (the
never-contacted backlog can sit invisible — the exact risk 01-data raised when it moved them off
the dashboard).

### Cluster C — The card content contract

Inherited and fixed: avatar (512px local JPEG, themed-swatch+initials fallback), status ring,
name, one-line fuel preview; **nothing log-derived** (04-log). This cluster settles the two open
content items.

**[DECIDED] The card shows a small category label.** With category grouping dropped (Cluster A),
the card is now where category is visible at a glance. This is the "category badge" the plugin
docs advertised (`Orbit Hub.md:21`) but the code never rendered.
**[REJECTED] Category as filter-only, card stays minimal** — reasonable under grouping, but
grouping is gone, so category would otherwise have no glanceable surface.
*Not a reversal of 04-log's "nothing log-derived on the card": category is contact data, not
log-derived.*

**[DECIDED] Favourite contacts carry a subtle favourite marker (star/pin) on their card**, so the
favourites set is recognizable inline in the flat list, not only via the filter.
**[REJECTED] No marker** — favourites would be invisible in the default list.

*Exact placement, size, and styling of the category label, favourite marker, status ring, and
fuel preview on the card are the owner's design pass (HANDOFF §12.4) — this fixes only WHAT the
card must be able to carry, not how it looks.*

### Cluster D — Favourites surface

**[DECIDED] No always-on pinned favourites area on the dashboard — favourites are the
filter/segment only.** The always-visible pinned favourites grid is the WIDGET's job (HANDOFF §6);
duplicating it on the dashboard is redundant.
**[REJECTED] A pinned favourites row at the top**; **[REJECTED] both a pinned row and the
filter.**

**[DECIDED] Favourites are MARKED with a star toggle on the contact profile, and ORDERED by drag
on a dedicated "Manage favourites" screen shared by the dashboard and the widget config.** This
resolves the rank-editing surface 06-crud D assigned out to domains 8/12 without deciding.
Clean split: marking is a per-contact act (profile); ordering is one shared place.
**[REJECTED] All marking + ordering inside one Manage-favourites screen** (no per-profile star —
marking a favourite while looking at the person is the natural moment).
**[REJECTED] Long-press a card to mark + drag on the favourites view** — long-press is already
03-fuel's profile-quick-actions gesture and would contend for it.
*Consequences exported:* the **profile screen gains a favourite star** (the profile has no owning
domain in INDEX, like the compose and never-contacted screens), and the **"Manage favourites"
screen is net-new, shared with domain 12 (widget)**. The rank column itself is 01-data E.

### Cluster E — Birthday banner & the digest seam

**[DECIDED — resolves the dashboard half of HANDOFF open-question #7] The dashboard carries a
birthday banner in v1:** a banner at the top (7-day window, soonest first, tap → the contact's
profile), reusing the existing `birthday` fixed column (01-data F).
This answers only the **dashboard-banner** half of Q7. It **does not** decide birthday
*notifications* (a domain-11 call) or the weekly *digest's* existence/form (a domain-14 call) —
both remain open. Q7 was an `[OPEN]` item, so resolving part of it now is not a reversal; the
keep decision is explicitly the owner's.
**[REJECTED] Reserve a slot, defer to domain 14** (owner kept birthday as a fixed column and the
plugin shipped this — no reason to withhold it); **[REJECTED] no dashboard birthday surfacing.**

**[DECIDED] The banner surfaces an upcoming birthday for any contact EXCEPT archived — a
birthday deliberately OVERRIDES snooze- and never-contacted-suppression.** A snoozed friend's or a
not-yet-contacted person's birthday still appears.
**This is a scoped EXCEPTION to 01-data C's suppression rules, not a reversal** — the dashboard
*list* still excludes snoozed and never-contacted; only the birthday banner reaches past them,
because a birthday is exactly the moment to break a snooze or finally reach out. The plugin's
banner iterated **all** contacts with no predicate (`BirthdayBanner.tsx:15`); this replaces that
with "exclude archived only."
**[REJECTED] Include snoozed but exclude never-contacted**; **[REJECTED] respect the dashboard's
full exclusions** (would silently drop a snoozed friend's birthday).

**[DECIDED] The weekly DIGEST is deferred wholesale to domain 14; the dashboard ships no digest
surface in v1.** The plugin's digest was a manual-command markdown-file export
(`main.ts:294-356`) with no mobile analogue, and its keep/cut is Q7's other half.
*Exported to domain 14:* the digest's candidate mobile homes (a dashboard summary strip, a weekly
notification, a dedicated screen, or cut) are domain 14's to choose; the dashboard reserves
nothing for it in v1.

### Cluster F — Freshness, refresh & empty states

**[DECIDED] The dashboard re-queries automatically on screen-focus and on app-foreground, and
also offers pull-to-refresh. No ported refresh button.** The auto path is the correctness
mechanism; pull-to-refresh is a familiar Android affordance on top.
Rationale (platform-verified): `expo-sqlite`'s `addDatabaseChangeListener` wraps SQLite's
`sqlite3_update_hook`, which is **connection-scoped** and cannot see writes made on another
connection — so it is **structurally blind to the headless widget/notification "mark contacted"
writes** that happen in a separate JS context. A change-listener would therefore silently miss
the single most important cross-context update. Re-query on focus (`useFocusEffect`) plus an
`AppState`→`active` listener (covers home→widget→reopen, which may not fire a navigation event)
is the reliable path. Reads must use the **async** query API — the `...Sync` variants block the
JS thread — which keeps HANDOFF §3's "no blocking call on the read path" intact.
**[REJECTED] Auto-only, no visible control**; **[REJECTED] a ported explicit refresh button.**

**[DECIDED] Cause-aware empty states.** First run (zero contacts) shows a prominent "Add your
first contact" CTA; when the default list is empty only because everyone sits in a hidden
population, the empty state points there ("3 not yet contacted →"). This distinguishes "you have
nobody" from "everybody's in another bucket" — the same discoverability risk the counts in
Cluster B address.
**[REJECTED] One generic "No contacts" state**; **[REJECTED] deferring empty states to the design
pass** (the *cause-distinction* is behavior, not styling; the copy/visuals remain the owner's).</new_string>
</new_string>
</new_string>
</invoke>


---

## Cross-domain constraints exported

- **[dashboard → fuel]** The **cross-contact fuel search** 03-fuel decided but left unowned is the
  **dashboard search box** — name AND fuel text, plain `LIKE`, `off_limits` excluded. 03-fuel's
  "who did I save this for" case is served here.
- **[dashboard → data / 03-fuel]** The search index over fuel must **exclude `off_limits`** items,
  matching every other glanceable surface.
- **[dashboard → INDEX / self]** Domain 8 **adopts and owns the never-contacted screen** (a
  separate sibling list, reached from the dashboard, entry shows a count) — previously unowned
  (01-data). Archived stays 06-crud's separate screen.
- **[dashboard → INDEX]** The **dashboard is the app's home/landing screen**; the orrery and the
  list screens hang off it. The nav *mechanism* (tabs/drawer/stack) is a planning detail.
- **[dashboard → data]** The default dashboard query excludes **three** populations —
  `last_contact IS NOT NULL` (never-contacted), `archived_at IS NULL`, and not-currently-snoozed.
  A **"Snoozed" segment** overrides the snooze exclusion on demand (does not reverse 01-data C).
- **[dashboard → widget (12) / profile]** Favourites are **marked with a star on the contact
  profile** and **ordered by drag on a net-new "Manage favourites" screen shared with the widget
  config**. This is the rank-editing surface 06-crud D assigned to 8/12. The profile screen (still
  unowned in INDEX) therefore gains a favourite toggle.
- **[dashboard → orrery (9)]** Rogue contacts are **not** hidden from the dashboard (only
  snooze/archive/never-contacted are); a rogue contact appears in the list with its status
  treatment. The card's rogue rendering **inherits domain 9's rogue visual** (04-log left rogue
  rendering open) — the dashboard does not invent its own.
- **[dashboard → 14 (digest) / 11 (notify)]** The dashboard owns the **birthday BANNER** (7-day,
  soonest-first, tap→profile, excludes archived only — overrides snooze/never-contacted
  suppression). It does **not** own birthday *notifications* (11) or the weekly *digest* (14),
  both still open under HANDOFF Q7. Domain 14 must not assume the dashboard reserved digest space.
- **[dashboard → 14 / planning]** The ported birthday parser has **two bugs to fix in the new
  single parser**: (1) a **day-of drop** — the contact vanishes from the banner *on* their
  birthday because `today` carries a time-of-day while `birthdayThisYear` is local midnight, so
  the `< today` roll-forward pushes daysUntil to ~365 and the `"🎉 Today!"` branch is dead code
  (`BirthdayBanner.tsx:12,83,86,47-48`); (2) **Feb-29 → Mar-1** in non-leap years via JS `Date`
  overflow. The new column keeps a single parser with an optional year (01-data F).
- **[dashboard → data / photos]** Cards use `expo-image` with **`recyclingKey={contactId}`** as a
  **correctness** requirement (prevents a recycled row flashing the previous contact's face), not
  a mere optimization. Reads use the **async** SQLite API only (sync variants block the JS thread).

---

## Deferred to phase discussion

- The never-contacted screen's own design: name, nav placement, sort within it, whether it
  reuses the dashboard card, what its empty state says. (Domain 8 owns it, but the detail waits.)
- The "Manage favourites" screen's design and how it is co-owned with the widget config (domain
  12) — one screen or two entry points into one list.
- The exact filter/segment affordance: chips vs a menu; whether filters combine (category AND
  battery) or are single-select like the plugin picker; whether the snoozed and favourites
  segments are peers of the category/battery filters or a separate control.
- Whether search is a live in-place filter of the flat list (the picker's behavior) or a distinct
  results view, and how a fuel-match is indicated vs a name-match.
- Copy and visuals for the cause-aware empty states, the hidden-population counts, and the
  birthday banner (owner's design pass, HANDOFF §12.4).
- How the category label, favourite marker, status ring, and fuel preview are arranged on the card
  (owner's design pass).
- Whether the birthday banner's tap could later offer a message action rather than only opening
  the profile (interacts with domain 11's compose/SMS handoff).

---

## Deferred to phase planning

- The dashboard's default query and its indexes: `archived_at IS NULL AND last_contact IS NOT NULL
  AND (snooze_until IS NULL OR snooze_until <= now)`, plus the segment/filter variants.
- The freshness wiring: `useFocusEffect` re-query + `AppState`→active listener; async-only query
  API; whether pull-to-refresh simply re-runs the same query.
- The name+fuel search query (`LIKE` join across contacts and fuel, `off_limits` excluded), and
  whether it needs its own index at this scale (03-fuel deferred FTS5).
- Persisting last-used sort/filter across launches — AsyncStorage is the idiomatic choice
  (platform-verified); a SQLite settings row is a fine alternative. Not load-bearing.
- The nav mechanism (tab bar vs drawer vs stack) and how the five-ish destinations (dashboard,
  orrery, not-yet-contacted, archived, settings, and any compose entry) are wired.
- The recency sort's tiebreak and its handling of the derived `daysSinceContact`.
- Reconcile a version-label drift noticed during verification: the 07-photos workpaper is pinned
  to Expo SDK 55 / RN 0.83.4 while 01-data and this run verified against **SDK 57 / RN 0.86**. It
  does not change any 07-photos decision, but the label should be reconciled at planning time.

---

## Decisions made without you

Orchestrator's picks with no articulable divergence. **Read each as the decision AS ADOPTED.**
Veto any cheaply at review.

1. **The plugin's hardcoded category-group map** (`ContactGrid.tsx:11-24`, the 11-token
   Family&Friends/Community&Professional/Service/Other scheme) **is dropped entirely** — it was the
   source of 01-data F6's incoherence and is moot once grouping is gone and categories are a real
   table.
2. **The contact-count display** ("N contacts") is retained in some header form; it is cheap and
   orienting. Exact placement is the design pass.
3. **Rogue contacts sort with `decay`/beyond in the status sort** (rogue is the far end of the
   continuous progress value) — the exact ordering of rogue vs decay is domain 9's threshold call,
   not the dashboard's.
4. **The search is a real-time in-place filter** by default (mirrors `ContactPickerGrid`'s
   behavior), pending the phase-discussion refinement above.
5. **Filters/segments reset to the default (all, status-sorted) is NOT forced on launch** — last
   used is persisted (see planning). If persistence proves annoying it is a one-line change.
6. **The birthday banner's window stays 7 days** (the plugin's value) unless domain 14 revisits it
   when it designs birthday handling end-to-end.

---

---

## Findings

Investigation 2026-08-13. Orchestrator read the plugin's full dashboard path on disk:
`views/OrbitDashboard.tsx`, `OrbitView.tsx`, `components/OrbitHeader.tsx`, `ContactGrid.tsx`,
`ContactCard.tsx`, `ContactPickerGrid.tsx`, `BirthdayBanner.tsx`, `context/OrbitContext.tsx`,
`OrbitIndex.getContactsByStatus()`, `main.ts:290-356` (weekly digest), and the `Sidebar View.md`
/ `Orbit Hub.md` docs. Subagents produced workpapers in `workpapers/08-dashboard/`.

### The plugin's dashboard, verified first-hand

- **Shell** (`OrbitDashboard.tsx`): `BirthdayBanner` (top) + `OrbitHeader` + `ContactGrid`.
- **Header** (`OrbitHeader.tsx`): a contact count, a **sort** dropdown (`status` | `name`), a
  **filter** dropdown (`all` | `charger` | `decay`(= decay+wobble, labelled "Needs Attention")),
  and a manual **Refresh** button. That is the entire control set.
- **Grid** (`ContactGrid.tsx`): filter → sort → then **group into hardcoded category sections**
  ("Family & Friends", "Community & Professional", "Service", + "Other"). Empty sections are
  hidden. Status sort order is `decay 0, wobble 1, stable 2, snoozed 3` — so the plugin **shows
  snoozed contacts** (last), which the mobile snooze-suppression rule reverses.
- **Card** (`ContactCard.tsx`): avatar (photo or initials) + status-ring class + name. Hover →
  fuel tooltip; right-click → mark-contacted / snooze 1wk / snooze 1mo / unsnooze / open. **No
  category badge, no recency string, no fuel preview inline** — despite the docs.
- **Docs drift (confirms 01-data F7 / 03-fuel F10):** `Sidebar View.md:37-40` advertises a
  **category filter** and a **3-way battery filter**, and `Orbit Hub.md:21` a **category badge** —
  none exist on the sidebar. The richer control set (name search, category dropdown, battery
  dropdown, 3-way recency sort, "decaying only" toggle) is real but lives on
  **`ContactPickerGrid.tsx:107-163`**, the modal picker — not the dashboard. Per 03-fuel F10,
  domain 8 should inherit from the **picker**, not the header.
- **Birthday banner** (`BirthdayBanner.tsx`): iterates **all** contacts, shows those with a
  birthday within **7 days**, soonest first, tap opens the note. Renders null if none.
- **Weekly digest** (`main.ts:294-356`): builds a markdown report bucketing contacted-this-week /
  needs-attention(decay) / snoozed, writes it to a vault file and opens it — a mechanism with **no
  mobile analogue**. Verified it is a **manual palette command only** — no interval, no scheduler.

### F1 — A change-listener cannot see the headless one-tap write (platform-verified)

`expo-sqlite@57`'s `addDatabaseChangeListener` wraps SQLite's `sqlite3_update_hook`, which fires
**only for writes on the connection it was registered on** — "cannot access any changes made
outside of that connection; not even other threads in the same process using a different
connection" (SQLite docs). The widget/notification "mark contacted" write runs headless in a
separate JS context on its own connection (04-log F5), so a foreground listener is **structurally
blind** to the single most important cross-context update. The reliable freshness mechanism is a
**re-query on focus (`useFocusEffect`) + an `AppState`→active listener**, not a listener. A manual
refresh is optional polish. The hook also misses truncate-optimized deletes and `ON CONFLICT
REPLACE` — a second reason not to lean on it. (Cites in `platform-reactive-read-path.md`; SDK 57 /
expo-sqlite 57.0.1 / RN 0.86, doc-verified — no `node_modules` in the repo yet.)

### F2 — The offline read path holds, with two must-dos

`expo-image` makes **zero** network calls for a local `file://` source (`cachePolicy:memory-disk`
is inert for local files), so nothing on the read path hits the network. Two requirements:
reads must use the **async** query API (the `...Sync` variants are documented to block the JS
thread), and avatars must be **app-sandbox document-dir files** so the URI is always readable.
`recyclingKey={contactId}` is a **correctness** requirement in a scrolling list (it blanks the
view before the new source loads), not just an optimization. Memory is a non-issue at tens of rows.

### F3 — The plugin's birthday/digest code honours none of mobile's suppression rules

The banner iterates **all** contacts (`BirthdayBanner.tsx:15`, filtering only on a missing
birthday) and the digest **explicitly buckets snoozed** contacts (`main.ts:305-306,333-336`) and
surfaces **never-contacted** ones as "(last: never)" in Needs-Attention (`main.ts:308-311`, since
`calculateStatus(null)`→decay). All three contradict 01-data (snooze hidden from lists;
never-contacted and archived excluded). So the banner **cannot port the all-contacts loop** — it
needs a deliberate predicate, decided in Cluster E as "exclude archived only," a scoped exception.

### F4 — Two birthday-parser bugs to fix in the new single parser

(1) **Day-of drop:** `today` carries a time-of-day (`BirthdayBanner.tsx:12`) but `birthdayThisYear`
is local midnight (`:83`); on the actual birthday the `< today` guard (`:86`) rolls it to next
year, so `daysUntil` ≈ 365 and the contact **vanishes from the banner on their birthday** — the
`"🎉 Today!"` branch (`:47-48`) is dead code. Distinct from the classic UTC off-by-one. (2)
**Feb-29 → Mar-1** silently in non-leap years via JS `Date` overflow. Verified first-hand against
the file; recorded so the new parser (01-data F, one parser, optional year) does not reinherit them.

### Workpapers

- `workpapers/08-dashboard/platform-reactive-read-path.md` — reactive/offline read path, versions,
  URLs (Expo SDK 57).
- `workpapers/08-dashboard/overlap-birthday-digest.md` — the dashboard ↔ digest/notify/birthday
  seam, with the keep/cut entanglement and parser bugs.
</content>
</invoke>
