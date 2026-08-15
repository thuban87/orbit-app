/**
 * Photo value widget (FLD-04 / PHOTO-01 custom-field reuse) — EDIT-ONLY.
 *
 * The goal's third reuse: a custom `photo`-type field drives the EXACT same
 * pipeline as the main avatar. When enabled (an edit form supplies a numeric
 * `contactId` + the field's `colName`) it renders the shared, already
 * target-kind-aware `<PhotoSourcePicker>` with a `{kind:'customField'}` target —
 * the SAME Add / Change (library + URL) / Remove affordance and Skia crop the
 * contact photo uses. It only USES the picker; it never edits it and never
 * touches SQL.
 *
 * CROP-SUCCESS + VALUE (no callback nav params): the picker navigates to
 * `CropPhoto` threading `requestId = customFieldPhotoRelPath(contactId, colName)`;
 * `CropPhotoScreen` persists the master at that derivable path and publishes the
 * success to `photo-result-store`. On focus/return this widget re-derives the
 * SAME key, `consumeCropResult`s it once, records the just-written-but-not-yet-
 * committed file in the staged ledger (`markPhotoStaged` — the orphan-cleanup
 * hook `EditContactScreen` drains on cancel/unmount), and sets the field value to
 * that derivable relPath via `onChange`. The edit form persists that value on
 * Save through its existing guarded upsert — this is NOT a new write path.
 *
 * Remove is wired straight through: the picker's customField Remove deletes the
 * `cv-` file inline and calls `onValueChange(null)` → the widget's `onChange(null)`
 * clears the field value on Save. The widget NEVER interpolates `colName` into SQL
 * (the path builders enforce safety by construction). Colours via `useTheme()`.
 *
 * On the create form / def preview (no contactId) it stays a minimal DISABLED
 * placeholder — a photo needs a persisted contact to derive its stable filename.
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PhotoSourcePicker } from "@/components/PhotoSourcePicker";
import { customFieldPhotoRelPath } from "@/services/photos/photo-storage";
import {
  consumeCropResult,
  markPhotoStaged,
} from "@/stores/photo-result-store";
import { useTheme } from "@/theme";
import {
  customFieldValueForTarget,
  isPhotoWidgetEnabled,
} from "./photo-field-logic";
import type { FieldWidgetProps } from "./types";

export function PhotoFieldWidget({
  value,
  onChange,
  label,
  contactId,
  colName,
  testID,
}: FieldWidgetProps) {
  const { colors } = useTheme();

  const enabled =
    isPhotoWidgetEnabled(contactId) &&
    typeof colName === "string" &&
    colName.length > 0;

  // On focus/return from CropPhotoScreen: consume this field's crop-success ONCE
  // (keyed on the re-derived cv- relPath), stage the file for orphan cleanup, and
  // set the field value to the derivable relPath. Hooks run unconditionally; the
  // guard keeps the disabled/create case inert.
  useFocusEffect(
    useCallback(() => {
      if (!isPhotoWidgetEnabled(contactId) || !colName) {
        return;
      }
      const relPath = customFieldPhotoRelPath(contactId, colName);
      const result = consumeCropResult(relPath);
      if (result?.success) {
        // Record the persisted-but-not-yet-committed file so EditContactScreen
        // can delete it if the edit is cancelled without Save.
        markPhotoStaged(relPath);
        onChange(customFieldValueForTarget(contactId, colName));
      }
    }, [contactId, colName, onChange]),
  );

  if (enabled) {
    return (
      <View testID={testID}>
        <PhotoSourcePicker
          target={{ kind: "customField", contactId, colName }}
          photo={value}
          name={label}
          onValueChange={onChange}
        />
      </View>
    );
  }

  // Create form / def preview (no contactId): photo is edit-only.
  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      style={[
        styles.placeholder,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        Save this contact first to add a photo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: "dashed",
    paddingHorizontal: 12,
    paddingVertical: 20,
    alignItems: "center",
  },
  text: {
    fontSize: 13,
    textAlign: "center",
  },
});
