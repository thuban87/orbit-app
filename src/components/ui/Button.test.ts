/**
 * Button role→treatment unit coverage (THEME-10 / dossier §P). No render: this
 * asserts the PURE `button-roles` helpers directly (importing from `Button.tsx`
 * would transitively load `react-native`, which the node test env cannot parse).
 * Because the helper returns theme-token KEYS, this test embeds NO colour literal
 * (check:colors bars a literal outside src/**\/theme/**) — it asserts the WIRING:
 * which palette token each role reads for its fill / border / foreground.
 */
import { describe, expect, it } from "vitest";
import {
  assertButtonAccessibility,
  type ButtonRole,
  buttonVisual,
  MIN_TOUCH_TARGET,
} from "./button-roles";

const ALL_ROLES: ButtonRole[] = [
  "primary",
  "secondary",
  "tertiary",
  "destructive",
  "iconOnly",
];

describe("buttonVisual — the five-role hierarchy", () => {
  it("Primary = filled accent + onAccent foreground", () => {
    const v = buttonVisual("primary");
    expect(v.fillToken).toBe("accent");
    expect(v.foregroundToken).toBe("onAccent");
    expect(v.glyph).toBeNull();
  });

  it("Secondary = tonal surface + outline border, textPrimary foreground", () => {
    const v = buttonVisual("secondary");
    expect(v.fillToken).toBe("surface");
    expect(v.borderToken).toBe("border");
    expect(v.borderWidth).toBeGreaterThan(0);
    expect(v.foregroundToken).toBe("textPrimary");
  });

  it("Tertiary = text-only using the accent-as-link tone (accentText), never the fill accent", () => {
    const v = buttonVisual("tertiary");
    expect(v.fillToken).toBeNull();
    expect(v.borderToken).toBeNull();
    expect(v.foregroundToken).toBe("accentText");
    expect(v.foregroundToken).not.toBe("accent");
  });

  it("Destructive = danger fill/border + the reserved `warning` glyph + onDanger foreground (never onAccent, never a literal)", () => {
    const v = buttonVisual("destructive");
    expect(v.fillToken).toBe("danger");
    expect(v.borderToken).toBe("danger");
    // Distinct BEYOND colour: the registry warning glyph pairs the danger token.
    expect(v.glyph).toBe("warning");
    // The NAMED destructive foreground — NOT a reuse of the accent's onAccent.
    expect(v.foregroundToken).toBe("onDanger");
    expect(v.foregroundToken).not.toBe("onAccent");
  });

  it("IconOnly = registry glyph, no fill, requires an accessibilityLabel", () => {
    const v = buttonVisual("iconOnly");
    expect(v.fillToken).toBeNull();
    expect(v.requiresAccessibilityLabel).toBe(true);
  });

  it("every role meets the 44×44 minimum touch target floor", () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
    for (const role of ALL_ROLES) {
      expect(buttonVisual(role).minTouchTarget).toBe(44);
    }
  });

  it("only IconOnly requires an accessibilityLabel (label roles have a visible name)", () => {
    for (const role of ALL_ROLES) {
      expect(buttonVisual(role).requiresAccessibilityLabel).toBe(
        role === "iconOnly",
      );
    }
  });
});

describe("assertButtonAccessibility — the icon-only a11y contract", () => {
  it("rejects an IconOnly button with no accessibilityLabel", () => {
    expect(() => assertButtonAccessibility("iconOnly", {})).toThrow();
    expect(() =>
      assertButtonAccessibility("iconOnly", { accessibilityLabel: "   " }),
    ).toThrow();
  });

  it("accepts an IconOnly button that carries an accessibilityLabel", () => {
    expect(() =>
      assertButtonAccessibility("iconOnly", {
        accessibilityLabel: "Add contact",
      }),
    ).not.toThrow();
  });

  it("never blocks a text-label role (it has its own accessible name)", () => {
    for (const role of [
      "primary",
      "secondary",
      "tertiary",
      "destructive",
    ] as const) {
      expect(() => assertButtonAccessibility(role, {})).not.toThrow();
    }
  });
});
