/**
 * Glass-scope read analyzer (D-34 / RG-029 `ui-accessibility/AUD-UIA-001`).
 * TEST SUPPORT ONLY — never imported by app code.
 *
 * `GlassForegroundScope` re-provides the theme inside a `GlassSurface` card, a
 * `ChromeScrim` and a `ShellAppBar` `trailing` subtree. Only a hook called
 * INSIDE that subtree (a `ScopedPalette` render prop, or a child component that
 * calls `useTheme()` itself) sees the glass palette. A palette resolved ABOVE
 * the scope — `const { colors } = useTheme()` at the top of the host, or a
 * `ThemePalette` parameter — renders the ROOT tone inside the card, so the D-24
 * Standard-Light variants never reach those pixels.
 *
 * This analyzer finds, inside every scope region, each read of a
 * glass-overridden token through a palette whose ORIGIN (the `useTheme()` call
 * or the `ThemePalette` parameter it came from) lies outside the region:
 *
 *   - `direct`      `colors.danger`, `theme.colors.textSecondary`
 *   - `computed`    `colors[toneKey]` (the key cannot be proven non-overridden)
 *   - `palette-prop` a whole outer palette handed on (`<Row palette={colors} />`
 *                   or `tone(colors)`), so the callee reads the root tone
 *   - `indirect`    a reference to an outer local variable, JSX value or
 *                   function that itself reads an overridden token through an
 *                   outer palette (transitive, fixpoint over the file)
 *
 * Scope regions: `<GlassSurface>` children (unless `treatment="orrery-overlay"`,
 * which keeps the root palette under ADR-149), `<ChromeScrim>` children, the
 * `<ShellAppBar trailing={…}>` value, direct `<GlassForegroundScope>` children
 * (38.5-06 C2-M1: a component that draws its own see-through backing, such as
 * the table-driven `ListRow`, scopes its content directly), and every
 * auto-discovered scope slot
 * (`discoverScopeWrappers`): a component whose `children` or other
 * `ReactNode`-typed prop renders inside a scope region, and a same-file render
 * helper whose `ReactNode` parameter renders inside one (its call-site argument
 * becomes scope content).
 *
 * Exempt by construction: bindings from `useGlassForegroundColors()` and
 * `useUnscopedTheme()` are never treated as palettes, and a palette whose
 * origin is inside the region (a `ScopedPalette` render-prop parameter, a child
 * component's own `useTheme()`) is in scope.
 *
 * Identifiers are resolved with a syntactic lexical-scope walk (no type
 * checker); a palette is a `colors` binding destructured from `useTheme()` (or
 * `theme.colors` where `theme = useTheme()`), an alias of one, or a parameter
 * (or destructured prop) typed `ThemePalette`.
 *
 * KNOWN BLIND SPOT (T-38.4-20-03, accepted): a plain colour STRING passed
 * across files as a prop (`<Row color={colors.danger} />` where `Row` renders
 * it inside its own card) is reported at the call site only if the call site is
 * itself inside a scope; a string resolved above a scope in ANOTHER file is not
 * traced. The Plan 17 device rows cover it.
 */
import ts from "typescript";
import { applyAccent, resolveAccent } from "../accents";
import { resolveGlassForegroundPalette } from "../glass-foregrounds";
import { ACCENT_IDS, type AccentId } from "../theme-option-ids";
import { resolvePalette } from "../theme-presets";
import type { ThemePalette } from "../theme-types";

/** The elements that open a glass foreground scope, and which slot is scoped. */
export const SCOPE_ELEMENTS = [
  {
    element: "GlassSurface",
    slot: "children",
    exceptWhen: { attribute: "treatment", value: "orrery-overlay" },
  },
  { element: "ChromeScrim", slot: "children" },
  { element: "ShellAppBar", slot: "trailing" },
] as const;

/**
 * The scope labels `scopeRegions()` hard-codes (38.5-06 C2-M1). A superset of
 * `SCOPE_ELEMENTS`: `GlassForegroundScope` is a scope but draws NO backing, so it
 * is deliberately absent from `SCOPE_ELEMENTS` (38.5-01's `bare-text-sites.ts`
 * reads that list as the BACKED glass set) and present here.
 */
export const SCOPE_REGION_SCOPES = [
  "GlassSurface",
  "ChromeScrim",
  "ShellAppBar.trailing",
  "GlassForegroundScope",
] as const;

/**
 * Components whose scoped slots `scopeRegions()` hard-codes (with their own
 * exceptions, e.g. the orrery overlay). Their implementations render
 * `{children}` inside a `GlassForegroundScope`, so wrapper discovery would
 * otherwise re-derive them WITHOUT those exceptions (an analyzer false
 * positive); discovery skips them.
 */
const HARD_CODED_SCOPE_OWNERS: ReadonlySet<string> = new Set([
  "GlassSurface",
  "ChromeScrim",
  "ShellAppBar",
  "GlassForegroundScope",
]);

export type GlassScopeFindingKind =
  | "direct"
  | "indirect"
  | "palette-prop"
  | "computed";

export interface GlassScopeFinding {
  file: string;
  line: number;
  expr: string;
  kind: GlassScopeFindingKind;
  scope: string;
}

/** A discovered scope slot. */
export interface ScopeWrapper {
  kind: "component" | "render-helper";
  /** Component name (JSX tag) or same-file render helper name. */
  owner: string;
  /** `children`, a ReactNode prop name, or the helper parameter name. */
  slot: string;
  /** The file that defines the wrapper (render helpers apply only there). */
  file: string;
  /** Render helpers only: the scoped parameter's index. */
  paramIndex?: number;
}

export interface SourceFileInput {
  file: string;
  source: string;
}

/**
 * The palette keys the glass scope overrides: every key where
 * `resolveGlassForegroundPalette` (Standard Light over an asset, for every
 * curated accent plus the NULL default) differs from the root palette. A future
 * override widens the contract automatically.
 */
export function deriveGlassOverriddenKeys(): Set<keyof ThemePalette> {
  const keys = new Set<keyof ThemePalette>();
  const ids: (AccentId | null)[] = [...ACCENT_IDS, null];
  for (const accentId of ids) {
    const palette = applyAccent(
      resolvePalette("standard", "light"),
      resolveAccent(accentId, "standard", "light"),
    );
    const glass = resolveGlassForegroundPalette({
      palette,
      package: "standard",
      mode: "light",
      accentId,
      backgroundIsAsset: true,
    });
    if (!glass) continue;
    for (const key of Object.keys(glass) as (keyof ThemePalette)[]) {
      if (glass[key] !== palette[key]) keys.add(key);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// TypeScript-AST helpers (standalone; no shared scan module exists).
// ---------------------------------------------------------------------------

function parse(file: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

type FunctionLike =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;

function isFunctionLike(node: ts.Node): node is FunctionLike {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function unwrap(expr: ts.Expression): ts.Expression {
  let e = expr;
  while (
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isNonNullExpression(e) ||
    ts.isSatisfiesExpression(e)
  ) {
    e = e.expression;
  }
  return e;
}

/** The declaration node (VariableDeclaration / ParameterDeclaration / BindingElement) binding `text` in `name`. */
function findBinding(name: ts.BindingName, text: string): ts.Node | undefined {
  if (ts.isIdentifier(name))
    return name.text === text ? name.parent : undefined;
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    const found = findBinding(element.name, text);
    if (found) return found;
  }
  return undefined;
}

function declarationInStatements(
  statements: readonly ts.Statement[],
  text: string,
): ts.Node | undefined {
  for (const statement of statements) {
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        const found = findBinding(d.name, text);
        if (found) return found;
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      statement.name?.text === text
    ) {
      return statement;
    } else if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.name?.text === text) return clause;
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const spec of bindings.elements) {
          if (spec.name.text === text) return spec;
        }
      } else if (bindings && bindings.name.text === text) {
        return bindings;
      }
    }
  }
  return undefined;
}

/** Lexical resolution of an identifier reference to its declaration. */
function resolveIdentifier(id: ts.Identifier): ts.Node | undefined {
  const text = id.text;
  let node: ts.Node | undefined = id.parent;
  while (node) {
    if (isFunctionLike(node)) {
      for (const p of node.parameters) {
        const found = findBinding(p.name, text);
        if (found) return found;
      }
      if (ts.isFunctionExpression(node) && node.name?.text === text)
        return node;
    }
    if (ts.isBlock(node) || ts.isSourceFile(node) || ts.isModuleBlock(node)) {
      const found = declarationInStatements(node.statements, text);
      if (found) return found;
    } else if (ts.isCaseClause(node) || ts.isDefaultClause(node)) {
      const found = declarationInStatements(node.statements, text);
      if (found) return found;
    } else if (
      (ts.isForStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isForInStatement(node)) &&
      node.initializer &&
      ts.isVariableDeclarationList(node.initializer)
    ) {
      for (const d of node.initializer.declarations) {
        const found = findBinding(d.name, text);
        if (found) return found;
      }
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      const found = findBinding(node.variableDeclaration.name, text);
      if (found) return found;
    }
    node = node.parent;
  }
  return undefined;
}

/** True when `id` is in a declaration-name or property-name position (not a reference). */
function isNonReferencePosition(id: ts.Identifier): boolean {
  const p = id.parent;
  if (!p) return true;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return true;
  if (ts.isPropertyAssignment(p) && p.name === id) return true;
  if (ts.isJsxAttribute(p) && p.name === id) return true;
  if (
    (ts.isVariableDeclaration(p) ||
      ts.isParameter(p) ||
      ts.isFunctionDeclaration(p) ||
      ts.isFunctionExpression(p) ||
      ts.isClassDeclaration(p) ||
      ts.isPropertySignature(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isTypeAliasDeclaration(p) ||
      ts.isInterfaceDeclaration(p) ||
      ts.isImportSpecifier(p) ||
      ts.isImportClause(p) ||
      ts.isNamespaceImport(p)) &&
    (p as { name?: ts.Node }).name === id
  )
    return true;
  if (ts.isBindingElement(p) && (p.name === id || p.propertyName === id))
    return true;
  if (ts.isTypeReferenceNode(p) || ts.isQualifiedName(p)) return true;
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return true;
  return false;
}

function typeNameText(type: ts.TypeNode | undefined): string | undefined {
  if (!type || !ts.isTypeReferenceNode(type)) return undefined;
  const name = type.typeName;
  return ts.isIdentifier(name) ? name.text : name.right.text;
}

function isThemePaletteType(type: ts.TypeNode | undefined): boolean {
  return typeNameText(type) === "ThemePalette";
}

function isReactNodeType(type: ts.TypeNode | undefined, sf: ts.SourceFile) {
  return !!type && /\bReactNode\b/.test(type.getText(sf));
}

/** The type node of member `key` in a parameter's type (inline literal or same-file interface/alias). */
function memberType(
  paramType: ts.TypeNode | undefined,
  key: string,
  sf: ts.SourceFile,
): ts.TypeNode | undefined {
  if (!paramType) return undefined;
  let members: ts.NodeArray<ts.TypeElement> | undefined;
  if (ts.isTypeLiteralNode(paramType)) {
    members = paramType.members;
  } else {
    const name = typeNameText(paramType);
    if (!name) return undefined;
    for (const statement of sf.statements) {
      if (ts.isInterfaceDeclaration(statement) && statement.name.text === name)
        members = statement.members;
      else if (
        ts.isTypeAliasDeclaration(statement) &&
        statement.name.text === name &&
        ts.isTypeLiteralNode(statement.type)
      )
        members = statement.type.members;
    }
  }
  if (!members) return undefined;
  for (const member of members) {
    if (
      ts.isPropertySignature(member) &&
      member.name.getText(sf) === key &&
      member.type
    )
      return member.type;
  }
  return undefined;
}

function isUseThemeCall(expr: ts.Expression): boolean {
  const e = unwrap(expr);
  return (
    ts.isCallExpression(e) &&
    ts.isIdentifier(e.expression) &&
    e.expression.text === "useTheme"
  );
}

// ---------------------------------------------------------------------------
// Palette origin tracking.
// ---------------------------------------------------------------------------

class PaletteResolver {
  private readonly originCache = new Map<ts.Node, ts.Node | null>();

  constructor(private readonly sf: ts.SourceFile) {}

  /** Where a THEME value was resolved (a `useTheme()` call), or null. */
  themeOrigin(expr: ts.Expression): ts.Node | null {
    const e = unwrap(expr);
    if (isUseThemeCall(e)) return e;
    if (ts.isIdentifier(e)) {
      const decl = resolveIdentifier(e);
      if (
        decl &&
        ts.isVariableDeclaration(decl) &&
        ts.isIdentifier(decl.name) &&
        decl.initializer
      ) {
        return this.themeOrigin(decl.initializer);
      }
    }
    return null;
  }

  /** Where a PALETTE value was resolved (a `useTheme()` call or a `ThemePalette` parameter), or null. */
  paletteOrigin(expr: ts.Expression): ts.Node | null {
    const e = unwrap(expr);
    if (ts.isIdentifier(e)) {
      const decl = resolveIdentifier(e);
      return decl ? this.declOrigin(decl) : null;
    }
    if (ts.isPropertyAccessExpression(e) && e.name.text === "colors") {
      return this.themeOrigin(e.expression);
    }
    return null;
  }

  private declOrigin(decl: ts.Node): ts.Node | null {
    const cached = this.originCache.get(decl);
    if (cached !== undefined) return cached;
    this.originCache.set(decl, null); // cycle guard
    const origin = this.computeDeclOrigin(decl);
    this.originCache.set(decl, origin);
    return origin;
  }

  private computeDeclOrigin(decl: ts.Node): ts.Node | null {
    if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name)) {
      return decl.initializer ? this.paletteOrigin(decl.initializer) : null;
    }
    if (ts.isParameter(decl) && ts.isIdentifier(decl.name)) {
      return isThemePaletteType(decl.type) ? decl : null;
    }
    if (ts.isBindingElement(decl) && ts.isIdentifier(decl.name)) {
      const key = decl.propertyName
        ? decl.propertyName.getText(this.sf)
        : decl.name.text;
      const pattern = decl.parent;
      const holder = pattern.parent;
      if (ts.isVariableDeclaration(holder) && holder.initializer) {
        if (key !== "colors") return null;
        return this.themeOrigin(holder.initializer);
      }
      if (ts.isParameter(holder)) {
        return isThemePaletteType(memberType(holder.type, key, this.sf))
          ? holder
          : null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scope regions.
// ---------------------------------------------------------------------------

interface Region {
  start: number;
  end: number;
  roots: ts.Node[];
  scope: string;
}

function tagName(node: ts.JsxOpeningLikeElement, sf: ts.SourceFile): string {
  return node.tagName.getText(sf);
}

function attribute(
  node: ts.JsxOpeningLikeElement,
  name: string,
  sf: ts.SourceFile,
): ts.JsxAttribute | undefined {
  for (const prop of node.attributes.properties) {
    if (ts.isJsxAttribute(prop) && prop.name.getText(sf) === name) return prop;
  }
  return undefined;
}

function isOrreryOverlay(node: ts.JsxOpeningLikeElement, sf: ts.SourceFile) {
  const attr = attribute(node, "treatment", sf);
  const init = attr?.initializer;
  if (!init) return false;
  if (ts.isStringLiteral(init)) return init.text === "orrery-overlay";
  if (ts.isJsxExpression(init) && init.expression) {
    const e = unwrap(init.expression);
    return ts.isStringLiteralLike(e) && e.text === "orrery-overlay";
  }
  return false;
}

function childrenRegion(el: ts.JsxElement, scope: string): Region | undefined {
  if (el.children.length === 0) return undefined;
  return {
    start: el.openingElement.end,
    end: el.closingElement.getStart(),
    roots: [...el.children],
    scope,
  };
}

function attributeRegion(
  attr: ts.JsxAttribute | undefined,
  scope: string,
): Region | undefined {
  const init = attr?.initializer;
  if (!init) return undefined;
  return { start: init.getStart(), end: init.end, roots: [init], scope };
}

function scopeRegions(
  sf: ts.SourceFile,
  file: string,
  wrappers: readonly ScopeWrapper[],
): Region[] {
  const regions: Region[] = [];
  const components = wrappers.filter((w) => w.kind === "component");
  const helpers = wrappers.filter(
    (w) => w.kind === "render-helper" && w.file === file,
  );
  // A discovered wrapper can re-derive a hard-coded region with the same range;
  // keep one region per range so no read is reported twice.
  const add = (r: Region | undefined) => {
    if (r && !regions.some((x) => x.start === r.start && x.end === r.end))
      regions.push(r);
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = tagName(opening, sf);
      if (ts.isJsxElement(node)) {
        if (tag === "GlassSurface" && !isOrreryOverlay(opening, sf))
          add(childrenRegion(node, "GlassSurface"));
        if (tag === "ChromeScrim") add(childrenRegion(node, "ChromeScrim"));
        if (tag === "GlassForegroundScope")
          add(childrenRegion(node, "GlassForegroundScope"));
        for (const w of components) {
          if (w.owner === tag && w.slot === "children")
            add(childrenRegion(node, `${tag}.children`));
        }
      }
      if (tag === "ShellAppBar")
        add(
          attributeRegion(
            attribute(opening, "trailing", sf),
            "ShellAppBar.trailing",
          ),
        );
      for (const w of components) {
        if (w.owner === tag && w.slot !== "children")
          add(
            attributeRegion(attribute(opening, w.slot, sf), `${tag}.${w.slot}`),
          );
      }
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text;
      for (const w of helpers) {
        const arg =
          w.owner === callee && w.paramIndex !== undefined
            ? node.arguments[w.paramIndex]
            : undefined;
        if (arg)
          add({
            start: arg.getStart(),
            end: arg.end,
            roots: [arg],
            scope: `${callee}(${w.slot})`,
          });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return regions;
}

/**
 * The scope label of every region in one file (test support: proves each
 * hard-coded scope element yields a region, C2-M1).
 */
export function scopeRegionLabels(
  file: string,
  source: string,
  wrappers: readonly ScopeWrapper[] = [],
): string[] {
  return scopeRegions(parse(file, source), file, wrappers).map((r) => r.scope);
}

function inside(node: ts.Node, region: Region): boolean {
  const pos = node.getStart();
  return pos >= region.start && pos < region.end;
}

function within(node: ts.Node, container: ts.Node): boolean {
  return node.getStart() >= container.getStart() && node.end <= container.end;
}

// ---------------------------------------------------------------------------
// Wrapper discovery.
// ---------------------------------------------------------------------------

function namedFunctions(
  sf: ts.SourceFile,
): { name: string; fn: FunctionLike }[] {
  const out: { name: string; fn: FunctionLike }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      out.push({ name: node.name.text, fn: node });
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const init = unwrap(node.initializer);
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        out.push({ name: node.name.text, fn: init });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Identifier references inside `fn` that resolve to `decl` and sit in a region. */
function referencedInRegion(
  fn: FunctionLike,
  decl: ts.Node,
  text: string,
  regions: readonly Region[],
): boolean {
  let hit = false;
  const visit = (node: ts.Node) => {
    if (hit) return;
    if (
      ts.isIdentifier(node) &&
      node.text === text &&
      !isNonReferencePosition(node) &&
      resolveIdentifier(node) === decl &&
      regions.some((r) => inside(node, r))
    ) {
      hit = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  if (fn.body) visit(fn.body);
  return hit;
}

function wrapperKey(w: ScopeWrapper): string {
  return w.kind === "component"
    ? `${w.owner}.${w.slot}`
    : `${w.file}#${w.owner}(${w.slot})`;
}

/**
 * Discover every scope slot across `files` (fixpoint: a wrapper's slot is a
 * scope region, which can reveal a wrapper of a wrapper).
 */
export function discoverScopeWrappers(
  files: readonly SourceFileInput[],
): ScopeWrapper[] {
  const parsed = files.map((f) => ({
    file: f.file,
    sf: parse(f.file, f.source),
  }));
  const found = new Map<string, ScopeWrapper>();
  for (let pass = 0; pass < 6; pass++) {
    const before = found.size;
    const current = [...found.values()];
    for (const { file, sf } of parsed) {
      const regions = scopeRegions(sf, file, current);
      if (regions.length === 0) continue;
      for (const { name, fn } of namedFunctions(sf)) {
        if (HARD_CODED_SCOPE_OWNERS.has(name)) continue;
        if (
          !fn.body ||
          !regions.some((r) => within(r.roots[0], fn.body as ts.Node))
        )
          continue;
        const isComponent = /^[A-Z]/.test(name);
        if (isComponent) {
          const param = fn.parameters[0];
          if (!param) continue;
          if (ts.isObjectBindingPattern(param.name)) {
            for (const element of param.name.elements) {
              if (!ts.isIdentifier(element.name)) continue;
              const key = element.propertyName
                ? element.propertyName.getText(sf)
                : element.name.text;
              const slotType = memberType(param.type, key, sf);
              if (key !== "children" && !isReactNodeType(slotType, sf))
                continue;
              if (referencedInRegion(fn, element, element.name.text, regions)) {
                const w: ScopeWrapper = {
                  kind: "component",
                  owner: name,
                  slot: key,
                  file,
                };
                found.set(wrapperKey(w), w);
              }
            }
          }
        } else {
          fn.parameters.forEach((param, index) => {
            if (
              !ts.isIdentifier(param.name) ||
              !isReactNodeType(param.type, sf)
            )
              return;
            if (referencedInRegion(fn, param, param.name.text, regions)) {
              const w: ScopeWrapper = {
                kind: "render-helper",
                owner: name,
                slot: param.name.text,
                file,
                paramIndex: index,
              };
              found.set(wrapperKey(w), w);
            }
          });
        }
      }
    }
    if (found.size === before) break;
  }
  return [...found.values()].sort((a, b) =>
    wrapperKey(a).localeCompare(wrapperKey(b)),
  );
}

// ---------------------------------------------------------------------------
// The analysis.
// ---------------------------------------------------------------------------

/**
 * Report every out-of-scope read of an overridden token inside a scope region
 * of one file. `wrappers` comes from `discoverScopeWrappers` over the repo.
 */
export function analyzeGlassScopeReads(
  filePath: string,
  source: string,
  overriddenKeys: ReadonlySet<string>,
  wrappers: readonly ScopeWrapper[] = [],
): GlassScopeFinding[] {
  const sf = parse(filePath, source);
  const regions = scopeRegions(sf, filePath, wrappers);
  if (regions.length === 0) return [];
  const palettes = new PaletteResolver(sf);
  const lineOf = (node: ts.Node) =>
    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const text = (node: ts.Node) => node.getText(sf).replace(/\s+/g, " ");

  /** An overridden read through a palette whose origin lies outside `container` (a range). */
  const outerOrigin = (
    expr: ts.Expression,
    start: number,
    end: number,
  ): boolean => {
    const origin = palettes.paletteOrigin(expr);
    if (!origin) return false;
    const pos = origin.getStart(sf);
    return pos < start || pos >= end;
  };

  /** The kind of a single node, judged against the range [start, end). */
  const classify = (
    node: ts.Node,
    start: number,
    end: number,
  ): GlassScopeFindingKind | null => {
    if (
      ts.isPropertyAccessExpression(node) &&
      overriddenKeys.has(node.name.text) &&
      outerOrigin(node.expression, start, end)
    )
      return "direct";
    if (
      ts.isElementAccessExpression(node) &&
      outerOrigin(node.expression, start, end)
    ) {
      const arg = unwrap(node.argumentExpression);
      if (ts.isStringLiteralLike(arg))
        return overriddenKeys.has(arg.text) ? "direct" : null;
      return "computed";
    }
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      ts.isJsxAttribute(node.parent) &&
      outerOrigin(node.expression, start, end)
    )
      return "palette-prop";
    if (ts.isCallExpression(node)) {
      for (const arg of node.arguments) {
        if (outerOrigin(arg, start, end)) return "palette-prop";
      }
    }
    return null;
  };

  // Transitive taint: file-wide fixpoint over variable and function
  // declarations that read an overridden token through a palette resolved
  // OUTSIDE the declaration itself (a nested component's own useTheme() is in
  // its own render, so it is not tainted).
  const decls: ts.Node[] = [];
  const collect = (node: ts.Node) => {
    if (
      (ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer) ||
      (ts.isFunctionDeclaration(node) && node.name && node.body)
    )
      decls.push(node);
    ts.forEachChild(node, collect);
  };
  collect(sf);
  const tainted = new Set<ts.Node>();
  const readsOuter = (decl: ts.Node): boolean => {
    let hit = false;
    const start = decl.getStart(sf);
    const end = decl.end;
    const visit = (node: ts.Node) => {
      if (hit) return;
      if (classify(node, start, end)) {
        hit = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(decl, visit);
    return hit;
  };
  for (const decl of decls) if (readsOuter(decl)) tainted.add(decl);
  for (let changed = true; changed; ) {
    changed = false;
    for (const decl of decls) {
      if (tainted.has(decl)) continue;
      let hit = false;
      const visit = (node: ts.Node) => {
        if (hit) return;
        if (ts.isIdentifier(node) && !isNonReferencePosition(node)) {
          const target = resolveIdentifier(node);
          if (target && target !== decl && tainted.has(target)) {
            hit = true;
            return;
          }
        }
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(decl, visit);
      if (hit) {
        tainted.add(decl);
        changed = true;
      }
    }
  }

  // Findings keyed by position; the innermost region wins.
  const findings = new Map<number, GlassScopeFinding & { width: number }>();
  const report = (
    node: ts.Node,
    kind: GlassScopeFindingKind,
    region: Region,
  ) => {
    const pos = node.getStart(sf);
    const width = region.end - region.start;
    const prior = findings.get(pos);
    if (prior && prior.width <= width) return;
    findings.set(pos, {
      file: filePath,
      line: lineOf(node),
      expr: text(node),
      kind,
      scope: region.scope,
      width,
    });
  };

  for (const region of regions) {
    const visit = (node: ts.Node) => {
      const kind = classify(node, region.start, region.end);
      if (kind) {
        report(node, kind, region);
        if (kind !== "palette-prop") return;
      }
      if (ts.isIdentifier(node) && !isNonReferencePosition(node)) {
        const target = resolveIdentifier(node);
        if (
          target &&
          tainted.has(target) &&
          !(
            target.getStart(sf) >= region.start &&
            target.getStart(sf) < region.end
          )
        )
          report(node, "indirect", region);
      }
      ts.forEachChild(node, visit);
    };
    for (const root of region.roots) visit(root);
  }

  return [...findings.values()]
    .map(({ width: _width, ...finding }) => finding)
    .sort((a, b) => a.line - b.line);
}
