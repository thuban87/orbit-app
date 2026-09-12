// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit Button's visual-role domain prop, not ARIA.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui";
import { getExecutor } from "@/db/database";
import { listPickerContacts, type PickerContactRow } from "@/db/picker-read";
import { filterPicker, pickerRowMarkers } from "@/logic/contact-picker-order";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { useTheme } from "@/theme";
import {
  applyPickerExclusions,
  clearSelection,
  orderedSelection,
  selectionCount,
  toggleSelection,
} from "./contact-picker-multiselect";

interface ContactPickerBaseProps {
  visible: boolean;
  onDismiss: () => void;
  /** Optional owner exclusion for relationship links; existing callers see all rows. */
  excludeContactId?: number;
  /** Existing group members are excluded before filtering so they cannot be re-added. */
  excludeContactIds?: number[];
  /** Profile template assignment must never surface archived contacts, even while searching. */
  allowArchivedSearch?: boolean;
}

type SingleSelectContactPickerProps = ContactPickerBaseProps & {
  mode?: "single";
  onSelect: (contactId: number) => void;
  onConfirm?: never;
  initialSelected?: never;
};

type MultiSelectContactPickerProps = ContactPickerBaseProps & {
  mode: "multi";
  onConfirm: (contactIds: number[]) => void;
  initialSelected?: number[];
  onSelect?: never;
};

/** A type-safe single- or multi-select contract over the one canonical picker. */
export type ContactPickerProps =
  | SingleSelectContactPickerProps
  | MultiSelectContactPickerProps;

/** A shell-owned, local-first picker shared by all contact-targeting actions. */
export function ContactPicker(props: ContactPickerProps) {
  const {
    visible,
    onDismiss,
    excludeContactId,
    excludeContactIds,
    allowArchivedSearch = true,
  } = props;
  const { colors } = useTheme();
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<PickerContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(
    () => new Set(),
  );
  const requestId = useRef(0);
  const wasVisible = useRef(false);
  const hasSearch = term.trim().length > 0;
  const isMultiSelect = props.mode === "multi";

  const dismiss = useCallback(() => {
    shellTransientStore.getState().closeTransient("contact-picker");
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!visible) {
      shellTransientStore.getState().closeTransient("contact-picker");
      return;
    }

    // The registry owns the layer order, while this real callback owns the
    // Modal's local visibility through the parent prop.
    shellTransientStore.getState().openTransient("contact-picker", dismiss);
    return () =>
      shellTransientStore.getState().closeTransient("contact-picker");
  }, [dismiss, visible]);

  useEffect(() => {
    if (!visible) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setFailed(false);

    void listPickerContacts(getExecutor(), {
      includeArchived: allowArchivedSearch && hasSearch,
    })
      .then((nextRows) => {
        if (requestId.current === currentRequest) setRows(nextRows);
      })
      .catch(() => {
        if (requestId.current === currentRequest) {
          setRows([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (requestId.current === currentRequest) setLoading(false);
      });
  }, [allowArchivedSearch, hasSearch, visible]);

  useEffect(() => {
    if (visible && !wasVisible.current && props.mode === "multi") {
      setSelectedContactIds(new Set(props.initialSelected));
    }
    wasVisible.current = visible;
  }, [props, visible]);

  const filteredRows = useMemo(
    () =>
      filterPicker(
        applyPickerExclusions(rows, { excludeContactId, excludeContactIds }),
        term,
      ),
    [excludeContactId, excludeContactIds, rows, term],
  );
  const isZeroContacts = !loading && !failed && rows.length === 0;

  const select = useCallback(
    (contactId: number) => {
      dismiss();
      if (props.mode === "single" || props.mode === undefined) {
        props.onSelect(contactId);
      }
    },
    [dismiss, props],
  );

  const confirmSelection = useCallback(() => {
    if (props.mode !== "multi") return;
    props.onConfirm(orderedSelection(selectedContactIds));
    dismiss();
  }, [dismiss, props, selectedContactIds]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={dismiss}
    >
      <View accessibilityViewIsModal style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Dismiss picker"
          onPress={dismiss}
          style={StyleSheet.absoluteFill}
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.scrim,
              { backgroundColor: colors.background },
            ]}
          />
        </Pressable>

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.textPrimary }]}
          >
            {isMultiSelect ? "Choose contacts" : "Choose contact"}
          </Text>
          <TextInput
            accessibilityLabel="Search contacts"
            autoCapitalize="none"
            onChangeText={setTerm}
            placeholder="Search contacts"
            placeholderTextColor={colors.textSecondary}
            value={term}
            style={[
              styles.search,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />

          {loading ? (
            <View style={styles.message}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ color: colors.textSecondary }}>
                Loading contacts…
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredRows}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                filteredRows.length === 0 ? styles.emptyList : undefined
              }
              ListEmptyComponent={
                <PickerMessage colors={colors}>
                  {isZeroContacts ? "No contacts yet" : "No matching contacts"}
                </PickerMessage>
              }
              renderItem={({ item }) => {
                const isSelected = selectedContactIds.has(item.id);
                const markers = pickerRowMarkers(item);
                const markerLabels = [
                  markers.snoozed ? "Snoozed" : null,
                  markers.archived ? "Archived" : null,
                ].filter((label): label is string => label !== null);
                const accessibilityLabel = [
                  item.name,
                  isMultiSelect && isSelected ? "Selected" : null,
                  ...markerLabels,
                ]
                  .filter((label): label is string => label !== null)
                  .join(", ");

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={accessibilityLabel}
                    accessibilityState={
                      isMultiSelect ? { selected: isSelected } : undefined
                    }
                    onPress={() => {
                      if (props.mode === "multi") {
                        setSelectedContactIds((current) =>
                          toggleSelection(current, item.id),
                        );
                      } else {
                        select(item.id);
                      }
                    }}
                    style={[styles.row, { borderColor: colors.border }]}
                  >
                    <Avatar
                      photo={item.photo}
                      name={item.name}
                      size={40}
                      cacheBust={item.modified_at}
                      contactId={`picker-${item.id}`}
                    />
                    <View style={styles.rowCopy}>
                      <Text
                        numberOfLines={2}
                        style={[styles.rowName, { color: colors.textPrimary }]}
                      >
                        {item.name}
                      </Text>
                      {markerLabels.length > 0 ? (
                        <Text
                          style={[
                            styles.marker,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {markerLabels.join(" · ")}
                        </Text>
                      ) : null}
                    </View>
                    {isMultiSelect && isSelected ? (
                      <Icon name="select" state="active" tone="accent" />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          )}
          {isZeroContacts ? (
            <Text
              style={[styles.addContactHint, { color: colors.textSecondary }]}
            >
              Use Add Contact to start logging.
            </Text>
          ) : null}
          {isMultiSelect ? (
            <View
              style={[
                styles.multiSelectActions,
                { borderColor: colors.border },
              ]}
            >
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.selectionCount, { color: colors.accent }]}
              >
                {selectionCount(selectedContactIds)} selected
              </Text>
              <View style={styles.multiSelectButtons}>
                <Button
                  role="tertiary"
                  label="Clear"
                  disabled={selectionCount(selectedContactIds) === 0}
                  onPress={() => setSelectedContactIds(clearSelection())}
                />
                <Button
                  role="primary"
                  label="Done"
                  onPress={confirmSelection}
                />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function PickerMessage({
  children,
  colors,
}: {
  children: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Text style={[styles.messageText, { color: colors.textSecondary }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    opacity: 0.85,
  },
  sheet: {
    elevation: 1,
    maxHeight: "82%",
    minHeight: 260,
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    zIndex: 1,
    paddingBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  row: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  rowCopy: {
    flex: 1,
  },
  rowName: {
    fontSize: 16,
    fontWeight: "600",
  },
  marker: {
    fontSize: 13,
    marginTop: 2,
  },
  message: {
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    minHeight: 128,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  messageText: {
    fontSize: 15,
    paddingHorizontal: 16,
    textAlign: "center",
  },
  addContactHint: {
    fontSize: 13,
    paddingTop: 8,
    textAlign: "center",
  },
  multiSelectActions: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingTop: 8,
  },
  multiSelectButtons: {
    flexDirection: "row",
    gap: 8,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: "600",
  },
});
