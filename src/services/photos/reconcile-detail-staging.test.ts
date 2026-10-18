import { describe, expect, it, vi } from "vitest";
import { reconcileStagingRelPath } from "@/services/photos/photo-storage";
import {
  createDetailStagingTracker,
  detailStagingToken,
  gridStagingToken,
} from "@/services/photos/reconcile-detail-staging";

vi.mock("expo-file-system", () => ({
  Directory: class {},
  File: class {},
  Paths: {},
}));

describe("reconcile detail staging (38.12-19 fold of 38.12-10 deferred item 1)", () => {
  it("the detail stages under its own names, never a grid card's file", () => {
    const detail = detailStagingToken(4, 9);
    const grid = gridStagingToken(4, 9);
    expect(detail).not.toBe(grid);
    expect(reconcileStagingRelPath(detail)).not.toBe(
      reconcileStagingRelPath(grid),
    );
    // Both stay inside the safe reconcile-staging name space.
    expect(reconcileStagingRelPath(detail)).toBe(
      "reconcile-staging/reconcile-detail-contact-4-link-9.jpg",
    );
  });

  it("closing deletes every copy the detail staged but did not promote", () => {
    const deleted: string[] = [];
    const tracker = createDetailStagingTracker((relative) =>
      deleted.push(relative),
    );
    tracker.track("reconcile-staging/reconcile-detail-contact-1-link-1.jpg");
    tracker.track("reconcile-staging/reconcile-detail-contact-1-link-2.jpg");
    // The promoted copy is deleted by the promote path, then released.
    tracker.release("reconcile-staging/reconcile-detail-contact-1-link-1.jpg");
    tracker.clear();
    expect(deleted).toEqual([
      "reconcile-staging/reconcile-detail-contact-1-link-2.jpg",
    ]);
    // A second close deletes nothing more.
    tracker.clear();
    expect(deleted).toHaveLength(1);
  });

  it("one failed delete does not stop the others", () => {
    const deleted: string[] = [];
    const tracker = createDetailStagingTracker((relative) => {
      if (relative.endsWith("a.jpg")) throw new Error("io");
      deleted.push(relative);
    });
    tracker.track("reconcile-staging/a.jpg");
    tracker.track("reconcile-staging/b.jpg");
    tracker.clear();
    expect(deleted).toEqual(["reconcile-staging/b.jpg"]);
  });
});
