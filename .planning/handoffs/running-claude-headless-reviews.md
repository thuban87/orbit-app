# Handoff: running the Claude side of a review-convergence cycle

**For:** the codex review agent driving a `gsd-plan-review-convergence` / cross-AI review session.
**Problem this solves:** you can get the **codex** reviewer to run fine, but the **Claude** reviewer
throws errors or emits nothing (empty output / 0-byte file). This is a known, solved failure. Do
exactly what's below and the Claude review will produce a real markdown review on stdout.

---

## TL;DR — the one command that works

```bash
timeout 900 claude -p \
  --model claude-opus-5 \
  --allowedTools Read Grep Glob \
  --disallowedTools Write Edit MultiEdit NotebookEdit Bash \
  < review-prompt.md \
  > /tmp/claude-review-<slug>.out \
  2> /tmp/claude-review-<slug>.err
```

- `review-prompt.md` = your review prompt (see "Prompt requirements" below).
- `<slug>` = something unique per review (e.g. the plan/phase id) so parallel runs don't clobber files.
- The **deliverable is stdout** (`.out`), not any file Claude writes. That is the whole trick.
- Run it **in the background with a long timeout** — a source-grounded review takes ~5–9 minutes.
  Do not kill it early and read "empty" as "failed" (see "Verifying" below).

---

## Why the Claude reviewer was failing

`gsd-review`'s Claude lane runs headless `claude -p` with a review prompt, in the repo directory,
with a broad tool allow-list. Given that, headless Claude decides to "complete the workflow" by
**writing files** — it tries to `Write` `STATE.md` or something under `.planning/`.

In headless `-p` mode there is **no human to approve a tool call at runtime**. So the moment Claude
reaches for a tool that isn't pre-authorized, the call is denied (or stalls) and the run dies —
frequently with **zero bytes on stdout**. It looks like "Claude is broken." It isn't. Claude is
being blocked doing something it never needed to do for a review.

The codex lane doesn't hit this because codex's review path doesn't go wandering off to write repo
state files the same way.

## The fix, and why the flags are what they are

Two changes turn it reliable:

1. **Make stdout the deliverable, not a written file.** The prompt must tell Claude to print the
   review to stdout and write nothing. Then there is no file-write step to get blocked on.

2. **Physically deny write tools on the CLI.** `--disallowedTools Write Edit MultiEdit NotebookEdit
   Bash` guarantees Claude cannot even attempt a write, so it can't stall on one. It also can't run
   Bash (which a review doesn't need and which is another approval trap).

   **This matters specifically in orbit-app:** this repo's `.claude/settings.local.json` allows
   `Write` and `Edit` **globally**. So you cannot rely on a permission gap to stop the reviewer from
   writing — you must **explicitly disallow** the write tools on the command line. `--disallowedTools`
   takes precedence over the settings allow-list, so this holds regardless of settings drift.

`--allowedTools Read Grep Glob` gives the reviewer exactly the read-only tools it needs to ground its
findings in the actual source. That combination — read-only allow + explicit write/Bash disallow +
stdout deliverable — is what was verified working on the Phase 16 convergence run.

---

## Prompt requirements (`review-prompt.md`)

The prompt content is yours, but it **must** include these instructions or the run can still misfire:

- **"Output the full review to stdout as markdown. Write NO files. Do not modify STATE.md, .planning/,
  or anything on disk."** — non-negotiable; this is what removes the write-step failure.
- **"Read the plan(s) and the actual cited source files before judging."** Point it at the plan files
  under `.planning/phases/<phase>/` and tell it to open the real code with Read/Grep/Glob — do not let
  it review the plan text in isolation. (Per repo rule: review the code, not the diff.)
- Keep the review scope and severity format identical to what you ask codex for, so the two are
  aggregatable side by side.

A fresh `claude -p` starts with **no inherited context** — it does not see the orchestrator's
conversation. That's intended (independent perspective). It means the prompt must be self-contained:
name the phase, the plan files, and where the source lives.

---

## Model

Use **`claude-opus-5`** for the **review lane** (this is what the owner directed for convergence
reviews). Valid model ids on this box: `claude-opus-5`, `claude-sonnet-5`, `claude-opus-4-8`.

Note the split, if you also drive replanning: the **review** runs on opus-5, but the **replanning**
agents (`gsd-planner` / `gsd-plan-checker`) should inherit the main-loop model — pass **no** model
override to them.

---

## Verifying it actually worked (don't misread a timeout)

After the run:

```bash
wc -c /tmp/claude-review-<slug>.out    # should be clearly non-zero (a real review is KB-sized)
cat  /tmp/claude-review-<slug>.err     # check here first if .out is empty
```

- **Non-empty `.out`** → success. Feed it into aggregation.
- **Empty `.out`** → read `.err`.
  - If `.err` mentions a blocked/denied **Write/Edit/Bash** → the disallow flags weren't applied, or
    the prompt didn't say "write no files." Fix the command/prompt, don't widen permissions.
  - If it ran a long time and just got cut off with no error → **timeout kill, not a failure.**
    Raise the `timeout` (e.g. `1200`) and re-run in the background. A grounded review over real
    source genuinely takes minutes.

---

## Do NOT do these

- **Do not "fix" this by adding `Write(.planning/*)` (or widening Write) in settings.** That's the
  wrong direction — it lets the reviewer scribble on repo state. The fix is denying writes on the
  CLI, not granting them. (Widening the write posture is also an owner decision, not a reviewer's.)
- **Do not route the Claude reviewer through `gsd-review`'s `claude` lane** to get around this — that
  lane is the thing that fails. Invoke `claude -p` directly with the command above.
- **Do not reintroduce `--dangerously-bypass-hook-trust`** anywhere (that's a codex-lane red herring;
  the current workflow bans it and flagless works).

---

## Aggregating

Run the codex reviewer as you already do (flagless — no bypass flag needed), run the Claude reviewer
with the command above, then merge both into the convergence `REVIEWS.md` yourself. Two independent
perspectives, one file.

---

### Alternative (if you're an in-session Claude agent, not a CLI-only codex agent)

If whoever is orchestrating has the Agent tool available, a **read-only Claude subagent** (spawn type
`claude`, prompt it to read plans + cited source and **return markdown, writing no files**) gets the
same independent Claude perspective without any CLI plumbing. The headless `claude -p` command above
is the path when you only have a shell.
