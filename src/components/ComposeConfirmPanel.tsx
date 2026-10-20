/**
 * ComposeConfirmPanel — Compose's "Did you send it?" panel (38.14).
 *
 * Presentational only: ComposeScreen owns the writes (through the one assist
 * runner, D-08) and the panel claim (D-23). The three answers are the carried
 * D-01 set — Yes, log it / No, don't log / Later — in a `ConfirmActions`
 * measure-and-stack row (D-11, ADR-174 :38), so Yes sits on the right like the
 * dialogs (D-73) and the row stacks at large text instead of wrapping.
 *
 * While `pending` (a write is in flight) every answer is disabled; the screen's
 * synchronous latch is what guarantees write-once, this is the visible state.
 * Every colour resolves through theme tokens (CLAUDE.md).
 */
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { ConfirmActions } from "@/components/ui/ConfirmDialog";
import { useTheme } from "@/theme";

export const COMPOSE_PANEL_LABELS = {
  heading: "Did you send it?",
  yes: "Yes, log it",
  dismiss: "No, don't log",
  later: "Later",
} as const;

type ComposeConfirmPanelProps = {
  /** True while a Yes / No write is in flight: disables every answer. */
  pending: boolean;
  onYes: () => void;
  onDismiss: () => void;
  onLater: () => void;
};

export function ComposeConfirmPanel({
  pending,
  onYes,
  onDismiss,
  onLater,
}: ComposeConfirmPanelProps) {
  const { colors } = useTheme();
  return (
    <View
      testID="compose-confirm"
      style={[
        styles.panel,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <AppText role="heading">{COMPOSE_PANEL_LABELS.heading}</AppText>
      <ConfirmActions
        cancelLabel={COMPOSE_PANEL_LABELS.later}
        secondaryLabel={COMPOSE_PANEL_LABELS.dismiss}
        confirmLabel={COMPOSE_PANEL_LABELS.yes}
        destructive={false}
        cancelDisabled={pending}
        secondaryDisabled={pending}
        confirmDisabled={pending}
        onCancel={onLater}
        onSecondary={onDismiss}
        onConfirm={onYes}
        testIDs={{
          cancel: "compose-confirm-later",
          secondary: "compose-confirm-dismiss",
          confirm: "compose-confirm-yes",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
});
