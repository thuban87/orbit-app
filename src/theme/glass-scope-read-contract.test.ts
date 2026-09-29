/**
 * Glass-scope read contract (D-34 / RG-029 `ui-accessibility/AUD-UIA-001`;
 * T-38.4-20-01).
 *
 * Every read of a glass-overridden token rendered inside a `GlassSurface`
 * card, a `ChromeScrim`, a `ShellAppBar` `trailing` subtree or a discovered
 * scope slot must resolve THROUGH the scope: from a `ScopedPalette` render
 * prop or a child component that calls `useTheme()` itself. A palette resolved
 * above the scope renders the root tone and silently bypasses the D-24 proof.
 *
 * The analyzer (`__contract__/glass-scope-reads.ts`) derives the overridden
 * token set from `resolveGlassForegroundPalette`, so a future override widens
 * this contract automatically.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeGlassScopeReads,
  deriveGlassOverriddenKeys,
  discoverScopeWrappers,
  type GlassScopeFinding,
  SCOPE_REGION_SCOPES,
  type SourceFileInput,
  scopeRegionLabels,
} from "./__contract__/glass-scope-reads";

const REPO = join(__dirname, "..", "..");
const SRC = join(REPO, "src");

/**
 * Deliberately-root reads inside a scope: `file:line:expr` → reason. An entry
 * is allowed only for a read that must keep the ROOT palette (for example an
 * opaque surface nested inside a scope). Empty: every finding is swept.
 */
const GLASS_SCOPE_READ_ALLOWLIST: Record<string, string> = {};

/**
 * The discovered scope slots. A new wrapper (a component or render helper that
 * renders a ReactNode slot inside a scope) changes this list, so it is noticed.
 * `AnchoredPanel` is absent: its surface is an orrery overlay (root palette).
 */
const EXPECTED_SCOPE_SLOTS = [
  "ProfileSection.children",
  "ProfileSection.headerAction",
  "src/screens/AIConnectionScreen.tsx#card(body)",
];

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (
        name === "node_modules" ||
        name === "__snapshots__" ||
        name === "__dev__"
      )
        continue;
      walk(path, out);
    } else if (
      name.endsWith(".tsx") &&
      !name.endsWith(".test.tsx") &&
      !name.endsWith(".spec.tsx")
    ) {
      out.push(path);
    }
  }
  return out;
}

const overridden = deriveGlassOverriddenKeys();

function fixture(source: string): GlassScopeFinding[] {
  const file = "fixture.tsx";
  const wrappers = discoverScopeWrappers([{ file, source }]);
  return analyzeGlassScopeReads(file, source, overridden, wrappers);
}

const HEADER = `
import { useTheme, useUnscopedTheme, useGlassForegroundColors, type ThemePalette } from "@/theme";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { ScopedPalette } from "@/components/ui/ScopedPalette";
import { ShellAppBar } from "@/components/ShellAppBar";
import { GlassForegroundScope } from "@/theme";
import { Text, View } from "react-native";
`;

describe("deriveGlassOverriddenKeys", () => {
  it("is exactly the keys the Standard-Light glass resolver changes", () => {
    expect([...overridden].sort()).toEqual(
      [
        "accentText",
        "danger",
        "rogue",
        "statusDecay",
        "statusStable",
        "statusWobble",
        "textSecondary",
      ].sort(),
    );
  });
});

describe("analyzeGlassScopeReads — violations", () => {
  it.each([
    [
      "an outer colors.danger inside <GlassSurface>",
      `export function A() { const { colors } = useTheme();
        return <GlassSurface><Text style={{ color: colors.danger }} /></GlassSurface>; }`,
      "direct",
      "GlassSurface",
    ],
    [
      "an outer read inside <ChromeScrim>",
      `export function A() { const { colors } = useTheme();
        return <ChromeScrim><Text style={{ color: colors.textSecondary }} /></ChromeScrim>; }`,
      "direct",
      "ChromeScrim",
    ],
    [
      "an outer read inside <ShellAppBar trailing={…}>",
      `export function A() { const { colors } = useTheme();
        return <ShellAppBar title="t" trailing={<Text style={{ color: colors.accentText }} />} />; }`,
      "direct",
      "ShellAppBar.trailing",
    ],
    [
      "an outer read through theme.colors",
      `export function A() { const theme = useTheme();
        return <GlassSurface><Text style={{ color: theme.colors.rogue }} /></GlassSurface>; }`,
      "direct",
      "GlassSurface",
    ],
    [
      "an outer local JSX value rendered inside the scope (HomeScreen listEmptyContent shape)",
      `export function A() { const { colors } = useTheme();
        const note = <Text style={{ color: colors.textSecondary }} />;
        return <ChromeScrim>{note}</ChromeScrim>; }`,
      "indirect",
      "ChromeScrim",
    ],
    [
      "a local function closing over colors.accentText, called inside the scope",
      `export function A() { const { colors } = useTheme();
        function link() { return <Text style={{ color: colors.accentText }} />; }
        return <GlassSurface>{link()}</GlassSurface>; }`,
      "indirect",
      "GlassSurface",
    ],
    [
      "a computed palette access inside the scope",
      `export function A({ toneKey }: { toneKey: "danger" }) { const { colors } = useTheme();
        return <GlassSurface><Text style={{ color: colors[toneKey] }} /></GlassSurface>; }`,
      "computed",
      "GlassSurface",
    ],
    [
      "a whole outer palette passed as a prop",
      `export function A() { const { colors } = useTheme();
        return <GlassSurface><Row palette={colors} /></GlassSurface>; }`,
      "palette-prop",
      "GlassSurface",
    ],
    [
      "a ThemePalette component parameter read inside its own <GlassSurface>",
      `export function Row({ colors }: { colors: ThemePalette }) {
        return <GlassSurface><Text style={{ color: colors.statusDecay }} /></GlassSurface>; }`,
      "direct",
      "GlassSurface",
    ],
  ])("reports %s", (_label, body, kind, scope) => {
    const findings = fixture(HEADER + body);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind, scope, file: "fixture.tsx" });
    expect(findings[0].line).toBeGreaterThan(0);
  });

  it("reports an outer overridden read inside a direct <GlassForegroundScope> subtree (no GlassSurface; C2-M1)", () => {
    const findings = fixture(
      `${HEADER}export function Row() { const { colors } = useTheme();
        return <GlassForegroundScope><Text style={{ color: colors.textSecondary }} /></GlassForegroundScope>; }`,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      kind: "direct",
      scope: "GlassForegroundScope",
      expr: "colors.textSecondary",
    });
  });

  it("reports an outer ring read (ringVisual(…, colors)) inside a direct scope as a palette hand-off", () => {
    const findings = fixture(
      `${HEADER}export function Row() { const { colors } = useTheme();
        return <GlassForegroundScope><View style={{ borderColor: ring(colors) }} /></GlassForegroundScope>; }`,
    );
    expect(findings.map((f) => [f.kind, f.scope])).toEqual([
      ["palette-prop", "GlassForegroundScope"],
    ]);
  });

  it("reports reads inside a discovered wrapper's children and ReactNode slot (ProfileSection)", () => {
    const source = `${HEADER}
      function ProfileSection({ headerAction, children }: { headerAction?: React.ReactNode; children: React.ReactNode }) {
        return <GlassSurface><View>{headerAction}</View><View>{children}</View></GlassSurface>;
      }
      export function Host() { const { colors } = useTheme();
        return (
          <ProfileSection headerAction={<Text style={{ color: colors.accentText }} />}>
            <Text style={{ color: colors.danger }} />
          </ProfileSection>
        );
      }`;
    const findings = fixture(source);
    expect(findings.map((f) => [f.expr, f.scope])).toEqual([
      ["colors.accentText", "ProfileSection.headerAction"],
      ["colors.danger", "ProfileSection.children"],
    ]);
  });

  it("reports reads inside the body argument of a same-file card(lane, body) render helper", () => {
    const source = `${HEADER}
      export function Host() { const { colors } = useTheme();
        function card(lane: string, body: React.ReactNode) {
          return <GlassSurface key={lane}>{body}</GlassSurface>;
        }
        return <View>{card("a", <Text style={{ color: colors.textSecondary }} />)}</View>;
      }`;
    const findings = fixture(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: "direct", scope: "card(body)" });
  });
});

describe("analyzeGlassScopeReads — passes", () => {
  it.each([
    [
      "a ScopedPalette render prop inside the scope",
      `export function A() {
        return <GlassSurface><ScopedPalette>{(scoped) => <Text style={{ color: scoped.danger }} />}</ScopedPalette></GlassSurface>; }`,
    ],
    [
      "a child component that calls useTheme() itself",
      `function Caption() { const { colors } = useTheme(); return <Text style={{ color: colors.textSecondary }} />; }
      export function A() { return <GlassSurface><Caption /></GlassSurface>; }`,
    ],
    [
      "a non-overridden token (textPrimary) through the outer palette",
      `export function A() { const { colors } = useTheme();
        return <GlassSurface><Text style={{ color: colors.textPrimary }} /></GlassSurface>; }`,
    ],
    [
      'an orrery-overlay surface (treatment="orrery-overlay")',
      `export function A() { const { colors } = useTheme();
        return <GlassSurface treatment="orrery-overlay"><Text style={{ color: colors.danger }} /></GlassSurface>; }`,
    ],
    [
      "a useUnscopedTheme() binding",
      `export function A() { const { colors } = useUnscopedTheme();
        return <GlassSurface><Text style={{ color: colors.danger }} /></GlassSurface>; }`,
    ],
    [
      "a useGlassForegroundColors() binding",
      `export function A() { const glass = useGlassForegroundColors();
        return <GlassSurface><Text style={{ color: glass.textSecondary }} /></GlassSurface>; }`,
    ],
    [
      "reads outside any scope",
      `export function A() { const { colors } = useTheme();
        return <View><Text style={{ color: colors.danger }} /><GlassSurface><Text>ok</Text></GlassSurface></View>; }`,
    ],
  ])("passes %s", (_label, body) => {
    expect(fixture(HEADER + body)).toEqual([]);
  });
});

describe("scope regions — every handled scope element yields a region (C2-M1)", () => {
  const MINIMAL: Record<(typeof SCOPE_REGION_SCOPES)[number], string> = {
    GlassSurface: "<GlassSurface><Text>x</Text></GlassSurface>",
    ChromeScrim: "<ChromeScrim><Text>x</Text></ChromeScrim>",
    "ShellAppBar.trailing":
      '<ShellAppBar title="t" trailing={<Text>x</Text>} />',
    GlassForegroundScope:
      "<GlassForegroundScope><Text>x</Text></GlassForegroundScope>",
  };

  it("the handled set is exactly GlassSurface, ChromeScrim, ShellAppBar.trailing and GlassForegroundScope", () => {
    expect([...SCOPE_REGION_SCOPES].sort()).toEqual([
      "ChromeScrim",
      "GlassForegroundScope",
      "GlassSurface",
      "ShellAppBar.trailing",
    ]);
  });

  it.each(SCOPE_REGION_SCOPES.map((scope) => [scope]))(
    "a minimal %s instance yields its region",
    (scope) => {
      const source = `${HEADER}export function A() { return ${MINIMAL[scope]}; }`;
      expect(scopeRegionLabels("fixture.tsx", source)).toEqual([scope]);
    },
  );

  it("a primitive's own implementation is not discovered as a wrapper (its orrery exception stands)", () => {
    // GlassSurface renders its children inside GlassForegroundScope only for the
    // card treatment; the analyzer's hard-coded GlassSurface branch owns that
    // rule. Discovering "GlassSurface.children" through the new branch would
    // drop the orrery-overlay exception (a false positive, fixed in the analyzer).
    const source = `${HEADER}
      export function GlassSurface({ children, treatment }: { children?: React.ReactNode; treatment?: string }) {
        return <View>{treatment === "orrery-overlay" ? children : <GlassForegroundScope>{children}</GlassForegroundScope>}</View>;
      }
      export function ChromeScrim({ children }: { children?: React.ReactNode }) {
        return <View><GlassForegroundScope>{children}</GlassForegroundScope></View>;
      }
      export function Host() { const { colors } = useTheme();
        return <GlassSurface treatment="orrery-overlay"><Text style={{ color: colors.danger }} /></GlassSurface>;
      }`;
    expect(discoverScopeWrappers([{ file: "fixture.tsx", source }])).toEqual(
      [],
    );
    expect(fixture(source)).toEqual([]);
  });

  it("an overlapping region pair (a scope directly inside a scope) reports each read once", () => {
    const findings = fixture(
      `${HEADER}export function A() { const { colors } = useTheme();
        return <ChromeScrim><GlassForegroundScope><Text style={{ color: colors.danger }} /></GlassForegroundScope></ChromeScrim>; }`,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].scope).toBe("GlassForegroundScope");
  });
});

describe("glass-scope read contract (repo)", () => {
  const files: SourceFileInput[] = walk(SRC, []).map((path) => ({
    file: relative(REPO, path),
    source: readFileSync(path, "utf8"),
  }));
  const wrappers = discoverScopeWrappers(files);
  const findings = files.flatMap(({ file, source }) =>
    analyzeGlassScopeReads(file, source, overridden, wrappers),
  );
  const keyOf = (f: GlassScopeFinding) => `${f.file}:${f.line}:${f.expr}`;

  it("scans the real source tree", () => {
    expect(files.length).toBeGreaterThan(150);
  });

  it("discovers exactly the known scope slots", () => {
    expect(
      wrappers.map((w) =>
        w.kind === "component"
          ? `${w.owner}.${w.slot}`
          : `${w.file}#${w.owner}(${w.slot})`,
      ),
    ).toEqual(EXPECTED_SCOPE_SLOTS);
  });

  it("has no out-of-scope overridden-token read inside a glass/chrome scope", () => {
    const live = findings.filter(
      (f) => !(keyOf(f) in GLASS_SCOPE_READ_ALLOWLIST),
    );
    expect(
      live.map(
        (f) => `${f.file}:${f.line} [${f.kind}] ${f.expr} in ${f.scope}`,
      ),
    ).toEqual([]);
  });

  it("keeps every allowlist entry reasoned and live", () => {
    const liveKeys = new Set(findings.map(keyOf));
    for (const [key, reason] of Object.entries(GLASS_SCOPE_READ_ALLOWLIST)) {
      expect(reason.trim().length, key).toBeGreaterThan(0);
      expect(liveKeys.has(key), `stale allowlist entry ${key}`).toBe(true);
    }
  });
});
