import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getExecutor, localDateTime } from "@/db/database";
import { sessionRowCounts } from "@/db/import-session-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { runImportBatch } from "@/services/import/import-driver";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "import-progress";

/** One calm, determinate surface for a chunked logical batch import. */
export function ImportProgressScreen({
  navigation,
  route,
}: RootStackScreenProps<"ImportProgress">) {
  const { colors } = useTheme();
  const mounted = useRef(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    mounted.current = true;
    const exec = getExecutor();
    void (async () => {
      try {
        const counts = await sessionRowCounts(exec, route.params.sessionId);
        if (mounted.current) setTotal(counts.pending);
        await runImportBatch(exec, {
          sessionId: route.params.sessionId,
          now: localDateTime(),
          onProgress: (nextDone, nextTotal) => {
            if (!mounted.current) return;
            setDone(nextDone);
            setTotal(nextTotal);
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
        // means setup/session access failed, so leave the progress surface safe.
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [navigation, route.params.sessionId]);

  const progress = total === 0 ? 0 : Math.min(done / total, 1);
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
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
});
