import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { getExecutor } from "@/db/database";
import { getMergeCandidate, listMergeCandidates, type MergeCandidate } from "@/db/merge-candidate-read";
import { recommendSurvivor } from "@/logic/survivor-recommendation";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";

type Candidate = MergeCandidate;

/** Select the other contact first, then choose the surviving identity. */
export function SurvivorSelectScreen({ navigation, route }: RootStackScreenProps<"SurvivorSelect">) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pair, setPair] = useState<Candidate[] | null>(null);
  const first = route.params.firstContactId;
  const second = route.params.secondContactId;
  useEffect(() => { void listMergeCandidates(getExecutor(), first).then(setRows).catch(() => setRows([])); }, [first]);
  useEffect(() => {
    if (!second) return;
    void Promise.all([getMergeCandidate(getExecutor(), first), getMergeCandidate(getExecutor(), second)])
      .then(([a, b]) => setPair(a && b ? [a, b] : []))
      .catch(() => setPair([]));
  }, [first, second]);
  const recommendation = useMemo(
    () => (pair?.length === 2 ? recommendSurvivor(pair[0], pair[1]) : null),
    [pair],
  );
  useEffect(() => {
    if (recommendation) setSelected(recommendation.candidateId);
  }, [recommendation]);
  const continueToImpact = useCallback(() => {
    if (!second || selected == null) return;
    navigation.navigate("MergeConflicts", { survivorId: selected, absorbedId: selected === first ? second : first });
  }, [first, navigation, second, selected]);
  if (!second) return <View style={[styles.root, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Choose a contact to merge</Text><FlatList data={rows ?? []} keyExtractor={(row) => String(row.id)} renderItem={({ item }) => <Pressable onPress={() => navigation.setParams({ secondContactId: item.id })} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Avatar name={item.name} photo={item.photo} size={40} /><Text style={[styles.name, { color: colors.textPrimary }]}>{item.name}</Text></Pressable>} /></View>;
  return <View style={[styles.root, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Which contact survives?</Text>{(pair ?? []).map((candidate) => <Pressable key={candidate.id} onPress={() => setSelected(candidate.id)} style={[styles.card, { backgroundColor: colors.surface, borderColor: selected === candidate.id ? colors.borderStrong : colors.border }]}><View style={styles.cardCopy}><Text style={[styles.name, { color: colors.textPrimary }]}>{candidate.name}</Text>{recommendation?.candidateId === candidate.id ? <View style={[styles.recommended, { backgroundColor: colors.surfaceElevated }]}><Text style={{ color: colors.textSecondary }}>Recommended</Text></View> : null}<Text style={{ color: colors.textSecondary }}>{selected === candidate.id ? "✓ Will survive" : "Keep this contact"}</Text></View>{selected === candidate.id ? <Text style={{ color: colors.accent }}>✓</Text> : null}</Pressable>)}<Pressable disabled={selected == null} onPress={continueToImpact} style={[styles.cta, { backgroundColor: colors.accent }]}><Text style={{ color: colors.background }}>Continue</Text></Pressable></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 20, gap: 12 }, title: { fontSize: 24, fontWeight: "600" }, card: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, cardCopy: { flex: 1, gap: 5 }, name: { fontSize: 16, fontWeight: "600" }, recommended: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }, cta: { padding: 16, borderRadius: 12, alignItems: "center" } });
