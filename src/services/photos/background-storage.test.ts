import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  operations: [] as string[],
  exists: new Set<string>(),
  bytes: new Map<string, Uint8Array>(),
}));

vi.mock("expo-file-system", () => {
  const uri = (parts: unknown[]) =>
    parts
      .map((part) =>
        typeof part === "string" ? part : (part as { uri: string }).uri,
      )
      .map((part, index) =>
        index === 0
          ? part.replace(/\/+$/, "")
          : part.replace(/^\/+/, "").replace(/\/+$/, ""),
      )
      .join("/");
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = uri(parts);
    }
    get exists() {
      return h.exists.has(this.uri);
    }
    get name() {
      return this.uri.split("/").at(-1) ?? "";
    }
    async copy(destination: File) {
      h.operations.push(`copy ${this.uri} -> ${destination.uri}`);
      h.exists.add(destination.uri);
      h.bytes.set(destination.uri, h.bytes.get(this.uri) ?? new Uint8Array());
    }
    async move(destination: File) {
      h.operations.push(`move ${this.uri} -> ${destination.uri}`);
      h.exists.delete(this.uri);
      h.exists.add(destination.uri);
      const bytes = h.bytes.get(this.uri);
      if (bytes) h.bytes.set(destination.uri, bytes);
      h.bytes.delete(this.uri);
      this.uri = destination.uri;
    }
    delete() {
      h.operations.push(`delete ${this.uri}`);
      h.exists.delete(this.uri);
      h.bytes.delete(this.uri);
    }
    write(bytes: Uint8Array) {
      h.operations.push(`write ${this.uri}`);
      h.exists.add(this.uri);
      h.bytes.set(this.uri, bytes);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = uri(parts);
    }
    get name() {
      return this.uri.split("/").at(-1) ?? "";
    }
    create() {}
    get exists() {
      return true;
    }
    list() {
      const prefix = `${this.uri}/`;
      const children = new Map<string, "file" | "directory">();
      for (const entry of h.exists) {
        if (!entry.startsWith(prefix)) continue;
        const remainder = entry.slice(prefix.length);
        const [name, ...rest] = remainder.split("/");
        children.set(name, rest.length > 0 ? "directory" : "file");
      }
      return [...children].map(([name, kind]) =>
        kind === "directory" ? new Directory(this, name) : new File(this, name),
      );
    }
  }
  return { Directory, File, Paths: { document: { uri: "file:///doc" } } };
});

import {
  backgroundDerivativeRelPath,
  backgroundRestorePendingRelPath,
  deleteBackgroundRestorePending,
  listBackgroundRestorePendingEntries,
  persistBackgroundDerivative,
  reconcileBackgroundDir,
  resolveBackgroundUriFromDocumentUri,
  stageBackgroundRestorePendingBase64,
} from "./background-storage";

beforeEach(() => {
  h.operations = [];
  h.exists = new Set();
  h.bytes = new Map();
});

describe("background storage", () => {
  it("stages decoded bytes in the uid-keyed restore-pending namespace", async () => {
    const relative = await stageBackgroundRestorePendingBase64(
      "AQID",
      "background_1",
      "session_1",
    );
    expect(relative).toBe(
      backgroundRestorePendingRelPath("background_1", "session_1"),
    );
    expect([...h.bytes.get(`file:///doc/${relative}`)!]).toEqual([1, 2, 3]);
    expect(listBackgroundRestorePendingEntries()).toEqual([{ relative }]);
    deleteBackgroundRestorePending(relative);
    expect(h.exists.has(`file:///doc/${relative}`)).toBe(false);
  });

  it("only permits UID-derived profile-background paths and rejects traversal/cache paths", () => {
    expect(backgroundDerivativeRelPath("background_1")).toBe(
      "profile-backgrounds/background_1.jpg",
    );
    for (const unsafe of ["../x", "a/b", "file:///cache/x", "has space"]) {
      expect(() => backgroundDerivativeRelPath(unsafe)).toThrow();
    }
    expect(() =>
      resolveBackgroundUriFromDocumentUri("file:///doc", "../x.jpg"),
    ).toThrow();
  });

  it("uses tmp then bak replacement without pre-deleting the old bytes", async () => {
    const relative = backgroundDerivativeRelPath("background_1");
    const destination = `file:///doc/${relative}`;
    h.exists.add(destination);
    await persistBackgroundDerivative("file:///cache/new.jpg", relative);
    expect(h.operations).toEqual([
      `copy file:///cache/new.jpg -> ${destination}.tmp`,
      `move ${destination} -> ${destination}.bak`,
      `move ${destination}.tmp -> ${destination}`,
      `delete ${destination}.bak`,
    ]);
  });

  it("serializes two rapid writes for one UID without leaving sidecars", async () => {
    const relative = backgroundDerivativeRelPath("background_1");
    await Promise.all([
      persistBackgroundDerivative("file:///cache/first.jpg", relative),
      persistBackgroundDerivative("file:///cache/second.jpg", relative),
    ]);
    expect(h.exists.has(`file:///doc/${relative}`)).toBe(true);
    expect(h.exists.has(`file:///doc/${relative}.tmp`)).toBe(false);
    expect(h.exists.has(`file:///doc/${relative}.bak`)).toBe(false);
  });

  it("plans every interrupted swap stage without treating ordinary files as sidecars", () => {
    expect(
      reconcileBackgroundDir([
        "one.jpg.tmp",
        "two.jpg.bak",
        "three.jpg",
        "three.jpg.bak",
      ]),
    ).toEqual([
      { kind: "deleteTmp", relative: "profile-backgrounds/one.jpg.tmp" },
      {
        kind: "restoreBak",
        from: "profile-backgrounds/two.jpg.bak",
        to: "profile-backgrounds/two.jpg",
      },
      { kind: "deleteBak", relative: "profile-backgrounds/three.jpg.bak" },
    ]);
  });
});
