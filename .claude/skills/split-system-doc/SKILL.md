---
name: split-system-doc
description: Split a bloated system doc in docs/systems/ of the orbit-app repo into two or more cohesive docs. Mechanical relocation only — no new content. Interactively confirms seam locations before any writes. Invoke when asked to split, refactor, or carve up a system doc that has grown past the readable threshold. Takes a system-doc name as the argument (e.g. "contacts", "contacts.md", or "docs/systems/contacts.md").
metadata:
  short-description: Split an oversized system doc into cohesive docs
---

# split-system-doc

Split an oversized orbit-app system doc into multiple cohesive docs by mechanically relocating sections. The skill proposes seam candidates, **interactively confirms boundaries with the user**, and then executes the split with full cross-reference bookkeeping.

This skill is harness-neutral: it uses plain verbs ("read the file", "move the section", "search for the string"). It runs the same under any agent harness.

## Scope guard — read this first

This is a **mechanical relocation operation**, not a content edit. Splitting moves sections from one file to others; it does not improve, condense, rewrite, or augment the content being moved.

**Allowed:**
1. Read the source doc, the template, all ADRs in `docs/decisions/`, `CLAUDE.md`, and `docs/systems/README.md`.
2. Move sections verbatim from the source into new docs.
3. Update cross-references on existing files (ADR `Decisions`-section references, CLAUDE.md subsystem table, README, source-doc Purpose section).
4. Add Changelog rows that record the split itself.

**Forbidden:**
- Rewording, condensing, or "improving" any section while moving it. If a section is awkward, that's a separate operation.
- Writing new gotchas, new flows, new Decisions entries, or new content of any kind.
- Inferring section assignments without user confirmation. The seam-confirmation gate (step 4) is mandatory and blocking.
- Splitting docs that are clearly cohesive (under 300 lines, or with no natural seam). If the source doesn't pass the bloat test, confirm with the user before proceeding.

The skill's promise: *every line of source content lands in exactly one destination, with nothing lost, nothing edited, and every cross-reference correctly redirected.* Anything beyond that is out of scope.

## When to invoke

The user runs `/split-system-doc <doc-name>` or asks "split contacts.md" / "carve up the custom-fields doc". Argument forms accepted: `contacts`, `contacts.md`, `docs/systems/contacts.md`.

## Inputs

- **Source doc** (the argument). Resolve to `docs/systems/<base>.md`. If it doesn't exist or is under 300 lines, ask the user to confirm before proceeding ("This doc is only N lines — are you sure you want to split it?").
- **Template** — read once at the start so new-doc structure matches:
  - `.planning/knowledgebase/templates/system-doc-template.md`
- **Routing authority** — `docs/systems/README.md`. Its 18-subsystem table defines orbit's canonical subsystem boundaries and filenames; new docs from a split should align to those boundaries and use canonical-style names.

## Commit-as-you-go (bake this into every run)

When this skill is RUN, **commit its outputs atomically as you go**:

- One commit that creates the new doc(s) + the trimmed source together (the split is one logical change; keeping them in a single commit means the tree is never in a content-losing intermediate state).
- A follow-up commit for the cross-reference updates (ADRs, CLAUDE.md, README) if you prefer to separate mechanical moves from reference bookkeeping; otherwise fold them in.
- Stage only your own files with explicit `git add <path>` — never `git add -A`/`git add .`.
- **No AI/assistant attribution or trailers in commit messages** (owner preference). Plain factual messages, e.g. `docs(kb): split contacts.md into contacts + contact-lifecycle`.
- **Never run `git worktree`, never create a branch, never `git push`.** Commit in place on the current branch; the owner pushes.

## Outputs

| Where | What |
|-------|------|
| `docs/systems/<new-doc>.md` (×N) | New system doc(s) with sections moved from source. Each gets standard system-doc frontmatter (Last updated, Updated by phase, Owners, Purpose) and a fresh Changelog starting with the split row. |
| `docs/systems/<source-doc>.md` | Trimmed source doc. Same structure, smaller. Purpose section gets a "see also" line pointing at the new docs. Changelog gets a "split off" row. |
| `docs/decisions/ADR-NNN-*.md` (touched) | ADRs whose `Decisions`-section reference pointed at the source doc get redirected to the correct new doc. Body content otherwise unchanged. |
| `CLAUDE.md` | Subsystem table gets new rows for new docs; source-doc row scope narrowed if appropriate — as shown in the approved final plan (step 5) and applied in step 8. |
| `docs/systems/README.md` | Subsystem table updated to match CLAUDE.md. |

## Workflow

### 1. Resolve and inventory the source

- Resolve the argument to `docs/systems/<base>.md`. If not found, list `docs/systems/` and ask the user.
- Read the full source doc. Capture: total line count; section structure (every `##`/`###` heading with its line range); per-section line count; tables in the doc (Configuration, Decisions, Gotchas, Key Files, Store/Service/DAO, etc.) with row counts.
- If the source is under 300 lines, ask: "This doc is N lines — splitting it may be premature. Confirm to proceed?" Wait for explicit confirmation.

### 2. Inventory cross-references

Build a map of everything that references the source doc — updated in step 8.

1. **ADR references.** Scan `docs/decisions/*.md` for the literal string `docs/systems/<base>.md` and for `<base>.md` mentions. Capture the ADR number, line, and surrounding context.
2. **CLAUDE.md.** Find the subsystem-table row for the source doc.
3. **README.** `docs/systems/README.md` — find the subsystem-table row.
4. **Other system docs.** Search `docs/systems/*.md` for `<base>.md` references in `Related Systems` sections or narrative.

### 3. Propose initial seams

Analyze the section structure and propose a split. Heuristics:

- **How It Works flows** are the strongest signal. Cluster flows by subject (data authoring vs. presentation vs. lifecycle, etc.) and propose one new doc per cluster.
- **Architecture sub-sections** (Data Model, Store/Service/DAO Layer, Key Files) split along the same lines as the flows that consume them.
- **Configuration table rows** split per-row by domain — but default to keeping the whole table together unless the user assigns specific rows.
- **Decisions section** splits per-ADR — each ADR row goes to whichever new doc covers its subject.
- **Gotchas section** splits per-gotcha.
- **Changelog stays with the source doc** as the historical record. New docs get fresh Changelogs.

Align new docs to the subsystem boundaries in `docs/systems/README.md` where they fit. Produce a written proposal:

```markdown
## Proposed split

Source: `docs/systems/<base>.md` (N lines)

### Proposed new docs

| New doc | Covers | Approx lines | Section assignments |
|---------|--------|--------------|---------------------|
| docs/systems/<base>.md (kept, slimmer) | <scope> | ~X | Sections: A, B, C; Config rows: 1-3, 7; Gotchas: 1-4, 9; Decisions: ADR-NNN, ADR-MMM |
| docs/systems/<new1>.md | <scope> | ~X | Sections: D, E; Config rows: 4-6; Gotchas: 5-8; Decisions: ADR-PPP |

### Ambiguous sections

- Section X (lines NNN-MMM) — could fit <new1> or <new2>; borderline because: ...
- Config row N — domain unclear; needs user assignment.
```

### 4. Confirm seams with the user (mandatory, blocking)

This step is **non-negotiable**. Do NOT proceed to writing without explicit user approval of the seams.

1. **Top-level structure question.** Ask: "Does this split structure work — N docs with the proposed scopes?" with the structure as preview. Options: Approve / Adjust / Cancel.
2. **For each ambiguous section** (sections, Config rows, Gotchas, ADRs without an obvious home), ask a targeted placement question; options are the candidate target docs.
3. **If the user adjusts the structure**, regenerate the proposal (step 3) and re-confirm. Iterate until explicit approval.
4. **Final gate.** After all assignments settle, ask: "Final plan ready. Approve to execute?" Options: Approve / Cancel.

If the user cancels at any point, stop. Do not write anything.

### 5. Plan output (after approval)

Restate the final plan as a written summary, including the cross-reference impact from step 2.

```markdown
## Final split plan (approved)

**Source:** docs/systems/<base>.md (N lines → ~X lines after trim)
**New docs:** <list with line estimates>
**Section assignments:** <table>
**Cross-reference updates:**
- ADRs to update (M): list
- CLAUDE.md: 1 row narrowed, K rows added
- README: 1 row narrowed, K rows added
- Other system docs with Related Systems references: list
**Changelog rows:**
- Source doc: "Split off <new docs> on <today>"
- Each new doc: "Split from <source> on <today>"
```

### 6. Execute the section moves

For each new doc:

1. Read `system-doc-template.md` to confirm structure.
2. Create the new doc with frontmatter:
   - `Last updated:` today's date
   - `Updated by phase:` `KB-restructure (split from <source>)`
   - `Owners:` carry forward only the owners (stores/services/DAOs) relevant to this doc's scope — don't drag along owners that stayed with the source.
   - `Purpose:` a 1–3 sentence purpose statement specific to this doc's scope. **This is the only original content the skill writes** — keep it minimal (state the scope, no editorializing).
3. For each assigned section: copy it verbatim from the source — heading, body, tables, code blocks, inline links. Preserve heading levels exactly (a `### Foo` under `## Architecture` stays `### Foo` under the same parent). For Configuration / Decisions / Gotchas / Key Files tables: copy the header + the assigned rows. Re-number Gotchas starting from 1 in each new doc (gotcha numbers are doc-local).
4. Add a fresh `## Changelog` with one row:

   ```
   | Date | Phase | What Changed |
   |------|-------|--------------|
   | <today> | KB-restructure | Split from `<source-base>.md`. Initial scope: <one-line summary>. |
   ```

5. Write the file.

For the source doc:

1. Remove every moved section (and only those — leave everything else untouched, including formatting, blank lines, and section ordering).
2. Re-number the source doc's Gotchas if any were removed (numbers stay contiguous).
3. In the Purpose section, append a "See also" line:

   ```
   **See also:** `docs/systems/<new1>.md` (<scope>), `docs/systems/<new2>.md` (<scope>).
   ```

4. Update the header: `Last updated:` today, `Updated by phase:` `KB-restructure (split off <new docs>)`.
5. Append a Changelog row:

   ```
   | <today> | KB-restructure | Split off `<new1>.md` (<scope>) and `<new2>.md` (<scope>) for readability. Source content moved verbatim; no behavior changes. |
   ```

6. **Content preservation check.** Before writing the trimmed source, count the section bodies that should remain. After writing, verify the source doc's line count is consistent with what was kept. If any source content can't be accounted for in either the trimmed source or the new docs, stop and report the discrepancy.

Commit the new docs + trimmed source together (see commit-as-you-go).

### 7. Update affected ADRs

For each ADR from step 2's inventory:

1. Open the ADR.
2. Find the reference to the source doc.
3. Redirect it to the correct new doc based on the section assignments. (If the ADR's subject moved, point at the new doc; if it stayed, leave it. If it spans both, reference both — add, don't replace.)
4. Edit only that reference. **Do not edit any other field.** ADR bodies are immutable; `Supersedes:` / `Superseded by:` / `Required by:` are off-limits here — those belong to `extract-phase-kb`.

### 8. Update CLAUDE.md and README

1. **CLAUDE.md subsystem table.** Narrow the source-doc row's scope if applicable; add new rows for new docs in the same column shape, placed adjacent to the source row (subsystem grouping reads better than alphabetical). Edit no other section. Apply exactly the row changes shown in the approved final plan (step 5) — they were surfaced for the owner at the seam-confirmation gate (step 4); make no CLAUDE.md change that was not in that plan.
2. **`docs/systems/README.md`.** Mirror the CLAUDE.md changes — same scope edits, same new rows.

Commit the cross-reference updates.

### 9. Cross-link integrity pass

After all writes:

1. **Decisions sections.** For each new doc, scan `docs/decisions/` for any ADR whose `Implementation > Key files` paths overlap the new doc's Key Files. Every such ADR must appear in the new doc's Decisions section. Add missing ones with a one-line summary.
2. **Source-doc Decisions sweep.** Confirm the source no longer lists ADRs whose subject moved out. Each ADR sits in exactly one system doc's Decisions section per concern.
3. **Path verification.** Confirm every file path mentioned in the new docs (Key Files, Related Systems pointers, Decisions references) actually exists on disk.
4. **No-orphan check.** Confirm every section that was in the source before the split now lives in exactly one place (source or one new doc). Nothing twice; nothing missing.

### 10. Report back

Tell the user:

- The source doc, the new docs created, line counts before/after.
- Counts: ADRs updated, CLAUDE.md/README rows added/edited.
- Any judgment call during the move (e.g. "Config row 7 fit either doc; placed in <new1> per your step-4 answer").
- Any ambiguities surfaced by the cross-link pass that warrant the owner's eye.
- Total line counts: source-before vs. source-after-plus-new-docs-summed — should match within ±5 lines (allowing Purpose lines, Changelog rows, the "see also" line).
- The commits you made (hashes + subjects), and confirmation nothing was pushed.
- Confirmation that the `CLAUDE.md` and `docs/systems/README.md` subsystem tables end consistent with each other.

## Conventions to enforce

- **Mechanical only.** No content rewrites. The Purpose section of new docs is the *only* original content, minimal (1–3 sentences).
- **Section ordering preserved.** Within each new doc, sections appear in the same order they did in the source.
- **Tables move whole by default.** Row-level splits of Configuration / Key Files / Store-Service-DAO tables only happen with explicit user assignment in step 4.
- **Decisions and Gotchas split per-row.** Each ADR row and each gotcha gets individual placement. Re-number gotchas from 1 in each destination.
- **Changelog stays with source.** New docs start fresh Changelogs with only the split row.
- **Date discipline.** Today's date on every Changelog row added during the split and on `Last updated:` headers (source and new). Phase = `KB-restructure`.
- **ADR bodies are immutable.** Only the Decisions-section cross-reference is updated.
- **Align to `docs/systems/README.md` boundaries** when naming and scoping new docs.
- **Commit-as-you-go, no AI attribution, never push, never worktree** (see the dedicated section above).

## Anti-patterns

- ❌ **Skipping the seam-confirmation gate (step 4).** Mandatory and blocking, even if the seams "seem obvious."
- ❌ **Improvising new content during the move.** No new gotchas, Decisions entries, or rewording.
- ❌ **Splitting tables at the row level without user input.** Default is whole-table moves.
- ❌ **Editing ADR bodies.** Only the Decisions-section cross-reference is fair game here.
- ❌ **Forgetting CLAUDE.md or README.** Both subsystem tables must end consistent.
- ❌ **Losing content.** The content-preservation check (step 6) is a hard gate. If lines went missing, stop and report.
- ❌ **Splitting cohesive docs.** If the source is under 300 lines or has no real conceptual seam, confirm first — a line-count-only split produces two docs that constantly cross-reference each other and are worse than one.
- ❌ `git add -A`, a branch, a worktree, a push, or an AI attribution trailer.
