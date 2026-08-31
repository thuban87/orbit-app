import { StyleSheet, Text, View } from "react-native";
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

/** A shell overlay that leaves Android Back untouched. */
export function AssistBanner() {
  const { colors } = useTheme();
  const newest = useAssistBanner((state) => state.newest);
  const morePendingCount = useAssistBanner((state) => state.morePendingCount);
  const refresh = useAssistBanner((state) => state.refresh);

  if (!newest) {
    return null;
  }

  const confirm = async (connected: 0 | 1, note?: string) => {
    await markAssistLogged(getExecutor(), {
      assistUid: newest.uid,
      connected,
      note,
      now: localDateTime(),
    });
    notifyWidgetDataChanged();
    await refresh();
  };

  const dismiss = async () => {
    await markAssistDismissed(getExecutor(), {
      assistUid: newest.uid,
      now: localDateTime(),
    });
    await refresh();
  };

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View
        style={[
          styles.banner,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.question, { color: colors.textPrimary }]}
        >
          {questionFor(newest.channel, newest.contact_name)}
        </Text>
        {morePendingCount > 0 ? (
          <Text style={[styles.pendingCount, { color: colors.accent }]}>
            {morePendingCount} more pending
          </Text>
        ) : null}
        <AssistConfirmation
          key={newest.uid}
          channel={newest.channel}
          onConfirm={confirm}
          onDismiss={dismiss}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 64,
    right: 12,
    left: 12,
    zIndex: 32,
    elevation: 32,
  },
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  question: {
    fontSize: 16,
    fontWeight: "700",
  },
  pendingCount: {
    fontSize: 15,
    fontWeight: "600",
  },
});
