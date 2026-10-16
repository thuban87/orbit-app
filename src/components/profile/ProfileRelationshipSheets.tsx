// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  INVALID_INTERVAL_MESSAGE,
  parseCustomInterval,
} from "@/components/frequency-picker-logic";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Sheet } from "@/components/ui/Sheet";
import type { ProfileSnapshot } from "@/db/profile-read";
import {
  CUSTOM_FREQUENCY_LABEL,
  customFrequencyApplyState,
  FREQUENCY_CHOICES,
  frequencySheetSelection,
  type RelationshipSheetAction,
  type RelationshipSheetState,
  relationshipExplanation,
  relationshipSheetReducer,
} from "@/profile/relationship-sheet-model";
import {
  createRelationshipSheetRunner,
  type RelationshipSheetRunner,
} from "@/profile/relationship-sheet-runner";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import type { RelationshipSheetId } from "./RelationshipOverview";

type FrequencyState = RelationshipSheetState<number | null>;

function idleSelector<T>(value: T): RelationshipSheetState<T> {
  return { committed: value, draft: value, pending: false, error: null };
}

/**
 * The Overview's Contact Frequency sheet and the stat explanations. The Snooze
 * tile opens the shared `SnoozeSheet` instead (38.11 D-45, 38.11-10), hosted
 * beside this component in `ProfileModuleHost`.
 */
export function ProfileRelationshipSheets({
  active,
  snapshot,
  onClose,
  onOpenHistory,
  onOpenInsights,
  onSetFrequency,
}: {
  active: RelationshipSheetId | null;
  snapshot: ProfileSnapshot;
  onClose: () => void;
  onOpenHistory?: () => void;
  onOpenInsights?: () => void;
  onSetFrequency: (days: number) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [frequency, setFrequency] = useState(() =>
    idleSelector(snapshot.identity.intervalDays),
  );
  // 38.11 D-54: the Frequency sheet's Custom… days box. Touched is set on the
  // first typing so the error shows only after the user types (D-36).
  const [customDaysOpen, setCustomDaysOpen] = useState(false);
  const [customDaysRaw, setCustomDaysRaw] = useState("");
  const [customDaysTouched, setCustomDaysTouched] = useState(false);

  // Synchronous mirror of the selector state, so the runner's pending checks
  // never read a stale render. Every state change goes through
  // `applyFrequency`, which updates the mirror and the rendered state together.
  const frequencyRef = useRef<FrequencyState>(frequency);
  const applyFrequency = (
    update: (state: FrequencyState) => FrequencyState,
  ) => {
    const next = update(frequencyRef.current);
    frequencyRef.current = next;
    setFrequency(next);
  };
  const latestOnClose = useRef(onClose);
  latestOnClose.current = onClose;

  // 38.3 RG-025 (D-24): saveFrequency and Retry settle through the shared
  // runner. Only the "frequency" owner is submitted here; the snooze selector
  // settles inside `SnoozeSheet` (38.11-10).
  const runnerRef = useRef<RelationshipSheetRunner | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = createRelationshipSheetRunner({
      dispatch: (_owner, action) =>
        applyFrequency((state) =>
          relationshipSheetReducer(
            state,
            action as RelationshipSheetAction<number | null>,
          ),
        ),
      isPending: () => frequencyRef.current.pending,
      onClose: () => latestOnClose.current(),
    });
  }
  const runner = runnerRef.current;

  // biome-ignore lint/correctness/useExhaustiveDependencies: applyFrequency only writes the mirror + state setter; the effect is keyed on the snapshot value.
  useEffect(() => {
    applyFrequency((state) => ({
      ...state,
      committed: snapshot.identity.intervalDays,
      draft: snapshot.identity.intervalDays,
    }));
  }, [snapshot.identity.intervalDays]);

  // A fresh sheet starts with the Custom… box closed (it reopens prefilled).
  useEffect(() => {
    if (active !== "frequency") {
      setCustomDaysOpen(false);
      setCustomDaysTouched(false);
    }
  }, [active]);

  const close = () => {
    if (frequencyRef.current.pending) return;
    applyFrequency((state) =>
      relationshipSheetReducer(state, { type: "dismiss" }),
    );
    runner.clear();
    onClose();
  };

  const saveFrequency = (days: number) =>
    runner.submit("frequency", days, () => onSetFrequency(days));

  const frequencySelection = frequencySheetSelection(frequency.draft);
  const customDays = customFrequencyApplyState(
    parseCustomInterval(customDaysRaw, "days"),
    customDaysTouched,
  );
  const openCustomDays = () => {
    if (customDaysOpen) return;
    setCustomDaysRaw(
      frequencySelection.kind === "custom"
        ? String(frequencySelection.days)
        : "",
    );
    setCustomDaysTouched(false);
    setCustomDaysOpen(true);
  };

  const explanation =
    active === "status"
      ? relationshipExplanation({
          kind: "status",
          metric: snapshot.metrics.status,
          insightsAvailable: !!onOpenInsights,
          // D-11: the host passes no History action when the layout hides it.
          historyAvailable: onOpenHistory !== undefined,
        })
      : active === "gravity"
        ? relationshipExplanation({
            kind: "gravity",
            metric: snapshot.metrics.gravity,
          })
        : active === "intensity"
          ? relationshipExplanation({
              kind: "intensity",
              metric: snapshot.metrics.intensity,
            })
          : null;

  return (
    <Sheet
      visible={active !== null}
      onRequestClose={close}
      variant={explanation ? "detail" : "compact"}
      scrollBody={false}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {explanation ? (
          <>
            <AppText role="heading" accessibilityRole="header">
              {explanation.title}
            </AppText>
            {/* 38.11 D-75: the plain explanation of the term comes first. */}
            <AppText role="body">{explanation.definition}</AppText>
            <AppText role="body">{explanation.summary}</AppText>
            {explanation.details.map((detail) => (
              <AppText key={detail} role="body">
                {detail}
              </AppText>
            ))}
            {explanation.routes?.includes("history") && onOpenHistory ? (
              <Button
                role="tertiary"
                label="View history"
                onPress={onOpenHistory}
              />
            ) : null}
            {explanation.routes?.includes("insights") && onOpenInsights ? (
              <Button
                role="tertiary"
                label="View insights"
                onPress={onOpenInsights}
              />
            ) : null}
          </>
        ) : null}
        {active === "frequency" ? (
          <>
            <AppText role="heading" accessibilityRole="header">
              Contact Frequency
            </AppText>
            {FREQUENCY_CHOICES.map((choice) => (
              <Pressable
                key={choice.label}
                accessibilityRole="button"
                accessibilityLabel={choice.accessibilityLabel}
                accessibilityState={{
                  selected: frequency.draft === choice.days,
                  disabled: frequency.pending,
                }}
                disabled={frequency.pending}
                onPress={() => void saveFrequency(choice.days)}
                style={[
                  styles.choice,
                  styles.frequencyChoice,
                  {
                    borderColor:
                      frequency.draft === choice.days
                        ? colors.accent
                        : colors.border,
                  },
                ]}
              >
                <AppText role="body" style={styles.frequencyLabel}>
                  {choice.label}
                </AppText>
                {/* D-66: the current choice carries the filled select glyph,
                    as the dropdowns do, so it never depends on border colour. */}
                {frequency.draft === choice.days ? (
                  <Icon name="select" state="active" tone="accentText" />
                ) : null}
              </Pressable>
            ))}
            {/* 38.11 D-54 (amends D-14): presets apply on tap; the Custom…
                row reveals a days box applied with Apply, through the same
                runner, so pending, error and Retry match the presets. */}
            <Pressable
              testID="profile-frequency-custom"
              accessibilityRole="button"
              accessibilityLabel={
                frequencySelection.kind === "custom"
                  ? `Custom frequency, every ${frequencySelection.days} days`
                  : "Custom frequency"
              }
              accessibilityState={{
                selected: frequencySelection.kind === "custom",
                expanded: customDaysOpen,
                disabled: frequency.pending,
              }}
              disabled={frequency.pending}
              onPress={openCustomDays}
              style={[
                styles.choice,
                styles.frequencyChoice,
                {
                  borderColor:
                    frequencySelection.kind === "custom"
                      ? colors.accent
                      : colors.border,
                },
              ]}
            >
              <View style={styles.frequencyLabel}>
                <AppText role="body">{CUSTOM_FREQUENCY_LABEL}</AppText>
                {frequencySelection.kind === "custom" ? (
                  // D-11: "Every N days" wording.
                  <AppText role="caption">
                    {`Every ${frequencySelection.days} ${frequencySelection.days === 1 ? "day" : "days"}`}
                  </AppText>
                ) : null}
              </View>
              {frequencySelection.kind === "custom" ? (
                <Icon name="select" state="active" tone="accentText" />
              ) : null}
            </Pressable>
            {customDaysOpen ? (
              <View style={styles.customDays}>
                <View style={styles.customDaysRow}>
                  <TextInput
                    testID="profile-frequency-custom-days"
                    accessibilityLabel="Custom frequency in days"
                    value={customDaysRaw}
                    editable={!frequency.pending}
                    onChangeText={(text) => {
                      setCustomDaysTouched(true);
                      setCustomDaysRaw(text);
                    }}
                    keyboardType="number-pad"
                    placeholder="Days"
                    placeholderTextColor={colors.textPlaceholder}
                    style={[
                      styles.customDaysInput,
                      {
                        color: colors.textPrimary,
                        backgroundColor: colors.surface,
                        borderColor: customDays.showError
                          ? colors.danger
                          : colors.border,
                      },
                    ]}
                  />
                  <Button
                    role="primary"
                    label="Apply"
                    disabled={!customDays.canApply || frequency.pending}
                    onPress={() => {
                      if (customDays.days !== null) {
                        void saveFrequency(customDays.days);
                      }
                    }}
                  />
                </View>
                <FieldError
                  testID="profile-frequency-custom-error"
                  message={
                    customDays.showError ? INVALID_INTERVAL_MESSAGE : null
                  }
                />
              </View>
            ) : null}
            {frequency.error ? (
              <AppText role="caption">{frequency.error}</AppText>
            ) : null}
          </>
        ) : null}
        {frequency.error && runner.canRetry() ? (
          <Button
            role="secondary"
            label="Retry"
            onPress={() => void runner.retry()}
          />
        ) : null}
        <View style={styles.close}>
          <Button role="tertiary" label="Close" onPress={close} />
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.sm, paddingBottom: SPACING.base },
  choice: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.base,
  },
  frequencyChoice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  frequencyLabel: { flexShrink: 1 },
  customDays: { gap: SPACING.xs },
  customDaysRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  customDaysInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  close: { marginTop: SPACING.sm },
});
