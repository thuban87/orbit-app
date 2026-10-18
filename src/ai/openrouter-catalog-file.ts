import { File, Paths } from "expo-file-system";
import {
  loadCachedOpenRouterCatalog,
  type OpenRouterModel,
} from "@/ai/openrouter-catalog";

/**
 * The OpenRouter models in the local on-disk catalog cache, read-only (38.12
 * DEF-03). A local file read, never a provider call (local-first; no egress).
 * Empty when there is no cache or it cannot be read. The model picker owns
 * every refresh write of this file.
 */
export async function readCachedOpenRouterModels(): Promise<
  readonly OpenRouterModel[]
> {
  const catalog = await loadCachedOpenRouterCatalog({
    async read() {
      const file = new File(
        Paths.document,
        "ai",
        "openrouter-model-catalog.json",
      );
      return file.exists ? file.text() : null;
    },
    async write() {
      // Read-only: the picker owns refresh writes.
    },
  });
  return catalog?.models ?? [];
}
