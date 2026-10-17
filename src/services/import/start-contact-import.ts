import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SqlExecutor } from "@/db/types";
import type { RootStackParamList } from "@/navigation/types";
import type { ContactImportMode } from "@/screens/use-contact-import-mode";
import { routePickedImport } from "@/services/import/import-acquire";
import { withImportFlowActive } from "@/services/import/import-flow-guard";
import type { PickedContact } from "../../../modules/orbit-contact-picker";

type AppNavigate = NativeStackNavigationProp<RootStackParamList>["navigate"];

export interface StartContactImportOptions {
  mode: ContactImportMode;
  exec: SqlExecutor;
  effectivePhoneRegion: string | null;
  now: string;
  pick: () => Promise<PickedContact[]>;
  /**
   * Notes enrichment for the API-37 system picker, which cannot supply notes
   * (requesting the note mimetype makes it reject the whole pick). After a
   * non-empty pick, `ensureNotesAccess` asks for READ_CONTACTS in context
   * (ADR-003's existing grant, ADR-154); when granted, `readByLookupKeys` re-reads the
   * picked contacts and their notes are merged in. Denied → import proceeds
   * without notes.
   *
   * The re-read is an import path, so it always asks for full-size photos
   * (D-118, D-137); the lookup URI reliably returns them under READ_CONTACTS.
   */
  ensureNotesAccess?: () => Promise<boolean>;
  readByLookupKeys?: (
    lookupKeys: readonly string[],
    options: { preferFullSize: boolean },
  ) => Promise<PickedContact[]>;
  /**
   * Discard an app-cache photo copy. When the re-read returns a photo it
   * replaces the picker-session copies, which are retired; a re-read copy that
   * is not used is retired too (AUD-DPI-011 / D-16).
   */
  discardPhotoCopy?: (uri: string) => void;
  /** Wider than PickedImportNavigator so it can open LegacyContactPicker too. */
  navigate: AppNavigate;
}

/**
 * Dispatch contact acquisition at the sole SDK-routing seam. System results
 * enter the existing shared import sink; the legacy screen calls that same sink
 * after its user chooses contacts.
 */
export async function startContactImport({
  mode,
  exec,
  effectivePhoneRegion,
  now,
  pick,
  ensureNotesAccess,
  readByLookupKeys,
  discardPhotoCopy,
  navigate,
}: StartContactImportOptions): Promise<void> {
  if (mode === "legacy") {
    navigate("LegacyContactPicker");
    return;
  }

  await withImportFlowActive(async () => {
    const picked = await withNotes(
      await pick(),
      ensureNotesAccess,
      readByLookupKeys,
      discardPhotoCopy,
    );
    await routePickedImport(
      exec,
      picked,
      { effectivePhoneRegion, now },
      { navigate: (route, params) => navigate(route, params) },
    );
  });
}

/**
 * Merge provider-read notes into picked contacts and prefer the re-read's
 * full-size photo (D-118, D-137); never blocks the import.
 */
async function withNotes(
  picked: PickedContact[],
  ensureNotesAccess: StartContactImportOptions["ensureNotesAccess"],
  readByLookupKeys: StartContactImportOptions["readByLookupKeys"],
  discardPhotoCopy: StartContactImportOptions["discardPhotoCopy"],
): Promise<PickedContact[]> {
  if (picked.length === 0 || !ensureNotesAccess || !readByLookupKeys) {
    return picked;
  }
  let read: PickedContact[];
  try {
    if (!(await ensureNotesAccess())) return picked;
    read = await readByLookupKeys(
      picked.map((c) => c.lookupKey),
      { preferFullSize: true },
    );
  } catch {
    return picked;
  }

  const discard = (uri: string | null | undefined) => {
    if (!uri) return;
    try {
      discardPhotoCopy?.(uri);
    } catch {
      // Best-effort: the cold-start cache sweep retires any survivor.
    }
  };
  const byKey = new Map<string, PickedContact>();
  for (const copy of read) {
    if (byKey.has(copy.lookupKey)) {
      discard(copy.photoTempUri);
      discard(copy.thumbnailTempUri);
    } else {
      byKey.set(copy.lookupKey, copy);
    }
  }
  const adopted = new Set<string>();
  const merged = picked.map((contact) => {
    const copy = byKey.get(contact.lookupKey);
    if (!copy) return contact;
    let next =
      contact.note == null && copy.note
        ? { ...contact, note: copy.note }
        : contact;
    if (copy.photoTempUri && !adopted.has(contact.lookupKey)) {
      adopted.add(contact.lookupKey);
      // The re-read's photo (lookup URI, full-size) replaces the picker copy.
      discard(contact.photoTempUri);
      discard(contact.thumbnailTempUri);
      next = {
        ...next,
        photoTempUri: copy.photoTempUri,
        thumbnailTempUri: copy.thumbnailTempUri ?? null,
        photoFingerprint: copy.photoFingerprint ?? null,
      };
    }
    return next;
  });
  // Retire re-read copies no picked contact took (no photo adopted for them).
  for (const copy of byKey.values()) {
    if (adopted.has(copy.lookupKey)) continue;
    discard(copy.photoTempUri);
    discard(copy.thumbnailTempUri);
  }
  return merged;
}
