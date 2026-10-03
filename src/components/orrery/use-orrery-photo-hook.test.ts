/**
 * The Orrery photo cache's load wiring through the PRODUCTION loader deps
 * (38.6 D-41, review IN-02; retargeted from the deleted per-body hook in
 * 38.7-07): dropping a photo from an owner's request cancels its queued
 * derivative generation, so the manipulator never runs for a body nobody
 * shows, and once a body's derivative is on disk a later visit decodes it
 * without reading or decoding the 1024 master. The cache's custody rules are
 * covered by `resources/orrery-photo-cache.test.ts`; the derivative store by
 * `orrery-derivative-store.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  manipulated: [] as string[],
  finishRender: [] as Array<() => void>,
  reads: [] as string[],
  decodedSizes: [] as number[],
  /** The fake cache dir: derivative URI → present. */
  disk: new Set<string>(),
}));

vi.mock("@/stores/photo-cache-bust-store", () => ({
  getPhotoCacheBust: () => 1,
  subscribePhotoCacheBust: () => () => {},
}));
vi.mock("@shopify/react-native-skia", () => {
  const image = (size: number) => {
    h.decodedSizes.push(size);
    return { width: () => size, height: () => size, dispose: () => {} };
  };
  return {
    Skia: {
      Data: {
        fromURI: async (uri: string) => {
          h.reads.push(uri);
          return { file: uri };
        },
      },
      Image: {
        MakeImageFromEncoded: (data: { file: string }) =>
          image(data.file.startsWith("deriv:") ? 512 : 1024),
      },
    },
  };
});
vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate(uri: string) {
      h.manipulated.push(uri);
      const ctx = {
        release() {},
        resize() {
          return ctx;
        },
        renderAsync: () =>
          new Promise((resolve) => {
            h.finishRender.push(() =>
              resolve({
                release() {},
                saveAsync: async () => ({ uri: `tmp:${uri}` }),
              }),
            );
          }),
      };
      return ctx;
    },
  },
}));
vi.mock("@/services/photos/photo-storage", () => ({
  resolvePhotoUri: (relative: string) => `file:///docs/${relative}`,
}));
vi.mock("@/services/photos/orrery-derivative-store", () => {
  const uriOf = (relative: string, signature: string) =>
    `deriv:${relative}@${signature}`;
  return {
    orreryMasterSignature: () => "36109-1000",
    findOrreryDerivative: (relative: string, signature: string) =>
      h.disk.has(uriOf(relative, signature))
        ? uriOf(relative, signature)
        : null,
    installOrreryDerivative: async (
      _temp: string,
      relative: string,
      signature: string,
    ) => {
      h.disk.add(uriOf(relative, signature));
      return uriOf(relative, signature);
    },
    dropOrreryDerivative: (uri: string) => h.disk.delete(uri),
  };
});
vi.mock("@/utils/logger", () => ({
  Logger: { warn: vi.fn(), error: vi.fn() },
}));

const { resetOrreryPhotoQueueForTests } = await import("./use-orrery-photo");
const { createOrreryPhotoCache } = await import(
  "./resources/orrery-photo-cache"
);

async function flush(turns = 6): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
}

const request = (relative: string, priority: number) => ({
  key: relative,
  relativePath: relative,
  priority,
  visible: true,
});

beforeEach(() => {
  resetOrreryPhotoQueueForTests();
  h.manipulated.length = 0;
  h.finishRender.length = 0;
  h.reads.length = 0;
  h.decodedSizes.length = 0;
  h.disk.clear();
});

describe("orreryPhotoCache through the production loader (38.6 D-41, IN-02)", () => {
  it("an owner with no photo requests reads nothing", async () => {
    const cache = createOrreryPhotoCache();
    cache.mount("w", () => {});
    cache.request("w", []);
    await flush();
    expect(h.reads).toEqual([]);
    expect(cache.drawn("w").size).toBe(0);
  });

  it("dropping a photo whose generation is still queued skips that generation", async () => {
    const cache = createOrreryPhotoCache();
    const ready: number[] = [];
    cache.mount("w", () => ready.push(cache.drawn("w").size));
    cache.request("w", [
      request("avatars/contact-1.jpg", 0),
      request("avatars/contact-2.jpg", 1),
    ]);
    await flush();
    // One manipulator slot: contact-1 is generating, contact-2 waits in the queue.
    expect(h.manipulated).toEqual(["file:///docs/avatars/contact-1.jpg"]);

    // contact-2 leaves the request (its body is gone): its decode is cancelled.
    cache.request("w", [request("avatars/contact-1.jpg", 0)]);
    h.finishRender.shift()?.();
    await flush();

    expect(h.manipulated).toEqual(["file:///docs/avatars/contact-1.jpg"]);
    // Only contact-1 was published; the dropped photo published nothing.
    expect([...cache.drawn("w").keys()]).toEqual(["avatars/contact-1.jpg"]);
    expect(ready).toEqual([1]);
    expect([...h.disk]).toEqual(["deriv:avatars/contact-1.jpg@36109-1000"]);
  });

  it("a later visit once the derivative is on disk never reads or decodes the 1024 master", async () => {
    const cache = createOrreryPhotoCache();
    cache.mount("w", () => {});
    cache.request("w", [request("avatars/contact-1.jpg", 0)]);
    await flush();
    h.finishRender.shift()?.();
    await flush();
    const epoch = cache.release("w") as number;
    cache.confirmReleased("w", epoch);
    cache.clearUnheld();
    expect(h.manipulated).toHaveLength(1);

    // A return visit (or a restart: the in-process queue is gone, the disk is not).
    resetOrreryPhotoQueueForTests();
    h.reads.length = 0;
    h.decodedSizes.length = 0;
    const next = createOrreryPhotoCache();
    next.mount("w", () => {});
    next.request("w", [request("avatars/contact-1.jpg", 0)]);
    await flush();
    expect(h.manipulated).toHaveLength(1);
    expect(h.reads).toEqual(["deriv:avatars/contact-1.jpg@36109-1000"]);
    expect(h.decodedSizes).toEqual([512]);
    expect(next.drawn("w").size).toBe(1);
  });
});
