import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getExecutor, localDateTime } from "@/db/database";
import { getSessionById, sessionRowCounts } from "@/db/import-session-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { runImportBatch } from "@/services/import/import-driver";
import {
  followImportRun,
  isImportRunActive,
} from "@/services/import/import-run-guard";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import {
  classifyImportStop,
  IMPORT_PROGRESS_BACK_NOTICE,
  type ImportProgressPhase,
  importProgressBlocksLeave,
  importProgressRunIdentity,
} from "./import-progress-state";
import {
  importProgressHoldActive,
  useOpenImportSession,
} from "./use-open-import-session";

const LOG_SCOPE = "import-progress";

/** One calm, determinate surface for a chunked logical batch import. */
export function ImportProgressScreen({
  navigation,
  route,
}: RootStackScreenProps<"ImportProgress">) {
  const { colors } = useTheme();
  const [state, setState] = useState<ImportProgressPhase>({
    phase: "running",
    done: 0,
    total: 0,
  });
  // A fatal stop releases the hold so the resume sweep can re-offer the
  // session on the next foreground (D-20).
  useOpenImportSession(
    route.params.sessionId,
    importProgressHoldActive(state.phase),
  );
  // 38.4 D-74 (owner): the run this screen is driving or following. Non-null
  // from the moment a run starts until it finishes or stops.
  const driving = useRef<object | null>(null);
  const [backNotice, setBackNotice] = useState(false);

  // D-74: while a pass runs, Back (hardware Back, the back gesture, a tab pop
  // or any other removal) must not leave this screen. Leaving used to return to
  // bulk setup with the pass still running, and Continue there started a
  // second pass over the same rows. Once the pass settles, leaving works.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (
          !importProgressBlocksLeave({
            driving: driving.current !== null,
            runActive: isImportRunActive(route.params.sessionId),
          })
        )
          return;
        event.preventDefault();
        setBackNotice(true);
        AccessibilityInfo.announceForAccessibility(IMPORT_PROGRESS_BACK_NOTICE);
      }),
    [navigation, route.params.sessionId],
  );

  const runIdentity = importProgressRunIdentity(route.params);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runIdentity (session + resume runKey) re-keys the run; a resume re-entry reuses this route and only swaps params (38.3 review B-WR-01).
  useEffect(() => {
    // Per-run liveness: a re-keyed run must never receive an earlier run's
    // late progress or stop (B-WR-01).
    const run = { live: true };
    driving.current = run;
    const releaseDriving = () => {
      if (driving.current === run) driving.current = null;
    };
    const exec = getExecutor();
    // A re-entry starts a fresh run: leave "stopped" so the hold re-engages.
    setState({ phase: "running", done: 0, total: 0 });
    setBackNotice(false);
    const onProgress = (nextDone: number, nextTotal: number) => {
      if (!run.live) return;
      setState({ phase: "running", done: nextDone, total: nextTotal });
    };
    void (async () => {
      try {
        const counts = await sessionRowCounts(exec, route.params.sessionId);
        if (!run.live) return;
        setState({ phase: "running", done: 0, total: counts.pending });
        // D-74: never a second pass over the same rows. A pass already in
        // flight for this session (any route) is followed, not restarted.
        const following = followImportRun(route.params.sessionId, onProgress);
        if (following) await following;
        else {
          await runImportBatch(exec, {
            sessionId: route.params.sessionId,
            now: localDateTime(),
            onProgress,
          });
        }
        releaseDriving();
        if (run.live) {
          navigation.replace("ImportComplete", {
            sessionId: route.params.sessionId,
          });
        }
      } catch (error) {
        Logger.error(LOG_SCOPE, "batch import failed", error);
        // A row-level failure is isolated in the driver. Reaching this branch
        // means setup/session access failed. Stop truthfully and hand recovery
        // to the user; never re-run the batch from here (RG-035, D-20).
        releaseDriving();
        const outcome = await classifyImportStop(() =>
          getSessionById(exec, route.params.sessionId),
        );
        if (run.live) setState({ phase: "stopped", outcome });
      }
    })();
    return () => {
      run.live = false;
      releaseDriving();
    };
  }, [navigation, route.params.sessionId, runIdentity]);

  if (state.phase === "stopped") {
    const readable = state.outcome === "summary-available";
    return (
      <View testID="import-progress-stopped" style={styles.root}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Import stopped
        </Text>
        <Text style={[styles.status, { color: colors.textSecondary }]}>
          {readable
            ? "Contacts already saved are kept. Nothing else will import until you continue."
            : "Couldn't read this import. Contacts already saved are kept."}
        </Text>
        {readable ? (
          <Pressable
            testID="import-progress-view-summary"
            accessibilityRole="button"
            accessibilityLabel="View import summary"
            onPress={() =>
              navigation.replace("ImportComplete", {
                sessionId: route.params.sessionId,
              })
            }
            style={[styles.button, { backgroundColor: colors.accent }]}
          >
            <Text style={{ color: colors.onAccent }}>View import summary</Text>
          </Pressable>
        ) : (
          <Pressable
            testID="import-progress-back"
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={[styles.button, { backgroundColor: colors.accent }]}
          >
            <Text style={{ color: colors.onAccent }}>Back</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const { done, total } = state;
  const progress = total === 0 ? 0 : Math.min(done / total, 1);
  return (
    <View style={styles.root}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.textPrimary }]}
      >
        Importing… {done} of {total}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.surface }]}>
        <View
          style={[
            styles.bar,
            { backgroundColor: colors.accent, width: `${progress * 100}%` },
          ]}
        />
      </View>
      <Text style={[styles.status, { color: colors.textSecondary }]}>
        Photos may finish after contacts
      </Text>
      {backNotice ? (
        <Text
          testID="import-progress-back-notice"
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: colors.textPrimary }]}
        >
          {IMPORT_PROGRESS_BACK_NOTICE}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 4 },
  status: { fontSize: 14, textAlign: "center" },
  button: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "center",
  },
});
