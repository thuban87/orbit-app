import type { OrrerySatellite } from "@/db/orrery-satellites-read";
/** Original Unicode text is presentation, never identity or inferred relationship type. */
export function satelliteContext(row: OrrerySatellite, parentName: string) {
  return {
    name: row.personName,
    relation: row.relationType
      ? `${row.relationType} of ${parentName}`
      : `A key person for ${parentName}`,
  };
}
