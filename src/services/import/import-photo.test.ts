import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/db/types";

vi.mock("expo-image-manipulator", () => ({
  ImageManipulator: {},
  SaveFormat: { JPEG: "jpeg" },
}));
vi.mock("@/db/contacts-dao", () => ({ setContactPhoto: vi.fn() }));
vi.mock("@/db/import-session-dao", () => ({
  retireRowStagedPhoto: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/photos/photo-storage", () => ({
  contactPhotoRelPath: (contactId: number) =>
    `avatars/contact-${contactId}.jpg`,
  deleteImportStaging: vi.fn(),
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
import { retireRowStagedPhoto } from "@/db/import-session-dao";

const NOW = "2026-08-29 12:00:00";

beforeEach(() => {
  vi.clearAllMocks();
});

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
    deleteImportStaging: vi.fn(),
    ...overrides,
  };
}

describe("persistImportedPhotoPostCommit", () => {
  it("persists a stable 512px master and records the contact photo", async () => {
    const fs = createFs();

    await expect(
      persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
        contactId: 42,
        rowId: 7,
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
    expect(retireRowStagedPhoto).toHaveBeenCalledWith(
      expect.anything(),
      7,
      NOW,
    );
    expect(fs.deleteImportStaging).toHaveBeenCalledWith(
      "import-staging/import-session-row.jpg",
    );
  });

  it("photo failure returns ok:false and does not throw", async () => {
    const fs = createFs({
      resizeToMaster: vi.fn().mockRejectedValue(new Error("decode failed")),
    });

    await expect(
      persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
        contactId: 42,
        rowId: 7,
        stagedPhotoPath: "import-staging/import-session-row.jpg",
        now: NOW,
      }),
    ).resolves.toEqual({ ok: false });
    expect(fs.persistMaster).not.toHaveBeenCalled();
    expect(fs.setContactPhoto).not.toHaveBeenCalled();
    expect(retireRowStagedPhoto).not.toHaveBeenCalled();
    expect(fs.deleteImportStaging).not.toHaveBeenCalled();
  });

  it("preserves staging when recording the master photo fails", async () => {
    const fs = createFs({
      setContactPhoto: vi.fn().mockRejectedValue(new Error("database failed")),
    });

    await expect(
      persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
        contactId: 42,
        rowId: 7,
        stagedPhotoPath: "import-staging/import-session-row.jpg",
        now: NOW,
      }),
    ).resolves.toEqual({ ok: false });

    expect(fs.persistMaster).toHaveBeenCalled();
    expect(retireRowStagedPhoto).not.toHaveBeenCalled();
    expect(fs.deleteImportStaging).not.toHaveBeenCalled();
  });

  it("null staged photo is a skipped no-op", async () => {
    const fs = createFs();

    await expect(
      persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
        contactId: 42,
        rowId: 7,
        stagedPhotoPath: null,
        now: NOW,
      }),
    ).resolves.toEqual({ ok: true, skipped: true });
    expect(fs.resizeToMaster).not.toHaveBeenCalled();
    expect(fs.persistMaster).not.toHaveBeenCalled();
    expect(fs.setContactPhoto).not.toHaveBeenCalled();
    expect(retireRowStagedPhoto).not.toHaveBeenCalled();
    expect(fs.deleteImportStaging).not.toHaveBeenCalled();
  });

  it("empty staged photo is a skipped no-op", async () => {
    const fs = createFs();

    await expect(
      persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
        contactId: 42,
        rowId: 7,
        stagedPhotoPath: "",
        now: NOW,
      }),
    ).resolves.toEqual({ ok: true, skipped: true });
    expect(retireRowStagedPhoto).not.toHaveBeenCalled();
    expect(fs.deleteImportStaging).not.toHaveBeenCalled();
  });
});
