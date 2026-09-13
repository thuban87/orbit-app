/**
 * UpdateContactScreen — the compact Update Contact chooser (CAPT-12/13,
 * dossier §Y/§Z/§AA). After the contact is known, Update Contact opens a
 * registry-driven action surface rather than the full Edit Contact form. Each
 * row opens a focused editor; a successful inner save returns to the chooser
 * with the SAME contact targeted (recent-success cue) and the user exits only
 * via Done. Category is never a row — it stays in Edit Contact.
 *
 * Row assembly, applicability filtering, and the repeated-update session model
 * live in the node-tested pure `update-contact-chooser-logic.ts`; this file is
 * the RN shell + navigation, device-UAT at the phase gate.
 *
 * TASK 1 (tracer): the chooser renders every row; Memory navigates to the full
 * Memory editor and Done exits. The remaining focused editors are wired in
 * Task 3.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ContactPicker } from "@/components/ContactPicker";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui";
import { getExecutor } from "@/db/database";
import { listDefs } from "@/db/field-defs-dao";
import { getValuesForContact } from "@/db/field-values-dao";
import type { DashboardScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  buildChooserRows,
  type ChooserRow,
  finishSession,
  openRow,
  selectApplicableDefs,
  startSession,
  targetContact,
} from "./update-contact-chooser-logic";

const LOG_SCOPE = "update-contact-screen";

export function UpdateContactScreen({
  navigation,
  route,
}: DashboardScreenProps<"UpdateContact">) {
  const { colors } = useTheme();
  const [session, setSession] = useState(() =>
    startSession(route.params?.contactId ?? null),
  );
  const [rows, setRows] = useState<ChooserRow[]>([]);

  const contactId = session.contactId;

  const load = useCallback(
    async (id: number, cancelled: () => boolean = () => false) => {
      const exec = getExecutor();
      const defs = await listDefs(exec, { includeQuarantined: false });
      const values = await getValuesForContact(exec, id, defs);
      if (cancelled()) return;
      setRows(buildChooserRows({ id }, selectApplicableDefs(defs, values)));
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      if (contactId === null) return;
      let cancelled = false;
      void load(contactId, () => cancelled).catch((error) => {
        Logger.error(LOG_SCOPE, "failed to build chooser rows", error);
        if (!cancelled) setRows(buildChooserRows({ id: contactId }, []));
      });
      return () => {
        cancelled = true;
      };
    }, [contactId, load]),
  );

  const onPickContact = (id: number) => setSession((s) => targetContact(s, id));
  const onDone = () => {
    setSession((s) => finishSession(s));
    navigation.goBack();
  };

  const onSelectRow = (row: ChooserRow) => {
    if (contactId === null) return;
    if (row.kind === "memory") {
      navigation.navigate("Memory", { contactId });
      return;
    }
    // Task 3 wires the remaining focused editors; the tracer only routes Memory.
    setSession((s) => openRow(s, row.key));
  };

  if (contactId === null) {
    return (
      <View style={styles.root}>
        <ShellAppBar variant="child" title="Update Contact" />
        <ContactPicker
          visible
          mode="single"
          onSelect={onPickContact}
          onDismiss={() => navigation.goBack()}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Update Contact" />
      <ScrollView contentContainerStyle={styles.content}>
        {rows.map((row) => {
          const recent = session.lastSavedRowKey === row.key;
          const enabled = row.kind === "memory";
          return (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              accessibilityState={{ disabled: !enabled }}
              disabled={!enabled}
              onPress={() => onSelectRow(row)}
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: recent ? colors.accent : colors.border,
                  opacity: enabled ? 1 : 0.5,
                },
              ]}
            >
              <AppText role="body">{row.label}</AppText>
              {recent ? (
                <AppText role="caption" style={{ color: colors.accent }}>
                  Updated
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={onDone}
          style={[styles.done, { borderColor: colors.accent }]}
        >
          <AppText role="body" style={{ color: colors.accentText }}>
            Done
          </AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: SPACING.sm, padding: SPACING.base },
  row: {
    alignItems: "center",
    borderRadius: RADII.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: SPACING.base,
  },
  done: {
    alignItems: "center",
    borderRadius: RADII.md,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: SPACING.md,
    minHeight: 48,
  },
});
