#!/usr/bin/env tsx
/**
 * Bare-text site inventory (38.5-01, dossier P-6). Re-derives the 38.4 brief's
 * `bare-text-sites.csv` from the code on disk with the committed classifier
 * `src/theme/__contract__/bare-text-sites.ts`, replacing the brief's uncommitted
 * scratch walker. Re-runnable at phase close (38.5-09).
 *
 *   npx tsx scripts/bare-text-inventory.ts [--out <csv>] [--route <Name>] [--compare <brief csv>] [--sites <json>] [--d24 1]
 *
 *   --out      write the brief-format CSV (14 columns)
 *   --route    only rows for this route (repeatable)
 *   --compare  print added / removed / moved / reclassified rows against another
 *              CSV in the same columns (the 38.4 brief's, or a previous run)
 *   --sites    write every classified foreground (backed, bare, mixed, unmounted)
 *              as JSON, for hand verification
 *   --d24      print the D-24 figure (red `danger` bare sites ÷ all bare sites)
 *              in the three 38.5-01 units, plus the per-combination breakdown
 *              (38.5-09 M-2, C2-M3): a `see-through-entry` or
 *              `combination-dependent` row counts as bare (it is on the art in
 *              at least one combination); per combination it counts as bare
 *              only where it is on the art, and as backed elsewhere
 *
 * Rows are matched on route + file + component + element + token, tolerant of
 * line drift (pass 1: same line; pass 2: in source order within the key;
 * pass 3: route + file + element + token, ignoring the component name; pass 4:
 * route + file + component + element with a changed token, reported as
 * "retokened"). The pass each match used is printed.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  type BareTextRow,
  classifyBareTextSites,
  type ForegroundSite,
  parseCsv,
  rowsToCsv,
  type SourceFileInput,
  splitFileLine,
} from "../src/theme/__contract__/bare-text-sites";
import { ART_COMBINATION_KEYS } from "../src/theme/art-treatments";

const REPO = join(__dirname, "..");
const ROOTS = ["src/screens", "src/components", "src/navigation"];

function collect(dir: string, out: SourceFileInput[]) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__dev__" || name === "__tests__") continue;
      collect(full, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push({
        file: relative(REPO, full).split("\\").join("/"),
        source: readFileSync(full, "utf8"),
      });
    }
  }
}

function args(argv: string[]) {
  const out: {
    out?: string;
    compare?: string;
    sites?: string;
    d24?: boolean;
    routes: string[];
  } = { routes: [] };
  for (let i = 0; i < argv.length; i += 2) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === "--out") out.out = v;
    else if (a === "--compare") out.compare = v;
    else if (a === "--sites") out.sites = v;
    else if (a === "--route") out.routes.push(v);
    else if (a === "--d24") out.d24 = v !== "0";
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

/** Brief tokens: `textPrimary(default)`, `expr:textSecondary`; compare on the palette key. */
function normToken(t: string): string {
  return t
    .split("|")
    .map((x) => x.replace(/\(default\)$/, "").replace(/^expr:/, ""))
    .sort()
    .join("|");
}

interface Keyed {
  route: string;
  file: string;
  line: number;
  component: string;
  element: string;
  token: string;
  bareKind: string;
}

function fromBrief(r: Record<string, string>): Keyed {
  const [file, line] = splitFileLine(r["file:line"]);
  return {
    route: r["screen/route"],
    file,
    line,
    component: r.component,
    element: r.element,
    token: r.token,
    bareKind: r.bare_kind,
  };
}

function fromRow(r: BareTextRow): Keyed {
  const [file, line] = splitFileLine(r.fileLine);
  return {
    route: r.route,
    file,
    line,
    component: r.component,
    element: r.element,
    token: r.token,
    bareKind: r.bareKind,
  };
}

function compare(
  briefRows: Keyed[],
  newRows: Keyed[],
  sites: ForegroundSite[],
) {
  const pairs: { b: Keyed; n: Keyed; pass: string }[] = [];
  let bLeft = [...briefRows];
  let nLeft = [...newRows];
  const passes: [string, (k: Keyed) => string, boolean][] = [
    [
      "pass1:same-line",
      (k) =>
        `${k.route}|${k.file}|${k.component}|${k.element}|${normToken(k.token)}|${k.line}`,
      false,
    ],
    [
      "pass2:source-order",
      (k) =>
        `${k.route}|${k.file}|${k.component}|${k.element}|${normToken(k.token)}`,
      true,
    ],
    [
      "pass3:ignore-component",
      (k) => `${k.route}|${k.file}|${k.element}|${normToken(k.token)}`,
      true,
    ],
    // A token change at the same element (e.g. the 38.4-16 accent → accentText misrole swap).
    [
      "pass4:retokened",
      (k) => `${k.route}|${k.file}|${k.component}|${k.element}`,
      true,
    ],
  ];
  for (const [pass, keyOf] of passes) {
    const groups = new Map<string, Keyed[]>();
    for (const n of nLeft)
      groups.set(keyOf(n), [...(groups.get(keyOf(n)) ?? []), n]);
    for (const g of groups.values()) g.sort((a, b) => a.line - b.line);
    const matchedN = new Set<Keyed>();
    const matchedB = new Set<Keyed>();
    const sortedB = [...bLeft].sort((a, b) => a.line - b.line);
    for (const b of sortedB) {
      const g = groups.get(keyOf(b));
      const n = g?.find((x) => !matchedN.has(x));
      if (!n) continue;
      matchedN.add(n);
      matchedB.add(b);
      pairs.push({ b, n, pass });
    }
    bLeft = bLeft.filter((b) => !matchedB.has(b));
    nLeft = nLeft.filter((n) => !matchedN.has(n));
  }
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  for (const { b, n, pass } of pairs) {
    bump(pass);
    const moved = b.line !== n.line;
    const kind = b.bareKind !== n.bareKind;
    const retok = normToken(b.token) !== normToken(n.token);
    const tag = kind
      ? "! reclassified"
      : retok
        ? "! retokened"
        : moved
          ? "~ moved"
          : "= exact";
    bump(tag);
    console.log(
      `${tag.padEnd(15)} [${pass}] ${n.route} ${b.file}:${b.line}${moved ? `→${n.line}` : ""} ${n.component} ${n.element} ${n.token}${kind ? ` (${b.bareKind}→${n.bareKind})` : ""}${normToken(b.token) !== normToken(n.token) ? ` (brief token ${b.token})` : ""}`,
    );
  }
  for (const b of bLeft) {
    // Why is it gone? Look for the same element in the file among ALL classified sites.
    const same = sites.filter(
      (s) =>
        s.file === b.file &&
        s.element === b.element &&
        normToken(s.token) === normToken(b.token),
    );
    const near = same.sort(
      (x, y) => Math.abs(x.line - b.line) - Math.abs(y.line - b.line),
    )[0];
    let why = "no matching foreground in the file";
    if (near) {
      why =
        near.classification === "backed"
          ? `now backed (${near.backingKinds.join("+")}) at :${near.line}`
          : near.classification === "unmounted"
            ? `unmounted at :${near.line}`
            : `site :${near.line} is ${near.classification} but not on route ${b.route} (routes: ${near.bareRoutes.join(" ") || "-"})`;
    } else {
      const anyTok = sites
        .filter((s) => s.file === b.file && s.element === b.element)
        .sort(
          (x, y) => Math.abs(x.line - b.line) - Math.abs(y.line - b.line),
        )[0];
      if (anyTok && Math.abs(anyTok.line - b.line) < 40)
        why = `nearest ${b.element} :${anyTok.line} has token ${anyTok.token} (${anyTok.classification})`;
    }
    bump("- removed");
    console.log(
      `${"- removed".padEnd(15)} ${b.route} ${b.file}:${b.line} ${b.component} ${b.element} ${b.token} — ${why}`,
    );
  }
  for (const n of nLeft) {
    bump("+ added");
    console.log(
      `${"+ added".padEnd(15)} ${n.route} ${n.file}:${n.line} ${n.component} ${n.element} ${n.token} (${n.bareKind})`,
    );
  }
  console.log(
    `\nmatch method: route+file+component+element+token (line-drift tolerant), 4 passes`,
  );
  console.log(`compare summary: ${JSON.stringify(counts)}`);
  console.log(
    `brief rows ${briefRows.length}; new rows ${newRows.length}; matched ${pairs.length}`,
  );
}

/** A row whose rendered colour can be the red `danger` token. */
function isDanger(token: string): boolean {
  return normToken(token).split("|").includes("danger");
}

/** The three 38.5-01 D-24 units over a set of rows (C2-M3 counting). */
function d24Units(rows: readonly BareTextRow[]) {
  const bareOnly = rows.filter((r) => r.bareKind !== "mixed");
  const unit = (rs: readonly BareTextRow[], unique: boolean) => {
    const keyOf = (r: BareTextRow) =>
      unique ? r.fileLine : `${r.route}|${r.fileLine}`;
    const all = new Set(rs.map(keyOf));
    const danger = new Set(rs.filter((r) => isDanger(r.token)).map(keyOf));
    return { numerator: danger.size, denominator: all.size };
  };
  return {
    "bare-only, unique file:line": unit(bareOnly, true),
    "bare + mixed, unique file:line": unit(rows, true),
    "per-route row": unit(rows, false),
  };
}

function pct(u: { numerator: number; denominator: number }): string {
  return u.denominator === 0
    ? "n/a"
    : `${((100 * u.numerator) / u.denominator).toFixed(2)}%`;
}

function printD24(rows: readonly BareTextRow[]) {
  const kinds: Record<string, number> = {};
  for (const r of rows) kinds[r.bareKind] = (kinds[r.bareKind] ?? 0) + 1;
  console.log(
    `\nD-24 FINAL (treatment-aware, C2-M3); rows by bare_kind ${JSON.stringify(kinds)}`,
  );
  for (const [name, u] of Object.entries(d24Units(rows)))
    console.log(`  ${name}: ${u.numerator} / ${u.denominator} = ${pct(u)}`);
  console.log(
    "per-combination breakdown (each row bare only where it is on the art):",
  );
  const header = ["combination", ...Object.keys(d24Units([]))];
  console.log(`  ${header.join(" | ")}`);
  for (const key of ART_COMBINATION_KEYS) {
    const onArt = rows.filter((r) => r.onArtKeys.includes(key));
    const u = d24Units(onArt);
    console.log(
      `  ${key} | ${Object.values(u)
        .map((x) => `${x.numerator}/${x.denominator} = ${pct(x)}`)
        .join(" | ")}`,
    );
  }
}

function main() {
  const opts = args(process.argv.slice(2));
  const files: SourceFileInput[] = [];
  for (const r of ROOTS) collect(join(REPO, r), files);
  const analysis = classifyBareTextSites(files);
  let rows = analysis.rows;
  if (opts.routes.length)
    rows = rows.filter((r) => opts.routes.includes(r.route));

  const byClass: Record<string, number> = {};
  for (const s of analysis.sites)
    byClass[s.classification] = (byClass[s.classification] ?? 0) + 1;
  const uniq = (xs: string[]) => new Set(xs).size;
  console.log(
    `foregrounds ${analysis.sites.length}: ${JSON.stringify(byClass)}`,
  );
  const uniqOf = (kind: string) =>
    uniq(rows.filter((r) => r.bareKind === kind).map((r) => r.fileLine));
  console.log(
    `rows ${rows.length}; unique file:line bare ${uniqOf("bare")}, mixed ${uniqOf("mixed")}, see-through-entry ${uniqOf("see-through-entry")}, combination-dependent ${uniqOf("combination-dependent")}; routes ${uniq(rows.map((r) => r.route))}`,
  );
  if (opts.d24) printD24(rows);

  if (opts.out) {
    writeFileSync(resolve(REPO, opts.out), rowsToCsv(rows));
    console.log(`wrote ${opts.out}`);
  }
  if (opts.sites) {
    const slim = analysis.sites.map((s) => ({
      ...s,
      chains: s.chains.map((c) => ({ ...c, note: c.note.join(" < ") })),
    }));
    writeFileSync(resolve(REPO, opts.sites), JSON.stringify(slim, null, 1));
    console.log(`wrote ${opts.sites}`);
  }
  if (opts.compare) {
    let brief = parseCsv(readFileSync(resolve(REPO, opts.compare), "utf8")).map(
      fromBrief,
    );
    if (opts.routes.length)
      brief = brief.filter((b) => opts.routes.includes(b.route));
    console.log(`\n--compare ${opts.compare}`);
    compare(brief, rows.map(fromRow), analysis.sites);
  }
}

main();
