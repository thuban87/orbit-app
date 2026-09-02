# Phase 02 — Theme & Visual System — Planning Notes

- **Phase:** 02 Theme & Visual System
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-02-theme-visual-system-dossier.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**E-09 — app-wide preset backgrounds behind text-heavy screens supersede `HANDOFF.md` §7's
`[DECIDED]` starfield placement rule.**

- Dossier: D-02-018…024 app-wide preset backgrounds fixed behind scrolling content, opacity by
  density (`phase-02…md:102-122`); Phase 10's D-10-017 is the Profile half.
- `HANDOFF.md:172-174`: "Starfield background, but **dashboard/orbit screens only, not behind
  text-heavy screens** where contrast suffers."
- **Ratified (owner, 2026-09-01):** the dossier's placement stands; the `HANDOFF.md` §7 supersession
  note was added 2026-09-01. Plan against the dossier, not §7's original text.
- Note: HANDOFF's "tap-to-freeze" and live creeping motion were already superseded by ADR-048; no
  new finding there.

## REPLAN items for plan-phase

### R-17 — Status glyphs, semantic icon registry, and reduced-motion support have no existing foundation — Phase 2 must build them before 6/7/8/9/11 consume them

- **Unbuilt / needed:** distinct status silhouettes, a semantic icon registry, and a reduced-motion
  hook (D-02-049/050/053, D-02-033).
- **Code facts (verified 2026-09-01):**
  - Status is expressed as **colour + border weight only**, no glyphs
    (`src/components/contact-card-ring.ts:44-61`).
  - There is **no icon registry** anywhere in `src/`.
  - **Zero** usages of `isReduceMotionEnabled` / `useReducedMotion` — reduced-motion infrastructure
    does not exist at all, yet Phases 2, 8, 9 and 11 all assume it
    (D-02-033, D-08-122, D-09-117, D-11-144).
- **Resolved / recommended path:** Phase 2 delivers the registry, the glyph set, and the
  reduced-motion hook as **first-class deliverables**, sequenced **before** the renderer phases
  (6, 7, 8, 9, 11). Consumers are D-06-043 and D-07-027/028.
- **Constraints / trip-wires:**
  - All colours resolve through theme tokens, including inside Skia draw calls (`CLAUDE.md`).
    Glyphs and the registry must not hardcode colour.
  - Animation never driven from React state; the reduced-motion hook must be readable from the Skia
    render loop without per-frame `setState`.

### R-16 — Theme preferences are new durable settings with no storage decision

- **Unbuilt / needed:** theme package + per-package accent/background memory (D-02-014/015).
- **Code facts (verified 2026-09-01):** AsyncStorage key `orbit-theme` holds only `mode` and
  `presetId`; there is exactly one preset, `space-dark`, and **no light palette**
  (`src/theme/theme-presets.ts:18`, `src/theme/theme-types.ts:161`). AsyncStorage prefs are **not**
  in the backup.
- **Resolved path (owner, 2026-09-01):** **all new durable preferences, including theme, live in
  `app_settings` columns**, portable via the backup manifest — not AsyncStorage.
- **Constraints / trip-wires:**
  - New keys must be added to `PORTABLE_SETTINGS_KEYS` (`src/backup/backup-schema.ts:106-113`) so
    the format-4 bump (Phase 16, R-09) carries them.
  - Migrating the existing `orbit-theme` AsyncStorage value into the new columns is this phase's
    job; decide read-once-then-clear vs. one-time import in the plan.

## Migration / sequencing

- Implies **one migration** adding `app_settings` columns for theme package, mode, accent,
  background, and per-package memory.
- **Number it head+1 at plan time** — verify against `src/db/migrations/` and `TARGET_VERSION` in
  `src/db/database.ts`. Head at audit time was 14; it will have moved.
- **Must land before:** nothing schema-wise, but the **non-schema** deliverables (icon registry,
  glyph set, reduced-motion hook) must land before Phases 6, 7, 8, 9, 11 build renderers.
- **Must land before the backup bump:** the new settings keys must exist before Phase 16's format-4
  plan serializes them.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15 (Settings & Personalization):** the Appearance surface — Theme package
  (Galaxy/Standard), Mode (Light/Dark/Follow System), Accent (curated), Background (bundled presets
  + None/Solid), live preview, per-package memory (D-02-010/014/015/016/080, D-RM-064). Phase 2
  builds the engine and the persisted state; Phase 15 builds the settings UI.
- **Phase 17 (Onboarding):** first-launch appearance default **Galaxy + Follow System**; may offer
  an early appearance choice (D-02-004/081).
- **Phase 18:** large-text reflow and theme QA (D-02-031/065/082); reduced-motion QA across
  Orrery/History/Theme once this phase's hook exists.
