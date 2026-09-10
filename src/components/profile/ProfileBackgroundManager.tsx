// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button semantic roles are domain props.

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { Sheet } from "@/components/ui/Sheet";
import { listCategories } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import {
  assignCategoryProfilePresentation,
  assignContactBackgroundTemplate,
  assignGlobalProfilePresentation,
  createProfileBackgroundTemplate,
  deleteProfileBackgroundTemplate,
} from "@/db/profile-presentation-dao";
import {
  listProfileBackgroundTemplates,
  type ProfileBackgroundTemplateRow,
  readCategoryProfilePresentation,
} from "@/db/profile-presentation-read";
import { newUid } from "@/db/uid";
import {
  type BackgroundManagerState,
  beginBackgroundPreparation,
  cancelBackgroundPreparation,
  createBackgroundManagerState,
  finishBackgroundPreparation,
  requestBackgroundManagerDismissal,
  resolveBackgroundListState,
} from "@/profile/background-manager-model";
import type { ProfilePresentationInputs } from "@/profile/types";
import { prepareProfileBackground } from "@/services/photos/background-pipeline";
import {
  backgroundDerivativeRelPath,
  deleteBackgroundDerivative,
  persistBackgroundDerivative,
  resolveBackgroundUri,
} from "@/services/photos/background-storage";
import { profileBackgroundTarget } from "@/services/photos/profile-background-target";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "profile-background-manager";
const MAX_SCALE = 8;

type Page = "list" | "crop" | "name" | "assign";
type CropSource = { uri: string; width: number; height: number };
type Category = { id: number; name: string };

export interface ProfileBackgroundManagerProps {
  visible: boolean;
  contactId: number;
  contactName: string;
  presentation: ProfilePresentationInputs;
  onRequestClose: () => void;
  onCommitted?: () => void;
}

/**
 * Profile-owned background template management. Picker bytes are copied into the
 * app-owned namespace before a template row references them; Cancel and failure
 * never mutate the previously committed selection or its bytes.
 */
export function ProfileBackgroundManager({
  visible,
  contactId,
  contactName,
  presentation,
  onRequestClose,
  onCommitted,
}: ProfileBackgroundManagerProps) {
  const { colors } = useTheme();
  const { height: viewportHeight, width: viewportWidth } =
    useWindowDimensions();
  const cropTarget = useMemo(
    () =>
      profileBackgroundTarget({ width: viewportWidth, height: viewportHeight }),
    [viewportHeight, viewportWidth],
  );
  const [page, setPage] = useState<Page>("list");
  const [templates, setTemplates] = useState<ProfileBackgroundTemplateRow[]>(
    [],
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [source, setSource] = useState<CropSource | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [managerState, setManagerState] = useState<BackgroundManagerState>(() =>
    createBackgroundManagerState(null),
  );
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const tokenCounter = useRef(0);
  const activeTokenRef = useRef<string | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const refresh = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const [nextTemplates, nextCategories] = await Promise.all([
        listProfileBackgroundTemplates(getExecutor()),
        listCategories(getExecutor()),
      ]);
      setTemplates(nextTemplates);
      setCategories(nextCategories);
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to load background templates", error);
      setListError("Couldn't load background templates. Try again.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void refresh();
  }, [refresh, visible]);

  const cropBase = useMemo(() => {
    if (!source) return null;
    return Math.max(
      cropTarget.preview.width / source.width,
      cropTarget.preview.height / source.height,
    );
  }, [cropTarget, source]);

  const clampSharedPan = useCallback(
    (nextScale: number, nextX: number, nextY: number) => {
      if (!source || !cropBase) return;
      const boundedScale = Math.max(1, Math.min(nextScale, MAX_SCALE));
      const maxX = Math.max(
        0,
        (source.width * cropBase * boundedScale - cropTarget.preview.width) / 2,
      );
      const maxY = Math.max(
        0,
        (source.height * cropBase * boundedScale - cropTarget.preview.height) /
          2,
      );
      scale.value = boundedScale;
      translateX.value = Math.max(-maxX, Math.min(nextX, maxX));
      translateY.value = Math.max(-maxY, Math.min(nextY, maxY));
    },
    [cropBase, cropTarget, scale, source, translateX, translateY],
  );

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (!source || !cropBase) return;
      const maxX = Math.max(
        0,
        (source.width * cropBase * scale.value - cropTarget.preview.width) / 2,
      );
      const maxY = Math.max(
        0,
        (source.height * cropBase * scale.value - cropTarget.preview.height) /
          2,
      );
      translateX.value = Math.max(
        -maxX,
        Math.min(startX.value + event.translationX, maxX),
      );
      translateY.value = Math.max(
        -maxY,
        Math.min(startY.value + event.translationY, maxY),
      );
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      if (!source || !cropBase) return;
      const nextScale = Math.max(
        1,
        Math.min(startScale.value * event.scale, MAX_SCALE),
      );
      const maxX = Math.max(
        0,
        (source.width * cropBase * nextScale - cropTarget.preview.width) / 2,
      );
      const maxY = Math.max(
        0,
        (source.height * cropBase * nextScale - cropTarget.preview.height) / 2,
      );
      scale.value = nextScale;
      translateX.value = Math.max(-maxX, Math.min(translateX.value, maxX));
      translateY.value = Math.max(-maxY, Math.min(translateY.value, maxY));
    });
  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const chooseImage = useCallback(async () => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });
      const asset = picked.canceled ? null : picked.assets[0];
      if (!asset?.uri || !asset.width || !asset.height) return;
      const token = `background-${++tokenCounter.current}`;
      activeTokenRef.current = token;
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      setSource({ uri: asset.uri, width: asset.width, height: asset.height });
      setManagerState((state) => beginBackgroundPreparation(state, token));
      setPage("crop");
    } catch (error) {
      Logger.error(LOG_SCOPE, "background picker failed", error);
      setManagerState((state) => ({
        ...state,
        error: "Couldn't open your photos. Please try again.",
      }));
    }
  }, [scale, translateX, translateY]);

  const prepareCrop = useCallback(async () => {
    if (!source || saving) return;
    const token = activeTokenRef.current;
    if (!token) return;
    setSaving(true);
    const uid = newUid();
    const relativePath = backgroundDerivativeRelPath(uid);
    try {
      const prepared = await prepareProfileBackground({
        rawUri: source.uri,
        transform: {
          destinationWidth: cropTarget.preview.width,
          destinationHeight: cropTarget.preview.height,
          srcWidth: source.width,
          srcHeight: source.height,
          scale: scale.value,
          translateX: translateX.value,
          translateY: translateY.value,
        },
        output: cropTarget.output,
        cropAndResize: async ({ rawUri, crop, output }) => {
          const rendered = await ImageManipulator.manipulate(rawUri)
            .crop(crop)
            .resize(output)
            .renderAsync();
          const saved = await rendered.saveAsync({
            format: SaveFormat.JPEG,
            compress: 0.82,
          });
          return {
            uri: saved.uri,
            release: () =>
              (rendered as unknown as { release?: () => void }).release?.(),
          };
        },
        persist: (preparedUri) =>
          persistBackgroundDerivative(preparedUri, relativePath),
      });
      if (activeTokenRef.current !== token) {
        deleteBackgroundDerivative(prepared.relativePath);
        return;
      }
      activeTokenRef.current = null;
      setManagerState((state) => {
        return finishBackgroundPreparation(state, token, {
          ok: true,
          relativePath: prepared.relativePath,
        });
      });
      setSource(null);
      setTemplateName(`${contactName}'s background`);
      setPage("name");
    } catch (error) {
      Logger.error(LOG_SCOPE, "background processing failed", error);
      if (activeTokenRef.current !== token) return;
      activeTokenRef.current = null;
      setManagerState((state) =>
        finishBackgroundPreparation(state, token, {
          ok: false,
          message:
            "Couldn't prepare that image. Choose another image or try again.",
        }),
      );
    } finally {
      setSaving(false);
    }
  }, [contactName, cropTarget, saving, scale, source, translateX, translateY]);

  const retryCrop = useCallback(() => {
    if (!source || saving) return;
    const token = `background-${++tokenCounter.current}`;
    activeTokenRef.current = token;
    setManagerState((state) => beginBackgroundPreparation(state, token));
    void prepareCrop();
  }, [prepareCrop, saving, source]);

  const saveTemplate = useCallback(async () => {
    const imagePath = managerState.pendingPath;
    if (!imagePath || saving) return;
    setSaving(true);
    try {
      const uid = imagePath.slice(
        "profile-backgrounds/".length,
        -".jpg".length,
      );
      await createProfileBackgroundTemplate(getExecutor(), {
        uid,
        name: templateName,
        imagePath,
        now: localDateTime(),
      });
      setManagerState(createBackgroundManagerState(imagePath));
      setSelectedUid(uid);
      setPage("assign");
      await refresh();
      onCommitted?.();
    } catch (error) {
      Logger.error(LOG_SCOPE, "background template write failed", error);
      setManagerState((state) => ({
        ...state,
        error: "Couldn't save your changes. Nothing was applied. Try again.",
      }));
    } finally {
      setSaving(false);
    }
  }, [managerState.pendingPath, onCommitted, refresh, saving, templateName]);

  const assign = useCallback(
    async (
      scope: "global" | "category" | "contact" | "inherit",
      categoryId?: number,
    ) => {
      if (!selectedUid || saving) return;
      setSaving(true);
      try {
        const now = localDateTime();
        if (scope === "global") {
          await assignGlobalProfilePresentation(getExecutor(), {
            layoutTemplateUid: presentation.global.layoutTemplateUid,
            backgroundTemplateUid: selectedUid,
            now,
          });
        } else if (scope === "category" && categoryId !== undefined) {
          const current = await readCategoryProfilePresentation(
            getExecutor(),
            categoryId,
          );
          await assignCategoryProfilePresentation(getExecutor(), {
            categoryId,
            layoutTemplateUid: current.layoutTemplateUid,
            backgroundTemplateUid: selectedUid,
            now,
          });
        } else {
          await assignContactBackgroundTemplate(getExecutor(), {
            contactId,
            templateUid: scope === "inherit" ? null : selectedUid,
            now,
          });
        }
        await refresh();
        onCommitted?.();
        setPage("list");
      } catch (error) {
        Logger.error(LOG_SCOPE, "background assignment failed", error);
        setManagerState((state) => ({
          ...state,
          error: "Couldn't save your changes. Nothing was applied. Try again.",
        }));
      } finally {
        setSaving(false);
      }
    },
    [
      contactId,
      onCommitted,
      presentation.global.layoutTemplateUid,
      refresh,
      saving,
      selectedUid,
    ],
  );

  const closeOrGuard = () => {
    if (requestBackgroundManagerDismissal(managerState).kind === "close") {
      onRequestClose();
      return;
    }
    Alert.alert(
      "Discard changes?",
      "Your background changes have not been saved.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard changes",
          style: "destructive",
          onPress: () => {
            if (managerState.pendingPath)
              deleteBackgroundDerivative(managerState.pendingPath);
            activeTokenRef.current = null;
            setManagerState(cancelBackgroundPreparation(managerState));
            setSource(null);
            setPage("list");
            onRequestClose();
          },
        },
      ],
    );
  };

  const selected =
    templates.find((template) => template.uid === selectedUid) ?? null;
  const imageStyle =
    source && cropBase
      ? { width: source.width * cropBase, height: source.height * cropBase }
      : null;
  const listState = resolveBackgroundListState({
    loading: listLoading,
    error: listError,
    templateCount: templates.length,
  });

  return (
    <Sheet visible={visible} onRequestClose={closeOrGuard} variant="expanded">
      <View style={styles.root} accessibilityViewIsModal>
        <View style={styles.heading}>
          <AppText role="heading">Profile backgrounds</AppText>
          <Button role="secondary" label="Back" onPress={closeOrGuard} />
        </View>
        {managerState.error ? (
          <AppText style={{ color: colors.danger }}>
            {managerState.error}
          </AppText>
        ) : null}
        {page === "list" ? (
          <ScrollView
            style={styles.workspace}
            contentContainerStyle={styles.content}
          >
            <AppText role="body">
              Background templates are separate from layout templates.
            </AppText>
            <Button
              role="primary"
              label="Choose photo"
              onPress={() => void chooseImage()}
            />
            {listState.kind === "loading" ? (
              <AppText role="body">Loading backgrounds…</AppText>
            ) : null}
            {listState.kind === "empty" ? (
              <AppText role="body">
                No saved backgrounds yet. Choose a photo to create one.
              </AppText>
            ) : null}
            {listState.kind === "error" ? (
              <>
                <AppText style={{ color: colors.danger }}>
                  {listState.message}
                </AppText>
                <Button
                  role="secondary"
                  label="Retry"
                  onPress={() => void refresh()}
                />
              </>
            ) : null}
            {listState.kind === "populated"
              ? templates.map((template) => (
                  <GlassSurface
                    key={template.uid}
                    density="dense"
                    style={styles.row}
                  >
                    <Image
                      source={{ uri: resolveBackgroundUri(template.imagePath) }}
                      style={styles.thumbnail}
                    />
                    <View style={styles.rowText}>
                      <AppText role="label">{template.name}</AppText>
                      <Button
                        role="tertiary"
                        label="Assign"
                        onPress={() => {
                          setSelectedUid(template.uid);
                          setPage("assign");
                        }}
                      />
                      <Button
                        role="tertiary"
                        label="Delete"
                        onPress={() =>
                          Alert.alert(
                            "Delete background template?",
                            "Profiles using it will fall back to their Category or default background. Contact information will not change.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete template",
                                style: "destructive",
                                onPress: () =>
                                  void (async () => {
                                    const orphan =
                                      await deleteProfileBackgroundTemplate(
                                        getExecutor(),
                                        template.uid,
                                        localDateTime(),
                                      );
                                    if (orphan)
                                      deleteBackgroundDerivative(orphan);
                                    await refresh();
                                    onCommitted?.();
                                  })(),
                              },
                            ],
                          )
                        }
                      />
                    </View>
                  </GlassSurface>
                ))
              : null}
          </ScrollView>
        ) : null}
        {page === "crop" && source && imageStyle ? (
          <ScrollView
            style={styles.workspace}
            contentContainerStyle={styles.content}
          >
            <AppText role="body">
              Pinch to crop and drag to reposition. The preview uses the Profile
              aspect.
            </AppText>
            <View style={[styles.cropViewport, cropTarget.preview]}>
              <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
                <Animated.Image
                  source={{ uri: source.uri }}
                  style={[imageStyle, animatedImageStyle]}
                  resizeMode="stretch"
                />
              </GestureDetector>
            </View>
            <View style={styles.controls}>
              <Button
                role="tertiary"
                label="Reset crop"
                onPress={() => clampSharedPan(1, 0, 0)}
              />
              <Button
                role="tertiary"
                label="Zoom in"
                onPress={() =>
                  clampSharedPan(
                    scale.value * 1.15,
                    translateX.value,
                    translateY.value,
                  )
                }
              />
              <Button
                role="tertiary"
                label="Zoom out"
                onPress={() =>
                  clampSharedPan(
                    scale.value / 1.15,
                    translateX.value,
                    translateY.value,
                  )
                }
              />
              <Button
                role="tertiary"
                label="Move left"
                onPress={() =>
                  clampSharedPan(
                    scale.value,
                    translateX.value - 24,
                    translateY.value,
                  )
                }
              />
              <Button
                role="tertiary"
                label="Move right"
                onPress={() =>
                  clampSharedPan(
                    scale.value,
                    translateX.value + 24,
                    translateY.value,
                  )
                }
              />
              <Button
                role="tertiary"
                label="Move up"
                onPress={() =>
                  clampSharedPan(
                    scale.value,
                    translateX.value,
                    translateY.value - 24,
                  )
                }
              />
              <Button
                role="tertiary"
                label="Move down"
                onPress={() =>
                  clampSharedPan(
                    scale.value,
                    translateX.value,
                    translateY.value + 24,
                  )
                }
              />
            </View>
            <Button role="secondary" label="Cancel" onPress={closeOrGuard} />
            {managerState.error ? (
              <Button
                role="secondary"
                label="Retry"
                disabled={saving}
                onPress={retryCrop}
              />
            ) : null}
            <Button
              role="primary"
              label={saving ? "Preparing…" : "Use background"}
              disabled={saving}
              onPress={() => void prepareCrop()}
            />
          </ScrollView>
        ) : null}
        {page === "name" ? (
          <ScrollView
            style={styles.workspace}
            contentContainerStyle={styles.content}
          >
            <AppText role="body">
              Name this reusable background template.
            </AppText>
            <TextInput
              accessibilityLabel="Background template name"
              value={templateName}
              onChangeText={setTemplateName}
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />
            <Button
              role="primary"
              label={saving ? "Saving…" : "Save background template"}
              disabled={saving || !templateName.trim()}
              onPress={() => void saveTemplate()}
            />
          </ScrollView>
        ) : null}
        {page === "assign" && selected ? (
          <ScrollView
            style={styles.workspace}
            contentContainerStyle={styles.content}
          >
            <AppText role="heading">Assign {selected.name}</AppText>
            <Button
              role="secondary"
              label="Set as global default"
              onPress={() => void assign("global")}
            />
            <AppText role="label">Category override</AppText>
            {categories.map((category) => (
              <Button
                key={category.id}
                role="tertiary"
                label={`Assign to ${category.name}`}
                onPress={() => void assign("category", category.id)}
              />
            ))}
            <Button
              role="primary"
              label={`Use for ${contactName}`}
              onPress={() => void assign("contact")}
            />
            <Button
              role="secondary"
              label={`Use inherited background for ${contactName}`}
              onPress={() => void assign("inherit")}
            />
          </ScrollView>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: SPACING.sm },
  workspace: { flex: 1 },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  content: { gap: SPACING.sm, paddingBottom: SPACING.xl },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.sm,
  },
  rowText: { flex: 1, gap: SPACING.xs },
  thumbnail: { borderRadius: RADII.md, height: 56, width: 84 },
  cropViewport: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  input: {
    borderRadius: RADII.md,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});
