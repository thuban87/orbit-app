/**
 * 38.7-14 (H5, D-28/D-55): the occlusion-source contract. Every Orrery text
 * surface drawn over the map must have an occlusion source that the 4.5:1
 * proofs in `src/theme/tokens/surface.test.ts` actually cover, so the proof
 * cannot pass on paper for a surface the dim does not reach:
 *   (a) every surface that can carry text over the canvas has an entry in
 *       `ORRERY_OCCLUSION_SOURCES`;
 *   (b) the focus card is a "derived-rect" positioned from the same UI-thread
 *       `focusCardRect` the canvas dims under;
 *   (c) every "obstacle-rect" surface does not move over the map while open;
 *   (d) every "no-text" surface renders no text;
 *   (e) every "header-scrim" surface is covered by the title proof and every
 *       rect surface by the card proof (or is opaque).
 * A new text surface without a source fails this suite.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ORRERY_OCCLUSION_SOURCES } from "./v2/occlusion-sources";

const REPO = join(__dirname, "..", "..", "..");
const ORRERY_DIR = join(REPO, "src", "components", "orrery");
const SCREEN = "src/screens/OrreryScreen.tsx";

function read(path: string): string {
  return readFileSync(join(REPO, path), "utf8");
}

/** Every non-test .tsx under src/components/orrery/**. */
function orreryComponents(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".tsx") && !name.includes(".test."))
        out.push(relative(REPO, full));
    }
  };
  walk(ORRERY_DIR);
  return out.sort();
}

function componentName(path: string): string {
  return (path.split("/").pop() ?? "").replace(/\.tsx$/, "");
}

/** Registered components by source kind. */
function componentsWith(source: string): Set<string> {
  return new Set(
    Object.values(ORRERY_OCCLUSION_SOURCES)
      .filter((entry) => entry.source === source)
      .map((entry) => entry.component),
  );
}

const REGISTERED = new Set(
  Object.values(ORRERY_OCCLUSION_SOURCES).map((entry) => entry.component),
);

/** The obstacle ids a source file registers (JSX props and exported ids). */
function obstacleIdsIn(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(/obstacleId="([^"]+)"/g))
    ids.push(match[1]);
  for (const match of text.matchAll(
    /export const [A-Z_]+_OBSTACLE = "([^"]+)"/g,
  ))
    ids.push(match[1]);
  return ids;
}

describe("38.7-14 (H5): every Orrery text surface has a proven occlusion source", () => {
  it("(a) every orrery-overlay glass surface and every obstacle under src/components/orrery is registered", () => {
    const glass: string[] = [];
    for (const path of orreryComponents()) {
      const text = readFileSync(join(REPO, path), "utf8");
      if (text.includes('treatment="orrery-overlay"')) {
        glass.push(componentName(path));
        expect(
          REGISTERED.has(componentName(path)),
          `${path} renders orrery-overlay glass but has no occlusion source`,
        ).toBe(true);
      }
      for (const id of obstacleIdsIn(text))
        expect(
          ORRERY_OCCLUSION_SOURCES[id],
          `${path} registers obstacle "${id}" with no occlusion source`,
        ).toBeDefined();
    }
    // The scan found the HUD surfaces (guards against a vacuous pass).
    expect(glass).toEqual(
      expect.arrayContaining([
        "OrreryClusterPanel",
        "OrreryControls",
        "OrreryFocusContext",
        "OrrerySystemSelector",
        "OrreryViewOptions",
      ]),
    );
  });

  it("(a) every feedback notice site in OrreryScreen and the title header are registered", () => {
    const screen = read(SCREEN);
    const ids = [
      ...screen.matchAll(/<OrreryFeedback\s+obstacleId="([^"]+)"/g),
    ].map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    for (const id of ids)
      expect(ORRERY_OCCLUSION_SOURCES[id], id).toEqual({
        component: "OrreryFeedback",
        source: "obstacle-rect",
      });
    expect(screen).toContain("<OrreryImmersiveHeader");
    expect(ORRERY_OCCLUSION_SOURCES["orrery-immersive-header"]).toEqual({
      component: "OrreryImmersiveHeader",
      source: "header-scrim",
    });
    // The dashboard's AnchoredPanel also renders orrery-overlay glass, but it
    // is not an Orrery surface: nothing in the Orrery renders it.
    for (const path of [...orreryComponents(), SCREEN])
      expect(read(path), path).not.toContain("AnchoredPanel");
  });

  it("(b) the focus card is a derived rect, positioned from the same focusCardRect the canvas dims under", () => {
    expect(ORRERY_OCCLUSION_SOURCES["orrery-focus-context"]).toEqual({
      component: "OrreryFocusContext",
      source: "derived-rect",
    });
    const card = read("src/components/orrery/OrreryFocusContext.tsx");
    // Its animated style reads `placement` (left/top/width) on the UI thread.
    expect(card).toMatch(
      /useAnimatedStyle\(\(\) => \{\s*const rect = placement\.value;/,
    );
    expect(card).toMatch(/left: rect\.x,\s*top: rect\.y,/);
    const screen = read(SCREEN);
    // The screen passes ONE focusCardRect to the card and to the world, which
    // merges it into the occlusion rects (collectOcclusion).
    expect(screen).toContain("placement={focusCardRect}");
    expect(screen).toContain("focusCardRect={focusCardRect}");
    expect(read("src/components/orrery/OrreryWorld.tsx")).toMatch(
      /collectOcclusion\(staticRects\.value, cardRect\.value\)/,
    );
  });

  it("(c) obstacle-rect surfaces do not animate their position over the map", () => {
    for (const name of componentsWith("obstacle-rect")) {
      const text = read(`src/components/orrery/${name}.tsx`);
      expect(text, `${name} reads the shared frame`).not.toMatch(
        /frame\.value/,
      );
      expect(
        text,
        `${name} positions itself with an animated style`,
      ).not.toMatch(/useAnimatedStyle/);
    }
  });

  it("(d) no-text surfaces render no text", () => {
    for (const name of componentsWith("no-text")) {
      const text = read(`src/components/orrery/${name}.tsx`);
      expect(text, name).not.toMatch(/<AppText\b/);
      expect(text, name).not.toMatch(/<Text\b/);
    }
  });

  it("(e) header-scrim surfaces are covered by the title proof; rect surfaces by the card proof or an opaque backing", () => {
    const proof = read("src/theme/tokens/surface.test.ts");
    expect(proof).toContain(
      'describe("Orrery title over the V2 sky (38.7-14, D-39)"',
    );
    expect(proof).toContain(
      "Orrery cards over the V2 sky — ADR-169 both extrema",
    );
    expect(proof).toContain("ORRERY_OCCLUSION_DIM[pkg][mode]");
    expect([...componentsWith("header-scrim")]).toEqual([
      "OrreryImmersiveHeader",
    ]);
    const header = read("src/components/orrery/OrreryImmersiveHeader.tsx");
    expect(header).toContain("headerScrimLayout(");
    for (const name of [
      ...componentsWith("derived-rect"),
      ...componentsWith("obstacle-rect"),
    ]) {
      if (name === "OrreryFeedback") {
        // Notices sit on an OPAQUE surface backing (palette text on surface).
        const screen = read(SCREEN);
        const sites = [
          ...screen.matchAll(
            /<OrreryFeedback\s+obstacleId="[^"]+"(?:\s+testID="[^"]+")?\s+style=\{\[styles\.\w+, \{ backgroundColor: colors\.surface \}\]\}/g,
          ),
        ];
        const all = [...screen.matchAll(/<OrreryFeedback\s/g)];
        expect(sites.length, "every notice has an opaque surface").toBe(
          all.length,
        );
        continue;
      }
      expect(
        read(`src/components/orrery/${name}.tsx`),
        `${name} is a see-through Orrery card`,
      ).toContain('treatment="orrery-overlay"');
    }
  });

  it("the dim's corners match the 8 dp HUD plates it backs (38.7-14)", () => {
    expect(read("src/components/orrery/OrreryHudCorners.tsx")).toContain(
      "export const HUD_PLATE: ViewStyle = { borderRadius: RADII.sm };",
    );
    expect(read("src/components/orrery/v2/draw-overlay.ts")).toContain(
      "export const OCCLUSION_RADIUS = RADII.sm;",
    );
  });
});
