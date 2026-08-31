import type { ReconcileDiffResult } from "@/logic/reconcile-diff";

/**
 * Source-wins bulk application is only safe for a non-empty selection whose
 * every surfaced difference is additive and non-photo. Photos remain an
 * explicit, side-by-side manual choice even when Orbit currently has none.
 */
export function isAdditiveOnlySelection(
  cards: readonly ReconcileDiffResult[],
): boolean {
  return (
    cards.length > 0 &&
    cards.every(
      (card) =>
        !card.missingSource &&
        card.fields.length > 0 &&
        card.fields.every(
          (field) =>
            field.outcome === "additive" && field.fieldFamily !== "photo",
        ),
    )
  );
}
