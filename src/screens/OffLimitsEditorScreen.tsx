// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { FuelEditor } from "@/components/FuelEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import { addFuel, deleteFuel, editFuel } from "@/db/fuel-dao";
import { type FuelItem, listFuelForEditor } from "@/db/fuel-read";
import { newUid } from "@/db/uid";
import { useContactHeader } from "@/hooks/use-contact-header";
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
  route,
}: RootStackScreenProps<"OffLimitsEditor">) {
  const { colors } = useTheme();
  const { contactId } = route.params;
  // Single-person form: the person line under the fixed title (38.9 D-45).
  const person = useContactHeader(contactId);
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
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Off Limits" person={person} />
      <ScrollView contentContainerStyle={styles.content}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: SPACING.base, padding: SPACING.base },
});
