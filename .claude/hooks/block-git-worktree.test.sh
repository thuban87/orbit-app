#!/usr/bin/env bash
# Test harness for block-git-worktree.sh — cases live in a file so the hook,
# which inspects the Bash *command string*, doesn't match this script's own text.
HOOK="$(dirname "$0")/block-git-worktree.sh"

fail=0
chk() { # $1 = expected rc, $2 = command string
  printf '%s' "$2" | jq -Rs '{tool_input:{command:.}}' | "$HOOK" >/dev/null 2>&1
  rc=$?
  if [ "$rc" -eq "$1" ]; then status="ok  "; else status="FAIL"; fail=1; fi
  printf '%s  want=%s got=%s  <- %s\n' "$status" "$1" "$rc" "$2"
}

wt="worktree"   # assembled at runtime; keeps literal invocations out of this file

echo "=== MUST BLOCK (2) ==="
chk 2 "git $wt add ../wt br"
chk 2 "cd /tmp && git $wt add x"
chk 2 "git -C /repo $wt add /p b"
chk 2 "foo; git   $wt  prune"
chk 2 "git $wt remove ../wt"
chk 2 "x || git $wt list"
chk 2 "$(printf 'echo hi\ngit %s add ../z' "$wt")"
chk 2 "git --git-dir=/x/.git $wt add /p"

echo
echo "=== MUST ALLOW (0) ==="
chk 0 "git status"
chk 0 "git log --oneline -1"
chk 0 "git commit -m 'chore: disable git $wt usage; see hook'"
chk 0 "echo \"Bash(git $wt:*) denied\""
chk 0 "echo 'run \`git $wt\` never'"
chk 0 "grep -r $wt .claude/"
chk 0 "git branch -a"

echo
[ "$fail" -eq 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"
