/**
 * G2 regression (38.4 Plan 19, D-33, GAP-G2): the app-wide touch wedge that
 * made the Contacts screen "freeze".
 *
 * Mechanism (proven on the Pixel 3a, `38.4-G2-INVESTIGATION.md`): a View with
 * a STATIC `pointerEvents="box-none"` whose accessibility props toggle can be
 * flattened by Fabric in one state and re-formed in the other.
 * `pointerEvents: box-none` alone does not make a node form a native view
 * (`ViewShadowNode::initialize`). When the node forms a view again, Android
 * re-creates it without re-applying the unchanged `box-none`, so the new view
 * defaults to `pointerEvents: auto`. The universal FAB's full-screen dial
 * container did exactly this on every dial close and then swallowed every touch
 * below the FAB (all tabs, the Contacts controls, the list, Profile scroll)
 * until a cold start.
 *
 * Rule: such a View must declare `collapsable={false}`, so it is a permanent
 * native view that is never flattened or re-created and keeps its `box-none`.
 * A View whose `pointerEvents` value itself changes with the same state is not
 * exposed (the re-formed view always receives an explicit value) and is out of
 * this rule's scope.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");

const DYNAMIC_A11Y_PROPS = new Set([
  "importantForAccessibility",
  "accessibilityElementsHidden",
  "accessible",
]);

interface BoxNoneView {
  file: string;
  line: number;
  togglesA11y: boolean;
  collapsableFalse: boolean;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__dev__" || name === "__tests__") continue;
      out.push(...sourceFiles(path));
    } else if (name.endsWith(".tsx") && !name.includes(".test.")) {
      out.push(path);
    }
  }
  return out;
}

function isViewTag(tag: ts.JsxTagNameExpression): boolean {
  const text = tag.getText();
  return text === "View" || text === "Animated.View";
}

/** Every View/Animated.View with a literal `pointerEvents="box-none"`. */
function findStaticBoxNoneViews(file: string, text: string): BoxNoneView[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  );
  const found: BoxNoneView[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      isViewTag(node.tagName)
    ) {
      let staticBoxNone = false;
      let togglesA11y = false;
      let collapsableFalse = false;
      for (const attribute of node.attributes.properties) {
        if (ts.isJsxSpreadAttribute(attribute)) {
          // A spread (e.g. `fabDialBackgroundA11y(open)`) can toggle a11y props.
          togglesA11y = true;
          continue;
        }
        const name = attribute.name.getText();
        const init = attribute.initializer;
        if (name === "pointerEvents") {
          staticBoxNone =
            init !== undefined &&
            ts.isStringLiteral(init) &&
            init.text === "box-none";
        } else if (DYNAMIC_A11Y_PROPS.has(name)) {
          if (
            init !== undefined &&
            ts.isJsxExpression(init) &&
            init.expression !== undefined &&
            init.expression.kind !== ts.SyntaxKind.TrueKeyword &&
            init.expression.kind !== ts.SyntaxKind.FalseKeyword &&
            !ts.isStringLiteral(init.expression)
          ) {
            togglesA11y = true;
          }
        } else if (name === "collapsable") {
          collapsableFalse =
            init !== undefined &&
            ts.isJsxExpression(init) &&
            init.expression?.kind === ts.SyntaxKind.FalseKeyword;
        }
      }
      if (staticBoxNone) {
        found.push({
          file: relative(SRC, file),
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          togglesA11y,
          collapsableFalse,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const allBoxNoneViews = sourceFiles(SRC).flatMap((file) =>
  findStaticBoxNoneViews(file, readFileSync(file, "utf8")),
);

describe("G2: box-none overlays never re-form as touch sinks (D-33)", () => {
  it("the scan sees the shell overlays it guards", () => {
    const files = new Set(allBoxNoneViews.map((view) => view.file));
    expect(files).toContain(join("components", "UniversalFab.tsx"));
    expect(files).toContain(join("components", "Snackbar.tsx"));
  });

  it("every static box-none View with toggling accessibility props is collapsable={false}", () => {
    const offenders = allBoxNoneViews
      .filter((view) => view.togglesA11y && !view.collapsableFalse)
      .map((view) => `${view.file}:${view.line}`);
    expect(offenders).toEqual([]);
  });

  it("the universal FAB's full-screen dial container is a permanent native view", () => {
    const text = readFileSync(
      join(SRC, "components", "UniversalFab.tsx"),
      "utf8",
    );
    const dial = text.slice(
      text.lastIndexOf("<View", text.indexOf("style={styles.dial}")),
      text.indexOf("style={styles.dial}"),
    );
    expect(dial).toContain('pointerEvents="box-none"');
    expect(dial).toContain("collapsable={false}");
  });

  it("the detector flags the pre-fix dial shape and accepts the fixed one", () => {
    const broken = `const a = (<View
      accessibilityViewIsModal
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      accessibilityElementsHidden={!open}
      pointerEvents="box-none"
      style={styles.dial}
    />);`;
    const fixed = broken.replace(
      'pointerEvents="box-none"',
      'collapsable={false}\n      pointerEvents="box-none"',
    );
    const dynamicPointerEvents = `const b = (<View
      pointerEvents={blocked ? "none" : "box-none"}
      importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
    />);`;
    expect(findStaticBoxNoneViews("x.tsx", broken)).toEqual([
      expect.objectContaining({ togglesA11y: true, collapsableFalse: false }),
    ]);
    expect(findStaticBoxNoneViews("x.tsx", fixed)).toEqual([
      expect.objectContaining({ togglesA11y: true, collapsableFalse: true }),
    ]);
    expect(findStaticBoxNoneViews("x.tsx", dynamicPointerEvents)).toEqual([]);
  });
});
