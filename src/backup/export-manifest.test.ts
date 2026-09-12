import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { buildExportManifest } from "@/backup/export-manifest";
import { BACKUP_FORMAT_VERSION } from "@/backup/types";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  createGroupEvent,
  deleteGroupEventAndInteractions,
  dissolveGroupEvent,
} from "@/db/group-events-dao";
import { runMigrations } from "@/db/migrations/runner";

const NOW = "2026-08-25 12:00:00";

describe("buildExportManifest", () => {
  it.each(["dissolve", "delete"] as const)(
    "keeps a local Group Event tombstone but omits it from the format-4 export after %s",
    async (action) => {
      let count = 0;
      const exec = nodeSqliteExecutor(openTestDb());
      await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
        now: NOW,
        newUid: () => `uid-${++count}`,
      });
      await exec.runAsync(
        "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
        ["group-contact", "Group contact", 7, NOW, NOW],
      );
      const contact = await exec.getFirstAsync<{ id: number }>(
        "SELECT id FROM contacts WHERE uid = ?",
        ["group-contact"],
      );
      const { groupEventId } = await createGroupEvent(exec, {
        uid: "group-parent",
        title: "Dinner",
        occurredAt: NOW,
        now: NOW,
        participants: [{ contactId: contact!.id, uid: "group-child" }],
      });

      if (action === "dissolve") {
        await dissolveGroupEvent(exec, { groupEventId, now: NOW });
      } else {
        await deleteGroupEventAndInteractions(exec, { groupEventId, now: NOW });
      }

      expect(
        await exec.getFirstAsync<{ entity_type: string }>(
          "SELECT entity_type FROM tombstones WHERE entity_uid = ?",
          ["group-parent"],
        ),
      ).toEqual({ entity_type: "group_event" });
      const manifest = await buildExportManifest(exec, {
        exportedAt: NOW,
        readPhotoBase64: async () => "AQID",
      });
      expect(manifest.backupFormatVersion).toBe(4);
      expect(manifest.tombstones).not.toContainEqual(
        expect.objectContaining({ entityType: "group_event" }),
      );
      if (action === "delete") {
        expect(manifest.tombstones).toContainEqual(
          expect.objectContaining({
            entityType: "interaction",
            entityUid: "group-child",
          }),
        );
      }
    },
  );

  it("pins the format-4 portable-settings wire shape before Phase 36", async () => {
    let count = 0;
    const exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: () => `uid-${++count}`,
    });

    const manifest = await buildExportManifest(exec, {
      exportedAt: NOW,
      readPhotoBase64: async () => "AQID",
    });

    // D-06 trip-wire: Phase 36 owns the coordinated wire change to v5.
    expect(BACKUP_FORMAT_VERSION).toBe(4);
    expect(manifest.backupFormatVersion).toBe(4);
    expect(Object.keys(manifest.appSettings).sort()).toEqual([
      "aiCustomEndpoint",
      "aiCustomModel",
      "aiModel",
      "aiPromptTemplate",
      "aiProvider",
      "backupIntervalDays",
      "backupRetentionDays",
      "birthdayEnabled",
      "birthdayUnboundEnabled",
      "decayEnabled",
      "deliveryHour",
      "digestEnabled",
      "includeUnboundNeverContacted",
      "interactionAssistEnabled",
      "lockscreenPublic",
      "modifiedAt",
      "notificationsEnabled",
      "phoneRegionOverride",
      "quietEndHour",
      "quietStartHour",
      "selfSunColour",
      "sunContactUid",
    ]);
    expect(manifest.appSettings).not.toHaveProperty("orreryLastSystem");
  });

  it("emits the migrated interaction vocabulary from a post-migration DB without a source change (D-06)", async () => {
    let count = 0;
    const exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: () => `uid-${++count}`,
    });
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)`,
      ["vocab-c", "Vocab", 7, NOW, NOW],
    );
    const contact = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM contacts WHERE uid = ?",
      ["vocab-c"],
    );
    // A row already carrying the migrated (post-025) vocabulary. Export SELECTs the
    // live quality/channel column, so it serializes Positive/Message automatically —
    // export-manifest.ts is NOT changed and BACKUP_FORMAT_VERSION is NOT bumped.
    await exec.runAsync(
      `INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, channel, connected, quality, source, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "vocab-i",
        contact!.id,
        NOW,
        NOW,
        "Message",
        1,
        "Positive",
        "manual",
        NOW,
      ],
    );

    const manifest = await buildExportManifest(exec, {
      exportedAt: NOW,
      readPhotoBase64: async () => "",
    });

    expect(manifest.interactions).toEqual([
      expect.objectContaining({
        uid: "vocab-i",
        quality: "Positive",
        channel: "Message",
      }),
    ]);
    // Phase 36 owns the format bump; this guard keeps it unchanged this phase.
    expect(BACKUP_FORMAT_VERSION).toBe(4);
  });

  it("exports full portable state with bytes and never local paths or backup bookkeeping", async () => {
    let count = 0;
    const exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: () => `uid-${++count}`,
    });
    await exec.runAsync("UPDATE profile SET name = ?, photo = ? WHERE id = 1", [
      "Me",
      "avatars/profile.jpg",
    ]);
    const category = await exec.getFirstAsync<{ id: number; uid: string }>(
      "SELECT id, uid FROM categories ORDER BY id LIMIT 1",
    );
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, category_id, interval_days, photo, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["contact-a", "Ada", category!.id, 7, "avatars/contact-1.jpg", NOW, NOW],
    );
    const contact = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM contacts WHERE uid = ?",
      ["contact-a"],
    );
    const linked = await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)`,
      ["contact-b", "Bea", 7, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO contact_methods
        (uid, contact_id, method_type, raw_value, display_value, canonical_value,
         canonical_region, label, extension, is_actionable, is_primary,
         display_order, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "method-a",
        contact!.id,
        "phone",
        "+1 555 0100",
        "+1 555 0100",
        "+15550100",
        "US",
        "Mobile",
        "42",
        1,
        1,
        0,
        NOW,
        NOW,
      ],
    );
    await exec.runAsync(
      "UPDATE app_settings SET sun_contact_id = ?, data_revision = 9, backup_folder_uri = ? WHERE id = 1",
      [contact!.id, "content://local"],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_defs (uid, col_name, label, type, options, show_on_new, always_show, display_order, share_with_ai, created_at, modified_at) VALUES (?, ?, ?, ?, NULL, 0, 0, 0, 0, ?, ?)`,
      ["def-a", "nickname", "Nickname", "text", NOW, NOW],
    );
    const def = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM custom_field_defs WHERE uid = ?",
      ["def-a"],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, NULL, ?, ?)`,
      ["value-a", contact!.id, def!.id, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_value_history (uid, contact_id, field_def_id, value, created_at) VALUES (?, ?, ?, ?, ?)`,
      ["history-a", contact!.id, def!.id, "Old nickname", NOW],
    );
    await exec.runAsync(
      `INSERT INTO memories (uid, contact_id, type, custom_label, value, pinned, outdated, provenance, allow_ai, created_at, modified_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "memory-deleted",
        contact!.id,
        "custom",
        "Note",
        "Remember this",
        1,
        0,
        "user",
        1,
        NOW,
        NOW,
        "2026-08-26 12:00:00",
      ],
    );
    await exec.runAsync(
      `INSERT INTO relationships (uid, contact_id, person_name, linked_contact_id, pinned, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "relationship-a",
        contact!.id,
        "Bea",
        linked.lastInsertRowId,
        0,
        NOW,
        NOW,
      ],
    );
    await exec.runAsync(
      `INSERT INTO current_state_entries (uid, contact_id, field_key, value, is_current, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "state-history",
        contact!.id,
        "current_location",
        "Chicago",
        0,
        NOW,
        NOW,
      ],
    );
    await exec.runAsync(
      `INSERT INTO current_state_entries (uid, contact_id, field_key, value, is_current, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "state-current",
        contact!.id,
        "current_location",
        "Madison",
        1,
        NOW,
        "2026-08-26 12:00:00",
      ],
    );
    const manifest = await buildExportManifest(exec, {
      exportedAt: NOW,
      readPhotoBase64: async () => "AQID",
    });
    expect(manifest.appSettings).toMatchObject({
      sunContactUid: "contact-a",
      modifiedAt: NOW,
    });
    expect(manifest.appSettings).not.toHaveProperty("sunContactId");
    expect(JSON.stringify(manifest)).not.toMatch(
      /data_revision|backup_folder_uri|avatars\//,
    );
    expect(manifest.profile).toMatchObject({ photoBase64: "AQID" });
    expect(manifest.contacts[0]).toMatchObject({
      uid: "contact-a",
      categoryUid: category!.uid,
      trackingEnabled: 1,
      intervalDays: 7,
      photoBase64: "AQID",
    });
    expect(manifest).toMatchObject({
      contactMethods: [
        {
          uid: "method-a",
          contactUid: "contact-a",
          methodType: "phone",
          canonicalValue: "+15550100",
          canonicalRegion: "US",
          label: "Mobile",
          extension: "42",
          isActionable: 1,
          isPrimary: 1,
          displayOrder: 0,
        },
      ],
    });
    expect(manifest.customFieldValues).toEqual([
      expect.objectContaining({ uid: "value-a", value: null }),
    ]);
    expect(manifest.customFieldDefs).toEqual([
      expect.objectContaining({
        uid: "def-a",
        scope: "global",
        historyRetained: 0,
        fieldGroup: null,
      }),
    ]);
    expect(manifest.customFieldValueHistory).toEqual([
      expect.objectContaining({
        uid: "history-a",
        contactUid: "contact-a",
        fieldDefUid: "def-a",
        value: "Old nickname",
      }),
    ]);
    expect(manifest.memories).toEqual([
      expect.objectContaining({
        uid: "memory-deleted",
        contactUid: "contact-a",
        allowAi: 1,
        deletedAt: "2026-08-26 12:00:00",
      }),
    ]);
    expect(manifest.currentStateEntries).toEqual([
      expect.objectContaining({ uid: "state-current", isCurrent: 1 }),
      expect.objectContaining({ uid: "state-history", isCurrent: 0 }),
    ]);
    expect(manifest.relationships).toEqual([
      expect.objectContaining({
        uid: "relationship-a",
        contactUid: "contact-a",
        linkedContactUid: "contact-b",
      }),
    ]);
  });

  it("omits all seven Phase-23 theme keys from a format-3 export's appSettings (deferral guard, REVIEWS 23-01 HIGH)", async () => {
    // The theme keys are allowlisted + DAO-writable this phase, but their
    // EMISSION from getPortableSettingsSnapshot is deferred to Phase 36 so the
    // format-3 wire stays byte-identical — export-manifest spreads `...portable`
    // unconditionally, so the ONLY safe guard is that the snapshot never carries
    // them. A format-3 export's appSettings must contain none of the seven.
    let count = 0;
    const exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: () => `uid-${++count}`,
    });
    const manifest = await buildExportManifest(exec, {
      exportedAt: NOW,
      readPhotoBase64: async () => "AQID",
    });
    expect(manifest.backupFormatVersion).toBe(4);
    for (const key of [
      "themePackage",
      "galaxyMode",
      "standardMode",
      "galaxyAccent",
      "standardAccent",
      "galaxyBackground",
      "standardBackground",
    ]) {
      expect(manifest.appSettings).not.toHaveProperty(key);
    }
  });

  it("aborts rather than emitting a partial manifest when one referenced photo cannot be read", async () => {
    const exec = nodeSqliteExecutor(openTestDb());
    let count = 0;
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: () => `uid-${++count}`,
    });
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, photo, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ["contact-a", "Ada", 7, "avatars/contact-1.jpg", NOW, NOW],
    );
    await expect(
      buildExportManifest(exec, {
        exportedAt: NOW,
        readPhotoBase64: async () => {
          throw new Error("missing");
        },
      }),
    ).rejects.toThrow(/repair/i);
  });
});
