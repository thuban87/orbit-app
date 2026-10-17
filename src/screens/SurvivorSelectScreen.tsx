import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { ContactPickerList } from "@/components/ContactPicker";
import { ShellAppBar } from "@/components/ShellAppBar";
import { EmptyState } from "@/components/ui";
import { getExecutor } from "@/db/database";
import {
  getMergeCandidate,
  type MergeCandidate,
} from "@/db/merge-candidate-read";
import { listPickerContacts, type PickerContactRow } from "@/db/picker-read";
import { recommendSurvivor } from "@/logic/survivor-recommendation";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import { DEFAULT_FLOW_HOST } from "@/navigation/flow-host";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import {
  canContinueToImpact,
  makeCloseStepTwo,
  mergePickerRows,
  mergePickerState,
} from "./survivor-select-logic";

type Candidate = MergeCandidate;

/**
 * Select the other contact first, then choose the surviving identity.
 *
 * Step one is the shared contact picker (38.12 D-43): search, the house ✕
 * Cancel in the header, the launching person shown first as the fixed first
 * party (D-99) and excluded from the list, never a contact in the Bin, and its
 * own loading and error states apart from an empty list. Opened with both ids
 * (Reconcile's "Review merge"), it starts at step two and never mounts the
 * picker (convergence c1 L-5).
 */
export function SurvivorSelectScreen({
  navigation,
  route,
}: RootStackScreenProps<"SurvivorSelect">) {
  const { colors } = useTheme();
  // null while the picker read is in flight (D-43).
  const [rows, setRows] = useState<PickerContactRow[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumped by "Try again" to re-run the picker read.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [firstPerson, setFirstPerson] = useState<Candidate | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pair, setPair] = useState<Candidate[] | null>(null);
  const first = route.params.firstContactId;
  const second = route.params.secondContactId;
  // 38.12 D-110: the flow host travels SurvivorSelect → MergeConflicts →
  // MergeImpactSummary, which ends the merge where it was started.
  const host = route.params.host ?? DEFAULT_FLOW_HOST;
  const onPickerStep = second == null;
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
  // The picker read runs only on the picker step: a step-two entry never
  // reads the candidate list (L-5). `loadAttempt` re-runs it after a failure.
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadAttempt is bumped by "Try again" only to re-issue this read.
  useEffect(() => {
    if (!onPickerStep) return;
    let cancelled = false;
    setLoadFailed(false);
    const exec = getExecutor();
    void Promise.all([
      listPickerContacts(exec, { includeArchived: false }),
      getMergeCandidate(exec, first),
    ])
      .then(([list, person]) => {
        if (cancelled) return;
        setRows(list);
        setFirstPerson(person);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [first, loadAttempt, onPickerStep]);
  const retryLoad = useCallback(() => {
    setRows(null);
    setLoadFailed(false);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);
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
      host,
    });
  }, [first, host, navigation, pair, second, selected]);
  // House header (38.9 D-16, D-44); the title follows the step. The picker
  // step carries the ✕ Cancel (D-43, 38.9 D-59): it leaves the merge before
  // anything was chosen. Step two keeps plain Back (its sub-editor guard).
  const header = (
    <ShellAppBar
      variant="child"
      title={second ? "Which contact survives?" : "Choose a contact to merge"}
      backKind={onPickerStep ? "cancel" : "back"}
    />
  );
  if (onPickerStep) {
    const state = mergePickerState(rows, loadFailed);
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.root}>
          {firstPerson ? (
            <View
              testID="merge-first-party"
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Avatar
                name={firstPerson.name}
                photo={firstPerson.photo}
                size={40}
              />
              <View style={styles.cardCopy}>
                <Text style={{ color: colors.textSecondary }}>Merging</Text>
                <Text style={[styles.name, { color: colors.textPrimary }]}>
                  {firstPerson.name}
                </Text>
              </View>
            </View>
          ) : null}
          {state === "error" ? (
            <EmptyState
              testID="merge-picker-failed"
              icon="warning"
              heading="Couldn't load contacts"
              body="Nothing was changed."
              action={{ label: "Try again", onPress: retryLoad }}
            />
          ) : state === "loading" ? (
            <View testID="merge-picker-loading" style={styles.loading}>
              <ActivityIndicator color={colors.accentText} />
              <Text style={{ color: colors.textSecondary }}>
                Loading contacts…
              </Text>
            </View>
          ) : (
            <ContactPickerList
              mode="single"
              rows={mergePickerRows(rows ?? [], first)}
              excludeContactId={first}
              allowArchivedSearch={false}
              onPick={(row) =>
                navigation.setParams({ secondContactId: row.id })
              }
              style={styles.picker}
            />
          )}
        </View>
      </View>
    );
  }
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
          style={[
            styles.cta,
            // The disabled look (D-26), as Merge conflicts' Continue.
            {
              backgroundColor: canContinue
                ? colors.accent
                : colors.surfaceElevated,
            },
          ]}
        >
          <Text
            style={{
              color: canContinue ? colors.onAccent : colors.textSecondary,
            }}
          >
            Continue
          </Text>
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
  picker: { flex: 1 },
  loading: {
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    minHeight: 128,
  },
});
