import { useNavigation } from "@react-navigation/native";
import { useEffect, type RefObject } from "react";
import { Alert } from "react-native";

type DiscardKeepGuardOptions = {
  hasUnsavedChanges: boolean;
  bypassRef: RefObject<boolean>;
};

/**
 * Blocks route removal only while a focused workflow has meaningful unsaved
 * changes. Callers set the bypass immediately before a confirmed-save route
 * transition so the completed save can leave without a second confirmation.
 */
export function useDiscardKeepGuard({
  hasUnsavedChanges,
  bypassRef,
}: DiscardKeepGuardOptions): void {
  const navigation = useNavigation();

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (bypassRef.current || !hasUnsavedChanges) {
          return;
        }

        event.preventDefault();
        Alert.alert("Discard changes?", "Your unsaved changes will be lost.", [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.dispatch(event.data.action),
          },
        ]);
      }),
    [bypassRef, hasUnsavedChanges, navigation],
  );
}
