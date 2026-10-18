/**
 * Backup-folder children as `{ uri, name }` pairs (38.12 review A-WR-02,
 * extending D-143).
 *
 * Every backup-file recognition path (pruning, re-encryption, the kept-backups
 * count and the D-136 same-minute suffix) reads `name`, never the URI. A
 * document URI's last segment is the file name only on device storage, whose
 * document ids are paths; Google Drive's ids are opaque
 * (`acc=1;doc=encoded=…`), so a URI-derived name never matched there.
 *
 * Pure: no native import, so it is unit-testable. `saf-storage.ts` feeds it
 * the native listing.
 */

export interface BackupFolderEntry {
  /** The provider URI used to read or delete the file. */
  readonly uri: string;
  /** The file's display name, normalised for backup-name recognition. */
  readonly name: string;
}

/** One child as the native listing reports it. */
export interface RawBackupFolderEntry {
  readonly uri: string;
  readonly name: string | null;
  readonly mimeType: string | null;
}

const JSON_MIME_TYPES = new Set(["application/json", "text/json"]);

/**
 * The last decoded segment of a document URI: the file name on device storage
 * only. Used when the provider gives no display name. Never throws.
 */
export function uriSegmentName(uri: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    decoded = uri;
  }
  return decoded.split("/").pop() ?? "";
}

/**
 * A provider child as a backup-folder entry. The display name is the name;
 * when the provider gives none, the URI segment stands in. A JSON document
 * whose display name has no `.json` extension gets one: Orbit creates backups
 * by stem plus the JSON mime type, and a provider such as Drive can keep the
 * bare stem as the display name.
 */
export function backupFolderEntry(
  raw: RawBackupFolderEntry,
): BackupFolderEntry {
  const displayName = raw.name?.trim();
  if (!displayName) return { uri: raw.uri, name: uriSegmentName(raw.uri) };
  const mimeType = raw.mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const name =
    JSON_MIME_TYPES.has(mimeType) &&
    !displayName.toLowerCase().endsWith(".json")
      ? `${displayName}.json`
      : displayName;
  return { uri: raw.uri, name };
}

/**
 * URIs as entries named by their URI segment (device-storage names). Since
 * 38.12 D-158 the app lists only through the native module; this stays for
 * tests that model a device-storage folder.
 */
export function entriesFromUris(uris: readonly string[]): BackupFolderEntry[] {
  return uris.map((uri) => ({ uri, name: uriSegmentName(uri) }));
}
