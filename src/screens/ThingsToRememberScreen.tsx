/** Unified local-only Contact Knowledge surface (KNOW-01). */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { MemoryEditor, type MemoryDraft } from "@/components/MemoryEditor";
import {
  RelationshipEditor,
  type RelationshipDraft,
} from "@/components/RelationshipEditor";
import { AppText } from "@/components/ui";
import { setCurrentStateValue } from "@/db/current-state-history-dao";
import {
  getCurrentStateValues,
  type CurrentStateEntryRow,
} from "@/db/current-state-history-read";
import { getExecutor, localDateTime } from "@/db/database";
import { listDefs } from "@/db/field-defs-dao";
import {
  getValuesForContact,
  visibleDefsForProfile,
} from "@/db/field-values-dao";
import {
  getFirstClassDerived,
  getFirstClassFields,
  type FirstClassDerived,
  type FirstClassFields,
} from "@/db/first-class-knowledge-read";
import {
  CURRENT_STATE_FIELD_KEYS,
  CURRENT_STATE_FIELD_REGISTRY,
  KNOWLEDGE_GROUP_ORDER,
  MEMORY_TYPE_REGISTRY,
  PROVISIONAL_MEMORY_LABEL,
  RELATIONSHIPS_GROUP,
  type CurrentStateFieldKey,
} from "@/db/memory-registry";
import {
  addMemory,
  deleteMemory,
  editMemory,
  restoreMemory,
} from "@/db/memories-dao";
import {
  listMemoriesForContact,
  resolveVisibility,
  type MemoryRow,
} from "@/db/memories-read";
import {
  addRelationship,
  deleteRelationship,
  editRelationship,
  restoreRelationship,
} from "@/db/relationships-dao";
import {
  listRelationshipsForContact,
  resolveRelationshipVisibility,
  type RelationshipRow,
} from "@/db/relationships-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { snackbarStore } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import { rowsForKnowledgeDisplay } from "./things-to-remember-ordering";

const LOG_SCOPE = "things-to-remember";
const GROUP_PREVIEW_LIMIT = 3;
const [CURRENT_STATE_GROUP, RELATIONSHIPS_GROUP_KEY, MEMORIES_GROUP_KEY] =
  KNOWLEDGE_GROUP_ORDER;
const FIRST_CLASS_LABELS = {
  birthday: "Birthday",
  socialBattery: "Social Battery",
  intervalDays: "Contact Frequency",
  categoryName: "Category",
  gravity: "Gravity",
  intensity: "Intensity (closeness)",
} as const;

interface CustomValue {
  id: number;
  label: string;
  value: string | null;
}
interface KnowledgeState {
  memories: MemoryRow[];
  relationships: RelationshipRow[];
  currentValues: Partial<Record<CurrentStateFieldKey, CurrentStateEntryRow>>;
  firstClass: FirstClassFields | null;
  derived: FirstClassDerived | null;
  customValues: CustomValue[];
}
const EMPTY_KNOWLEDGE: KnowledgeState = {
  memories: [],
  relationships: [],
  currentValues: {},
  firstClass: null,
  derived: null,
  customValues: [],
};

function memoryGroupLabel(memory: MemoryRow): string {
  if (memory.type === "custom")
    return memory.custom_label ?? PROVISIONAL_MEMORY_LABEL;
  return (
    MEMORY_TYPE_REGISTRY[memory.type as keyof typeof MEMORY_TYPE_REGISTRY]
      ?.displayName ?? PROVISIONAL_MEMORY_LABEL
  );
}
function firstClassRows(
  firstClass: FirstClassFields | null,
  derived: FirstClassDerived | null,
) {
  const rows: { label: string; value: string | null }[] = [
    { label: FIRST_CLASS_LABELS.birthday, value: firstClass?.birthday ?? null },
    {
      label: FIRST_CLASS_LABELS.socialBattery,
      value: firstClass?.socialBattery ?? null,
    },
    {
      label: FIRST_CLASS_LABELS.intervalDays,
      value:
        firstClass?.intervalDays == null
          ? null
          : `${firstClass.intervalDays} days`,
    },
    {
      label: FIRST_CLASS_LABELS.categoryName,
      value: firstClass?.categoryName ?? null,
    },
    {
      label: FIRST_CLASS_LABELS.gravity,
      value: derived?.gravity?.tierName ?? null,
    },
    {
      label: FIRST_CLASS_LABELS.intensity,
      value:
        derived?.intensity == null
          ? null
          : `${derived.intensity.multiple}× this period`,
    },
  ];
  return rows.filter(
    (row): row is { label: string; value: string } => row.value !== null,
  );
}

export function ThingsToRememberScreen({
  navigation,
  route,
}: RootStackScreenProps<"ThingsToRemember">) {
  const { colors } = useTheme();
  const { contactId } = route.params;
  const [knowledge, setKnowledge] = useState<KnowledgeState>(EMPTY_KNOWLEDGE);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingField, setEditingField] = useState<CurrentStateFieldKey | null>(
    null,
  );
  const [currentDraft, setCurrentDraft] = useState("");

  const load = useCallback(
    async (cancelled: () => boolean = () => false) => {
      const exec = getExecutor();
      const [
        memories,
        relationships,
        currentValues,
        firstClass,
        derived,
        defs,
      ] = await Promise.all([
        listMemoriesForContact(exec, contactId),
        listRelationshipsForContact(exec, contactId),
        getCurrentStateValues(exec, contactId),
        getFirstClassFields(exec, contactId),
        getFirstClassDerived(exec, contactId, localDateTime()),
        listDefs(exec, { includeQuarantined: false }),
      ]);
      const values = await getValuesForContact(exec, contactId, defs);
      const visibleDefs = visibleDefsForProfile(defs, values);
      if (cancelled()) return;
      setKnowledge({
        memories,
        relationships,
        currentValues,
        firstClass,
        derived,
        customValues: visibleDefs.map((definition) => ({
          id: definition.id,
          label: definition.label,
          value: values[definition.col_name] ?? null,
        })),
      });
    },
    [contactId],
  );
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void load(() => cancelled).catch((error) => {
        Logger.error(LOG_SCOPE, "failed to load contact knowledge", error);
        if (!cancelled) setKnowledge(EMPTY_KNOWLEDGE);
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const memories = rowsForKnowledgeDisplay(
    knowledge.memories,
    includeHidden,
    (memory) => resolveVisibility(memory.type, memory.hidden) === "hide",
  );
  const relationships = rowsForKnowledgeDisplay(
    knowledge.relationships,
    includeHidden,
    (relationship) => resolveRelationshipVisibility(relationship.hidden) === "hide",
  );
  const groupedMemories = useMemo(() => {
    const groups = new Map<string, MemoryRow[]>();
    for (const memory of memories) {
      const key = `${memory.type}:${memory.custom_label ?? ""}`;
      groups.set(key, [...(groups.get(key) ?? []), memory]);
    }
    return [...groups.entries()].map(([key, items]) => ({
      key,
      label: memoryGroupLabel(items[0]),
      items,
    }));
  }, [memories]);
  const firstClass = firstClassRows(knowledge.firstClass, knowledge.derived);
  const isEmpty =
    !knowledge.firstClass?.birthday &&
    !knowledge.firstClass?.socialBattery &&
    Object.keys(knowledge.currentValues).length === 0 &&
    knowledge.customValues.length === 0 &&
    knowledge.relationships.every((relationship) =>
      resolveRelationshipVisibility(relationship.hidden) === "hide",
    ) &&
    knowledge.memories.every(
      (memory) => resolveVisibility(memory.type, memory.hidden) === "hide",
    );
  const refresh = () =>
    void load().catch((error) =>
      Logger.error(LOG_SCOPE, "failed to refresh contact knowledge", error),
    );

  const saveCurrentValue = async (fieldKey: CurrentStateFieldKey) => {
    const value = currentDraft.trim();
    if (!value) return;
    try {
      await setCurrentStateValue(getExecutor(), {
        contactId,
        fieldKey,
        value,
        now: localDateTime(),
      });
      setEditingField(null);
      setCurrentDraft("");
      refresh();
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to save current state", error);
    }
  };
  const add = async (draft: MemoryDraft): Promise<boolean> => {
    try {
      const now = localDateTime();
      await addMemory(getExecutor(), {
        contactId,
        ...draft,
        createdAt: now,
        now,
      });
      refresh();
      return true;
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to add memory", error);
      return false;
    }
  };
  const edit = async (id: number, draft: MemoryDraft): Promise<boolean> => {
    try {
      await editMemory(getExecutor(), {
        id,
        contactId,
        ...draft,
        now: localDateTime(),
      });
      refresh();
      return true;
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to edit memory", error);
      return false;
    }
  };
  const restore = (id: number) =>
    void restoreMemory(getExecutor(), { id, contactId, now: localDateTime() })
      .then(refresh)
      .catch((error) =>
        Logger.error(LOG_SCOPE, "failed to restore memory", error),
      );
  const remove = (id: number) =>
    void deleteMemory(getExecutor(), { id, contactId, now: localDateTime() })
      .then(() => {
        refresh();
        snackbarStore.getState().show({
          kind: "success",
          label: "Moved to Recently Deleted",
          action: {
            label: "Undo",
            accessibilityLabel: "Undo moving memory to Recently Deleted",
            onPress: () => restore(id),
          },
        });
      })
      .catch((error) =>
        Logger.error(LOG_SCOPE, "failed to delete memory", error),
      );
  const unhideMemory = (memory: MemoryRow) =>
    void editMemory(getExecutor(), {
      id: memory.id,
      contactId,
      hidden: false,
      now: localDateTime(),
    })
      .then(refresh)
      .catch((error) =>
        Logger.error(LOG_SCOPE, "failed to show memory on Profile", error),
      );
  const addKeyPerson = async (
    draft: RelationshipDraft,
  ): Promise<boolean> => {
    try {
      const now = localDateTime();
      await addRelationship(getExecutor(), {
        contactId,
        ...draft,
        createdAt: now,
        now,
      });
      refresh();
      return true;
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to add relationship", error);
      return false;
    }
  };
  const editKeyPerson = async (
    id: number,
    draft: RelationshipDraft,
  ): Promise<boolean> => {
    try {
      await editRelationship(getExecutor(), {
        id,
        contactId,
        ...draft,
        now: localDateTime(),
      });
      refresh();
      return true;
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to edit relationship", error);
      return false;
    }
  };
  const restoreKeyPerson = (id: number) =>
    void restoreRelationship(getExecutor(), {
      id,
      contactId,
      now: localDateTime(),
    })
      .then(refresh)
      .catch((error) =>
        Logger.error(LOG_SCOPE, "failed to restore relationship", error),
      );
  const removeKeyPerson = (id: number) =>
    void deleteRelationship(getExecutor(), {
      id,
      contactId,
      now: localDateTime(),
    })
      .then(() => {
        refresh();
        snackbarStore.getState().show({
          kind: "success",
          label: "Relationship removed",
          action: {
            label: "Undo",
            accessibilityLabel: "Undo removing relationship",
            onPress: () => restoreKeyPerson(id),
          },
        });
      })
      .catch((error) =>
        Logger.error(LOG_SCOPE, "failed to delete relationship", error),
      );

  return (
    <ScrollView
      testID="things-to-remember-screen"
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
          <AppText role="caption">Back</AppText>
        </Pressable>
        <AppText accessibilityRole="header" role="display">
          Things to Remember
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recently Deleted"
          onPress={() => navigation.navigate("RecentlyDeleted", { contactId })}
          style={[styles.back, { borderColor: colors.border }]}
        >
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            Recently Deleted
          </AppText>
        </Pressable>
      </View>
      <View
        testID={`knowledge-group-${CURRENT_STATE_GROUP}`}
        style={[styles.group, { borderColor: colors.border }]}
      >
        <View style={styles.switchRow}>
          <View style={styles.visibilityCopy}>
            <AppText role="heading">Show hidden items</AppText>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              Hidden items are still stored on this device.
            </AppText>
          </View>
          <Switch
            value={includeHidden}
            onValueChange={setIncludeHidden}
            accessibilityLabel="Show hidden items"
          />
        </View>
      </View>
      {isEmpty ? (
        <View testID="things-to-remember-empty" style={styles.empty}>
          <AppText role="heading">Nothing to remember yet</AppText>
          <AppText role="body" style={{ color: colors.textSecondary }}>
            Add birthdays, gift ideas, key people, and anything worth bringing
            up next time.
          </AppText>
        </View>
      ) : null}
      <View style={[styles.group, { borderColor: colors.border }]}>
        <AppText role="heading">Featured &amp; current</AppText>
        {firstClass.map((row) => (
          <View key={row.label} style={styles.readOnlyRow}>
            <AppText role="label" style={{ color: colors.textSecondary }}>
              {row.label}
            </AppText>
            <AppText role="body">{row.value}</AppText>
          </View>
        ))}
        {CURRENT_STATE_FIELD_KEYS.map((fieldKey) => {
          const current = knowledge.currentValues[fieldKey];
          const editing = editingField === fieldKey;
          return (
            <View key={fieldKey} style={styles.currentStateRow}>
              <AppText role="label">
                {CURRENT_STATE_FIELD_REGISTRY[fieldKey].displayName}
              </AppText>
              <AppText role="body">{current?.value ?? "Not set"}</AppText>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {current ? "Most recent" : "Not set"}
              </AppText>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Set new ${CURRENT_STATE_FIELD_REGISTRY[fieldKey].displayName} value`}
                  onPress={() => {
                    setEditingField(fieldKey);
                    setCurrentDraft("");
                  }}
                  style={[styles.action, { borderColor: colors.border }]}
                >
                  <AppText role="caption" style={{ color: colors.accent }}>
                    Set new value
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${CURRENT_STATE_FIELD_REGISTRY[fieldKey].displayName} history`}
                  onPress={() =>
                    navigation.navigate("MemoryHistory", {
                      contactId,
                      fieldKey,
                    })
                  }
                  style={[styles.action, { borderColor: colors.border }]}
                >
                  <AppText role="caption" style={{ color: colors.accent }}>
                    History
                  </AppText>
                </Pressable>
              </View>
              {editing ? (
                <View style={styles.inlineDraft}>
                  <TextInput
                    accessibilityLabel={`New ${CURRENT_STATE_FIELD_REGISTRY[fieldKey].displayName} value`}
                    value={currentDraft}
                    onChangeText={setCurrentDraft}
                    placeholder="Set a new value"
                    placeholderTextColor={colors.textSecondary}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Save current value"
                    onPress={() => void saveCurrentValue(fieldKey)}
                    style={[styles.action, { borderColor: colors.border }]}
                  >
                    <AppText role="caption" style={{ color: colors.accent }}>
                      Save
                    </AppText>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      {knowledge.customValues.length > 0 ? (
        <View
          testID={`knowledge-group-${RELATIONSHIPS_GROUP_KEY}`}
          style={[styles.group, { borderColor: colors.border }]}
        >
          <AppText role="heading">Custom fields</AppText>
          {knowledge.customValues.map((item) => (
            <View key={item.id} style={styles.readOnlyRow}>
              <AppText role="label" style={{ color: colors.textSecondary }}>
                {item.label}
              </AppText>
              {item.value ? <AppText role="body">{item.value}</AppText> : null}
            </View>
          ))}
        </View>
      ) : null}
      <View style={[styles.group, { borderColor: colors.border }]}>
        <AppText role="heading">{RELATIONSHIPS_GROUP.displayName}</AppText>
        <RelationshipEditor
          contactId={contactId}
          items={relationships}
          onAdd={addKeyPerson}
          onEdit={editKeyPerson}
          onDelete={removeKeyPerson}
          onRestore={restoreKeyPerson}
        />
      </View>
      {groupedMemories.map((group, index) => {
        const shown = expanded[group.key]
          ? group.items
          : group.items.slice(0, GROUP_PREVIEW_LIMIT);
        return (
          <View
            key={group.key}
            testID={`knowledge-group-${MEMORIES_GROUP_KEY}-${group.key}`}
            style={[styles.group, { borderColor: colors.border }]}
          >
            <AppText role="heading">{group.label}</AppText>
            <MemoryEditor
              items={shown}
              showAdd={index === groupedMemories.length - 1}
              onAdd={add}
              onEdit={edit}
              onDelete={remove}
              onRestore={restore}
            />
            {shown
              .filter(
                (memory) =>
                  resolveVisibility(memory.type, memory.hidden) === "hide",
              )
              .map((memory) => (
                <Pressable
                  key={`unhide-${memory.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${memoryGroupLabel(memory)} memory on Profile`}
                  onPress={() => unhideMemory(memory)}
                  style={[styles.action, { borderColor: colors.border }]}
                >
                  <AppText role="caption" style={{ color: colors.accent }}>
                    Show on Profile
                  </AppText>
                </Pressable>
              ))}
            {group.items.length > GROUP_PREVIEW_LIMIT &&
            !expanded[group.key] ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View all ${group.label} memories`}
                onPress={() =>
                  setExpanded((current) => ({ ...current, [group.key]: true }))
                }
                style={styles.tertiary}
              >
                <AppText role="body" style={{ color: colors.accent }}>
                  View all
                </AppText>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {groupedMemories.length === 0 ? (
        <MemoryEditor
          items={[]}
          onAdd={add}
          onEdit={edit}
          onDelete={remove}
          onRestore={restore}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    borderRadius: SPACING.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  back: {
    alignSelf: "flex-start",
    borderRadius: SPACING.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: SPACING.md,
  },
  content: { gap: SPACING.lg, padding: SPACING.base },
  currentStateRow: { gap: SPACING.xs },
  empty: { gap: SPACING.sm },
  group: {
    borderRadius: SPACING.md,
    borderWidth: 1,
    gap: SPACING.md,
    padding: SPACING.base,
  },
  header: { gap: SPACING.base },
  inlineDraft: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  input: {
    borderRadius: SPACING.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    minWidth: 180,
    paddingHorizontal: SPACING.sm,
  },
  readOnlyRow: { gap: SPACING.xs },
  relationship: {
    borderRadius: SPACING.sm,
    borderWidth: 1,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
    minHeight: 44,
  },
  tertiary: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  visibilityCopy: { flex: 1, gap: SPACING.xs },
});
