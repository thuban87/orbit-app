// biome-ignore-all lint/a11y/useValidAriaRole: AppText uses semantic typography roles.
import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ALL_CONTACTS_SYSTEM } from "@/logic/orrery-system-logic";
import type { OrrerySystemState } from "@/stores/orrery-system-store";
import { SPACING } from "@/theme/tokens/spacing";
import { companionRows } from "./orrery-companion-logic";
import { systemEmptyCopy } from "./orrery-controls-logic";

/** Complete conventional access to the SAME committed System, including its sun. */
export function OrreryContactsSheet({
  visible,
  state,
  measured,
  onClose,
  onAction,
  relationshipContextById,
}: {
  visible: boolean;
  state: OrrerySystemState;
  measured: boolean;
  onClose: () => void;
  onAction: (kind: "focus" | "profile", id: number) => void;
  relationshipContextById?: Readonly<Record<number, ReactNode>>;
}) {
  const { height } = useWindowDimensions();
  const scene = state.snapshot;
  const empty = state.status === "ready" && scene?.contacts.length === 0;
  const qualifyingSun = !!scene?.systemSnapshot.members.some(
    (member) => member.id === scene.systemSnapshot.resolvedSunIdentity?.id,
  );
  const emptyCopy = systemEmptyCopy(
    state.requested.name,
    state.requested.id === "builtin:all-contacts",
    qualifyingSun,
  );
  return (
    <Sheet visible={visible} onRequestClose={onClose} variant="detail">
      <ScrollView
        style={{ maxHeight: height * 0.45 }}
        contentContainerStyle={styles.content}
      >
        <AppText role="heading">Contacts in this System</AppText>
        <AppText>{state.requested.name}</AppText>
        {state.status === "initial" || state.status === "loading" ? (
          <AppText>Loading contacts…</AppText>
        ) : null}
        {state.status === "error" || state.status === "stale" ? (
          <>
            <AppText>
              {state.status === "stale"
                ? "Couldn't refresh this System. Showing the last loaded contacts."
                : "Couldn't load this System. Try loading it again."}
            </AppText>
            <Button
              role="secondary"
              label="Reload System"
              onPress={() => void state.reload()}
            />
          </>
        ) : null}
        {state.status === "missing-category" ? (
          <>
            <AppText>This System is no longer available.</AppText>
            <Button
              role="secondary"
              label="Show All Contacts"
              onPress={() => void state.select(ALL_CONTACTS_SYSTEM)}
            />
          </>
        ) : null}
        {empty ? (
          <>
            <AppText role="heading">{emptyCopy.heading}</AppText>
            <AppText>{emptyCopy.body}</AppText>
          </>
        ) : null}
        {companionRows(scene).map(({ member, context }) => (
          <View key={member.uid} style={styles.row}>
            <Avatar
              photo={member.photo}
              name={member.name}
              contactId={member.uid}
              cacheBust={scene?.dataRevision}
              size={44}
            />
            <AppText>{member.name}</AppText>
            {context ? <AppText role="caption">{context}</AppText> : null}
            {relationshipContextById?.[member.id]}
            <Button
              role="secondary"
              label="Focus in Orrery"
              accessibilityLabel={`Focus in Orrery: ${member.name}`}
              disabled={state.status !== "ready" || !measured}
              onPress={() => onAction("focus", member.id)}
            />
            <Button
              role="secondary"
              label="Open Profile"
              accessibilityLabel={`Open Profile: ${member.name}`}
              disabled={state.status !== "ready"}
              onPress={() => onAction("profile", member.id)}
            />
          </View>
        ))}
        <Button role="secondary" label="Close contact list" onPress={onClose} />
      </ScrollView>
    </Sheet>
  );
}
const styles = StyleSheet.create({
  content: { gap: SPACING.base },
  row: { gap: SPACING.sm },
});
