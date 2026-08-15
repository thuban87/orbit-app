/**
 * ContactProfileScreen (CRUD-01 scaffold) — the header the create flow lands on
 * (`navigation.replace("Profile", { contactId })`). This phase lays ONLY the
 * header + "Add details" refine affordance + the "Rarely responds" label + a
 * placeholder overflow `⋯`; the read surfaces (timeline, gravity/intensity,
 * fuel) are owned by later phases and appear here as clearly-labelled stubs.
 *
 * The `⋯` is a low-emphasis (`textSecondary`) placeholder with a 44px hit area
 * and an `accessibilityLabel` (UI-SPEC D2 flag) — its real Archive action lands
 * in Plan 08, so it is inert here. "Add details" (accent text-link) opens the
 * full edit form (`Edit`), surfacing frequency/last-spoke/phone first — the
 * name-only refine path.
 *
 * The light `getContactHeader` read (name + rarely_responds) is the only data
 * this scaffold needs. Every colour resolves through `useTheme().colors.*`
 * (CLAUDE.md / check:colors).
 */
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor } from "@/db/database";
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
};

export function ContactProfileScreen({
  navigation,
  route,
}: RootStackScreenProps<"Profile">) {
  const { colors } = useTheme();
  const { contactId } = route.params;
  const [header, setHeader] = useState<Header | null>(null);

  const load = useCallback(async () => {
    try {
      const row = await getContactHeader(getExecutor(), contactId);
      setHeader(row);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load contact header", err);
      Alert.alert("Couldn't load this contact", "Please go back and retry.");
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

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

        <Text
          testID="contact-profile-name"
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          {header?.name ?? ""}
        </Text>

        <Pressable
          testID="contact-profile-overflow"
          accessibilityRole="button"
          accessibilityLabel="More actions"
          hitSlop={16}
          onPress={() => {
            // Placeholder — the real overflow menu (Archive) lands in Plan 08.
          }}
          style={styles.overflowBtn}
        >
          <Text style={[styles.overflowGlyph, { color: colors.textSecondary }]}>
            ⋯
          </Text>
        </Pressable>
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
  overflowBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  overflowGlyph: {
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
