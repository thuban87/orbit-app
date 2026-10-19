// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit Button's visual-role domain prop, not ARIA.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui";
import { RegisteredModal } from "@/components/ui/RegisteredModal";
import { getExecutor } from "@/db/database";
import { listPickerContacts, type PickerContactRow } from "@/db/picker-read";
import { filterPicker, pickerRowMarkers } from "@/logic/contact-picker-order";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import {
  contactPickerKeyboardFrame,
  contactPickerTitle,
  growRestingFrame,
  type RestingFrame,
  rebaseRestingFrame,
} from "./contact-picker-chrome";
import {
  applyPickerExclusions,
  clearSelection,
  confirmMultiSelection,
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
  /**
   * The heading, naming the action that opened the picker (38.13 D-70), e.g.
   * "Quick Log: choose contact". Absent → "Choose contact(s)".
   */
  title?: string;
}

type SingleSelectContactPickerProps = ContactPickerBaseProps & {
  mode?: "single";
  onSelect: (contactId: number) => void;
  onConfirm?: never;
  initialSelected?: never;
};

type MultiSelectContactPickerProps = ContactPickerBaseProps & {
  mode: "multi";
  onConfirm: (contactIds: number[]) => void | Promise<void>;
  initialSelected?: number[];
  onSelect?: never;
};

/** A type-safe single- or multi-select contract over the one canonical picker. */
export type ContactPickerProps =
  | SingleSelectContactPickerProps
  | MultiSelectContactPickerProps;

/** The "New contact" row the share screen puts first (38.10 D-82, I-07). */
export interface ContactPickerLeadingAction {
  label: string;
  testID?: string;
  /** Receives the current search text, so the create form starts with it. */
  onPress: (searchText: string) => void;
}

/**
 * The picker's list body: always-visible search, the rows, and the
 * multi-select bar. The modal `ContactPicker` wraps it; the share screen
 * embeds it (38.10 D-80). Every prop beyond the modal's is optional and
 * additive, so the existing consumers are unchanged.
 *
 * It never closes anything it does not own: picks and confirmations are
 * reported through callbacks, and only the modal wrapper dismisses itself or
 * touches the shell transient registry (convergence c11).
 */
export interface ContactPickerListProps {
  /** Fixed mode (the modal). Absent = single taps, plus multi-select when offered. */
  mode?: "single" | "multi";
  /** A single pick (single mode, or a tap while not multi-selecting). */
  onPick?: (row: PickerContactRow) => void;
  /** Multi-select Done; a throw keeps the selection for a retry. */
  onConfirm?: (contactIds: number[]) => void | Promise<void>;
  /** Called after a successful multi-select confirm (the modal dismisses). */
  onConfirmed?: () => void;
  /** Inline error under the multi-select bar after a failed confirm. */
  confirmErrorLabel?: string;
  /** Load and reset only while visible (the modal). Defaults to true. */
  visible?: boolean;
  initialSelected?: readonly number[];
  excludeContactId?: number;
  excludeContactIds?: number[];
  allowArchivedSearch?: boolean;
  /** Host-supplied rows; when given, the list skips its own load. */
  rows?: readonly PickerContactRow[];
  /** Whether host-supplied rows are still loading (no empty-state flash). */
  loading?: boolean;
  /** Keep `rows` in the order given instead of the picker ordering. */
  keepSourceOrder?: boolean;
  /** A first row that receives the search text; hides the zero-contact hint. */
  leadingAction?: ContactPickerLeadingAction;
  /** A single tap fires `onPick` at once (embedded use). */
  tapToSelect?: boolean;
  /** Offer a visible way into and out of multi-select (38.10 I-09). */
  multiSelectEntry?: boolean;
  /** Clears an uncontrolled search when it changes (38.10 I-14). */
  searchResetKey?: unknown;
  /** Controlled search (the share screen owns it for Back, 38.9 D-33). */
  searchText?: string;
  onSearchTextChange?: (text: string) => void;
  /** Controlled multi-select flag; turning it off clears the selection. */
  multiSelect?: boolean;
  onMultiSelectChange?: (on: boolean) => void;
  /** Every row, the leading action and the multi-select entry are inert. */
  disabled?: boolean;
  /** Outer style; the embedded host passes `{ flex: 1 }`. */
  style?: StyleProp<ViewStyle>;
}

export function ContactPickerList({
  mode,
  onPick,
  onConfirm,
  onConfirmed,
  confirmErrorLabel = "Couldn't add those contacts. Please try again.",
  visible = true,
  initialSelected,
  excludeContactId,
  excludeContactIds,
  allowArchivedSearch = true,
  rows: hostRows,
  loading: hostLoading = false,
  keepSourceOrder = false,
  leadingAction,
  tapToSelect = false,
  multiSelectEntry = false,
  searchResetKey,
  searchText,
  onSearchTextChange,
  multiSelect,
  onMultiSelectChange,
  disabled = false,
  style,
}: ContactPickerListProps) {
  const { colors } = useTheme();
  const [ownTerm, setOwnTerm] = useState("");
  const term = searchText ?? ownTerm;
  const setTerm = useCallback(
    (text: string) => {
      if (onSearchTextChange) onSearchTextChange(text);
      if (searchText === undefined) setOwnTerm(text);
    },
    [onSearchTextChange, searchText],
  );
  const [ownMultiSelect, setOwnMultiSelect] = useState(false);
  const multiSelectOn = multiSelect ?? ownMultiSelect;
  const setMultiSelectOn = useCallback(
    (on: boolean) => {
      if (onMultiSelectChange) onMultiSelectChange(on);
      if (multiSelect === undefined) setOwnMultiSelect(on);
    },
    [multiSelect, onMultiSelectChange],
  );
  const [loadedRows, setLoadedRows] = useState<PickerContactRow[]>([]);
  const [ownLoading, setOwnLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(
    () => new Set(),
  );
  const requestId = useRef(0);
  const wasVisible = useRef(false);
  const hasSearch = term.trim().length > 0;
  const hostOwnsRows = hostRows !== undefined;
  const isMultiSelect = mode === "multi" || (multiSelectEntry && multiSelectOn);
  const rows = hostRows ?? loadedRows;
  const loading = hostOwnsRows ? hostLoading : ownLoading;

  // A new share (or any key change) starts with an empty search (I-14).
  const lastResetKey = useRef(searchResetKey);
  useEffect(() => {
    if (lastResetKey.current === searchResetKey) return;
    lastResetKey.current = searchResetKey;
    setOwnTerm("");
  }, [searchResetKey]);

  // Leaving multi-select drops the selection.
  useEffect(() => {
    if (!isMultiSelect) {
      setSelectedContactIds(clearSelection());
      setConfirmError(false);
    }
  }, [isMultiSelect]);

  useEffect(() => {
    if (!visible || hostOwnsRows) return;
    const currentRequest = ++requestId.current;
    setOwnLoading(true);
    setFailed(false);

    void listPickerContacts(getExecutor(), {
      includeArchived: allowArchivedSearch && hasSearch,
    })
      .then((nextRows) => {
        if (requestId.current === currentRequest) setLoadedRows(nextRows);
      })
      .catch(() => {
        if (requestId.current === currentRequest) {
          setLoadedRows([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (requestId.current === currentRequest) setOwnLoading(false);
      });
  }, [allowArchivedSearch, hasSearch, hostOwnsRows, visible]);

  useEffect(() => {
    if (visible && !wasVisible.current && mode === "multi") {
      setSelectedContactIds(new Set(initialSelected));
    }
    wasVisible.current = visible;
  }, [initialSelected, mode, visible]);

  const filteredRows = useMemo(
    () =>
      filterPicker(
        applyPickerExclusions([...rows], {
          excludeContactId,
          excludeContactIds,
        }),
        term,
        { keepOrder: keepSourceOrder, allowArchived: allowArchivedSearch },
      ),
    [
      allowArchivedSearch,
      excludeContactId,
      excludeContactIds,
      keepSourceOrder,
      rows,
      term,
    ],
  );
  const isZeroContacts = !loading && !failed && rows.length === 0;

  const confirmSelection = useCallback(async () => {
    if (!isMultiSelect || !onConfirm) return;
    if (confirming || disabled) return;
    setConfirming(true);
    setConfirmError(false);
    const outcome = await confirmMultiSelection(selectedContactIds, onConfirm);
    setConfirming(false);
    if (!outcome.ok) {
      setConfirmError(true);
      return;
    }
    setSelectedContactIds(clearSelection());
    onConfirmed?.();
  }, [
    confirming,
    disabled,
    isMultiSelect,
    onConfirm,
    onConfirmed,
    selectedContactIds,
  ]);

  const onRowPress = (item: PickerContactRow) => {
    if (disabled) return;
    if (isMultiSelect) {
      setSelectedContactIds((current) => toggleSelection(current, item.id));
    } else if (mode === "single" || mode === undefined || tapToSelect) {
      onPick?.(item);
    }
  };

  const onRowLongPress = (item: PickerContactRow) => {
    if (disabled || !multiSelectEntry || isMultiSelect) return;
    setMultiSelectOn(true);
    setSelectedContactIds(new Set([item.id]));
  };

  return (
    <View style={[styles.listRoot, style]}>
      <TextInput
        accessibilityLabel="Search contacts"
        autoCapitalize="none"
        onChangeText={setTerm}
        placeholder="Search contacts"
        placeholderTextColor={colors.textPlaceholder}
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
      {multiSelectEntry && !isMultiSelect ? (
        <View style={styles.entryRow}>
          <Button
            testID="contact-picker-select-several"
            role="tertiary"
            label="Select several"
            disabled={disabled}
            onPress={() => setMultiSelectOn(true)}
          />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.message}>
          <ActivityIndicator color={colors.accentText} />
          <Text style={{ color: colors.textSecondary }}>Loading contacts…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            filteredRows.length === 0 ? styles.emptyList : undefined
          }
          ListHeaderComponent={
            leadingAction ? (
              <Pressable
                testID={leadingAction.testID}
                accessibilityRole="button"
                accessibilityLabel={leadingAction.label}
                accessibilityState={{ disabled: disabled || isMultiSelect }}
                disabled={disabled || isMultiSelect}
                onPress={() => leadingAction.onPress(term)}
                style={[
                  styles.row,
                  {
                    borderColor: colors.border,
                    opacity: disabled || isMultiSelect ? 0.5 : 1,
                  },
                ]}
              >
                <Icon name="add" tone="textPrimary" />
                <Text style={[styles.rowName, { color: colors.textPrimary }]}>
                  {leadingAction.label}
                </Text>
              </Pressable>
            ) : null
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
              markers.archived ? "In Bin" : null,
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
                testID={`contact-picker-row-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                accessibilityState={
                  isMultiSelect
                    ? { selected: isSelected, disabled }
                    : disabled
                      ? { disabled }
                      : undefined
                }
                disabled={disabled}
                onPress={() => onRowPress(item)}
                onLongPress={
                  multiSelectEntry ? () => onRowLongPress(item) : undefined
                }
                style={[styles.row, { borderColor: colors.border }]}
              >
                <Avatar
                  photo={item.photo}
                  name={item.name}
                  size={40}
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
                      style={[styles.marker, { color: colors.textSecondary }]}
                    >
                      {markerLabels.join(" · ")}
                    </Text>
                  ) : null}
                </View>
                {isMultiSelect && isSelected ? (
                  <Icon name="select" state="active" tone="accentText" />
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
      {isZeroContacts && !leadingAction ? (
        <Text style={[styles.addContactHint, { color: colors.textSecondary }]}>
          Use Add Contact to start logging.
        </Text>
      ) : null}
      {isMultiSelect ? (
        <View
          style={[styles.multiSelectActions, { borderColor: colors.border }]}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.selectionCount, { color: colors.accentText }]}
          >
            {selectionCount(selectedContactIds)} selected
          </Text>
          <View style={styles.multiSelectButtons}>
            {multiSelectEntry ? (
              <Button
                testID="contact-picker-exit-multi-select"
                role="tertiary"
                label="Cancel"
                accessibilityLabel="Cancel selecting several"
                onPress={() => setMultiSelectOn(false)}
              />
            ) : (
              <Button
                role="tertiary"
                label="Clear"
                disabled={selectionCount(selectedContactIds) === 0}
                onPress={() => setSelectedContactIds(clearSelection())}
              />
            )}
            <Button
              testID="contact-picker-done"
              role="primary"
              label="Done"
              disabled={
                confirming ||
                disabled ||
                (multiSelectEntry && selectionCount(selectedContactIds) === 0)
              }
              onPress={() => void confirmSelection()}
            />
          </View>
          {confirmError ? (
            <Text style={[styles.confirmError, { color: colors.danger }]}>
              {confirmErrorLabel}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

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
  const insets = useSafeAreaInsets();
  const isMultiSelect = props.mode === "multi";

  // 38.13 D-43: the 38.9 sheet keyboard layout (CaptureScreen's pattern). The
  // modal window is edge-to-edge, so the sheet is lifted above the keyboard
  // and capped to the room left; the search field stays first and the list
  // shrinks, so both stay visible.
  const [keyboardHeight, setKeyboardHeight] = useState(() =>
    Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0,
  );
  const [frameHeight, setFrameHeight] = useState(0);
  // The keyboard-down frame height, tracked per window height so a shrunken
  // window (cover display, split screen) is measured again instead of keeping
  // the tallest height ever seen (38.13 review B-IN-05).
  const windowHeight = useWindowDimensions().height;
  const restingFrame = useRef<RestingFrame>({ height: 0, windowHeight });
  restingFrame.current = rebaseRestingFrame(restingFrame.current, windowHeight);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) =>
      setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const onRootLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    restingFrame.current = growRestingFrame(restingFrame.current, height);
    setFrameHeight(height);
  }, []);
  const keyboardFrame = contactPickerKeyboardFrame({
    frameHeight,
    restingFrameHeight: restingFrame.current.height,
    keyboardHeight,
    topClearance: insets.top + SPACING.lg,
  });

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

  const select = useCallback(
    (row: PickerContactRow) => {
      dismiss();
      if (props.mode === "single" || props.mode === undefined) {
        props.onSelect(row.id);
      }
    },
    [dismiss, props],
  );

  return (
    <RegisteredModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={dismiss}
    >
      <View
        accessibilityViewIsModal
        onLayout={onRootLayout}
        style={[styles.modalRoot, { paddingBottom: keyboardFrame.lift }]}
      >
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
              maxHeight: keyboardFrame.maxHeight,
              minHeight: keyboardFrame.minHeight,
            },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.textPrimary }]}
          >
            {contactPickerTitle(props.title, isMultiSelect)}
          </Text>
          <ContactPickerList
            mode={isMultiSelect ? "multi" : "single"}
            visible={visible}
            onPick={select}
            onConfirm={props.mode === "multi" ? props.onConfirm : undefined}
            onConfirmed={dismiss}
            initialSelected={
              props.mode === "multi" ? props.initialSelected : undefined
            }
            excludeContactId={excludeContactId}
            excludeContactIds={excludeContactIds}
            allowArchivedSearch={allowArchivedSearch}
          />
        </View>
      </View>
    </RegisteredModal>
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
  // Content-sized and shrinkable, as the modal sheet's direct children were;
  // the embedded host stretches it with `style={{ flex: 1 }}`.
  listRoot: {
    flexShrink: 1,
  },
  entryRow: {
    alignItems: "flex-start",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    opacity: 0.85,
  },
  // maxHeight / minHeight come from contactPickerKeyboardFrame (82% / 260
  // at rest, D-43).
  sheet: {
    elevation: 1,
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
  confirmError: { marginTop: 8 },
  selectionCount: {
    fontSize: 14,
    fontWeight: "600",
  },
});
