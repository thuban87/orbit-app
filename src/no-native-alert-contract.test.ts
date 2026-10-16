/**
 * 38.9 D-27 (with D-10): no production file reaches React Native's `Alert`
 * API. 38.11 replaced the last one, the Contacts card snooze dialog, with the
 * shared snooze sheet (38.11 D-45). Every decision is a themed `confirm()`,
 * every blocking message a themed `notice()`, and everything else a snackbar
 * or a sheet (`src/stores/confirm-store.ts`, `src/stores/snackbar-store.ts`).
 *
 * The scan parses each production file with the TypeScript compiler, so
 * comments and strings never count (RESEARCH Pitfall 4), and it catches every
 * import form: named, aliased, re-exported, namespace/default member access,
 * and dynamic `import()` / `require()` destructuring or member access (the
 * form `widget-linking.ts` used before 38.9-05).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const HOME = ["src", "screens", "HomeScreen.tsx"].join("/");

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

const isAlertName = (name: ts.Node | undefined) =>
  name !== undefined &&
  (ts.isIdentifier(name) || ts.isStringLiteral(name)) &&
  name.text === "Alert";

function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/** Each place `text` reaches React Native's `Alert`, as "line: form". */
function findRnAlertUses(file: string, text: string): string[] {
  const source = parse(file, text);
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
          if (isAlertName(element.propertyName ?? element.name)) {
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
          if (isAlertName(element.propertyName ?? element.name)) {
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

  const scan = (node: ts.Node) => {
    // `RN.Alert` on a namespace or default import, or directly on
    // `require("react-native")` / `(await import("react-native"))`.
    if (ts.isPropertyAccessExpression(node) && node.name.text === "Alert") {
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
      isAlertName(node.argumentExpression)
    ) {
      hits.push(`${line(node)}: element access`);
    }
    // `const { Alert } = await import("react-native")`, `.then(({ Alert }) =>`.
    if (
      loadsRnDynamically &&
      ts.isBindingElement(node) &&
      isAlertName(node.propertyName ?? node.name)
    ) {
      hits.push(`${line(node)}: dynamic destructure`);
    }
    ts.forEachChild(node, scan);
  };
  scan(source);
  return hits;
}

/** Lines of every `Alert.alert(...)` call in `text` (comments ignored). */
function alertCallLines(file: string, text: string): number[] {
  const source = parse(file, text);
  const lines: number[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "alert" &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "Alert"
    ) {
      lines.push(
        source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return lines;
}

const files = [...productionFiles(SRC), join(ROOT, "App.tsx")];
const rel = (file: string) => relative(ROOT, file).split(sep).join("/");

describe("no native Alert anywhere in production code (38.9 D-27; 38.11 D-45)", () => {
  it("scans the whole app", () => {
    expect(files.length).toBeGreaterThan(300);
    expect(files.map(rel)).toContain(HOME);
    expect(files.map(rel)).toContain("App.tsx");
  });

  it("no production file reaches React Native's Alert", () => {
    const offenders = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      // Every form names both; skip the parse for files that cannot match.
      if (!text.includes("react-native") || !text.includes("Alert")) {
        return [];
      }
      return findRnAlertUses(file, text).map((hit) => `${rel(file)}:${hit}`);
    });
    expect(
      offenders,
      "use confirm()/notice() (src/stores/confirm-store.ts) or showSnackbar() instead",
    ).toEqual([]);
  }, 30_000);

  it("no production file calls Alert.alert, HomeScreen included (38.11 D-45)", () => {
    const calls = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      if (!text.includes("Alert")) return [];
      return alertCallLines(file, text).map((line) => `${rel(file)}:${line}`);
    });
    expect(calls).toEqual([]);
    const home = join(ROOT, HOME);
    expect(findRnAlertUses(home, readFileSync(home, "utf8"))).toEqual([]);
  });
});

describe("findRnAlertUses detects every import form", () => {
  const cases: [string, string][] = [
    ["named", 'import { Alert, View } from "react-native";'],
    ["aliased", 'import { Alert as NativeAlert } from "react-native";'],
    ["re-export", 'export { Alert } from "react-native";'],
    ["namespace", 'import * as RN from "react-native";\nRN.Alert.alert("x");'],
    ["default", 'import RN from "react-native";\nRN.Alert.alert("x");'],
    ["element", 'import * as RN from "react-native";\nconst A = RN["Alert"];'],
    [
      "dynamic destructure",
      'async function f() { const { Alert } = await import("react-native"); Alert.alert("x"); }',
    ],
    [
      "dynamic then-destructure",
      'void import("react-native").then(({ Alert }) => Alert.alert("x"));',
    ],
    [
      "dynamic member",
      'async function f() { (await import("react-native")).Alert.alert("x"); }',
    ],
    ["require member", 'require("react-native").Alert.alert("x");'],
    ["require destructure", 'const { Alert: A } = require("react-native");'],
  ];
  it.each(cases)("%s", (_name, text) => {
    expect(findRnAlertUses("fixture.ts", text)).toHaveLength(1);
  });

  it("ignores comments, strings, other modules and other Alert names", () => {
    const text = [
      '// import { Alert } from "react-native";',
      '/* const { Alert } = await import("react-native"); Alert.alert("x"); */',
      'const label = "Alert from react-native";',
      'import { Alert } from "some-other-lib";',
      'import { View } from "react-native";',
      "const AlertBanner = null;",
    ].join("\n");
    expect(findRnAlertUses("fixture.tsx", text)).toEqual([]);
  });
});
