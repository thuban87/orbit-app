/**
 * Device FS binding for the model-catalog cache (14-10).
 *
 * This is the ONLY `expo-file-system` user in the model-catalog feature, mirroring
 * the photo-storage chokepoint pattern — so a future SDK signature drift is a
 * one-file change. It is intentionally SEPARATE from the pure, node-tested
 * `model-catalog-cache.ts` (which takes an injected `CatalogStorage`): keeping the
 * FS import out of the pure module lets Vitest prove the cache logic without
 * mocking native, exactly as `secure-fetch` keeps its native transport separate.
 *
 * The catalog is a device-local, non-relational JSON cache (`ai/model-catalog.json`
 * under `Paths.document`) — the repo's established shape for cached/derived,
 * non-relational data (photos live under the same document dir; dashboard prefs use
 * AsyncStorage). It is deliberately NOT a SQLite migration: it holds no contact
 * data, is fully re-derivable from LiteLLM, and a corrupt/missing cache simply
 * falls back to the bundled seed.
 *
 * NOT unit-tested (native I/O) — proven by on-device UAT, like the secure-fetch
 * native transport.
 */
import { Directory, File, Paths } from "expo-file-system";
import type { CatalogStorage } from "@/ai/model-catalog-cache";

/** The document-dir subdirectory + filename the cached catalog lives in. */
const CATALOG_DIR = "ai";
const CATALOG_FILE = "model-catalog.json";

/** The single File reference for the cached catalog snapshot. */
function catalogFile(): File {
  return new File(Paths.document, CATALOG_DIR, CATALOG_FILE);
}

/**
 * The real `expo-file-system`-backed catalog storage. `read` returns the file
 * text or null when it does not exist yet; `write` ensures the `ai/` directory
 * exists (idempotent) and persists the JSON, creating the file on first write.
 */
export function createFileCatalogStorage(): CatalogStorage {
  return {
    async read(): Promise<string | null> {
      const file = catalogFile();
      if (!file.exists) return null;
      return file.text();
    },
    async write(data: string): Promise<void> {
      // Ensure ai/ exists (idempotent — no throw if already present).
      new Directory(Paths.document, CATALOG_DIR).create({
        intermediates: true,
        idempotent: true,
      });
      const file = catalogFile();
      if (!file.exists) file.create({ intermediates: true });
      file.write(data);
    },
  };
}
