import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";
import { BackHandler } from "react-native";
import { shellTransientStore } from "@/stores/shell-transient-store";

/**
 * Completion screens where Back means "leave the finished flow" (owner ruling
 * 38.9 D-73; review WR-07): on "Import complete" and "Check complete", header
 * Back and system Back act like Done instead of returning to the flow's setup
 * screen. The header Back gets the same `done` through `ShellAppBar`'s
 * `onBack`, which already lets an open shell transient close first.
 *
 * The system-Back handler, as a pure factory: an open shell transient (menu,
 * dial) keeps first refusal (RootNavigator closes it); otherwise Back runs
 * `done` and is consumed so the native stack does not pop.
 */
export function completionBackHandler(
  done: () => void,
  isAnyTransientOpen: () => boolean,
): () => boolean {
  return () => {
    if (isAnyTransientOpen()) return false;
    done();
    return true;
  };
}

/**
 * Registers the system-Back handler while the screen is focused (the
 * useFocusEffect + BackHandler idiom of CaptureScreen / ComposeScreen).
 */
export function useBackActsAsDone(done: () => void): void {
  const doneRef = useRef(done);
  doneRef.current = done;
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        completionBackHandler(
          () => doneRef.current(),
          () => shellTransientStore.getState().isAnyOpen(),
        ),
      );
      return () => subscription.remove();
    }, []),
  );
}
