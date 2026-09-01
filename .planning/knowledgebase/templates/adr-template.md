# ADR-{NUMBER}: {TITLE}

**Status:** Accepted
**Date:** {YYYY-MM-DD}
**Phase:** {phase-id} (e.g., 16-custom-field-value-normalization)
**Source decisions:** {D-XX, D-YY, ...} from phase CONTEXT.md
**Reversibility:** {one-way | costly | reversible}
**Migration:** {migration number(s) this ADR ships, or "None"}
**Supersedes:** {ADR-NNN or "None"}
**Superseded by:** {ADR-NNN or "None"}

## Context

{What problem or requirement drove this decision? What was the situation before this decision was made? 2-4 sentences max. Pull from the CONTEXT.md `<domain>` section and the relevant DISCUSSION-LOG entry's setup text.}

## Decision

{What was decided, stated clearly and directly. Start with "We will..." or "The system uses..." — not "We decided to..." Pull the selected option from the DISCUSSION-LOG table and the matching D-XX entry from CONTEXT.md.}

## Alternatives Considered

{For each rejected option from the DISCUSSION-LOG table, one line:}

- **{Option name}** — {Brief description}. Rejected because {reason, inferred from context or discussion}.

## Consequences

### Positive

- {What this decision enables or simplifies}

### Negative

- {What this decision constrains or complicates}

### Risks

- {Any risks accepted — pull from PLAN threat models if available}

## Implementation

**Key files:**
- `{path/to/file}` — {what this file does for this decision}

**Depends on:** ADR-{NNN} ({brief title})
**Required by:** ADR-{NNN} ({brief title})

<!--
KEY FILES IS A MACHINE CONTRACT — NOT PROSE. Read this before writing the block.

This list is the ONLY source of the `code -> ADR` edges in the knowledge graph
(scripts/synthesize-adr-edges.ts). Get it wrong and agents cannot see which decisions
govern the code they are editing.

Cautionary tale (from the owner's OTHER project, quest-board — not orbit history):
phase 05.5.6 there deleted ADR-120's anti-tamper price floor without anyone noticing,
in part because the code→ADR edges were broken and no agent could see the decision that
governed the file. On orbit the same failure mode would let a migration or DAO edit
silently reverse a recorded custom-field invariant. Verify with `npm run audit:adr-key-files`.

REQUIRED:
- The heading is literally `**Key files:**`. Not `**Code:**`, `**Schema:**`,
  `**Migrations:**`, `**Tests:**`, `**Components:**`, or `**Deletions:**`. Quest-board's
  phase 05 invented six such sub-headings and 89 real paths went unseen for months. Group
  with prose inside the bullets if you need to; do not invent sub-headings.
- Full repo-relative paths, in backticks, using orbit's FLAT `src/` tree:
  `src/db/field-values-dao.ts`, `src/stores/theme-store.ts`. There is no `apps/mobile/`
  monorepo prefix in this repo.
- ONE path per backticked token, ONE bullet per file.

ORBIT MIGRATIONS ARE TYPESCRIPT, NOT `.sql`. Schema changes ship as application code under
`src/db/migrations/` (run via the `PRAGMA user_version` pattern), e.g.
`src/db/migrations/006-normalize-custom-values.ts`. There are no numbered `NNN_*.sql`
files to cite — never invent one.

FORBIDDEN — each of these silently breaks the graph:
- Relative shorthand. `field-values-dao.ts`, `(tabs)/settings.tsx`, `hooks/useX.ts` are
  NOT paths. Write the full path from the repo root.
- Brace shorthand. `stores/{contact,theme}-store.ts` — write two bullets.
- Comma-separated lists inside one backticked token.
- Globs. `components/**/*.tsx` claims the entire app is governed by this decision.
- Guessing a filename. Open the file. Copy the path.

A FILE DELETED BY THIS DECISION STILL BELONGS HERE. Name it. It has no graph node, so
it costs nothing, and the record of what this decision removed is the point. Do NOT
later "correct" it to whatever replaced it — see the immutability note below.
-->


---

<!--
AGENT INSTRUCTIONS:
- One ADR per decision or tightly-coupled decision cluster (2-3 D-XX entries max). **Exception:
  a legacy-reclaim ADR** (e.g. ADR-001 at phase 16) legitimately spans a whole phase's decision
  set — its `Source decisions` list may be long.
- Number globally across the project, not per-phase
- Reversibility mirrors the `**Reversibility:**` tag on each D-XX in phase CONTEXT.md
  (one-way | costly | reversible). Use the strictest value among the sourced decisions.
- Migration names the TS migration number(s) this ADR ships (e.g., "006"), or "None"
- Pull "Alternatives Considered" directly from DISCUSSION-LOG.md tables
- Pull "Decision" from the ✓-marked row + the matching D-XX in CONTEXT.md
- Pull "Implementation > Key files" from PLAN and SUMMARY key-files sections
- If a later phase modifies this decision, do NOT edit this ADR — create a new one that supersedes it
- Keep the whole thing under ~40 lines of content (excluding this comment block)
-->
