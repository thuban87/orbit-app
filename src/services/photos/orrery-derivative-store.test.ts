/**
 * orrery-derivative-store (38.6 D-41) — node proof of the Orrery's cache-dir
 * derivatives over an in-memory file system: the layout and durable signature,
 * hit / miss / stale-signature / empty lookups, the atomic install (older
 * signatures removed, temp retired on failure, nothing left behind when the
 * master changes or is deleted mid-install), namespace-confined drops, the
 * per-photo discard the ownership layer calls, and the chunked once-per-process
 * launch orphan sweep (whole namespace, no head-of-list cap — WR6-01).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/photos/photo-storage", () => ({
  photoFileStat: vi.fn(() => null),
}));
vi.mock("@/services/photos/derivative-cache", () => ({
  discardDerivative: vi.fn(() => true),
}));
vi.mock("@/services/launch-sweep", () => ({
  registerSweepHook: vi.fn(),
}));
vi.mock("@/utils/logger", () => ({
  Logger: { warn: vi.fn(), error: vi.fn() },
}));

import { registerSweepHook } from "@/services/launch-sweep";
import { discardDerivative } from "@/services/photos/derivative-cache";
import {
  __resetOrreryDerivativeSweepForTest,
  discardOrreryDerivatives,
  dropOrreryDerivative,
  findOrreryDerivative,
  formatOrrerySignature,
  installOrreryDerivative,
  ORRERY_DERIVATIVE_DIR,
  ORRERY_DERIVATIVE_SWEEP_CHUNK,
  type OrreryDerivativeEntry,
  type OrreryDerivativeFs,
  orreryDerivativeUri,
  orreryMasterSignature,
  registerOrreryDerivativeSweep,
  sweepOrreryDerivativesOncePerProcess,
} from "./orrery-derivative-store";

const NS = `file:///cache/${ORRERY_DERIVATIVE_DIR}`;
const TEMP = "file:///cache/ImageManipulator/7f.jpg";

/** In-memory file system: files (URI → byte size), directories, master stats. */
class FakeFs implements OrreryDerivativeFs {
  cacheUri = "file:///cache/";
  files = new Map<string, number>();
  dirs = new Set<string>(["file:///cache", "file:///cache/ImageManipulator"]);
  masters = new Map<string, { size: number; modificationTime: number }>();
  /** Runs while the rename is in flight (before it lands). */
  duringMove?: () => void;
  failMove = false;
  truncateOnMove = false;
  throwEverywhere = false;

  private guard(): void {
    if (this.throwEverywhere) throw new Error("native fs gone");
  }
  masterStat(relative: string) {
    this.guard();
    return this.masters.get(relative) ?? null;
  }
  fileSize(uri: string) {
    this.guard();
    return this.files.get(uri) ?? null;
  }
  dirExists(uri: string) {
    this.guard();
    return this.dirs.has(uri);
  }
  ensureDir(uri: string) {
    this.guard();
    let path = uri;
    while (path.startsWith("file:///cache") && !this.dirs.has(path)) {
      this.dirs.add(path);
      path = path.slice(0, path.lastIndexOf("/"));
    }
  }
  list(directoryUri: string): OrreryDerivativeEntry[] {
    this.guard();
    const prefix = `${directoryUri}/`;
    const child = (uri: string) =>
      uri.startsWith(prefix) && !uri.slice(prefix.length).includes("/");
    return [
      ...[...this.dirs].filter(child).map((uri) => ({
        name: uri.slice(prefix.length),
        uri,
        isDirectory: true,
      })),
      ...[...this.files.keys()].filter(child).map((uri) => ({
        name: uri.slice(prefix.length),
        uri,
        isDirectory: false,
      })),
    ];
  }
  deleteFile(uri: string) {
    this.guard();
    if (!this.files.delete(uri)) throw new Error(`no file ${uri}`);
  }
  deleteDir(uri: string) {
    this.guard();
    if (!this.dirs.delete(uri)) throw new Error(`no dir ${uri}`);
    for (const path of [...this.files.keys()])
      if (path.startsWith(`${uri}/`)) this.files.delete(path);
    for (const path of [...this.dirs])
      if (path.startsWith(`${uri}/`)) this.dirs.delete(path);
  }
  async move(from: string, to: string) {
    this.guard();
    await Promise.resolve();
    this.duringMove?.();
    if (this.failMove) throw new Error("rename failed");
    const size = this.files.get(from);
    if (size === undefined) throw new Error("no source");
    if (!this.dirs.has(to.slice(0, to.lastIndexOf("/"))))
      throw new Error("no parent");
    this.files.delete(from);
    this.files.set(to, this.truncateOnMove ? size - 1 : size);
  }
}

const REL = "avatars/contact-12.jpg";
const STAT = { size: 36109, modificationTime: 1_700_000_000_123.7 };
const SIG = "36109-1700000000123";
const PHOTO_DIR = `${NS}/contact-12.jpg`;
const FINAL = `${PHOTO_DIR}/${SIG}.jpg`;

let fs: FakeFs;
beforeEach(() => {
  fs = new FakeFs();
  fs.masters.set(REL, STAT);
  vi.mocked(discardDerivative).mockClear();
  __resetOrreryDerivativeSweepForTest();
});

describe("layout and signature", () => {
  it("formats size + whole-ms mtime, and rejects unusable stats", () => {
    expect(formatOrrerySignature(STAT)).toBe(SIG);
    expect(formatOrrerySignature(null)).toBeNull();
    expect(formatOrrerySignature({ size: 0, modificationTime: 1 })).toBeNull();
    expect(
      formatOrrerySignature({ size: 10, modificationTime: Number.NaN }),
    ).toBeNull();
    expect(
      formatOrrerySignature({ size: 1.5, modificationTime: 1 }),
    ).toBeNull();
  });

  it("puts each photo's derivative in the cache dir under its own sub-directory, named by signature", () => {
    expect(orreryDerivativeUri(REL, SIG, fs)).toBe(FINAL);
    expect(orreryDerivativeUri("avatars/cv-3-pet_photo.webp", "1-2", fs)).toBe(
      `${NS}/cv-3-pet_photo.webp/1-2.jpg`,
    );
    expect(FINAL.startsWith("file:///cache/")).toBe(true);
  });

  it("builds nothing for an unsafe path or signature", () => {
    for (const bad of ["Rex", "avatars/../x.jpg", "avatars/a/b.jpg", "/etc/x"])
      expect(orreryDerivativeUri(bad, SIG, fs)).toBeNull();
    for (const bad of ["", "../1", "1-2/../3", "abc"])
      expect(orreryDerivativeUri(REL, bad, fs)).toBeNull();
  });

  it("reads the master's signature, null when it is missing or the stat throws", () => {
    expect(orreryMasterSignature(REL, fs)).toBe(SIG);
    expect(orreryMasterSignature("avatars/contact-99.jpg", fs)).toBeNull();
    expect(orreryMasterSignature("Rex", fs)).toBeNull();
    fs.throwEverywhere = true;
    expect(orreryMasterSignature(REL, fs)).toBeNull();
  });
});

describe("findOrreryDerivative — hit / miss / stale / empty", () => {
  it("HIT: the file for exactly this signature", () => {
    fs.ensureDir(PHOTO_DIR);
    fs.files.set(FINAL, 41_000);
    expect(findOrreryDerivative(REL, SIG, fs)).toBe(FINAL);
  });

  it("MISS: nothing on disk", () => {
    expect(findOrreryDerivative(REL, SIG, fs)).toBeNull();
  });

  it("STALE: a derivative for another signature is never returned", () => {
    fs.ensureDir(PHOTO_DIR);
    fs.files.set(`${PHOTO_DIR}/20000-1.jpg`, 41_000);
    expect(findOrreryDerivative(REL, SIG, fs)).toBeNull();
  });

  it("an empty file is not a derivative", () => {
    fs.ensureDir(PHOTO_DIR);
    fs.files.set(FINAL, 0);
    expect(findOrreryDerivative(REL, SIG, fs)).toBeNull();
  });
});

describe("installOrreryDerivative — atomic, never stale, never orphaned", () => {
  it("renames the temp file into place and removes older signatures of the photo", async () => {
    fs.ensureDir(PHOTO_DIR);
    fs.files.set(`${PHOTO_DIR}/20000-1.jpg`, 30_000);
    fs.files.set(`${PHOTO_DIR}/20000-1.jpg.partial`, 10);
    fs.files.set(TEMP, 41_000);
    await expect(installOrreryDerivative(TEMP, REL, SIG, fs)).resolves.toBe(
      FINAL,
    );
    expect([...fs.files]).toEqual([[FINAL, 41_000]]);
    expect(discardDerivative).not.toHaveBeenCalled();
  });

  it("the final name never exists with partial content (it appears only through the rename)", async () => {
    fs.files.set(TEMP, 41_000);
    const seen: Array<number | null> = [];
    fs.duringMove = () => seen.push(fs.fileSize(FINAL));
    await installOrreryDerivative(TEMP, REL, SIG, fs);
    expect(seen).toEqual([null]);
    expect(fs.fileSize(FINAL)).toBe(41_000);
  });

  it("leaves nothing behind when the master is REPLACED mid-install", async () => {
    fs.files.set(TEMP, 41_000);
    fs.duringMove = () =>
      fs.masters.set(REL, {
        size: 50_000,
        modificationTime: 1_800_000_000_000,
      });
    await expect(
      installOrreryDerivative(TEMP, REL, SIG, fs),
    ).resolves.toBeNull();
    expect(fs.files.size).toBe(0);
  });

  it("leaves nothing behind when the master is DELETED mid-install", async () => {
    fs.files.set(TEMP, 41_000);
    fs.duringMove = () => fs.masters.delete(REL);
    await expect(
      installOrreryDerivative(TEMP, REL, SIG, fs),
    ).resolves.toBeNull();
    expect(fs.files.size).toBe(0);
  });

  it("retires the temp file and rethrows when the rename fails", async () => {
    fs.files.set(TEMP, 41_000);
    fs.failMove = true;
    await expect(installOrreryDerivative(TEMP, REL, SIG, fs)).rejects.toThrow(
      "rename failed",
    );
    expect(discardDerivative).toHaveBeenCalledWith(TEMP);
    expect(fs.fileSize(FINAL)).toBeNull();
  });

  it("refuses an empty temp file or an unsafe target (temp retired)", async () => {
    fs.files.set(TEMP, 0);
    await expect(installOrreryDerivative(TEMP, REL, SIG, fs)).rejects.toThrow(
      "empty",
    );
    await expect(
      installOrreryDerivative(TEMP, "avatars/../x.jpg", SIG, fs),
    ).rejects.toThrow("unsafe");
    expect(discardDerivative).toHaveBeenCalledTimes(2);
  });

  it("deletes a short file that the rename produced", async () => {
    fs.files.set(TEMP, 41_000);
    fs.truncateOnMove = true;
    await expect(installOrreryDerivative(TEMP, REL, SIG, fs)).rejects.toThrow(
      "size mismatch",
    );
    expect(fs.fileSize(FINAL)).toBeNull();
  });
});

describe("dropOrreryDerivative — confined to the namespace", () => {
  it("deletes a derivative file", () => {
    fs.ensureDir(PHOTO_DIR);
    fs.files.set(FINAL, 41_000);
    expect(dropOrreryDerivative(FINAL, fs)).toBe(true);
    expect(fs.fileSize(FINAL)).toBeNull();
  });

  it("refuses anything outside it — a master, another cache file, a traversal", () => {
    const outside = [
      "file:///docs/avatars/contact-12.jpg",
      "file:///cache/ImageManipulator/7f.jpg",
      `${NS}/contact-12.jpg/../../x.jpg`,
      `${NS}/contact-12.jpg`,
      `${NS}/contact-12.jpg/${SIG}.jpg?v=1`,
      `${NS}/contact-12.jpg/%2e%2e.jpg`,
    ];
    for (const uri of outside) fs.files.set(uri, 1);
    for (const uri of outside)
      expect(dropOrreryDerivative(uri, fs)).toBe(false);
    for (const uri of outside) expect(fs.fileSize(uri)).toBe(1);
  });
});

describe("discardOrreryDerivatives — the ownership layer's per-photo delete", () => {
  it("deletes every derivative of the photo and nothing else", () => {
    fs.ensureDir(PHOTO_DIR);
    fs.files.set(FINAL, 41_000);
    fs.files.set(`${PHOTO_DIR}/1-1.jpg`, 9);
    fs.ensureDir(`${NS}/contact-13.jpg`);
    fs.files.set(`${NS}/contact-13.jpg/5-5.jpg`, 5);
    expect(discardOrreryDerivatives(REL, fs)).toBe(true);
    expect([...fs.files.keys()]).toEqual([`${NS}/contact-13.jpg/5-5.jpg`]);
    expect(fs.dirExists(PHOTO_DIR)).toBe(false);
  });

  it("is a no-op when there is nothing cached, refuses unsafe paths, and never throws", () => {
    expect(discardOrreryDerivatives(REL, fs)).toBe(true);
    expect(discardOrreryDerivatives("avatars/../x.jpg", fs)).toBe(false);
    fs.throwEverywhere = true;
    expect(() => discardOrreryDerivatives(REL, fs)).not.toThrow();
    expect(discardOrreryDerivatives(REL, fs)).toBe(false);
  });
});

describe("sweepOrreryDerivativesOncePerProcess — chunked launch orphan sweep", () => {
  /** A live photo: master present and its current-signature derivative on disk. */
  function addLive(name: string): void {
    const relative = `avatars/${name}`;
    fs.masters.set(relative, { size: 1000, modificationTime: 5 });
    fs.ensureDir(`${NS}/${name}`);
    fs.files.set(`${NS}/${name}/1000-5.jpg`, 41_000);
  }

  it("keeps only current derivatives of masters that still exist", async () => {
    // Current + stale + stray for a live master.
    fs.ensureDir(PHOTO_DIR);
    fs.files.set(FINAL, 41_000);
    fs.files.set(`${PHOTO_DIR}/20000-1.jpg`, 30_000);
    fs.files.set(`${PHOTO_DIR}/x.tmp`, 3);
    fs.ensureDir(`${PHOTO_DIR}/nested`);
    // A deleted contact's photo (master gone).
    fs.ensureDir(`${NS}/contact-13.jpg`);
    fs.files.set(`${NS}/contact-13.jpg/5-5.jpg`, 5);
    // Foreign entries in the namespace root.
    fs.files.set(`${NS}/junk.txt`, 1);
    fs.ensureDir(`${NS}/not-a-photo`);

    const summary = await sweepOrreryDerivativesOncePerProcess(fs);
    expect([...fs.files.keys()]).toEqual([FINAL]);
    expect([...fs.dirs].filter((d) => d.startsWith(NS)).sort()).toEqual([
      NS,
      PHOTO_DIR,
    ]);
    expect(summary).toEqual({ removed: 6, inspected: 4 });
  });

  it("runs once per process", async () => {
    fs.ensureDir(`${NS}/contact-13.jpg`);
    await sweepOrreryDerivativesOncePerProcess(fs);
    fs.ensureDir(`${NS}/contact-14.jpg`);
    await expect(sweepOrreryDerivativesOncePerProcess(fs)).resolves.toEqual({
      removed: 0,
      inspected: 0,
    });
    expect(fs.dirExists(`${NS}/contact-14.jpg`)).toBe(true);
  });

  it("WR6-01 repro: an orphan listed after 2,000+ live entries is removed", async () => {
    const LIVE = 2_050;
    for (let i = 0; i < LIVE; i++) addLive(`contact-${1000 + i}.jpg`);
    // Listed last (insertion order): its master is gone.
    const orphan = `${NS}/contact-99999.jpg`;
    fs.ensureDir(orphan);
    fs.files.set(`${orphan}/7-7.jpg`, 7);

    const summary = await sweepOrreryDerivativesOncePerProcess(fs, () =>
      Promise.resolve(),
    );
    expect(summary).toEqual({ removed: 1, inspected: LIVE + 1 });
    expect(fs.dirExists(orphan)).toBe(false);
    expect(fs.fileSize(`${orphan}/7-7.jpg`)).toBeNull();
    // Every live derivative survives.
    expect(fs.files.size).toBe(LIVE);
    expect(fs.list(NS)).toHaveLength(LIVE);
  });

  it("yields a tick between chunks, never inside one, and walks every entry", async () => {
    const total = ORRERY_DERIVATIVE_SWEEP_CHUNK * 2 + 1;
    for (let i = 0; i < total; i++)
      fs.ensureDir(`${NS}/contact-${1000 + i}.jpg`); // all orphans
    const remainingAtYield: number[] = [];
    const summary = await sweepOrreryDerivativesOncePerProcess(fs, async () => {
      remainingAtYield.push(fs.list(NS).length);
    });
    // Two full chunks → two yields, each after exactly one more chunk.
    expect(remainingAtYield).toEqual([
      total - ORRERY_DERIVATIVE_SWEEP_CHUNK,
      total - ORRERY_DERIVATIVE_SWEEP_CHUNK * 2,
    ]);
    expect(summary).toEqual({ removed: total, inspected: total });
    expect(fs.list(NS)).toHaveLength(0);
  });

  it("the default yield is a real macrotask: other work runs mid-walk", async () => {
    for (let i = 0; i < ORRERY_DERIVATIVE_SWEEP_CHUNK + 1; i++)
      fs.ensureDir(`${NS}/contact-${1000 + i}.jpg`);
    let remainingWhenTimerRan: number | null = null;
    setTimeout(() => {
      remainingWhenTimerRan = fs.list(NS).length;
    }, 0);
    await sweepOrreryDerivativesOncePerProcess(fs);
    expect(remainingWhenTimerRan).toBe(1);
    expect(fs.list(NS)).toHaveLength(0);
  });

  it("an entry discarded between chunks is skipped quietly", async () => {
    const total = ORRERY_DERIVATIVE_SWEEP_CHUNK + 1;
    for (let i = 0; i < total; i++) addLive(`contact-${1000 + i}.jpg`);
    const last = `contact-${1000 + total - 1}.jpg`;
    const summary = await sweepOrreryDerivativesOncePerProcess(fs, async () => {
      // The ownership layer discards a photo while the sweep is paused.
      discardOrreryDerivatives(`avatars/${last}`, fs);
    });
    expect(summary).toEqual({ removed: 0, inspected: total });
    expect(fs.list(NS)).toHaveLength(total - 1);
  });

  it("is a no-op without a namespace and never rejects", async () => {
    await expect(sweepOrreryDerivativesOncePerProcess(fs)).resolves.toEqual({
      removed: 0,
      inspected: 0,
    });
    __resetOrreryDerivativeSweepForTest();
    fs.throwEverywhere = true;
    await expect(sweepOrreryDerivativesOncePerProcess(fs)).resolves.toEqual({
      removed: 0,
      inspected: 0,
    });
  });

  it("registers on the launch-sweep registry, and the hook does not wait for the walk", async () => {
    registerOrreryDerivativeSweep();
    expect(registerSweepHook).toHaveBeenCalledWith(expect.any(Function), {
      id: "orrery-derivative",
    });
    const hook = vi.mocked(registerSweepHook).mock.calls.at(-1)?.[0];
    // Production fs is unavailable in node: the detached walk logs and settles.
    await expect(hook?.()).resolves.toBeUndefined();
  });
});
