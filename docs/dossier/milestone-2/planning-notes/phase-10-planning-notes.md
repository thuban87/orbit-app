# Phase 10 — Profile Experience — Planning Notes

- **Phase:** 10 Profile Experience
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-10-profile-experience-dossier.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**E-06 — Phase 10 removes the Profile AI-draft entry that ADR-052 required.**

- D-10-016 "AI Draft is not restored as a separate Profile action" (`phase-10…md:71`) against
  ADR-052's Context/rejected note: "Compose-only invocation — rejected because profile browsing also
  needs a drafting entry point" (`docs/decisions/ADR-052…md:18,22`).
- **Code facts (verified 2026-09-01):** the Profile "AI draft" entry exists at
  `src/screens/ContactProfileScreen.tsx:1075`.
- **The outcome is recorded in the dossier and `docs/decisions/`, not here.** Confirm a superseding
  ADR before removing the entry; the same ADR covers Phase 16's disclosure half of E-06.

**E-09 — Profile / Hero backgrounds (D-10-017, `phase-10…md:77`)** are the Phase 10 half of the
`HANDOFF.md` §7 starfield-placement supersession ("not behind text-heavy screens"). See
`phase-02-planning-notes.md`; the outcome lives in the dossier and `HANDOFF.md` §7.

**AUTO-FIX applied to this dossier:** AF-05 — the GSD notes used pre-insert phase numbering.
`:878` now reads **Phase 13's** forms/business workflows and `:879` **Phase 14's** Message/AI
Compose (D-10-209/210 vs D-RM-014).

## REPLAN items for plan-phase

### R-06 — Profile layout/background templates, assignments, per-contact overrides, and expanded/collapsed persistence are unbuilt

- **Unbuilt / needed:** D-10-019/023/038/041/051/064/068 (`phase-10…md:81-89,146-184,241-254`).
- **Code facts (verified 2026-09-01):** there is **no** template / layout / assignment / collapsed
  schema anywhere; the single-row `profile` table is the **self record**, not a per-contact layout
  store. Custom snooze end date (D-10-110) needs **no schema** — `snooze_until` is already a date,
  so that is UI + DAO only.
- **Resolved / recommended path:** new tables for templates and assignments, plus a per-contact
  override table; expanded/collapsed section state is a **per-contact UI preference** — decide
  explicitly whether it is durable (a table) or ephemeral, and if durable, whether it belongs in the
  backup.
- **Constraints / trip-wires:**
  - Category assignments for layouts/backgrounds inherit **Category deletion fallout** (Phase 15
    Category CRUD, D-10-175/200). Plan the fallout behavior here.
  - Profile background images have an image-memory cost flagged for Phase 18 (D-10-186/203).

### R-15 — Cycles heatmap and cadence-relative Intensity are undefined for contacts with no cadence

- **Unbuilt / needed:** a defined fallback. D-10-100 derives the Intensity interval from Contact
  Frequency (`phase-10…md:391`).
- **Code facts (verified 2026-09-01):** `computeContactIntensity` returns `{available:false}` for
  Unbound (`src/utils/impact.ts:139`); `interval_days` is **nullable**
  (`011-contact-lifecycle-schema.ts:22-23`); ADR-062 requires that **every cadence consumer guard
  nullable cadence**. Profiles of Unbound / never-assigned-cadence contacts **are reachable**
  (D-04-085, D-05-059).
- **Resolved / recommended path:** define the fallback explicitly in the plan — hide the lens, or
  fall back to a fixed 7 Days / Month window. Coordinate with Phase 11's identical R-15 note so the
  answer is decided once.
- **Constraints / trip-wires:** an unguarded cadence read on an Unbound profile is an ADR-062
  violation, not a cosmetic gap.

### R-01 dependency — the Contact Knowledge model gates the Profile's knowledge sections

- Phase 10's TTR / knowledge sections (D-10-118…162) consume the Phase 3 model, which is **almost
  entirely unbuilt** (see `phase-03-planning-notes.md`). **Phase 3 must land first.** Do not plan
  Profile sections against Memory types, pinning, visibility, relationships, Last Talked About, or
  Current Location as if they exist.

## Migration / sequencing

- Implies **one migration** for profile layout/background templates, template assignments,
  per-contact overrides, and (if durable) collapsed-section state.
- **Number it head+1 at plan time**, verified against `src/db/migrations/` on disk. Head at audit
  time was 14.
- **Must land after:** Phase 3 (R-01 knowledge model) and Phase 2 (theme/background presets).
- **Must land before:** Phase 16's format-4 backup bump; declare the new entities for serialization.
- **No schema** for custom snooze end date.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15:** Profile layout/background **managers are routes into the canonical surfaces Phase 10
  builds**, not reimplementations (D-10-172/173); plus Category CRUD with layout/background
  assignment fallout (D-10-175/200).
- **Phase 17:** may introduce Profile customization/backgrounds without redefining them (D-10-202).
- **Phase 18:** Profile background image-memory behavior and large-text reflow (D-10-186/203).
