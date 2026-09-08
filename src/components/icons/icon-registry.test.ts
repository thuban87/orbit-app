/**
 * icon-registry (THEME-09, D-05) — node-testable invariants for the ONE
 * centralized semantic icon registry.
 *
 * Pure module: `icon-registry.ts` imports nothing from `react-native` (only
 * `import type` erasures), so this suite runs under the node vitest harness.
 * The Ionicons-name TYPE validation and the `Icon` render live in `Icon.tsx`
 * (which imports the real Ionicons) and are enforced by `tsc --noEmit`, not
 * here.
 */
import { describe, expect, it } from "vitest";
import {
  ICON_REGISTRY,
  type IconName,
  type IconTone,
  type StatusTone,
  TAB_ICON,
} from "./icon-registry";

/** The four status/neutral display glyphs plus snoozed StatusGlyph needs. */
const STATUS_GLYPH_NAMES = [
  "status-stable",
  "status-wobble",
  "status-decay",
  "status-rogue",
  "status-neutral",
  "status-snoozed",
] as const satisfies readonly IconName[];

/** Systems state must stay distinguishable without relying on colour alone. */
const SYSTEM_STATE_NAMES = [
  "system-empty",
  "system-broken",
  "system-overrides",
] as const satisfies readonly IconName[];

/** General semantic names the app screens draw through (RESEARCH Pattern 4). */
const BASE_NAMES = [
  "close",
  "settings",
  "favorite",
  "search",
  "back",
  "add",
  "message",
  "call",
  "edit",
  "sparkle",
] as const satisfies readonly IconName[];

describe("ICON_REGISTRY", () => {
  it("maps every semantic name to a non-empty outline AND filled glyph", () => {
    for (const [name, pair] of Object.entries(ICON_REGISTRY)) {
      expect(pair.outline, `${name}.outline`).toBeTruthy();
      expect(pair.filled, `${name}.filled`).toBeTruthy();
      expect(typeof pair.outline).toBe("string");
      expect(typeof pair.filled).toBe("string");
    }
  });

  it("registers the general screen icons", () => {
    for (const name of BASE_NAMES) {
      expect(ICON_REGISTRY[name]).toBeDefined();
    }
  });

  it("registers the six StatusGlyph display names (REVIEWS 23-05 MEDIUM)", () => {
    for (const name of STATUS_GLYPH_NAMES) {
      expect(ICON_REGISTRY[name]).toBeDefined();
      expect(ICON_REGISTRY[name].outline).toBeTruthy();
      expect(ICON_REGISTRY[name].filled).toBeTruthy();
    }
  });

  it("registers distinct semantic System-state icon pairs", () => {
    for (const name of SYSTEM_STATE_NAMES) {
      expect(ICON_REGISTRY[name]).toBeDefined();
      expect(ICON_REGISTRY[name].outline).toBeTruthy();
      expect(ICON_REGISTRY[name].filled).toBeTruthy();
    }
    expect(ICON_REGISTRY["system-empty"].outline).not.toBe(
      ICON_REGISTRY["system-broken"].outline,
    );
    expect(ICON_REGISTRY["system-broken"].outline).not.toBe(
      ICON_REGISTRY["system-overrides"].outline,
    );
  });

  it("reserves the `warning` name required by Plan 07 (REVIEWS 23-05 LOW)", () => {
    expect(ICON_REGISTRY.warning).toBeDefined();
    expect(ICON_REGISTRY.warning.outline).toBeTruthy();
    expect(ICON_REGISTRY.warning.filled).toBeTruthy();
  });
});

describe("TAB_ICON (route-key -> semantic name mapping, REVIEWS 23-05 LOW)", () => {
  it("maps the explicit semantic names to the real TabParamList keys", () => {
    expect(TAB_ICON.DashboardTab).toBe("dashboard");
    expect(TAB_ICON.OrreryTab).toBe("orrery");
    expect(TAB_ICON.BackupTab).toBe("backup");
    expect(TAB_ICON.SettingsTab).toBe("settings");
  });

  it("resolves every TabParamList key to a registered outline+filled entry", () => {
    // TAB_ICON is typed `Record<keyof TabParamList, IconName>`, so its own keys
    // ARE the four tab identities — iterating them proves no tab route can be
    // left without an icon once TAB_GLYPHS is retired.
    const keys = Object.keys(TAB_ICON);
    expect(keys.sort()).toEqual(
      ["BackupTab", "DashboardTab", "OrreryTab", "SettingsTab"].sort(),
    );
    for (const key of keys as (keyof typeof TAB_ICON)[]) {
      const name = TAB_ICON[key];
      expect(ICON_REGISTRY[name], `tab ${key} -> ${name}`).toBeDefined();
      expect(ICON_REGISTRY[name].outline).toBeTruthy();
      expect(ICON_REGISTRY[name].filled).toBeTruthy();
    }
  });
});

describe("IconTone / StatusTone (string-valued tokens only, REVIEWS 23-05 cycle-4 MEDIUM)", () => {
  it("admits string-valued ThemePalette keys as a tone", () => {
    // These are erased at runtime; the value is the enforcement of the type.
    const accent: IconTone = "accent";
    const textPrimary: IconTone = "textPrimary";
    expect(accent).toBe("accent");
    expect(textPrimary).toBe("textPrimary");
  });

  it("rejects an array-valued ThemePalette key as a tone (tsc --noEmit gate)", () => {
    // @ts-expect-error avatarSwatches is `readonly string[]` (theme-types.ts:110)
    // — an array cannot feed Ionicons' string `color` prop, so it is NOT an
    // IconTone. tsc --noEmit fails if this line ever typechecks.
    const rejected: IconTone = "avatarSwatches";
    // Runtime is irrelevant; the @ts-expect-error above is the real assertion.
    expect(rejected).toBe("avatarSwatches");
  });

  it("keeps StatusTone a subset of IconTone", () => {
    const _statusToneIsIconTone: StatusTone extends IconTone ? true : false =
      true;
    const stable: StatusTone = "statusStable";
    const border: StatusTone = "border";
    expect(_statusToneIsIconTone).toBe(true);
    expect(stable).toBe("statusStable");
    expect(border).toBe("border");
  });
});
