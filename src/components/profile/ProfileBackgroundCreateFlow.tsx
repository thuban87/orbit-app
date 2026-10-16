// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button semantic roles are domain props.

/**
 * The shared "new background from a photo" flow (38.11 D-79, D-58.1; RESEARCH
 * section 5 R2): pick a photo, crop it to the Profile's shape, name it, write
 * the template row. Used by the Profile's background sheet
 * (`ProfileBackgroundManager`) and the Settings Profile Backgrounds page, so
 * both run one implementation.
 *
 * Split in two so a host keeps the draft while its sheet is hidden:
 * `useProfileBackgroundCreateFlow` owns the state (draft lifecycle, pending
 * file, tokens, crop shared values and gestures) and lives in the host, outside
 * any Modal; `ProfileBackgroundCreateFlow` renders the crop or name step inside
 * the host's sheet.
 *
 * Files (ADR-112): picker bytes are copied into the app-owned
 * `profile-backgrounds/<uid>.jpg` namespace before a template row references
 * them. A discarded draft deletes its pending file; a stale (superseded) crop
 * deletes its own output. Cancel and failure never touch committed templates.
 *
 * The crop step's Back is the 38.9 icon-only chevron (D-43, D-44).
 *
 * Worklets: every worklet helper is defined ABOVE the gesture that calls it (a
 * worklet calling a later-defined worklet is undefined on device; memory note
 * "worklet-forward-ref-hazard"). Animation runs on shared values, never React
 * state (CLAUDE.md Conventions).
 */
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { ScopedPalette } from "@/components/ui/ScopedPalette";
import { getExecutor, localDateTime } from "@/db/database";
import { createProfileBackgroundTemplate } from "@/db/profile-presentation-dao";
import { newUid } from "@/db/uid";
import { confirmDiscard } from "@/navigation/discard-keep-guard";
import {
  type BackgroundManagerState,
  beginBackgroundPreparation,
  cancelBackgroundPreparation,
  createBackgroundManagerState,
  finishBackgroundPreparation,
  requestBackgroundManagerDismissal,
} from "@/profile/background-manager-model";
import {
  type BackgroundCropRect,
  clampBackgroundCropSelection,
  createInitialBackgroundCropSelection,
  describeBackgroundCropSelection,
  pinchResizeBackgroundCropSelection,
  translateBackgroundCropSelection,
} from "@/services/photos/background-crop-geometry";
import { prepareProfileBackground } from "@/services/photos/background-pipeline";
import {
  backgroundDerivativeRelPath,
  deleteBackgroundDerivative,
  persistBackgroundDerivative,
} from "@/services/photos/background-storage";
import { renderBackgroundDerivative } from "@/services/photos/manipulator-derivatives";
import { profileBackgroundTarget } from "@/services/photos/profile-background-target";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "profile-background-create-flow";
const MAX_ZOOM = 8;

export type BackgroundCropSource = {
  uri: string;
  width: number;
  height: number;
};
export type ProfileBackgroundCreateStep = "idle" | "crop" | "name";
export type ChooseBackgroundResult = "picked" | "cancelled" | "failed";

export interface UseProfileBackgroundCreateFlowOptions {
  /** The prefilled template name on the name step. */
  defaultName: string;
  /**
   * After the template row is written. The flow is back to `idle` with
   * nothing pending; the host decides what follows (an assign step).
   */
  onSaved: (templateUid: string, name: string) => void | Promise<void>;
}

/** The draft state and crop machinery; call it in the host, outside its sheet. */
export function useProfileBackgroundCreateFlow({
  defaultName,
  onSaved,
}: UseProfileBackgroundCreateFlowOptions) {
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
  const [step, setStep] = useState<ProfileBackgroundCreateStep>("idle");
  const [source, setSource] = useState<BackgroundCropSource | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [state, setState] = useState<BackgroundManagerState>(() =>
    createBackgroundManagerState(null),
  );
  const [saving, setSaving] = useState(false);
  const [cropStatus, setCropStatus] = useState("");
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
  const tokenCounter = useRef(0);
  const activeTokenRef = useRef<string | null>(null);
  // Latest state for the async discard prompt: a crop that finishes while the
  // prompt is open must still have its pending file deleted on Discard.
  const stateRef = useRef(state);
  stateRef.current = state;

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

  const profileAspect = cropTarget.preview.width / cropTarget.preview.height;
  const publishStatus = useCallback(
    (x: number, y: number, width: number, height: number) => {
      if (source)
        setCropStatus(
          describeBackgroundCropSelection(
            { originX: x, originY: y, width, height },
            source,
          ),
        );
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
    publishStatus(
      initial.originX,
      initial.originY,
      initial.width,
      initial.height,
    );
  }, [
    profileAspect,
    publishStatus,
    selectionHeight,
    selectionWidth,
    selectionX,
    selectionY,
    source,
    sourceHeight,
    sourceWidth,
  ]);
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
  // Worklet helper: defined above the pinch gesture that calls it.
  const clampSelection = () => {
    "worklet";
    const maxWidth = Math.min(
      sourceWidth.value,
      sourceHeight.value * profileAspect,
    );
    const width = Math.max(
      maxWidth / MAX_ZOOM,
      Math.min(selectionWidth.value, maxWidth),
    );
    selectionWidth.value = width;
    selectionHeight.value = width / profileAspect;
    selectionX.value = Math.max(
      0,
      Math.min(selectionX.value, sourceWidth.value - width),
    );
    selectionY.value = Math.max(
      0,
      Math.min(selectionY.value, sourceHeight.value - selectionHeight.value),
    );
  };
  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = selectionX.value;
      startY.value = selectionY.value;
    })
    .onUpdate((event) => {
      selectionX.value = startX.value + event.translationX / displayScale.value;
      selectionY.value = startY.value + event.translationY / displayScale.value;
      const maxX = Math.max(0, sourceWidth.value - selectionWidth.value);
      selectionX.value = Math.max(0, Math.min(selectionX.value, maxX));
      selectionY.value = Math.max(
        0,
        Math.min(selectionY.value, sourceHeight.value - selectionHeight.value),
      );
    })
    .onFinalize(() =>
      runOnJS(publishStatus)(
        selectionX.value,
        selectionY.value,
        selectionWidth.value,
        selectionHeight.value,
      ),
    );
  const pinch = Gesture.Pinch()
    .onStart((event) => {
      startWidth.value = selectionWidth.value;
      startHeight.value = selectionHeight.value;
      startX.value = selectionX.value;
      startY.value = selectionY.value;
      pinchFocalX.value =
        (event.focalX - displayOffsetX.value) / displayScale.value;
      pinchFocalY.value =
        (event.focalY - displayOffsetY.value) / displayScale.value;
      pinchRatioX.value = (pinchFocalX.value - startX.value) / startWidth.value;
      pinchRatioY.value =
        (pinchFocalY.value - startY.value) / startHeight.value;
    })
    .onUpdate((event) => {
      const width = startWidth.value / event.scale;
      const focalX = pinchFocalX.value;
      const focalY = pinchFocalY.value;
      selectionWidth.value = width;
      selectionHeight.value = width / profileAspect;
      selectionX.value = focalX - width * pinchRatioX.value;
      selectionY.value = focalY - selectionHeight.value * pinchRatioY.value;
      clampSelection();
    })
    .onFinalize(() =>
      runOnJS(publishStatus)(
        selectionX.value,
        selectionY.value,
        selectionWidth.value,
        selectionHeight.value,
      ),
    );
  const sourceImageStyle = useAnimatedStyle(() => ({
    height: sourceHeight.value * displayScale.value,
    left: displayOffsetX.value,
    top: displayOffsetY.value,
    width: sourceWidth.value * displayScale.value,
  }));
  const selectionStyle = useAnimatedStyle(() => ({
    height: selectionHeight.value * displayScale.value,
    left: displayOffsetX.value + selectionX.value * displayScale.value,
    top: displayOffsetY.value + selectionY.value * displayScale.value,
    width: selectionWidth.value * displayScale.value,
  }));
  const maskTopStyle = useAnimatedStyle(() => ({
    height: displayOffsetY.value + selectionY.value * displayScale.value,
  }));
  const maskBottomStyle = useAnimatedStyle(() => ({
    top:
      displayOffsetY.value +
      (selectionY.value + selectionHeight.value) * displayScale.value,
  }));
  const maskLeftStyle = useAnimatedStyle(() => ({
    height: selectionHeight.value * displayScale.value,
    top: displayOffsetY.value + selectionY.value * displayScale.value,
    width: displayOffsetX.value + selectionX.value * displayScale.value,
  }));
  const maskRightStyle = useAnimatedStyle(() => ({
    height: selectionHeight.value * displayScale.value,
    left:
      displayOffsetX.value +
      (selectionX.value + selectionWidth.value) * displayScale.value,
    top: displayOffsetY.value + selectionY.value * displayScale.value,
  }));

  /** The current selection, read from the shared values on the JS thread. */
  const currentSelection = (): BackgroundCropRect => ({
    originX: selectionX.value,
    originY: selectionY.value,
    width: selectionWidth.value,
    height: selectionHeight.value,
  });
  /** Fine-tune: back to the initial crop. */
  const resetCrop = () => {
    if (!source) return;
    const next = createInitialBackgroundCropSelection(source, profileAspect);
    selectionX.value = next.originX;
    selectionY.value = next.originY;
    selectionWidth.value = next.width;
    selectionHeight.value = next.height;
    publishStatus(next.originX, next.originY, next.width, next.height);
  };
  /** Fine-tune: zoom about the selection centre (factor > 1 zooms in). */
  const zoomCrop = (factor: number) => {
    if (!source) return;
    const next = pinchResizeBackgroundCropSelection(
      currentSelection(),
      source,
      profileAspect,
      {
        x: selectionX.value + selectionWidth.value / 2,
        y: selectionY.value + selectionHeight.value / 2,
      },
      factor,
    );
    selectionX.value = next.originX;
    selectionY.value = next.originY;
    selectionWidth.value = next.width;
    selectionHeight.value = next.height;
    publishStatus(next.originX, next.originY, next.width, next.height);
  };
  /** Fine-tune: move the selection by source pixels. */
  const nudgeCrop = (dx: number, dy: number) => {
    if (!source) return;
    const next = translateBackgroundCropSelection(
      currentSelection(),
      source,
      dx,
      dy,
    );
    selectionX.value = next.originX;
    selectionY.value = next.originY;
    publishStatus(next.originX, next.originY, next.width, next.height);
  };

  const chooseImage = useCallback(async (): Promise<ChooseBackgroundResult> => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });
      const asset = picked.canceled ? null : picked.assets[0];
      if (!asset?.uri || !asset.width || !asset.height) return "cancelled";
      const token = `background-${++tokenCounter.current}`;
      activeTokenRef.current = token;
      setSource({ uri: asset.uri, width: asset.width, height: asset.height });
      setState((current) => beginBackgroundPreparation(current, token));
      setStep("crop");
      return "picked";
    } catch (error) {
      Logger.error(LOG_SCOPE, "background picker failed", error);
      setState((current) => ({
        ...current,
        error: "Couldn't open your photos. Please try again.",
      }));
      return "failed";
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
          {
            originX: selectionX.value,
            originY: selectionY.value,
            width: selectionWidth.value,
            height: selectionHeight.value,
          },
          source,
          profileAspect,
        ),
        output: cropTarget.output,
        // Releases the rendered image and its context once saved (D-11, WR-02).
        cropAndResize: renderBackgroundDerivative,
        persist: (preparedUri) =>
          persistBackgroundDerivative(preparedUri, relativePath),
      });
      if (activeTokenRef.current !== token) {
        deleteBackgroundDerivative(prepared.relativePath);
        return;
      }
      activeTokenRef.current = null;
      setState((current) => {
        return finishBackgroundPreparation(current, token, {
          ok: true,
          relativePath: prepared.relativePath,
        });
      });
      setSource(null);
      setTemplateName(defaultName);
      setStep("name");
    } catch (error) {
      Logger.error(LOG_SCOPE, "background processing failed", error);
      if (activeTokenRef.current !== token) return;
      activeTokenRef.current = null;
      setState((current) =>
        finishBackgroundPreparation(current, token, {
          ok: false,
          message:
            "Couldn't prepare that image. Choose another image or try again.",
        }),
      );
    } finally {
      setSaving(false);
    }
  }, [
    cropTarget.output,
    defaultName,
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
    setState((current) => beginBackgroundPreparation(current, token));
    void prepareCrop();
  }, [prepareCrop, saving, source]);

  const saveTemplate = useCallback(async () => {
    const imagePath = state.pendingPath;
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
      setState(createBackgroundManagerState(imagePath));
      setStep("idle");
      await onSaved(uid, templateName);
    } catch (error) {
      Logger.error(LOG_SCOPE, "background template write failed", error);
      setState((current) => ({
        ...current,
        error: "Couldn't save your changes. Nothing was applied. Try again.",
      }));
    } finally {
      setSaving(false);
    }
  }, [onSaved, saving, state.pendingPath, templateName]);

  /**
   * The one guarded exit (crop Back/Cancel, the host sheet's scrim and system
   * Back): nothing pending → `close()` at once; work pending → the shared
   * themed "Discard changes?" (38.9 D-13, D-52), and on Discard the pending
   * file is deleted (ADR-112), the draft dropped, then `close()`.
   */
  const requestCancel = useCallback((close: () => void) => {
    if (requestBackgroundManagerDismissal(stateRef.current).kind === "close") {
      close();
      return;
    }
    void confirmDiscard().then((discard) => {
      if (!discard) return;
      const latest = stateRef.current;
      if (latest.pendingPath) deleteBackgroundDerivative(latest.pendingPath);
      activeTokenRef.current = null;
      setState(cancelBackgroundPreparation(latest));
      setSource(null);
      setStep("idle");
      close();
    });
  }, []);

  /** A fresh visit: drops any clean draft view (never a pending file). */
  const reset = useCallback(() => {
    activeTokenRef.current = null;
    setState((current) => cancelBackgroundPreparation(current));
    setStep("idle");
    setSource(null);
    setTemplateName("");
    setCropStatus("");
    setFineTuneOpen(false);
  }, []);

  /** Shows a host-side failure on the flow's error line. */
  const setError = useCallback((message: string) => {
    setState((current) => ({ ...current, error: message }));
  }, []);

  return {
    step,
    state,
    dirty: state.dirty,
    saving,
    source,
    cropSpace,
    setCropSpace,
    cropStatus,
    fineTuneOpen,
    setFineTuneOpen,
    templateName,
    setTemplateName,
    gesture: Gesture.Simultaneous(pan, pinch),
    sourceImageStyle,
    selectionStyle,
    maskTopStyle,
    maskBottomStyle,
    maskLeftStyle,
    maskRightStyle,
    resetCrop,
    zoomCrop,
    nudgeCrop,
    chooseImage,
    prepareCrop,
    retryCrop,
    saveTemplate,
    requestCancel,
    reset,
    setError,
  };
}

export type ProfileBackgroundCreateFlowController = ReturnType<
  typeof useProfileBackgroundCreateFlow
>;

/** A sheet header: the 38.9 icon-only chevron Back, then the title (D-43, D-44). */
export function ProfileBackgroundFlowHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Button
        role="iconOnly"
        icon="back"
        accessibilityLabel="Back"
        onPress={onBack}
      />
      <AppText role="heading" style={styles.headerTitle}>
        {title}
      </AppText>
    </View>
  );
}

export interface ProfileBackgroundCreateFlowProps {
  flow: ProfileBackgroundCreateFlowController;
  /** The guarded exit; hosts pass a call to `flow.requestCancel`. */
  onCancel: () => void;
  /**
   * When the flow is the whole sheet (the Settings page), the name step draws
   * its own header and error line. The Profile sheet draws its own header
   * around the name step, so it leaves this off.
   */
  standalone?: boolean;
}

/** Renders the crop or name step; nothing while the flow is idle. */
export function ProfileBackgroundCreateFlow({
  flow,
  onCancel,
  standalone = false,
}: ProfileBackgroundCreateFlowProps) {
  const { colors } = useTheme();
  const { source, cropSpace } = flow;

  if (flow.step === "crop" && source) {
    return (
      <View style={styles.cropEditor}>
        <GlassSurface density="dense" style={styles.cropTopOverlay}>
          <ProfileBackgroundFlowHeader
            title="Crop background"
            onBack={onCancel}
          />
          <AppText role="body">
            Drag to reposition. Pinch or use the controls to zoom.
          </AppText>
        </GlassSurface>
        <View
          style={styles.cropPreviewSpace}
          onLayout={({ nativeEvent }) => {
            const { width, height } = nativeEvent.layout;
            flow.setCropSpace((current) =>
              current?.width === width && current.height === height
                ? current
                : { width, height },
            );
          }}
        >
          {cropSpace ? (
            <View
              style={[
                styles.cropViewport,
                { height: cropSpace.height, width: "100%" },
              ]}
            >
              <GestureDetector gesture={flow.gesture}>
                <Animated.View style={styles.cropTouchSurface}>
                  <Animated.Image
                    source={{ uri: source.uri }}
                    style={[styles.containedSource, flow.sourceImageStyle]}
                    resizeMode="stretch"
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.cropMask,
                      styles.cropMaskTop,
                      { backgroundColor: colors.background },
                      flow.maskTopStyle,
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.cropMask,
                      styles.cropMaskBottom,
                      { backgroundColor: colors.background },
                      flow.maskBottomStyle,
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.cropMask,
                      styles.cropMaskLeft,
                      { backgroundColor: colors.background },
                      flow.maskLeftStyle,
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.cropMask,
                      styles.cropMaskRight,
                      { backgroundColor: colors.background },
                      flow.maskRightStyle,
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.cropSelection,
                      { borderColor: colors.accent },
                      flow.selectionStyle,
                    ]}
                  />
                </Animated.View>
              </GestureDetector>
            </View>
          ) : null}
        </View>
        <GlassSurface density="dense" style={styles.cropBottomOverlay}>
          {flow.state.error ? (
            <ScopedPalette>
              {(scoped) => (
                <AppText style={{ color: scoped.danger }}>
                  {flow.state.error}
                </AppText>
              )}
            </ScopedPalette>
          ) : null}
          <AppText accessibilityLiveRegion="polite" role="body">
            {flow.cropStatus}
          </AppText>
          {flow.fineTuneOpen ? (
            <View style={styles.fineTuneControls}>
              <Button
                role="tertiary"
                label="Reset"
                accessibilityLabel="Reset crop"
                onPress={flow.resetCrop}
              />
              <Button
                role="tertiary"
                label="Zoom in"
                accessibilityLabel="Zoom in"
                onPress={() => flow.zoomCrop(1.15)}
              />
              <Button
                role="tertiary"
                label="Zoom out"
                accessibilityLabel="Zoom out"
                onPress={() => flow.zoomCrop(1 / 1.15)}
              />
              <Button
                role="tertiary"
                label="Move left"
                accessibilityLabel="Move left"
                onPress={() => flow.nudgeCrop(-24, 0)}
              />
              <Button
                role="tertiary"
                label="Move right"
                accessibilityLabel="Move right"
                onPress={() => flow.nudgeCrop(24, 0)}
              />
              <Button
                role="tertiary"
                label="Move up"
                accessibilityLabel="Move up"
                onPress={() => flow.nudgeCrop(0, -24)}
              />
              <Button
                role="tertiary"
                label="Move down"
                accessibilityLabel="Move down"
                onPress={() => flow.nudgeCrop(0, 24)}
              />
            </View>
          ) : null}
          <View style={styles.cropActions}>
            <Button role="secondary" label="Cancel" onPress={onCancel} />
            <Button
              role="tertiary"
              label="Fine tune"
              onPress={() => flow.setFineTuneOpen((open) => !open)}
            />
            {flow.state.error ? (
              <Button
                role="secondary"
                label="Retry"
                disabled={flow.saving}
                onPress={flow.retryCrop}
              />
            ) : null}
            <Button
              role="primary"
              label={flow.saving ? "Preparing…" : "Use background"}
              disabled={flow.saving}
              onPress={() => void flow.prepareCrop()}
            />
          </View>
        </GlassSurface>
      </View>
    );
  }

  if (flow.step === "name") {
    return (
      <>
        {standalone ? (
          <>
            <ProfileBackgroundFlowHeader
              title="Name background"
              onBack={onCancel}
            />
            {flow.state.error ? (
              <AppText style={{ color: colors.danger }}>
                {flow.state.error}
              </AppText>
            ) : null}
          </>
        ) : null}
        <ScrollView
          style={styles.workspace}
          contentContainerStyle={styles.content}
        >
          <AppText role="body">Name this reusable background template.</AppText>
          <TextInput
            accessibilityLabel="Background template name"
            value={flow.templateName}
            onChangeText={flow.setTemplateName}
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
            label={flow.saving ? "Saving…" : "Save background template"}
            disabled={flow.saving || !flow.templateName.trim()}
            onPress={() => void flow.saveTemplate()}
          />
        </ScrollView>
      </>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  headerTitle: { flex: 1 },
  workspace: { flex: 1 },
  content: { gap: SPACING.sm, paddingBottom: SPACING.xl },
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
