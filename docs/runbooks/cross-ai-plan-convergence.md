# Runbook: Cross-AI plan-review convergence (`/gsd-plan-review-convergence`)

**Why this exists.** The convergence skill (`/gsd-plan-review-convergence N`) loops
*review → replan → re-review* using external AI CLIs until no HIGH concerns and no
actionable review findings remain (or the cycle cap is hit). Out of the box, **two of
the three reviewers we want don't "just work"** in this Claude Code environment — the
Claude lane self-skips and the codex lane has a flag trap. This runbook records the
**exact, proven-working setup** (Phase 19, 2026-08-29: drove unresolved concerns
35 → 11 → 6 → 7 → 3 → 0 across 5 cycles, all 12 HIGH resolved). Run it this way and the
three-reviewer convergence works end-to-end.

> Everything here is **local, commit-in-place, NEVER pushed** and **no git worktrees**
> (CLAUDE.md). The owner pushes.

---

## 0. The command

```
/gsd-plan-review-convergence <N> --codex --claude --cursor --max-cycles 5
```

…followed (in the same prompt) by these three overrides, which the orchestrator needs
to make the reviewers work:

- **codex** runs **without** the hook-trust bypass flag (flagless).
- **claude** reviewer = a **Sonnet 5** subagent, run **headlessly** (fresh context, no
  inheritance) — not the built-in `--claude` lane.
- **cursor** — use it even though older docs imply convergence excludes it (it's in the
  reviewer-lane roster, so the loop forwards it fine).

Prereq (one-time): `gsd config-set workflow.plan_review_convergence true`.

---

## 1. Why each reviewer needs special handling

| Reviewer | Problem out of the box | What to do instead |
|---|---|---|
| **codex** | Older gsd-review auto-added `--dangerously-bypass-hook-trust`, which the host safety classifier **blocks** (silent empty output). | Run **flagless** — current gsd-review (#2479) no longer adds it and flagless works in steady state. Never reintroduce the flag. |
| **claude** | gsd-review's `--claude` lane **self-skips** when it detects Claude Code (`CLAUDE_CODE_ENTRYPOINT` → `SELF_CLI=claude`, for reviewer independence); even when it runs, headless `claude -p` tries to Write repo state and dies with 0 bytes. | Do **not** use the built-in lane. Provide the Claude perspective as a **freshly-spawned Sonnet-5 subagent** (see §2). This is the "read-only Claude subagent" alternative from `.planning/handoffs/running-claude-headless-reviews.md`. |
| **cursor** | Legacy note said convergence errors on `--cursor`. | It's in `gsd-tools review-lane flags`, so the convergence loop derives and forwards it. Just pass `--cursor`. |

---

## 2. The review step — one Sonnet-5 subagent does all three lanes

Each cycle, spawn **one** review agent (via the Agent tool) that **is** the Claude
reviewer and also drives the two CLI lanes:

- **`model: "sonnet"`** → it's a Sonnet 5 reviewer. (Owner directed Sonnet 5 for the
  2026-08-29 run; the handoff doc's default was `claude-opus-5` — confirm per run.)
- **`subagent_type: "general-purpose"`**, fresh prompt → **no context inheritance**
  (that's the "headless" property; a spawned agent never sees the orchestrator's
  conversation).
- Its job, in order:
  1. `Skill(gsd-review, args="--phase N --codex --cursor")` — runs codex + cursor,
     appends their findings to `<phase>/N-REVIEWS.md`. **Not `--claude`.**
  2. Do its **own** independent, source-grounded review as the Claude/Sonnet-5 lane and
     append it to the same REVIEWS.md (so all three aggregate in one file).
  3. Emit the **CYCLE_SUMMARY contract** (see §4) as the last thing it returns.

**Timeouts:** codex's source-grounded review runs ~570 s. Any Bash call that wraps/waits
on gsd-review must use `timeout: 1200000` (20 min). **An empty result after a long run is
a TIMEOUT, not a crash/hook failure** — re-run with more time; never silently drop a lane.

---

## 3. The replan + internal-check steps — inherit the orchestrator model

When findings remain, the orchestrator replans **inline** (not wrapped in an Agent — so
plan-phase can spawn its own sub-agents at depth 1):

```
Skill(gsd-plan-phase, args="N --reviews --skip-research")
```

That runs `gsd-planner` (replan) and then `gsd-plan-checker` (internal quality gate,
with its own max-3 revision loop). For **both** of those subagents:

- **Pass NO `model` override** → they inherit the orchestrator model (**Opus 4.8**).
- **Do NOT pass `model: "opus"`** — the Agent tool's `opus` alias resolves to the
  *newest* Opus (Opus 5). Omitting the override is the only reliable way to pin 4.8.
- This matches the handoff doc: review lane on its own model; **replanning agents inherit
  the main loop**.

---

## 4. The CYCLE_SUMMARY contract (load-bearing)

The orchestrator decides converge/stall/replan from the review agent's **return
message**, NOT by grepping REVIEWS.md (which accumulates history and inflates counts).
The review agent MUST end its response with:

```
CYCLE_SUMMARY: current_high=<N> current_actionable=<M>

## Current HIGH Concerns
- … (or exactly "None.")

## Current Actionable Non-HIGH Concerns
- … (or exactly "None.")
```

- **`current_high`** = HIGH concerns still unresolved this cycle (all 3 reviewers,
  de-duplicated).
- **`current_actionable`** = MEDIUM/LOW findings that would be invisible to
  `/gsd-execute-phase` unless folded into a PLAN.md field or explicitly deferred/rejected
  there.
- **Exclude** anything already incorporated into plan content, and **all** advisory
  source-grounding / fact-drift findings.
- **Converged** = `current_high=0 AND current_actionable=0`.

---

## 5. Loop control the orchestrator runs

1. **Review** (§2) → parse CYCLE_SUMMARY.
2. If `0/0` → converged: mark STATE, stop.
3. Else **stall check**: if `high+actionable >= previous cycle's total`, warn (count not
   decreasing — often a fix recurring in a sibling call site; tell the replanner to
   **generalize** the fix, not patch one site).
4. **Max-cycles gate**: at `--max-cycles`, stop and **ask the owner** (proceed as-is /
   fix the residual now / stop for manual review). Don't loop past the cap.
5. Else **replan inline** (§3) → internal checker/revision → back to step 1.

---

## 6. Non-negotiable discipline

- **Verify every subagent claim against `git log`/`git show` and the files on disk**
  before trusting or reporting it — subagents have asserted commit/file states that were
  wrong. (Confirmed useful every cycle on Phase 19.)
- **Review the code, not the diff** — reviewers/checkers must read the actual source
  (esp. every writer of a shared SQLite table; the graph can't enumerate SQL writers).
- **Decision authority**: a replan revises *plans*, not recorded decisions. If a fix
  would reverse an ADR/HANDOFF/`[DECIDED]` item, the planner emits
  `## CHECKPOINT REACHED` and the orchestrator escalates — it never silently reverses.
- **Migration numbers**: never assume from memory. `ls src/db/migrations/` + read
  `TARGET_VERSION`; next free number is head+1 and drifts every schema phase. (Phase 19
  = 012; a stale prompt said 007/008 and the checker caught it.)
- **No push, no worktree, commit in place.** Each cycle commits `docs(N): …` with **no AI
  attribution / no Claude trailer**.

---

## 7. What it produces

- `<phase>/N-REVIEWS.md` — all cycles' findings from all three reviewers, aggregated
  (audit trail; grows each cycle).
- Revised `N-*-PLAN.md` files (+ ROADMAP/COVERAGE) committed per replan.
- Convergence outcome surfaced to the owner; on convergence, STATE.md updated to
  "ready to execute".

Everything stays local — **push is the owner's**.
