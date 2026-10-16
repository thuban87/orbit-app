// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button semantic roles are domain props.

/**
 * Profile Backgrounds (38.11 D-58.1, D-84) — the Settings page for the global
 * profile background, the Category backgrounds and the library of saved
 * backgrounds. Delete lives here (the themed destructive confirm, then the
 * derivative cleanup — ADR-112), behind each card's ⋯ menu (docs/systems/
 * ux-standards.md "Destructive actions" rule 4). Settings → Appearance's
 * "Default profile background" row opens it (D-84), and every stack that hosts
 * a Profile registers it (PROFILE_REACHABLE_ROUTES, RG-021) so the Profile's
 * background sheet can open it too.
 *
 * The list/delete/assign operations are the shared
 * `useProfileBackgroundLibrary` hook the Profile's background sheet also uses.
 *
 * "Choose photo" (D-79) runs the shared crop-and-name flow
 * (`ProfileBackgroundCreateFlow`) and then offers Set as global default, Use
 * for a category, or Not now — no person-level choices here. The flow and its
 * assign step render inside an expanded `Sheet` (review V-05): a Modal, so it
 * covers the tab bar and the +, its body is not a ScrollView (the crop's pan
 * and pinch have no scrolling parent), and its header chevron is the only Back
 * while it is open (38.9 D-07). The sheet's scrim and system Back run the same
 * guarded exit as that chevron: with a crop or name pending, the themed
 * "Discard changes?" and, on Discard, the pending file is deleted (ADR-112).
 *
 * Back is the `ShellAppBar` header Back only (38.9 D-07, D-16). Every colour
 * resolves through the theme (CLAUDE.md / check:colors).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { CategoryChoiceSheet } from "@/components/category/CategoryChoiceSheet";
import { OverflowMenu } from "@/components/OverflowMenu";
import {
  ProfileBackgroundCreateFlow,
  ProfileBackgroundFlowHeader,
  useProfileBackgroundCreateFlow,
} from "@/components/profile/ProfileBackgroundCreateFlow";
import { useProfileBackgroundLibrary } from "@/components/profile/use-profile-background-library";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ScopedPalette } from "@/components/ui/ScopedPalette";
import { Sheet } from "@/components/ui/Sheet";
import type { ProfileBackgroundTemplateRow } from "@/db/profile-presentation-read";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { resolveBackgroundListState } from "@/profile/background-manager-model";
import { resolveBackgroundUri } from "@/services/photos/background-storage";
import { showSnackbar } from "@/stores/snackbar-store";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "profile-backgrounds-screen";
const SAVE_FAILED =
  "Couldn't save your changes. Nothing was applied. Try again.";

type SavedBackground = { uid: string; name: string };

type CategoryPicker =
  | { mode: "clear" }
  | { mode: "assign"; template: SavedBackground };

export function ProfileBackgroundsScreen() {
  const bottomClearance = useBottomClearance();
  const library = useProfileBackgroundLibrary({
    active: true,
    includeAssignments: true,
  });
  const {
    templates,
    categories,
    globalTemplateUid,
    categoryTemplateUids,
    listLoading,
    listError,
    refresh,
    deleteTemplate,
    assignGlobal,
    assignCategory,
  } = library;
  const [categoryPicker, setCategoryPicker] = useState<CategoryPicker | null>(
    null,
  );
  // One write at a time (a double tap must not write twice).
  const busyRef = useRef(false);
  // The background just created, while its assign step shows.
  const [saved, setSaved] = useState<SavedBackground | null>(null);
  const flow = useProfileBackgroundCreateFlow({
    defaultName: "New background",
    onSaved: async (uid, name) => {
      setSaved({ uid, name });
      showSnackbar({ kind: "success", label: `Saved ${name}` });
      await refresh();
    },
  });
  const { reset: resetFlow, requestCancel } = flow;
  // A route removal with a crop or name pending asks first (38.9 D-13). The
  // create sheet is a Modal, so its own scrim/system Back normally answer
  // first; this covers any other removal while work is pending.
  const bypassRef = useRef(false);
  useDiscardKeepGuard({ hasUnsavedChanges: flow.dirty, bypassRef });

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const nameOf = (uid: string | null): string | null =>
    uid === null
      ? null
      : (templates.find((template) => template.uid === uid)?.name ?? null);
  const globalName = nameOf(globalTemplateUid);
  const categoriesWithBackground = categories.filter(
    (category) =>
      nameOf(categoryTemplateUids.get(category.id) ?? null) !== null,
  );

  const runWrite = useCallback(
    async (write: () => Promise<void>, success: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        await write();
        showSnackbar({ kind: "success", label: success });
      } catch (error) {
        Logger.error(LOG_SCOPE, "background assignment failed", error);
        showSnackbar({ kind: "error", label: SAVE_FAILED });
      } finally {
        busyRef.current = false;
      }
    },
    [],
  );

  const setGlobal = (template: ProfileBackgroundTemplateRow) =>
    void runWrite(
      () => assignGlobal(template.uid),
      `Set ${template.name} as the global background`,
    );
  const clearGlobal = () =>
    void runWrite(() => assignGlobal(null), "Cleared the global background");

  const choosePhoto = async () => {
    if ((await flow.chooseImage()) === "failed") {
      showSnackbar({
        kind: "error",
        label: "Couldn't open your photos. Please try again.",
      });
    }
  };
  /** The create sheet's one exit: guarded while the flow runs, else Not now. */
  const closeCreate = () => {
    if (flow.step !== "idle") {
      requestCancel(resetFlow);
      return;
    }
    setSaved(null);
  };
  const setSavedAsGlobal = (template: SavedBackground) => {
    setSaved(null);
    void runWrite(
      () => assignGlobal(template.uid),
      `Set ${template.name} as the global background`,
    );
  };

  const onDelete = async (template: ProfileBackgroundTemplateRow) => {
    if (await deleteTemplate(template)) {
      showSnackbar({ kind: "warning", label: `Deleted ${template.name}` });
    }
  };

  const listState = resolveBackgroundListState({
    loading: listLoading,
    error: listError,
    templateCount: templates.length,
  });

  return (
    <View testID="profile-backgrounds-screen" style={styles.root}>
      <ShellAppBar variant="child" title="Profile Backgrounds" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        <GlassSurface style={styles.section}>
          <AppText role="label" accessibilityRole="header">
            Global background
          </AppText>
          <AppText role="body" testID="profile-backgrounds-global-name">
            {globalName ?? "None"}
          </AppText>
          <AppText role="body">
            Used for any contact without their own or a Category background.
          </AppText>
          {globalName !== null ? (
            <Button
              role="secondary"
              label="Clear global background"
              onPress={clearGlobal}
            />
          ) : null}
        </GlassSurface>

        <GlassSurface style={styles.section}>
          <AppText role="label" accessibilityRole="header">
            Category backgrounds
          </AppText>
          {categories.length === 0 ? (
            <AppText role="body">No categories available</AppText>
          ) : categoriesWithBackground.length === 0 ? (
            <AppText role="body">No Category has its own background.</AppText>
          ) : (
            <>
              {categoriesWithBackground.map((category) => (
                <View key={category.id} style={styles.assignmentRow}>
                  <AppText role="body" style={styles.flex}>
                    {category.name}
                  </AppText>
                  <AppText role="body">
                    {nameOf(categoryTemplateUids.get(category.id) ?? null)}
                  </AppText>
                </View>
              ))}
              <Button
                role="secondary"
                label="Clear category background"
                onPress={() => setCategoryPicker({ mode: "clear" })}
              />
            </>
          )}
        </GlassSurface>

        <GlassSurface style={styles.section}>
          <AppText role="label" accessibilityRole="header">
            Saved backgrounds
          </AppText>
          <Button
            role="primary"
            label="Choose photo"
            accessibilityLabel="Choose photo for a new background"
            onPress={() => void choosePhoto()}
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
              <ScopedPalette>
                {(scoped) => (
                  <AppText style={{ color: scoped.danger }}>
                    {listState.message}
                  </AppText>
                )}
              </ScopedPalette>
              <Button
                role="secondary"
                label="Retry"
                onPress={() => void refresh()}
              />
            </>
          ) : null}
        </GlassSurface>

        {listState.kind === "populated"
          ? templates.map((template) => (
              <GlassSurface
                key={template.uid}
                density="dense"
                style={styles.card}
              >
                <Image
                  source={{ uri: resolveBackgroundUri(template.imagePath) }}
                  style={styles.thumbnail}
                />
                <View style={styles.cardText}>
                  <AppText role="label">{template.name}</AppText>
                  <Button
                    role="tertiary"
                    label="Set as global default"
                    accessibilityLabel={`Set ${template.name} as the global default`}
                    onPress={() => setGlobal(template)}
                  />
                  {categories.length > 0 ? (
                    <Button
                      role="tertiary"
                      label="Use for a category"
                      accessibilityLabel={`Use ${template.name} for a category`}
                      onPress={() =>
                        setCategoryPicker({ mode: "assign", template })
                      }
                    />
                  ) : null}
                </View>
                <OverflowMenu
                  actions={[
                    {
                      label: "Delete",
                      accessibilityLabel: `Delete ${template.name}`,
                      onPress: () => void onDelete(template),
                    },
                  ]}
                />
              </GlassSurface>
            ))
          : null}
      </ScrollView>
      <Sheet
        visible={flow.step !== "idle" || saved !== null}
        onRequestClose={closeCreate}
        variant="expanded"
      >
        <View style={styles.createRoot} accessibilityViewIsModal>
          <ProfileBackgroundCreateFlow
            flow={flow}
            onCancel={closeCreate}
            standalone
          />
          {flow.step === "idle" && saved !== null ? (
            <View style={styles.assignStep}>
              <ProfileBackgroundFlowHeader
                title={`Use ${saved.name}`}
                onBack={closeCreate}
              />
              <AppText role="body">
                Use it now, or later from Saved backgrounds.
              </AppText>
              <Button
                role="primary"
                label="Set as global default"
                onPress={() => setSavedAsGlobal(saved)}
              />
              {categories.length > 0 ? (
                <Button
                  role="secondary"
                  label="Use for a category"
                  onPress={() =>
                    setCategoryPicker({ mode: "assign", template: saved })
                  }
                />
              ) : null}
              <Button role="tertiary" label="Not now" onPress={closeCreate} />
            </View>
          ) : null}
        </View>
      </Sheet>
      <CategoryChoiceSheet
        visible={categoryPicker !== null}
        categories={
          categoryPicker?.mode === "clear"
            ? categoriesWithBackground
            : categories
        }
        selectedId={null}
        allowUncategorized={false}
        getAccessibilityLabel={(category) =>
          categoryPicker?.mode === "assign"
            ? `Use ${categoryPicker.template.name} for ${category.name}`
            : `Clear ${category.name} background`
        }
        title={
          categoryPicker?.mode === "assign"
            ? "Use for a category"
            : "Clear category background"
        }
        onRequestClose={() => setCategoryPicker(null)}
        onSelect={(categoryId) => {
          const picker = categoryPicker;
          setCategoryPicker(null);
          if (categoryId === null || picker === null) return;
          const category = categories.find((c) => c.id === categoryId);
          const categoryName = category?.name ?? "the category";
          if (picker.mode === "assign") {
            // Choosing from the new background's assign step finishes it.
            if (saved?.uid === picker.template.uid) setSaved(null);
            void runWrite(
              () => assignCategory(categoryId, picker.template.uid),
              `Set ${picker.template.name} for ${categoryName}`,
            );
          } else {
            void runWrite(
              () => assignCategory(categoryId, null),
              `Cleared the ${categoryName} background`,
            );
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: SPACING.sm, padding: SPACING.md },
  section: { gap: SPACING.xs, padding: SPACING.md },
  assignmentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  flex: { flex: 1 },
  card: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.sm,
  },
  cardText: { flex: 1, gap: SPACING.xs },
  thumbnail: { borderRadius: RADII.md, height: 56, width: 84 },
  createRoot: { flex: 1, gap: SPACING.sm },
  assignStep: { gap: SPACING.sm },
});
