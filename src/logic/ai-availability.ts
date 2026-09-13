/**
 * ai-availability — the stable three-state AI-availability adapter Compose
 * consumes (Phase 35-04, COMP-09 / D-07 / D-12).
 *
 * AI availability is THREE-state, not binary (D-07): AI Off removes every AI
 * affordance; AI On + Ready exposes the normal actions; AI On + Needs Attention
 * REPLACES the AI actions with a restrained "AI needs attention" repair notice
 * rather than letting AI silently vanish.
 *
 * This module is the STABLE INTERFACE (swap-internals-later discipline, mirroring
 * app-settings-dao's read-shape/validate-on-write contract): Compose consumes
 * `AiAvailability` + `computeAiAvailability` and computes no availability state
 * itself. The implementation here is the PROVISIONAL D-12 derivation from what
 * exists today — Off = provider `'none'`; Ready = provider set + credential
 * present; Needs-Attention = provider set + credential missing/invalid. Phase 36
 * later replaces this derivation (and the polished repair flow) WITHOUT touching
 * Compose. The Needs-Attention repair route targets the EXISTING AI settings
 * surface as an interim — no new provider-troubleshooting UI here.
 *
 * The adapter is PURE over its inputs: it takes the provider id and a
 * credential-present signal (the caller supplies presence from the existing
 * key store) and reads no secret itself, so Phase 36 can swap the credential
 * source without changing Compose.
 *
 * NODE-PURE: no UI-runtime import.
 */
import type { AiProviderId } from "@/services/ai-types";

/** The three availability states Compose renders against (D-07). */
export type AiAvailability = "off" | "ready" | "needs-attention";

/** The pure inputs the provisional D-12 derivation reads. */
export interface AiAvailabilityInput {
  /** The active AI provider; `'none'` disables generation entirely. */
  readonly provider: AiProviderId;
  /**
   * Whether a usable credential is present for `provider` — supplied by the
   * caller from the existing key store. The adapter never reads a secret itself.
   * For a provider that needs no stored credential the caller passes `true`.
   */
  readonly hasCredential: boolean;
}

/**
 * Derive the three-state availability from the provider id + credential-present
 * signal (provisional D-12 implementation). Pure over its inputs.
 */
export function computeAiAvailability(
  input: AiAvailabilityInput,
): AiAvailability {
  if (input.provider === "none") return "off";
  return input.hasCredential ? "ready" : "needs-attention";
}

/**
 * The affordance posture the Compose screen renders for a given availability
 * state (COMP-09 / D-07, UI-SPEC E6). Manual composition and Research are usable
 * in EVERY state — AI availability never gates them. Only the AI actions
 * (Draft / Rewrite / Add-to-AI / Message Focus) change:
 *
 *   - `off`             → no AI affordance at all (manual + Research only).
 *   - `ready`           → the AI actions are exposed.
 *   - `needs-attention` → a restrained "AI needs attention" repair notice
 *                         REPLACES the AI actions. It does NOT silently hide AI
 *                         (`repairNotice` is shown) and does NOT restore the AI
 *                         actions (`showAiActions` stays false). The notice
 *                         routes toward the existing AI settings surface (D-12);
 *                         Compose is never a provider-troubleshooting surface.
 */
export interface AiAffordancePosture {
  /** Manual composition is usable — ALWAYS true. */
  readonly manualComposition: boolean;
  /** Research (Things to Remember) is usable — ALWAYS true. */
  readonly research: boolean;
  /** Whether the AI actions are exposed (Ready only). */
  readonly showAiActions: boolean;
  /** Whether the restrained repair notice is shown (Needs-Attention only). */
  readonly repairNotice: boolean;
}

/** Map an availability state to its screen affordance posture (pure). */
export function selectAiAffordance(
  availability: AiAvailability,
): AiAffordancePosture {
  return {
    // Manual composition and Research are never gated by AI availability.
    manualComposition: true,
    research: true,
    showAiActions: availability === "ready",
    repairNotice: availability === "needs-attention",
  };
}
