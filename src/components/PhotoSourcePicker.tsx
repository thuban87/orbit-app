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
 * Remove switches on `target.kind` and uses the owned-master path. Contact and
 * profile clear their reference with a durable delete intent in one transaction;
 * custom-field Remove enqueues only the intent until the form Save clears value.
 * The contact/profile branches write the DB here, then call `onChanged()`; the
 * customField branch NEVER touches SQL — the field value is cleared through the
 * edit form's guarded upsert on Save (the widget wires `onValueChange` to its
 * `onChange(null)`).
 *
 * HOLD MODE (38.11 D-77): Add Contact has no contact yet, so it passes `hold`
 * instead of a target. Add/Change and the paste-URL path mint a fresh pick
 * token, build a `create-staging/` path and open CropPhoto in hold mode; on
 * focus the picker consumes the crop result for that path, reports it through
 * `onHeldChange` and deletes the previously held file. The held file is not a
 * stored photo path, so its preview is an `expo-image` `Image` fed by
 * `resolveCreateStagingUri` (never `Avatar`, never the "Photo unavailable"
 * check). Remove asks the same confirm, deletes the held file and reports
 * `null`.
 *
 * All colours via `useTheme().colors.*` (check:colors); 44px touch targets; copy
 * verbatim from the 05-UI-SPEC Copywriting Contract.
 */
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import {
  PhotoUnavailableNotice,
  usePhotoLoadFailure,
} from "@/components/PhotoUnavailableNotice";
import { runUrlSubmit } from "@/components/photo-url-submit";
import { FieldError } from "@/components/ui/FieldError";
import {
  clearContactPhotoCore,
  getContactPhotoIdentity,
} from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { isUnusablePhotoReference } from "@/db/photo-relative-path";
import { clearProfilePhotoCore } from "@/db/profile-dao";
import type { RootStackParamList } from "@/navigation/types";
import { newCreateStagingToken } from "@/services/photos/create-photo";
import {
  enqueueRemovalIntentOwned,
  removeOwnedMaster,
} from "@/services/photos/owned-master";
import {
  contactPhotoRelPath,
  createStagingRelPath,
  customFieldPhotoRelPath,
  deleteCreateStaging,
  type PhotoTargetDescriptor,
  profilePhotoRelPath,
  resolveCreateStagingUri,
} from "@/services/photos/photo-storage";
import { isImageUrl } from "@/services/photos/url-image";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { confirm } from "@/stores/confirm-store";
import {
  consumeCropResult,
  markPhotoStaged,
} from "@/stores/photo-result-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { persistentDangerScrim } from "@/theme/danger-scrim";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "photo-source-picker";

/** The preview avatar diameter in the edit surface. */
const PREVIEW_SIZE = 96;

interface PhotoTargetProps {
  /** Which record this affordance edits — drives the derivable paths + Remove. */
  target: PhotoTargetDescriptor;
  /** The current stored RELATIVE photo path, or null for the no-photo state. */
  photo: string | null;
  /** Display name — seeds the preview Avatar's initials/swatch fallback. */
  name: string;
  /** Refresh callback the contact/profile targets fire after their inline DAO write. */
  onChanged?: () => void;
  /** The customField target clears its form value on Remove via this callback. */
  onValueChange?: (value: string | null) => void;
}

/** Add Contact's held photo (38.11 D-77): no contact exists yet. */
export interface PhotoHold {
  /** The open form's staging session token (`[A-Za-z0-9_-]`). */
  sessionToken: string;
  /** The held `create-staging/…` path, or null when nothing is held. */
  heldRelative: string | null;
  /** Reports a newly held path, or null after Remove. */
  onHeldChange: (relative: string | null) => void;
}

interface PhotoHoldProps {
  hold: PhotoHold;
  /** Display name — seeds the initials preview while nothing is held. */
  name: string;
}

export type PhotoSourcePickerProps = PhotoTargetProps | PhotoHoldProps;

/** The URL field's validation message (D-40: inline under the field). */
const INVALID_URL_MESSAGE =
  "That doesn't look like an image URL. Check the link and try again.";

/**
 * Remove photo as ONE themed destructive gate (38.9 D-27, D-30): Cancel
 * resolves false, Remove resolves true. Destructive, so it is not dismissable
 * by Back or a scrim tap (ADR-086); the native dialog it replaces was.
 */
function confirmRemovePhoto(): Promise<boolean> {
  return confirm({
    title: "Remove photo?",
    message: "This deletes the photo from this device and can't be undone.",
    confirmLabel: "Remove",
    destructive: true,
  });
}

/** The held preview URI, or null (initials) if the path is somehow unsafe. */
function safeHeldUri(relative: string): string | null {
  try {
    return resolveCreateStagingUri(relative);
  } catch (err) {
    Logger.error(LOG_SCOPE, "held photo path refused", err);
    return null;
  }
}

/** A failure the user can carry on from: an error snackbar (D-27). */
function showPhotoError(label: string) {
  showSnackbar({ kind: "error", label });
}

export function PhotoSourcePicker(props: PhotoSourcePickerProps) {
  const hold = "hold" in props ? props.hold : null;
  const targetProps = "hold" in props ? null : props;
  const target = targetProps?.target ?? null;
  const photo = hold ? hold.heldRelative : (targetProps?.photo ?? null);
  const { name } = props;
  const onChanged = targetProps?.onChanged;
  const onValueChange = targetProps?.onValueChange;
  const theme = useTheme();
  const { colors } = theme;
  const removeScrim = persistentDangerScrim(theme);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // "Paste image URL" reveal state — a plain toggle + text buffer (not a
  // render-loop concern), gated so a submit-in-flight can't double-fire.
  const [urlEntryOpen, setUrlEntryOpen] = useState(false);
  const [urlText, setUrlText] = useState("");
  const [submittingUrl, setSubmittingUrl] = useState(false);
  // URL validation error, under the URL field; cleared when it changes (D-40).
  const [urlError, setUrlError] = useState<string | null>(null);
  const urlController = useRef<AbortController | null>(null);
  // D-23: a kept reference whose file will not load shows "Photo unavailable";
  // Change and Remove stay available (Remove still clears it, by the user).
  const [photoFailed, onPhotoLoadErrorChange] = usePhotoLoadFailure();
  const abortUrl = useCallback(() => {
    urlController.current?.abort();
    urlController.current = null;
  }, []);
  useEffect(() => abortUrl, [abortUrl]);
  useFocusEffect(useCallback(() => abortUrl, [abortUrl]));

  // Hold mode (D-77): the staging path handed to the crop screen, consumed
  // once when this screen is focused again. Review IN-03: the path is kept
  // until its result arrives — Back during "Use photo" refocuses this screen
  // before the crop publishes, and the late result is consumed on the next
  // focus instead of being orphaned. A new pick replaces the path.
  const pendingHoldRef = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!hold) return;
      const pending = pendingHoldRef.current;
      if (!pending) return;
      const result = consumeCropResult(pending);
      if (!result) return;
      pendingHoldRef.current = null;
      if (!result.success) return;
      const previous = hold.heldRelative;
      hold.onHeldChange(pending);
      if (previous && previous !== pending) {
        try {
          deleteCreateStaging(previous);
        } catch (err) {
          Logger.error(LOG_SCOPE, "failed to delete replaced held photo", err);
        }
      }
    }, [hold]),
  );

  /** Hold mode: a fresh staging path for one pick (never reused). */
  const nextHoldPath = useCallback((): string => {
    if (!hold) throw new Error("photo hold missing");
    const relative = createStagingRelPath(
      hold.sessionToken,
      newCreateStagingToken(),
    );
    pendingHoldRef.current = relative;
    return relative;
  }, [hold]);

  // Stable recycling identity for the preview Avatar across the three kinds.
  const avatarId = !target
    ? "create-held"
    : target.kind === "contact"
      ? target.contactId
      : target.kind === "profile"
        ? "profile"
        : `${target.contactId}-${target.colName}`;

  // Add/Change: launch the system library (no permission), then crop. A
  // customField pick threads its derivable cv- relPath as the requestId.
  const pickFromLibrary = useCallback(async () => {
    try {
      if (hold) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 1,
        });
        if (result.canceled) return;
        const rawUri = result.assets[0]?.uri;
        if (!rawUri) return;
        navigation.navigate("CropPhoto", {
          rawUri,
          hold: { stagingRel: nextHoldPath() },
        });
        return;
      }
      if (!target) throw new Error("photo target missing");
      const contactUid =
        target.kind === "profile"
          ? undefined
          : ((await getContactPhotoIdentity(getExecutor(), target.contactId)) ??
            undefined);
      if (target.kind !== "profile" && !contactUid)
        throw new Error("contact photo target missing");
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
        contactUid,
        requestId:
          target.kind === "customField"
            ? customFieldPhotoRelPath(target.contactId, target.colName)
            : undefined,
      });
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to launch photo library", err);
      showPhotoError("Couldn't open your photos. Please try again.");
    }
  }, [navigation, target, hold, nextHoldPath]);

  // Remove: confirm, then switch on kind — clear the right store + delete the
  // correct derivable file inline (best-effort). Never derefs a missing contactId.
  const removePhoto = useCallback(async () => {
    if (!(await confirmRemovePhoto())) {
      return;
    }
    try {
      if (hold) {
        // Nothing is saved yet: delete the held file and forget it (D-77).
        if (hold.heldRelative) deleteCreateStaging(hold.heldRelative);
        hold.onHeldChange(null);
        return;
      }
      if (!target) throw new Error("photo target missing");
      const exec = getExecutor();
      const now = localDateTime();
      switch (target.kind) {
        case "contact":
          await removeOwnedMaster(exec, contactPhotoRelPath(target.contactId), {
            clearReferenceCore: (tx) =>
              clearContactPhotoCore(tx, target.contactId, now),
          });
          onChanged?.();
          // A contact photo is widget-visible (the tile avatar); clearing it must
          // refresh the widget. Profile/customField cases are not widget-visible.
          notifyWidgetDataChanged();
          break;
        case "profile":
          await removeOwnedMaster(exec, profilePhotoRelPath(), {
            clearReferenceCore: (tx) => clearProfilePhotoCore(tx, now),
          });
          onChanged?.();
          break;
        case "customField": {
          // No SQL here — the field value clears through the edit form's Save.
          const relative = customFieldPhotoRelPath(
            target.contactId,
            target.colName,
          );
          await enqueueRemovalIntentOwned(exec, relative);
          markPhotoStaged(relative);
          onValueChange?.(null);
          break;
        }
      }
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to remove photo", err);
      showPhotoError("Couldn't remove the photo. Please try again.");
    }
  }, [target, hold, onChanged, onValueChange]);

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
      setUrlError(INVALID_URL_MESSAGE);
      return;
    }
    setUrlError(null);
    setSubmittingUrl(true);
    abortUrl();
    const controller = new AbortController();
    urlController.current = controller;
    try {
      const contactUid =
        !target || target.kind === "profile"
          ? undefined
          : ((await getContactPhotoIdentity(getExecutor(), target.contactId)) ??
            undefined);
      if (!hold && !target) throw new Error("photo target missing");
      if (target && target.kind !== "profile" && !contactUid)
        throw new Error("contact photo target missing");
      if (controller.signal.aborted) return;
      const result = await runUrlSubmit({
        url,
        signal: controller.signal,
        navigate: (rawUri) =>
          target
            ? navigation.navigate("CropPhoto", {
                rawUri,
                target,
                contactUid,
                requestId:
                  target.kind === "customField"
                    ? customFieldPhotoRelPath(target.contactId, target.colName)
                    : undefined,
              })
            : navigation.navigate("CropPhoto", {
                rawUri,
                hold: { stagingRel: nextHoldPath() },
              }),
      });
      if (result.status === "aborted") return;
      if (result.status === "error") throw result.cause;
      if (controller.signal.aborted) return;
      // Collapse the entry on a successful hand-off to the crop screen.
      setUrlEntryOpen(false);
      setUrlText("");
    } catch (err) {
      if (controller.signal.aborted) return;
      Logger.error(LOG_SCOPE, "failed to download image from url", err);
      if (
        err &&
        typeof err === "object" &&
        "kind" in err &&
        err.kind === "network"
      ) {
        showPhotoError(
          "Couldn't fetch that image. Check your connection or try a different link.",
        );
      } else if (
        err &&
        typeof err === "object" &&
        "kind" in err &&
        err.kind === "invalid"
      ) {
        setUrlError(INVALID_URL_MESSAGE);
      } else {
        // content-type / decode / write failures (and any non-typed error).
        showPhotoError("That image couldn't be used. Try a JPEG or PNG.");
      }
    } finally {
      if (urlController.current === controller) urlController.current = null;
      if (!controller.signal.aborted) setSubmittingUrl(false);
    }
  }, [
    submittingUrl,
    urlText,
    navigation,
    target,
    hold,
    nextHoldPath,
    abortUrl,
  ]);

  const hasPhoto = photo != null;
  // Hold mode: the held file is a staging path, not a stored photo path, so it
  // is resolved here and drawn as a plain Image (D-77), and the D-34 check
  // below never applies to it.
  const heldUri = hold?.heldRelative ? safeHeldUri(hold.heldRelative) : null;
  // D-34: a value that is not a stored photo path (text left in a custom photo
  // field) is never resolved: the preview shows initials, the notice shows at
  // once, and Change / Remove stay available. The value itself is untouched.
  const unusable = hold ? false : isUnusablePhotoReference(photo);
  const showUnavailable = !hold && hasPhoto && (photoFailed || unusable);

  return (
    <View style={styles.root}>
      {heldUri ? (
        // A fresh path per pick, so no cached decode can be stale; never cached.
        <Image
          testID="photo-source-held-preview"
          source={{ uri: heldUri }}
          contentFit="cover"
          cachePolicy="none"
          style={[styles.heldPreview, { backgroundColor: colors.surface }]}
        />
      ) : (
        <Avatar
          photo={hold || unusable ? null : photo}
          name={name}
          contactId={avatarId}
          size={PREVIEW_SIZE}
          onLoadErrorChange={onPhotoLoadErrorChange}
        />
      )}

      <View style={styles.actions}>
        {showUnavailable ? <PhotoUnavailableNotice /> : null}
        <Pressable
          testID="photo-source-add-change"
          accessibilityRole="button"
          accessibilityLabel={hasPhoto ? "Change photo" : "Add photo"}
          onPress={() => void pickFromLibrary()}
          style={styles.actionBtn}
        >
          <Text style={[styles.actionText, { color: colors.accentText }]}>
            {hasPhoto ? "Change photo" : "Add photo"}
          </Text>
        </Pressable>

        {hasPhoto ? (
          <Pressable
            testID="photo-source-remove"
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
            onPress={() => void removePhoto()}
            style={[
              styles.actionBtn,
              removeScrim && [styles.scrimmedActionBtn, removeScrim],
            ]}
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
              onChangeText={(next) => {
                setUrlText(next);
                setUrlError(null);
              }}
              editable={!submittingUrl}
              placeholder="https://…"
              placeholderTextColor={colors.textPlaceholder}
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
            <FieldError testID="photo-source-url-error" message={urlError} />
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
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={[styles.actionText, { color: colors.onAccent }]}>
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
  heldPreview: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: PREVIEW_SIZE / 2,
  },
  actions: {
    flex: 1,
    gap: 8,
  },
  actionBtn: {
    minHeight: 44,
    justifyContent: "center",
  },
  // D-50: the Galaxy Dark scrim reads as a pill hugging the label.
  scrimmedActionBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    borderRadius: 10,
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
