/**
 * Repo-wide placeholder token contract (RG-029 `ui-accessibility/AUD-UIA-001`;
 * D-24 follow-through, research Pitfall 9; T-38.4-16-01).
 *
 * Inside a Standard-Light glass/chrome scope, `textSecondary` resolves to the
 * primary text colour (`glass-foregrounds.ts`). A placeholder painted with
 * `textSecondary` there reads exactly like entered text. `textPlaceholder`
 * carries the same value as `textSecondary` in every palette but is never
 * overridden by the scope, so every `placeholderTextColor` in the app must use
 * it.
 *
 * The scan parses every `src/**\/*.tsx` file with the TypeScript compiler and
 * checks both JSX props (`placeholderTextColor={...}`) and object-literal keys
 * (`{ placeholderTextColor: ... }`, e.g. a spread props bag).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");
const REQUIRED = "colors.textPlaceholder";

/**
 * Documented exceptions: `file:line` → reason. A prop may use another token
 * only when it deliberately does so, with the reason written here. Empty today.
 */
const ALLOWLIST: Record<string, string> = {};

interface PlaceholderSite {
  file: string;
  line: number;
  expression: string;
}

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "__snapshots__") continue;
      walk(path, out);
    } else if (name.endsWith(".tsx") && !name.endsWith(".test.tsx")) {
      out.push(path);
    }
  }
  return out;
}

/** Every placeholderTextColor value in one source file, with its 1-based line. */
function placeholderSites(file: string, source: string): PlaceholderSite[] {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const sites: PlaceholderSite[] = [];
  const record = (node: ts.Node, value: ts.Node | undefined) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    sites.push({
      file,
      line,
      expression: value ? value.getText(sf).replace(/\s+/g, "") : "<none>",
    });
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sf) === "placeholderTextColor"
    ) {
      const init = node.initializer;
      record(node, init && ts.isJsxExpression(init) ? init.expression : init);
    } else if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(sf) === "placeholderTextColor"
    ) {
      record(node, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return sites;
}

/** The sites that violate the contract (not the token and not allowlisted). */
function placeholderViolations(sites: PlaceholderSite[]): string[] {
  return sites
    .filter(
      (site) =>
        site.expression !== REQUIRED &&
        ALLOWLIST[`${site.file}:${site.line}`] === undefined,
    )
    .map((site) => `${site.file}:${site.line} uses ${site.expression}`);
}

describe("placeholder token contract (RG-029, D-24)", () => {
  const files = walk(SRC, []);
  const sites = files.flatMap((path) =>
    placeholderSites(
      relative(join(SRC, ".."), path),
      readFileSync(path, "utf8"),
    ),
  );

  it("finds the app's placeholder props (the scan is not vacuous)", () => {
    // 77 since 38.9-13: the Memory meaningful date (D-65) and the custom Date
    // field (D-66) became native date pickers, so their two TextInputs and
    // placeholder props are gone. 63 since 38.10-18 (2026-10-13): the retired
    // kind editor (6) and ThingsToRememberScreen (1) deleted; MemoryEditor's
    // value field (-1), RelationshipEditor's note field (-1; plan 15,
    // convergence c1 F-U1), the share screen (Capture -2, its confirmation
    // card +1), Add/Edit Contact (-2 each), Update Contact (-1) and the
    // history editor (-2) moved to the shared EntryTextField (one site, +1);
    // OffLimitsForm added 2. 38.10-09 had held a transitional floor of 43
    // while those plans ran. 62 since 38.10-25 (2026-10-14, D-136 S5): the
    // share confirmation card's note moved to the shared EntryTextField
    // (already counted once), so its own site is gone (-1).
    expect(sites.length).toBeGreaterThanOrEqual(62);
  });

  it("every placeholderTextColor uses colors.textPlaceholder", () => {
    expect(placeholderViolations(sites)).toEqual([]);
  });

  it("fails when one prop is reverted to the secondary text token", () => {
    const reverted = placeholderSites(
      "fixture.tsx",
      [
        "export const A = () => (",
        "  <TextInput placeholderTextColor={colors.textPlaceholder} />",
        ");",
        "export const B = () => (",
        "  <TextInput placeholderTextColor={colors.textSecondary} />",
        ");",
        "const bag = { placeholderTextColor: colors.textSecondary };",
      ].join("\n"),
    );
    expect(placeholderViolations(reverted)).toEqual([
      "fixture.tsx:5 uses colors.textSecondary",
      "fixture.tsx:7 uses colors.textSecondary",
    ]);
  });

  it("every allowlist entry still points at a live placeholder prop", () => {
    const live = new Set(sites.map((site) => `${site.file}:${site.line}`));
    for (const key of Object.keys(ALLOWLIST)) expect(live.has(key)).toBe(true);
  });
});
