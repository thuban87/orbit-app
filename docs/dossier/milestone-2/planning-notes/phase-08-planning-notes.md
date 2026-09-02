# Phase 08 — Orrery Camera & Scale Exploration — Planning Notes

- **Phase:** 08 Orrery Camera & Scale Exploration
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-08-orrery-camera-scale-exploration-dossier.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**E-02 — the built-in "Not Contacted" Orrery System (D-08-087, `phase-08…md:357-364`).**

- **Owner resolution (2026-09-01):** an **"All Contacts" population (Active ∪ Not Contacted)**;
  **Active excludes never-contacted**; the Never Contacted screen and the include-Unbound toggle
  retire.
- Consequence for Phase 8: "Not Contacted" is a legitimate **population**, so a System over it is
  consistent — but the orrery read **currently excludes never-contacted bodies**
  (`src/db/orrery-read.ts:95-101`, mirroring ADR-011). The plan must widen the orrery read for that
  System **explicitly and by population**, not by deleting the exclusion from the default read.
- **Trip-wire:** removing the exclusion wholesale would put never-contacted bodies into every
  orrery view — the same ADR-011 reversal in a second surface. Keep the default read segregated.

**E-03 — removing the Status / Relationship mode split (D-08-005/006, `phase-08…md:27-29`;
D-08-153 :699; SC1 :673) reverses ADR-048.**

- ADR-048's Decision: "opens a status-default orrery and **morphs it on one Skia canvas into a calm
  relationship view**"; its rejected alternative was "Relationship view as the default or only view…
  would otherwise remove the owner's relationship map" (`docs/decisions/ADR-048…md:18,22`).
- **Code facts (verified 2026-09-01):** the split is live — `src/screens/OrreryScreen.tsx:121,178,683-692`;
  `src/components/orrery/OrbitBody.tsx:112-120` (angle-only morph; relationship mode = even angular spread
  plus muted colour, **not** category/gravity rings).
- **Ratified (owner, 2026-09-01):** the Status / Relationship mode split is removed in favour of a
  single unnamed status view. **ADR-077** supersedes ADR-048 on this point. Plan the removal.

## REPLAN items for plan-phase

### R-05 — density preset, satellites toggle, and last-active System persistence are unbuilt

- **Unbuilt / needed:** D-08-034 (density persists, `phase-08…md:152`); D-08-100/101 (satellites
  toggle, :409-416); last-active System (D-09-006, Phase 9's half).
- **Code facts (verified 2026-09-01):** orrery persistence is **only** `sun_contact_id` and
  `self_sun_colour` (`src/db/migrations/003-orrery-settings.ts:38-48`) plus `contacts.ring_seq`.
  There is **no** systems / density / satellite / camera state anywhere. Camera state is
  **intentionally ephemeral** (D-08-064) — no schema for it.
- **Resolved / recommended path (owner, R-16):** these are durable preferences → **`app_settings`
  columns**, portable via the backup manifest, not AsyncStorage.
- **Constraints / trip-wires:**
  - **Satellites depend on the Phase 3 relationships model existing.** D-08-104/142 describe an
    "existing structured relationship model" that **does not exist** (R-01). Phase 3 precedes Phase 8
    in D-RM-062 — keep that order; do not plan satellites against an assumed table.
  - Do not persist camera state; D-08-064 decided it is ephemeral.

### R-17 — reduced-motion support does not exist

- **Code facts (verified 2026-09-01):** zero `isReduceMotionEnabled` / `useReducedMotion` usage in
  `src/`, yet D-08-122 assumes it.
- **Resolved / recommended path:** consume the hook Phase 2 delivers (R-17). It must be readable
  from the Skia render loop — **never drive animation from React state**, and pause on
  `useIsFocused === false` and `AppState` background.

## Migration / sequencing

- Implies **one migration** adding orrery preference columns to `app_settings`: density preset,
  satellites toggle, last-active System. May be merged with Phase 9's Systems migration if the two
  phases are planned together — decide the split once.
- **Number it head+1 at plan time**, verified against `src/db/migrations/` on disk. Head at audit
  time was 14.
- **Must land after:** Phase 3's relationships model (R-01) for satellites; Phase 2's reduced-motion
  hook.
- **Must land before:** Phase 16's format-4 backup bump.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15:** Category CRUD, including the deletion fallout to generated Orrery Systems and
  custom-System rules (D-08-131/146; the warning D-09-041 requires).
- **Phase 18:** wheel density and neighbor count, large-System performance (culling/LOD, HUD
  responsiveness), gesture QA and device-GPU behavior (D-08-149). **Performance claims cannot be
  made on the desktop emulator** — the orrery is a Skia render-loop feature; measure on the phone.
