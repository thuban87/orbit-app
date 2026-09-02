# Phase 05 — Dashboard Control Surface — Planning Notes

- **Phase:** 05 Dashboard Control Surface
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-05-dashboard-control-surface-dossier-amended-group-events.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**E-01 — the "Manage Favorites" overflow entry.**

- **Owner resolution (2026-09-01):** the **Manage-favourites screen is retired**; the widget uses
  the **Favorites population in Default order**.
- Consequence for Phase 5: the Dashboard overflow entry **Manage Favorites** (D-05-005 :44-50,
  D-05-055 :270-275) goes away. It had no defined purpose under the binary model, and the only
  sensible one (a list with unstar) was ADR-033's **rejected alternative** — do not build it.
- Today's Settings row "Manage favourites" (`src/screens/SettingsScreen.tsx:2005-2048`) is part of
  the same retirement; hand its removal to whichever plan touches Settings (see Phase 15 stub).

**E-02 — never-contacted contacts.**

- **Owner resolution (2026-09-01):** an **"All Contacts" population (Active ∪ Not Contacted)**;
  **Active excludes never-contacted**; the **Never Contacted screen and the include-Unbound toggle
  retire**.
- Consequence for Phase 5: the control surface exposes populations, so All Contacts / Active / Not
  Contacted are population entries — not a Never Contacted destination.

**E-04 — no permanent Dashboard birthday module.**

- D-05-013 (`phase-05…md:122-124`) and D-05-082 (:397) delegate richer birthday content to "Your
  Week", which now has a **deferred slot (Phase 19)** — see `phase-19-your-week-placeholder.md`.
  The ADR-034 outcome for the existing banner is recorded in the dossier and `docs/decisions/`,
  not here.

**E-07 — Archived and Unbound become Dashboard child routes.**

- D-05-058/059 (:284-288) move Archived and Unbound out of Settings, editing ADR-019's consequence
  ("Settings becomes the distinct home for Custom Fields and Archived contacts") and the *placement*
  clause of ADR-018 ("restore and permanent deletion live **only in Settings' Archived contacts
  list**"). **ADR-018's substance — the archive-before-purge gate — is untouched.**
- **The outcome is recorded in the dossier and `docs/decisions/`, not here.** Confirm before
  planning the overflow's route table.

**AUTO-FIX applied to this dossier:**

- **AF-02** — §M's overflow bulk entry no longer claims to "support the existing/current import";
  the entry enters **Phase 7 Grid multi-select ("Select Contacts")**. Import belongs to
  Backup/Restore per Phase 7 §O. The §R "Import/Bulk Management" line was corrected likewise.
- **AF-08** — D-05-075 (:372) no longer defers a compact Card/Grid renderer; Phase 7 v0.2 is it.

## REPLAN items for plan-phase

### R-11 — Unbound retrieval after Dashboard search stops surfacing Unbound

- **Unbuilt / needed:** a name-lookup path for Unbound contacts that is not Dashboard search.
- **Code facts (verified 2026-09-01):** `UnboundContactsScreen.tsx` has **no search**; today's
  Dashboard search returns Unbound as neutral rows (`src/db/dashboard-read.ts:230-240`,
  `src/utils/dashboard-search-row-logic.ts:20-24`) — the ADR-062 "retrieval row" consequence.
- **Resolved / recommended path:** since Phase 5 owns the Unbound child route, give that route its
  own search (or ensure Phase 1's picker covers Unbound). Coordinate with Phase 4's R-11 note so the
  work is owned once, not twice.
- **Constraints / trip-wires:** removing Unbound from search **without** a replacement weakens
  ADR-062 → trip-wire.

### R-19 — the amended overflow assumes bulk mutations that do not exist

- **Unbuilt / needed:** bulk Quick Log, favourites, snooze, category, archive, frequency
  (D-07-076…090 — Phase 7 builds them; Phase 5 routes to them).
- **Code facts (verified 2026-09-01):** **no bulk mutation exists** for any of these; archive writes
  an immutable lifecycle event per contact inside its transaction
  (`src/db/contacts-dao.ts:527-545`).
- **Resolved / recommended path:** Phase 5's overflow entry is a **route into Phase 7's multi-select
  mode**, not its own implementation. Sequence Phase 5's entry behind Phase 7's capability or ship
  the entry disabled.
- **Constraints / trip-wires:** bulk archive must compose N per-contact lifecycle-event writes
  (ADR-025); bulk Quick Log must compose the recency cores (see Phase 12's R-02 note). Never a bulk
  `INSERT INTO interactions`.

## Migration / sequencing

- **None of its own.** Phase 5 is a control surface over Phase 4's state and Phase 7's bulk
  capability.
- Retiring the `include_unbound_never_contacted` setting (E-02) and the Manage-favourites row (E-01)
  touches `app_settings` / `PORTABLE_SETTINGS_KEYS` — coordinate the removal with Phase 16's
  format-4 bump rather than dropping keys ad hoc.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15:** today's Settings rows "Manage favourites / Custom Fields / Archived contacts"
  (`SettingsScreen.tsx:2005-2048`) and "Include unbound in Not yet contacted" (:911-947) must be
  reconciled there — E-01 retires the first, E-02 retires the last, and E-07 decides the home of
  Archived.
- **Phase 19 / Your Week:** richer birthday content (D-05-013, D-05-072).
