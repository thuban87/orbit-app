import { useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AssistConfirmation } from "@/components/AssistConfirmation";
import { PendingConfirmationsSheet } from "@/components/PendingConfirmationsSheet";
import { getExecutor, localDateTime } from "@/db/database";
import {
  markAssistDismissed,
  markAssistLogged,
} from "@/db/interaction-assist-dao";
import {
  ASSIST_FAILURE_COPY,
  publishAssistCommit,
  publishAssistDismissal,
  runAssistAction,
} from "@/services/assist-commit";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { useAssistBanner } from "@/stores/assist-store";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import type { InFlightRef } from "@/utils/single-flight";

const LOG_SCOPE = "assist-banner";

function logFailure(message: string, error: unknown): void {
  Logger.error(LOG_SCOPE, message, error);
}

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
  const [reviewOpen, setReviewOpen] = useState(false);
  // 38.3 RG-023 / D-08: the ref is the synchronous double-tap latch (a state
  // flag alone cannot stop two taps in one tick); `pending` drives the UI only.
  // Both are declared above the early return (Rules of Hooks).
  const latchRef = useRef<InFlightRef>({ current: false });
  const [pending, setPending] = useState(false);

  if (!newest) {
    return reviewOpen ? (
      <PendingConfirmationsSheet
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />
    ) : null;
  }

  const assistUid = newest.uid;

  // Confirm/dismiss run through the shared runner + publisher
  // (src/services/assist-commit.ts). Both handlers always resolve: a write
  // failure shows an Alert and leaves the assist pending; a publication failure
  // after the commit is only logged, never reported as "couldn't log" (D-04).
  const confirm = async (connected: 0 | 1, note?: string) => {
    setPending(true);
    const result = await runAssistAction({
      latch: latchRef.current,
      write: () =>
        markAssistLogged(getExecutor(), {
          assistUid,
          connected,
          note,
          now: localDateTime(),
        }),
      publish: () =>
        publishAssistCommit({
          notifyWidget: notifyWidgetDataChanged,
          bumpShell: bumpShellRefresh,
          refreshQueue: refresh,
          logFailure,
        }),
      onError: (kind) => {
        const copy = ASSIST_FAILURE_COPY.log[kind];
        Alert.alert(copy.title, copy.body);
      },
      logFailure,
    });
    if (result !== "busy") setPending(false);
  };

  const dismiss = async () => {
    setPending(true);
    const result = await runAssistAction({
      latch: latchRef.current,
      write: () =>
        markAssistDismissed(getExecutor(), {
          assistUid,
          now: localDateTime(),
        }),
      publish: () =>
        publishAssistDismissal({ refreshQueue: refresh, logFailure }),
      onError: () => {
        const copy = ASSIST_FAILURE_COPY.dismiss.generic;
        Alert.alert(copy.title, copy.body);
      },
      logFailure,
    });
    if (result !== "busy") setPending(false);
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${morePendingCount} more pending`}
            onPress={() => setReviewOpen(true)}
            style={styles.pendingCount}
          >
            <Text style={{ color: colors.accent }}>
              {morePendingCount} more pending
            </Text>
          </Pressable>
        ) : null}
        <AssistConfirmation
          key={newest.uid}
          channel={newest.channel}
          onConfirm={confirm}
          onDismiss={dismiss}
        />
      </View>
      <PendingConfirmationsSheet
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />
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
    minHeight: 44,
    justifyContent: "center",
    fontSize: 15,
    fontWeight: "600",
  },
});
