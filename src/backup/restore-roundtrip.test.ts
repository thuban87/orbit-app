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
import { buildExportManifest } from "@/backup/export-manifest";
import { applyRestore } from "@/backup/restore-apply";
import { getPhotoDisplay } from "@/components/photo-display";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { updateAppSettings } from "@/db/app-settings-dao";
import { archiveContact } from "@/db/contacts-dao";
import { readDataRevision } from "@/db/data-revision-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { completeGlobalPairsCore } from "@/db/pair-matrix";
import { purgeContact } from "@/db/purge-dao";
import { snoozeContact } from "@/db/snooze-dao";
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
