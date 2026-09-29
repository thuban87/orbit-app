import { describe, expect, it } from "vitest";
import {
  BACKGROUND_SLOT_IDS,
  RETIRED_BACKGROUND_SLOT_IDS,
} from "@/theme/theme-option-ids";
import {
  unavailableBackupBackgrounds,
  withDefaultBackgrounds,
} from "./restore-backgrounds";

describe("unavailableBackupBackgrounds (38.5 D-47)", () => {
  it("finds nothing for absent keys, null, every active id and every retired id", () => {
    expect(unavailableBackupBackgrounds(undefined)).toEqual([]);
    expect(unavailableBackupBackgrounds({})).toEqual([]);
    for (const id of [
      null,
      ...BACKGROUND_SLOT_IDS,
      ...RETIRED_BACKGROUND_SLOT_IDS,
    ]) {
      expect(
        unavailableBackupBackgrounds({
          galaxyBackground: id,
          standardBackground: id,
        }),
        String(id),
      ).toEqual([]);
    }
  });

  it("flags an id the DAO would reject, per key, with its package default", () => {
    expect(
      unavailableBackupBackgrounds({
        galaxyBackground: "galaxy-comet",
        standardBackground: "standard-meadow",
      }),
    ).toEqual([
      {
        key: "galaxyBackground",
        package: "galaxy",
        storedId: "galaxy-comet",
        replacement: "galaxy-quiet",
      },
      {
        key: "standardBackground",
        package: "standard",
        storedId: "standard-meadow",
        replacement: "standard-dawn",
      },
    ]);
  });

  it("treats a prototype-shaped string as unavailable, never as a slot", () => {
    expect(
      unavailableBackupBackgrounds({ galaxyBackground: "__proto__" }),
    ).toHaveLength(1);
  });
});

describe("withDefaultBackgrounds (the restore mapping, D-47)", () => {
  it("replaces only unavailable ids and keeps every other key", () => {
    const settings = {
      modifiedAt: "2026-09-29 10:00:00",
      sunContactUid: null,
      galaxyBackground: "galaxy-comet",
      standardBackground: "standard-mesh",
      galaxyAccent: "solar-amber",
    };
    expect(withDefaultBackgrounds(settings)).toEqual({
      ...settings,
      galaxyBackground: "galaxy-quiet",
    });
    // The input is not mutated.
    expect(settings.galaxyBackground).toBe("galaxy-comet");
  });

  it("returns the same object when nothing is unavailable", () => {
    const settings = { galaxyBackground: "galaxy-nebula" };
    expect(withDefaultBackgrounds(settings)).toBe(settings);
  });
});
