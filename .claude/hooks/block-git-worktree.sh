#!/usr/bin/env bash
# PreToolUse(Bash) guard: this project sets .planning/config.json workflow.use_worktrees=false.
# GSD's code-review-fix workflow does not read that key, so fixer/executor agents have
# spun up isolated worktrees on their own. Deny at the harness layer, where prose can't
# be ignored and a compound command can't slip past a permission glob.
#
# Exit 2 = block the tool call and feed stderr back to the agent.

set -uo pipefail

command=$(jq -r '.tool_input.command // empty' 2>/dev/null <<<"${1:-$(cat)}")

# Match a real `git worktree <subcommand>` invocation, not the phrase in prose.
#
#   - Anchored to a command boundary: line start, or after ; && || |
#     (grep is line-oriented, so ^ also covers embedded newlines / heredoc lines).
#   - Tolerates global flags: `git -C /path worktree add`, `git --git-dir=x worktree`.
#   - Requires a real worktree subcommand to follow, so `Bash(git worktree:*)`,
#     `` `git worktree` ``, and "git worktree" inside a commit message do NOT match.
readonly WT_SUBCMD='add|list|remove|move|prune|lock|unlock|repair'
readonly GIT_FLAGS='([[:space:]]+-[^[:space:]]+([[:space:]]+[^-;&|[:space:]][^[:space:]]*)?)*'

if grep -Eqi "(^|[;&|])[[:space:]]*git${GIT_FLAGS}[[:space:]]+worktree[[:space:]]+(${WT_SUBCMD})([[:space:]]|$)" <<<"$command"; then
  cat >&2 <<'MSG'
BLOCKED: `git worktree` is disabled in orbit-app.

.planning/config.json sets workflow.use_worktrees=false. Work in the main checkout
on the current branch. Do not create a branch + worktree and fast-forward it back —
the owner wants commits made in place, visibly.

If you believe isolation is genuinely required, stop and ask the owner first.
MSG
  exit 2
fi

exit 0
