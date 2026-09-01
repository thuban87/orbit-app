#!/usr/bin/env tsx
/**
 * CI gate: every ADR **touched in this change** must name resolvable key files.
 *
 * WHY DIFF-SCOPED AND NOT WHOLE-CORPUS
 *
 * Some paths in existing ADRs point at files that no longer exist — and they are
 * CORRECT. An ADR names the file it deletes because that ADR is the decision that
 * deleted it; another names what existed when it was decided. A whole-corpus gate
 * would fail on those forever, so it would need an allowlist of known-dead paths —
 * a second file that drifts out of sync with reality, which is the exact disease
 * this whole effort exists to cure.
 *
 * Gating the diff holds every NEW decision to the standard and leaves history alone.
 * That is where the failure actually happens: on the owner's other project a phase
 * shipped 12 ADRs with no `**Key files:**` block at all (they used **Code:** /
 * **Schema:** / **Migrations:**), and 89 real paths were invisible to the graph for
 * months. This gate would have caught that on the very first one.
 *
 * WHAT IT ENFORCES (deliberately the minimum bar — a nagging gate gets disabled):
 *   1. The ADR has an `## Implementation` section.
 *   2. It names at least one path that resolves to a real file.
 *   3. No path is a glob — `components/**\/*.tsx` claims the whole app.
 *
 * It does NOT require every path to resolve: an ADR may legitimately name a file it
 * deletes. It only insists the ADR is anchored to something real.
 *
 * Usage:
 *   npm run check:adr-key-files              # vs origin/main (CI)
 *   npm run check:adr-key-files -- --all     # whole corpus (report; still exits 0 on
 *                                            #   pre-existing rot, fails only on globs
 *                                            #   and zero-resolvable ADRs)
 */

import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { auditAdrKeyFiles } from "./audit-adr-key-files";

const repoRoot = path.resolve(__dirname, "..");
const all = process.argv.includes("--all");
const baseArg = process.argv.find((a) => a.startsWith("--base="));
const base = baseArg ? baseArg.split("=")[1] : "origin/main";

function git(args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

/** ADR numbers touched in this change (added or modified vs the base ref). */
function changedAdrs(): Set<string> {
  // Fall back to HEAD~1 when the base ref is unavailable (shallow clone, local run).
  const ref = git(["rev-parse", "--verify", "--quiet", base]) ? base : "HEAD~1";
  const files = git([
    "diff",
    "--name-only",
    "--diff-filter=AM",
    `${ref}...HEAD`,
  ])
    .split("\n")
    .filter(Boolean);

  const nums = new Set<string>();
  for (const f of files) {
    const m = f.match(/^docs\/decisions\/ADR-(\d+)-.*\.md$/);
    if (m) nums.add(m[1]);
  }
  return nums;
}

const { findings, noKeyFilesBlock } = auditAdrKeyFiles();

const scope = all ? null : changedAdrs();
const inScope = (adr: string) => scope === null || scope.has(adr);

if (scope !== null && scope.size === 0) {
  console.log(
    "[check-adr-key-files] No ADRs added or modified. Nothing to check.",
  );
  process.exit(0);
}

const byAdr = new Map<string, typeof findings>();
for (const f of findings) {
  if (!inScope(f.adr)) continue;
  const list = byAdr.get(f.adr) ?? [];
  list.push(f);
  byAdr.set(f.adr, list);
}

const errors: string[] = [];

// 1. No Implementation section / no paths at all.
for (const adr of noKeyFilesBlock) {
  if (!inScope(adr)) continue;
  errors.push(
    `ADR-${adr}: no '## Implementation' section naming any file.\n` +
      `    Every ADR must say which code its decision governs — that list is the ONLY\n` +
      `    source of the code->ADR edges in the knowledge graph. Use '**Key files:**'\n` +
      `    with full repo-relative paths. See .planning/knowledgebase/templates/adr-template.md`,
  );
}

for (const [adr, fs_] of byAdr) {
  // 2. At least one path must resolve to a real file.
  const resolvable = fs_.filter((f) => f.category === "LIVE");
  if (resolvable.length === 0) {
    const shown = fs_
      .slice(0, 3)
      .map((f) => `      \`${f.raw}\` (${f.category})`)
      .join("\n");
    errors.push(
      `ADR-${adr}: names ${fs_.length} path(s), NONE of which resolve to a real file.\n${shown}\n` +
        `    An ADR may legitimately name a file it deletes, but it must be anchored to\n` +
        `    something that exists. Open the files and copy the real paths.`,
    );
  }

  // 3. No globs.
  // Globs in a bullet's DESCRIPTION are quoted config values, not key files —
  // failing an ADR for accurately citing a config include pattern helps nobody.
  for (const f of fs_.filter(
    (x) => x.category === "GLOB" && !x.inDescription,
  )) {
    errors.push(
      `ADR-${adr}: glob in key files — \`${f.raw}\`\n` +
        `    A glob claims a whole directory tree governs by this decision. A glob\n` +
        `    column once collapsed one ADR's four files into the entire app. Name the files.`,
    );
  }
}

const label = all ? "whole corpus" : `ADRs changed vs ${base}`;

if (errors.length === 0) {
  const n = scope === null ? "all" : scope.size;
  console.log(`[check-adr-key-files] PASS — ${n} ADR(s) checked (${label}).`);
  process.exit(0);
}

console.error(
  `\n[check-adr-key-files] FAIL — ${errors.length} problem(s) (${label}):\n`,
);
for (const e of errors) console.error(`  ${e}\n`);
console.error(
  `  Run 'npm run audit:adr-key-files -- --full' to see every path.\n`,
);
process.exit(1);
