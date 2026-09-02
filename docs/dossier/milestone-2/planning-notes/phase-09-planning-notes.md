# Phase 09 — Orrery Systems — Planning Notes

- **Phase:** 09 Orrery Systems
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-09-orrery-systems-dossier.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**None.** No escalation routes to Phase 9. Note that Phase 8's E-02 and E-03 outcomes constrain what
Systems can render (population membership, and whether a Relationship view still exists) — read
`phase-08-planning-notes.md` before planning.

## REPLAN items for plan-phase

### R-05 — Systems persistence is entirely unbuilt

- **Unbuilt / needed:** persisted System definitions, rules, inclusions, exclusions, order,
  visibility, and last-active System (D-09-006/011/132, `phase-09…md:45,62,539-550`).
- **Code facts (verified 2026-09-01):** orrery persistence is **only** `sun_contact_id` and
  `self_sun_colour` (`src/db/migrations/003-orrery-settings.ts:38-48`) plus `contacts.ring_seq`.
  No systems table, no rules, no inclusion/exclusion sets, no ordering, no visibility state.
- **Resolved / recommended path:** a new table set — System definitions, rule rows, and explicit
  inclusion/exclusion rows — with ordering and visibility as columns on the definition. Last-active
  System is a **preference** and belongs in `app_settings` (R-16 owner resolution), not in the
  Systems tables.
- **Constraints / trip-wires:**
  - **Generated Systems derive from Categories.** Category deletion fallout is real: it must
    invalidate or repoint generated Systems and custom-System rules, with the warning D-09-041
    requires. Category CRUD itself is Phase 15 — plan the **fallout handling** here so Phase 15 has
    something to call.
  - Read every writer of the tables this phase adds before asserting an invariant about them; the
    graph cannot enumerate SQL writers.
  - Reduced motion (D-09-117) consumes Phase 2's hook (R-17), which does not exist yet.

### R-09 — Systems state must be serializable by the backup format bump

- **Code facts (verified 2026-09-01):** backup format 3 serializes the entity set at
  `src/backup/export-manifest.ts:45-81`. Systems are not present (they do not exist).
- **Resolved path (owner, 2026-09-01):** **the backup format bump to v4 is folded into Phase 16 as
  its final plan, sequenced after all other schema lands.** Phase 9 does **not** bump the format;
  it must **declare its entity list and validation/orphan-repair expectations** in its plan so
  Phase 16 can serialize them.

## Migration / sequencing

- Implies **one migration** creating the Systems tables (definitions + rules + inclusions/exclusions
  + order + visibility), plus the last-active-System preference column in `app_settings` (may be
  shared with Phase 8's orrery-prefs migration).
- **Number it head+1 at plan time**, verified against `src/db/migrations/` on disk. Head at audit
  time was 14.
- **Must land after:** Phase 8 (camera/scale foundation) and Phase 3 (relationships, if Systems
  reference them).
- **Must land before:** Phase 16's format-4 backup bump — that is the last schema-consuming plan in
  the milestone.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15:** Systems Management is a **route into the canonical surface Phase 9 builds**, not a
  reimplementation (D-09-086/143); plus Category CRUD and its deletion fallout
  (D-09-037…041/045/134…136/143).
- **Phase 18:** large-System performance, culling/LOD, HUD responsiveness, yearly rendering budget
  (D-09-111/131/145); reduced-motion QA once Phase 2's hook exists.
