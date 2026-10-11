import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import {
  GroupMergeCollisionError,
  type MergeResolutions,
} from "@/db/merge-dao";
import { navigationRef } from "@/navigation/linking";
import { resetToDashboardWith } from "@/navigation/reset-intents";
import type { RootStackScreenProps } from "@/navigation/types";
import { mergeContactsWithPhotoOwnership } from "@/services/photos/merge-photo-rehome";
import { confirm } from "@/stores/confirm-store";
import { useTheme } from "@/theme";
import { persistentDangerScrim } from "@/theme/danger-scrim";
import { plural } from "@/utils/plural";
import { ShellAppBar } from "./ShellAppBar";

type Counts = {
  interactions: number;
  fuel: number;
  events: number;
  methods: number;
  links: number;
};

export function MergeImpactSummary({
  navigation,
  route,
}: RootStackScreenProps<"MergeImpactSummary">) {
  const theme = useTheme();
  const { colors } = theme;
  const { survivorId, absorbedId, resolutions } = route.params;
  const [names, setNames] = useState({
    survivor: "Contact",
    absorbed: "Contact",
  });
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  useEffect(() => {
    const exec = getExecutor();
    void Promise.all([
      getContactHeader(exec, survivorId),
      getContactHeader(exec, absorbedId),
      ...[
        "interactions",
        "fuel",
        "events",
        "contact_methods",
        "external_contact_links",
      ].map((table) =>
        exec.getFirstAsync<{ n: number }>(
          `SELECT COUNT(*) AS n FROM ${table} WHERE contact_id = ?`,
          [absorbedId],
        ),
      ),
    ]).then(([survivor, absorbed, ...rows]) => {
      setNames({
        survivor: survivor?.name ?? "Contact",
        absorbed: absorbed?.name ?? "Contact",
      });
      setCounts({
        interactions: rows[0]?.n ?? 0,
        fuel: rows[1]?.n ?? 0,
        events: rows[2]?.n ?? 0,
        methods: rows[3]?.n ?? 0,
        links: rows[4]?.n ?? 0,
      });
    });
  }, [absorbedId, survivorId]);
  const typedResolutions: MergeResolutions = resolutions;
  // In flight from the confirm until the merge settles (38.9 review WR-01):
  // the ref blocks a second press synchronously; the state dims and disables
  // "Merge contacts" (D-26) so it never looks live while a merge runs.
  const mergingRef = useRef(false);
  const [merging, setMerging] = useState(false);
  const settleMerge = () => {
    mergingRef.current = false;
    setMerging(false);
  };
  // Irreversible: themed destructive confirm, not dismissable (D-30, ADR-086).
  const confirmMerge = () => {
    if (mergingRef.current) return;
    mergingRef.current = true;
    setMerging(true);
    void confirm({
      title: "Merge contacts?",
      message: "This cannot be undone.",
      confirmLabel: "Merge",
      destructive: true,
    }).then((ok) => {
      if (!ok) {
        settleMerge();
        return;
      }
      void mergeContactsWithPhotoOwnership(getExecutor(), {
        survivorId,
        absorbedId,
        resolutions: typedResolutions,
        now: localDateTime(),
      })
        .then(() =>
          navigationRef.current?.reset(
            resetToDashboardWith({
              name: "Profile",
              params: { contactId: survivorId },
            }),
          ),
        )
        .catch((error: unknown) => {
          settleMerge();
          setFailureMessage(
            error instanceof GroupMergeCollisionError
              ? error.message
              : "Couldn't merge these contacts. Nothing was changed. Try again.",
          );
        });
    });
  };
  const rows = counts
    ? [
        plural(counts.interactions, "interaction", "interactions"),
        plural(counts.fuel, "fuel item", "fuel items"),
        plural(counts.events, "event", "events"),
        plural(counts.methods, "contact method", "contact methods"),
        plural(counts.links, "external link", "external links"),
      ]
    : [];
  return (
    <View style={styles.screen}>
      {/* House header with the ✕ Cancel (38.9 D-16, D-59): it abandons the
          merge and goes back; nothing is written until the Merge confirm. */}
      <ShellAppBar
        variant="child"
        title={`Merge ${names.absorbed} into ${names.survivor}`}
        backKind="cancel"
      />
      <View style={styles.root}>
        {rows.map((row) => (
          <View
            key={row}
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.textPrimary }}>{row}</Text>
          </View>
        ))}
        <View
          style={[
            styles.warning,
            { borderColor: colors.danger },
            persistentDangerScrim(theme),
          ]}
        >
          <Text
            style={{ color: colors.danger }}
          >{`${names.absorbed} will be retired.`}</Text>
          <Text style={{ color: colors.textSecondary }}>
            This can&apos;t be simply undone.
          </Text>
        </View>
        {failureMessage ? (
          <Text style={{ color: colors.danger }}>{failureMessage}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: merging }}
          disabled={merging}
          onPress={confirmMerge}
          style={[
            styles.cta,
            {
              backgroundColor: merging ? colors.surfaceElevated : colors.accent,
            },
          ]}
        >
          <Text
            style={{ color: merging ? colors.textSecondary : colors.onAccent }}
          >
            Merge contacts
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  root: { flex: 1, padding: 20, gap: 12 },
  row: { padding: 14, borderRadius: 12, borderWidth: 1 },
  warning: { padding: 14, borderLeftWidth: 3, gap: 4 },
  cta: { padding: 16, borderRadius: 12, alignItems: "center" },
});
