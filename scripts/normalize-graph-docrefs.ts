#!/usr/bin/env tsx
/**
 * Graph post-processor — merges graphify's scattered ADR nodes into one node per ADR.
 *
 * WHY THIS EXISTS
 *
 * graphify's `_disambiguate_colliding_node_ids` (extractors/resolution.py) salts
 * same-id nodes apart by source path whenever an id appears in 2+ files. It exempts
 * `type: module|namespace` nodes, because — in its own words — `import CoreKit` from
 * three files is "the *same* module, not distinct same-named symbols, so they must
 * collapse to one shared node".
 *
 * Doc-refs are that identical case: an ADR cited by five files is ONE document. But
 * _add_doc_ref tags them `file_type: doc_ref` and never sets `type`, so they miss the
 * exemption and scatter. Measured elsewhere: an ADR cited by 1 file gets 1 shared
 * node; an ADR cited by N files gets N private nodes and no shared one — so merging
 * fails precisely where it matters. An ADR cited by 18 files became 18 disconnected
 * nodes.
 *
 * Re-merging is what makes "which files does ADR-N govern" and "what else breaks if I
 * revisit this decision" a one-hop query instead of impossible.
 *
 * ORDERING IS LOAD-BEARING
 *
 * Run this ONLY on the copy in .planning/graphs/ — never on graphify-out/graph.json,
 * which is graphify's own incremental baseline. `graphify update` re-extracts over its
 * baseline and silently re-scatters the merge (verified). scripts/graph-build.sh gets
 * this order right; run it rather than invoking graphify by hand.
 *
 * Idempotent. Delete this script if graphify ever exempts doc_ref upstream.
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface GraphNode {
  id: string;
  label?: string;
  file_type?: string;
  [k: string]: unknown;
}
interface GraphLink {
  source: string;
  target: string;
  relation?: string;
  [k: string]: unknown;
}
interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
  [k: string]: unknown;
}

const graphPath = process.argv[2] ?? ".planning/graphs/graph.json";
const abs = path.resolve(graphPath);

if (!fs.existsSync(abs)) {
  console.error(`[normalize-graph-docrefs] No graph at ${graphPath}`);
  process.exit(1);
}

const graph: Graph = JSON.parse(fs.readFileSync(abs, "utf8"));

/** Matches both the canonical `docref_adr_0001` and the salted `<path>_docref_adr_0001`. */
const DOCREF = /docref_(adr_\d+)$/;

const remap = new Map<string, string>();
const canonical = new Map<string, GraphNode>();

for (const node of graph.nodes) {
  const m = DOCREF.exec(node.id);
  if (!m) continue;
  const canonicalId = `docref_${m[1]}`;
  remap.set(node.id, canonicalId);
  // Prefer an already-canonical node as the survivor; otherwise take the first.
  if (!canonical.has(canonicalId) || node.id === canonicalId) {
    canonical.set(canonicalId, { ...node, id: canonicalId });
  }
}

if (remap.size === 0) {
  console.log(
    "[normalize-graph-docrefs] No ADR nodes found; nothing to merge.",
  );
  process.exit(0);
}

graph.nodes = [
  ...graph.nodes.filter((n) => !remap.has(n.id)),
  ...canonical.values(),
];

const seen = new Set<string>();
const links: GraphLink[] = [];
for (const link of graph.links) {
  const source = remap.get(link.source) ?? link.source;
  const target = remap.get(link.target) ?? link.target;
  if (source === target) continue; // self-loop from a collapsed pair
  const key = `${source} ${target} ${link.relation ?? ""}`;
  if (seen.has(key)) continue; // parallel edge from a collapsed pair
  seen.add(key);
  links.push({ ...link, source, target });
}
graph.links = links;

fs.writeFileSync(abs, JSON.stringify(graph));

console.log(
  `[normalize-graph-docrefs] merged ${remap.size} node(s) -> ${canonical.size} canonical ADR node(s) in ${graphPath}`,
);
