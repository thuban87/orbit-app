/**
 * useOrreryPhoto's effect wiring (38.6 D-37 / review IN-02), driven through a
 * hook-capturing React fake: a mounted body retains its photo path for the
 * derivative cache budget, and unmounting cancels its queued downsample so the
 * manipulator never runs for a body that is gone. The SkImage lifecycle itself
 * is covered by `use-orrery-photo.test.ts` (`createOrreryImageSlot`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  effects: [] as Array<() => undefined | (() => void)>,
  setImage: [] as unknown[],
  manipulated: [] as string[],
  finishRender: [] as Array<() => void>,
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
}));
vi.mock("@shopify/react-native-skia", () => {
  const image = (size: number) => ({
    width: () => size,
    height: () => size,
    dispose: () => {},
  });
  return {
    Skia: {
      Data: {
        fromURI: async (uri: string) => ({ file: uri }),
        fromBase64: (b64: string) => ({ b64 }),
      },
      Image: {
        MakeImageFromEncoded: (data: { file?: string }) =>
          image(data.file === undefined ? 512 : 1024),
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
                saveAsync: async () => ({
                  uri: "file:///cache/small.jpg",
                  base64: `small-of-${uri}`,
                }),
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
vi.mock("@/services/photos/derivative-cache", () => ({
  discardDerivative: vi.fn(),
}));
vi.mock("@/utils/logger", () => ({
  Logger: { warn: vi.fn(), error: vi.fn() },
}));

const {
  orreryDerivativeCacheState,
  resetOrreryPhotoCacheForTests,
  useOrreryPhoto,
} = await import("./use-orrery-photo");

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
  resetOrreryPhotoCacheForTests();
  h.effects.length = 0;
  h.setImage.length = 0;
  h.manipulated.length = 0;
  h.finishRender.length = 0;
});

describe("useOrreryPhoto — retain and cancel (38.6 D-37, IN-02)", () => {
  it("retains the photo path while mounted and releases it on unmount", () => {
    const unmount = mount("avatars/contact-1.jpg");
    expect(orreryDerivativeCacheState().live).toEqual([
      "avatars/contact-1.jpg",
    ]);
    unmount();
    expect(orreryDerivativeCacheState().live).toEqual([]);
  });

  it("retains nothing for a photo-less body", () => {
    mount(null);
    expect(orreryDerivativeCacheState().live).toEqual([]);
  });

  it("unmounting a body whose downsample is still queued skips that downsample", async () => {
    mount("avatars/contact-1.jpg");
    const unmountTwo = mount("avatars/contact-2.jpg");
    await flush();
    // One slot: contact-1 is downsampling, contact-2 waits in the queue.
    expect(h.manipulated).toEqual(["file:///docs/avatars/contact-1.jpg"]);

    unmountTwo();
    h.finishRender.shift()?.();
    await flush();

    expect(h.manipulated).toEqual(["file:///docs/avatars/contact-1.jpg"]);
    // Only contact-1 published an image; the unmounted body published nothing.
    expect(h.setImage).toHaveLength(1);
    expect(orreryDerivativeCacheState().keys).toEqual([
      "avatars/contact-1.jpg#1",
    ]);
  });

  it("a remount after the Orrery returns is a cache hit (no second downsample)", async () => {
    const unmount = mount("avatars/contact-1.jpg");
    await flush();
    h.finishRender.shift()?.();
    await flush();
    unmount();
    expect(h.manipulated).toHaveLength(1);

    mount("avatars/contact-1.jpg");
    await flush();
    expect(h.manipulated).toHaveLength(1);
    expect(h.setImage).toHaveLength(2);
  });
});
