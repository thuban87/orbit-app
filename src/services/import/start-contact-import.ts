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
   */
  ensureNotesAccess?: () => Promise<boolean>;
  readByLookupKeys?: (
    lookupKeys: readonly string[],
  ) => Promise<PickedContact[]>;
  /**
   * Discard an app-cache photo copy. The provider re-read copies each contact's
   * photo into `contact-picker-*.photo`; only notes are used, so those copies are
   * retired immediately (AUD-DPI-011 / D-16).
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

/** Merge provider-read notes into picked contacts; never blocks the import. */
async function withNotes(
  picked: PickedContact[],
  ensureNotesAccess: StartContactImportOptions["ensureNotesAccess"],
  readByLookupKeys: StartContactImportOptions["readByLookupKeys"],
  discardPhotoCopy: StartContactImportOptions["discardPhotoCopy"],
): Promise<PickedContact[]> {
  if (picked.length === 0 || !ensureNotesAccess || !readByLookupKeys) {
    return picked;
  }
  try {
    if (!(await ensureNotesAccess())) return picked;
    const read = await readByLookupKeys(picked.map((c) => c.lookupKey));
    for (const copy of read) {
      if (!copy.photoTempUri) continue;
      try {
        discardPhotoCopy?.(copy.photoTempUri);
      } catch {
        // Best-effort: the cold-start cache sweep retires any survivor.
      }
    }
    const notes = new Map(read.map((c) => [c.lookupKey, c.note ?? null]));
    return picked.map((c) =>
      c.note == null && notes.get(c.lookupKey)
        ? { ...c, note: notes.get(c.lookupKey) }
        : c,
    );
  } catch {
    return picked;
  }
}
