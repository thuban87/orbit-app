import { describe, expect, it } from "vitest";
import {
  BACKGROUND_SLOT_IDS,
  RETIRED_BACKGROUND_SLOT_IDS,
} from "@/theme/theme-option-ids";
import {
  backgroundsNeedingConsent,
  restoreWritesBackupSettings,
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

describe("the shared settings-write predicate and consent decision (RA-a / D-49)", () => {
  const PHONE = "2026-09-15 10:00:00";

  it("restoreWritesBackupSettings: Replace-all always; Merge only when the backup is strictly newer", () => {
    expect(
      restoreWritesBackupSettings("replace-all", "2026-01-01 00:00:00", PHONE),
    ).toBe(true);
    expect(
      restoreWritesBackupSettings("merge", "2026-09-29 10:00:00", PHONE),
    ).toBe(true);
    expect(restoreWritesBackupSettings("merge", PHONE, PHONE)).toBe(false);
    expect(
      restoreWritesBackupSettings("merge", "2026-09-01 10:00:00", PHONE),
    ).toBe(false);
  });

  it("backgroundsNeedingConsent asks only for settings the restore will write", async () => {
    const older = {
      modifiedAt: "2026-09-01 10:00:00",
      galaxyBackground: "galaxy-comet",
    };
    const newer = {
      modifiedAt: "2026-09-29 10:00:00",
      galaxyBackground: "galaxy-comet",
    };
    const phone = async () => PHONE;
    await expect(
      backgroundsNeedingConsent("merge", older, phone),
    ).resolves.toEqual([]);
    await expect(
      backgroundsNeedingConsent("merge", newer, phone),
    ).resolves.toHaveLength(1);
    await expect(
      backgroundsNeedingConsent("replace-all", older, phone),
    ).resolves.toHaveLength(1);
  });

  it("does not read the phone's stamp when nothing is unavailable", async () => {
    let reads = 0;
    const read = async () => {
      reads += 1;
      return PHONE;
    };
    await expect(
      backgroundsNeedingConsent(
        "merge",
        {
          modifiedAt: "2026-09-29 10:00:00",
          galaxyBackground: "galaxy-aurora",
        },
        read,
      ),
    ).resolves.toEqual([]);
    await expect(
      backgroundsNeedingConsent("merge", undefined, read),
    ).resolves.toEqual([]);
    expect(reads).toBe(0);
  });
});
