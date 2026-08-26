import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  entries: [] as Array<Record<string, unknown>>,
  pending: [] as Array<{ relative: string; isStageTmpOrphan: boolean }>,
  deletedPending: [] as string[],
  deletedJournal: [] as string[],
  persisted: [] as Array<[string, string]>,
  persistThrows: false,
  deletedPhoto: [] as string[],
  existingCanonical: new Set<string>(),
  deleteLeavesCanonical: false,
  rows: new Map<string, unknown>(),
}));

vi.mock("@/db/restore-photo-journal-dao", () => ({
  listJournalEntriesCore: async () => h.entries,
  deleteJournalEntryCore: async (_exec: unknown, path: string) => { h.deletedJournal.push(path); },
}));
vi.mock("@/services/photos/photo-storage", () => ({
  listRestorePendingPhotos: () => h.pending,
  deleteRestorePending: (path: string) => { h.deletedPending.push(path); },
  resolveRestorePendingUri: (path: string) => `file:///doc/${path}`,
  persistMaster: async (source: string, destination: string) => {
    h.persisted.push([source, destination]);
    if (h.persistThrows) throw new Error("disk unavailable");
  },
  deletePhoto: (path: string) => { h.deletedPhoto.push(path); if (!h.deleteLeavesCanonical) h.existingCanonical.delete(path); },
  photoFileExists: (path: string) => h.existingCanonical.has(path),
}));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

import { drainRestorePhotoJournal } from "@/services/photos/restore-photo-finalize-sweep";

const finalize = (overrides: Record<string, unknown> = {}) => ({
  relativePath: "avatars/_restore_pending/contact-a-s.jpg",
  action: "finalize",
  targetKind: "contact",
  contactUid: "contact-a",
  valueUid: null,
  fieldDefUid: null,
  canonicalRelativePath: "avatars/contact-1.jpg",
  createdAt: "2026-08-25 12:00:00",
  ...overrides,
});

beforeEach(() => {
  h.entries = [];
  h.pending = [];
  h.deletedPending = [];
  h.deletedJournal = [];
  h.persisted = [];
  h.persistThrows = false;
  h.deletedPhoto = [];
  h.existingCanonical = new Set();
  h.deleteLeavesCanonical = false;
  h.rows = new Map();
});

function exec() {
  return {
    getFirstAsync: async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM contacts")) return h.rows.get(`contact:${params?.[0]}`) ?? null;
      if (sql.includes("FROM custom_field_values")) return h.rows.get(`value:${params?.[0]}:${params?.[1]}`) ?? null;
      return null;
    },
  } as never;
}

describe("restore photo finalization sweep", () => {
  it("finalizes a committed live contact entry then removes both recovery artifacts", async () => {
    h.entries = [finalize()];
    h.pending = [{ relative: "avatars/_restore_pending/contact-a-s.jpg", isStageTmpOrphan: false }];
    h.rows.set("contact:contact-a", { id: 1 });
    await drainRestorePhotoJournal(exec());
    expect(h.persisted).toEqual([["file:///doc/avatars/_restore_pending/contact-a-s.jpg", "avatars/contact-1.jpg"]]);
    expect(h.deletedPending).toEqual(["avatars/_restore_pending/contact-a-s.jpg"]);
    expect(h.deletedJournal).toEqual(["avatars/_restore_pending/contact-a-s.jpg"]);
  });

  it("cleans an already-finalized row without retrying persistMaster when its staged source is gone", async () => {
    h.entries = [finalize()];
    h.rows.set("contact:contact-a", { id: 1 });
    await drainRestorePhotoJournal(exec());
    expect(h.persisted).toEqual([]);
    expect(h.deletedJournal).toEqual(["avatars/_restore_pending/contact-a-s.jpg"]);
  });

  it("garbage-collects an unlive target without applying its staged bytes", async () => {
    h.entries = [finalize({ valueUid: "value-a", targetKind: "customField" })];
    h.pending = [{ relative: "avatars/_restore_pending/contact-a-s.jpg", isStageTmpOrphan: false }];
    await drainRestorePhotoJournal(exec());
    expect(h.persisted).toEqual([]);
    expect(h.deletedPending).toEqual(["avatars/_restore_pending/contact-a-s.jpg"]);
    expect(h.deletedJournal).toEqual(["avatars/_restore_pending/contact-a-s.jpg"]);
  });

  it("keeps a delete row when deletePhoto returns but the canonical file still exists", async () => {
    const entry = finalize({ relativePath: "avatars/_restore_pending/delete-a.jpg", action: "delete" });
    h.entries = [entry];
    h.existingCanonical.add("avatars/contact-1.jpg");
    // Simulate the real deletePhoto contract failing internally: it returns normally.
    h.deleteLeavesCanonical = true;
    await drainRestorePhotoJournal(exec());
    expect(h.deletedPhoto).toEqual(["avatars/contact-1.jpg"]);
    expect(h.deletedJournal).toEqual([]);
  });

  it("keeps a committed finalize entry for retry when persistMaster fails", async () => {
    h.entries = [finalize()];
    h.pending = [{ relative: "avatars/_restore_pending/contact-a-s.jpg", isStageTmpOrphan: false }];
    h.rows.set("contact:contact-a", { id: 1 });
    h.persistThrows = true;
    await drainRestorePhotoJournal(exec());
    expect(h.persisted).toHaveLength(1);
    expect(h.deletedPending).toEqual([]);
    expect(h.deletedJournal).toEqual([]);
  });

  it("deletes unjournaled ready files and incomplete stage-tmp files without finalizing either", async () => {
    h.pending = [
      { relative: "avatars/_restore_pending/rolled-back.jpg", isStageTmpOrphan: false },
      { relative: "avatars/_restore_pending/partial.jpg.stage-tmp", isStageTmpOrphan: true },
    ];
    await drainRestorePhotoJournal(exec());
    expect(h.deletedPending).toEqual([
      "avatars/_restore_pending/rolled-back.jpg",
      "avatars/_restore_pending/partial.jpg.stage-tmp",
    ]);
    expect(h.persisted).toEqual([]);
  });
});
