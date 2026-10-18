import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * About → Your data (38.12 D-125, D-151). The privacy line keeps the D-125
 * wording and adds the owner's Export clause, drawn as a highlighted span
 * (primary text colour, bold) nested inside the secondary-colour line.
 *
 * The screen statically requires its PNG icon, which node cannot load, so the
 * layout is pinned as a source contract and the copy through the model.
 */

vi.mock("expo-constants", () => ({ default: { expoConfig: {} } }));

const { ABOUT_PRIVACY_EXPORT_CLAUSE, ABOUT_PRIVACY_LINE } = await import(
  "./settings-about-model"
);

describe("About privacy line (D-125, D-151)", () => {
  it("keeps the D-125 wording and adds the Export clause", () => {
    expect(`${ABOUT_PRIVACY_LINE} ${ABOUT_PRIVACY_EXPORT_CLAUSE}`).toBe(
      "Your contact data stays on this phone, and in the backup folder you choose. Orbit never sends it anywhere else, except to your own AI provider when you choose to use AI, and when you use Export, which hands your full data to an app you pick.",
    );
  });

  it("draws the Export clause as a highlighted span nested in the line, through theme tokens", () => {
    const source = readFileSync(
      join(__dirname, "SettingsAboutScreen.tsx"),
      "utf8",
    );
    const line = source.slice(
      source.indexOf('testID="settings-about-privacy-line"'),
      source.indexOf("</SettingsRow>"),
    );
    // The line is the secondary colour and ends with the nested clause.
    expect(line).toContain("style={{ color: colors.textSecondary }}");
    expect(line).toMatch(
      /\{ABOUT_PRIVACY_LINE\}\{" "\}\s*<AppText[\s\S]*testID="settings-about-privacy-export"[\s\S]*style=\{\[styles\.highlight, \{ color: colors\.textPrimary \}\]\}[\s\S]*\{ABOUT_PRIVACY_EXPORT_CLAUSE\}\s*<\/AppText>\s*<\/AppText>/,
    );
    expect(source).toMatch(/highlight: \{ fontWeight: "700" \}/);
  });
});
