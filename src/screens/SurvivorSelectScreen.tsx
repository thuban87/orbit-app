import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor } from "@/db/database";
import { listMergeCandidates, type MergeCandidate } from "@/db/merge-candidate-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";

type Candidate = MergeCandidate & { createdAt?: string };

/** Select the other contact first, then choose the surviving identity. */
export function SurvivorSelectScreen({ navigation, route }: RootStackScreenProps<"SurvivorSelect">) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<number | null>(route.params.secondContactId ?? null);
  const [names, setNames] = useState<Record<number, string>>({});
  const first = route.params.firstContactId;
  const second = route.params.secondContactId;
  useEffect(() => { void listMergeCandidates(getExecutor(), first).then(setRows).catch(() => setRows([])); }, [first]);
  useEffect(() => { if (!second) return; void Promise.all([getContactHeader(getExecutor(), first), getContactHeader(getExecutor(), second)]).then(([a, b]) => setNames({ [first]: a?.name ?? "Contact", [second]: b?.name ?? "Contact" })); }, [first, second]);
  const continueToImpact = useCallback(() => {
    if (!second || selected == null) return;
    navigation.navigate("MergeImpactSummary", { survivorId: selected, absorbedId: selected === first ? second : first });
  }, [first, navigation, second, selected]);
  if (!second) return <View style={[styles.root, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Choose a contact to merge</Text><FlatList data={rows ?? []} keyExtractor={(row) => String(row.id)} renderItem={({ item }) => <Pressable onPress={() => navigation.setParams({ secondContactId: item.id })} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Avatar name={item.name} photo={item.photo} size={40} /><Text style={[styles.name, { color: colors.textPrimary }]}>{item.name}</Text></Pressable>} /></View>;
  return <View style={[styles.root, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Which contact survives?</Text>{[first, second].map((id) => <Pressable key={id} onPress={() => setSelected(id)} style={[styles.card, { backgroundColor: selected === id ? colors.accent : colors.surface, borderColor: selected === id ? colors.borderStrong : colors.border }]}><Text style={[styles.name, { color: selected === id ? colors.background : colors.textPrimary }]}>{names[id] ?? "Loading…"}</Text><Text style={{ color: selected === id ? colors.background : colors.textSecondary }}>{selected === id ? "✓ Will survive" : "Keep this contact"}</Text></Pressable>)}<Pressable disabled={selected == null} onPress={continueToImpact} style={[styles.cta, { backgroundColor: colors.accent }]}><Text style={{ color: colors.background }}>Continue</Text></Pressable></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 20, gap: 12 }, title: { fontSize: 24, fontWeight: "600" }, card: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, name: { fontSize: 16, fontWeight: "600", flex: 1 }, cta: { padding: 16, borderRadius: 12, alignItems: "center" } });
