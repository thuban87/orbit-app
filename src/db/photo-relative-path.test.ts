import { describe, expect, it } from "vitest";
import {
  assertSafeRelative,
  assertSafeRestorePendingRelative,
} from "@/db/photo-relative-path";

describe("restore pending photo paths", () => {
  it("keeps the canonical grammar closed while allowing only the recovery namespace", () => {
    const pending = "avatars/_restore_pending/contact-uid-session.jpg";
    expect(() => assertSafeRelative(pending)).toThrow();
    expect(() => assertSafeRestorePendingRelative(pending)).not.toThrow();
    expect(() => assertSafeRestorePendingRelative(`${pending}.stage-tmp`)).not.toThrow();
  });

  it("rejects traversal, absolute paths, and NUL bytes from both boundaries", () => {
    for (const value of ["/avatars/x.jpg", "avatars/_restore_pending/../x.jpg", "avatars/_restore_pending/x.jpg\0tail"]) {
      expect(() => assertSafeRelative(value)).toThrow();
      expect(() => assertSafeRestorePendingRelative(value)).toThrow();
    }
  });
});
