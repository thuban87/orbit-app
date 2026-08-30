import type { PickedContact } from "../../modules/orbit-contact-picker";

/**
 * Split selected provider keys before a bounded SQL IN query. The default limit
 * is deliberately defensive against the common ~999 SQLite bind-variable
 * limit, not a claimed Contacts Provider contract.
 */
export function chunkLookupKeys(
  lookupKeys: readonly string[],
  limit: number,
): string[][] {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(
      "contact lookup-key chunk limit must be a positive integer",
    );
  }

  const chunks: string[][] = [];
  for (let start = 0; start < lookupKeys.length; start += limit) {
    chunks.push(lookupKeys.slice(start, start + limit));
  }
  return chunks;
}

/** Deduplicate native chunk output and restore the user's selected ordering. */
export function mergeSelectedContacts(
  chunkResults: readonly (readonly PickedContact[])[],
  selectedOrder: readonly string[],
): PickedContact[] {
  const contactsByLookupKey = new Map<string, PickedContact>();
  for (const contacts of chunkResults) {
    for (const contact of contacts) {
      if (!contactsByLookupKey.has(contact.lookupKey)) {
        contactsByLookupKey.set(contact.lookupKey, contact);
      }
    }
  }

  const emitted = new Set<string>();
  return selectedOrder.flatMap((lookupKey) => {
    if (emitted.has(lookupKey)) return [];
    emitted.add(lookupKey);
    const contact = contactsByLookupKey.get(lookupKey);
    return contact ? [contact] : [];
  });
}
