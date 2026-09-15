import { describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import { persistAppearanceSetting } from "./settings-appearance-persist";

/**
 * A durable `AppSettings` fixture. Only the seven theme fields matter here —
 * `themeSelectionFromSettings` reads exactly those — so the rest are cast away.
 */
const DURABLE_SETTINGS = {
  themePackage: "standard",
  galaxyMode: "dark",
  standardMode: "light",
  galaxyAccent: "nebula-blue",
  standardAccent: null,
  galaxyBackground: "galaxy-nebula",
  standardBackground: "standard-dawn",
} as AppSettings;

const makeDeps = (overrides?: {
  updateAppSettings?: (
    exec: SqlExecutor,
    patch: unknown,
    now: string,
  ) => Promise<void>;
}) => ({
  updateAppSettings: vi.fn(
    overrides?.updateAppSettings ??
      (async (_exec: SqlExecutor, _patch: unknown, _now: string) => {}),
  ),
  getAppSettings: vi.fn(async (_exec: SqlExecutor) => DURABLE_SETTINGS),
  hydrateThemeStore: vi.fn((_selection) => {}),
  now: () => "2026-09-14 12:00:00",
});

describe("persistAppearanceSetting — durable write", () => {
  it("on success writes the patch and does NOT re-read or reconcile the store", async () => {
    const deps = makeDeps();
    const exec = {} as SqlExecutor;

    const result = await persistAppearanceSetting(
      exec,
      { themePackage: "galaxy" },
      deps,
    );

    expect(result.ok).toBe(true);
    expect(deps.updateAppSettings).toHaveBeenCalledWith(
      exec,
      { themePackage: "galaxy" },
      "2026-09-14 12:00:00",
    );
    // No divergence to reconcile on the happy path.
    expect(deps.getAppSettings).not.toHaveBeenCalled();
    expect(deps.hydrateThemeStore).not.toHaveBeenCalled();
  });
});

describe("persistAppearanceSetting — failed durable write (review MEDIUM, cycle-3)", () => {
  it("re-reads the durable settings, reconciles the live store via hydrate, and surfaces the error — in that order", async () => {
    const writeError = new Error("disk full");
    const deps = makeDeps({
      updateAppSettings: async () => {
        throw writeError;
      },
    });
    const exec = {} as SqlExecutor;

    const result = await persistAppearanceSetting(
      exec,
      { standardBackground: "standard-mesh" },
      deps,
    );

    // The failure is reported, never swallowed.
    expect(result.ok).toBe(false);
    expect(result.error).toBe(writeError);

    // The durable value was re-read and the live store reconciled to it — the
    // store is NOT left diverged from SQLite.
    expect(deps.getAppSettings).toHaveBeenCalledWith(exec);
    expect(deps.hydrateThemeStore).toHaveBeenCalledTimes(1);
    expect(deps.hydrateThemeStore).toHaveBeenCalledWith({
      package: "standard",
      galaxyMode: "dark",
      standardMode: "light",
      galaxyAccent: "nebula-blue",
      standardAccent: null,
      galaxyBackground: "galaxy-nebula",
      standardBackground: "standard-dawn",
    });
    expect(result.reconciledSelection).toEqual({
      package: "standard",
      galaxyMode: "dark",
      standardMode: "light",
      galaxyAccent: "nebula-blue",
      standardAccent: null,
      galaxyBackground: "galaxy-nebula",
      standardBackground: "standard-dawn",
    });

    // Ordering: write attempt BEFORE the re-read BEFORE the reconcile.
    expect(deps.updateAppSettings.mock.invocationCallOrder[0]).toBeLessThan(
      deps.getAppSettings.mock.invocationCallOrder[0],
    );
    expect(deps.getAppSettings.mock.invocationCallOrder[0]).toBeLessThan(
      deps.hydrateThemeStore.mock.invocationCallOrder[0],
    );
  });
});
