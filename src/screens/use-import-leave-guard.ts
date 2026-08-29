import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { getExecutor, localDateTime } from "@/db/database";
import { discardSession } from "@/db/import-session-dao";
import { listSessionRows } from "@/db/import-session-read";
import { deleteImportStaging } from "@/services/photos/photo-storage";
import { Logger } from "@/utils/logger";

async function discardUnresolvedSession(sessionId: number): Promise<void> {
  const exec = getExecutor();
  const rows = await listSessionRows(exec, sessionId);
  if (!rows.some((row) => row.contactId === null)) return;
  const stagedPaths = await discardSession(exec, sessionId, localDateTime());
  stagedPaths.forEach(deleteImportStaging);
}

/** Discard accepted-but-uncommitted import ownership when its review is left. */
export function useImportLeaveGuard(
  navigation: NavigationProp<ParamListBase>,
  sessionId: number,
  hasMeaningfulEdits: boolean,
): void {
  const leaving = useRef(false);
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
}
