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
 * Hook order: the component stays mounted while `photo` flips between null and
 * a path, so every hook runs unconditionally above the single null return.
 */
import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  Modal as RNModal,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icons/Icon";
import { usePhotoDisplay } from "@/components/photo-display";
import {
  LIGHTBOX_CLOSE_BACKING_OPACITY,
  LIGHTBOX_SCRIM_OPACITY,
} from "@/components/photo-lightbox-logic";
import { UnscopedTheme, useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

/** Minimum ✕ touch box (D-16: ≥48). */
const CLOSE_TARGET = 48;

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
  const closeRef = useRef<View>(null);

  // TalkBack focus lands on the ✕ when the lightbox opens (overlay-base idiom).
  useEffect(() => {
    if (!visible) return;
    const handle = findNodeHandle(closeRef.current);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [visible]);

  if (photo == null || display == null) return null;

  const side = Math.min(width, height);

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
            <View
              testID="photo-lightbox-scrim"
              style={[
                StyleSheet.absoluteFill,
                styles.scrim,
                { backgroundColor: colors.background },
              ]}
            />
            <View style={styles.stage}>
              <Image
                source={display.source}
                cachePolicy={display.cachePolicy}
                contentFit="contain"
                accessibilityLabel={`Photo of ${name}`}
                style={{ width: side, height: side }}
              />
            </View>
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
  scrim: { opacity: LIGHTBOX_SCRIM_OPACITY },
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
