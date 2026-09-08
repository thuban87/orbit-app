// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button semantic roles are domain props.
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import ReorderableList, {
  type ReorderableListRenderItemInfo,
  type ReorderableListReorderEvent,
  reorderItems,
  useReorderableDrag,
} from "react-native-reorderable-list";
import { Icon } from "@/components/icons/Icon";
import { buildSystemChoices } from "@/components/orrery/orrery-controls-logic";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import type { OrrerySystemId } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  readOrrerySystemMembersCore,
  readOrrerySystemSnapshot,
} from "@/db/orrery-system-read";
import {
  deleteSystemWithActiveFallback,
  duplicateSystem,
  listCustomSystems,
  listSystemOverrides,
  listSystemPrefs,
  renameSystem,
  reorderSystems,
  resetSystemOverrides,
  restoreDeletedSystemAndActiveSelection,
  setSystemHidden,
} from "@/db/systems-dao";
import type { SystemDescriptor } from "@/logic/orrery-system-logic";
import type { RootStackParamList } from "@/navigation/types";
import { useOrreryPreferencesStore } from "@/stores/orrery-preferences-store";
import { showSnackbar, snackbarStore } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

const ALL_CONTACTS_REF = "builtin:all-contacts" as OrrerySystemId;

export type SystemManagementRow = SystemDescriptor & {
  memberCount: number;
  hidden: boolean;
  hasOverrides: boolean;
  broken: boolean;
};

function isAllContacts(row: SystemManagementRow): boolean {
  return row.id === ALL_CONTACTS_REF;
}

function isCustom(row: SystemManagementRow): boolean {
  return row.ref.kind === "custom";
}

/** Keep the protected System visibly and durably first, even after a drag. */
export function pinAllContacts<T extends { id: string }>(
  rows: readonly T[],
): T[] {
  const allContacts = rows.find((row) => row.id === ALL_CONTACTS_REF);
  return allContacts
    ? [allContacts, ...rows.filter((row) => row.id !== ALL_CONTACTS_REF)]
    : [...rows];
}

/** Management has a readable, deterministic action contract per System kind. */
export function managementActions(row: SystemManagementRow): string[] {
  if (isCustom(row)) return ["Edit", "Rename", "Duplicate", "Delete"];
  const actions = ["Duplicate", "Manage Members"];
  if (!isAllContacts(row)) actions.push(row.hidden ? "Show" : "Hide");
  if (row.hasOverrides) actions.push("Reset Overrides");
  return actions;
}

function errorSnackbar(label: string): void {
  showSnackbar({
    kind: "error",
    label,
    action: {
      label: "Dismiss",
      accessibilityLabel: "Dismiss message",
      onPress: () => snackbarStore.getState().dismiss(),
    },
  });
}

/** Refresh the in-memory selection after a DAO composite commits its settings write. */
async function refreshOrreryPreferences(): Promise<void> {
  const exec = getExecutor();
  const prefs = useOrreryPreferencesStore.getState();
  await prefs.hydrate(exec);
}

/** Delete never touches contacts; its snapshot powers the short-lived Undo action. */
export async function deleteManagedSystem(input: {
  systemRef: OrrerySystemId;
  onChanged: () => Promise<void>;
}): Promise<void> {
  const deletion = await deleteSystemWithActiveFallback(getExecutor(), {
    systemRef: input.systemRef,
    now: localDateTime(),
  });
  await refreshOrreryPreferences();
  await input.onChanged();
  showSnackbar({
    kind: "success",
    label: "System deleted",
    action: {
      label: "Undo",
      accessibilityLabel: "Undo System deletion",
      onPress: () => {
        void (async () => {
          try {
            await restoreDeletedSystemAndActiveSelection(getExecutor(), {
              snapshot: deletion.snapshot,
              restoreActiveSelection: deletion.wasActive,
              now: localDateTime(),
            });
          } catch {
            errorSnackbar("Couldn't undo — that name is in use again");
            return;
          }
          try {
            await refreshOrreryPreferences();
            await input.onChanged();
          } catch {
            errorSnackbar("System restored, but the list couldn't refresh.");
          }
        })();
      },
    },
  });
}

function SystemRow({
  row,
  renaming,
  renameValue,
  onRenameValueChange,
  onSubmitRename,
  onCancelRename,
  onAction,
}: {
  row: SystemManagementRow;
  renaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onAction: (action: string) => void;
}) {
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  const actions = managementActions(row);
  const indicator = row.broken
    ? {
        icon: "status-decay" as const,
        tone: "danger" as const,
        label: "Needs attention",
      }
    : row.memberCount === 0
      ? {
          icon: "status-wobble" as const,
          tone: "statusWobble" as const,
          label: "Empty",
        }
      : row.hasOverrides
        ? {
            icon: "status-neutral" as const,
            tone: "textSecondary" as const,
            label: "Overrides",
          }
        : null;

  return (
    <View
      testID={`system-row-${row.id}`}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isAllContacts(row)
            ? "All Contacts is pinned first"
            : `Reorder ${row.name}`
        }
        accessibilityHint="Long press and drag to reorder Systems"
        disabled={isAllContacts(row)}
        onLongPress={isAllContacts(row) ? undefined : drag}
        style={styles.dragHandle}
      >
        <Icon name="sort" size="md" tone="textSecondary" />
      </Pressable>
      <View style={styles.rowBody}>
        {renaming ? (
          <>
            <TextInput
              autoFocus
              accessibilityLabel="System name"
              value={renameValue}
              onChangeText={onRenameValueChange}
              style={[
                styles.renameInput,
                {
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />
            <View style={styles.actionRow}>
              <Button
                role="secondary"
                label="Cancel"
                onPress={onCancelRename}
              />
              <Button
                role="primary"
                label="Save name"
                onPress={onSubmitRename}
              />
            </View>
          </>
        ) : (
          <>
            <AppText role="heading">{row.name}</AppText>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {row.memberCount} {row.memberCount === 1 ? "member" : "members"}
              {row.hidden ? " · Hidden from switcher" : ""}
            </AppText>
            {indicator ? (
              <View style={styles.indicator}>
                <Icon name={indicator.icon} size="sm" tone={indicator.tone} />
                <AppText
                  role="caption"
                  style={{ color: colors[indicator.tone] }}
                >
                  {indicator.label}
                </AppText>
              </View>
            ) : null}
            <View style={styles.actionRow}>
              {actions.map((action) => (
                <Button
                  key={action}
                  role={action === "Delete" ? "destructive" : "secondary"}
                  label={action}
                  onPress={() => onAction(action)}
                  testID={`system-${row.id}-${action.toLowerCase().replaceAll(" ", "-")}`}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export function SystemsManagementScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<SystemManagementRow[]>([]);
  const committedRows = useRef<SystemManagementRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const load = useCallback(async () => {
    const exec = getExecutor();
    const [snapshot, customSystems, prefs] = await Promise.all([
      readOrrerySystemSnapshot(exec),
      listCustomSystems(exec),
      listSystemPrefs(exec),
    ]);
    const prefByRef = new Map(prefs.map((pref) => [pref.systemRef, pref]));
    const choices = buildSystemChoices(snapshot.categories, customSystems);
    const loaded = await Promise.all(
      choices.map(async (choice, sourceIndex) => {
        const [members, overrides] = await Promise.all([
          readOrrerySystemMembersCore(exec, choice.ref),
          listSystemOverrides(exec, choice.id),
        ]);
        const pref = prefByRef.get(choice.id);
        return {
          ...choice,
          memberCount: members.members.length,
          hidden: pref?.hidden === 1,
          hasOverrides: overrides.length > 0,
          broken:
            members.status !== "ready" ||
            (members.brokenRules?.length ?? 0) > 0,
          sourceIndex,
          displayOrder: pref?.displayOrder,
        };
      }),
    );
    const ordered = pinAllContacts(
      [...loaded]
        .sort(
          (a, b) =>
            (a.displayOrder ?? Number.MAX_SAFE_INTEGER) -
              (b.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
            a.sourceIndex - b.sourceIndex,
        )
        .map(
          ({
            sourceIndex: _sourceIndex,
            displayOrder: _displayOrder,
            ...row
          }) => row,
        ),
    );
    committedRows.current = ordered;
    setRows(ordered);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().catch(() =>
        setError("Couldn't load Systems. Please try again."),
      );
    }, [load]),
  );

  const beginRename = (row: SystemManagementRow) => {
    setError(null);
    setRenamingId(row.id);
    setRenameValue(row.name);
  };
  const submitRename = async () => {
    const row = rows.find((candidate) => candidate.id === renamingId);
    if (!row) return;
    if (!renameValue.trim()) {
      setError("Give this System a name.");
      return;
    }
    try {
      await renameSystem(getExecutor(), {
        systemRef: row.id,
        name: renameValue,
        now: localDateTime(),
      });
      setRenamingId(null);
      await load();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Couldn't rename this System.";
      setError(
        message.includes("already exists")
          ? `A System named "${renameValue.trim()}" already exists. Choose a different name.`
          : message,
      );
    }
  };
  const deleteRow = (row: SystemManagementRow) => {
    Alert.alert(
      `Delete ${row.name}?`,
      "This only removes the System. Your contacts are not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteManagedSystem({
                  systemRef: row.id,
                  onChanged: load,
                });
              } catch {
                setError("Couldn't delete this System. Please try again.");
              }
            })();
          },
        },
      ],
    );
  };
  const onAction = (row: SystemManagementRow, action: string) => {
    const systemRef = row.id as OrrerySystemId;
    if (action === "Edit") {
      if (row.ref.kind === "custom")
        navigation.navigate("SystemBuilder", { systemUid: row.ref.uid });
      return;
    }
    if (action === "Rename") return beginRename(row);
    if (action === "Delete") return deleteRow(row);
    if (action === "Manage Members") {
      navigation.navigate("SystemBuilder", { systemRef });
      return;
    }
    if (action === "Duplicate") {
      void (async () => {
        try {
          const duplicate = await duplicateSystem(getExecutor(), {
            systemRef,
            now: localDateTime(),
          });
          navigation.navigate("SystemBuilder", { systemUid: duplicate.uid });
        } catch {
          setError("Couldn't duplicate this System. Please try again.");
        }
      })();
      return;
    }
    if (action === "Hide" || action === "Show") {
      void (async () => {
        try {
          await setSystemHidden(getExecutor(), {
            systemRef,
            hidden: action === "Hide",
            now: localDateTime(),
          });
          await load();
        } catch {
          setError("Couldn't update System visibility. Please try again.");
        }
      })();
      return;
    }
    if (action === "Reset Overrides") {
      Alert.alert(
        "Reset overrides?",
        "Manual includes and excludes will be removed. The System's rules stay.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reset",
            style: "destructive",
            onPress: () => {
              void resetSystemOverrides(getExecutor(), { systemRef })
                .then(load)
                .catch(() => setError("Couldn't reset membership overrides."));
            },
          },
        ],
      );
    }
  };
  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const next = pinAllContacts(reorderItems(rows, from, to));
    setRows(next);
    void reorderSystems(getExecutor(), {
      orderedRefs: next.map((row) => row.id as OrrerySystemId),
      now: localDateTime(),
    })
      .then(() => {
        committedRows.current = next;
      })
      .catch(() => {
        setRows(committedRows.current);
        setError(
          "Couldn't save the new System order. The previous order was restored.",
        );
      });
  };
  const renderItem = ({
    item,
  }: ReorderableListRenderItemInfo<SystemManagementRow>) => (
    <SystemRow
      row={item}
      renaming={renamingId === item.id}
      renameValue={renameValue}
      onRenameValueChange={setRenameValue}
      onSubmitRename={() => void submitRename()}
      onCancelRename={() => {
        setRenamingId(null);
        setError(null);
      }}
      onAction={(action) => onAction(item, action)}
    />
  );
  const empty = rows.length === 0 && !error;

  return (
    <View
      testID="systems-management-screen"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ShellAppBar variant="child" title="Systems" />
      <View style={styles.content}>
        {error ? (
          <AppText
            accessibilityLiveRegion="polite"
            style={{ color: colors.danger }}
          >
            {error}
          </AppText>
        ) : null}
        <Button
          role="primary"
          label="Create New System"
          onPress={() => navigation.navigate("SystemBuilder")}
          testID="create-new-system"
        />
        {empty ? <AppText>Loading Systems…</AppText> : null}
        <ReorderableList
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={renderItem}
          onReorder={onReorder}
          contentContainerStyle={styles.list}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, padding: SPACING.base, gap: SPACING.md },
  list: { gap: SPACING.md, paddingBottom: SPACING.xl },
  row: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: RADII.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  dragHandle: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  rowBody: { flex: 1, gap: SPACING.sm },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  indicator: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  renameInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});
