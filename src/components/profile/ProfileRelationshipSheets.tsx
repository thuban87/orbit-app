// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { ProfileSnapshot } from "@/db/profile-read";
import type { SnoozePreset } from "@/db/snooze-dao";
import {
  FREQUENCY_CHOICES,
  type RelationshipSheetState,
  relationshipExplanation,
  relationshipSheetReducer,
  SNOOZE_CHOICES,
  validateCustomSnoozeDate,
} from "@/profile/relationship-sheet-model";
import {
  createRelationshipSheetRunner,
  type RelationshipSelector,
  type RelationshipSelectorValues,
  type RelationshipSheetRunner,
} from "@/profile/relationship-sheet-runner";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { formatLocalDate } from "@/utils/dates";
import type { RelationshipSheetId } from "./RelationshipOverview";

type Operation = () => Promise<void>;
type SelectorState<O extends RelationshipSelector> = RelationshipSheetState<
  RelationshipSelectorValues[O]
>;
type SelectorStates = { [O in RelationshipSelector]: SelectorState<O> };

function idleSelector<T>(value: T): RelationshipSheetState<T> {
  return { committed: value, draft: value, pending: false, error: null };
}

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
  onOpenHistory?: () => void;
  onOpenInsights?: () => void;
  onSetFrequency: (days: number) => Promise<void>;
  onSnooze: (
    request: { preset: SnoozePreset } | { until: string },
  ) => Promise<void>;
  onUnsnooze: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const [frequency, setFrequency] = useState(() =>
    idleSelector(snapshot.identity.intervalDays),
  );
  const [snooze, setSnooze] = useState(() =>
    idleSelector(snapshot.identity.snoozeUntil),
  );
  const [customDate, setCustomDate] = useState(todayLocal);
  const [customOpen, setCustomOpen] = useState(false);

  // Synchronous mirror of both selector states, so the runner's pending checks
  // never read a stale render. Every selector state change goes through
  // `applySelector`, which updates the mirror and the rendered state together.
  const selectors = useRef<SelectorStates>({ frequency, snooze });
  const applySelector = <O extends RelationshipSelector>(
    owner: O,
    update: (state: SelectorState<O>) => SelectorState<O>,
  ) => {
    const next = update(selectors.current[owner]);
    selectors.current = { ...selectors.current, [owner]: next };
    if (owner === "frequency") {
      setFrequency(next as SelectorStates["frequency"]);
    } else {
      setSnooze(next as SelectorStates["snooze"]);
    }
  };
  const latestOnClose = useRef(onClose);
  latestOnClose.current = onClose;

  // 38.3 RG-025 (D-24): saveFrequency, saveSnooze and Retry all settle through
  // one owner-scoped runner — a Retry settles only the selector that failed.
  const runnerRef = useRef<RelationshipSheetRunner | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = createRelationshipSheetRunner({
      dispatch: (owner, action) =>
        applySelector(owner, (state) =>
          relationshipSheetReducer(state, action),
        ),
      isPending: (owner) => selectors.current[owner].pending,
      onClose: () => latestOnClose.current(),
    });
  }
  const runner = runnerRef.current;

  // biome-ignore lint/correctness/useExhaustiveDependencies: applySelector only writes the mirror + state setters; the effect is keyed on the snapshot values.
  useEffect(() => {
    applySelector("frequency", (state) => ({
      ...state,
      committed: snapshot.identity.intervalDays,
      draft: snapshot.identity.intervalDays,
    }));
    applySelector("snooze", (state) => ({
      ...state,
      committed: snapshot.identity.snoozeUntil,
      draft: snapshot.identity.snoozeUntil,
    }));
  }, [snapshot.identity.intervalDays, snapshot.identity.snoozeUntil]);

  const close = () => {
    if (
      selectors.current.frequency.pending ||
      selectors.current.snooze.pending
    ) {
      return;
    }
    applySelector("frequency", (state) =>
      relationshipSheetReducer(state, { type: "dismiss" }),
    );
    applySelector("snooze", (state) =>
      relationshipSheetReducer(state, { type: "dismiss" }),
    );
    runner.clear();
    setCustomOpen(false);
    onClose();
  };

  const saveFrequency = (days: number) =>
    runner.submit("frequency", days, () => onSetFrequency(days));

  const saveSnooze = (operation: Operation, draft: string | null) =>
    runner.submit("snooze", draft, operation);

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
        {(frequency.error || snooze.error) && runner.canRetry() ? (
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
  close: { marginTop: SPACING.sm },
});
