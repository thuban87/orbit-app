// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { ProfileSnapshot } from "@/db/profile-read";
import type { SnoozePreset } from "@/db/snooze-dao";
import {
  FREQUENCY_CHOICES,
  relationshipExplanation,
  relationshipSheetReducer,
  SNOOZE_CHOICES,
  validateCustomSnoozeDate,
} from "@/profile/relationship-sheet-model";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { formatLocalDate } from "@/utils/dates";
import type { RelationshipSheetId } from "./RelationshipOverview";

type Operation = () => Promise<void>;

export function ProfileRelationshipSheets({
  active,
  snapshot,
  todayLocal,
  onClose,
  onOpenHistory,
  onOpenInsights,
  onSetFrequency,
  onSnooze,
  onUnsnooze,
}: {
  active: RelationshipSheetId | null;
  snapshot: ProfileSnapshot;
  todayLocal: string;
  onClose: () => void;
  onOpenHistory: () => void;
  onOpenInsights?: () => void;
  onSetFrequency: (days: number) => Promise<void>;
  onSnooze: (
    request: { preset: SnoozePreset } | { until: string },
  ) => Promise<void>;
  onUnsnooze: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const [frequency, setFrequency] = useState({
    committed: snapshot.identity.intervalDays,
    draft: snapshot.identity.intervalDays,
    pending: false,
    error: null as string | null,
  });
  const [snooze, setSnooze] = useState({
    committed: snapshot.identity.snoozeUntil,
    draft: snapshot.identity.snoozeUntil,
    pending: false,
    error: null as string | null,
  });
  const [customDate, setCustomDate] = useState(todayLocal);
  const [customOpen, setCustomOpen] = useState(false);
  const retry = useRef<Operation | null>(null);

  useEffect(() => {
    setFrequency((state) => ({
      ...state,
      committed: snapshot.identity.intervalDays,
      draft: snapshot.identity.intervalDays,
    }));
    setSnooze((state) => ({
      ...state,
      committed: snapshot.identity.snoozeUntil,
      draft: snapshot.identity.snoozeUntil,
    }));
  }, [snapshot.identity.intervalDays, snapshot.identity.snoozeUntil]);

  const close = () => {
    if (frequency.pending || snooze.pending) return;
    setFrequency((state) =>
      relationshipSheetReducer(state, { type: "dismiss" }),
    );
    setSnooze((state) => relationshipSheetReducer(state, { type: "dismiss" }));
    retry.current = null;
    setCustomOpen(false);
    onClose();
  };

  const saveFrequency = async (days: number) => {
    setFrequency((state) =>
      relationshipSheetReducer(state, { type: "submit", value: days }),
    );
    const operation = () => onSetFrequency(days);
    retry.current = operation;
    try {
      await operation();
      setFrequency((state) =>
        relationshipSheetReducer(state, { type: "success" }),
      );
      onClose();
    } catch {
      setFrequency((state) =>
        relationshipSheetReducer(state, { type: "failure" }),
      );
    }
  };

  const saveSnooze = async (operation: Operation, draft: string | null) => {
    setSnooze((state) =>
      relationshipSheetReducer(state, { type: "submit", value: draft }),
    );
    retry.current = operation;
    try {
      await operation();
      setSnooze((state) =>
        relationshipSheetReducer(state, { type: "success" }),
      );
      onClose();
    } catch {
      setSnooze((state) =>
        relationshipSheetReducer(state, { type: "failure" }),
      );
    }
  };

  const explanation =
    active === "status"
      ? relationshipExplanation({
          kind: "status",
          metric: snapshot.metrics.status,
          insightsAvailable: !!onOpenInsights,
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
    >
      <ScrollView contentContainerStyle={styles.content}>
        {explanation ? (
          <>
            <AppText role="heading" accessibilityRole="header">
              {explanation.title}
            </AppText>
            <AppText role="body">{explanation.summary}</AppText>
            {explanation.details.map((detail) => (
              <AppText key={detail} role="body">
                {detail}
              </AppText>
            ))}
            {explanation.routes?.includes("history") ? (
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
                  {
                    borderColor:
                      frequency.draft === choice.days
                        ? colors.accent
                        : colors.border,
                  },
                ]}
              >
                <AppText role="body">{choice.label}</AppText>
              </Pressable>
            ))}
            {frequency.error ? (
              <AppText role="caption">{frequency.error}</AppText>
            ) : null}
          </>
        ) : null}
        {active === "snooze" ? (
          <>
            <AppText role="heading" accessibilityRole="header">
              Snooze
            </AppText>
            {SNOOZE_CHOICES.map((choice) => (
              <Pressable
                key={choice.kind === "preset" ? choice.preset : choice.kind}
                accessibilityRole="button"
                accessibilityLabel={choice.accessibilityLabel}
                accessibilityState={{ disabled: snooze.pending }}
                disabled={snooze.pending}
                onPress={() => {
                  if (choice.kind === "preset") {
                    void saveSnooze(
                      () => onSnooze({ preset: choice.preset }),
                      choice.preset,
                    );
                  } else {
                    setCustomOpen(true);
                  }
                }}
                style={[styles.choice, { borderColor: colors.border }]}
              >
                <AppText role="body">{choice.label}</AppText>
              </Pressable>
            ))}
            {customOpen ? (
              <>
                <DateTimePicker
                  value={new Date(`${customDate}T12:00:00`)}
                  minimumDate={new Date(`${todayLocal}T12:00:00`)}
                  onChange={(event: DateTimePickerEvent, date?: Date) => {
                    if (event.type === "set" && date) {
                      setCustomDate(formatLocalDate(date));
                    }
                  }}
                />
                <Button
                  role="primary"
                  label="Set snooze"
                  disabled={
                    !validateCustomSnoozeDate(customDate, todayLocal).valid ||
                    snooze.pending
                  }
                  onPress={() =>
                    void saveSnooze(
                      () => onSnooze({ until: customDate }),
                      customDate,
                    )
                  }
                />
                <Button
                  role="tertiary"
                  label="Cancel snooze"
                  onPress={() => setCustomOpen(false)}
                />
              </>
            ) : null}
            {snapshot.identity.snoozeUntil ? (
              <Button
                role="secondary"
                label="Unsnooze"
                disabled={snooze.pending}
                onPress={() => void saveSnooze(onUnsnooze, null)}
              />
            ) : null}
            {snooze.error ? (
              <AppText role="caption">{snooze.error}</AppText>
            ) : null}
          </>
        ) : null}
        {(frequency.error || snooze.error) && retry.current ? (
          <Button
            role="secondary"
            label="Retry"
            onPress={() => {
              setFrequency((state) =>
                relationshipSheetReducer(state, { type: "retry" }),
              );
              setSnooze((state) =>
                relationshipSheetReducer(state, { type: "retry" }),
              );
              void retry
                .current?.()
                .then(onClose)
                .catch(() => {
                  setFrequency((state) =>
                    relationshipSheetReducer(state, { type: "failure" }),
                  );
                  setSnooze((state) =>
                    relationshipSheetReducer(state, { type: "failure" }),
                  );
                });
            }}
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
  close: { marginTop: SPACING.sm },
});
