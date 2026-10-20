// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
import { StyleSheet, View } from "react-native";
import { showsConnected } from "@/components/history/interaction-detail-logic";
import { Icon } from "@/components/icons/Icon";
import {
  TouchpointRefineForm,
  type TouchpointRefineValue,
} from "@/components/TouchpointRefineForm";
import { AppText, Button } from "@/components/ui";
import type {
  GroupEventDetail,
  GroupEventParticipant,
} from "@/db/group-events-read";
import { resolveDisplay } from "@/logic/group-inheritance";
import { channelOptionsFor } from "@/screens/log-interaction-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { followLineLabel } from "./participant-summary-logic";

export interface ParticipantFollowState {
  channel: boolean;
  quality: boolean;
  duration: boolean;
}

export interface ParticipantEditDraft {
  value: TouchpointRefineValue;
  follow: ParticipantFollowState;
}

export function participantDraft(
  participant: GroupEventParticipant,
  event: GroupEventDetail,
): ParticipantEditDraft {
  const display = resolveDisplay(participant, {
    channel: event.channel ?? "In Person",
    quality: event.quality,
    duration: event.duration,
  });
  return {
    value: {
      occurredAt: event.occurredAt,
      channel: display.channel.value,
      quality: display.quality.value,
      duration: display.duration.value,
      direction: participant.direction,
      connected: participant.connected,
      note: participant.note,
      allowAi: 0,
    },
    follow: {
      channel: display.channel.following,
      quality: display.quality.following,
      duration: display.duration.following,
    },
  };
}

interface ParticipantOverrideEditorProps {
  event: GroupEventDetail;
  participant: GroupEventParticipant;
  draft: ParticipantEditDraft;
  onChange: (draft: ParticipantEditDraft) => void;
  /**
   * 38.10 Research Q4: the inline error under the participant's note (a linked
   * own note cleared to blank). Passed straight to the form; absent or null
   * renders nothing.
   */
  noteError?: string | null;
}

const FOLLOW_FIELDS = [
  ["channel", "Channel"],
  ["quality", "Tone"],
  ["duration", "Duration"],
] as const;

export function ParticipantOverrideEditor({
  event,
  participant,
  draft,
  onChange,
  noteError,
}: ParticipantOverrideEditorProps) {
  const { colors } = useTheme();

  function changeValue(next: TouchpointRefineValue) {
    const follow = { ...draft.follow };
    if (next.channel !== draft.value.channel) follow.channel = false;
    if (next.quality !== draft.value.quality) follow.quality = false;
    if (next.duration !== draft.value.duration) follow.duration = false;
    onChange({ value: next, follow });
  }

  function followEvent(field: keyof ParticipantFollowState) {
    const eventValues = {
      channel: event.channel ?? "In Person",
      quality: event.quality,
      duration: event.duration,
    } as const;
    onChange({
      value: { ...draft.value, [field]: eventValues[field] },
      follow: { ...draft.follow, [field]: true },
    });
  }

  return (
    <View style={styles.editor}>
      <View style={styles.stateLine}>
        <Icon name="group-events" tone="textSecondary" size="sm" />
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          Editing {participant.contactName}
        </AppText>
      </View>
      <TouchpointRefineForm
        testID="participant-override-form"
        value={draft.value}
        onChange={changeValue}
        now={event.occurredAt}
        // 38.14 D-60: options from the participant's STORED channel (or the
        // event's when following), never the draft, so a stored legacy value
        // stays selectable after switching away.
        channelOptions={channelOptionsFor(
          participantDraft(participant, event).value.channel,
        )}
        noteError={noteError}
        // D-87 (owner, code review B-WR-05): a participant is an event child,
        // so Connected is hidden as in the sheet (D-30); the stored value is
        // kept (the patch builders write only changed fields).
        visibleFields={[
          "channel",
          "direction",
          ...(showsConnected({
            channel: draft.value.channel,
            groupEventId: event.id,
          })
            ? (["connected"] as const)
            : []),
          "tone",
          "note",
          "duration",
        ]}
      />
      <View style={styles.followFields}>
        {FOLLOW_FIELDS.map(([field, label]) => {
          const following = draft.follow[field];
          return (
            <View key={field} style={styles.followRow}>
              <View style={styles.stateLine}>
                <Icon
                  name={following ? "group-events" : "edit"}
                  tone="textSecondary"
                  size="sm"
                />
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  {/* 38.14 D-29: every line names its field. */}
                  {followLineLabel(label, following)}
                </AppText>
              </View>
              {!following ? (
                <Button
                  role="tertiary"
                  label={`Follow event ${label.toLowerCase()}`}
                  onPress={() => followEvent(field)}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: SPACING.base },
  followFields: { gap: SPACING.sm },
  followRow: { gap: SPACING.xs },
  stateLine: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
});
