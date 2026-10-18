// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * MatchChoiceSheet (38.12 D-107, D-51, D-52) — Review matches' per-person
 * bottom sheet. Titled with the incoming person, it lists the candidate Orbit
 * contacts as single-choice rows (photo or initials, name, evidence) inside
 * the sheet's own scroll body, then Link (enabled once a candidate is picked),
 * Import as new, Skip and Cancel. Every control is held while a write is in
 * flight (ADR-168 latch on the host; T-38.12-20).
 *
 * It replaces Duplicate review's two centred dialogs: the old "Choose an
 * existing contact" modal and the bulk "Choose action" chooser (D-107). The
 * host drives it from `currentLink` for both a single row tap and the bulk
 * "link" queue; closing it (Cancel, scrim, Back) is the host's `onClose`,
 * which clears the queue (D-52).
 *
 * The picked candidate is remembered against `entryKey`, so advancing to the
 * next queued person never carries a pick over to them, and it is dropped
 * whenever the sheet closes, so Cancel then reopening the same row starts
 * fresh (38.12 D-IN-05). Nothing is preselected. Every colour resolves through `useTheme()`.
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import type { CandidateChoice } from "@/components/CandidateCardGrid";
import { Icon } from "@/components/icons/Icon";
import { AppText, Button, Sheet } from "@/components/ui";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

/** Choice avatar diameter (40); matches the existing-contact choice size. */
const CHOICE_AVATAR_SIZE = SPACING["2xl"] - SPACING.sm;

/** Shown when no candidate is left to link to (gone or below "possible"). */
export const MATCH_CHOICE_EMPTY_COPY = "No Orbit contact to link to.";

export interface MatchChoiceSheetProps {
  visible: boolean;
  /** Identifies the person being settled; a pick never outlives it. */
  entryKey: string | number | null;
  /** The incoming person's name — the sheet title. */
  personName: string;
  /** The filtered, ordered candidates (D-52). */
  choices: readonly CandidateChoice[];
  /** True while any resolve write is in flight. */
  writing: boolean;
  onLink: (choice: CandidateChoice) => void;
  onImportNew: () => void;
  onSkip: () => void;
  /** Cancel, scrim and Back. */
  onClose: () => void;
}

export function MatchChoiceSheet({
  visible,
  entryKey,
  personName,
  choices,
  writing,
  onLink,
  onImportNew,
  onSkip,
  onClose,
}: MatchChoiceSheetProps) {
  const { colors } = useTheme();
  const [picked, setPicked] = useState<{
    entryKey: string | number | null;
    contactId: number;
  } | null>(null);
  // Clear the pick when the sheet closes (the adjust-state-during-render
  // pattern: no effect, no extra frame showing a stale pick on reopen).
  const [shownVisible, setShownVisible] = useState(visible);
  if (shownVisible !== visible) {
    setShownVisible(visible);
    if (!visible) setPicked(null);
  }
  const selected =
    picked && picked.entryKey === entryKey
      ? (choices.find((choice) => choice.contactId === picked.contactId) ??
        null)
      : null;

  return (
    <Sheet visible={visible} variant="detail" onRequestClose={onClose}>
      <View style={styles.body}>
        <AppText role="heading">{personName}</AppText>
        {choices.length > 0 ? (
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            Might be one of these Orbit contacts
          </AppText>
        ) : (
          <AppText role="body" style={{ color: colors.textSecondary }}>
            {MATCH_CHOICE_EMPTY_COPY}
          </AppText>
        )}
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {choices.map((choice) => {
            const checked = selected?.contactId === choice.contactId;
            return (
              <Pressable
                key={choice.contactId}
                testID={`match-choice-${choice.contactId}`}
                accessibilityRole="radio"
                accessibilityLabel={[choice.name, choice.evidenceHint]
                  .filter(Boolean)
                  .join(", ")}
                accessibilityState={{ checked, disabled: writing }}
                disabled={writing}
                onPress={() =>
                  setPicked({ entryKey, contactId: choice.contactId })
                }
                style={[
                  styles.choice,
                  {
                    backgroundColor: colors.surface,
                    borderColor: checked ? colors.borderStrong : colors.border,
                  },
                  checked && styles.choiceChecked,
                ]}
              >
                <Icon
                  name="select"
                  state={checked ? "active" : "default"}
                  size="md"
                  tone={checked ? "accentText" : "textSecondary"}
                />
                <Avatar
                  photo={choice.photo ?? null}
                  name={choice.name}
                  contactId={choice.contactId}
                  size={CHOICE_AVATAR_SIZE}
                />
                <View style={styles.choiceText}>
                  <AppText role="body" style={{ color: colors.textPrimary }}>
                    {choice.name}
                  </AppText>
                  {choice.evidenceHint ? (
                    <AppText
                      role="caption"
                      style={{ color: colors.textSecondary }}
                    >
                      {choice.evidenceHint}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.actions}>
          <Button
            role="primary"
            testID="match-choice-link"
            label="Link"
            disabled={writing || selected === null}
            onPress={() => {
              if (selected) onLink(selected);
            }}
          />
          <View style={styles.secondaryRow}>
            <View style={styles.secondaryAction}>
              <Button
                role="secondary"
                testID="match-choice-import-new"
                label="Import as new"
                disabled={writing}
                onPress={onImportNew}
              />
            </View>
            <View style={styles.secondaryAction}>
              <Button
                role="secondary"
                testID="match-choice-skip"
                label="Skip"
                disabled={writing}
                onPress={onSkip}
              />
            </View>
          </View>
          <Button
            role="tertiary"
            testID="match-choice-cancel"
            label="Cancel"
            disabled={writing}
            onPress={onClose}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACING.sm, paddingTop: SPACING.xs },
  choices: { gap: SPACING.sm },
  choice: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: 44,
    padding: SPACING.md,
  },
  choiceChecked: { borderWidth: 2 },
  choiceText: { flex: 1, gap: 2 },
  actions: { gap: SPACING.sm, marginTop: SPACING.sm },
  secondaryRow: { flexDirection: "row", gap: SPACING.sm },
  secondaryAction: { flex: 1 },
});
