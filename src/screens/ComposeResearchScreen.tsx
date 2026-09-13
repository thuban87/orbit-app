/**
 * ComposeResearchScreen (COMP-08 / COMP-11, plan 35-06) — the read-only "Things
 * to Remember" Research side of Compose.
 *
 * This is a COMPACT, read-only PROJECTION over the normalized `ResearchItem[]`
 * from `compose-research-read` — NOT the full `ThingsToRememberScreen` editor. It
 * reuses ONLY the read boundary; it imports no editor component, no mutation DAO,
 * and exposes no add / edit / delete. It shows only populated conversation-relevant
 * groups (empty groups are simply absent) with Off Limits rendered as a distinct,
 * read-only "Avoid" group that never exposes Add to AI.
 *
 *   - Eligibility is CONSUMED, never re-derived: an Add to AI / "Added ✓" toggle is
 *     rendered only where `ResearchItem.aiEligible` is true; the screen never reads
 *     a raw per-source permission column and never excludes off-limits in the UI
 *     (both eligibility and the off-limits marking are structural at the read
 *     boundary — see ResearchItem.aiEligible / .isOffLimits).
 *   - The toggle drives the session-only Message Focus store (COMP-11 / D-10);
 *     Add to AI grants NO permission and performs NO network op.
 *   - It is a pure OFFLINE read path: a single local SQLite read on focus, no
 *     blocking network call, all colours via theme tokens, all text in AppText
 *     roles, every control padded to the 44px touch-target floor.
 */
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { AppText } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { MIN_TOUCH_TARGET } from "@/components/ui/button-roles";
import {
  readComposeResearch,
  type ResearchItem,
} from "@/db/compose-research-read";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor } from "@/db/database";
import type { RootStackScreenProps } from "@/navigation/types";
import { useComposeSession } from "@/stores/compose-session-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "compose-research";

export interface ComposeResearchScreenProps {
  /** The contact whose knowledge the Research side projects. */
  contactId: number;
}

/** The minimal contact identity the Research header renders for orientation. */
interface ResearchHeader {
  name: string;
  photo: string | null;
  modified_at: string;
}

/**
 * Navigation adapter (plan 35-09 wiring): extracts the SERIALIZABLE `contactId`
 * route param and renders the plain-prop screen, so `ComposeResearchScreen` keeps
 * the stable plain `contactId` contract plan 35-06 established while resolving as a
 * registered `ComposeResearch` route in both stacks.
 */
export function ComposeResearchRoute({
  route,
}: RootStackScreenProps<"ComposeResearch">) {
  return <ComposeResearchScreen contactId={route.params.contactId} />;
}

/** One consecutive run of items sharing a display group. */
interface ResearchGroup {
  name: string;
  items: ResearchItem[];
}

/** Fold the already-ordered item list into consecutive display groups. */
function groupItems(items: ResearchItem[]): ResearchGroup[] {
  const groups: ResearchGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) {
      last.items.push(item);
    } else {
      groups.push({ name: item.group, items: [item] });
    }
  }
  return groups;
}

export function ComposeResearchScreen({
  contactId,
}: ComposeResearchScreenProps) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [header, setHeader] = useState<ResearchHeader | null>(null);
  const messageFocus = useComposeSession((state) => state.messageFocus);
  const addToFocus = useComposeSession((state) => state.addToFocus);
  const startSession = useComposeSession((state) => state.startSession);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Scope Message Focus to this contact (idempotent for the same contact) so
      // the session-only selection survives the Compose↔Research transition (D-10).
      startSession(contactId);
      const exec = getExecutor();
      void readComposeResearch(exec, contactId)
        .then((rows) => {
          if (!cancelled) setItems(rows);
        })
        .catch((error) => {
          Logger.error(LOG_SCOPE, "failed to load research", error);
          if (!cancelled) setItems([]);
        });
      // The SAME contact-identity header Compose shows (orientation parity across
      // the two sibling sides — D-14-010). Local SQLite read; never blocks render.
      void getContactHeader(exec, contactId)
        .then((row) => {
          if (!cancelled && row !== null) {
            setHeader({
              name: row.name,
              photo: row.photo,
              modified_at: row.modified_at,
            });
          }
        })
        .catch((error) => {
          Logger.error(LOG_SCOPE, "failed to load contact header", error);
        });
      return () => {
        cancelled = true;
      };
    }, [contactId, startSession]),
  );

  const groups = useMemo(() => groupItems(items), [items]);
  const selectedIds = useMemo(
    () => new Set(messageFocus.map((item) => item.id)),
    [messageFocus],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Contact-identity header — the SAME Back + Avatar + name heading Compose
            shows, so the two sibling sides stay oriented (D-14-010). Back pops to
            Compose with the session (draft + Message Focus) preserved (COMP-07). */}
        <View style={styles.header}>
          <Button
            role="tertiary"
            label="Back"
            accessibilityLabel="Back to compose"
            onPress={() => navigation.goBack()}
          />
          {header !== null ? (
            <>
              <Avatar
                photo={header.photo}
                name={header.name}
                contactId={contactId}
                cacheBust={header.modified_at}
                size={48}
              />
              <AppText role="heading" accessibilityRole="header">
                {header.name}
              </AppText>
            </>
          ) : null}
        </View>
        {items.length === 0 ? (
          <AppText role="caption">nothing to remember yet</AppText>
        ) : (
          <>
            <AppText role="label">Things to Remember</AppText>
            {groups.map((group) => (
              <View key={group.name} style={styles.group}>
                <AppText role="label" style={{ color: colors.textSecondary }}>
                  {group.name}
                </AppText>
                {group.items.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <View style={styles.rowText}>
                      <AppText role="label">{item.label}</AppText>
                      {item.value ? (
                        <AppText role="caption">{item.value}</AppText>
                      ) : null}
                    </View>
                    {item.aiEligible ? (
                      <AddToAiToggle
                        selected={selectedIds.has(item.id)}
                        onPress={() => addToFocus(item)}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * The Add to AI / "Added ✓" toggle. Text-only accent LINK tone (accentText); the
 * selected state uses a RESTRAINED accent-tinted surface + border (dossier §O),
 * never the full accent fill — a treatment the standard Button roles do not
 * express, so this is a purpose-built token-driven control (no colour literal, all
 * text in an AppText role, padded to the 44px floor).
 */
function AddToAiToggle({
  selected,
  onPress,
}: {
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? "Added to AI — tap to remove" : "Add to AI"}
      style={[
        styles.toggle,
        {
          backgroundColor: selected ? colors.surfaceElevated : colors.background,
          borderColor: selected ? colors.accentText : colors.background,
        },
      ]}
    >
      <AppText role="label" style={{ color: colors.accentText }}>
        {selected ? "Added ✓" : "Add to AI"}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: SPACING.base,
    gap: SPACING.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  group: {
    gap: SPACING.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  rowText: {
    flex: 1,
    gap: SPACING.xs,
  },
  toggle: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADII.md,
  },
});
