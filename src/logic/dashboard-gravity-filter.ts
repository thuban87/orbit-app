/**
 * Reversible Dashboard Gravity/Closeness filtering (RESEARCH A2). Gravity is
 * derived from interaction history at read time, never stored in contacts and
 * never expressed as a SQL WHERE clause. Promoting it to a cached column is an
 * owner decision because it creates a one-way schema commitment.
 */
import type { ImpactInputs } from "@/db/impact-read";
import { computeContactGravity, GRAVITY_TIERS } from "@/services/impact";

export type GravityInputsLoader = (id: number) => Promise<ImpactInputs | null>;

const GRAVITY_TIER_NAMES = new Set(GRAVITY_TIERS.map((tier) => tier.name));

/**
 * Narrow SQL candidates by the selected derived tiers. Iteration is sequential
 * and appends surviving ids in candidate order, deliberately preserving the
 * SQL ORDER BY for Dashboard rendering and search scoping.
 */
export async function filterByGravity(
  candidateIds: readonly number[],
  selectedTiers: readonly string[],
  loadInputs: GravityInputsLoader,
  now: string,
): Promise<number[]> {
  const selected = new Set(
    selectedTiers.filter((tier) => GRAVITY_TIER_NAMES.has(tier)),
  );
  if (selected.size === 0) return [...candidateIds];

  const survivors: number[] = [];
  for (const id of candidateIds) {
    const inputs = await loadInputs(id);
    if (inputs && selected.has(computeContactGravity(inputs, now).tierName)) {
      survivors.push(id);
    }
  }
  return survivors;
}
