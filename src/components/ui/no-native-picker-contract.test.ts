/**
 * 38.9 D-28: no production file imports `@react-native-picker/picker`. Every
 * single choice opens the one themed `OptionSheet` (src/components/ui), at
 * every list length; there are no native spinners.
 *
 * The scan parses each production file under `src/` (tests excluded) plus
 * `App.tsx` with the TypeScript compiler, so a comment or prose mention never
 * counts, and it catches every load form: `import … from`, side-effect
 * `import "…"`, `export … from`, `import x = require(…)`, dynamic `import()`
 * and `require()`, including subpath specifiers.
 *
 * The npm dependency itself stays installed for now: removing it changes
 * native autolinking, so it is left to a plan that builds native anyway
 * (38.9 RESEARCH, this plan only).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(ROOT, "src");
const BANNED = "@react-native-picker/picker";

function productionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...productionFiles(path));
    } else if (/\.tsx?$/.test(name) && !name.includes(".test.")) {
      out.push(path);
    }
  }
  return out;
}

const isBanned = (node: ts.Node | undefined): boolean =>
  node !== undefined &&
  ts.isStringLiteralLike(node) &&
  (node.text === BANNED || node.text.startsWith(`${BANNED}/`));

/** Every banned load in `text`, as 1-based line numbers. */
function nativePickerLoads(file: string, text: string): number[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lines: number[] = [];
  const hit = (node: ts.Node) =>
    lines.push(source.getLineAndCharacterOfPosition(node.getStart()).line + 1);
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      isBanned(node.moduleSpecifier)
    ) {
      hit(node);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      isBanned(node.moduleReference.expression)
    ) {
      hit(node);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require")) &&
      isBanned(node.arguments[0])
    ) {
      hit(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return lines;
}

describe("no native picker (D-28)", () => {
  it("no production file under src/ or App.tsx loads @react-native-picker/picker", () => {
    const files = [...productionFiles(SRC)];
    const app = join(ROOT, "App.tsx");
    if (existsSync(app)) files.push(app);
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      // A file that never spells the specifier cannot load it; parse the rest.
      if (!text.includes(BANNED)) return [];
      return nativePickerLoads(file, text).map(
        (line) =>
          `${relative(ROOT, file)}:${line} loads ${BANNED}; use OptionSheet (D-28)`,
      );
    });
    expect(offenders).toEqual([]);
  }, 30_000);

  describe("the scan itself", () => {
    const cases: Array<[string, string]> = [
      ["named import", `import { Picker } from "${BANNED}";`],
      ["default import", `import Picker from "${BANNED}";`],
      ["side-effect import", `import "${BANNED}";`],
      ["type import", `import type { PickerProps } from "${BANNED}";`],
      ["re-export", `export { Picker } from "${BANNED}";`],
      ["star re-export", `export * from "${BANNED}";`],
      ["import equals", `import P = require("${BANNED}");`],
      ["dynamic import", `const m = await import("${BANNED}");`],
      ["require", `const { Picker } = require("${BANNED}");`],
      ["subpath", `import x from "${BANNED}/js/Picker";`],
    ];
    it.each(cases)("catches a %s", (_name, text) => {
      expect(nativePickerLoads("probe.tsx", text)).toEqual([1]);
    });

    it("ignores comments, prose strings and look-alike packages", () => {
      const text = [
        `// replaces every ${BANNED} spinner`,
        `/** ${BANNED} */`,
        `const note = "the old ${BANNED} spinner";`,
        `import x from "${BANNED}-extra";`,
        `import DateTimePicker from "@react-native-community/datetimepicker";`,
      ].join("\n");
      expect(nativePickerLoads("probe.tsx", text)).toEqual([]);
    });
  });
});
