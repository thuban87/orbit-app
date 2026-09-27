import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  nativeColorSchemeFor,
  useNativeColorSchemeSync,
} from "./native-color-scheme";
import { resolveMode } from "./theme-presets";
import type { SystemScheme, ThemeMode } from "./theme-types";

// D-50 (OA-D4): native dialogs (RN Alert, the date/time pickers) follow Orbit's
// mode SETTING. Render-free: `react`'s useEffect is replaced by a recorder so
// the hook's effect body and dependency list are observable without a DOM.
const mocks = vi.hoisted(() => ({
  setColorScheme: vi.fn(),
  effects: [] as Array<{ run: () => unknown; deps: unknown[] | undefined }>,
}));

vi.mock("react-native", () => ({
  Appearance: { setColorScheme: mocks.setColorScheme },
}));

vi.mock("react", () => ({
  useEffect: (run: () => unknown, deps?: unknown[]) => {
    mocks.effects.push({ run, deps });
  },
}));

const ALL_MODES: ThemeMode[] = ["light", "dark", "system"];
const DEVICE_SCHEMES: SystemScheme[] = [
  "light",
  "dark",
  "unspecified",
  null,
  undefined,
];

beforeEach(() => {
  mocks.setColorScheme.mockReset();
  mocks.effects.length = 0;
});

describe("nativeColorSchemeFor (D-50)", () => {
  it("maps each Orbit mode setting to the native night mode", () => {
    expect(nativeColorSchemeFor("light")).toBe("light");
    expect(nativeColorSchemeFor("dark")).toBe("dark");
    expect(nativeColorSchemeFor("system")).toBe("unspecified");
  });

  it("is total over ThemeMode", () => {
    for (const mode of ALL_MODES) {
      expect(["light", "dark", "unspecified"]).toContain(
        nativeColorSchemeFor(mode),
      );
    }
  });

  // Feedback-loop guard (T-38.4-22-03). Once the native night mode is forced,
  // useColorScheme() reports the override. If "system" were mapped to its
  // RESOLVED value, Orbit's System mode would freeze on the last forced value.
  it("maps system to 'unspecified' whatever the device scheme, never to the resolved mode", () => {
    for (const device of DEVICE_SCHEMES) {
      const resolved = resolveMode("system", device);
      expect(nativeColorSchemeFor("system")).toBe("unspecified");
      expect(nativeColorSchemeFor("system")).not.toBe(resolved);
    }
  });
});

describe("useNativeColorSchemeSync (D-50)", () => {
  it("applies the mapped scheme from an effect keyed on the mode, not during render", () => {
    useNativeColorSchemeSync("dark");
    // Rendering alone registers the effect but never calls the native module.
    expect(mocks.setColorScheme).not.toHaveBeenCalled();
    expect(mocks.effects).toHaveLength(1);
    expect(mocks.effects[0]?.deps).toEqual(["dark"]);

    mocks.effects[0]?.run();
    expect(mocks.setColorScheme).toHaveBeenCalledTimes(1);
    expect(mocks.setColorScheme).toHaveBeenCalledWith("dark");
  });

  it("hands the native layer 'unspecified' for system so the device drives it", () => {
    useNativeColorSchemeSync("system");
    expect(mocks.effects[0]?.deps).toEqual(["system"]);
    mocks.effects[0]?.run();
    expect(mocks.setColorScheme).toHaveBeenCalledWith("unspecified");
  });

  it("applies light for an explicit light setting", () => {
    useNativeColorSchemeSync("light");
    mocks.effects[0]?.run();
    expect(mocks.setColorScheme).toHaveBeenCalledWith("light");
  });
});

describe("ThemeProvider source contract (D-50)", () => {
  const SOURCE = readFileSync(
    new URL("./theme-provider.tsx", import.meta.url),
    "utf8",
  );

  it("syncs the native night mode exactly once, from the active package's mode setting", () => {
    expect(SOURCE.match(/useNativeColorSchemeSync\(/g) ?? []).toHaveLength(1);
    expect(SOURCE).toMatch(
      /const activeMode\s*=\s*themePackage === "galaxy" \? galaxyMode : standardMode;/,
    );
    expect(SOURCE).toMatch(/useNativeColorSchemeSync\(activeMode\);/);
  });

  it("never feeds the resolved mode or the device scheme to the native sync", () => {
    expect(SOURCE).not.toMatch(/useNativeColorSchemeSync\(\s*resolved/);
    expect(SOURCE).not.toMatch(/useNativeColorSchemeSync\(\s*scheme/);
    expect(SOURCE).not.toMatch(/useNativeColorSchemeSync\([^)]*resolveMode/);
  });

  it("resolves its own palette from the same active mode", () => {
    expect(SOURCE).toMatch(/resolveMode\(activeMode, scheme\)/);
  });
});
