#!/usr/bin/env bash
#
# The ONLY sanctioned way to build the knowledge graph in this repo.
#
# `$gsd-graphify build` and a bare `graphify update .` are NOT equivalent and must
# not be used — see .claude/hooks/block-graphify-build.sh, which blocks them.
#
# Why a wrapper exists at all:
#
#   graphify scatters ADR nodes (an ADR cited by N files becomes N disconnected
#   nodes instead of one shared node — see scripts/normalize-graph-docrefs.ts).
#   The scattered graph looks completely normal: same file, same node count order
#   of magnitude, no warnings. It just silently loses every code->ADR edge, so
#   agents stop being able to see which decisions govern the code they're editing.
#
#   The stock GSD build copies that scattered graph straight into .planning/graphs/.
#   This script builds, copies, and THEN normalizes the copy.
#
# Ordering is load-bearing: normalize the copy in .planning/graphs/, never
# graphify-out/graph.json. That file is graphify's incremental baseline, and the
# next `graphify update` re-extracts over it and silently undoes the merge.
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

GRAPH_DIR=".planning/graphs"
OUT_DIR="graphify-out"

echo "==> Regenerating ADR registry from docs/decisions/ADR-*.md"
npx tsx scripts/gen-adr-registry.ts

echo "==> Building graph (graphify)"
graphify update .

echo "==> Copying artifacts to ${GRAPH_DIR}/"
mkdir -p "${GRAPH_DIR}"
cp "${OUT_DIR}/graph.json" "${GRAPH_DIR}/graph.json"
cp "${OUT_DIR}/GRAPH_REPORT.md" "${GRAPH_DIR}/GRAPH_REPORT.md"

echo "==> Normalizing ADR nodes in the copy (graphify-out stays pristine)"
npx tsx scripts/normalize-graph-docrefs.ts "${GRAPH_DIR}/graph.json"

# Must run AFTER the normalizer: it targets the canonical `docref_adr_NNNN` nodes,
# which do not exist until the scattered ones are merged.
echo "==> Synthesizing code->ADR edges from ADR Implementation sections"
npx tsx scripts/synthesize-adr-edges.ts "${GRAPH_DIR}/graph.json"

# The visualization must be rendered LAST, from the NORMALIZED graph.
#
# Two traps this avoids:
#   1. `graphify update` only emits graph.html on a full rebuild, not on an
#      incremental one. Copying it conditionally (`[ -f ... ]`) silently left the
#      previous graph.html in place — you'd be looking at a stale picture with no
#      indication anything was wrong.
#   2. graphify renders the html from ITS graph, which still has the ADR nodes
#      scattered. Rendering from the normalized copy is what puts the merged ADR
#      bridge on screen.
#
# --node-limit: graphify defaults to 5000 and silently falls back to a
# community-aggregated view above that. The real cap is on file SIZE (512 MiB),
# so raising the node limit is free and keeps every node visible.
# --labels is NOT optional. `export html` defaults to looking for .graphify_labels.json
# NEXT TO the --graph file. Point it at .planning/graphs/ and it finds none, renders with
# zero community labels, and the viz comes up with an empty community list and a
# "select all" that toggles nothing. The labels live in graphify-out/ where graphify
# wrote them.
echo "==> Rendering visualization from the normalized graph"
graphify export html \
  --graph "${GRAPH_DIR}/graph.json" \
  --labels "${OUT_DIR}/.graphify_labels.json" \
  --node-limit 20000 >/dev/null
# graphify's export destination moved across versions: older builds wrote graph.html
# into OUT_DIR (cwd), current builds write it next to the --graph file (GRAPH_DIR).
# Accept either; fail loudly only if neither produced it.
if [ -f "${OUT_DIR}/graph.html" ]; then
  cp "${OUT_DIR}/graph.html" "${GRAPH_DIR}/graph.html"
elif [ ! -f "${GRAPH_DIR}/graph.html" ]; then
  echo "ERROR: graphify export produced no graph.html in ${OUT_DIR} or ${GRAPH_DIR}" >&2
  exit 1
fi

echo "==> Writing diff snapshot"
node "${HOME}/.claude/gsd-core/bin/gsd-tools.cjs" graphify build snapshot >/dev/null

echo "==> Done."
node "${HOME}/.claude/gsd-core/bin/gsd-tools.cjs" graphify status
