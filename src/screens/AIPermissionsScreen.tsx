// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { type FilterChip, FilterChipRow } from "@/components/FilterChipRow";
import { AppText, Button, ConfirmDialog, GlassSurface } from "@/components/ui";
import {
  type AiPermissionCategory,
  type AiPermissionDefaults,
  type AiPermissionImpact,
  type AiPermissionItem,
  bulkDisableAiPermissions,
  bulkEnableAiPermissions,
  getAiPermissionDefaults,
  getBulkPermissionImpact,
  listAiPermissionItems,
  setAiPermissionDefault,
} from "@/db/ai-permissions-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  type AiPermissionTypeFilter,
  filterAiPermissionItems,
  groupAiPermissionItems,
  selectedPermissionRefs,
  summarizePermissionView,
} from "./ai-permissions-logic";

const LOG_SCOPE = "ai-permissions";
const EMPTY_COPY = "AI can't access any contact information yet.";
const DEFAULT_NOTE = "Changing this affects new items only.";

const TYPE_CHIPS: FilterChip<AiPermissionTypeFilter>[] = [
  { key: "all", label: "All" },
  { key: "memory", label: "Memories" },
  { key: "interaction-note", label: "Interaction notes" },
  { key: "custom-field", label: "Custom fields" },
];

const DEFAULT_ROWS: ReadonlyArray<{
  category: AiPermissionCategory;
  key: keyof AiPermissionDefaults;
  label: string;
}> = [
  { category: "memory", key: "memory", label: "Memories" },
  {
    category: "interaction-note",
    key: "interactionNote",
    label: "Interaction notes",
  },
  { category: "custom-field", key: "customField", label: "Custom fields" },
];

interface AIPermissionsScreenProps {
  onBack: () => void;
}

type PendingAction =
  | { kind: "disable" }
  | { kind: "enable"; impact: AiPermissionImpact }
  | null;

export function AIPermissionsScreen({ onBack }: AIPermissionsScreenProps) {
  const { colors } = useTheme();
  const [defaults, setDefaults] = useState<AiPermissionDefaults>({
    memory: 0,
    interactionNote: 0,
    customField: 0,
  });
  const [items, setItems] = useState<AiPermissionItem[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<AiPermissionTypeFilter>("all");
  const [enabledOnly, setEnabledOnly] = useState(true);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [nextDefaults, nextItems] = await Promise.all([
        getAiPermissionDefaults(exec),
        listAiPermissionItems(exec, {}),
      ]);
      setDefaults(nextDefaults);
      setItems(nextItems);
      setError(null);
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to load AI permissions", caught);
      setError("Couldn't load AI permissions. Please try again.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      filterAiPermissionItems(items, {
        query,
        type: typeFilter,
        enabledOnly,
      }),
    [enabledOnly, items, query, typeFilter],
  );
  const groups = useMemo(() => groupAiPermissionItems(filtered), [filtered]);
  const summary = useMemo(() => summarizePermissionView(filtered), [filtered]);
  const refs = useMemo(
    () => selectedPermissionRefs(items, selected),
    [items, selected],
  );

  async function toggleDefault(
    category: AiPermissionCategory,
    key: keyof AiPermissionDefaults,
    enabled: boolean,
  ) {
    const value = enabled ? 1 : 0;
    setDefaults((current) => ({ ...current, [key]: value }));
    try {
      await setAiPermissionDefault(
        getExecutor(),
        category,
        value,
        localDateTime(),
      );
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to update AI permission default", caught);
      setDefaults((current) => ({ ...current, [key]: enabled ? 0 : 1 }));
      setError("Couldn't update that default. Please try again.");
    }
  }

  function toggleSelected(itemKey: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  }

  async function requestEnable() {
    if (refs.length === 0) return;
    try {
      const impact = await getBulkPermissionImpact(getExecutor(), refs);
      setPendingAction({ kind: "enable", impact });
    } catch (caught) {
      Logger.error(
        LOG_SCOPE,
        "failed to calculate AI permission impact",
        caught,
      );
      setError("Couldn't review that selection. Please try again.");
    }
  }

  async function applyPending() {
    if (!pendingAction || refs.length === 0 || busy) return;
    setBusy(true);
    try {
      if (pendingAction.kind === "enable") {
        await bulkEnableAiPermissions(getExecutor(), refs, localDateTime());
      } else {
        await bulkDisableAiPermissions(getExecutor(), refs, localDateTime());
      }
      setPendingAction(null);
      setSelected(new Set());
      await load();
    } catch (caught) {
      Logger.error(
        LOG_SCOPE,
        "failed to update selected AI permissions",
        caught,
      );
      setError("Couldn't update those permissions. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const confirmMessage =
    pendingAction?.kind === "enable"
      ? `This will make ${pendingAction.impact.items} items across ${pendingAction.impact.contacts} contacts available to AI. Enable?`
      : "Remove AI access from the selected information?";

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Button role="tertiary" label="Back" onPress={onBack} />
        <AppText accessibilityRole="header" role="display">
          AI Data Permissions
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <AppText role="heading">Defaults for new information</AppText>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            {DEFAULT_NOTE}
          </AppText>
          {DEFAULT_ROWS.map((row) => (
            <GlassSurface
              key={row.category}
              density="dense"
              style={styles.card}
            >
              <View style={styles.defaultRow}>
                <View style={styles.copy}>
                  <AppText role="body">{row.label}</AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Review existing ${row.label}`}
                    onPress={() => {
                      setTypeFilter(row.category);
                      setEnabledOnly(false);
                    }}
                  >
                    <AppText role="caption" style={{ color: colors.accent }}>
                      Review existing…
                    </AppText>
                  </Pressable>
                </View>
                <Switch
                  accessibilityLabel={`Allow AI for new ${row.label}`}
                  value={defaults[row.key] === 1}
                  onValueChange={(value) =>
                    void toggleDefault(row.category, row.key, value)
                  }
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.surfaceElevated}
                />
              </View>
            </GlassSurface>
          ))}
        </View>

        <View style={styles.section}>
          <AppText role="heading">Review existing</AppText>
          <TextInput
            accessibilityLabel="Search contacts"
            autoCapitalize="none"
            placeholder="Search contacts"
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            style={[
              styles.search,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          <FilterChipRow
            chips={TYPE_CHIPS}
            active={typeFilter}
            onSelect={setTypeFilter}
          />
          <View style={styles.enabledRow}>
            <AppText role="body">Enabled only</AppText>
            <Switch
              accessibilityLabel="Show enabled information only"
              value={enabledOnly}
              onValueChange={setEnabledOnly}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            AI can currently access information from {summary.contacts} contacts
            · {summary.items} items
          </AppText>

          {error ? (
            <AppText
              accessibilityLabel={error}
              role="caption"
              style={{ color: colors.danger }}
            >
              {error}
            </AppText>
          ) : null}

          {groups.length === 0 ? (
            <GlassSurface density="dense" style={styles.card}>
              <AppText role="body">{EMPTY_COPY}</AppText>
            </GlassSurface>
          ) : (
            groups.map((group) => {
              const expanded = expandedContact === group.contactUid;
              return (
                <GlassSurface
                  key={group.contactUid}
                  density="dense"
                  style={styles.card}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${expanded ? "Hide" : "Review"} ${group.contactName}`}
                    accessibilityState={{ expanded }}
                    onPress={() =>
                      setExpandedContact(expanded ? null : group.contactUid)
                    }
                    style={styles.contactHeader}
                  >
                    <AppText role="body">{group.contactName}</AppText>
                    <AppText
                      role="caption"
                      style={{ color: colors.textSecondary }}
                    >
                      {group.items.length} items ·{" "}
                      {expanded ? "Hide" : "Review"}
                    </AppText>
                  </Pressable>
                  {expanded
                    ? group.items.map((item) => {
                        const checked = selected.has(item.itemKey);
                        return (
                          <Pressable
                            key={item.itemKey}
                            accessibilityRole="checkbox"
                            accessibilityLabel={`${item.label}: ${item.value}`}
                            accessibilityState={{ checked }}
                            onPress={() => toggleSelected(item.itemKey)}
                            style={[
                              styles.item,
                              { borderTopColor: colors.border },
                            ]}
                          >
                            <View style={styles.copy}>
                              <AppText role="body">{item.label}</AppText>
                              <AppText
                                role="caption"
                                style={{ color: colors.textSecondary }}
                              >
                                {item.value}
                              </AppText>
                            </View>
                            <AppText
                              role="caption"
                              style={{
                                color: item.enabled
                                  ? colors.accent
                                  : colors.textSecondary,
                              }}
                            >
                              {checked
                                ? "Selected"
                                : item.enabled
                                  ? "Enabled"
                                  : "Disabled"}
                            </AppText>
                          </Pressable>
                        );
                      })
                    : null}
                </GlassSurface>
              );
            })
          )}

          {selected.size > 0 ? (
            <View style={styles.bulkActions}>
              <AppText role="caption">{selected.size} selected</AppText>
              <View style={styles.buttonRow}>
                <Button
                  role="secondary"
                  label="Disable selected"
                  disabled={busy}
                  onPress={() => setPendingAction({ kind: "disable" })}
                />
                <Button
                  role="primary"
                  label="Enable selected"
                  disabled={busy}
                  onPress={() => void requestEnable()}
                />
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={pendingAction !== null}
        onRequestClose={() => setPendingAction(null)}
        title={
          pendingAction?.kind === "enable"
            ? "Enable AI access?"
            : "Disable AI access?"
        }
        message={confirmMessage}
        confirmLabel={
          pendingAction?.kind === "enable" ? "Enable access" : "Disable access"
        }
        destructive={pendingAction?.kind === "disable"}
        onConfirm={() => void applyPending()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bulkActions: { gap: SPACING.sm, paddingTop: SPACING.sm },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  card: { padding: SPACING.base },
  contactHeader: { gap: SPACING.xs },
  content: { gap: SPACING.xl, padding: SPACING.base },
  copy: { flex: 1, gap: SPACING.xs },
  defaultRow: { alignItems: "center", flexDirection: "row", gap: SPACING.md },
  enabledRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.base,
  },
  item: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.sm,
    minHeight: 44,
    paddingTop: SPACING.sm,
  },
  root: { flex: 1 },
  search: {
    borderRadius: RADII.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
  },
  section: { gap: SPACING.md },
});
