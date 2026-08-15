/**
 * PhotoSourcePicker (PHOTO-01 + the replace/remove half of PHOTO-05) — the single,
 * genuinely target-kind-aware edit affordance (Add / Change / Remove) for ALL
 * three photo targets: contact, self/profile, and a custom `photo` field. Owned in
 * full here so no later plan re-touches this file in the same wave — Plan 06's URL
 * submit and Plan 08's custom-field widget only USE it.
 *
 * Add/Change launches the Android 13+ system Photo Picker via
 * `launchImageLibraryAsync({ mediaTypes: ['images'] })` — NO camera, NO runtime
 * permission — and on a pick navigates to `CropPhotoScreen`, threading a
 * serializable `requestId` (the derivable cv- relPath) ONLY for a customField
 * target so Plan 08's widget can correlate the crop-success. A canceled pick is
 * silent.
 *
 * Remove switches on `target.kind` and deletes the correct derivable file inline
 * (non-undoable, best-effort/idempotent), never dereferencing a missing contactId:
 *   - contact     → `clearContactPhoto` + `deletePhoto(contactPhotoRelPath(id))`
 *   - profile     → `clearProfilePhoto` + `deletePhoto(profilePhotoRelPath())`
 *   - customField → `deletePhoto(customFieldPhotoRelPath(id, col))` + `onValueChange(null)`
 * The contact/profile branches write the DB here, then call `onChanged()`; the
 * customField branch NEVER touches SQL — the field value is cleared through the
 * edit form's guarded upsert on Save (the widget wires `onValueChange` to its
 * `onChange(null)`).
 *
 * All colours via `useTheme().colors.*` (check:colors); 44px touch targets; copy
 * verbatim from the 05-UI-SPEC Copywriting Contract.
 */
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { useCallback } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { clearContactPhoto } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { clearProfilePhoto } from "@/db/profile-dao";
import type { RootStackParamList } from "@/navigation/types";
import {
  contactPhotoRelPath,
  customFieldPhotoRelPath,
  deletePhoto,
  type PhotoTargetDescriptor,
  profilePhotoRelPath,
} from "@/services/photos/photo-storage";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "photo-source-picker";

/** The preview avatar diameter in the edit surface. */
const PREVIEW_SIZE = 96;

interface PhotoSourcePickerProps {
  /** Which record this affordance edits — drives the derivable paths + Remove. */
  target: PhotoTargetDescriptor;
  /** The current stored RELATIVE photo path, or null for the no-photo state. */
  photo: string | null;
  /** Display name — seeds the preview Avatar's initials/swatch fallback. */
  name: string;
  /** Forwarded to the inner `<Avatar cacheBust>` so a same-path replace refreshes. */
  cacheBust?: string | number;
  /** Refresh callback the contact/profile targets fire after their inline DAO write. */
  onChanged?: () => void;
  /** The customField target clears its form value on Remove via this callback. */
  onValueChange?: (value: string | null) => void;
}

/** Promise wrapper over the SPEC destructive confirm so Remove reads as ONE gate. */
function confirmRemovePhoto(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Remove photo?",
      "This deletes the photo from this device and can't be undone.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function PhotoSourcePicker({
  target,
  photo,
  name,
  cacheBust,
  onChanged,
  onValueChange,
}: PhotoSourcePickerProps) {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Stable recycling identity for the preview Avatar across the three kinds.
  const avatarId =
    target.kind === "contact"
      ? target.contactId
      : target.kind === "profile"
        ? "profile"
        : `${target.contactId}-${target.colName}`;

  // Add/Change: launch the system library (no permission), then crop. A
  // customField pick threads its derivable cv- relPath as the requestId.
  const pickFromLibrary = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) {
        return; // silent — no error, no toast
      }
      const rawUri = result.assets[0]?.uri;
      if (!rawUri) {
        return;
      }
      navigation.navigate("CropPhoto", {
        rawUri,
        target,
        requestId:
          target.kind === "customField"
            ? customFieldPhotoRelPath(target.contactId, target.colName)
            : undefined,
      });
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to launch photo library", err);
      Alert.alert("Couldn't open your photos. Please try again.");
    }
  }, [navigation, target]);

  // Remove: confirm, then switch on kind — clear the right store + delete the
  // correct derivable file inline (best-effort). Never derefs a missing contactId.
  const removePhoto = useCallback(async () => {
    if (!(await confirmRemovePhoto())) {
      return;
    }
    try {
      const exec = getExecutor();
      const now = localDateTime();
      switch (target.kind) {
        case "contact":
          await clearContactPhoto(exec, target.contactId, now);
          deletePhoto(contactPhotoRelPath(target.contactId));
          onChanged?.();
          break;
        case "profile":
          await clearProfilePhoto(exec, now);
          deletePhoto(profilePhotoRelPath());
          onChanged?.();
          break;
        case "customField":
          // No SQL here — the field value clears through the edit form's Save.
          deletePhoto(
            customFieldPhotoRelPath(target.contactId, target.colName),
          );
          onValueChange?.(null);
          break;
      }
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to remove photo", err);
      Alert.alert("Couldn't remove the photo. Please try again.");
    }
  }, [target, onChanged, onValueChange]);

  const hasPhoto = photo != null;

  return (
    <View style={styles.root}>
      <Avatar
        photo={photo}
        name={name}
        contactId={avatarId}
        cacheBust={cacheBust}
        size={PREVIEW_SIZE}
      />

      <View style={styles.actions}>
        <Pressable
          testID="photo-source-add-change"
          accessibilityRole="button"
          accessibilityLabel={hasPhoto ? "Change photo" : "Add photo"}
          onPress={() => void pickFromLibrary()}
          style={styles.actionBtn}
        >
          <Text style={[styles.actionText, { color: colors.accent }]}>
            {hasPhoto ? "Change photo" : "Add photo"}
          </Text>
        </Pressable>

        {hasPhoto ? (
          <Pressable
            testID="photo-source-remove"
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
            onPress={() => void removePhoto()}
            style={styles.actionBtn}
          >
            <Text style={[styles.actionText, { color: colors.danger }]}>
              Remove photo
            </Text>
          </Pressable>
        ) : (
          // The URL entry point (the actual submit is wired in Plan 06 — this
          // renders the affordance only; it stubs no fake save).
          <Pressable
            testID="photo-source-paste-url"
            accessibilityRole="button"
            accessibilityLabel="Paste image URL"
            onPress={() => {
              // Plan 06 wires the URL download/submit; no-op placeholder here.
            }}
            style={styles.actionBtn}
          >
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>
              Paste image URL
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  actions: {
    flex: 1,
    gap: 8,
  },
  actionBtn: {
    minHeight: 44,
    justifyContent: "center",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
