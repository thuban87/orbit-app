/** Closed System identities; independent of Dashboard selection/search/sort state. */
import {
  assertOrreryLastSystem,
  ORRERY_BUILTIN_SYSTEM_IDS,
  type OrrerySystemId,
} from "@/db/app-settings-dao";
import {
  ACTIVE_SEGREGATION_WHERE,
  buildFilterWhere,
  DASHBOARD_POPULATION_SCOPE_WHERE,
  FAVOURITES_WHERE,
  NOT_CONTACTED_WHERE,
  type PopulationWhere,
  SNOOZED_WHERE,
} from "@/logic/dashboard-query-logic";

export type OrreryBuiltinId =
  | "all-contacts"
  | "favorites"
  | "needs-attention"
  | "not-contacted"
  | "snoozed"
  | "chargers";
export type OrrerySystemRef =
  | { kind: "builtin"; id: OrreryBuiltinId }
  | { kind: "category"; uid: string };
export interface SystemDescriptor {
  ref: OrrerySystemRef;
  id: OrrerySystemId;
  name: string;
}
export const ALL_CONTACTS_SYSTEM: OrrerySystemRef = {
  kind: "builtin",
  id: "all-contacts",
};
export const BUILTIN_SYSTEM_LABELS: Record<OrreryBuiltinId, string> = {
  "all-contacts": "All Contacts",
  favorites: "Favorites",
  "needs-attention": "Needs Attention",
  "not-contacted": "Not Contacted",
  snoozed: "Snoozed",
  chargers: "Chargers",
};
export function parseSystemRef(value: unknown): OrrerySystemRef | null {
  try {
    assertOrreryLastSystem("System", value);
  } catch {
    return null;
  }
  const token = value as OrrerySystemId;
  if (token.startsWith("category:"))
    return { kind: "category", uid: token.slice(9) };
  return { kind: "builtin", id: token.slice(8) as OrreryBuiltinId };
}
export function systemRefId(system: OrrerySystemRef): OrrerySystemId {
  const token =
    system.kind === "category"
      ? `category:${system.uid}`
      : `builtin:${system.id}`;
  assertOrreryLastSystem("System", token);
  return token as OrrerySystemId;
}
export const BUILTIN_SYSTEMS: SystemDescriptor[] =
  ORRERY_BUILTIN_SYSTEM_IDS.map((id) => {
    const ref = parseSystemRef(id) as Extract<
      OrrerySystemRef,
      { kind: "builtin" }
    >;
    return { id, ref, name: BUILTIN_SYSTEM_LABELS[ref.id] };
  });

/** Shared by member reads and narrow target validation. Runtime values stay bound. */
export function buildOrrerySystemWhere(
  system: OrrerySystemRef,
): PopulationWhere {
  systemRefId(system); // Validate even callers crossing an untyped boundary.
  if (system.kind === "category")
    return {
      sql: `${ACTIVE_SEGREGATION_WHERE} AND EXISTS (SELECT 1 FROM categories cat WHERE cat.id=c.category_id AND cat.uid=?)`,
      params: [system.uid],
    };
  switch (system.id) {
    case "all-contacts":
      return { sql: DASHBOARD_POPULATION_SCOPE_WHERE, params: [] };
    case "not-contacted":
      return {
        sql: `${DASHBOARD_POPULATION_SCOPE_WHERE} AND ${NOT_CONTACTED_WHERE}`,
        params: [],
      };
    case "favorites":
      return {
        sql: `${ACTIVE_SEGREGATION_WHERE} AND ${FAVOURITES_WHERE}`,
        params: [],
      };
    case "snoozed":
      return {
        sql: `${ACTIVE_SEGREGATION_WHERE} AND ${SNOOZED_WHERE}`,
        params: [],
      };
    case "needs-attention": {
      const filter = buildFilterWhere({ "needs-attention": ["on"] });
      return {
        sql: `${ACTIVE_SEGREGATION_WHERE} AND (${filter.sql})`,
        params: filter.params,
      };
    }
    case "chargers": {
      const filter = buildFilterWhere({ "social-battery": ["Charger"] });
      return {
        sql: `${ACTIVE_SEGREGATION_WHERE} AND (${filter.sql})`,
        params: filter.params,
      };
    }
  }
}
