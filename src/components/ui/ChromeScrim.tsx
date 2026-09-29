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
 *
 * GLASS FOREGROUND SCOPE (RG-029 / ui-accessibility/AUD-UIA-001 / D-24): the
 * children render inside `GlassForegroundScope`, so chrome text reads the
 * proof-validated glass palette (Standard Light over an asset resolves
 * `textSecondary` to `textPrimary`).
 *
 * ART TREATMENT OPT-IN (38.5-06 / D-08, D-28): only the Contacts "N contacts"
 * count label passes `artComponent`. Its backing then comes from the
 * per-combination table (`useArtTreatment`): `none` draws no backing and renders
 * its children WITHOUT the glass scope (D-10: text on the art takes the root,
 * art-suited palette); otherwise the backing draws at the table's opacity with
 * the children scoped as before. With no `artComponent` (every other use) the
 * tree is exactly today's.
 */
import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { GlassForegroundScope, useTheme } from "@/theme";
import { artScrimBacking } from "@/theme/art-treatments";
import { chromeScrimOpacity } from "@/theme/tokens/surface";
import { useArtTreatment } from "@/theme/use-art-treatment";

export interface ChromeScrimProps {
  children?: ReactNode;
  /** Layout style (padding/margins/alignment/border-radius) — never colour. */
  style?: StyleProp<ViewStyle>;
  /** Rounds the scrim backing to match a padded pill/panel. */
  radius?: number;
  /**
   * The v2-marked component this scrim backs (38.5-06). Only the Contacts count
   * label opts in; omitted, the scrim is exactly today's.
   */
  artComponent?: "contactsCountLabel";
}

export function ChromeScrim({
  children,
  style,
  radius,
  artComponent,
}: ChromeScrimProps) {
  const { colors, mode, package: themePackage } = useTheme();
  const treatment = useArtTreatment(artComponent);
  const { opacity, scoped } = artScrimBacking(
    treatment,
    chromeScrimOpacity(themePackage, mode),
  );
  return (
    <View style={style}>
      {opacity !== null ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.surface, opacity },
            radius !== undefined ? { borderRadius: radius } : null,
          ]}
        />
      ) : null}
      {scoped ? (
        <GlassForegroundScope>{children}</GlassForegroundScope>
      ) : (
        children
      )}
    </View>
  );
}
