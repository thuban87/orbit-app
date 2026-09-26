import { useEffect } from "react";
import { markImportSessionOpen } from "@/services/import/import-flow-guard";

/**
 * Effect body for {@link useOpenImportSession}: mark `sessionId` open while
 * `active`, returning the release as the cleanup. Inactive marks nothing, so a
 * fatally stopped import can be re-offered by the resume sweep (D-20).
 */
export function openImportSessionEffect(
  sessionId: number,
  active: boolean,
): (() => void) | undefined {
  return active ? markImportSessionOpen(sessionId) : undefined;
}

/** Keep the resume prompt from offering the import session this screen shows. */
export function useOpenImportSession(sessionId: number, active = true): void {
  useEffect(
    () => openImportSessionEffect(sessionId, active),
    [sessionId, active],
  );
}
