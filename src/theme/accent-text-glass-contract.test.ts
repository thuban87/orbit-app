/**
 * Source-scan proof of the Plan 16 accent-text role swap (RG-029
 * `ui-accessibility/AUD-UIA-001`; ADR-084; D-24/D-26; T-38.4-16-03).
 *
 * The RG-029 inventory's Table C listed every site that painted the accent
 * FILL token as a text/glyph foreground. Plan 16 resolved each row in the
 * inventory's "Plan 16 resolution" table: `done` rows now read `accentText`
 * (the ADR-084 link/text role, which carries the Standard-Light glass variant
 * when read inside a glass scope). The palette tests prove the variant; this
 * test proves the SWAP itself, site by site, so a revert to `colors.accent`
 * fails here.
 *
 * Row format (see the inventory for the rule): `| M# | \`file\` | \`anchor\` |
 * offset | status | binding | backing |`. The anchor occurs exactly once in the
 * file; the site is `offset` lines from it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const INVENTORY = join(
  ROOT,
  ".planning/phases/38.4-audit-remediation-ui-performance-release/38.4-RG029-INVENTORY.md",
);
const SECTION = "### Plan 16 resolution (Table C)";
const TABLE_C_ROWS = 74;

/** `color: colors.X`, `color={colors.X}` or `tone="X"` (not borderColor etc.). */
const FOREGROUND =
  /(?<![A-Za-z])color(?::\s*|=\{\s*)[A-Za-z]+\.(\w+)|tone="(\w+)"/;
const FILL_AS_TEXT = /colors\.accent\b|tone="accent"/;

interface ResolutionRow {
  id: string;
  file: string;
  anchor: string | null;
  offset: number | null;
  status: string;
}

function parseResolution(markdown: string): ResolutionRow[] {
  const start = markdown.indexOf(SECTION);
  if (start < 0) return [];
  const body = markdown.slice(start + SECTION.length);
  const end = body.search(/\n#{1,3} /);
  const section = end < 0 ? body : body.slice(0, end);
  const rows: ResolutionRow[] = [];
  for (const line of section.split("\n")) {
    const match = line.match(
      /^\| (M\d+) \| `([^`]+)` \| (?:`([^`]+)`|—) \| ([+-]\d+|—) \| ([^|]+) \|/,
    );
    if (!match) continue;
    rows.push({
      id: match[1],
      file: match[2],
      anchor: match[3] ?? null,
      offset: match[4] === "—" ? null : Number(match[4]),
      status: match[5].trim(),
    });
  }
  return rows;
}

/**
 * Rows whose Plan 16 `accentText` swap a later owner ruling superseded with a
 * different, non-accent role. The anchored site must now read that token.
 * D-69 (owner, 2026-09-27): the "Enter a real date…" birthday errors on Import
 * Review and Bulk Review are errors, so they read `danger`.
 */
const SUPERSEDED_STATUS = /^superseded — D-(\d+): reads (\w+)$/;

/** null when the anchored site reads accentText; otherwise the failure. */
function checkDoneSite(
  source: string,
  anchor: string,
  offset: number,
  expected = "accentText",
): string | null {
  const lines = source.split("\n");
  const hits = lines.flatMap((line, index) =>
    line.includes(anchor) ? [index] : [],
  );
  if (hits.length !== 1)
    return `anchor occurs ${hits.length} times (must be exactly once)`;
  const siteIndex = hits[0] + offset;
  const site = lines[siteIndex];
  if (site === undefined) return `site line ${siteIndex + 1} is past EOF`;
  const found = site.match(FOREGROUND);
  if (!found)
    return `line ${siteIndex + 1} has no foreground colour: ${site.trim()}`;
  const token = found[1] ?? found[2];
  if (FILL_AS_TEXT.test(site) || token !== expected)
    return `line ${siteIndex + 1} uses ${token}, not ${expected}: ${site.trim()}`;
  return null;
}

describe("accent-text role swap contract (Plan 16, RG-029, ADR-084)", () => {
  const rows = parseResolution(readFileSync(INVENTORY, "utf8"));
  const done = rows.filter((row) => row.status === "done");

  it("resolves every Table C row exactly once", () => {
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    const expected = Array.from(
      { length: TABLE_C_ROWS },
      (_, index) => `M${index + 1}`,
    );
    expect([...ids].sort()).toEqual([...expected].sort());
  });

  it("uses only the documented statuses", () => {
    for (const row of rows) {
      expect(
        row.status === "done" ||
          /^obsolete — removed by Plan \d+ \([0-9a-f]{7,}\)$/.test(
            row.status,
          ) ||
          row.status.startsWith("kept — not a text/glyph foreground") ||
          SUPERSEDED_STATUS.test(row.status) ||
          row.status.startsWith("excluded — Orrery canvas (E-5"),
        `${row.id}: ${row.status}`,
      ).toBe(true);
    }
  });

  it("covers the 62 swapped sites (64 less the two D-69 supersessions)", () => {
    expect(done.length).toBe(62);
  });

  const superseded = rows.filter((row) => SUPERSEDED_STATUS.test(row.status));

  it("records the D-69 birthday errors as superseded to danger", () => {
    expect(
      superseded.map((row) => [row.id, row.file, row.status]).sort(),
    ).toEqual([
      [
        "M29",
        "src/screens/BulkReviewScreen.tsx",
        "superseded — D-69: reads danger",
      ],
      [
        "M5",
        "src/screens/ImportReviewScreen.tsx",
        "superseded — D-69: reads danger",
      ],
    ]);
  });

  it.each(superseded.map((row) => [row.id, row] as const))(
    "%s reads its superseding token at its anchored site",
    (_id, row) => {
      const token = (
        row.status.match(SUPERSEDED_STATUS) as RegExpMatchArray
      )[2];
      expect(
        checkDoneSite(
          readFileSync(join(ROOT, row.file), "utf8"),
          row.anchor as string,
          row.offset as number,
          token,
        ),
      ).toBeNull();
    },
  );

  it.each(done.map((row) => [row.id, row] as const))(
    "%s reads accentText at its anchored site",
    (_id, row) => {
      const path = join(ROOT, row.file);
      expect(existsSync(path)).toBe(true);
      expect(row.anchor).not.toBeNull();
      expect(row.offset).not.toBeNull();
      expect(
        checkDoneSite(
          readFileSync(path, "utf8"),
          row.anchor as string,
          row.offset as number,
        ),
      ).toBeNull();
    },
  );

  it("fails when a done site is reverted to the accent fill", () => {
    const source = [
      "<Pressable",
      '  accessibilityLabel="Retry"',
      "  onPress={retry}",
      "  style={[styles.btn, { borderColor: colors.accent }]}",
      ">",
      "  <Text style={{ color: colors.accent }}>Retry</Text>",
      "</Pressable>",
    ].join("\n");
    expect(checkDoneSite(source, "onPress={retry}", 3)).toMatch(
      /uses accent, not accentText/,
    );
    expect(
      checkDoneSite(
        source.replace(
          "color: colors.accent }}>",
          "color: colors.accentText }}>",
        ),
        "onPress={retry}",
        3,
      ),
    ).toBeNull();
    expect(
      checkDoneSite('<Icon name="select" tone="accent" />', "Icon", 0),
    ).toMatch(/uses accent/);
  });
});
