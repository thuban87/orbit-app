# Milestone-2 Audit → GSD Planning — Handoff & Intent

**Audience:** the agent (Fable or otherwise) driving the audit and then the GSD milestone
setup. **Purpose:** record, durably, what the cross-dossier audit findings are *for* and how
they must flow into GSD planning — because GSD's planner does not read the audit report on its
own, and the human facilitating this may not have the originating Claude session open.

Written by Claude (Opus 4.8) during audit prep. Not a decision record; the dossiers and ADRs
remain authoritative. This is process intent.

---

## The intended sequence

1. **Audit** — run `oa-audit-dossiers milestone-2` (dry run, no `--fix`). It reconciles against
   `audit/prior-runs/` (Lane C), checks existing-table invariants + unbuilt schema (Lane A),
   and produces `audit/AUDIT-REPORT.md` + `audit/LEDGER.md`. (`audit/` is gitignored — local artifacts.)
2. **Resolve findings** — in this order, BEFORE milestone setup, so the roadmapper plans against
   corrected inputs:
   - **AUTO-FIX** — re-run with `--fix`, batch-approve the small dossier text syncs.
   - **ESCALATE** — owner ratifies or declines each ADR reversal. Ratify → author a **superseding
     ADR** (ADRs immutable; new supersedes, both kept) + regenerate `docs/decisions/adr-registry.ts`.
     Decline → amend the dossier back to honor the ADR. Do not let the ChatGPT-authored dossier
     stand as ADR ratification.
   - **REPLAN / STUB-CONTRACT** — no dossier redo. These are implementation/sequencing notes for
     later (see routing below).
3. **`complete-milestone`** — archive the current milestone.
4. **`new-milestone`** → roadmapper → `plan-phase` — this is where the dossiers become the
   milestone's phases and where REPLAN/STUB findings must be in the planning inputs.

## What each finding route means for the work (dossiers are NOT redone)

Dossiers decide **WHAT**; they do not own **HOW/sequencing**. Almost every finding is downstream
implementation planning, not a dossier rewrite.

| Route | Meaning | Dossier edit now? | Landing place |
|---|---|---|---|
| AUTO-FIX | Stale dossier text vs a decision settled elsewhere | Tiny targeted edit | The skill, on approval |
| ESCALATE | Dossier reverses an Accepted ADR | Only after owner decision | Superseding ADR *or* dossier amendment |
| REPLAN | WHAT is fine; needs schema/migration/sequencing no dossier owns | Usually none | That phase's `plan-phase` |
| STUB-CONTRACT | Dependency on a deferred phase (15/17/18) | None | The eventual GSD stub for that phase |

REPLAN example (group events): the dossier decision stays; the *plan* for that phase must create
the migration, route writes through the single recency writer, and bump the backup format. That's
the planner/executor's job, not a dossier change.

## The bridge — how findings reach `plan-phase` (the load-bearing step)

GSD's `plan-phase` / phase-researcher read a phase's own inputs, **not** `audit/AUDIT-REPORT.md`.
So during `new-milestone` setup, for each phase:

- Take that phase's REPLAN + STUB-CONTRACT findings from the audit report's **"Handoff to GSD
  planning"** section (indexed by phase).
- Attach them to the phase's planning inputs — its `CONTEXT.md` shim (which points at the dossier
  as ground truth) and/or a **"Planning notes / audit findings"** appendix. Per project convention
  the dossier is ground truth and `CONTEXT.md` is a shim; the audit findings ride alongside as
  planning notes, they do not overwrite dossier decisions.
- The migration-sequencing meta-note (≥7 new forward-only migrations, none numbered) goes to the
  roadmapper: it must assign a strict schema → consumers → backup order and real migration numbers.
  Do NOT let any phase assume its own migration number — verify head+1 against `src/db/migrations/`.

## For the agent doing the "how to set up the new milestone via GSD" audit

You are expected to investigate the actual GSD skills (`gsd-complete-milestone`, `gsd-new-milestone`,
`gsd-roadmapper`, `gsd-plan-phase`, `gsd-discuss-phase`) to determine exactly which files they read
as phase inputs, then wire the dossiers + these audit findings into those inputs accordingly. This
doc states the *intent*; you determine the *mechanism* from the live GSD skills. If the mechanism
differs from the "CONTEXT.md + planning-notes appendix" assumption above, follow the mechanism and
note the deviation — the goal (every REPLAN/STUB finding is visible to the phase's planner) is what
matters, not the specific file.
