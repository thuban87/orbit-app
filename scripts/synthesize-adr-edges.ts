#!/usr/bin/env tsx
/**
 * Synthesize `code -> ADR` edges into the knowledge graph.
 *
 * WHY
 *
 * graphify only draws a code->ADR edge when a source file literally cites `ADR-NNN`
 * in a comment. Few files do, so only a handful of ADRs end up connected to any code.
 * "What does ADR-001 say?" works everywhere; "what breaks if I revisit ADR-001?"
 * works almost nowhere — and that second question is the whole point.
 *
 * Every ADR's `## Implementation` section already names the files its decision governs.
 * That is an authored, human judgment recorded at decision time. This script reads it
 * and draws the edges graphify cannot.
 *
 * WHY NOT docs/decisions/INDEX.md — it has the same data in a tidy table, and it is a
 * TRAP. Its "Key file globs" column is a lossy SUMMARY of the ADR bodies: on the
 * owner's other project it collapsed one ADR's four exact files into
 * `components/**\/*.tsx`, i.e. the entire app. Measured, synthesizing from it gave
 * every store the IDENTICAL 71 ADRs (median 14 per file, max 76) — noise dressed as
 * knowledge, drowning the real citations. The ADR bodies give a median of ~2 ADRs per
 * file. Read the source, never the summary.
 *
 * HONESTY OF THE EDGES
 *
 * These edges are DERIVED FROM A DOCUMENT, not from code. They are marked
 * `relation: "governed_by"` with `confidence: "INFERRED"`, so an agent can always tell
 * them from a real `cites` edge that graphify extracted from an actual comment. Without
 * that distinction we would be laundering a document's claim into a graph fact.
 *
 * A MISSING EDGE MEANS "NOBODY WROTE IT DOWN", NEVER "NO DECISION GOVERNS THIS FILE."
 *
 * Only LIVE paths become edges. DELETED paths (a file removed by a later decision) have
 * no graph node at all, so they are inert here — which is exactly right: an ADR names
 * the file it deletes because it is the decision that deleted it.
 *
 * Runs on the .planning/graphs/ copy, AFTER normalize-graph-docrefs.ts. Idempotent.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { auditAdrKeyFiles } from "./audit-adr-key-files";

interface GraphNode {
  id: string;
  label?: string;
  source_file?: string;
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
  console.error(`[synthesize-adr-edges] No graph at ${graphPath}`);
  process.exit(1);
}

const graph: Graph = JSON.parse(fs.readFileSync(abs, "utf8"));

/**
 * source_file -> its file-node id.
 *
 * Derived FROM THE GRAPH, not by reimplementing graphify's id algorithm. That algorithm
 * is not what you would guess: the file node for `.../contact-store.ts` is
 * `src_stores_contact_store` — the extension is dropped — while the salted doc-ref
 * variant keeps it (`..._contact_store_ts_docref_adr_0001`). Guessing would silently
 * produce phantom endpoints, and graphify drops edges to nodes that do not exist, so
 * the failure would be invisible.
 *
 * The file node is the one whose label is the basename of its own source_file. Verified
 * unambiguous on quest-board's larger graph; re-check if orbit ever hits a collision.
 */
const fileNodeId = new Map<string, string>();
for (const n of graph.nodes) {
  if (n.source_file && n.label === path.basename(n.source_file)) {
    fileNodeId.set(n.source_file, n.id);
  }
}

const adrNodeIds = new Set(
  graph.nodes.filter((n) => n.id.startsWith("docref_adr")).map((n) => n.id),
);

const existing = new Set(
  graph.links.map((l) => `${l.source} ${l.target} ${l.relation ?? ""}`),
);

const { findings } = auditAdrKeyFiles();

let added = 0;
let noFileNode = 0;
let noAdrNode = 0;
const adrsLinked = new Set<string>();
const filesLinked = new Set<string>();

for (const f of findings) {
  if (f.category !== "LIVE") continue; // DELETED/MOVED/WRONG have no live node to link

  const source = fileNodeId.get(f.raw);
  if (!source) {
    // The path is real but graphify never graphed it — e.g. it lives under a
    // .graphifyignore'd directory (.planning/, docs/decisions/, generated output).
    noFileNode++;
    continue;
  }

  const target = `docref_adr_${f.adr.padStart(4, "0")}`;
  if (!adrNodeIds.has(target)) {
    noAdrNode++;
    continue;
  }

  const key = `${source} ${target} governed_by`;
  if (existing.has(key)) continue; // idempotent
  existing.add(key);

  graph.links.push({
    source,
    target,
    relation: "governed_by",
    confidence: "INFERRED",
    confidence_score: 0.8,
    source_file: f.raw,
    weight: 1.0,
    _origin: "adr-implementation-section",
  });
  added++;
  adrsLinked.add(f.adr);
  filesLinked.add(f.raw);
}

fs.writeFileSync(abs, JSON.stringify(graph));

console.log(
  `[synthesize-adr-edges] +${added} governed_by edges (INFERRED) — ` +
    `${adrsLinked.size} ADRs linked to ${filesLinked.size} files`,
);
if (noFileNode) {
  console.log(
    `[synthesize-adr-edges]   ${noFileNode} live path(s) skipped: real files, but not in the graph corpus (.graphifyignore)`,
  );
}
if (noAdrNode) {
  console.log(
    `[synthesize-adr-edges]   ${noAdrNode} skipped: no ADR node (run gen:adr-registry)`,
  );
}
