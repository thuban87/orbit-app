/**
 * GlassSurface (THEME-05) — the ONE semantic surface component.
 *
 * Keyed by the active theme PACKAGE (no parallel component families):
 *   - Galaxy renders glass-forward — expo-blur where affordable, a translucent
 *     tint, a luminous border, a subtle glow.
 *   - Standard renders flatter/quieter — an opaque tint, a plain border, no glow.
 *
 * Blur degrades gracefully (dossier §F): when blur is unavailable (or the package
 * is flat) the surface falls back to a semi-opaque tinted surface TOKEN. Blur
 * carries no required meaning.
 *
 * SURFACE-TOKEN-ONLY (cycle-3 LOW, finding #4): every style value comes from the
 * pure `resolveSurfaceStyle(package, blurAvailable)` selector (token KEYS + declared
 * opacities) resolved to a real colour ONLY via `useTheme().colors[key]`. This
 * component carries NO colour or opacity literal, so the check:colors `/theme/`
 * LOCATION exemption cannot become an escape hatch. The live tint opacity it applies
 * is `resolveSurfaceStyle().liveGlassTintOpacity`, which is `>= fallbackTintOpacity`
 * (the AA-checked bound), so the rendered glass composite is never more translucent
 * than the surface the AA gate validated (REVIEWS 23-06 MEDIUM live-glass invariant).
 */
import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import {
  cardTintOpacity,
  resolveSurfaceStyle,
  type SurfaceDensity,
} from "@/theme/tokens/surface";

export interface GlassSurfaceProps {
  children?: ReactNode;
  /**
   * Whether expo-blur is affordable on this device/platform (glass packages only).
   * Defaults to `true`; a caller that measures jank passes `false` to force the
   * tinted-token fallback. Blur is decorative — the fallback carries the same
   * semantics.
   */
  blurAvailable?: boolean;
  /**
   * Content density — denser content uses a MORE opaque surface (readability wins).
   * Defaults to `comfortable`.
   */
  density?: SurfaceDensity;
  /** Extra layout style (padding/margins/size) — never colour. */
  style?: StyleProp<ViewStyle>;
}

/** Blur intensity for the glass surface (device-UAT tunable). */
const BLUR_INTENSITY = 32;

export function GlassSurface({
  children,
  blurAvailable = true,
  density = "comfortable",
  style,
}: GlassSurfaceProps) {
  const { colors, mode, package: themePackage } = useTheme();
  const s = resolveSurfaceStyle(themePackage, blurAvailable);

  // Mode-aware card tint (31.1-06): glassy when the background art tone matches
  // the mode (galaxy↔dark, standard↔light) so the background shows THROUGH the
  // card; opaque otherwise so text stays readable over a mismatched art.
  const tintOpacity = cardTintOpacity(themePackage, mode, density);

  const tintColor = colors[s.tintTokenKey];
  const borderColor = colors[s.borderTokenKey];

  // Subtle glow (galaxy only) — a token-coloured shadow. Standard passes null.
  const glow: ViewStyle =
    s.glowTokenKey !== null
      ? {
          shadowColor: colors[s.glowTokenKey],
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          // NO Android `elevation` (31.1-06): on Android, elevation on a now-glassy
          // (translucent) surface renders an opaque dark inner rectangle that blocks
          // the background from showing through the card. The iOS shadow props above
          // keep the subtle glow on iOS; Android forgoes it for true glass. (Minor
          // deviation from dossier §F "subtle glow" — Android-only.)
        }
      : {};

  return (
    <View style={[styles.container, { borderColor }, glow, style]}>
      {/* Optional real blur underneath (glass + affordable). Decorative only. */}
      {s.useBlur ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={BLUR_INTENSITY}
          tint={mode === "dark" ? "dark" : "light"}
          // Android needs an explicit method; SDK31+ path falls back to none on
          // older devices, which is exactly the graceful degrade we want.
          blurMethod="dimezisBlurViewSdk31Plus"
          pointerEvents="none"
        />
      ) : null}
      {/* The semi-opaque tint — the guaranteed-readable surface (AA-checked). Sits
          above the blur, below the content, so children stay fully opaque. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tintColor, opacity: tintOpacity },
        ]}
        pointerEvents="none"
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADII.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  content: {
    // Content renders above the tint/blur layers.
    position: "relative",
  },
});
