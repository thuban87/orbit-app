import type { OrreryCategory } from "@/db/orrery-system-read";
import type { SystemCatalogEntry } from "@/db/systems-catalog-read";
import type { CustomSystem } from "@/db/systems-dao";
import {
  BUILTIN_SYSTEMS,
  type SystemDescriptor,
  systemRefId,
} from "@/logic/orrery-system-logic";

export type SystemChoice = SystemDescriptor & {
  /** Null means this row is waiting for its progressive count result. */
  count: number | null;
  severity: "none" | "empty" | "broken";
  overrides: boolean;
};

export function buildSystemChoices(
  catalog: readonly SystemCatalogEntry[],
  counts: ReadonlyMap<string, number>,
  broken: ReadonlyMap<string, boolean>,
): SystemChoice[];
export function buildSystemChoices(
  categories: readonly OrreryCategory[],
  customSystems?: readonly CustomSystem[],
): SystemDescriptor[];

export function buildSystemChoices(
  source: readonly SystemCatalogEntry[] | readonly OrreryCategory[],
  countsOrCustom: ReadonlyMap<string, number> | readonly CustomSystem[] = [],
  broken: ReadonlyMap<string, boolean> = new Map(),
): SystemChoice[] | SystemDescriptor[] {
  // The selector renders once with an empty catalog while its read is in
  // flight. Inspecting a row cannot discriminate that state, so discriminate
  // by the second argument instead: selector callers always supply a count
  // map, while the legacy Management caller supplies a CustomSystem array.
  if (
    typeof (countsOrCustom as ReadonlyMap<string, number>).get === "function"
  ) {
    const catalog = source as readonly SystemCatalogEntry[];
    const counts = countsOrCustom as ReadonlyMap<string, number>;
    const builtinOrder = new Map(
      BUILTIN_SYSTEMS.map((row, index) => [row.id, index]),
    );
    return catalog
      .filter((row) => !row.hidden)
      .sort((a, b) => {
        const aAll = a.id === "builtin:all-contacts";
        const bAll = b.id === "builtin:all-contacts";
        if (aAll || bAll) return aAll ? -1 : 1;
        const aOrdered = a.displayOrder !== null;
        const bOrdered = b.displayOrder !== null;
        if (aOrdered || bOrdered) {
          if (!aOrdered) return 1;
          if (!bOrdered) return -1;
          if (a.displayOrder !== b.displayOrder)
            return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
        }
        const rank = (row: SystemCatalogEntry) =>
          row.ref.kind === "builtin" ? 0 : row.ref.kind === "category" ? 1 : 2;
        const rankDifference = rank(a) - rank(b);
        if (rankDifference) return rankDifference;
        if (a.ref.kind === "builtin" && b.ref.kind === "builtin")
          return (builtinOrder.get(a.id) ?? 0) - (builtinOrder.get(b.id) ?? 0);
        if (a.ref.kind === "category" && b.ref.kind === "category")
          return (
            (a.categoryOrder ?? 0) - (b.categoryOrder ?? 0) ||
            a.id.localeCompare(b.id)
          );
        if (a.ref.kind === "custom" && b.ref.kind === "custom")
          return (
            (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
            a.id.localeCompare(b.id)
          );
        return a.id.localeCompare(b.id);
      })
      .map((row) => {
        const id = systemRefId(row.ref);
        const count = counts.get(id) ?? null;
        return {
          ref: row.ref,
          id,
          name: row.name,
          count,
          severity: broken.get(id) ? "broken" : count === 0 ? "empty" : "none",
          overrides: row.hasOverrides,
        };
      });
  }
  const categories = source as readonly OrreryCategory[];
  const customSystems = countsOrCustom as readonly CustomSystem[];
  return [
    ...BUILTIN_SYSTEMS,
    ...[...categories]
      .sort(
        (a, b) =>
          a.display_order - b.display_order ||
          (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0),
      )
      .map(
        (row): SystemDescriptor => ({
          id: `category:${row.uid}`,
          ref: { kind: "category", uid: row.uid },
          name: row.name,
        }),
      ),
    ...customSystems.map(
      (row): SystemDescriptor => ({
        id: `custom:${row.uid}`,
        ref: { kind: "custom", uid: row.uid },
        name: row.name,
      }),
    ),
  ];
}
export function systemSelectorLabel(name: string): string {
  return `Choose System. Current System: ${name}`;
}
export function registerSystemSelectorTransient(
  registry: {
    openTransient: (id: string, dismiss: () => void) => void;
    closeTransient: (id: string) => void;
  },
  latest: { current: () => void },
  restore: () => void,
) {
  const id = "orrery-system-selector";
  registry.openTransient(id, () => latest.current());
  return () => {
    registry.closeTransient(id);
    restore();
  };
}
export function systemEmptyCopy(
  name: string,
  allContacts: boolean,
  qualifyingSun: boolean,
) {
  if (qualifyingSun)
    return {
      heading: "Your contacts are centered here",
      body: "Open the contact at the center or choose another System.",
    };
  if (allContacts)
    return {
      heading: "No contacts in your Orrery yet",
      body: "Add a contact and choose a contact frequency to include them here.",
    };
  return {
    heading: `No contacts in ${name}`,
    body: "Choose another System to explore your contacts.",
  };
}
