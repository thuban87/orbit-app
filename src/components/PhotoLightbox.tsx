/**
 * PhotoLightbox (38.6 D-03/D-15/D-16) — a reusable full-screen view of one
 * contact photo. Today it opens only from the Profile photo (D-15).
 *
 * Shell mirrors `BaseOverlay`'s lifecycle contract (overlay-base.tsx) without
 * its Pressable scrim: an RN `Modal` whose `onRequestClose` is hardware Back,
 * its own `GestureHandlerRootView` (an Android Modal is a separate native
 * root), `UnscopedTheme`, and accessibility focus moved to the ✕ on open.
 *
 * The image is the local canonical photo through the shared display source
 * (`usePhotoDisplay`), so a just-changed photo is current. It never resolves a
 * plain photo URI (photo-writer-contract.test.ts) and has no network path.
 *
 * Gestures (D-16) run as UI-thread worklets on Reanimated shared values — no
 * React state changes while a gesture runs. Pinch zooms about the focal point
 * (1× to LIGHTBOX_MAX_ZOOM), double-tap toggles 1× ↔ LIGHTBOX_DOUBLE_TAP_SCALE
 * about the tap point, one-finger pan moves the image only while zoomed
 * (clamped to its edges), and a downward drag at 1× fades the scrim and closes
 * past the distance/velocity threshold. The math is in photo-lightbox-logic.ts.
 *
 * Hook order: the component stays mounted while `photo` flips between null and
 * a path, so every hook runs unconditionally above the single null return.
 */
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  Modal as RNModal,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons/Icon";
import { usePhotoDisplay } from "@/components/photo-display";
import {
  clampScale,
  clampTranslate,
  dismissProgress,
  doubleTapTarget,
  focalTranslate,
  isZoomed,
  LIGHTBOX_CLOSE_BACKING_OPACITY,
  lightboxScrimOpacity,
  shouldDismiss,
} from "@/components/photo-lightbox-logic";
import { UnscopedTheme, useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";

/** Minimum ✕ touch box (D-16: ≥48). */
const CLOSE_TARGET = 48;

/** Double-tap zoom and swipe-out duration (0 under reduced motion). */
const LIGHTBOX_ANIMATION_MS = 200;

export interface PhotoLightboxProps {
  visible: boolean;
  /** Canonical relative photo path, or null (renders nothing). */
  photo: string | null;
  /** Contact name for the image's accessible label. */
  name: string;
  onClose: () => void;
}

export function PhotoLightbox({
  visible,
  photo,
  name,
  onClose,
}: PhotoLightboxProps) {
  const display = usePhotoDisplay(photo);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const reducedMotion = useReducedMotionShared();
  const closeRef = useRef<View>(null);
  // WR-06: the photo failed to load — show the initials, never a blank scrim.
  const [failed, setFailed] = useState(false);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dismissY = useSharedValue(0);
  const startScale = useSharedValue(1);

  const side = Math.min(width, height);

  // Every open starts at 1×, centred, undismissed.
  useEffect(() => {
    if (!visible) return;
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
    dismissY.value = 0;
    startScale.value = 1;
  }, [visible, scale, tx, ty, dismissY, startScale]);

  // Each open, photo or display revision retries the image.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed on open+identity+revision
  useEffect(() => {
    setFailed(false);
  }, [visible, photo, display?.revision]);

  // TalkBack focus lands on the ✕ when the lightbox opens (overlay-base idiom).
  useEffect(() => {
    if (!visible) return;
    const handle = findNodeHandle(closeRef.current);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [visible]);

  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onStart(() => {
        "worklet";
        startScale.value = scale.value;
        dismissY.value = 0;
      })
      .onUpdate((e) => {
        "worklet";
        const next = clampScale(startScale.value * e.scale);
        const prev = scale.value;
        tx.value = clampTranslate(
          focalTranslate(tx.value, e.focalX - width / 2, prev, next),
          side,
          next,
          width,
        );
        ty.value = clampTranslate(
          focalTranslate(ty.value, e.focalY - height / 2, prev, next),
          side,
          next,
          height,
        );
        scale.value = next;
      });

    const pan = Gesture.Pan()
      .minDistance(8)
      .onChange((e) => {
        "worklet";
        const s = scale.value;
        if (isZoomed(s)) {
          tx.value = clampTranslate(tx.value + e.changeX, side, s, width);
          ty.value = clampTranslate(ty.value + e.changeY, side, s, height);
          return;
        }
        // At 1× a one-finger downward drag is the swipe-to-close.
        if (e.numberOfPointers === 1) {
          dismissY.value = Math.max(0, e.translationY);
        }
      })
      .onEnd((e) => {
        "worklet";
        if (dismissY.value <= 0) return;
        if (shouldDismiss(scale.value, dismissY.value, e.velocityY)) {
          dismissY.value = withTiming(height, {
            duration: reducedMotion.value ? 0 : LIGHTBOX_ANIMATION_MS,
          });
          runOnJS(onClose)();
          return;
        }
        dismissY.value = reducedMotion.value ? 0 : withSpring(0);
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e, success) => {
        "worklet";
        if (!success) return;
        const prev = scale.value;
        const next = doubleTapTarget(prev);
        const nextTx =
          next === 1
            ? 0
            : clampTranslate(
                focalTranslate(tx.value, e.x - width / 2, prev, next),
                side,
                next,
                width,
              );
        const nextTy =
          next === 1
            ? 0
            : clampTranslate(
                focalTranslate(ty.value, e.y - height / 2, prev, next),
                side,
                next,
                height,
              );
        const timing = {
          duration: reducedMotion.value ? 0 : LIGHTBOX_ANIMATION_MS,
        };
        scale.value = withTiming(next, timing);
        tx.value = withTiming(nextTx, timing);
        ty.value = withTiming(nextTy, timing);
      });

    return Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));
  }, [
    width,
    height,
    side,
    onClose,
    reducedMotion,
    scale,
    tx,
    ty,
    dismissY,
    startScale,
  ]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value + dismissY.value },
      { scale: scale.value },
    ],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: lightboxScrimOpacity(dismissProgress(dismissY.value)),
  }));

  if (photo == null || display == null) return null;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <UnscopedTheme>
          <View testID="photo-lightbox" style={styles.root}>
            <Animated.View
              testID="photo-lightbox-scrim"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
                scrimStyle,
              ]}
            />
            <GestureDetector gesture={gesture}>
              <View collapsable={false} style={styles.stage}>
                <Animated.View style={imageStyle}>
                  {failed ? (
                    <Avatar photo={null} name={name} size={side} />
                  ) : (
                    <Image
                      source={display.source}
                      cachePolicy={display.cachePolicy}
                      contentFit="contain"
                      accessibilityLabel={`Photo of ${name}`}
                      onError={() => setFailed(true)}
                      style={{ width: side, height: side }}
                    />
                  )}
                </Animated.View>
              </View>
            </GestureDetector>
            <Pressable
              ref={closeRef}
              accessibilityRole="button"
              accessibilityLabel="Close photo"
              onPress={onClose}
              style={[
                styles.close,
                {
                  top: insets.top + SPACING.sm,
                  right: insets.right + SPACING.sm,
                },
              ]}
            >
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.closeBacking,
                  { backgroundColor: colors.background },
                ]}
              />
              <Icon name="close" tone="textPrimary" />
            </Pressable>
          </View>
        </UnscopedTheme>
      </GestureHandlerRootView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  close: {
    position: "absolute",
    minWidth: CLOSE_TARGET,
    minHeight: CLOSE_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBacking: {
    borderRadius: CLOSE_TARGET / 2,
    opacity: LIGHTBOX_CLOSE_BACKING_OPACITY,
  },
});
