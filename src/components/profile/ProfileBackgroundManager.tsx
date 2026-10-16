// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button semantic roles are domain props.

import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { Sheet } from "@/components/ui/Sheet";
import { getExecutor, localDateTime } from "@/db/database";
import { assignContactBackgroundTemplate } from "@/db/profile-presentation-dao";
import type { RootStackParamList } from "@/navigation/types";
import {
  assignContactBackground,
  type ContactBackgroundWriter,
  isContactBackground,
  resolveBackgroundListState,
  shouldResetBackgroundManagerViewOnOpen,
} from "@/profile/background-manager-model";
import { resolveBackgroundUri } from "@/services/photos/background-storage";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  ProfileBackgroundCreateFlow,
  useProfileBackgroundCreateFlow,
} from "./ProfileBackgroundCreateFlow";
import { useProfileBackgroundLibrary } from "./use-profile-background-library";

const LOG_SCOPE = "profile-background-manager";

/** `list`: the saved backgrounds; `created`: the choices after a new one is named. */
type Page = "list" | "created";

export interface ProfileBackgroundManagerProps {
  visible: boolean;
  contactId: number;
  contactName: string;
  /** This person's own background (null when they inherit one); marks the current card. */
  contactBackgroundTemplateUid: string | null;
  onRequestClose: () => void;
  onCommitted?: () => void;
}

/**
 * The Profile's Background sheet: choosing a background for this person only
 * (38.11 D-58.2-4). Global and Category backgrounds and Delete live on the
 * Settings Profile Backgrounds page, which "Manage global backgrounds" opens
 * (the route is registered in every Profile-hosting stack, 38.11-06). Each
 * saved-background card's Assign applies it to this person at once with a
 * confirming snackbar (RESEARCH A2, "this plan only"); the card in use is
 * marked selected. Choose photo stays (D-79): after the new background is
 * named the sheet offers only Use for {name} and Not now.
 *
 * Picker bytes are copied into the app-owned namespace before a template row
 * references them; Cancel and failure never mutate the previously committed
 * selection or its bytes. The crop and name steps are the shared
 * `ProfileBackgroundCreateFlow` (its state hook lives here, outside the sheet,
 * so an unsaved crop survives the sheet hiding), and the list is the shared
 * `useProfileBackgroundLibrary`.
 */
export function ProfileBackgroundManager({
  visible,
  contactId,
  contactName,
  contactBackgroundTemplateUid,
  onRequestClose,
  onCommitted,
}: ProfileBackgroundManagerProps) {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [page, setPage] = useState<Page>("list");
  const { templates, listLoading, listError, refresh } =
    useProfileBackgroundLibrary({ active: visible, onCommitted });
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  // One write at a time (a double tap must not write twice).
  const busyRef = useRef(false);
  const wasVisibleRef = useRef(false);

  // The shared crop-and-name flow; a save goes on to the `created` page.
  const flow = useProfileBackgroundCreateFlow({
    defaultName: `${contactName}'s background`,
    onSaved: async (uid) => {
      setSelectedUid(uid);
      setPage("created");
      await refresh();
      onCommitted?.();
    },
  });
  const { reset: resetFlow } = flow;
  const managerState = flow.state;

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    const opening = !wasVisibleRef.current;
    wasVisibleRef.current = true;
    if (!opening) return;
    if (shouldResetBackgroundManagerViewOnOpen(managerState)) {
      resetFlow();
      setPage("list");
      setSelectedUid(null);
    }
    void refresh();
  }, [managerState, refresh, resetFlow, visible]);

  // Contact-scoped writes only (38.11 D-58.3): this person's own background.
  // Built from `contactId` and the screen's `onCommitted`, never sheet state.
  const writer = useMemo<ContactBackgroundWriter>(
    () => ({
      write: (templateUid) =>
        assignContactBackgroundTemplate(getExecutor(), {
          contactId,
          templateUid,
          now: localDateTime(),
        }),
      onCommitted,
      notify: showSnackbar,
      logError: (message, error) => Logger.error(LOG_SCOPE, message, error),
    }),
    [contactId, onCommitted],
  );

  const assignToContact = useCallback(
    async (templateUid: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        await assignContactBackground(writer, { templateUid, contactName });
      } finally {
        busyRef.current = false;
      }
      setPage("list");
      setSelectedUid(null);
    },
    [contactName, writer],
  );

  // The Settings page manages global and Category backgrounds and Delete
  // (38.11 D-58.2); it is registered in every stack that hosts a Profile.
  const manageGlobalBackgrounds = () => {
    onRequestClose();
    navigation.navigate("ProfileBackgrounds");
  };

  const notNow = () => {
    setPage("list");
    setSelectedUid(null);
  };

  // The shared themed discard prompt (D-13, D-52), via the flow's guarded exit.
  const closeOrGuard = () => flow.requestCancel(onRequestClose);

  const selected =
    templates.find((template) => template.uid === selectedUid) ?? null;
  const listState = resolveBackgroundListState({
    loading: listLoading,
    error: listError,
    templateCount: templates.length,
  });

  return (
    <Sheet visible={visible} onRequestClose={closeOrGuard} variant="expanded">
      <View style={styles.root} accessibilityViewIsModal>
        {flow.step !== "crop" ? (
          <View style={styles.heading}>
            <AppText role="heading">Profile backgrounds</AppText>
            <Button role="secondary" label="Back" onPress={closeOrGuard} />
          </View>
        ) : null}
        {flow.step !== "crop" && managerState.error ? (
          <AppText style={{ color: colors.danger }}>
            {managerState.error}
          </AppText>
        ) : null}
        {page === "list" && flow.step === "idle" ? (
          <ScrollView
            style={styles.workspace}
            contentContainerStyle={styles.content}
          >
            <AppText role="body">
              Background templates are separate from layout templates.
            </AppText>
            <Button
              role="primary"
              label="Choose photo"
              onPress={() => void flow.chooseImage()}
            />
            <Button
              role="secondary"
              label="Manage global backgrounds"
              onPress={manageGlobalBackgrounds}
            />
            {listState.kind === "loading" ? (
              <AppText role="body">Loading backgrounds…</AppText>
            ) : null}
            {listState.kind === "empty" ? (
              <AppText role="body">
                No saved backgrounds yet. Choose a photo to create one.
              </AppText>
            ) : null}
            {listState.kind === "error" ? (
              <>
                <AppText style={{ color: colors.danger }}>
                  {listState.message}
                </AppText>
                <Button
                  role="secondary"
                  label="Retry"
                  onPress={() => void refresh()}
                />
              </>
            ) : null}
            {listState.kind === "populated"
              ? templates.map((template) => {
                  const current = isContactBackground(
                    template.uid,
                    contactBackgroundTemplateUid,
                  );
                  // D-58.4: two columns by two rows — the picture on the
                  // left spanning both rows; the name top-right and Assign
                  // bottom-right, centred. No Delete (D-58.3).
                  return (
                    <GlassSurface
                      key={template.uid}
                      density="dense"
                      selected={current}
                      style={styles.card}
                      contentStyle={styles.cardContent}
                    >
                      <Image
                        source={{
                          uri: resolveBackgroundUri(template.imagePath),
                        }}
                        style={styles.thumbnail}
                      />
                      <View style={styles.cardRight}>
                        <AppText role="label" style={styles.cardName}>
                          {template.name}
                        </AppText>
                        <Button
                          role="tertiary"
                          label="Assign"
                          accessibilityLabel={`Assign ${template.name} to ${contactName}`}
                          accessibilityHint={
                            current ? "Current background" : undefined
                          }
                          selected={current}
                          onPress={() => void assignToContact(template.uid)}
                        />
                      </View>
                    </GlassSurface>
                  );
                })
              : null}
          </ScrollView>
        ) : null}
        <ProfileBackgroundCreateFlow flow={flow} onCancel={closeOrGuard} />
        {page === "created" && flow.step === "idle" && selected ? (
          <ScrollView
            style={styles.workspace}
            contentContainerStyle={styles.content}
          >
            <AppText role="heading">Assign {selected.name}</AppText>
            <Button
              role="primary"
              label={`Use for ${contactName}`}
              onPress={() => void assignToContact(selected.uid)}
            />
            <Button role="tertiary" label="Not now" onPress={notNow} />
          </ScrollView>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: SPACING.sm },
  workspace: { flex: 1 },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  content: { gap: SPACING.sm, paddingBottom: SPACING.xl },
  card: { padding: SPACING.sm },
  // The row lives on the surface's content wrapper: GlassSurface lays its
  // children out inside that wrapper, so a row on `style` would not apply.
  cardContent: { alignItems: "stretch", flexDirection: "row", gap: SPACING.sm },
  // The picture spans both rows of the card (D-58.4).
  thumbnail: {
    alignSelf: "stretch",
    borderRadius: RADII.md,
    minHeight: 64,
    width: 96,
  },
  cardRight: { alignItems: "center", flex: 1, justifyContent: "center" },
  cardName: { textAlign: "center" },
});
