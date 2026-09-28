import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { getExecutor, localDateTime } from "@/db/database";
import { discardSession } from "@/db/import-session-dao";
import { listSessionRows } from "@/db/import-session-read";
import { deleteImportStaging } from "@/services/photos/photo-storage";
import { Logger } from "@/utils/logger";
import { hasUnresolvedRows } from "./import-leave-guard-logic";

async function discardUnresolvedSession(sessionId: number): Promise<void> {
  const exec = getExecutor();
  const rows = await listSessionRows(exec, sessionId);
  if (!hasUnresolvedRows(rows)) return;
  const stagedPaths = await discardSession(exec, sessionId, localDateTime());
  stagedPaths.forEach(deleteImportStaging);
}

/**
 * Discard accepted-but-uncommitted import ownership when its review is left.
 *
 * Returns `markImportComplete`: call it after a commit succeeds and before the
 * screen's own post-commit navigation (reset to Profile, replace with
 * ImportComplete), so that navigation is not mistaken for abandoning the
 * review and the "Leave import?" prompt does not fire (38.4 D-72).
 */
export function useImportLeaveGuard(
  navigation: NavigationProp<ParamListBase>,
  sessionId: number,
  hasMeaningfulEdits: boolean,
): () => void {
  const leaving = useRef(false);
  const markImportComplete = useCallback(() => {
    leaving.current = true;
  }, []);
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (leaving.current) return;
        event.preventDefault();
        const leave = async () => {
          try {
            await discardUnresolvedSession(sessionId);
          } catch (error) {
            Logger.error(
              "import-leave-guard",
              "failed to discard import session",
              error,
            );
          } finally {
            leaving.current = true;
            navigation.dispatch(event.data.action);
          }
        };
        if (!hasMeaningfulEdits) {
          void leave();
          return;
        }
        Alert.alert(
          "Leave import?",
          "You've made changes. Leaving keeps anything already imported and discards the rest.",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Leave",
              style: "destructive",
              onPress: () => void leave(),
            },
          ],
        );
      }),
    [hasMeaningfulEdits, navigation, sessionId],
  );
  return markImportComplete;
}
