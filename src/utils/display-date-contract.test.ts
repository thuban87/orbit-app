import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBirthdayForStorage } from "@/screens/edit-contact-logic";

/**
 * Display-date contract (38.9 D-23, D-48, D-70; threat T-38.9-31).
 *
 * The date-only display formatters in `src/utils/dates.ts` are display only.
 * Storage keys, query parameters and persisted values stay on
 * `formatLocalDate()` (CLAUDE.md conventions). Source-scan idiom: most
 * consumers import react-native, which the node vitest environment cannot
 * load, so the rule is asserted against the source on disk.
 */

const DISPLAY_FORMATTERS = [
  "formatDisplayDate",
  "formatDisplayDateOrFallback",
  "formatMonthDay",
  "formatStoredBirthdayForDisplay",
] as const;

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const isTestFile = (path: string) => /\.test\.(ts|tsx)$/.test(path);

/** Source with block and line comments removed, so prose cannot trip a rule. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Names imported from `@/utils/dates` (any import form). */
function importedFromDates(src: string): string[] {
  const names: string[] = [];
  const re =
    /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["'](?:@\/utils\/dates|(?:\.\.?\/)+(?:utils\/)?dates)["']/g;
  let match = re.exec(src);
  while (match) {
    for (const part of match[1].split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name) names.push(name);
    }
    match = re.exec(src);
  }
  return names;
}

const PRODUCTION_FILES = walk("src").filter((path) => !isTestFile(path));

describe("display formatters are never storage (D-23)", () => {
  it("no production file builds a date with toISOString().split", () => {
    const offenders = PRODUCTION_FILES.filter((path) =>
      /toISOString\(\)\s*\.split/.test(codeOnly(source(path))),
    );
    expect(offenders).toEqual([]);
  });

  it("no file under src/db imports a display formatter", () => {
    const offenders = PRODUCTION_FILES.filter(
      (path) => path.startsWith(join("src", "db")) || path.startsWith("src/db"),
    ).filter((path) =>
      importedFromDates(source(path)).some((name) =>
        (DISPLAY_FORMATTERS as readonly string[]).includes(name),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it.each([
    "src/screens/edit-contact-logic.ts",
    "src/logic/picked-contact-map.ts",
    "src/logic/reconcile-diff.ts",
    "src/db/compose-research-read.ts",
  ])("%s imports no display formatter (C5-H1, C7-L2)", (path) => {
    const imported = importedFromDates(source(path));
    for (const name of DISPLAY_FORMATTERS) {
      expect(imported).not.toContain(name);
    }
    for (const name of DISPLAY_FORMATTERS) {
      expect(codeOnly(source(path))).not.toMatch(new RegExp(`\\b${name}\\(`));
    }
  });

  it("no production line assigns a display formatter to a key, date or occurred_at", () => {
    const keyAssign =
      /\b(?:key|dateKey|date_key|occurred_at|occurredAt|snooze_until|meaningful_date|birthday)\s*[:=]\s*formatDisplayDate/;
    const testIdUse = /testID=\{[^}]*formatDisplayDate/;
    const offenders: string[] = [];
    for (const path of PRODUCTION_FILES) {
      codeOnly(source(path))
        .split("\n")
        .forEach((line, index) => {
          if (keyAssign.test(line) || testIdUse.test(line)) {
            offenders.push(`${path}:${index + 1}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});

describe("the birthday storage helper is unchanged (D-23, C5-H1)", () => {
  it("keeps a known-year birthday as YYYY-MM-DD", () => {
    expect(buildBirthdayForStorage("1990-06-02", false)).toBe("1990-06-02");
  });

  it("stores a year-unknown birthday as MM-DD", () => {
    expect(buildBirthdayForStorage("2021-02-29", true)).toBe("02-29");
  });
});

describe("Digest day detail uses the weekday display form (D-48)", () => {
  it("formats the day label and both accessibility strings", () => {
    const src = source("src/components/digest/DigestDayDetail.tsx");
    const calls =
      src.match(/formatDisplayDate(?:OrFallback)?\([^)]*weekday:\s*true/g) ??
      [];
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(src).not.toMatch(/<AppText role="label">\{date\}<\/AppText>/);
    expect(src).not.toMatch(/`Activity for \$\{date\}`/);
    expect(src).not.toMatch(/`Loading activity for \$\{date\}`/);
  });
});
