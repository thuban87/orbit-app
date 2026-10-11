/**
 * 38.9 D-24 / D-40: every RN `Modal` window in the app goes through
 * `RegisteredModal`, so it reports "open" to the overlay registry (the Phase 39
 * D-58/D-97 signal) and carries an in-window snackbar host. A file that imports
 * React Native's `Modal` directly would open a window the registry cannot see
 * and that hides every snackbar under it (RESEARCH Pitfall 5).
 *
 * The scan parses each production file with the TypeScript compiler, so
 * comments and strings never count, and it catches every import form: named,
 * aliased, re-exported, namespace/default member access, and dynamic
 * `import()` / `require()` destructuring or member access.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(ROOT, "src");
const ALLOWED = join("src", "components", "ui", "RegisteredModal.tsx");

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

const isReactNative = (node: ts.Node | undefined) =>
  node !== undefined &&
  ts.isStringLiteral(node) &&
  node.text === "react-native";

const isRnLoad = (node: ts.Node): boolean =>
  ts.isCallExpression(node) &&
  (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
    (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
  isReactNative(node.arguments[0]);

/** Each place `text` reaches React Native's `Modal`, as "line: form". */
function findRnModalUses(file: string, text: string): string[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits: string[] = [];
  const line = (node: ts.Node) =>
    source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const rnNamespaces = new Set<string>();
  let loadsRnDynamically = false;

  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      isReactNative(statement.moduleSpecifier)
    ) {
      const clause = statement.importClause;
      if (clause?.name) rnNamespaces.add(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) {
        rnNamespaces.add(bindings.name.text);
      } else if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if ((element.propertyName ?? element.name).text === "Modal") {
            hits.push(`${line(element)}: named import`);
          }
        }
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      isReactNative(statement.moduleSpecifier)
    ) {
      const clause = statement.exportClause;
      if (!clause) hits.push(`${line(statement)}: export *`);
      else if (ts.isNamedExports(clause)) {
        for (const element of clause.elements) {
          if ((element.propertyName ?? element.name).text === "Modal") {
            hits.push(`${line(element)}: re-export`);
          }
        }
      }
    }
  }

  const visit = (node: ts.Node) => {
    if (isRnLoad(node)) loadsRnDynamically = true;
    ts.forEachChild(node, visit);
  };
  visit(source);

  const isModalName = (name: ts.Node | undefined) =>
    name !== undefined &&
    (ts.isIdentifier(name) || ts.isStringLiteral(name)) &&
    name.text === "Modal";

  const scan = (node: ts.Node) => {
    // `RN.Modal` / `RN["Modal"]` on a namespace or default import, or directly
    // on `require("react-native")` / `(await import("react-native"))`.
    if (ts.isPropertyAccessExpression(node) && node.name.text === "Modal") {
      const target = ts.isParenthesizedExpression(node.expression)
        ? node.expression.expression
        : node.expression;
      const base = ts.isAwaitExpression(target) ? target.expression : target;
      if (
        (ts.isIdentifier(base) && rnNamespaces.has(base.text)) ||
        isRnLoad(base)
      ) {
        hits.push(`${line(node)}: member access`);
      }
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      rnNamespaces.has(node.expression.text) &&
      isModalName(node.argumentExpression)
    ) {
      hits.push(`${line(node)}: element access`);
    }
    // `const { Modal } = await import("react-native")`, `.then(({ Modal }) =>`.
    if (
      loadsRnDynamically &&
      ts.isBindingElement(node) &&
      isModalName(node.propertyName ?? node.name)
    ) {
      hits.push(`${line(node)}: dynamic destructure`);
    }
    ts.forEachChild(node, scan);
  };
  scan(source);
  return hits;
}

const files = [...productionFiles(SRC), join(ROOT, "App.tsx")];

describe("only RegisteredModal renders React Native's Modal (38.9 D-24)", () => {
  it("scans the whole app", () => {
    expect(files.length).toBeGreaterThan(300);
    expect(files.map((file) => relative(ROOT, file))).toContain(ALLOWED);
  });

  it("no production file other than RegisteredModal.tsx imports Modal from react-native", () => {
    const offenders = files
      .filter((file) => relative(ROOT, file) !== ALLOWED)
      .flatMap((file) => {
        const text = readFileSync(file, "utf8");
        // Every form names both; skip the parse for files that cannot match.
        if (!text.includes("react-native") || !text.includes("Modal")) {
          return [];
        }
        return findRnModalUses(file, text).map(
          (hit) => `${relative(ROOT, file).split(sep).join("/")}:${hit}`,
        );
      });
    expect(
      offenders,
      "render the window through RegisteredModal (src/components/ui/RegisteredModal.tsx) instead",
    ).toEqual([]);
  }, 30_000);

  it("RegisteredModal itself is the one importer the scan finds", () => {
    const allowed = join(ROOT, ALLOWED);
    expect(findRnModalUses(allowed, readFileSync(allowed, "utf8"))).toEqual([
      expect.stringMatching(/named import$/),
    ]);
  });

  it("BaseOverlay renders its window through RegisteredModal", () => {
    const overlay = readFileSync(
      join(SRC, "components", "ui", "overlay-base.tsx"),
      "utf8",
    );
    expect(overlay).toMatch(
      /import \{ RegisteredModal as RNModal \} from "\.\/RegisteredModal";/,
    );
    expect(findRnModalUses("overlay-base.tsx", overlay)).toEqual([]);
  });
});

describe("findRnModalUses detects every import form", () => {
  const cases: [string, string][] = [
    ["named", 'import { Modal, View } from "react-native";'],
    ["aliased", 'import { Modal as RNModal } from "react-native";'],
    ["re-export", 'export { Modal } from "react-native";'],
    ["namespace", 'import * as RN from "react-native";\nconst M = RN.Modal;'],
    ["default", 'import RN from "react-native";\nconst M = RN.Modal;'],
    ["element", 'import * as RN from "react-native";\nconst M = RN["Modal"];'],
    [
      "dynamic destructure",
      'async function f() { const { Modal } = await import("react-native"); }',
    ],
    [
      "dynamic member",
      'async function f() { return (await import("react-native")).Modal; }',
    ],
    ["require member", 'const M = require("react-native").Modal;'],
    ["require destructure", 'const { Modal: M } = require("react-native");'],
  ];
  it.each(cases)("%s", (_name, text) => {
    expect(findRnModalUses("fixture.ts", text)).toHaveLength(1);
  });

  it("ignores comments, strings, other modules and other Modal names", () => {
    const text = [
      '// import { Modal } from "react-native";',
      '/* const { Modal } = require("react-native"); */',
      'const label = "Modal from react-native";',
      'import { RegisteredModal } from "@/components/ui/RegisteredModal";',
      'import { Modal } from "some-other-lib";',
      'import { View } from "react-native";',
    ].join("\n");
    expect(findRnModalUses("fixture.tsx", text)).toEqual([]);
  });
});
