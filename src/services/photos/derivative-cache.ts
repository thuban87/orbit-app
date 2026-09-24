/** Best-effort retirement of app-owned, evictable photo copies (RG-013). */
import { Directory, File, Paths } from "expo-file-system";
import { registerSweepHook } from "@/services/launch-sweep";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "derivative-cache";
const PROCESS_STARTED_AT = Date.now();
let swept = false;

export interface DerivativeCacheEntry {
  uri: string;
  modificationTime: number | null;
}

export interface DerivativeCacheFs {
  cacheUri: string;
  delete(uri: string): void;
  list(directoryUri: string): DerivativeCacheEntry[];
}

function productionFs(): DerivativeCacheFs {
  return {
    cacheUri: Paths.cache.uri,
    delete: (uri) => new File(uri).delete(),
    list: (uri) => {
      const directory = new Directory(uri);
      if (!directory.exists) return [];
      return directory
        .list()
        .flatMap((entry) =>
          entry instanceof File
            ? [
                {
                  uri: entry.uri,
                  modificationTime: entry.info().modificationTime ?? null,
                },
              ]
            : [],
        );
    },
  };
}

/** Resolve file URIs before checking prefixes; reject encoded paths and URI extras. */
function resolvedFileUri(input: string): string | null {
  try {
    if (input.includes("%")) return null;
    const url = new URL(input);
    if (url.protocol !== "file:" || url.host || url.search || url.hash)
      return null;
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function allowedUri(uri: string, cacheUri: string): string | null {
  const path = resolvedFileUri(uri);
  const cache = resolvedFileUri(cacheUri);
  if (!path || !cache) return null;
  if (path.startsWith(`${cache}/ImageManipulator/`)) return path;
  if (path.startsWith(`${cache}/photo-dl/`)) return path;
  if (path.startsWith(`${cache}/`)) {
    const name = path.slice(cache.length + 1);
    if (/^contact-picker-[^/]+\.photo$/.test(name)) return path;
  }
  return null;
}

/** Never throw: cache cleanup cannot change a successful save or mask its error. */
export function discardDerivative(
  uri: string,
  fs: DerivativeCacheFs = productionFs(),
): boolean {
  try {
    const safe = allowedUri(uri, fs.cacheUri);
    if (!safe) {
      Logger.warn(LOG_SCOPE, "cache discard refused outside owned namespace");
      return false;
    }
    fs.delete(safe);
    return true;
  } catch {
    Logger.warn(LOG_SCOPE, "cache discard failed");
    return false;
  }
}

/** The launch runner may fire again on foreground return; this body runs once. */
export function sweepDerivativeCacheOncePerProcess(
  fs: DerivativeCacheFs = productionFs(),
): void {
  if (swept) return;
  swept = true;
  for (const directory of [
    `${fs.cacheUri.replace(/\/$/, "")}/ImageManipulator`,
    `${fs.cacheUri.replace(/\/$/, "")}/photo-dl`,
    fs.cacheUri,
  ]) {
    try {
      for (const entry of fs.list(directory)) {
        if (
          entry.modificationTime !== null &&
          entry.modificationTime < PROCESS_STARTED_AT
        ) {
          discardDerivative(entry.uri, fs);
        }
      }
    } catch {
      Logger.warn(LOG_SCOPE, "cache sweep namespace failed");
    }
  }
}

export function registerDerivativeCacheSweep(): void {
  registerSweepHook(async () => sweepDerivativeCacheOncePerProcess(), {
    id: "derivative-cache",
  });
}

/** Test-only reset; production never resets the cold-start guard. */
export function __resetDerivativeCacheSweepForTest(): void {
  swept = false;
}
