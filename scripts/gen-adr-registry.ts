#!/usr/bin/env tsx
/**
 * ADR Registry Generator — the code half of the ADR graph bridge.
 *
 * Emits docs/decisions/adr-registry.ts: one comment line per ADR, carrying its
 * number, status, supersession, and title. That file exists purely to be read by
 * graphify, which only mints ADR nodes from `ADR-NNN` tokens found in JS/TS
 * *comments* (see graphify extract.py::_extract_js_rationale). Markdown and JSON
 * are invisible to that scan — which is why docs/decisions/INDEX.md, despite
 * holding the same data, produces no ADR nodes at all.
 *
 * Two node kinds come out of each line:
 *   - a `doc_ref` node per ADR, shared with every source file citing that ADR
 *   - a `rationale` node whose label is the comment text, i.e. the status itself
 *
 * Net effect: `graphify query ADR-0018` surfaces "SUPERSEDED BY ADR-042" without
 * anyone having to know to go looking for it.
 *
 * Source of truth is the ADR files themselves, never INDEX.md — the index is
 * derived, and a derived source would let a supersession go stale silently.
 *
 * Regenerate:  npm run gen:adr-registry   (and after ADRs are added/superseded)
 */

import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const adrDir = path.join(repoRoot, "docs/decisions");
const outPath = path.join(adrDir, "adr-registry.ts");

/** Biome forbids trailing whitespace; graphify truncates labels near 80 chars. */
const MAX_LINE = 200;

interface Adr {
  num: string;
  title: string;
  status: string;
  supersededBy: string;
}

function field(body: string, key: string): string {
  const m = body.match(new RegExp(`^\\*\\*${key}:\\*\\*\\s*(.+)$`, "m"));
  return m ? m[1].trim() : "None";
}

function readAdrs(): Adr[] {
  const files = fs
    .readdirSync(adrDir)
    .filter((f) => /^ADR-\d+.*\.md$/.test(f))
    .sort();

  return files.map((file) => {
    const body = fs.readFileSync(path.join(adrDir, file), "utf8");
    const num = (file.match(/^ADR-(\d+)/) as RegExpMatchArray)[1];
    const titleMatch = body.match(/^#\s*ADR-\d+:\s*(.+)$/m);
    return {
      num,
      title: titleMatch ? titleMatch[1].trim() : "(untitled)",
      status: field(body, "Status"),
      supersededBy: field(body, "Superseded by"),
    };
  });
}

function render(adrs: Adr[]): string {
  const lines: string[] = [
    "/**",
    " * GENERATED FILE — DO NOT EDIT.",
    " *",
    " * Source of truth: docs/decisions/ADR-*.md",
    " * Regenerate:      npm run gen:adr-registry",
    " *",
    " * Exists to be read by graphify, not by the app. Each ADR-NNNN token below",
    " * becomes a graph node shared with every source file that cites the same ADR",
    " * in a comment, so an ADR's supersession state is one hop from the code it",
    " * governs. See scripts/gen-adr-registry.ts for why markdown cannot do this.",
    " */",
    "",
  ];

  for (const adr of adrs) {
    const superseded = adr.supersededBy !== "None";
    // IMPORTANT: outranks NOTE: for a human skimming, and both are graphify
    // rationale prefixes — so a retired ADR reads as retired at a glance.
    const tag = superseded ? "IMPORTANT" : "NOTE";
    const state = superseded
      ? `SUPERSEDED BY ${adr.supersededBy}`
      : adr.status.toUpperCase();
    const raw = `// ${tag}: ADR-${adr.num.padStart(4, "0")} [${state}] ${adr.title}`;
    lines.push(raw.slice(0, MAX_LINE).trimEnd());
  }

  lines.push("");
  lines.push(`export const ADR_COUNT = ${adrs.length};`);
  lines.push("");
  return lines.join("\n");
}

const adrs = readAdrs();
if (adrs.length === 0) {
  console.error(`[gen-adr-registry] No ADRs found in ${adrDir}`);
  process.exit(1);
}

fs.writeFileSync(outPath, render(adrs));

const superseded = adrs.filter((a) => a.supersededBy !== "None").length;
console.log(
  `[gen-adr-registry] ${adrs.length} ADRs (${superseded} superseded) -> ${path.relative(repoRoot, outPath)}`,
);
