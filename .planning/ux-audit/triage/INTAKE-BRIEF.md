# Intake brief — UX-audit fix phases 38.9–38.12 (2026-10-10)

Shared instructions for the agents that write each fix phase's intake workpaper. The workpaper is the
`--from` input to the owner's `phase-dossier` skill (`~/.claude/skills/phase-dossier/SKILL.md`; read it
and its `references/orientation-evidence.md` and `references/method.md` so your output fits stages A–B).
Goal (owner, 2026-10-10): "walk into these planning sessions for these new phases totally prepared to
fully make the dossier relatively quickly since we have most of the info already." Owner on effort:
"Usage isn't really an issue anymore so feel free to make that as robust as it needs to be."

## Hard rules (CLAUDE.md and `.planning/DOSSIER-CONVENTIONS.md` §10; non-negotiable)
- Never use git worktrees. Never push. Never commit. The ONLY file you may write is your phase's
  workpaper path given in your task. Do not create `*-CONTEXT.md` or `*-LEDGER.md` (GSD treats a
  phase as discussed when a CONTEXT exists; the ledger belongs to the dossier session).
- Read the actual code on disk: full files, not diffs or summaries. If a change touches a shared
  table, read **every writer** of that table before stating an invariant (graphify has no
  TypeScript→SQL edges — grep the SQL strings yourself).
- Use `npm run graph:ask -- governs <file>` / `impact <N>` to find governing ADRs (it flags
  superseded ones); verify by opening the ADR. Never run graphify builds.
- **Rules carry their source** (CLAUDE.md, verbatim): "Every constraint in a plan, dossier or agent
  prompt cites its source: a `D-NN` decision, an ADR, `HANDOFF.md`, this file, a runbook, or a note
  that quotes the owner. A constraint with no source is labelled **"this plan only"**. A later
  planner never carries it forward. Planners do not copy constraints from earlier phases' plans.
  Re-derive them from the sources above. Earlier plans are history, not policy. Plan checkers and
  reviewers flag any constraint that has no source. Never put an assumption into the recommended
  option of an owner question (a device, a process, a location). The owner answers the question
  asked; anything riding along in the option text is not his decision."
- **Recommendation ≠ decision** (phase-dossier hard rule). Nothing you write is a decision. Owner
  rulings already made are quoted with their source; everything else is evidence, a DERIVED
  candidate (engineering, resolved by investigation) or a draft OPEN question (product/taste/risk).
- **Reversing a recorded decision is the owner's call** (CLAUDE.md "Whose decision is it"). For every
  fix that would delete, weaken or invert an ADR, a dossier line or a CONTEXT D-ID, name the record,
  open it, quote the part that would die, and say whether it is in that record's rejected
  alternatives. Owner ruling 2026-10-10 (39-LEDGER Batch 14, N4 "A"): these are handled in each
  phase's own dossier session — so the workpaper must list them all.
- Do not propose plan counts, plan splits or wave orders (that is `gsd-plan-phase`'s job). You may
  note natural seams as evidence.
- Do not name a specific test phone; device checks defer to `docs/runbooks/desktop-build-pipeline.md`.
- Baseline: state "verified against `main @ <hash>`" (run `git rev-parse --short HEAD`). Cite code as
  `path:line`. Label claims [CODE] (you opened it), [AUDIT] (audit says, not re-verified), [TRIAGE]
  (triage says), [INFERRED] (your reasoning).

## Inputs
- `.planning/ux-audit/FINDINGS-ASSIGNMENT.md` — your phase's finding list (its table has the report line
  of each finding), plus "touches" from other phases and the judgment calls (§7; orchestrator rulings
  are marked).
- `.planning/ux-audit/UX-AUDIT-REPORT.md` — full finding text (symptom, evidence, proposed fix or
  investigation pin); §4 cross-cutting themes with "unifying direction"; §5/§6; §7 known items.
- `.planning/ux-audit/NON-UX-FINDINGS.md`.
- `.planning/ux-audit/triage/` — slice reports (classes vs Phase 39, tags: owner-call, reversal,
  backlog, p40), slice5 (themes, standards, glossary vs lesson copy, grouping), README.
- `.planning/phases/39-onboarding/39-CONTEXT.md` and `39-LEDGER.md` Batches 10 and 13–16 — owner
  rulings from this triage, including D-94..D-102 (D-100's table: what each fix phase builds for 39).
- `.planning/ROADMAP.md` — your phase entry, Phase 39/40 entries, backlog 999.3–999.6 (owner wording),
  "Milestone-wide migration ordering" and "Decision authority" sections.
- `.planning/phases/40-responsive-release-hardening/40-CONTEXT.md`.
- Evidence screenshots/dumps under `untracked/artifacts/ux-audit/<area>/` — open when they settle a
  question. Never open the privacy screenshots: `E-add-edit-update/69-*`, `70-*`, `71-crop-screen.png`,
  `I-sharing/02-after-back-from-capture.png`.

## Owner rulings so far that apply across phases (cite these, do not re-ask)
- Four fix phases before 39; 38.9 builds shared rules/components and does mechanical app-wide
  conversions; area phases fix their own screens against them (39-LEDGER Batch 14 R1).
- Class-A items and 39's prerequisite fixes are built in the fix phases (39-CONTEXT D-100, D-101,
  D-102). Their D-IDs in 39-CONTEXT stay authoritative and bind the building phase.
- Fuel is removed from the app; each former fuel kind gets its own place on the Profile; a share goes
  to a person and a chosen section (owner examples: Amazon link → Gift Ideas; article → Last Talked
  About; joke → new "Thought of Them"); new shares get a per-item Allow AI switch, off by default
  (39-LEDGER Batch 10 and Batch 13 P1/Q3; 39-CONTEXT D-99).
- A-X01/A-X02 List-view memory and tap latency: investigate at the start of 38.11, "as robust as it
  needs to be" (Batch 14 R4).
- Phase 40 keeps the accessibility-label sweep and large-text items (Batch 14 R3).
- No installed user base yet (memory note `no-installed-base-no-legacy-repair`): flag legacy-data
  repair items and ask; do not auto-cut forward hardening. Migrations are still forward-only and
  permanent (CLAUDE.md "SQLite migrations").

## Workpaper structure (`{N}-WORKPAPER-audit-intake.md`)
1. **Header** — phase, baseline hash, how to use (`/phase-dossier {N} --from <this file>`), sources.
2. **Scope in one screen** — what the phase changes, grouped by sub-area/theme; counts; High items.
3. **Owner rulings already made** — quoted, each with source; what they bind.
4. **Finding-by-finding evidence** — for every assigned finding: id, sev, one-line symptom, [CODE]
   root cause with `path:line` (open the code), whether the audit's proposed fix is still right,
   candidate fix shapes, which shared standard it depends on, and Phase 39 link. Every Needs-
   investigation finding gets a real investigation now (that is the main value of this paper);
   if something truly cannot be settled without a device, say exactly what check is needed.
5. **Recorded decisions in play** — table: fix → record (ADR / dossier :line / CONTEXT D-ID) → part
   that dies → in its rejected alternatives? → verified [CODE/DOC].
6. **Draft owner questions** — product, taste, priority, risk/security, and reversals. Numbered, each
   with options, a recommendation and the evidence; no assumptions in the recommended option.
   Group into likely interrogation batches.
7. **DERIVED candidates** — engineering questions you resolved by investigation, with evidence.
8. **Cross-phase interfaces** — what this phase needs from earlier fix phases, what it hands to later
   ones, to Phase 39 (per D-100..D-102, lesson copy notes) and to Phase 40.
9. **Data layer** — tables touched, every writer/reader (grepped), migrations/backup-format/export
   impact, test files that pin current behaviour (grep consumers incl. `*.test.ts`).
10. **Gaps** — what the audit did not verify and what device checks the phase will need.
11. **Rules added/changed** — "none" unless you changed a standing rule (you should not).

Then return to the orchestrator a ≤250-word summary: counts, the top owner questions, every
suspected reversal, and anything that contradicts the assignment table or the roadmap entry.
