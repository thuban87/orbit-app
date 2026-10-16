import { describe, expect, it } from "vitest";
import {
  assertSafeCreateStagingRelative,
  assertSafeRelative,
  assertSafeRestorePendingRelative,
  contactPhotoRelPath,
  customFieldPhotoRelPath,
  profilePhotoRelPath,
  restorePendingRelPath,
  SAFE_CREATE_STAGING_RELATIVE,
} from "@/db/photo-relative-path";

describe("restore pending photo paths", () => {
  it("keeps ADR-021 canonical filenames byte-identical", () => {
    expect(contactPhotoRelPath(42)).toBe("avatars/contact-42.jpg");
    expect(customFieldPhotoRelPath(42, "pet_photo")).toBe(
      "avatars/cv-42-pet_photo.jpg",
    );
    expect(profilePhotoRelPath()).toBe("avatars/profile.jpg");
    expect(
      restorePendingRelPath({ kind: "contact", uid: "uid" }, "session"),
    ).toBe("avatars/_restore_pending/contact-uid-session.jpg");
  });
  it("keeps the canonical grammar closed while allowing only the recovery namespace", () => {
    const pending = "avatars/_restore_pending/contact-uid-session.jpg";
    expect(() => assertSafeRelative(pending)).toThrow();
    expect(() => assertSafeRestorePendingRelative(pending)).not.toThrow();
    expect(() =>
      assertSafeRestorePendingRelative(`${pending}.stage-tmp`),
    ).not.toThrow();
  });

  it("rejects traversal, absolute paths, and NUL bytes from both boundaries", () => {
    for (const value of [
      "/avatars/x.jpg",
      "avatars/_restore_pending/../x.jpg",
      "avatars/_restore_pending/x.jpg\0tail",
    ]) {
      expect(() => assertSafeRelative(value)).toThrow();
      expect(() => assertSafeRestorePendingRelative(value)).toThrow();
    }
  });
});

describe("Add Contact held-photo staging paths (38.11 D-77)", () => {
  const held = "create-staging/create-session1-pick2.jpg";

  it("accepts a flat create-<session>-<pick>.jpg and its .stage-tmp", () => {
    expect(SAFE_CREATE_STAGING_RELATIVE.test(held)).toBe(true);
    expect(() => assertSafeCreateStagingRelative(held)).not.toThrow();
    expect(() =>
      assertSafeCreateStagingRelative(`${held}.stage-tmp`),
    ).not.toThrow();
    expect(() =>
      assertSafeCreateStagingRelative("create-staging/create-a_b-C-9.jpg"),
    ).not.toThrow();
  });

  it("is never a canonical photo path", () => {
    expect(() => assertSafeRelative(held)).toThrow();
  });

  it("rejects traversal, nested folders, other namespaces and other extensions", () => {
    for (const value of [
      "create-staging/../avatars/contact-1.jpg",
      "create-staging/create-..-x.jpg",
      "create-staging/sub/create-a-b.jpg",
      "/create-staging/create-a-b.jpg",
      "create-staging/import-a-b.jpg",
      "create-staging/a-b.jpg",
      "reconcile-staging/create-a-b.jpg",
      "import-staging/create-a-b.jpg",
      "avatars/create-a-b.jpg",
      "create-staging/create-a-b.png",
      "create-staging/create-a-b.webp",
      "create-staging/create-a-b.jpg.tmp",
      "create-staging/create-a-b.jpg\0tail",
      "create-staging\\create-a-b.jpg",
      "",
    ]) {
      expect(() => assertSafeCreateStagingRelative(value), value).toThrow();
    }
  });
});
