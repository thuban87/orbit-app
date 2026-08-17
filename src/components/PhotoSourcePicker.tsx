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
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
import {
  downloadImageToCache,
  isImageUrl,
  UrlImageError,
} from "@/services/photos/url-image";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
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

  // "Paste image URL" reveal state — a plain toggle + text buffer (not a
  // render-loop concern), gated so a submit-in-flight can't double-fire.
  const [urlEntryOpen, setUrlEntryOpen] = useState(false);
  const [urlText, setUrlText] = useState("");
  const [submittingUrl, setSubmittingUrl] = useState(false);

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
          // A contact photo is widget-visible (the tile avatar); clearing it must
          // refresh the widget. Profile/customField cases are not widget-visible.
          notifyWidgetDataChanged();
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

  // Add from URL: validate https-only up front, download ONCE to cache, then
  // hand the raw cache uri to the SAME crop→pipeline flow a picked image uses —
  // threading the derivable requestId ONLY for a customField target (Plan 05
  // convention). Each failure maps to its 05-UI-SPEC error copy by `kind`.
  const submitUrl = useCallback(async () => {
    if (submittingUrl) {
      return;
    }
    const url = urlText.trim();
    if (!isImageUrl(url)) {
      Alert.alert(
        "That doesn't look like an image URL.",
        "Check the link and try again.",
      );
      return;
    }
    setSubmittingUrl(true);
    try {
      const rawUri = await downloadImageToCache(url);
      navigation.navigate("CropPhoto", {
        rawUri,
        target,
        requestId:
          target.kind === "customField"
            ? customFieldPhotoRelPath(target.contactId, target.colName)
            : undefined,
      });
      // Collapse the entry on a successful hand-off to the crop screen.
      setUrlEntryOpen(false);
      setUrlText("");
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to download image from url", err);
      if (err instanceof UrlImageError && err.kind === "network") {
        Alert.alert(
          "Couldn't fetch that image.",
          "Check your connection or try a different link.",
        );
      } else if (err instanceof UrlImageError && err.kind === "invalid") {
        Alert.alert(
          "That doesn't look like an image URL.",
          "Check the link and try again.",
        );
      } else {
        // content-type / decode / write failures (and any non-typed error).
        Alert.alert("That image couldn't be used.", "Try a JPEG or PNG.");
      }
    } finally {
      setSubmittingUrl(false);
    }
  }, [submittingUrl, urlText, navigation, target]);

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
        ) : urlEntryOpen ? (
          // URL entry state: a themed input + "Add from URL" submit (44px). On
          // submit → https-only validate → download once → crop pipeline.
          <View style={styles.urlEntry}>
            <TextInput
              testID="photo-source-url-input"
              value={urlText}
              onChangeText={setUrlText}
              editable={!submittingUrl}
              placeholder="https://…"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              inputMode="url"
              style={[
                styles.urlInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
            />
            <Pressable
              testID="photo-source-url-submit"
              accessibilityRole="button"
              accessibilityLabel="Add from URL"
              accessibilityState={{ disabled: submittingUrl }}
              disabled={submittingUrl}
              onPress={() => void submitUrl()}
              style={[styles.urlSubmit, { backgroundColor: colors.accent }]}
            >
              {submittingUrl ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.actionText, { color: colors.background }]}>
                  Add from URL
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          // The "Paste image URL" affordance reveals the URL entry above.
          <Pressable
            testID="photo-source-paste-url"
            accessibilityRole="button"
            accessibilityLabel="Paste image URL"
            onPress={() => setUrlEntryOpen(true)}
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
  urlEntry: {
    gap: 8,
  },
  urlInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  urlSubmit: {
    minHeight: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
});
