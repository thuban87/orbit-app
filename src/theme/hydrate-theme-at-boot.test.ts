/**
 * hydrate-theme-at-boot — the dependency-INJECTED boot coordinator (THEME-03/13).
 *
 * Node-testable WITHOUT react-test-renderer: the coordinator owns no React, so
 * injected fakes prove its idempotency + error-isolation contract:
 *   - compare-before-write: a repeat import when the DB already equals the mapped
 *     legacy values performs ZERO writes and leaves data_revision/modified_at
 *     unchanged (REVIEWS 23-01 HIGH — the guard is the value DIFF, not "patch
 *     non-empty", because updateAppSettings ALWAYS bumps the revision);
 *   - getItem / JSON.parse / removeItem failures are EACH individually non-fatal;
 *   - a write-failure leaves the AsyncStorage key intact and does not partially
 *     write;
 *   - the returned settings never carry pre-import values.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, AppSettingsPatch } from "@/db/app-settings-dao";
import { Logger } from "@/utils/logger";
import { hydrateThemeAtBoot } from "./hydrate-theme-at-boot";

const LEGACY_KEY = "orbit-theme";

/** A minimal AppSettings — only the theme fields + revision/modifiedAt matter. */
function makeSettings(over: Partial<AppSettings> = {}): AppSettings {
  return {
    themePackage: "galaxy",
    galaxyMode: "system",
    standardMode: "system",
    galaxyAccent: null,
    standardAccent: null,
    galaxyBackground: null,
    standardBackground: null,
    dataRevision: 0,
    modifiedAt: "2026-09-03 12:00:00",
    ...over,
  } as unknown as AppSettings;
}

/** The real zustand persist envelope, serialized as AsyncStorage stores it. */
function envelopeJson(mode: string, presetId = "space-dark"): string {
  return JSON.stringify({ state: { mode, presetId }, version: 1 });
}

interface FakeOptions {
  initial: AppSettings;
  legacy?: string | null;
  getItemThrows?: boolean;
  updateThrows?: boolean;
  removeThrows?: boolean;
}

function makeDeps(opts: FakeOptions) {
  let settings = opts.initial;
  const store = new Map<string, string>();
  if (opts.legacy != null) store.set(LEGACY_KEY, opts.legacy);
  const calls = { update: 0, remove: 0, updatedWith: [] as AppSettingsPatch[] };

  const deps = {
    getItem: async (key: string): Promise<string | null> => {
      if (opts.getItemThrows) throw new Error("getItem unavailable");
      return store.get(key) ?? null;
    },
    removeItem: async (key: string): Promise<void> => {
      calls.remove += 1;
      if (opts.removeThrows) throw new Error("removeItem failed");
      store.delete(key);
    },
    getAppSettings: async (): Promise<AppSettings> => ({ ...settings }),
    updateAppSettings: async (patch: AppSettingsPatch): Promise<void> => {
      calls.update += 1;
      calls.updatedWith.push(patch);
      if (opts.updateThrows) throw new Error("write failed");
      // Mirror the real DAO: any write bumps data_revision + modified_at.
      settings = {
        ...settings,
        ...patch,
        dataRevision: settings.dataRevision + 1,
        modifiedAt: "2026-09-03 13:30:00",
      } as AppSettings;
    },
  };
  return {
    deps,
    calls,
    keyPresent: () => store.has(LEGACY_KEY),
    current: () => settings,
  };
}

beforeEach(() => {
  // Silence the coordinator's non-fatal warn/error logging in the error tests.
  Logger.setLevel("off");
  vi.restoreAllMocks();
});

describe("hydrateThemeAtBoot — one-time import", () => {
  it("imports the legacy value with a non-empty diff and clears the key", async () => {
    const { deps, calls, keyPresent } = makeDeps({
      initial: makeSettings(), // galaxy / system
      legacy: envelopeJson("dark"),
    });
    const result = await hydrateThemeAtBoot(deps);

    // themePackage already 'galaxy' (dropped); galaxyMode 'dark' differs → written.
    expect(calls.update).toBe(1);
    expect(calls.updatedWith[0]).toEqual({ galaxyMode: "dark" });
    // The returned settings carry the POST-import value, never the pre-import one.
    expect(result.galaxyMode).toBe("dark");
    expect(result.dataRevision).toBe(1);
    // The key is cleared after the write.
    expect(keyPresent()).toBe(false);
  });

  it("no-ops when there is no legacy value", async () => {
    const { deps, calls } = makeDeps({ initial: makeSettings(), legacy: null });
    const result = await hydrateThemeAtBoot(deps);
    expect(calls.update).toBe(0);
    expect(calls.remove).toBe(0);
    expect(result.galaxyMode).toBe("system");
  });
});

describe("hydrateThemeAtBoot — idempotency (compare-before-write)", () => {
  it("performs ZERO writes when the DB already equals the mapped legacy values", async () => {
    // Simulate a FAILED clear: the DB already holds galaxy/dark and the legacy
    // key is still present. A second import must diff to empty → no write, no bump.
    const before = makeSettings({ galaxyMode: "dark", dataRevision: 5 });
    const { deps, calls, keyPresent, current } = makeDeps({
      initial: before,
      legacy: envelopeJson("dark"),
    });
    const result = await hydrateThemeAtBoot(deps);

    expect(calls.update).toBe(0);
    // data_revision + modified_at are byte-identical before vs after.
    expect(current().dataRevision).toBe(5);
    expect(result.dataRevision).toBe(5);
    expect(result.modifiedAt).toBe(before.modifiedAt);
    // The empty-diff path STILL clears the now-redundant key.
    expect(keyPresent()).toBe(false);
  });
});

describe("hydrateThemeAtBoot — error isolation", () => {
  it("is non-fatal when getItem rejects (no import, no write, returns current)", async () => {
    const { deps, calls } = makeDeps({
      initial: makeSettings(),
      legacy: envelopeJson("dark"),
      getItemThrows: true,
    });
    const result = await hydrateThemeAtBoot(deps);
    expect(calls.update).toBe(0);
    expect(calls.remove).toBe(0);
    expect(result.galaxyMode).toBe("system");
  });

  it("is non-fatal on a corrupt/unparseable blob (no import, key left intact)", async () => {
    const { deps, calls, keyPresent } = makeDeps({
      initial: makeSettings(),
      legacy: "{not valid json",
    });
    const result = await hydrateThemeAtBoot(deps);
    expect(calls.update).toBe(0);
    expect(calls.remove).toBe(0);
    expect(keyPresent()).toBe(true);
    expect(result.galaxyMode).toBe("system");
  });

  it("is non-fatal when removeItem fails after a successful write", async () => {
    const { deps, calls, keyPresent } = makeDeps({
      initial: makeSettings(),
      legacy: envelopeJson("dark"),
      removeThrows: true,
    });
    const result = await hydrateThemeAtBoot(deps);
    // The write committed; the failed clear does not throw. The key stays for the
    // next launch, which diffs to empty and writes nothing.
    expect(calls.update).toBe(1);
    expect(result.galaxyMode).toBe("dark");
    expect(keyPresent()).toBe(true);
  });

  it("leaves the AsyncStorage key INTACT on a write-failure and does not partially write", async () => {
    const before = makeSettings({ dataRevision: 3 });
    const { deps, calls, keyPresent, current } = makeDeps({
      initial: before,
      legacy: envelopeJson("dark"),
      updateThrows: true,
    });
    const result = await hydrateThemeAtBoot(deps);

    expect(calls.update).toBe(1); // attempted
    expect(calls.remove).toBe(0); // never cleared
    expect(keyPresent()).toBe(true); // intact for retry
    // No partial write: the settings are the pre-import snapshot.
    expect(current().galaxyMode).toBe("system");
    expect(current().dataRevision).toBe(3);
    expect(result.galaxyMode).toBe("system");
    expect(result.dataRevision).toBe(3);
  });
});
