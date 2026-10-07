# Orbit — Dossier Conventions

Read by the global `phase-dossier` skill (`~/.claude/skills/phase-dossier/`) at the start of every
run. It overrides the skill's generic defaults.

Built 2026-10-07 from:
- the Claude-era M2 dossiers (38.5, 38.6, 38.7);
- the ChatGPT-era dossiers (11, 37.1, 38);
- the workpapers in `docs/dossier/workpapers/`;
- the ADRs and the ADR template;
- the 38.6/38.7 CONTEXT + DISCUSSION-LOG files;
- CLAUDE.md, and the `oa-interrogate`, `oa-audit-dossiers` and `extract-phase-kb` skills.

## 1. Paths

**From Phase 38.8 on, every planning file for a phase lives in its phase folder:**

```
.planning/phases/{N}-{slug}/
  {N}-WORKPAPER-{topic}.md     research/design evidence, competing models, open questions (optional)
  {N}-WORKPAPER-{topic}/       its screenshots, fixtures, evidence manifests
  {N}-LEDGER.md                decision ledger: provenance + resume point
  {N}-CONTEXT.draft.md         the dossier while it awaits owner acceptance
  {N}-CONTEXT.md               the accepted dossier (GSD reads this)
  {N}-DISCUSSION-LOG.md        stub pointing at the ledger
```

- **The CONTEXT is the dossier.** There is no separate `docs/dossier/milestone-2/phase-…-dossier.md`
  for 38.8 onward.
- Reuse an existing `{N}-*` folder. The owner inserts phases into the roadmap themselves (via a
  dedicated agent), reusing this folder. GSD fails if two folders match one phase number.
- At milestone close `gsd-cleanup` moves phase folders to `.planning/milestones/v{X}-phases/`.
  Refer to planning files by phase + filename, not by deep relative links, where you can.
- **Legacy, read-only history (don't move or rewrite):** `docs/dossier/milestone-2/` (phases
  01–38.7), `docs/dossier/*.md` (milestone-1 domains), `docs/dossier/workpapers/`,
  `docs/dossier/milestone-2/planning-notes/`, and `docs/experiments/` syntheses (HARVEST-MAP /
  DEAD-ENDS / OWNER-REVIEW).

## 2. Status tokens

| Skill status | Orbit token | Notes |
|---|---|---|
| LOCKED | `[DECIDED · YYYY-MM-DD]` | owner chose it |
| DERIVED | `[DERIVED]`, or `[DERIVED · verified]` | engineering consequence, pinned so planning can't drift |
| CARRIED | `[CARRIED · <source>]` | **new token.** Older dossiers used a "Carried Constraints" section |
| PROVISIONAL | `[PROVISIONAL]` | **new token.** Ledger/draft only; must be cleared before handoff |
| OPEN | `[OPEN]` | never present in an accepted CONTEXT |
| DEFERRED | `[DEFERRED]` | |
| REJECTED | `[REJECTED · YYYY-MM-DD]` | always with the reason |
| NOTE | `[PLANNING NOTE]` | add `· LIKELY` when unverified |

Markers:
- `⚠ SUPERSEDES <record> (partial — what)` and `⚠ AMENDS <record>` go on the decision that reverses or
  amends a recorded decision. Never label one a "bug fix".
- When something changes, strike the old text through but keep it, and add `[RESOLVED · was OPEN]`
  or `[SUPERSEDED by D-NN (owner, date)]`.

In CONTEXT.md the token follows the GSD bullet, e.g.
`- **D-03:** [DECIDED · 2026-10-07] Activity stream is the default History view. …`.

## 3. IDs

- **One D-NN space per phase**, starting at D-01. An ID is assigned in the ledger when the decision
  is made, and the same ID is used in CONTEXT.md. Never reuse or renumber.
- Questions are `Q-NN`, notes `N-NN`. These stay out of `<decisions>` as bold bullets (see the
  skill's parse rules).
- **Cross-phase references:** use `38.6 D-11` for a Claude-era phase and `ADR-121` for an ADR. The
  ChatGPT-era dossiers (01–38.1) have no IDs; cite them by file and section, e.g.
  `phase-11 dossier §G`.
- **Owner checkpoint option codes** (e.g. `T-HOME = HOME-A`) are recorded verbatim in the ledger.

## 4. CONTEXT.md dossier blocks (added to GSD's template)

After `<deferred>`, and before the footer:

```
<supersessions>
## Supersessions to record at KB extraction
| D-ID | Supersedes / amends | Partial — what exactly | What survives |
</supersessions>

<verification>
## Verification Expectations
**Unit and logic:** …
**Device:** debug for iteration, then one release build on the Pixel 6 Pro and Pixel 3a. Datasets: …
**Owner device checkpoints:** by D-ID …
**Obsolete / rewritten tests:** …
</verification>
```

Other placements:
- **`<domain>`** carries Objective, **In**, **Out** and **Preserved behavior** lists, citing D-IDs.
- **`<code_context>`** is the "Current State" section of the old dossiers: what the live code does
  today, with `path:line`, plus defects found (a table: # | Defect | Where | Root cause).
- **Header blockquote**, beyond the skill's default: "Authoritative contract: this file. Record any
  new rulings here as dated `[DECIDED]` entries with new D-IDs, and in the ledger."

## 5. Evidence and citations

- State the baseline at the top: "verified against `main @ <hash>` unless labelled LIKELY".
- Cite code as backticked `path:line` or `path:start-end`, and commits as short hashes in
  backticks. Cite docs as `ADR-121 :18`, `phase-11 dossier :170`.
- **Finding governing ADRs:** `npm run graph:ask -- <query>`, not raw graphify or grep. It flags
  superseded ADRs. A missing code→ADR edge means nobody wrote the citation, not that no decision
  governs the file (CLAUDE.md, "The ADR bridge").
- System docs: `docs/systems/<subsystem>.md` (e.g. `interaction-history.md`, `profile.md`). Read the
  one for the area. Its Decisions list names the governing ADRs.
- Workpaper evidence labels: `[DOCUMENTED]` / `[INFERRED]`, graph `EXTRACTED` / `INFERRED`, and
  "reasoned assessment, not user-test result" where that applies.

## 6. ADRs and supersession

- **ADRs are not written at dossier time.** They are written at phase close by `extract-phase-kb`,
  from the phase's decision source. The dossier records the supersession with the `⚠ SUPERSEDES`
  marker on the decision plus a row in `<supersessions>`.
- **Exception (the ADR-177 precedent):** if the owner rules that the phase itself writes the ADR,
  that ruling is a D-NN, and a plan task writes it.
- **ADR mechanics,** for reference when naming what is superseded:
  - Files are `docs/decisions/ADR-NNN-slug.md`, numbered globally (the next number is max + 1) and
    immutable.
  - Status is always `Accepted`. Retirement is expressed only through `**Superseded by:**`.
  - The new ADR says `**Supersedes:** ADR-121 (partial — <what>)`; on the old ADR, only its
    `**Superseded by:**` line changes.
  - `INDEX.md` and `adr-registry.ts` are generated (`npm run gen:adr-index`, `gen:adr-registry`).
- **KB extraction source for 38.8 onward:** the phase's `{N}-CONTEXT.md` is the dossier, and the
  `{N}-LEDGER.md` supplies the alternatives and rationale. When the phase is added to
  `.planning/knowledgebase/phase-dossier-map.md`, its "Dossier file(s)" column names the CONTEXT.

## 7. Owner authority (CLAUDE.md, "owner's bucket")

The owner decides:
- taste, product, visual design and priorities;
- risk and security posture;
- **anything that reverses a decision recorded in an ADR, a dossier or `HANDOFF.md`**, however
  technical the trigger.

Enforcing a recorded decision is a planner call; reversing one is the owner's.

`HANDOFF.md` (repo root) is the pre-repo decision record: its `[DECIDED]` items are not reopened and its
`[REJECTED]` items are not re-proposed as new. A question from the owner mid-interrogation is a question,
not authorization: answer it, then continue; do not act on it. Name the record and
which half of it dies, then ask. "It's just a bug fix" is never a licence.

## 8. Verification format

See the `<verification>` block in §4. Device work means:
- the owner's **Pixel 6 Pro** and **Pixel 3a**;
- debug builds for iteration, then one release build;
- named seed datasets (e.g. long-history fixtures);
- owner checkpoints listed by D-ID.

Never invent performance thresholds. Unmeasured gates are `[PLANNING NOTE]`s, or owner-locked
after a measured baseline (the 38.7 D-56 pattern).

## 9. Commits

- Commit in place on the current branch. **Never push** (the owner pushes). **Never `git worktree`.**
- **No AI/assistant attribution trailers** (owner preference). Plain factual messages:
  - `docs({N}): interrogation complete — ledger`
  - `docs({N}): accept dossier draft`
  - `docs({N}): capture phase context` (the handoff commit, via `gsd-tools query commit`)
- The ledger is written after every batch and committed only at stage boundaries.
- Stage only the named files. Never `git add -A`.

## 10. Subagent rules (add to every subagent prompt)

- "Never use git worktrees. Never push. Read the actual code on disk: full files, not diffs or
  summaries."
- Never pass `isolation: "worktree"` to the Agent tool.
- Raw `graphify` builds are blocked by a hook. Use the npm scripts.
- Verify every subagent claim against the files or `git show` before reporting it.

## 11. Terms and pointers

- The glossary and the non-negotiables are in `CLAUDE.md`; pre-repo decisions are in `HANDOFF.md`; subsystem routing is in
  `docs/systems/README.md`.
- History area: ADR-119…123 and ADR-152/165/174; `docs/systems/interaction-history.md`; the
  phase-11 v0.2 dossier (the ChatGPT-era ground truth for History).
- The product direction is in `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md`.
