import { describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/db/types";

vi.mock("expo-image-manipulator", () => ({
  ImageManipulator: {},
  SaveFormat: { JPEG: "jpeg" },
}));
vi.mock("@/db/contacts-dao", () => ({ setContactPhoto: vi.fn() }));
vi.mock("@/services/photos/photo-storage", () => ({
  contactPhotoRelPath: (contactId: number) =>
    `avatars/contact-${contactId}.jpg`,
  persistMaster: vi.fn(),
  resolveImportStagingUri: (relative: string) =>
    `file:///documents/${relative}`,
}));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn() },
}));

import {
  type ImportedPhotoFs,
  persistImportedPhotoPostCommit,
} from "@/services/import/import-photo";

const NOW = "2026-08-29 12:00:00";

function createFs(overrides: Partial<ImportedPhotoFs> = {}): ImportedPhotoFs {
  return {
    resolveStagedPhotoPath: vi.fn(
      (relative: string) => `file:///documents/${relative}`,
    ),
    contactPhotoRelPath: vi.fn(
      (contactId: number) => `avatars/contact-${contactId}.jpg`,
    ),
    resizeToMaster: vi.fn().mockResolvedValue("file:///cache/master.jpg"),
    persistMaster: vi.fn().mockResolvedValue("avatars/contact-42.jpg"),
    setContactPhoto: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("persistImportedPhotoPostCommit", () => {
  it("persists a stable 512px master and records the contact photo", async () => {
    const fs = createFs();

    await expect(
      persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
        contactId: 42,
        stagedPhotoPath: "import-staging/import-session-row.jpg",
        now: NOW,
      }),
    ).resolves.toEqual({ ok: true });

    expect(fs.resizeToMaster).toHaveBeenCalledWith(
      "file:///documents/import-staging/import-session-row.jpg",
    );
    expect(fs.persistMaster).toHaveBeenCalledWith(
      "file:///cache/master.jpg",
      "avatars/contact-42.jpg",
    );
    expect(fs.setContactPhoto).toHaveBeenCalledWith(
      expect.anything(),
      42,
      "avatars/contact-42.jpg",
      NOW,
    );
  });

  it("photo failure returns ok:false and does not throw", async () => {
    const fs = createFs({
      resizeToMaster: vi.fn().mockRejectedValue(new Error("decode failed")),
    });

    await expect(
      persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
        contactId: 42,
        stagedPhotoPath: "import-staging/import-session-row.jpg",
        now: NOW,
      }),
    ).resolves.toEqual({ ok: false });
    expect(fs.persistMaster).not.toHaveBeenCalled();
    expect(fs.setContactPhoto).not.toHaveBeenCalled();
  });

  it("null staged photo is a skipped no-op", async () => {
    const fs = createFs();

    await expect(
      persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
        contactId: 42,
        stagedPhotoPath: null,
        now: NOW,
      }),
    ).resolves.toEqual({ ok: true, skipped: true });
    expect(fs.resizeToMaster).not.toHaveBeenCalled();
    expect(fs.persistMaster).not.toHaveBeenCalled();
    expect(fs.setContactPhoto).not.toHaveBeenCalled();
  });
});
