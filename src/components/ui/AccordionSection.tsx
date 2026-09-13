/**
 * AccordionSection (CAPT-01/CAPT-14, dossier §D/§AD) — the reusable CONTROLLED
 * expand/collapse section that carries the phase's information-architecture and
 * its validation-focus contract.
 *
 * This primitive is the shared reveal-and-focus surface consumed by BOTH the
 * Add-Contact accordion (34-03) and the Edit-Contact IA (34-08). Its interface is
 * deliberately fixed here so the downstream plan can drive it identically:
 *
 *   • `sectionId`   — a stable id the parent maps a blocking validation error to
 *                     (`resolveErrorSection` in create-contact-logic). The section
 *                     is the reveal TARGET; the id is the routing key.
 *   • `expanded` +  — CONTROLLED disclosure. The parent owns which sections are
 *     `onExpandedChange`  open, so on a blocked Save it can expand the erroring
 *                     section via `onExpandedChange(true)` rather than leaving the
 *                     user hunting collapsed drawers.
 *   • `containerRef` — a first-invalid-field / scroll target the parent can drive:
 *                     it attaches to the section's root `View`, so the parent can
 *                     `measureLayout`/scroll the revealed section into view.
 *
 * A11Y (UI-SPEC): the header is a single control that is BOTH the section heading
 * (AppText `heading`) and the disclosure button — it announces `accessibilityState
 * {{ expanded }}` and its accessible name matches the visible title. The touch
 * target is ≥44×44 (MIN_TOUCH_TARGET).
 *
 * ANIMATION: expand/collapse is a plain conditional render — NOT a React-state-
 * driven animated height. Driving an animation from `setState` per frame re-renders
 * the tree on the JS thread (CLAUDE.md animation rule); a section that simply
 * mounts/unmounts its body avoids that hazard entirely.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";
import { AppText } from "./AppText";
import { MIN_TOUCH_TARGET } from "./button-roles";

export interface AccordionSectionProps {
  /** Stable id the parent maps a blocking validation error to (reveal target). */
  sectionId: string;
  /** Visible header text; also the control's accessible name. */
  title: string;
  /** CONTROLLED disclosure state — the parent owns which sections are open. */
  expanded: boolean;
  /** Fired with the next disclosure state when the header is toggled. */
  onExpandedChange: (next: boolean) => void;
  /** The section body, revealed only while expanded. */
  children: ReactNode;
  /**
   * Parent-driven scroll target: attaches to the section's root `View` so the
   * parent can measure/scroll the revealed section (and its first invalid field)
   * into view on a blocked Save. This is the "registered scroll target" half of
   * the validation-focus contract 34-08 also consumes.
   */
  containerRef?: (node: View | null) => void;
  testID?: string;
}

export function AccordionSection({
  sectionId,
  title,
  expanded,
  onExpandedChange,
  children,
  containerRef,
  testID,
}: AccordionSectionProps) {
  const { colors } = useTheme();

  return (
    <View
      ref={containerRef}
      testID={testID ?? `accordion-${sectionId}`}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: expanded ? colors.borderStrong : colors.border,
        },
      ]}
    >
      <Pressable
        testID={`accordion-${sectionId}-header`}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={() => onExpandedChange(!expanded)}
        style={styles.header}
      >
        <AppText role="heading">{title}</AppText>
        <AppText role="heading" style={{ color: colors.textSecondary }}>
          {expanded ? "−" : "+"}
        </AppText>
      </Pressable>
      {expanded ? (
        <View
          testID={`accordion-${sectionId}-body`}
          style={[styles.body, { borderTopColor: colors.border }]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  header: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  body: {
    borderTopWidth: 1,
    padding: 16,
    gap: 16,
  },
});
