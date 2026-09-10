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
  runOnJS,
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
  assignGlobalProfileBackgroundTemplate,
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
  deleteBackgroundTemplateAndRefresh,
  finishBackgroundPreparation,
  requestBackgroundManagerDismissal,
  resolveBackgroundListState,
  shouldResetBackgroundManagerViewOnOpen,
} from "@/profile/background-manager-model";
import { prepareProfileBackground } from "@/services/photos/background-pipeline";
import {
  clampBackgroundCropSelection,
  createInitialBackgroundCropSelection,
  describeBackgroundCropSelection,
  pinchResizeBackgroundCropSelection,
  translateBackgroundCropSelection,
} from "@/services/photos/background-crop-geometry";
import {
  backgroundDerivativeRelPath,
  deleteBackgroundDerivative,
  persistBackgroundDerivative,
  resolveBackgroundUri,
} from "@/services/photos/background-storage";
import {
  profileBackgroundTarget,
} from "@/services/photos/profile-background-target";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "profile-background-manager";
const MAX_ZOOM = 8;

type Page = "list" | "crop" | "name" | "assign";
type CropSource = { uri: string; width: number; height: number };
type Category = { id: number; name: string };

export interface ProfileBackgroundManagerProps {
  visible: boolean;
  contactId: number;
  contactName: string;
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
  const [cropSpace, setCropSpace] = useState<{
    width: number;
    height: number;
  } | null>(null);
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
  const [cropStatus, setCropStatus] = useState("");
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
  const tokenCounter = useRef(0);
  const activeTokenRef = useRef<string | null>(null);
  const wasVisibleRef = useRef(false);

  const displayScale = useSharedValue(1);
  const displayOffsetX = useSharedValue(0);
  const displayOffsetY = useSharedValue(0);
  const sourceWidth = useSharedValue(1);
  const sourceHeight = useSharedValue(1);
  const selectionX = useSharedValue(0);
  const selectionY = useSharedValue(0);
  const selectionWidth = useSharedValue(1);
  const selectionHeight = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startWidth = useSharedValue(1);
  const startHeight = useSharedValue(1);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const pinchRatioX = useSharedValue(0.5);
  const pinchRatioY = useSharedValue(0.5);

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
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    const opening = !wasVisibleRef.current;
    wasVisibleRef.current = true;
    if (!opening) return;
    if (shouldResetBackgroundManagerViewOnOpen(managerState)) {
      activeTokenRef.current = null;
      setManagerState((current) => cancelBackgroundPreparation(current));
      setPage("list");
      setSelectedUid(null);
      setSource(null);
      setTemplateName("");
      setCropStatus("");
      setFineTuneOpen(false);
    }
    void refresh();
  }, [managerState, refresh, visible]);

  const profileAspect = cropTarget.preview.width / cropTarget.preview.height;
  const publishStatus = useCallback(
    (x: number, y: number, width: number, height: number) => {
      if (source) setCropStatus(describeBackgroundCropSelection({ originX: x, originY: y, width, height }, source));
    },
    [source],
  );
  useEffect(() => {
    if (!source) return;
    const initial = createInitialBackgroundCropSelection(source, profileAspect);
    sourceWidth.value = source.width;
    sourceHeight.value = source.height;
    selectionX.value = initial.originX;
    selectionY.value = initial.originY;
    selectionWidth.value = initial.width;
    selectionHeight.value = initial.height;
    setFineTuneOpen(false);
    publishStatus(initial.originX, initial.originY, initial.width, initial.height);
  }, [profileAspect, publishStatus, selectionHeight, selectionWidth, selectionX, selectionY, source, sourceHeight, sourceWidth]);
  useEffect(() => {
    if (!source || !cropSpace) return;
    const scale = Math.min(
      cropSpace.width / source.width,
      cropSpace.height / source.height,
    );
    displayScale.value = scale;
    displayOffsetX.value = (cropSpace.width - source.width * scale) / 2;
    displayOffsetY.value = (cropSpace.height - source.height * scale) / 2;
  }, [cropSpace, displayOffsetX, displayOffsetY, displayScale, source]);
  const clampSelection = () => {
    "worklet";
    const maxWidth = Math.min(sourceWidth.value, sourceHeight.value * profileAspect);
    const width = Math.max(maxWidth / MAX_ZOOM, Math.min(selectionWidth.value, maxWidth));
    selectionWidth.value = width;
    selectionHeight.value = width / profileAspect;
    selectionX.value = Math.max(0, Math.min(selectionX.value, sourceWidth.value - width));
    selectionY.value = Math.max(0, Math.min(selectionY.value, sourceHeight.value - selectionHeight.value));
  };
  const pan = Gesture.Pan().onStart(() => {
    startX.value = selectionX.value;
    startY.value = selectionY.value;
  }).onUpdate((event) => {
    selectionX.value = startX.value + event.translationX / displayScale.value;
    selectionY.value = startY.value + event.translationY / displayScale.value;
    const maxX = Math.max(0, sourceWidth.value - selectionWidth.value);
    selectionX.value = Math.max(0, Math.min(selectionX.value, maxX));
    selectionY.value = Math.max(0, Math.min(selectionY.value, sourceHeight.value - selectionHeight.value));
  }).onFinalize(() => runOnJS(publishStatus)(selectionX.value, selectionY.value, selectionWidth.value, selectionHeight.value));
  const pinch = Gesture.Pinch().onStart((event) => {
    startWidth.value = selectionWidth.value;
    startHeight.value = selectionHeight.value;
    startX.value = selectionX.value;
    startY.value = selectionY.value;
    pinchFocalX.value = (event.focalX - displayOffsetX.value) / displayScale.value;
    pinchFocalY.value = (event.focalY - displayOffsetY.value) / displayScale.value;
    pinchRatioX.value = (pinchFocalX.value - startX.value) / startWidth.value;
    pinchRatioY.value = (pinchFocalY.value - startY.value) / startHeight.value;
  }).onUpdate((event) => {
    const width = startWidth.value / event.scale;
    const focalX = pinchFocalX.value;
    const focalY = pinchFocalY.value;
    selectionWidth.value = width;
    selectionHeight.value = width / profileAspect;
    selectionX.value = focalX - width * pinchRatioX.value;
    selectionY.value = focalY - selectionHeight.value * pinchRatioY.value;
    clampSelection();
  }).onFinalize(() => runOnJS(publishStatus)(selectionX.value, selectionY.value, selectionWidth.value, selectionHeight.value));
  const sourceImageStyle = useAnimatedStyle(() => ({ height: sourceHeight.value * displayScale.value, left: displayOffsetX.value, top: displayOffsetY.value, width: sourceWidth.value * displayScale.value }));
  const selectionStyle = useAnimatedStyle(() => ({ height: selectionHeight.value * displayScale.value, left: displayOffsetX.value + selectionX.value * displayScale.value, top: displayOffsetY.value + selectionY.value * displayScale.value, width: selectionWidth.value * displayScale.value }));
  const maskTopStyle = useAnimatedStyle(() => ({ height: displayOffsetY.value + selectionY.value * displayScale.value }));
  const maskBottomStyle = useAnimatedStyle(() => ({ top: displayOffsetY.value + (selectionY.value + selectionHeight.value) * displayScale.value }));
  const maskLeftStyle = useAnimatedStyle(() => ({ height: selectionHeight.value * displayScale.value, top: displayOffsetY.value + selectionY.value * displayScale.value, width: displayOffsetX.value + selectionX.value * displayScale.value }));
  const maskRightStyle = useAnimatedStyle(() => ({ height: selectionHeight.value * displayScale.value, left: displayOffsetX.value + (selectionX.value + selectionWidth.value) * displayScale.value, top: displayOffsetY.value + selectionY.value * displayScale.value }));

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
  }, []);

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
        selection: clampBackgroundCropSelection(
          { originX: selectionX.value, originY: selectionY.value, width: selectionWidth.value, height: selectionHeight.value },
          source,
          profileAspect,
        ),
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
  }, [
    contactName,
    cropTarget.output,
    profileAspect,
    saving,
    selectionHeight,
    selectionWidth,
    selectionX,
    selectionY,
    source,
  ]);

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
      scope:
        | "global"
        | "clear-global"
        | "category"
        | "clear-category"
        | "contact"
        | "inherit",
      categoryId?: number,
    ) => {
      const needsSelectedTemplate =
        scope === "global" || scope === "category" || scope === "contact";
      if ((needsSelectedTemplate && !selectedUid) || saving) return;
      setSaving(true);
      try {
        const now = localDateTime();
        if (scope === "global" || scope === "clear-global") {
          await assignGlobalProfileBackgroundTemplate(getExecutor(), {
            templateUid: scope === "clear-global" ? null : selectedUid,
            now,
          });
        } else if (
          (scope === "category" || scope === "clear-category") &&
          categoryId !== undefined
        ) {
          const current = await readCategoryProfilePresentation(
            getExecutor(),
            categoryId,
          );
          await assignCategoryProfilePresentation(getExecutor(), {
            categoryId,
            layoutTemplateUid: current.layoutTemplateUid,
            backgroundTemplateUid:
              scope === "clear-category" ? null : selectedUid,
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
  const listState = resolveBackgroundListState({
    loading: listLoading,
    error: listError,
    templateCount: templates.length,
  });

  return (
    <Sheet visible={visible} onRequestClose={closeOrGuard} variant="expanded">
      <View style={styles.root} accessibilityViewIsModal>
        {page !== "crop" ? (
          <View style={styles.heading}>
            <AppText role="heading">Profile backgrounds</AppText>
            <Button role="secondary" label="Back" onPress={closeOrGuard} />
          </View>
        ) : null}
        {page !== "crop" && managerState.error ? (
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
            <AppText role="label">Background assignment</AppText>
            <AppText role="body">
              Clear an assignment to use the next available Category, global, or
              active theme background. Layout choices stay unchanged.
            </AppText>
            <Button
              role="secondary"
              label="Clear global background"
              onPress={() => void assign("clear-global")}
            />
            {categories.map((category) => (
              <Button
                key={`clear-${category.id}`}
                role="secondary"
                label={`Clear ${category.name} background`}
                onPress={() => void assign("clear-category", category.id)}
              />
            ))}
            <Button
              role="secondary"
              label={`Inherit Category, global, or theme background for ${contactName}`}
              onPress={() => void assign("inherit")}
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
                                    try {
                                      await deleteBackgroundTemplateAndRefresh({
                                        removeTemplate: () =>
                                          deleteProfileBackgroundTemplate(
                                            getExecutor(),
                                            template.uid,
                                            localDateTime(),
                                          ),
                                        removeDerivative:
                                          deleteBackgroundDerivative,
                                        refresh,
                                        onCommitted,
                                      });
                                    } catch (error) {
                                      Logger.error(
                                        LOG_SCOPE,
                                        "failed to delete background template",
                                        error,
                                      );
                                      setListError(
                                        "Couldn't delete that background. Try again.",
                                      );
                                    }
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
        {page === "crop" && source ? (
          <View style={styles.cropEditor}>
            <GlassSurface density="dense" style={styles.cropTopOverlay}>
              <View style={styles.heading}>
                <AppText role="heading">Crop background</AppText>
                <Button role="secondary" label="Back" onPress={closeOrGuard} />
              </View>
              <AppText role="body">
                Drag to reposition. Pinch or use the controls to zoom.
              </AppText>
            </GlassSurface>
            <View
              style={styles.cropPreviewSpace}
              onLayout={({ nativeEvent }) => {
                const { width, height } = nativeEvent.layout;
                setCropSpace((current) =>
                  current?.width === width && current.height === height
                    ? current
                    : { width, height },
                );
              }}
            >
              {cropSpace ? (
                <View style={[styles.cropViewport, { height: cropSpace.height, width: "100%" }]}>
                  <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
                    <Animated.View style={styles.cropTouchSurface}>
                      <Animated.Image source={{ uri: source.uri }} style={[styles.containedSource, sourceImageStyle]} resizeMode="stretch" />
                      <Animated.View pointerEvents="none" style={[styles.cropMask, styles.cropMaskTop, { backgroundColor: colors.background }, maskTopStyle]} />
                      <Animated.View pointerEvents="none" style={[styles.cropMask, styles.cropMaskBottom, { backgroundColor: colors.background }, maskBottomStyle]} />
                      <Animated.View pointerEvents="none" style={[styles.cropMask, styles.cropMaskLeft, { backgroundColor: colors.background }, maskLeftStyle]} />
                      <Animated.View pointerEvents="none" style={[styles.cropMask, styles.cropMaskRight, { backgroundColor: colors.background }, maskRightStyle]} />
                      <Animated.View pointerEvents="none" style={[styles.cropSelection, { borderColor: colors.accent }, selectionStyle]} />
                    </Animated.View>
                  </GestureDetector>
                </View>
              ) : null}
            </View>
            <GlassSurface density="dense" style={styles.cropBottomOverlay}>
              {managerState.error ? (
                <AppText style={{ color: colors.danger }}>
                  {managerState.error}
                </AppText>
              ) : null}
              <AppText accessibilityLiveRegion="polite" role="body">{cropStatus}</AppText>
              {fineTuneOpen ? <View style={styles.fineTuneControls}>
                <Button
                  role="tertiary"
                  label="Reset"
                  accessibilityLabel="Reset crop"
                  onPress={() => {
                    if (!source) return;
                    const next = createInitialBackgroundCropSelection(source, profileAspect);
                    selectionX.value = next.originX;
                    selectionY.value = next.originY;
                    selectionWidth.value = next.width;
                    selectionHeight.value = next.height;
                    publishStatus(next.originX, next.originY, next.width, next.height);
                  }}
                />
                <Button
                  role="tertiary"
                  label="Zoom in"
                  accessibilityLabel="Zoom in"
                  onPress={() => source && (() => { const next = pinchResizeBackgroundCropSelection({ originX: selectionX.value, originY: selectionY.value, width: selectionWidth.value, height: selectionHeight.value }, source, profileAspect, { x: selectionX.value + selectionWidth.value / 2, y: selectionY.value + selectionHeight.value / 2 }, 1.15); selectionX.value = next.originX; selectionY.value = next.originY; selectionWidth.value = next.width; selectionHeight.value = next.height; publishStatus(next.originX, next.originY, next.width, next.height); })()}
                />
                <Button
                  role="tertiary"
                  label="Zoom out"
                  accessibilityLabel="Zoom out"
                  onPress={() => source && (() => { const next = pinchResizeBackgroundCropSelection({ originX: selectionX.value, originY: selectionY.value, width: selectionWidth.value, height: selectionHeight.value }, source, profileAspect, { x: selectionX.value + selectionWidth.value / 2, y: selectionY.value + selectionHeight.value / 2 }, 1 / 1.15); selectionX.value = next.originX; selectionY.value = next.originY; selectionWidth.value = next.width; selectionHeight.value = next.height; publishStatus(next.originX, next.originY, next.width, next.height); })()}
                />
                <Button
                  role="tertiary"
                  label="Move left"
                  accessibilityLabel="Move left"
                  onPress={() => source && (() => { const next = translateBackgroundCropSelection({ originX: selectionX.value, originY: selectionY.value, width: selectionWidth.value, height: selectionHeight.value }, source, -24, 0); selectionX.value = next.originX; selectionY.value = next.originY; publishStatus(next.originX, next.originY, next.width, next.height); })()}
                />
                <Button
                  role="tertiary"
                  label="Move right"
                  accessibilityLabel="Move right"
                  onPress={() => source && (() => { const next = translateBackgroundCropSelection({ originX: selectionX.value, originY: selectionY.value, width: selectionWidth.value, height: selectionHeight.value }, source, 24, 0); selectionX.value = next.originX; selectionY.value = next.originY; publishStatus(next.originX, next.originY, next.width, next.height); })()}
                />
                <Button
                  role="tertiary"
                  label="Move up"
                  accessibilityLabel="Move up"
                  onPress={() => source && (() => { const next = translateBackgroundCropSelection({ originX: selectionX.value, originY: selectionY.value, width: selectionWidth.value, height: selectionHeight.value }, source, 0, -24); selectionX.value = next.originX; selectionY.value = next.originY; publishStatus(next.originX, next.originY, next.width, next.height); })()}
                />
                <Button
                  role="tertiary"
                  label="Move down"
                  accessibilityLabel="Move down"
                  onPress={() => source && (() => { const next = translateBackgroundCropSelection({ originX: selectionX.value, originY: selectionY.value, width: selectionWidth.value, height: selectionHeight.value }, source, 0, 24); selectionX.value = next.originX; selectionY.value = next.originY; publishStatus(next.originX, next.originY, next.width, next.height); })()}
                />
              </View> : null}
              <View style={styles.cropActions}>
                <Button
                  role="secondary"
                  label="Cancel"
                  onPress={closeOrGuard}
                />
                <Button role="tertiary" label="Fine tune" onPress={() => setFineTuneOpen((open) => !open)} />
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
              </View>
            </GlassSurface>
          </View>
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
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cropTouchSurface: { flex: 1, width: "100%" },
  containedSource: { position: "absolute" },
  cropMask: { opacity: 0.62, position: "absolute" },
  cropMaskTop: { left: 0, right: 0, top: 0 },
  cropMaskBottom: { bottom: 0, left: 0, right: 0 },
  cropMaskLeft: { left: 0 },
  cropMaskRight: { right: 0 },
  cropSelection: { borderWidth: 2, position: "absolute" },
  cropEditor: {
    flex: 1,
    overflow: "hidden",
  },
  cropTopOverlay: {
    padding: SPACING.sm,
  },
  cropPreviewSpace: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 0,
  },
  cropBottomOverlay: {
    padding: SPACING.sm,
  },
  cropControlRow: { gap: SPACING.xs, paddingRight: SPACING.sm },
  fineTuneControls: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  cropActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  input: {
    borderRadius: RADII.md,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});
