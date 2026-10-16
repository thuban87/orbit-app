/**
 * promoteCreatePhoto (38.11 D-77): the held Add Contact photo becomes the new
 * contact's photo after the create commits, through the owned persist; any
 * failure keeps the contact (returns { ok: false }, never throws) and the held
 * staging file is always deleted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/db/types";

vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn() },
}));

import {
  type CreatePhotoFs,
  newCreateStagingToken,
  promoteCreatePhoto,
} from "@/services/photos/create-photo";

const EXEC = { marker: "db" } as unknown as SqlExecutor;
const STAGED = "create-staging/create-session-pick.jpg";
const NOW = "2026-10-16 09:00:00";

function makeFs(overrides: Partial<CreatePhotoFs> = {}) {
  const calls: string[] = [];
  const fs: CreatePhotoFs = {
    resolveStagedUri: vi.fn((relative: string) => {
      calls.push(`resolve ${relative}`);
      return `file:///doc/${relative}`;
    }),
    persistOwnedMaster: vi.fn(
      async (_exec, srcUri: string, canonical: string, opts) => {
        calls.push(`persist ${srcUri} -> ${canonical}`);
        if (opts.authorize && !(await opts.authorize(EXEC)))
          throw new Error("photo target changed");
        return canonical;
      },
    ),
    getContactPhotoIdentity: vi.fn(async () => "uid-42"),
    setContactPhotoForUid: vi.fn(async (_exec, id, uid, relative) => {
      calls.push(`set ${id} ${uid} ${relative}`);
    }),
    notifyWidgetDataChanged: vi.fn(() => {
      calls.push("notify");
    }),
    deleteCreateStaging: vi.fn((relative: string) => {
      calls.push(`delete ${relative}`);
    }),
    ...overrides,
  };
  return { fs, calls };
}

const params = {
  exec: EXEC,
  contactId: 42,
  contactUid: "uid-42",
  stagedRelative: STAGED,
  now: NOW,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("promoteCreatePhoto (38.11 D-77)", () => {
  it("persists to avatars/contact-<id>.jpg, sets the photo, notifies, then deletes the held file", async () => {
    const { fs, calls } = makeFs();
    await expect(promoteCreatePhoto(params, fs)).resolves.toEqual({
      ok: true,
    });
    expect(calls).toEqual([
      `resolve ${STAGED}`,
      `persist file:///doc/${STAGED} -> avatars/contact-42.jpg`,
      "set 42 uid-42 avatars/contact-42.jpg",
      "notify",
      `delete ${STAGED}`,
    ]);
    expect(fs.setContactPhotoForUid).toHaveBeenCalledWith(
      EXEC,
      42,
      "uid-42",
      "avatars/contact-42.jpg",
      NOW,
    );
  });

  it("a persist failure returns { ok: false }, never sets the photo, and still deletes the held file", async () => {
    const { fs, calls } = makeFs({
      persistOwnedMaster: vi.fn(async () => {
        throw new Error("disk full");
      }),
    });
    await expect(promoteCreatePhoto(params, fs)).resolves.toEqual({
      ok: false,
    });
    expect(fs.setContactPhotoForUid).not.toHaveBeenCalled();
    expect(fs.notifyWidgetDataChanged).not.toHaveBeenCalled();
    expect(calls.at(-1)).toBe(`delete ${STAGED}`);
  });

  it("refuses the write when the id no longer belongs to the created contact", async () => {
    const { fs } = makeFs({
      getContactPhotoIdentity: vi.fn(async () => "someone-else"),
    });
    await expect(promoteCreatePhoto(params, fs)).resolves.toEqual({
      ok: false,
    });
    expect(fs.setContactPhotoForUid).not.toHaveBeenCalled();
    expect(fs.deleteCreateStaging).toHaveBeenCalledWith(STAGED);
  });

  it("a DB-write failure returns { ok: false } and still deletes the held file", async () => {
    const { fs } = makeFs({
      setContactPhotoForUid: vi.fn(async () => {
        throw new Error("contact photo target changed");
      }),
    });
    await expect(promoteCreatePhoto(params, fs)).resolves.toEqual({
      ok: false,
    });
    expect(fs.persistOwnedMaster).toHaveBeenCalledTimes(1);
    expect(fs.notifyWidgetDataChanged).not.toHaveBeenCalled();
    expect(fs.deleteCreateStaging).toHaveBeenCalledWith(STAGED);
  });

  it("an unsafe staged path or a failing cleanup never throws", async () => {
    const { fs } = makeFs({
      resolveStagedUri: vi.fn(() => {
        throw new Error("unsafe create staging photo path");
      }),
      deleteCreateStaging: vi.fn(() => {
        throw new Error("unsafe create staging photo path");
      }),
    });
    await expect(promoteCreatePhoto(params, fs)).resolves.toEqual({
      ok: false,
    });
    expect(fs.persistOwnedMaster).not.toHaveBeenCalled();
  });

  it("a widget refresh failure after the photo is stored still reports success", async () => {
    const { fs } = makeFs({
      notifyWidgetDataChanged: vi.fn(() => {
        throw new Error("widget");
      }),
    });
    await expect(promoteCreatePhoto(params, fs)).resolves.toEqual({
      ok: true,
    });
    expect(fs.deleteCreateStaging).toHaveBeenCalledWith(STAGED);
  });
});

describe("newCreateStagingToken", () => {
  it("is file-name safe and fresh per call", () => {
    const a = newCreateStagingToken();
    const b = newCreateStagingToken();
    expect(a).toMatch(/^[A-Za-z0-9]+$/);
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(a).not.toBe(b);
  });
});
