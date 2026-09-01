---
name: extract-phase-kb
description: Extract knowledge-base artifacts (ADRs, system docs, runbooks, manifest) from a completed GSD phase in the orbit-app repo. Invoke when asked to extract, generate, or backfill KB docs for a specific phase, or as part of a milestone-close KB backfill batch. Takes a phase ID (e.g. "02", "18.1", "19.1") as the argument. Orbit's canonical decision source is the phase's mapped dossier; CONTEXT/DISCUSSION-LOG and PLAN/SUMMARY/REVIEW overlay it.
metadata:
  short-description: Extract ADRs, system docs, and runbooks from a completed phase
---

# extract-phase-kb

Extract a completed phase's decisions, system changes, and process additions into the orbit-app knowledge base.

This skill is harness-neutral: it uses plain verbs ("read the file", "run the command", "search for the string"). It runs the same under any agent harness.

## Scope guard — read this first

This is a **phase-bounded extraction**. The audit-trail value of the KB depends on each phase's record reflecting what was true *at that phase*, not what's true now.

**Allowed sources:**
1. Files inside the target phase directory (`.planning/phases/<phase-dir>/`).
2. The phase's **mapped dossier** (resolved via `.planning/knowledgebase/phase-dossier-map.md`) — see step 4. Orbit's dossiers are the canonical decision record.
3. Current contents of `docs/` (so you know what already exists and can update vs. create correctly).
4. The templates in `.planning/knowledgebase/templates/`.
5. Git history scoped to the phase's commits (e.g. `git log --format='%h %ad %s' --date=short -- .planning/phases/<phase-dir>/`).

**Forbidden sources:**
- Other phase directories, and dossiers other than the mapped one(s). If phase 1 references "this will be revisited in phase 2," that's part of phase 1's record. Do not open phase 2's directory or a later dossier to "verify" or "improve" the entry.
- Prior conversation memory or training-data knowledge of how the codebase looks today if it post-dates the phase being extracted.
- Speculative content. If the phase corpus and its dossier do not say something, do not write it.

**The chronology rule:** if the phase corpus contradicts your memory of the current code, the phase corpus wins for *this* extraction. The "current code is different now" fact gets captured later, when the phase that *changed* it is extracted — as a superseding ADR + a system-doc Changelog entry. That separation is what gives the KB its audit value.

If you find yourself thinking "but I know phase X changed this," stop. That belongs in phase X's superseding ADR, not in this phase's record.

**Batched, in strict phase order.** This skill runs as part of a **milestone-close / backfill batch**, not per-phase during development. Process phases in strict ascending order (01, 02, … 18, 18.1, 18.2, 19, 19.1, 20, 21, then milestone-2 phases). Each phase reads the *committed* outputs of the phases before it — this is how supersession detection works. Never process a phase before one that precedes it, and never forward-peek.

## When to invoke

The user runs `/extract-phase-kb <phase-id>` or asks "extract the KB for phase 2" / "backfill ADRs from phase 18.1". Argument forms accepted: `2`, `02`, `18.1`, `19.1`.

## Inputs

- **Phase ID** (the argument). Resolve to the directory under `.planning/phases/` whose name starts with that ID followed by a hyphen. Orbit uses sub-phase IDs (`18.1`, `18.2`, `19.1`) — match the exact ID prefix, not just the integer. If multiple match, ask the user which one.
- **Phase → dossier map:** read `.planning/knowledgebase/phase-dossier-map.md` to resolve this phase's authoritative decision source(s) and tier. This is the single lookup that tells you where the phase's `[DECIDED]` items live.
- **Subsystem routing table:** read `docs/systems/README.md`. Its table is the routing authority — it maps each of orbit's 18 subsystems to the owning `src/` code (DAOs in `src/db/` and services in `src/services/`, not stores). Route a phase's changes to a system doc by the owning code that shares a table.
- **Templates**: read all of these *before* generating anything so the output structure matches:
  - `.planning/knowledgebase/templates/adr-template.md` (has orbit's `Reversibility:` and `Migration:` fields)
  - `.planning/knowledgebase/templates/system-doc-template.md`
  - `.planning/knowledgebase/templates/runbook-template.md`
  - `.planning/knowledgebase/templates/phase-kb-manifest-template.md`

## Outputs

| Where | What |
|-------|------|
| `docs/decisions/ADR-NNN-<slug>.md` | One ADR per decision (or tight cluster). Numbered globally — find the next available number by listing `docs/decisions/`. (Special case: legacy ADR reclaim — see step 6.) |
| `docs/systems/<name>.md` | New system docs for newly-introduced subsystems. *Updates* (with new Changelog entries) for systems the phase modified. Use the canonical filenames in `docs/systems/README.md`. |
| `docs/runbooks/<name>.md` | New runbooks for newly-introduced repeatable processes. Updates for processes the phase modified. |
| `docs/decisions/_archive/ADR-NNN-<slug>.md` | Only during a legacy-ADR reclaim (step 6) — the pre-KB original ADR body, preserved before its number is reclaimed. |
| `.planning/phases/<phase-dir>/<phase-id>-KB-MANIFEST.md` | The audit trail tying this run to its outputs. |
| `CLAUDE.md` | Index entries added / edited / removed for new, renamed, or retired system docs and runbooks — **only as approved in the step-5 plan's *Planned CLAUDE.md changes* table** (see step 13). |
| Existing ADR files | Touched *only* to flip a `Superseded by:` or append a `Required by:` field. Body content is never edited retroactively (legacy reclaim in step 6 is the sole, documented exception). |

## Commit-as-you-go (bake this into every run)

When this skill is RUN, **commit its outputs atomically as you go** — do not batch everything into one commit at the end:

- One logical commit per ADR (or per tight ADR cluster that is genuinely one decision).
- One commit per system-doc or runbook create/update.
- A final commit for the manifest + regenerated derived artifacts (INDEX, registry, graph).
- Stage only your own files with an explicit `git add <path>` — never `git add -A`/`git add .`. The working tree may hold unrelated in-flight work.
- **No AI/assistant attribution or trailers in commit messages** (owner preference; co-authored-by is off). Write plain, factual messages, e.g. `docs(kb): ADR-004 photo relative-path storage (phase 05)`.
- **Never run `git worktree`, never create a branch, never `git push`.** Commit in place on the current branch. Report what is ready to push; the owner pushes.

## Workflow

### 1. Resolve the phase

- List `.planning/phases/` and find the directory matching the phase ID prefix (exact-ID match, including sub-phase suffix).
- Read the full directory listing so you know what artifacts exist.
- Capture the **phase ship date** with: `git log --format='%ad' --date=short --reverse -- .planning/phases/<phase-dir>/ | head -1` (date of the first commit that touched the phase dir). Fall back to the latest commit on `<phase-dir>/<phase-id>-*-SUMMARY.md` if that's empty. This date is used in ADR `Date:` fields and system-doc Changelog rows. Today's date is used only on the manifest's `Processed:` line.

### 2. Idempotency check

- If `<phase-id>-KB-MANIFEST.md` already exists in the phase directory, read it and ask the user:
  - **Re-extract from scratch** (overwrite — confirm before this happens),
  - **Update** (incremental — only process items not in the existing manifest), or
  - **Abort**.
- If no manifest exists, proceed.

### 3. Inventory existing KB (mandatory pre-flight)

Before reading the phase corpus, build an explicit inventory of what's already in the KB. This makes UPDATE-vs-CREATE decisions correct and enables supersession detection.

1. **ADR inventory.** Read `docs/decisions/INDEX.md` if it exists — a GENERATED lookup table (`npm run gen:adr-index`), derived from the ADR bodies. Read it, never edit it; if a row looks wrong, the ADR wins. Capture: number, title, status, phase, supersedes, superseded by, reversibility, migration, subsystems. **INDEX.md may not exist yet** (it is generated on the first real extraction) — if it is missing or looks stale (its newest entry predates the newest ADR file), fall back to listing `docs/decisions/` and reading each `ADR-*.md`'s header fields. Flag the missing/stale condition in the report-back step.
2. **System-doc inventory.** List `docs/systems/`. For each non-README doc, read the `Purpose` section + the `Owners` line + the `Key Files` paths. Capture a one-line scope per doc.
3. **Runbook inventory.** List `docs/runbooks/`. For each doc, read the `Overview` section. Capture the process it covers.
4. **Legacy-ADR check.** Orbit shipped three agent-authored ADRs before this machinery existed: `ADR-001` (custom-field value normalization, reclaimed at phase 16), `ADR-002` (hybrid two-picker contact import, reclaimed at phase 19.1), `ADR-003` (read-contacts on API 37 for reconcile, reclaimed at phase 20). If the phase you are extracting is one of those reclaim points, follow the legacy-ADR reclaim special case in step 6 instead of assigning a fresh number.

The inventory output is internal — reference it in step 5's plan.

### 4. Resolve the decision source, then read the phase corpus

**Decision-source resolver (orbit-specific — the biggest departure from a generic extractor).** Orbit's canonical decision record is the **dossier**, not CONTEXT. Look this phase up in `.planning/knowledgebase/phase-dossier-map.md` and apply this precedence:

1. **Mapped dossier** — if the map names a dossier for this phase, that dossier is the **primary** source for `[DECIDED]` items and "Alternatives Considered". Milestone-1 dossiers live at `docs/dossier/*.md` and are **domain-numbered, not phase-numbered** (e.g. dossier `07-photos` → phase 05, `04-log` → phase 06, `03-fuel` → phase 07, `09-orrery` → phase 13). Milestone-2 dossiers live at `docs/dossier/milestone-2/phase-NN-<slug>-dossier.md` and are phase-numbered. The split phases 18/18.1/18.2 share one dossier; 19.1 shares phase 19's dossier. **Never map any phase to the cut `05-import` dossier.**
2. **CONTEXT `D-XX` + DISCUSSION-LOG** — only phases **16, 17, 19.1** have genuine `D-NN` decision IDs plus a sibling `*-DISCUSSION-LOG.md`. For these, the `D-NN` entries and the DISCUSSION-LOG decision tables are a first-class source (for 17 and 19.1, overlaid on the dossier; 16 has no dossier). Requirement-style IDs elsewhere (`FND-`, `DATA-`, `FLD-`, `CRUD-`, `CMP-`) are **not** decision IDs — those phases are prose CONTEXT.
3. **Prose CONTEXT** — a substantial `CONTEXT.md` with no `D-NN` IDs and no DISCUSSION-LOG. Treat its prose as authoritative where there is no dossier (phases 01 and 09 have no dossier by design).

Special cases from the map you must honor:
- Phases **05, 06, 07** have **no CONTEXT.md at all** — the dossier is the sole source.
- Phases **01** and **09** have **no dossier** — CONTEXT prose is authoritative.
- Phase **16** has **no dossier** — its authority is `context-dxx` (migration 006 / ADR-001).

**Always overlay the phase-directory artifacts for implementation, deviations, and owner-resolutions**, regardless of which tier supplied the decision. Read, in order:

1. The mapped dossier (per resolver above) — **primary decision source.**
2. `<phase-id>-CONTEXT.md` — `D-XX` entries where present (16/17/19.1); otherwise prose context. Carries each decision's **`Reversibility:`** tag (one-way | costly | reversible) for the ADR field.
3. `<phase-id>-DISCUSSION-LOG.md` (16/17/19.1) — decision tables with options considered and the chosen option. **Pulls "Alternatives Considered".**
4. `<phase-id>-RESEARCH.md` — technical context for why options were on the table.
5. `<phase-id>-PATTERNS.md` (if present) — existing code patterns that informed the implementation.
6. `<phase-id>-NN-PLAN.md` files — what was built. Source of ADR "Implementation > Key files" and system-doc updates.
7. `<phase-id>-NN-SUMMARY.md` files — what actually shipped (may differ from plan). Source of *deviations* and *gotchas*.
8. `<phase-id>-VERIFICATION.md` (if present) — what was confirmed working.
9. `<phase-id>-REVIEW.md` / `REVIEWS.md` / `REVIEW-FIX.md` (if present) — issues found and resolved, and **owner-resolutions**. These are ADR-grade: e.g. phase 16's `D-06a`/`D-06b` "owner resolution, cycle-N review" entries settle the decision and must be captured, not treated as mere review notes. Also a source of gotchas.
10. `<phase-id>-UAT.md` / `HUMAN-UAT.md` / `*-UAT-FINDINGS.md` (if present) — known UX edge cases.
11. `<phase-id>-SECURITY.md` (if present) — threat model + mitigations. Cite in relevant ADRs.
12. `<phase-id>-UI-SPEC.md` (if present) — UI contract for system-doc UI sections.
13. `ADDENDUM.md` / `SEED.md` / `*-ROOTCAUSE.md` / similar one-offs — read these too.

When the dossier and a later phase-directory artifact conflict on what shipped, the **artifact (PLAN/SUMMARY/REVIEW) wins for implementation facts**; the dossier still governs the *decision and its rationale*. Note any such deviation in the ADR's Consequences and the system doc's Gotchas.

### 5. Plan the extraction (DO NOT WRITE YET)

Produce a written plan and present it before writing any files. The plan **must** use the tables below — classifying every output as CREATE or UPDATE, and listing supersession candidates. This is the gate that makes delta handling correct.

```markdown
## Planned ADRs (always CREATE, except legacy reclaim)

| Proposed # | Title | Decision source | Reversibility | Migration | Supersedes existing? |
|------------|-------|-----------------|---------------|-----------|----------------------|
| ADR-NNN | ... | dossier <name> §X / D-XX | one-way | 007 | None / ADR-NNN |

## Planned system-doc actions

| File | Mode | Sections affected | Reason |
|------|------|-------------------|--------|
| docs/systems/photos.md | CREATE | full doc | First phase to introduce this subsystem |
| docs/systems/contacts.md | UPDATE | Data Model (+col X), How It Works (flow Y), Gotchas (+#N), Decisions (+ADR-NNN), Changelog (+row) | Phase touches contacts-dao and adds column X |

## Planned runbook actions

| File | Mode | Sections affected | Reason |
|------|------|-------------------|--------|

## ADRs requiring "Superseded by:" updates on existing files

| Existing ADR | Will be superseded by | Reason |
|--------------|----------------------|--------|
| ADR-NNN (existing) | ADR-NNN (new, this plan) | Phase X reverses or replaces the original decision |

## Legacy-ADR reclaim (only at phases 16 / 19.1 / 20)

| Reclaimed # | Original title | New title | Archive path |
|-------------|----------------|-----------|--------------|

## Planned CLAUDE.md changes  (write `_None._` if empty)

| Change | Section / row | Reason |
|--------|---------------|--------|
| ADD | Knowledge-base index: row for `docs/systems/<new>.md` (or a new runbook) | new system doc / runbook created this run |
| EDIT / REMOVE | the exact existing row/line | doc renamed, split, or retired this run |

## Deferred / not captured

- {item} — {reason}
```

**Rules for the plan:**
- Every existing system doc / runbook touched by this phase must appear with mode = UPDATE. Never CREATE on top of an existing doc.
- Mode = CREATE is only for genuinely new subsystems / processes — confirm against the inventory from step 3 and the routing table in `docs/systems/README.md`.
- The supersession table is **mandatory** even when empty (write `_None._`). It forces a conscious check.
- If a planned ADR's source decisions overlap or contradict an existing ADR's content, that existing ADR belongs in the supersession table.
- **Reversibility** on each planned ADR = the strictest value among its sourced decisions' `Reversibility:` tags (one-way > costly > reversible). **Migration** = the TS migration number(s) the phase ships (orbit migrations are TypeScript under `src/db/migrations/`, run via `PRAGMA user_version`; there are no `.sql` files), or "None".
- **CLAUDE.md changes are part of this plan, never a silent side effect.** Every row this run will add, remove, or edit in `CLAUDE.md` (index entries for new/renamed/split/retired system docs and runbooks) must appear in the *Planned CLAUDE.md changes* table above, so the owner sees and approves them in this review. Step 13 applies exactly what is approved here — nothing that was not in this table.

Wait for approval (or edits to the plan) before continuing.

### 6. Generate ADRs

For each approved ADR:

- **Number:** find the next ADR number by listing `docs/decisions/` and taking max + 1. Pad to 3 digits (`ADR-004`, `ADR-042`).
- Read `adr-template.md` and fill in every `{placeholder}`, including orbit's `Reversibility:` and `Migration:` fields.
- "Decision" states the chosen option — start with "We will…" or "The system uses…". Pull from the dossier's decision and, where present, the ✓-marked DISCUSSION-LOG row + matching `D-XX`.
- "Alternatives Considered" pulls every rejected option (from the dossier's alternatives and/or the DISCUSSION-LOG table) — one bullet each with the rejection reason.
- "Implementation > Key files" pulls from PLAN/SUMMARY key-files sections. **Full repo-relative paths in orbit's flat `src/` tree** (`src/db/field-values-dao.ts`), one path per backticked token, one bullet per file. No monorepo prefix, no globs, no invented filenames — open the file and copy the path. A file **deleted** by this decision still belongs here. See the machine-contract comment in `adr-template.md`.
- "Consequences > Risks" pulls from PLAN threat models / SECURITY.md if present.
- Status: `Accepted`. **Date: phase ship date** (step 1, not today). Phase: full phase ID. Source decisions: the dossier section / `D-XX` IDs. Reversibility + Migration per step 5.
- If this ADR is in the supersession table, set `Supersedes: ADR-NNN (<title>)`.
- Write to `docs/decisions/ADR-NNN-<slug>.md` (kebab-case slug from the title). **Then commit it** (commit-as-you-go).

**Legacy-ADR reclaim — documented special case (only at the reclaim phases).** Orbit's `ADR-001`, `ADR-002`, `ADR-003` were authored by agents before this machinery existed; their numbers are cited in `CLAUDE.md`, `HANDOFF.md`, and phase artifacts, so the numbers must not dangle. When extracting the reclaim phase for one of them (ADR-001 at phase **16**, ADR-002 at phase **19.1**, ADR-003 at phase **20**):

1. Read the existing `docs/decisions/ADR-00N-*.md` as **reference material only** for what it covered.
2. Copy the original file verbatim to `docs/decisions/_archive/` (create the dir if needed) — this preserves the pre-KB body.
3. Regenerate the ADR **in place at the same number** from the phase corpus + dossier using the current template (with Reversibility + Migration + a proper `Key files:` block). Overwrite the original path.
4. This is the **only** case where an existing ADR body is rewritten. Record the reclaim in the manifest's legacy-reclaim note and commit it as its own commit.

Note (informational, do not act beyond your phase): `ADR-003` partially supersedes `ADR-002`. Handle each ADR only when you reach its own reclaim phase — do not forward-touch.

### 7. Update existing ADRs (supersession)

For each row in the plan's supersession table:

- Open the existing ADR file.
- Edit *only* the `Superseded by:` field — flip it to the new ADR's number + title. Use `ADR-NNN` for full supersession or `ADR-NNN (partial)` when part of the original stands.
- Do **not** edit any other field or rewrite the body. The original ADR's content is the historical record.

### 8. Update / create system docs

Route by the owning code in `docs/systems/README.md`. For each subsystem the phase touched:

**Update mode:**
- Read the existing doc.
- Rewrite affected body sections in **present tense** to reflect the new state. (If the schema gained a `parent_id` column, the Data Model section describes the table *with* that column inline — not "phase X added parent_id".)
- Append new gotchas to the Gotchas section.
- Add new ADRs to the Decisions section, *and* re-scan all `docs/decisions/ADR-*.md` for any whose `Implementation > Key files` paths overlap this doc's Key Files — every such ADR should be cross-linked here, even if written in a previous extraction (bidirectional cross-link integrity).
- Add a Changelog row — date = phase ship date, phase ID, brief description.
- Update the `Last updated:` and `Updated by phase:` header lines.

**Create mode:**
- Read `system-doc-template.md` and fill it from the phase artifacts + dossier.
- Use the canonical filename from `docs/systems/README.md` for the matching subsystem boundary. Confirm/refine the "Owning code" file set against the real code on disk while authoring (per "review the code, not the diff") and note any correction.
- Cross-link every ADR generated this run that references files in this system.

**Both modes:**
- Present tense in the body; phase-attribution lives in the Changelog only.
- **Gotcha promotion rule:** a bug fixed *within the same phase* is a "this used to bite, here's the fix" entry (past tense, fix noted). A bug still open is a "this still bites" entry (present tense, workaround if any). Don't write fixed bugs as active or open bugs as fixed.
- **Cross-cutting work spans multiple docs.** If a phase touches more than one subsystem, each affected doc gets its own UPDATE row and its own scope-relevant body changes. Do **not** consolidate cross-cutting work into one doc "for cohesion" — let the cross-cutting nature show as the same ADR appearing in multiple docs' Decisions sections. `docs/systems/README.md` is authoritative for routing; route by the owning code that shares a table when scope is ambiguous. (Note the README's open routing question for phase 21 "reach out" — decide its home when you extract phase 21, per the code on disk.)
- **Bloat watch:** if an update pushes a doc past ~300 lines, flag it in the report-back step and recommend a split — don't split unilaterally. The `split-system-doc` skill handles structural splits when the owner decides.
- **Commit** each system-doc create/update as its own commit.

### 9. Update / create runbooks

For each repeatable process the phase introduced or changed:

**Update mode:** update the Architecture header's phase reference; append to Pitfalls if new ones surfaced; update the Smoke Test if commands/outputs changed; update file-path tables if files moved.

**Create mode:** read `runbook-template.md` and fill it. The "How to" section must be **copy-paste ready** — exact paths, exact code blocks. Good orbit runbook candidates: adding a TS SQLite migration (`PRAGMA user_version`), adding a theme profile/token, adding a custom-field type + parser, adding an orrery visual layer.

Commit each runbook create/update. (Orbit has no `.planning/design/images/` migration-candidate directory — do not look for one.)

### 10. Generate the phase KB manifest

Read `phase-kb-manifest-template.md` and produce `<phase-id>-KB-MANIFEST.md` in the phase directory. Keep it short. Include:

- `Processed:` = today's date.
- `Source docs consumed:` = count + list (include the mapped dossier).
- Tables matching the template (ADRs Produced, System Docs Updated/Created, Runbooks Updated/Created, **ADRs Superseded** — add even if `_None._`).
- A **legacy-reclaim note** if this phase reclaimed ADR-001/002/003 (which number, archive path).
- "Deferred / Not Captured" — prevents the next agent from re-processing skipped items.

### 11. Cross-link integrity pass

After all writes:

1. **ADR `Required by:` updates.** For every new ADR that cites an existing ADR in `Depends on:`, open the cited ADR and append the new ADR number to its `Required by:` field (that field only).
2. **System-doc Decisions completeness.** For every system doc touched this run, gather every ADR whose subsystem maps to that doc — from `docs/decisions/INDEX.md` (filter by the Subsystems column) if it exists, plus this run's new ADRs. **Fallback if INDEX.md is missing:** scan `ADR-*.md` for `Key files:` path overlaps with the doc's Key Files. Every ADR in the set must appear in the doc's Decisions section; add missing ones with a one-line summary.
3. **Manifest cross-check.** Confirm every ADR / system doc / runbook listed in the manifest exists at the claimed path, and every supersession has its `Superseded by:` flip.

### 12. Verify the ADRs, then regenerate the derived artifacts

**Do NOT hand-edit `docs/decisions/INDEX.md` or `docs/decisions/adr-registry.ts` — both are GENERATED.** The ADR **bodies** are the source of truth. Run these in order and fix anything they report:

```bash
npm run check:adr-key-files    # GATE — must pass before you finish
npm run gen:adr-index          # regenerates docs/decisions/INDEX.md
npm run graph:build            # regenerates the ADR registry + knowledge graph (via scripts/graph-build.sh)
```

- **`check:adr-key-files` is the gate.** It fails if a touched ADR has no `## Implementation` section naming a real file, uses an invented sub-heading instead of `**Key files:**`, uses relative shorthand, or uses a glob. Every ADR's `Key files:` block is the ONLY source of the `code → ADR` edges in the graph — a broken block is how a recorded invariant gets reversed unnoticed. If it fails, fix the ADR — do not skip the gate. (`npm run audit:adr-key-files` gives a fuller report; `npm run fix-adr-key-files` exists but review its edits.)
- **Never build the graph any other way.** Use `npm run graph:build` — never raw `graphify`, `graphify update`, `$gsd-graphify build`, or copying `graphify-out/` into `.planning/graphs/`. The raw build silently scatters ADR nodes and destroys code→ADR edges; the wrapper builds, copies, normalizes, and synthesizes edges in the load-bearing order.
- **Supersession** in the ADR body is what the index and graph read — a supersession you fail to record is a retired decision that still looks live.
- Commit the regenerated INDEX/registry/graph artifacts with the manifest.

### 13. Update CLAUDE.md (per the approved plan)

Apply exactly the CLAUDE.md changes approved in step 5's *Planned CLAUDE.md changes* table — no more, no less:
- Add index rows for brand-new system docs / runbooks created this run.
- Edit or remove rows for docs renamed, split, or retired this run.

Touch only those index rows/entries; leave every other row and section of `CLAUDE.md` untouched. **Never make a CLAUDE.md edit that did not appear in the approved step-5 plan** — if a needed change surfaces mid-write, add it to the plan and re-confirm with the owner rather than editing silently. Then commit `CLAUDE.md` (commit-as-you-go).

### 14. Report back

Tell the user:

- The phase processed and where the manifest lives; the decision-source tier used (dossier / context-dxx / context-prose) and which dossier.
- Counts: ADRs created, ADRs reclaimed (legacy), ADRs superseded, system docs updated/created, runbooks updated/created.
- Derived-artifact results: `check:adr-key-files` pass/fail, INDEX row delta, graph build result, supersession flips applied.
- Any system doc that crossed ~300 lines and needs a split decision.
- Anything deferred and why; anything ambiguous in the sources to sanity-check.
- The commits you made (hashes + subjects), and confirmation nothing was pushed.
- If this phase's ADR count is suspiciously high (≥7 in a non-foundation phase), call it out — many may belong as consequences of existing ADRs.
- If INDEX.md was missing or stale, surface it.

## Conventions to enforce

- **ADR slug = kebab-case from title.** No spaces, no underscores. Strip leading articles.
- **ADR numbers are global**, not per-phase. Check `docs/decisions/` for the current max before assigning (legacy reclaim keeps the original number).
- **Date discipline.** ADR `Date:` = phase ship date. System-doc Changelog row date + `Last updated:` = phase ship date. Manifest `Processed:` = today. Never put today's date on an ADR or Changelog row.
- **System docs use present tense.** Past tense leaks phase-attribution into the body — that belongs in the Changelog.
- **Don't duplicate decision content** between an ADR and a system doc — the doc references the ADR by number with a one-line summary.
- **Don't generate filler.** If a template section has no source material, write `_None._` or omit it — never invent content.
- **Don't edit existing ADRs except** `Superseded by:` / `Required by:` (and the documented legacy reclaim).
- **Bidirectional cross-links.** A system-doc Decisions section lists every ADR citing its Key Files; an ADR's `Required by:` lists every later ADR that cites it in `Depends on:`. Step 11 enforces this.
- **Orbit is local-first on-device SQLite.** No backend, no RPC, no Supabase — logic that would live in a DB function lives in TypeScript. Migrations are TS under `src/db/migrations/`. Never introduce a network dependency into a read path when describing a system.
- **Commit-as-you-go, no AI attribution, never push, never worktree** (see the dedicated section above).

## Anti-patterns

- ❌ **Pulling from later phases or unmapped dossiers.** See Scope Guard. Only the mapped dossier(s) and this phase's directory.
- ❌ **Treating a requirement ID as a decision ID.** `FND-`, `DATA-`, `FLD-`, `CRUD-`, `CMP-` are requirements, not `D-NN` decisions. Only phases 16/17/19.1 have real `D-NN` + DISCUSSION-LOG.
- ❌ **Mapping a phase to the cut `05-import` dossier**, or assuming dossier number == phase number (M1 dossiers are domain-numbered).
- ❌ **Today's date on an ADR.** ADRs are dated when the phase shipped.
- ❌ Generating one ADR per decision ID. Cluster tightly-related decisions (2–3) into one ADR when they're one architectural choice.
- ❌ Generating an ADR for an ambient project-wide convention ("we use Zustand", "we use theme tokens"). Those live in `CLAUDE.md`, not ADRs.
- ❌ Writing a system doc by summarizing the phase plan. The doc describes the system *as it exists now*; the Changelog carries phase-attribution.
- ❌ Skipping the plan gate (step 5) and writing files directly. Always show the plan first.
- ❌ Creating a new system doc when an existing one fits. Default to update.
- ❌ Editing an existing ADR's body (outside the documented legacy reclaim). Only `Superseded by:` / `Required by:` are mutable.
- ❌ Writing fixed bugs as active gotchas, or open bugs as fixed. The Gotcha promotion rule governs.
- ❌ Skipping the supersession table because "nothing is superseded". Write `_None._` explicitly.
- ❌ Building the graph with raw `graphify` or committing everything in one lump at the end. Use `npm run graph:build`; commit atomically.
- ❌ `git add -A`, a branch, a worktree, a push, or an AI attribution trailer.
