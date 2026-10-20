/**
 * ProfileHeading — the one renderer for the Profile heading levels (38.14
 * D-52 scale S2, D-56).
 *
 * Styles a `<Text>` from `PROFILE_HEADING_SCALE[level]` only: the family
 * resolves through the shared `resolveFontFamily`, the colour through
 * `useTheme().colors[colorToken]` (read here, so a heading inside a
 * `GlassSurface` card resolves through its glass scope). No literal sizes or
 * colours. Like `AppText`, it never disables OS font scaling and imposes no
 * fixed height or line clamp, so large text reflows.
 *
 * `h1` (a top-level section heading) and `h2` (a sub-section heading) carry
 * `accessibilityRole="header"`; `h3` is a group label inside a section.
 *
 * The scale is used on the Profile only (D-56).
 */
import type { ReactNode } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme";
import {
  PROFILE_HEADING_SCALE,
  type ProfileHeadingLevel,
  resolveFontFamily,
} from "@/theme/tokens/typography";

export interface ProfileHeadingProps extends Omit<TextProps, "role" | "style"> {
  level: ProfileHeadingLevel;
  children?: ReactNode;
}

export function ProfileHeading({
  level,
  children,
  ...rest
}: ProfileHeadingProps) {
  const { colors } = useTheme();
  const t = PROFILE_HEADING_SCALE[level];
  const style: TextStyle = {
    fontFamily: resolveFontFamily(t.family, t.weight),
    fontSize: t.size,
    // Kept so a system-font degrade still renders at the right weight.
    fontWeight: `${t.weight}` as TextStyle["fontWeight"],
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
    textTransform: t.uppercase ? "uppercase" : "none",
    color: colors[t.colorToken],
  };
  return (
    <Text
      accessibilityRole={level === "h3" ? undefined : "header"}
      {...rest}
      style={style}
    >
      {children}
    </Text>
  );
}
