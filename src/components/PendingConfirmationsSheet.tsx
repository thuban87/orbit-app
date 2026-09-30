import { useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AssistConfirmation } from "@/components/AssistConfirmation";
import { Avatar } from "@/components/Avatar";
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
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import type { InFlightRef } from "@/utils/single-flight";

/** Per-row contact avatar diameter (40): the queued contact's photo or initials (38.6 D-14). */
const PENDING_AVATAR_SIZE = SPACING["2xl"] - SPACING.sm;

const LOG_SCOPE = "pending-confirmations";

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
  // 38.3 RG-023 / D-08: one synchronous latch PER ASSIST (a double tap on one
  // row is blocked; a different row stays usable), plus the pending uids for UI.
  // Latches are kept for the sheet's lifetime; the queue holds at most five
  // pending assists, so the map stays tiny.
  const latchesRef = useRef(new Map<string, InFlightRef>());
  const [pendingUids, setPendingUids] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const latchFor = (uid: string): InFlightRef => {
    let latch = latchesRef.current.get(uid);
    if (!latch) {
      latch = { current: false };
      latchesRef.current.set(uid, latch);
    }
    return latch;
  };

  const markPending = (uid: string, isPending: boolean) => {
    setPendingUids((previous) => {
      if (previous.has(uid) === isPending) return previous;
      const next = new Set(previous);
      if (isPending) next.add(uid);
      else next.delete(uid);
      return next;
    });
  };

  // Same contract as AssistBanner (src/services/assist-commit.ts): handlers
  // always resolve; a write failure shows an Alert and leaves the assist
  // pending; a post-commit publication failure is logged only (D-04).
  const confirm = async (uid: string, connected: 0 | 1, note?: string) => {
    markPending(uid, true);
    const result = await runAssistAction({
      latch: latchFor(uid),
      write: () =>
        markAssistLogged(getExecutor(), {
          assistUid: uid,
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
      onError: (kind, error) => {
        logFailure("assist confirm failed", error);
        const copy = ASSIST_FAILURE_COPY.log[kind];
        Alert.alert(copy.title, copy.body);
      },
      // 38.3 review B-WR-05: dismissed/expired before this confirm — nothing
      // was logged, so say so and only refresh the queue.
      onClosed: () =>
        Alert.alert(
          ASSIST_FAILURE_COPY.closed.title,
          ASSIST_FAILURE_COPY.closed.body,
        ),
      publishClosed: () =>
        publishAssistDismissal({ refreshQueue: refresh, logFailure }),
      logFailure,
    });
    if (result !== "busy") markPending(uid, false);
  };

  const dismiss = async (uid: string) => {
    markPending(uid, true);
    const result = await runAssistAction({
      latch: latchFor(uid),
      write: () =>
        markAssistDismissed(getExecutor(), {
          assistUid: uid,
          now: localDateTime(),
        }),
      publish: () =>
        publishAssistDismissal({ refreshQueue: refresh, logFailure }),
      onError: (_kind, error) => {
        logFailure("assist dismiss failed", error);
        const copy = ASSIST_FAILURE_COPY.dismiss.generic;
        Alert.alert(copy.title, copy.body);
      },
      logFailure,
    });
    if (result !== "busy") markPending(uid, false);
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
                  {/* One TalkBack stop with one label (review WR2-04): the
                      Avatar's "Photo of …" must not read the name twice. */}
                  <View
                    accessible
                    accessibilityLabel={questionFor(
                      assist.channel,
                      assist.contact_name,
                    )}
                    style={styles.questionRow}
                  >
                    <Avatar
                      photo={assist.contact_photo}
                      name={assist.contact_name}
                      contactId={assist.contact_id}
                      size={PENDING_AVATAR_SIZE}
                    />
                    <Text
                      numberOfLines={1}
                      style={[styles.question, { color: colors.textPrimary }]}
                    >
                      {questionFor(assist.channel, assist.contact_name)}
                    </Text>
                  </View>
                  <AssistConfirmation
                    channel={assist.channel}
                    onConfirm={(connected, note) =>
                      confirm(assist.uid, connected, note)
                    }
                    onDismiss={() => dismiss(assist.uid)}
                    pending={pendingUids.has(assist.uid)}
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
  questionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  question: { flex: 1, fontSize: 16, fontWeight: "700" },
  empty: { gap: 4, paddingVertical: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyBody: { fontSize: 15 },
});
