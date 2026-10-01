/**
 * CropPhotoScreen (PHOTO-01) — the repo's FIRST Skia render-loop surface.
 *
 * A focused modal that frames the picked/downloaded raw image in a fixed 1:1
 * square viewport (pan + pinch, NO rotation — 05-UI-SPEC), then on "Use photo"
 * computes the source-pixel crop rect via the PURE `crop-geometry` and runs the
 * Plan 04 pipeline (`persistCroppedMaster`), dispatching by target kind:
 *   - contact  → `setContactPhoto`
 *   - profile  → `setProfilePhoto`
 *   (the display revision is published by the ownership layer's persist —
 *   `notifyPhotoBytesChanged` in owned-master, 38.6 D-01 — not by this screen)
 *   - customField → persist the file ONLY (the awaiting widget learns of success
 *     via a Plan-08 `photo-result-store` publish keyed on `route.params.requestId`
 *     — that store does not exist in this wave, so here the branch just persists
 *     and the serializable `requestId` is carried through the route untouched).
 * Every branch then `goBack()`s; mounted avatars already refreshed from the
 * display revision the owned persist published for the canonical path.
 *
 * RENDER-LOOP RULE (CLAUDE.md, non-negotiable): the pan/zoom transform is driven
 * ONLY by Reanimated SHARED VALUES, read into Skia via `useDerivedValue`. React
 * state/effects are used solely for the ONE-TIME geometry init (allowed) — never
 * per-frame. Gestures run as UI-thread worklets. It is a focused modal with no
 * ambient/looping animation, so the pause-on-blur / AppState-background rule is
 * satisfied by construction.
 *
 * GEOMETRY INIT (once, when the decoded image + measured viewport are both ready):
 * read the decoded image's intrinsic dims (`image.width()/height()` → srcW/srcH),
 * take the square viewport side (`cropLayout`), compute
 * `baseScale = viewport / min(srcW, srcH)` (cover scale at scale=1) and seed
 * `scale=1 / tx=0 / ty=0`. These inputs are handed verbatim to
 * `cropRectFromTransform` at confirm with the LIVE shared-value reads — the exact
 * contract `crop-geometry.ts` documents (addresses [codex/HIGH 05-04+05-05]).
 *
 * MEASURED SPACE (38.6 review WR5-02): the canvas sits in a shrinkable slot
 * whose measured height caps it, so the Cancel / Use photo footer stays on
 * screen when the in-flow assist banner (D-38) or a short phone takes height
 * away. If the square's side changes after init (the banner came or went), the
 * pan is scaled by the same ratio: every screen-space quantity scales with the
 * viewport, so the crop rect in source pixels is unchanged.
 *
 * A very large source that never decodes is downscaled ONCE via the manipulator
 * (05-RESEARCH A4); the SAME (possibly-downscaled) URI feeds BOTH the preview
 * geometry AND the pipeline crop, so the crop-rect coordinate space always
 * matches the image being cropped.
 *
 * Every Skia draw colour resolves through `useTheme().colors.*` (check:colors
 * applies inside Skia calls) — background, a `surface`-derived dim mask, and a
 * `borderStrong` frame outline.
 */
import {
  Canvas,
  Fill,
  Group,
  Rect,
  Image as SkiaImage,
  useImage,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import {
  getContactPhotoIdentity,
  setContactPhotoForUid,
} from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { setProfilePhoto } from "@/db/profile-dao";
import type { RootStackScreenProps } from "@/navigation/types";
import { cropRectFromTransform } from "@/services/photos/crop-geometry";
import { discardDerivative } from "@/services/photos/derivative-cache";
import { renderPreviewDownscale } from "@/services/photos/manipulator-derivatives";
import { withCanonicalPathLock } from "@/services/photos/owned-master";
import {
  PhotoPipelineError,
  persistCroppedMaster,
} from "@/services/photos/photo-pipeline";
import { relPathForTarget } from "@/services/photos/photo-storage";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { publishCropResult } from "@/stores/photo-result-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { cropLayout, cropNaturalHeight } from "./crop-photo-layout";

const LOG_SCOPE = "crop-photo";

/** Max pinch zoom (scale=1 is cover; the image always covers the square). */
const MAX_SCALE = 8;
/** Dim opacity over the region outside the crop square (surface-derived). */
const MASK_OPACITY = 0.6;
/** Crop-frame outline stroke width. */
const FRAME_STROKE = 2;
/** If the source has not decoded within this window, downscale once (A4). */
const DECODE_FALLBACK_MS = 2500;
/** Max edge for the decode-failure downscale fallback. */
const DOWNSCALE_MAX_EDGE = 2048;

/** The static geometry captured at one-time init, read by the confirm handler. */
interface CropGeom {
  viewport: number;
  srcW: number;
  srcH: number;
  baseScale: number;
}

export function CropPhotoScreen({
  navigation,
  route,
}: RootStackScreenProps<"CropPhoto">) {
  const { colors } = useTheme();
  const { rawUri, target } = route.params;
  const { width: screenW } = useWindowDimensions();

  // The square viewport side + its placement in the canvas. Before the canvas
  // slot is measured it is the natural layout from the screen width; after,
  // the measured slot caps the canvas height (review WR5-02).
  const [canvasSlot, setCanvasSlot] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const { viewport, squareX, squareY, canvasW, canvasH } = cropLayout(
    canvasSlot?.width ?? screenW,
    canvasSlot?.height ?? null,
  );
  const naturalCanvasH = cropNaturalHeight(canvasSlot?.width ?? screenW);

  // The image URI actually decoded + cropped. Starts as the raw source; swapped
  // for a downscaled copy ONLY if the raw source fails to decode (A4). Keeping
  // preview + crop on the SAME uri keeps the crop-rect coordinate space matched.
  const [sourceUri, setSourceUri] = useState(rawUri);
  const fallbackUriRef = useRef<string | null>(null);
  useEffect(() => {
    setSourceUri(rawUri);
    setDownscaleTried(false);
    return () => {
      if (fallbackUriRef.current) discardDerivative(fallbackUriRef.current);
      fallbackUriRef.current = null;
    };
  }, [rawUri]);
  const [downscaleTried, setDownscaleTried] = useState(false);
  const image = useImage(sourceUri);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  // Live gesture transform — SHARED VALUES ONLY (never React state per frame).
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // Geometry mirrored into shared values so the UI-thread gesture worklets can
  // clamp against the source/viewport without touching React state.
  const svViewport = useSharedValue(viewport);
  const svBaseScale = useSharedValue(1);
  const svSrcW = useSharedValue(0);
  const svSrcH = useSharedValue(0);
  // Gesture start snapshots.
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const startScale = useSharedValue(1);

  // Static geometry for the (JS-thread) confirm handler + a one-time-init guard.
  const geomRef = useRef<CropGeom | null>(null);
  const initedRef = useRef(false);

  // ONE-TIME geometry init: fires exactly once when the image + viewport are both
  // ready. React state/effects for one-time init is allowed (CLAUDE.md); only
  // per-frame gesture updates must stay on shared values.
  useEffect(() => {
    if (initedRef.current) {
      // Review WR5-02: the measured space changed the square after init. Scale
      // the pan with it so the same part of the photo stays framed.
      const previous = geomRef.current;
      if (!previous || viewport <= 1 || previous.viewport === viewport) return;
      const ratio = viewport / previous.viewport;
      const baseScale = viewport / Math.min(previous.srcW, previous.srcH);
      geomRef.current = { ...previous, viewport, baseScale };
      svViewport.value = viewport;
      svBaseScale.value = baseScale;
      tx.value = tx.value * ratio;
      ty.value = ty.value * ratio;
      return;
    }
    if (!image || viewport <= 1) {
      return;
    }
    const srcW = image.width();
    const srcH = image.height();
    if (srcW <= 0 || srcH <= 0) {
      return;
    }
    const baseScale = viewport / Math.min(srcW, srcH);
    geomRef.current = { viewport, srcW, srcH, baseScale };
    svViewport.value = viewport;
    svBaseScale.value = baseScale;
    svSrcW.value = srcW;
    svSrcH.value = srcH;
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
    initedRef.current = true;
    setReady(true);
  }, [image, viewport, scale, tx, ty, svViewport, svBaseScale, svSrcW, svSrcH]);

  // Decode-failure fallback (A4): if the raw source has not decoded within the
  // window, downscale it ONCE and retry the preview on the smaller copy. The
  // effect re-runs (and clears the timer) the moment `image` resolves, so a
  // normally-decoding source never triggers this.
  useEffect(() => {
    if (image || downscaleTried) {
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          // Releases the rendered image and its context (D-11, review WR-02).
          const uri = await renderPreviewDownscale(rawUri, DOWNSCALE_MAX_EDGE);
          if (!active) {
            discardDerivative(uri);
          } else {
            if (fallbackUriRef.current)
              discardDerivative(fallbackUriRef.current);
            fallbackUriRef.current = uri;
            setSourceUri(uri);
          }
        } catch (err) {
          Logger.error(LOG_SCOPE, `decode-fallback downscale failed`, err);
        } finally {
          if (active) setDownscaleTried(true);
        }
      })();
    }, DECODE_FALLBACK_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [image, downscaleTried, rawUri]);

  // Skia transform: scale about the square centre, then apply the pan (screen px).
  // screen = translate(centre*(1-scale) + pan) ∘ scale(q). Matches the
  // centre-origin convention crop-geometry documents (positive tx → image right).
  const transform = useDerivedValue(() => {
    const s = scale.value;
    const centre = svViewport.value / 2;
    return [
      { translateX: centre * (1 - s) + tx.value },
      { translateY: centre * (1 - s) + ty.value },
      { scale: s },
    ];
  });

  const pan = Gesture.Pan()
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      const s = scale.value;
      const ws = svSrcW.value * svBaseScale.value * s;
      const hs = svSrcH.value * svBaseScale.value * s;
      const maxTx = Math.max(0, (ws - svViewport.value) / 2);
      const maxTy = Math.max(0, (hs - svViewport.value) / 2);
      const nx = startTx.value + e.translationX;
      const ny = startTy.value + e.translationY;
      tx.value = Math.max(-maxTx, Math.min(nx, maxTx));
      ty.value = Math.max(-maxTy, Math.min(ny, maxTy));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const s = Math.max(1, Math.min(startScale.value * e.scale, MAX_SCALE));
      scale.value = s;
      // Re-clamp pan for the new scale so the image keeps covering the square.
      const ws = svSrcW.value * svBaseScale.value * s;
      const hs = svSrcH.value * svBaseScale.value * s;
      const maxTx = Math.max(0, (ws - svViewport.value) / 2);
      const maxTy = Math.max(0, (hs - svViewport.value) / 2);
      tx.value = Math.max(-maxTx, Math.min(tx.value, maxTx));
      ty.value = Math.max(-maxTy, Math.min(ty.value, maxTy));
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  // The cover-scaled image size for THIS render's viewport (not the ref's
  // last value), so a re-measured square draws at its new size at once.
  const drawGeom = geomRef.current;
  const drawScale = drawGeom
    ? viewport / Math.min(drawGeom.srcW, drawGeom.srcH)
    : 0;
  const drawW = drawGeom ? drawGeom.srcW * drawScale : 0;
  const drawH = drawGeom ? drawGeom.srcH * drawScale : 0;

  const onCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const onUse = useCallback(async () => {
    const geom = geomRef.current;
    if (!ready || !geom || busy) {
      return;
    }
    setBusy(true);
    try {
      const cropRect = cropRectFromTransform({
        viewport: geom.viewport,
        srcW: geom.srcW,
        srcH: geom.srcH,
        baseScale: geom.baseScale,
        scale: scale.value,
        tx: tx.value,
        ty: ty.value,
      });
      // Crop the SAME uri the preview decoded (rawUri, or the A4 downscale).
      const exec = getExecutor();
      const capturedUid = route.params.contactUid;
      if (target.kind !== "profile" && !capturedUid)
        throw new Error("contact photo target missing");
      await withCanonicalPathLock(
        relPathForTarget(target),
        async (lockToken) => {
          const relative = await persistCroppedMaster({
            exec,
            lockToken,
            authorize:
              target.kind === "profile"
                ? undefined
                : async (lockedExec) =>
                    (await getContactPhotoIdentity(
                      lockedExec,
                      target.contactId,
                    )) === capturedUid,
            rawUri: sourceUri,
            cropRect,
            target,
          });

          const now = localDateTime();
          if (target.kind === "contact" && capturedUid) {
            await setContactPhotoForUid(
              exec,
              target.contactId,
              capturedUid,
              relative,
              now,
            );
            // A contact photo is widget-visible (the tile avatar). Profile/customField
            // photos are NOT, so this publish lives inside the contact branch only.
            notifyWidgetDataChanged();
          } else if (target.kind === "profile") {
            await setProfilePhoto(exec, relative, now);
          } else if (target.kind === "customField" && route.params.requestId) {
            // customField: the master is already persisted at its derivable cv- path;
            // no DB write here (the field value is set through the edit form's Save).
            // Publish the crop-success on the serializable requestId (the cv- relPath)
            // so the awaiting widget sets its value on focus. The display revision
            // for that same cv- path was already published by the owned persist.
            publishCropResult(route.params.requestId, true);
          }
        },
      );
      navigation.goBack();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to save cropped photo", err);
      const message =
        err instanceof PhotoPipelineError
          ? "That image couldn't be used. Try a JPEG or PNG."
          : "Couldn't save the photo. Please try again.";
      Alert.alert(message);
    } finally {
      setBusy(false);
    }
  }, [
    ready,
    busy,
    sourceUri,
    target,
    navigation,
    scale,
    tx,
    ty,
    route.params.requestId,
    route.params.contactUid,
  ]);

  return (
    <View testID="crop-photo-screen" style={styles.root}>
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Position photo
        </Text>
      </View>

      {/* Shrinkable slot (review WR5-02): its natural size is the original
          fixed canvas, and it gives up height before the footer does. */}
      <View
        testID="crop-photo-canvas-slot"
        style={[styles.canvasSlot, { flexBasis: naturalCanvasH }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setCanvasSlot((previous) =>
            previous?.width === width && previous.height === height
              ? previous
              : { width, height },
          );
        }}
      >
        <GestureDetector gesture={gesture}>
          <Canvas
            testID="crop-photo-canvas"
            style={{ width: canvasW, height: canvasH }}
          >
            <Fill color={colors.background} />

            {ready && image && drawGeom ? (
              <Group
                transform={[{ translateX: squareX }, { translateY: squareY }]}
              >
                <Group transform={transform}>
                  <SkiaImage
                    image={image}
                    x={(viewport - drawW) / 2}
                    y={(viewport - drawH) / 2}
                    width={drawW}
                    height={drawH}
                    fit="fill"
                  />
                </Group>
              </Group>
            ) : null}

            {/* Dim mask over the region OUTSIDE the crop square (surface-derived). */}
            <Group opacity={MASK_OPACITY}>
              <Rect
                x={0}
                y={0}
                width={canvasW}
                height={squareY}
                color={colors.surface}
              />
              <Rect
                x={0}
                y={squareY + viewport}
                width={canvasW}
                height={canvasH - (squareY + viewport)}
                color={colors.surface}
              />
              <Rect
                x={0}
                y={squareY}
                width={squareX}
                height={viewport}
                color={colors.surface}
              />
              <Rect
                x={squareX + viewport}
                y={squareY}
                width={canvasW - (squareX + viewport)}
                height={viewport}
                color={colors.surface}
              />
            </Group>

            {/* Fixed centred square crop frame. */}
            <Rect
              x={squareX}
              y={squareY}
              width={viewport}
              height={viewport}
              style="stroke"
              strokeWidth={FRAME_STROKE}
              color={colors.borderStrong}
            />
          </Canvas>
        </GestureDetector>
      </View>

      {!image && downscaleTried ? (
        // Neither the source nor its one-time downscale decoded: say so instead
        // of leaving "Use photo" silently disabled with an empty viewport.
        <Text
          testID="crop-photo-undecodable"
          accessibilityRole="alert"
          style={[styles.undecodable, { color: colors.textSecondary }]}
        >
          That image couldn't be used. Try a JPEG or PNG.
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Pressable
          testID="crop-photo-cancel"
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          style={styles.cancelBtn}
        >
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
            Cancel
          </Text>
        </Pressable>

        <Pressable
          testID="crop-photo-use"
          accessibilityRole="button"
          accessibilityLabel="Use photo"
          accessibilityState={{ disabled: !ready || busy }}
          disabled={!ready || busy}
          onPress={() => void onUse()}
          style={[
            styles.useBtn,
            {
              backgroundColor: ready && !busy ? colors.accent : colors.surface,
              borderColor: ready && !busy ? colors.accent : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.useText,
              {
                color: ready && !busy ? colors.onAccent : colors.textSecondary,
              },
            ]}
          >
            Use photo
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  canvasSlot: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  header: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  undecodable: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 12,
  },
  cancelBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  useBtn: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 24,
  },
  useText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
