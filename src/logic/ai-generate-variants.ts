/**
 * ai-generate-variants — the node-pure fan-out that turns the single-draft model
 * call into the ADR-079 three-suggestion set (Phase 35-04, COMP-12 / HIGH-3).
 *
 * `generateVariants` fires `count` concurrent `generateOne(prompt, signal, index)`
 * calls that SHARE the one read-only AbortSignal the lifecycle owns, and resolves
 * the drafts in deterministic order once all succeed. On the first rejection it
 * FAST-FAILS (Promise.all semantics) and propagates that (already-sanitized)
 * error. It does NOT — and CANNOT — call `abort()`: the signal is read-only. The
 * CALLER that owns the AbortController (the AiSuggestionLifecycle) performs the
 * abort on the propagated rejection, which the still-in-flight sibling calls then
 * observe via the shared signal (HIGH-2). An already-aborted signal short-circuits
 * with zero calls.
 *
 * `variantTemperature` is the minimal COMP-12 "meaningfully varied" lever (D-12):
 * a deterministic, pairwise-distinct, in-range temperature per variant index, so
 * the three calls differ deliberately rather than by incidental model
 * nondeterminism. The screen adapter (plan 35-08) applies it inside `generateOne`.
 *
 * NODE-PURE: it imports nothing from the UI runtime or the model-service layer,
 * and never constructs a model input object — `generateOne` (the injected
 * adapter) owns that. Fully proven off-device with Vitest.
 */

/** Fixed spacing between adjacent variant temperatures. */
export const VARIANT_TEMPERATURE_STEP = 0.15;

/** A single model call: given the prompt, the shared signal, and this variant's
 * 0-based index, resolve one draft (or reject with a sanitized error). */
export type GenerateOne<P> = (
  prompt: P,
  signal: AbortSignal,
  variantIndex: number,
) => Promise<string>;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Fan out `count` concurrent `generateOne` calls under the ONE shared read-only
 * signal, passing each its 0-based `variantIndex`, and resolve the drafts in
 * deterministic (index) order. On the first rejection the whole promise rejects
 * with that error (the caller aborts the controller so the siblings cancel). An
 * already-aborted signal short-circuits with zero calls, rejecting with the
 * signal's own abort reason.
 */
export function generateVariants<P>(
  generateOne: GenerateOne<P>,
  prompt: P,
  signal: AbortSignal,
  count = 3,
): Promise<readonly string[]> {
  if (signal.aborted) {
    // Short-circuit: fire NOTHING and surface the signal's own abort reason.
    return Promise.reject(
      signal.reason ?? new DOMException("Aborted", "AbortError"),
    );
  }
  // Promise.all preserves input order regardless of settle order, and fast-fails
  // on the first rejection — exactly the fan-out contract we want.
  return Promise.all(
    Array.from({ length: count }, (_v, index) =>
      generateOne(prompt, signal, index),
    ),
  );
}

/**
 * A deterministic, pairwise-distinct, in-range ([0,1]) temperature for one
 * variant. A fixed-spacing window is centred on `base` and SLID (not clamped
 * per-point) wholly inside `[0, 1 - width]`, so the values never collapse even
 * when `base` sits at an extreme (0 or 1). When the window cannot fit at all
 * (very large `count`), it falls back to an even spread across the full range.
 */
export function variantTemperature(
  base: number,
  variantIndex: number,
  count = 3,
): number {
  const safeBase = clamp01(base);
  if (count <= 1) return safeBase;

  const width = VARIANT_TEMPERATURE_STEP * (count - 1);
  if (width >= 1) {
    // The fixed-spacing window is wider than the range — spread evenly instead.
    return clamp01(variantIndex / (count - 1));
  }
  // Slide the whole window inside [0, 1 - width] so every point is in-range AND
  // distinct (naive per-point clamping would collapse points at the extremes).
  const lo = Math.min(Math.max(safeBase - width / 2, 0), 1 - width);
  return clamp01(lo + variantIndex * VARIANT_TEMPERATURE_STEP);
}
