import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import { mergeContacts, type MergeResolutions } from "@/db/merge-dao";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";

type Counts = { interactions: number; fuel: number; events: number; methods: number; links: number };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function MergeImpactSummary({ navigation, route }: RootStackScreenProps<"MergeImpactSummary">) {
  const { colors } = useTheme(); const { survivorId, absorbedId, resolutions } = route.params;
  const [names, setNames] = useState({ survivor: "Contact", absorbed: "Contact" }); const [counts, setCounts] = useState<Counts | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => { const exec = getExecutor(); void Promise.all([getContactHeader(exec, survivorId), getContactHeader(exec, absorbedId), ...["interactions", "fuel", "events", "contact_methods", "external_contact_links"].map((table) => exec.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE contact_id = ?`, [absorbedId]))]).then(([survivor, absorbed, ...rows]) => { setNames({ survivor: survivor?.name ?? "Contact", absorbed: absorbed?.name ?? "Contact" }); setCounts({ interactions: rows[0]?.n ?? 0, fuel: rows[1]?.n ?? 0, events: rows[2]?.n ?? 0, methods: rows[3]?.n ?? 0, links: rows[4]?.n ?? 0 }); }); }, [absorbedId, survivorId]);
  const typedResolutions: MergeResolutions = resolutions;
  const confirm = () => Alert.alert("Merge contacts?", "This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Merge", style: "destructive", onPress: () => { void mergeContacts(getExecutor(), { survivorId, absorbedId, resolutions: typedResolutions, now: localDateTime() }).then(() => navigation.replace("Profile", { contactId: survivorId })).catch(() => setFailed(true)); } }]);
  const rows = counts ? [plural(counts.interactions, "interaction", "interactions"), plural(counts.fuel, "fuel item", "fuel items"), plural(counts.events, "event", "events"), plural(counts.methods, "contact method", "contact methods"), plural(counts.links, "external link", "external links")] : [];
  return <View style={[styles.root, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.textPrimary }]}>{`Merge ${names.absorbed} into ${names.survivor}`}</Text>{rows.map((row) => <View key={row} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.textPrimary }}>{row}</Text></View>)}<View style={[styles.warning, { borderColor: colors.danger }]}><Text style={{ color: colors.danger }}>{`${names.absorbed} will be retired.`}</Text><Text style={{ color: colors.textSecondary }}>This can&apos;t be simply undone.</Text></View>{failed ? <Text style={{ color: colors.danger }}>Couldn&apos;t merge these contacts. Nothing was changed. Try again.</Text> : null}<Pressable onPress={confirm} style={[styles.cta, { backgroundColor: colors.accent }]}><Text style={{ color: colors.background }}>Merge contacts</Text></Pressable></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 20, gap: 12 }, title: { fontSize: 24, fontWeight: "600" }, row: { padding: 14, borderRadius: 12, borderWidth: 1 }, warning: { padding: 14, borderLeftWidth: 3, gap: 4 }, cta: { padding: 16, borderRadius: 12, alignItems: "center" } });
