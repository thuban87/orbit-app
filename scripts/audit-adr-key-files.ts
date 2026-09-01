#!/usr/bin/env tsx
/**
 * ADR Key-files Audit — READ-ONLY. Writes nothing, changes nothing.
 *
 * Every ADR carries a `**Key files:**` block naming the code its decision governs.
 * That block is the authoritative source for the code->ADR edges in the knowledge
 * graph (docs/decisions/INDEX.md is a *derived* summary and its glob column is
 * lossy to the point of being useless — on the owner's other project it collapsed
 * one ADR's four exact files into `components/**\/*.tsx`, i.e. the whole app).
 *
 * This script classifies every path in every Key-files block, so a correction pass
 * can be scripted from git's rename records rather than guessed at by an agent.
 *
 * Categories:
 *   LIVE          path exists today. Nothing to do.
 *   MOVED         file was renamed; git knows the current path. Correctable.
 *   DELETED       file was genuinely removed by a later decision. LEAVE ALONE —
 *                 this is correct history, and a deleted file has no graph node,
 *                 so it is inert to graphify either way.
 *   WRONG         path never existed in git history, but exactly one file in the
 *                 repo has that basename. Almost always a typo or relative-path
 *                 shorthand written into the ADR ("(tabs)/settings.tsx").
 *                 Correctable.
 *   UNRESOLVABLE  never existed, and no unambiguous match. Needs human eyes.
 *   GLOB          wildcard pattern, not an exact path. Reported, never corrected.
 *
 * Usage:
 *   npm run audit:adr-key-files            # summary
 *   npm run audit:adr-key-files -- --full  # every finding, grouped
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const adrDir = path.join(repoRoot, "docs/decisions");
const full = process.argv.includes("--full");

type Category =
  | "LIVE"
  | "MOVED"
  | "DELETED"
  | "WRONG"
  | "UNRESOLVABLE"
  | "GLOB";

export interface Finding {
  adr: string;
  /** The path exactly as written in the ADR — the string a fixer must replace. */
  raw: string;
  category: Category;
  /** The correct path, when one can be determined without judgment. */
  suggestion?: string;
  note?: string;
  /** ADR filename, so a fixer doesn't have to re-derive it. */
  file?: string;
  /**
   * True when the path appeared only in a bullet's DESCRIPTION (after the em dash),
   * where ADRs legitimately quote config values and globs. Real key files can show up
   * here too, so these are kept — but the CI gate must not fail an ADR over a
   * glob that is merely being quoted in prose.
   */
  inDescription?: boolean;
  /**
   * True when this path was produced by expanding brace shorthand
   * (`dir/{A,B}.tsx`). The literal string never appears in the ADR, so a fixer
   * CANNOT do a safe single-occurrence replacement on it. Expanded paths exist to
   * feed the graph, never to be auto-corrected.
   */
  expanded?: boolean;
}

/**
 * Shell-style brace expansion: `a/{b,c}/d.ts` -> [`a/b/d.ts`, `a/c/d.ts`].
 * Handles nesting (`src/{db/x,stores/{a,b}-store}`).
 *
 * Returns [input] when there is nothing to expand, so callers can treat it as a
 * pure widening. Callers MUST still filter for path-shape afterwards: ADRs are
 * full of TypeScript object literals in backticks (`{initialValue?, onComplete}`)
 * that expand into harmless garbage and must never be read as file paths.
 */
export function expandBraces(input: string): string[] {
  const open = input.indexOf("{");
  if (open === -1) return [input];

  // Find the matching close brace for THIS open brace, respecting nesting.
  let depth = 0;
  let close = -1;
  for (let i = open; i < input.length; i++) {
    if (input[i] === "{") depth++;
    else if (input[i] === "}") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return [input]; // unbalanced — leave it alone

  // Split the body on top-level commas only.
  const body = input.slice(open + 1, close);
  const options: string[] = [];
  let buf = "";
  depth = 0;
  for (const ch of body) {
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (ch === "," && depth === 0) {
      options.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  options.push(buf);

  const prefix = input.slice(0, open);
  const suffix = input.slice(close + 1);
  return options.flatMap((opt) => expandBraces(prefix + opt.trim() + suffix));
}

/**
 * Split on commas that are NOT inside braces.
 *
 * A single backticked token in an ADR can hold a comma-separated LIST of paths,
 * each of which may itself use brace shorthand:
 *
 *   `src/{db/x,stores/{a,b}-store}.ts, src/services/status.ts`
 *
 * Brace-expanding that whole string without splitting first produces a cartesian
 * product glued together by the literal comma ("src/db/x.ts,src/services/status.ts") —
 * strings that still look path-shaped (they contain a slash and end in an extension)
 * and therefore sail past the path filter as plausible garbage.
 */
function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let depth = 0;
  for (const ch of input) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  parts.push(buf);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Does this look like a file path (a directory separator and an extension)? */
function isPathLike(p: string): boolean {
  return p.includes("/") && /\.\w+$/.test(p) && !p.includes(",");
}

/**
 * Return the body of a `## <heading>` section, or null.
 *
 * Done by splitting rather than by regex on purpose: JavaScript has NO `\Z` anchor.
 * `/(?=^## |\Z)/m` looks like "next heading or end of input" but `\Z` is an identity
 * escape meaning a LITERAL 'Z', so the section silently truncates at the first capital
 * Z in the text. It happened to give the right answer on one corpus, which is exactly
 * how that bug survives to bite someone later.
 */
export function section(body: string, heading: string): string | null {
  const lines = body.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

function git(args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  } catch {
    return "";
  }
}

/** Every path git currently tracks. */
const tracked = new Set(git(["ls-files"]).split("\n").filter(Boolean));

/** basename -> tracked paths with that basename (for WRONG resolution). */
const byBasename = new Map<string, string[]>();
for (const p of tracked) {
  const b = path.basename(p);
  const list = byBasename.get(b) ?? [];
  list.push(p);
  byBasename.set(b, list);
}

/**
 * Rename map: old path -> new path, built ONCE from every rename record in history.
 *
 * Git does not store renames. It stores snapshots, and infers renames at diff time
 * by content similarity. That inference is NOT reliably visible through
 * `git log --diff-filter=R -- <old-path>`: pathspec limiting plus history
 * simplification prunes the very commit that renamed the file, so querying "from the
 * old path" silently returns nothing and a moved file looks deleted.
 *
 * Scanning all rename records globally, once, avoids the trap and is far cheaper
 * than one git call per path.
 */
const renameMap = new Map<string, string>();
{
  const log = git([
    "log",
    "--all",
    "-M",
    "--diff-filter=R",
    "--name-status",
    "--format=",
  ]);
  // Walk oldest-first so a later rename overwrites an earlier one, leaving the map
  // pointing at the most recent destination for each source.
  for (const line of log.split("\n").reverse()) {
    const m = line.match(/^R\d*\t(.+?)\t(.+)$/);
    if (m) renameMap.set(m[1], m[2]);
  }
}

/**
 * Where did a now-missing path go? Follows rename chains (a → b → c) to whatever
 * exists today. Returns null if it was genuinely deleted rather than moved.
 */
function findRenameTarget(p: string): string | null {
  let target = renameMap.get(p);
  const seen = new Set<string>([p]);
  while (target && !seen.has(target)) {
    if (tracked.has(target)) return target;
    seen.add(target);
    target = renameMap.get(target);
  }
  return null;
}

/**
 * Did this path ever exist in history at all?
 *
 * `--full-history` is mandatory. Without it git applies history simplification and
 * can prune the very commits that added/deleted the file, so a genuinely-deleted
 * path reports as "never existed" and gets misfiled as UNRESOLVABLE instead of
 * DELETED.
 */
function everExisted(p: string): boolean {
  return (
    git(["log", "--all", "--full-history", "--oneline", "-1", "--", p]) !== ""
  );
}

function classify(p: string): Omit<Finding, "adr" | "raw"> {
  // A real, tracked file wins over every heuristic below. This ordering is what keeps
  // dynamic route filenames out of the GLOB bucket: `src/app/contact/[id].tsx` is a
  // LITERAL FILENAME, not a wildcard, and square brackets are its normal spelling.
  // Treating `[` as a glob character would misfile real files as globs.
  if (tracked.has(p)) return { category: "LIVE" };

  // Only *, ? and { mean "wildcard" here. `[` deliberately does NOT — see above.
  if (/[*?{}]/.test(p)) return { category: "GLOB" };

  if (everExisted(p)) {
    const moved = findRenameTarget(p);
    if (moved) return { category: "MOVED", suggestion: moved };
    return {
      category: "DELETED",
      note: "removed by a later decision — correct history, leave alone",
    };
  }

  const candidates = byBasename.get(path.basename(p)) ?? [];
  if (candidates.length === 1) {
    return {
      category: "WRONG",
      suggestion: candidates[0],
      note: "never existed at this path; unique basename match",
    };
  }
  if (candidates.length > 1) {
    return {
      category: "UNRESOLVABLE",
      note: `never existed; ${candidates.length} files share this basename — ambiguous, needs a human`,
    };
  }
  return {
    category: "UNRESOLVABLE",
    note: "never existed; no file with this basename",
  };
}

// ---------------------------------------------------------------- collect

export interface AuditResult {
  findings: Finding[];
  noKeyFilesBlock: string[];
  adrCount: number;
}

/** Single source of classification truth — the fixer consumes this, so the two
 *  can never drift apart and "fix" something the audit never flagged. */
export function auditAdrKeyFiles(): AuditResult {
  const findings: Finding[] = [];
  const noKeyFilesBlock: string[] = [];

  const adrFiles = fs
    .readdirSync(adrDir)
    .filter((f) => /^ADR-\d+.*\.md$/.test(f))
    .sort();

  for (const file of adrFiles) {
    const adr = (file.match(/^ADR-(\d+)/) as RegExpMatchArray)[1];
    const body = fs.readFileSync(path.join(adrDir, file), "utf8");

    // Read the WHOLE `## Implementation` section, not just a `**Key files:**` block.
    //
    // The orbit ADR template mandates `**Key files:**`, but an older or hand-written
    // ADR may label the same content `**Code:**` / `**Schema:**` / `**Migrations:**`
    // / `**Tests:**` / `**Deletions:**`. A Key-files-only parser would report those
    // ADRs as "no key files at all" even though the paths are right there. On the
    // owner's other project 89 real paths across 12 ADRs went unseen for months for
    // exactly this reason. Reading the whole section loses nothing and gains those.
    const impl = section(body, "Implementation");
    if (impl === null) {
      noKeyFilesBlock.push(adr);
      continue;
    }

    const paths: { p: string; expanded: boolean; inDescription: boolean }[] =
      [];
    for (const line of impl.split("\n")) {
      // These name ADRs and rationale, not files.
      if (/^\*\*(Depends on|Required by|Note):\*\*/.test(line.trim())) continue;

      // Key-files bullets are `- \`path\` — description`. BOTH sides can name real
      // files, so both are parsed — but they are not equally trustworthy:
      //
      //   A bullet may hide the real key file only in the DESCRIPTION
      //   ("`biome.json` — ... exempting `src/lib/haptics.ts`") — must be parsed.
      //   A bullet may quote a CONFIG VALUE that is a glob
      //   ("`vitest.config.ts` — include pattern `src/**/*.test.ts`") — NOT a key file.
      //
      // So descriptions are parsed, but flagged. The CI gate refuses to fail an ADR
      // over a glob that only appears in prose — otherwise a correct ADR gets blocked
      // for accurately quoting a config file.
      const dash = line.indexOf("—");

      for (const m of line.matchAll(/`([^`]+)`/g)) {
        const token = m[1];
        const inDescription = dash !== -1 && (m.index ?? 0) > dash;
        // Split the comma-separated list FIRST, then brace-expand each element.
        // Doing it in the other order cartesian-products across the commas.
        for (const item of splitTopLevelCommas(token)) {
          const variants = expandBraces(item);
          for (const v of variants) {
            if (!isPathLike(v)) continue; // drops TS object literals, prose, etc.
            // `expanded` means "this literal string is not in the ADR", which is true
            // if we brace-expanded it OR if we split it out of a comma list.
            const wasRewritten = variants.length > 1 || item !== token;
            paths.push({ p: v, expanded: wasRewritten, inDescription });
          }
        }
      }
    }

    if (paths.length === 0) noKeyFilesBlock.push(adr);

    for (const { p, expanded, inDescription } of paths) {
      findings.push({
        adr,
        raw: p,
        ...classify(p),
        file,
        expanded,
        inDescription,
      });
    }
  }

  return { findings, noKeyFilesBlock, adrCount: adrFiles.length };
}

export const CATEGORY_ORDER: Category[] = [
  "LIVE",
  "MOVED",
  "WRONG",
  "DELETED",
  "UNRESOLVABLE",
  "GLOB",
];

// ---------------------------------------------------------------- report

if (require.main === module) {
  const { findings, noKeyFilesBlock, adrCount } = auditAdrKeyFiles();

  const counts = new Map<Category, number>();
  for (const f of findings)
    counts.set(f.category, (counts.get(f.category) ?? 0) + 1);

  const correctable = (counts.get("MOVED") ?? 0) + (counts.get("WRONG") ?? 0);

  console.log("ADR KEY-FILES AUDIT (read-only)\n");
  console.log(`ADRs scanned:                 ${adrCount}`);
  console.log(`ADRs with NO Key-files block: ${noKeyFilesBlock.length}`);
  if (noKeyFilesBlock.length) {
    console.log(`   ${noKeyFilesBlock.map((a) => `ADR-${a}`).join(", ")}`);
  }
  console.log(`paths examined:               ${findings.length}\n`);

  for (const c of CATEGORY_ORDER) {
    const n = counts.get(c) ?? 0;
    if (n) console.log(`  ${String(n).padStart(4)}  ${c}`);
  }
  console.log(`\n  -> ${correctable} correctable (MOVED + WRONG)`);
  console.log(
    `  -> ${counts.get("DELETED") ?? 0} DELETED must NOT be touched (correct history; inert to the graph)`,
  );
  console.log(`  -> ${counts.get("UNRESOLVABLE") ?? 0} need a human decision`);

  if (full) {
    for (const c of CATEGORY_ORDER) {
      const rows = findings.filter((f) => f.category === c);
      if (!rows.length || c === "LIVE" || c === "GLOB") continue;
      console.log(`\n\n=== ${c} (${rows.length}) ===`);
      for (const f of rows) {
        console.log(`  ADR-${f.adr}: ${f.raw}`);
        if (f.suggestion) console.log(`            -> ${f.suggestion}`);
        if (f.note) console.log(`            (${f.note})`);
      }
    }
  }
}
