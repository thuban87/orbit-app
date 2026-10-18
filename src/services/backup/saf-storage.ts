import * as FileSystem from "expo-file-system/legacy";
import { Linking } from "react-native";
import { isOwnedAutomaticBackupName } from "@/backup/backup-file-names";
import {
  type BackupFolderEntry,
  backupFolderEntry,
  entriesFromUris,
} from "@/backup/backup-folder-entries";
import { listBackupFolderEntries } from "../../../modules/orbit-backup-document-picker";

export type { BackupFolderEntry } from "@/backup/backup-folder-entries";

export interface SafStorage {
  /** Returns the provider URI only after the replacement can be read back. */
  writeVerified(
    directoryUri: string,
    name: string,
    contents: string,
  ): Promise<string>;
  /**
   * The folder's children with their display names (38.12 review A-WR-02).
   * Recognise backup files by `name`, never by the URI: on Google Drive the
   * URI's last segment is an opaque id.
   */
  list(directoryUri: string): Promise<BackupFolderEntry[]>;
  remove(uri: string): Promise<void>;
}

/** The narrow read capability required by the resumable re-encryption protocol. */
export interface SafReadableStorage extends SafStorage {
  read(uri: string): Promise<string>;
}

/** SAF picker/open bridge; screens never inspect content URIs or provider paths. */
export interface SafFolderAdapter {
  requestDirectory(initialUri?: string): Promise<{
    readonly granted: boolean;
    readonly directoryUri?: string;
  }>;
  canOpen(uri: string): Promise<boolean>;
  open(uri: string): Promise<void>;
}

export function createSafStorage(): SafReadableStorage & SafFolderAdapter {
  return {
    async writeVerified(directoryUri, name, contents) {
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(
        directoryUri,
        name.replace(/\.json$/, ""),
        "application/json",
      );
      await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, contents);
      // A read-back is both an access probe and the durable-write verification.
      JSON.parse(
        await FileSystem.StorageAccessFramework.readAsStringAsync(uri),
      );
      return uri;
    },
    async list(directoryUri) {
      // The provider's own names (works on Drive). If the native listing is
      // unavailable, the URI listing still names device-storage files right.
      let native: Awaited<ReturnType<typeof listBackupFolderEntries>> = null;
      try {
        native = await listBackupFolderEntries(directoryUri);
      } catch {
        native = null;
      }
      if (native) return native.map(backupFolderEntry);
      return entriesFromUris(
        await FileSystem.StorageAccessFramework.readDirectoryAsync(
          directoryUri,
        ),
      );
    },
    remove: (uri) => FileSystem.StorageAccessFramework.deleteAsync(uri),
    read: (uri) => FileSystem.StorageAccessFramework.readAsStringAsync(uri),
    requestDirectory: (initialUri) =>
      FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
        initialUri,
      ),
    canOpen: (uri) => Linking.canOpenURL(uri),
    open: (uri) => Linking.openURL(uri),
  };
}

/** The folder's automatic backups (D-136), recognised by display name. */
export function ownedAutomaticEntries(
  entries: readonly BackupFolderEntry[],
): BackupFolderEntry[] {
  return entries.filter((entry) => isOwnedAutomaticBackupName(entry.name));
}
