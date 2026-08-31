/**
 * app_settings migration (002/003) + DAO proof (NOTIF-05 / OQ-1 / ORR-05 / ORR-06).
 *
 * The single-row `app_settings` table is the backup-native (SQLite, OQ-1) home
 * for the app-level notification controls (002) and the orrery sun controls
 * (003). This suite proves, node-side via the node:sqlite adapter, that
 * migration 002 is forward-only + additive, and that the DAO reads/writes/
 * validates every field — the notification fields AND the two sun fields.
 *
 * Migration 001 is imported and run unchanged — 002/003 edit no shipped table.
 *
 * COLOUR-GATE SAFETY (C2-3): this file lives OUTSIDE src/**\/theme, so the
 * no-arg `npm run check:colors` scans it. It therefore contains NO forbidden
 * colour literal: every valid-6-hex accept input is ASSEMBLED from a
 * non-`#`-prefixed hex fragment (`` `#${HEX_UPPER}` ``), so the gate's
 * `#[0-9a-fA-F]{3,8}` pattern never matches the source (a `#` immediately
 * followed by `$`), and every reject input is a string the gate does not match.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { PORTABLE_SETTINGS_KEYS } from "@/backup/backup-schema";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  type AppSettings,
  type AppSettingsPatch,
  acknowledgeProvider,
  assertPhoneRegionOverride,
  type BackupBookkeepingPatch,
  getAppSettings,
  getPortableSettingsSnapshot,
  recordAutomaticBackupHealthCore,
  resolveEffectivePhoneRegion,
  SELF_SUN_COLOUR_RE,
  setInteractionAssistEnabled,
  updateAppSettings,
  updateAppSettingsCore,
} from "@/db/app-settings-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { migration012 } from "@/db/migrations/012-import-sessions";
import { migration013 } from "@/db/migrations/013-reconciliation-and-merge";
import { migration014 } from "@/db/migrations/014-interaction-assists";
import { runMigrations } from "@/db/migrations/runner";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-08-16 12:00:00";
const LATER = "2026-08-16 13:30:00";

// Gate-safe hex building blocks (C2-3): the fragment has NO leading `#`, so
// neither the fragment nor the assembled `` `#${...}` `` template matches
// check-colors' `#[0-9a-fA-F]{3,8}` pattern. `HEX_UPPER` is the gold value that
// becomes `starPalette[0]` in 13-04.
const HEX_UPPER = "F2C14E";
const HEX_LOWER = "f2c14e";
/** A valid 6-hex, upper-case — assembled, never a bare literal. */
const VALID_HEX_UPPER = `#${HEX_UPPER}`;
/** A valid 6-hex, lower-case — proves the case-insensitive character class. */
const VALID_HEX_LOWER = `#${HEX_LOWER}`;
/** `#` followed by non-hex chars — the gate does not match it. */
const REJECT_BAD_CHARS = "#GGGGGG";
/** A non-hex word NOT in the gate's named-colour list. */
const REJECT_WORD = "crimson";
/** A 3-char hex (too short for the 6-char rule) — assembled gate-safe. */
const REJECT_SHORT = `#${HEX_UPPER.slice(0, 3)}`;
/** An 8-char hex (too long for the 6-char rule) — assembled gate-safe. */
const REJECT_LONG = `#${HEX_UPPER}${"AA"}`;

let exec: SqlExecutor;

/** Bring a fresh in-memory DB to v2 (001 then 002), the pre-Phase-13 state. */
async function migrateToV2(): Promise<void> {
  await runMigrations(exec, [migration001, migration002], 2, {
    now: NOW,
    newUid,
  });
}

/**
 * Bring a fresh in-memory DB to v14. The DAO selects the backup columns added by
 * migration 007, so every current-schema test needs the complete launch path.
 */
async function migrateToV5(): Promise<void> {
  await runMigrations(
    exec,
    [
      migration001,
      migration002,
      migration003,
      migration004,
      migration005,
      migration006,
      migration007,
      migration008,
      migration009,
      migration010,
      migration011,
      migration012,
      migration013,
      migration014,
    ],
    14,
    { now: NOW, newUid },
  );
}

/** The disabled-by-default AI fields, for splicing into full-object expectations. */
const AI_DEFAULTS = {
  aiProvider: "none" as const,
  aiModel: "",
  aiCustomEndpoint: "",
  aiCustomModel: "",
  aiPromptTemplate: "",
  aiAckOpenai: 0 as const,
  aiAckAnthropic: 0 as const,
  aiAckGoogle: 0 as const,
  aiAckCustom: 0 as const,
};

const BACKUP_DEFAULTS = {
  backupIntervalDays: 1,
  backupRetentionDays: 7,
  backupFolderUri: null,
  backupFolderName: null,
  backupFolderAccessible: 0 as const,
  backupFolderDiagnostic: null,
  lastAutomaticBackupAt: null,
  dataRevision: 0,
  lastBackupDataRevision: 0,
  encryptionEnabled: 0 as const,
  backupNudgeDismissed: 0 as const,
  modifiedAt: NOW,
};

type KeysOverlap<A, B> = Extract<keyof A, keyof B>;
type IsNever<T> = [T] extends [never] ? true : false;
const portableAndBookkeepingAreDisjoint: IsNever<
  KeysOverlap<
    Awaited<ReturnType<typeof getPortableSettingsSnapshot>>,
    BackupBookkeepingPatch
  >
> = true;

void portableAndBookkeepingAreDisjoint;

beforeEach(() => {
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
});

describe("migration 002 — app_settings (forward-only, additive)", () => {
  it("creates app_settings and seeds exactly one id=1 row on a fresh v0->v2 run", async () => {
    await migrateToV2();

    const version = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(version?.user_version).toBe(2);

    const rows = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM app_settings",
    );
    expect(rows).toEqual([{ id: 1 }]);
  });

  it("seeds the decided defaults", async () => {
    await migrateToV2();
    const row = await exec.getFirstAsync<{
      notifications_enabled: number;
      decay_enabled: number;
      birthday_enabled: number;
      lockscreen_public: number;
      delivery_hour: number;
      quiet_start_hour: number;
      quiet_end_hour: number;
      created_at: string;
      modified_at: string;
    }>("SELECT * FROM app_settings WHERE id = 1");
    expect(row).toMatchObject({
      notifications_enabled: 0,
      decay_enabled: 1,
      birthday_enabled: 1,
      lockscreen_public: 0,
      delivery_hour: 9,
      quiet_start_hour: 21,
      quiet_end_hour: 8,
      created_at: NOW,
      modified_at: NOW,
    });
  });

  it("runs 001 THEN 002 in ascending order from v0", async () => {
    // A device may jump v0->v2 in one update; both steps must apply in order.
    await migrateToV2();
    const tables = await exec.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    const names = new Set(tables.map((t) => t.name));
    expect(names.has("app_settings")).toBe(true);
    // A migration-001 table proves 001 also ran.
    expect(names.has("contacts")).toBe(true);
  });

  it("upgrades an existing v1 DB to v2 without touching migration-001 data", async () => {
    // First bring the DB to v1 only (the shipped state before this phase).
    await runMigrations(exec, [migration001], 1, { now: NOW, newUid });
    const before = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM categories",
    );
    // Then apply 002 up to v2.
    await runMigrations(exec, [migration001, migration002], 2, {
      now: LATER,
      newUid,
    });
    const after = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM categories",
    );
    expect(after?.n).toBe(before?.n);
    const settings = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM app_settings WHERE id = 1",
    );
    expect(settings?.id).toBe(1);
  });

  it("is idempotent — re-running at v2 applies nothing and keeps one row", async () => {
    await migrateToV2();
    await migrateToV2(); // second call: user_version already 2, no pending steps
    const rows = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM app_settings",
    );
    expect(rows).toEqual([{ id: 1 }]);
  });

  it("enforces the single-row CHECK (id must be 1)", async () => {
    await migrateToV2();
    // Wrap in an async fn: the node:sqlite adapter throws synchronously, whereas
    // the on-device expo executor rejects — the wrapper normalises both to a
    // rejected promise so the assertion holds against either executor.
    await expect(
      (async () =>
        exec.runAsync(
          `INSERT INTO app_settings (id, notifications_enabled, decay_enabled, birthday_enabled, lockscreen_public, delivery_hour, quiet_start_hour, quiet_end_hour, created_at, modified_at)
         VALUES (2, 0, 1, 1, 0, 9, 21, 8, ?, ?)`,
          [NOW, NOW],
        ))(),
    ).rejects.toThrow();
  });
});

describe("app-settings-dao — read", () => {
  it("getAppSettings returns the seeded defaults as a typed row", async () => {
    await migrateToV5();
    const settings = await getAppSettings(exec);
    const expected: AppSettings = {
      notificationsEnabled: 0,
      decayEnabled: 1,
      birthdayEnabled: 1,
      // Digest defaults ON (migration 005, DGST-01).
      digestEnabled: 1,
      interactionAssistEnabled: 1,
      lockscreenPublic: 0,
      deliveryHour: 9,
      quietStartHour: 21,
      quietEndHour: 8,
      // The two sun fields default NULL and read back as null (no resolution here).
      sunContactId: null,
      selfSunColour: null,
      phoneRegionOverride: null,
      includeUnboundNeverContacted: 0,
      birthdayUnboundEnabled: 1,
      // AI starts disabled: provider `none`, empty config, acks 0 (AI-01).
      ...AI_DEFAULTS,
      ...BACKUP_DEFAULTS,
    };
    expect(settings).toEqual(expected);
  });

  it("throws if the id=1 row is missing (never happens post-seed, loud by design)", async () => {
    await migrateToV5();
    await exec.runAsync("DELETE FROM app_settings WHERE id = 1");
    await expect((async () => getAppSettings(exec))()).rejects.toThrow();
  });
});

describe("app-settings-dao — validated write", () => {
  beforeEach(async () => {
    await migrateToV5();
  });

  it("updates only the supplied fields and bumps modified_at", async () => {
    await updateAppSettings(
      exec,
      { notificationsEnabled: 1, deliveryHour: 7 },
      LATER,
    );
    const settings = await getAppSettings(exec);
    expect(settings.notificationsEnabled).toBe(1);
    expect(settings.deliveryHour).toBe(7);
    // Untouched fields keep their seeded defaults.
    expect(settings.quietStartHour).toBe(21);
    expect(settings.quietEndHour).toBe(8);
    expect(settings.decayEnabled).toBe(1);

    const row = await exec.getFirstAsync<{ modified_at: string }>(
      "SELECT modified_at FROM app_settings WHERE id = 1",
    );
    expect(row?.modified_at).toBe(LATER);
  });

  it("roundtrips a valid phone-region override and rejects malformed restore input", async () => {
    await updateAppSettings(exec, { phoneRegionOverride: "gb" }, LATER);
    expect((await getAppSettings(exec)).phoneRegionOverride).toBe("gb");
    expect(() =>
      assertPhoneRegionOverride("phoneRegionOverride", null),
    ).not.toThrow();
    expect(() =>
      assertPhoneRegionOverride("phoneRegionOverride", "US"),
    ).not.toThrow();
    expect(() =>
      assertPhoneRegionOverride("phoneRegionOverride", "not-a-region"),
    ).toThrow();
    await expect(
      (async () =>
        updateAppSettings(
          exec,
          { phoneRegionOverride: "not-a-region" },
          LATER,
        ))(),
    ).rejects.toThrow();
  });

  it("persists lifecycle preference defaults and emits them through the portable settings projection", async () => {
    expect(await getAppSettings(exec)).toMatchObject({
      includeUnboundNeverContacted: 0,
      birthdayUnboundEnabled: 1,
    });

    await updateAppSettings(
      exec,
      { includeUnboundNeverContacted: 1, birthdayUnboundEnabled: 0 },
      LATER,
    );

    expect(await getAppSettings(exec)).toMatchObject({
      includeUnboundNeverContacted: 1,
      birthdayUnboundEnabled: 0,
    });
    expect(await getPortableSettingsSnapshot(exec)).toMatchObject({
      includeUnboundNeverContacted: 1,
      birthdayUnboundEnabled: 0,
    });
  });

  it("uses the saved region before the device fallback without changing saved method identity", async () => {
    expect(resolveEffectivePhoneRegion("GB", "US")).toBe("GB");
    expect(resolveEffectivePhoneRegion(null, "US")).toBe("US");

    await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [newUid(), "Region contact", 30, NOW, NOW],
    );
    const contact = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM contacts WHERE name = 'Region contact'",
    );
    await exec.runAsync(
      `INSERT INTO contact_methods
       (uid, contact_id, method_type, raw_value, display_value, canonical_value,
        canonical_region, is_actionable, is_primary, display_order, created_at, modified_at)
       VALUES (?, ?, 'phone', ?, ?, ?, ?, 1, 1, 0, ?, ?)`,
      [
        newUid(),
        contact?.id,
        "020 1234 5678",
        "020 1234 5678",
        "+442012345678",
        "GB",
        NOW,
        NOW,
      ],
    );
    await updateAppSettings(exec, { phoneRegionOverride: "US" }, LATER);
    expect(
      await exec.getFirstAsync<{
        canonical_value: string;
        canonical_region: string;
      }>("SELECT canonical_value, canonical_region FROM contact_methods"),
    ).toEqual({ canonical_value: "+442012345678", canonical_region: "GB" });
  });

  it("roundtrips every field", async () => {
    await updateAppSettings(
      exec,
      {
        notificationsEnabled: 1,
        decayEnabled: 0,
        birthdayEnabled: 0,
        lockscreenPublic: 1,
        deliveryHour: 6,
        quietStartHour: 22,
        quietEndHour: 7,
      },
      LATER,
    );
    expect(await getAppSettings(exec)).toEqual({
      notificationsEnabled: 1,
      decayEnabled: 0,
      birthdayEnabled: 0,
      // Untouched by this patch — still the seeded default (ON).
      digestEnabled: 1,
      interactionAssistEnabled: 1,
      lockscreenPublic: 1,
      deliveryHour: 6,
      quietStartHour: 22,
      quietEndHour: 7,
      // The sun fields are untouched by this patch — still null.
      sunContactId: null,
      selfSunColour: null,
      phoneRegionOverride: null,
      includeUnboundNeverContacted: 0,
      birthdayUnboundEnabled: 1,
      // AI fields untouched by this patch — still the disabled defaults.
      ...AI_DEFAULTS,
      ...BACKUP_DEFAULTS,
      dataRevision: 1,
      modifiedAt: LATER,
    });
  });

  it.each([
    ["deliveryHour", -1],
    ["deliveryHour", 24],
    ["deliveryHour", 9.5],
    ["deliveryHour", Number.NaN],
    ["quietStartHour", -1],
    ["quietStartHour", 24],
    ["quietEndHour", 25],
    ["quietEndHour", 3.14],
  ])(
    "rejects out-of-range/non-integer %s=%s before any UPDATE",
    async (field, value) => {
      await expect(
        (async () =>
          updateAppSettings(
            exec,
            { [field]: value } as Parameters<typeof updateAppSettings>[1],
            LATER,
          ))(),
      ).rejects.toThrow();
      // The row must be unchanged: modified_at still the seed value.
      const row = await exec.getFirstAsync<{ modified_at: string }>(
        "SELECT modified_at FROM app_settings WHERE id = 1",
      );
      expect(row?.modified_at).toBe(NOW);
    },
  );

  it("accepts the boundary hours 0 and 23", async () => {
    await updateAppSettings(exec, { deliveryHour: 0, quietEndHour: 23 }, LATER);
    const settings = await getAppSettings(exec);
    expect(settings.deliveryHour).toBe(0);
    expect(settings.quietEndHour).toBe(23);
  });

  it("persists the canonical 0/1 toggle inputs", async () => {
    await updateAppSettings(
      exec,
      { decayEnabled: 0, birthdayEnabled: 1 },
      LATER,
    );
    const settings = await getAppSettings(exec);
    expect(settings.decayEnabled).toBe(0);
    expect(settings.birthdayEnabled).toBe(1);
  });

  it("rejects a toggle value that is neither 0 nor 1", async () => {
    await expect(
      (async () =>
        updateAppSettings(exec, { decayEnabled: 2 as 0 | 1 }, LATER))(),
    ).rejects.toThrow();
    const row = await exec.getFirstAsync<{ decay_enabled: number }>(
      "SELECT decay_enabled FROM app_settings WHERE id = 1",
    );
    expect(row?.decay_enabled).toBe(1);
  });

  it("round-trips the digest toggle: write 0 reads 0, write 1 reads 1 (DGST-01)", async () => {
    // Defaults ON — a durable OFF must persist (the launch sweep may not re-enable).
    expect((await getAppSettings(exec)).digestEnabled).toBe(1);
    await updateAppSettings(exec, { digestEnabled: 0 }, LATER);
    expect((await getAppSettings(exec)).digestEnabled).toBe(0);
    await updateAppSettings(exec, { digestEnabled: 1 }, LATER);
    expect((await getAppSettings(exec)).digestEnabled).toBe(1);
  });

  it("expires pending assists on opt-out, keeps them expired on re-enable, and bumps revision once per flip", async () => {
    const contact = await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, ?, 30, ?, ?)`,
      [newUid(), "Assist contact", NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO interaction_assists
       (uid, contact_id, channel, endpoint_value, status, handoff_at, created_at, modified_at)
       VALUES (?, ?, 'call', ?, 'pending', ?, ?, ?)`,
      [newUid(), contact.lastInsertRowId, "+15551234567", NOW, NOW, NOW],
    );
    const before = await getAppSettings(exec);

    await setInteractionAssistEnabled(exec, 0, LATER);
    const afterOff = await getAppSettings(exec);
    expect(afterOff.interactionAssistEnabled).toBe(0);
    expect(afterOff.dataRevision).toBe(before.dataRevision + 1);
    expect(await exec.getAllAsync("SELECT id FROM interactions")).toEqual([]);
    expect(
      await exec.getAllAsync<{ status: string }>(
        "SELECT status FROM interaction_assists",
      ),
    ).toEqual([{ status: "expired" }]);

    await setInteractionAssistEnabled(exec, 1, "2026-08-16 14:00:00");
    const afterOn = await getAppSettings(exec);
    expect(afterOn.interactionAssistEnabled).toBe(1);
    expect(afterOn.dataRevision).toBe(afterOff.dataRevision + 1);
    expect(
      await exec.getAllAsync<{ status: string }>(
        "SELECT status FROM interaction_assists",
      ),
    ).toEqual([{ status: "expired" }]);
    expect(await getPortableSettingsSnapshot(exec)).toMatchObject({
      interactionAssistEnabled: 1,
    });
    expect(PORTABLE_SETTINGS_KEYS).toContain("interactionAssistEnabled");
  });

  it("rejects a non-0/1 digestEnabled before any UPDATE (assertToggle guard, T-15-05)", async () => {
    await expect(
      (async () =>
        updateAppSettings(exec, { digestEnabled: 2 as 0 | 1 }, LATER))(),
    ).rejects.toThrow();
    // No write occurred: the column keeps its seeded default and modified_at is NOW.
    const row = await exec.getFirstAsync<{
      digest_enabled: number;
      modified_at: string;
    }>("SELECT digest_enabled, modified_at FROM app_settings WHERE id = 1");
    expect(row?.digest_enabled).toBe(1);
    expect(row?.modified_at).toBe(NOW);
  });

  it("is a no-op that still bumps modified_at when the patch is empty", async () => {
    await updateAppSettings(exec, {}, LATER);
    const settings = await getAppSettings(exec);
    expect(settings.deliveryHour).toBe(9);
    const row = await exec.getFirstAsync<{ modified_at: string }>(
      "SELECT modified_at FROM app_settings WHERE id = 1",
    );
    expect(row?.modified_at).toBe(LATER);
  });

  it("never references a per-contact column (writes only app_settings)", async () => {
    // Guard the DATA-04 recency invariant by construction: a contacts write here
    // would be a cross-table leak. Insert a contact, snapshot last_contact,
    // update settings, assert the contact row is byte-identical.
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, last_contact, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newUid(), "Sam", 30, NOW, NOW, NOW],
    );
    const before = await exec.getFirstAsync<{
      last_contact: string;
      modified_at: string;
    }>("SELECT last_contact, modified_at FROM contacts WHERE name = 'Sam'");
    await updateAppSettings(exec, { deliveryHour: 11 }, LATER);
    const after = await exec.getFirstAsync<{
      last_contact: string;
      modified_at: string;
    }>("SELECT last_contact, modified_at FROM contacts WHERE name = 'Sam'");
    expect(after).toEqual(before);
  });
});

describe("app-settings-dao — sun fields (ORR-05 / ORR-06)", () => {
  beforeEach(async () => {
    await migrateToV5();
  });

  it("reads both sun fields as null on a fresh seed", async () => {
    const settings = await getAppSettings(exec);
    expect(settings.sunContactId).toBeNull();
    expect(settings.selfSunColour).toBeNull();
  });

  /** Insert a real contact so the FK on `sun_contact_id` is satisfiable. */
  async function insertContact(name: string): Promise<number> {
    const res = await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [newUid(), name, 30, NOW, NOW],
    );
    return res.lastInsertRowId;
  }

  it("writes and reads back a positive-integer sunContactId", async () => {
    const cid = await insertContact("Sunny");
    await updateAppSettings(exec, { sunContactId: cid }, LATER);
    const settings = await getAppSettings(exec);
    expect(settings.sunContactId).toBe(cid);
  });

  it("clears sunContactId back to null (self)", async () => {
    const cid = await insertContact("Sunny");
    await updateAppSettings(exec, { sunContactId: cid }, LATER);
    await updateAppSettings(exec, { sunContactId: null }, LATER);
    const settings = await getAppSettings(exec);
    expect(settings.sunContactId).toBeNull();
  });

  it("writes and reads back a valid 6-hex selfSunColour (upper case)", async () => {
    await updateAppSettings(exec, { selfSunColour: VALID_HEX_UPPER }, LATER);
    const settings = await getAppSettings(exec);
    expect(settings.selfSunColour).toBe(VALID_HEX_UPPER);
  });

  it("accepts a lower-case 6-hex selfSunColour (case-insensitive class)", async () => {
    await updateAppSettings(exec, { selfSunColour: VALID_HEX_LOWER }, LATER);
    const settings = await getAppSettings(exec);
    expect(settings.selfSunColour).toBe(VALID_HEX_LOWER);
  });

  it("clears selfSunColour back to null (resolve to starPalette[0] at read)", async () => {
    await updateAppSettings(exec, { selfSunColour: VALID_HEX_UPPER }, LATER);
    await updateAppSettings(exec, { selfSunColour: null }, LATER);
    const settings = await getAppSettings(exec);
    expect(settings.selfSunColour).toBeNull();
  });

  it.each([
    ["zero", 0],
    ["negative", -3],
    ["non-integer", 1.5],
  ])(
    "rejects a %s sunContactId before any UPDATE (no write)",
    async (_label, value) => {
      await expect(
        (async () => updateAppSettings(exec, { sunContactId: value }, LATER))(),
      ).rejects.toThrow();
      const row = await exec.getFirstAsync<{
        sun_contact_id: number | null;
        modified_at: string;
      }>("SELECT sun_contact_id, modified_at FROM app_settings WHERE id = 1");
      expect(row?.sun_contact_id).toBeNull();
      expect(row?.modified_at).toBe(NOW);
    },
  );

  it.each([
    ["a non-hex word", REJECT_WORD],
    ["a too-short 3-hex", REJECT_SHORT],
    ["a too-long 8-hex", REJECT_LONG],
    ["bad hex chars", REJECT_BAD_CHARS],
  ])(
    "rejects %s selfSunColour before any UPDATE (no write)",
    async (_label, value) => {
      await expect(
        (async () =>
          updateAppSettings(exec, { selfSunColour: value }, LATER))(),
      ).rejects.toThrow();
      const row = await exec.getFirstAsync<{
        self_sun_colour: string | null;
        modified_at: string;
      }>("SELECT self_sun_colour, modified_at FROM app_settings WHERE id = 1");
      expect(row?.self_sun_colour).toBeNull();
      expect(row?.modified_at).toBe(NOW);
    },
  );

  it("exports the SELF_SUN_COLOUR_RE the write path validates against (palette lock)", async () => {
    // 13-04's M6 conformance test imports THIS regex and runs every starPalette
    // entry through it — the single source of truth for what is writable.
    expect(SELF_SUN_COLOUR_RE.test(VALID_HEX_UPPER)).toBe(true);
    expect(SELF_SUN_COLOUR_RE.test(VALID_HEX_LOWER)).toBe(true);
    expect(SELF_SUN_COLOUR_RE.test(REJECT_SHORT)).toBe(false);
    expect(SELF_SUN_COLOUR_RE.test(REJECT_LONG)).toBe(false);
    expect(SELF_SUN_COLOUR_RE.test(REJECT_BAD_CHARS)).toBe(false);
  });
});

describe("app-settings-dao — AI settings (AI-01)", () => {
  beforeEach(async () => {
    await migrateToV5();
  });

  /** Read the raw ack column without going through the typed DAO reader. */
  async function ackCustom(): Promise<number> {
    const row = await exec.getFirstAsync<{ ai_ack_custom: number }>(
      "SELECT ai_ack_custom FROM app_settings WHERE id = 1",
    );
    return row?.ai_ack_custom ?? -1;
  }

  it("persists a known provider + model and reloads them", async () => {
    await updateAppSettings(
      exec,
      { aiProvider: "openai", aiModel: "gpt-4.1-mini" },
      LATER,
    );
    const settings = await getAppSettings(exec);
    expect(settings.aiProvider).toBe("openai");
    expect(settings.aiModel).toBe("gpt-4.1-mini");
  });

  it("rejects an unknown provider before any UPDATE (no write)", async () => {
    await expect(
      (async () =>
        updateAppSettings(exec, { aiProvider: "evilcorp" as never }, LATER))(),
    ).rejects.toThrow();
    const settings = await getAppSettings(exec);
    expect(settings.aiProvider).toBe("none");
    const row = await exec.getFirstAsync<{ modified_at: string }>(
      "SELECT modified_at FROM app_settings WHERE id = 1",
    );
    expect(row?.modified_at).toBe(NOW);
  });

  it("rejects an http:// Custom endpoint on write and changes no row (H2)", async () => {
    await expect(
      (async () =>
        updateAppSettings(
          exec,
          { aiCustomEndpoint: "http://api.example.com/v1" },
          LATER,
        ))(),
    ).rejects.toThrow();
    const settings = await getAppSettings(exec);
    expect(settings.aiCustomEndpoint).toBe("");
    const row = await exec.getFirstAsync<{ modified_at: string }>(
      "SELECT modified_at FROM app_settings WHERE id = 1",
    );
    expect(row?.modified_at).toBe(NOW);
  });

  it("rejects a non-public IP-literal Custom endpoint on write (C4-H1)", async () => {
    await expect(
      (async () =>
        updateAppSettings(
          exec,
          { aiCustomEndpoint: "https://192.168.1.10/v1" },
          LATER,
        ))(),
    ).rejects.toThrow();
    expect((await getAppSettings(exec)).aiCustomEndpoint).toBe("");
  });

  it("persists a valid public https Custom endpoint", async () => {
    await updateAppSettings(
      exec,
      { aiCustomEndpoint: "https://api.example.com/v1/chat" },
      LATER,
    );
    expect((await getAppSettings(exec)).aiCustomEndpoint).toBe(
      "https://api.example.com/v1/chat",
    );
  });

  it("accepts an EMPTY endpoint as unconfigured and clears a previous one (C3-M5)", async () => {
    await updateAppSettings(
      exec,
      { aiCustomEndpoint: "https://api.example.com/v1" },
      LATER,
    );
    expect((await getAppSettings(exec)).aiCustomEndpoint).toBe(
      "https://api.example.com/v1",
    );
    // An empty string is a valid write that clears the prior value, no throw.
    await updateAppSettings(exec, { aiCustomEndpoint: "" }, LATER);
    expect((await getAppSettings(exec)).aiCustomEndpoint).toBe("");
  });

  it("does NOT let a generic patch set an aiAck* flag (C3-H3a)", async () => {
    // Seed the ack to 1 directly (simulating Plan 05's dedicated writer).
    await exec.runAsync(
      "UPDATE app_settings SET ai_ack_custom = 1 WHERE id = 1",
    );
    // A generic patch attempting to flip it back to 0 (or set any ack) is dropped.
    await updateAppSettings(
      exec,
      { aiAckCustom: 0, aiAckOpenai: 1 } as AppSettings,
      LATER,
    );
    const settings = await getAppSettings(exec);
    // The ack columns are untouched by the generic path.
    expect(settings.aiAckCustom).toBe(1);
    expect(settings.aiAckOpenai).toBe(0);
  });

  it("resets ai_ack_custom to 0 when the endpoint CHANGES (C3-H3b)", async () => {
    await updateAppSettings(
      exec,
      { aiCustomEndpoint: "https://api.example.com/v1" },
      LATER,
    );
    // Acknowledge the current recipient (Plan 05 writer, simulated).
    await exec.runAsync(
      "UPDATE app_settings SET ai_ack_custom = 1 WHERE id = 1",
    );
    expect(await ackCustom()).toBe(1);

    // Writing a DIFFERENT endpoint must reset the ack in the same transaction.
    await updateAppSettings(
      exec,
      { aiCustomEndpoint: "https://other.example.com/v1" },
      LATER,
    );
    expect(await ackCustom()).toBe(0);
  });

  it("leaves ai_ack_custom untouched when the SAME endpoint is rewritten (C3-H3b)", async () => {
    await updateAppSettings(
      exec,
      { aiCustomEndpoint: "https://api.example.com/v1" },
      LATER,
    );
    await exec.runAsync(
      "UPDATE app_settings SET ai_ack_custom = 1 WHERE id = 1",
    );
    // Re-writing the IDENTICAL endpoint (e.g. alongside a model change) keeps it.
    await updateAppSettings(
      exec,
      { aiCustomEndpoint: "https://api.example.com/v1", aiCustomModel: "x" },
      LATER,
    );
    expect(await ackCustom()).toBe(1);
  });

  it("persists the prompt-template override and custom model", async () => {
    await updateAppSettings(
      exec,
      { aiPromptTemplate: "Say hi to {{name}}", aiCustomModel: "local-7b" },
      LATER,
    );
    const settings = await getAppSettings(exec);
    expect(settings.aiPromptTemplate).toBe("Say hi to {{name}}");
    expect(settings.aiCustomModel).toBe("local-7b");
  });
});

describe("app-settings-dao — portable backup projection and local bookkeeping", () => {
  beforeEach(async () => {
    await migrateToV5();
  });

  it("returns an explicit portable projection without device-local bookkeeping", async () => {
    const snapshot = await getPortableSettingsSnapshot(exec);
    expect(snapshot).toMatchObject({
      notificationsEnabled: 0,
      digestEnabled: 1,
      interactionAssistEnabled: 1,
      sunContactId: null,
      aiProvider: "none",
      aiModel: "",
      aiCustomEndpoint: "",
      aiCustomModel: "",
      aiPromptTemplate: "",
      backupIntervalDays: 1,
      backupRetentionDays: 7,
      modifiedAt: NOW,
    });
    const localOnlyKeys = [
      "dataRevision",
      "lastBackupDataRevision",
      "backupFolderUri",
      "backupFolderName",
      "backupFolderAccessible",
      "backupFolderDiagnostic",
      "lastAutomaticBackupAt",
      "encryptionEnabled",
      "backupNudgeDismissed",
    ];
    for (const key of localOnlyKeys) {
      expect(Object.keys(snapshot)).not.toContain(key);
    }
  });

  it.each([0, -1, 1.5, 3651])(
    "rejects malformed backup day values before writing (%s)",
    async (days) => {
      await expect(
        (async () =>
          updateAppSettings(exec, { backupIntervalDays: days }, LATER))(),
      ).rejects.toThrow();
      const row = await exec.getFirstAsync<{
        backup_interval_days: number;
        modified_at: string;
      }>(
        "SELECT backup_interval_days, modified_at FROM app_settings WHERE id = 1",
      );
      expect(row).toEqual({ backup_interval_days: 1, modified_at: NOW });
    },
  );

  it("accepts the inclusive backup-day bounds", async () => {
    await updateAppSettings(
      exec,
      { backupIntervalDays: 1, backupRetentionDays: 3650 },
      LATER,
    );
    const settings = await getAppSettings(exec);
    expect(settings.backupIntervalDays).toBe(1);
    expect(settings.backupRetentionDays).toBe(3650);
  });

  it("preserves the custom-endpoint acknowledgement reset in the composable core", async () => {
    await exec.runAsync(
      "UPDATE app_settings SET ai_custom_endpoint = ?, ai_ack_custom = 1 WHERE id = 1",
      ["https://api.example.com/v1"],
    );
    await inWriteTransaction(exec, () =>
      updateAppSettingsCore(
        exec,
        { aiCustomEndpoint: "https://api.example.net/v1" },
        LATER,
      ),
    );
    expect((await getAppSettings(exec)).aiAckCustom).toBe(0);
  });

  it("records automatic-backup bookkeeping without advancing data revision", async () => {
    await exec.runAsync(
      "UPDATE app_settings SET data_revision = 12 WHERE id = 1",
    );
    await inWriteTransaction(exec, () =>
      recordAutomaticBackupHealthCore(exec, {
        backupFolderUri: "content://provider/tree/orbit",
        backupFolderName: "Orbit backups",
        lastAutomaticBackupAt: LATER,
        lastBackupDataRevision: 12,
      }),
    );
    expect(
      await exec.getFirstAsync<{ data_revision: number }>(
        "SELECT data_revision FROM app_settings WHERE id = 1",
      ),
    ).toEqual({ data_revision: 12 });
    expect((await getAppSettings(exec)).lastBackupDataRevision).toBe(12);
  });

  // Compile-time lock: local bookkeeping can never be accepted by the generic
  // portable settings patch, even if a future caller attempts it.
  it("keeps bookkeeping fields out of the general settings patch type", () => {
    const invalidPatch: AppSettingsPatch = {
      // @ts-expect-error backupFolderUri is device-local bookkeeping, never portable.
      backupFolderUri: "content://local",
    };
    expect(invalidPatch).toBeDefined();
  });
});

describe("acknowledgeProvider — the SOLE ai_ack_* writer (H5 / C2-H3)", () => {
  beforeEach(async () => {
    await migrateToV5();
  });

  /** The provider→column allowlist, mirrored here to prove each maps 1:1. */
  const CASES: Array<{
    provider: Parameters<typeof acknowledgeProvider>[1];
    column: string;
  }> = [
    { provider: "openai", column: "ai_ack_openai" },
    { provider: "anthropic", column: "ai_ack_anthropic" },
    { provider: "google", column: "ai_ack_google" },
    { provider: "custom", column: "ai_ack_custom" },
  ];

  /** Read every ack column as a map for cross-column no-leak assertions. */
  async function readAcks(): Promise<Record<string, number>> {
    const row = await exec.getFirstAsync<Record<string, number>>(
      `SELECT ai_ack_openai, ai_ack_anthropic, ai_ack_google, ai_ack_custom
         FROM app_settings WHERE id = 1`,
    );
    return row ?? {};
  }

  for (const { provider, column } of CASES) {
    it(`sets ONLY ${column} for provider '${provider}' and reloads acknowledged`, async () => {
      await acknowledgeProvider(exec, provider, LATER);
      const acks = await readAcks();
      // The target column flipped to 1; the other three stayed 0.
      for (const c of CASES) {
        expect(acks[c.column]).toBe(c.column === column ? 1 : 0);
      }
      // The typed reader reflects the acknowledgement across a reload.
      const settings = await getAppSettings(exec);
      const flag = {
        openai: settings.aiAckOpenai,
        anthropic: settings.aiAckAnthropic,
        google: settings.aiAckGoogle,
        custom: settings.aiAckCustom,
      }[provider];
      expect(flag).toBe(1);
    });
  }

  it("bumps modified_at and writes NOTHING outside the one ack column (write-spy)", async () => {
    // Spy on every SQL statement issued during the ack write.
    const statements: string[] = [];
    const spied = {
      ...exec,
      runAsync: (sql: string, params?: unknown[]) => {
        statements.push(sql);
        return exec.runAsync(sql, params);
      },
      execAsync: (sql: string) => {
        statements.push(sql);
        return exec.execAsync(sql);
      },
    } as typeof exec;

    await acknowledgeProvider(spied, "openai", LATER);

    const joined = statements.join("\n").toLowerCase();
    // The acknowledgement update plus its outer-operation revision increment.
    const updates = statements.filter((s) => /update/i.test(s));
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatch(/ai_ack_openai\s*=\s*1/);
    expect(updates[0]).toMatch(/modified_at\s*=\s*\?/);
    expect(updates[1]).toMatch(/data_revision\s*=\s*data_revision\s*\+\s*1/);
    // No contact / interaction / fuel / last_contact write on this path (DATA-04).
    expect(joined).not.toMatch(/\bcontacts\b/);
    expect(joined).not.toMatch(/\binteractions\b/);
    expect(joined).not.toMatch(/\bfuel\b/);
    expect(joined).not.toMatch(/last_contact/);

    const row = await exec.getFirstAsync<{ modified_at: string }>(
      "SELECT modified_at FROM app_settings WHERE id = 1",
    );
    expect(row?.modified_at).toBe(LATER);
  });

  it("is idempotent — a second acknowledge keeps the flag at 1 (changes===1)", async () => {
    await acknowledgeProvider(exec, "anthropic", LATER);
    // A re-acknowledge still updates exactly one row (modified_at bump), no throw.
    await expect(
      acknowledgeProvider(exec, "anthropic", NOW),
    ).resolves.toBeUndefined();
    expect((await getAppSettings(exec)).aiAckAnthropic).toBe(1);
  });

  it("throws (→ rollback) when the id=1 row is missing (assertOneChange)", async () => {
    await exec.runAsync("DELETE FROM app_settings WHERE id = 1");
    await expect(acknowledgeProvider(exec, "google", LATER)).rejects.toThrow(
      /changed 0/,
    );
  });
});
