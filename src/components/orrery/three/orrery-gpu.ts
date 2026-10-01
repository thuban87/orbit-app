/**
 * ORRERY LAB C — WebGPU adapter/device ownership + one-off spike probes.
 *
 * One GPUDevice per app process, created lazily on the first Orrery mount and
 * reused across remounts (each mount still creates/disposes its own renderer
 * and canvas context). Keeping the device off the remount path avoids
 * re-requesting Dawn adapters on every tab visit; whether the Vulkan surface
 * re-bind survives 10× remounts is spike check 2 (react-native-webgpu issue 407).
 */
import { File } from "expo-file-system";
import * as THREE from "three/webgpu";
import { defaultOrreryImageDeps } from "../use-orrery-photo";
import type { BodyInfo } from "./orrery-scene3d";

interface OrreryGpu {
  adapter: GPUAdapter;
  device: GPUDevice;
}
let gpu: Promise<OrreryGpu> | null = null;

function installTextDecoderIfMissing() {
  if (typeof TextDecoder !== "undefined") return;
  const native = (
    globalThis as {
      RNWebGPU?: {
        DecodeToUTF8?: (b: ArrayBuffer | ArrayBufferView) => string;
      };
    }
  ).RNWebGPU?.DecodeToUTF8;
  if (!native) return;
  class NativeTextDecoder {
    readonly encoding = "utf-8";
    decode(input?: ArrayBuffer | ArrayBufferView) {
      return input && native ? native(input) : "";
    }
  }
  (globalThis as { TextDecoder?: unknown }).TextDecoder = NativeTextDecoder;
  console.log(
    "[lab-c] TextDecoder missing on Hermes: installed RNWebGPU.DecodeToUTF8 shim",
  );
}

export function getOrreryGpu(): Promise<OrreryGpu> {
  if (!gpu) {
    gpu = (async () => {
      installTextDecoderIfMissing();
      const t0 = performance.now();
      console.log(
        `[lab-c] stage requestAdapter navigator.gpu=${typeof navigator !== "undefined" && !!navigator.gpu}`,
      );
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });
      if (!adapter) throw new Error("No GPUAdapter");
      const info = adapter.info as GPUAdapterInfo & {
        isFallbackAdapter?: boolean;
      };
      console.log(
        `[lab-c] adapter vendor=${info.vendor} arch=${info.architecture} device=${info.device} desc=${info.description} fallback=${info.isFallbackAdapter ?? "n/a"} features=${[...adapter.features].join(",")} in ${Math.round(performance.now() - t0)}ms`,
      );
      const withTimeout = <T>(p: Promise<T>, ms: number) =>
        Promise.race([
          p,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
        ]);
      const tDev = performance.now();
      let device = await withTimeout(adapter.requestDevice(), 5000);
      console.log(
        `[lab-c] stage requestDevice ${device ? "ok" : "TIMEOUT"} ${Math.round(performance.now() - tDev)}ms`,
      );
      if (!device) {
        const retry = await navigator.gpu.requestAdapter();
        device = retry
          ? await withTimeout(
              retry.requestDevice({
                implicitDeviceSynchronization: false,
              } as GPUDeviceDescriptor),
              5000,
            )
          : null;
        console.log(
          `[lab-c] stage requestDevice(noImplicitSync) ${device ? "ok" : "TIMEOUT"}`,
        );
      }
      if (!device) throw new Error("requestDevice timed out");
      device.lost.then((lost) => {
        console.warn(`[lab-c] GPU device LOST: ${lost.reason} ${lost.message}`);
        gpu = null;
      });
      console.log(
        `[lab-c] device ready in ${Math.round(performance.now() - t0)}ms`,
      );
      return { adapter, device };
    })();
    gpu.catch(() => {
      gpu = null;
    });
  }
  return gpu;
}

let bitmapProbed = false;
/**
 * Spike check 3, byte path: photo file bytes → createImageBitmap(ArrayBuffer)
 * → THREE.Texture → renderer.initTexture (GPU upload). Runs once per process.
 * The production path in this lab is Skia decode → atlas readPixels.
 */
export async function runBitmapProbe(
  renderer: THREE.WebGPURenderer,
  infos: readonly BodyInfo[],
) {
  if (bitmapProbed) return;
  const target = infos.find((i) => i.photo);
  if (!target?.photo) return;
  bitmapProbed = true;
  try {
    const t0 = performance.now();
    const uri = defaultOrreryImageDeps.fileUri(target.photo);
    const bytes = await new File(uri).bytes();
    const t1 = performance.now();
    const bitmap = await (
      createImageBitmap as unknown as (b: ArrayBuffer) => Promise<ImageBitmap>
    )(bytes.buffer as ArrayBuffer);
    const t2 = performance.now();
    const tex = new THREE.Texture(bitmap as unknown as HTMLImageElement);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    renderer.initTexture(tex);
    const t3 = performance.now();
    console.log(
      `[lab-c] bitmap-probe OK ${bitmap.width}x${bitmap.height} read=${(t1 - t0).toFixed(1)}ms decode=${(t2 - t1).toFixed(1)}ms upload=${(t3 - t2).toFixed(1)}ms`,
    );
    tex.dispose();
    (bitmap as { close?: () => void }).close?.();
  } catch (error) {
    console.warn("[lab-c] bitmap-probe FAILED", error);
  }
}
