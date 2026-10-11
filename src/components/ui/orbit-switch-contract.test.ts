/**
 * 38.9 D-47 (with D-25): every switch in the app is the Orbit switch. No
 * production file reaches React Native's `Switch` (named, aliased, re-exported,
 * namespace/default member access, dynamic `import()`/`require()`), and no
 * production file renders a raw `<Switch>` JSX tag. OrbitSwitch itself is
 * custom-drawn, so it has no exemption.
 *
 * It also pins the OrbitSwitch animation rules: the thumb animates from a
 * Reanimated shared value with `withTiming`, never from React state (CLAUDE.md
 * animation rule), and the worklet helper is defined above its caller (owner
 * memory worklet-forward-ref-hazard).
 *
 * The scan parses each file with the TypeScript compiler, so comments and
 * strings never count.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(ROOT, "src");
const ORBIT_SWITCH = join(SRC, "components", "ui", "OrbitSwitch.tsx");

function productionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__contract__") continue; // test support only
      out.push(...productionFiles(path));
    } else if (/\.tsx?$/.test(name) && !name.includes(".test.")) {
      out.push(path);
    }
  }
  return out;
}

function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
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

const isSwitchName = (name: ts.Node | undefined) =>
  name !== undefined &&
  (ts.isIdentifier(name) || ts.isStringLiteral(name)) &&
  name.text === "Switch";

/** Each place `text` reaches RN's Switch or renders `<Switch>`, as "line: form". */
function findRnSwitchUses(file: string, text: string): string[] {
  const source = parse(file, text);
  const hits: string[] = [];
  const line = (node: ts.Node) =>
    source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const rnNamespaces = new Set<string>();

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
        for (const el of bindings.elements) {
          if (isSwitchName(el.propertyName ?? el.name)) {
            hits.push(`${line(el)}: import`);
          }
        }
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      isReactNative(statement.moduleSpecifier) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const el of statement.exportClause.elements) {
        if (isSwitchName(el.propertyName ?? el.name)) {
          hits.push(`${line(el)}: re-export`);
        }
      }
    }
  }

  const visit = (node: ts.Node): void => {
    // RN.Switch / ReactNative.Switch
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "Switch" &&
      ((ts.isIdentifier(node.expression) &&
        rnNamespaces.has(node.expression.text)) ||
        isRnLoad(node.expression))
    ) {
      hits.push(`${line(node)}: member access`);
    }
    // const { Switch } = require("react-native") / await import("react-native")
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isObjectBindingPattern(node.name)
    ) {
      let init: ts.Expression = node.initializer;
      if (ts.isAwaitExpression(init)) init = init.expression;
      if (isRnLoad(init)) {
        for (const el of node.name.elements) {
          if (isSwitchName(el.propertyName ?? el.name)) {
            hits.push(`${line(el)}: dynamic load`);
          }
        }
      }
    }
    // <Switch …> / <RN.Switch …>
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (tag === "Switch" || tag.endsWith(".Switch")) {
        hits.push(`${line(node)}: <${tag}>`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

describe("D-47: no production file renders React Native's Switch", () => {
  it("the scanner catches every import and render form (self-test)", () => {
    const fixture = [
      'import { Switch } from "react-native";',
      'import { Switch as RnSwitch } from "react-native";',
      'import * as RN from "react-native";',
      'export { Switch } from "react-native";',
      'const { Switch: S2 } = require("react-native");',
      "const a = RN.Switch;",
      "const b = <Switch />;",
      "const c = <RN.Switch value />;",
    ].join("\n");
    const hits = findRnSwitchUses("fixture.tsx", fixture);
    expect(hits.length).toBe(8);
    // Comments and strings never count; OrbitSwitch is not RN's Switch.
    expect(
      findRnSwitchUses(
        "clean.tsx",
        '// <Switch />\nconst s = "<Switch>";\nconst d = <OrbitSwitch value />;',
      ),
    ).toEqual([]);
  });

  it("finds no RN Switch import or <Switch> tag in any production file", () => {
    const offenders: string[] = [];
    for (const file of productionFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      // Every form the scanner catches names `Switch`; skip the parse otherwise.
      if (!text.includes("Switch")) continue;
      for (const hit of findRnSwitchUses(file, text)) {
        offenders.push(`${relative(ROOT, file)}:${hit}`);
      }
    }
    expect(offenders).toEqual([]);
  }, 30_000);
});

describe("OrbitSwitch animation rules (CLAUDE.md; worklet-forward-ref-hazard)", () => {
  const text = readFileSync(ORBIT_SWITCH, "utf8");
  const source = parse(ORBIT_SWITCH, text);

  it("animates the thumb from a Reanimated shared value with withTiming", () => {
    expect(text).toContain("useSharedValue");
    expect(text).toContain("withTiming");
    expect(text).toContain("useAnimatedStyle");
  });

  it("never holds animation in React state", () => {
    const calls: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        calls.push(node.expression.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(calls).not.toContain("useState");
    expect(calls).not.toContain("useReducer");
    expect(calls.filter((name) => /^set[A-Z]/.test(name))).toEqual([]);
  });

  it("defines every worklet function above its first caller", () => {
    const worklets = new Map<string, number>();
    for (const statement of source.statements) {
      if (
        ts.isFunctionDeclaration(statement) &&
        statement.name &&
        statement.body?.statements[0] &&
        ts.isExpressionStatement(statement.body.statements[0]) &&
        ts.isStringLiteral(statement.body.statements[0].expression) &&
        statement.body.statements[0].expression.text === "worklet"
      ) {
        worklets.set(statement.name.text, statement.getStart());
      }
    }
    expect(worklets.size).toBeGreaterThan(0);
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        worklets.has(node.expression.text)
      ) {
        expect(node.getStart()).toBeGreaterThan(
          worklets.get(node.expression.text) ?? Number.POSITIVE_INFINITY,
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  });
});

describe("the Orrery satellites switches keep announcing busy (C5-M2)", () => {
  for (const file of [
    "src/components/orrery/OrreryViewOptions.tsx",
    "src/screens/SettingsOrreryScreen.tsx",
  ]) {
    it(`${file} passes busy to its OrbitSwitch`, () => {
      const text = readFileSync(join(ROOT, file), "utf8");
      const start = text.indexOf("<OrbitSwitch");
      expect(start).toBeGreaterThan(-1);
      const region = text.slice(start, text.indexOf("/>", start));
      expect(region).toContain('accessibilityLabel="Relationship Satellites"');
      expect(region).toContain("busy={busy}");
    });
  }
});
