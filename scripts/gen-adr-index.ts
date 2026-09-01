#!/usr/bin/env tsx
/**
 * Regenerate docs/decisions/INDEX.md from the ADR bodies.
 *
 * INDEX.md is a DERIVED navigation aid. It must never be hand-edited, and it must
 * never be the thing a machine reads. The ADR bodies are the source; the graph edges
 * come from them (scripts/synthesize-adr-edges.ts); this file exists purely so a human
 * can scan the corpus.
 *
 * WHY THE GLOB COLUMN IS RETIRED (cautionary tale from the owner's OTHER project,
 * quest-board — not orbit history):
 *
 *   An ADR there named FOUR exact files. A hand-maintained index summarized them as
 *   `src/components/**\/*.tsx` — the entire component tree. Synthesizing graph edges
 *   from that column gave two unrelated stores the IDENTICAL 71 ADRs (median 14 per
 *   file, max 76). Noise dressed as knowledge.
 *
 * The lesson of that bug is the design of this script: the glob column is gone. It is
 * replaced by a Key files count plus the real directories, which is honest about what
 * it is: a navigation aid, not a contract.
 *
 * Usage: npm run gen:adr-index
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { auditAdrKeyFiles } from "./audit-adr-key-files";

const repoRoot = path.resolve(__dirname, "..");
const adrDir = path.join(repoRoot, "docs/decisions");
const outPath = path.join(adrDir, "INDEX.md");

interface Row {
  num: string;
  title: string;
  status: string;
  phase: string;
  supersedes: string;
  supersededBy: string;
  dirs: string[];
  liveCount: number;
  totalCount: number;
  subsystems: string;
}

function field(body: string, key: string): string {
  const m = body.match(new RegExp(`^\\*\\*${key}:\\*\\*\\s*(.+)$`, "m"));
  const v = m ? m[1].trim() : "";
  return v && v !== "None" ? v : "—";
}

const { findings } = auditAdrKeyFiles();
const byAdr = new Map<string, typeof findings>();
for (const f of findings) {
  const list = byAdr.get(f.adr) ?? [];
  list.push(f);
  byAdr.set(f.adr, list);
}

/**
 * Carry the curated `Subsystems` column forward from the existing INDEX.md.
 *
 * This column is NOT derivable from file paths: docs/systems/ keys subsystems off
 * *owning stores*, not directories, and the values are assigned by hand. Regenerating
 * them mechanically would mean inventing them.
 *
 * Preserved, never invented. A brand-new ADR gets `—` until someone fills it in.
 */
function previousSubsystems(): Map<string, string> {
  const prev = new Map<string, string>();
  if (!fs.existsSync(outPath)) return prev;
  for (const line of fs.readFileSync(outPath, "utf8").split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    // Old shape: | # | Title | Status | Phase | Supersedes | Superseded by | Subsystems | Key file globs |
    // New shape: | # | Title | Status | Phase | Supersedes | Superseded by | Subsystems | Key files | Directories |
    if (cells.length < 9 || !/^\d+$/.test(cells[1])) continue;
    const subsystems = cells[7];
    if (subsystems && subsystems !== "—") prev.set(cells[1], subsystems);
  }
  return prev;
}

const carried = previousSubsystems();

const rows: Row[] = [];
for (const file of fs
  .readdirSync(adrDir)
  .filter((f) => /^ADR-\d+.*\.md$/.test(f))
  .sort()) {
  const body = fs.readFileSync(path.join(adrDir, file), "utf8");
  const num = (file.match(/^ADR-(\d+)/) as RegExpMatchArray)[1];
  const titleMatch = body.match(/^#\s*ADR-\d+:\s*(.+)$/m);
  const fs_ = byAdr.get(num) ?? [];

  // Real directories, deduped — a navigation hint, never a machine contract.
  const dirs = [
    ...new Set(
      fs_.filter((f) => f.category === "LIVE").map((f) => path.dirname(f.raw)),
    ),
  ].sort();

  rows.push({
    num,
    title: titleMatch ? titleMatch[1].trim() : "(untitled)",
    status: field(body, "Status"),
    phase: field(body, "Phase").split(/[\s(]/)[0],
    supersedes: field(body, "Supersedes"),
    supersededBy: field(body, "Superseded by"),
    dirs,
    liveCount: fs_.filter((f) => f.category === "LIVE").length,
    totalCount: fs_.length,
    subsystems: carried.get(num) ?? "—",
  });
}

const esc = (s: string) => s.replace(/\|/g, "\\|");
const superseded = rows.filter((r) => r.supersededBy !== "—").length;

const out = `# ADR Index

**GENERATED FILE — DO NOT EDIT.** Regenerate with \`npm run gen:adr-index\`.

Source of truth: the individual \`ADR-NNN-*.md\` files. This index is *derived*. If a row
here disagrees with the underlying ADR, **the ADR wins** — do not "fix" the row, fix the
generator.

## Do not machine-read this file

An earlier version of this index (on the owner's other project) carried a hand-written
"Key file globs" column. It was a lossy summary: one ADR's four exact files were recorded
as \`src/components/**/*.tsx\` — the whole component tree. Anything that consumed that
column concluded every store was governed by the same 71 ADRs.

**The ADR bodies' \`**Key files:**\` blocks are the contract.** They are what
\`scripts/synthesize-adr-edges.ts\` turns into the graph's \`code -> ADR\` edges, and what
\`npm run audit:adr-key-files\` validates. This file is a human navigation aid — nothing
more. The "Key files" column below is a *count* and the real directories, deliberately
not something you can pattern-match against.

## How to use this

- **Is a decision still live?** Check the \`Superseded by\` column. ${superseded} of
  ${rows.length} ADRs are superseded in whole or in part.
- **Which decisions govern a file?** Don't grep this file — ask the graph:
  \`npm run graph:ask -- governs src/db/field-values-dao.ts\`, or follow the
  \`governed_by\` edges.

## Index

| # | Title | Status | Phase | Supersedes | Superseded by | Subsystems | Key files | Directories |
|---|-------|--------|-------|------------|---------------|------------|-----------|-------------|
${rows
  .map((r) => {
    const files =
      r.totalCount === 0
        ? "—"
        : r.liveCount === r.totalCount
          ? `${r.liveCount}`
          : `${r.liveCount}/${r.totalCount} live`;
    const dirs = r.dirs.length
      ? r.dirs
          .slice(0, 3)
          .map((d) => `\`${d}\``)
          .join(", ") + (r.dirs.length > 3 ? ` +${r.dirs.length - 3}` : "")
      : "—";
    return `| ${r.num} | ${esc(r.title)} | ${r.status} | ${r.phase} | ${esc(r.supersedes)} | ${esc(r.supersededBy)} | ${esc(r.subsystems)} | ${files} | ${dirs} |`;
  })
  .join("\n")}
`;

fs.writeFileSync(outPath, out);
console.log(
  `[gen-adr-index] ${rows.length} ADRs (${superseded} superseded) -> docs/decisions/INDEX.md`,
);
