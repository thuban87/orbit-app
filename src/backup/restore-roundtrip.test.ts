import { expect, it, vi } from "vitest";

const photo = vi.hoisted(() => ({ files: new Map<string, string>() }));

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/photos/photo-storage", async () => {
  const paths = await vi.importActual<
    typeof import("@/db/photo-relative-path")
  >("@/db/photo-relative-path");
  return {
    contactPhotoRelPath: (id: number) => `avatars/contact-${id}.jpg`,
    customFieldPhotoRelPath: (id: number, colName: string) =>
      `avatars/cv-${id}-${colName}.jpg`,
    profilePhotoRelPath: () => "avatars/profile.jpg",
    deletePhoto: (path: string) => {
      photo.files.delete(path);
    },
    deleteRestorePending: (path: string) => {
      photo.files.delete(path);
    },
    listRestorePendingPhotos: () =>
      [...photo.files.keys()]
        .filter((path) => path.startsWith("avatars/_restore_pending/"))
        .map((relative) => ({ relative, isStageTmpOrphan: false })),
    photoFileExists: (path: string) => photo.files.has(path),
    photoSwapBackupExists: (path: string) => photo.files.has(`${path}.bak`),
    persistMaster: async (source: string, canonical: string) => {
      const bytes = photo.files.get(source);
      if (bytes === undefined) throw new Error("pending photo missing");
      photo.files.set(canonical, bytes);
      return canonical;
    },
    resolveRestorePendingUri: (path: string) => path,
    resolvePhotoUri: (path: string) => `file:///docs/${path}`,
    resolvePhotoDisplayUri: (path: string, revision?: number) =>
      revision === undefined
        ? `file:///docs/${path}`
        : `file:///docs/${path}?v=${revision}`,
    restorePendingRelPath: paths.restorePendingRelPath,
    stageRestorePendingBase64: async (base64: string, path: string) => {
      photo.files.set(path, base64);
    },
    // The file-copy stager merge re-homing and the D-26 local stager use.
    stageRestorePending: async (sourceUri: string, path: string) => {
      const bytes = photo.files.get(sourceUri.replace("file:///docs/", ""));
      if (bytes === undefined) throw new Error("source photo missing");
      photo.files.set(path, bytes);
    },
  };
});
vi.mock("@/services/photos/background-storage", () => ({
  backgroundDerivativeRelPath: (uid: string) =>
    `profile-backgrounds/${uid}.jpg`,
  resolveBackgroundRestorePendingUri: (path: string) => path,
  stageBackgroundRestorePendingBase64: async () => {},
  persistBackgroundDerivative: async () => {},
  deleteBackgroundRestorePending: () => {},
}));
vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule: async () => {},
}));
vi.mock("@/services/notifications/digest-schedule", () => ({
  reconcileDigestSchedule: async () => {},
}));

import { parseBackupManifest } from "@/backup/backup-schema";
import {
  buildExportManifest,
  buildExportReport,
} from "@/backup/export-manifest";
import { applyRestore } from "@/backup/restore-apply";
import { BACKUP_FORMAT_VERSION } from "@/backup/types";
import { getPhotoDisplay } from "@/components/photo-display";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { updateAppSettings } from "@/db/app-settings-dao";
import { archiveContact } from "@/db/contacts-dao";
import { readDataRevision } from "@/db/data-revision-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { completeGlobalPairsCore } from "@/db/pair-matrix";
import { purgeContact } from "@/db/purge-dao";
import { insertFinalizeEntryCore } from "@/db/restore-photo-journal-dao";
import { snoozeContact } from "@/db/snooze-dao";
import { inWriteTransaction } from "@/db/transaction";
import { finalizeJournalEntryOwned } from "@/services/photos/owned-master";
import { getPhotoCacheBust } from "@/stores/photo-cache-bust-store";

const NOW = "2026-09-01 00:00:00";
let next = 0;
async function db() {
  const exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `test-${++next}`,
  });
  return exec;
}
async function contact(
  exec: Awaited<ReturnType<typeof db>>,
  uid: string,
  archived = false,
) {
  await exec.runAsync(
    "INSERT INTO contacts(uid,name,interval_days,archived_at,created_at,modified_at) VALUES(?,?,30,?,?,?)",
    [uid, uid, archived ? NOW : null, NOW, NOW],
  );
}
async function def(
  exec: Awaited<ReturnType<typeof db>>,
  uid: string,
  scope = "global",
  quarantined = false,
) {
  await exec.runAsync(
    "INSERT INTO custom_field_defs(uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,quarantined_at,created_at,modified_at) VALUES(?,?,?,'text',0,0,0,0,?,?,?,?)",
    [uid, uid, uid, scope, quarantined ? NOW : null, NOW, NOW],
  );
}
async function exported(exec: Awaited<ReturnType<typeof db>>) {
  return parseBackupManifest(
    await buildExportManifest(exec, {
      exportedAt: NOW,
      readPhotoBase64: async () => "AQID",
    }),
  );
}

it("keeps restored live UIDs exportable across repeated Replace-all restores", async () => {
  const destination = await db();
  await contact(destination, "alpha");
  await contact(destination, "beta");
  const alpha = await destination.getFirstAsync<{ id: number }>(
    "SELECT id FROM contacts WHERE uid='alpha'",
  );
  await destination.runAsync(
    "INSERT INTO interactions(uid,contact_id,occurred_at,recorded_at,channel,connected,quality,source,modified_at) VALUES(?,?,?,?,?,?,?,?,?)",
    [
      "alpha-interaction",
      alpha!.id,
      NOW,
      NOW,
      "text",
      1,
      "good",
      "manual",
      NOW,
    ],
  );
  const saved = await exported(destination);
  await contact(destination, "gamma");

  for (let attempt = 0; attempt < 2; attempt++) {
    expect(await applyRestore(destination, saved, "replace-all")).toMatchObject(
      {
        status: "applied",
      },
    );
    expect(
      await destination.getAllAsync<{ uid: string }>(
        "SELECT uid FROM contacts ORDER BY uid",
      ),
    ).toEqual([{ uid: "alpha" }, { uid: "beta" }]);
    expect(
      await destination.getAllAsync<{
        entity_type: string;
        entity_uid: string;
      }>(
        "SELECT t.entity_type,t.entity_uid FROM tombstones t WHERE (t.entity_type='contact' AND EXISTS (SELECT 1 FROM contacts c WHERE c.uid=t.entity_uid)) OR (t.entity_type='interaction' AND EXISTS (SELECT 1 FROM interactions i WHERE i.uid=t.entity_uid))",
      ),
    ).toEqual([]);
    const reexported = await exported(destination);
    expect(reexported.contacts.map((row) => row.uid).sort()).toEqual([
      "alpha",
      "beta",
    ]);
    expect(reexported.interactions.map((row) => row.uid)).toEqual([
      "alpha-interaction",
    ]);
  }
  expect(
    await destination.getFirstAsync<{ entity_uid: string }>(
      "SELECT entity_uid FROM tombstones WHERE entity_type='contact' AND entity_uid='gamma'",
    ),
  ).toEqual({ entity_uid: "gamma" });
});

it.each(["merge", "replace-all"] as const)(
  "restores real exported custom-photo bytes from wire UIDs in %s",
  async (mode) => {
    photo.files.clear();
    const source = await db();
    const destination = await db();
    await contact(source, "incoming-photo-owner");
    await source.runAsync(
      "INSERT INTO custom_field_defs(uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,quarantined_at,created_at,modified_at) VALUES('photo-def','portrait','Portrait','photo',0,0,0,0,'global',?,?,?)",
      [NOW, NOW, NOW],
    );
    const sourceIds = await source.getFirstAsync<{
      contact: number;
      def: number;
    }>(
      "SELECT c.id AS contact,d.id AS def FROM contacts c CROSS JOIN custom_field_defs d WHERE c.uid='incoming-photo-owner' AND d.uid='photo-def'",
    );
    await source.runAsync(
      "INSERT INTO custom_field_values(uid,contact_id,field_def_id,value,created_at,modified_at) VALUES('photo-value',?,?,?, ?, ?)",
      [sourceIds!.contact, sourceIds!.def, "avatars/source.jpg", NOW, NOW],
    );
    await contact(destination, "old-id-owner");
    const manifest = await exported(source);
    const wire = manifest.customFieldValues.find(
      (row) => row.uid === "photo-value",
    )!;
    expect(wire).not.toHaveProperty("fieldType");
    expect(wire).not.toHaveProperty("colName");
    expect(wire.photoBase64).toBe("AQID");
    expect((await applyRestore(destination, manifest, mode)).status).toBe(
      "applied",
    );
    const restored = await destination.getFirstAsync<{
      id: number;
      value: string;
    }>(
      "SELECT c.id,v.value FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id WHERE v.uid='photo-value'",
    );
    if (mode === "merge") expect(restored!.id).not.toBe(sourceIds!.contact);
    expect(restored!.value).toBe(`avatars/cv-${restored!.id}-portrait.jpg`);
    expect(photo.files.get(restored!.value)).toBe("AQID");
  },
);

it("keeps incoming photo bytes when the winning local definition is text", async () => {
  photo.files.clear();
  const source = await db();
  const destination = await db();
  await contact(source, "owner");
  await source.runAsync(
    "INSERT INTO custom_field_defs(uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,created_at,modified_at) VALUES('def','portrait','Portrait','photo',0,0,0,0,'global',?,?)",
    [NOW, NOW],
  );
  const ids = await source.getFirstAsync<{ contact: number; def: number }>(
    "SELECT c.id AS contact,d.id AS def FROM contacts c CROSS JOIN custom_field_defs d WHERE c.uid='owner' AND d.uid='def'",
  );
  await source.runAsync(
    "INSERT INTO custom_field_values(uid,contact_id,field_def_id,value,created_at,modified_at) VALUES('value',?,?,?, ?, ?)",
    [ids!.contact, ids!.def, "avatars/source.jpg", NOW, NOW],
  );
  const manifest = await exported(source);
  await destination.runAsync(
    "INSERT INTO custom_field_defs(uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,created_at,modified_at) VALUES('def','portrait','Portrait','text',0,0,0,0,'global',?,?)",
    [NOW, "2026-09-02 00:00:00"],
  );
  expect((await applyRestore(destination, manifest, "merge")).status).toBe(
    "applied",
  );
  const value = await destination.getFirstAsync<{ value: string }>(
    "SELECT value FROM custom_field_values WHERE uid='value'",
  );
  expect(value?.value).toMatch(/^avatars\/cv-\d+-portrait\.jpg$/);
  expect(photo.files.get(value!.value)).toBe("AQID");
});

it("Merge with local definitions completes all global pairs and its real export restores", async () => {
  const source = await db();
  const destination = await db();
  await contact(source, "incoming");
  await def(destination, "global");
  await def(destination, "quarantined", "global", true);
  await def(destination, "scoped", "contact");
  expect(
    (await applyRestore(destination, await exported(source), "merge")).status,
  ).toBe("applied");
  const rows = await destination.getAllAsync<{ defUid: string; uid: string }>(
    "SELECT d.uid AS defUid,v.uid FROM custom_field_values v JOIN custom_field_defs d ON d.id=v.field_def_id",
  );
  expect(rows.map((row) => row.defUid).sort()).toEqual([
    "global",
    "quarantined",
  ]);
  expect(rows.every((row) => row.uid.startsWith("pair:"))).toBe(true);
  const copy = await db();
  expect(
    (await applyRestore(copy, await exported(destination), "replace-all"))
      .status,
  ).toBe("applied");
});

it("stages a valid photo-bearing wire UID with punctuation under a safe temporary slot", async () => {
  const source = await db();
  const destination = await db();
  await contact(source, "a:b");
  await source.runAsync(
    "UPDATE contacts SET photo='avatars/source.jpg' WHERE uid='a:b'",
  );
  const staged: string[] = [];
  const result = await applyRestore(
    destination,
    await exported(source),
    "merge",
    {
      stagePhoto: async (_bytes, relative) => {
        staged.push(relative);
      },
    },
  );
  expect(result.status).toBe("applied");
  expect(staged).toHaveLength(1);
  expect(staged[0]).toMatch(
    /^avatars\/_restore_pending\/contact-slot0-[A-Za-z0-9_-]+\.jpg$/,
  );
});

it("Merge with incoming definitions completes local archived contacts and independently seeded pairs reconcile", async () => {
  const source = await db();
  const destination = await db();
  await contact(source, "shared");
  await contact(destination, "shared");
  await contact(destination, "local-only", true);
  await def(source, "global");
  await def(destination, "global");
  await completeGlobalPairsCore(source);
  await completeGlobalPairsCore(destination);
  expect(
    (await applyRestore(destination, await exported(source), "merge")).status,
  ).toBe("applied");
  const count = await destination.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id WHERE c.uid='local-only'",
  );
  expect(count?.n).toBe(1);
  expect(
    (await applyRestore(source, await exported(destination), "merge")).status,
  ).toBe("applied");
});

it("conflates equal own UIDs and keeps one deterministic pair", async () => {
  const first = await db();
  const second = await db();
  for (const exec of [first, second]) {
    await contact(exec, "same-contact");
    await def(exec, "same-def");
    await completeGlobalPairsCore(exec);
  }
  expect(
    (await applyRestore(second, await exported(first), "merge")).status,
  ).toBe("applied");
  expect(
    await second.getAllAsync<{ uid: string }>(
      "SELECT uid FROM custom_field_values",
    ),
  ).toEqual([
    {
      uid: `pair:${Buffer.from("same-contact").toString("hex").toUpperCase()}:${Buffer.from("same-def").toString("hex").toUpperCase()}`,
    },
  ]);
});

it("refuses distinct value identities for one pair without changing the destination", async () => {
  const source = await db();
  const destination = await db();
  for (const exec of [source, destination]) {
    await contact(exec, "same-contact");
    await def(exec, "same-def");
  }
  const pairIds = async (exec: Awaited<ReturnType<typeof db>>) => ({
    contact: (await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM contacts WHERE uid='same-contact'",
    ))!.id,
    def: (await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM custom_field_defs WHERE uid='same-def'",
    ))!.id,
  });
  for (const [exec, uid] of [
    [source, "wire-a"],
    [destination, "wire-b"],
  ] as const) {
    const ids = await pairIds(exec);
    await exec.runAsync(
      "INSERT INTO custom_field_values(uid,contact_id,field_def_id,value,created_at,modified_at) VALUES(?,?,?,NULL,?,?)",
      [uid, ids.contact, ids.def, NOW, NOW],
    );
  }
  const before = await destination.getAllAsync(
    "SELECT * FROM custom_field_values",
  );
  expect(
    (await applyRestore(destination, await exported(source), "merge")).status,
  ).toBe("incompatible-destination");
  expect(
    await destination.getAllAsync("SELECT * FROM custom_field_values"),
  ).toEqual(before);
});

it("refuses two definition UIDs that claim the same column name", async () => {
  const source = await db();
  const destination = await db();
  await def(source, "source-def");
  await destination.runAsync(
    "INSERT INTO custom_field_defs(uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,created_at,modified_at) VALUES('destination-def','source-def','Clash','text',0,0,0,0,'global',?,?)",
    [NOW, NOW],
  );
  expect(
    (await applyRestore(destination, await exported(source), "merge")).status,
  ).toBe("incompatible-destination");
});

it("seeds a fallback UID when a wire value occupies the missing pair's deterministic slot", async () => {
  const source = await db();
  const destination = await db();
  await contact(source, "source-contact");
  await def(source, "source-def");
  await contact(destination, "destination-contact");
  await def(destination, "destination-def");
  await completeGlobalPairsCore(destination);
  const sourceContactId = (await source.getFirstAsync<{ id: number }>(
    "SELECT id FROM contacts WHERE uid='source-contact'",
  ))!.id;
  const sourceDefId = (await source.getFirstAsync<{ id: number }>(
    "SELECT id FROM custom_field_defs WHERE uid='source-def'",
  ))!.id;
  const occupied = `pair:${Buffer.from("destination-contact").toString("hex").toUpperCase()}:${Buffer.from("source-def").toString("hex").toUpperCase()}`;
  await source.runAsync(
    "INSERT INTO custom_field_values(uid,contact_id,field_def_id,value,created_at,modified_at) VALUES(?,?,?,?,?,?)",
    [occupied, sourceContactId, sourceDefId, "keep", NOW, NOW],
  );
  expect(
    (await applyRestore(destination, await exported(source), "merge")).status,
  ).toBe("applied");
  const original = await destination.getFirstAsync<{
    value: string;
    uid: string;
  }>(
    "SELECT v.value,v.uid FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id JOIN custom_field_defs d ON d.id=v.field_def_id WHERE c.uid='source-contact' AND d.uid='source-def'",
  );
  expect(original).toEqual({ value: "keep", uid: occupied });
  const fallback = await destination.getFirstAsync<{ uid: string }>(
    "SELECT v.uid FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id JOIN custom_field_defs d ON d.id=v.field_def_id WHERE c.uid='destination-contact' AND d.uid='source-def'",
  );
  expect(fallback?.uid).toMatch(/^pairx:[0-9a-f]{32}$/);
});

it("persists tombstone-only parent and child evidence, bumps revision, and blocks older resurrection", async () => {
  const source = await db();
  const oldSource = await db();
  const destination = await db();
  await contact(oldSource, "deleted-contact");
  const olderSnapshot = await exported(oldSource);
  for (const entityType of ["contact", "fuel"]) {
    await source.runAsync(
      "INSERT INTO tombstones(entity_type,entity_uid,deleted_at) VALUES(?,?,?)",
      [entityType, `deleted-${entityType}`, "2026-09-02 00:00:00"],
    );
  }
  const before = await readDataRevision(destination);
  expect(
    (await applyRestore(destination, await exported(source), "merge")).status,
  ).toBe("applied");
  expect(await readDataRevision(destination)).toBe(before + 1);
  expect(
    await destination.getAllAsync(
      "SELECT entity_type,entity_uid FROM tombstones WHERE entity_uid LIKE 'deleted-%' ORDER BY entity_type",
    ),
  ).toEqual([
    { entity_type: "contact", entity_uid: "deleted-contact" },
    { entity_type: "fuel", entity_uid: "deleted-fuel" },
  ]);
  expect((await applyRestore(destination, olderSnapshot, "merge")).status).toBe(
    "applied",
  );
  expect(
    await destination.getFirstAsync(
      "SELECT uid FROM contacts WHERE uid='deleted-contact'",
    ),
  ).toBeNull();
});

it("reconciles against snooze and settings writes committed while incoming bytes stage", async () => {
  const source = await db();
  const destination = await db();
  await contact(source, "shared");
  await contact(destination, "shared");
  await source.runAsync(
    "UPDATE contacts SET photo='avatars/source.jpg' WHERE uid='shared'",
  );
  const manifest = await exported(source);
  const local = await destination.getFirstAsync<{ id: number }>(
    "SELECT id FROM contacts WHERE uid='shared'",
  );
  const result = await applyRestore(destination, manifest, "merge", {
    stagePhoto: async () => {
      await snoozeContact(destination, {
        contactId: local!.id,
        uid: "snooze-event",
        preset: "1w",
        now: "2026-09-03 00:00:00",
      });
      await updateAppSettings(
        destination,
        { digestEnabled: 1 },
        "2026-09-03 00:00:00",
      );
    },
  });
  expect(result.status).toBe("applied");
  expect(
    await destination.getFirstAsync<{
      snooze_until: string;
      modified_at: string;
    }>("SELECT snooze_until,modified_at FROM contacts WHERE uid='shared'"),
  ).toMatchObject({ modified_at: "2026-09-03 00:00:00" });
  expect(
    await destination.getFirstAsync<{
      modified_at: string;
      digest_enabled: number;
    }>("SELECT modified_at,digest_enabled FROM app_settings WHERE id=1"),
  ).toMatchObject({ modified_at: "2026-09-03 00:00:00", digest_enabled: 1 });
  expect(
    await destination.getFirstAsync(
      "SELECT uid FROM events WHERE uid='snooze-event'",
    ),
  ).toBeTruthy();
});

it("retains a contact purge committed during staging instead of resurrecting the incoming row", async () => {
  const source = await db();
  const destination = await db();
  await contact(source, "purged", true);
  await contact(destination, "purged", true);
  await source.runAsync(
    "UPDATE contacts SET photo='avatars/source.jpg' WHERE uid='purged'",
  );
  const manifest = await exported(source);
  const local = await destination.getFirstAsync<{ id: number }>(
    "SELECT id FROM contacts WHERE uid='purged'",
  );
  expect(
    (
      await applyRestore(destination, manifest, "merge", {
        stagePhoto: async () =>
          purgeContact(destination, local!.id, { now: "2026-09-03 00:00:00" }),
      })
    ).status,
  ).toBe("applied");
  expect(
    await destination.getFirstAsync(
      "SELECT uid FROM contacts WHERE uid='purged'",
    ),
  ).toBeNull();
  expect(
    await destination.getFirstAsync(
      "SELECT entity_uid FROM tombstones WHERE entity_type='contact' AND entity_uid='purged'",
    ),
  ).toBeTruthy();
});

it("retains a contact archive committed during staging", async () => {
  const source = await db();
  const destination = await db();
  await contact(source, "archived");
  await contact(destination, "archived");
  await source.runAsync(
    "UPDATE contacts SET photo='avatars/source.jpg' WHERE uid='archived'",
  );
  const manifest = await exported(source);
  const local = await destination.getFirstAsync<{ id: number }>(
    "SELECT id FROM contacts WHERE uid='archived'",
  );
  expect(
    (
      await applyRestore(destination, manifest, "merge", {
        stagePhoto: async () =>
          archiveContact(destination, local!.id, "2026-09-03 00:00:00"),
      })
    ).status,
  ).toBe("applied");
  expect(
    await destination.getFirstAsync<{
      archived_at: string;
      modified_at: string;
    }>("SELECT archived_at,modified_at FROM contacts WHERE uid='archived'"),
  ).toEqual({
    archived_at: "2026-09-03 00:00:00",
    modified_at: "2026-09-03 00:00:00",
  });
});

it("imports a newer tombstone with no row action and lets equal-second deletion win", async () => {
  const source = await db();
  const destination = await db();
  await source.runAsync(
    "INSERT INTO tombstones(entity_type,entity_uid,deleted_at) VALUES('contact','gone','2026-09-03 00:00:00')",
  );
  await destination.runAsync(
    "INSERT INTO tombstones(entity_type,entity_uid,deleted_at) VALUES('contact','gone','2026-09-02 00:00:00')",
  );
  const before = await readDataRevision(destination);
  expect(
    (await applyRestore(destination, await exported(source), "merge")).status,
  ).toBe("applied");
  expect(await readDataRevision(destination)).toBe(before + 1);
  expect(
    await destination.getFirstAsync<{ deleted_at: string }>(
      "SELECT deleted_at FROM tombstones WHERE entity_type='contact' AND entity_uid='gone'",
    ),
  ).toEqual({ deleted_at: "2026-09-03 00:00:00" });
  const older = await db();
  await contact(older, "gone");
  await older.runAsync(
    "UPDATE contacts SET modified_at='2026-09-03 00:00:00' WHERE uid='gone'",
  );
  expect(
    (await applyRestore(destination, await exported(older), "merge")).status,
  ).toBe("applied");
  expect(
    await destination.getFirstAsync(
      "SELECT uid FROM contacts WHERE uid='gone'",
    ),
  ).toBeNull();
});

it("a restore that finalizes a contact photo publishes a new display revision in-process (38.6 D-01)", async () => {
  photo.files.clear();
  const source = await db();
  const destination = await db();
  await contact(source, "photo-owner");
  await source.runAsync(
    "UPDATE contacts SET photo='avatars/source.jpg' WHERE uid='photo-owner'",
  );
  // The destination already shows an older photo at the same canonical path.
  await contact(destination, "photo-owner");
  const local = await destination.getFirstAsync<{ id: number }>(
    "SELECT id FROM contacts WHERE uid='photo-owner'",
  );
  const canonical = `avatars/contact-${local!.id}.jpg`;
  await destination.runAsync(
    "UPDATE contacts SET photo=?, modified_at='2000-01-01 00:00:00' WHERE uid='photo-owner'",
    [canonical],
  );
  photo.files.set(canonical, "OLD");
  const before = getPhotoDisplay(canonical)!;
  expect(
    (await applyRestore(destination, await exported(source), "merge")).status,
  ).toBe("applied");
  expect(photo.files.get(canonical)).toBe("AQID");
  const after = getPhotoDisplay(canonical)!;
  expect(after.revision).toBeGreaterThan(before.revision);
  expect(after.source.uri).not.toBe(before.source.uri);
});

async function replaceAllCleanupFixture() {
  photo.files.clear();
  const source = await db();
  const destination = await db();
  await contact(source, "incoming");
  await source.runAsync(
    "UPDATE contacts SET photo='avatars/source.jpg' WHERE uid='incoming'",
  );
  // A different destination contact owned the same identity-derived path.
  await destination.runAsync(
    "INSERT INTO contacts(uid,name,photo,interval_days,created_at,modified_at) VALUES('old','Old','avatars/contact-1.jpg',30,?,?)",
    [NOW, NOW],
  );
  photo.files.set("avatars/contact-1.jpg", "OLD");
  return { destination, manifest: await exported(source) };
}

it("replace-all cleanup after a failed finalize publishes a revision only once the bytes are gone", async () => {
  const { destination, manifest } = await replaceAllCleanupFixture();
  const canonical = "avatars/contact-1.jpg";
  const before = getPhotoCacheBust(canonical) ?? 0;
  const result = await applyRestore(destination, manifest, "replace-all", {
    persistPhoto: async () => {
      throw new Error("disk unavailable");
    },
  });
  expect(result).toMatchObject({
    status: "applied",
    photosNeedingAttention: 1,
  });
  expect(
    await destination.getFirstAsync<{ photo: string }>(
      "SELECT photo FROM contacts WHERE uid='incoming'",
    ),
  ).toEqual({ photo: canonical });
  expect(photo.files.has(canonical)).toBe(false);
  expect(getPhotoCacheBust(canonical) ?? 0).toBe(before + 1);
});

it("replace-all cleanup whose delete silently fails does not publish a revision", async () => {
  const { destination, manifest } = await replaceAllCleanupFixture();
  const canonical = "avatars/contact-1.jpg";
  const before = getPhotoCacheBust(canonical) ?? 0;
  const removed: string[] = [];
  const result = await applyRestore(destination, manifest, "replace-all", {
    persistPhoto: async () => {
      throw new Error("disk unavailable");
    },
    // deletePhoto swallows errors: the file is still on disk afterwards.
    deleteCanonicalPhoto: (path) => {
      removed.push(path);
    },
    canonicalPhotoExists: (path) => photo.files.has(path),
  });
  expect(result).toMatchObject({
    status: "applied",
    photosNeedingAttention: 1,
  });
  expect(removed).toContain(canonical);
  expect(photo.files.get(canonical)).toBe("OLD");
  expect(getPhotoCacheBust(canonical) ?? 0).toBe(before);
});

function bytesToBase64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}
// "RIFF" + size + "WEBP" + "VP8 " header: a (38.6 D-10) WebP master's leading bytes.
const WEBP_BASE64 = bytesToBase64([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56,
  0x50, 0x38, 0x20, 0x0e, 0x00, 0x00, 0x00,
]);
// FF D8 FF: a legacy 512 JPEG master's leading bytes (D-12: never re-encoded).
const JPEG_BASE64 = bytesToBase64([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

it.each(["merge", "replace-all"] as const)(
  "a mixed JPEG/WebP library restores and re-exports byte-for-byte under the unchanged .jpg names in %s (38.6 D-12/D-19/D-21)",
  async (mode) => {
    expect(BACKUP_FORMAT_VERSION).toBe(7);
    photo.files.clear();
    const source = await db();
    const destination = await db();
    await contact(source, "webp-owner");
    await contact(source, "jpeg-owner");
    await source.runAsync(
      "UPDATE contacts SET photo='avatars/source-webp.jpg' WHERE uid='webp-owner'",
    );
    await source.runAsync(
      "UPDATE contacts SET photo='avatars/source-jpeg.jpg' WHERE uid='jpeg-owner'",
    );
    photo.files.set("avatars/source-webp.jpg", WEBP_BASE64);
    photo.files.set("avatars/source-jpeg.jpg", JPEG_BASE64);
    const readMap = async (relative: string) => {
      const bytes = photo.files.get(relative);
      if (bytes === undefined) throw new Error(`missing ${relative}`);
      return bytes;
    };
    const manifest = parseBackupManifest(
      await buildExportManifest(source, {
        exportedAt: NOW,
        readPhotoBase64: readMap,
      }),
    );
    expect(manifest.backupFormatVersion).toBe(7);
    const wire = Object.fromEntries(
      manifest.contacts.map((row) => [row.uid, row.photoBase64]),
    );
    expect(wire).toEqual({
      "jpeg-owner": JPEG_BASE64,
      "webp-owner": WEBP_BASE64,
    });

    expect((await applyRestore(destination, manifest, mode)).status).toBe(
      "applied",
    );
    const restored = await destination.getAllAsync<{
      id: number;
      uid: string;
      photo: string;
    }>("SELECT id, uid, photo FROM contacts ORDER BY uid");
    expect(restored.map((row) => row.uid)).toEqual([
      "jpeg-owner",
      "webp-owner",
    ]);
    for (const row of restored) {
      expect(row.photo).toBe(`avatars/contact-${row.id}.jpg`);
      expect(photo.files.get(row.photo)).toBe(
        row.uid === "webp-owner" ? WEBP_BASE64 : JPEG_BASE64,
      );
    }

    const reexported = parseBackupManifest(
      await buildExportManifest(destination, {
        exportedAt: NOW,
        readPhotoBase64: readMap,
      }),
    );
    expect(
      Object.fromEntries(
        reexported.contacts.map((row) => [row.uid, row.photoBase64]),
      ),
    ).toEqual(wire);
  },
);

/*
 * 38.6 D-24 / D-26 / D-29: a missing or empty photo is left out of the backup,
 * counted and marked; restoring a marked row never removes a photo this phone
 * still has.
 *
 * Fixture (source ids by insert order): `z-marked` id 1 owns contact-1.jpg and a
 * pet photo cv-1-pet.jpg, both on disk now but reported missing by the reader at
 * export time (it resolved "", D-29), so the restore sees marked rows whose
 * local files exist; `a-bytes`
 * id 2 owns contact-2.jpg (readable); `m-lost` id 3 names contact-3.jpg, which
 * is not on disk. Replace-all re-inserts contacts in uid order, so back on the
 * source `a-bytes` takes id 1 (z-marked's old id) and `z-marked` takes id 3.
 */
const LATER = "2026-09-02 00:00:00";
async function skippedPhotoSource() {
  photo.files.clear();
  const source = await db();
  for (const [uid, path] of [
    ["z-marked", "avatars/contact-1.jpg"],
    ["a-bytes", "avatars/contact-2.jpg"],
    ["m-lost", "avatars/contact-3.jpg"],
  ] as const) {
    await contact(source, uid);
    await source.runAsync("UPDATE contacts SET photo=? WHERE uid=?", [
      path,
      uid,
    ]);
  }
  await source.runAsync(
    "INSERT INTO custom_field_defs(uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,created_at,modified_at) VALUES('pet-def','pet','Pet','photo',0,0,0,0,'global',?,?)",
    [NOW, NOW],
  );
  await source.runAsync(
    "INSERT INTO custom_field_values(uid,contact_id,field_def_id,value,created_at,modified_at) VALUES('pet-value',(SELECT id FROM contacts WHERE uid='z-marked'),(SELECT id FROM custom_field_defs WHERE uid='pet-def'),'avatars/cv-1-pet.jpg',?,?)",
    [NOW, NOW],
  );
  await completeGlobalPairsCore(source);
  await source.runAsync("UPDATE profile SET photo='avatars/profile.jpg'");
  photo.files.set("avatars/profile.jpg", "U0VMRg"); // self photo
  photo.files.set("avatars/contact-1.jpg", "QUFB"); // z-marked's own bytes
  photo.files.set("avatars/contact-2.jpg", "QkJC"); // a-bytes
  photo.files.set("avatars/cv-1-pet.jpg", "UEVU"); // z-marked's pet
  const missingAtExport = new Set([
    "avatars/contact-1.jpg",
    "avatars/cv-1-pet.jpg",
    "avatars/profile.jpg",
  ]);
  const report = await buildExportReport(source, {
    exportedAt: NOW,
    // The production reader's D-29 contract: "" for a missing or empty file.
    readPhotoBase64: async (relative) => {
      const bytes = photo.files.get(relative);
      if (bytes === undefined || missingAtExport.has(relative)) return "";
      return bytes;
    },
  });
  // Through the wire, as a real backup file would be.
  const manifest = parseBackupManifest(
    JSON.parse(JSON.stringify(report.manifest)),
  );
  return { source, manifest, skippedPhotos: report.skippedPhotos };
}
function newer(
  manifest: ReturnType<typeof parseBackupManifest>,
  change: (row: Record<string, unknown>) => void = () => {},
) {
  const copy = parseBackupManifest(JSON.parse(JSON.stringify(manifest)));
  for (const row of [
    ...copy.contacts,
    ...copy.customFieldValues,
    ...(copy.profile ? [copy.profile] : []),
  ]) {
    row.modifiedAt = LATER;
    change(row);
  }
  return copy;
}
async function photosByUid(exec: Awaited<ReturnType<typeof db>>) {
  return Object.fromEntries(
    (
      await exec.getAllAsync<{ id: number; uid: string; photo: string | null }>(
        "SELECT id, uid, photo FROM contacts",
      )
    ).map((row) => [row.uid, row]),
  );
}
async function petValue(exec: Awaited<ReturnType<typeof db>>) {
  return (
    await exec.getFirstAsync<{ value: string | null }>(
      "SELECT value FROM custom_field_values WHERE uid='pet-value'",
    )
  )?.value;
}
async function profilePhoto(exec: Awaited<ReturnType<typeof db>>) {
  return (
    await exec.getFirstAsync<{ photo: string | null }>(
      "SELECT photo FROM profile WHERE id=1",
    )
  )?.photo;
}
async function journal(exec: Awaited<ReturnType<typeof db>>) {
  return exec.getAllAsync("SELECT * FROM restore_photo_journal");
}

it("exports missing photos as marked nulls and counts them (D-24/D-26/D-29)", async () => {
  const { source, manifest, skippedPhotos } = await skippedPhotoSource();
  expect(skippedPhotos).toBe(4);
  expect(manifest.profile).toMatchObject({
    photoBase64: null,
    photoSkipped: true,
  });
  expect(manifest.backupFormatVersion).toBe(7);
  const byUid = Object.fromEntries(manifest.contacts.map((r) => [r.uid, r]));
  expect(byUid["a-bytes"]?.photoBase64).toBe("QkJC");
  expect(byUid["a-bytes"]).not.toHaveProperty("photoSkipped");
  for (const uid of ["z-marked", "m-lost"])
    expect(byUid[uid]).toMatchObject({ photoBase64: null, photoSkipped: true });
  const values = Object.fromEntries(
    manifest.customFieldValues.map((r) => [r.uid, r]),
  );
  expect(values["pet-value"]).toMatchObject({
    value: null,
    photoBase64: null,
    photoSkipped: true,
  });
  // A photo-type pair with no photo is not marked.
  for (const [uid, row] of Object.entries(values))
    if (uid !== "pet-value") expect(row).not.toHaveProperty("photoSkipped");
  // The export never touches a reference (D-23).
  expect((await photosByUid(source))["m-lost"]?.photo).toBe(
    "avatars/contact-3.jpg",
  );
});

it("Replace-all into a fresh phone gives marked rows no photo and restores every other photo byte-identical", async () => {
  const { manifest } = await skippedPhotoSource();
  const destination = await db();
  const result = await applyRestore(destination, manifest, "replace-all");
  expect(result).toMatchObject({ status: "applied", restoredPhotosMissing: 4 });
  expect(await profilePhoto(destination)).toBeNull();
  const rows = await photosByUid(destination);
  expect(rows["z-marked"]?.photo).toBeNull();
  expect(rows["m-lost"]?.photo).toBeNull();
  expect(await petValue(destination)).toBeNull();
  const keeps = rows["a-bytes"]!;
  expect(keeps.photo).toBe(`avatars/contact-${keeps.id}.jpg`);
  expect(photo.files.get(keeps.photo!)).toBe("QkJC");
  expect(await journal(destination)).toEqual([]);
});

it("a same-age Merge back onto the source keeps every local photo (local wins the tie)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  const before = await photosByUid(source);
  expect(await applyRestore(source, manifest, "merge")).toMatchObject({
    status: "applied",
  });
  expect(await photosByUid(source)).toEqual(before);
  expect(await petValue(source)).toBe("avatars/cv-1-pet.jpg");
  expect(await journal(source)).toEqual([]);
});

it("a Merge of NEWER marked rows leaves local bytes and references untouched and deletes nothing (D-26)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  const result = await applyRestore(source, newer(manifest), "merge");
  expect(result).toMatchObject({
    status: "applied",
    photoCleanupPending: 0,
    restoredPhotosMissing: 0,
  });
  const rows = await photosByUid(source);
  expect(rows["z-marked"]?.photo).toBe("avatars/contact-1.jpg");
  expect(rows["m-lost"]?.photo).toBe("avatars/contact-3.jpg");
  expect(await petValue(source)).toBe("avatars/cv-1-pet.jpg");
  // Kept bytes survive the finalize/delete phase.
  expect(photo.files.get("avatars/contact-1.jpg")).toBe("QUFB");
  expect(photo.files.get("avatars/cv-1-pet.jpg")).toBe("UEVU");
  expect(photo.files.get("avatars/contact-2.jpg")).toBe("QkJC");
  expect(await profilePhoto(source)).toBe("avatars/profile.jpg");
  expect(photo.files.get("avatars/profile.jpg")).toBe("U0VMRg");
  expect(await journal(source)).toEqual([]);
});

it("an UNMARKED null on a newer row still removes the photo (unchanged meaning)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  const cleared = newer(manifest, (row) => {
    delete row.photoSkipped;
  });
  expect(await applyRestore(source, cleared, "merge")).toMatchObject({
    status: "applied",
  });
  const rows = await photosByUid(source);
  expect(rows["z-marked"]?.photo).toBeNull();
  expect(photo.files.has("avatars/contact-1.jpg")).toBe(false);
});

it("Replace-all back onto the source moves each marked row's local bytes to its new id-derived canonical (id reuse, D-26)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  const result = await applyRestore(source, manifest, "replace-all");
  // m-lost's local file was already gone: flagged unavailable, counted (D-28).
  expect(result).toMatchObject({
    status: "applied",
    photosNeedingAttention: 0,
    restoredPhotosMissing: 1,
  });
  const rows = await photosByUid(source);
  // a-bytes took z-marked's old id 1.
  expect(rows["a-bytes"]).toMatchObject({
    id: 1,
    photo: "avatars/contact-1.jpg",
  });
  expect(photo.files.get("avatars/contact-1.jpg")).toBe("QkJC");
  const marked = rows["z-marked"]!;
  expect(marked.id).not.toBe(1);
  expect(marked.photo).toBe(`avatars/contact-${marked.id}.jpg`);
  expect(photo.files.get(marked.photo!)).toBe("QUFB");
  // D-28: m-lost references its OWN new canonical, never its old path. It took
  // a-bytes's old id 2, whose stale bytes were deleted before the flag landed,
  // so nothing loads there and the profile shows "Photo unavailable".
  const lost = rows["m-lost"]!;
  expect(lost.id).toBe(2);
  expect(lost.photo).toBe("avatars/contact-2.jpg");
  expect(photo.files.has(lost.photo!)).toBe(false);
  // The pet photo followed its contact to the new canonical.
  expect(await profilePhoto(source)).toBe("avatars/profile.jpg");
  expect(photo.files.get("avatars/profile.jpg")).toBe("U0VMRg");
  const pet = await petValue(source);
  expect(pet).toBe(`avatars/cv-${marked.id}-pet.jpg`);
  expect(photo.files.get(pet!)).toBe("UEVU");
  // No two rows share a reference, and every kept path still has its bytes.
  const references = [
    ...Object.values(rows).map((row) => row.photo),
    pet,
  ].filter((value): value is string => value !== null);
  expect(new Set(references).size).toBe(references.length);
  for (const reference of references)
    if (reference !== lost.photo) expect(photo.files.has(reference)).toBe(true);
  expect(await journal(source)).toEqual([]);
  expect(
    [...photo.files.keys()].filter((path) =>
      path.startsWith("avatars/_restore_pending/"),
    ),
  ).toEqual([]);
});

it("Replace-all aborts before any write when a marked row's existing local file cannot be copied (review CR2-01)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  const rowsBefore = await photosByUid(source);
  const petBefore = await petValue(source);
  const filesBefore = new Map(photo.files);
  const copied: string[] = [];
  await expect(
    applyRestore(source, manifest, "replace-all", {
      stageLocalPhoto: async (canonical, pending) => {
        // Genuinely absent (m-lost): nothing to stage, the restore continues.
        if (!photo.files.has(canonical)) return false;
        // z-marked's photo is on disk but the copy fails part-way (a full
        // disk), leaving the stager's half-written temp file (review IN2-03).
        if (canonical === "avatars/contact-1.jpg") {
          photo.files.set(`${pending}.stage-tmp`, "partial");
          throw new Error("ENOSPC: no space left on device");
        }
        photo.files.set(pending, photo.files.get(canonical)!);
        copied.push(canonical);
        return true;
      },
    }),
  ).rejects.toThrow("ENOSPC");
  // The profile's local bytes were staged before the failure.
  expect(copied).toContain("avatars/profile.jpg");
  // Nothing was written: every row, reference and byte is as it was, and no
  // staged copy or journal row is left behind.
  expect(await photosByUid(source)).toEqual(rowsBefore);
  expect(await petValue(source)).toBe(petBefore);
  expect(await profilePhoto(source)).toBe("avatars/profile.jpg");
  expect(await journal(source)).toEqual([]);
  expect(photo.files).toEqual(filesBefore);
});

it("Replace-all settles an unfinished finalize before staging a marked row's local bytes, so the newer photo survives (review WR2-02)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  // An earlier restore committed newer bytes for z-marked's canonical, but its
  // post-commit finalize failed: the stale bytes are still at contact-1.jpg.
  const pending = "avatars/_restore_pending/contact-z-marked-older.jpg";
  photo.files.set(pending, "TkVX");
  await inWriteTransaction(source, () =>
    insertFinalizeEntryCore(source, {
      relativePath: pending,
      action: "finalize",
      targetKind: "contact",
      contactUid: "z-marked",
      valueUid: null,
      fieldDefUid: null,
      canonicalRelativePath: "avatars/contact-1.jpg",
      createdAt: NOW,
    }),
  );
  const result = await applyRestore(source, manifest, "replace-all");
  expect(result).toMatchObject({
    status: "applied",
    photosNeedingAttention: 0,
    restoredPhotosMissing: 1,
  });
  const rows = await photosByUid(source);
  const marked = rows["z-marked"]!;
  expect(marked.photo).toBe(`avatars/contact-${marked.id}.jpg`);
  // The newer bytes, not the stale canonical's.
  expect(photo.files.get(marked.photo!)).toBe("TkVX");
  expect(photo.files.get("avatars/contact-1.jpg")).toBe("QkJC");
  expect(await journal(source)).toEqual([]);
  expect(
    [...photo.files.keys()].filter((path) =>
      path.startsWith("avatars/_restore_pending/"),
    ),
  ).toEqual([]);
});

/** Records every delete intent a restore enqueues (before the drain retires it). */
function recordingDeleteIntents(exec: Awaited<ReturnType<typeof db>>) {
  const intents: string[] = [];
  const recording: typeof exec = {
    ...exec,
    runAsync: (sql, params) => {
      if (sql.includes("restore_photo_journal") && sql.includes("'delete'"))
        intents.push(String((params as unknown[])[1]));
      return exec.runAsync(sql, params);
    },
  };
  return { recording, intents };
}

it("a Merge of NEWER marked rows queues no delete intent for any photo it keeps (review IN2-01)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  const { recording, intents } = recordingDeleteIntents(source);
  expect(await applyRestore(recording, newer(manifest), "merge")).toMatchObject(
    { status: "applied" },
  );
  for (const kept of [
    "avatars/contact-1.jpg",
    "avatars/contact-3.jpg",
    "avatars/cv-1-pet.jpg",
    "avatars/profile.jpg",
  ])
    expect(intents).not.toContain(kept);
});

/**
 * Elsewhere z-marked was merged into a new contact: z-marked is tombstoned and
 * its value rows (the marked pet photo included) moved to n-new, keeping their
 * uids. Every row is newer than this phone's, so the backup wins a Merge.
 */
function petMovedToNewContact(
  manifest: ReturnType<typeof parseBackupManifest>,
) {
  const moved = newer(manifest);
  const marked = moved.contacts.find((row) => row.uid === "z-marked")!;
  const merged: Record<string, unknown> = {
    ...marked,
    uid: "n-new",
    photoBase64: null,
  };
  delete merged.photoSkipped;
  moved.contacts = [
    ...moved.contacts.filter((row) => row.uid !== "z-marked"),
    merged,
  ];
  for (const row of moved.customFieldValues)
    if (row.contactUid === "z-marked") row.contactUid = "n-new";
  moved.tombstones.push({
    entityType: "contact",
    entityUid: "z-marked",
    deletedAt: LATER,
  });
  return moved;
}
async function petOwner(exec: Awaited<ReturnType<typeof db>>) {
  return exec.getFirstAsync<{ id: number; uid: string }>(
    "SELECT c.id, c.uid FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id WHERE v.uid='pet-value'",
  );
}

it("a Merge whose marked value arrives under another contact keeps its photo at the row's new canonical (review IN2-01/WR3-01)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  const moved = petMovedToNewContact(manifest);
  const { recording, intents } = recordingDeleteIntents(source);
  const result = await applyRestore(recording, moved, "merge");
  // Nothing was missing on this phone: the pet photo is not counted.
  expect(result).toMatchObject({
    status: "applied",
    photosNeedingAttention: 0,
    photoCleanupPending: 0,
    restoredPhotosMissing: 0,
  });
  const owner = await petOwner(source);
  expect(owner?.uid).toBe("n-new");
  // The reference follows the row to n-new's own canonical, and the bytes
  // this phone had land there (never NULL, never z-marked's old path).
  const pet = await petValue(source);
  expect(pet).toBe(`avatars/cv-${owner!.id}-pet.jpg`);
  expect(photo.files.get(pet!)).toBe("UEVU");
  // The old copy is cleaned up only because it was carried over: no orphan.
  expect(intents).toContain("avatars/cv-1-pet.jpg");
  expect(photo.files.has("avatars/cv-1-pet.jpg")).toBe(false);
  // z-marked itself is gone, so its own photo is still cleaned up.
  expect(intents).toContain("avatars/contact-1.jpg");
  expect(photo.files.has("avatars/contact-1.jpg")).toBe(false);
  // Every marked row that stays in place keeps its path and gets no intent.
  expect(intents).not.toContain("avatars/contact-3.jpg");
  expect(intents).not.toContain("avatars/profile.jpg");
  expect((await photosByUid(source))["m-lost"]?.photo).toBe(
    "avatars/contact-3.jpg",
  );
  expect(await journal(source)).toEqual([]);
  expect(
    [...photo.files.keys()].filter((path) =>
      path.startsWith("avatars/_restore_pending/"),
    ),
  ).toEqual([]);
});

it("a Merge whose marked value arrives under another contact with its file already lost flags it at the new canonical (D-28, review WR3-01)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  photo.files.delete("avatars/cv-1-pet.jpg");
  const result = await applyRestore(
    source,
    petMovedToNewContact(manifest),
    "merge",
  );
  expect(result).toMatchObject({
    status: "applied",
    photoCleanupPending: 0,
    restoredPhotosMissing: 1,
  });
  const owner = await petOwner(source);
  // "Photo unavailable" evidence at the row's own new canonical, not NULL and
  // not z-marked's old path; nothing is on disk there.
  const pet = await petValue(source);
  expect(pet).toBe(`avatars/cv-${owner!.id}-pet.jpg`);
  expect(photo.files.has(pet!)).toBe(false);
  expect(await journal(source)).toEqual([]);
});

it("a Replace-all whose marked value arrives under another contact moves this phone's bytes to the row's new canonical (review CR3-01)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  const result = await applyRestore(
    source,
    petMovedToNewContact(manifest),
    "replace-all",
  );
  // Only m-lost's photo was really missing on this phone (D-28).
  expect(result).toMatchObject({
    status: "applied",
    photosNeedingAttention: 0,
    photoCleanupPending: 0,
    restoredPhotosMissing: 1,
  });
  const owner = await petOwner(source);
  expect(owner?.uid).toBe("n-new");
  const pet = await petValue(source);
  expect(pet).toBe(`avatars/cv-${owner!.id}-pet.jpg`);
  expect(photo.files.get(pet!)).toBe("UEVU");
  expect(await journal(source)).toEqual([]);
  expect(
    [...photo.files.keys()].filter((path) =>
      path.startsWith("avatars/_restore_pending/"),
    ),
  ).toEqual([]);
});

it("Replace-all flags every already-lost marked contact and custom photo at its own new canonical, never aliasing (D-28)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  // z-marked's own photo and pet photo are gone from this phone too.
  photo.files.delete("avatars/contact-1.jpg");
  photo.files.delete("avatars/cv-1-pet.jpg");
  // Old m-lost (id 3) left a stale pet file behind; z-marked reuses id 3.
  photo.files.set("avatars/cv-3-pet.jpg", "U1RBTEU");
  const { recording, intents } = recordingDeleteIntents(source);
  const result = await applyRestore(recording, manifest, "replace-all");
  expect(result).toMatchObject({
    status: "applied",
    photosNeedingAttention: 0,
    photoCleanupPending: 0,
    restoredPhotosMissing: 3,
  });
  const rows = await photosByUid(source);
  expect(rows["a-bytes"]).toMatchObject({
    id: 1,
    photo: "avatars/contact-1.jpg",
  });
  expect(photo.files.get("avatars/contact-1.jpg")).toBe("QkJC");
  // m-lost took id 2: a-bytes's old bytes there were deleted first.
  expect(rows["m-lost"]).toMatchObject({
    id: 2,
    photo: "avatars/contact-2.jpg",
  });
  expect(photo.files.has("avatars/contact-2.jpg")).toBe(false);
  // z-marked took id 3: nothing was on disk, so no intent targeted the path.
  expect(rows["z-marked"]).toMatchObject({
    id: 3,
    photo: "avatars/contact-3.jpg",
  });
  expect(photo.files.has("avatars/contact-3.jpg")).toBe(false);
  expect(intents).not.toContain("avatars/contact-3.jpg");
  // The pet value follows z-marked; the stale file was deleted first.
  expect(await petValue(source)).toBe("avatars/cv-3-pet.jpg");
  expect(photo.files.has("avatars/cv-3-pet.jpg")).toBe(false);
  const references = [
    ...Object.values(rows).map((row) => row.photo),
    await petValue(source),
  ].filter((value): value is string => value != null);
  expect(new Set(references).size).toBe(references.length);
  expect(await profilePhoto(source)).toBe("avatars/profile.jpg");
  expect(photo.files.get("avatars/profile.jpg")).toBe("U0VMRg");
  expect(await journal(source)).toEqual([]);
});

it("Replace-all never flags a lost photo onto another contact's leftover bytes (D-28)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  // The stale file at m-lost's new canonical (a-bytes's old id 2) cannot be
  // deleted: deletePhoto swallows the error and the file stays.
  const result = await applyRestore(source, manifest, "replace-all", {
    deleteCanonicalPhoto: (path) => {
      if (path !== "avatars/contact-2.jpg") photo.files.delete(path);
    },
    canonicalPhotoExists: (path) => photo.files.has(path),
  });
  expect(result).toMatchObject({
    status: "applied",
    photoCleanupPending: 1,
    restoredPhotosMissing: 1,
  });
  const rows = await photosByUid(source);
  expect(rows["m-lost"]).toMatchObject({ id: 2, photo: null });
  expect(photo.files.get("avatars/contact-2.jpg")).toBe("QkJC");
});

/*
 * Review WR3-02: D-28's in-transaction "nothing on disk" decision cannot take
 * the path lock, so it must also rule out bytes that are about to land there.
 * Fixture: a-bytes's bytes travel in the backup, but on this phone its
 * canonical contact-2.jpg is empty right now; m-lost (lost photo) takes id 2.
 */
const OLDER_PENDING = "avatars/_restore_pending/contact-a-bytes-older.jpg";
async function olderFinalizeForContact2(exec: Awaited<ReturnType<typeof db>>) {
  photo.files.delete("avatars/contact-2.jpg");
  photo.files.set(OLDER_PENDING, "WFhY");
  const stale = {
    relativePath: OLDER_PENDING,
    action: "finalize",
    targetKind: "contact",
    contactUid: "a-bytes",
    valueUid: null,
    fieldDefUid: null,
    canonicalRelativePath: "avatars/contact-2.jpg",
    createdAt: NOW,
  } as const;
  await inWriteTransaction(exec, () => insertFinalizeEntryCore(exec, stale));
  return stale;
}

it("Replace-all never flags a lost photo at a path the launch drain is finalizing right now (review WR3-02)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  const stale = await olderFinalizeForContact2(source);
  // The launch drain (after the backup picker returned) is mid-persist of an
  // older restore's bytes for a-bytes at contact-2.jpg; they land only after
  // the restore transaction has committed.
  let committed!: () => void;
  const commit = new Promise<void>((resolve) => {
    committed = resolve;
  });
  let persisting!: () => void;
  const started = new Promise<void>((resolve) => {
    persisting = resolve;
  });
  const drain = finalizeJournalEntryOwned(source, stale, async (from, to) => {
    persisting();
    await commit;
    photo.files.set(to, photo.files.get(from)!);
  });
  await started;
  let bumped = false;
  const watched: typeof source = {
    ...source,
    runAsync: (sql, params) => {
      if (sql.includes("data_revision = data_revision + 1")) bumped = true;
      return source.runAsync(sql, params);
    },
    execAsync: async (sql) => {
      await source.execAsync(sql);
      if (sql === "COMMIT" && bumped) committed();
    },
  };
  const result = await applyRestore(watched, manifest, "replace-all");
  await drain;
  expect(result).toMatchObject({
    status: "applied",
    photoCleanupPending: 0,
    restoredPhotosMissing: 1,
  });
  const lost = (await photosByUid(source))["m-lost"]!;
  expect(lost.id).toBe(2);
  // Flagged only after the drain's bytes landed and were deleted: the row
  // never shows a-bytes's older photo.
  expect(lost.photo).toBe("avatars/contact-2.jpg");
  expect(photo.files.has("avatars/contact-2.jpg")).toBe(false);
  expect(await journal(source)).toEqual([]);
});

it("Replace-all treats a committed finalize row for a lost row's new path as occupied (review WR3-02)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  await olderFinalizeForContact2(source);
  const { recording, intents } = recordingDeleteIntents(source);
  const result = await applyRestore(recording, manifest, "replace-all");
  expect(result).toMatchObject({
    status: "applied",
    photoCleanupPending: 0,
    restoredPhotosMissing: 1,
  });
  // The deferred path: the path is cleaned under its lock (the superseded
  // finalize retired, its pending bytes deleted), then the flag lands.
  expect(intents).toContain("avatars/contact-2.jpg");
  expect((await photosByUid(source))["m-lost"]).toMatchObject({
    id: 2,
    photo: "avatars/contact-2.jpg",
  });
  expect(photo.files.has("avatars/contact-2.jpg")).toBe(false);
  expect(photo.files.has(OLDER_PENDING)).toBe(false);
  expect(await journal(source)).toEqual([]);
});

it("Replace-all never flags a lost photo at a path whose interrupted swap the launch sweep will restore (review WR3-02)", async () => {
  const { source, manifest } = await skippedPhotoSource();
  // An interrupted replace left a-bytes's old photo as contact-2.jpg.bak; the
  // next launch sweep moves it back onto contact-2.jpg.
  photo.files.delete("avatars/contact-2.jpg");
  photo.files.set("avatars/contact-2.jpg.bak", "QkJC");
  const result = await applyRestore(source, manifest, "replace-all");
  expect(result).toMatchObject({ status: "applied", restoredPhotosMissing: 1 });
  // The D-32 fallback: no reference rather than another contact's photo.
  expect((await photosByUid(source))["m-lost"]).toMatchObject({
    id: 2,
    photo: null,
  });
});
