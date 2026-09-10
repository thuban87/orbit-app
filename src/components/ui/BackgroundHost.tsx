/**
 * BackgroundHost (THEME-04 / D-04) — the fixed-behind-scroll background host.
 *
 * Renders the active package's resolved background FIXED behind scrollable content
 * (it never scrolls with the content), with a density-driven surface scrim so dense
 * screens stay readable (presentation screens show more background; dense forms use a
 * more opaque scrim — readability wins). Per D-04 this applies app-wide behind
 * text-heavy screens too (supersedes HANDOFF §7's dashboard/orrery-only scope;
 * ADR-048 tap-to-freeze / creeping motion stays superseded — NOT reinstated).
 *
 * ADOPTION IS DEFERRED (REVIEWS scope note): this plan delivers the PRIMITIVE +
 * behaviors (fixed-behind-scroll, density scrim, render-failure fallback). Mounting
 * it at the app-shell root across existing screens is a renderer/Phase-15 task; the
 * Appearance settings UI that drives the stored slot is Phase 37. The in-scope mount
 * point for this plan's device-UATs is the dev-only `ThemePreviewScreen`.
 *
 * RENDER-FAILURE FALLBACK (REVIEWS 23-06 MEDIUM/LOW): asset PRESENCE is guaranteed at
 * bundle time (every slot resolves to a real `require()`); the runtime fallback
 * catches an image RENDER failure (`Image` `onError`, decode error, null image) — NOT
 * a bundle-missing module (which fails at Metro resolution, not recoverably at
 * runtime). The `onError` handler flips a boolean into the node-tested pure reducer
 * `resolveRenderableBackground(package, slotId, renderFailed)`, so the effective
 * background silently becomes None/Solid — the fallback branch is unit-tested, not
 * untested inline component logic.
 *
 * Backgrounds are STATIC bundled assets, so this host ships NO animation worklet
 * (REVIEWS 23-06 MEDIUM animated-background contract: only an animating Galaxy
 * background would add a reduced-motion-gated Skia/Reanimated worklet).
 *
 * All colour resolves through `useTheme()`/surface tokens — no colour literal.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import { useThemeStore } from "@/stores/theme-store";
import { useTheme } from "@/theme";
import {
  type ResolvedBackground,
  resolveRenderableBackground,
} from "@/theme/backgrounds";
import type { BackgroundSlotId } from "@/theme/theme-option-ids";
import type { ThemePackage } from "@/theme/theme-types";
import {
  type SurfaceDensity,
  surfaceOpacityForDensity,
} from "@/theme/tokens/surface";
import { backgroundHostSelection } from "./background-host-model";

export interface BackgroundHostProps {
  children?: ReactNode;
  /**
   * Content density — a denser region gets a MORE opaque scrim so text stays
   * readable over the background. Defaults to `presentation` (most background
   * shows); a dense form passes `dense`.
   */
  density?: SurfaceDensity;
  /**
   * Package override (dev harness). Production callers omit it and the active
   * package from `useTheme()` is used.
   */
  themePackage?: ThemePackage;
  /**
   * Stored slot-id override (dev harness). `undefined` = read the active package's
   * stored background from the theme store; an explicit value (incl. `null` for the
   * package default, or `'none'`) forces a slot.
   */
  slotId?: BackgroundSlotId | null;
  /**
   * DEV-only: force the render-failure fallback (the `ThemePreviewScreen` toggle
   * that exercises `onError -> None/Solid` on device without deleting an asset).
   */
  forceRenderError?: boolean;
  /**
   * An already-resolved derivative in app-owned document storage. Remote URIs
   * are deliberately rejected so a Profile background cannot create a network
   * read path.
   */
  appOwnedBackgroundUri?: string | null;
  /** Profile uses its dedicated readability token; all other hosts use SURFACE. */
  readability?: "default" | "profile";
}

export function BackgroundHost({
  children,
  density = "presentation",
  themePackage,
  slotId,
  forceRenderError = false,
  appOwnedBackgroundUri = null,
  readability = "default",
}: BackgroundHostProps) {
  const { colors, package: activePackage } = useTheme();
  const { height: viewportHeight, width: viewportWidth } =
    useWindowDimensions();
  const storeGalaxy = useThemeStore((s) => s.galaxyBackground);
  const storeStandard = useThemeStore((s) => s.standardBackground);

  const pkg = themePackage ?? activePackage;
  const storedSlot = pkg === "galaxy" ? storeGalaxy : storeStandard;
  // An explicit prop (including null) overrides the stored slot; undefined defers.
  const effectiveSlot = slotId === undefined ? storedSlot : slotId;

  // Latch a render failure, resetting whenever the selection changes so a new
  // (valid) slot gets a fresh render attempt rather than staying stuck on the
  // fallback. Uses React's render-phase reset idiom (no effect, no extra frame).
  const [renderFailed, setRenderFailed] = useState(false);
  const { localUri, selectionKey } = backgroundHostSelection({
    package: pkg,
    slotId: effectiveSlot,
    appOwnedBackgroundUri,
    forceRenderError,
    renderFailed,
  });
  const [prevKey, setPrevKey] = useState(selectionKey);
  if (selectionKey !== prevKey) {
    setPrevKey(selectionKey);
    setRenderFailed(false);
  }

  const resolved: ResolvedBackground = resolveRenderableBackground(
    pkg,
    effectiveSlot,
    forceRenderError || renderFailed,
  );

  // Density scrim opacity is token-sourced (surface.ts) — denser -> more opaque.
  const scrimOpacity = surfaceOpacityForDensity(pkg, density);
  const scrimStyle =
    readability === "profile"
      ? { backgroundColor: colors.profileBackgroundScrim }
      : { backgroundColor: colors.surface, opacity: scrimOpacity };
  const imageSource = localUri
    ? { uri: localUri }
    : resolved.kind === "asset"
      ? resolved.source()
      : null;

  return (
    <View style={styles.root}>
      {/* Fixed background layer — absolute fill BEHIND the scrollable content, so it
          never scrolls with it (THEME-04). */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {imageSource ? (
          <Image
            source={imageSource}
            style={[
              StyleSheet.absoluteFill,
              { height: viewportHeight, width: viewportWidth },
            ]}
            resizeMode="cover"
            // A RENDER failure (decode/null image) silently degrades to None/Solid
            // via the node-tested reducer — no user-facing error.
            onError={() => setRenderFailed(true)}
          />
        ) : (
          // None/Solid: the plain themed background colour.
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.background },
            ]}
          />
        )}
        {/* Density scrim — the surface tint at the density opacity keeps content
            readable. For None/Solid this simply deepens the solid background. */}
        <View style={[StyleSheet.absoluteFill, scrimStyle]} />
      </View>
      {/* Scrollable content sits above the fixed background. */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative",
  },
  content: {
    flex: 1,
  },
});
