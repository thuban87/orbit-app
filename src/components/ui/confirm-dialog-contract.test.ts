import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { confirmActionsFit } from "./confirm-dialog-layout";

/**
 * Source contract for the shared ConfirmDialog (RG-034
 * ui-accessibility/AUD-UIA-011; ADR-086 destructive dismissal). Reads the
 * component source from disk. The native large-text evidence (font_scale 2.0 at
 * ≈320dp and ≈349dp) lives in 38.4-INVESTIGATIONS.md.
 */
const dialog = readFileSync("src/components/ui/ConfirmDialog.tsx", "utf8");

/** The body of one `StyleSheet.create` entry, e.g. `actions: { … }`. */
function styleEntry(name: string): string {
  const start = dialog.indexOf(`  ${name}: {`);
  expect(start).toBeGreaterThan(-1);
  return dialog.slice(start, dialog.indexOf("},", start) + 2);
}

/** Source without block or line comments. */
const code = dialog
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("ConfirmDialog dismissal policy (ADR-086, D-06, 38.9 D-24)", () => {
  it("passes effectiveDismissable so a destructive confirmation ignores Back and scrim even when dismissable is also passed", () => {
    expect(code).toContain(
      "dismissable={effectiveDismissable({ destructive, dismissable })}",
    );
    expect(code).toMatch(
      /import \{[^}]*\beffectiveDismissable\b[^}]*\} from "@\/stores\/confirm-store"/,
    );
  });

  it("passes no other dismissable= to BaseOverlay (never the raw prop)", () => {
    expect(code.match(/\bdismissable=/g)).toHaveLength(1);
  });
});

describe("ConfirmDialog themed card and variants (38.9 D-43, D-52, D-24)", () => {
  it("draws the card with a 2dp borderStrong border (D-43)", () => {
    expect(styleEntry("card")).toContain("borderWidth: 2");
    expect(code).toContain("borderColor: colors.borderStrong");
    expect(styleEntry("card")).not.toContain("hairlineWidth");
  });

  it("controls the warning glyph above the title with headingGlyph, defaulting to destructive (D-52)", () => {
    expect(code).toContain("headingGlyph = destructive");
    expect(code).toMatch(/\{headingGlyph \? \(/);
  });

  it("renders a notice as a single primary button inside the same actions container", () => {
    expect(code).toContain('variant?: "confirm" | "notice"');
    expect(code).toMatch(/notice=\{variant === "notice"\}/);
    const actions = code.slice(code.indexOf("export function ConfirmActions("));
    expect(actions).toMatch(/if \(notice\)[\s\S]*?role="primary"/);
  });

  it("can draw the third choice as a Destructive button, off by default (38.12 D-150)", () => {
    const actions = code.slice(code.indexOf("export function ConfirmActions("));
    expect(actions).toContain("secondaryDestructive = false,");
    expect(actions).toMatch(
      /role=\{secondaryDestructive \? "destructive" : "secondary"\}\s+label=\{secondaryLabel\}/,
    );
    expect(code).toContain("secondaryDestructive={secondaryDestructive}");
  });

  it("can draw Cancel disabled for a host holding its exits, off by default (D-26; fix-pass WR-01)", () => {
    const actions = code.slice(code.indexOf("export function ConfirmActions("));
    expect(actions).toContain("cancelDisabled = false,");
    expect(actions).toMatch(
      /role="secondary"\s+label=\{cancelLabel\}\s+disabled=\{cancelDisabled\}/,
    );
  });
});

describe("ConfirmDialog large-text reachability (RG-034 ui-accessibility/AUD-UIA-011, CONFIRMED on device)", () => {
  it("wraps the action row instead of pushing a choice off the card", () => {
    expect(styleEntry("actions")).toContain('flexWrap: "wrap"');
    expect(styleEntry("actions")).toContain('justifyContent: "flex-end"');
  });

  it("caps each choice at the card width so a long label wraps inside its button", () => {
    expect(styleEntry("action")).toContain('maxWidth: "100%"');
  });

  it("keeps the original single row when both choices fit, and stacks full-width when they do not", () => {
    expect(styleEntry("actionsRow")).toContain('flexDirection: "row"');
    expect(styleEntry("actionsRow")).not.toContain("flexWrap");
    expect(styleEntry("actionsStacked")).toContain('flexDirection: "column"');
    expect(styleEntry("actionsStacked")).toContain('alignItems: "stretch"');
    expect(dialog).toContain("confirmActionsFit(");
  });

  it("scrolls the title and message inside a card bounded by the window", () => {
    expect(dialog).toContain("<ScrollView");
    expect(styleEntry("card")).toContain("flexShrink: 1");
    expect(styleEntry("body")).toContain("flexShrink: 1");
    expect(styleEntry("contentWrap")).toContain("flexShrink: 1");
  });

  it("keeps the card clear of the status and navigation bars", () => {
    expect(dialog).toContain("useSafeAreaInsets()");
    expect(dialog).toMatch(/paddingTop: insets\.top \+ SPACING\.\w+/);
    expect(dialog).toMatch(/paddingBottom: insets\.bottom \+ SPACING\.\w+/);
  });

  it("keeps the actions outside the scrolling body so both choices stay on-screen", () => {
    const scrollEnd = dialog.indexOf("</ScrollView>");
    const actionsStart = dialog.indexOf("<ConfirmActions");
    expect(scrollEnd).toBeGreaterThan(-1);
    expect(actionsStart).toBeGreaterThan(scrollEnd);
  });
});

describe("confirmActionsFit", () => {
  it("fits when both natural widths plus the gap are within the row", () => {
    expect(
      confirmActionsFit({ cancel: 245, confirm: 581, row: 848, gap: 22 }),
    ).toBe(true);
  });

  it("tolerates sub-pixel rounding at an exactly full row", () => {
    expect(
      confirmActionsFit({ cancel: 245.4, confirm: 581.3, row: 848, gap: 22 }),
    ).toBe(true);
  });

  it("stacks when a large-text label cannot share the row (Pixel 3a, font_scale 2.0, ≈320dp)", () => {
    expect(
      confirmActionsFit({ cancel: 245, confirm: 834, row: 834, gap: 27 }),
    ).toBe(false);
  });

  it("counts a third, secondary choice and its gap (38.11 D-73)", () => {
    expect(
      confirmActionsFit({
        cancel: 200,
        secondary: 300,
        confirm: 300,
        row: 840,
        gap: 20,
      }),
    ).toBe(true);
    expect(
      confirmActionsFit({
        cancel: 200,
        secondary: 300,
        confirm: 300,
        row: 830,
        gap: 20,
      }),
    ).toBe(false);
    expect(
      confirmActionsFit({
        cancel: 200,
        secondary: 0,
        confirm: 300,
        row: 840,
        gap: 20,
      }),
    ).toBeNull();
  });

  it("does not decide before every width is measured", () => {
    expect(
      confirmActionsFit({ cancel: 0, confirm: 581, row: 848, gap: 22 }),
    ).toBeNull();
    expect(
      confirmActionsFit({ cancel: 245, confirm: 581, row: 0, gap: 22 }),
    ).toBeNull();
  });
});
