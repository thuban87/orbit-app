import { Picker } from "@react-native-picker/picker";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
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
import { CategoryChoiceSheet } from "@/components/category/CategoryChoiceSheet";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { listCategories } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import { setSessionBatchDefaults } from "@/db/import-session-dao";
import {
  getSessionById,
  type ImportSessionRow,
  listSessionRows,
  sessionRowCounts,
} from "@/db/import-session-read";
import {
  CATEGORY_SEARCH_THRESHOLD,
  resolveCategorySelection,
} from "@/logic/category-logic";
import type { RootStackScreenProps } from "@/navigation/types";
import { importedPhotoFs } from "@/services/import/import-photo";
import {
  combineCluster,
  detectSourceClusters,
} from "@/services/import/source-consolidation";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import {
  BULK_BOUND_BLURB,
  BULK_IMPORT_DEFAULT_FREQUENCY,
  boundFrequencyBlocksImport,
  bulkLifecycleChoice,
  initialBulkLifecycle,
} from "./bulk-import-setup-logic";
import { useImportLeaveGuard } from "./use-import-leave-guard";
import {
  bulkSetupHoldActive,
  useOpenImportSession,
} from "./use-open-import-session";

const LOG_SCOPE = "bulk-import-setup";

/** D-57: Unbound first (the default), then Bound. */
const LIFECYCLE_OPTIONS = [
  { bound: false, label: "Unbound" },
  { bound: true, label: "Bound" },
] as const;

function contactLabel(count: number): string {
  return `${count} ${count === 1 ? "contact" : "contacts"}`;
}

/** Shared-defaults confirmation for a picker-selected batch, never a row list. */
export function BulkImportSetupScreen({
  navigation,
  route,
}: RootStackScreenProps<"BulkImportSetup">) {
  // 38.3 review B-CR-02 (D-20): hold the session only while this screen is
  // focused. It stays mounted under the pushed ImportProgress, and holding it
  // there kept the refcounted mark alive after a fatal stop released
  // ImportProgress's own hold, so the resume sweep never re-offered it.
  const isFocused = useIsFocused();
  useOpenImportSession(route.params.sessionId, bulkSetupHoldActive(isFocused));
  const { colors } = useTheme();
  const [count, setCount] = useState(0);
  const [categories, setCategories] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  // D-57: the batch lifecycle — Unbound by default, restored from the session.
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [intervalDays, setIntervalDays] = useState<number | null>(null);
  // 38.4 review CR-01: the picker never emits an invalid custom entry, so
  // Import is blocked while Bound and the frequency is invalid.
  const [intervalValid, setIntervalValid] = useState(true);
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
      const saved = initialBulkLifecycle(session);
      setTrackingEnabled(saved.trackingEnabled);
      setIntervalDays(saved.intervalDays);
      setCategories(nextCategories);
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to load bulk import setup", error);
      Alert.alert("Couldn't load import setup", "Please reopen this import.");
    }
  }, [route.params.sessionId]);

  useEffect(() => {
    void load();
  }, [load]);
  // 38.3 review B-CR-02: startBatch leaves `saving` true on its success path
  // (the push to ImportProgress), so returning here after an "Import stopped"
  // must re-enable Import. Only a focus transition runs this, never an
  // in-flight start on the already-focused screen.
  useFocusEffect(
    useCallback(() => {
      setSaving(false);
      void load();
    }, [load]),
  );

  // 38.4 review CR-01: a Bound batch with an invalid custom frequency must not
  // import (the Import button, startBatch, onImport and onCombine all check it).
  const importBlocked =
    saving ||
    count === 0 ||
    boundFrequencyBlocksImport(trackingEnabled, intervalValid);

  function clusterKey(rows: ImportSessionRow[]): string {
    return rows
      .map((row) => row.id)
      .sort((left, right) => left - right)
      .join(",");
  }

  async function startBatch() {
    if (importBlocked) return;
    setSaving(true);
    try {
      const exec = getExecutor();
      const currentCategories = await listCategories(exec);
      const currentCategoryId = resolveCategorySelection(
        currentCategories,
        categoryId,
      );
      setCategories(currentCategories);
      if (currentCategoryId !== categoryId) setCategoryId(currentCategoryId);
      // D-57: category and lifecycle in ONE write before any contact is
      // created, so a resumed import keeps the batch choice.
      await setSessionBatchDefaults(
        exec,
        route.params.sessionId,
        {
          categoryId: currentCategoryId,
          lifecycle: bulkLifecycleChoice(trackingEnabled, intervalDays),
        },
        localDateTime(),
      );
      navigation.navigate("ImportProgress", {
        sessionId: route.params.sessionId,
        batchCategoryId: currentCategoryId,
      });
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to start bulk import", error);
      Alert.alert("Couldn't start import", "Please try again.");
      setSaving(false);
    }
  }

  async function onImport() {
    if (importBlocked) return;
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
    if (
      !consolidationRows ||
      saving ||
      boundFrequencyBlocksImport(trackingEnabled, intervalValid)
    )
      return;
    setSaving(true);
    try {
      const exec = getExecutor();
      const [session, currentCategories] = await Promise.all([
        getSessionById(exec, route.params.sessionId),
        listCategories(exec),
      ]);
      if (!session) throw new Error("import session is unavailable");
      const currentCategoryId = resolveCategorySelection(
        currentCategories,
        categoryId,
      );
      setCategories(currentCategories);
      if (currentCategoryId !== categoryId) setCategoryId(currentCategoryId);
      // D-57: persist the batch choice BEFORE the combine commits, so an
      // import interrupted after this cluster resumes with the same defaults.
      const lifecycle = bulkLifecycleChoice(trackingEnabled, intervalDays);
      await setSessionBatchDefaults(
        exec,
        route.params.sessionId,
        { categoryId: currentCategoryId, lifecycle },
        localDateTime(),
      );
      const result = await combineCluster(exec, importedPhotoFs, {
        rows: consolidationRows,
        batchCategoryId: currentCategoryId,
        lifecycle,
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
    <ScrollView contentContainerStyle={styles.content}>
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
          Orbit participation
        </Text>
        {/* D-57: one lifecycle for the whole batch, Unbound by default. The
            selected option is accent-filled with an onAccent label (ADR-084,
            as D-30). */}
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Orbit participation"
          style={styles.defaults}
        >
          {LIFECYCLE_OPTIONS.map(({ bound, label }) => {
            const selected = trackingEnabled === bound;
            return (
              <Pressable
                key={label}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                accessibilityLabel={label}
                onPress={() => {
                  setEdited(true);
                  setTrackingEnabled(bound);
                  // Unbound hides the picker; its last validity no longer applies.
                  if (!bound) setIntervalValid(true);
                }}
                style={[
                  styles.default,
                  {
                    backgroundColor: selected ? colors.accent : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected ? colors.onAccent : colors.textPrimary,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {trackingEnabled ? (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Frequency
            </Text>
            <FrequencyPicker
              value={intervalDays ?? BULK_IMPORT_DEFAULT_FREQUENCY}
              onChange={(value) => {
                setEdited(true);
                setIntervalDays(value);
              }}
              onValidityChange={setIntervalValid}
            />
            <Text style={[styles.blurb, { color: colors.textSecondary }]}>
              {BULK_BOUND_BLURB}
            </Text>
          </>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Category override
        </Text>
        {categories.length > CATEGORY_SEARCH_THRESHOLD ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Batch category override"
            onPress={() => setCategorySheetOpen(true)}
            style={[
              styles.picker,
              styles.categoryChoice,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.textPrimary }}>
              {categories.find((row) => row.id === categoryId)?.name ??
                "Uncategorized"}
            </Text>
          </Pressable>
        ) : (
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
        )}
        <CategoryChoiceSheet
          visible={categorySheetOpen}
          categories={categories}
          selectedId={categoryId}
          onSelect={(value) => {
            setEdited(true);
            setCategoryId(value);
          }}
          onRequestClose={() => setCategorySheetOpen(false)}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={importBlocked}
        onPress={() => void onImport()}
        style={[
          styles.import,
          {
            backgroundColor: importBlocked ? colors.surface : colors.accent,
            borderColor: importBlocked ? colors.border : colors.accent,
          },
        ]}
      >
        <Text
          style={{
            color: importBlocked ? colors.textSecondary : colors.onAccent,
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
  blurb: { fontSize: 13, lineHeight: 18 },
  defaults: { flexDirection: "row", gap: 8 },
  default: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  picker: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  categoryChoice: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  import: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
  },
});
