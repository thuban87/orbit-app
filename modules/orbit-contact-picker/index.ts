import { File } from "expo-file-system";
import {
  chunkLookupKeys,
  mergeSelectedContacts,
} from "../../src/logic/contact-picker-chunk";
import type { ContactSummary } from "../../src/logic/contact-picker-source";
import OrbitContactPickerModule from "./src/OrbitContactPickerModule";

export interface PickedMethod {
  readonly type: "phone" | "email";
  readonly value: string;
  /**
   * Raw ContactsContract TYPE code (Phone.TYPE / Email.TYPE, DATA2); null when
   * the provider did not return it. Mapped to Orbit's label set by its
   * consumer, never here (D-102).
   */
  readonly typeCode?: number | null;
  /**
   * Raw ContactsContract LABEL (DATA3) for TYPE_CUSTOM; null when the provider
   * did not return one (D-102).
   */
  readonly customLabel?: string | null;
}

export interface PickedContact {
  readonly lookupKey: string;
  readonly displayName: string | null;
  readonly methods: PickedMethod[];
  readonly birthday: string | null;
  /** Freeform Android Contacts note, when the provider grants it. */
  readonly note?: string | null;
  /**
   * App-private cache copy of a picker-granted photo. This `file://` value is
   * intentionally evictable and must be moved to durable staging by the
   * import-session acceptance flow before it is persisted.
   */
  readonly photoTempUri: string | null;
  /**
   * App-private cache copy of the provider thumbnail, present only when
   * `photoTempUri` holds the full-size copy (a `preferFullSize` import read).
   * Used by "Import with smaller photos" (D-133); evictable like photoTempUri.
   */
  readonly thumbnailTempUri?: string | null;
  /**
   * SHA-256 lowercase hex of the phone's thumbnail bytes, else of the
   * full-size bytes when the phone has no thumbnail. Stable across Orbit's
   * thumbnail-to-full-size switch (D-118), so Check linked contacts can tell an
   * already-adopted phone photo from a changed one (D-132).
   */
  readonly photoFingerprint?: string | null;
  /**
   * JS-only (38.12 D-147): set when the person chose "Import without photos"
   * for a contact that had a phone photo. The import then records that photo
   * as reviewed, so Check linked contacts does not offer it again. Never set
   * by the native module.
   */
  readonly photoDeclined?: boolean;
}

export interface PickContactsOptions {
  readonly multiple: boolean;
}

export type { ContactSummary } from "../../src/logic/contact-picker-source";

/** Selected-key provider read result. Missing contacts are benign omissions. */
export interface SelectedReadResult {
  readonly contacts: PickedContact[];
  readonly omittedCount: number;
}

// A tunable defensive limit below the classic ~999 SQLite bind-variable limit.
// It is not a Contacts Provider contract.
export const CONTACT_LOOKUP_KEY_CHUNK_LIMIT = 900;

/** True only on Android 17 (API 37) or newer. */
export function isContactPickerAvailable(): boolean {
  return OrbitContactPickerModule.isContactPickerAvailable();
}

/**
 * Opens Android's privacy-preserving system Contact Picker. The native module
 * snapshots the temporary picker grant before resolving and returns an empty
 * list when the user cancels or the picker is unavailable.
 */
export function pickContacts(
  options: PickContactsOptions,
): Promise<PickedContact[]> {
  return OrbitContactPickerModule.pickContacts(options);
}

/**
 * Reads Contacts Provider data for Orbit's legacy (API <= 36) in-app picker.
 * The native module rejects read failures so callers never mistake one for a
 * cancelled picker.
 */
export function listContactsSummary(): Promise<ContactSummary[]> {
  return OrbitContactPickerModule.listContactsSummary();
}

export interface ReadContactsOptions {
  /**
   * D-137: full-size photos are import-only. Import reads pass true (full-size
   * first, thumbnail copy handed over separately); the default false keeps
   * today's thumbnail-first bytes for Check linked contacts. photoFingerprint
   * is emitted either way (D-132).
   */
  readonly preferFullSize?: boolean;
}

export interface ReadAllContactsOptions extends ReadContactsOptions {
  /** Keys per native provider read; defaults to CONTACT_LOOKUP_KEY_CHUNK_LIMIT. */
  readonly chunkLimit?: number;
}

/** Read one bounded provider chunk; an empty chunk must never query the provider. */
export function readContactsByLookupKeys(
  lookupKeys: readonly string[],
  options?: ReadContactsOptions,
): Promise<PickedContact[]> {
  if (lookupKeys.length === 0) return Promise.resolve([]);
  return OrbitContactPickerModule.readContactsByLookupKeys(
    [...lookupKeys],
    options?.preferFullSize ?? false,
  );
}

export function readAllContacts(): Promise<PickedContact[]>;
export function readAllContacts(
  lookupKeys: readonly string[],
  options?: ReadAllContactsOptions,
): Promise<SelectedReadResult>;
/**
 * The legacy no-argument path remains backwards-compatible for non-browse
 * callers. The picker itself uses only the selected-key path below.
 */
export async function readAllContacts(
  lookupKeys?: readonly string[],
  options?: ReadAllContactsOptions,
): Promise<PickedContact[] | SelectedReadResult> {
  if (lookupKeys === undefined)
    return OrbitContactPickerModule.readAllContacts();

  // UI selection is a Set, but deduplicating here protects the native IN query
  // and gives omittedCount stable semantics for direct callers too.
  const selectedOrder = [...new Set(lookupKeys)];
  if (selectedOrder.length === 0) return { contacts: [], omittedCount: 0 };

  const chunkLimit = options?.chunkLimit ?? CONTACT_LOOKUP_KEY_CHUNK_LIMIT;
  const preferFullSize = options?.preferFullSize ?? false;
  const completedChunks: PickedContact[][] = [];
  try {
    for (const chunk of chunkLookupKeys(selectedOrder, chunkLimit)) {
      completedChunks.push(
        await readContactsByLookupKeys(chunk, { preferFullSize }),
      );
    }
  } catch (error) {
    // A completed chunk can have already copied a full contact photo into cache.
    // Best-effort cleanup preserves the original provider failure for the caller.
    for (const photoUri of completedChunks
      .flat()
      .flatMap((contact) => [contact.photoTempUri, contact.thumbnailTempUri])
      .filter((uri): uri is string => uri != null)) {
      try {
        new File(photoUri).delete();
      } catch {
        // Cache cleanup failure must not hide the provider read failure.
      }
    }
    throw error;
  }

  const contacts = mergeSelectedContacts(completedChunks, selectedOrder);
  return {
    contacts,
    omittedCount: selectedOrder.length - contacts.length,
  };
}
