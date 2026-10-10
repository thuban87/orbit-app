# Shared brief — UX audit vs Phase 39 triage (read-only)

Repo: /home/bwales/projects/orbit-app (Orbit: Android personal relationship manager, React Native/Expo, local-first SQLite). HEAD d148ed47. The audit ran at 05b85252; `git diff 05b85252..HEAD -- src` is EMPTY, so audit citations refer to current code.

## Hard rules (from CLAUDE.md, non-negotiable)
- READ-ONLY. Do not modify any repo file. The ONLY file you may write is the output file named in your task. Never run `git worktree`, never push, never commit.
- Review the code, not the summary: when you verify a claim, open the actual file at the cited lines and read enough surrounding code (and other writers/readers of the same data) to judge it. The audit's own words are claims to check, not facts.
- Rules carry their source: every constraint you cite names its source (a D-NN in 39-CONTEXT, an ADR, a dossier line, CLAUDE.md). Keep the audit's claims, the code's facts and your own inferences clearly separated and labelled.
- Do not decide owner questions. Where a finding is really a product/taste/priority decision, say so and frame it as a question with a recommendation.

## Baseline you must read first, in full
- `.planning/phases/39-onboarding/39-CONTEXT.md` (342 lines) — the accepted Phase 39 dossier, D-01..D-93. This is the comparison baseline. Pay attention to the "Trigger points" table and the mockup frame list below.
- Accepted mockup frames (`.planning/phases/39-onboarding/39-WORKPAPER-mockup/onboarding-mockup.html`): 01 Welcome · 02 Acquire choice · 03 Add Contact teaching step (Relationship Basics open: Last spoke Not yet / Bound / Monthly) · 04 Orient Digest (Up Next / Horizon Never Contacted / Your Week) · 05 Orient Contacts (swipe line) · 06 Orient Orrery · 07 Orient + button · 08 Release · A Record Quick Log intercept · B Prepare (first normal Profile visit) · C Systems tip on "Choose System" · D History hint.

## Audit sources
- `.planning/ux-audit/UX-AUDIT-REPORT.md` — area sections by line: A 202-523, B 524-747, C 748-904, D 905-1182, E 1183-1539, F 1540-1930, G 1931-2321, H 2322-2733, I 2734-2990, J 2991-3182, K 3183-3690; §4 cross-cutting 3691-4501; §5 quick wins 4502-4666; §6 needs investigation 4667-4882; §7 known items 4883-4916; §8 could-not-check 4917-5009.
- `untracked/artifacts/ux-audit/cross-cutting.md` — themes X-01..X-43 with member findings and "unifying direction".
- Evidence (screenshots/xml dumps) under `untracked/artifacts/ux-audit/<area folder>/`. Open one only when it settles a judgment. Do NOT open the privacy screenshots: E-add-edit-update/69-*, 70-*, 71-crop-screen.png, I-sharing/02-after-back-from-capture.png.
- Audit exclusions: Orrery, widget, onboarding, real AI calls, backlog 999.3–999.6 (known), the Phase 39 prerequisites (known).
- Backlog (ROADMAP.md lines 1583-1622): 999.3 inline Memory/Off Limits inputs + retire Fuel editor; 999.4 APP_NAME everywhere; 999.5 shared items get their own Things to Remember section with optional reminders; 999.6 move entries between TTR sections.
- Phase 40 (`.planning/phases/40-responsive-release-hardening/40-CONTEXT.md`) owns: large-text/landscape reflow, density, perf, gesture/GPU QA, "Did you send it?" lifecycle heuristics, reduced-motion QA, accessibility audit before beta.

## Classes (assign exactly one per finding; give the D-IDs)
- **A** Must be fixed before the Phase 39 lesson that teaches/shows it — the lesson would teach or display unstable/broken behaviour (D-02, D-03). Name the lesson/frame and D-ID.
- **B** Changes a Phase 39 decision — needs the owner. Name the D-ID it changes and propose the amendment in one line.
- **C** Changes lesson copy, vocabulary or the mockup only (e.g. a term the lesson uses is being renamed; a dialog/header standard the lesson card should match).
- **D** Folds into an existing 39 prerequisite (D-50/D-51/D-87 create defaults; D-75 possible match; D-76 Did you send it; D-77 not-contacted status).
- **E** No impact on 39.
Be strict about A: "the lesson's trigger screen has a cosmetic flaw" is usually E or C, not A. A means the taught behaviour itself is wrong/unstable, or the trigger point/flow the lesson rides on is broken.

## Also tag every finding (for fix planning later) — short tags
- fix: QW (has Proposed fix) | NI (Needs investigation) | both | none
- owner-call: Y + the question, if the finding is really a product decision
- reversal: Y + which ADR/dossier/D-ID it would likely reverse, if fixing it seems to contradict a recorded decision (grep docs/decisions/ and docs/dossier/ briefly; say "suspected" if unverified)
- backlog: 999.x if it overlaps
- p40: Y if it is really performance / large-text / accessibility-audit / lifecycle-heuristics work that Phase 40 owns
- theme: X-NN it belongs to

## Verification duty
For every High finding in your slice, and every finding you put in class A or B, open the cited code and confirm or refute the claim. Record: CONFIRMED (file:line), REFUTED (why), or UNVERIFIED (why). Previous agent reports on this project have been wrong (misread taps, wrong timings, wrong "where X renders"), so be concrete.

## Output file format (markdown)
1. Header: slice, counts by class (A/B/C/D/E), counts of each tag.
2. Table: one row per finding: `id | sev | class | D-IDs | tags | one-line why`.
3. "Class A detail": per item — what's broken, which lesson/frame, verification result with file:line, the minimal fix shape.
4. "Class B detail": per item — D-ID changed, proposed amendment text, recommendation, verification.
5. "Class C/D detail": short notes.
6. "Hidden owner calls": numbered list of product questions with a recommendation each.
7. "Suspected recorded-decision reversals": list with the decision cited.
8. "Gaps": anything in your slice's routes that a 39 trigger depends on but the audit did not verify (see §8 of the report).
Keep it dense; no padding. Then return to the orchestrator a SHORT summary (≤250 words): counts, the A and B item ids with one line each, and anything surprising.
