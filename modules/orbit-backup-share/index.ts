import OrbitBackupShareModule from "./src/OrbitBackupShareModule";

/**
 * Share a staged backup export through the system chooser, granting read access
 * only to the app the user picks (ADR-155). Android-only.
 */
export function shareBackupExport(
  fileUri: string,
  title: string,
): Promise<void> {
  return OrbitBackupShareModule.share(fileUri, "application/json", title);
}

/** Revoke a chosen app's read grant before the staged export is deleted. */
export function revokeBackupExportShare(fileUri: string): void {
  try {
    OrbitBackupShareModule.revoke(fileUri);
  } catch {
    // Best-effort: deleting the file makes any remaining grant unusable.
  }
}
