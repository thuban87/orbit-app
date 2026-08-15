/**
 * Unit tests for the custom photo-field pure logic + the transient result store
 * (PHOTO-01 custom-field reuse).
 *
 * Proves the two correctness rules the widget relies on — the field value equals
 * the derivable `cv-` relPath, and the widget is EDIT-ONLY — plus the
 * `photo-result-store` contract the crop-success channel + orphan-cleanup ledger
 * depend on: publish/consume matches only on requestId, and the staged ledger
 * drains exactly once.
 *
 * `photo-field-logic` imports `photo-storage`, whose top-level `expo-file-system`
 * import cannot load in the node env; the pure filename builder needs none of it,
 * so the native module is stubbed empty (the same isolation photo-storage.test
 * uses, minus the FS model this file never exercises).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-file-system", () => ({}));

import {
  customFieldValueForTarget,
  isPhotoWidgetEnabled,
} from "@/components/field-widgets/photo-field-logic";
import {
  consumeCropResult,
  markPhotoStaged,
  publishCropResult,
  takeStagedPhotos,
} from "@/stores/photo-result-store";

describe("customFieldValueForTarget", () => {
  it("returns the derivable cv- relPath the pipeline writes the master to", () => {
    expect(customFieldValueForTarget(42, "pet_photo")).toBe(
      "avatars/cv-42-pet_photo.jpg",
    );
  });

  it("inherits the path builder guards (bad contactId / col_name throw)", () => {
    expect(() => customFieldValueForTarget(0, "pet_photo")).toThrow();
    expect(() => customFieldValueForTarget(-1, "pet_photo")).toThrow();
    expect(() => customFieldValueForTarget(1.5, "pet_photo")).toThrow();
    expect(() => customFieldValueForTarget(42, "Pet Photo")).toThrow();
  });
});

describe("isPhotoWidgetEnabled", () => {
  it("is true only for a defined numeric contactId (edit form)", () => {
    expect(isPhotoWidgetEnabled(42)).toBe(true);
    expect(isPhotoWidgetEnabled(1)).toBe(true);
  });

  it("is false for undefined / null (create form / def preview)", () => {
    expect(isPhotoWidgetEnabled(undefined)).toBe(false);
    expect(isPhotoWidgetEnabled(null)).toBe(false);
  });
});

describe("photo-result-store crop-success channel", () => {
  beforeEach(() => {
    // Drain any residual state so tests don't bleed into one another.
    takeStagedPhotos();
    consumeCropResult("avatars/cv-1-any.jpg");
  });

  it("consumes a published result ONLY on a matching requestId", () => {
    const key = "avatars/cv-42-pet_photo.jpg";
    publishCropResult(key, true);

    // A non-matching key leaves the result intact.
    expect(consumeCropResult("avatars/cv-99-other.jpg")).toBeNull();

    // The matching key returns + clears it.
    expect(consumeCropResult(key)).toEqual({ requestId: key, success: true });

    // A second consume of the same key is now empty (consumed once).
    expect(consumeCropResult(key)).toBeNull();
  });
});

describe("photo-result-store staged ledger", () => {
  beforeEach(() => {
    takeStagedPhotos();
  });

  it("records staged cv- paths and drains them exactly once", () => {
    markPhotoStaged("avatars/cv-42-pet_photo.jpg");
    markPhotoStaged("avatars/cv-7-headshot.jpg");

    const drained = takeStagedPhotos();
    expect(drained.sort()).toEqual([
      "avatars/cv-42-pet_photo.jpg",
      "avatars/cv-7-headshot.jpg",
    ]);

    // Drain-once: the ledger is empty after the first take.
    expect(takeStagedPhotos()).toEqual([]);
  });

  it("dedupes a re-crop-in-place of the same staged path", () => {
    markPhotoStaged("avatars/cv-42-pet_photo.jpg");
    markPhotoStaged("avatars/cv-42-pet_photo.jpg");
    expect(takeStagedPhotos()).toEqual(["avatars/cv-42-pet_photo.jpg"]);
  });
});
