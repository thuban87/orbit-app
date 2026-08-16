# Handoff — after Phase 8 (start Phase 9 in a FRESH session)

**Phase 8 (Dashboard & Never-Contacted Screen): COMPLETE & VERIFIED (2026-08-16).**
- 10/10 plans executed; cross-AI plan convergence (3 cycles, codex + claude, 12 findings resolved);
  code review (0 HIGH; 1 MEDIUM + 5 LOW — all fixed); 666/666 unit tests + tsc + check:colors green;
  on-device Pixel UAT passed (render + nav + favourite write, no crashes). `08-VERIFICATION.md` = passed.
- Owner-approved during the phase: a **Settings gear** on the dashboard header (reachability fix); the
  **`react-native-reorderable-list@0.18.1`** dependency for drag-reorder; search relocated to the dashboard
  (standalone Settings FuelSearch retired).

## ⚠ NOT pushed — owner action
All Phase 8 work is committed **locally on `main`** and was **never pushed** (project rule). The owner
pushes when ready.

## Next: Phase 9 — Compose Screen & SMS Handoff
Start it in a **fresh session** (this one was stopped for context-rot). Requirements CMP-01/02/03 —
the in-app compose surface (fuel visible → Send to SMS / Copy), reachable from the profile, reused later
by notifications (11), the widget (12), and AI Suggest (14). It is a cross-phase-shared surface
(ROADMAP "The compose screen is one surface, built once").

Resume command (same flags the owner used, adjust the range as desired):
```
/gsd-autonomous --from 9 --to 9 --converge --claude --codex --claude --max-cycles 3
```

## Operating reminders for the next session (learned this run)
- **`--codex`/`--claude` override applies ONLY to the pre-execution PLAN convergence** (2 reviewers for
  `--converge`). Do NOT run codex on the post-execution code-review gate — that's a single Claude reviewer.
- **Answer the owner's questions; do NOT act off them** unless told to (see memory `answer-questions-dont-act`).
- **`claude -p` plan reviewer is broken here** (Write-permission gap) — use a read-only Claude subagent +
  codex CLI, aggregate manually (memory `claude-reviewer-via-subagent`).
- **On-device build** = the `docs/runbooks/desktop-build-pipeline.md` procedure (tar-over-ssh → `droid` →
  `npm ci` + `expo prebuild --clean` + `gradlew assembleRelease` → scp APK → `adb install` on Pixel
  `1A071FDEE002BU`). A **native-dep change requires the full prebuild+release build**; JS-only changes can
  use the debug+Metro loop.
- Worktrees OFF; agents never push; colours via theme tokens only.
