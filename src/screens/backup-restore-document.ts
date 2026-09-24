import { File } from "expo-file-system";

/** Restore copies belong to Orbit's cache and are consumed exactly once. */
export async function readRestoreDocument(uri: string): Promise<string> {
  const file = new File(uri);
  try {
    return await file.text();
  } finally {
    file.delete();
  }
}
