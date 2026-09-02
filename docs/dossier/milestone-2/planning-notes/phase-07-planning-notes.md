# Phase 07 — Dashboard Card View — Planning Notes

- **Phase:** 07 Dashboard Card View
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-07-dashboard-card-view-dossier-v0.2.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**E-08 — bulk delete's "30-day quarantine" premise was false.**

- **Owner resolution (2026-09-01):** **bulk Delete becomes Archive. There is no contact quarantine
  and no auto-purge.**
- The dossier's D-07-092 ("current delete behavior sends contacts into a 30-day quarantine",
  `phase-07…md:317`) and its confirmation copy D-07-093/114/130 (:319, :385, :429) rested on a
  premise the code contradicts. D-RM-026 (`roadmap:185`) restated it.
- **Code facts (verified 2026-09-01):** **no contact quarantine or auto-purge exists** — "Retention
  is INDEFINITE… there is NO auto-purge sweep" (`src/screens/ArchivedContactsScreen.tsx:9-11`);
  purge is archive-gated and manual (`src/db/purge-dao.ts:211-219`); the Profile has no Delete at
  all. The only 30-day quarantine in the app is for custom-field **definitions**
  (`src/services/field-sweep.ts`, `HANDOFF.md` §14.5).
- **Plan implication:** the Sensitive Operations entry is **"Archive"**, and permanent deletion
  remains a deliberate action taken on the Archived list. **Do not build a quarantine state or a
  launch-time auto-purge sweep** — that would be a data-loss policy ADR-018 never decided.
  Confirmation copy must describe archiving, not quarantine.

**E-01 — Favourites binary.** Owner resolution: Manage-favourites screen retired; widget uses the
Favorites population in Default order. D-07-033 (`phase-07…md:111`) stands — the Grid never sorts by
rank. Bulk "favourite" (below) sets membership, not rank.

**E-02 — never-contacted contacts.** Owner resolution: an **All Contacts** population
(Active ∪ Not Contacted); Active excludes never-contacted; the Never Contacted screen retires.
D-07-025 (:81) is the **card presentation** for never-contacted cards inside All Contacts / Not
Contacted, not a change to the Active predicate.

## REPLAN items for plan-phase

### R-19 — multi-select assumes bulk mutations that do not exist

- **Unbuilt / needed:** bulk Quick Log, favourites, snooze, category, archive, frequency
  (D-07-076…090).
- **Code facts (verified 2026-09-01):** **no bulk mutation exists** for any of these; archive writes
  an immutable lifecycle event per contact **inside its transaction**
  (`src/db/contacts-dao.ts:527-545`).
- **Resolved / recommended path:** build each bulk operation as **N composed single-contact
  operations inside one transaction**, reusing the existing cores — not as a set-based SQL update.
- **Constraints / trip-wires:**
  - **Bulk archive must compose N lifecycle-event writes** (ADR-025's event fan-out). A bare
    `UPDATE contacts SET archived_at=…` would silently skip the immutable event trail.
  - **Bulk Quick Log must compose the recency cores** — `insertInteractionCore` +
    `recomputeLastContactCore` (`src/db/recency-dao.ts:159-214,258-346`; ADR-010/024/071) — inside
    one transaction. The write mutex is **non-reentrant**: compose the *cores*, never call top-level
    writers in a loop. A bulk `INSERT INTO interactions` (as `benchmark.ts:119` does) leaves
    `last_contact` wrong for every contact touched.
  - `rejectFutureOccurredAt` applies to every logged interaction, bulk included.

### R-17 — status glyphs and the semantic icon registry do not exist

- **Unbuilt / needed:** D-07-027/028 consume Phase 2's silhouettes and registry.
- **Code facts (verified 2026-09-01):** colour + border weight only
  (`src/utils/contact-card-ring.ts:44-61`); no registry; no reduced-motion hook.
- **Resolved / recommended path:** consume Phase 2's deliverables; do not fork a second icon source.

## Migration / sequencing

- **None of its own** — every bulk operation composes existing writers against existing schema.
- **Explicitly not implied (E-08):** no quarantine column, no purge-deadline column, no launch-time
  auto-purge sweep.
- **Must land after:** Phase 4 (population/sort model) and Phase 2 (glyphs/registry).

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 18:** Grid density fallbacks, large-text reflow, and grid performance
  (D-07-016/017/103).
- **Backup/Restore:** Phase 7 §O disowns import — import lives with Backup/Restore, whose format-4
  bump is **Phase 16's** final plan (R-09). Phase 7's multi-select entry point (per AF-02) is
  "Select Contacts", not an import surface.
