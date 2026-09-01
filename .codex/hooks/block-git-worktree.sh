#!/usr/bin/env bash
# PreToolUse(Bash) guard: this project disables Git worktrees.

set -uo pipefail

command=$(jq -r '.tool_input.command // empty' 2>/dev/null <<<"${1:-$(cat)}")
readonly WT_SUBCMD='add|list|remove|move|prune|lock|unlock|repair'
readonly GIT_FLAGS='([[:space:]]+-[^[:space:]]+([[:space:]]+[^-;&|[:space:]][^[:space:]]*)?)*'

if grep -Eqi "(^|[;&|])[[:space:]]*git${GIT_FLAGS}[[:space:]]+worktree[[:space:]]+(${WT_SUBCMD})([[:space:]]|$)" <<<"$command"; then
  cat >&2 <<'MSG'
BLOCKED: `git worktree` is disabled in orbit-app.

.planning/config.json sets workflow.use_worktrees=false. Work in the main checkout on
the current branch. If isolation is genuinely required, stop and ask the owner first.
MSG
  exit 2
fi

exit 0
