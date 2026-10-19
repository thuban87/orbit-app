/**
 * HomeScreen List host contract (38.13 D-55 / D-81 F1 + F2; review R1-01,
 * R5-01).
 *
 * - The swipeable List row host is memoised and takes scalar props only: line 3
 *   as two strings and time as the read's local day, never a per-read object or
 *   a seconds timestamp, so an unchanged contact gets identical props across
 *   publishes.
 * - Every callback the List renderItem hands a row keeps one identity across a
 *   Population, Filters, Sort or search change: no deps list names `reload`,
 *   `query`, `debouncedSearchText` or `rows`, and each dep is fixed for the
 *   screen's life or is another callback in the same set.
 * - The List FlatList is windowed through the tunables at the top of the file,
 *   with no `getItemLayout` (large text, Phase 40).
 *
 * Textual / AST, as the other HomeScreen contracts are (HomeScreen is too large
 * to render in the node test environment).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/screens/HomeScreen.tsx"),
  "utf8",
);
const file = ts.createSourceFile(
  "HomeScreen.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

/** The `useCallback(fn, [deps])` initialiser of `const <name> = …`. */
function callbackInitialiserOf(name: string): ts.CallExpression {
  let found: ts.CallExpression | null = null;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "useCallback"
    ) {
      found = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (found === null) {
    throw new Error(`HomeScreen \`${name} = useCallback(…)\` not found`);
  }
  return found;
}

function depsOf(name: string): string[] {
  const deps = callbackInitialiserOf(name).arguments[1];
  if (!deps || !ts.isArrayLiteralExpression(deps)) {
    throw new Error(`\`${name}\` has no dependency array`);
  }
  return deps.elements.map((element) => element.getText(file));
}

/** The `<SwipeableListRow …/>` element the List renderItem returns. */
function renderItemRowElement(): ts.JsxSelfClosingElement {
  const body = callbackInitialiserOf("renderListRow").arguments[0];
  let found: ts.JsxSelfClosingElement | null = null;
  const visit = (node: ts.Node): void => {
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(file) === "SwipeableListRow"
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  if (body) visit(body);
  if (found === null) {
    throw new Error("renderListRow does not return <SwipeableListRow />");
  }
  return found;
}

function rowAttributes(): Map<string, ts.JsxAttribute> {
  const attributes = new Map<string, ts.JsxAttribute>();
  for (const property of renderItemRowElement().attributes.properties) {
    if (ts.isJsxAttribute(property)) {
      attributes.set(property.name.getText(file), property);
    }
  }
  return attributes;
}

function attributeExpression(attribute: ts.JsxAttribute): ts.Expression {
  const initializer = attribute.initializer;
  if (
    !initializer ||
    !ts.isJsxExpression(initializer) ||
    !initializer.expression
  ) {
    throw new Error(`${attribute.name.getText(file)} has no expression`);
  }
  return initializer.expression;
}

/** The FlatList whose `renderItem` is the List row renderer. */
function listFlatListAttributes(): Map<string, string> {
  let found: Map<string, string> | null = null;
  const visit = (node: ts.Node): void => {
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(file) === "FlatList"
    ) {
      const attributes = new Map<string, string>();
      for (const property of node.attributes.properties) {
        if (ts.isJsxAttribute(property)) {
          attributes.set(
            property.name.getText(file),
            property.initializer?.getText(file) ?? "",
          );
        }
      }
      if (attributes.get("renderItem") === "{renderListRow}") {
        found = attributes;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (found === null) {
    throw new Error("the List FlatList with renderItem={renderListRow}");
  }
  return found;
}

describe("the memoised List row host (D-55 F1; review R1-01)", () => {
  it("SwipeableListRow is wrapped in memo and keeps its function name", () => {
    expect(source).toContain(
      "const SwipeableListRow = memo(function SwipeableListRow({",
    );
  });

  it("the List renderItem is a useCallback passed to the FlatList", () => {
    expect(callbackInitialiserOf("renderListRow")).toBeDefined();
    expect(listFlatListAttributes().get("renderItem")).toBe("{renderListRow}");
  });

  it("passes line 3 as two strings and time as the day key: no listNow, now= or line3= object", () => {
    const attributes = rowAttributes();
    expect(attributes.has("now")).toBe(false);
    expect(attributes.has("listNow")).toBe(false);
    expect(attributes.has("line3")).toBe(false);
    expect(attributes.has("line3Text")).toBe(true);
    expect(attributes.has("line3IconName")).toBe(true);
    expect(
      attributeExpression(attributes.get("listDay") as ts.JsxAttribute).getText(
        file,
      ),
    ).toBe("listDay");
    const element = renderItemRowElement().getText(file);
    expect(element).not.toMatch(/\blistNow\b/);
    expect(element).not.toMatch(/\bline3=/);
  });

  it("the day key is the read's local date", () => {
    expect(source).toContain("const listDay = listNow.slice(0, 10);");
  });

  it("builds no per-row closures: every function prop is a bare stable identifier", () => {
    const attributes = rowAttributes();
    for (const [name, attribute] of attributes) {
      const expression = attributeExpression(attribute);
      expect(
        ts.isArrowFunction(expression) || ts.isFunctionExpression(expression),
        `${name} must not be built per row`,
      ).toBe(false);
    }
    expect(
      attributeExpression(
        attributes.get("onFavouriteTap") as ts.JsxAttribute,
      ).getText(file),
    ).toBe("onFavouriteTap");
    expect(
      attributeExpression(
        attributes.get("onOpenProfile") as ts.JsxAttribute,
      ).getText(file),
    ).toBe("goToProfile");
  });

  it("the row host rebuilds ListRow's line-3 object from the two strings with useMemo", () => {
    const host = source.slice(
      source.indexOf("function SwipeableListRow("),
      source.indexOf("interface ListRowLine3"),
    );
    expect(host).toMatch(/const line3 = useMemo\(/);
    expect(host).toContain("[line3IconName, line3Text]");
    expect(host).toContain("now={listDay}");
    expect(host).toContain("line3={line3}");
  });

  it("passes extraData covering the overlay, the maps, search mode and the day", () => {
    expect(listFlatListAttributes().get("extraData")).toBe("{listExtraData}");
    const extra = source.slice(
      source.indexOf("const listExtraData = useMemo("),
      source.indexOf("const todayLocal"),
    );
    for (const name of [
      "favouriteOverlay",
      "line3ByContactId",
      "searchResultsByContactId",
      "isSearchMode",
      "listDay",
    ]) {
      expect(extra).toContain(name);
    }
  });
});

describe("row callbacks are query-independent (D-55 F1; review R5-01)", () => {
  const forbidden = ["reload", "query", "debouncedSearchText", "rows"];
  /** Values fixed for the screen's life. */
  const lifetimeValues = ["navigation", "favouriteStore", "scheduler"];

  /** The row callbacks the renderItem passes, by the HomeScreen name. */
  function rowCallbackNames(): string[] {
    const names: string[] = [];
    for (const [prop, attribute] of rowAttributes()) {
      if (!/^on[A-Z]/.test(prop)) continue;
      names.push(attributeExpression(attribute).getText(file));
    }
    return names;
  }

  it("the renderItem passes the expected stable callbacks", () => {
    expect(rowCallbackNames().sort()).toEqual(
      [
        "goToProfile",
        "onFavouriteTap",
        "onSwipeRightAction",
        "onEditContact",
        "logQuickly",
        "openLogInteraction",
      ].sort(),
    );
  });

  it("no row callback, nor toggleFavourite or logQuickly, names reload, query, debouncedSearchText or rows", () => {
    const callbackSet = [
      ...rowCallbackNames(),
      "toggleFavourite",
      "logQuickly",
    ];
    for (const name of callbackSet) {
      const deps = depsOf(name);
      for (const word of forbidden) {
        expect(deps, `${name} deps`).not.toContain(word);
      }
      for (const dep of deps) {
        expect(
          lifetimeValues.includes(dep) || callbackSet.includes(dep),
          `${name} depends on ${dep}`,
        ).toBe(true);
      }
    }
  });

  it("each named callback has the expected deps", () => {
    expect(depsOf("goToProfile")).toEqual(["navigation"]);
    expect(depsOf("onFavouriteTap")).toEqual(["toggleFavourite"]);
    expect(depsOf("toggleFavourite")).toEqual(["favouriteStore", "scheduler"]);
    expect(depsOf("onSwipeRightAction")).toEqual(["logQuickly"]);
    expect(depsOf("onEditContact")).toEqual([]);
    expect(depsOf("logQuickly")).toEqual([]);
    expect(depsOf("openLogInteraction")).toEqual([]);
  });

  it("the favourite read goes through the scheduler, never reload", () => {
    expect(source).not.toContain('reload("favourite")');
  });
});

describe("the List FlatList is windowed (D-55 F2)", () => {
  it("declares the tunables near the top of the file", () => {
    const component = source.indexOf("export function HomeScreen(");
    for (const name of [
      "LIST_WINDOW_SIZE",
      "LIST_INITIAL_NUM_TO_RENDER",
      "LIST_MAX_TO_RENDER_PER_BATCH",
    ]) {
      const declaration = source.search(new RegExp(`const ${name} = \\d+;`));
      expect(declaration, name).toBeGreaterThan(-1);
      expect(declaration, name).toBeLessThan(component);
      expect(declaration, name).toBeLessThan(
        source.indexOf("function SwipeActionSurface("),
      );
    }
  });

  it("sets windowSize, initialNumToRender and maxToRenderPerBatch from them", () => {
    const attributes = listFlatListAttributes();
    expect(attributes.get("windowSize")).toBe("{LIST_WINDOW_SIZE}");
    expect(attributes.get("initialNumToRender")).toBe(
      "{LIST_INITIAL_NUM_TO_RENDER}",
    );
    expect(attributes.get("maxToRenderPerBatch")).toBe(
      "{LIST_MAX_TO_RENDER_PER_BATCH}",
    );
  });

  it("uses no getItemLayout and leaves removeClippedSubviews at its default", () => {
    expect(source).not.toContain("getItemLayout");
    expect(listFlatListAttributes().has("removeClippedSubviews")).toBe(false);
  });
});

/** The memoised host's source, between its declaration and ListRowLine3. */
function hostSource(): string {
  return source.slice(
    source.indexOf("function SwipeableListRow("),
    source.indexOf("interface ListRowLine3"),
  );
}

describe("a swiped row closes once its action fires (D-25)", () => {
  function swipeOpenBody(): string {
    const host = hostSource();
    const start = host.indexOf("const onSwipeableOpen = useCallback(");
    expect(start).toBeGreaterThan(-1);
    return host.slice(start, host.indexOf("return (", start));
  }

  it("fires the right-swipe action, then closes the row", () => {
    expect(swipeOpenBody()).toMatch(
      /if \(direction === "right"\) \{\s*void onSwipeRightAction\(contactId\);\s*\} else \{\s*onEditContact\(contactId\);\s*\}\s*swipeableRef\.current\?\.close\(\);/,
    );
  });

  it("the host keeps no React state; openRowRef is cleared by the existing onClose", () => {
    const host = hostSource();
    expect(host).not.toMatch(/useState\(/);
    expect(host).toMatch(
      /const onClose = useCallback\(\(\) => \{\s*if \(isThisRowOpen\(\)\) openRowRef\.current = null;/,
    );
    expect(host).toContain("onSwipeableClose={onClose}");
  });
});

describe("the List row's TalkBack actions run what they are named for (D-26)", () => {
  it("onSwipeRightAction is the one right-swipe function, used only for the right swipe", () => {
    expect(
      source.match(/const onSwipeRightAction = useCallback\(/g),
    ).toHaveLength(1);
    const attributes = rowAttributes();
    expect(
      attributeExpression(
        attributes.get("onSwipeRightAction") as ts.JsxAttribute,
      ).getText(file),
    ).toBe("onSwipeRightAction");
    // Host-side: the swipe calls it; no accessibility action does.
    const host = hostSource();
    expect(host).toContain("void onSwipeRightAction(contactId);");
    expect(host).not.toMatch(/onQuickLog=\{[^}]*onSwipeRightAction/);
    expect(host).not.toMatch(/onLogInteraction=\{[^}]*onSwipeRightAction/);
    expect(source).not.toMatch(/\bconst onLogInteraction = useCallback\(/);
  });

  it("the accessibility Quick Log runs logQuickly and Log Interaction opens Log Interaction", () => {
    const attributes = rowAttributes();
    expect(
      attributeExpression(
        attributes.get("onQuickLog") as ts.JsxAttribute,
      ).getText(file),
    ).toBe("logQuickly");
    expect(
      attributeExpression(
        attributes.get("onLogInteraction") as ts.JsxAttribute,
      ).getText(file),
    ).toBe("openLogInteraction");
    const open =
      callbackInitialiserOf("openLogInteraction").arguments[0]?.getText(file);
    expect(open).toContain(
      'navigateDashboardContactAction(contactId, "LogContact")',
    );
  });

  it("the host hands ListRow all three accessibility handlers", () => {
    const host = hostSource();
    expect(host).toContain("onQuickLog={onRowQuickLog}");
    expect(host).toContain("onLogInteraction={onRowLogInteraction}");
    expect(host).toContain("onEditContact={onRowEditContact}");
    expect(host).toMatch(
      /const onRowQuickLog = useCallback\(\(\) => \{\s*onQuickLog\(contactId\);/,
    );
    expect(host).toMatch(
      /const onRowLogInteraction = useCallback\(\(\) => \{\s*onLogInteraction\(contactId\);/,
    );
  });
});
