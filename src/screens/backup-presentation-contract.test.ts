import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatDateTimeMinuteOrFallback } from "@/utils/dates";

/**
 * Backup/Restore presentation contract (38.4 Plan 05).
 *
 * RG-029 `ui-accessibility/AUD-UIA-002` (D-12): every filled primary action on
 * the Backup and Restore screens labels its text with the ADR-084 role
 * foreground for its fill — `onAccent` on an `accent` fill, `onDanger` on a
 * `danger` fill — never the page-text token `textPrimary`.
 *
 * Source-scan idiom (see dashboard-category-contract.test.ts): the screens
 * import react-native, which the vitest node environment cannot load, so the
 * contract is asserted against the source on disk.
 */

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Every JSX region that starts at a `styles.primaryButton` style reference and
 * ends at the enclosing `</Pressable>` — i.e. the fill declaration plus the
 * label `Text` of each filled primary action.
 */
function primaryButtonRegions(source: string): string[] {
  const regions: string[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf("styles.primaryButton", from);
    if (start === -1) return regions;
    const end = source.indexOf("</Pressable>", start);
    expect(end).toBeGreaterThan(start);
    regions.push(source.slice(start, end));
    from = end;
  }
}

/** The `color:` value of the label `Text` inside a primary-button region. */
function labelColor(region: string): string {
  const match = region.match(
    /<Text\s+style=\{\{\s*color:\s*([^}]+?),?\s*\}\}\s*>/,
  );
  expect(match, `no label Text colour in region:\n${region}`).not.toBeNull();
  return (match as RegExpMatchArray)[1].replace(/\s+/g, " ").trim();
}

describe("Backup/Restore filled-action role foregrounds (RG-029 AUD-UIA-002)", () => {
  it("Backup: the accent-filled passphrase continue action labels with onAccent", () => {
    const regions = primaryButtonRegions(read("src/screens/BackupScreen.tsx"));
    expect(regions).toHaveLength(1);
    const [region] = regions;
    expect(region).toContain("backgroundColor: colors.accent");
    expect(labelColor(region)).toBe("colors.onAccent");
    expect(region).not.toContain("colors.textPrimary");
  });

  it("Restore Preview: 'Choose file again' labels with onAccent and the apply label mirrors its fill", () => {
    const regions = primaryButtonRegions(
      read("src/screens/RestorePreviewScreen.tsx"),
    );
    expect(regions).toHaveLength(2);
    const [chooseAgain, apply] = regions;

    expect(chooseAgain).toContain("backgroundColor: colors.accent");
    expect(chooseAgain).toContain("Choose file again");
    expect(labelColor(chooseAgain)).toBe("colors.onAccent");
    expect(chooseAgain).not.toContain("colors.textPrimary");

    // Replace-all is the destructive branch: danger fill → onDanger label.
    // Galaxy Dark onDanger-on-danger (~3.91:1) is the ADR-084 owner-accepted
    // limitation — used as the designated foreground, never retuned (D-12).
    expect(apply).toMatch(
      /backgroundColor:\s*mode === "replace-all" \? colors\.danger : colors\.accent/,
    );
    expect(labelColor(apply)).toBe(
      'mode === "replace-all" ? colors.onDanger : colors.onAccent',
    );
    expect(apply).not.toContain("colors.textPrimary");
  });

  it("Restore Result: the accent-filled return action labels with onAccent", () => {
    const regions = primaryButtonRegions(
      read("src/screens/RestoreResultScreen.tsx"),
    );
    expect(regions).toHaveLength(1);
    const [region] = regions;
    expect(region).toContain("backgroundColor: colors.accent");
    expect(labelColor(region)).toBe("colors.onAccent");
    expect(region).not.toContain("colors.textPrimary");
  });
});

describe("Restore Preview source date (RG-038 AUD-UIA-018, D-07)", () => {
  const preview = read("src/screens/RestorePreviewScreen.tsx");

  it("renders the source date through the shared minute formatter, never raw", () => {
    expect(preview).toContain(
      "Source date: {formatDateTimeMinuteOrFallback(preview.exportedAt)}",
    );
    expect(preview).not.toContain("{preview.exportedAt}");
    expect(preview).toMatch(
      /import \{[^}]*\bformatDateTimeMinuteOrFallback\b[^}]*\} from "@\/utils\/dates"/,
    );
  });

  it("formats an Orbit export stamp to minutes in 12-hour AM/PM", () => {
    expect(formatDateTimeMinuteOrFallback("2026-09-26 14:05:38")).toBe(
      "Sep 26, 2026, 2:05 PM",
    );
    expect(formatDateTimeMinuteOrFallback("2026-09-26 09:59:59")).toBe(
      "Sep 26, 2026, 9:59 AM",
    );
  });

  it("renders midnight as 12:00 AM and noon as 12:00 PM", () => {
    expect(formatDateTimeMinuteOrFallback("2026-09-26 00:00:00")).toBe(
      "Sep 26, 2026, 12:00 AM",
    );
    expect(formatDateTimeMinuteOrFallback("2026-09-26 12:00:00")).toBe(
      "Sep 26, 2026, 12:00 PM",
    );
  });

  it("shows the neutral fallback for an empty or foreign-format value (untrusted file input)", () => {
    for (const foreign of [
      "",
      "   ",
      "2026-08-25T12:00:00.000Z",
      "yesterday",
      "2026-13-40 25:61:00",
    ]) {
      expect(formatDateTimeMinuteOrFallback(foreign)).toBe("Unknown time");
    }
  });
});
