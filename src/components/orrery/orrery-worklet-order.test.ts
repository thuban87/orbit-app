/**
 * Same-file worklet forward-reference guard (D-19; T-38.4-02-01).
 *
 * The Reanimated plugin captures a worklet's closure when the statement that
 * creates it runs. A top-level worklet that calls a same-file worklet declared
 * LATER therefore captures `undefined` and crashes on Hermes — a class vitest
 * cannot observe at runtime (fix f979263). This scan resolves every call made
 * from inside a worklet body with the TypeScript checker and fails when the
 * callee is a same-file worklet whose declaring statement comes after the
 * statement that creates the calling worklet.
 *
 * Only captures made at statement execution count: a worklet created later
 * (inside a non-worklet function such as a hook body or a JS callback) sees the
 * whole module and is not reported.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const TARGETS = [
  "src/logic/orrery-switch-choreography.ts",
  "src/components/orrery/use-orrery-switch-runtime.ts",
];

function isWorkletFunction(node: ts.Node | undefined): boolean {
  if (
    !node ||
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

/** A worklet declaration: `function f(){"worklet"}`, `const f = () => {"worklet"}`, `const f = useCallback(() => {"worklet"}, deps)`. */
function isWorkletDeclaration(declaration: ts.Declaration): boolean {
  if (ts.isFunctionDeclaration(declaration))
    return isWorkletFunction(declaration);
  if (!ts.isVariableDeclaration(declaration) || !declaration.initializer)
    return false;
  const init = declaration.initializer;
  if (isWorkletFunction(init)) return true;
  return ts.isCallExpression(init) && isWorkletFunction(init.arguments[0]);
}

function declaringStatement(declaration: ts.Declaration): ts.Node {
  let node: ts.Node = declaration;
  while (
    node.parent &&
    !ts.isSourceFile(node.parent) &&
    !ts.isBlock(node.parent)
  )
    node = node.parent;
  return node;
}

interface ForwardReference {
  caller: string;
  callee: string;
  line: number;
}

function scanWorkletForwardReferences(
  files: Record<string, string>,
): ForwardReference[] {
  const options: ts.CompilerOptions = {
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.Preserve,
  };
  const host = ts.createCompilerHost(options);
  const sources = new Map(
    Object.entries(files).map(([name, text]) => [
      name,
      ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true),
    ]),
  );
  host.getSourceFile = (name) => sources.get(name);
  host.fileExists = (name) => sources.has(name);
  host.readFile = (name) => files[name];
  const program = ts.createProgram([...sources.keys()], options, host);
  const checker = program.getTypeChecker();
  const found: ForwardReference[] = [];

  for (const source of sources.values()) {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
        check(node, node.expression, source);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;

  function check(
    call: ts.CallExpression,
    callee: ts.Identifier,
    source: ts.SourceFile,
  ) {
    const declaration = checker
      .getSymbolAtLocation(callee)
      ?.declarations?.find((item) => item.getSourceFile() === source);
    if (!declaration || !isWorkletDeclaration(declaration)) return;
    const calleeStatement = declaringStatement(declaration);
    const scope = calleeStatement.parent;
    // Walk from the call up to the statement in the callee's scope, requiring an
    // unbroken chain of worklet functions: that is a capture at statement time.
    let node: ts.Node = call;
    let sawWorklet = false;
    let caller = "";
    while (node.parent && node.parent !== scope) {
      node = node.parent;
      if (ts.isFunctionLike(node)) {
        if (!isWorkletFunction(node)) return;
        sawWorklet = true;
      }
      if (
        (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
        node.name &&
        ts.isIdentifier(node.name)
      )
        caller = node.name.text;
    }
    if (!sawWorklet || node.parent !== scope || node === calleeStatement)
      return;
    if (node.getStart(source) < calleeStatement.getStart(source))
      found.push({
        caller: caller || "<anonymous worklet>",
        callee: callee.text,
        line:
          source.getLineAndCharacterOfPosition(call.getStart(source)).line + 1,
      });
  }
}

function load(paths: string[]): Record<string, string> {
  return Object.fromEntries(
    paths.map((path) => [path, readFileSync(path, "utf8")]),
  );
}

describe("same-file worklet forward references (Hermes hazard)", () => {
  it("reports a worklet that calls a same-file worklet declared later", () => {
    const fixture = `
      function early(): number { "worklet"; return late() + 1; }
      function late(): number { "worklet"; return 1; }
      const arrow = (): number => { "worklet"; return laterArrow(); };
      const laterArrow = (): number => { "worklet"; return late(); };
      function nested(xs: number[]): number[] {
        "worklet";
        return xs.map((x) => { "worklet"; return x + lateNested(); });
      }
      function lateNested(): number { "worklet"; return 2; }
      function plainJs(): number { return late(); }
      function useHook() {
        const first = useCallback(() => { "worklet"; second(); }, []);
        const second = useCallback(() => { "worklet"; return late(); }, []);
        const deferred = () => runOnUI(() => { "worklet"; afterHook(); });
        return { first, second, deferred };
      }
      function afterHook(): void { "worklet"; }
    `;
    expect(
      scanWorkletForwardReferences({ "fixture.ts": fixture }).map(
        ({ caller, callee }) => `${caller}->${callee}`,
      ),
    ).toEqual([
      "early->late",
      "arrow->laterArrow",
      "nested->lateNested",
      "first->second",
    ]);
  });

  it("accepts callees declared above their worklet callers", () => {
    const fixture = `
      function base(): number { "worklet"; return 1; }
      function user(): number { "worklet"; return base(); }
      const arrowUser = (): number => { "worklet"; return user(); };
    `;
    expect(scanWorkletForwardReferences({ "ok.ts": fixture })).toEqual([]);
  });

  it.each(TARGETS)("%s has no same-file worklet forward reference", (path) => {
    expect(scanWorkletForwardReferences(load([path]))).toEqual([]);
  });

  it("every other Orrery worklet module is forward-reference free", () => {
    const logic = readdirSync("src/logic")
      .filter(
        (name) => /^orrery-.*\.ts$/.test(name) && !name.includes(".test."),
      )
      .map((name) => join("src/logic", name));
    const components = readdirSync("src/components/orrery")
      .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
      .map((name) => join("src/components/orrery", name));
    const others = [...logic, ...components].filter(
      (path) => !TARGETS.includes(path),
    );
    expect(others.length).toBeGreaterThan(0);
    expect(
      others.flatMap((path) =>
        scanWorkletForwardReferences(load([path])).map(
          (ref) => `${path}:${ref.line} ${ref.caller}->${ref.callee}`,
        ),
      ),
    ).toEqual([]);
  });
});
