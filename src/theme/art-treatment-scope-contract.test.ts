/**
 * Art-treatment blast-radius contract (38.5-06; owner rulings D-28, D-12, D-04).
 *
 * The shared primitives have large blast radii (ShellAppBar ~25 consumers,
 * GlassSurface ~25 files, ChromeScrim 7 screens). The per-combination table may
 * reach ONLY the five v2-marked components, through explicit opt-ins:
 *   - `artComponent=` on the Contacts count label (`ChromeScrim`), the Contacts
 *     header and the Digest header (`ShellAppBar`);
 *   - `treatment="contact-entry"` on the Contacts Card-view card (`GridCard`);
 *   - `useArtTreatment(` inside the primitives that honour those opt-ins, plus the
 *     table-driven `ListRow`.
 * Plus one orchestrator addition (38.5-01 gap H-3): `DashboardControlRow` reads
 * the `contactsTopButtons` cell for its ACTIVE-state backing only. No overlay
 * menu and no Orrery control or menu is ever table-driven (D-12, D-04).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(__dirname, "..", "..");
const SRC = join(REPO, "src");

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "__snapshots__") continue;
      walk(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

/** Source with comments removed, so a doc mention is never counted as a use. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const FILES = walk(SRC, []).map((path) => ({
  file: relative(REPO, path),
  code: code(readFileSync(path, "utf8")),
}));

function occurrences(pattern: RegExp): { file: string; match: string }[] {
  return FILES.flatMap(({ file, code: src }) =>
    [...src.matchAll(pattern)].map((m) => ({
      file,
      // Formatting-independent: collapse whitespace and a trailing comma.
      match: m[0]
        .replace(/\s+/g, " ")
        .replace(/\(\s+/g, "(")
        .replace(/,?\s*\)$/, ")"),
    })),
  );
}

describe("art-treatment opt-ins are confined to the five v2-marked sites (D-28)", () => {
  it("artComponent= appears only on the count label, the Contacts header and the Digest header", () => {
    expect(
      occurrences(/artComponent="[A-Za-z]+"/g).map(
        ({ file, match }) => `${file} ${match}`,
      ),
    ).toEqual([
      'src/screens/DigestScreen.tsx artComponent="digestHeader"',
      'src/screens/HomeScreen.tsx artComponent="contactsCountLabel"',
      'src/screens/HomeScreen.tsx artComponent="contactsHeader"',
    ]);
    // No dynamic artComponent value anywhere.
    expect(occurrences(/artComponent=\{/g)).toEqual([]);
  });

  it("the count-label opt-in sits on the ChromeScrim that renders the count, not the empty panel", () => {
    const home = FILES.find((f) => f.file === "src/screens/HomeScreen.tsx");
    const src = home?.code ?? "";
    const scrims = [...src.matchAll(/<ChromeScrim\b[\s\S]*?>/g)];
    const optedIn = scrims.filter((m) => m[0].includes("artComponent="));
    expect(optedIn).toHaveLength(1);
    const after = src.slice(optedIn[0].index, (optedIn[0].index ?? 0) + 600);
    expect(after).toContain('testID="dashboard-header-count"');
    // The empty panel and every other ChromeScrim stay on the default path.
    expect(scrims.length).toBeGreaterThanOrEqual(2);
  });

  it("the header opt-ins sit on the Contacts and Digest ShellAppBars", () => {
    const home =
      FILES.find((f) => f.file === "src/screens/HomeScreen.tsx")?.code ?? "";
    const digest =
      FILES.find((f) => f.file === "src/screens/DigestScreen.tsx")?.code ?? "";
    expect(home).toMatch(
      /<ShellAppBar\b[^>]*title="Orbit"[^>]*artComponent="contactsHeader"/,
    );
    expect(digest).toMatch(
      /<ShellAppBar\b[^>]*title=\{DIGEST\}[^>]*artComponent="digestHeader"/,
    );
    // The Digest message/notice scrims are not marked.
    expect(digest).not.toMatch(/<ChromeScrim\b[^>]*artComponent=/);
  });

  it('treatment="contact-entry" is passed only by GridCard', () => {
    expect(
      occurrences(/treatment="contact-entry"/g).map(({ file }) => file),
    ).toEqual(["src/components/GridCard.tsx"]);
    expect(
      occurrences(/["']contact-entry["']/g)
        .map(({ file }) => file)
        .filter((f, i, all) => all.indexOf(f) === i)
        .sort(),
    ).toEqual([
      "src/components/GridCard.tsx",
      "src/components/ui/GlassSurface.tsx",
      // 38.5-09 M-2: the bare-text classifier READS the treatment to classify
      // GridCard's text per combination. Test/tool support only, never
      // imported by app code, so it is not an opt-in.
      "src/theme/__contract__/bare-text-sites.ts",
    ]);
  });

  it("useArtTreatment( is called only by the opted-in primitives, ListRow and the control-row active state", () => {
    const calls = occurrences(/useArtTreatment\(([^)]*)\)/g).filter(
      ({ file }) => file !== "src/theme/use-art-treatment.ts",
    );
    expect(calls.map(({ file, match }) => `${file} ${match}`).sort()).toEqual(
      [
        "src/components/ShellAppBar.tsx useArtTreatment(artComponent)",
        'src/components/ListRow.tsx useArtTreatment("contactsListEntries")',
        "src/components/ui/ChromeScrim.tsx useArtTreatment(artComponent)",
        'src/components/control-surface/DashboardControlRow.tsx useArtTreatment("contactsTopButtons")',
        'src/components/ui/GlassSurface.tsx useArtTreatment(treatment === "contact-entry" ? "contactsCardEntries" : undefined)',
      ].sort(),
    );
  });

  it("no Orrery file and no other control-surface file references the table (D-12, D-04)", () => {
    const offenders = FILES.filter(
      ({ file, code: src }) =>
        (file.startsWith("src/components/orrery/") ||
          file.startsWith("src/screens/Orrery") ||
          (file.startsWith("src/components/control-surface/") &&
            file !==
              "src/components/control-surface/DashboardControlRow.tsx")) &&
        /artComponent|contact-entry|useArtTreatment|art-treatments/.test(src),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("DashboardControlRow reads only the active-state backing; its menus stay untouched", () => {
    const row =
      FILES.find(
        (f) =>
          f.file === "src/components/control-surface/DashboardControlRow.tsx",
      )?.code ?? "";
    expect(row).not.toMatch(/artComponent|contact-entry/);
    expect(row.match(/useArtTreatment\(/g)).toHaveLength(1);
    expect(row).toMatch(/controlTriggerBacking\(/);
  });
});

describe("ListRow palette reads (C2-L4)", () => {
  const listRow =
    FILES.find((f) => f.file === "src/components/ListRow.tsx")?.code ?? "";

  it("the opaque category chip's text reads the ROOT palette through useUnscopedTheme()", () => {
    expect(listRow).toMatch(
      /const \{ colors: rootColors \} = useUnscopedTheme\(\);/,
    );
    const chip = listRow.slice(
      listRow.indexOf("dashboard-list-row-category-"),
      listRow.indexOf("dashboard-list-row-category-") + 700,
    );
    expect(chip).toContain("rootColors.surfaceElevated");
    expect(chip).toContain("rootColors.textSecondary");
  });

  it("every other colour read comes from the ScopedPalette render prop, not a top-level useTheme()", () => {
    expect(listRow).toMatch(/<ScopedPalette>/);
    expect(listRow).not.toMatch(/\buseTheme\(\)/);
  });
});
