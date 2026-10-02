/**
 * ORRERY LAB C — Paragraph cache for the 3D world's labels (PERFORMANCE.md D.6).
 *
 * The `labels` memo in OrreryWorld3D re-ran `prepareOrreryText` for every body
 * (name + context, ~240 Paragraphs at Dense) on every focus / viewport / scene
 * change and never disposed the old ones. Each RN Skia Paragraph carries a flat
 * 1 MB of Hermes external memory pressure until it is disposed or collected,
 * so focus changes drove GC storms. This cache reuses a Paragraph for an
 * identical (text, role, scale, width, ink colour, font provider) request and
 * disposes entries once the committed label set no longer references them.
 *
 * JS thread only (React resource path), never inside a worklet.
 */
import type { SkTypefaceFontProvider } from "@shopify/react-native-skia";
import type { ThemePalette } from "@/theme/theme-types";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import { type PreparedOrreryText, prepareOrreryText } from "./OrreryLabel";

type Prepare = typeof prepareOrreryText;

let providerSerial = 0;
const providerIds = new WeakMap<object, number>();
function providerId(provider: SkTypefaceFontProvider | null): number {
  if (!provider) return 0;
  let id = providerIds.get(provider);
  if (id === undefined) {
    id = ++providerSerial;
    providerIds.set(provider, id);
  }
  return id;
}

export class OrreryTextCache {
  private entries = new Map<string, PreparedOrreryText>();
  /** Lifetime counters for the renderer log. */
  created = 0;
  disposed = 0;

  constructor(private readonly prepare: Prepare = prepareOrreryText) {}

  get size() {
    return this.entries.size;
  }

  get(
    text: string,
    role: "label" | "caption",
    fontScale: number,
    maxWidth: number,
    fontProvider: SkTypefaceFontProvider | null,
    colors: ThemePalette,
  ): PreparedOrreryText | null {
    if (!fontProvider) return null;
    const ink = colors[TYPOGRAPHY[role].colorToken];
    const key = `${providerId(fontProvider)}\u0001${role}\u0001${fontScale}\u0001${maxWidth}\u0001${ink}\u0001${text}`;
    const hit = this.entries.get(key);
    if (hit) return hit;
    const prepared = this.prepare(
      text,
      role,
      fontScale,
      maxWidth,
      fontProvider,
      colors,
    );
    if (prepared) {
      this.entries.set(key, prepared);
      this.created++;
    }
    return prepared;
  }

  /**
   * Dispose every cached Paragraph that the COMMITTED consumer set no longer
   * references. Called after the consumer (scene label rasters) switched to
   * the new set, so nothing can paint a disposed Paragraph.
   */
  sweep(live: Iterable<PreparedOrreryText | null | undefined>) {
    const keep = new Set<PreparedOrreryText>();
    for (const t of live) if (t) keep.add(t);
    for (const [key, entry] of this.entries)
      if (!keep.has(entry)) {
        this.entries.delete(key);
        disposeText(entry);
        this.disposed++;
      }
  }

  /** Unmount: release everything. */
  clear() {
    for (const entry of this.entries.values()) {
      disposeText(entry);
      this.disposed++;
    }
    this.entries.clear();
  }
}

function disposeText(entry: PreparedOrreryText) {
  (entry.paragraph as { dispose?: () => void }).dispose?.();
}
