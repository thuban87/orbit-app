import * as FileSystem from "expo-file-system/legacy";
import { Linking } from "react-native";
import { isOwnedAutomaticBackup } from "@/backup/auto-backup-policy";
import { SafWriteError } from "@/services/backup/saf-write-error";

export interface SafStorage {
  /** Returns the provider URI only after the replacement can be read back. */
  writeVerified(
    directoryUri: string,
    name: string,
    contents: string,
  ): Promise<string>;
  list(directoryUri: string): Promise<string[]>;
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
      let uri: string;
      try {
        uri = await FileSystem.StorageAccessFramework.createFileAsync(
          directoryUri,
          name.replace(/\.json$/, ""),
          "application/json",
        );
      } catch {
        throw new SafWriteError("create");
      }
      try {
        await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, contents);
      } catch {
        throw new SafWriteError("write");
      }
      // A read-back is both an access probe and the durable-write verification.
      try {
        JSON.parse(
          await FileSystem.StorageAccessFramework.readAsStringAsync(uri),
        );
      } catch {
        throw new SafWriteError("read-back");
      }
      return uri;
    },
    list: (directoryUri) =>
      FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri),
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

export function ownedAutomaticUris(uris: string[]): string[] {
  return uris.filter((uri) =>
    isOwnedAutomaticBackup(decodeURIComponent(uri).split("/").pop() ?? ""),
  );
}
