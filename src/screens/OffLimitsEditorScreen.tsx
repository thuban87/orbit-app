// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { FuelEditor } from "@/components/FuelEditor";
import { AppText, Button } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import { addFuel, deleteFuel, editFuel } from "@/db/fuel-dao";
import { type FuelItem, listFuelForEditor } from "@/db/fuel-read";
import { newUid } from "@/db/uid";
import type { RootStackScreenProps } from "@/navigation/types";
import { confirm, notice } from "@/stores/confirm-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import { createOffLimitsEditorController } from "./off-limits-editor-controller";

const LOG_SCOPE = "off-limits-editor";

/** Dedicated, kind-scoped editor for the complete Off Limits collection. */
export function OffLimitsEditorScreen({
  navigation,
  route,
}: RootStackScreenProps<"OffLimitsEditor">) {
  const { colors } = useTheme();
  const { contactId } = route.params;
  const [items, setItems] = useState<FuelItem[]>([]);
  const controller = useMemo(
    () =>
      createOffLimitsEditorController({
        contactId,
        dao: {
          listFuelForEditor: (id) => listFuelForEditor(getExecutor(), id),
          addFuel: (input) => addFuel(getExecutor(), input),
          editFuel: (input) => editFuel(getExecutor(), input),
          deleteFuel: (input) => deleteFuel(getExecutor(), input),
        },
        now: localDateTime,
        newUid,
        onItems: setItems,
        onError: (error) => {
          Logger.error(LOG_SCOPE, "failed to update Off Limits", error);
          showSnackbar({
            kind: "error",
            label: "Couldn't update Off Limits. Please try again.",
          });
        },
      }),
    [contactId],
  );

  useFocusEffect(
    useCallback(() => {
      void controller.reload().catch((error) => {
        Logger.error(LOG_SCOPE, "failed to load Off Limits", error);
        void notice({
          title: "Couldn't load Off Limits",
          message: "Please go back and retry.",
        });
      });
    }, [controller]),
  );

  const confirmDelete = useCallback(
    (id: number) => {
      // Irreversible: themed destructive confirm, not dismissable (D-30, ADR-086).
      void confirm({
        title: "Delete off-limits item?",
        message: "This can't be undone.",
        confirmLabel: "Delete",
        destructive: true,
      }).then((ok) => {
        if (ok) void controller.onDelete(id);
      });
    },
    [controller],
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button
          role="tertiary"
          label="Back"
          onPress={() => navigation.goBack()}
        />
        <AppText accessibilityRole="header" role="display">
          Off Limits
        </AppText>
      </View>
      <AppText role="body" style={{ color: colors.textSecondary }}>
        Keep topics here that you want to avoid bringing up.
      </AppText>
      <FuelEditor
        testID="off-limits-editor"
        items={items}
        now={localDateTime()}
        onAdd={controller.onAdd}
        onEdit={(id, patch) => void controller.onEdit(id, patch)}
        onDelete={confirmDelete}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.base, padding: SPACING.base },
  header: { alignItems: "center", flexDirection: "row", gap: SPACING.sm },
});
