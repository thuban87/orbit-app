import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AssistConfirmation } from "@/components/AssistConfirmation";
import { Avatar } from "@/components/Avatar";
import { PendingConfirmationsSheet } from "@/components/PendingConfirmationsSheet";
import {
  fabDialBackgroundA11y,
  selectFabDialOpen,
} from "@/components/universal-fab-logic";
import { getExecutor, localDateTime } from "@/db/database";
import {
  markAssistDismissed,
  markAssistLogged,
} from "@/db/interaction-assist-dao";
import {
  assistAnswerSnackbar,
  assistDestinationLine,
} from "@/logic/assist-display";
import {
  ASSIST_FAILURE_COPY,
  publishAssistCommit,
  publishAssistDismissal,
  runAssistAction,
} from "@/services/assist-commit";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { useAssistBanner } from "@/stores/assist-store";
import { notice } from "@/stores/confirm-store";
import { setShellTopOffset } from "@/stores/shell-offset-store";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import type { InFlightRef } from "@/utils/single-flight";

/** Banner contact avatar (40); matches the Pending confirmations sheet it opens (38.6 D-25 F-2). */
const ASSIST_BANNER_AVATAR_SIZE = SPACING["2xl"] - SPACING.sm;

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

/**
 * The shell assist banner, which leaves Android Back untouched.
 *
 * 38.6 D-38: it renders IN FLOW at the top of the tab navigator's safe-area
 * column (`RootNavigator`'s `TabNavigatorContainer`, below the status-bar
 * inset), so while a question is pending every screen's content, including its
 * app bar (Profile Back/star/more, the dashboard search row), is pushed down
 * below the banner instead of being covered by an absolute overlay. It
 * occupies and takes touch only inside its own bounds and never floats over
 * another screen's touch targets.
 */
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
  // Hidden from accessibility while the FAB dial is open (D-31, D-42 A). The
  // review sheet is an RN Modal (its own window) and is not affected.
  const fabDialOpen = shellTransientStore(selectFabDialOpen);
  // 38.6 review WR5-01: the banner's in-flow height moves every screen below
  // it, so it is published as the shell top offset that window measurements
  // re-measure on. The root's onLayout publishes it while shown; hiding the
  // banner (no layout event fires) and unmounting publish 0. Kept as two
  // effects so showing the banner never resets a height onLayout already set.
  const shown = Boolean(newest);
  useEffect(() => {
    if (!shown) setShellTopOffset(0);
  }, [shown]);
  useEffect(() => () => setShellTopOffset(0), []);

  // Review A-IN-09: the pending sheet is rendered in ONE tree position (the
  // second child of the returned fragment) whether or not a banner shows, so
  // answering the last pending row inside the sheet (`newest` → null) neither
  // remounts it nor replays its opening animation and drops its held size.
  const sheet = (
    <PendingConfirmationsSheet
      visible={reviewOpen}
      onClose={() => setReviewOpen(false)}
    />
  );
  if (!newest) {
    return (
      <>
        {null}
        {sheet}
      </>
    );
  }

  const assistUid = newest.uid;
  const { channel, contact_name: personName } = newest;
  const question = questionFor(channel, personName);
  // 38.14 D-74: where it went and when, from the stored endpoint (shown as the
  // contact method writes it, D-79) and handoff time. Device-only display.
  const destinationLine = assistDestinationLine(newest, localDateTime());

  // Confirm/dismiss run through the shared runner + publisher
  // (src/services/assist-commit.ts). Both handlers always resolve: a write
  // failure shows a snackbar or notice and leaves the assist pending; a publication failure
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
    if (result !== "busy") setPending(false);
    // 38.14 D-74: answering confirms with a named snackbar.
    if (result === "done") {
      showSnackbar({
        kind: "success",
        label: assistAnswerSnackbar({
          channel,
          personName,
          answer: connected === 0 ? "no-answer" : "logged",
        }),
      });
    }
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
      onError: (_kind, error) => {
        logFailure("assist dismiss failed", error);
        const copy = ASSIST_FAILURE_COPY.dismiss.generic;
        showSnackbar({ kind: "error", label: `${copy.title}. ${copy.body}` });
      },
      logFailure,
    });
    if (result !== "busy") setPending(false);
    if (result === "done") {
      showSnackbar({
        kind: "success",
        label: assistAnswerSnackbar({
          channel,
          personName,
          answer: "dismissed",
        }),
      });
    }
  };

  return (
    <>
      <View
        // G2 (38.4 D-33): never flattened/re-created, so `box-none` always holds.
        collapsable={false}
        pointerEvents="box-none"
        style={styles.root}
        onLayout={(event) => setShellTopOffset(event.nativeEvent.layout.height)}
        {...fabDialBackgroundA11y(fabDialOpen)}
      >
        <View
          style={[
            styles.banner,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* One TalkBack stop with one label, like the import choice rows:
            the Avatar's own "Photo of …" must not read the name twice
            (review WR2-04). */}
          <View
            accessible
            accessibilityLabel={`${question} ${destinationLine}`}
            style={styles.questionRow}
          >
            <Avatar
              photo={newest.contact_photo}
              name={newest.contact_name}
              contactId={newest.contact_id}
              size={ASSIST_BANNER_AVATAR_SIZE}
            />
            <View style={styles.questionText}>
              {/* 38.14 D-90: the question may take two lines so a large font
                keeps the person's name readable instead of cutting it off.
                The banner's height follows its layout (onLayout below). */}
              <Text
                numberOfLines={2}
                style={[styles.question, { color: colors.textPrimary }]}
              >
                {question}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.destination, { color: colors.textSecondary }]}
              >
                {destinationLine}
              </Text>
            </View>
          </View>
          {morePendingCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${morePendingCount} more pending`}
              onPress={() => setReviewOpen(true)}
              style={styles.pendingCount}
            >
              <Text style={{ color: colors.accentText }}>
                {morePendingCount} more pending
              </Text>
            </Pressable>
          ) : null}
          <AssistConfirmation
            key={newest.uid}
            channel={newest.channel}
            onConfirm={confirm}
            onDismiss={dismiss}
            pending={pending}
          />
        </View>
      </View>
      {sheet}
    </>
  );
}

const styles = StyleSheet.create({
  // In flow (38.6 D-38): no absolute position, zIndex or elevation.
  root: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  questionText: {
    flex: 1,
    gap: 2,
  },
  question: {
    fontSize: 16,
    fontWeight: "700",
  },
  destination: {
    fontSize: 14,
  },
  pendingCount: {
    minHeight: 44,
    justifyContent: "center",
    fontSize: 15,
    fontWeight: "600",
  },
});
