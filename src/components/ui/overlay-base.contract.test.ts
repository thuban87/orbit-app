import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "overlay-base.tsx"), "utf8");
/** Source without block or line comments (the header names the JSX it pins). */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("BaseOverlay Android Modal gesture-root contract", () => {
  it("places a full-screen GestureHandlerRootView immediately inside RNModal", () => {
    expect(source).toContain("import { GestureHandlerRootView }");
    expect(source).toMatch(
      /<RNModal[\s\S]*?\{\(hostId\) => \(\s*<GestureHandlerRootView style={styles\.root}>/,
    );
  });
});

describe("BaseOverlay registered window + in-window snackbar (38.9 D-24, D-40)", () => {
  it("renders its window through RegisteredModal, never RN Modal directly", () => {
    expect(source).toMatch(
      /import \{ RegisteredModal as RNModal \} from "\.\/RegisteredModal";/,
    );
    expect(source).not.toMatch(/\bModal\b[^;]*from "react-native"/);
    expect(source).toContain("overlayKind={overlayKind}");
    expect(source).toContain("renderSnackbarHost={false}");
  });

  it("places the snackbar host as the last child of the root View inside the gesture root", () => {
    expect(code).toMatch(
      /<Snackbar host=\{hostId\} \/>\s*<\/View>\s*<\/GestureHandlerRootView>/,
    );
    expect(code.match(/<Snackbar\b/g)).toHaveLength(1);
  });

  it("keeps the ADR-086 dismissal policy: Back is a no-op when not dismissable", () => {
    expect(source).toContain(
      "onRequestClose={dismissable ? onRequestClose : noop}",
    );
  });
});
