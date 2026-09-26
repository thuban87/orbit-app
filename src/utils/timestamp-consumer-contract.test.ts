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
});
