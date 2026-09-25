import { useEffect } from "react";
import { markImportSessionOpen } from "@/services/import/import-flow-guard";

/** Keep the resume prompt from offering the import session this screen shows. */
export function useOpenImportSession(sessionId: number): void {
  useEffect(() => markImportSessionOpen(sessionId), [sessionId]);
}
