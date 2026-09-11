/**
 * ChromeScrim (31.1-05) — a LOCAL readability backing for bare-on-background
 * "chrome" text (app bar title/back, the dashboard count, section headings,
 * empty states) that does NOT sit on a `GlassSurface` card.
 *
 * With the shell `BackgroundHost` veil lightened so the selected background is
 * visibly present (D-31.1-05-A), this chrome would otherwise sit on raw art. This
 * primitive draws an absolute-fill `colors.surface` tint at `chromeScrimOpacity`
 * behind its children, so the text stays AA-readable independent of the veil —
 * the readability half of the owner-approved "lighten wash + protect chrome".
 *
 * TOKEN-ONLY (check:colors `/theme/` exemption is not an escape hatch): the tint
 * colour is the `surface` palette token read via `useTheme()`, and the opacity is
 * the declared `chromeScrimOpacity(package)` — no colour/opacity literal here. The
 * per-asset AA of that opacity is proven in `surface.test.ts`.
 *
 * Cards do NOT use this — they already back their own text via `GlassSurface`.
 */
import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { chromeScrimOpacity } from "@/theme/tokens/surface";

export interface ChromeScrimProps {
  children?: ReactNode;
  /** Layout style (padding/margins/alignment/border-radius) — never colour. */
  style?: StyleProp<ViewStyle>;
  /** Rounds the scrim backing to match a padded pill/panel. */
  radius?: number;
}

export function ChromeScrim({ children, style, radius }: ChromeScrimProps) {
  const { colors, mode, package: themePackage } = useTheme();
  const opacity = chromeScrimOpacity(themePackage, mode);
  return (
    <View style={style}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.surface, opacity },
          radius !== undefined ? { borderRadius: radius } : null,
        ]}
      />
      {children}
    </View>
  );
}
