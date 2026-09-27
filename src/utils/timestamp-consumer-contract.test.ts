import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Timestamp consumer contract (38.4 Plan 07).
 *
 * RG-038 `ui-accessibility/AUD-UIA-018` (D-07, ADR-152): every covered consumer
 * renders explicit timestamps — visible text AND accessibility labels — through
 * the shared minute-precision formatters in `src/utils/dates.ts`, never by
 * slicing `HH:MM` (24-hour, locale-blind) out of the stored string and never as
 * the raw stored value.
 *
 * Source-scan idiom (see backup-presentation-contract.test.ts): the consumers
 * import react-native, which the vitest node environment cannot load, so the
 * contract is asserted against the source on disk. The formatter behaviour
 * itself (identical AM/PM, midnight and minute-boundary fixtures) is proven in
 * `dates.test.ts`.
 */

interface Consumer {
  readonly path: string;
  /** Shared formatters the consumer must call. */
  readonly formatters: readonly string[];
  /** Minimum number of formatter call sites (visible text + a11y labels). */
  readonly minCalls: number;
}

const CONSUMERS: readonly Consumer[] = [
  {
    path: "src/components/history/DateDetailSheet.tsx",
    formatters: ["formatTimeMinuteOrFallback"],
    // 3 visible time captions + 3 accessibility labels.
    minCalls: 6,
  },
  {
    path: "src/components/digest/DigestDayDetail.tsx",
    formatters: ["formatTimeMinuteOrFallback"],
    // Rows sit within a known day: 2 visible time captions + 2 a11y labels.
    minCalls: 4,
  },
  {
    path: "src/screens/GroupEventDetailScreen.tsx",
    formatters: ["formatDateTimeMinuteOrFallback"],
    // The "When" field (no date context on the screen, so date-time).
    minCalls: 1,
  },
  {
    path: "src/screens/GroupEventsScreen.tsx",
    formatters: ["formatDateTimeMinuteOrFallback"],
    // Each Events list row's date-time caption (38.4 Plan 12). Rows span many
    // days, so date-time; the row's accessible name carries no time.
    minCalls: 1,
  },
];

/** Substring extraction of the stored string's `HH:MM` characters (11..16). */
const SLICE_TIME_PATTERN = /\.(?:slice|substring|substr)\(\s*11\s*,/;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function countCalls(source: string, fn: string): number {
  return source.split(`${fn}(`).length - 1;
}

describe("timestamp consumer contract (RG-038)", () => {
  it.each(CONSUMERS)("$path imports the shared minute formatters", (c) => {
    const source = read(c.path);
    const importMatch = source.match(
      /import\s*\{([^}]*)\}\s*from\s*"@\/utils\/dates";/,
    );
    expect(importMatch).not.toBeNull();
    for (const fn of c.formatters) {
      expect(importMatch?.[1]).toContain(fn);
    }
  });

  it.each(CONSUMERS)(
    "$path renders time through the shared formatters, never a stored-string slice",
    (c) => {
      const source = read(c.path);
      expect(source).not.toMatch(SLICE_TIME_PATTERN);
      expect(source).not.toMatch(/function\s+timeOf\s*\(/);
      const calls = c.formatters.reduce(
        (sum, fn) => sum + countCalls(source, fn),
        0,
      );
      expect(calls).toBeGreaterThanOrEqual(c.minCalls);
    },
  );

  it("DateDetailSheet announces the formatted time in every row label", () => {
    const source = read("src/components/history/DateDetailSheet.tsx");
    const labels = source.match(/accessibilityLabel=\{`[^`]*`\}/g) ?? [];
    expect(labels.length).toBe(3);
    for (const label of labels) {
      expect(label).toContain("formatTimeMinuteOrFallback(");
    }
  });

  it("DigestDayDetail announces the formatted time in every row label", () => {
    const source = read("src/components/digest/DigestDayDetail.tsx");
    const labels = (
      source.match(/accessibilityLabel=\{`[^`]*`\}/g) ?? []
    ).filter((label) => label.includes("row."));
    expect(labels.length).toBe(2);
    for (const label of labels) {
      expect(label).toContain("formatTimeMinuteOrFallback(row.occurredAt)");
    }
  });

  it("GroupEventDetailScreen renders When through the date-time formatter, never raw", () => {
    const source = read("src/screens/GroupEventDetailScreen.tsx");
    expect(source).toMatch(
      /label="When"\s+value=\{formatDateTimeMinuteOrFallback\(event\.occurredAt\)\}/,
    );
    expect(source).not.toMatch(/value=\{event\.occurredAt\}/);
  });

  it("GroupEventsScreen formats each row's time through the shared formatter, with no local 24-hour helper", () => {
    const source = read("src/screens/GroupEventsScreen.tsx");
    expect(source).not.toMatch(/function\s+displayDateTime\s*\(/);
    expect(source).not.toMatch(/\.slice\(\s*0\s*,\s*5\s*\)/);
    expect(source).toContain("formatDateTimeMinuteOrFallback(item.occurredAt)");
  });
});
