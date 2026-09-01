#!/usr/bin/env tsx
/**
 * ADR Key-files Corrector — DRY-RUN BY DEFAULT. Pass --apply to write.
 *
 * Corrects file *pointers* in ADR `**Key files:**` blocks. It does not touch a
 * single word of decision text, rationale, context, or supersession state.
 *
 * ADRs are immutable (CLAUDE.md). That clause protects the *decision*. A path
 * saying where the code lives is not a decision — and a wrong path makes the
 * historical record less accurate, not more. This script only ever changes a
 * path that the audit proved is wrong and can resolve without judgment.
 *
 * SAFETY RULES — all enforced, not merely intended:
 *   - Only findings the audit classified WRONG or MOVED are touched. Anything
 *     else (DELETED / UNRESOLVABLE / GLOB / LIVE) is refused.
 *   - DELETED is never touched. A file removed by a later decision SHOULD still
 *     be named by the ADR that introduced it — that is correct history, and a
 *     deleted file has no graph node anyway, so it is inert to graphify.
 *   - Every edit must have an unambiguous `suggestion` from the audit.
 *   - Replacement is scoped to the Key-files block, inside backticks, and must
 *     match exactly once in that block. Anything else aborts that edit.
 *
 * Usage:
 *   npm run fix:adr-key-files            # dry run — prints a unified diff
 *   npm run fix:adr-key-files -- --apply # write it
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { auditAdrKeyFiles, type Finding, section } from "./audit-adr-key-files";

const repoRoot = path.resolve(__dirname, "..");
const adrDir = path.join(repoRoot, "docs/decisions");
const apply = process.argv.includes("--apply");

/**
 * The only category this script is permitted to rewrite: WRONG — a path that never
 * existed anywhere in git history, resolving to exactly one real file. Those are
 * typos and dropped path prefixes. There is no judgment in fixing them.
 *
 * MOVED is deliberately EXCLUDED, and this is not caution for its own sake:
 *
 *   A rename can BE a supersession. An ADR decides a feature and names its file; a
 *   later ADR replaces that feature and the file is renamed to match. "Correcting"
 *   the first ADR's pointer would make it claim it governed a file that did not
 *   exist when it was decided — a file whose whole purpose is to replace what it
 *   decided. That is not fixing a pointer, it is rewriting the historical record,
 *   and it destroys the audit trail that ADR immutability exists to protect.
 *
 * Nothing in the file system distinguishes an organizational move from a semantic
 * rename. Only a human can. So MOVED is reported for review and never auto-applied.
 */
const CORRECTABLE = new Set(["WRONG"]);

interface Edit {
  file: string;
  adr: string;
  from: string;
  to: string;
}

const { findings } = auditAdrKeyFiles();

const edits: Edit[] = [];
const refused: { f: Finding; why: string }[] = [];

for (const f of findings) {
  if (f.category === "MOVED") {
    refused.push({
      f,
      why: `MOVED to ${f.suggestion} — a rename may encode a supersession; needs a human, never auto-applied`,
    });
    continue;
  }
  if (!CORRECTABLE.has(f.category)) continue; // silently skip LIVE/GLOB/DELETED
  if (f.expanded) {
    // Came from brace shorthand (`dir/{A,B}.tsx`). This literal string does not
    // appear anywhere in the ADR, so there is nothing safe to find-and-replace.
    refused.push({
      f,
      why: "expanded from brace shorthand — not a literal string in the ADR; correct it by hand",
    });
    continue;
  }
  if (!f.suggestion) {
    refused.push({ f, why: "no unambiguous suggestion" });
    continue;
  }
  if (!f.file) {
    refused.push({ f, why: "audit did not report the ADR filename" });
    continue;
  }
  edits.push({ file: f.file, adr: f.adr, from: f.raw, to: f.suggestion });
}

// Group by ADR file so each file is read/written once.
const byFile = new Map<string, Edit[]>();
for (const e of edits) {
  const list = byFile.get(e.file) ?? [];
  list.push(e);
  byFile.set(e.file, list);
}

let applied = 0;
const diffs: string[] = [];

for (const [file, fileEdits] of byFile) {
  const full = path.join(adrDir, file);
  const original = fs.readFileSync(full, "utf8");

  // Replacement is scoped to the `## Implementation` section — the same region the
  // audit reads, via the same helper, so the two cannot disagree about where the
  // boundary is. NOT the whole file: a path may also appear in Context/Decision
  // prose, and rewriting prose is editing the decision, which this must never do.
  const impl = section(original, "Implementation");
  if (impl === null) {
    for (const e of fileEdits) {
      refused.push({
        f: { adr: e.adr, raw: e.from, category: "WRONG" },
        why: "Implementation section vanished between audit and fix",
      });
    }
    continue;
  }

  let newBlock = impl;
  const done: Edit[] = [];

  for (const e of fileEdits) {
    // Only ever replace the backticked path, and only inside the Implementation section.
    const needle = `\`${e.from}\``;
    const hits = newBlock.split(needle).length - 1;
    if (hits !== 1) {
      refused.push({
        f: { adr: e.adr, raw: e.from, category: "WRONG" },
        why: `expected exactly 1 occurrence in the Implementation section, found ${hits}`,
      });
      continue;
    }
    newBlock = newBlock.replace(needle, `\`${e.to}\``);
    done.push(e);
  }

  if (done.length === 0) continue;

  const updated = original.replace(impl, newBlock);

  // Guard: the ONLY thing that may change is inside the Implementation section.
  const origRest = original.replace(impl, "");
  const newRest = updated.replace(newBlock, "");
  if (origRest !== newRest) {
    console.error(
      `REFUSING ${file}: the edit would have changed text outside the Implementation section.`,
    );
    continue;
  }

  for (const e of done) {
    diffs.push(
      `  ${file}\n    ADR-${e.adr}\n      - \`${e.from}\`\n      + \`${e.to}\``,
    );
  }

  if (apply) {
    fs.writeFileSync(full, updated);
    applied += done.length;
  }
}

// ---------------------------------------------------------------- report

console.log(
  apply
    ? "ADR KEY-FILES CORRECTION — APPLYING\n"
    : "ADR KEY-FILES CORRECTION — DRY RUN (nothing written)\n",
);

if (diffs.length === 0) {
  console.log("  Nothing to correct.");
} else {
  console.log(`${diffs.length} path correction(s):\n`);
  console.log(diffs.join("\n\n"));
}

if (refused.length) {
  console.log(
    `\n\nREFUSED (${refused.length}) — left untouched, need a human:`,
  );
  for (const r of refused) {
    console.log(`  ADR-${r.f.adr}: ${r.f.raw}\n      (${r.why})`);
  }
}

console.log(
  apply
    ? `\n\nApplied ${applied} correction(s). Decision text untouched — review with: git diff docs/decisions/`
    : "\n\nDry run. Re-run with --apply to write these changes.",
);
