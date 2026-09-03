/**
 * Button (THEME-10 / dossier §P) — the ONE button API expressing the formal
 * five-role hierarchy. A screen picks a `role`; colour, radius, spacing and the
 * destructive affordance all resolve from tokens — no parallel button families,
 * no ad-hoc colour.
 *
 *   Primary     filled `accent` + `onAccent` label (one per surface)
 *   Secondary   tonal `surface` + `border` outline, `textPrimary` label
 *   Tertiary    text-only, the accent-as-link `accentText` tone
 *   Destructive `danger` fill + the NAMED `onDanger` foreground for BOTH the
 *               label AND the reserved `warning` registry glyph — DISTINCT beyond
 *               colour (dossier §P). Irreversible actions additionally route
 *               through `ConfirmDialog`; this primitive supplies the colour+glyph
 *               half of that contract.
 *   IconOnly    a registry glyph in a 44×44 circular target; `accessibilityLabel`
 *               is REQUIRED (enforced at the type level AND at runtime).
 *
 * The role→treatment mapping and the a11y contract live in the pure, node-tested
 * sibling `button-roles.ts`; this module only RESOLVES those token keys to real
 * colours via `useTheme()` and renders. No colour literal here (check:colors).
 */
import { Pressable, type PressableProps, StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import type { IconName, IconTone } from "@/components/icons/icon-registry";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { AppText } from "./AppText";
import {
  assertButtonAccessibility,
  type ButtonRole,
  buttonVisual,
} from "./button-roles";

// Re-exported so `button-roles` stays "exported from Button" for app consumers.
export {
  type ButtonRole,
  buttonVisual,
  MIN_TOUCH_TARGET,
} from "./button-roles";

interface CommonButtonProps
  extends Pick<PressableProps, "onPress" | "disabled" | "testID"> {
  /** Optional a11y label; REQUIRED for `role="iconOnly"` (see the union below). */
  accessibilityLabel?: string;
}

interface LabelButtonProps extends CommonButtonProps {
  role: "primary" | "secondary" | "tertiary" | "destructive";
  /** Visible text label — supplies the accessible name for text-label roles. */
  label: string;
}

interface IconOnlyButtonProps extends CommonButtonProps {
  role: "iconOnly";
  /** The semantic registry glyph (never a raw Ionicons name — D-05). */
  icon: IconName;
  /** REQUIRED — an icon-only control has no text label to name it. */
  accessibilityLabel: string;
}

export type ButtonProps = LabelButtonProps | IconOnlyButtonProps;

export function Button(props: ButtonProps) {
  const { role, onPress, disabled, testID, accessibilityLabel } = props;
  const { colors } = useTheme();
  const v = buttonVisual(role);

  // Belt-and-suspenders with the TS discriminated union: an icon-only button
  // with no accessibilityLabel is rejected outright (THEME-10 a11y contract).
  assertButtonAccessibility(role, { accessibilityLabel });

  const foreground = colors[v.foregroundToken];
  const containerStyle = {
    backgroundColor: v.fillToken ? colors[v.fillToken] : undefined,
    borderColor: v.borderToken ? colors[v.borderToken] : undefined,
    borderWidth: v.borderWidth,
    borderRadius: RADII[v.radiusToken],
    minWidth: v.minTouchTarget,
    minHeight: v.minTouchTarget,
    opacity: disabled ? 0.5 : 1,
  };

  const iconTone: IconTone = v.foregroundToken;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={
        accessibilityLabel ?? (props.role !== "iconOnly" ? props.label : undefined)
      }
      style={[styles.base, containerStyle]}
    >
      {props.role === "iconOnly" ? (
        <Icon name={props.icon} tone={iconTone} size="md" />
      ) : (
        <View style={styles.content}>
          {/* Destructive is distinct BEYOND colour: the reserved warning glyph,
              tinted the same onDanger foreground, always accompanies the label. */}
          {v.glyph ? <Icon name={v.glyph} tone={iconTone} size="sm" /> : null}
          <AppText role="label" style={{ color: foreground }}>
            {props.label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
});
