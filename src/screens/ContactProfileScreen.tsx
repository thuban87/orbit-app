/**
 * ContactProfileScreen (CRUD-01 scaffold) — the header the create flow lands on
 * (`navigation.replace("Profile", { contactId })`). This phase lays ONLY the
 * header + "Add details" refine affordance + the "Rarely responds" label + a
 * placeholder overflow `⋯`; the read surfaces (timeline, gravity/intensity,
 * fuel) are owned by later phases and appear here as clearly-labelled stubs.
 *
 * The `⋯` is a low-emphasis (`textSecondary`) `OverflowMenu` whose sole action
 * this phase is Archive (Plan 08) — a reversible `archived_at` flag flip that
 * hides the contact from every live surface, then navigates off the (now hidden)
 * profile back to Home. Archive is deliberately NOT styled destructive and is
 * never adjacent to purge (purge lands on the Archived list in Plan 09 — the
 * two-stage guarantee). "Add details" (accent text-link) opens the full edit
 * form (`Edit`), surfacing frequency/last-spoke/phone first — the name-only
 * refine path.
 *
 * The light `getContactHeader` read (name + rarely_responds) is the only data
 * this scaffold needs. Every colour resolves through `useTheme().colors.*`
 * (CLAUDE.md / check:colors).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { OverflowMenu } from "@/components/OverflowMenu";
import { TimelineRow } from "@/components/TimelineRow";
import {
  TouchpointRefineForm,
  type TouchpointRefineValue,
} from "@/components/TouchpointRefineForm";
import { getContactHeader } from "@/db/contact-read";
import { archiveContact } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  deleteTouchpoint,
  editTouchpointFull,
  recordTouchpoint,
} from "@/db/recency-dao";
import {
  listTimeline,
  type TimelineItem,
  type TimelineTouchpoint,
} from "@/db/timeline-read";
import { newUid } from "@/db/uid";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "contact-profile";

/** The light header read the scaffold renders. */
type Header = {
  id: number;
  name: string;
  rarely_responds: number;
  archived_at: string | null;
  /** Stored relative photo path (`avatars/…`) or null — drives the Avatar. */
  photo: string | null;
  /** Second-resolution row timestamp — the Avatar's cross-session cache-bust. */
  modified_at: string;
};

export function ContactProfileScreen({
  navigation,
  route,
}: RootStackScreenProps<"Profile">) {
  const { colors } = useTheme();
  const { contactId } = route.params;
  const [header, setHeader] = useState<Header | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  // In-flight latch for the one-tap log — blocks a double-fire while the write
  // is open, and dims the button.
  const [logging, setLogging] = useState(false);
  // The touchpoint currently open in the refine form (null = form closed) and
  // its controlled value. The parent owns both — the form is presentational.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [refineValue, setRefineValue] = useState<TouchpointRefineValue | null>(
    null,
  );
  // In-flight latch for the refine save — blocks a double-fire.
  const [savingEdit, setSavingEdit] = useState(false);

  // The SINGLE unified read: the header AND the interleaved timeline, so both
  // refresh together on focus and after an in-place log (LOG-02 read half).
  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [row, rows] = await Promise.all([
        getContactHeader(exec, contactId),
        listTimeline(exec, contactId),
      ]);
      setHeader(row);
      setTimeline(rows);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load contact", err);
      Alert.alert("Couldn't load this contact", "Please go back and retry.");
    }
  }, [contactId]);

  // Reload on focus, not just on mount: the only route into Edit is this
  // profile's "Add details", so Edit always sits directly above Profile in the
  // native stack. Saving via navigation.navigate("Profile", { contactId }) pops
  // back to THIS existing instance without remounting — an on-mount effect would
  // never re-run, leaving a renamed name / stale "Rarely responds" label. `load`
  // is a stable useCallback (keyed on contactId), so the focus effect is stable.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // One-tap "Log contact" (LOG-01) — the primary action of this slice. Records a
  // touchpoint through the SINGLE writer (recordTouchpoint) with the Cluster-G
  // one-tap defaults: direction='outbound' passed EXPLICITLY (the DAO defaults
  // direction to null, which would starve gravity), channel='unspecified',
  // connected=1, quality=null, source='manual'. occurredAt/now both come from
  // localDateTime() — never toISOString (DATA-05 local wall-clock contract).
  const doLogContact = useCallback(async () => {
    if (logging) {
      return; // Guard the double-fire while the write is in flight.
    }
    setLogging(true);
    try {
      const stamp = localDateTime();
      await recordTouchpoint(getExecutor(), {
        contactId,
        uid: newUid(),
        occurredAt: stamp,
        now: stamp,
        channel: "unspecified",
        direction: "outbound",
        connected: 1,
        quality: null,
        source: "manual",
      });
      // In-place log does NOT re-fire useFocusEffect (the screen stays focused),
      // so refresh every derived surface through the SINGLE unified load().
      await load();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to log contact", err);
      Alert.alert("Couldn't log contact", "Please try again.");
    } finally {
      setLogging(false);
    }
  }, [contactId, logging, load]);

  // Archive (the overflow's only action this phase): flip archived_at, then
  // leave the now-hidden profile back to Home. Reversible — Restore lives on the
  // Archived list (Settings), never here (two-stage guarantee).
  const doArchive = useCallback(async () => {
    try {
      await archiveContact(getExecutor(), contactId, localDateTime());
      navigation.popToTop();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to archive contact", err);
      Alert.alert("Couldn't archive", "Please try again.");
    }
  }, [contactId, navigation]);

  // Open the refine form for a touchpoint (LOG-01). Seed the controlled value
  // from the stored row verbatim — occurred_at flows in as-is, and the form
  // seeds its date+time dialogs via parseLocalDateTime (time-of-day preserved),
  // NOT types.ts parseDate.
  const openEdit = useCallback((tp: TimelineTouchpoint) => {
    setEditingId(tp.id);
    setRefineValue({
      occurredAt: tp.occurred_at,
      channel: tp.channel,
      direction: tp.direction,
      connected: tp.connected,
      quality: tp.quality,
      note: tp.note,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setRefineValue(null);
  }, []);

  // Save the refine edit through the SINGLE full edit path (editTouchpointFull),
  // which always recomputes recency, then refresh every derived surface through
  // the SINGLE unified load() — an in-place edit does NOT re-fire useFocusEffect,
  // so a partial reload would leave status/gravity/intensity stale.
  const saveEdit = useCallback(async () => {
    if (editingId === null || !refineValue || savingEdit) {
      return;
    }
    setSavingEdit(true);
    try {
      await editTouchpointFull(getExecutor(), {
        interactionId: editingId,
        contactId,
        now: localDateTime(),
        occurredAt: refineValue.occurredAt,
        channel: refineValue.channel,
        direction: refineValue.direction,
        connected: refineValue.connected,
        quality: refineValue.quality,
        note: refineValue.note,
      });
      setEditingId(null);
      setRefineValue(null);
      await load();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to save touchpoint edit", err);
      Alert.alert("Couldn't save", "Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }, [editingId, refineValue, savingEdit, contactId, load]);

  // Delete a touchpoint behind a confirm whose copy states the deletion is
  // PERMANENT and unrecoverable (dossier Cluster C — no undo, no backup, no
  // server). deleteTouchpoint recomputes recency (moving it back when the newest
  // row is removed); then the SINGLE unified load() refreshes every surface.
  const doDelete = useCallback(
    (tp: TimelineTouchpoint) => {
      Alert.alert(
        "Delete this touchpoint?",
        "This permanently deletes it. There's no undo and no backup — it can't be recovered.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await deleteTouchpoint(getExecutor(), {
                    interactionId: tp.id,
                    contactId,
                    now: localDateTime(),
                  });
                  // If the deleted row was open in the refine form, close it.
                  if (editingId === tp.id) {
                    setEditingId(null);
                    setRefineValue(null);
                  }
                  await load();
                } catch (err) {
                  Logger.error(LOG_SCOPE, "failed to delete touchpoint", err);
                  Alert.alert("Couldn't delete", "Please try again.");
                }
              })();
            },
          },
        ],
      );
    },
    [contactId, editingId, load],
  );

  return (
    <ScrollView
      testID="contact-profile-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="contact-profile-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>

        <Avatar
          photo={header?.photo ?? null}
          name={header?.name ?? ""}
          contactId={contactId}
          cacheBust={header?.modified_at}
          size={64}
        />

        <Text
          testID="contact-profile-name"
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          {header?.name ?? ""}
        </Text>

        <OverflowMenu
          actions={[
            {
              label: "Archive",
              testID: "contact-profile-archive",
              onPress: () => void doArchive(),
            },
          ]}
        />
      </View>

      {header?.rarely_responds === 1 ? (
        <Text
          testID="contact-profile-rarely-responds"
          style={[styles.rarelyLabel, { color: colors.textSecondary }]}
        >
          Rarely responds · attempts don't reset the orbit
        </Text>
      ) : null}

      <Pressable
        testID="contact-profile-add-details"
        accessibilityRole="button"
        accessibilityLabel="Add details"
        onPress={() => navigation.navigate("Edit", { contactId })}
        style={styles.addDetails}
      >
        <Text style={[styles.addDetailsText, { color: colors.accent }]}>
          Add details
        </Text>
      </Pressable>

      <Pressable
        testID="contact-profile-log-contact"
        accessibilityRole="button"
        accessibilityLabel="Log contact"
        accessibilityState={{ disabled: logging }}
        disabled={logging}
        onPress={() => void doLogContact()}
        style={[
          styles.logContact,
          {
            backgroundColor: logging ? colors.surface : colors.accent,
            borderColor: logging ? colors.border : colors.accent,
          },
        ]}
      >
        <Text
          style={[
            styles.logContactText,
            { color: logging ? colors.textSecondary : colors.background },
          ]}
        >
          Log contact
        </Text>
      </Pressable>

      {/* The real interleaved timeline (LOG-02 read half): touchpoints (editable
          next plan) + read-only events, newest-first. */}
      <View testID="contact-profile-timeline" style={styles.timeline}>
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          Timeline
        </Text>
        {timeline.length === 0 ? (
          <Text
            testID="contact-profile-timeline-empty"
            style={[styles.sectionBody, { color: colors.textSecondary }]}
          >
            No touchpoints yet
          </Text>
        ) : (
          timeline.map((item) => (
            <TimelineRow
              key={`${item.kind}-${item.id}`}
              item={item}
              // Edit + delete affordances on touchpoints ONLY — events stay
              // read-only (no callbacks passed).
              onEdit={
                item.kind === "touchpoint" ? () => openEdit(item) : undefined
              }
              onDelete={
                item.kind === "touchpoint" ? () => doDelete(item) : undefined
              }
            />
          ))
        )}
      </View>

      {editingId !== null && refineValue ? (
        <View
          testID="contact-profile-refine"
          style={[
            styles.refinePanel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Refine touchpoint
          </Text>
          <TouchpointRefineForm
            value={refineValue}
            onChange={setRefineValue}
            now={localDateTime()}
          />
          <View style={styles.refineActions}>
            <Pressable
              testID="contact-profile-refine-cancel"
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={cancelEdit}
              style={[styles.refineBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
            <Pressable
              testID="contact-profile-refine-save"
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: savingEdit }}
              disabled={savingEdit}
              onPress={() => void saveEdit()}
              style={[
                styles.refineBtn,
                {
                  backgroundColor: savingEdit ? colors.surface : colors.accent,
                  borderColor: savingEdit ? colors.border : colors.accent,
                },
              ]}
            >
              <Text
                style={{
                  color: savingEdit ? colors.textSecondary : colors.background,
                  fontWeight: "700",
                }}
              >
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
  },
  rarelyLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  addDetails: {
    minHeight: 44,
    justifyContent: "center",
  },
  addDetailsText: {
    fontSize: 16,
    fontWeight: "600",
  },
  logContact: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logContactText: {
    fontSize: 16,
    fontWeight: "700",
  },
  timeline: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionBody: {
    fontSize: 15,
  },
  refinePanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  refineActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  refineBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
