import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AssistConfirmation } from "@/components/AssistConfirmation";
import { Avatar } from "@/components/Avatar";
import {
  markNoteDirty,
  PENDING_AVATAR_SIZE,
  PENDING_ROW_GAP,
  PENDING_ROW_INNER_GAP,
  PENDING_ROW_PADDING_BOTTOM,
  PENDING_SHEET_GAP,
  pendingSheetVariantFor,
  pruneDirtyNotes,
  shouldPromptOnSheetClose,
} from "@/components/pending-confirmations-sheet-logic";
import { Button } from "@/components/ui/Button";
import type { SizedSheetVariant } from "@/components/ui/option-sheet-logic";
import { Sheet } from "@/components/ui/Sheet";
import { useSheetFitEnvironment } from "@/components/use-sheet-fit-environment";
import { CLOSE } from "@/constants/glossary";
import { getExecutor, localDateTime } from "@/db/database";
import {
  markAssistDismissed,
  markAssistLogged,
} from "@/db/interaction-assist-dao";
import type { EligiblePendingAssist } from "@/db/interaction-assist-read";
import {
  assistAnswerSnackbar,
  assistDestinationLine,
} from "@/logic/assist-display";
import { confirmDiscard } from "@/navigation/discard-keep-guard";
import {
  ASSIST_FAILURE_COPY,
  publishAssistCommit,
  publishAssistDismissal,
  runAssistAction,
} from "@/services/assist-commit";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { useAssistBanner } from "@/stores/assist-store";
import { notice } from "@/stores/confirm-store";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import type { InFlightRef } from "@/utils/single-flight";

const LOG_SCOPE = "pending-confirmations";

const TITLE = "Pending confirmations";

/** A row's answer labels in ConfirmActions order (D-09 sets, D-73 Yes right). */
function answerLabels(channel: "call" | "text" | "email"): string[] {
  return channel === "call"
    ? ["Don't log", "No answer", "Yes"]
    : ["Don't log", "Yes"];
}

const NO_DIRTY_NOTES: ReadonlySet<string> = new Set();

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

/**
 * A transient queue review surface for pending Interaction Assist
 * confirmations: a sized bottom sheet with a Close button (38.14 D-74; ADR-255
 * sizing). Each row reads "<channel> to <destination> · <time>" and every
 * answer confirms with a named snackbar. Its `queue` is the assist store's
 * visible queue, so a record Compose's panel shows, or one answered "Later",
 * is not offered here (D-23, D-77).
 */
export function PendingConfirmationsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const sheetFit = useSheetFitEnvironment();
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

  // 38.9 D-13 / D-14 (J-07): uids whose confirmation note holds typed text.
  // Pruned against the live queue at close time (review M6), and cleared when
  // the sheet actually closes: the Modal unmounts the notes while hidden.
  const [dirtyNotes, setDirtyNotes] =
    useState<ReadonlySet<string>>(NO_DIRTY_NOTES);

  useEffect(() => {
    if (!visible) setDirtyNotes(NO_DIRTY_NOTES);
  }, [visible]);

  const closeSheet = () => {
    setDirtyNotes(NO_DIRTY_NOTES);
    onClose();
  };

  // The one close for Back and the scrim tap (the Sheet's onRequestClose) and
  // the Close button. A second close
  // request while the prompt is pending gets false from the single-flight
  // confirmDiscard(), so onClose runs at most once (review C2-L3).
  const requestSheetClose = () => {
    const live = pruneDirtyNotes(
      dirtyNotes,
      queue.map((assist) => assist.uid),
    );
    if (!shouldPromptOnSheetClose(live)) {
      closeSheet();
      return;
    }
    void confirmDiscard().then((discard) => {
      if (discard) closeSheet();
    });
  };

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
  // always resolve; a write failure shows a snackbar or notice and leaves the assist
  // pending; a post-commit publication failure is logged only (D-04).
  const confirm = async (
    assist: EligiblePendingAssist,
    connected: 0 | 1,
    note?: string,
  ) => {
    const { uid } = assist;
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
        // A wrong device clock blocks logging until fixed (notice); otherwise
        // the user can retry (error snackbar). D-27.
        if (kind === "future-date") {
          void notice({ title: copy.title, message: copy.body });
        } else {
          showSnackbar({ kind: "error", label: `${copy.title}. ${copy.body}` });
        }
      },
      // 38.3 review B-WR-05: dismissed/expired before this confirm — nothing
      // was logged, so say so and only refresh the queue.
      // Informational, not an error: neutral (success-kind) snackbar.
      onClosed: () =>
        showSnackbar({
          kind: "success",
          label: `${ASSIST_FAILURE_COPY.closed.title}. ${ASSIST_FAILURE_COPY.closed.body}`,
        }),
      publishClosed: () =>
        publishAssistDismissal({ refreshQueue: refresh, logFailure }),
      logFailure,
    });
    if (result !== "busy") markPending(uid, false);
    // 38.14 D-74: answering confirms with a named snackbar.
    if (result === "done") {
      showSnackbar({
        kind: "success",
        label: assistAnswerSnackbar({
          channel: assist.channel,
          personName: assist.contact_name,
          answer: connected === 0 ? "no-answer" : "logged",
        }),
      });
    }
  };

  const dismiss = async (assist: EligiblePendingAssist) => {
    const { uid } = assist;
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
        showSnackbar({ kind: "error", label: `${copy.title}. ${copy.body}` });
      },
      logFailure,
    });
    if (result !== "busy") markPending(uid, false);
    if (result === "done") {
      showSnackbar({
        kind: "success",
        label: assistAnswerSnackbar({
          channel: assist.channel,
          personName: assist.contact_name,
          answer: "dismissed",
        }),
      });
    }
  };

  const now = localDateTime();
  const rows = queue.map((assist) => ({
    assist,
    question: questionFor(assist.channel, assist.contact_name),
    destination: assistDestinationLine(assist, now),
  }));
  // ADR-255: the size is decided when the sheet opens and held until it next
  // opens — answering a row, or the close animation, must never swap the Sheet
  // between its expanded and compact/detail blocks (a remount would drop a
  // typed note or cut the animation).
  const sizingRef = useRef<{ open: boolean; variant: SizedSheetVariant }>({
    open: false,
    variant: "compact",
  });
  if (visible && !sizingRef.current.open) {
    sizingRef.current = {
      open: true,
      variant: pendingSheetVariantFor({
        ...sheetFit,
        title: TITLE,
        rows: rows.map((row) => ({
          question: row.question,
          destination: row.destination,
          answers: answerLabels(row.assist.channel),
        })),
      }),
    };
  } else if (!visible && sizingRef.current.open) {
    sizingRef.current = { ...sizingRef.current, open: false };
  }
  const variant = sizingRef.current.variant;

  const title = (
    <Text
      accessibilityRole="header"
      style={[styles.title, { color: colors.textPrimary }]}
    >
      {TITLE}
    </Text>
  );

  const list =
    queue.length === 0 ? (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
          You're all caught up
        </Text>
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          No confirmations waiting.
        </Text>
      </View>
    ) : (
      rows.map(({ assist, question, destination }) => (
        <View
          key={assist.uid}
          style={[styles.item, { borderColor: colors.border }]}
        >
          {/* One TalkBack stop with one label (review WR2-04): the
              Avatar's "Photo of …" must not read the name twice. */}
          <View
            accessible
            accessibilityLabel={`${question} ${destination}`}
            style={styles.questionRow}
          >
            <Avatar
              photo={assist.contact_photo}
              name={assist.contact_name}
              contactId={assist.contact_id}
              size={PENDING_AVATAR_SIZE}
            />
            <View style={styles.questionText}>
              <Text
                numberOfLines={1}
                style={[styles.question, { color: colors.textPrimary }]}
              >
                {question}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.destination, { color: colors.textSecondary }]}
              >
                {destination}
              </Text>
            </View>
          </View>
          <AssistConfirmation
            channel={assist.channel}
            onConfirm={(connected, note) => confirm(assist, connected, note)}
            onDismiss={() => dismiss(assist)}
            pending={pendingUids.has(assist.uid)}
            onNoteDirtyChange={(dirty) =>
              setDirtyNotes((previous) =>
                markNoteDirty(previous, assist.uid, dirty),
              )
            }
          />
        </View>
      ))
    );

  const closeRow = (
    <View style={styles.closeRow}>
      {/* biome-ignore lint/a11y/useValidAriaRole: Button role is the design-system hierarchy role. */}
      <Button
        testID="pending-confirmations-close"
        role="tertiary"
        label={CLOSE}
        onPress={requestSheetClose}
      />
    </View>
  );

  // 38.13 D-87: an expanded Sheet's body does not scroll; its consumer owns the
  // scroll. A compact / detail sheet passes scrollBody={false} because the list
  // owns its ScrollView (sheet-consumers-contract EXPECTED_OPT_OUTS).
  return variant === "expanded" ? (
    <Sheet
      visible={visible}
      onRequestClose={requestSheetClose}
      variant="expanded"
    >
      <View style={styles.content}>
        {title}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        >
          {list}
        </ScrollView>
        {closeRow}
      </View>
    </Sheet>
  ) : (
    <Sheet
      visible={visible}
      onRequestClose={requestSheetClose}
      variant={variant === "compact" ? "compact" : "detail"}
      scrollBody={false}
    >
      <View style={styles.content}>
        {title}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        >
          {list}
        </ScrollView>
        {closeRow}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Shrinks inside the sheet's cap so the Close row always stays on screen
  // while the list scrolls.
  content: { flexShrink: 1, gap: PENDING_SHEET_GAP },
  scroll: { flexGrow: 0, flexShrink: 1 },
  title: { fontSize: 20, fontWeight: "700" },
  list: { gap: PENDING_ROW_GAP },
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: PENDING_ROW_PADDING_BOTTOM,
    gap: PENDING_ROW_INNER_GAP,
  },
  questionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  questionText: { flex: 1, gap: 2 },
  question: { fontSize: 16, fontWeight: "700" },
  destination: { fontSize: 14 },
  empty: { gap: 4, paddingVertical: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyBody: { fontSize: 15 },
  closeRow: { flexDirection: "row", justifyContent: "flex-end" },
});
