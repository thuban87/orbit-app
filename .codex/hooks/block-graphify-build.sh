#!/usr/bin/env bash
# PreToolUse(Bash) guard: raw graphify builds silently corrupt this repo's ADR graph.

set -uo pipefail

command=$(jq -r '.tool_input.command // empty' 2>/dev/null <<<"${1:-$(cat)}")

# The project wrapper builds, copies, and normalizes the graph, so it is safe.
if grep -Eq '(scripts/graph-build\.sh|npm[[:space:]]+run[[:space:]]+graph:build)' <<<"$command"; then
  exit 0
fi

readonly BOUNDARY='(^|[;&|])[[:space:]]*'
readonly RAW_BUILD="${BOUNDARY}(npx[[:space:]]+)?graphify[[:space:]]+(update|build)([[:space:]]|$)"
readonly GSD_BUILD='gsd-tools(\.cjs)?[[:space:]]+graphify[[:space:]]+build([[:space:]]|$)'
readonly ARTIFACT_COPY="${BOUNDARY}(cp|mv|install)[[:space:]][^;&|]*graphify-out/[^;&|]*\.planning/graphs"

if grep -Eq "(${RAW_BUILD}|${GSD_BUILD}|${ARTIFACT_COPY})" <<<"$command"; then
  cat >&2 <<'MSG'
BLOCKED: build the knowledge graph with `npm run graph:build`, not graphify directly.

The raw build scatters cited ADR nodes and destroys code-to-ADR edges without warning.
The sanctioned wrapper builds, copies, then normalizes the graph. Query, status, and
diff operations remain allowed.
MSG
  exit 2
fi

exit 0
