# Orbit — KB Extraction Conventions

Read by the global `extract-phase-kb` skill (`~/.claude/skills/extract-phase-kb/`, mirrored for codex
in `~/.codex/skills/extract-phase-kb/`) at the start of every run. It overrides the skill's generic
defaults. Where it is silent, the skill applies. `CLAUDE.md` wins over both.

It replaces orbit's repo-local `extract-phase-kb` skill (archived at
`.claude/skills-archive/extract-phase-kb/`). Every orbit-specific rule from that skill is carried
over below. The setup history is in `.planning/knowledgebase/KB-SETUP-PLAN.md`.

## 1. Paths

- **Phase folders:** `.planning/phases/{N}-{slug}/`. Top-level numbers are zero-padded to two digits
  (`02`, `18.1`); accept `2` and resolve it to `02-…`. Orbit uses sub-phase IDs (`18.1`, `18.2`,
  `19.1`, `38.10`); match the exact ID prefix, not just the integer. At milestone close,
  `gsd-cleanup` may move phase folders to `.planning/milestones/v{X}-phases/`.
- **KB locations:** `docs/decisions/`, `docs/systems/`, `docs/runbooks/`.
- **Templates:** `.planning/knowledgebase/templates/`: `adr-template.md` (with orbit's
  `Reversibility:` and `Migration:` fields), `system-doc-template.md`, `runbook-template.md`,
  `phase-kb-manifest-template.md`.
- **Manifest:** `{N}-KB-MANIFEST.md` in the phase folder. Include the mapped dossier in "Source docs
  consumed".

## 2. Subsystem routing index

`docs/systems/README.md` is the routing authority. It maps each of orbit's 18 subsystems to its
owning `src/` code: DAOs in `src/db/` and services in `src/services/`, not stores. Route a phase's
changes by the owning code that shares a table. Orbit's `CLAUDE.md` has **no per-doc KB index**, so
routine index changes go to the README only.

- Planned README changes (always in the step-5 plan):
  - **anchor-phase column updates** when a doc is created at a phase other than its listed anchor;
  - **new rows** only for a genuinely new subsystem;
  - **narrowed or retired rows** for renamed or split docs.
- Touch `CLAUDE.md` only for a genuinely new top-level concept or convention (rare).
- **Phase 21 "reach out":** the README carries an open routing question. Decide its home when phase
  21 is extracted, from the code on disk.

## 3. Decision sources

Orbit's canonical decision record is the **dossier**, not CONTEXT. Resolve each phase through
`.planning/knowledgebase/phase-dossier-map.md`, which gives the decision-source file(s) and tier:

- `dossier`: the mapped dossier is the primary source for `[DECIDED]` items and Alternatives
  Considered.
- `context-dxx`: the phase CONTEXT has genuine `D-NN` IDs plus a sibling DISCUSSION-LOG. These are a
  first-class source, overlaid on the dossier where one exists.
- `context-prose`: a substantial CONTEXT with no `D-NN` IDs and no DISCUSSION-LOG; its prose is
  authoritative where there is no dossier.

**Milestone-1 dossiers** (`docs/dossier/*.md`) are **domain-numbered, not phase-numbered**. For
example, dossier `07-photos` is phase 05, `04-log` is 06, `03-fuel` is 07 and `09-orrery` is 13.
- Phases 18, 18.1 and 18.2 share one dossier; 19.1 shares phase 19's.
- **Never map any phase to the cut `05-import` dossier.**
- **No CONTEXT.md at all:** phases 05, 06, 07 (dossier only).
- **No dossier:** phases 01 and 09 (CONTEXT prose is authoritative) and phase 16 (`context-dxx`:
  `16-CONTEXT.md` D-IDs + DISCUSSION-LOG, migration 006 / ADR-001).
- **Real `D-NN` + DISCUSSION-LOG in milestone 1:** only phases 16, 17 and 19.1.

**Milestone-2 dossiers** are `docs/dossier/milestone-2/phase-NN-<slug>-dossier.md`, phase-numbered
and topic-matched. Map rows are backfilled during extraction; a phase with no map row must be
verified against its CONTEXT before extraction.

**From phase 38.8 on, the CONTEXT is the dossier** (`phase-dossier` skill;
`.planning/DOSSIER-CONVENTIONS.md`). Its map row names `{N}-CONTEXT.md`, and `{N}-LEDGER.md`
supplies alternatives, rationale, revisions and supersessions. Dossier-grade CONTEXTs carry orbit
status tokens (`[DECIDED · date]`, `[DERIVED]`, `[CARRIED · source]`, `[REJECTED · date]`) and
`<supersessions>` / `<verification>` blocks. `[CARRIED]` items are carried, not new decisions.

**Not decision IDs:** the requirement IDs `FND-`, `DATA-`, `FLD-`, `CRUD-`, `CMP-`.

**Owner resolutions in review files are ADR-grade.** For example, phase 16's `D-06a` / `D-06b`
"owner resolution, cycle-N review" entries settle decisions and must be captured.

**Map backfill:** when a phase has no map row yet (milestone 2), add one as part of the run. List it
under *Special cases* in the step-5 plan and commit it on its own.

**Pre-repo decision record:** `HANDOFF.md` (repo root). Its `[DECIDED]` items are carried context.
Cite it where a phase's ADR rests on it.

## 4. ADR fields and migrations

- **Extra fields:**
  - `Reversibility:` is the strictest of the sourced decisions' ratings (one-way > costly >
    reversible).
  - `Migration:` is the migration number(s) the phase ships, or "None".
- **Migrations** are TypeScript under `src/db/migrations/`, run via `PRAGMA user_version`. There are
  no `.sql` files.
- **Numbers:** 3-digit, global. **Supersession string** on the new ADR: full, `ADR-NNN (<title>)`;
  partial, `ADR-NNN (partial — what dies; what survives)` (the form ADR-177 uses). On the old ADR,
  `ADR-NNN` for a full supersession or `ADR-NNN (partial)` when part of it stands.
- **Key files:** full repo-relative paths in orbit's flat `src/` tree (`src/db/field-values-dao.ts`).
  No monorepo prefix.
- **ADRs written in-phase by owner ruling** (e.g. ADR-177, written by 38.5 plan 08): check
  `docs/decisions/` for ADRs whose `Phase:` is this phase before numbering, and do not duplicate them.

## 5. Derived artifacts

```bash
npm run check:adr-key-files    # gate
npm run gen:adr-index          # docs/decisions/INDEX.md (may not exist before the first real extraction)
npm run graph:build            # scripts/graph-build.sh: ADR registry + graph
```

- `npm run audit:adr-key-files` gives a fuller report. `npm run fix-adr-key-files` exists, but review
  its edits.
- **codex: run extractions in yolo/full-access.** The default workspace-write sandbox makes
  `graph:build` no-op silently (KB-SETUP-PLAN "CODEX GRAPH GAP"). The skill's edge-count check
  catches it.

## 6. Run mode and order

- **Milestone-close / backfill batch, in strict ascending phase order:** 01, 02 … 18, 18.1, 18.2, 19,
  19.1, 20, 21, then the milestone-2 phases. It is not run per phase during development. Each phase
  reads the committed outputs of the phases before it. Never forward-peek.
- Ship-date rule: the skill default.

## 7. Commits

- Message forms: `docs(kb): ADR-004 photo relative-path storage (phase 05)`, one commit per ADR or doc.
  Finish with a manifest + regenerated-artifacts commit.
- Commit in place on the current branch. Never push, branch or worktree. **No AI attribution.**
- Stage explicit paths only. Never `git add -A`.

## 8. Special cases

**Legacy-ADR reclaim.** Orbit shipped three agent-authored ADRs before the KB machinery existed.
Their numbers are cited in `CLAUDE.md`, `HANDOFF.md` and phase artifacts, so they must not dangle:

| ADR | Topic | Reclaimed at phase |
|-----|-------|--------------------|
| ADR-001 | custom-field value normalization | 16 |
| ADR-002 | hybrid two-picker contact import | 19.1 |
| ADR-003 | read-contacts on API 37 for reconcile | 20 |

At a reclaim phase, and only there:
1. Read the existing `docs/decisions/ADR-00N-*.md` as reference material only.
2. Copy it verbatim to `docs/decisions/_archive/` (create the folder if needed).
3. Regenerate the ADR **in place at the same number** from the phase corpus and dossier, using the
   current template (Reversibility, Migration and a proper `Key files:` block).
4. This is the only case where an existing ADR body is rewritten. Record it in the manifest's
   legacy-reclaim note and commit it on its own.

ADR-003 partially supersedes ADR-002. Handle each ADR only when you reach its own reclaim phase.

- There is no `.planning/design/images/` migration-candidate folder in orbit; do not look for one.
- **Good runbook candidates:** adding a TS SQLite migration (`PRAGMA user_version`), adding a theme
  profile or token, adding a custom-field type and parser, adding an orrery visual layer.

## 9. Repo-specific anti-patterns and platform notes

- **Orbit is local-first, on-device SQLite.** No backend, no RPC, no Supabase. Logic that would live
  in a DB function lives in TypeScript. Never introduce a network dependency into a read path when
  describing a system.
- ❌ Assuming dossier number = phase number in milestone 1.
- ❌ Treating requirement IDs as decision IDs.
- The split skill is `split-system-doc` (pending reconciliation with quest-board-app's
  `qb-split-system-doc`).
