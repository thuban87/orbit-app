# Phase 06 — Dashboard List View — Planning Notes

- **Phase:** 06 Dashboard List View
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-06-dashboard-list-view-dossier.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**E-01 — Favourites binary vs ADR-033's rank.**

- **Owner resolution (2026-09-01):** the **Manage-favourites screen is retired**; the **widget uses
  the Favorites population in Default order**.
- Consequence for Phase 6: D-06-038/106 (`phase-06…md:134,363`) stand — the List never sorts by
  `favourite_rank`. Ranked order is not a List concern.

**E-02 — never-contacted contacts in the List.**

- **Owner resolution (2026-09-01):** an **"All Contacts" population (Active ∪ Not Contacted)**;
  **Active excludes never-contacted**; the Never Contacted screen retires.
- Consequence for Phase 6: D-06-019/045 (`No interactions yet`, neutral border — `:70,:161`) are the
  **row presentation for never-contacted rows inside All Contacts / Not Contacted**, not a change to
  the Active predicate. `BASE_WHERE` (`src/db/dashboard-read.ts:155-158`) still excludes them from
  Active.

## REPLAN items for plan-phase

### R-17 — status glyphs and the semantic icon registry do not exist

- **Unbuilt / needed:** D-06-043 consumes Phase 2's status silhouettes and icon registry
  (D-02-049/050/053).
- **Code facts (verified 2026-09-01):** status today is **colour + border weight only**, no glyphs
  (`src/utils/contact-card-ring.ts:44-61`); there is no icon registry in `src/`; zero
  `useReducedMotion` / `isReduceMotionEnabled` usage anywhere.
- **Resolved / recommended path:** **Phase 2 must deliver the registry, the glyph set, and the
  reduced-motion hook before Phase 6 plans against them.** If Phase 6 is planned first, it must
  either define those primitives itself (and hand them to Phase 2) or block — do not fork a second
  icon source.
- **Constraints / trip-wires:** all colours resolve through theme tokens; no hardcoded colour in
  row rendering.

### R-16 — the right-swipe logging preference is a new durable setting

- **Unbuilt / needed:** global right-swipe preference, Quick Log vs Log Contact, default Quick Log
  (D-06-062/065/098).
- **Resolved path (owner, 2026-09-01):** it lives in an **`app_settings` column**, portable via the
  backup manifest — not AsyncStorage. Phase 6 owns the preference's storage and read; **Phase 15
  owns the Settings UI** for it.

## Migration / sequencing

- Implies **one small migration** adding the right-swipe preference column to `app_settings` (may be
  folded into Phase 4's preference migration if the phases are planned together — decide once, not
  twice).
- **Number it head+1 at plan time**, verified against `src/db/migrations/` on disk. Head at audit
  time was 14.
- **Must land after:** Phase 2's icon registry / glyph set / reduced-motion hook (R-17); Phase 4's
  population and sort model.
- **Must land before:** Phase 16's format-4 backup bump (the new key must be portable).

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15:** the Dashboard List right-swipe preference — Quick Log vs Log Contact, global,
  default Quick Log (D-06-062/065/098).
- **Phase 17:** an early right-swipe logging preference choice plus Dashboard gesture/star education
  (D-06-064/072/073/099).
- **Phase 18:** List density fallbacks and large-text reflow (D-06-101).
