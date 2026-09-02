# Deferred Phases 15 / 17 / 18 — Stub Contracts

- **Phases:** 15 Settings & Personalization · 17 Onboarding · 18 Responsive & Release Hardening
- **Dossier (ground truth):** none — these phases are roadmap-deferred with reserved slots
  (D-RM-014). The dossiers of Phases 1–14 and 16 are the source of every requirement below.
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3 (STUB-CONTRACT section), owner
  resolutions 2026-09-01

> Planning notes, not decisions. These are **dependencies pointed at deferred phases**, collected so
> each eventual GSD stub has a checklist. They are **not orphans** — the slots exist. Nothing here
> originates a requirement; every bullet traces to a dossier decision ID.

---

## Deferred Phase 15 — Settings & Personalization must expose

- **Appearance:** Theme package (Galaxy / Standard), Mode (Light / Dark / Follow System), Accent
  (curated), Background (bundled presets + None / Solid), live preview, per-package memory.
  [D-02-010/014/015/016/080, D-RM-064]
- **Dashboard List right-swipe:** Quick Log vs Log Contact — global, default Quick Log.
  [D-06-062/065/098]
- **Ordinary logging Default Interaction Channel:** Remember Last Choice (factory) / Message / Call /
  In Person; the remembered value updates **only after a successful ordinary save**; **copy must
  state that Group Log is exempt and defaults In Person**.
  [D-13-083…093, D-12-136, D-GE-002, D-RM-053/054, D-MH-011]
- **Compose default message mode:** Text / Email / Remember Last Choice (factory); remembered on
  Copy / Transmit. [D-14-013/014/017/133, D-RM-059]
- **Contacts Administration / Category CRUD**, including deletion fallout to generated Orrery
  Systems and custom-System rules (with the warning D-09-041 requires) and to Profile
  layout/background Category assignments. **No reconciliation wizard.**
  [D-RM-039/040, D-08-131/146, D-09-037…041/045/134…136/143, D-10-175/200]
- **Local owner-profile settings.** [D-RM-006/064]
- **Routes into canonical surfaces, not reimplementations:** Systems Management (D-09-086/143),
  Profile layout/background managers (D-10-172/173), the AI management hierarchy including the
  **AI-Off escape hatch** (D-16-009/010/124…126/159, D-RM-065, D-MH-014).
- **Existing Settings rows to reconcile** (verified on disk 2026-09-01): today's Settings hosts
  "Manage favourites / Custom Fields / Archived contacts" (`src/screens/SettingsScreen.tsx:2005-2048`)
  and "Include unbound in Not yet contacted" (:911-947). Their fate is now partly decided:
  - **Manage favourites — retired** (owner resolution, E-01: the Manage-favourites screen is retired;
    the widget uses the Favorites population in Default order).
  - **Include unbound in Not yet contacted — retired** (owner resolution, E-02: an "All Contacts"
    population = Active ∪ Not Contacted; Active excludes never-contacted; the Never Contacted screen
    and the include-Unbound toggle retire). It is in `PORTABLE_SETTINGS_KEYS` — coordinate removal
    with Phase 16's format-4 bump.
  - **Archived contacts** — its home depends on E-07's outcome (Dashboard child route vs Settings);
    read the Phase 5 dossier and `docs/decisions/`.
  - **Custom Fields** — unaffected by any resolution; still a Settings destination.
- **No longer a Phase 15 candidate:** the Memory **Recently Deleted / Trash** surface (D-03-029) was
  listed as a possible Phase 15 owner. **The owner assigned it to Phase 3** (2026-09-01). Do not
  re-plan it here.

## Deferred Phase 17 — Onboarding must honor

- First-launch appearance default **Galaxy + Follow System**; may offer an early appearance choice.
  [D-02-004/081]
- An early right-swipe logging preference choice, plus Dashboard gesture and star education.
  [D-06-064/072/073/099]
- Teach the final **Message / Call / In Person** vocabulary — **never** legacy Text / Email / Other;
  and do **not** imply the Channel default governs Group Log. [D-13-177]
- May promote **OpenRouter** as the recommended connection and explain the data flow; does **not**
  redefine the architecture; respects AI's optional posture. [D-16-030/162, D-14-135]
- May introduce Profile customization and backgrounds without redefining them. [D-10-202]
- Preserve first-run / default / permission / gesture seams generally. [D-RM-066, D-MH-015]

## Deferred Phase 18 — Responsive & Release Hardening must audit

- Landscape / tablet plus large-text reflow on **every** surface; List and Grid density fallbacks;
  Relationship Overview packing; yearly heatmap rendering; wheel density and neighbor count;
  large-System performance (culling / LOD, HUD responsiveness); gesture QA and device-GPU behavior;
  image-memory behavior for Profile backgrounds.
  [D-01-070/076, D-02-031/065/082, D-06-101, D-07-016/017/103, D-08-149, D-09-111/131/145,
  D-10-186/203, D-11-092/098/156, D-12-131, D-13-178]
- External-app resume / lifecycle heuristics for "Did you send it?"; AI loading presentation.
  [D-14-041/112/136]
- Wire the **sanitized AI diagnostic seam** into Sentry, preserving the no-private-content boundary.
  [D-16-142…148/161/177]
- **Reduced-motion QA** across Orrery / History / Theme, once Phase 2's reduced-motion hook exists
  (R-17 — it does not exist today: zero `isReduceMotionEnabled` / `useReducedMotion` usage in `src/`).

---

## Notes for whoever creates these stubs

- Performance claims: the orrery is a Skia render-loop feature and **cannot be assessed on the
  desktop emulator**. Phase 18 measurements must come from the physical Pixel, and must say which
  thread the evidence covers (`dumpsys gfxinfo` sees the UI/render thread; RN jank usually lives on
  the JS thread).
- Phase 15's settings write to `app_settings` columns, not AsyncStorage (owner resolution, R-16) —
  the owning feature phase creates the column; Phase 15 builds the control over it.
- None of these three phases owns schema of its own by default. If a stub's plan discovers it needs
  a migration, that is a signal the owning feature phase missed something — check before adding one.
