import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  operations: [] as string[],
  exists: new Set<string>(),
}));

vi.mock("expo-file-system", () => {
  const uri = (parts: unknown[]) =>
    parts
      .map((part) => (typeof part === "string" ? part : (part as { uri: string }).uri))
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
    }
    async move(destination: File) {
      h.operations.push(`move ${this.uri} -> ${destination.uri}`);
      h.exists.delete(this.uri);
      h.exists.add(destination.uri);
      this.uri = destination.uri;
    }
    delete() {
      h.operations.push(`delete ${this.uri}`);
      h.exists.delete(this.uri);
    }
  }
  class Directory {
    constructor(..._parts: unknown[]) {}
    create() {}
    get exists() {
      return true;
    }
    list() {
      return [];
    }
  }
  return { Directory, File, Paths: { document: { uri: "file:///doc" } } };
});

import {
  backgroundDerivativeRelPath,
  persistBackgroundDerivative,
  reconcileBackgroundDir,
  resolveBackgroundUriFromDocumentUri,
} from "./background-storage";

beforeEach(() => {
  h.operations = [];
  h.exists = new Set();
});

describe("background storage", () => {
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
