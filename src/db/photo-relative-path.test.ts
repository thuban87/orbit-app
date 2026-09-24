import { describe, expect, it } from "vitest";
import {
  assertSafeRelative,
  assertSafeRestorePendingRelative,
  contactPhotoRelPath,
  customFieldPhotoRelPath,
  profilePhotoRelPath,
  restorePendingRelPath,
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
