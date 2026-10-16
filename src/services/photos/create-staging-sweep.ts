/**
 * Launch/foreground orphan sweep for Add Contact's held photos (38.11 D-77).
 *
 * The `create-staging/` namespace holds a picked photo only while an Add
 * Contact form is open. Nothing in the database ever references it (RESEARCH
 * A3: keep it create-only), so every file there that no live form owns is an
 * orphan: a form left without saving whose unmount cleanup did not run, or an
 * app kill. The launch sweep also runs on every real background -> active
 * transition (`launch-sweep.ts`), which includes returning from the system
 * photo picker, so a live form's files are protected by its active staging
 * session (`staging-sessions.ts`) and kept.
 *
 * Importing this module runs nothing; `registerCreateStagingSweep` adds the
 * hook, and App.tsx registers it once.
 */
import { registerSweepHook } from "@/services/launch-sweep";
import { pendingBelongsToActiveSession } from "@/services/photos/staging-sessions";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "create-staging-sweep";

/** The injectable file boundary (production: photo-storage). */
export interface CreateStagingFs {
  listCreateStagingPhotos(): Array<{
    relative: string;
    isStageTmpOrphan: boolean;
  }>;
  deleteCreateStaging(relative: string): void;
}

async function nativeCreateStagingFs(): Promise<CreateStagingFs> {
  const { deleteCreateStaging, listCreateStagingPhotos } = await import(
    "@/services/photos/photo-storage"
  );
  return { deleteCreateStaging, listCreateStagingPhotos };
}

/** Delete every create-staging file that no active Add Contact form owns. */
export async function sweepOrphanCreateStaging(
  fs?: CreateStagingFs,
): Promise<void> {
  try {
    const boundary = fs ?? (await nativeCreateStagingFs());
    for (const staged of boundary.listCreateStagingPhotos()) {
      if (pendingBelongsToActiveSession(staged.relative)) continue;
      boundary.deleteCreateStaging(staged.relative);
    }
  } catch (error) {
    // Cleanup only: a failure here must never fail the launch sweep.
    Logger.error(LOG_SCOPE, "create staging sweep failed", error);
  }
}

/** Register the sweep on the launch registry; importing does no work. */
export function registerCreateStagingSweep(
  options: { fs?: CreateStagingFs } = {},
): void {
  registerSweepHook(() => sweepOrphanCreateStaging(options.fs));
}
