/**
 * ORRERY LAB C — WebGPU adapter/device ownership + one-off spike probes.
 *
 * Device lifecycle (learned on the Pixel 6 Pro, see _notes/M1-BUILD.md):
 *  - requestDevice() issued while the Orrery's SurfaceView is being created
 *    blocked the JS AND main threads for ~32 s, so a device is always
 *    requested while NO WebGPU surface is being created: a "spare" device is
 *    prewarmed at module load and re-prewarmed right after each unmount; the
 *    world only mounts its <Canvas> once it holds a device.
 *  - ONE device per mount, destroyed on unmount. A process-wide shared device
 *    leaked every renderer (three's backend hangs a `device.lost.then(...)`
 *    reaction per renderer on the shared device, rooting the whole graph):
 *    Hermes external memory grew ~200 MB per remount and the JS thread
 *    SIGSEGV'd on the 3rd–4th remount at 200 bodies.
 */
import { File } from "expo-file-system";
import * as THREE from "three/webgpu";
import { defaultOrreryImageDeps } from "../use-orrery-photo";
import type { BodyInfo } from "./orrery-scene3d";

let adapterLogged = false;
let spare: Promise<GPUDevice> | null = null;

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

/** A fresh adapter per device: a WebGPU adapter is "consumed" by one device. */
async function requestAdapter(): Promise<GPUAdapter> {
  installTextDecoderIfMissing();
  const t0 = performance.now();
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });
  if (!adapter) throw new Error("No GPUAdapter");
  if (!adapterLogged) {
    adapterLogged = true;
    const info = adapter.info as GPUAdapterInfo & {
      isFallbackAdapter?: boolean;
    };
    console.log(
      `[lab-c] adapter vendor=${info.vendor} arch=${info.architecture} device=${info.device} desc=${info.description} fallback=${info.isFallbackAdapter ?? "n/a"} in ${Math.round(performance.now() - t0)}ms`,
    );
  }
  return adapter;
}

async function createDevice(): Promise<GPUDevice> {
  const adapter = await requestAdapter();
  const t0 = performance.now();
  const device = await adapter.requestDevice();
  // react-native-webgpu 0.10.4: every `device.queue` read builds a NEW native
  // GPUQueue + JS wrapper (GPUDevice::getQueue → make_shared) and three reads
  // it on every write/submit. Pin one wrapper as an own property shadowing the
  // prototype getter (the device stays the real host object, so
  // context.configure({ device }) still unwraps it).
  const queue = device.queue;
  Object.defineProperty(device, "queue", {
    value: queue,
    writable: false,
    configurable: true,
    enumerable: true,
  });
  device.lost.then((lost) => {
    if (lost.reason !== "destroyed")
      console.warn(`[lab-c] GPU device LOST: ${lost.reason} ${lost.message}`);
  });
  console.log(
    `[lab-c] device created in ${Math.round(performance.now() - t0)}ms`,
  );
  return device;
}

/** Create a spare device now, while no WebGPU surface is being created. */
export function prewarmOrreryDevice(): void {
  if (spare) return;
  spare = createDevice();
  spare.catch((error) => {
    console.warn("[lab-c] device prewarm failed", error);
    spare = null;
  });
}

/** Take the spare (or create one). The caller owns and must release it. */
export function acquireOrreryDevice(): Promise<GPUDevice> {
  const taken = spare ?? createDevice();
  spare = null;
  return taken;
}

/** Destroy a mount's device and prewarm the next one off the surface path. */
export function releaseOrreryDevice(device: GPUDevice): void {
  device.destroy();
  setTimeout(prewarmOrreryDevice, 0);
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
