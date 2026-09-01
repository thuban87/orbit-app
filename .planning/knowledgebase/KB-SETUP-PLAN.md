# KB Extraction Machinery — Setup Plan & Tracker

**Status:** Group A in progress · **Started:** 2026-08-31 · **Owner:** Brad

Living tracker for standing up the knowledge-base extraction machinery (ADRs, system
docs, runbooks, graphify) for orbit-app. Adapts the two quest-board skills
(`qb-extract-phase-kb`, `qb-split-system-doc`) plus their supporting substrate.

---

## Goal

A repeatable pipeline that turns completed phase artifacts into a durable knowledge base:
globally-numbered immutable ADRs, present-tense system docs, runbooks, and a graphify
discovery index — all routed by a fixed subsystem map. Two skills do the work; a substrate
of templates + scripts + graph bridge supports them.

## Locked decisions (from planning discussion, 2026-08-29 → 08-31)

- **Two skills**, no `qb-` prefix: `extract-phase-kb` (extract) + `split-system-doc` (split).
  Authored **harness-neutral**, installed for BOTH Claude (`.claude/skills/`) and codex
  (`~/.codex/skills/`).
- **ADR format = quest-board's template** + orbit additions: **`Reversibility:`** field
  (one-way / costly / reversible — mirrors phase-16 D-XX tags) and optional **`Migration:`**
  field. `KEY FILES` comment block rewritten for orbit reality.
- **Dossier is orbit's canonical decision source.** Extract resolver precedence:
  (1) mapped dossier → (2) CONTEXT `D-XX` + DISCUSSION-LOG → (3) prose CONTEXT; always
  overlay PLAN/SUMMARY/REVIEW for implementation, deviations, and owner-resolutions.
  (See memory: *Dossier is ground truth, not CONTEXT.md*.)
- **Phase→dossier map is non-trivial** (M1 dossiers are domain-numbered; dossier-5 cut;
  phase-18 split). A one-time lookup artifact resolves it. M2 dossiers are phase-numbered.
- **18-subsystem boundary map** locked → `docs/systems/README.md` (routing authority).
- **extract-learnings: skipped** per-phase (KB-extract doesn't need it). **graduation:**
  left as a free auto no-op. **KB-extract runs BATCHED per-milestone**, not per-phase, so
  the per-phase routine stays at 5 skills.
- **Full completionist run**, strict phase order 01→21, continuing into M2. **Sequential**
  across harnesses (each phase reads the prior's committed outputs — no parallelism).
- **Existing ADR-001/002 stay in place now.** Their numbers are cited in CLAUDE.md /
  HANDOFF / artifacts. The backfill **reclaims 001/002 in place** at phases 16 & 19.1
  (read old body as reference → overwrite → copy original to `docs/decisions/_archive/`),
  so citations never dangle. Archive is a run-time step, not build-time.

---

## Group A — Substrate  *(build now)*

- [x] **A1 Templates** → `.planning/knowledgebase/templates/` (5 files) — *subagent, done 08-31.
      Flag: some subsystem/store names in template EXAMPLES are illustrative placeholders, not
      verified files (fine for a template). claude-md-kb-section templates path set to
      `.planning/knowledgebase/templates/`.*
- [x] **A2 Subsystem map** → `docs/systems/README.md` (18-subsystem routing table) + dir created — *orchestrator, done 08-31*
- [x] **A3 Phase→dossier map** → `.planning/knowledgebase/phase-dossier-map.md` — *subagent, done 08-31.
      Verified findings for the resolver: `context-dxx` tier (real D-NN + DISCUSSION-LOG) is
      ONLY phases 16, 17, 19.1; 01–04 D- matches were false positives (FND-/CRUD- prefixes) =
      `context-prose`; phases 05/06/07 have NO CONTEXT.md → dossier is sole source; dossier
      05-import CUT; phase 18 split shares one dossier; dossiers domain-numbered (07-photos→P05).*
- [x] **A4 ADR-bridge scripts** → `scripts/` (9 ported) + `package.json` (7 npm scripts) +
      `docs/decisions/adr-registry.ts` — *subagent, done 08-31. `tsx` already present. Legacy
      ADR-001/002/003 don't parse (no `## Implementation`, bulleted `- **Status:**`) — expected,
      fixed at backfill. Note: ADR-003 (added 08-31, phase 20) partially supersedes ADR-002.*
- [x] **A5 Graphify enable** → `config.json enabled:true` ✅, `.graphifyignore` ✅ authored;
      `.gitignore` graphify rules were ALREADY present ✅ — *orchestrator, done 08-31*
- [x] **A6 Verify hook wiring** — both block hooks ALREADY wired in `settings.json` PreToolUse ✅ — *orchestrator, done 08-31*
- [x] **A7 First `npm run graph:build`** — *done 08-31. Clean end-to-end: 3,516 nodes /
      11,088 edges / 189 communities; ADR normalize ran (14→5); synth reported +0 code→ADR
      edges (expected — legacy ADRs have no Key-files block). `graphify-out/` + `.planning/graphs/`
      created; both gitignore-handled. INDEX.md deferred — generated on first real extraction.*

## Group B — The two skills  *(after A)*

- [x] **B1 `extract-phase-kb`** — *done 08-31 (subagent, verified). 323 lines; dossier-first
      resolver, 18 subsystems, chronology discipline, legacy ADR-001/002/003 reclaim rule,
      batched-per-milestone, commit-as-you-go baked in, harness-neutral. Commit `3760c65`.*
- [x] **B2 `split-system-doc`** — *done 08-31 (subagent, verified). Commit `7e92c91`.*
- [x] **B3 Install both** to `.claude/skills/` (committed) + `~/.codex/skills/` (global, incl.
      `agents/openai.yaml` wrapper). CLAUDE.md's 4 stale "port before build" notes synced to
      reality. Codex block hooks (worktree + graphify) ported repo-scoped to `.codex/hooks/`
      (git-publication already covered by `.codex/rules/`; production-db N/A). — *done 08-31*

## Group C — Existing ADRs  *(deferred to backfill)*

- [ ] C1 Reclaim ADR-001 in place at phase 16; archive original → `docs/decisions/_archive/`
- [ ] C2 Reclaim ADR-002 in place at phase 19.1; archive original

## Post-build adjustments

- **2026-08-31 — CLAUDE.md rule reversed (owner).** Earlier the skills *deferred* CLAUDE.md
  edits to the owner. Owner prefers the quest-board behavior: the skills **maintain CLAUDE.md
  themselves** (index rows for new/renamed/retired system docs + runbooks), but **every
  add/remove/change is surfaced in the skill's plan-gate / seam-confirmation review for owner
  approval before writing**. Applied to both skills (commit `265edb3`); codex copies re-synced.

## Test plan  *(validates the machine before mass run)*

- [ ] T1 **Claude → phase 01** (real, in-order, committed); verify
- [ ] T2 **codex → phase 02** (real, in-order, committed) — only after T1 commits; verify
- [x] T3 **Subagent → phase 16 scratch dry-run** — *done 08-31. Isolation VERIFIED (repo
      untouched, all output in scratch). Resolver correct (no-dossier/context-dxx, D-06a/b
      owner-resolutions captured), legacy ADR-001 reclaim worked, plan-gate surfaces CLAUDE.md
      changes as intended, ADR/system-doc quality good.*
- [x] T4 **Iterate skills on findings** — *done 08-31 (commit `1b5052e`): batch-order
      prerequisite guard, INDEX.md plan-level status, cross-cutting tie-breaker rule, manifest
      decision-source-tier field, reclaim ADRs exempt from cluster cap.*

## Backfill progress & codex learnings

- **Phase 01** (Claude) — extracted 2026-08-31. ADR-004…007, no system docs (persistence-core
  deferred to 02). Clean; 12 graph edges. Verified good.
- **Phase 02** (codex) — extracted 2026-08-31. ADR-008…012 (dossier-sourced), 3 system docs
  (persistence-core, contacts, status-engine), sqlite-migration-pipeline runbook. Content on par
  with Claude; chronologically scoped. README anchor nudged 01→02; CLAUDE.md untouched (correct).
- **Phase 03** (codex, **yolo/full-access**) — extracted 2026-09-01. ADR-013…015 (original
  dynamic-column custom-field design), custom-fields.md created, persistence-core.md UPDATED
  (cross-cutting). **Chronology nailed** — describes the phase-03 dynamic-column model
  (`contact_custom_values`, DDL), NOT the current normalized one; supersession correctly `None`
  (phase 16 not yet processed). Graph rebuilt fine (26→42 edges).
- **CODEX GRAPH GAP — RESOLVED by full-access.** codex's default `workspace-write` sandbox
  silently skips `graph:build` (graphify needs `~/.claude/…` outside the workspace + worker
  subprocesses) and reports success anyway (phase 02 had to be rebuilt externally, 12→26).
  **CONFIRMED FIX: run codex extractions in yolo/full-access** — phase 03 rebuilt the graph itself
  (26→42, graph committed). Backstops still in place: the skill's before/after edge-count catch
  flags `GRAPH REBUILD OWED` (commit `2d724c5`) for any non-yolo run, and a final `graph:build`
  from Claude/shell at end-of-batch is cheap insurance.
- **Phase 04** (codex, yolo) — extracted 2026-09-01. ADR-016…019, contacts.md UPDATED
  (lifecycle/archive/purge — chronologically clean), custom-fields.md + persistence-core.md
  cross-cutting UPDATEs. Graph 42→60. **Two boundary calls to note:** (1) codex added a NEW
  "App shell" subsystem row to README (navigation/bootstrap/settings) — not in the original 18;
  (2) app-shell.md **absorbed the theme contract** (theme-types/presets, no-raw-hex), which
  overlaps ADR-006 and **pre-empts the M2 theme doc** that phase 01 deliberately deferred. At
  M2's theme phase, decide whether to split theme out of app-shell (use `split-system-doc`).
- **Safeguard bug fixed (`grep -c` → `grep -o | wc -l`):** graph.json is minified to one line,
  so the edge-count catch always read 1→1 and fired a false `GRAPH REBUILD OWED` every run.
  Fixed; phase 04's graph was actually fine.
- **Watch at phase 16:** the reclaimed ADR-001 (normalized) must supersede ADR-013/014/015 —
  their `Superseded by:` should flip to ADR-001 when phase 16 is extracted.
- **Skill fix:** subsystem index maintenance routes to `docs/systems/README.md`, not CLAUDE.md
  (orbit has no per-doc CLAUDE.md index) — commit `afc0e85`.

## Deferred — not this session

- [ ] Full backfill 01→21 in strict order, batched, post sub-upgrade
- [ ] M2 going-forward extraction at each milestone close

---

## Progress log

- **2026-08-31** — Plan written. Group A kicked off: subagents dispatched for A1
  (templates), A3 (phase-dossier map), A4 (scripts); orchestrator handling A2/A5/A6.
  Verified pre-state: both block hooks already exist in `.claude/hooks/`; graphify still
  disabled; no templates/scripts/`docs/systems`/graphs dir yet.
- **2026-08-31** — **Group A complete.** All 3 subagents landed (templates, phase→dossier
  map, scripts); orchestrator did A2/A5/A6 + A7. First graph:build clean (3,516 nodes).
  **NOT committed** — the working tree has the owner's in-flight phase-20/21 dev work and a
  `config.json` `review`-models block (owner's, uncommitted) entangled, so committing is left
  to the owner / a selective substrate-only commit. Next: Group B (author the two skills).
- **2026-08-31** — Substrate committed as 3 atomic commits (scripts / graphify config+build /
  templates+maps). Owner then authorized committing the rest: added `.gsd/` + `**/uat-shots/`
  to `.gitignore` (uat screenshots ignored per owner — 11MB, still Syncthing-synced), and
  committed the owner's in-flight phase-21 work, milestone-2 dossiers, and config. **Tree
  clean.** Reminder for Group B: both skills must **atomically commit their own work as they
  go** (owner request).
