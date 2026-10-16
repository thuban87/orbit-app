// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button semantic roles are domain props.

import { useCallback, useEffect, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { CategoryChoiceSheet } from "@/components/category/CategoryChoiceSheet";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { Sheet } from "@/components/ui/Sheet";
import { getExecutor, localDateTime } from "@/db/database";
import { assignContactBackgroundTemplate } from "@/db/profile-presentation-dao";
import {
  resolveBackgroundListState,
  shouldResetBackgroundManagerViewOnOpen,
} from "@/profile/background-manager-model";
import { resolveBackgroundUri } from "@/services/photos/background-storage";
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

type Page = "list" | "assign";

function clearCategoryAccessibilityLabel(category: { name: string }): string {
  return `Clear ${category.name} background`;
}

export interface ProfileBackgroundManagerProps {
  visible: boolean;
  contactId: number;
  contactName: string;
  onRequestClose: () => void;
  onCommitted?: () => void;
}

/**
 * Profile-owned background template management. Picker bytes are copied into the
 * app-owned namespace before a template row references them; Cancel and failure
 * never mutate the previously committed selection or its bytes.
 *
 * The crop and name steps are the shared `ProfileBackgroundCreateFlow` (its
 * state hook lives here, outside the sheet, so an unsaved crop survives the
 * sheet hiding), and the list/delete/global/category operations are the shared
 * `useProfileBackgroundLibrary`; the Settings Profile Backgrounds page uses
 * both too (38.11 D-58.1, D-79).
 */
export function ProfileBackgroundManager({
  visible,
  contactId,
  contactName,
  onRequestClose,
  onCommitted,
}: ProfileBackgroundManagerProps) {
  const { colors } = useTheme();
  const [page, setPage] = useState<Page>("list");
  // The shared list/delete/global/category operations (38.11 D-58.1), also
  // used by the Settings Profile Backgrounds page.
  const {
    templates,
    categories,
    listLoading,
    listError,
    refresh,
    deleteTemplate,
    assignGlobal,
    assignCategory,
  } = useProfileBackgroundLibrary({ active: visible, onCommitted });
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryPickerMode, setCategoryPickerMode] = useState<
    "assign" | "clear" | null
  >(null);
  const wasVisibleRef = useRef(false);

  // The shared crop-and-name flow; a save goes on to this sheet's assign page.
  const flow = useProfileBackgroundCreateFlow({
    defaultName: `${contactName}'s background`,
    onSaved: async (uid) => {
      setSelectedUid(uid);
      setPage("assign");
      await refresh();
      onCommitted?.();
    },
  });
  const { reset: resetFlow, setError } = flow;
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

  const assign = useCallback(
    async (
      scope:
        | "global"
        | "clear-global"
        | "category"
        | "clear-category"
        | "contact"
        | "inherit",
      categoryId?: number,
    ) => {
      const needsSelectedTemplate =
        scope === "global" || scope === "category" || scope === "contact";
      if ((needsSelectedTemplate && !selectedUid) || saving) return;
      setSaving(true);
      try {
        if (scope === "global" || scope === "clear-global") {
          await assignGlobal(scope === "clear-global" ? null : selectedUid);
        } else if (
          (scope === "category" || scope === "clear-category") &&
          categoryId !== undefined
        ) {
          await assignCategory(
            categoryId,
            scope === "clear-category" ? null : selectedUid,
          );
        } else {
          await assignContactBackgroundTemplate(getExecutor(), {
            contactId,
            templateUid: scope === "inherit" ? null : selectedUid,
            now: localDateTime(),
          });
          await refresh();
        }
        onCommitted?.();
        setPage("list");
      } catch (error) {
        Logger.error(LOG_SCOPE, "background assignment failed", error);
        setError("Couldn't save your changes. Nothing was applied. Try again.");
      } finally {
        setSaving(false);
      }
    },
    [
      assignCategory,
      assignGlobal,
      contactId,
      onCommitted,
      refresh,
      saving,
      selectedUid,
      setError,
    ],
  );

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
    <>
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
              <AppText role="label">Background assignment</AppText>
              <AppText role="body">
                Clear an assignment to use the next available Category, global,
                or active theme background. Layout choices stay unchanged.
              </AppText>
              <Button
                role="secondary"
                label="Clear global background"
                onPress={() => void assign("clear-global")}
              />
              {categories.length === 0 ? (
                <AppText role="body">No categories available</AppText>
              ) : (
                <Button
                  role="secondary"
                  label="Clear category background"
                  onPress={() => setCategoryPickerMode("clear")}
                />
              )}
              <Button
                role="secondary"
                label={`Inherit Category, global, or theme background for ${contactName}`}
                onPress={() => void assign("inherit")}
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
                ? templates.map((template) => (
                    <GlassSurface
                      key={template.uid}
                      density="dense"
                      style={styles.row}
                    >
                      <Image
                        source={{
                          uri: resolveBackgroundUri(template.imagePath),
                        }}
                        style={styles.thumbnail}
                      />
                      <View style={styles.rowText}>
                        <AppText role="label">{template.name}</AppText>
                        <Button
                          role="tertiary"
                          label="Assign"
                          onPress={() => {
                            setSelectedUid(template.uid);
                            setPage("assign");
                          }}
                        />
                        <Button
                          role="tertiary"
                          label="Delete"
                          onPress={() => void deleteTemplate(template)}
                        />
                      </View>
                    </GlassSurface>
                  ))
                : null}
            </ScrollView>
          ) : null}
          <ProfileBackgroundCreateFlow flow={flow} onCancel={closeOrGuard} />
          {page === "assign" && flow.step === "idle" && selected ? (
            <ScrollView
              style={styles.workspace}
              contentContainerStyle={styles.content}
            >
              <AppText role="heading">Assign {selected.name}</AppText>
              <Button
                role="secondary"
                label="Set as global default"
                onPress={() => void assign("global")}
              />
              <AppText role="label">Set for this category</AppText>
              {categories.length === 0 ? (
                <AppText role="body">No categories available</AppText>
              ) : (
                <Button
                  role="tertiary"
                  label="Choose category"
                  onPress={() => setCategoryPickerMode("assign")}
                />
              )}
              <Button
                role="primary"
                label={`Use for ${contactName}`}
                onPress={() => void assign("contact")}
              />
              <Button
                role="secondary"
                label={`Use inherited background for ${contactName}`}
                onPress={() => void assign("inherit")}
              />
            </ScrollView>
          ) : null}
        </View>
      </Sheet>
      <CategoryChoiceSheet
        visible={categoryPickerMode !== null}
        categories={categories}
        selectedId={null}
        allowUncategorized={false}
        getAccessibilityLabel={
          categoryPickerMode === "clear"
            ? clearCategoryAccessibilityLabel
            : (category) => `Assign background to ${category.name}`
        }
        title={
          categoryPickerMode === "clear"
            ? "Clear category background"
            : "Assign background to category"
        }
        onRequestClose={() => setCategoryPickerMode(null)}
        onSelect={(categoryId) => {
          const mode = categoryPickerMode;
          setCategoryPickerMode(null);
          if (categoryId !== null && mode)
            void assign(
              mode === "clear" ? "clear-category" : "category",
              categoryId,
            );
        }}
      />
    </>
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
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.sm,
  },
  rowText: { flex: 1, gap: SPACING.xs },
  thumbnail: { borderRadius: RADII.md, height: 56, width: 84 },
});
