# Phase 04 — Dashboard Data & State Foundation — Planning Notes

- **Phase:** 04 Dashboard Data & State Foundation
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-04-dashboard-data-state-foundation-dossier.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**E-01 — Favourites: binary membership vs ADR-033's drag-reordered rank.**

- **Owner resolution (2026-09-01):** the **Manage-favourites screen is retired**, and the
  **widget uses the Favorites population in Default order**.
- Consequence for Phase 4: the dossier's binary model (D-04-022 `phase-04…md:68`; D-04-023/092
  :70,:306; D-04-040 :137; D-04-088 :279) stands. The Dashboard never sorts by
  `favourite_rank`.
- **Code facts (verified 2026-09-01):** `favourite_rank` is the only favourite column
  (`001-initial.ts:74`); the favourites branch orders `favourite_rank ASC`
  (`src/db/dashboard-read.ts:244-245`); widget data is `listDashboard({filter:"favourites"})`
  truncated to 6 by rank (`src/services/widget/widget-data.ts:83-86`); capture / sun / merge pickers order by
  rank (`src/db/capture-read.ts:65-66`, `src/db/sun-picker-read.ts:45`,
  `src/db/merge-candidate-read.ts:29`).
- **Plan implication:** the widget's ordering source changes from rank to the Favorites population's
  Default order (ADR-043's consequence). `ManageFavouritesScreen.tsx` and the rank-ordered picker
  reads need a decided fate — either they fall back to Default order too, or the column becomes
  vestigial. **Do not drop the `favourite_rank` column** without a plan for the pickers that read
  it. This ratification supersedes ADR-033; confirm the superseding ADR exists before planning.
- **Deferred (owner, 2026-09-01):** customizable widget membership is deferred to a future
  milestone. The widget's membership is the Favorites population; it is not user-configurable in
  this milestone.

**E-02 — never-contacted contacts in Active Contacts vs ADR-011's segregation.**

- **Owner resolution (2026-09-01):** there is an **"All Contacts" population = Active ∪ Not
  Contacted**; **Active excludes never-contacted**; the **Never Contacted screen and the
  include-Unbound toggle retire**.
- Consequence for Phase 4: D-04-027 ("never-contacted remain eligible for Active Contacts") is
  **not** what ships. Not Contacted becomes a **population**, and All Contacts is the union — ADR-011's
  read-level segregation of Active survives.
- **Code facts (verified 2026-09-01):** `BASE_WHERE` requires `last_contact IS NOT NULL`
  (`src/db/dashboard-read.ts:155-158`); never-contacted is a sibling list
  `listNeverContactedWithPolicy` (`:296-322`) plus `NeverContactedScreen.tsx`; the header count
  excludes them (`:383-388`); the orrery read excludes them (`src/db/orrery-read.ts:95-101`).
- **Plan implication:** keep `BASE_WHERE` for Active; build All Contacts as an explicit union
  predicate, not by weakening `BASE_WHERE`. Retiring `NeverContactedScreen` and the
  `include_unbound_never_contacted` setting is a **deletion with consumers** — the setting is in
  `PORTABLE_SETTINGS_KEYS` (`src/backup/backup-schema.ts:106-113`) and in
  `SettingsScreen.tsx:911-947`; plan its removal and its backup-compat behavior together with
  Phase 16's format-4 bump.

**E-04 — removing the Dashboard birthday banner (ADR-034) and the un-owned "Your Week".**

- Your Week now has a **deferred slot (Phase 19)** — see `phase-19-your-week-placeholder.md`. The
  7-day "reason to reconnect" surface therefore has a named destination.
- **Code facts (verified 2026-09-01):** `BirthdayBanner.tsx:40` (`WINDOW_DAYS = 7`), mounted at
  `HomeScreen.tsx:270`; `listBirthdayCandidates` (`dashboard-read.ts:391-399`). **Digest has no
  birthday read at all.**
- **The banner's fate is recorded in the dossier and in `docs/decisions/` (ADR-034 supersession),
  not here.** Confirm before planning; if the banner is removed and Phase 19 is not yet planned,
  note the coverage gap in the plan rather than silently dropping the surface.

**AUTO-FIX applied to this dossier:** AF-08 — D-04-008 (:31) and D-04-088 (:278) still listed a
compact Card/Grid renderer as "Explicitly Deferred"; Phase 7 v0.2 **is** that renderer (D-07-011/013,
D-RM-015). No separate compact renderer is deferred.

## REPLAN items for plan-phase

### R-10 — typo tolerance and knowledge-wide search vs ADR-031/032's LIKE-only, no-FTS5 model

- **Unbuilt / needed:** D-04-052…059 (`phase-04…md:174-196`).
- **Code facts (verified 2026-09-01):** exact substring `LIKE ? ESCAPE '\'` over `contacts.name` +
  eligible `fuel.text`, ordered by the active sort, never by relevance
  (`src/db/dashboard-read.ts:230-240`). ADR-031 rejected FTS5.
- **Resolved path (owner, 2026-09-01):** **TypeScript scoring over the already-filtered eligible
  set** — prefix/substring plus **edit distance ≤ 1 per term (≤ 2 for terms of six or more
  characters)**. **No FTS5, no new index.**
- **Constraints / trip-wires:** FTS5 would reverse ADR-031 → ESCALATE. The searchable **corpus**
  (Memory labels/notes, relationships, custom fields) depends on **R-01 (Phase 3) landing first** —
  Phase 4 cannot search fields that do not exist.

### R-11 — Phase 4 removes Unbound contacts from Dashboard search, but search is the only name-lookup path for Unbound today

- **Unbuilt / needed:** a replacement retrieval path before D-04-047 ("Dashboard search never
  surfaces Unbound contacts", `phase-04…md:154`) can ship.
- **Code facts (verified 2026-09-01):** the search branch is archived-only and **does** return
  Unbound as neutral rows today (`src/db/dashboard-read.ts:230-240`;
  `src/screens/dashboard-search-row-logic.ts:20-24`) — this is ADR-062's "retrieval row" consequence.
  `UnboundContactsScreen.tsx` has **no search**. Phase 1's picker mentions Archived and Snoozed
  markers but not Unbound (D-01-037/039).
- **Resolved / recommended path:** give the Unbound child route its own search, **or** add Unbound
  to the picker's explicit-search path — so ADR-062's "retrieval … stay[s] available" holds.
- **Constraints / trip-wires:** removing the Unbound search rows **without** a replacement path
  weakens ADR-062 → treat as a trip-wire, not a cleanup.

### R-16 — Dashboard preferences are new durable settings

- **Unbuilt / needed:** population multi-select + List/Card + Default-vs-explicit sort (D-04-065).
- **Code facts (verified 2026-09-01):** AsyncStorage `orbit-dashboard-prefs` holds a single `sort`
  and `filter`; not portable, not in the backup.
- **Resolved path (owner, 2026-09-01):** these live in **`app_settings` columns**, portable via the
  backup manifest — not AsyncStorage. Add the keys to `PORTABLE_SETTINGS_KEYS`.

## Migration / sequencing

- Implies **one migration** for the dashboard preference columns (population multi-select, view
  mode, sort mode + default-vs-explicit distinction) in `app_settings`, plus the removal path for
  `include_unbound_never_contacted` (E-02) — removal of a portable settings key must be coordinated
  with the backup format-4 bump, not done unilaterally.
- **Number it head+1 at plan time**, verified on disk. Head at audit time was 14.
- **Must land after:** Phase 3's knowledge model (R-01), which supplies the search corpus.
- **Must land before:** Phase 16's format-4 backup bump.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15:** the Dashboard List right-swipe preference (Quick Log vs Log Contact, default Quick
  Log) reaches Settings via Phase 6 (D-06-062/065/098).
- **Phase 19 / Your Week:** richer birthday presentation (D-04-025, D-04-082) — see
  `phase-19-your-week-placeholder.md`.
