/**
 * ADR-027 retains derived-never-stored Gravity, complete history with an ancient
 * floor, and the recency-mirroring connected scope (applied by impact.ts).
 * Phase08 dossier §E/§Z and ORRC-03/15 authorize modest Orrery mass/context,
 * partially superseding its old profile-only/Orrery-rejection display clauses.
 * Plan29-12 owns that KB handoff; Gravity/intensity policy is unchanged.
 */
import type { ImpactInputs } from "@/db/impact-read";
import type { ReadOnlyExecutor } from "@/db/transaction";

export const ORRERY_IMPACT_CHUNK_SIZE = 256;
interface ImpactRow {
  id: number;
  tracking_enabled: number;
  interval_days: number | null;
  rarely_responds: number;
  occurred_at: string | null;
  connected: number | null;
  direction: string | null;
}

/** No mutex/BEGIN here: compose through the snapshot callback's ro only. */
export async function readOrreryImpactInputsCore(
  exec: ReadOnlyExecutor,
  contactIds: readonly number[],
): Promise<Map<number, ImpactInputs>> {
  const ids = [
    ...new Set(contactIds.filter((id) => Number.isSafeInteger(id) && id > 0)),
  ];
  const inputs = new Map<number, ImpactInputs>();
  for (
    let offset = 0;
    offset < ids.length;
    offset += ORRERY_IMPACT_CHUNK_SIZE
  ) {
    const chunk = ids.slice(offset, offset + ORRERY_IMPACT_CHUNK_SIZE);
    const rows = await exec.getAllAsync<ImpactRow>(
      `SELECT c.id,c.tracking_enabled,c.interval_days,c.rarely_responds,
              i.occurred_at,i.connected,i.direction
       FROM contacts c LEFT JOIN interactions i ON i.contact_id=c.id
       WHERE c.id IN (${chunk.map(() => "?").join(",")})
       ORDER BY c.id,i.occurred_at DESC,i.id DESC`,
      chunk,
    );
    for (const row of rows) {
      let input = inputs.get(row.id);
      if (!input) {
        input = {
          trackingEnabled: row.tracking_enabled,
          intervalDays: row.interval_days,
          rarelyResponds: row.rarely_responds,
          interactions: [],
        };
        inputs.set(row.id, input);
      }
      if (row.occurred_at !== null)
        input.interactions.push({
          occurredAt: row.occurred_at,
          connected: row.connected as number,
          direction: row.direction,
        });
    }
  }
  return inputs;
}
