import type { OrreryCategory } from "@/db/orrery-system-read";
import {
  BUILTIN_SYSTEMS,
  type SystemDescriptor,
} from "@/logic/orrery-system-logic";

export function buildSystemChoices(
  categories: readonly OrreryCategory[],
): SystemDescriptor[] {
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
