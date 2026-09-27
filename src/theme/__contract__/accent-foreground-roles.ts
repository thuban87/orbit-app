/**
 * Accent foreground role analyzer (38.4 D-63, owner; ADR-084; RG-029
 * `ui-accessibility/AUD-UIA-001`/`AUD-UIA-002`). TEST SUPPORT ONLY — never
 * imported by app code.
 *
 * ADR-084 splits the accent into three roles: `accent` is the FILL, `accentText`
 * is the link/text role (it carries the D-24/D-26 Standard-Light glass variant),
 * and `onAccent` is the label drawn ON an accent fill. Two misroles keep
 * returning, usually hidden in a ternary or a multi-line style object that a
 * line-anchored regex never sees:
 *
 *   - `accent-as-text`        a text/glyph foreground that paints the FILL
 *                             (`color: active ? colors.accent : …`,
 *                             `tone={selected ? "accent" : …}`)
 *   - `background-on-accent`  a label or glyph foreground that paints the page
 *                             `background` token (the label on an accent fill
 *                             must read `onAccent`)
 *
 * A FOREGROUND SLOT is an object property or JSX attribute named in
 * `FOREGROUND_SLOTS` (`color`, `tone`, `tintColor`, `glyphColor`,
 * `placeholderTextColor`, and the tone-object keys `text`, `textColor`,
 * `label`, `labelColor`, `foreground` that a `{ background, border, text }`
 * helper returns). Its value is reduced to leaves syntactically:
 * parentheses and type assertions are unwrapped, both arms of a conditional,
 * both sides of `??`/`||` and the right side of `&&` are followed, call
 * arguments are followed (`asColor(palette.accent)`), and a same-file `const`
 * identifier is resolved to its initializer (depth-limited). A leaf is the
 * accent fill when it is `X.accent`, `X["accent"]` or (in a `tone` slot) the
 * string `"accent"`; it is the page background when it is `X.background`,
 * `X["background"]` or `"background"`.
 *
 * Fills are never foreground slots (`backgroundColor`, `borderColor`,
 * `trackColor` …), so a legitimate accent fill is not scanned at all. The one
 * exception is a graphic whose `color` prop IS its fill (a Skia `Circle`) or a
 * tint the owner kept as a graphic (the tab bar, the pull-to-refresh spinner):
 * those are allowlisted with a reason in the contract test.
 */
import ts from "typescript";

export const FOREGROUND_SLOTS = new Set([
  "color",
  "tone",
  "tintColor",
  "glyphColor",
  "placeholderTextColor",
  // Tone-object keys: a helper that returns `{ background, border, text }`
  // for a segment or chip, later read as `color: tone.text`.
  "text",
  "textColor",
  "label",
  "labelColor",
  "foreground",
]);

export type AccentRoleRule = "accent-as-text" | "background-on-accent";

export interface AccentRoleFinding {
  file: string;
  line: number;
  rule: AccentRoleRule;
  /** The foreground slot name (`color`, `tone`, …). */
  slot: string;
  /** The offending leaf expression, e.g. `colors.accent` or `"accent"`. */
  leaf: string;
  /** The whole slot, whitespace-collapsed, e.g. `tone={isFavourite ? "accent" : "textSecondary"}`. */
  text: string;
}

const MAX_RESOLVE_DEPTH = 3;

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function slotName(name: ts.Node): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isJsxNamespacedName?.(name)) return undefined;
  return undefined;
}

/** The nearest `const X = …` initializer visible from `from`, same file. */
function resolveConst(
  id: ts.Identifier,
  from: ts.Node,
): ts.Expression | undefined {
  let scope: ts.Node | undefined = from.parent;
  while (scope) {
    let found: ts.Expression | undefined;
    const visit = (node: ts.Node): void => {
      if (found) return;
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === id.text &&
        node.initializer &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        found = node.initializer;
        return;
      }
      // Do not descend into nested functions: their locals are not visible.
      if (node !== scope && ts.isFunctionLike(node)) return;
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(scope, visit);
    if (found) return found;
    scope = scope.parent;
  }
  return undefined;
}

function leaves(
  expr: ts.Expression,
  depth: number,
  out: ts.Expression[],
): ts.Expression[] {
  if (
    ts.isParenthesizedExpression(expr) ||
    ts.isAsExpression(expr) ||
    ts.isNonNullExpression(expr) ||
    ts.isSatisfiesExpression(expr) ||
    ts.isTypeAssertionExpression(expr)
  ) {
    return leaves(expr.expression, depth, out);
  }
  if (ts.isConditionalExpression(expr)) {
    leaves(expr.whenTrue, depth, out);
    leaves(expr.whenFalse, depth, out);
    return out;
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (
      op === ts.SyntaxKind.QuestionQuestionToken ||
      op === ts.SyntaxKind.BarBarToken
    ) {
      leaves(expr.left, depth, out);
      leaves(expr.right, depth, out);
      return out;
    }
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      leaves(expr.right, depth, out);
      return out;
    }
  }
  if (ts.isCallExpression(expr)) {
    for (const arg of expr.arguments) leaves(arg, depth, out);
    return out;
  }
  if (ts.isIdentifier(expr) && depth < MAX_RESOLVE_DEPTH) {
    const init = resolveConst(expr, expr);
    if (init) return leaves(init, depth + 1, out);
  }
  out.push(expr);
  return out;
}

function tokenOf(leaf: ts.Expression, slot: string): string | undefined {
  if (ts.isPropertyAccessExpression(leaf)) return leaf.name.text;
  if (
    ts.isElementAccessExpression(leaf) &&
    ts.isStringLiteralLike(leaf.argumentExpression)
  ) {
    return leaf.argumentExpression.text;
  }
  if (slot === "tone" && ts.isStringLiteralLike(leaf)) return leaf.text;
  return undefined;
}

function ruleFor(token: string | undefined): AccentRoleRule | undefined {
  if (token === "accent") return "accent-as-text";
  if (token === "background") return "background-on-accent";
  return undefined;
}

/** Every accent-role misrole in one source file. */
export function scanAccentForegroundRoles(
  file: string,
  source: string,
): AccentRoleFinding[] {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings: AccentRoleFinding[] = [];

  const check = (slotNode: ts.Node, slot: string, value: ts.Expression) => {
    for (const leaf of leaves(value, 0, [])) {
      const rule = ruleFor(tokenOf(leaf, slot));
      if (!rule) continue;
      findings.push({
        file,
        line: sf.getLineAndCharacterOfPosition(leaf.getStart(sf)).line + 1,
        rule,
        slot,
        leaf: leaf.getText(sf),
        text: collapse(slotNode.getText(sf)),
      });
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const name = slotName(node.name);
      if (name && FOREGROUND_SLOTS.has(name))
        check(node, name, node.initializer);
    } else if (ts.isShorthandPropertyAssignment(node)) {
      if (FOREGROUND_SLOTS.has(node.name.text))
        check(node, node.name.text, node.name);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = ts.isIdentifier(node.name) ? node.name.text : undefined;
      if (name && FOREGROUND_SLOTS.has(name)) {
        const init = node.initializer;
        if (ts.isStringLiteral(init)) check(node, name, init);
        else if (ts.isJsxExpression(init) && init.expression)
          check(node, name, init.expression);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}
