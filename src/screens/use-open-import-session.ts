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

/**
 * BulkImportSetup's hold policy (38.3 review B-CR-02, D-20). Setup is PUSHED
 * under ImportProgress and stays mounted, and the open-session mark is
 * refcounted, so a Setup that held the session while hidden kept the count
 * above zero after ImportProgress released it on a fatal stop — the resume
 * sweep could never re-offer the session. Setup therefore holds the session
 * only while it is the focused screen; ImportProgress owns the hold while the
 * run is on screen.
 */
export function bulkSetupHoldActive(isFocused: boolean): boolean {
  return isFocused;
}

/** ImportProgress holds the session until a fatal stop (D-20). */
export function importProgressHoldActive(
  phase: "running" | "stopped",
): boolean {
  return phase !== "stopped";
}

/** Keep the resume prompt from offering the import session this screen shows. */
export function useOpenImportSession(sessionId: number, active = true): void {
  useEffect(
    () => openImportSessionEffect(sessionId, active),
    [sessionId, active],
  );
}
