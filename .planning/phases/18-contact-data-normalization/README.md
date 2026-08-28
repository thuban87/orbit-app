# ⚠️ This directory is NOT a live phase

The original **Phase 18: Contact Data Normalization** was **split on 2026-08-27** into two live phases:

- **`../18.1-contact-method-normalization/`** — contact method normalization (v9 migration). Review-converged (4 cross-AI cycles) and execution-ready.
- **`../18.2-bound-unbound-lifecycle/`** — Bound/Unbound lifecycle (v10 migration). Re-cut but not yet reviewed.

Streamlined Export (original plan 18-10) was deferred out entirely. See `18-SPLIT-PLAN.md` for the full
plan-to-bucket map, migration split, and finding re-assignments. The ROADMAP lists 18.1 and 18.2, not this.

## What this directory now holds

**Shared reference artifacts — STILL LIVE, do not move or delete.** The live 18.1 and 18.2 plans
reference these by `@`-path during execution:

- `18-CONTEXT.md`, `18-RESEARCH.md`, `18-PATTERNS.md`, `18-UI-SPEC.md`, `18-VALIDATION.md`

**Historical record (safe to read, not live):**

- `18-REVIEWS.md` — the original phase's cross-AI review cycles (findings re-assigned into 18.1/18.2).
- `18-SPLIT-PLAN.md` — the split rationale and plan-to-bucket map.
- `superseded-original-plans/` — the original 12 `18-NN-PLAN.md` files. **Superseded — do NOT execute.**
  Their content was re-cut into the 18.1/18.2 plans; they are kept only for provenance.

## If you are executing

Execute from `../18.1-contact-method-normalization/` (18.1 only — 18.2 is not reviewed yet). Do not run
any plan in `superseded-original-plans/`.
