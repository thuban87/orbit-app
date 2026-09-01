---
name: oa-audit-dossiers
description: "Pre-build system audit of a milestone's dossiers: ingest every dossier in full, build a lossless decision ledger, then detect cross-dossier conflicts and single-decision risks across three lanes — paper conflicts, a mandatory data-layer reality check against the live codebase (via read-only subagents), and an exhaustive cross-phase + orphan-dependency sweep — rated and routed to auto-fix / replan / owner-escalation. Read-only up to an explicit approval gate."
argument-hint: "[milestone dir or glob] (no arg = docs/dossier/milestone-2) · append --fix to arm the fix stage"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
---

<objective>
One run audits an entire milestone's dossiers as a system, BEFORE any of it is built,
looking for decisions that conflict or that will cause problems even if they do not
conflict. Output is two committed-when-approved artifacts — a lossless decision ledger and
a rated, cited conflict report — plus, only after the owner approves, atomic fixes for the
small/medium findings.

**Why this exists.** The milestone-2 dossiers were authored outside GSD (in ChatGPT) and
locked before this repo's planners ever saw them. Conflicts between dossier N and dossier M
live in the seam between two documents; nothing in the discuss→plan→execute pipeline reads
two dossiers against each other. This skill is the missing cross-dossier gate that runs
once, up front, so the owner fixes contradictions on paper instead of discovering them
three phases into execution.

**The load-bearing property: one brain adjudicates conflicts.** The full milestone corpus is
~130k tokens of dossier text and fits in a single context. Do NOT fan out subagents to
ingest or "summarize" dossiers — a conflict between two dossiers is only visible to an agent
that holds both. **Ingestion (Pass 1) and every conflict/risk verdict (Pass 2) happen in
THIS context, never delegated.**

Subagents are permitted for exactly two things, both fact-gathering, never judgment:
- **Lane A code-reality verification** (Pass 2): a per-table subagent is handed specific
  ledger claims plus the files to check, and returns *confirmed / contradicted / the code
  actually does X* with `file:line` cites. It reports facts scoped to its assignment; it
  never decides whether a fact is a cross-dossier conflict. The orchestrator, holding the
  full ledger, makes every such call.
- **The fix stage**, where each fix is local and isolated.

**Extract is not synthesize.** Pass 1 re-shapes every decision into an atomic ledger entry
losslessly — nothing is dropped, compressed, or judged. Summarizing here would defeat the
entire point.
</objective>

<hard_rules>
From CLAUDE.md, non-negotiable:

- **This skill makes NO repo mutation until the owner approves fixes at the gate in step 6.**
  Up to that point it writes only the two audit artifacts (LEDGER.md, AUDIT-REPORT.md), never
  commits them, and never edits a dossier or any source file. Lane A verification subagents
  DO run before the gate, but they are strictly read-only (Read/Grep/Glob) — they gather
  facts, they do not write. A dry run is: run (including the full Lane A/B deep pass), read
  the output, stop. No fixes, no dossier edits, no commits.
- **The authority gate overrides fix effort.** A fix that would reverse, weaken, invert, or
  even edit a `[DECIDED]` statement, an ADR, or a HANDOFF.md entry is the OWNER's call —
  it ESCALATES regardless of how trivial the edit looks. "It's a one-line fix" is never a
  licence to reverse a recorded decision. Small effort ≠ small authority.
- **Never run `git worktree`; never pass `isolation: "worktree"` to the Agent tool.** Every
  fixer subagent prompt MUST include: "Never use git worktrees. Never push. Read the actual
  file on disk, not a diff or summary. Commit in place on the current branch."
- **Never push.** Commit locally; tell the owner what is ready.
- **Do not report a subagent's claim as fact.** After any fixer subagent returns, verify its
  work against `git diff` / `git show` and the file on disk before reporting it done.
- **Read the code, not the diff.** Findings cite dossier:line on every side of a conflict;
  the owner (and you) must be able to open both and confirm. A finding without verifiable
  cites is not a finding.
</hard_rules>

<process>

## 1. Resolve scope and mode

- **Argument** = a directory or glob of dossiers. No argument → `docs/dossier/milestone-2`.
- **`--fix`** anywhere in the argument arms the fix stage (step 7). Without it, the run
  always stops at the gate after presenting the report — this is the dry-run default.
- **Resolve dossier versions — do NOT trust a fixed glob.** List the whole directory. Files
  are versioned by suffix (`…-dossier.md`, `…-dossier-v0.2.md`, `…-dossier-amended-<topic>.md`)
  and an amended/higher-version file **supersedes** the plain `…-dossier.md` for the same
  phase number. For each phase number, select the single latest/most-amended file as
  authoritative; treat any superseded original as non-authoritative and do NOT ingest it
  (ingesting both double-counts a decision and manufactures phantom self-conflicts). A glob
  like `phase-*-dossier.md` silently misses `-v0.2`/`-amended` files and grabs stale
  originals — never rely on it. Also pick up group-events / restructuring briefs in the dir.
- **The roadmap file** (e.g. `orbit-ui-ux-working-roadmap-v0.8.md`) carries intended phase
  ordering and the milestone phase map — load it; it is the source for the orphan sweep
  (Lane B) and sequencing conflicts. Note any internal-title-vs-filename version mismatch.
- **`.docx` masters:** attempt text extraction before skipping — `unzip -p <file> word/document.xml`
  then strip tags, or `pandoc <file> -t plain` if available. If a decision lives only in the
  `.docx` and not the `.md` roadmap, it must be audited too. If extraction genuinely fails,
  record the file as an UNAUDITED GAP in the report header (not a silent skip) and tell the
  owner it may hide decisions.
- **Record the exact ingested manifest** in the report header: every file read, with its
  resolved version, and every file deliberately skipped (superseded originals, failed docx),
  so the corpus that was actually audited is auditable.
- If fewer dossiers exist than the milestone will eventually have, say so plainly — this is
  a valid partial/dry run over what exists today, and the skill is re-runnable when the
  rest land. The ledger and report are rewritten wholesale each run (idempotent); a prior
  `audit/LEDGER.md` on disk may be read as a cross-check but the run re-extracts from source.

## 2. Load everything, in full, in this context

Read every matched dossier end to end. Also read `HANDOFF.md` and skim `docs/decisions/`
(ADR titles + status) so the authority gate can recognise a recorded decision. Do NOT
delegate this reading — you must personally hold every dossier at once.

Each dossier carries its **own Decision Legend** (tags have varied: `[DECIDED]`,
`[DERIVED]`, `[DEFERRED]`, possibly others). Read each dossier's legend; never assume a
fixed vocabulary across the set.

## 3. Pass 1 — lossless extraction → LEDGER.md

Emit one atomic entry per tagged statement AND per structural claim. This is
transcription, not summary: preserve the statement faithfully, one entry each.

```
LEDGER ENTRY
  id:        D-<phase>-<seq>            e.g. D-06-014
  phase:     06
  section:   "N. Swipe Actions"         # the dossier's own heading
  topic:     <short tag, e.g. "swipe/log-direction">
  status:    LOCKED        # was [DECIDED]
           | DERIVED       # was [DERIVED] — an author-asserted consequence
           | DEFERRED-DECISION   # postponed, but something locked assumes an answer
           | DEFERRED-FEATURE    # postponed build-later, no current coupling
  statement: <the decision, quoted or tight-paraphrased — no meaning lost>
  assumes:   [<topics/phases this depends on — esp. from Cross-Phase Constraints>]
  cite:      phase-06-dashboard-list-view-dossier.md:216
```

Map each dossier's legend tags onto the normalized `status` set. Extract from **every**
part that carries decisions, not just the lettered sections:

- Lettered decision sections (A, B, C…) — the bulk.
- **Cross-Phase Constraints** — each "Phase X is authoritative for Y" line becomes a
  ledger entry with `assumes` pointing at phase X. These are cross-checkable claims and the
  richest conflict source.
- **Explicitly Deferred** — classify each item DEFERRED-FEATURE unless a LOCKED entry
  elsewhere depends on it (then DEFERRED-DECISION).
- **Phase Success Criteria** and **Notes for GSD/Roadmapper** — the "do not…" imperatives
  here are strong constraints; extract them.
- **Scope's "does not" list** — an explicit boundary; extract as a boundary entry.

Write `<dir>/audit/LEDGER.md` grouped by phase. This file doubles as the GSD-extractable
decision registry.

## 4. Pass 2 — conflict + risk detection over the ledger

Run three lanes. Lanes 0 and B are pure reasoning over the ledger held in one context.
Lane A gathers on-disk facts via read-only subagents and feeds them back to this context,
which makes every verdict. **A run is not complete unless all three lanes ran** — skipping
Lane A is the failure mode that made an earlier run look deceptively clean.

### Lane 0 — paper conflicts (ledger vs ledger)

**CONFLICT** — two entries that cannot both hold. Hunt specifically for:
- Direct contradiction — two LOCKED entries asserting incompatible things.
- **Cross-phase claim mismatch** — a `Cross-Phase Constraints` entry says phase X owns/defines
  Y, but phase X's ledger has no such entry, or defines it differently. (High yield —
  verified exhaustively in Lane B, not spot-checked.)
- **Broken derivation** — a DERIVED entry that does not actually follow from, or contradicts,
  its own phase's LOCKED parents, or another phase's LOCKED entry.
- **Sequencing conflict** — phase A (earlier in the roadmap) depends on something phase B
  (later) builds. Effort may be one line; blast radius is not.
- **Forward-compat foreclosure** — a LOCKED entry makes a DEFERRED-DECISION impossible or
  expensive, or assumes an answer to one that is still open. (This is the ONLY way deferred
  items enter analysis — see the deferred-item rule below.)

### Lane A — code/schema reality check (ledger vs the live codebase) — MANDATORY

This is where this repo's real correctness bugs live (CLAUDE.md: "read every writer of a
shared table"). A dossier decision about storage is a *claim*; the schema and DAOs are the
*truth*. Verify every claim against disk.

1. **Enumerate claims to check.** From the ledger, collect every entry that asserts anything
   about a table, column, migration, index/constraint, a writer's behavior, or a data-layer
   invariant. Group them by the table/subsystem they touch.
2. **One read-only subagent per table/subsystem.** Spawn `general-purpose` (or `Explore`)
   agents — parallel where the tables are disjoint. Each prompt carries: the specific ledger
   claims (id + statement + cite), the table name, and the boilerplate: *"Never use git
   worktrees. Read the actual code on disk — full files, not diffs. Grep the table name
   across `src/db`, `src/services`, `src/screens`, `src/backup`; open EVERY writer and the
   owning migration. For each claim return: CONFIRMED / CONTRADICTED / code-actually-does-X,
   with file:line. Report on-disk facts within scope that the claim omits. Do NOT judge
   whether anything is a cross-dossier conflict — report facts only."* These agents are
   read-only (Read/Grep/Glob); they write nothing and run in a dry run.
3. **Verify and adjudicate here.** Do not report a subagent's claim as fact — open the cited
   file yourself for any finding you'll surface. Then the orchestrator (holding the full
   ledger) decides whether a confirmed-fact-vs-claim gap is a CONFLICT/RISK.
4. **Flag required-but-unbuilt schema explicitly.** Where a dossier requires a table/column/
   migration that does not exist yet (e.g. group-event table, a duration column, new
   lifecycle event types), that is a finding: the migration is unsequenced and unnumbered,
   and per the repo's migration-numbering hazard that is exactly where silent corruption
   hides. Route such findings REPLAN (they need sequencing), and note how many new migrations
   the milestone implies and that no dossier orders them.
5. **Storage-shape changes are migrations, not relabels.** A "terminology" change that alters
   an enum's values, a column's null semantics, or default over existing rows is a data
   migration — analyze the backfill, don't file it as a doc-sync.

### Lane B — exhaustive cross-phase + orphan sweep

- **Every** "Phase X owns/defines Y" claim (from Cross-Phase Constraints and `assumes`) is
  resolved against phase X's own ledger — all of them, recorded as checked, not spot-checked.
- **Orphan sweep:** every dependency must resolve to a phase that actually owns and builds it
  *within the milestone phase map* (from the roadmap). A dependency on a surface no phase owns
  (e.g. a "Your Week" that three phases delegate to but nobody builds), or on a phase not yet
  interrogated/planned, is a routed finding — usually REPLAN or ESCALATE — **not** a "watch"
  item. Un-owned and uninterrogated-dependency surfaces are first-class findings.

### Then, for all lanes:

**RISK** — a single entry that is internally fine but a high-confidence footgun (e.g. a
decision that violates a data-layer invariant in CLAUDE.md, or reintroduces a bug the repo
already fixed). **Conservative**: report only footguns you can name a concrete failure for.
Do NOT report taste, style, or "I'd have done it differently." When in doubt, drop it.

**Deferred-item rule.** A DEFERRED-FEATURE with no coupling to any LOCKED entry NEVER
enters conflict analysis — it stays parked in the ledger, not the report. A deferred item
enters ONLY on the two forward-compat axes above (something locked assumes its answer, or
forecloses it). This keeps the report signal-dense.

Rate every finding on three independent dimensions:

```
FINDING
  kind:     CONFLICT | RISK
  effort:   SMALL     # one-line / one-clause edit in one dossier
          | MEDIUM    # some edits + slight rework of a phase goal
          | LARGE     # impacts multiple decisions, needs planning
  blast:    <count + list of phases whose decisions/plans this touches>
  reverses_locked: yes | no    # touches/contradicts a [DECIDED], ADR, or HANDOFF entry
  sides:    [D-06-014 @ ...:216, D-04-003 @ ...:88]   # cite EVERY side
  summary:  <one line: what collides and why it can't stand>
  proposed: <the concrete edit, if effort is SMALL/MEDIUM>
```

## 5. Route every finding

```
if reverses_locked:                       → ESCALATE   (owner's call, even if SMALL)
elif unbuilt/unsequenced schema
     or orphan/uninterrogated dependency: → REPLAN     (needs sequencing/planning)
elif effort == LARGE or blast is wide:    → REPLAN     (targeted new planning session)
elif effort in {SMALL, MEDIUM}:           → AUTO-FIX   (fixer subagent, after approval)
```

`blast is wide` = the fix ripples into more than one phase's already-written decisions/plans.
A trivial edit with wide blast routes to REPLAN, not AUTO-FIX. An AUTO-FIX only ever aligns a
dossier with a decision already recorded elsewhere; it never originates a decision.

## 6. Write AUDIT-REPORT.md and present — the gate

Write `<dir>/audit/AUDIT-REPORT.md`: findings grouped by route (ESCALATE / REPLAN /
AUTO-FIX), each with its three ratings, both-sides cites, and proposed edit. Include a
short header: dossiers audited, ledger entry count, finding counts per kind and per route.

**Leave both artifacts uncommitted.** Present the owner a compact summary — counts per
route, and the AUTO-FIX list as candidates. Then STOP at the gate:

- **Dry run / no `--fix`:** state that the two docs are in the working tree, nothing is
  committed, and he can read them and re-run with `--fix` when ready. Done.
- **`--fix` present:** ask ONCE, via AskUserQuestion, which AUTO-FIX findings to apply
  (batch approval — never per-finding drip). Offer "apply all AUTO-FIX", a subset, or
  "none (leave as dry run)". ESCALATE and REPLAN items are reported for the owner to act on
  himself; the skill never touches them.

## 7. Fix stage (only past the gate, only for approved AUTO-FIX findings)

For each approved finding, spawn ONE fixer subagent (these run in parallel where they touch
disjoint files; serialize any that touch the same dossier). Each prompt carries the
hard-rules boilerplate plus: the finding, both-sides cites, the exact proposed edit, and
"make only this edit; if the real fix reverses a [DECIDED]/ADR/HANDOFF item, do NOT edit —
report back that it needs escalation."

After each returns: **open the file and `git diff` yourself** — confirm the edit is exactly
the approved one and touches nothing else. Then commit it atomically:
`docs(dossier): resolve <finding-id> — <summary>`, in place, current branch. One commit per
finding so any single fix is independently reversible.

If a fixer reports its fix actually needs to reverse a locked decision, move that finding to
ESCALATE and leave it for the owner — do not apply it.

## 8. Wrap up

Commit LEDGER.md and AUDIT-REPORT.md (only now, alongside applied fixes — or not at all if
the run stayed a dry run and the owner wants the tree clean; ask). Report to the owner:

- ledger + report locations,
- what was auto-fixed (with commit hashes, verified against `git show`),
- the ESCALATE list — decisions only he can reverse, each with both-sides cites,
- the REPLAN list — findings needing a targeted planning session, with the phases each touches.

</process>

<success_criteria>
- Dossier versions were resolved (latest/amended per phase; superseded originals not ingested);
  the report header lists the exact ingested manifest and any UNAUDITED GAP (failed docx).
- Every authoritative dossier read in full in one context; ingestion and every conflict/risk
  verdict done here, not delegated.
- LEDGER.md is lossless — every tagged statement, cross-phase constraint, boundary, and
  "do not" note has an atomic, cited entry; nothing summarized away.
- **All three lanes ran.** Lane A verified every data-layer claim against the live codebase
  via read-only subagents whose facts were re-confirmed on disk before use; required-but-
  unbuilt schema was flagged and routed REPLAN.
- **Every** "Phase X owns Y" claim was resolved against phase X's ledger (Lane B), and every
  dependency on an un-owned or uninterrogated surface is a routed finding, not a watch item.
- Findings carry effort, blast radius, and reverses_locked independently; routing follows
  the state machine with the authority gate overriding effort.
- Deferred-features with no coupling never appear in the report; deferred-decisions appear
  only on the forward-compat axes.
- Risk findings are conservative — each names a concrete failure, none are taste.
- No repo mutation before the approval gate; a dry run produced exactly the two docs plus
  read-only subagent activity.
- Every applied fix was verified against git diff before being reported, one atomic commit each.
- No [DECIDED]/ADR/HANDOFF reversal was applied by the skill; all were escalated to the owner.
</success_criteria>
