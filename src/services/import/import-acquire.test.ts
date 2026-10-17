import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
/** Stored photo sizes the production estimator stats (F-3 end-to-end case). */
const fileSizes = vi.hoisted(() => new Map<string, number>());
vi.mock("expo-file-system", () => ({
  Paths: { document: { uri: "file:///doc" } },
  Directory: class {
    create() {}
    get exists() {
      return false;
    }
    list() {
      return [];
    }
  },
  File: class {
    private readonly relative: string;
    constructor(...parts: unknown[]) {
      this.relative = String(parts.at(-1));
    }
    get exists() {
      return fileSizes.has(this.relative);
    }
    get size() {
      return fileSizes.get(this.relative) ?? 0;
    }
  },
}));
/** Source widths the default "smaller" width read sees (B-9). */
const imageWidths = vi.hoisted(() => new Map<string, number>());
vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate: (uri: string) => ({
      renderAsync: async () => ({
        width: imageWidths.get(uri) ?? 4096,
        release() {},
        saveAsync: async () => ({ uri: `${uri}.small.jpg` }),
      }),
      resize() {
        return this;
      },
      release() {},
    }),
  },
}));

const { importStagingRelPath, stageImportPhoto } = vi.hoisted(() => ({
  importStagingRelPath: vi.fn(() => "import-staging/test.jpg"),
  stageImportPhoto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/photos/photo-storage", () => ({
  importStagingRelPath,
  stageImportPhoto,
}));
const { discardDerivative } = vi.hoisted(() => ({
  discardDerivative: vi.fn(),
}));
vi.mock("@/services/photos/derivative-cache", () => ({ discardDerivative }));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { readPromptContext } from "@/db/ai-context-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { UNBOUND_IMPORT } from "@/db/import-session-dao";
import { getSessionById, listSessionRows } from "@/db/import-session-read";
import { setMemoryAllowAiCore } from "@/db/memories-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import type { FlowHost } from "@/navigation/flow-host";
import { APPROVED_BACKUP_ENCRYPTION_PROFILE } from "@/services/backup/encryption";
import {
  acceptPickedContacts,
  commitSingleImport,
  routePickedImport,
} from "@/services/import/import-acquire";
import { importRowAsNew } from "@/services/import/import-driver";
import type {
  PhotoBudgetChoice,
  PhotoBudgetDeps,
} from "@/services/import/import-photo-budget";
import { startContactImport } from "@/services/import/start-contact-import";
import type { PickedContact } from "../../../modules/orbit-contact-picker";

const NOW = "2026-08-29 12:00:00";
let exec: SqlExecutor;
let counter = 0;
const uid = () => `acquire-test-${++counter}`;

beforeEach(async () => {
  counter = 0;
  vi.clearAllMocks();
  discardDerivative.mockReset();
  fileSizes.clear();
  imageWidths.clear();
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

describe("import acquisition", () => {
  it("does not stage a photo for a nameless bulk row but keeps the single-review photo", async () => {
    const options = {
      batchCategoryId: null,
      effectivePhoneRegion: "US",
      now: NOW,
    };
    const nameless = {
      lookupKey: "nameless",
      displayName: " ",
      methods: [],
      birthday: null,
      photoTempUri: "file:///cache/contact-picker-nameless.photo",
    };

    await acceptPickedContacts(exec, [nameless], { ...options, mode: "bulk" });
    expect(stageImportPhoto).not.toHaveBeenCalled();
    expect(discardDerivative).toHaveBeenCalledWith(nameless.photoTempUri);

    await acceptPickedContacts(exec, [nameless], {
      ...options,
      mode: "single",
    });
    expect(stageImportPhoto).toHaveBeenCalledTimes(1);
    expect(discardDerivative).toHaveBeenCalledTimes(2);
  });

  it("stores the bridge photo fingerprint in the payload and discards the unstaged thumbnail copy (D-132, D-133)", async () => {
    const picked = {
      lookupKey: "fingerprinted",
      displayName: "Finn",
      methods: [],
      birthday: null,
      photoTempUri: "file:///cache/contact-picker-full.photo",
      thumbnailTempUri: "file:///cache/contact-picker-thumb.photo",
      photoFingerprint: "a".repeat(64),
    };
    const sessionId = await acceptPickedContacts(exec, [picked], {
      mode: "single",
      batchCategoryId: null,
      effectivePhoneRegion: "US",
      now: NOW,
    });
    const [row] = await listSessionRows(exec, sessionId);
    expect(JSON.parse(row.sourcePayload)).toMatchObject({
      photoFingerprint: "a".repeat(64),
    });
    expect(stageImportPhoto).toHaveBeenCalledTimes(1);
    expect(stageImportPhoto).toHaveBeenCalledWith(
      picked.photoTempUri,
      expect.any(String),
    );
    expect(discardDerivative).toHaveBeenCalledWith(picked.photoTempUri);
    expect(discardDerivative).toHaveBeenCalledWith(picked.thumbnailTempUri);

    const withoutFingerprint = await acceptPickedContacts(
      exec,
      [{ ...picked, lookupKey: "plain", photoFingerprint: undefined }],
      {
        mode: "single",
        batchCategoryId: null,
        effectivePhoneRegion: "US",
        now: NOW,
      },
    );
    const [plainRow] = await listSessionRows(exec, withoutFingerprint);
    expect(JSON.parse(plainRow.sourcePayload).photoFingerprint).toBeNull();
  });

  it("retires every accepted or skipped picker copy and keeps accepted rows when cleanup fails", async () => {
    discardDerivative.mockImplementation(() => {
      throw new Error("delete failed");
    });
    const picked = [
      {
        lookupKey: "one",
        displayName: "One",
        methods: [],
        birthday: null,
        photoTempUri: "file:///cache/contact-picker-one.photo",
      },
      {
        lookupKey: "two",
        displayName: "Two",
        methods: [],
        birthday: null,
        photoTempUri: "file:///cache/contact-picker-two.photo",
      },
    ];
    stageImportPhoto.mockRejectedValueOnce(new Error("copy failed"));
    const sessionId = await acceptPickedContacts(exec, picked, {
      mode: "bulk",
      batchCategoryId: null,
      effectivePhoneRegion: "US",
      now: NOW,
    });
    expect(await listSessionRows(exec, sessionId)).toHaveLength(2);
    expect(discardDerivative).toHaveBeenCalledTimes(2);
    expect(discardDerivative).toHaveBeenCalledWith(picked[0].photoTempUri);
    expect(discardDerivative).toHaveBeenCalledWith(picked[1].photoTempUri);
  });

  it("single pick → one session + one row → one Unbound contact + row resolved imported + session complete", async () => {
    await exec.runAsync(
      "UPDATE app_settings SET ai_default_memory_allow = 1 WHERE id = 1",
    );
    const sessionId = await acceptPickedContacts(
      exec,
      [
        {
          lookupKey: "android-1",
          displayName: "Ada Import",
          methods: [{ type: "phone", value: "312 555 0100" }],
          birthday: null,
          note: "Single review note",
          photoTempUri: null,
        },
      ],
      {
        mode: "single",
        batchCategoryId: null,
        effectivePhoneRegion: "US",
        now: NOW,
      },
    );
    const rows = await listSessionRows(exec, sessionId);
    expect(rows).toHaveLength(1);
    const contactId = await commitSingleImport(exec, {
      sessionId,
      rowId: rows[0].id,
      input: {
        uid: uid(),
        name: "Ada Import",
        intervalDays: null,
        trackingEnabled: false,
        now: NOW,
        methodDrafts: [{ uid: uid(), type: "phone", value: "312 555 0100" }],
        methodNormalization: { effectivePhoneRegion: "US" },
      },
      externalLinks: [{ provider: "android", externalContactId: "android-1" }],
      birthday: null,
      now: NOW,
    });
    expect(
      await exec.getFirstAsync<{ tracking_enabled: number }>(
        "SELECT tracking_enabled FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ tracking_enabled: 0 });
    expect(await listSessionRows(exec, sessionId)).toEqual([
      expect.objectContaining({
        contactId,
        rowStatus: "imported",
        matchOutcome: "new",
      }),
    ]);
    expect(await getSessionById(exec, sessionId)).toEqual(
      expect.objectContaining({ status: "complete" }),
    );
    expect(
      await exec.getAllAsync<{ type: string; value: string; allow_ai: number }>(
        "SELECT type, value, allow_ai FROM memories WHERE contact_id = ?",
        [contactId],
      ),
    ).toEqual([{ type: "imported", value: "Single review note", allow_ai: 0 }]);
    expect(
      (await readPromptContext(exec, contactId, NOW)).sharedMemories,
    ).toEqual([]);
    const memory = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM memories WHERE contact_id = ?",
      [contactId],
    );
    if (!memory) throw new Error("missing imported note");
    await setMemoryAllowAiCore(exec, {
      id: memory.id,
      contactId,
      allow: true,
      now: NOW,
    });
    expect(
      (await readPromptContext(exec, contactId, NOW)).sharedMemories,
    ).toEqual([
      { label: "Imported from Contacts App", value: "Single review note" },
    ]);
  });

  it("preserves a bulk note through the real session serialization and driver replay", async () => {
    await exec.runAsync(
      "UPDATE app_settings SET ai_default_memory_allow = 1 WHERE id = 1",
    );
    const sessionId = await acceptPickedContacts(
      exec,
      [
        {
          lookupKey: "android-bulk-note",
          displayName: "Bulk Note",
          methods: [],
          birthday: null,
          note: "Raw bulk provider note",
          photoTempUri: null,
        },
      ],
      {
        mode: "bulk",
        batchCategoryId: null,
        effectivePhoneRegion: "US",
        now: NOW,
      },
    );
    const [row] = await listSessionRows(exec, sessionId);

    const result = await importRowAsNew(exec, {
      lifecycle: UNBOUND_IMPORT,
      row,
      batchCategoryId: null,
      phoneRegion: "US",
      now: NOW,
    });

    if (result.contactId === null) throw new Error("expected a contact");
    expect(JSON.parse(row.sourcePayload)).toMatchObject({
      note: "Raw bulk provider note",
    });
    expect(
      await exec.getAllAsync<{ type: string; value: string; allow_ai: number }>(
        "SELECT type, value, allow_ai FROM memories WHERE contact_id = ?",
        [result.contactId],
      ),
    ).toEqual([
      { type: "imported", value: "Raw bulk provider note", allow_ai: 0 },
    ]);
    expect(
      (await readPromptContext(exec, result.contactId, NOW)).sharedMemories,
    ).toEqual([]);
    const memory = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM memories WHERE contact_id = ?",
      [result.contactId],
    );
    if (!memory) throw new Error("missing bulk note");
    await setMemoryAllowAiCore(exec, {
      id: memory.id,
      contactId: result.contactId,
      allow: true,
      now: NOW,
    });
    expect(
      (await readPromptContext(exec, result.contactId, NOW)).sharedMemories,
    ).toEqual([
      { label: "Imported from Contacts App", value: "Raw bulk provider note" },
    ]);
  });
});

/**
 * 38.4 D-57 (planner-bucket enforcement of Phase 19 Cluster D / ADR-066): the
 * single-contact review's Bound choice and cadence reach the contact row.
 */
describe("commitSingleImport lifecycle (D-57)", () => {
  async function singleSession(lookupKey: string) {
    const sessionId = await acceptPickedContacts(
      exec,
      [
        {
          lookupKey,
          displayName: "Single Person",
          methods: [],
          birthday: null,
          note: null,
          photoTempUri: null,
        },
      ],
      {
        mode: "single",
        batchCategoryId: null,
        effectivePhoneRegion: "US",
        now: NOW,
      },
    );
    const [row] = await listSessionRows(exec, sessionId);
    return { sessionId, rowId: row.id };
  }

  it.each([
    [true, 30, { tracking_enabled: 1, interval_days: 30 }],
    [false, null, { tracking_enabled: 0, interval_days: null }],
  ] as const)(
    "trackingEnabled %s creates the reviewed lifecycle",
    async (trackingEnabled, intervalDays, expected) => {
      const { sessionId, rowId } = await singleSession(
        `single-${trackingEnabled}`,
      );
      const effects = vi.fn(async () => {});
      const contactId = await commitSingleImport(exec, {
        sessionId,
        rowId,
        effects,
        input: {
          uid: uid(),
          name: "Single Person",
          intervalDays,
          trackingEnabled,
          now: NOW,
          methodDrafts: [],
          methodNormalization: { effectivePhoneRegion: "US" },
        },
        externalLinks: [
          {
            provider: "android",
            externalContactId: `single-${trackingEnabled}`,
          },
        ],
        birthday: null,
        now: NOW,
      });
      expect(
        await exec.getFirstAsync(
          "SELECT tracking_enabled, interval_days FROM contacts WHERE id = ?",
          [contactId],
        ),
      ).toEqual(expected);
      // D-57: a Bound single import refreshes reminders and the widget once.
      expect(effects).toHaveBeenCalledTimes(trackingEnabled ? 1 : 0);
    },
  );
});

/**
 * D-133 photo budget at the shared import sink (routePickedImport): asked
 * before any session exists, only with backup encryption on (F-5), production
 * deps by default (F-3), fail closed without a decider (F-3), the unknown-size
 * variant on a null estimate (c4 E-1), and the host forwarded (A-1).
 */
describe("routePickedImport photo budget (D-133)", () => {
  const CAP = APPROVED_BACKUP_ENCRYPTION_PROFILE.maxCiphertextBytes;
  const FULL = "file:///cache/contact-picker-full.photo";
  const THUMB = "file:///cache/contact-picker-thumb.photo";
  const options = { effectivePhoneRegion: "US", now: NOW };

  function photoContact(
    lookupKey = "photo-1",
    photos: Partial<PickedContact> = {
      photoTempUri: FULL,
      thumbnailTempUri: THUMB,
    },
  ): PickedContact {
    return {
      lookupKey,
      displayName: `Photo ${lookupKey}`,
      methods: [],
      birthday: null,
      photoTempUri: null,
      ...photos,
    };
  }

  /** Encryption on, current backup already at the cap: one photo goes over. */
  const overDeps: Partial<PhotoBudgetDeps> = {
    encryptionEnabled: async () => true,
    currentBackupBytes: async () => CAP,
  };
  const nullDeps: Partial<PhotoBudgetDeps> = {
    encryptionEnabled: async () => true,
    currentBackupBytes: async () => null,
  };

  async function sessionCount(): Promise<number> {
    const row = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM import_sessions",
    );
    return row?.n ?? 0;
  }

  function navigator() {
    return { navigate: vi.fn() };
  }

  it("over budget + Go back creates no session and discards every picked copy", async () => {
    const decide = vi.fn(async () => "back" as PhotoBudgetChoice);
    const nav = navigator();
    const result = await routePickedImport(
      exec,
      [photoContact()],
      { ...options, decidePhotoBudget: decide, photoBudget: overDeps },
      nav,
    );
    expect(result).toEqual({ status: "cancelled" });
    expect(decide).toHaveBeenCalledWith({
      projectedBytes: CAP + 62_000,
    });
    expect(await sessionCount()).toBe(0);
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(stageImportPhoto).not.toHaveBeenCalled();
    expect(discardDerivative).toHaveBeenCalledWith(FULL);
    expect(discardDerivative).toHaveBeenCalledWith(THUMB);
  });

  it("over budget + without stages no photos", async () => {
    const result = await routePickedImport(
      exec,
      [photoContact()],
      {
        ...options,
        decidePhotoBudget: async () => "without",
        photoBudget: overDeps,
      },
      navigator(),
    );
    expect(result).toMatchObject({ status: "routed" });
    expect(await sessionCount()).toBe(1);
    expect(stageImportPhoto).not.toHaveBeenCalled();
    expect(discardDerivative).toHaveBeenCalledWith(FULL);
    expect(discardDerivative).toHaveBeenCalledWith(THUMB);
  });

  it("over budget + smaller stages the thumbnail copy", async () => {
    await routePickedImport(
      exec,
      [photoContact()],
      {
        ...options,
        decidePhotoBudget: async () => "smaller",
        photoBudget: overDeps,
      },
      navigator(),
    );
    expect(stageImportPhoto).toHaveBeenCalledTimes(1);
    expect(stageImportPhoto).toHaveBeenCalledWith(THUMB, expect.any(String));
    expect(discardDerivative).toHaveBeenCalledWith(FULL);
  });

  it("smaller keeps and stages a thumbnail-only photo already no wider than the edge (B-9)", async () => {
    imageWidths.set(THUMB, 96);
    await routePickedImport(
      exec,
      [
        photoContact("thumb-only", {
          photoTempUri: THUMB,
          thumbnailTempUri: null,
        }),
      ],
      {
        ...options,
        decidePhotoBudget: async () => "smaller",
        photoBudget: overDeps,
      },
      navigator(),
    );
    expect(stageImportPhoto).toHaveBeenCalledWith(THUMB, expect.any(String));
    // Discarded once, by acceptPickedContacts after staging, never before.
    expect(discardDerivative).toHaveBeenCalledTimes(1);
  });

  it("over budget + continue stages the full-size copy", async () => {
    await routePickedImport(
      exec,
      [photoContact()],
      {
        ...options,
        decidePhotoBudget: async () => "continue",
        photoBudget: overDeps,
      },
      navigator(),
    );
    expect(stageImportPhoto).toHaveBeenCalledWith(FULL, expect.any(String));
  });

  it("under budget never asks", async () => {
    const decide = vi.fn();
    const result = await routePickedImport(
      exec,
      [photoContact()],
      {
        ...options,
        decidePhotoBudget: decide,
        photoBudget: {
          encryptionEnabled: async () => true,
          currentBackupBytes: async () => 1_000,
        },
      },
      navigator(),
    );
    expect(decide).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "routed" });
    expect(stageImportPhoto).toHaveBeenCalledWith(FULL, expect.any(String));
  });

  it("a null estimate still asks (unknown size): back creates no session (c4 E-1)", async () => {
    const decide = vi.fn(async () => "back" as PhotoBudgetChoice);
    const result = await routePickedImport(
      exec,
      [photoContact()],
      { ...options, decidePhotoBudget: decide, photoBudget: nullDeps },
      navigator(),
    );
    expect(decide).toHaveBeenCalledWith(null);
    expect(result).toEqual({ status: "cancelled" });
    expect(await sessionCount()).toBe(0);
  });

  it("a null estimate + without stages no photos (c4 E-1)", async () => {
    const decide = vi.fn(async () => "without" as PhotoBudgetChoice);
    await routePickedImport(
      exec,
      [photoContact()],
      { ...options, decidePhotoBudget: decide, photoBudget: nullDeps },
      navigator(),
    );
    expect(decide).toHaveBeenCalledWith(null);
    expect(await sessionCount()).toBe(1);
    expect(stageImportPhoto).not.toHaveBeenCalled();
  });

  it("a pick with no photos never estimates or asks", async () => {
    const decide = vi.fn();
    const currentBackupBytes = vi.fn();
    await routePickedImport(
      exec,
      [photoContact("plain", { photoTempUri: null })],
      {
        ...options,
        decidePhotoBudget: decide,
        photoBudget: {
          encryptionEnabled: async () => true,
          currentBackupBytes,
        },
      },
      navigator(),
    );
    expect(currentBackupBytes).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();
  });

  it("forwards a non-default host to ImportReview (one pick) and BulkImportSetup (two) (A-1)", async () => {
    const host: FlowHost = { kind: "digest" };
    const single = navigator();
    const one = await routePickedImport(
      exec,
      [photoContact("one", { photoTempUri: null })],
      { ...options, host },
      single,
    );
    expect(single.navigate).toHaveBeenCalledWith("ImportReview", {
      sessionId: one.status === "routed" ? one.sessionId : -1,
      host,
    });
    const bulk = navigator();
    const two = await routePickedImport(
      exec,
      [
        photoContact("a", { photoTempUri: null }),
        photoContact("b", { photoTempUri: null }),
      ],
      { ...options, host },
      bulk,
    );
    expect(bulk.navigate).toHaveBeenCalledWith("BulkImportSetup", {
      sessionId: two.status === "routed" ? two.sessionId : -1,
      host,
    });
  });

  it("(i) the real startContactImport with only a decider runs the production estimator before any session (F-3)", async () => {
    await exec.runAsync(
      "UPDATE app_settings SET encryption_enabled = 1 WHERE id = 1",
    );
    await exec.runAsync(
      "INSERT INTO contacts(uid,name,photo,interval_days,created_at,modified_at) VALUES('big','Big Photo','avatars/contact-big.jpg',30,?,?)",
      [NOW, NOW],
    );
    fileSizes.set("avatars/contact-big.jpg", 8_000_000);
    let sessionsWhenAsked = -1;
    const decide = vi.fn(async () => {
      sessionsWhenAsked = await sessionCount();
      return "back" as PhotoBudgetChoice;
    });
    const navigate = vi.fn();

    await startContactImport({
      mode: "system",
      exec,
      effectivePhoneRegion: "US",
      now: NOW,
      pick: async () => [photoContact()],
      navigate: navigate as never,
      decidePhotoBudget: decide,
    });

    expect(decide).toHaveBeenCalledOnce();
    const [estimate] = decide.mock.calls[0] as unknown as [
      { projectedBytes: number },
    ];
    expect(estimate.projectedBytes).toBeGreaterThan(CAP);
    expect(estimate.projectedBytes).toBeGreaterThan(
      Math.ceil((8_000_000 * 4) / 3),
    );
    expect(sessionsWhenAsked).toBe(0);
    expect(await sessionCount()).toBe(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("(ii) no decider + over budget fails closed: cancelled, no session, copies discarded (F-3)", async () => {
    const result = await routePickedImport(
      exec,
      [photoContact()],
      { ...options, photoBudget: overDeps },
      navigator(),
    );
    expect(result).toEqual({ status: "cancelled" });
    expect(await sessionCount()).toBe(0);
    expect(discardDerivative).toHaveBeenCalledWith(FULL);
    expect(discardDerivative).toHaveBeenCalledWith(THUMB);
  });

  it("(iii) no decider + null estimate with encryption on fails closed (F-3)", async () => {
    const result = await routePickedImport(
      exec,
      [photoContact()],
      { ...options, photoBudget: nullDeps },
      navigator(),
    );
    expect(result).toEqual({ status: "cancelled" });
    expect(await sessionCount()).toBe(0);
  });

  it("(iv) encryption off: a would-be-over pick never asks and imports the photo (F-5)", async () => {
    const decide = vi.fn();
    const result = await routePickedImport(
      exec,
      [photoContact()],
      {
        ...options,
        decidePhotoBudget: decide,
        photoBudget: {
          encryptionEnabled: async () => false,
          currentBackupBytes: async () => CAP * 2,
        },
      },
      navigator(),
    );
    expect(decide).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "routed" });
    expect(await sessionCount()).toBe(1);
    expect(stageImportPhoto).toHaveBeenCalledWith(FULL, expect.any(String));
  });

  it("(iv-b) encryption off by default settings: no decider is needed and the import proceeds (F-5)", async () => {
    fileSizes.set("avatars/contact-big.jpg", 8_000_000);
    const result = await routePickedImport(
      exec,
      [photoContact()],
      options,
      navigator(),
    );
    expect(result).toMatchObject({ status: "routed" });
  });

  it("(v) encryption off + a null estimator never asks and the import proceeds (F-5)", async () => {
    const decide = vi.fn();
    const result = await routePickedImport(
      exec,
      [photoContact()],
      {
        ...options,
        decidePhotoBudget: decide,
        photoBudget: {
          encryptionEnabled: async () => false,
          currentBackupBytes: async () => null,
        },
      },
      navigator(),
    );
    expect(decide).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "routed" });
  });

  it("(vii) a throwing encryption read counts as ON, for injected and default deps alike", async () => {
    const throwing = async () => {
      throw new Error("settings unreadable");
    };
    const decide = vi.fn(async () => "back" as PhotoBudgetChoice);
    await routePickedImport(
      exec,
      [photoContact()],
      {
        ...options,
        decidePhotoBudget: decide,
        photoBudget: {
          encryptionEnabled: throwing,
          currentBackupBytes: async () => CAP,
        },
      },
      navigator(),
    );
    expect(decide).toHaveBeenCalledWith({ projectedBytes: CAP + 62_000 });

    const nullDecide = vi.fn(async () => "back" as PhotoBudgetChoice);
    await routePickedImport(
      exec,
      [photoContact()],
      {
        ...options,
        decidePhotoBudget: nullDecide,
        photoBudget: {
          encryptionEnabled: throwing,
          currentBackupBytes: async () => null,
        },
      },
      navigator(),
    );
    expect(nullDecide).toHaveBeenCalledWith(null);

    const cancelled = await routePickedImport(
      exec,
      [photoContact()],
      {
        ...options,
        photoBudget: {
          encryptionEnabled: throwing,
          currentBackupBytes: async () => CAP,
        },
      },
      navigator(),
    );
    expect(cancelled).toEqual({ status: "cancelled" });

    // Default deps: the settings read itself fails (and so does the estimate).
    const broken: SqlExecutor = {
      ...exec,
      getFirstAsync: async () => {
        throw new Error("db unreadable");
      },
      getAllAsync: async () => {
        throw new Error("db unreadable");
      },
    } as SqlExecutor;
    const defaultDecide = vi.fn(async () => "back" as PhotoBudgetChoice);
    const viaDefaults = await routePickedImport(
      broken,
      [photoContact()],
      { ...options, decidePhotoBudget: defaultDecide },
      navigator(),
    );
    expect(defaultDecide).toHaveBeenCalledWith(null);
    expect(viaDefaults).toEqual({ status: "cancelled" });
    expect(await sessionCount()).toBe(0);
  });
});
