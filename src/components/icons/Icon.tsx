/**
 * Icon (THEME-09 / D-06) — the single presentational primitive every screen
 * draws an icon through. It resolves:
 *   - the base glyph from the semantic `name` via `ICON_REGISTRY` (state
 *     `active` -> filled, else outline);
 *   - COLOUR only through `useTheme().colors[tone]` — never a hardcoded colour;
 *   - SIZE only through the `ICON_SIZE` token set — never a hardcoded pixel.
 *
 * `tone` is typed `IconTone` (the string-valued ThemePalette keys), so
 * `colors[tone]` is always a `string` Ionicons' `color` prop can consume — the
 * array-valued tokens (avatarSwatches/gravityTiers/starPalette) are excluded at
 * the type level (REVIEWS 23-05 cycle-4 MEDIUM).
 *
 * This module is where the REAL Ionicons component is imported, so `tsc`
 * validates every registry glyph string against Ionicons' name union here:
 * `glyph` flows straight into `<Ionicons name={glyph}/>`, so an invalid glyph
 * in the registry fails `tsc --noEmit` at that prop — no cast, no escape hatch.
 * The registry module itself stays react-native-free (node-testable).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/theme";
import { ICON_SIZE, type IconSizeToken } from "@/theme/tokens/icon-size";
import { ICON_REGISTRY, type IconName, type IconTone } from "./icon-registry";

export interface IconProps {
  /** Semantic name — must be a registered `IconName` (unregistered fails tsc). */
  name: IconName;
  /** `active` -> filled glyph; anything else -> outline. */
  state?: "default" | "active";
  /** Rendered size, resolved through the `ICON_SIZE` token set. */
  size?: IconSizeToken;
  /** Colour token — a string-valued `ThemePalette` key. */
  tone?: IconTone;
}

export function Icon({
  name,
  state = "default",
  size = "md",
  tone = "textPrimary",
}: IconProps) {
  const { colors } = useTheme();
  const glyph = ICON_REGISTRY[name][state === "active" ? "filled" : "outline"];
  return <Ionicons name={glyph} size={ICON_SIZE[size]} color={colors[tone]} />;
}
