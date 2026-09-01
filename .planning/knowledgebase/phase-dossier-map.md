# Phase → Dossier Decision-Source Map

**Purpose:** a one-time lookup table for the KB-extraction skill. For each orbit-app phase it
records the authoritative decision source(s) and the *tier* of that source, so the extractor
knows where a phase's `[DECIDED]` items actually live.

**Why the numbers don't line up.** The dossier (`docs/dossier/*.md`) is the canonical
decision record for milestone-1, but it is numbered by **interrogation DOMAIN**, not by phase.
The domain order was "data-model first" (see `docs/dossier/INDEX.md`), so a dossier number is
almost never the phase number. Concretely:

- Dossier `05-import` was **CUT** by the owner (2026-08-12) — no phase implements it, and the
  numbering skips it, which is why dossiers jump `04 → 06`.
- Topic slugs diverge from phase slugs: e.g. dossier `07-photos` → phase 05, dossier
  `04-log` → phase 06, dossier `03-fuel` → phase 07, dossier `09-orrery` → phase 13.
- Phase **18** was later **split** into 18.1 (data-layer) + 18.2 (lifecycle) from a single
  dossier; phase **19** spawned a remediation sub-phase **19.1**.
- Dossiers **18–21** were interrogated later (2026-08-25/26) and ARE phase-numbered and
  topic-matched cleanly.
- Some milestone-1 phases have **no dossier at all**: phase 01 (scaffold, HANDOFF §4-driven),
  phase 09 (the cross-phase "compose screen" — an explicitly *unowned* surface in the dossier
  index), and phases 16/17 in part (late normalization/portability work discussed in-corpus).

**Decision-source tiers** (a phase may carry more than one; the resolver **prefers dossier,
overlays context**):

- `dossier` — a `docs/dossier/*.md` file is the authoritative source.
- `context-dxx` — the phase's `CONTEXT.md` uses genuine `D-NN` decision IDs **and** a
  sibling `*-DISCUSSION-LOG.md` exists. Confirmed only in phases **16, 17, 19.1**.
- `context-prose` — a substantial `CONTEXT.md` with no `D-NN` decision IDs and no
  DISCUSSION-LOG (requirement IDs like `FND-01`/`FLD-02`/`CRUD-01` are NOT decision IDs).

Phases 05, 06, 07 have **no CONTEXT.md at all** — they rely purely on their dossier.

---

## Milestone-1 phases (01–21)

| Phase ID | Phase dir | Dossier file(s) | Tier | Notes |
|----------|-----------|-----------------|------|-------|
| 01 | `01-project-scaffold-portable-code` | — (none) | context-prose | Scaffold + portable-code extraction; governed by HANDOFF §4 port list, not a dossier domain. CONTEXT uses `FND-01…06` requirement IDs (not `D-NN`). |
| 02 | `02-data-foundation-status-engine` | `01-data.md` | dossier + context-prose | Core contact schema & status engine. CONTEXT is prose with `DATA-NN` requirement IDs. |
| 03 | `03-custom-fields` | `02-fields.md` | dossier + context-prose | Custom fields; also HANDOFF §14 + ADR-001. CONTEXT uses `FLD-01…07` requirement IDs (not `D-NN`). |
| 04 | `04-contact-crud-lifecycle` | `06-crud.md` | dossier + context-prose | CRUD/forms/lifecycle. CONTEXT uses `CRUD-NN` requirement IDs. |
| 05 | `05-photos` | `07-photos.md` | dossier | No CONTEXT.md — dossier is the sole source. Number mismatch (dossier 07 → phase 05). |
| 06 | `06-interaction-log-status-impact` | `04-log.md` | dossier | No CONTEXT.md — dossier only. Dossier 04 → phase 06. |
| 07 | `07-conversational-fuel` | `03-fuel.md` | dossier | No CONTEXT.md — dossier only. Dossier 03 → phase 07. |
| 08 | `08-dashboard-never-contacted-screen` | `08-dashboard.md` | dossier + context-prose | Numbers coincide here. Dossier 08 also owns the adopted never-contacted screen. |
| 09 | `09-compose-screen-sms-handoff` | — (none dedicated) | context-prose | The cross-phase "compose screen" — explicitly **unowned** in the dossier index. Decisions synthesized in CONTEXT prose from `03-fuel` + `11-notify` constraints (`CMP-NN` requirement IDs). Built once, reused by phases 11/12/14. |
| 10 | `10-share-sheet-capture` | `10-capture.md` | dossier + context-prose | Numbers coincide. |
| 11 | `11-actionable-notifications` | `11-notify.md` | dossier + context-prose | Numbers coincide. |
| 12 | `12-home-screen-widget` | `12-widget.md` | dossier + context-prose | Numbers coincide. |
| 13 | `13-orrery` | `09-orrery.md` | dossier + context-prose | Number mismatch (dossier 09 → phase 13). |
| 14 | `14-ai-message-suggestions` | `13-ai.md` | dossier + context-prose | Dossier 13 → phase 14. |
| 15 | `15-weekly-digest` | `14-digest.md` | dossier + context-prose | Dossier 14 → phase 15. |
| 16 | `16-custom-field-value-normalization` | — (none) | context-dxx | Late normalization phase (migration 006 / ADR-001) descending from `02-fields`, but authoritative source is `16-CONTEXT.md` with `D-01…` IDs + `16-DISCUSSION-LOG.md`. No dedicated dossier. |
| 17 | `17-backup-export-restore` | `15-backup.md` | dossier + context-dxx | Both: dossier 15 is canonical, overlaid by `17-CONTEXT.md` (`D-01…` IDs) + `17-DISCUSSION-LOG.md`. |
| 18 | `18-contact-data-normalization` | `18-contact-data-normalization.md` | dossier + context-prose | **Split phase** — original 18, preserved dir; the heavy shared context artifacts live here. Superseded for execution by 18.1/18.2. Dossier is phase-numbered/clean. |
| 18.1 | `18.1-contact-method-normalization` | `18-contact-data-normalization.md` | dossier + context-prose | Data-layer half of the 18→18.1/18.2 split (v9 migration). CONTEXT points back to the shared 18 artifacts. |
| 18.2 | `18.2-bound-unbound-lifecycle` | `18-contact-data-normalization.md` | dossier + context-prose | Lifecycle half of the split (Bound/Unbound across surfaces). Same shared dossier as 18/18.1. |
| 19 | `19-system-contact-import` | `19-system-contact-import.md` | dossier + context-prose | Phase-numbered/clean dossier. CONTEXT is short prose. |
| 19.1 | `19.1-older-android-contact-picker-hybrid-two-picker-adr-002` | `19-system-contact-import.md` | dossier + context-dxx | Remediation sub-phase of 19, governed by **ADR-002**. `19.1-CONTEXT.md` uses `D-01…D-14` IDs + `19.1-DISCUSSION-LOG.md`. Folds in four carried-forward Phase-19 items (D-11..D-14). |
| 20 | `20-contact-reconciliation-merge` | `20-contact-reconciliation-merge.md` | dossier + context-prose | Phase-numbered/clean dossier. Short prose CONTEXT. |
| 21 | `21-interaction-assist-reach-out` | `21-interaction-assist-reach-out.md` | dossier + context-prose | Phase-numbered/clean dossier (revised 2026-08-31, has a Revision Log). Short prose CONTEXT. |

---

## Milestone-2 phases

Milestone-2 dossiers live in `docs/dossier/milestone-2/` and — unlike milestone-1 — **are
phase-numbered and topic-matched cleanly** (`phase-NN-<slug>-dossier.md`). No milestone-2
*phase directories* exist under `.planning/phases/` yet, so tier/CONTEXT assessment is N/A
until those phases are opened. Dossiers present so far:

- `phase-01-app-shell-navigation-dossier.md`
- `phase-02-theme-visual-system-dossier.md`
- `phase-03-contact-knowledge-foundation-dossier.md`
- `phase-04-dashboard-data-state-foundation-dossier.md`
- `phase-05-dashboard-control-surface-dossier.md`
- `phase-06-dashboard-list-view-dossier.md`
- `phase-07-dashboard-card-view-dossier.md`
- `phase-08-orrery-camera-scale-exploration-dossier.md`
- `phase-09-orrery-systems-dossier.md`

Also in that dir (not phase dossiers): `orbit-ui-ux-master-handoff-v0.5.docx`,
`orbit-ui-ux-working-roadmap-v0.5.md`.

---

## Unresolved / caveats for the resolver

- **None left UNRESOLVED.** Every milestone-1 phase has an identified authoritative source,
  confirmed by reading dossier openings and phase CONTEXT files.
- Phases **01** and **09** deliberately have **no dossier** (scaffold = HANDOFF §4; compose =
  the explicitly-unowned cross-phase surface). Treat CONTEXT prose as authoritative there.
- Phase **16** has **no dossier**; its authority is `context-dxx` + ADR-001 (migration 006).
- The `05-import` dossier is CUT — do not attempt to map any phase to it.
