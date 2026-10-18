import * as FileSystem from "expo-file-system/legacy";
import { Linking } from "react-native";
import { isOwnedAutomaticBackupName } from "@/backup/backup-file-names";
import {
  type BackupFolderEntry,
  backupFolderEntry,
} from "@/backup/backup-folder-entries";
import {
  createBackupFolderDocument,
  deleteBackupFolderDocument,
  listBackupFolderEntries,
  type NativeBackupFolderEntry,
  readBackupFolderDocument,
  writeBackupFolderDocument,
} from "../../../modules/orbit-backup-document-picker";

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

/**
 * The backup folder's file operations (38.12 D-158). Every create, write,
 * read, list and delete goes through Orbit's own native backup module
 * (DocumentsContract / ContentResolver), so any document provider works,
 * Google Drive included. expo-file-system's legacy StorageAccessFramework
 * treated only device-storage URIs as SAF and refused Drive outright; it is
 * kept only for the folder picker, which works on every provider.
 */
export interface BackupFolderNative {
  createDocument(
    treeUri: string,
    displayName: string,
    mimeType: string,
  ): Promise<string>;
  write(documentUri: string, contents: string): Promise<void>;
  read(documentUri: string): Promise<string>;
  remove(documentUri: string): Promise<void>;
  list(treeUri: string): Promise<readonly NativeBackupFolderEntry[] | null>;
}

const nativeBackupFolder: BackupFolderNative = {
  createDocument: createBackupFolderDocument,
  write: writeBackupFolderDocument,
  read: readBackupFolderDocument,
  remove: deleteBackupFolderDocument,
  list: listBackupFolderEntries,
};

export function createSafStorage(
  native: BackupFolderNative = nativeBackupFolder,
): SafReadableStorage & SafFolderAdapter {
  return {
    async writeVerified(directoryUri, name, contents) {
      // The full name, ".json" included: a provider such as Drive keeps the
      // name exactly as given, and device storage keeps a matching extension.
      const uri = await native.createDocument(
        directoryUri,
        name,
        "application/json",
      );
      try {
        await native.write(uri, contents);
        // A read-back is both an access probe and the durable-write verification.
        JSON.parse(await native.read(uri));
      } catch (error) {
        // Never leave an empty or partial file that looks like a backup.
        try {
          await native.remove(uri);
        } catch {
          /* keep the original failure */
        }
        throw error;
      }
      return uri;
    },
    async list(directoryUri) {
      // The provider's own names (works on Drive). A failed listing is a
      // failure, never an empty folder: callers keep their own fallbacks.
      const entries = await native.list(directoryUri);
      if (!entries) throw new Error("The backup folder could not be listed.");
      return entries.map(backupFolderEntry);
    },
    remove: (uri) => native.remove(uri),
    read: (uri) => native.read(uri),
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
