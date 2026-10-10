# UX Audit Triage — Session Prompt

> Paste everything below the line into a fresh Claude Code session in `/home/bwales/projects/orbit-app`.
> Written 2026-10-10 at the end of the Phase 39 planning session.

---

You're picking up two connected jobs for the owner of Orbit, an Android personal relationship manager (React Native / Expo, local-first SQLite, solo developer):

1. **Compare the new UX audit with Phase 39 (Onboarding), thoroughly.** Phase 39's dossier is accepted, but the owner ran a hands-on UX audit *before* planning 39, because lessons must teach stable product behaviour and the app turned out to have many rough edges.
2. **Then discuss with the owner how to enact the audit's fixes:** what the work looks like, how it groups into phases, roughly how many phases, and in what order relative to Phase 39 and Phase 40.

This is a **planning and discussion** session. Investigate read-only first. Don't change app code, don't edit `39-CONTEXT.md`, don't insert roadmap phases and don't write plans until the owner says so. If you think a file change would help (for example a findings-to-39 impact doc), say what and why, and wait for the go-ahead.

## Read first

**Project rules (yourself):**
- `CLAUDE.md` in full, especially "Answering the owner", "Whose decision is it", "Plan sizing", "Rules carry their source" and "Never push".
- The memory index (loaded automatically). Pay attention to: `phase-39-ux-audit-before-planning`, `owner-decisions-block-never-default`, `owner-decision-requests-format`, `batch-human-decisions-after-all-reviews`, `surface-held-decisions-upfront`, `fold-before-new-plan`, `organic-plan-granularity`, `phase-insert-tool-unusable-on-v2-roadmap`, `widget-overhaul-planned`, `no-absolutes-for-delegation-defaults`, `interrogation-stay-on-phase-subject`, `untracked-artifacts-folder`.

**Phase 39 (yourself; this is the comparison baseline):**
- `.planning/phases/39-onboarding/39-CONTEXT.md` — the accepted dossier and the authority. Read it in full. It has 93 decisions (D-01..D-93), a `<supersessions>` table and a "Before planning" note.
- `.planning/phases/39-onboarding/39-LEDGER.md` — read its "Resume here" block, the decision index, and the "Stage F audit" section. Dip into the batches only when you need the reasoning behind a decision.
- `.planning/phases/39-onboarding/39-WORKPAPER-mockup/onboarding-mockup.html` — the accepted look (also published at https://claude.ai/artifact/DbBZG7DfQpsQ1ow3rxuQDp). Note which real screens each lesson frame draws.
- Do **not** compare against the older workpapers in `docs/dossier/workpapers/phase-39-*`. They are history; the CONTEXT supersedes them.

**The audit (summary yourself; full findings through subagents):**
- `.planning/ux-audit/UX-AUDIT-REPORT.md` (~5,100 lines). Read the summary, the top 10, §7 "Known items seen again" and §8 "What could not be checked" yourself.
- Hand §3's 297 per-area findings, §5 quick wins and §6 needs-investigation lists to subagents.
- `untracked/artifacts/ux-audit/cross-cutting.md` — the 43 themes X-01..X-43, each with its member findings and a "unifying direction". This is the best unit for the comparison.
- `.planning/ux-audit/NON-UX-FINDINGS.md` — 7 crash and other non-UX items.
- `.planning/ux-audit/UX-AUDIT-PROMPT.md` — what the audit was told, including its exclusions: Orrery, widget, onboarding, AI calls, and known backlog 999.3–999.6.

**Roadmap context:**
- `.planning/ROADMAP.md`: the Phase 39 and Phase 40 entries, and the Backlog section (999.2–999.6).
- `.planning/phases/40-responsive-release-hardening/40-CONTEXT.md`: Phase 40 owns the device, accessibility and performance audit before beta, including "Did you send it?" lifecycle heuristics.
- `.planning/STATE.md`, the header and Session sections only.

Keep your own context lean: the owner expects this session to run long, into fix planning. Use subagents (Opus) for the bulk reading. Give each one a slice and ask for a dense written result with citations. Look at a specific finding, screenshot or file yourself when it helps you judge something, but not routinely. Subagents never push, never use git worktrees, and don't modify files unless you've given them a specific file to write.

## Job 1: Compare the audit with Phase 39

For every Phase 39 surface, work out what the audit means for it. Cover at least:
- **First run:** Welcome, Acquire, Add Contact tip, Orient and its steps (Digest, Contacts, Orrery, + button), adapted Orient, and landing after the first save. D-08..D-12, D-52, D-61, D-63, D-65, D-68, D-70, D-71, D-81, D-86..D-88.
- **Lessons:** Prepare (D-14), Reach Out (D-15), Record and the Quick Log intercept (D-16, D-34, D-53), Memory (D-23), Categories (D-24), Group Log (D-26), Notifications (D-28), Systems (D-66), History hint (D-67), AI setup and first AI Compose (D-20, D-21, D-69), and sharing (D-93, content still pinned).
- **Prerequisite fixes** already in 39: D-04/D-50/D-51/D-87 (new-contact defaults), D-75 (possible match), D-76 ("Did you send it?"), D-77 ("Not tracked").
- **Settings → Tutorials** (D-92), and the lesson presenter's look (D-80..D-85, D-89, D-32).
- **The "not taught" list** (D-25, D-27, D-29..D-31). Check whether any finding argues a "no lesson" call was really covering confusing UX (D-02).

Classify each relevant finding or theme as one of:
- **A. Must be fixed before the lesson that teaches it.** The lesson would teach unstable or broken behaviour.
- **B. Changes a Phase 39 decision.** This needs the owner. Propose a dated amendment (D-94+) and name the D-ID it changes.
- **C. Changes lesson copy, vocabulary or the mockup only.** For example the glossary themes X-36/X-37, or a header or dialog standard the lesson card should match.
- **D. Folds into an existing 39 prerequisite.** For example E-05/E-13 into D-50/D-51, H-02/H-03 into D-75, J-02/J-05/J-08 into D-76, D-09 into D-77.
- **E. No impact on 39.**

Also settle two things the dossier left open:
- **D-93, the sharing lesson.** Its content waits on the audit plus backlog 999.5. Say what the audit shows about the sharing flow, and what has to be true before a sharing lesson can be written.
- **Whether the audit's own limits matter for 39.** Area A ran on about 1,000 contacts. Four routes were not reached. Check whether any 39 trigger point sits in something unverified.

**Verify before you rely on it.** The audit's verifier checked citations at `main @ 05b85252`. Spot-check the High findings and anything that would change a 39 decision against the current code before presenting it. Agent reports have been wrong before; this project has seen misread taps, a wrong timing estimate, and a wrong "where does X render" claim.

**Present Job 1 to the owner** as a short summary:
- counts by class;
- the class B items as numbered questions, each with a recommendation;
- the class A items, which become prerequisites in Job 2.

If a written impact doc would help, propose one (for example `.planning/ux-audit/39-IMPACT.md`) and ask before writing it. Record the owner's 39 decisions as D-94+ entries in `39-LEDGER.md` and `39-CONTEXT.md` once he approves them, following `.planning/DOSSIER-CONVENTIONS.md`.

## Job 2: Discuss enacting the fixes

This is a discussion. Bring options and a recommendation; the owner decides. Topics:

- **Sequencing.** What must land before Phase 39 is planned? What can run alongside 39, or after it? What belongs in Phase 40?
  - Phase 40 owns performance, accessibility and large-text/responsive work, so performance-flavoured findings may go there.
- **Phase grouping.** Group by area changed, per CLAUDE.md "Plan sizing". Two shapes to weigh:
  - phases per product area: Contacts tab, Profile and editors, logging and history, Things to Remember, people lifecycle and import, Compose and confirmations, Settings;
  - phases per cross-cutting standard: one dialog system, one header/Back standard, one destructive-action rule, Back-with-unsaved-changes, a glossary.

  A likely answer is a mix: one early "UX standards" phase that sets the shared components and rules (and probably the ADRs for them), so the area phases follow it instead of inventing their own. Give a realistic phase count with reasons.
- **Quick wins.** 122 findings already carry a proposed fix. Should they ride inside the area phases, or go in one quick-wins pass first?
- **Needs investigation.** 175 findings are pinned. Should they get a spike or research step per area, or be resolved during each area's planning?
- **Owner calls hidden in the findings.** Some findings are product decisions, not bugs. For example F-03: should Quick Log follow the "remember last channel" preference at all? List these as owner questions instead of deciding them.
- **Recorded decisions.** The owner deliberately kept old decisions out of the audit. Fixing things will still reverse some ADRs or dossier decisions. Per CLAUDE.md, a reversal is the owner's call. Ask whether he wants the separate "decisions audit" run now, over the chosen fixes, or per phase during planning.
- **Backlog overlap.** 999.3 (Fuel editor and inline inputs), 999.5 (shared items section and reminders) and 999.6 (move entries between sections) overlap heavily with themes X-15, X-17 and the area I findings. Decide whether they become, or fold into, the new phases.
- **Non-UX findings.** Route the 7 crash and non-UX items (to a phase, todos, or now).
- **Re-verification.** Should a narrowed re-run of the audit, on the same areas, follow the fixes before Phase 39's device pass?
- **Roadmap mechanics.** New phases are inserted by hand as decimal phases (the `phase insert` tool fails on this roadmap), each with its own `.planning/phases/{N}-{slug}/` folder. The owner may want to insert them himself; ask.
- **The owner's own list.** He expected the audit to catch things he already had in mind. Ask him for that list and check which ones the audit caught and which it missed.

## How to work with the owner

- Answer questions directly and briefly. A question is not a go-ahead.
- Ask a few focused questions at a time, each with short typeable codes and a recommendation, plus "approve all". No internal IDs he wouldn't recognise.
- Name pending high-impact decisions up front instead of holding them all to the end.
- Never fill in a default for an owner decision.
- Describe UX behaviourally: what is on screen, and what happens when it's tapped.
- When he corrects you, say plainly that you got it wrong, then fix it.
- Commit only files he has agreed to, with plain messages and no AI attribution. Never push; he pushes.
- Some audit screenshots contain personal data and are listed for deletion in the report's §9. Remind him once; don't delete them yourself.
- If you add or change a standing rule (memory note, runbook rule, convention), keep working and list it at the end of that reply under **"Rules added/changed"**.

Start by reading, then give the owner a short "here's what I've read and how I'll approach Job 1" before the subagent sweep.
