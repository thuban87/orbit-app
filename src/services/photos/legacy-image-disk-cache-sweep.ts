/**
 * One-time clear of expo-image's legacy DISK cache (38.6 D-01, privacy).
 *
 * Avatars used `cachePolicy="memory-disk"` until 38.6, which left decoded
 * avatars — including photos of since-deleted contacts — in Glide's disk cache.
 * Local avatars are now memory-only, so nothing reads or overwrites those
 * entries again (ExpoImageViewWrapper.kt:444). This launch-sweep hook clears
 * them once with `Image.clearDiskCache()`.
 *
 * The flag is a DEVICE-LOCAL AsyncStorage key (versioned-key idiom of
 * `use-read-contacts-permission.ts`), deliberately NOT an `app_settings` column:
 * the cache it describes is device-local, so it needs no migration and must not
 * travel in a backup. The flag is written only after a successful clear, so a
 * failed clear retries next launch. The hook never rejects. `clearDiskCache`
 * touches only expo-image's disk cache — never a photo master or the DB.
 */
import { registerSweepHook } from "@/services/launch-sweep";
import { Logger } from "@/utils/logger";

/** Versioned device-local flag: set once the legacy disk cache was cleared. */
export const LEGACY_IMAGE_DISK_CACHE_CLEARED_KEY =
  "expo_image_disk_cache_cleared_v1";

const LOG_SCOPE = "legacy-image-disk-cache-sweep";

export interface LegacyImageDiskCacheDeps {
  readFlag(): Promise<boolean>;
  writeFlag(): Promise<void>;
  clearDiskCache(): Promise<boolean>;
}

/**
 * Clear the legacy disk cache unless the flag says it already happened. A
 * flag-read failure counts as unset (clearing twice is harmless); a failed or
 * `false` clear leaves the flag unwritten so the next launch retries. Every
 * failure is logged; nothing is rethrown.
 */
export async function clearLegacyImageDiskCacheOnce(
  deps: LegacyImageDiskCacheDeps,
): Promise<void> {
  let cleared = false;
  try {
    cleared = await deps.readFlag();
  } catch (error) {
    Logger.error(LOG_SCOPE, "flag read failed; treating as unset", error);
  }
  if (cleared) return;
  let ok = false;
  try {
    ok = await deps.clearDiskCache();
  } catch (error) {
    Logger.error(LOG_SCOPE, "disk cache clear failed", error);
    return;
  }
  if (!ok) {
    Logger.error(LOG_SCOPE, "disk cache clear reported false; will retry");
    return;
  }
  try {
    await deps.writeFlag();
  } catch (error) {
    Logger.error(LOG_SCOPE, "flag write failed; will clear again", error);
  }
}

async function readFlag(): Promise<boolean> {
  try {
    const { default: AsyncStorage } = await import(
      "@react-native-async-storage/async-storage"
    );
    return (
      (await AsyncStorage.getItem(LEGACY_IMAGE_DISK_CACHE_CLEARED_KEY)) ===
      "true"
    );
  } catch {
    return false;
  }
}

async function writeFlag(): Promise<void> {
  try {
    const { default: AsyncStorage } = await import(
      "@react-native-async-storage/async-storage"
    );
    await AsyncStorage.setItem(LEGACY_IMAGE_DISK_CACHE_CLEARED_KEY, "true");
  } catch {
    // Flag persistence only avoids a repeat clear; a repeat clear is harmless.
  }
}

async function clearDiskCache(): Promise<boolean> {
  const { Image } = await import("expo-image");
  return Image.clearDiskCache();
}

/** Register the one-time clear on the launch-sweep registry (App.tsx, once). */
export function registerLegacyImageDiskCacheSweep(): void {
  registerSweepHook(
    () =>
      clearLegacyImageDiskCacheOnce({ readFlag, writeFlag, clearDiskCache }),
    { id: "legacy-image-disk-cache" },
  );
}
