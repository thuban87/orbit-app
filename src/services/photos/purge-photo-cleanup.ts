/** Post-commit purge adapter: run durable, reference-checked delete intents. */
import { contactPhotoRelPath } from "@/db/photo-relative-path";
import { listJournalEntriesCore } from "@/db/restore-photo-journal-dao";
import type { SqlExecutor } from "@/db/types";
import { Logger } from "@/utils/logger";
import { executeDeleteIntentOwned } from "./owned-master";

export function buildPhotoPurgeCleanup(
  exec: SqlExecutor,
): (contactId: number) => Promise<void> {
  return async (contactId) => {
    const main = contactPhotoRelPath(contactId);
    const customPrefix = `avatars/cv-${contactId}-`;
    let entries: Awaited<ReturnType<typeof listJournalEntriesCore>>;
    try {
      entries = await listJournalEntriesCore(exec);
    } catch {
      Logger.error(
        "purge-photo-cleanup",
        "failed to read pending photo deletions",
      );
      return;
    }
    for (const entry of entries) {
      if (
        entry.action !== "delete" ||
        (entry.canonicalRelativePath !== main &&
          !entry.canonicalRelativePath.startsWith(customPrefix))
      )
        continue;
      try {
        await executeDeleteIntentOwned(exec, entry.canonicalRelativePath);
      } catch {
        Logger.error(
          "purge-photo-cleanup",
          "post-commit photo deletion pending",
        );
      }
    }
  };
}
