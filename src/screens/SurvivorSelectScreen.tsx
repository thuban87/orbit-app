import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { ShellAppBar } from "@/components/ShellAppBar";
import { getExecutor } from "@/db/database";
import {
  getMergeCandidate,
  listMergeCandidates,
  type MergeCandidate,
} from "@/db/merge-candidate-read";
import { recommendSurvivor } from "@/logic/survivor-recommendation";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { canContinueToImpact, makeCloseStepTwo } from "./survivor-select-logic";

type Candidate = MergeCandidate;

/** Select the other contact first, then choose the surviving identity. */
export function SurvivorSelectScreen({
  navigation,
  route,
}: RootStackScreenProps<"SurvivorSelect">) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pair, setPair] = useState<Candidate[] | null>(null);
  const first = route.params.firstContactId;
  const second = route.params.secondContactId;
  // Opened at step two with both ids (Reconcile, `ReconcileDetailScreen`'s
  // "Review merge"): Back keeps leaving to Reconcile, as before (this plan only;
  // review C6-H1). Captured once on mount.
  const [enteredAtStepTwo] = useState(route.params.secondContactId != null);
  // The guard requires a bypass ref; nothing sets it (no save navigation here).
  const bypassRef = useRef(false);
  const closeStepTwo = makeCloseStepTwo<Candidate[]>({
    setPair,
    setSelected,
    setParams: (params) => navigation.setParams(params),
  });
  // Step two reached from the picker is a sub-editor of this route (D-14,
  // C5-M7): every Back (header, system key, system gesture) returns to the
  // picker first and clears the previous pair and pick; a further Back leaves.
  // A RESET (the post-merge return to the survivor's Profile) never closes it
  // (C6-H1).
  useDiscardKeepGuard({
    hasUnsavedChanges: false,
    bypassRef,
    subEditor: {
      open: second != null && !enteredAtStepTwo,
      dirty: false,
      close: closeStepTwo,
    },
  });
  useEffect(() => {
    void listMergeCandidates(getExecutor(), first)
      .then(setRows)
      .catch(() => setRows([]));
  }, [first]);
  useEffect(() => {
    if (!second) return;
    // A read for an earlier pick never fills the screen (review C6-M2).
    let cancelled = false;
    void Promise.all([
      getMergeCandidate(getExecutor(), first),
      getMergeCandidate(getExecutor(), second),
    ])
      .then(([a, b]) => {
        if (!cancelled) setPair(a && b ? [a, b] : []);
      })
      .catch(() => {
        if (!cancelled) setPair([]);
      });
    return () => {
      cancelled = true;
    };
  }, [first, second]);
  const recommendation = useMemo(
    () => (pair?.length === 2 ? recommendSurvivor(pair[0], pair[1]) : null),
    [pair],
  );
  useEffect(() => {
    if (recommendation) setSelected(recommendation.candidateId);
  }, [recommendation]);
  // Continue acts only on the pair chosen now, once it has loaded (C6-M2).
  const canContinue = canContinueToImpact({ first, second, pair, selected });
  const continueToImpact = useCallback(() => {
    if (!canContinueToImpact({ first, second, pair, selected })) return;
    if (second == null || selected == null) return;
    navigation.navigate("MergeConflicts", {
      survivorId: selected,
      absorbedId: selected === first ? second : first,
    });
  }, [first, navigation, pair, second, selected]);
  // House header with plain Back (38.9 D-16, D-44); the title follows the step.
  const header = (
    <ShellAppBar
      variant="child"
      title={second ? "Which contact survives?" : "Choose a contact to merge"}
    />
  );
  if (!second)
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.root}>
          <FlatList
            data={rows ?? []}
            keyExtractor={(row) => String(row.id)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  navigation.setParams({ secondContactId: item.id })
                }
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Avatar name={item.name} photo={item.photo} size={40} />
                <Text style={[styles.name, { color: colors.textPrimary }]}>
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    );
  return (
    <View style={styles.screen}>
      {header}
      <View style={styles.root}>
        {(pair ?? []).map((candidate) => (
          <Pressable
            key={candidate.id}
            onPress={() => setSelected(candidate.id)}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor:
                  selected === candidate.id
                    ? colors.borderStrong
                    : colors.border,
              },
            ]}
          >
            <View style={styles.cardCopy}>
              <Text style={[styles.name, { color: colors.textPrimary }]}>
                {candidate.name}
              </Text>
              {recommendation?.candidateId === candidate.id ? (
                <View
                  style={[
                    styles.recommended,
                    { backgroundColor: colors.surfaceElevated },
                  ]}
                >
                  <Text style={{ color: colors.textSecondary }}>
                    Recommended
                  </Text>
                </View>
              ) : null}
              <Text style={{ color: colors.textSecondary }}>
                {selected === candidate.id
                  ? "✓ Will survive"
                  : "Keep this contact"}
              </Text>
            </View>
            {selected === candidate.id ? (
              <Text style={{ color: colors.accentText }}>✓</Text>
            ) : null}
          </Pressable>
        ))}
        <Pressable
          disabled={!canContinue}
          accessibilityState={{ disabled: !canContinue }}
          onPress={continueToImpact}
          style={[styles.cta, { backgroundColor: colors.accent }]}
        >
          <Text style={{ color: colors.onAccent }}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  root: { flex: 1, padding: 20, gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardCopy: { flex: 1, gap: 5 },
  name: { fontSize: 16, fontWeight: "600" },
  recommended: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cta: { padding: 16, borderRadius: 12, alignItems: "center" },
});
