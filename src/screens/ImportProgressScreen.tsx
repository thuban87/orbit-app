import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getExecutor, localDateTime } from "@/db/database";
import { getSessionById, sessionRowCounts } from "@/db/import-session-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { runImportBatch } from "@/services/import/import-driver";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import {
  classifyImportStop,
  type ImportProgressPhase,
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
  const mounted = useRef(false);
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

  useEffect(() => {
    mounted.current = true;
    const exec = getExecutor();
    void (async () => {
      try {
        const counts = await sessionRowCounts(exec, route.params.sessionId);
        if (mounted.current)
          setState({ phase: "running", done: 0, total: counts.pending });
        await runImportBatch(exec, {
          sessionId: route.params.sessionId,
          now: localDateTime(),
          onProgress: (nextDone, nextTotal) => {
            if (!mounted.current) return;
            setState({ phase: "running", done: nextDone, total: nextTotal });
          },
        });
        if (mounted.current) {
          navigation.replace("ImportComplete", {
            sessionId: route.params.sessionId,
          });
        }
      } catch (error) {
        Logger.error(LOG_SCOPE, "batch import failed", error);
        // A row-level failure is isolated in the driver. Reaching this branch
        // means setup/session access failed. Stop truthfully and hand recovery
        // to the user; never re-run the batch from here (RG-035, D-20).
        const outcome = await classifyImportStop(() =>
          getSessionById(exec, route.params.sessionId),
        );
        if (mounted.current) setState({ phase: "stopped", outcome });
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [navigation, route.params.sessionId]);

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
            <Text style={{ color: colors.background }}>
              View import summary
            </Text>
          </Pressable>
        ) : (
          <Pressable
            testID="import-progress-back"
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={[styles.button, { backgroundColor: colors.accent }]}
          >
            <Text style={{ color: colors.background }}>Back</Text>
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
