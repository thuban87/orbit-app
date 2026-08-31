import { describe, expect, it, vi } from "vitest";
vi.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: { JPEG: "jpeg" } }));
vi.mock("@/services/photos/photo-storage", () => ({
  contactPhotoRelPath: (contactId: number) => `avatars/contact-${contactId}.jpg`,
  reconcileStagingRelPath: (token: string) => `reconcile-staging/reconcile-${token}.jpg`,
  resolveReconcileStagingUri: (relative: string) => `file:///documents/${relative}`,
  stageReconcilePhoto: vi.fn(),
  persistMaster: vi.fn(),
}));
import { assertSafeRelative } from "@/db/photo-relative-path";
import {
  promoteReconcilePhoto,
  stageReconcileSourcePhoto,
  type ReconcilePhotoFs,
} from "@/services/photos/reconcile-photo";

function fs(): ReconcilePhotoFs & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    stage: async (_cacheUri, relative) => { calls.push(`stage:${relative}`); },
    resolveStaged: (relative) => `file:///documents/${relative}`,
    readBytes: async () => new TextEncoder().encode("source photo bytes"),
    resizeToMaster: async (uri) => { calls.push(`resize:${uri}`); return "file:///cache/resized.jpg"; },
    persistMaster: async (uri, relative) => { calls.push(`persist:${uri}:${relative}`); return relative; },
    contactPhotoRelPath: (contactId) => `avatars/contact-${contactId}.jpg`,
  };
}

describe("reconcile photo staging", () => {
  it("stages cache input durably and hashes the staged bytes deterministically", async () => {
    const boundary = fs();
    const one = await stageReconcileSourcePhoto("file:///cache/picker.jpg", "link-1", boundary);
    const two = await stageReconcileSourcePhoto("file:///cache/picker.jpg", "link-2", boundary);
    expect(one.stagedRelative).toBe("reconcile-staging/reconcile-link-1.jpg");
    expect(one.contentHash).toBe(two.contentHash);
    expect(boundary.calls).toContain("stage:reconcile-staging/reconcile-link-1.jpg");
  });

  it("promotes only to the durable canonical avatars namespace", async () => {
    const boundary = fs();
    const relative = await promoteReconcilePhoto(boundary, { contactId: 42, stagedRelative: "reconcile-staging/reconcile-link-1.jpg" });
    expect(relative).toBe("avatars/contact-42.jpg");
    expect(() => assertSafeRelative(relative)).not.toThrow();
    expect(boundary.calls).toEqual([
      "resize:file:///documents/reconcile-staging/reconcile-link-1.jpg",
      "persist:file:///cache/resized.jpg:avatars/contact-42.jpg",
    ]);
  });
});
