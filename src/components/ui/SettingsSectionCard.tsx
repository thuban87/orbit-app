// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.

/**
 * SettingsSectionCard (38.12 D-119) — the one section card every Settings
 * sub-page draws: an optional uppercase section header (a11y role "header", as
 * the Settings pages had inline before), then one card surface holding the
 * section's rows with a hairline divider between them.
 *
 * Surfaces:
 *   plain (default)  the `surface` colour, a hairline `border`, `RADII.lg`.
 *   glass            the shared `GlassSurface` card, for pages whose cards keep
 *                    the mode-aware glass treatment (Profile backgrounds; owner
 *                    memory "mode-aware glassy cards"). Rows inside read the
 *                    glass foreground palette through the surface's scope.
 *
 * Children are normally `SettingsRow`s; anything else (a chip group, a busy
 * line) brings its own padding. `null` children (reserved model slots) are
 * dropped before dividers are placed, so no divider ever doubles up.
 *
 * Colours via `useTheme()`; radii and spacing via the theme tokens (CLAUDE.md /
 * check:colors).
 */
import { Children, isValidElement, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { AppText } from "./AppText";
import { GlassSurface } from "./GlassSurface";

export type SettingsSectionCardSurface = "plain" | "glass";

export interface SettingsSectionCardProps {
  /** Section header, drawn uppercase above the card. */
  title?: string;
  children?: ReactNode;
  testID?: string;
  /** Card surface; defaults to the plain opaque card. */
  surface?: SettingsSectionCardSurface;
}

export function SettingsSectionCard({
  title,
  children,
  testID,
  surface = "plain",
}: SettingsSectionCardProps) {
  const { colors } = useTheme();
  const items = Children.toArray(children);
  const rows = items.flatMap((child, position) =>
    position === 0
      ? [child]
      : [
          <View
            key={`settings-divider-${isValidElement(child) ? child.key : String(child)}`}
            style={[styles.divider, { backgroundColor: colors.border }]}
          />,
          child,
        ],
  );

  return (
    <View testID={testID} style={styles.section}>
      {title !== undefined ? (
        <AppText
          role="label"
          accessibilityRole="header"
          style={[styles.heading, { color: colors.textSecondary }]}
        >
          {title}
        </AppText>
      ) : null}
      {surface === "glass" ? (
        <GlassSurface>{rows}</GlassSurface>
      ) : (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {rows}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
  heading: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.xs,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.lg,
    overflow: "hidden",
  },
  divider: { height: StyleSheet.hairlineWidth },
});
