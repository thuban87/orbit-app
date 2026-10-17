// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { type FilterChip, FilterChipRow } from "@/components/FilterChipRow";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button, ConfirmDialog, OrbitSwitch } from "@/components/ui";
import { MIN_TOUCH_TARGET } from "@/components/ui/button-roles";
import { SettingsSectionCard } from "@/components/ui/SettingsSectionCard";
import {
  type AiDefaultKey,
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
import { aiLockReason } from "@/logic/ai-lock";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import { plural } from "@/utils/plural";
import {
  type AiPermissionTypeFilter,
  buildPermissionSummaryCopy,
  defaultRowCaption,
  filterAiPermissionItems,
  groupAiPermissionItems,
  permissionGroupA11yLabel,
  permissionGroupCaption,
  permissionItemA11yLabel,
  selectedPermissionRefs,
  visibleSelectedKeys,
} from "./ai-permissions-logic";

const LOG_SCOPE = "ai-permissions";
const DEFAULT_NOTE = "Changing this affects new items only.";

const TYPE_CHIPS: FilterChip<AiPermissionTypeFilter>[] = [
  { key: "all", label: "All" },
  { key: "memory", label: "Memories" },
  { key: "interaction-note", label: "Interaction notes" },
  { key: "custom-field", label: "Custom fields" },
];

/**
 * One "new items" default row. `defaultKey` is the setting it writes;
 * `reviewCategory` is the closed review filter its "Review existing" link
 * opens. Gift Ideas and Thought of Them have their own defaults (D-61) but are
 * reviewed as memories, so the review union stays closed (RESEARCH Pitfall 5).
 * Every row's caption follows its switch (`defaultRowCaption`, 38.12 D-88,
 * D-28).
 */
const DEFAULT_ROWS: ReadonlyArray<{
  defaultKey: AiDefaultKey;
  reviewCategory: AiPermissionCategory;
  key: keyof AiPermissionDefaults;
  label: string;
}> = [
  {
    defaultKey: "memory",
    reviewCategory: "memory",
    key: "memory",
    label: "Memories",
  },
  {
    defaultKey: "gift_idea",
    reviewCategory: "memory",
    key: "giftIdea",
    label: "Gift Ideas",
  },
  {
    defaultKey: "thought_of_them",
    reviewCategory: "memory",
    key: "thoughtOfThem",
    label: "Thought of Them",
  },
  {
    defaultKey: "interaction-note",
    reviewCategory: "interaction-note",
    key: "interactionNote",
    label: "Interaction notes",
  },
  {
    defaultKey: "custom-field",
    reviewCategory: "custom-field",
    key: "customField",
    label: "Custom fields",
  },
];

type PendingAction =
  | { kind: "disable" }
  | { kind: "enable"; impact: AiPermissionImpact }
  | null;

/** The "Review existing…" link label on each default row. */
function ReviewExistingLinkLabel() {
  const { colors } = useTheme();
  return (
    <AppText role="caption" style={{ color: colors.accentText }}>
      Review existing…
    </AppText>
  );
}

/** A default row's caption. */
function DefaultRowCaption({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <AppText role="caption" style={{ color: colors.textSecondary }}>
      {text}
    </AppText>
  );
}

/** Back is the shared header's only (38.9 D-16, D-07). */
export function AIPermissionsScreen() {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const [defaults, setDefaults] = useState<AiPermissionDefaults>({
    memory: 0,
    interactionNote: 0,
    customField: 0,
    giftIdea: 0,
    thoughtOfThem: 0,
  });
  const [items, setItems] = useState<AiPermissionItem[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<AiPermissionTypeFilter>("all");
  const [enabledOnly, setEnabledOnly] = useState(true);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  // 38.4 review Lane D WR-01: a failed READ means no count is truthful; a
  // failed WRITE leaves the last clean read standing. Separate states, so a
  // failed toggle or bulk apply never hides the counts.
  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Only a successful read backs a count (38.4 AUD-UIA-013): until the first
  // read lands the empty `items` array is not "AI can access nothing".
  const [loaded, setLoaded] = useState(false);
  // "Review existing…" scrolls the page to the review list (38.12 D-86).
  const scrollRef = useRef<ScrollView>(null);
  const reviewY = useRef(0);

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [nextDefaults, nextItems] = await Promise.all([
        getAiPermissionDefaults(exec),
        listAiPermissionItems(exec, {}),
      ]);
      setDefaults(nextDefaults);
      setItems(nextItems);
      setLoaded(true);
      setReadError(null);
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to load AI permissions", caught);
      setReadError("Couldn't load AI permissions. Please try again.");
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
  // Access totals come from the UNFILTERED enabled items; the list line states
  // exactly what the list below shows and how much of it AI can access; no
  // count prints without a clean read (38.4 RG-008; AUD-UIA-013; D-17; D-44).
  const summaryCopy = useMemo(
    () =>
      buildPermissionSummaryCopy({
        allItems: items,
        filteredItems: filtered,
        enabledOnly,
        loadFailed: !loaded || readError !== null,
      }),
    [enabledOnly, filtered, items, loaded, readError],
  );
  // 38.4 review Lane D WR-04: only selected rows that are on screen (filtered
  // view, expanded contact) count or reach a bulk consent change.
  const visibleSelected = useMemo(
    () => visibleSelectedKeys(filtered, expandedContact, selected),
    [expandedContact, filtered, selected],
  );
  // Disable acts on every visible selected row; Enable never includes a locked
  // one (38.10 D-102, D-103).
  const selectedRefs = useMemo(
    () => selectedPermissionRefs(filtered, visibleSelected),
    [filtered, visibleSelected],
  );
  const enableRefs = useMemo(
    () => selectedPermissionRefs(filtered, visibleSelected, "enable"),
    [filtered, visibleSelected],
  );

  async function toggleDefault(
    category: AiDefaultKey,
    key: keyof AiPermissionDefaults,
    enabled: boolean,
  ) {
    const value = enabled ? 1 : 0;
    setDefaults((current) => ({ ...current, [key]: value }));
    setActionError(null);
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
      setActionError("Couldn't update that default. Please try again.");
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
    if (enableRefs.length === 0) return;
    setActionError(null);
    try {
      const impact = await getBulkPermissionImpact(getExecutor(), enableRefs);
      setPendingAction({ kind: "enable", impact });
    } catch (caught) {
      Logger.error(
        LOG_SCOPE,
        "failed to calculate AI permission impact",
        caught,
      );
      setActionError("Couldn't review that selection. Please try again.");
    }
  }

  async function applyPending() {
    const refs = pendingAction?.kind === "enable" ? enableRefs : selectedRefs;
    if (!pendingAction || refs.length === 0 || busy) return;
    setBusy(true);
    setActionError(null);
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
      setActionError("Couldn't update those permissions. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const shownError = readError ?? actionError;

  const confirmMessage =
    pendingAction?.kind === "enable"
      ? `This will make ${plural(pendingAction.impact.items, "item")} across ${plural(pendingAction.impact.contacts, "contact")} available to AI. Enable?`
      : "Remove AI access from the selected information?";

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="AI Data Permissions" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        <SettingsSectionCard title="Defaults for new information">
          <View key="note" style={styles.cardRow}>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {DEFAULT_NOTE}
            </AppText>
          </View>
          {DEFAULT_ROWS.map((row) => (
            <View key={row.key} style={[styles.cardRow, styles.defaultRow]}>
              <View style={styles.copy}>
                <AppText role="body">{row.label}</AppText>
                <DefaultRowCaption
                  text={defaultRowCaption(defaults[row.key] === 1)}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Review existing ${row.label}`}
                  onPress={() => {
                    setTypeFilter(row.reviewCategory);
                    setEnabledOnly(false);
                    scrollRef.current?.scrollTo({
                      y: reviewY.current,
                      animated: true,
                    });
                  }}
                  style={styles.reviewLink}
                >
                  <ReviewExistingLinkLabel />
                </Pressable>
              </View>
              <OrbitSwitch
                accessibilityLabel={`Allow AI for new ${row.label}`}
                value={defaults[row.key] === 1}
                onValueChange={(value) =>
                  void toggleDefault(row.defaultKey, row.key, value)
                }
              />
            </View>
          ))}
        </SettingsSectionCard>

        <View
          onLayout={(event) => {
            reviewY.current = event.nativeEvent.layout.y;
          }}
        >
          <SettingsSectionCard title="Review existing">
            <View key="filters" style={[styles.cardRow, styles.filters]}>
              <TextInput
                accessibilityLabel="Search contacts"
                autoCapitalize="none"
                placeholder="Search contacts"
                placeholderTextColor={colors.textPlaceholder}
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
                <OrbitSwitch
                  accessibilityLabel="Show enabled information only"
                  value={enabledOnly}
                  onValueChange={setEnabledOnly}
                />
              </View>
              {summaryCopy.accessLine !== null ? (
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  {summaryCopy.accessLine}
                </AppText>
              ) : null}
              {summaryCopy.listLine !== null ? (
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  {summaryCopy.listLine}
                </AppText>
              ) : null}
              {shownError ? (
                <AppText
                  accessibilityLabel={shownError}
                  role="caption"
                  style={{ color: colors.danger }}
                >
                  {shownError}
                </AppText>
              ) : null}
            </View>
            {groups.length === 0 ? (
              summaryCopy.emptyLine !== null ? (
                <View key="empty" style={styles.cardRow}>
                  <AppText role="body">{summaryCopy.emptyLine}</AppText>
                </View>
              ) : null
            ) : (
              groups.map((group) => {
                const expanded = expandedContact === group.contactUid;
                return (
                  <View key={group.contactUid} style={styles.cardRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={permissionGroupA11yLabel(
                        group,
                        expanded,
                      )}
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
                        {permissionGroupCaption(group, expanded)}
                      </AppText>
                    </Pressable>
                    {expanded
                      ? group.items.map((item) => {
                          const checked = visibleSelected.has(item.itemKey);
                          return (
                            <Pressable
                              key={item.itemKey}
                              accessibilityRole="checkbox"
                              accessibilityLabel={permissionItemA11yLabel(item)}
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
                                {item.locked ? (
                                  <AppText
                                    role="caption"
                                    style={{ color: colors.textSecondary }}
                                  >
                                    {aiLockReason(item.locked)}
                                  </AppText>
                                ) : null}
                              </View>
                              <AppText
                                role="caption"
                                style={{
                                  color: item.enabled
                                    ? colors.accentText
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
                  </View>
                );
              })
            )}
          </SettingsSectionCard>
        </View>

        {visibleSelected.size > 0 ? (
          <View style={styles.bulkActions}>
            <AppText role="caption">{visibleSelected.size} selected</AppText>
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
                disabled={busy || enableRefs.length === 0}
                onPress={() => void requestEnable()}
              />
            </View>
          </View>
        ) : null}
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
  bulkActions: { gap: SPACING.sm },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  // A row inside a shared section card brings its own padding (D-119).
  cardRow: { padding: SPACING.base, gap: SPACING.xs },
  contactHeader: { gap: SPACING.xs },
  content: { gap: SPACING.xl, padding: SPACING.base },
  copy: { flex: 1, gap: SPACING.xs },
  defaultRow: { alignItems: "center", flexDirection: "row", gap: SPACING.md },
  enabledRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  filters: { gap: SPACING.md },
  // The "Review existing…" link meets the 44dp floor with its own box — no
  // overlapping hitSlop (38.4 RG-030; ui-accessibility/AUD-UIA-006).
  reviewLink: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: MIN_TOUCH_TARGET,
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
});
