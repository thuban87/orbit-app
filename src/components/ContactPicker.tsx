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
import { getExecutor } from "@/db/database";
import { listPickerContacts, type PickerContactRow } from "@/db/picker-read";
import {
  filterPicker,
  pickerRowMarkers,
} from "@/logic/contact-picker-order";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { useTheme } from "@/theme";

export interface ContactPickerProps {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (contactId: number) => void;
  /** Optional owner exclusion for relationship links; existing callers see all rows. */
  excludeContactId?: number;
  /** Profile template assignment must never surface archived contacts, even while searching. */
  allowArchivedSearch?: boolean;
}

/** A shell-owned, local-first picker shared by all contact-targeting actions. */
export function ContactPicker({
  visible,
  onDismiss,
  onSelect,
  excludeContactId,
  allowArchivedSearch = true,
}: ContactPickerProps) {
  const { colors } = useTheme();
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<PickerContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);
  const hasSearch = term.trim().length > 0;

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
    return () => shellTransientStore.getState().closeTransient("contact-picker");
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

  const filteredRows = useMemo(
    () =>
      filterPicker(
        excludeContactId === undefined
          ? rows
          : rows.filter((row) => row.id !== excludeContactId),
        term,
      ),
    [excludeContactId, rows, term],
  );
  const isZeroContacts = !loading && !failed && rows.length === 0;

  const select = useCallback(
    (contactId: number) => {
      dismiss();
      onSelect(contactId);
    },
    [dismiss, onSelect],
  );

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
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
            Choose contact
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
              <Text style={{ color: colors.textSecondary }}>Loading contacts…</Text>
            </View>
          ) : (
            <FlatList
              data={filteredRows}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={filteredRows.length === 0 ? styles.emptyList : undefined}
              ListEmptyComponent={
                <PickerMessage colors={colors}>
                  {isZeroContacts ? "No contacts yet" : "No matching contacts"}
                </PickerMessage>
              }
              renderItem={({ item }) => {
                const markers = pickerRowMarkers(item);
                const markerLabels = [
                  markers.snoozed ? "Snoozed" : null,
                  markers.archived ? "Archived" : null,
                ].filter((label): label is string => label !== null);
                const accessibilityLabel = [item.name, ...markerLabels].join(", ");

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={accessibilityLabel}
                    onPress={() => select(item.id)}
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
                        <Text style={[styles.marker, { color: colors.textSecondary }]}>
                          {markerLabels.join(" · ")}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
          {isZeroContacts ? (
            <Text style={[styles.addContactHint, { color: colors.textSecondary }]}> 
              Use Add Contact to start logging.
            </Text>
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
  return <Text style={[styles.messageText, { color: colors.textSecondary }]}>{children}</Text>;
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
});
