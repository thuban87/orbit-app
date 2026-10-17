import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("expo-file-system", () => ({
  Paths: { document: { uri: "file:///doc" } },
  File: class {},
  Directory: class {},
}));
const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@/utils/logger", () => ({
  Logger: { warn, error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

import { buildExportManifest } from "@/backup/export-manifest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { APPROVED_BACKUP_ENCRYPTION_PROFILE } from "@/services/backup/encryption";
import type { PickedContact } from "../../../modules/orbit-contact-picker";
import {
  applyPhotoBudgetChoice,
  ESTIMATE_PHOTO_PLACEHOLDER,
  estimateCurrentBackupBytes,
  isOverPhotoBudget,
  PHOTO_CONTACT_BACKUP_BYTES,
  photoBudgetBody,
  readEncryptionEnabled,
  SMALLER_IMPORT_PHOTO_EDGE,
} from "./import-photo-budget";

const NOW = "2026-10-17 12:00:00";
const CAP = APPROVED_BACKUP_ENCRYPTION_PROFILE.maxCiphertextBytes;
let exec: SqlExecutor;
let counter = 0;

beforeEach(async () => {
  counter = 0;
  warn.mockReset();
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `budget-test-${++counter}`,
    defaultPhoneRegion: "US",
  });
});

async function seedContactPhoto(path: string) {
  await exec.runAsync(
    "INSERT INTO contacts(uid,name,photo,interval_days,created_at,modified_at) VALUES(?,?,?,30,?,?)",
    [`contact-${path}`, "Photo Person", path, NOW, NOW],
  );
}

async function seedBackground(path: string) {
  await exec.runAsync(
    "INSERT INTO profile_background_templates(uid,name,image_path,created_at,modified_at) VALUES(?,?,?,?,?)",
    ["background-one", "Saved", path, NOW, NOW],
  );
}

/** The manifest JSON's UTF-8 size with every found photo read as the placeholder. */
async function placeholderManifestBytes(
  sizes: Record<string, number>,
): Promise<{ bytes: number; placeholders: number }> {
  let placeholders = 0;
  const manifest = await buildExportManifest(exec, {
    exportedAt: "2000-01-01 00:00:00",
    readPhotoBase64: async (path) => {
      if (!(path in sizes)) return "";
      placeholders += 1;
      return ESTIMATE_PHOTO_PLACEHOLDER;
    },
  });
  return {
    bytes: new TextEncoder().encode(JSON.stringify(manifest)).length,
    placeholders,
  };
}

describe("estimateCurrentBackupBytes (D-133; convergence c3 D-2)", () => {
  it("sums manifest JSON minus placeholders plus each photo's base64 size", async () => {
    const sizes: Record<string, number> = {
      "avatars/contact-1.jpg": 30_001,
      "avatars/contact-2.jpg": 12_345,
    };
    await seedContactPhoto("avatars/contact-1.jpg");
    await seedContactPhoto("avatars/contact-2.jpg");
    const fileSize = vi.fn((path: string) => sizes[path] ?? null);

    const estimate = await estimateCurrentBackupBytes(exec, fileSize);

    const base = await placeholderManifestBytes(sizes);
    expect(base.placeholders).toBe(2);
    expect(estimate).toBe(
      base.bytes -
        2 * ESTIMATE_PHOTO_PLACEHOLDER.length +
        Math.ceil((30_001 * 4) / 3) +
        Math.ceil((12_345 * 4) / 3),
    );
    expect(fileSize).toHaveBeenCalledWith("avatars/contact-1.jpg");
  });

  it("estimates through a saved Profile background with the real exporter and counts its bytes", async () => {
    const sizes: Record<string, number> = {
      "profile-backgrounds/background-one.jpg": 400_000,
      "avatars/contact-1.jpg": 50_000,
    };
    await seedBackground("profile-backgrounds/background-one.jpg");
    await seedContactPhoto("avatars/contact-1.jpg");

    const estimate = await estimateCurrentBackupBytes(
      exec,
      (path) => sizes[path] ?? null,
    );

    expect(estimate).not.toBeNull();
    const base = await placeholderManifestBytes(sizes);
    expect(estimate).toBe(
      base.bytes -
        2 * ESTIMATE_PHOTO_PLACEHOLDER.length +
        Math.ceil((400_000 * 4) / 3) +
        Math.ceil((50_000 * 4) / 3),
    );
    expect(estimate).toBeGreaterThan(Math.ceil((400_000 * 4) / 3));
  });

  it("skips a missing contact photo as the exporter does", async () => {
    await seedContactPhoto("avatars/contact-gone.jpg");
    const estimate = await estimateCurrentBackupBytes(exec, () => null);
    const base = await placeholderManifestBytes({});
    expect(estimate).toBe(base.bytes);
  });

  it("returns null (logged) without throwing when a saved background's file is missing", async () => {
    await seedBackground("profile-backgrounds/background-one.jpg");
    await expect(
      estimateCurrentBackupBytes(exec, () => null),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "import-photo-budget",
      expect.any(String),
      expect.anything(),
    );
  });
});

describe("isOverPhotoBudget", () => {
  it("adds ~62 KB per incoming photo contact and compares with the encrypted cap", () => {
    expect(PHOTO_CONTACT_BACKUP_BYTES).toBe(62_000);
    const atCap = CAP - 2 * PHOTO_CONTACT_BACKUP_BYTES;
    expect(
      isOverPhotoBudget({
        currentBytes: atCap,
        incomingPhotoContacts: 2,
        encryptionEnabled: true,
      }),
    ).toEqual({ over: false, projectedBytes: CAP });
    expect(
      isOverPhotoBudget({
        currentBytes: atCap + 1,
        incomingPhotoContacts: 2,
        encryptionEnabled: true,
      }),
    ).toEqual({ over: true, projectedBytes: CAP + 1 });
  });

  it("is never over with encryption off (no cap on the plaintext path)", () => {
    expect(
      isOverPhotoBudget({
        currentBytes: CAP * 4,
        incomingPhotoContacts: 10,
        encryptionEnabled: false,
      }).over,
    ).toBe(false);
  });
});

describe("readEncryptionEnabled", () => {
  it("treats a failed read as ON (logged)", async () => {
    await expect(
      readEncryptionEnabled(
        {
          encryptionEnabled: async () => {
            throw new Error("db");
          },
        },
        exec,
      ),
    ).resolves.toBe(true);
    expect(warn).toHaveBeenCalled();
  });
});

const base: PickedContact = {
  lookupKey: "k",
  displayName: "Ada",
  methods: [],
  birthday: null,
  photoTempUri: null,
};

describe("applyPhotoBudgetChoice (D-133; c1 C-3; c2 B-9)", () => {
  const full = "file:///cache/contact-picker-full.photo";
  const thumb = "file:///cache/contact-picker-thumb.photo";

  it("continue leaves every contact unchanged and discards nothing", async () => {
    const picked = [{ ...base, photoTempUri: full, thumbnailTempUri: thumb }];
    const downscale = vi.fn();
    const result = await applyPhotoBudgetChoice(picked, "continue", {
      downscale,
      readWidth: vi.fn(),
    });
    expect(result).toEqual({ contacts: picked, discard: [] });
    expect(downscale).not.toHaveBeenCalled();
  });

  it("without drops every photo and returns both copies for discard", async () => {
    const result = await applyPhotoBudgetChoice(
      [
        { ...base, photoTempUri: full, thumbnailTempUri: thumb },
        { ...base, lookupKey: "none" },
      ],
      "without",
      { downscale: vi.fn(), readWidth: vi.fn() },
    );
    expect(
      result.contacts.map((c) => [c.photoTempUri, c.thumbnailTempUri]),
    ).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(result.discard).toEqual([full, thumb]);
  });

  it("smaller uses the thumbnail copy and discards the full-size copy", async () => {
    const result = await applyPhotoBudgetChoice(
      [{ ...base, photoTempUri: full, thumbnailTempUri: thumb }],
      "smaller",
      { downscale: vi.fn(), readWidth: vi.fn() },
    );
    expect(result.contacts[0]).toMatchObject({
      photoTempUri: thumb,
      thumbnailTempUri: null,
    });
    expect(result.discard).toEqual([full]);
  });

  it("smaller downscales a full-size-only photo to SMALLER_IMPORT_PHOTO_EDGE", async () => {
    const downscale = vi.fn(
      async () => "file:///cache/ImageManipulator/small.jpg",
    );
    const result = await applyPhotoBudgetChoice(
      [{ ...base, photoTempUri: full, thumbnailTempUri: null }],
      "smaller",
      { downscale, readWidth: async () => 1024 },
    );
    expect(downscale).toHaveBeenCalledWith(full, SMALLER_IMPORT_PHOTO_EDGE);
    expect(result.contacts[0].photoTempUri).toBe(
      "file:///cache/ImageManipulator/small.jpg",
    );
    expect(result.discard).toEqual([full]);
  });

  it("smaller treats an unreadable width as wider and downscales", async () => {
    const downscale = vi.fn(async () => "file:///cache/ImageManipulator/s.jpg");
    await applyPhotoBudgetChoice([{ ...base, photoTempUri: full }], "smaller", {
      downscale,
      readWidth: async () => null,
    });
    expect(downscale).toHaveBeenCalledOnce();
  });

  it("smaller drops the photo (never keeps full size) when the downscale fails", async () => {
    const result = await applyPhotoBudgetChoice(
      [{ ...base, photoTempUri: full, thumbnailTempUri: null }],
      "smaller",
      {
        downscale: async () => {
          throw new Error("decode");
        },
        readWidth: async () => 2048,
      },
    );
    expect(result.contacts[0].photoTempUri).toBeNull();
    expect(result.discard).toEqual([full]);
    expect(warn).toHaveBeenCalled();
  });

  it("smaller keeps a thumbnail-only photo already no wider than the edge, without discarding it (B-9)", async () => {
    const downscale = vi.fn();
    const result = await applyPhotoBudgetChoice(
      [{ ...base, photoTempUri: thumb, thumbnailTempUri: null }],
      "smaller",
      { downscale, readWidth: async () => SMALLER_IMPORT_PHOTO_EDGE },
    );
    expect(downscale).not.toHaveBeenCalled();
    expect(result.contacts[0].photoTempUri).toBe(thumb);
    expect(result.discard).not.toContain(thumb);
    expect(result.discard).toEqual([]);
  });
});

describe("photoBudgetBody", () => {
  it("shows the projected MB and the 8 MB cap from the profile", () => {
    expect(photoBudgetBody({ projectedBytes: 9.25 * 1024 * 1024 })).toBe(
      "Importing these photos would make your backup about 9.3 MB. Backups can't be bigger than 8 MB.",
    );
  });

  it("has an unknown-size variant for a null estimate (c4 E-1)", () => {
    expect(photoBudgetBody(null)).toBe(
      "Orbit couldn't check whether these photos fit in your backups. Backups can't be bigger than 8 MB.",
    );
  });
});
