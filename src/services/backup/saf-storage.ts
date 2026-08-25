import * as FileSystem from "expo-file-system/legacy";
import { isOwnedAutomaticBackup } from "@/backup/auto-backup-policy";

export interface SafStorage {
  writeVerified(directoryUri: string, name: string, contents: string): Promise<void>;
  list(directoryUri: string): Promise<string[]>;
  remove(uri: string): Promise<void>;
}

export function createSafStorage(): SafStorage {
  return {
    async writeVerified(directoryUri, name, contents) {
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(directoryUri, name.replace(/\.json$/, ""), "application/json");
      await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, contents);
      // A read-back is both an access probe and the durable-write verification.
      JSON.parse(await FileSystem.StorageAccessFramework.readAsStringAsync(uri));
    },
    list: (directoryUri) => FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri),
    remove: (uri) => FileSystem.StorageAccessFramework.deleteAsync(uri),
  };
}

export function ownedAutomaticUris(uris: string[]): string[] {
  return uris.filter((uri) => isOwnedAutomaticBackup(decodeURIComponent(uri).split("/").pop() ?? ""));
}
