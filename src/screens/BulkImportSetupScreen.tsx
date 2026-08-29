import { Picker } from "@react-native-picker/picker";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ConsolidationPrompt } from "@/components/ConsolidationPrompt";
import { listCategories } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import { setSessionBatchCategory } from "@/db/import-session-dao";
import {
  getSessionById,
  type ImportSessionRow,
  listSessionRows,
  sessionRowCounts,
} from "@/db/import-session-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { importedPhotoFs } from "@/services/import/import-photo";
import {
  combineCluster,
  detectSourceClusters,
} from "@/services/import/source-consolidation";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { useImportLeaveGuard } from "./use-import-leave-guard";

const LOG_SCOPE = "bulk-import-setup";

function contactLabel(count: number): string {
  return `${count} ${count === 1 ? "contact" : "contacts"}`;
}

/** Shared-defaults confirmation for a picker-selected batch, never a row list. */
export function BulkImportSetupScreen({
  navigation,
  route,
}: RootStackScreenProps<"BulkImportSetup">) {
  const { colors } = useTheme();
  const [count, setCount] = useState(0);
  const [categories, setCategories] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [edited, setEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [consolidationRows, setConsolidationRows] = useState<
    ImportSessionRow[] | null
  >(null);
  const [declinedClusters, setDeclinedClusters] = useState<Set<string>>(
    new Set(),
  );

  useImportLeaveGuard(navigation, route.params.sessionId, edited);

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [counts, session, nextCategories] = await Promise.all([
        sessionRowCounts(exec, route.params.sessionId),
        getSessionById(exec, route.params.sessionId),
        listCategories(exec),
      ]);
      if (!session) throw new Error("import session is unavailable");
      setCount(counts.pending);
      setCategoryId(session.batchCategoryId);
      setCategories(nextCategories);
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to load bulk import setup", error);
      Alert.alert("Couldn't load import setup", "Please reopen this import.");
    }
  }, [route.params.sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  function clusterKey(rows: ImportSessionRow[]): string {
    return rows
      .map((row) => row.id)
      .sort((left, right) => left - right)
      .join(",");
  }

  async function startBatch() {
    if (saving || count === 0) return;
    setSaving(true);
    try {
      await setSessionBatchCategory(
        getExecutor(),
        route.params.sessionId,
        categoryId,
        localDateTime(),
      );
      navigation.navigate("ImportProgress", {
        sessionId: route.params.sessionId,
        batchCategoryId: categoryId,
      });
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to start bulk import", error);
      Alert.alert("Couldn't start import", "Please try again.");
      setSaving(false);
    }
  }

  async function onImport() {
    if (saving || count === 0) return;
    try {
      const exec = getExecutor();
      const [session, rows] = await Promise.all([
        getSessionById(exec, route.params.sessionId),
        listSessionRows(exec, route.params.sessionId),
      ]);
      if (!session) throw new Error("import session is unavailable");
      const cluster = detectSourceClusters(rows, {
        phoneRegion: session.phoneRegion,
      }).clusters.find(
        (candidate) => !declinedClusters.has(clusterKey(candidate)),
      );
      if (cluster) {
        setConsolidationRows(cluster);
        return;
      }
      await startBatch();
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to prepare consolidation", error);
      Alert.alert("Couldn't prepare import", "Please try again.");
    }
  }

  async function onCombine() {
    if (!consolidationRows || saving) return;
    setSaving(true);
    try {
      const exec = getExecutor();
      const session = await getSessionById(exec, route.params.sessionId);
      if (!session) throw new Error("import session is unavailable");
      const result = await combineCluster(exec, importedPhotoFs, {
        rows: consolidationRows,
        batchCategoryId: categoryId,
        phoneRegion: session.phoneRegion,
        now: localDateTime(),
      });
      if (result.combined && result.sessionComplete) {
        navigation.replace("ImportComplete", {
          sessionId: route.params.sessionId,
        });
        return;
      }
      if (!result.combined) {
        setDeclinedClusters((current) =>
          new Set(current).add(clusterKey(consolidationRows)),
        );
      }
      setConsolidationRows(null);
      await load();
      setSaving(false);
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to combine source records", error);
      Alert.alert(
        "Couldn't combine contacts",
        "Please keep them separate and try again.",
      );
      setSaving(false);
    }
  }

  function onKeepSeparate() {
    if (consolidationRows) {
      setDeclinedClusters((current) =>
        new Set(current).add(clusterKey(consolidationRows)),
      );
    }
    setConsolidationRows(null);
  }

  const importLabel = `Import ${contactLabel(count)}`;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.back, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Import contacts
        </Text>
      </View>

      <Text style={[styles.count, { color: colors.textPrimary }]}>
        {contactLabel(count)} selected
      </Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Defaults
        </Text>
        <View style={styles.defaults}>
          <View
            style={[
              styles.default,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.textPrimary }}>Unbound</Text>
          </View>
          <View
            style={[
              styles.default,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.textPrimary }}>Uncategorized</Text>
          </View>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Category override
        </Text>
        <View
          style={[
            styles.picker,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Picker
            accessibilityLabel="Batch category override"
            selectedValue={categoryId ?? -1}
            onValueChange={(value) => {
              setEdited(true);
              setCategoryId(value === -1 ? null : Number(value));
            }}
            dropdownIconColor={colors.textSecondary}
            style={{ color: colors.textPrimary }}
          >
            <Picker.Item label="Uncategorized" value={-1} />
            {categories.map((category) => (
              <Picker.Item
                key={category.id}
                label={category.name}
                value={category.id}
              />
            ))}
          </Picker>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={saving || count === 0}
        onPress={() => void onImport()}
        style={[
          styles.import,
          {
            backgroundColor:
              saving || count === 0 ? colors.surface : colors.accent,
            borderColor: saving || count === 0 ? colors.border : colors.accent,
          },
        ]}
      >
        <Text
          style={{
            color:
              saving || count === 0 ? colors.textSecondary : colors.background,
            fontWeight: "600",
          }}
        >
          {importLabel}
        </Text>
      </Pressable>
      <ConsolidationPrompt
        visible={consolidationRows !== null}
        rows={consolidationRows ?? []}
        onCombine={() => void onCombine()}
        onKeepSeparate={onKeepSeparate}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  title: { fontSize: 22, fontWeight: "700" },
  count: { fontSize: 18, fontWeight: "600" },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600" },
  defaults: { flexDirection: "row", gap: 8 },
  default: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  picker: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  import: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
  },
});
