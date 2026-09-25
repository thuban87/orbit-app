/**
 * Human provenance for linked-contact reconcile options (RG-031). Every Android
 * source shares one provider, so a provider label ("Contacts (android)") cannot
 * tell two linked phone contacts apart. Label each source by its own phone
 * contact name; duplicate names are numbered in link order so options stay
 * distinguishable, and a nameless source still reads as a phone contact.
 */
export function reconcileSourceLabels(
  sources: readonly { displayName: string | null }[],
): string[] {
  const bases = sources.map(({ displayName }) => {
    const name = displayName?.trim();
    return name ? `Phone contact “${name}”` : "Phone contact";
  });
  const totals = new Map<string, number>();
  for (const base of bases) totals.set(base, (totals.get(base) ?? 0) + 1);
  const seen = new Map<string, number>();
  return bases.map((base) => {
    if ((totals.get(base) ?? 0) < 2) return base;
    const index = (seen.get(base) ?? 0) + 1;
    seen.set(base, index);
    return `${base} (${index})`;
  });
}
