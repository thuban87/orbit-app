/**
 * useOrreryPhoto's effect wiring through the PRODUCTION deps (38.6 D-41, review
 * IN-02), driven by a hook-capturing React fake: unmounting cancels a queued
 * derivative generation so the manipulator never runs for a body that is gone,
 * and once a body's derivative is on disk a remount (a return visit or a
 * restart) decodes it without reading or decoding the 1024 master. The SkImage
 * lifecycle itself is covered by `use-orrery-photo.test.ts`
 * (`createOrreryImageSlot`); the derivative store by
 * `orrery-derivative-store.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  effects: [] as Array<() => undefined | (() => void)>,
  setImage: [] as unknown[],
  manipulated: [] as string[],
  finishRender: [] as Array<() => void>,
  reads: [] as string[],
  decodedSizes: [] as number[],
  /** The fake cache dir: derivative URI → present. */
  disk: new Set<string>(),
}));

vi.mock("react", () => ({
  useRef: (value: unknown) => ({ current: value }),
  useState: (init: unknown) => [
    typeof init === "function" ? (init as () => unknown)() : init,
    (next: unknown) => h.setImage.push(next),
  ],
  useEffect: (effect: () => undefined | (() => void)) => {
    h.effects.push(effect);
  },
}));
vi.mock("@/stores/photo-cache-bust-store", () => ({
  usePhotoCacheBust: () => 1,
  getPhotoCacheBust: () => 1,
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

const { resetOrreryPhotoQueueForTests, useOrreryPhoto } = await import(
  "./use-orrery-photo"
);

async function flush(turns = 6): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
}

/** Render the hook once and run its load effect; returns that effect's cleanup. */
function mount(relative: string | null): () => void {
  h.effects.length = 0;
  // biome-ignore lint/correctness/useHookAtTopLevel: react is mocked; the hook runs as a plain function here.
  useOrreryPhoto(relative);
  const cleanup = h.effects[0]?.();
  return cleanup ?? (() => {});
}

beforeEach(() => {
  resetOrreryPhotoQueueForTests();
  h.effects.length = 0;
  h.setImage.length = 0;
  h.manipulated.length = 0;
  h.finishRender.length = 0;
  h.reads.length = 0;
  h.decodedSizes.length = 0;
  h.disk.clear();
});

describe("useOrreryPhoto — cancel and disk derivative (38.6 D-41, IN-02)", () => {
  it("publishes null for a photo-less body and reads nothing", async () => {
    mount(null);
    await flush();
    expect(h.setImage).toEqual([null]);
    expect(h.reads).toEqual([]);
  });

  it("unmounting a body whose generation is still queued skips that generation", async () => {
    mount("avatars/contact-1.jpg");
    const unmountTwo = mount("avatars/contact-2.jpg");
    await flush();
    // One slot: contact-1 is generating, contact-2 waits in the queue.
    expect(h.manipulated).toEqual(["file:///docs/avatars/contact-1.jpg"]);

    unmountTwo();
    h.finishRender.shift()?.();
    await flush();

    expect(h.manipulated).toEqual(["file:///docs/avatars/contact-1.jpg"]);
    // Only contact-1 published an image; the unmounted body published nothing.
    expect(h.setImage).toHaveLength(1);
    expect([...h.disk]).toEqual(["deriv:avatars/contact-1.jpg@36109-1000"]);
  });

  it("a remount once the derivative is on disk never reads or decodes the 1024 master", async () => {
    const unmount = mount("avatars/contact-1.jpg");
    await flush();
    h.finishRender.shift()?.();
    await flush();
    unmount();
    expect(h.manipulated).toHaveLength(1);

    // A return visit (or a restart: the in-process queue is gone, the disk is not).
    resetOrreryPhotoQueueForTests();
    h.reads.length = 0;
    h.decodedSizes.length = 0;
    mount("avatars/contact-1.jpg");
    await flush();
    expect(h.manipulated).toHaveLength(1);
    expect(h.reads).toEqual(["deriv:avatars/contact-1.jpg@36109-1000"]);
    expect(h.decodedSizes).toEqual([512]);
    expect(h.setImage).toHaveLength(2);
  });
});
