/**
 * Worklet default-parameter guard (38.7-15; the forward-reference guard's
 * sibling, orrery-worklet-order.test.ts).
 *
 * The worklets Babel plugin (react-native-worklets 0.10.4) emits a worklet's
 * UI-runtime code as `function f(p = X) { const { X } = this.__closure; … }`:
 * the closure is unpacked in the BODY, but a default-parameter initializer is
 * evaluated in the parameter scope, before the body runs, so `X` resolves
 * against the UI runtime's globals and throws `ReferenceError: Property 'X'
 * doesn't exist`. Node/vitest run the untransformed function and never see it
 * (DEBUG 6 Pro, 38.7-15: every System switch threw on
 * `beginSwitchLead(intensity = SWITCH_LEAD_INTENSITY)`).
 *
 * Rule: a "worklet" function's default parameters may be literals or refer to
 * its own earlier parameters only (`undefined`, `NaN` and `Infinity` are
 * literals here). Resolve anything else in the body instead
 * (`const x = p === undefined ? MODULE_DEFAULT : p;`), where the plugin
 * captures it. This scan fails on any default-parameter initializer of a
 * "worklet" function that references another identifier, across src/logic
 * and src/components/orrery (recursive) and every other src file that
 * declares a worklet.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const LITERAL_IDENTIFIERS = new Set(["undefined", "NaN", "Infinity"]);

function isWorkletFunction(node: ts.Node): node is ts.SignatureDeclaration & {
  body: ts.Block;
} {
  if (
    !(
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    )
  )
    return false;
  const body = node.body;
  if (!body || !ts.isBlock(body)) return false;
  const first = body.statements[0];
  return (
    !!first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === "worklet"
  );
}

/** Every name a parameter list binds (destructuring included). */
function boundNames(parameters: readonly ts.ParameterDeclaration[]) {
  const names = new Set<string>();
  const collect = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) names.add(name.text);
    else
      for (const element of name.elements)
        if (!ts.isOmittedExpression(element)) collect(element.name);
  };
  for (const parameter of parameters) collect(parameter.name);
  return names;
}

/** Identifiers an initializer READS (property names and keys excluded). */
function referencedIdentifiers(expression: ts.Expression): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      const isPropertyName =
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        (ts.isQualifiedName(parent) && parent.right === node);
      if (!isPropertyName) found.push(node.text);
    }
    // Types are erased; they never run.
    if (ts.isTypeNode(node)) return;
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
}

/** Initializers of a parameter, including those nested in destructuring. */
function initializers(parameter: ts.ParameterDeclaration): ts.Expression[] {
  const out: ts.Expression[] = [];
  if (parameter.initializer) out.push(parameter.initializer);
  const walk = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) return;
    for (const element of name.elements) {
      if (ts.isOmittedExpression(element)) continue;
      if (element.initializer) out.push(element.initializer);
      walk(element.name);
    }
  };
  walk(parameter.name);
  return out;
}

interface DefaultParamHazard {
  worklet: string;
  identifier: string;
  line: number;
}

export function scanWorkletDefaultParams(
  fileName: string,
  text: string,
): DefaultParamHazard[] {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.ES2022,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: DefaultParamHazard[] = [];
  const visit = (node: ts.Node) => {
    if (isWorkletFunction(node)) {
      const own = boundNames(node.parameters);
      const name =
        node.name && ts.isIdentifier(node.name)
          ? node.name.text
          : ts.isVariableDeclaration(node.parent) &&
              ts.isIdentifier(node.parent.name)
            ? node.parent.name.text
            : "<anonymous worklet>";
      for (const parameter of node.parameters)
        for (const initializer of initializers(parameter))
          for (const identifier of referencedIdentifiers(initializer))
            if (!own.has(identifier) && !LITERAL_IDENTIFIERS.has(identifier))
              found.push({
                worklet: name,
                identifier,
                line:
                  source.getLineAndCharacterOfPosition(
                    initializer.getStart(source),
                  ).line + 1,
              });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function sourceFiles(directory: string): string[] {
  return (readdirSync(directory, { recursive: true }) as string[])
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\./.test(name))
    .map((name) => join(directory, name));
}

describe("worklet default parameters (UI-runtime ReferenceError hazard)", () => {
  it("reports a default parameter that reads a module or outer identifier", () => {
    const fixture = `
      import { IMPORTED } from "./x";
      const MODULE_DEFAULT = 0.5;
      export function lead(intensity: number = MODULE_DEFAULT) { "worklet"; return intensity; }
      export const arrow = (look = IMPORTED.look) => { "worklet"; return look; };
      export function destructured({ a = MODULE_DEFAULT }: { a?: number }) { "worklet"; return a; }
      export function computed(x = Math.max(1, 2)) { "worklet"; return x; }
      function useHook(outer: number) {
        return useCallback((v = outer) => { "worklet"; return v; }, []);
      }
      export function plain(p = MODULE_DEFAULT) { return p; }
    `;
    expect(
      scanWorkletDefaultParams("fixture.ts", fixture).map(
        ({ worklet, identifier }) => `${worklet}:${identifier}`,
      ),
    ).toEqual([
      "lead:MODULE_DEFAULT",
      "arrow:IMPORTED",
      "destructured:MODULE_DEFAULT",
      "computed:Math",
      "<anonymous worklet>:outer",
    ]);
  });

  it("accepts literal defaults, own earlier parameters and body fallbacks", () => {
    const fixture = `
      const MODULE_DEFAULT = 0.5;
      export function ok(
        a: number,
        b = 1,
        c: string | null = null,
        d = -1,
        e = a,
        f = { x: 0, y: [1, 2] },
        g = undefined,
        h = b * 2,
        i?: number,
      ) {
        "worklet";
        const intensity = i === undefined ? MODULE_DEFAULT : i;
        return [a, b, c, d, e, f, g, h, intensity];
      }
      export function sample(runtime: { progress: number }, progress = runtime.progress) {
        "worklet";
        return progress;
      }
    `;
    expect(scanWorkletDefaultParams("ok.ts", fixture)).toEqual([]);
  });

  it("no worklet in src reads an identifier from a default parameter", () => {
    const targets = new Set([
      ...sourceFiles("src/logic"),
      ...sourceFiles("src/components/orrery"),
    ]);
    // The two directories the Orrery's worklets live in are always scanned.
    expect(targets).toContain(join("src/logic", "orrery-switch-lead-logic.ts"));
    expect(targets).toContain(
      join("src/components/orrery", "v2", "draw-bodies.ts"),
    );
    // Every other src file that declares a worklet, too.
    for (const path of sourceFiles("src"))
      if (readFileSync(path, "utf8").includes('"worklet"')) targets.add(path);
    expect(
      [...targets].flatMap((path) =>
        scanWorkletDefaultParams(path, readFileSync(path, "utf8")).map(
          (hazard) =>
            `${path}:${hazard.line} ${hazard.worklet}(… = ${hazard.identifier})`,
        ),
      ),
    ).toEqual([]);
  });
});
