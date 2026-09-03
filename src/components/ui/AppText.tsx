/**
 * AppText — the semantic typography primitive (THEME-07, dossier §H).
 *
 * A thin `<Text>` wrapper that resolves a semantic `role` (display | heading |
 * body | label | caption) to family / size / weight / lineHeight from the pure
 * `TYPOGRAPHY` tokens and its colour from `useTheme()` — the only sanctioned
 * colour source (no hex here; check:colors). Screens speak in ROLES, never raw
 * font sizes.
 *
 * THEME-07 reflow contract — this primitive DELIBERATELY does NOT:
 *   - set `allowFontScaling={false}` (OS text scaling stays honoured), or
 *   - impose a fixed height or a default `numberOfLines` on reflowable content.
 * So large OS text reflows (wraps / grows height) rather than truncating or
 * shrinking. A caller may still pass `numberOfLines`/tighter style for a genuine
 * utility/form case, but the primitive imposes none.
 *
 * The font FAMILY is semantic ("Inter" / "Space Grotesk"); it maps here to the
 * concrete loaded font key (a distinct file per weight — Android will not
 * reliably synthesize a weight from one custom family). Keys match the expo-font
 * map in `src/theme/fonts.ts`.
 */
import type { ReactNode } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme";
import {
  type FontFamily,
  type FontWeight,
  TYPOGRAPHY,
  type TypographyRole,
} from "@/theme/tokens/typography";

/** Map the semantic family + weight to the loaded expo-font key (fonts.ts). */
function resolveFontFamily(family: FontFamily, weight: FontWeight): string {
  if (family === "Space Grotesk") {
    return "SpaceGrotesk-SemiBold";
  }
  return weight === 600 ? "Inter-SemiBold" : "Inter-Regular";
}

// Omit RN's accessibility `role` so our semantic typography `role` owns the name
// (callers needing the a11y role use `accessibilityRole`).
export interface AppTextProps extends Omit<TextProps, "role"> {
  /** Semantic typography role; defaults to `body`. */
  role?: TypographyRole;
  children?: ReactNode;
}

export function AppText({
  role = "body",
  style,
  children,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  const t = TYPOGRAPHY[role];

  const roleStyle: TextStyle = {
    fontFamily: resolveFontFamily(t.family, t.weight),
    fontSize: t.size,
    // Redundant with the weight-specific family, but kept so a system-font
    // degrade (loadAppFonts failed) still renders at the right weight.
    fontWeight: `${t.weight}` as TextStyle["fontWeight"],
    lineHeight: t.lineHeight,
    color: colors[t.colorToken],
  };

  // Caller style comes LAST so a genuine utility case can override — but the
  // primitive itself never disables scaling or clamps lines.
  return (
    <Text {...rest} style={[roleStyle, style]}>
      {children}
    </Text>
  );
}
