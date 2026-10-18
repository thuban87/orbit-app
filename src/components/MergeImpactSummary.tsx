import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import {
  GroupMergeCollisionError,
  type MergeResolutions,
} from "@/db/merge-dao";
import {
  type MergeDroppedItems,
  type MergeImpactCounts,
  readMergeDroppedItems,
  readMergeImpactCounts,
} from "@/db/merge-impact-read";
import { DEFAULT_FLOW_HOST, finishFlowOnProfile } from "@/navigation/flow-host";
import type { RootStackScreenProps } from "@/navigation/types";
import { applyLifecycleTransitionEffects } from "@/services/contact-lifecycle-effects";
import { mergeContactsWithPhotoOwnership } from "@/services/photos/merge-photo-rehome";
import { confirm } from "@/stores/confirm-store";
import { useTheme } from "@/theme";
import { persistentDangerScrim } from "@/theme/danger-scrim";
import { mergeDroppedLines, mergeImpactLines } from "./merge-impact-lines";
import { ShellAppBar } from "./ShellAppBar";

export function MergeImpactSummary({
  navigation,
  route,
}: RootStackScreenProps<"MergeImpactSummary">) {
  const theme = useTheme();
  const { colors } = theme;
  const { survivorId, absorbedId, resolutions } = route.params;
  // 38.12 D-110: a merge finishes where it was started. A Profile ⋯ merge
  // (profile host, keyed by the launching route) ends on the survivor's
  // Profile in that stack; a Settings merge pops back to Contacts &
  // Relationships. Never a root reset. SurvivorSelect and MergeConflicts
  // thread the host here (38.12-11).
  const host = route.params.host ?? DEFAULT_FLOW_HOST;
  const [names, setNames] = useState({
    survivor: "Contact",
    absorbed: "Contact",
  });
  const [counts, setCounts] = useState<MergeImpactCounts | null>(null);
  const [dropped, setDropped] = useState<MergeDroppedItems | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  // A failed read never leaves an irreversible merge confirmable with an
  // empty summary (38.12 review B-WR-10): Merge stays disabled until the
  // counts load; a failure shows Retry.
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    void loadAttempt;
    const exec = getExecutor();
    let live = true;
    setLoadFailed(false);
    void Promise.all([
      getContactHeader(exec, survivorId),
      getContactHeader(exec, absorbedId),
      // Only what moves (B-WR-09): the survivor and the chosen resolutions.
      readMergeImpactCounts(exec, absorbedId, { survivorId, resolutions }),
      readMergeDroppedItems(exec, absorbedId),
    ])
      .then(([survivor, absorbed, impact, notKept]) => {
        if (!live) return;
        setNames({
          survivor: survivor?.name ?? "Contact",
          absorbed: absorbed?.name ?? "Contact",
        });
        setCounts(impact);
        setDropped(notKept);
      })
      .catch(() => {
        if (live) setLoadFailed(true);
      });
    return () => {
      live = false;
    };
  }, [absorbedId, loadAttempt, resolutions, survivorId]);
  const typedResolutions: MergeResolutions = resolutions;
  // In flight from the confirm until the merge settles (38.9 review WR-01):
  // the ref blocks a second press synchronously; the state dims and disables
  // "Merge contacts" (D-26) so it never looks live while a merge runs.
  const mergingRef = useRef(false);
  const [merging, setMerging] = useState(false);
  const settleMerge = () => {
    mergingRef.current = false;
    setMerging(false);
  };
  // Irreversible: themed destructive confirm, not dismissable (D-30, ADR-086).
  const confirmMerge = () => {
    if (mergingRef.current || counts === null) return;
    mergingRef.current = true;
    setMerging(true);
    void confirm({
      title: "Merge contacts?",
      message: "This cannot be undone.",
      confirmLabel: "Merge",
      destructive: true,
    }).then((ok) => {
      if (!ok) {
        settleMerge();
        return;
      }
      void mergeContactsWithPhotoOwnership(getExecutor(), {
        survivorId,
        absorbedId,
        resolutions: typedResolutions,
        now: localDateTime(),
      })
        .then(() => {
          // The absorbed person's alerts go and the survivor's may change:
          // refresh the schedule and the widget post-commit (B-IN-07).
          void applyLifecycleTransitionEffects(survivorId, "merge", {
            exec: getExecutor(),
          });
          finishFlowOnProfile(navigation, host, survivorId);
        })
        .catch((error: unknown) => {
          settleMerge();
          setFailureMessage(
            error instanceof GroupMergeCollisionError
              ? error.message
              : "Couldn't merge these contacts. Nothing was changed. Try again.",
          );
        });
    });
  };
  // One plural() line per non-zero count over every table the merge moves
  // (38.12 D-44).
  const rows = counts ? mergeImpactLines(counts) : [];
  // Not confirmable until the summary has loaded (B-WR-10).
  const mergeDisabled = merging || counts === null || dropped === null;
  // D-146: the survivor's Profile layout, background and Orrery choices win;
  // the absorbed person's own are listed as not kept.
  const droppedRows = dropped ? mergeDroppedLines(dropped) : [];
  return (
    <View style={styles.screen}>
      {/* House header with the ✕ Cancel (38.9 D-16, D-59): it abandons the
          merge and goes back; nothing is written until the Merge confirm. */}
      <ShellAppBar
        variant="child"
        title={`Merge ${names.absorbed} into ${names.survivor}`}
        backKind="cancel"
      />
      <View style={styles.root}>
        {rows.map((row) => (
          <View
            key={row}
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.textPrimary }}>{row}</Text>
          </View>
        ))}
        {droppedRows.length > 0 ? (
          <View
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.textPrimary }}>
              {`Not kept from ${names.absorbed} (${names.survivor}'s stay):`}
            </Text>
            {droppedRows.map((row) => (
              <Text key={row} style={{ color: colors.textSecondary }}>
                {row}
              </Text>
            ))}
          </View>
        ) : null}
        <View
          style={[
            styles.warning,
            { borderColor: colors.danger },
            persistentDangerScrim(theme),
          ]}
        >
          <Text
            style={{ color: colors.danger }}
          >{`${names.absorbed} will be retired.`}</Text>
          <Text style={{ color: colors.textSecondary }}>
            This can&apos;t be simply undone.
          </Text>
        </View>
        {failureMessage ? (
          <Text style={{ color: colors.danger }}>{failureMessage}</Text>
        ) : null}
        {loadFailed ? (
          <View style={styles.loadError}>
            <Text style={{ color: colors.danger }}>
              Couldn&apos;t load what this merge moves. Nothing was changed.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading the merge summary"
              onPress={() => setLoadAttempt((attempt) => attempt + 1)}
              style={[styles.retry, { borderColor: colors.accent }]}
            >
              <Text style={{ color: colors.accentText }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: mergeDisabled }}
          disabled={mergeDisabled}
          onPress={confirmMerge}
          style={[
            styles.cta,
            {
              backgroundColor: mergeDisabled
                ? colors.surfaceElevated
                : colors.accent,
            },
          ]}
        >
          <Text
            style={{
              color: mergeDisabled ? colors.textSecondary : colors.onAccent,
            }}
          >
            Merge contacts
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  root: { flex: 1, padding: 20, gap: 12 },
  row: { padding: 14, borderRadius: 12, borderWidth: 1 },
  warning: { padding: 14, borderLeftWidth: 3, gap: 4 },
  cta: { padding: 16, borderRadius: 12, alignItems: "center" },
  loadError: { gap: 8 },
  retry: {
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});
