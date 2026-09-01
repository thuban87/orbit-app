#!/usr/bin/env tsx
/**
 * Precise answers to the two questions agents actually ask the graph.
 *
 * `$gsd-graphify query <term>` is a LEXICAL substring match. Asking it about
 * `contact-store.ts` returns hundreds of nodes and edges — the ADRs you wanted are in
 * there, buried under every `stores()` in the test suite. An agent then burns a dozen
 * follow-up commands and several minutes filtering it by hand. That is not the graph
 * being slow; it is the wrong tool for a precise question.
 *
 * These two questions have exact answers. Give them exactly.
 *
 *   npm run graph:ask -- governs src/stores/contact-store.ts
 *       Which decisions govern this file?
 *
 *   npm run graph:ask -- impact 1
 *       If I change ADR-001, what else is affected?
 *
 * Both distinguish EXTRACTED from INFERRED, because they are not the same claim:
 *   cites       (EXTRACTED) — the file literally names the ADR in a comment.
 *   governed_by (INFERRED)  — the ADR's Key-files list names the file. A document's
 *                             claim about the code, not the code's own.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const graphPath = path.join(repoRoot, ".planning/graphs/graph.json");

interface Node {
  id: string;
  label?: string;
  file_type?: string;
  source_file?: string;
}
interface Link {
  source: string;
  target: string;
  relation?: string;
}

if (!fs.existsSync(graphPath)) {
  console.error("No graph. Run: npm run graph:build");
  process.exit(1);
}

const graph: { nodes: Node[]; links: Link[] } = JSON.parse(
  fs.readFileSync(graphPath, "utf8"),
);
const byId = new Map(graph.nodes.map((n) => [n.id, n]));

/**
 * ADR label -> its supersession line, read from the ADR BODIES.
 *
 * Not from the graph's rationale nodes: graphify truncates a node label at 80 chars, so
 * a long supersession note reads "[SUPERSEDED BY ADR-042 (partial — the ... " — cut off
 * mid-word, with no closing bracket. A warning that trails off mid-sentence is a warning
 * people learn to skim. The bodies are the source of truth anyway.
 */
const adrDir = path.join(repoRoot, "docs/decisions");
const adrStatus = new Map<string, string>();
for (const file of fs.readdirSync(adrDir)) {
  const m = file.match(/^ADR-(\d+)-.*\.md$/);
  if (!m) continue;
  const body = fs.readFileSync(path.join(adrDir, file), "utf8");
  const sup = body.match(/^\*\*Superseded by:\*\*\s*(.+)$/m);
  if (sup && sup[1].trim() !== "None") {
    adrStatus.set(`ADR-${m[1].padStart(4, "0")}`, sup[1].trim());
  }
}

/**
 * The generated registry cites every ADR by construction, so it is a hit for every
 * query and tells you nothing. Never report it as an affected file.
 */
const REGISTRY = "docs/decisions/adr-registry.ts";

function statusOf(label: string): string {
  const s = adrStatus.get(label);
  return s ? `\n        ⚠ SUPERSEDED BY ${s}` : "";
}

const [mode, arg] = process.argv.slice(2);

if (mode === "governs" && arg) {
  // Accept a full path or a bare filename.
  const fileNodes = graph.nodes.filter(
    (n) =>
      n.source_file &&
      n.label === path.basename(n.source_file) &&
      (n.source_file === arg || path.basename(n.source_file) === arg),
  );

  if (fileNodes.length === 0) {
    console.log(
      `No file node for "${arg}". Is it in the graph corpus (.graphifyignore)?`,
    );
    process.exit(0);
  }

  for (const fn of fileNodes) {
    const cited: string[] = [];
    const inferred: string[] = [];
    for (const l of graph.links) {
      if (l.source !== fn.id || !l.target.startsWith("docref_adr")) continue;
      const label = byId.get(l.target)?.label ?? l.target;
      (l.relation === "cites" ? cited : inferred).push(label);
    }

    console.log(`\n${fn.source_file}\n`);
    if (!cited.length && !inferred.length) {
      console.log("  No ADR is recorded for this file.");
      console.log(
        "  That means NOBODY WROTE IT DOWN — not that no decision governs it.",
      );
      continue;
    }
    if (cited.length) {
      console.log("  EXTRACTED — the file itself cites these in a comment:");
      for (const a of [...new Set(cited)].sort())
        console.log(`    ${a}${statusOf(a)}`);
    }
    if (inferred.length) {
      console.log("  INFERRED — these ADRs name this file in their Key files:");
      for (const a of [...new Set(inferred)].sort())
        console.log(`    ${a}${statusOf(a)}`);
    }
  }
  console.log(
    "\n  The graph cannot see TypeScript->SQL edges. To find every writer of a shared\n" +
      "  table, you must still grep. Read the code before you conclude.\n",
  );
  process.exit(0);
}

if (mode === "impact" && arg) {
  const num = arg.replace(/\D/g, "").padStart(4, "0");
  const target = `docref_adr_${num}`;
  const label = `ADR-${num}`;

  if (!byId.has(target)) {
    console.log(`No node for ${label}. Run: npm run graph:build`);
    process.exit(0);
  }

  const cited: string[] = [];
  const inferred: string[] = [];
  for (const l of graph.links) {
    if (l.target !== target) continue;
    const f = byId.get(l.source)?.source_file;
    if (!f || f === REGISTRY) continue;
    (l.relation === "cites" ? cited : inferred).push(f);
  }

  const status = adrStatus.get(label);
  console.log(`\n${label}\n`);
  if (status) {
    console.log(`  ⚠ SUPERSEDED BY ${status}\n`);
    console.log(
      "  ⚠ THIS DECISION IS RETIRED. Reversing or re-litigating it is the OWNER's call,\n" +
        "    not yours. See 'Whose decision is it' in CLAUDE.md.\n",
    );
  }

  if (cited.length) {
    console.log("  EXTRACTED — files that cite it directly in a comment:");
    for (const f of [...new Set(cited)].sort()) console.log(`    ${f}`);
  }
  if (inferred.length) {
    console.log("\n  INFERRED — files named in its Key files:");
    for (const f of [...new Set(inferred)].sort()) console.log(`    ${f}`);
  }
  if (!cited.length && !inferred.length) console.log("  No files linked.");
  console.log(
    "\n  Not exhaustive: a file is linked only if someone wrote the citation or listed it.\n",
  );
  process.exit(0);
}

console.log(`Usage:
  npm run graph:ask -- governs <file>    Which decisions govern this file?
  npm run graph:ask -- impact <ADR-NNN>  What else is affected if I change it?

Examples:
  npm run graph:ask -- governs src/stores/contact-store.ts
  npm run graph:ask -- governs contact-store.ts
  npm run graph:ask -- impact 1`);
