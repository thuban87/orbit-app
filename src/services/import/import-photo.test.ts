import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/db/types";

const h = vi.hoisted(() => ({
  encodeMaster: vi.fn(async (_uri: string, _crop?: unknown) => {
    return "file:///cache/ImageManipulator/master.webp";
  }),
}));
vi.mock("expo-image-manipulator", () => ({
  ImageManipulator: {},
  SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
}));
vi.mock("@/services/photos/master-encode", () => ({
  encodeMaster: h.encodeMaster,
}));
vi.mock("@/db/contacts-dao", () => ({ setContactPhoto: vi.fn() }));
vi.mock("@/db/database", () => ({ getExecutor: () => ({ marker: "db" }) }));
vi.mock("@/services/photos/owned-master", () => ({
  persistOwnedMaster: vi.fn().mockResolvedValue("avatars/contact-42.jpg"),
}));
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
vi.mock("@/db/reconcile-snapshot-dao", () => ({
  recordImportedPhotoFingerprint: vi.fn().mockResolvedValue(undefined),
  recordDeclinedPhotoReview: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/services/photos/derivative-cache", () => ({
  discardDerivative: vi.fn(),
}));

import { retireRowStagedPhoto } from "@/db/import-session-dao";
import {
  recordDeclinedPhotoReview,
  recordImportedPhotoFingerprint,
} from "@/db/reconcile-snapshot-dao";
import {
  type ImportedPhotoFs,
  importedPhotoFs,
  persistImportedPhotoPostCommit,
} from "@/services/import/import-photo";
import { retryPhotoFs } from "@/services/import/import-photo-retry";
import { persistOwnedMaster } from "@/services/photos/owned-master";

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
    discardDerivative: vi.fn(() => true),
    ...overrides,
  };
}

describe("persistImportedPhotoPostCommit", () => {
  it("routes the production master boundary through the canonical owner", async () => {
    await importedPhotoFs.persistMaster(
      "file:///cache/master.jpg",
      "avatars/contact-42.jpg",
    );
    expect(persistOwnedMaster).toHaveBeenCalledWith(
      { marker: "db" },
      "file:///cache/master.jpg",
      "avatars/contact-42.jpg",
    );
  });
  it("resizeToMaster delegates to the shared D-10 encoder with no crop", async () => {
    await expect(
      importedPhotoFs.resizeToMaster(
        "file:///documents/import-staging/import-session-row.jpg",
      ),
    ).resolves.toBe("file:///cache/ImageManipulator/master.webp");
    expect(h.encodeMaster).toHaveBeenCalledTimes(1);
    expect(h.encodeMaster.mock.calls[0]).toEqual([
      "file:///documents/import-staging/import-session-row.jpg",
    ]);
  });

  it("import retry inherits the same D-10 master encoder", () => {
    expect(retryPhotoFs.resizeToMaster).toBe(importedPhotoFs.resizeToMaster);
  });

  it("persists the D-10 master under the canonical name and records the contact photo", async () => {
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
    expect(fs.discardDerivative).toHaveBeenCalledWith(
      "file:///cache/master.jpg",
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

  it("records the phone photo fingerprint after a successful persist (D-132)", async () => {
    const fs = createFs();
    const exec = {} as SqlExecutor;
    await expect(
      persistImportedPhotoPostCommit(exec, fs, {
        contactId: 42,
        rowId: 7,
        stagedPhotoPath: "import-staging/a.jpg",
        now: NOW,
      }),
    ).resolves.toEqual({ ok: true });
    expect(recordImportedPhotoFingerprint).toHaveBeenCalledTimes(1);
    expect(recordImportedPhotoFingerprint).toHaveBeenCalledWith(exec, {
      rowId: 7,
      contactId: 42,
      now: NOW,
    });
    expect(
      vi.mocked(fs.setContactPhoto).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(recordImportedPhotoFingerprint).mock.invocationCallOrder[0],
    );
  });

  it("a throwing fingerprint record never fails the photo import", async () => {
    vi.mocked(recordImportedPhotoFingerprint).mockRejectedValueOnce(
      new Error("locked"),
    );
    const fs = createFs();
    await expect(
      persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
        contactId: 42,
        rowId: 7,
        stagedPhotoPath: "import-staging/a.jpg",
        now: NOW,
      }),
    ).resolves.toEqual({ ok: true });
    expect(retireRowStagedPhoto).toHaveBeenCalled();
    expect(fs.deleteImportStaging).toHaveBeenCalledWith("import-staging/a.jpg");
  });

  it("a failed or skipped persist records no fingerprint", async () => {
    for (const fs of [
      createFs({ persistMaster: vi.fn().mockRejectedValue(new Error("p")) }),
      createFs({ setContactPhoto: vi.fn().mockRejectedValue(new Error("db")) }),
    ]) {
      await expect(
        persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
          contactId: 42,
          rowId: 7,
          stagedPhotoPath: "import-staging/a.jpg",
          now: NOW,
        }),
      ).resolves.toEqual({ ok: false });
    }
    await persistImportedPhotoPostCommit({} as SqlExecutor, createFs(), {
      contactId: 42,
      rowId: 7,
      stagedPhotoPath: null,
      now: NOW,
    });
    expect(recordImportedPhotoFingerprint).not.toHaveBeenCalled();
    // D-147: with no photo to adopt, a declined phone photo is remembered
    // (the DAO checks the row's photoDeclined flag).
    expect(recordDeclinedPhotoReview).toHaveBeenCalledWith(
      {},
      { rowId: 7, contactId: 42, now: NOW },
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
    expect(fs.discardDerivative).toHaveBeenCalledWith(
      "file:///cache/master.jpg",
    );
  });

  it("discards after persist failure and keeps photo_failed outcome", async () => {
    const fs = createFs({
      persistMaster: vi.fn().mockRejectedValue(new Error("persist")),
    });
    await expect(
      persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
        contactId: 42,
        rowId: 7,
        stagedPhotoPath: "import-staging/a.jpg",
        now: NOW,
      }),
    ).resolves.toEqual({ ok: false });
    expect(fs.discardDerivative).toHaveBeenCalledWith(
      "file:///cache/master.jpg",
    );
  });

  it("reports a successful save despite a failed discard", async () => {
    const fs = createFs({
      discardDerivative: vi.fn(() => {
        throw new Error("delete");
      }),
    });
    await expect(
      persistImportedPhotoPostCommit({} as SqlExecutor, fs, {
        contactId: 42,
        rowId: 7,
        stagedPhotoPath: "import-staging/a.jpg",
        now: NOW,
      }),
    ).resolves.toEqual({ ok: true });
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
