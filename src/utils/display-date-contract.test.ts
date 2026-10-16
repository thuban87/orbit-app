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

// D-70 / D-23 (reviews C6-L4, C7-L2): the stored-birthday displays use the
// birthday formatter, render only; the values behind them stay raw. (Four since
// 38.10-18: the retired Things to Remember screen was the fifth.) 38.11-04: Edit
// Contact's birthday trigger moved into the shared BirthdayField (Add and Edit
// both render it), so the component is the site and the Edit screen is not.
// 38.11-08: the Profile's Birthday tile (38.11 D-53) is a site.
describe("stored-birthday display sites (D-70)", () => {
  const BIRTHDAY_SITES = [
    "src/components/BirthdayField.tsx",
    "src/components/profile/RelationshipOverview.tsx",
    "src/screens/MergeConflictsScreen.tsx",
    // Research's caption logic moved into a node-testable helper (38.9-16).
    "src/screens/compose-research-logic.ts",
    "src/screens/ReconcileDetailScreen.tsx",
  ];

  it.each(BIRTHDAY_SITES)("%s calls formatStoredBirthdayForDisplay", (path) => {
    expect(codeOnly(source(path))).toMatch(/formatStoredBirthdayForDisplay\(/);
  });

  it.each(BIRTHDAY_SITES)(
    "%s never passes a birthday to the general D-48 formatter",
    (path) => {
      const code = codeOnly(source(path));
      expect(code).not.toMatch(
        /formatDisplayDate(?:OrFallback)?\([^)]*birthday/i,
      );
    },
  );

  it("Research formats the birthday, meaningful and entry dates at render only (D-29)", () => {
    const helper = codeOnly(source("src/screens/compose-research-logic.ts"));
    expect(helper).toMatch(
      /item\.id === "firstclass:birthday"\)\s*\{\s*return formatStoredBirthdayForDisplay\(item\.value\);/,
    );
    // Memory meaningful dates and current-state entry dates go through the
    // D-48 formatter with a raw fallback; the birthday formatter is not reused.
    expect(helper).toMatch(/formatDisplayDateOrFallback\(date, date\)/);
    expect(helper).toMatch(/withDate\(item\.value, item\.meaningfulDate\)/);
    expect(helper).toMatch(/withDate\(item\.value, item\.entryDate\)/);
    const screen = codeOnly(source("src/screens/ComposeResearchScreen.tsx"));
    expect(screen).toContain("researchItemDisplayValue(item)");
    // Add to AI carries the raw item.
    expect(screen).toContain("addToFocus(item)");
  });

  it("Reconcile formats only the birthday field and still chooses by option id", () => {
    const code = codeOnly(source("src/screens/ReconcileDetailScreen.tsx"));
    expect(code).toMatch(
      /field\.fieldFamily === "birthday"\s*\?\s*formatStoredBirthdayForDisplay\(value\)/,
    );
    expect(code).toContain("onChange={(option) => onChoice(option.id)}");
  });

  it("Merge conflicts keep differs() on the raw values", () => {
    const code = codeOnly(source("src/screens/MergeConflictsScreen.tsx"));
    expect(code).toMatch(/differs\(value\.survivor, value\.absorbed\)/);
    expect(code).toMatch(/\[conflict\.key\]: option\.id/);
  });
});

// 38.9-16 fold (38.9-13 out-of-scope findings #1-#2; D-23, D-48, D-66): the
// last raw date-only displays format at render only; the stored values, keys
// and choices stay raw.
describe("remaining date-only display sites (38.9-16)", () => {
  it("the AI model picker shows the catalog date in display form, raw fallback", () => {
    const code = codeOnly(source("src/screens/AIModelPickerScreen.tsx"));
    expect(code).toMatch(
      /formatDisplayDateOrFallback\(\s*openRouterCatalog\.updatedLocalDate,\s*openRouterCatalog\.updatedLocalDate,?\s*\)/,
    );
    expect(code).not.toMatch(/Updated \{openRouterCatalog\.updatedLocalDate\}/);
    // The freshness check still compares the stored local date key.
    expect(source("src/ai/openrouter-catalog.ts")).toMatch(
      /catalog\.updatedLocalDate !== formatLocalDate\(now\)/,
    );
  });

  it("Research custom items carry the field type; the read module formats nothing", () => {
    const read = codeOnly(source("src/db/compose-research-read.ts"));
    expect(read).toContain("fieldType: field.type");
    expect(read).toContain('value: field.rawValue ?? ""');
    const helper = codeOnly(source("src/screens/compose-research-logic.ts"));
    expect(helper).toMatch(
      /customValueDisplayText\(item\.fieldType, item\.value\)/,
    );
  });

  it("Merge conflicts read the field type and format custom choices at render only", () => {
    const code = codeOnly(source("src/screens/MergeConflictsScreen.tsx"));
    expect(code).toMatch(/defs\.label, defs\.type,/);
    expect(code).toMatch(
      /customConflictDisplayValues\(\s*field\.type,\s*field\.survivor_value!,\s*field\.absorbed_value!,?\s*\)/,
    );
    // The resolution stores only the option id.
    expect(code).toMatch(/\[field\.field_def_id\]: option\.id/);
  });
});

// D-65 / D-66 / D-67: the two native date pickers store formatLocalDate output
// only, never a display string, and set no date range.
describe("native date pickers (D-65, D-66, D-67)", () => {
  const editor = () => codeOnly(source("src/components/MemoryEditor.tsx"));
  const widget = () =>
    codeOnly(source("src/components/field-widgets/DateFieldWidget.tsx"));

  it("MemoryCard and the Profile memory line format meaningful_date with a raw fallback", () => {
    for (const path of [
      "src/components/MemoryCard.tsx",
      "src/profile/knowledge-presentation.ts",
    ]) {
      const code = codeOnly(source(path));
      const uses = code.match(/meaningful_date/g) ?? [];
      const formatted =
        code.match(
          /formatDisplayDateOrFallback\(\s*memory\.meaningful_date,\s*memory\.meaningful_date,?\s*\)/g,
        ) ?? [];
      expect(formatted.length).toBeGreaterThanOrEqual(1);
      // Every read of meaningful_date is the guard, the formatter call or its fallback.
      expect(uses.length).toBeLessThanOrEqual(formatted.length * 2 + 1);
    }
  });

  it("MemoryEditor has no free-text meaningful date and stores picker output", () => {
    const code = editor();
    expect(code).not.toContain('accessibilityLabel="Meaningful date optional"');
    expect(code).toMatch(/<DateTimePicker/);
    expect(code).toMatch(/storedFromPickerEvent\(/);
    expect(code).toMatch(/update\("meaningfulDate", stored\)/);
    expect(code).toMatch(/update\("meaningfulDate", null\)/);
    expect(code).not.toMatch(/update\([^)]*formatDisplayDate/);
  });

  it("DateFieldWidget has no TextInput and emits only picker output or Clear", () => {
    const code = widget();
    expect(code).not.toMatch(/<TextInput/);
    expect(code).toMatch(/<DateTimePicker/);
    expect(code).toMatch(/storedFromPickerEvent\(/);
    const emits = code.match(/onChange\(([^)]*)\)/g) ?? [];
    expect(emits.sort()).toEqual(['onChange("")', "onChange(stored)"].sort());
    expect(code).not.toMatch(/onChange\([^)]*formatDisplayDate/);
  });

  it.each([
    "src/components/MemoryEditor.tsx",
    "src/components/field-widgets/DateFieldWidget.tsx",
  ])("%s sets no minimumDate or maximumDate (D-67)", (path) => {
    const code = codeOnly(source(path));
    expect(code).not.toMatch(/minimumDate|maximumDate/);
  });

  it("EntryDateField caps the date at maxDate and stores picker output (D-101)", () => {
    const code = codeOnly(source("src/components/ui/EntryDateField.tsx"));
    expect(code).toMatch(/<DateTimePicker/);
    expect(code).toMatch(/maximumDate=\{maxDate\}/);
    expect(code).toMatch(/storedFromPickerEvent\(/);
    expect(code).not.toMatch(/minimumDate/);
    expect(code).not.toMatch(/onChange\([^)]*formatDisplayDate/);
  });

  it("date-pick-logic imports no display formatter and no React", () => {
    const code = source("src/components/date-pick-logic.ts");
    for (const name of DISPLAY_FORMATTERS) {
      expect(importedFromDates(code)).not.toContain(name);
    }
    expect(code).toContain("formatLocalDate");
    expect(code).not.toMatch(/from ["']react(-native)?["']/);
  });
});
