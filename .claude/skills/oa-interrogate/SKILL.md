---
name: oa-interrogate
description: "Deep pre-roadmap interrogation of one dossier domain: investigate plugin source and platform constraints, then question the owner in rounds until top-level decisions are firm"
argument-hint: "<number|slug> from docs/dossier/INDEX.md (no arg = show status)"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - WebSearch
  - WebFetch
---

<objective>
One run = one domain from `docs/dossier/INDEX.md`, taken from "pending" to "complete":
deep investigation first (plugin source, platform constraints, cross-domain overlaps),
then structured interrogation of the owner, then a finished decision record at
`docs/dossier/NN-slug.md`.

**Depth contract:** investigation is DEEP — read full source files, verify constraints
against current official docs. Questions are MEDIUM — roadmap altitude (what it is, why,
how it fits the other domains), never code-level detail.

This skill exists because `/gsd-new-project`'s questioning never opens features up to find
hidden complexity. The exemplar output is HANDOFF.md §14 (custom fields): every meaningful
alternative surfaced, decided, and tagged.
</objective>

<hard_rules>
These come from CLAUDE.md and are non-negotiable:

- **Never run `git worktree`**, and never pass `isolation: "worktree"` to the Agent tool.
  Every subagent prompt you write MUST include: "Never use git worktrees. Read the actual
  code on disk — full files, not diffs or summaries."
- **Do not report a subagent's claim as fact.** Before a subagent finding becomes a
  question or a recommended answer, open the cited file/doc yourself and confirm it.
- **[DECIDED] and [REJECTED] items in HANDOFF.md or completed dossier files are not yours
  to reopen.** If the owner's answer to a question would reverse one, say so explicitly
  before recording it ("this reverses HANDOFF §X, which decided Y — confirm?").
- The old plugin lives at `~/projects/Orbit` — reference it in place. Never copy it into
  this repo. If the path is unreadable, stop and ask the owner to `/add-dir ~/projects/Orbit`.
- Commit in place on the current branch.
</hard_rules>

<process>

## 1. Resolve the argument

Read `docs/dossier/INDEX.md`. Match `$ARGUMENTS` against domain number or slug.

- **No argument:** print the status table, recommend the next `pending` domain in numbered
  order, and stop.
- **No match:** list valid numbers/slugs and stop.
- **Domain is `complete` or `cut`:** say so and stop unless the owner explicitly asks to
  reopen (that is an owner decision, not yours).

## 2. Load context

Read, in full: `INDEX.md`, `HANDOFF.md`, every dossier file whose status is `complete`
(their "Cross-domain constraints exported" sections bind this run), and the cross-domain
constraint log entries targeting this domain.

**Resume check:** if `docs/dossier/NN-slug.md` already exists with recorded decisions,
this is a resumed session. Treat every recorded answer as settled, rebuild the remaining
question queue from its [OPEN] items, and skip whatever investigation its "Findings"
section already covers. Never re-ask an answered question.

## 3. Deep investigation (orchestrator, in this context)

Read the plugin source files listed for this domain in INDEX.md — full files, at
`~/projects/Orbit`, plus whatever they import that matters. Read the matching user-facing
doc in `~/projects/Orbit/docs/`. Where docs and code disagree, trust code and note the
drift. Check `git -C ~/projects/Orbit log` on a file when a value or behavior seems
arbitrary — the history often explains it.

You are looking for: behavior the owner may not know his own plugin has, edge cases the
old code handled (they were handled for a reason), coupling that changes shape on mobile,
and anything HANDOFF.md asserts about this domain that the source contradicts.

## 4. Fan out subagents

Two kinds, spawned in parallel where independent:

**Overlap investigators** — for each likely-overlapping domain (INDEX lists candidates;
your reading may add more), spawn an agent with: the specific overlap hypothesis, the
relevant dossier/HANDOFF sections, and pointers into the plugin source. Its job: find
concrete design questions, conflicts, and constraints at the seam — not a general survey.

**Platform verifiers** — for each platform capability this domain depends on
(share-target registration, notification actions, widget APIs, SQLite/expo behavior,
etc.), spawn an agent to verify against **current official documentation** (WebSearch /
WebFetch / Context7 — not training data), citing versions. Expo moves fast; a constraint
that was true two SDK versions ago may be false now, and vice versa.

Every subagent prompt includes the hard-rules boilerplate (no worktrees; read actual code)
plus: "Write your full report to `docs/dossier/workpapers/NN-slug/<topic>.md`. Return only
a summary of ≤1 page: findings that change decisions, with file:line or doc citations."

Read summaries; open the full workpapers selectively. **Verify every load-bearing claim
yourself before building on it** (step 3's standards apply).

## 5. Derive the question set

Every candidate question must pass the **divergence test** — you must be able to state:

1. **The decision it unblocks.**
2. **What concretely diverges downstream if answered differently** — a schema changes, a
   phase boundary moves, a product promise is affected, a UX flow forks.

Triage by that test:

- **Passes, roadmap-altitude** → ask it. This includes implementation questions whose
  answer could ripple into the owner's operational or cosmetic choices — the owner wants
  to see the cracks. Operationally-vital questions are NEVER cut for count; there is no
  numeric cap. If more than 20 vital questions survive triage, tell the owner the count
  before starting so he can plan the session.
- **Passes, but structural implementation detail with no owner-visible ripple** → do not
  ask. Record under **"Deferred to phase planning"** — this is the hand-off to gsd's
  planner/researcher, where the owner wants these to land.
- **Passes, but belongs at phase level** (real question, wrong altitude — it needs
  implementation context that won't exist until that phase) → record under **"Deferred to
  phase discussion"** so `/gsd-discuss-phase` inherits it.
- **Fails the test** (no articulable divergence) → it is not a question. If it still needs
  a value, pick the obvious one and log it under **"Decisions made without you"** — the
  owner vetoes at review, cheaply.

**Organize by decision cluster, not by type.** Group questions around coherent chunks of
the domain (e.g. "the favourites grid", "the touchpoint record"). A cluster's operational
AND cosmetic questions travel together, so a cosmetic answer that forces an operational
change surfaces inside the cluster, not three rounds later. Tie-breaker: when unsure
whether a cosmetic item interlocks with a cluster, include it with the cluster — asking
early costs seconds, discovering late costs a backtrack. Only free-floating cosmetic items
that touch no cluster go in a final skippable batch ("answer now or punt to the design
pass"). Cosmetic questions that shape product feel are legitimate — taste is explicitly
the owner's bucket.

## 6. Interrogate, in rounds

Default is interactive via AskUserQuestion, batches of ≤4 questions; if the owner asks for
everything at once, dump the full set as a markdown list and take freeform answers.

Per batch:

- Label with progress: **"Round R — questions A–B of N queued"**, with the standing caveat
  that N counts questions *queued so far* and grows as answers spawn follow-ups.
- Name each question's cluster.
- Give concrete options with the investigated recommendation FIRST, labeled
  "(Recommended)". Options must be real alternatives surfaced by investigation, not
  filler. "Other" free-text always exists — when the owner signals he wants to explain,
  drop the option UI and ask as plain text (never trap freeform intent in a picker).

**After every batch, write before you think:** record the answers into
`docs/dossier/NN-slug.md` as [DECIDED] (with rationale) / [OPEN] / [REJECTED] (with why)
immediately, so a dead session loses nothing. Then re-derive: did any answer spawn
follow-ups, invalidate queued questions, or warrant another targeted subagent probe?
Update the queue and continue. This loop is the point of the skill — the custom-fields
session ran 10–15 rounds. Loop until zero operationally-vital questions remain. Then the
final skippable cosmetic batch, if any.

## 7. Wrap up

Finalize `docs/dossier/NN-slug.md` with this structure:

```markdown
# Dossier NN — `slug` — <Domain name>

## Scope                       <!-- what this domain covers, 1 para -->
## Decisions                   <!-- [DECIDED]/[OPEN]/[REJECTED], HANDOFF-style, grouped by cluster -->
## Cross-domain constraints exported   <!-- [this → other] entries -->
## Deferred to phase discussion
## Deferred to phase planning
## Decisions made without you  <!-- trivia the orchestrator picked; owner vetoes here -->
## Findings                    <!-- investigation summary; pointers into workpapers/ -->
```

Then:

1. Update INDEX.md: status → `complete` (or `in-progress` if [OPEN] items the owner chose
   to park remain — say which), and append this run's exported constraints to the
   cross-domain constraint log.
2. Show the owner the finished doc summary — decisions count, anything deferred, anything
   in "Decisions made without you".
3. Commit: `docs(dossier): interrogate NN-slug` including the domain doc, INDEX.md, and
   workpapers. In place, current branch.
4. Recommend the next pending domain.

</process>

<success_criteria>
- Plugin source for the domain read in full by the orchestrator, not summarized by proxy
- Platform constraints verified against current official docs with versions cited
- Every asked question passed the divergence test; nothing cut for count; >20 warning given
- Questions clustered by decision, operational+cosmetic together within a cluster
- Answers persisted to the domain doc after every round, not at the end
- Anything reversing a [DECIDED]/[REJECTED] item was flagged to the owner before recording
- INDEX.md status + constraint log updated; work committed in place
</success_criteria>
