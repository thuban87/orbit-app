#!/usr/bin/env bash
# PreToolUse(Bash) guard: the stock graphify build silently corrupts this repo's graph.
#
# graphify scatters ADR nodes — an ADR cited by N source files becomes N disconnected
# nodes instead of one shared node, so every code->ADR edge is lost. The scattered graph
# is indistinguishable from a good one at a glance: no warning, no error, plausible node
# count. Agents then read a graph that cannot answer "which decisions govern this file",
# and nobody finds out until wrong information has been planned against.
#
# scripts/graph-build.sh builds, copies, and then normalizes the copy. It is the only
# correct path. Deny the raw commands at the harness layer, because a subagent following
# GSD's own bundled graphify skill will otherwise run them in good faith.
#
# This hook fires per Bash TOOL CALL, not per subprocess — so graph-build.sh's own
# internal `graphify update .` is invisible to it and runs fine.
#
# Exit 2 = block the tool call and feed stderr back to the agent.

set -uo pipefail

command=$(jq -r '.tool_input.command // empty' 2>/dev/null <<<"${1:-$(cat)}")

# The sanctioned wrapper is always allowed, however it is spelled.
if grep -Eq '(scripts/graph-build\.sh|npm[[:space:]]+run[[:space:]]+graph:build)' <<<"$command"; then
  exit 0
fi

# Match real invocations, not the phrase in prose — `git commit -m "graphify build ..."`
# must not trip this. Anchored to a command boundary (line start, or after ; && || |);
# grep is line-oriented, so ^ also covers embedded newlines and heredoc lines.
#
# 1. A raw graphify build/update (bare binary, npx, or via gsd-tools.cjs).
# 2. Any copy of a graph artifact into .planning/graphs/ — the actual corrupting step,
#    which is what GSD's bundled skill does after its own build.
readonly BOUNDARY='(^|[;&|])[[:space:]]*'
readonly RAW_BUILD="${BOUNDARY}(npx[[:space:]]+)?graphify[[:space:]]+(update|build)([[:space:]]|$)"
readonly GSD_BUILD='gsd-tools(\.cjs)?[[:space:]]+graphify[[:space:]]+build([[:space:]]|$)'
readonly ARTIFACT_COPY="${BOUNDARY}(cp|mv|install)[[:space:]][^;&|]*graphify-out/[^;&|]*\.planning/graphs"

if grep -Eq "(${RAW_BUILD}|${GSD_BUILD}|${ARTIFACT_COPY})" <<<"$command"; then
  cat >&2 <<'MSG'
BLOCKED: build the knowledge graph with `npm run graph:build`, not graphify directly.

The raw graphify build SILENTLY CORRUPTS the graph in this repo. graphify scatters ADR
nodes: an ADR cited by N files becomes N disconnected nodes instead of one shared node,
which destroys every code->ADR edge. Nothing warns you. The graph looks fine. Agents
then plan against a graph that cannot answer "which ADRs govern this file" or "what
else breaks if I revisit this decision" — and the damage surfaces only once wrong
information has already been written into plans.

  npm run graph:build      # builds, copies, THEN normalizes the copy

This also regenerates docs/decisions/adr-registry.ts, so new and superseded ADRs enter
the graph. See scripts/graph-build.sh and scripts/normalize-graph-docrefs.ts.

`$gsd-graphify query|status|diff` are all fine — only `build` is blocked.
MSG
  exit 2
fi

exit 0
