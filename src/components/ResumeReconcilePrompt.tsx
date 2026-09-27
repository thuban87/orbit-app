import { type NavigationProp, useNavigation } from "@react-navigation/native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getExecutor, localDateTime } from "@/db/database";
import { discardSession } from "@/db/reconcile-session-dao";
import { navigateIntoTab } from "@/navigation/tab-entry";
import type { TabParamList } from "@/navigation/types";
import {
  cleanupDiscardedReconcileStagedPhotos,
  type ResumableReconcile,
} from "@/services/import/reconcile-resume-sweep";
import { deleteReconcileStaging } from "@/services/photos/photo-storage";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

type RootNavigation = NavigationProp<TabParamList>;

export interface ResumeReconcilePromptProps {
  resumable: ResumableReconcile | null;
  onDismiss(): void;
  onDiscarded?(): void;
}

/** App-root, explicit-action-only recovery sheet for a durable check. */
export function ResumeReconcilePrompt({
  resumable,
  onDismiss,
  onDiscarded,
}: ResumeReconcilePromptProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<RootNavigation>();
  // D-49: inset by the safe area so the bounded card never meets the bars.
  const insets = useSafeAreaInsets();
  if (!resumable) return null;
  const discard = async () => {
    try {
      const stagedPaths = await discardSession(
        getExecutor(),
        resumable.sessionId,
        localDateTime(),
      );
      cleanupDiscardedReconcileStagedPhotos(
        { deleteReconcileStaging },
        stagedPaths,
      );
      onDismiss();
      onDiscarded?.();
    } catch (error) {
      Logger.error("resume-reconcile-prompt", "could not discard check", error);
    }
  };
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => undefined}
    >
      <View
        style={[
          styles.modalRoot,
          {
            paddingTop: insets.top + SPACING.lg,
            paddingBottom: insets.bottom + SPACING.lg,
          },
        ]}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.scrim,
            { backgroundColor: colors.background },
          ]}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          {/* D-49: the heading and body give up height first and scroll at
              large text; the actions below stay outside, always reachable. */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
          >
            <Text style={[styles.heading, { color: colors.textPrimary }]}>
              Resume your check?
            </Text>
            <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
              {resumable.discardOnly
                ? "This saved check can’t be resumed. You can discard its unresolved contacts. Changes you already applied stay applied."
                : "Unresolved contacts are saved. Changes you already applied stay applied."}
            </Text>
          </ScrollView>
          {!resumable.discardOnly ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resume check"
              onPress={() => {
                navigateIntoTab(navigation, "SettingsTab", "ReconcileGrid", {
                  sessionId: resumable.sessionId,
                });
                onDismiss();
              }}
              style={[styles.button, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>
                Resume
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Discard check"
            onPress={() => void discard()}
            style={[
              styles.button,
              styles.discardButton,
              { borderColor: colors.danger },
            ]}
          >
            <Text style={[styles.buttonLabel, { color: colors.danger }]}>
              Discard
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  scrim: { opacity: 0.85 },
  // flexShrink: the card never outgrows the (safe-area inset) window (D-49).
  sheet: {
    flexShrink: 1,
    gap: 14,
    padding: 20,
    borderWidth: 1,
    borderRadius: 12,
  },
  heading: { fontSize: 18, fontWeight: "700" },
  // Bounded scroll body: short copy keeps its height, tall copy scrolls (D-49).
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { gap: 14 },
  bodyText: { fontSize: 15, lineHeight: 22 },
  button: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  discardButton: { borderWidth: 1 },
  buttonLabel: { fontSize: 16, fontWeight: "700" },
});
