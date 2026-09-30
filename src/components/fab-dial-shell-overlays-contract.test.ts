/**
 * D-31 follow-on (owner default D-42 A): while the FAB speed dial is open,
 * every shell overlay that `App.tsx` mounts OUTSIDE the tab navigator in the
 * same native window is hidden from accessibility too, with the Plan 12
 * `TabNavigatorContainer` pattern (a store selector, never mirrored state).
 *
 * RN `Modal`s (the resume prompts, and the assist banner's review sheet) are
 * separate native windows: a parent's accessibility flag cannot reach them,
 * and they sit above the dial and take focus while shown, so hiding them would
 * only hide a modal choice from a screen reader. They are exempt by contract.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

/** Components hidden while the dial is open (same window, outside the navigator). */
const HIDDEN_WHILE_DIAL_OPEN = {
  Snackbar: "src/components/Snackbar.tsx",
} as const;

/**
 * 38.6 D-38: the assist banner moved IN FLOW into the navigator's safe-area
 * column (`RootNavigator`'s `TabNavigatorContainer`), so the container hides it
 * with the rest of the shell. It keeps its own D-31 props as well.
 */
const HIDDEN_INSIDE_NAVIGATOR = {
  AssistBanner: "src/components/AssistBanner.tsx",
} as const;

/** Separate-window RN Modals: exempt, asserted to render `<Modal`. */
const SEPARATE_WINDOW_MODALS = {
  ResumeImportPrompt: "src/components/ResumeImportPrompt.tsx",
  ResumeReconcilePrompt: "src/components/ResumeReconcilePrompt.tsx",
} as const;

/** Render-null gates: own no UI. */
const RENDER_NULL_GATES = [
  "ShareIntentGate",
  "NotificationResponseGate",
  "WidgetLinkingGate",
] as const;

/** The dial itself, and the navigator already covered by D-31. */
const DIAL_AND_NAVIGATOR = ["UniversalFab", "RootNavigator"] as const;

/** The JSX opener `<Tag ... >` starting at `from` (brace-depth aware). */
function openerAt(text: string, from: number): string {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0 && text[i - 1] !== "=")
      return text.slice(from, i + 1);
  }
  throw new Error("unterminated JSX opener");
}

describe("App.tsx shell overlays outside the tab navigator (D-42 A)", () => {
  const app = read("App.tsx");
  const container = app.slice(
    app.indexOf("<NavigationContainer"),
    app.indexOf("</NavigationContainer>"),
  );

  it("classifies every component NavigationContainer renders", () => {
    const rendered = [
      ...new Set(
        [...container.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1]),
      ),
    ].filter((name) => name !== "NavigationContainer");
    const known = [
      ...Object.keys(HIDDEN_WHILE_DIAL_OPEN),
      ...Object.keys(SEPARATE_WINDOW_MODALS),
      ...RENDER_NULL_GATES,
      ...DIAL_AND_NAVIGATOR,
    ];
    const unclassified = rendered.filter((name) => !known.includes(name));
    expect(
      unclassified,
      "a new App.tsx shell overlay must be hidden while the FAB dial is open (fabDialBackgroundA11y) or classified here with a reason",
    ).toEqual([]);
    for (const name of known) expect(rendered).toContain(name);
  });

  it("keeps the render-null gates free of UI", () => {
    const sources: Record<string, string> = {
      ShareIntentGate: read("src/navigation/linking.ts"),
      NotificationResponseGate: read("src/navigation/notification-gate.tsx"),
      WidgetLinkingGate: read("src/navigation/widget-linking.ts"),
    };
    for (const [name, source] of Object.entries(sources)) {
      const start = source.indexOf(`export function ${name}(`);
      expect(start, `${name} is defined`).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf("\n}\n", start));
      expect(body, `${name} renders nothing`).toMatch(/return null;/);
      // A JSX tag follows whitespace, `(`, `{` or `>`; a TS generic follows an identifier.
      expect(body, `${name} renders no JSX`).not.toMatch(/(^|[\s({>])<[A-Z]/m);
    }
  });

  it("exempts the resume prompts only because they are separate-window RN Modals", () => {
    for (const [name, path] of Object.entries(SEPARATE_WINDOW_MODALS)) {
      const source = read(path);
      expect(source, `${name} renders an RN Modal`).toMatch(
        /import \{[^}]*\bModal\b[^}]*\} from "react-native"/,
      );
      const start = source.indexOf(`export function ${name}(`);
      expect(source.slice(start)).toMatch(/return \(\s*<Modal\b/);
    }
  });

  it("mounts the assist banner in flow inside the navigator, not over it (38.6 D-38)", () => {
    expect(container).not.toContain("<AssistBanner");
    const navigator = read("src/navigation/RootNavigator.tsx");
    const inside = navigator.slice(
      navigator.indexOf("<TabNavigatorContainer>"),
      navigator.indexOf("<Tab.Navigator"),
    );
    expect(inside).toContain("<AssistBanner />");
    expect(navigator.match(/<AssistBanner\b/g)).toHaveLength(1);
    const banner = read(HIDDEN_INSIDE_NAVIGATOR.AssistBanner);
    const styles = banner.slice(banner.indexOf("StyleSheet.create("));
    expect(styles).not.toMatch(/position:\s*"absolute"/);
    expect(styles).not.toMatch(/\b(?:zIndex|elevation):/);
  });

  for (const [name, path] of Object.entries({
    ...HIDDEN_WHILE_DIAL_OPEN,
    ...HIDDEN_INSIDE_NAVIGATOR,
  })) {
    describe(`${name} is hidden while the dial is open`, () => {
      const source = read(path);
      const render = source.slice(source.indexOf(`export function ${name}(`));

      it("subscribes once through the shared selector, above any early return", () => {
        expect(
          render.match(
            /const fabDialOpen = shellTransientStore\(selectFabDialOpen\);/g,
          ),
        ).toHaveLength(1);
        const subscribe = render.indexOf("const fabDialOpen =");
        const earlyReturn = render.search(
          /\n\s+if \([^)]*\) return\b|\n\s+if \(![a-z]+\) \{/,
        );
        if (earlyReturn !== -1) expect(subscribe).toBeLessThan(earlyReturn);
      });

      it("spreads the D-31 props on its same-window root View only", () => {
        expect(
          render.match(/fabDialBackgroundA11y\(fabDialOpen\)/g),
        ).toHaveLength(1);
        const main = render.slice(render.lastIndexOf("\n  return ("));
        const root = openerAt(main, main.indexOf("<View"));
        expect(root).toContain("{...fabDialBackgroundA11y(fabDialOpen)}");
        expect(root).toContain('pointerEvents="box-none"');
        expect(root).not.toMatch(/\baccessible\b(?!ity)/);
      });
    });
  }
});
