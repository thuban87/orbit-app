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
import { getContactHeader } from "@/db/contact-read";
import { archiveContact } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { recordTouchpoint } from "@/db/recency-dao";
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
  // In-flight latch for the one-tap log — blocks a double-fire while the write
  // is open, and dims the button.
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    try {
      const row = await getContactHeader(getExecutor(), contactId);
      setHeader(row);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load contact header", err);
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

      {/* Read surfaces (timeline / gravity / fuel) are later-phase — scaffold only. */}
      <View
        testID="contact-profile-timeline-stub"
        style={[
          styles.sectionStub,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          Timeline
        </Text>
        <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
          Coming in a later phase.
        </Text>
      </View>
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
  sectionStub: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
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
});
