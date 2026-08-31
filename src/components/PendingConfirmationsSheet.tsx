import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AssistConfirmation } from "@/components/AssistConfirmation";
import { getExecutor, localDateTime } from "@/db/database";
import {
  markAssistDismissed,
  markAssistLogged,
} from "@/db/interaction-assist-dao";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { useAssistBanner } from "@/stores/assist-store";
import { useTheme } from "@/theme";

function questionFor(channel: "call" | "text" | "email", name: string): string {
  switch (channel) {
    case "call":
      return `Did you reach ${name}?`;
    case "text":
      return `Did you text ${name}?`;
    case "email":
      return `Did you email ${name}?`;
  }
}

/** A transient queue review surface for pending Interaction Assist confirmations. */
export function PendingConfirmationsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const queue = useAssistBanner((state) => state.queue);
  const refresh = useAssistBanner((state) => state.refresh);

  const confirm = async (uid: string, connected: 0 | 1, note?: string) => {
    await markAssistLogged(getExecutor(), {
      assistUid: uid,
      connected,
      note,
      now: localDateTime(),
    });
    notifyWidgetDataChanged();
    await refresh();
  };

  const dismiss = async (uid: string) => {
    await markAssistDismissed(getExecutor(), {
      assistUid: uid,
      now: localDateTime(),
    });
    await refresh();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Dismiss pending confirmations"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.scrim,
              { backgroundColor: colors.background },
            ]}
          />
        </Pressable>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.textPrimary }]}
          >
            Pending confirmations
          </Text>
          {queue.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                You're all caught up
              </Text>
              <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                No confirmations waiting.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {queue.map((assist) => (
                <View
                  key={assist.uid}
                  style={[styles.item, { borderColor: colors.border }]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.question, { color: colors.textPrimary }]}
                  >
                    {questionFor(assist.channel, assist.contact_name)}
                  </Text>
                  <AssistConfirmation
                    channel={assist.channel}
                    onConfirm={(connected, note) =>
                      confirm(assist.uid, connected, note)
                    }
                    onDismiss={() => dismiss(assist.uid)}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  scrim: { opacity: 0.85 },
  sheet: {
    maxHeight: "80%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: "700" },
  list: { gap: 12 },
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    gap: 10,
  },
  question: { fontSize: 16, fontWeight: "700" },
  empty: { gap: 4, paddingVertical: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyBody: { fontSize: 15 },
});
