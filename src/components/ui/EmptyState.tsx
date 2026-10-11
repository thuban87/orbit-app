/**
 * EmptyState — the one empty-state component (38.9 D-20, D-71).
 *
 * An icon, a heading saying what is empty, one help line and one action. A
 * search-term echo is truncated (`truncateSearchEcho`) and the heading stays on
 * one line. Built from History's empty state plus an icon; the look follows
 * the 38.9 mockup reference panel (icon in a bordered circle, centred).
 *
 * It calls `useTheme()` itself, so inside a `ChromeScrim` or `GlassSurface`
 * it reads the scoped glass palette (glass-scope-read-contract.test.ts).
 * `children` render above the icon (History's refresh notice). `action` is
 * optional in the props (later consumers may differ; this plan only), but
 * every state converted in 38.9-13 passes one (D-20 "one action", D-71).
 */
import type { ReactNode } from "react";
import {
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { emptyStateHeading } from "./empty-state-logic";

const ICON_DISC = 44;

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

export interface EmptyStateProps {
  icon: IconName;
  /** What is empty. With `term`, the truncated term is echoed after it in quotes. */
  heading: string;
  /** One help line. */
  body: string;
  action?: EmptyStateAction;
  /** A search term to echo in the heading (truncated). */
  term?: string;
  testID: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  /** Rendered above the icon (e.g. History's refresh notice). */
  children?: ReactNode;
}

export function EmptyState({
  icon,
  heading,
  body,
  action,
  term,
  testID,
  onLayout,
  style,
  children,
}: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} onLayout={onLayout} style={[styles.root, style]}>
      {children}
      <View
        style={[
          styles.disc,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Icon name={icon} tone="textSecondary" size="md" />
      </View>
      <AppText
        role="heading"
        accessibilityRole="header"
        numberOfLines={term ? 1 : undefined}
        ellipsizeMode="tail"
        style={styles.text}
        testID={`${testID}-heading`}
      >
        {emptyStateHeading(heading, term)}
      </AppText>
      <AppText
        role="caption"
        style={[styles.text, { color: colors.textSecondary }]}
        testID={`${testID}-body`}
      >
        {body}
      </AppText>
      {action ? (
        // biome-ignore lint/a11y/useValidAriaRole: Button role is the design-system hierarchy role.
        <Button
          role="primary"
          label={action.label}
          accessibilityLabel={action.accessibilityLabel}
          onPress={action.onPress}
          testID={`${testID}-action`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", gap: SPACING.sm },
  disc: {
    width: ICON_DISC,
    height: ICON_DISC,
    borderRadius: ICON_DISC / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { textAlign: "center", alignSelf: "stretch" },
});
