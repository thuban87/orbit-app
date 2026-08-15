/**
 * photo-storage — node-side proof of the PURE surface + the crash-safe persist
 * failure paths (PHOTO-03).
 *
 * The FS-touching functions (`persistMaster`, `deletePhoto`, `reconcilePhotoWrites`)
 * are the only `expo-file-system` users, so the whole native module is replaced by
 * a faithful in-memory mock (`vi.mock`) driven through `vi.hoisted` shared state.
 * The mock records every copy/move/delete op and models an evictable filesystem as
 * a `Set` of URIs — enough to prove the copy-to-`.tmp` → `.bak`-swap NEVER
 * pre-deletes the prior master, on both a copy throw and a tmp→dest move throw.
 *
 * The pure functions (filename builders, `relPathForTarget`,
 * `resolvePhotoUriFromDocumentUri`, `reconcilePhotoDir`) need no FS at all — they
 * are exercised directly. `assertSafeRelative` is proven through its public
 * entry points (`resolvePhotoUriFromDocumentUri` / `deletePhoto`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared, hoisted mock state — a toy filesystem + an op log + throw switches.
const h = vi.hoisted(() => ({
  cfg: {} as { copyThrows?: boolean; moveTmpToDestThrows?: boolean },
  ops: [] as string[],
  exists: new Set<string>(),
}));

vi.mock("expo-file-system", () => {
  const joinUri = (parts: unknown[]): string =>
    parts
      .map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri))
      .map((s, i) =>
        i === 0
          ? s.replace(/\/+$/, "")
          : s.replace(/^\/+/, "").replace(/\/+$/, ""),
      )
      .join("/");

  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = joinUri(parts);
    }
    get exists(): boolean {
      return h.exists.has(this.uri);
    }
    async copy(dest: File): Promise<void> {
      h.ops.push(`copy ${this.uri} -> ${dest.uri}`);
      if (h.cfg.copyThrows) throw new Error("mock copy failed");
      h.exists.add(dest.uri);
    }
    async move(dest: File): Promise<void> {
      const tmpToDest = this.uri.endsWith(".tmp") && dest.uri.endsWith(".jpg");
      h.ops.push(`move ${this.uri} -> ${dest.uri}`);
      if (tmpToDest && h.cfg.moveTmpToDestThrows) {
        throw new Error("mock move failed");
      }
      h.exists.delete(this.uri);
      h.exists.add(dest.uri);
      this.uri = dest.uri;
    }
    delete(): void {
      h.ops.push(`delete ${this.uri}`);
      h.exists.delete(this.uri);
    }
  }

  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = joinUri(parts);
    }
    create(): void {}
    get exists(): boolean {
      return true;
    }
    list(): File[] {
      return [];
    }
  }

  const Paths = { document: { uri: "file:///doc" } };
  return { File, Directory, Paths };
});

import {
  contactPhotoRelPath,
  customFieldPhotoRelPath,
  deletePhoto,
  type PhotoTargetDescriptor,
  persistMaster,
  profilePhotoRelPath,
  reconcilePhotoDir,
  relPathForTarget,
  resolvePhotoUriFromDocumentUri,
} from "@/services/photos/photo-storage";

const DEST = "file:///doc/avatars/contact-42.jpg";

beforeEach(() => {
  h.cfg = {};
  h.ops = [];
  h.exists = new Set();
});

describe("filename builders — contactId-derivable, validated by construction", () => {
  it("derives the contact / custom-field / profile relative filenames", () => {
    expect(contactPhotoRelPath(42)).toBe("avatars/contact-42.jpg");
    expect(customFieldPhotoRelPath(42, "pet_photo")).toBe(
      "avatars/cv-42-pet_photo.jpg",
    );
    expect(profilePhotoRelPath()).toBe("avatars/profile.jpg");
  });

  it("throws on a non-positive / non-integer contactId", () => {
    expect(() => contactPhotoRelPath(0)).toThrow();
    expect(() => contactPhotoRelPath(-1)).toThrow();
    expect(() => contactPhotoRelPath(1.5)).toThrow();
    expect(() => customFieldPhotoRelPath(0, "pet_photo")).toThrow();
  });

  it("throws on an isSafeColName-failing colName", () => {
    expect(() => customFieldPhotoRelPath(42, "Pet Photo")).toThrow();
    expect(() => customFieldPhotoRelPath(42, "1bad")).toThrow();
    expect(() => customFieldPhotoRelPath(42, 'x"; DROP TABLE')).toThrow();
  });

  it("relPathForTarget maps every descriptor kind", () => {
    const contact: PhotoTargetDescriptor = { kind: "contact", contactId: 7 };
    const profile: PhotoTargetDescriptor = { kind: "profile" };
    const custom: PhotoTargetDescriptor = {
      kind: "customField",
      contactId: 7,
      colName: "pet_photo",
    };
    expect(relPathForTarget(contact)).toBe("avatars/contact-7.jpg");
    expect(relPathForTarget(profile)).toBe("avatars/profile.jpg");
    expect(relPathForTarget(custom)).toBe("avatars/cv-7-pet_photo.jpg");
  });
});

describe("resolvePhotoUriFromDocumentUri — pure rel -> file:// composer", () => {
  it("composes the document uri and the relative filename", () => {
    expect(
      resolvePhotoUriFromDocumentUri("file:///docs/", "avatars/contact-42.jpg"),
    ).toBe("file:///docs/avatars/contact-42.jpg");
  });

  it("tolerates a document uri without a trailing slash", () => {
    expect(
      resolvePhotoUriFromDocumentUri("file:///docs", "avatars/contact-42.jpg"),
    ).toBe("file:///docs/avatars/contact-42.jpg");
  });
});

describe("assertSafeRelative — generic boundary guard at the FS entry points", () => {
  const bad = [
    "../../etc/passwd",
    "/abs/path",
    "avatars/../secret.jpg",
    "avatars\\..\\x.jpg",
    "avatars/contact-42 .jpg",
    "avatars/contact-42.gif",
    "file:///abs/avatars/x.jpg",
    "photos/contact-42.jpg",
  ];

  it("rejects traversal / absolute / backslash / bad-ext / bad-dir via resolve", () => {
    for (const b of bad) {
      expect(() => resolvePhotoUriFromDocumentUri("file:///doc/", b)).toThrow();
    }
  });

  it("rejects the same set via deletePhoto", () => {
    for (const b of bad) {
      expect(() => deletePhoto(b)).toThrow();
    }
  });

  it("accepts a valid avatars/<name>.<ext>", () => {
    expect(
      resolvePhotoUriFromDocumentUri("file:///doc/", "avatars/contact-42.jpg"),
    ).toBe("file:///doc/avatars/contact-42.jpg");
    expect(() => deletePhoto("avatars/profile.png")).not.toThrow();
  });
});

describe("persistMaster — crash-safe, never pre-deletes the master", () => {
  it("happy path: copy -> .tmp, prior master -> .bak, .tmp -> dest, delete .bak", async () => {
    h.exists.add(DEST); // prior master present

    const rel = await persistMaster(
      "file:///cache/x.jpg",
      "avatars/contact-42.jpg",
    );

    expect(rel).toBe("avatars/contact-42.jpg");
    expect(h.exists.has(DEST)).toBe(true); // new bytes in place
    expect(h.exists.has(`${DEST}.tmp`)).toBe(false);
    expect(h.exists.has(`${DEST}.bak`)).toBe(false); // swap completed, bak cleaned
    // Ordering: copy-to-tmp precedes the prior-master move-aside.
    const copyIdx = h.ops.indexOf(`copy file:///cache/x.jpg -> ${DEST}.tmp`);
    const bakIdx = h.ops.indexOf(`move ${DEST} -> ${DEST}.bak`);
    expect(copyIdx).toBeGreaterThanOrEqual(0);
    expect(bakIdx).toBeGreaterThan(copyIdx);
  });

  it("first-ever set (no prior master) skips the .bak move-aside", async () => {
    const rel = await persistMaster(
      "file:///cache/x.jpg",
      "avatars/contact-9.jpg",
    );

    expect(rel).toBe("avatars/contact-9.jpg");
    expect(h.exists.has("file:///doc/avatars/contact-9.jpg")).toBe(true);
    expect(
      h.ops.some((o) => o.includes("-> file:///doc/avatars/contact-9.jpg.bak")),
    ).toBe(false);
  });

  it("a failed copy leaves the prior master untouched and rethrows", async () => {
    h.exists.add(DEST);
    h.cfg.copyThrows = true;

    await expect(
      persistMaster("file:///cache/x.jpg", "avatars/contact-42.jpg"),
    ).rejects.toThrow();

    // The prior master was never moved aside or deleted.
    expect(h.exists.has(DEST)).toBe(true);
    expect(h.ops.some((o) => o.startsWith(`move ${DEST} `))).toBe(false);
  });

  it("a failed tmp->dest move leaves the prior master recoverable from .bak", async () => {
    h.exists.add(DEST);
    h.cfg.moveTmpToDestThrows = true;

    await expect(
      persistMaster("file:///cache/x.jpg", "avatars/contact-42.jpg"),
    ).rejects.toThrow();

    // Prior master was renamed aside to .bak BEFORE the failing move, and the
    // failure path does NOT delete it — so it is recoverable by the launch sweep.
    expect(h.exists.has(`${DEST}.bak`)).toBe(true);
  });

  it("rejects an unsafe relative before touching the filesystem", async () => {
    await expect(
      persistMaster("file:///cache/x.jpg", "../../evil.jpg"),
    ).rejects.toThrow();
    expect(h.ops).toEqual([]);
  });
});

describe("deletePhoto — idempotent best-effort", () => {
  it("deletes an existing file and no-ops on a missing one", () => {
    h.exists.add("file:///doc/avatars/contact-1.jpg");
    deletePhoto("avatars/contact-1.jpg");
    expect(h.exists.has("file:///doc/avatars/contact-1.jpg")).toBe(false);
    expect(() => deletePhoto("avatars/contact-2.jpg")).not.toThrow();
  });
});

describe("reconcilePhotoDir — pure orphan tmp/bak reconciliation", () => {
  it("deletes an orphan *.tmp", () => {
    expect(reconcilePhotoDir(["contact-9.jpg.tmp"])).toEqual([
      { kind: "deleteTmp", relative: "avatars/contact-9.jpg.tmp" },
    ]);
  });

  it("deletes a *.bak whose canonical dest exists (swap completed)", () => {
    expect(reconcilePhotoDir(["contact-7.jpg", "contact-7.jpg.bak"])).toEqual([
      { kind: "deleteBak", relative: "avatars/contact-7.jpg.bak" },
    ]);
  });

  it("restores a *.bak whose canonical dest is MISSING (swap interrupted)", () => {
    expect(reconcilePhotoDir(["contact-7.jpg.bak"])).toEqual([
      {
        kind: "restoreBak",
        from: "avatars/contact-7.jpg.bak",
        to: "avatars/contact-7.jpg",
      },
    ]);
  });

  it("takes no action on a plain canonical file", () => {
    expect(reconcilePhotoDir(["contact-42.jpg"])).toEqual([]);
  });

  it("handles a mixed listing", () => {
    const actions = reconcilePhotoDir([
      "contact-42.jpg",
      "contact-9.jpg.tmp",
      "contact-7.jpg.bak",
      "profile.jpg",
      "profile.jpg.bak",
    ]);
    expect(actions).toEqual([
      { kind: "deleteTmp", relative: "avatars/contact-9.jpg.tmp" },
      {
        kind: "restoreBak",
        from: "avatars/contact-7.jpg.bak",
        to: "avatars/contact-7.jpg",
      },
      { kind: "deleteBak", relative: "avatars/profile.jpg.bak" },
    ]);
  });
});
