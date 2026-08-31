import type * as ExpoImageManipulator from "expo-image-manipulator";
import { assertSafeRelative } from "@/db/photo-relative-path";
import {
  contactPhotoRelPath,
  persistMaster,
  reconcileStagingRelPath,
  resolveReconcileStagingUri,
  stageReconcilePhoto,
} from "@/services/photos/photo-storage";

const MASTER_SIZE = 512;
const MASTER_COMPRESS = 0.75;

export interface ReconcilePhotoFs {
  stage: (cacheUri: string, relative: string) => Promise<void>;
  resolveStaged: (relative: string) => string | Promise<string>;
  readBytes: (uri: string) => Promise<Uint8Array>;
  resizeToMaster: (uri: string) => Promise<string>;
  persistMaster: (uri: string, relative: string) => Promise<string>;
  contactPhotoRelPath: (contactId: number) => string;
}

/**
 * SHA-256 of the staged bytes as lowercase hex. Hermes exposes no WebCrypto
 * global — `globalThis.crypto` is `undefined` there (uid.ts guards the same
 * value for exactly this reason) — so fall back to RNQC, the app's sole
 * production cryptographic primitive. Both branches emit identical hex, so the
 * hash flowing into `photoContentHash`/the classifier/`reconcile_source_snapshot`
 * is unchanged. The WebCrypto branch is the one node/vitest exercises; the
 * require is delayed so those tests never resolve the native module.
 */
async function digest(bytes: Uint8Array): Promise<string> {
  const webCrypto = globalThis.crypto;
  if (webCrypto?.subtle) {
    const hash = await webCrypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const quickCrypto = require("react-native-quick-crypto") as {
    createHash(algorithm: string): { update(data: Uint8Array): { digest(encoding: string): string } };
  };
  return quickCrypto.createHash("sha256").update(bytes).digest("hex");
}

async function readStagedBytes(uri: string): Promise<Uint8Array> {
  const { File } = await import("expo-file-system");
  return new File(uri).bytes();
}

async function resizeToMaster(uri: string): Promise<string> {
  const { ImageManipulator, SaveFormat } = (await import("expo-image-manipulator")) as typeof ExpoImageManipulator;
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: MASTER_SIZE, height: MASTER_SIZE }).renderAsync();
  return (await rendered.saveAsync({ format: SaveFormat.JPEG, compress: MASTER_COMPRESS })).uri;
}

export const reconcilePhotoFs: ReconcilePhotoFs = {
  stage: stageReconcilePhoto,
  resolveStaged: resolveReconcileStagingUri,
  readBytes: readStagedBytes,
  resizeToMaster,
  persistMaster,
  contactPhotoRelPath,
};

/** Stage the only selected source photo before it enters reconciliation state. */
export async function stageReconcileSourcePhoto(
  cacheUri: string,
  token: string,
  fs: ReconcilePhotoFs = reconcilePhotoFs,
): Promise<{ stagedRelative: string; contentHash: string }> {
  const stagedRelative = reconcileStagingRelPath(token);
  await fs.stage(cacheUri, stagedRelative);
  const contentHash = await digest(await fs.readBytes(await fs.resolveStaged(stagedRelative)));
  return { stagedRelative, contentHash };
}

/** Promote after the main DB apply transaction has committed. */
export async function promoteReconcilePhoto(
  fs: ReconcilePhotoFs,
  params: { contactId: number; stagedRelative: string },
): Promise<string> {
  const relative = fs.contactPhotoRelPath(params.contactId);
  assertSafeRelative(relative);
  const resized = await fs.resizeToMaster(await fs.resolveStaged(params.stagedRelative));
  return fs.persistMaster(resized, relative);
}
