/**
 * Repo-wide accent foreground role contract (38.4 D-63, owner; ADR-084; RG-029
 * `ui-accessibility/AUD-UIA-001`/`AUD-UIA-002`; review B1 WR-01/WR-02/IN-01,
 * C WR-01, D WR-02/IN-01/IN-02).
 *
 * Two rules, over every non-test `src/**\/*.ts(x)` file:
 *
 *   1. A text or glyph foreground never paints the accent FILL. On a
 *      non-accent surface it reads `accentText` (the link/text role, which
 *      carries the D-24/D-26 Standard-Light glass variant when read inside a
 *      glass scope).
 *   2. A label or glyph ON an accent fill never paints the page `background`
 *      token. It reads `onAccent`, the only token ADR-084 validates on `fill`.
 *
 * The Plan 16 Table C contract (`accent-text-glass-contract.test.ts`) anchors
 * individual rows and matches a literal `color: colors.X` / `tone="X"`, so a
 * ternary (`tone={isFavourite ? "accent" : …}`) or a multi-line style object
 * slipped past it. This contract walks the TypeScript AST instead
 * (`__contract__/accent-foreground-roles.ts`): every arm of a conditional,
 * both sides of `??`/`||`, call arguments and same-file `const` aliases.
 *
 * The allowlist is for paint that is NOT a text/glyph foreground even though
 * its prop is named `color`/`tone`/`tintColor`: the two graphic tints the
 * owner kept (the tab bar and the pull-to-refresh spinner, D-63) and Skia
 * canvas paints, where `color` IS the fill or stroke of a drawn shape in an
 * accessibility-hidden canvas (the RG-029 E-4/E-5 fill class). A stale entry
 * (it no longer matches a finding) fails, so the list cannot rot.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type AccentRoleFinding,
  type AccentRoleRule,
  scanAccentForegroundRoles,
} from "./__contract__/accent-foreground-roles";

const REPO = join(__dirname, "..", "..");
const SRC = join(REPO, "src");

interface AllowEntry {
  file: string;
  rule: AccentRoleRule;
  /** The whole slot, whitespace-collapsed, exactly as the analyzer reports it. */
  text: string;
  reason: string;
}

const TAB_BAR =
  "Tab-bar active icon tint: a graphic tint the owner kept on the accent fill (D-63).";
const PULL_TO_REFRESH =
  "Pull-to-refresh spinner tint: a graphic tint the owner kept on the accent fill (D-63).";
const SKIA_FILL =
  "Skia paint in an accessibility-hidden canvas: `color` is the fill/stroke of a drawn shape, not a text or glyph foreground (RG-029 E-4/E-5 fill class).";

const ACCENT_FOREGROUND_ALLOWLIST: readonly AllowEntry[] = [
  {
    file: "src/navigation/RootNavigator.tsx",
    rule: "accent-as-text",
    text: 'tone={focused ? "accent" : "textSecondary"}',
    reason: TAB_BAR,
  },
  {
    file: "src/screens/HomeScreen.tsx",
    rule: "accent-as-text",
    text: "tintColor={colors.accent}",
    reason: PULL_TO_REFRESH,
  },
  {
    file: "src/components/CardGrid.tsx",
    rule: "accent-as-text",
    text: "tintColor={colors.accent}",
    reason: PULL_TO_REFRESH,
  },
  {
    file: "src/screens/SystemBuilderScreen.tsx",
    rule: "accent-as-text",
    text: "color={colors.accent}",
    reason: `${SKIA_FILL} Builder backdrop Circle (Table C M9, kept).`,
  },
  {
    file: "src/screens/SystemBuilderScreen.tsx",
    rule: "background-on-accent",
    text: "color={colors.background}",
    reason: `${SKIA_FILL} Builder backdrop canvas <Fill>.`,
  },
  {
    file: "src/components/orrery/OrreryWorld.tsx",
    rule: "accent-as-text",
    text: "color={colors.accent}",
    reason: `${SKIA_FILL} Orrery reorder ghost (Table C E-5 Orrery canvas).`,
  },
  {
    file: "src/components/orrery/SatelliteBody.tsx",
    rule: "accent-as-text",
    text: "color={colors.accent}",
    reason: `${SKIA_FILL} Orrery focus ring stroke (Table C E-5 Orrery canvas).`,
  },
  {
    file: "src/components/orrery/SystemPreviewCanvas.tsx",
    rule: "accent-as-text",
    text: "color={ marker.id === focusedId ? colors.accent : colors.textSecondary }",
    reason: `${SKIA_FILL} System preview focused-marker Circle.`,
  },
  {
    file: "src/components/orrery/SystemPreviewCanvas.tsx",
    rule: "background-on-accent",
    text: "color={colors.background}",
    reason: `${SKIA_FILL} System preview canvas <Fill>.`,
  },
  {
    file: "src/screens/CropPhotoScreen.tsx",
    rule: "background-on-accent",
    text: "color={colors.background}",
    reason: `${SKIA_FILL} Crop canvas <Fill> behind the photo.`,
  },
];

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "__snapshots__") continue;
      walk(path, out);
    } else if (
      /\.tsx?$/.test(name) &&
      !/\.test\.tsx?$/.test(name) &&
      !name.endsWith(".d.ts")
    ) {
      out.push(path);
    }
  }
  return out;
}

function scanRepo(): AccentRoleFinding[] {
  return walk(SRC, []).flatMap((path) =>
    scanAccentForegroundRoles(relative(REPO, path), readFileSync(path, "utf8")),
  );
}

function allowed(finding: AccentRoleFinding): AllowEntry | undefined {
  return ACCENT_FOREGROUND_ALLOWLIST.find(
    (entry) =>
      entry.file === finding.file &&
      entry.rule === finding.rule &&
      entry.text === finding.text,
  );
}

function describeFinding(finding: AccentRoleFinding): string {
  const fix =
    finding.rule === "accent-as-text"
      ? "use accentText (glass-scoped where on glass)"
      : "use onAccent";
  return `${finding.file}:${finding.line} ${finding.rule} (${fix}): ${finding.text}`;
}

describe("accent foreground roles, repo-wide (D-63, ADR-084)", () => {
  const findings = scanRepo();

  it("no text or glyph foreground paints the accent fill", () => {
    const offenders = findings
      .filter((f) => f.rule === "accent-as-text" && !allowed(f))
      .map(describeFinding);
    expect(offenders).toEqual([]);
  });

  it("no label or glyph on an accent fill paints the page background", () => {
    const offenders = findings
      .filter((f) => f.rule === "background-on-accent" && !allowed(f))
      .map(describeFinding);
    expect(offenders).toEqual([]);
  });

  it.each(
    ACCENT_FOREGROUND_ALLOWLIST.map(
      (entry) => [`${entry.file} ${entry.text}`, entry] as const,
    ),
  )("allowlist entry %s still matches exactly one finding", (_label, entry) => {
    expect(entry.reason.trim().length).toBeGreaterThan(20);
    const matches = findings.filter(
      (f) =>
        f.file === entry.file && f.rule === entry.rule && f.text === entry.text,
    );
    expect(matches).toHaveLength(1);
  });

  it("keeps the allowlist to the two graphic tints and Skia canvas paints", () => {
    for (const entry of ACCENT_FOREGROUND_ALLOWLIST) {
      expect(
        [TAB_BAR, PULL_TO_REFRESH].includes(entry.reason) ||
          entry.reason.startsWith(SKIA_FILL),
        entry.file,
      ).toBe(true);
    }
  });
});

describe("accent foreground analyzer catches the forms that slipped past Table C", () => {
  const scan = (source: string) =>
    scanAccentForegroundRoles("fixture.tsx", source).map((f) => [
      f.rule,
      f.slot,
      f.leaf,
    ]);

  it("a ternary tone and a ternary style colour", () => {
    expect(
      scan(`<Icon name="favourite" tone={isFavourite ? "accent" : "textSecondary"} />;
const s = { color: active ? colors.accent : colors.textPrimary };`),
    ).toEqual([
      ["accent-as-text", "tone", '"accent"'],
      ["accent-as-text", "color", "colors.accent"],
    ]);
  });

  it("a multi-line ternary style object", () => {
    expect(
      scan(`const s = [
  styles.label,
  {
    color:
      link.url.trim().length === 0
        ? colors.textSecondary
        : colors.accent,
  },
];`),
    ).toEqual([["accent-as-text", "color", "colors.accent"]]);
  });

  it("the label on an accent fill, literal, conditional and as an Icon tone", () => {
    expect(
      scan(`<Pressable style={{ backgroundColor: colors.accent }}>
  <Text style={{ color: colors.background }}>Done</Text>
  <Text style={{ color: primary ? colors.background : colors.accent }}>x</Text>
  <Icon tone={isActive ? "background" : "textSecondary"} />
</Pressable>;`),
    ).toEqual([
      ["background-on-accent", "color", "colors.background"],
      ["background-on-accent", "color", "colors.background"],
      ["accent-as-text", "color", "colors.accent"],
      ["background-on-accent", "tone", '"background"'],
    ]);
  });

  it("follows a same-file const alias, ?? / || fallbacks and call arguments", () => {
    expect(
      scan(`function Row() {
  const tint = selected ? palette.accent : palette.textPrimary;
  return <Text style={{ color: tint }} />;
}
const a = { color: override ?? colors.accent };
const b = { color: asColor(palette.accent) };
const c = { color };`),
    ).toEqual([
      ["accent-as-text", "color", "palette.accent"],
      ["accent-as-text", "color", "colors.accent"],
      ["accent-as-text", "color", "palette.accent"],
    ]);
  });

  it("a tone-object helper's text key (read later as `color: tone.text`)", () => {
    expect(
      scan(`function segmentColors(selected: boolean) {
  if (selected) {
    return { background: colors.accent, border: colors.accent, text: colors.background };
  }
  return { background: colors.surface, border: colors.border, text: colors.textPrimary };
}`),
    ).toEqual([["background-on-accent", "text", "colors.background"]]);
  });

  it("never flags an accent fill, border or track, or the correct roles", () => {
    expect(
      scan(`<Pressable style={{ backgroundColor: colors.accent, borderColor: colors.accent }}>
  <Text style={{ color: colors.onAccent }}>Done</Text>
  <Text style={{ color: active ? colors.accentText : colors.textSecondary }}>Open</Text>
  <Icon tone={selected ? "accentText" : "textSecondary"} />
  <Switch trackColor={{ false: colors.border, true: colors.accent }} />
  <Screen options={{ tabBarActiveTintColor: colors.accent }} />
</Pressable>;`),
    ).toEqual([]);
  });
});
