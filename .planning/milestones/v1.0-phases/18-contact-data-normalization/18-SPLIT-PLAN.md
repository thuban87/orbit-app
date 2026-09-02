---
doc: phase-18-split-plan
status: confirmed — ordering (normalization-first) and migration (Option A / split) agreed with owner 2026-08-27; re-cut pending
created: 2026-08-27
supersedes_intent: reshapes the single Phase 18 into Phase 18.1 + Phase 18.2; defers Streamlined Export
---

# Phase 18 Split Plan — 18.1 Contact Method Normalization + 18.2 Bound/Unbound Lifecycle

## Why this split exists

Phase 18's dossier bundles two separable bodies of work under one name:

1. **Contact method normalization** — data-layer: normalized phone/email methods, canonical
   matching, primaries/ordering/extensions, provenance foundations, retire scalar columns,
   lossless backup of the normalized model. Touches data/CRUD/profile/backup surfaces.
2. **Bound/Unbound lifecycle** — a cross-cutting lifecycle gate that decides whether a contact
   appears in every *proactive* surface: dashboard, Orrery, Never Contacted, notifications,
   widgets, favourites, proactive AI. Touches nearly every proactive surface *by nature*, not by
   scope creep.

The phase felt monolithic because (2) is inherently cross-cutting and because several plans
straddled both concerns (which is also why the plan-size checker kept flagging them). Splitting at
the method/lifecycle seam resolves both problems at once.

## Two decisions (agreed with owner 2026-08-27)

- **Ordering: normalization first (18.1), then lifecycle (18.2).** The data-bearing v9 migration is
  the shared, irreversible foundation and must land against the known-good all-Bound/positive-cadence
  baseline. 18.2's proactive surfaces and Compose consume normalized primary methods, so 18.2 depends
  on 18.1, not the reverse.
- **Migration Option A: split migrations.** 18.1 ships **v9** — the data-bearing contacts rebuild
  that retires scalar phone/email into method rows; `interval_days` stays NOT NULL as today, all
  contacts Bound. 18.2 ships **v10** — a pure shape change making `interval_days` nullable and adding
  `tracking_enabled` + CHECK constraints + the one-way cadence trigger + the two Unbound settings
  columns. v10 moves no data (row-count-in = row-count-out, values identical) and ships alongside the
  lifecycle code that gives its constraints meaning, rather than locking constraint semantics a phase
  early. The one dangerous data-transform rebuild still happens exactly once (v9).
  - **Honest caveat — the seam is not clean here.** Two incorporated findings straddle it and must be
    divided, not lifted: **C3-H2** (migration preservation proof) splits — method/child preservation
    proof stays in 18.1 v9; the app_settings lifecycle-column preservation proof moves to 18.2 v10.
    **C3-M4** (backup rejects illegal lifecycle/cadence combos) moves to 18.2, since 18.1's backup
    cannot validate lifecycle combinations that cannot yet occur. **H3** (cadence CHECK/trigger DDL
    owner) moves from 18.1 to 18.2's v10.

## Process — bounded per-phase review, NOT open-ended convergence

Correcting the record: the cycle-3 fixes ARE in the plans (`fa20e62`; see `18-REVIEWS.md` cycle-3
disposition table, all 8 marked Incorporated) but were **never re-reviewed** — cycle 3 was the
owner's 3-cap and the run stopped there. So the plans carry unvalidated incorporations, and the
re-cut produces brand-new artifacts no reviewer has seen. A real review is warranted; a
migration-only review is not.

Two anti-spiral rules make this terminate where the prior run didn't:
- **Plan-sizing is OUT of the review loop.** Cycles 2–3 spiralled on "this plan is too big, split it"
  (a checker sizing complaint, not a correctness finding). Executor sizing is handled deliberately by
  this split. A reviewer noting a plan is large is not a blocker; only correctness / safety /
  missing-ownership findings are.
- **Stable scope.** Streamlined Export is deferred out; the method/lifecycle seam is fixed. Reviewers
  no longer have unbounded surface to pull in.

Per-phase sequence (18.1 fully, then 18.2 fully — each pass is smaller than the old 14-plan
monolith, and 18.2's review benefits from real on-device migration feedback):

1. Re-cut that phase's plans into the bucket per the map below (carry findings forward; divide the
   straddling findings above).
2. Throwaway `gsd-plan-checker` coherence pass — catches dangling deps only; **low trust, not a
   gate.** Expect it to miss things.
3. External review over the **full phase plan set** (Claude read-only gate first, then flagless
   Codex — the established lanes in `running-claude-headless-reviews.md`). Incorporate blockers.
   **Hard cap: 2 cycles.** A cycle producing only non-blocking findings ships with them logged.
4. Execute the phase → verify on the Pixel (18.1: real migration on real data; 18.2: lifecycle UAT).
5. Only then move to the next phase.

## Plan-to-bucket map

### Phase 18.1 — Contact Method Normalization (~6 plans)

| New | Source | Content |
|---|---|---|
| 18.1-01 | 18-01 (method parts) | v9 migration (methods only: data-bearing contacts rebuild, retire scalar phone/email into method/link/provenance rows, `interval_days` stays NOT NULL, all contacts Bound) + pure phone/email normalizer. Autonomous:false, human checkpoints. THE careful-execution plan. **Remove** from here: nullable cadence, `tracking_enabled`, cadence CHECK/trigger (H3), Unbound settings columns — all move to 18.2's v10. Keeps C3-H2's method/child preservation proof; the app_settings-lifecycle-column half of C3-H2 moves to 18.2. |
| 18.1-02 | 18-02 Task 1 (+ method half of Task 3) | Contact-method write/read DAO: persist/read ordered method drafts; `createContactFull`/`updateContactFull` accept method arrays with `tracking_enabled` defaulting to Bound. |
| 18.1-03 | 18-04 Tasks 1–3 (method-editor parts) | `ContactMethodsEditor` UI: method drafts, labels, primaries, invalid-state feedback. Sever dep on 18-05. |
| 18.1-04 | 18-07 (method parts) | Normalized backup/export/restore graph for **methods** incl. tombstones + v1→v2 wire migration for normalized method rows. **Sever the spurious dep on 18-05.** Does NOT carry lifecycle fields (`tracking_enabled`/nullable cadence don't exist until v10) — the lifecycle backup extension + C3-M4 validation move to 18.2 (see 18.2-09). |
| 18.1-05 | 18-06 Task 1 | Profile primary-actionable-method display + Compose handoff from primary method. |
| 18.1-06 | 18-08 Task 1 (+ new 18.1 UAT) | 18.1 verification + **owner-led Android migration UAT** on the Pixel with a real v8 backup. The critical on-device proof of the irreversible migration. |

### Phase 18.2 — Bound/Unbound Lifecycle (~10 plans, depends on 18.1)

Yes, 18.2 is the bigger half — the lifecycle rollout is inherently cross-cutting. Each plan is
single-concern and small (several are 18–26k); this is the reversible, already-reviewed half.

| New | Source | Content |
|---|---|---|
| 18.2-01 | NEW (split from 18-01) | **v10 migration** — pure shape change: make `interval_days` nullable, add `tracking_enabled` + the two CHECK constraints + one-way cadence trigger (H3) + `phone_region_override`/`include_unbound_never_contacted`/`birthday_unbound_enabled` settings columns. Moves no data; row-count-in = row-count-out with identical values. Owns the app_settings-lifecycle-column half of C3-H2's preservation proof. 18.2's Wave-1 foundation; all other 18.2 plans depend on it. |
| 18.2-02 | 18-02 Task 2 (+ lifecycle half of Task 3) | Lifecycle write DAO: Bind/Unbind transitions; lifecycle composition into create/edit saves. |
| 18.2-03 | 18-03 (whole) | Bound-aware query owners: dashboard, status, digest, favourites, unbound-read. |
| 18.2-04 | 18-11 (whole) | Nullable-cadence impact (gravity without intensity) + explicit Unbound AI context. |
| 18.2-05 | 18-12 (whole) | Orrery Bound-only reads + shared saved-sun policy + ring-seq DAO (owns C3-H1). |
| 18.2-06 | 18-09 (whole) | Notification/widget lifecycle policy + post-Unbind side effects + stale quick-action fail-closed. |
| 18.2-07 | 18-05 (whole) | Dedicated Unbound screen, nav, lifecycle settings, Never Contacted eligibility, neutral search rows. |
| 18.2-08 | 18-04 lifecycle-choice + 18-06 Tasks 2–3 | Bound/Unbound choice in create/edit forms + Bind/Unbind execution on profile with reload-safe failure handling. |
| 18.2-09 | 18-07 (lifecycle parts) + C3-M4 | Extend backup/restore wire format to carry `tracking_enabled` + nullable cadence; validate illegal lifecycle/cadence combos → `BackupSchemaError` before apply (C3-M4). May fold into 18.2-02 if small during re-cut. |
| 18.2-10 | 18-08 Task 2 (+ 18.2 verification) | 18.2 verification + owner-led Android lifecycle UAT. |

### Deferred out of Phase 18 entirely

| Source | Disposition |
|---|---|
| 18-10 Streamlined Export | Defer to a future export/polish slot. **Carry its findings with it:** the Streamlined Export PII-egress owner checkpoint (Task 1) and the distinct-artifact/UI/UAT requirement. It is `[DECIDED]` in dossier Cluster R, so this deferral is an owner decision, not a silent drop. |

## Dependency corrections the re-cut must make

The current dep web entangles method and lifecycle work. After the split, **no 18.1 plan may depend
on any 18.2 plan.** Specific severances:

- 18-07 → 18-05 dependency: **remove.** Backup serializes schema columns present from the v9
  migration; it does not need the Unbound UI or settings screen.
- 18-04 → 18-05 dependency: applies only to the lifecycle-choice half (now 18.2-07); the
  method-editor half (18.1-03) depends only on the method DAO (18.1-02).
- 18-06 → 18-09/18-11 dependencies: apply only to the lifecycle halves (now in 18.2-07); the
  method-display/Compose half (18.1-05) depends only on the method DAO + normalizer.

## Downstream roadmap edits required (execution step)

- Replace the single Phase 18 ROADMAP entry with Phase 18.1 and Phase 18.2 entries (goal, success
  criteria split, plan lists, waves). Keep 19/20/21 numbering intact per owner's decimal-ID choice.
- Repoint Phases 19/20/21 `Depends on: Phase 18` → `Phase 18.2` (import needs the full normalized +
  lifecycle model).
- Split requirements CDN-01..04 across 18.1/18.2 by which phase satisfies each success criterion.
- Verify GSD phase-ID tooling accepts decimal IDs (`18.1-…`, `18.2-…`); if not, raise with owner
  before renumbering (do NOT silently renumber 19→ to make room). See STATE.md tooling hazards.
- Create `18.1-…` and `18.2-…` phase directories; move/renumber PLAN files and their SUMMARY/VALIDATION
  companions; carry `18-REVIEWS.md` findings into each phase's review record.

## What is explicitly NOT changing

- No dossier decision is reversed except deferring Streamlined Export (owner-approved here).
- All incorporated data-safety review findings are preserved and travel with their plans.
- Success criteria 1–4 remain; they are partitioned across 18.1/18.2, not weakened.
